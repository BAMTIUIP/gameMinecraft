/**
 * Rating the game (https://yandex.ru/dev/games/doc/ru/sdk/sdk-review).
 *
 * The platform's rule is short: `requestReview()` may open its dialog **once per session**, and only
 * after `canReview()` said yes (otherwise the call may come back with
 * `use canReview before requestReview`). The game adds two habits of its own on top:
 *
 *  - the dialog is never thrown in the player's face — the shift ends, and a small "rate the game"
 *    button appears on the results screen; the platform dialog opens only from that click;
 *  - after a request the game stays quiet for a week (the player either rated the game or closed the
 *    dialog — either way asking again on every run would be nagging).
 *
 * Who exactly may be asked is the platform's decision (`NO_AUTH`, `GAME_RATED`,
 * `REVIEW_ALREADY_REQUESTED`, `REVIEW_WAS_REQUESTED`), and the answer is cached for the session.
 */

import { yaCanReview, yaRequestReview, yaServerTime, type YaReviewReason } from './yandex';
import { storageGet, storageSet } from './storage';

const STORAGE_KEY = 'orerush.review.v1';
/** Do not offer the dialog again for this long after it was shown. */
const QUIET_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export type ReviewOffer = { available: boolean; reason: YaReviewReason | 'cooldown' | 'offline' | 'done' | null };
export type ReviewResult = 'sent' | 'dismissed' | 'unavailable' | 'failed';

let offerCache: ReviewOffer | null = null;
let offerCheckInFlight: Promise<ReviewOffer> | null = null;
let requestInFlight: Promise<ReviewResult> | null = null;
let requestedThisSession = false;

/**
 * Last time the dialog was shown (0 = never) — persisted, so a week later it may be offered again.
 * A `GAME_RATED` answer is stored too: the platform never asks a player who has already rated the
 * game, so the button would keep coming back for nothing.
 */
function lastAsked(): { at: number; reason?: YaReviewReason } {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) return { at: 0 };
  try {
    const parsed = JSON.parse(raw) as { at?: number; reason?: YaReviewReason };
    const at = typeof parsed.at === 'number' && Number.isFinite(parsed.at) ? parsed.at : 0;
    return { at, ...(parsed.reason ? { reason: parsed.reason } : {}) };
  } catch {
    return { at: 0 };
  }
}

/** Test seam: forget the cached answer and the session flag (the storage stays). */
export function resetReviewState() {
  offerCache = null;
  offerCheckInFlight = null;
  requestInFlight = null;
  requestedThisSession = false;
}

/**
 * Should the results screen offer the rating button? Asks the platform once per session and caches
 * the answer. Never throws; outside Yandex Games it simply reports `offline`.
 */
export async function reviewOffer(): Promise<ReviewOffer> {
  if (requestedThisSession) return { available: false, reason: 'done' };
  const asked = lastAsked();
  // GAME_RATED is final: the platform will not ask this player again, so the offer is over for good.
  if (asked.reason === 'GAME_RATED') return { available: false, reason: 'GAME_RATED' };
  if (yaServerTime() - asked.at < QUIET_PERIOD_MS) return { available: false, reason: 'cooldown' };
  if (offerCache) return offerCache;
  if (offerCheckInFlight) return offerCheckInFlight;

  const check = (async (): Promise<ReviewOffer> => {
    const answer = await yaCanReview();
    offerCache = answer
      ? { available: answer.value, reason: answer.value ? null : (answer.reason ?? 'UNKNOWN') }
      : { available: false, reason: 'offline' };
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
 * Open the platform's rating dialog. Only meaningful right after a positive `reviewOffer()`; the
 * once-per-session rule is enforced here as well as by the platform. Concurrent UI clicks share one
 * request, and the session flag is rechecked after the async availability check.
 */
export async function requestGameReview(): Promise<ReviewResult> {
  if (requestInFlight) return requestInFlight;
  if (requestedThisSession) return 'unavailable';

  const request = (async (): Promise<ReviewResult> => {
    const offer = await reviewOffer();
    if (!offer.available || requestedThisSession) return 'unavailable';

    requestedThisSession = true;
    const result = await yaRequestReview();
    if (!result) return 'failed'; // nothing was shown: stay silent and allow a retry next session
    offerCache = { available: false, reason: 'done' };
    storageSet(STORAGE_KEY, JSON.stringify({ at: yaServerTime(), sent: result.sent, reason: offer.reason ?? undefined }));
    return result.sent ? 'sent' : 'dismissed';
  })();

  requestInFlight = request;
  try {
    return await request;
  } finally {
    if (requestInFlight === request) requestInFlight = null;
  }
}
