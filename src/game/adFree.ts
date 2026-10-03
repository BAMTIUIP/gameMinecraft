/**
 * Permanent ad-free IAP entitlement (Yandex Games example SKU: `disable_ads`).
 *
 * The platform purchase list is authoritative. We keep a small local mirror so a confirmed purchase
 * still suppresses ads if the player temporarily starts offline; each successful getPurchases() call
 * reconciles that mirror, including after an account switch. A permanent purchase is never consumed.
 */

import { storageGet, storageRemove, storageSet } from './storage';

export const AD_FREE_PRODUCT_ID = 'disable_ads';
const STORAGE_KEY = 'orerush.adfree.v1';

// `null` means there has not been a confirmed change in this session, so read the current storage
// backend each time (the Yandex safeStorage backend can be installed after this module is imported).
let sessionOverride: boolean | null = null;

export function hasAdFreeEntitlement(): boolean {
  return sessionOverride ?? storageGet(STORAGE_KEY) === 'true';
}

/** Cache a confirmed entitlement locally. The Yandex purchase itself remains unconsumed. */
export function cacheAdFreeEntitlement(owned: boolean) {
  sessionOverride = owned;
  if (owned) storageSet(STORAGE_KEY, 'true');
  else storageRemove(STORAGE_KEY);
}

/**
 * Reconcile only after a successful getPurchases() response. A null response means the SDK call
 * failed, so preserve the cached state; an empty array is authoritative and clears stale ownership.
 */
export function reconcileAdFreePurchases(purchases: readonly { productID?: string }[] | null): boolean {
  if (purchases === null) return hasAdFreeEntitlement();
  const owned = purchases.some((purchase) => purchase?.productID === AD_FREE_PRODUCT_ID);
  cacheAdFreeEntitlement(owned);
  return owned;
}
