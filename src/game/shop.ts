/**
 * Shop: in-app purchases and the in-game currency (https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases).
 *
 * Two rules from the documentation shape everything here:
 *
 *  1. **Save first, consume second.** `payments.consumePurchase()` deletes the purchase for good, so
 *     the netherite coins reach the player's cloud data (in the legacy `diamonds` profile field, with
 *     the write flushed) *before* the token is consumed. A crash in between means the purchase is delivered again, never lost.
 *  2. **Check for unprocessed purchases at every start** (requirement 1.13.1): a payment that went
 *     through while the network died is delivered on the next launch — that is `deliverPendingPurchases()`.
 *
 * The catalogue itself lives in the Yandex Console; the game only maps its product ids onto what it
 * sells and takes the price strings (and the portal-currency icon) from `payments.getCatalog()`,
 * because requirement 1.13.2 forbids hardcoding the currency.
 */

import { addDiamonds, flushProfile, getDiamonds, hasDeliveredPurchase, markPurchaseDelivered, spendDiamonds } from './profile';
import { cancelQueuedShopReward, queueShopReward, type ShopRewardProductId } from './shopRewards';
import { tvDevice } from './params';
import { yaConsumePurchase, yaGetCatalog, yaGetPurchases, yaPaymentsAvailable, yaPurchase } from './yandex';

/** Legacy Console product ids mapped to the netherite coins credited to the legacy balance field. */
export const DIAMOND_PACKS: Readonly<Record<string, number>> = {
  'diamonds-100': 100,
  'diamonds-599': 599,
  'diamonds-1599': 1599,
  'diamonds-5999': 5999,
};

/** Netherite-coin cost of the rewarded-video alternative on the results screen. */
export const REVIVE_DIAMOND_PRICE = 100;

/** Functional, in-game purchases; receipts are durably queued for the next world/run. */
export const SHOP_ITEM_PRICES: Readonly<Record<ShopRewardProductId, number>> = {
  'armor-uncommon': 349,
  'armor-rare': 899,
  'armor-epic': 1_999,
  'netherite-pickaxe': 2_999,
  'netherite-armor': 4_999,
  // Keep old in-memory checkout IDs valid while durable pre-upgrade receipts are being applied.
  'diamond-pickaxe': 2_999,
  'diamond-armor': 4_999,
  'chest-common': 199,
  'chest-rare': 699,
  'chest-epic': 1_799,
  'booster-start': 249,
  'booster-ore': 399,
  'booster-score': 499,
};

export type ShopItemBuyResult =
  | { ok: true; productId: ShopRewardProductId; cost: number; diamonds: number }
  | { ok: false; productId: string; reason: 'unavailable' | 'not-enough' | 'storage'; diamonds: number };

export type ShopPrice = {
  /** `<цена> <код валюты>` exactly as the Console reports it */
  label: string;
  /** portal-currency icon URL from the catalogue (null when the catalogue is unavailable) */
  currencyIcon: string | null;
  fromCatalog: boolean;
};

export type ShopCatalog = Map<string, ShopPrice>;

export type BuyResult =
  | { ok: true; productId: string; diamonds: number }
  | { ok: false; productId: string; reason: 'unavailable' | 'cancelled' | 'failed'; diamonds: number };

let catalogCache: ShopCatalog | null = null;

/**
 * Requirement 1.6.3 (TV adaptation): TV games must not sell anything, so in TV mode the game does not
 * even ask the platform for the payment object — `getPayments()` is never called, `getPurchases()` is
 * never called and the shop button is hidden in the UI. Real purchases stay available everywhere else.
 */
export function paymentsAvailable(): boolean {
  return !tvDevice() && yaPaymentsAvailable();
}

export function diamondsBalance(): number {
  return getDiamonds();
}

/** Spend netherite coins and durably queue the matching reward receipt. */
export function buyShopItem(productId: string): ShopItemBuyResult {
  const cost = SHOP_ITEM_PRICES[productId as ShopRewardProductId];
  if (!Number.isFinite(cost) || cost <= 0) return { ok: false, productId, reason: 'unavailable', diamonds: getDiamonds() };
  if (getDiamonds() < cost) return { ok: false, productId, reason: 'not-enough', diamonds: getDiamonds() };

  const receipt = queueShopReward(productId);
  if (!receipt) return { ok: false, productId, reason: 'storage', diamonds: getDiamonds() };
  if (!spendDiamonds(cost)) {
    cancelQueuedShopReward(receipt);
    return { ok: false, productId, reason: 'not-enough', diamonds: getDiamonds() };
  }
  return { ok: true, productId: productId as ShopRewardProductId, cost, diamonds: getDiamonds() };
}

