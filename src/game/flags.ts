/**
 * Feature flags / remote config (https://yandex.ru/dev/games/doc/ru/sdk/sdk-config).
 *
 * The game ships a **local configuration** (`LOCAL_FLAGS`) — every flag with a safe value — and asks
 * the platform for the remote one once at startup, passing the player data that the Yandex Console
 * can target on (paying status, language, runs played…). Precedence, as the docs describe it:
 *
 *     remote config  >  last successfully fetched remote config (cache)  >  LOCAL_FLAGS
 *
 * The cache is what makes a failed fetch harmless: a player on a flaky connection keeps the flags
 * they already had instead of suddenly falling back to defaults (for example, back into ads that
 * were switched off for their group). When the platform does answer, the fresh configuration is
 * authoritative — including flags the Console no longer defines, which fall back to LOCAL_FLAGS.
 */

import { getLang } from './i18n';
import { storageGet, storageSet } from './storage';
import { yaGetFlags, type YaClientFeature, type YaFlags } from './yandex';
import { getTotals } from './profile';
import { promoClientFeature } from './promo';

/**
 * Local configuration: the flags the game can live with when neither the remote config nor the
 * cache is available. Keys are dots-separated groups; values are always strings (SDK contract).
 */
export const LOCAL_FLAGS: YaFlags = {
  /** ads (used by src/game/ads.ts) */
  'adv.enabled': 'true',
  'adv.interstitial.enabled': 'true',
  /** seconds between two fullscreen ads */
  'adv.interstitialCooldownSec': '180',
  'adv.rewarded.enabled': 'true',
  /** sticky banner control through the SDK (Console option «Использовать API для показа sticky-баннера») */
  'adv.banner.enabled': 'true',
  /** shop / in-app purchases (used by src/game/shop.ts) */
  'shop.enabled': 'true',
  /** explore-mode shift length in minutes */
  'game.exploreMinutes': '20',
  /** development overlay only; production hides it even if remote config requests it */
  'ui.showFps': 'false',
  /** co-op survival (used by src/game/net/*) */
  'multiplayer.enabled': 'true',
  'multiplayer.maxPlayers': '5',
};

const CACHE_KEY = 'orerush.flags.v1';

let flags: YaFlags = { ...LOCAL_FLAGS };
/**
 * The single in-flight request. The documentation recommends asking the platform once at startup;
 * callers that arrive while it is running share that promise instead of racing each other into
 * two `getFlags()` calls and silently reading the local configuration.
 */
let pending: Promise<YaFlags> | null = null;
/** Set once the request has been made at all, so later callers never trigger a second one. */
let requested = false;

function readCache(): YaFlags | null {
  const raw = storageGet(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { flags?: YaFlags };
    if (!parsed?.flags || typeof parsed.flags !== 'object') return null;
    const clean: YaFlags = {};
    for (const [key, value] of Object.entries(parsed.flags)) {
      if (typeof value === 'string') clean[key] = value;
    }
    return Object.keys(clean).length ? clean : null;
  } catch {
    return null;
  }
}

/** Current value of a flag (never undefined: falls back to the local configuration). */
export function flag(key: keyof typeof LOCAL_FLAGS | string): string {
  return flags[key] ?? LOCAL_FLAGS[key] ?? '';
}

export function flagBool(key: string): boolean {
  return flag(key).toLowerCase() === 'true';
}

export function flagNumber(key: string, fallback = 0): number {
  const raw = flag(key);
  if (raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** The whole map, e.g. for tests and diagnostics. */
export function allFlags(): YaFlags {
  return { ...flags };
}

/**
 * Fetch the remote configuration once, as the documentation advises. Resolves to the flags actually
 * in force; never throws. Safe outside Yandex Games — the local configuration stays.
 *
 * `payingStatus` comes from the player profile and lets the Yandex Console target monetisation
 * flags at paying / non-paying groups (documentation: «Клиентские параметры»); it is optional so the
 * flags can load even when the profile is unavailable.
 */
export async function loadFlags(payingStatus?: string): Promise<YaFlags> {
  if (pending) return pending;
  if (requested) return flags;
  requested = true;
  pending = fetchFlags(payingStatus).finally(() => {
    pending = null;
  });
  return pending;
}

async function fetchFlags(payingStatus?: string): Promise<YaFlags> {
  const totals = getTotals();
  const features: YaClientFeature[] = [
    { name: 'lang', value: getLang() },
    { name: 'runs', value: String(totals.runs) },
    { name: 'bestScore', value: String(totals.bestScore) },
    { name: 'blocksMined', value: String(totals.blocksMined) },
  ];
  if (payingStatus) features.push({ name: 'payingStatus', value: payingStatus });
  // promo deep link: the Console can target flags at the players who came from a campaign
  const promo = promoClientFeature();
  if (promo) features.push(promo);

  const remote = await yaGetFlags(LOCAL_FLAGS, features);
  if (remote) {
    // the platform already merged defaultFlags under the remote values, so this object is complete
    flags = { ...LOCAL_FLAGS, ...remote };
    storageSet(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), flags: remote }));
  } else {
    // no answer: keep the last configuration the player actually had instead of jumping to defaults
    flags = { ...LOCAL_FLAGS, ...(readCache() ?? {}) };
  }
  return flags;
}
