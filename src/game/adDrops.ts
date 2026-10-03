/**
 * Rewarded shop drops. Nothing is committed unless the ad layer reports `rewarded: true`.
 * Login-day progress is measured in distinct trusted UTC dates (missed days do not erase it), so the
 * weekly and monthly drops cannot be farmed by moving the device clock or opening several tabs.
 */

import { COAL, COOKED_MEAT, GOLD, IRON, PLANKS, TORCH, BLOCKS } from './blocks';
import { showRewardedAd, type AdOutcome } from './ads';
import { addDiamonds, markProfileDirty, registerCloudPart, saveProgressNow } from './profile';
import { storageGet, storageSet } from './storage';
import { yaServerTime } from './yandex';

export const REWARDED_DROP_IDS = ['drop-daily', 'drop-weekly', 'drop-monthly'] as const;
export type RewardedDropId = (typeof REWARDED_DROP_IDS)[number];
export type RewardedDropItem = [blockId: number, count: number];
export type RewardedDropItemTarget = 'next-run' | 'own-world';

type PendingDropGrant = {
  target: RewardedDropItemTarget;
  items: RewardedDropItem[];
};

type LoginProgress = {
  /** Latest UTC date on which the game was opened. */
  last: string;
  /** Recent unique login dates, merged across devices; 90 is enough to track a 30-login reward. */
  days: string[];
  /** A date is counted again only after the corresponding drop was claimed. */
  weeklyClaimedAt: string;
  monthlyClaimedAt: string;
  weeklyCycles: number;
  monthlyCycles: number;
};

export type RewardedDropReward = {
  diamonds: number;
  items: RewardedDropItem[];
  /** Daily supplies go to the next run; monthly materials wait for the saved sandbox world. */
  delivery?: RewardedDropItemTarget;
};

export type RewardedDropStatus = {
  available: boolean;
  /** Current UTC period key: YYYY-MM-DD for daily/weekly, YYYY-MM for monthly. */
  period: string;
  /** Distinct game-entry days counted toward this drop since its previous claim. */
  progress: number;
  goal: number;
};

export type RewardedDropClaimResult =
  | ({ ok: true } & RewardedDropReward)
  | { ok: false; reason: 'ad' | 'claimed' | 'storage' };

type RewardedDropState = {
  claims: Partial<Record<RewardedDropId, string>>;
  /** Claim key → unconsumed items and their delivery target. */
  pending: Record<string, PendingDropGrant>;
  /** Claim keys already moved into an engine inventory. */
  delivered: string[];
  login: LoginProgress;
};

type CloudDropState = {
  claims?: Record<string, unknown>;
  pending?: Record<string, unknown>;
  delivered?: unknown[];
  login?: unknown;
};

const STORAGE_KEY = 'orerush.rewarded-drops.v1';
const DELIVERED_LIMIT = 1024;
const LOGIN_DAY_LIMIT = 90;
const DAILY_ITEMS: readonly RewardedDropItem[] = [
  [PLANKS, 8],
  [COAL, 6],
  [COOKED_MEAT, 3],
  [TORCH, 4],
];
const MONTHLY_ITEMS: readonly RewardedDropItem[] = [
  [IRON, 12],
  [GOLD, 4],
  [PLANKS, 32],
  [TORCH, 16],
];
const LOGIN_GOALS: Record<RewardedDropId, number> = {
  'drop-daily': 1,
  'drop-weekly': 7,
  'drop-monthly': 30,
};

let cached: RewardedDropState | undefined;

const emptyLogin = (): LoginProgress => ({
  last: '',
  days: [],
  weeklyClaimedAt: '',
  monthlyClaimedAt: '',
  weeklyCycles: 0,
  monthlyCycles: 0,
});
const emptyState = (): RewardedDropState => ({ claims: {}, pending: {}, delivered: [], login: emptyLogin() });

