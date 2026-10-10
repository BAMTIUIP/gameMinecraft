import { storageGet, storageSet } from './storage';

const DEV_SHOP_KEY = 'orerush.dev-shop.claims.v1';
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;
let developerShopEnabled = false;

type Mode = 'survival' | 'exploration' | 'own-world';
type DevReceipt = { id: string; opened?: Partial<Record<Mode, true>> };

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
      out.push({ id: entry, opened: {} });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const raw = entry as { id?: unknown; opened?: unknown };
      if (typeof raw.id !== 'string' || !PRODUCT_ID.test(raw.id)) continue;
      const opened: Partial<Record<Mode, true>> = {};
      if (raw.opened && typeof raw.opened === 'object') {
        for (const mode of ['survival', 'exploration', 'own-world'] as const) {
          if ((raw.opened as Record<string, unknown>)[mode] === true) opened[mode] = true;
        }
      }
      out.push({ id: raw.id, opened });
    }
  }
  // Deduplicate by id, merging opened
  const byId = new Map<string, DevReceipt>();
  for (const receipt of out) {
    const existing = byId.get(receipt.id);
    if (!existing) {
      byId.set(receipt.id, receipt);
      continue;
    }
    byId.set(receipt.id, {
      id: receipt.id,
      opened: { ...(existing.opened ?? {}), ...(receipt.opened ?? {}) },
    });
  }
  return [...byId.values()];
}

/** Developer-only test entitlements live on this device and are intentionally not added to the cloud profile. */
export function developerShopClaims(): string[] {
  const raw = storageGet(DEV_SHOP_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return normalizeDevClaims(value).map((r) => r.id);
  } catch {
    return [];
  }
}

export function developerShopClaimsForMode(mode: Mode): string[] {
  const raw = storageGet(DEV_SHOP_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return normalizeDevClaims(value)
      .filter((r) => !r.opened?.[mode])
      .map((r) => r.id);
  } catch {
    return [];
  }
}

/** Grant a catalogue product locally once; this path never opens the payment flow.
 * For one-time items (all except pets) we store claim per mode, available once per run type (survival, exploration, own-world).
 * In own-world they remain forever after save, in other modes they disappear after run and need re-buy per mode.
 * Pets are permanent (never cleared).
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
  const existing = receipts.find((r) => r.id === productId);
  if (!existing) {
    receipts.push({ id: productId, opened: {} });
    return storageSet(DEV_SHOP_KEY, JSON.stringify(receipts));
  }
  if (repeatable) {
    // For repeatable (infinite) we allow re-buy even if already claimed, but keep receipt for auto-grant per mode
    return true;
  }
  // For pets (non-repeatable) return false if already claimed ever
  const isPet = ['pet-wolf', 'pet-cat', 'pet-monkey', 'pet-parrot', 'pet-owl'].includes(productId);
  if (isPet) return false;
  // For one-time items, if already claimed in all modes, allow re-buy? Actually one-time per mode, so if not yet opened in all modes, return false? For simplicity, return true to allow re-buy per mode
  return true;
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
  for (const receipt of receipts) {
    if (!productIds.includes(receipt.id)) {
      remaining.push(receipt);
      continue;
    }
    const isPet = ['pet-wolf', 'pet-cat', 'pet-monkey', 'pet-parrot', 'pet-owl'].includes(receipt.id);
    if (isPet) {
      // Pets permanent, never clear
      remaining.push(receipt);
      continue;
    }
    const opened = { ...(receipt.opened ?? {}), [mode]: true as const };
    const allOpened = (['survival', 'exploration', 'own-world'] as const).every((m) => opened[m]);
    if (allOpened) {
      // All 3 modes granted, remove (one-time per each type done)
      changed = true;
      continue;
    }
    remaining.push({ id: receipt.id, opened });
    changed = true;
  }
  if (!changed) return false;
  return storageSet(DEV_SHOP_KEY, JSON.stringify(remaining));
}

export function clearDeveloperShopClaims(): boolean {
  return storageSet(DEV_SHOP_KEY, JSON.stringify([]));
}
