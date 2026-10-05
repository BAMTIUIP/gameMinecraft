/**
 * Advertising (https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv).
 *
 * The rules that shape this module, straight from the docs and requirement 4.4:
 *  - an ad must follow a **user action** (a click), never a timer while the player is busy, and never
 *    while the player is actively interacting — accidental clicks are treated as ad fraud;
 *  - a fullscreen ad is a break: the game must be at a stopped-gameplay moment (menu, results screen);
 *  - rewarded video is the only kind the player opts into, and the reward is granted in `onRewarded`,
 *    not in `onClose`;
 *  - every call can fail (no fill, too frequent, no network) and must leave the game exactly as it was.
 *
 * So the module keeps its own guard-rails on top of the platform ones: a flag gate, an "already
 * showing" lock, a cooldown with a hard floor, and silencing of the game's audio while an ad plays.
 * When there is no SDK at all (itch, own hosting, `npm run dev`) everything degrades to a no-op.
 */

import { holdAudioForAd } from './audio';
import { flagBool, flagNumber } from './flags';
import { hasAdFreeEntitlement } from './adFree';
import {
  yaAdvAvailable,
  yaRewardedAdAvailable,
  yaGetBannerAdvStatus,
  yaHideBannerAdv,
  yaShowBannerAdv,
  yaShowFullscreenAdv,
  yaShowRewardedVideo,
} from './yandex';

export type AdOutcome = {
  /** whether onClose reported wasShown=true */
  shown: boolean;
  /** rewarded video only: the platform counted the view */
  rewarded: boolean;
  /** why nothing happened — useful for logging and for the UI hint */
  skipped?: 'flag' | 'ad-free' | 'cooldown' | 'busy' | 'offline' | 'error';
};

const MIN_COOLDOWN_SEC = 60; // our own floor: the platform is stricter, but never be annoying
const SESSION_GRACE_MS = 30_000; // no fullscreen ad in the first 30 s of a session

let lastFullscreenAt = 0;
let sessionStartedAt = Date.now();
let inFlight = false;
let wantedBannerVisible: boolean | null = null;
let bannerSyncInFlight: Promise<void> | null = null;
/** `ADV_IS_NOT_CONNECTED` from `getBannerAdvStatus()`: the Console has no banners, so retrying is pointless. */
let bannerDisabledReason: string | null = null;

/** True when an ad is on screen right now — the game must not start anything interactive. */
export function adInFlight(): boolean {
  return inFlight;
}

/** True only when flags permit rewarded ads and the SDK exposes its rewarded-video method. */
export function rewardedAdsAvailable(): boolean {
  return flagBool('adv.enabled') && flagBool('adv.rewarded.enabled') && yaRewardedAdAvailable();
}

/** Seconds until the next fullscreen ad may be requested (0 = ready). */
export function fullscreenCooldownLeft(): number {
  const cooldown = Math.max(MIN_COOLDOWN_SEC, flagNumber('adv.interstitialCooldownSec', 180));
  const since = Date.now() - lastFullscreenAt;
  const grace = Math.max(0, SESSION_GRACE_MS - (Date.now() - sessionStartedAt));
  return Math.max(grace / 1000, Math.ceil((cooldown * 1000 - since) / 1000), 0);
}

/** Called once per session (App boot) so the grace period starts from the real beginning. */
export function markAdSessionStart() {
  sessionStartedAt = Date.now();
  lastFullscreenAt = 0;
}

/**
 * Fullscreen (interstitial) ad. Call it from a click in a non-gameplay state: between runs, from the
 * results screen. Resolves after the ad is closed (or immediately when it was skipped).
 */
export async function showFullscreenAd(): Promise<AdOutcome> {
  if (hasAdFreeEntitlement()) return { shown: false, rewarded: false, skipped: 'ad-free' };
  if (!flagBool('adv.enabled') || !flagBool('adv.interstitial.enabled')) return { shown: false, rewarded: false, skipped: 'flag' };
  if (inFlight) return { shown: false, rewarded: false, skipped: 'busy' };
  if (!yaAdvAvailable()) return { shown: false, rewarded: false, skipped: 'offline' };
  if (fullscreenCooldownLeft() > 0) return { shown: false, rewarded: false, skipped: 'cooldown' };

  inFlight = true;
  holdAudioForAd(true);
  try {
    const result = await yaShowFullscreenAdv();
    lastFullscreenAt = Date.now();
    return { shown: result.shown, rewarded: false, skipped: result.error ? 'error' : undefined };
  } finally {
    inFlight = false;
    holdAudioForAd(false);
  }
}

/**
 * Rewarded video: the player explicitly asks for a reward. Returns `rewarded: true` only when the
 * platform counted the view — a skipped or closed-early ad never pays out.
 */
export async function showRewardedAd(): Promise<AdOutcome> {
  if (!flagBool('adv.enabled') || !flagBool('adv.rewarded.enabled')) return { shown: false, rewarded: false, skipped: 'flag' };
  if (inFlight) return { shown: false, rewarded: false, skipped: 'busy' };
  if (!yaRewardedAdAvailable()) return { shown: false, rewarded: false, skipped: 'offline' };

  inFlight = true;
  holdAudioForAd(true);
  try {
    const result = await yaShowRewardedVideo();
    return { shown: result.shown, rewarded: result.rewarded, skipped: result.error ? 'error' : undefined };
  } finally {
    inFlight = false;
    holdAudioForAd(false);
  }
}

/**
 * Sticky banner: the platform shows it for the whole session by default. When "Use the API" is on in
 * the Console, the game decides — here the banner belongs to the menu (so it never covers the HUD or
 * the crosshair) and is hidden as soon as a run starts.
 */
export function syncBanner(visible: boolean): Promise<void> {
  // A disabled flag or permanent ad-free purchase must actively hide a banner the platform may
  // already be showing by default. React phase/flag/ownership changes can overlap while SDK calls
  // are pending, so serialize them and reconcile again if the desired visibility changes mid-request.
  wantedBannerVisible = visible && !hasAdFreeEntitlement() && flagBool('adv.enabled') && flagBool('adv.banner.enabled');
  if (bannerSyncInFlight) return bannerSyncInFlight;

  bannerSyncInFlight = (async () => {
    try {
      while (wantedBannerVisible !== null) {
        const desired: boolean = wantedBannerVisible;
        // Banners not connected in the Console: `getBannerAdvStatus()` says so with a reason, and
        // the documentation's example only calls showBannerAdv() when there is none. Remember it —
        // otherwise every phase change would retry a hopeless request.
        if (desired && bannerDisabledReason) return;
        const status = await yaGetBannerAdvStatus();
        if (wantedBannerVisible !== desired) continue;
        if (!status) return;
        if (status.reason === 'ADV_IS_NOT_CONNECTED') {
          bannerDisabledReason = status.reason;
          return;
        }
        if (desired !== status.showing) {
          if (desired) await yaShowBannerAdv();
          else await yaHideBannerAdv();
        }
        if (wantedBannerVisible === desired) return;
      }
    } finally {
      bannerSyncInFlight = null;
    }
  })();
  return bannerSyncInFlight;
}
