/**
 * Promo deep links (https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment#structure-referrer).
 *
 * A promo banner in the Yandex Games catalogue can open the game with
 * `?referrer=promo&promo_id=…&promo_intent=…&inapp_id=…`. The SDK hands those values back in
 * `ysdk.environment.referrer`, and the game has to take the player straight to the promised screen —
 * otherwise the click that brought them here ends on the main menu and the campaign loses its point.
 *
 * What the game does, and why exactly this:
 *  - `inappId` → the shop opens on the purchase the promo is about, with the item highlighted. The
 *    payment dialog itself is **not** opened automatically: the player still makes the final click;
 *  - `intent` → the screen the campaign asked for (the intents this game understands are listed below;
 *    anything else keeps the normal flow, as the docs suggest for a plain seasonal promo);
 *  - `promoId` travels to the remote config as a `clientFeature` (`promoId`), so the Yandex Console can
 *    target flags — or analytics — at the players who came from a specific campaign.
 *
 * The whole module is a no-op outside Yandex Games: there is no referrer without the platform.
 */

import { SHOP_PRODUCT_IDS } from './shopRewards';
import { yaReferrer } from './yandex';

export type PromoEntry = {
  promoId: string;
  intent: string | null;
  inappId: string | null;
};

export type PromoAction =
  /** open the shop, optionally highlighting one product id from the Console */
  | { kind: 'shop'; productId: string | null; promoId: string }
  /** a campaign we cannot route: the game keeps its normal flow */
  | { kind: 'none'; promoId: string };

let cached: PromoEntry | null | undefined;

/** The promo entry, or null when the game was opened normally. */
export function promoEntry(): PromoEntry | null {
  if (cached !== undefined) return cached;
  const referrer = yaReferrer();
  cached = referrer
    ? {
        promoId: referrer.promoId,
        intent: typeof referrer.intent === 'string' && referrer.intent ? referrer.intent : null,
        inappId: typeof referrer.inappId === 'string' && referrer.inappId ? referrer.inappId : null,
      }
    : null;
  return cached;
}

/** Test seam: forget the cached referrer (the platform value itself does not change). */
export function resetPromoState() {
  cached = undefined;
}

/** Intents this game understands. Everything else is left to the normal flow. */
const SHOP_INTENTS = new Set(['open_shop', 'open_starter_pack', 'starter_pack']);

export function promoAction(): PromoAction | null {
  const entry = promoEntry();
  if (!entry) return null;

  // a discount promo always names the purchase: show it in the shop, highlighted
  if (entry.inappId) {
    return {
      kind: 'shop',
      productId: (SHOP_PRODUCT_IDS as readonly string[]).includes(entry.inappId) ? entry.inappId : null,
      promoId: entry.promoId,
    };
  }
  if (entry.intent && SHOP_INTENTS.has(entry.intent)) {
    return { kind: 'shop', productId: null, promoId: entry.promoId };
  }
  return { kind: 'none', promoId: entry.promoId };
}

/** `clientFeatures` entry for `ysdk.getFlags`, so the Console can target the campaign. */
export function promoClientFeature(): { name: string; value: string } | null {
  const entry = promoEntry();
  if (!entry) return null;
  return { name: 'promoId', value: entry.promoId };
}