/**
 * Fetch the catalogue once and keep it in memory: prices come from the Console, so they are correct
 * for the player's currency and region. Without the catalogue the shop falls back to the labels
 * baked into the UI (useful outside Yandex Games, where the shop is a preview anyway).
 */
export async function loadShopCatalog(): Promise<ShopCatalog> {
  if (tvDevice()) return new Map(); // TV: no purchase UI, so no catalogue request either
  if (catalogCache) return catalogCache;
  const catalog: ShopCatalog = new Map();
  const products = await yaGetCatalog();
  for (const product of products ?? []) {
    if (!product?.id) continue;
    let currencyIcon: string | null = null;
    try {
      currencyIcon = product.getPriceCurrencyImage?.('small') ?? null;
    } catch {
      currencyIcon = null;
    }
    catalog.set(product.id, {
      label: product.price || product.priceValue,
      currencyIcon,
      fromCatalog: true,
    });
  }
  // an empty catalogue means the request failed: do not cache the failure, the next shop visit retries
  if (catalog.size) catalogCache = catalog;
  return catalog;
}

/** Test seam: forget the cached catalogue (used by the unit tests). */
export function resetShopCatalog() {
  catalogCache = null;
}

/**
 * Deliver everything the player paid for but never received: iterate the unconsumed purchases, grant
 * netherite coins to the legacy balance field, flush the data to the cloud and only then consume the
 * token. Returns the number of coins credited — the UI shows a "purchase restored" banner when it is above zero.
 */
export async function deliverPendingPurchases(): Promise<number> {
  if (tvDevice() || !yaPaymentsAvailable()) return 0;
  const purchases = await yaGetPurchases();
  if (!purchases?.length) return 0;

  let credited = 0;
  for (const purchase of purchases) {
    const amount = DIAMOND_PACKS[purchase.productID];
    if (!amount) {
      // an unknown product (for example, a permanent purchase handled elsewhere): leave the token
      console.warn('[shop] unknown product in purchases, not consuming', purchase.productID);
      continue;
    }

    // a token that was already paid out (a previous consume call failed) is only retried, never
    // credited again — that is what keeps the retry from duplicating the reward
    if (!hasDeliveredPurchase(purchase.purchaseToken)) {
      addDiamonds(amount, 'purchase');
      markPurchaseDelivered(purchase.purchaseToken);
      if (!(await flushProfile(true))) {
        // nothing reached the platform: do not consume, the next launch starts over
        console.warn('[shop] could not save the purchase reward, it will be delivered again next launch');
        continue;
      }
      credited += amount;
    }

    const consumed = await yaConsumePurchase(purchase.purchaseToken);
    if (!consumed) console.warn('[shop] could not consume purchase, delivery will be retried next launch');
  }
  return credited;
}

/**
 * Buy a legacy-ID coin pack: the payment frame opens, and on success netherite coins are credited
 * and saved before the purchase is consumed. Cancelling the frame is a normal outcome and changes nothing.
 */
export async function buyDiamondPack(productId: string): Promise<BuyResult> {
  if (!DIAMOND_PACKS[productId]) return { ok: false, productId, reason: 'failed', diamonds: getDiamonds() };
  if (!yaPaymentsAvailable()) return { ok: false, productId, reason: 'unavailable', diamonds: getDiamonds() };

  const purchase = await yaPurchase(productId, JSON.stringify({ source: 'shop', v: 1 }));
  if (!purchase) return { ok: false, productId, reason: 'cancelled', diamonds: getDiamonds() };

  const amount = DIAMOND_PACKS[purchase.productID] ?? DIAMOND_PACKS[productId];
  addDiamonds(amount, 'purchase');
  markPurchaseDelivered(purchase.purchaseToken); // pairs with the balance: one reward per token
  const saved = await flushProfile(true);
  if (!saved) {
    // the data did not reach the platform: keep the purchase unconsumed and let the next launch
    // deliver it (that is exactly what the "check unprocessed purchases" step is for)
    return { ok: false, productId, reason: 'failed', diamonds: getDiamonds() };
  }
  await yaConsumePurchase(purchase.purchaseToken);
  return { ok: true, productId, diamonds: getDiamonds() };
}

/** Spend netherite coins on a mid-run revive (the paid alternative to a rewarded video). */
export function buyRevive(): boolean {
  return spendDiamonds(REVIVE_DIAMOND_PRICE);
}
