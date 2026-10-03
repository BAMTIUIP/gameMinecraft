/**
 * Small daily bonus, credited only after a rewarded-video callback confirms the full view.
 * Dates are UTC dates from Yandex server time (or the local clock outside the platform) so moving the
 * device clock cannot immediately reopen the reward.
 */

import { showRewardedAd, type AdOutcome } from './ads';
import { addDiamonds, registerCloudPart, markProfileDirty, type CloudProfile } from './profile';
import { storageGet, storageSet } from './storage';
import { yaServerTime } from './yandex';

const STORAGE_KEY = 'orerush.daily.v1';

/** First day of a streak: keep the daily payout intentionally small. */
export const DAILY_BASE = 1;
/** The login streak rewards netherite coins, capped at two per day. */
export const DAILY_STREAK_BONUS = 1;
export const DAILY_MAX = 2;

export type DailyState = { last: string; streak: number; at: number };

export type DailyView = {
  available: boolean;
  /** what the player gets right now (0 when the bonus is already claimed) */
  amount: number;
  /** streak that this reward would continue (or the current one after the claim) */
  streak: number;
  /** today's date in UTC, as the game sees it through the trusted clock */
  today: string;
  reason: 'ready' | 'claimed' | 'clock';
};

export type DailyClaimResult =
  | { ok: true; amount: number; streak: number; reason: 'ready' }
  | { ok: false; amount: 0; streak: number; reason: 'ad' | 'claimed' | 'clock' | 'storage' };

let cached: DailyState | null | undefined;
const MAX_DAILY_STREAK = 1_000_000;

function validUtcDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function normalizedStreak(value: unknown): number {
  const candidate = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(candidate)
    ? Math.max(1, Math.min(MAX_DAILY_STREAK, Math.floor(candidate)))
    : 1;
}

/** Today's UTC date (`YYYY-MM-DD`) by the trusted clock. */
export function utcDay(ms = yaServerTime()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Seconds until the next UTC date, used for the disabled main-menu countdown. */
export function dailySecondsUntilReset(now = yaServerTime()): number {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const date = new Date(safeNow);
  const nextMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(0, Math.ceil((nextMidnight - safeNow) / 1000));
}

function parseState(raw: string | null): DailyState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyState>;
    if (!validUtcDay(parsed?.last)) return null;
    return {
      last: parsed.last,
      streak: normalizedStreak(parsed.streak),
      at: Number.isFinite(parsed.at) ? (parsed.at as number) : 0,
    };
  } catch {
    return null;
  }
}

/** The last claim, or null when the player has never taken the daily bonus. */
export function dailyState(): DailyState | null {
  if (cached === undefined) cached = parseState(storageGet(STORAGE_KEY));
  return cached;
}

function write(next: DailyState): boolean {
  if (!storageSet(STORAGE_KEY, JSON.stringify(next))) return false;
  cached = next;
  markProfileDirty({ daily: { last: next.last, streak: next.streak } });
  return true;
}

function dayBefore(day: string): string {
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return new Date(ms - 86_400_000).toISOString().slice(0, 10);
}

function amountFor(streak: number): number {
  return Math.min(DAILY_MAX, DAILY_BASE + DAILY_STREAK_BONUS * Math.max(0, streak - 1));
}

/** Is the bonus available right now, and how much would it be worth? */
export function dailyReward(): DailyView {
  const today = utcDay();
  const state = dailyState();
  if (!state) return { available: true, amount: DAILY_BASE, streak: 1, today, reason: 'ready' };
  if (state.last === today) return { available: false, amount: 0, streak: state.streak, today, reason: 'claimed' };
  // a date from the future means the stored state cannot be trusted: do not pay out
  if (state.last > today) return { available: false, amount: 0, streak: state.streak, today, reason: 'clock' };

  const streak = state.last === dayBefore(today) ? state.streak + 1 : 1;
  return { available: true, amount: amountFor(streak), streak, today, reason: 'ready' };
}

/** Internal payout commit. Callers must pass through `watchAndClaimDailyReward` first. */
function commitDailyReward(): DailyClaimResult {
  const view = dailyReward();
  if (!view.available) return { ok: false, amount: 0, streak: view.streak, reason: view.reason === 'ready' ? 'claimed' : view.reason };
  const next = { last: view.today, streak: view.streak, at: yaServerTime() };
  // Persist the one-claim guard before crediting currency so a storage failure cannot pay a free drop.
  if (!write(next)) return { ok: false, amount: 0, streak: view.streak, reason: 'storage' };
  addDiamonds(view.amount, 'grant');
  return { ok: true, amount: view.amount, streak: view.streak, reason: 'ready' };
}

/** Rewarded-ad gate for the main-menu daily bonus. Only a successful callback can reach the grant. */
export async function watchAndClaimDailyReward(
  showAd: () => Promise<AdOutcome> = showRewardedAd,
): Promise<DailyClaimResult> {
  const before = dailyReward();
  if (!before.available) return { ok: false, amount: 0, streak: before.streak, reason: before.reason === 'ready' ? 'claimed' : before.reason };
  let outcome: AdOutcome;
  try {
    outcome = await showAd();
  } catch {
    return { ok: false, amount: 0, streak: before.streak, reason: 'ad' };
  }
  if (!outcome?.rewarded) return { ok: false, amount: 0, streak: before.streak, reason: 'ad' };
  return commitDailyReward();
}

/** Test seam: forget the in-memory copy (storage keeps the truth). */
export function resetDailyState() {
  cached = undefined;
}

/**
 * Cloud part: the claim date travels with the profile. Two devices that claimed on different days
 * merge by the later date; the same date keeps the longer streak, so a second device can neither
 * re-claim the day nor shorten the streak.
 */
export function applyCloudDaily(remote: { last?: unknown; streak?: unknown } | undefined) {
  if (!remote || !validUtcDay(remote.last)) return;
  const local = dailyState();
  if (local && local.last > remote.last) return; // the local device is ahead: keep its record
  const streak = normalizedStreak(remote.streak);
  if (local && local.last === remote.last) {
    if (streak <= local.streak) return;
    cached = { ...local, streak };
    storageSet(STORAGE_KEY, JSON.stringify(cached));
    return;
  }
  cached = { last: remote.last, streak, at: 0 };
  storageSet(STORAGE_KEY, JSON.stringify(cached));
}

const applyDailyCloudPart = (cloud: CloudProfile) => {
  applyCloudDaily(cloud.daily);
};

registerCloudPart({
  collect: () => {
    const state = dailyState();
    return state ? { daily: { last: state.last, streak: state.streak } } : {};
  },
  apply: applyDailyCloudPart,
  mergeStale: applyDailyCloudPart,
});
