/**
 * Yandex Games shop purchases. Consumable shop products are bought directly with the platform's
 * currency; the game has no intermediate wallet or purchasable coin packs.
 *
 * Product prices and currency icons come only from `payments.getCatalog()`. After a successful
 * payment, the reward receipt and purchase token are flushed to the player's cloud profile before
 * `consumePurchase()` is called. If storage or the network is unavailable, the receipt remains
 * unconsumed and `getPurchases()` retries delivery at the next launch.
 */

import { flushProfile, hasDeliveredPurchase, markPurchaseDelivered } from './profile';
import { cacheAdFreeEntitlement, hasAdFreeEntitlement, reconcileAdFreePurchases, AD_FREE_PRODUCT_ID } from './adFree';
import {
  isShopProductId,
  queueShopReward,
  SHOP_PRODUCT_IDS,
  type ShopProductId,
} from './shopRewards';
import { tvDevice } from './params';
import { hasPet, MONKEY_PET_PRODUCT_ID, unlockPet, WOLF_PET_PRODUCT_ID } from './pets';
import { yaConsumePurchase, yaGetCatalog, yaGetPurchases, yaPaymentsAvailable, yaPurchase, type YaPurchase } from './yandex';

export { AD_FREE_PRODUCT_ID, SHOP_PRODUCT_IDS };

export type ShopItemBuyResult =
  | { ok: true; productId: ShopProductId; syncPending: boolean }
  | { ok: false; productId: string; reason: 'unavailable' | 'cancelled' | 'failed' };

export type ShopPrice = {
  /** `<amount> <currency>` exactly as the Yandex Console reports it. */
  label: string;
  /** SDK-provided image for the platform currency. */
  currencyIcon: string;
  fromCatalog: boolean;
};

export type ShopCatalog = Map<string, ShopPrice>;

export type AdFreeBuyResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

let catalogCache: ShopCatalog | null = null;
let catalogPromise: Promise<ShopCatalog> | null = null;

/** TV adaptation: purchases are unavailable and no payment SDK method is called in TV mode. */
export function paymentsAvailable(): boolean {
  return !tvDevice() && yaPaymentsAvailable();
}

/**
 * Fetch the catalogue once and keep it in memory. The Yandex Console formats the price for the
 * player's region and platform currency; offers missing either a formatted price or currency icon
 * are deliberately omitted instead of showing a guessed/hardcoded price.
 */
export async function loadShopCatalog(): Promise<ShopCatalog> {
  if (tvDevice()) return new Map();
  if (catalogCache) return catalogCache;
  if (catalogPromise) return catalogPromise;

  const request = (async () => {
    const catalog: ShopCatalog = new Map();
    const products = await yaGetCatalog();
    for (const product of products ?? []) {
      const label = typeof product?.price === 'string' ? product.price.trim() : '';
      if (!product?.id || !label) continue;

      let currencyIcon = '';
      try {
        const image = product.getPriceCurrencyImage?.('small');
        currencyIcon = typeof image === 'string' ? image.trim() : '';
      } catch {
        currencyIcon = '';
      }
      // Requirement 1.13.6: an active Console SKU has to be in the game. A missing currency image is
      // not a reason to drop the offer — the formatted price already names the currency (1.13.2), the
      // icon is only decoration. Offers without a formatted price stay out: showing a guessed price
      // would be worse than showing nothing.
      catalog.set(product.id, { label, currencyIcon, fromCatalog: true });
    }

    // An empty catalogue means the request failed or there are no complete offers; let a later shop
    // visit retry rather than permanently caching an empty response.
    if (catalog.size) catalogCache = catalog;
    return catalog;
  })();

  catalogPromise = request;
  try {
    return await request;
  } finally {
    if (catalogPromise === request) catalogPromise = null;
  }
}

/** Test seam: forget the cached catalogue. */
export function resetShopCatalog() {
  catalogCache = null;
  catalogPromise = null;
}

/**
 * `payments.purchase()` resolves for a cancelled payment too, so it never throws on its own. The one
 * case where it must throw is a signature-only answer (`signed: true`): the player has paid, but the
 * encrypted receipt can only be processed on a server this game does not have. Reported as `failed`
 * — never as `cancelled`, which would call a real payment a cancellation.
 */
async function purchaseOrFail(id: string, developerPayload: string): Promise<YaPurchase | null> {
  try {
    return await yaPurchase(id, developerPayload);
  } catch (err) {
    console.error('[shop] purchase could not be processed on the client', err);
    return null;
  }
}

type SettlementResult = {
  recognized: boolean;
  queued: boolean;
  saved: boolean;
};

/**
 * Make one consumable receipt durable, then consume it. A token already marked delivered is never
 * granted again; it is still flushed before retrying a previously failed consume.
 */
