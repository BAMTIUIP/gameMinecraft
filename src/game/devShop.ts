import { storageGet, storageSet } from './storage';

const DEV_SHOP_KEY = 'orerush.dev-shop.claims.v1';
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;
let developerShopEnabled = false;

type Mode = 'survival' | 'exploration' | 'own-world';
type DevReceipt = { receiptId: string; productId: string; opened?: Partial<Record<Mode, true>>; repeatable?: true };

/** Runtime gate for free local QA claims; the application keeps these controls off on TV devices. */
export function setDeveloperShopEnabled(enabled: boolean): void {
  developerShopEnabled = enabled;
}

export function isDeveloperShopEnabled(): boolean {
  return developerShopEnabled;
}

function normalizeDevClaims(value: unknown): DevReceipt[] {
  if (!Array.isArray(value)) return [];
  const out: DevReceipt[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && PRODUCT_ID.test(entry)) {
      out.push({ receiptId: `${entry}-${Math.random().toString(36).slice(2, 8)}`, productId: entry, opened: {} });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const raw = entry as { id?: unknown; receiptId?: unknown; productId?: unknown; opened?: unknown; repeatable?: unknown };
      const productId = typeof raw.productId === 'string' ? raw.productId : typeof raw.id === 'string' ? raw.id : null;
      if (!productId || !PRODUCT_ID.test(productId)) continue;
      const receiptId = typeof raw.receiptId === 'string' ? raw.receiptId : typeof raw.id === 'string' && raw.id.includes('-') ? raw.id : `${productId}-${Math.random().toString(36).slice(2, 8)}`;
      const opened: Partial<Record<Mode, true>> = {};
      if (raw.opened && typeof raw.opened === 'object') {
        for (const mode of ['survival', 'exploration', 'own-world'] as const) {
          if ((raw.opened as Record<string, unknown>)[mode] === true) opened[mode] = true;
        }
      }
      out.push(raw.repeatable === true ? { receiptId, productId, opened, repeatable: true } : { receiptId, productId, opened });
    }
  }
  return out;
}

/** Developer-only test entitlements live on this device and are intentionally not added to the cloud profile. */
export function developerShopClaims(): string[] {
  const raw = storageGet(DEV_SHOP_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    // repeatable (consumable) SKUs are not one-time claims, so they never show up as owned items
    return [...new Set(normalizeDevClaims(value).filter((r) => !r.repeatable).map((r) => r.productId))];
  } catch {
    return [];
  }
}

export function developerShopClaimsForMode(mode: Mode): string[] {
  const raw = storageGet(DEV_SHOP_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    const boosterIds = new Set(['booster-start', 'booster-ore', 'booster-score']);
    const seenBooster = new Set<string>();
    const filtered: string[] = [];
    for (const receipt of normalizeDevClaims(value)) {
      if (receipt.opened?.[mode]) continue;
      if (boosterIds.has(receipt.productId)) {
        if (seenBooster.has(receipt.productId)) continue;
        seenBooster.add(receipt.productId);
      }
      filtered.push(receipt.productId);
    }
    return filtered;
  } catch {
    return [];
  }
}

/** Grant a catalogue product locally once; this path never opens the payment flow.
 * For one-time items (all except pets) we store claim per mode, available once per run type (survival, exploration, own-world).
 * In own-world they remain forever after save, in other modes they disappear after run and need re-buy per mode.
 * Pets are permanent (never cleared).
 * For boosters: queue — if bought 10, only 1 per session, then burns and next applies.
 */
export function grantDeveloperShopProduct(productId: string, repeatable = false): boolean {
  if (!PRODUCT_ID.test(productId)) return false;
  const raw = storageGet(DEV_SHOP_KEY);
  let receipts: DevReceipt[] = [];
  try {
    receipts = raw ? normalizeDevClaims(JSON.parse(raw)) : [];
  } catch {
    receipts = [];
  }
  const isPet = ['pet-wolf', 'pet-cat', 'pet-monkey', 'pet-parrot', 'pet-owl'].includes(productId);
  const isBooster = ['booster-start', 'booster-ore', 'booster-score'].includes(productId);
  if (isPet) {
    if (receipts.some((r) => r.productId === productId)) return false;
    receipts.push({ receiptId: `${productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, productId, opened: {} });
    return storageSet(DEV_SHOP_KEY, JSON.stringify(receipts));
  }
  if (isBooster) {
    receipts.push({ receiptId: `${productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, productId, opened: {} });
    return storageSet(DEV_SHOP_KEY, JSON.stringify(receipts));
  }
  if (repeatable) {
    receipts.push({ receiptId: `${productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, productId, opened: {}, repeatable: true });
    return storageSet(DEV_SHOP_KEY, JSON.stringify(receipts));
  }
  if (receipts.some((r) => r.productId === productId)) return false;
  receipts.push({ receiptId: `${productId}-${Math.random().toString(36).slice(2, 8)}`, productId, opened: {} });
  return storageSet(DEV_SHOP_KEY, JSON.stringify(receipts));
}

export function completeDeveloperShopClaimsForMode(productIds: string[], mode: Mode): boolean {
  const raw = storageGet(DEV_SHOP_KEY);
  let receipts: DevReceipt[] = [];
  try {
    receipts = raw ? normalizeDevClaims(JSON.parse(raw)) : [];
  } catch {
    receipts = [];
  }
  let changed = false;
  const remaining: DevReceipt[] = [];
  const boosterIds = new Set(['booster-start', 'booster-ore', 'booster-score']);
  const handledBooster = new Set<string>();
  for (const receipt of receipts) {
    if (!productIds.includes(receipt.productId)) {
      remaining.push(receipt);
      continue;
    }
    const isPet = ['pet-wolf', 'pet-cat', 'pet-monkey', 'pet-parrot', 'pet-owl'].includes(receipt.productId);
    if (isPet) {
      remaining.push(receipt);
      continue;
    }
    if (boosterIds.has(receipt.productId)) {
      if (handledBooster.has(receipt.productId)) {
        remaining.push(receipt);
        continue;
      }
      handledBooster.add(receipt.productId);
    }
    const opened = { ...(receipt.opened ?? {}), [mode]: true as const };
    const allOpened = (['survival', 'exploration', 'own-world'] as const).every((m) => opened[m]);
    if (allOpened) {
      changed = true;
      continue;
    }
    remaining.push({ ...receipt, opened });
    changed = true;
  }
  if (!changed) return false;
  return storageSet(DEV_SHOP_KEY, JSON.stringify(remaining));
}

export function clearDeveloperShopClaims(): boolean {
  return storageSet(DEV_SHOP_KEY, JSON.stringify([]));
}