export function isRewardedDrop(id: string): id is RewardedDropId {
  return (REWARDED_DROP_IDS as readonly string[]).includes(id);
}

function validDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function validPeriod(id: RewardedDropId, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (id === 'drop-monthly') return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  return validDay(value);
}

function validItem(value: unknown): value is RewardedDropItem {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [id, count] = value;
  return Number.isInteger(id) && Number(id) > 0 && Number(id) < BLOCKS.length && Boolean(BLOCKS[Number(id)])
    && Number.isInteger(count) && Number(count) > 0 && Number(count) <= 999;
}

function normalizeLogin(value: unknown): LoginProgress {
  if (!value || typeof value !== 'object') return emptyLogin();
  const raw = value as Partial<LoginProgress>;
  const days = Array.isArray(raw.days)
    ? raw.days.filter(validDay)
    : [];
  if (validDay(raw.last)) days.push(raw.last);
  const uniqueDays = [...new Set(days)].sort().slice(-LOGIN_DAY_LIMIT);
  const last = validDay(raw.last) ? raw.last : uniqueDays.at(-1) ?? '';
  return {
    last: uniqueDays.at(-1) ?? last,
    days: uniqueDays,
    weeklyClaimedAt: validDay(raw.weeklyClaimedAt) ? raw.weeklyClaimedAt : '',
    monthlyClaimedAt: validDay(raw.monthlyClaimedAt) ? raw.monthlyClaimedAt : '',
    weeklyCycles: Number.isFinite(raw.weeklyCycles) ? Math.max(0, Math.min(1_000_000, Math.floor(raw.weeklyCycles!))) : 0,
    monthlyCycles: Number.isFinite(raw.monthlyCycles) ? Math.max(0, Math.min(1_000_000, Math.floor(raw.monthlyCycles!))) : 0,
  };
}

function parsePendingKey(key: string): { id: RewardedDropId; period: string } | null {
  const separator = key.lastIndexOf(':');
  if (separator < 0) return null;
  const id = key.slice(0, separator);
  const suffix = key.slice(separator + 1);
  const cycleSeparator = suffix.indexOf('#');
  const period = cycleSeparator < 0 ? suffix : suffix.slice(0, cycleSeparator);
  const cycle = cycleSeparator < 0 ? null : suffix.slice(cycleSeparator + 1);
  if (!isRewardedDrop(id) || !validPeriod(id, period)) return null;
  // Version-one claims used only the calendar period. New weekly/monthly receipts include a cycle
  // number so two monthly rewards in one long calendar month cannot overwrite one another.
  if (cycle !== null && (!/^[1-9]\d*$/.test(cycle) || id === 'drop-daily')) return null;
  return { id, period };
}

function normalizeState(value: unknown): RewardedDropState {
  if (!value || typeof value !== 'object') return emptyState();
  const raw = value as CloudDropState;
  const claims: RewardedDropState['claims'] = {};
  for (const id of REWARDED_DROP_IDS) {
    const claim = raw.claims?.[id];
    if (validPeriod(id, claim)) claims[id] = claim;
  }

  const pending: RewardedDropState['pending'] = {};
  if (raw.pending && typeof raw.pending === 'object') {
    for (const [key, rawGrant] of Object.entries(raw.pending)) {
      const claim = parsePendingKey(key);
      if (!claim) continue;
      // Accept the earlier array-only local shape too; infer the correct target from its product id.
      const structured = !Array.isArray(rawGrant) && rawGrant && typeof rawGrant === 'object'
        ? rawGrant as { target?: unknown; items?: unknown }
        : null;
      const rawItems = Array.isArray(rawGrant) ? rawGrant : structured?.items;
      if (!Array.isArray(rawItems)) continue;
      const items = rawItems.filter(validItem).map(([id, count]) => [id, count] as RewardedDropItem);
      const inferredTarget: RewardedDropItemTarget = claim.id === 'drop-monthly' ? 'own-world' : 'next-run';
      const target = structured?.target === 'own-world' || structured?.target === 'next-run'
        ? structured.target
        : inferredTarget;
      if (items.length) pending[key] = { target, items };
    }
  }

  const delivered = Array.isArray(raw.delivered)
    ? [...new Set(raw.delivered.filter((key): key is string => typeof key === 'string' && Boolean(parsePendingKey(key))))].slice(-DELIVERED_LIMIT)
    : [];
  for (const key of delivered) delete pending[key];
  return { claims, pending, delivered, login: normalizeLogin(raw.login) };
}

