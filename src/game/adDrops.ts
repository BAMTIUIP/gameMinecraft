/**
 * Rewarded ad packs. A successful view grants an account-bound bag/chest token that can be opened
 * once in each game mode (Survival, Exploration, My World). The actual contents are delivered only
 * when that token is opened inside the mode, so the reward behaves like pet ownership rather than a
 * one-time anonymous stack of resources.
 *
 * The file still keeps the older pending direct-item receipts used by the separate daily shortcut /
 * menu bonuses. Weekly/monthly login progress remains based on distinct trusted UTC days.
 */

import {
  BLOCKS,
  COAL,
  COOKED_MEAT,
  DIAMOND,
  GOLD,
  IRON,
  PLANKS,
  REWARD_PACK_DAILY,
  REWARD_PACK_MONTHLY,
  REWARD_PACK_WEEKLY,
  TORCH,
  WHEAT_SEEDS,
} from './blocks';
import { showRewardedAd, type AdOutcome } from './ads';
import { markProfileDirty, registerCloudPart, saveProgressNow } from './profile';
import { storageGet, storageSet } from './storage';
import { yaServerTime } from './yandex';
import { mulberry32 } from './noise';
import { makeItem, SLOTS, type Item, type Material, type Rarity, type Slot } from './items';
import { HOE_TOOLS } from './tools';

export const REWARDED_DROP_IDS = ['drop-daily', 'drop-weekly', 'drop-monthly'] as const;
export type RewardedDropId = (typeof REWARDED_DROP_IDS)[number];
export type RewardedDropItem = [blockId: number, count: number];
export type RewardedDropItemTarget = 'next-run' | 'own-world';
export type RewardedDropDelivery = RewardedDropItemTarget | 'account';
export type RewardedDropMode = 'survival' | 'exploration' | 'own-world';
export const REWARDED_DROP_MODES: readonly RewardedDropMode[] = ['survival', 'exploration', 'own-world'] as const;

export type RewardedDropReward = {
  /** Claiming an ad reward gives a chest token, not the final resources yet. */
  items: RewardedDropItem[];
  delivery?: RewardedDropDelivery;
};

export type RewardedDropPackContents = {
  chestItemId: number;
  items: RewardedDropItem[];
  tools: number[];
  gear: Item[];
};

export type RewardedDropOpenResult =
  | ({ ok: true; receiptKey: string } & RewardedDropPackContents)
  | { ok: false; reason: 'claimed' | 'storage' };

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

type RewardedPackReceipt = {
  key: string;
  id: RewardedDropId;
  seed: number;
  opened: Partial<Record<RewardedDropMode, true>>;
};

type RewardedDropState = {
  claims: Partial<Record<RewardedDropId, string>>;
  /** Claim key → unconsumed items and their delivery target. Legacy direct grants still use this. */
  pending: Record<string, PendingDropGrant>;
  /** Claim keys already moved into an engine inventory. */
  delivered: string[];
  /** Account-bound ad chests that can be opened once in each mode. */
  packs: RewardedPackReceipt[];
  login: LoginProgress;
};

type CloudDropState = {
  claims?: Record<string, unknown>;
  pending?: Record<string, unknown>;
  delivered?: unknown[];
  packs?: unknown[];
  login?: unknown;
};

const STORAGE_KEY = 'orerush.rewarded-drops.v1';
const DELIVERED_LIMIT = 1024;
const LOGIN_DAY_LIMIT = 90;
const PACK_LIMIT = 512;
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
const emptyState = (): RewardedDropState => ({ claims: {}, pending: {}, delivered: [], packs: [], login: emptyLogin() });

export function isRewardedDrop(id: string): id is RewardedDropId {
  return (REWARDED_DROP_IDS as readonly string[]).includes(id);
}

export function rewardedDropChestItemId(id: RewardedDropId): number {
  return id === 'drop-daily'
    ? REWARD_PACK_DAILY
    : id === 'drop-weekly'
      ? REWARD_PACK_WEEKLY
      : REWARD_PACK_MONTHLY;
}

export function rewardedDropIdFromChestItem(id: number): RewardedDropId | null {
  return id === REWARD_PACK_DAILY
    ? 'drop-daily'
    : id === REWARD_PACK_WEEKLY
      ? 'drop-weekly'
      : id === REWARD_PACK_MONTHLY
        ? 'drop-monthly'
        : null;
}

