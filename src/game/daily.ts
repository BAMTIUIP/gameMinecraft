/**
 * Daily reward (https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time).
 *
 * The docs make two points that shape this module:
 *  - time-gated rewards must be counted with **`ysdk.serverTime()`**, not with the device clock: the
 *    system time can be moved by the player and is not the same on every device, while server time
 *    is the same everywhere and cannot be rolled back to farm the bonus;
 *  - the claim date is stored in the cloud (`player.setData`), so "once per day" holds for the
 *    account and not for one browser profile — reinstalling the game on another device must not
 *    hand out a second reward for the same day.
 *
 * The game follows the calendar-day variant of the docs' example: the date is compared as an ISO
 * `YYYY-MM-DD` string in UTC (a lexicographic comparison of that format is a correct date
 * comparison, and it never runs into time zone or DST surprises). Consecutive days grow the bonus,
 * a missed day resets the streak, and a stored date that is somehow *ahead* of server time is
 * treated as "already claimed" — the safe direction.
 */

import { addDiamonds, registerCloudPart, markProfileDirty } from './profile';
import { storageGet, storageSet } from './storage';
import { yaServerTime } from './yandex';

const STORAGE_KEY = 'orerush.daily.v1';

/** first day of a streak */
export const DAILY_BASE = 25;
/** added for every consecutive day */
export const DAILY_STREAK_BONUS = 5;
/** the bonus stops growing here: at streak 6 the daily reward is already at the cap */
export const DAILY_MAX = 50;

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

let cached: DailyState | null | undefined;

/** Today's UTC date (`YYYY-MM-DD`) by the trusted clock. */
export function utcDay(ms = yaServerTime()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseState(raw: string | null): DailyState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyState>;
    if (typeof parsed?.last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.last)) return null;
    return {
      last: parsed.last,
      streak: Number.isFinite(parsed.streak) ? Math.max(1, Math.floor(parsed.streak as number)) : 1,
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

function write(next: DailyState) {
  cached = next;
  storageSet(STORAGE_KEY, JSON.stringify(next));
  markProfileDirty({ daily: { last: next.last, streak: next.streak } });
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

/**
 * Claim today's bonus. Returns what was granted; a second call on the same day changes nothing
 * (the storage entry is the guard — the UI is only a reflection of it).
 */
export function claimDailyReward(): { ok: boolean; amount: number; streak: number; reason: DailyView['reason'] } {
  const view = dailyReward();
  if (!view.available) return { ok: false, amount: 0, streak: view.streak, reason: view.reason };
  addDiamonds(view.amount, 'grant');
  write({ last: view.today, streak: view.streak, at: yaServerTime() });
  return { ok: true, amount: view.amount, streak: view.streak, reason: 'ready' };
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
  if (!remote || typeof remote.last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(remote.last)) return;
  const local = dailyState();
  if (local && local.last > remote.last) return; // the local device is ahead: keep its record
  const streak = Math.max(1, Math.floor(Number(remote.streak) || 1));
  if (local && local.last === remote.last) {
    if (streak <= local.streak) return;
    cached = { ...local, streak };
    storageSet(STORAGE_KEY, JSON.stringify(cached));
    return;
  }
  cached = { last: remote.last, streak, at: 0 };
  storageSet(STORAGE_KEY, JSON.stringify(cached));
}

registerCloudPart({
  collect: () => {
    const state = dailyState();
    return state ? { daily: { last: state.last, streak: state.streak } } : {};
  },
  apply: (cloud) => applyCloudDaily(cloud.daily),
});
