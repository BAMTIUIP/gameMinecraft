/** Durable grants for direct Yandex Games purchases, plus compatibility for already queued rewards. */

import { markProfileDirty, registerCloudPart, saveProgressNow } from './profile';
import { storageGet, storageSet } from './storage';
import { CAT_PET_PRODUCT_ID, MONKEY_PET_PRODUCT_ID, OWL_PET_PRODUCT_ID, PARROT_PET_PRODUCT_ID, WOLF_PET_PRODUCT_ID } from './pets';
import { yaServerTime } from './yandex';

/** Paid catalogue SKUs; pets are permanent entitlements, the remaining products are consumable rewards. */
const CONSUMABLE_SHOP_PRODUCT_IDS = [
  'armor-uncommon',
  'armor-rare',
  'armor-epic',
  'netherite-pickaxe',
  'netherite-armor',
  'chest-common',
  'chest-rare',
  'chest-epic',
  'booster-start',
  'booster-ore',
  'booster-score',
] as const;
export const SHOP_PRODUCT_IDS = [...CONSUMABLE_SHOP_PRODUCT_IDS, WOLF_PET_PRODUCT_ID, CAT_PET_PRODUCT_ID, MONKEY_PET_PRODUCT_ID, PARROT_PET_PRODUCT_ID, OWL_PET_PRODUCT_ID] as const;
export type ShopProductId = (typeof SHOP_PRODUCT_IDS)[number];

/** Include old queued gear receipts so an upgrade never drops a reward already paid for in-game. */
export const SHOP_REWARD_PRODUCT_IDS = [...CONSUMABLE_SHOP_PRODUCT_IDS, 'diamond-pickaxe', 'diamond-armor'] as const;
export type ShopRewardProductId = (typeof SHOP_REWARD_PRODUCT_IDS)[number];

export function isShopProductId(id: string): id is ShopProductId {
  return (SHOP_PRODUCT_IDS as readonly string[]).includes(id);
}

type Mode = 'survival' | 'exploration' | 'own-world';
type Receipt = { id: string; productId: ShopRewardProductId; opened?: Partial<Record<Mode, true>> };
type ShopRewardState = { pending: Receipt[]; delivered: string[] };

const STORAGE_KEY = 'orerush.shop-rewards.v1';
const RECEIPT_LIMIT = 1024;
let cached: ShopRewardState | undefined;
let receiptSequence = 0;

const emptyState = (): ShopRewardState => ({ pending: [], delivered: [] });

export function isShopRewardProduct(id: string): id is ShopRewardProductId {
  return (SHOP_REWARD_PRODUCT_IDS as readonly string[]).includes(id);
}

function normalizeState(value: unknown): ShopRewardState {
  if (!value || typeof value !== 'object') return emptyState();
  const raw = value as { pending?: unknown; delivered?: unknown };
  const pending = Array.isArray(raw.pending)
    ? raw.pending.flatMap((entry): Receipt[] => {
        if (!entry || typeof entry !== 'object') return [];
        const item = entry as Partial<Receipt> & { opened?: unknown };
        if (typeof item.id !== 'string' || item.id.length > 96 || !isShopRewardProduct(String(item.productId))) return [];
        const opened: Partial<Record<Mode, true>> = {};
        if (item.opened && typeof item.opened === 'object') {
          for (const mode of ['survival', 'exploration', 'own-world'] as const) {
            if ((item.opened as Record<string, unknown>)[mode] === true) opened[mode] = true;
          }
        }
        return [{ id: item.id, productId: item.productId as ShopRewardProductId, opened }];
      })
    : [];
  const delivered = Array.isArray(raw.delivered)
    ? [...new Set(raw.delivered.filter((id): id is string => typeof id === 'string' && id.length <= 96))].slice(-RECEIPT_LIMIT)
    : [];
  const completed = new Set(delivered);
  return { pending: pending.filter((entry) => !completed.has(entry.id)), delivered };
}