async function settleShopPurchase(productId: string, purchaseToken: string): Promise<SettlementResult> {
  if (!purchaseToken || !isShopProductId(productId)) {
    return { recognized: false, queued: false, saved: false };
  }

  // Pets are permanent account entitlements: keep each Yandex receipt so getPurchases() restores
  // ownership, and never pass the receipt to consumePurchase().
  if (productId === WOLF_PET_PRODUCT_ID || productId === MONKEY_PET_PRODUCT_ID) {
    const kind = productId === WOLF_PET_PRODUCT_ID ? 'wolf' : 'monkey';
    const newlyOwned = !hasPet(kind);
    if (!unlockPet(kind)) return { recognized: true, queued: false, saved: false };
    const saved = await flushProfile(true);
    return { recognized: true, queued: newlyOwned, saved };
  }

  const alreadyDelivered = hasDeliveredPurchase(purchaseToken);
  let queued = false;
  if (!alreadyDelivered) {
    if (!queueShopReward(productId)) {
      // Keep the platform purchase unconsumed. Startup delivery will retry once local storage works.
      return { recognized: true, queued: false, saved: false };
    }
    markPurchaseDelivered(purchaseToken);
    queued = true;
  }

  if (!(await flushProfile(true))) {
    // Nothing is consumed unless both the reward receipt and token reached the player's cloud save.
    return { recognized: true, queued, saved: false };
  }

  if (!(await yaConsumePurchase(purchaseToken))) {
    // The reward is safe in the cloud; the marker prevents a duplicate if Yandex returns this token
    // again on the next launch. Retrying consume is harmless.
    console.warn('[shop] could not consume purchase, delivery will be retried next launch');
  }
  return { recognized: true, queued, saved: true };
}

/**
 * Deliver paid shop products that were confirmed but never consumed. Permanent ad-free ownership is
 * reconciled from the same list and is never consumed. Retired/unknown SKUs are left untouched.
 * Returns the number of newly queued shop rewards.
 */
export async function deliverPendingPurchases(): Promise<number> {
  if (tvDevice() || !yaPaymentsAvailable()) return 0;
  const purchases = await yaGetPurchases();
  if (purchases === null) return 0;

  reconcileAdFreePurchases(purchases);
  let delivered = 0;
  for (const purchase of purchases) {
    if (purchase.productID === AD_FREE_PRODUCT_ID) continue;
    if (!isShopProductId(purchase.productID)) {
      // Old coin-pack IDs and unrelated products are intentionally not consumed or granted.
      console.warn('[shop] retired or unknown product in purchases, not consuming', purchase.productID);
      continue;
    }

    const settlement = await settleShopPurchase(purchase.productID, purchase.purchaseToken);
    if (settlement.recognized && settlement.queued && settlement.saved) delivered += 1;
  }
  return delivered;
}

/** Buy one catalogue shop product directly with Yandex Games platform currency. */
export async function buyShopProduct(productId: string): Promise<ShopItemBuyResult> {
  if (!isShopProductId(productId) || !paymentsAvailable()) {
    return { ok: false, productId, reason: 'unavailable' };
  }

  const catalog = await loadShopCatalog();
  if (!catalog.has(productId)) return { ok: false, productId, reason: 'unavailable' };

  const purchase = await purchaseOrFail(productId, JSON.stringify({ source: 'shop-item', v: 2 }));
  if (!purchase) return { ok: false, productId, reason: 'cancelled' };
  if (purchase.productID !== productId) {
    // Do not consume an unexpected receipt. If it is a supported SKU, the startup restore path will
    // deliver exactly the product Yandex reports rather than trusting the button that was clicked.
    console.warn('[shop] purchase returned a different product id', purchase.productID, productId);
    return { ok: false, productId, reason: 'failed' };
  }

  const settlement = await settleShopPurchase(purchase.productID, purchase.purchaseToken);
  if (!settlement.recognized) return { ok: false, productId, reason: 'failed' };
  return {
    ok: true,
    productId: productId as ShopProductId,
    // A confirmed payment stays recoverable in Yandex until cloud receipt storage succeeds.
    syncPending: !settlement.saved,
  };
}

/**
 * Buy the permanent ad-free entitlement. Its active catalogue row is required, and unlike consumable
 * shop products the receipt stays in Yandex so getPurchases() can restore ownership on later boots.
 */
export async function buyAdFree(): Promise<AdFreeBuyResult> {
  if (hasAdFreeEntitlement()) return { ok: true };
  if (!paymentsAvailable()) return { ok: false, reason: 'unavailable' };

  const catalog = await loadShopCatalog();
  if (!catalog.has(AD_FREE_PRODUCT_ID)) return { ok: false, reason: 'unavailable' };

  const purchase = await purchaseOrFail(AD_FREE_PRODUCT_ID, JSON.stringify({ source: 'ad-free', v: 1 }));
  if (!purchase) return { ok: false, reason: 'cancelled' };
  if (purchase.productID !== AD_FREE_PRODUCT_ID) {
    console.warn('[shop] ad-free purchase returned a different product id', purchase.productID);
    return { ok: false, reason: 'failed' };
  }

  cacheAdFreeEntitlement(true);
  return { ok: true };
}