export function isRewardedDropChestItem(id: number): boolean {
  return rewardedDropIdFromChestItem(id) !== null;
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

type PendingGrantId = RewardedDropId | 'bonus-daily' | 'bonus-shortcut';
type ParsedPendingKey = { id: PendingGrantId; period: string };

function parsePendingKey(key: string): ParsedPendingKey | null {
  if (key === 'bonus:shortcut:once') return { id: 'bonus-shortcut', period: 'once' };
  const dailyBonus = /^bonus:daily:(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (dailyBonus && validDay(dailyBonus[1])) return { id: 'bonus-daily', period: dailyBonus[1] };

  const separator = key.lastIndexOf(':');
  if (separator < 0) return null;
  const id = key.slice(0, separator);
  const suffix = key.slice(separator + 1);
  const cycleSeparator = suffix.indexOf('#');
  const period = cycleSeparator < 0 ? suffix : suffix.slice(0, cycleSeparator);
  const cycle = cycleSeparator < 0 ? null : suffix.slice(cycleSeparator + 1);
  if (!isRewardedDrop(id) || !validPeriod(id, period)) return null;
  if (cycle !== null && (!/^[1-9]\d*$/.test(cycle) || id === 'drop-daily')) return null;
  return { id, period };
}

function normalizePackReceipt(value: unknown): RewardedPackReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { key?: unknown; id?: unknown; seed?: unknown; opened?: unknown };
  if (typeof raw.key !== 'string' || raw.key.length > 96 || !isRewardedDrop(String(raw.id))) return null;
  const seed = Number(raw.seed);
  if (!Number.isFinite(seed)) return null;
  const opened: Partial<Record<RewardedDropMode, true>> = {};
  if (raw.opened && typeof raw.opened === 'object') {
    for (const mode of REWARDED_DROP_MODES) {
      if ((raw.opened as Record<string, unknown>)[mode] === true) opened[mode] = true;
    }
  }
  return {
    key: raw.key,
    id: raw.id as RewardedDropId,
    seed: Math.max(0, Math.floor(seed)) >>> 0,
    opened,
  };
}

function prunePackReceipts(receipts: RewardedPackReceipt[]): RewardedPackReceipt[] {
  const sorted = receipts.slice().sort((a, b) => a.key.localeCompare(b.key));
  if (sorted.length <= PACK_LIMIT) return sorted;
  const removable = sorted.filter((receipt) => REWARDED_DROP_MODES.every((mode) => receipt.opened[mode] === true));
  const removableKeys = new Set(removable.slice(0, Math.max(0, sorted.length - PACK_LIMIT)).map((receipt) => receipt.key));
  const trimmed = sorted.filter((receipt) => !removableKeys.has(receipt.key));
  return trimmed.slice(-PACK_LIMIT);
}

function normalizePacks(value: unknown): RewardedPackReceipt[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, RewardedPackReceipt>();
  for (const entry of value) {
    const receipt = normalizePackReceipt(entry);
    if (!receipt) continue;
    const existing = byKey.get(receipt.key);
    if (!existing) {
      byKey.set(receipt.key, receipt);
      continue;
    }
    byKey.set(receipt.key, {
      key: existing.key,
      id: existing.id,
      seed: existing.seed,
      opened: {
        survival: existing.opened.survival || receipt.opened.survival ? true : undefined,
        exploration: existing.opened.exploration || receipt.opened.exploration ? true : undefined,
        'own-world': existing.opened['own-world'] || receipt.opened['own-world'] ? true : undefined,
      },
    });
  }
  return prunePackReceipts([...byKey.values()]);
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
  return {
    claims,
    pending,
    delivered,
    packs: normalizePacks(raw.packs),
    login: normalizeLogin(raw.login),
  };
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
    packs: source.packs.map((receipt) => ({
      key: receipt.key,
      id: receipt.id,
      seed: receipt.seed,
      opened: { ...receipt.opened },
    })),
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
    packs: source.packs.map((receipt) => ({
      key: receipt.key,
      id: receipt.id,
      seed: receipt.seed,
      opened: { ...receipt.opened },
    })),
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

function queueBonusItems(key: string, items: readonly RewardedDropItem[]): boolean {
  const current = state();
  if (current.pending[key] || current.delivered.includes(key)) return true;
  const normalizedItems = items.filter(validItem).map(([id, count]) => [id, count] as RewardedDropItem);
  if (!normalizedItems.length) return false;
  const next = copyState(current);
  next.pending[key] = { target: 'next-run', items: normalizedItems };
  return writeState(next);
}

/** Queue an idempotent daily-login bonus for delivery to the next run. */
export function queueDailyBonusItems(day: string, items: readonly RewardedDropItem[]): boolean {
  if (!validDay(day)) return false;
  return queueBonusItems(`bonus:daily:${day}`, items);
}

/** Queue the one-time desktop-shortcut thank-you for delivery to the next run. */
export function queueShortcutBonusItems(items: readonly RewardedDropItem[]): boolean {
  return queueBonusItems('bonus:shortcut:once', items);
}

/** Roll back a daily bonus receipt if the matching daily claim could not be saved. */
export function cancelDailyBonusItems(day: string): boolean {
  if (!validDay(day)) return false;
  const key = `bonus:daily:${day}`;
  const current = state();
  if (!current.pending[key] || current.delivered.includes(key)) return false;
  const next = copyState(current);
  delete next.pending[key];
  return writeState(next);
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

/** Claiming a rewarded drop grants an account-bound chest token. */
export function rewardedDropReward(id: RewardedDropId): RewardedDropReward {
  return {
    items: [[rewardedDropChestItemId(id), 1]],
    delivery: 'account',
  };
}

function pickUniqueSlots(count: number, random: () => number): Slot[] {
  const pool = SLOTS.slice();
  const out: Slot[] = [];
  while (out.length < count && pool.length) {
    const index = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
    out.push(pool.splice(index, 1)[0]);
  }
  return out;
}

function weeklyBonusMaterial(random: () => number): Material {
  return random() < 0.72 ? 'iron' : random() < 0.88 ? 'gold' : 'diamond';
}

function monthlyUncommonMaterial(random: () => number): Material {
  return random() < 0.6 ? 'iron' : random() < 0.9 ? 'gold' : 'diamond';
}

function monthlyRareMaterial(random: () => number): Material {
  return random() < 0.58 ? 'gold' : 'diamond';
}

function makeBuffedItem(slot: Slot, material: Material, rarity: Rarity, random: () => number): Item {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const item = makeItem(slot, material, rarity, random);
    if (item.affixes.length > 0) return item;
  }
  // Very unlikely safety net for the uncommon tier's 40% affix roll.
  return makeItem(slot, material, (Math.min(4, rarity + 1) as Rarity), random);
}

/** Deterministic contents of the chest when it is actually opened inside a mode. */
export function rewardedDropPackContents(
  id: RewardedDropId,
  random: () => number = Math.random,
): RewardedDropPackContents {
  const chestItemId = rewardedDropChestItemId(id);
  if (id === 'drop-daily') {
    return {
      chestItemId,
      items: [
        [PLANKS, 12],
        [COAL, 6],
        [COOKED_MEAT, 4],
        [TORCH, 4],
        [WHEAT_SEEDS, 4],
      ],
      tools: [HOE_TOOLS[0]],
      gear: [],
    };
  }

  if (id === 'drop-weekly') {
    const [slotA, slotB, buffedSlot] = pickUniqueSlots(3, random);
    return {
      chestItemId,
      items: [
        [PLANKS, 24],
        [COAL, 10],
        [COOKED_MEAT, 6],
        [TORCH, 8],
        [IRON, 6],
        [WHEAT_SEEDS, 8],
      ],
      tools: [HOE_TOOLS[2]],
      gear: [
        makeItem(slotA, 'iron', 0, random, true),
        makeItem(slotB, 'iron', 0, random, true),
        makeBuffedItem(buffedSlot, weeklyBonusMaterial(random), 0, random),
      ],
    };
  }

  const [greenSlot, blueSlot] = pickUniqueSlots(2, random);
  return {
    chestItemId,
    items: [
      [PLANKS, 40],
      [COAL, 14],
      [COOKED_MEAT, 10],
      [TORCH, 14],
      [IRON, 12],
      [GOLD, 5],
      [DIAMOND, 2],
      [WHEAT_SEEDS, 12],
    ],
    tools: [],
    gear: [
      makeBuffedItem(greenSlot, monthlyUncommonMaterial(random), 0, random),
      makeBuffedItem(blueSlot, monthlyRareMaterial(random), 1, random),
    ],
  };
}

function receiptSeed(now: number, random: () => number): number {
  const time = Math.max(0, Math.floor(safeTime(now)) >>> 0);
  const extra = Math.max(0, Math.min(0xffff_ffff, Math.floor(random() * 0xffff_ffff))) >>> 0;
  return (time ^ extra ^ 0x7f4a7c15) >>> 0;
}

function receiptForOpen(current: RewardedDropState, id: RewardedDropId, mode: RewardedDropMode): RewardedPackReceipt | null {
  return current.packs.find((receipt) => receipt.id === id && receipt.opened[mode] !== true) ?? null;
}

function modeSalt(mode: RewardedDropMode): number {
  return mode === 'survival' ? 0x13579bdf : mode === 'exploration' ? 0x2468ace1 : 0x55aa10ef;
}

export function availableRewardedDropChestCounts(mode: RewardedDropMode): Record<RewardedDropId, number> {
  const counts: Record<RewardedDropId, number> = {
    'drop-daily': 0,
    'drop-weekly': 0,
    'drop-monthly': 0,
  };
  for (const receipt of state().packs) {
    if (receipt.opened[mode] === true) continue;
    counts[receipt.id] += 1;
  }
  return counts;
}

export function availableRewardedDropChestItems(mode: RewardedDropMode): RewardedDropItem[] {
  const counts = availableRewardedDropChestCounts(mode);
  return REWARDED_DROP_IDS.flatMap((id) => counts[id] > 0 ? [[rewardedDropChestItemId(id), counts[id]] as RewardedDropItem] : []);
}

/** Open one bound chest inside one specific mode. */
export function openRewardedDropPack(id: RewardedDropId, mode: RewardedDropMode): RewardedDropOpenResult {
  const current = state();
  const receipt = receiptForOpen(current, id, mode);
  if (!receipt) return { ok: false, reason: 'claimed' };

  const next = copyState(current);
  const target = next.packs.find((entry) => entry.key === receipt.key && entry.id === id);
  if (!target) return { ok: false, reason: 'claimed' };
  target.opened[mode] = true;
  if (!writeState(next)) return { ok: false, reason: 'storage' };
  saveProgressNow();

  const contents = rewardedDropPackContents(id, mulberry32((receipt.seed ^ modeSalt(mode)) >>> 0));
  return { ok: true, receiptKey: receipt.key, ...contents };
}

/** Undo an immediately-failed chest open (for example when the sandbox world could not be saved). */
export function rollbackOpenedRewardedDropPack(key: string, mode: RewardedDropMode): boolean {
  const current = state();
  const receipt = current.packs.find((entry) => entry.key === key);
  if (!receipt || receipt.opened[mode] !== true) return false;
  const next = copyState(current);
  const target = next.packs.find((entry) => entry.key === key);
  if (!target) return false;
  delete target.opened[mode];
  const written = writeState(next);
  if (written) saveProgressNow();
  return written;
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

  const reward = rewardedDropReward(id);
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
  if (!next.packs.some((receipt) => receipt.key === key)) {
    next.packs.push({ key, id, seed: receiptSeed(now, random), opened: {} });
    next.packs = prunePackReceipts(next.packs);
  }
  if (!writeState(next)) return { ok: false, reason: 'storage' };
  saveProgressNow();
  return { ok: true, items: reward.items, delivery: reward.delivery };
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
  return { keys, items: [...totals.entries()].map(([blockId, count]) => [blockId, count] as RewardedDropItem) };
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

function mergePacks(a: RewardedPackReceipt[], b: RewardedPackReceipt[]): RewardedPackReceipt[] {
  const merged = new Map<string, RewardedPackReceipt>();
  for (const receipt of [...a, ...b]) {
    const existing = merged.get(receipt.key);
    if (!existing) {
      merged.set(receipt.key, {
        key: receipt.key,
        id: receipt.id,
        seed: receipt.seed,
        opened: { ...receipt.opened },
      });
      continue;
    }
    merged.set(receipt.key, {
      key: existing.key,
      id: existing.id,
      seed: existing.seed,
      opened: {
        survival: existing.opened.survival || receipt.opened.survival ? true : undefined,
        exploration: existing.opened.exploration || receipt.opened.exploration ? true : undefined,
        'own-world': existing.opened['own-world'] || receipt.opened['own-world'] ? true : undefined,
      },
    });
  }
  return prunePackReceipts([...merged.values()]);
}

/** Cloud merge: claims/login dates and consumed-grant tokens only move forward; bound packs union by key and opened modes. */
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
  merged.packs = mergePacks(local.packs, incoming.packs);
  cached = normalizeState(merged);
  storageSet(STORAGE_KEY, JSON.stringify(cached));
  if (JSON.stringify(cloudState(cached)) !== JSON.stringify(cloudState(incoming))) {
    markProfileDirty({ adDrops: cloudState(cached) });
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