function state(): RewardedDropState {
  if (cached === undefined) {
    try {
      cached = normalizeState(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'));
    } catch {
      cached = emptyState();
    }
  }
  return cached;
}

function copyState(source: RewardedDropState): RewardedDropState {
  return {
    claims: { ...source.claims },
    pending: Object.fromEntries(Object.entries(source.pending).map(([key, grant]) => [key, {
      target: grant.target,
      items: grant.items.map(([id, count]) => [id, count] as RewardedDropItem),
    }])),
    delivered: source.delivered.slice(),
    login: {
      ...source.login,
      days: source.login.days.slice(),
    },
  };
}

function cloudState(source: RewardedDropState) {
  return {
    claims: { ...source.claims },
    pending: Object.fromEntries(Object.entries(source.pending).map(([key, grant]) => [key, {
      target: grant.target,
      items: grant.items.map(([id, count]) => [id, count]),
    }])),
    delivered: source.delivered.slice(),
    login: {
      ...source.login,
      days: source.login.days.slice(),
    },
  };
}

function writeState(next: RewardedDropState): boolean {
  const normalized = normalizeState(next);
  if (!storageSet(STORAGE_KEY, JSON.stringify(normalized))) return false;
  cached = normalized;
  markProfileDirty({ adDrops: cloudState(normalized) });
  return true;
}

function safeTime(now: number): number {
  return Number.isFinite(now) && now > 0 ? now : yaServerTime();
}

function utcDay(now: number): string {
  return new Date(safeTime(now)).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** Trusted-UTC period key shared by all devices on the Yandex account. */
export function rewardedDropPeriod(id: RewardedDropId, now = yaServerTime()): string {
  const date = new Date(safeTime(now));
  if (id === 'drop-monthly') return date.toISOString().slice(0, 7);
  if (id === 'drop-daily') return date.toISOString().slice(0, 10);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** Record one unique login date. Missing days never erase progress; repeat opens on the same date do not add it twice. */
export function recordRewardedDropLogin(now = yaServerTime()): boolean {
  const today = utcDay(now);
  const current = state();
  if (current.login.last > today || current.login.days.includes(today)) return false;
  const next = copyState(current);
  next.login.days = [...new Set([...next.login.days, today])].sort().slice(-LOGIN_DAY_LIMIT);
  next.login.last = next.login.days.at(-1) ?? today;
  return writeState(next);
}

function loginDayProgress(current: RewardedDropState, claimedAt: string, today: string): number {
  return Math.min(LOGIN_DAY_LIMIT, current.login.days.filter((day) => day <= today && (!claimedAt || day > claimedAt)).length);
}

/** Availability for daily, seven-login-day, and thirty-login-day rewarded drops. */
export function rewardedDropStatuses(now = yaServerTime()): Record<RewardedDropId, RewardedDropStatus> {
  const current = state();
  const today = utcDay(now);
  const dailyPeriod = rewardedDropPeriod('drop-daily', now);
  const dailyClaim = current.claims['drop-daily'];
  const weeklyProgress = loginDayProgress(current, current.login.weeklyClaimedAt, today);
  const monthlyProgress = loginDayProgress(current, current.login.monthlyClaimedAt, today);
  return {
    'drop-daily': {
      period: dailyPeriod,
      available: !dailyClaim || dailyClaim < dailyPeriod,
      progress: dailyClaim === dailyPeriod ? 1 : 0,
      goal: LOGIN_GOALS['drop-daily'],
    },
    'drop-weekly': {
      period: rewardedDropPeriod('drop-weekly', now),
      available: weeklyProgress >= LOGIN_GOALS['drop-weekly'],
      progress: Math.min(LOGIN_GOALS['drop-weekly'], weeklyProgress),
      goal: LOGIN_GOALS['drop-weekly'],
    },
    'drop-monthly': {
      period: rewardedDropPeriod('drop-monthly', now),
      available: monthlyProgress >= LOGIN_GOALS['drop-monthly'],
      progress: Math.min(LOGIN_GOALS['drop-monthly'], monthlyProgress),
      goal: LOGIN_GOALS['drop-monthly'],
    },
  };
}

/** Pure reward roll, with injectable randomness for deterministic boundary tests. */
export function rewardedDropReward(id: RewardedDropId, random: () => number = Math.random): RewardedDropReward {
  if (id === 'drop-daily') return { diamonds: 0, items: DAILY_ITEMS.map(([blockId, count]) => [blockId, count]), delivery: 'next-run' };
  if (id === 'drop-weekly') return { diamonds: 1 + Math.floor(Math.max(0, Math.min(0.999999999, random())) * 5), items: [] };
  return {
    diamonds: 10 + Math.floor(Math.max(0, Math.min(0.999999999, random())) * 41),
    items: MONTHLY_ITEMS.map(([blockId, count]) => [blockId, count]),
    delivery: 'own-world',
  };
}

/** Commit a drop only after the caller verified the rewarded-ad callback. */
export function claimRewardedDrop(
  id: RewardedDropId,
  now = yaServerTime(),
  random: () => number = Math.random,
): RewardedDropClaimResult {
  const current = state();
  const status = rewardedDropStatuses(now)[id];
  if (!status.available) return { ok: false, reason: 'claimed' };

  const reward = rewardedDropReward(id, random);
  const today = utcDay(now);
  const next = copyState(current);
  next.claims[id] = status.period;
  let key = `${id}:${status.period}`;
  if (id === 'drop-weekly') {
    next.login.weeklyClaimedAt = today;
    next.login.weeklyCycles += 1;
    key = `${id}:${status.period}#${next.login.weeklyCycles}`;
  } else if (id === 'drop-monthly') {
    next.login.monthlyClaimedAt = today;
    next.login.monthlyCycles += 1;
    key = `${id}:${status.period}#${next.login.monthlyCycles}`;
  }
  if (reward.items.length) {
    next.pending[key] = {
      target: reward.delivery ?? (id === 'drop-monthly' ? 'own-world' : 'next-run'),
      items: reward.items.map(([blockId, count]) => [blockId, count]),
    };
  }
  if (!writeState(next)) return { ok: false, reason: 'storage' };
  if (reward.diamonds > 0) addDiamonds(reward.diamonds, 'grant');
  else saveProgressNow(); // daily supplies have no currency side-effect to trigger the immediate cloud write
  return { ok: true, diamonds: reward.diamonds, items: reward.items, delivery: reward.delivery };
}

/** Ad gate used by the ordinary store: only `rewarded: true` reaches the claim/payout function. */
export async function watchAndClaimRewardedDrop(
  id: RewardedDropId,
  showAd: () => Promise<AdOutcome> = showRewardedAd,
  now?: number,
  random: () => number = Math.random,
): Promise<RewardedDropClaimResult> {
  if (!rewardedDropStatuses(now ?? yaServerTime())[id].available) return { ok: false, reason: 'claimed' };
  let outcome: AdOutcome;
  try {
    outcome = await showAd();
  } catch {
    return { ok: false, reason: 'ad' };
  }
  if (!outcome?.rewarded) return { ok: false, reason: 'ad' };
  // Re-read trusted time after the video closes in case it crossed the daily reset boundary.
  return claimRewardedDrop(id, now ?? yaServerTime(), random);
}

/** Read eligible supplies without consuming them; the caller acknowledges only after Engine accepts them. */
export function pendingRewardedDropItems(target: RewardedDropItemTarget): { keys: string[]; items: RewardedDropItem[] } | null {
  const current = state();
  const keys = Object.keys(current.pending).filter((key) => {
    const grant = current.pending[key];
    return !current.delivered.includes(key) && (grant.target === 'next-run' || target === 'own-world');
  });
  if (!keys.length) return null;

  const totals = new Map<number, number>();
  for (const key of keys) {
    for (const [id, count] of current.pending[key]?.items ?? []) totals.set(id, (totals.get(id) ?? 0) + count);
  }
  return { keys, items: [...totals.entries()].map(([id, count]) => [id, count] as RewardedDropItem) };
}

/** Mark a batch delivered after its inventory grant (and sandbox save, when applicable) succeeded. */
export function completePendingRewardedDropItems(keys: string[]): boolean {
  const current = state();
  const ready = [...new Set(keys)].filter((key) => current.pending[key] && !current.delivered.includes(key));
  if (!ready.length) return false;
  const next = copyState(current);
  for (const key of ready) delete next.pending[key];
  next.delivered = [...new Set([...next.delivered, ...ready])].slice(-DELIVERED_LIMIT);
  if (!writeState(next)) return false;
  saveProgressNow();
  return true;
}

function mergeLogin(a: LoginProgress, b: LoginProgress): LoginProgress {
  const days = [...new Set([...a.days, ...b.days])].sort().slice(-LOGIN_DAY_LIMIT);
  const laterDay = (left: string, right: string) => left > right ? left : right;
  return {
    last: laterDay(a.last, b.last) || days.at(-1) || '',
    days,
    weeklyClaimedAt: laterDay(a.weeklyClaimedAt, b.weeklyClaimedAt),
    monthlyClaimedAt: laterDay(a.monthlyClaimedAt, b.monthlyClaimedAt),
    weeklyCycles: Math.max(a.weeklyCycles, b.weeklyCycles),
    monthlyCycles: Math.max(a.monthlyCycles, b.monthlyCycles),
  };
}

/** Cloud merge: claims/login dates and consumed-grant tokens only move forward; pending grants union once. */
export function applyCloudRewardedDrops(remote: unknown) {
  if (!remote || typeof remote !== 'object') return;
  const local = state();
  const incoming = normalizeState(remote);
  const merged = emptyState();
  for (const id of REWARDED_DROP_IDS) {
    const localClaim = local.claims[id];
    const remoteClaim = incoming.claims[id];
    const newest = [localClaim, remoteClaim].filter((value): value is string => Boolean(value)).sort().at(-1);
    if (newest) merged.claims[id] = newest;
  }
  merged.login = mergeLogin(local.login, incoming.login);
  merged.delivered = [...new Set([...local.delivered, ...incoming.delivered])].slice(-DELIVERED_LIMIT);
  merged.pending = { ...local.pending };
  for (const [key, items] of Object.entries(incoming.pending)) {
    if (!merged.pending[key]) merged.pending[key] = items;
  }
  for (const key of merged.delivered) delete merged.pending[key];
  cached = merged;
  storageSet(STORAGE_KEY, JSON.stringify(merged));
  // If this device had newer login/claim or delivery markers, send the safe union back to the account.
  if (JSON.stringify(cloudState(merged)) !== JSON.stringify(cloudState(incoming))) {
    markProfileDirty({ adDrops: cloudState(merged) });
  }
}

/** Test seam: reset the local mirror between deterministic drop tests. */
export function resetRewardedDropState() {
  cached = emptyState();
  storageSet(STORAGE_KEY, JSON.stringify(cached));
}

registerCloudPart({
  collect: () => ({ adDrops: cloudState(state()) }),
  apply: (cloud) => applyCloudRewardedDrops(cloud.adDrops),
});
