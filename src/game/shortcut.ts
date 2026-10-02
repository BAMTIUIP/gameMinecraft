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
 *  - accepting pays a one-time reward in diamonds (`SHORTCUT_REWARD`), granted with the 'grant'
 *    reason so shop statistics (`diamondsBought`) are not inflated by it;
 *  - the player who already accepted is never asked again — the state lives in `safeStorage`, next to
 *    the balance it feeds.
 */

import { addDiamonds } from './profile';
import { storageGet, storageSet } from './storage';
import { yaCanShowShortcutPrompt, yaShowShortcutPrompt } from './yandex';

const STORAGE_KEY = 'orerush.shortcut.v1';
/** Do not offer the dialog again for this long after it was shown. */
const QUIET_PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
/** One-time thank-you for adding the game to the desktop. */
export const SHORTCUT_REWARD = 250;

export type ShortcutOffer = { available: boolean; reason: 'cooldown' | 'accepted' | 'offline' | 'done' | null };
export type ShortcutResult = 'accepted' | 'dismissed' | 'unavailable' | 'failed';

type ShortcutState = { at: number; accepted: boolean };

let offerCache: ShortcutOffer | null = null;
let promptedThisSession = false;

function state(): ShortcutState {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) return { at: 0, accepted: false };
  try {
    const parsed = JSON.parse(raw) as Partial<ShortcutState>;
    return {
      at: typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0,
      accepted: parsed.accepted === true,
    };
  } catch {
    return { at: 0, accepted: false };
  }
}

function saveState(next: ShortcutState) {
  storageSet(STORAGE_KEY, JSON.stringify(next));
}

/** Test seam: forget the cached answer and the session flag (the storage stays). */
export function resetShortcutState() {
  offerCache = null;
  promptedThisSession = false;
}

/** Has the shortcut already been added on this device? (the reward was paid then) */
export function shortcutAccepted(): boolean {
  return state().accepted;
}

/**
 * Should the menu offer the shortcut button? Asks the platform once per session, then remembers the
 * answer. Never throws; outside Yandex Games it reports `offline`.
 */
export async function shortcutOffer(): Promise<ShortcutOffer> {
  if (promptedThisSession) return { available: false, reason: 'done' };
  const saved = state();
  if (saved.accepted) return { available: false, reason: 'accepted' };
  if (Date.now() - saved.at < QUIET_PERIOD_MS) return { available: false, reason: 'cooldown' };
  if (offerCache) return offerCache;

  const canShow = await yaCanShowShortcutPrompt();
  offerCache = canShow === null ? { available: false, reason: 'offline' } : { available: canShow, reason: canShow ? null : 'offline' };
  return offerCache;
}

/**
 * Open the desktop-shortcut dialog. Returns 'accepted' when the shortcut was created — that is the
 * only outcome that pays the reward, and it is paid exactly once.
 */
export async function requestShortcut(): Promise<ShortcutResult> {
  if (promptedThisSession) return 'unavailable';
  const offer = await shortcutOffer();
  if (!offer.available) return 'unavailable';

  promptedThisSession = true;
  const result = await yaShowShortcutPrompt();
  if (!result) return 'failed'; // the dialog never opened: nothing is remembered, a retry is fine

  offerCache = { available: false, reason: 'done' };
  const alreadyAccepted = state().accepted;
  saveState({ at: Date.now(), accepted: alreadyAccepted || result.accepted });
  if (result.accepted && !alreadyAccepted) {
    // a one-time thank-you: 'grant', so it does not count towards the paid-diamonds statistics
    addDiamonds(SHORTCUT_REWARD, 'grant');
  }
  return result.accepted ? 'accepted' : 'dismissed';
}
