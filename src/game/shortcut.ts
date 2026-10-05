/**
 * Desktop shortcut (https://yandex.ru/dev/games/doc/ru/sdk/sdk-shortcut).
 *
 * The platform can drop a link to the game (or to the Yandex Games catalogue on the first call) onto
 * the player's desktop through a native dialog. Whether that is possible at all depends on the device,
 * the browser and the platform, so `canShowPrompt()` comes first and the button is drawn only when the
 * answer is yes; the dialog opens from a click.
 *
 * What the game adds around it:
 *  - the prompt is offered at most once every two weeks (`QUIET_PERIOD_MS`) — a nagging button is
 *    worse than no shortcut;
 *  - accepting queues a one-time starter-supplies reward for the next run;
 *  - the player who already accepted is never asked again — the state lives in `safeStorage`.
 */

import { COAL, COOKED_MEAT, PLANKS, TORCH } from './blocks';
import { queueShortcutBonusItems, type RewardedDropItem } from './adDrops';
import { storageGet, storageSet } from './storage';
import { yaCanShowShortcutPrompt, yaServerTime, yaShowShortcutPrompt } from './yandex';

const STORAGE_KEY = 'orerush.shortcut.v1';
/** Do not offer the dialog again for this long after it was shown. */
const QUIET_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
/** One-time starter supplies for adding the game to the desktop. */
export const SHORTCUT_REWARD_ITEMS: readonly RewardedDropItem[] = [
  [PLANKS, 24],
  [COAL, 16],
  [COOKED_MEAT, 8],
  [TORCH, 12],
];

/**
 * `offline` = there is no SDK or the method is missing (own hosting, itch, dev). `unsupported` = the
 * platform answered and the device/browser cannot drop a shortcut at all — a different situation
 * that only looks the same in the UI, and telling them apart keeps diagnostics honest.
 */
export type ShortcutOffer = { available: boolean; reason: 'cooldown' | 'accepted' | 'offline' | 'unsupported' | 'done' | null };
export type ShortcutResult = 'accepted' | 'dismissed' | 'unavailable' | 'failed';

type ShortcutState = { at: number; accepted: boolean; rewardQueued: boolean };

let offerCache: ShortcutOffer | null = null;
let offerCheckInFlight: Promise<ShortcutOffer> | null = null;
let requestInFlight: Promise<ShortcutResult> | null = null;
let promptedThisSession = false;

function state(): ShortcutState {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) return { at: 0, accepted: false, rewardQueued: false };
  try {
    const parsed = JSON.parse(raw) as Partial<ShortcutState>;
    return {
      at: typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0,
      accepted: parsed.accepted === true,
      rewardQueued: parsed.rewardQueued === true,
    };
  } catch {
    return { at: 0, accepted: false, rewardQueued: false };
  }
}

function saveState(next: ShortcutState) {
  storageSet(STORAGE_KEY, JSON.stringify(next));
}

function ensureAcceptedShortcutReward() {
  const saved = state();
  if (!saved.accepted || saved.rewardQueued) return;
  const rewardQueued = queueShortcutBonusItems(SHORTCUT_REWARD_ITEMS);
  if (rewardQueued) saveState({ ...saved, rewardQueued: true });
}

/** Test seam: forget the cached answer and the session flag (the storage stays). */
export function resetShortcutState() {
  offerCache = null;
  offerCheckInFlight = null;
  requestInFlight = null;
  promptedThisSession = false;
}

/** Has the shortcut already been added on this device? (the reward was paid then) */
export function shortcutAccepted(): boolean {
  ensureAcceptedShortcutReward();
  return state().accepted;
}

/**
 * Should the menu offer the shortcut button? Asks the platform once per session, then remembers the
 * answer. Never throws; outside Yandex Games it reports `offline`.
 */
export async function shortcutOffer(): Promise<ShortcutOffer> {
  ensureAcceptedShortcutReward();
  if (promptedThisSession) return { available: false, reason: 'done' };
  const saved = state();
  if (saved.accepted) return { available: false, reason: 'accepted' };
  if (yaServerTime() - saved.at < QUIET_PERIOD_MS) return { available: false, reason: 'cooldown' };
  if (offerCache) return offerCache;
  if (offerCheckInFlight) return offerCheckInFlight;

  const check = (async (): Promise<ShortcutOffer> => {
    const canShow = await yaCanShowShortcutPrompt();
    offerCache = canShow === null
      ? { available: false, reason: 'offline' }
      : { available: canShow, reason: canShow ? null : 'unsupported' };
    return offerCache;
  })();
  offerCheckInFlight = check;
  try {
    return await check;
  } finally {
    if (offerCheckInFlight === check) offerCheckInFlight = null;
  }
}

/**
 * Open the desktop-shortcut dialog. Returns 'accepted' when the shortcut was created — that is the
 * only outcome that pays the reward, and it is paid exactly once. Concurrent clicks share one prompt.
 */
export async function requestShortcut(): Promise<ShortcutResult> {
  if (requestInFlight) return requestInFlight;
  if (promptedThisSession) return 'unavailable';

  const request = (async (): Promise<ShortcutResult> => {
    const offer = await shortcutOffer();
    if (!offer.available || promptedThisSession) return 'unavailable';

    promptedThisSession = true;
    const result = await yaShowShortcutPrompt();
    if (!result) return 'failed'; // the dialog never opened: nothing is remembered; a later session can retry

    offerCache = { available: false, reason: 'done' };
    const saved = state();
    if (result.accepted) {
      // The stable grant key makes retries safe if storage briefly fails during acceptance.
      const rewardQueued = saved.rewardQueued || queueShortcutBonusItems(SHORTCUT_REWARD_ITEMS);
      saveState({ at: yaServerTime(), accepted: true, rewardQueued });
    } else {
      saveState({ at: yaServerTime(), accepted: saved.accepted, rewardQueued: saved.rewardQueued });
    }
    return result.accepted ? 'accepted' : 'dismissed';
  })();

  requestInFlight = request;
  try {
    return await request;
  } finally {
    if (requestInFlight === request) requestInFlight = null;
  }
}
