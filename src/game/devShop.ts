import { storageGet, storageSet } from './storage';

const DEV_SHOP_KEY = 'orerush.dev-shop.claims.v1';
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;
let developerShopEnabled = false;

/** Runtime gate for free local QA claims; the application keeps these controls off on TV devices. */
export function setDeveloperShopEnabled(enabled: boolean): void {
  developerShopEnabled = enabled;
}

export function isDeveloperShopEnabled(): boolean {
  return developerShopEnabled;
}

/** Developer-only test entitlements live on this device and are intentionally not added to the cloud profile. */
export function developerShopClaims(): string[] {
  const raw = storageGet(DEV_SHOP_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && PRODUCT_ID.test(id)))]
      : [];
  } catch {
    return [];
  }
}

/** Grant a catalogue product locally once; this path never opens the payment flow.
 * For repeatable consumables (chests, boosters, armor, tools) we store the claim for auto-grant at next run
 * but still return true even if already claimed, allowing infinite buying.
 */
export function grantDeveloperShopProduct(productId: string, repeatable = false): boolean {
  if (!PRODUCT_ID.test(productId)) return false;
  if (repeatable) {
    const claims = developerShopClaims();
    if (!claims.includes(productId)) {
      storageSet(DEV_SHOP_KEY, JSON.stringify([...claims, productId]));
    }
    return true;
  }
  const claims = developerShopClaims();
  if (claims.includes(productId)) return false;
  return storageSet(DEV_SHOP_KEY, JSON.stringify([...claims, productId]));
}

export function clearDeveloperShopClaims(): boolean {
  return storageSet(DEV_SHOP_KEY, JSON.stringify([]));
}
