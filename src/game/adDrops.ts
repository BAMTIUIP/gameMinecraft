/**
 * Time-limited shop drops. A reward is committed only after the ad layer reports that the platform
 * counted the rewarded view; closing early, an SDK error, or an offline ad leaves the claim untouched.
 *
 * Diamond rewards credit the account immediately. Voxel supplies are saved as pending grants and are
 * inserted after the next run/world is loaded, because Engine.startRun intentionally resets inventory.
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
};

type CloudDropState = {
  claims?: Record<string, unknown>;
  pending?: Record<string, unknown>;
  delivered?: unknown[];
};

const STORAGE_KEY = 'orerush.rewarded-drops.v1';
const DELIVERED_LIMIT = 1024;
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

let cached: RewardedDropState | undefined;

const emptyState = (): RewardedDropState => ({ claims: {}, pending: {}, delivered: [] });

export function isRewardedDrop(id: string): id is RewardedDropId {
  return (REWARDED_DROP_IDS as readonly string[]).includes(id);
}

function validPeriod(id: RewardedDropId, value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return id === 'drop-monthly' ? /^\d{4}-\d{2}$/.test(value) : /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validItem(value: unknown): value is RewardedDropItem {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [id, count] = value;
  return Number.isInteger(id) && Number(id) > 0 && Number(id) < BLOCKS.length && Boolean(BLOCKS[Number(id)])
    && Number.isInteger(count) && Number(count) > 0 && Number(count) <= 999;
}

function parsePendingKey(key: string): { id: RewardedDropId; period: string } | null {
  const separator = key.lastIndexOf(':');
  if (separator < 0) return null;
  const id = key.slice(0, separator);
  const period = key.slice(separator + 1);
  return isRewardedDrop(id) && validPeriod(id, period) ? { id, period } : null;
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
  return { claims, pending, delivered };
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
  };
}

function writeState(next: RewardedDropState): boolean {
  const normalized = normalizeState(next);
  if (!storageSet(STORAGE_KEY, JSON.stringify(normalized))) return false;
  cached = normalized;
  markProfileDirty({ adDrops: cloudState(normalized) });
  return true;
}

const DAY_MS = 86_400_000;

/** Trusted-UTC period key shared by all devices on the Yandex account. */
export function rewardedDropPeriod(id: RewardedDropId, now = yaServerTime()): string {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const date = new Date(safeNow);
  if (id === 'drop-monthly') return date.toISOString().slice(0, 7);
  if (id === 'drop-daily') return date.toISOString().slice(0, 10);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/** Availability for the three ordinary-store drops. A future saved period fails closed. */
export function rewardedDropStatuses(now = yaServerTime()): Record<RewardedDropId, RewardedDropStatus> {
  const current = state();
  return Object.fromEntries(REWARDED_DROP_IDS.map((id) => {
    const period = rewardedDropPeriod(id, now);
    const lastClaim = current.claims[id];
    return [id, { period, available: !lastClaim || lastClaim < period }];
  })) as Record<RewardedDropId, RewardedDropStatus>;
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

/**
 * Commit a drop after the caller has verified the rewarded-ad callback. Claim state and pending items
 * are written before currency is credited, so retries cannot double-pay if a profile sync is delayed.
 */
export function claimRewardedDrop(
  id: RewardedDropId,
  now = yaServerTime(),
  random: () => number = Math.random,
): RewardedDropClaimResult {
  const current = state();
  const status = rewardedDropStatuses(now)[id];
  if (!status.available) return { ok: false, reason: 'claimed' };

  const reward = rewardedDropReward(id, random);
  const key = `${id}:${status.period}`;
  const next = copyState(current);
  next.claims[id] = status.period;
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
  // Re-read trusted time after the video closes in case it crossed a daily/weekly/monthly boundary.
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

/** Cloud merge: claims and consumed-grant tokens only move forward; pending grants are unioned once. */
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
  merged.delivered = [...new Set([...local.delivered, ...incoming.delivered])].slice(-DELIVERED_LIMIT);
  merged.pending = { ...local.pending };
  for (const [key, items] of Object.entries(incoming.pending)) {
    if (!merged.pending[key]) merged.pending[key] = items;
  }
  for (const key of merged.delivered) delete merged.pending[key];
  cached = merged;
  storageSet(STORAGE_KEY, JSON.stringify(merged));
  // If this device had a newer claim or delivery marker, send the safe union back to the account.
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