function state(): ShopRewardState {
  if (cached === undefined) {
    try {
      cached = normalizeState(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'));
    } catch {
      cached = emptyState();
    }
  }
  return cached;
}

function cloudState(source: ShopRewardState) {
  return {
    pending: source.pending.map((entry) => ({ id: entry.id, productId: entry.productId, opened: entry.opened ? { ...entry.opened } : {} })),
    delivered: source.delivered.slice(),
  };
}

function write(next: ShopRewardState): boolean {
  const normalized = normalizeState(next);
  if (!storageSet(STORAGE_KEY, JSON.stringify(normalized))) return false;
  cached = normalized;
  markProfileDirty({ shopRewards: cloudState(normalized) });
  return true;
}

/** Save the reward receipt before the platform purchase token is consumed. */
export function queueShopReward(productId: string): string | null {
  if (!isShopRewardProduct(productId)) return null;
  const current = state();
  let id: string;
  do {
    receiptSequence += 1;
    // Trusted time, not the device clock: the id is persisted to the cloud and merged between
    // devices, and a skewed local clock would stamp the receipt with a moment that never happened.
    id = `${yaServerTime().toString(36)}-${receiptSequence.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (current.pending.some((entry) => entry.id === id) || current.delivered.includes(id));
  const next: ShopRewardState = {
    pending: [...current.pending, { id, productId }],
    delivered: current.delivered.slice(),
  };
  return write(next) ? id : null;
}

/** Undo only the receipt created by the current synchronous checkout if charging unexpectedly fails. */
export function cancelQueuedShopReward(id: string): boolean {
  const current = state();
  if (!current.pending.some((entry) => entry.id === id)) return false;
  return write({
    pending: current.pending.filter((entry) => entry.id !== id),
    delivered: current.delivered.slice(),
  });
}

export function pendingShopProductRewards(): { keys: string[]; products: ShopRewardProductId[] } | null {
  const current = state();
  if (!current.pending.length) return null;
  return {
    keys: current.pending.map((entry) => entry.id),
    products: current.pending.map((entry) => entry.productId),
  };
}

export function pendingShopProductRewardsForMode(mode: Mode): { keys: string[]; products: ShopRewardProductId[] } | null {
  const current = state();
  const boosterIds = new Set(['booster-start', 'booster-ore', 'booster-score']);
  // For boosters: only 1 per product per session (queue), even if bought 10, only 1 used per session then burns and next applies
  // For other one-time items (armor, chests, tools): all pending for that mode at once (once per run type per purchase)
  const filtered: Receipt[] = [];
  const seenBooster = new Set<string>();
  for (const entry of current.pending) {
    if (entry.opened?.[mode]) continue;
    if (boosterIds.has(entry.productId)) {
      if (seenBooster.has(entry.productId)) continue;
      seenBooster.add(entry.productId);
    }
    filtered.push(entry);
  }
  if (!filtered.length) return null;
  return {
    keys: filtered.map((entry) => entry.id),
    products: filtered.map((entry) => entry.productId),
  };
}

/** Acknowledge receipts only after the engine successfully applied (and, in a sandbox, saved) them.
 * One-time items (all except pets) are available once per run type (survival, exploration, own-world).
 * For own-world they remain forever after save, for other modes they disappear after run and need re-buy per mode.
 * We track opened per mode, and only move to delivered when all 3 modes have been granted.
 */
export function completePendingShopRewards(keys: string[]): boolean {
  const current = state();
  const ready = new Set(keys.filter((id) => current.pending.some((entry) => entry.id === id)));
  if (!ready.size) return false;
  const next: ShopRewardState = {
    pending: current.pending.filter((entry) => !ready.has(entry.id)),
    delivered: [...new Set([...current.delivered, ...ready])].slice(-RECEIPT_LIMIT),
  };
  if (!write(next)) return false;
  saveProgressNow();
  return true;
}

export function completePendingShopRewardsForMode(keys: string[], mode: Mode): boolean {
  const current = state();
  const ready = new Set(keys.filter((id) => current.pending.some((entry) => entry.id === id)));
  if (!ready.size) return false;
  const toDeliver: string[] = [];
  const toKeep: Receipt[] = [];
  for (const entry of current.pending) {
    if (!ready.has(entry.id)) {
      toKeep.push(entry);
      continue;
    }
    const opened = { ...(entry.opened ?? {}), [mode]: true as const };
    const allModesOpened = (['survival', 'exploration', 'own-world'] as const).every((m) => opened[m]);
    if (allModesOpened) {
      toDeliver.push(entry.id);
    } else {
      toKeep.push({ ...entry, opened });
    }
  }
  const next: ShopRewardState = {
    pending: toKeep,
    delivered: [...new Set([...current.delivered, ...toDeliver])].slice(-RECEIPT_LIMIT),
  };
  if (!write(next)) return false;
  saveProgressNow();
  return true;
}

export function applyCloudShopRewards(remote: unknown) {
  if (!remote || typeof remote !== 'object') return;
  const local = state();
  const incoming = normalizeState(remote);
  const merged = normalizeState({
    pending: [...local.pending, ...incoming.pending],
    delivered: [...local.delivered, ...incoming.delivered],
  });
  cached = merged;
  storageSet(STORAGE_KEY, JSON.stringify(merged));
  if (JSON.stringify(cloudState(merged)) !== JSON.stringify(cloudState(incoming))) {
    markProfileDirty({ shopRewards: cloudState(merged) });
  }
}

/** Test seam for isolated checkout and cloud-merge coverage. */
export function resetShopRewards() {
  cached = emptyState();
  storageSet(STORAGE_KEY, JSON.stringify(cached));
}

registerCloudPart({
  collect: () => ({ shopRewards: cloudState(state()) }),
  apply: (cloud) => applyCloudShopRewards(cloud.shopRewards),
});
