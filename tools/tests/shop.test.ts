/**
 * Direct Yandex Games shop purchases, receipt durability and the permanent ad-free entitlement.
 * Catalogue prices/icons must come from the SDK, and consumable purchase tokens must not be
 * consumed until both the reward receipt and token are durably stored in the cloud profile.
 */

type Call = { name: string; arg: unknown };
const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((call) => call.name === name).length;
const lastCall = (name: string) => [...calls].reverse().find((call) => call.name === name);

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ru', userActivation: { isActive: true } },
  configurable: true,
});

type TestPurchase = { productID: string; purchaseToken: string; developerPayload?: string };
let cloud: Record<string, unknown> = {};
let unprocessed: TestPurchase[] = [];
const recordedPurchases: TestPurchase[] = [];
let purchaseRejects = false;
let consumeFails = false;
let getPaymentsFailures = 1;
let getPaymentsCalls = 0;
let catalogFails = false;
let catalogCalls = 0;
let failSetData = false;

const product = (id: string, price: string) => ({
  id,
  title: id,
  description: id,
  imageURI: '',
  price,
  priceValue: '999',
  priceCurrencyCode: 'TST',
  getPriceCurrencyImage: (size: string) => `icon-${size}.png`,
});
const CATALOG = [
  product('armor-uncommon', '17 TST'),
  product('chest-common', '29 TST'),
  product('netherite-pickaxe', '149 TST'),
  product('pet-wolf', '199 TST'),
  product('pet-monkey', '229 TST'),
  product('pet-parrot', '179 TST'),
  product('disable_ads', '59 TST'),
  { ...product('raw-price-only', ''), priceValue: '7' },
  { ...product('no-currency-image', '7 TST'), getPriceCurrencyImage: undefined },
];

const stats: Record<string, number> = {};
const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-shop',
  getName: () => 'SHOPPER',
  getPhoto: () => 'photo-url',
  getPayingStatus: () => 'paying',
  getData: async (keys?: string[]) => {
    record('player.getData', keys);
    return keys ? Object.fromEntries(keys.filter((key) => key in cloud).map((key) => [key, cloud[key]])) : { ...cloud };
  },
  setData: async (data: Record<string, unknown>, flush?: boolean) => {
    record('player.setData', { data: structuredClone(data), flush: flush ?? false });
    if (failSetData) throw new Error('network down');
    Object.assign(cloud, data);
  },
  getStats: async () => ({ ...stats }),
  setStats: async (next: Record<string, number>) => Object.assign(stats, next),
  incrementStats: async (increments: Record<string, number>) => {
    for (const [key, value] of Object.entries(increments)) stats[key] = (stats[key] ?? 0) + value;
    return { ...stats };
  },
};

const payments = {
  getCatalog: async () => {
    catalogCalls += 1;
    record('payments.getCatalog');
    if (catalogFails) throw new Error('catalog unavailable');
    return CATALOG;
  },
  getPurchases: async () => {
    record('payments.getPurchases');
    return unprocessed.map((purchase) => ({ ...purchase }));
  },
  purchase: async (data: { id: string; developerPayload?: string }) => {
    record('payments.purchase', data);
    if (purchaseRejects) throw new Error('PURCHASE_CANCELLED');
    const receipt: TestPurchase = {
      productID: data.id,
      purchaseToken: `token-${data.id}-${recordedPurchases.length + 1}`,
      developerPayload: data.developerPayload ?? '',
    };
    recordedPurchases.push(receipt);
    unprocessed.push(receipt);
    return { ...receipt };
  },
  consumePurchase: async (token: string) => {
    record('payments.consumePurchase', token);
    if (consumeFails) throw new Error('consume failed');
    unprocessed = unprocessed.filter((purchase) => purchase.purchaseToken !== token);
  },
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
      serverTime: () => Date.now(),
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
      getPayments: async () => {
        getPaymentsCalls += 1;
        record('ysdk.getPayments');
        if (getPaymentsFailures > 0) {
          getPaymentsFailures -= 1;
          throw new Error('temporary payment preload failure');
        }
        return payments;
      },
      features: { LoadingAPI: { ready: () => record('LoadingAPI.ready') }, GameplayAPI: { start() {}, stop() {} } },
      on() {},
    };
  },
};

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const { hasAdFreeEntitlement, cacheAdFreeEntitlement } = await import('../../src/game/adFree');
const {
  AD_FREE_PRODUCT_ID,
  SHOP_PRODUCT_IDS,
  buyAdFree,
  buyShopProduct,
  deliverPendingPurchases,
  loadShopCatalog,
  paymentsAvailable,
  resetShopCatalog,
} = await import('../../src/game/shop');
const { pendingShopProductRewards } = await import('../../src/game/shopRewards');
const { hasMonkeyPet, hasParrotPet, hasWolfPet, resetPetsForTests } = await import('../../src/game/pets');

await initYandex();
await startProfileSync();
ok(paymentsAvailable(), 'Yandex Payments are available inside the platform');
ok(SHOP_PRODUCT_IDS.includes('armor-uncommon') && SHOP_PRODUCT_IDS.includes('chest-common'), 'Current store SKUs are direct reward products');
ok(!SHOP_PRODUCT_IDS.some((id) => id.startsWith('diamonds-')), 'No coin-pack SKU is supported');

const firstCatalogAttempt = await loadShopCatalog();
ok(firstCatalogAttempt.size === 0 && getPaymentsCalls === 1, 'A temporary payments preload failure leaves an empty catalogue without crashing');
let catalog = await loadShopCatalog();
ok(catalogCalls === 1 && getPaymentsCalls === 2, 'Reopening the shop retries getPayments() and the catalogue');
const chestPrice = catalog.get('chest-common');
ok(chestPrice?.label === '29 TST', 'The displayed price is exactly the formatted catalogue price', JSON.stringify(chestPrice));
ok(chestPrice?.currencyIcon === 'icon-small.png' && chestPrice.fromCatalog, 'The platform currency icon and provenance come from the SDK');
ok(catalog.get(AD_FREE_PRODUCT_ID)?.label === '59 TST', 'The separate ad-free entitlement also uses the catalogue price');
ok(catalog.get('pet-wolf')?.label === '199 TST' && catalog.get('pet-wolf')?.currencyIcon === 'icon-small.png', 'The wolf price and currency icon come directly from the Yandex catalogue');
ok(catalog.get('pet-monkey')?.label === '229 TST' && catalog.get('pet-monkey')?.currencyIcon === 'icon-small.png', 'The monkey price and currency icon also come directly from the Yandex catalogue');
ok(catalog.get('pet-parrot')?.label === '179 TST' && catalog.get('pet-parrot')?.currencyIcon === 'icon-small.png', 'The parrot price and currency icon come directly from the Yandex catalogue');
ok(!catalog.has('raw-price-only'), 'A row without the formatted SDK price is omitted');
// Requirement 1.13.6: an active Console SKU must be present in the game. A missing currency image is
// decoration, not a price, so the offer stays — without it — instead of disappearing from the shop.
ok(catalog.has('no-currency-image') && catalog.get('no-currency-image')?.currencyIcon === '', 'Товар без иконки валюты остаётся в магазине (п. 1.13.6)');
await loadShopCatalog();
ok(catalogCalls === 1, 'A successful catalogue response is cached');

resetShopCatalog();
catalogFails = true;
const failedCatalog = await loadShopCatalog();
ok(failedCatalog.size === 0, 'A catalogue failure returns an empty result');
catalogFails = false;
catalog = await loadShopCatalog();
ok(catalog.has('chest-common') && catalogCalls >= 3, 'An empty catalogue is not cached permanently; a later open retries');

// Purchases are always a direct SKU checkout; no game-side wallet or price arithmetic is involved.
const buyIndex = count('payments.purchase');
const purchaseResult = await buyShopProduct('chest-common');
ok(purchaseResult.ok && purchaseResult.productId === 'chest-common' && !purchaseResult.syncPending, 'Direct SKU checkout returns a successful durable purchase', JSON.stringify(purchaseResult));
ok(count('payments.purchase') === buyIndex + 1, 'A purchase opens the platform payment frame exactly once');
const purchaseArg = lastCall('payments.purchase')?.arg as { id?: string; developerPayload?: string } | undefined;
ok(purchaseArg?.id === 'chest-common', 'The clicked Yandex catalogue SKU is passed to purchase()', String(purchaseArg?.id));
ok(Boolean(purchaseArg?.developerPayload), 'The checkout includes a versioned developer payload');
const purchaseToken = recordedPurchases.at(-1)!.purchaseToken;
const savedProfile = cloud['orerush.profile'] as { deliveredPurchases?: string[]; shopRewards?: { pending?: Array<{ productId: string }> } } | undefined;
ok(savedProfile?.deliveredPurchases?.includes(purchaseToken) === true, 'The purchase token is stored in cloud before consumption');
ok(savedProfile?.shopRewards?.pending?.some((receipt) => receipt.productId === 'chest-common') === true, 'The matching item reward receipt is stored before consumption');
const firstConsume = calls.findIndex((call) => call.name === 'payments.consumePurchase');
const receiptCloudWrite = calls.findIndex((call) => call.name === 'player.setData' && JSON.stringify(call.arg).includes('shopRewards'));
ok(receiptCloudWrite >= 0 && firstConsume > receiptCloudWrite, 'Cloud reward/token persistence happens before consumePurchase');
ok(unprocessed.length === 0, 'A saved consumable receipt is consumed');
ok(pendingShopProductRewards()?.products.includes('chest-common') === true, 'A successful purchase is queued for engine delivery');

// The wolf is an account entitlement: buy directly through Yandex, persist ownership, never queue a consumable, and keep the receipt unconsumed.
resetPetsForTests();
const wolfConsumeBefore = count('payments.consumePurchase');
const wolfPurchaseBefore = count('payments.purchase');
const wolfBought = await buyShopProduct('pet-wolf');
ok(wolfBought.ok && wolfBought.productId === 'pet-wolf' && hasWolfPet(), 'Buying the wolf permanently unlocks the local entitlement');
ok(count('payments.purchase') === wolfPurchaseBefore + 1 && (lastCall('payments.purchase')?.arg as { id?: string } | undefined)?.id === 'pet-wolf', 'The wolf is purchased through its own Yandex SKU');
ok(count('payments.consumePurchase') === wolfConsumeBefore && unprocessed.some((purchase) => purchase.productID === 'pet-wolf'), 'The permanent wolf receipt is not consumed');
ok(!((pendingShopProductRewards()?.products as readonly string[] | undefined)?.includes('pet-wolf')), 'The permanent wolf never enters the consumable delivery queue');

// The monkey uses the same direct catalogue checkout while retaining an independent permanent entitlement.
const monkeyConsumeBefore = count('payments.consumePurchase');
const monkeyPurchaseBefore = count('payments.purchase');
const monkeyBought = await buyShopProduct('pet-monkey');
ok(monkeyBought.ok && monkeyBought.productId === 'pet-monkey' && hasMonkeyPet(), 'Buying the monkey permanently unlocks its local entitlement');
ok(count('payments.purchase') === monkeyPurchaseBefore + 1 && (lastCall('payments.purchase')?.arg as { id?: string } | undefined)?.id === 'pet-monkey', 'The monkey is purchased through its own Yandex SKU');
ok(count('payments.consumePurchase') === monkeyConsumeBefore && unprocessed.some((purchase) => purchase.productID === 'pet-monkey'), 'The permanent monkey receipt is kept unconsumed for account restoration');
ok(!((pendingShopProductRewards()?.products as readonly string[] | undefined)?.includes('pet-monkey')), 'The permanent monkey never enters the consumable delivery queue');

// The parrot is likewise a direct permanent SKU, restored from its unconsumed account receipt.
const parrotConsumeBefore = count('payments.consumePurchase');
const parrotPurchaseBefore = count('payments.purchase');
const parrotBought = await buyShopProduct('pet-parrot');
ok(parrotBought.ok && parrotBought.productId === 'pet-parrot' && hasParrotPet(), 'Buying the parrot permanently unlocks the local entitlement');
ok(count('payments.purchase') === parrotPurchaseBefore + 1 && (lastCall('payments.purchase')?.arg as { id?: string } | undefined)?.id === 'pet-parrot', 'The parrot is purchased through its own Yandex SKU');
ok(count('payments.consumePurchase') === parrotConsumeBefore && unprocessed.some((purchase) => purchase.productID === 'pet-parrot'), 'The permanent parrot receipt remains unconsumed for account restoration');
ok(!((pendingShopProductRewards()?.products as readonly string[] | undefined)?.includes('pet-parrot')), 'The permanent parrot never enters the consumable delivery queue');

// Cancellation is ordinary and never creates a receipt.
purchaseRejects = true;
const beforeCancelPurchases = recordedPurchases.length;
const cancelled = await buyShopProduct('armor-uncommon');
ok(!cancelled.ok && cancelled.reason === 'cancelled', 'Payment cancellation is reported as cancellation', JSON.stringify(cancelled));
ok(recordedPurchases.length === beforeCancelPurchases, 'A cancelled payment creates no receipt');
purchaseRejects = false;

// Unknown or retired SKUs are rejected locally, without opening the platform flow.
const beforeBadSku = count('payments.purchase');
const badSku = await buyShopProduct('diamonds-100');
ok(!badSku.ok && badSku.reason === 'unavailable', 'Retired coin-pack IDs are not purchasable');
const unknownSku = await buyShopProduct('not-in-catalog');
ok(!unknownSku.ok && unknownSku.reason === 'unavailable', 'Unknown products are rejected');
ok(count('payments.purchase') === beforeBadSku, 'Rejected product IDs never open the payment frame');

// A failed consume leaves the token with Yandex; restore retries consume but does not queue a duplicate.
consumeFails = true;
unprocessed = [{ productID: 'netherite-pickaxe', purchaseToken: 'restore-token-1', developerPayload: '' }];
const restoreCountBefore = pendingShopProductRewards()?.products.filter((id) => id === 'netherite-pickaxe').length ?? 0;
const deliveredWithConsumeFailure = await deliverPendingPurchases();
ok(deliveredWithConsumeFailure === 1, 'An unconsumed supported SKU is restored to the durable reward queue');
ok(unprocessed.length === 1, 'A failed consume keeps the receipt recoverable in Yandex');
const restoredQueue = pendingShopProductRewards();
ok((restoredQueue?.products.filter((id) => id === 'netherite-pickaxe').length ?? 0) === restoreCountBefore + 1, 'The restored receipt queues its direct product reward once');
consumeFails = false;
const retryCount = await deliverPendingPurchases();
ok(retryCount === 0 && unprocessed.length === 0, 'The next restore retries consume without adding a second reward');
ok((pendingShopProductRewards()?.products.filter((id) => id === 'netherite-pickaxe').length ?? 0) === restoreCountBefore + 1, 'Repeated delivery of the same token never duplicates the reward');

// Unknown/unrelated Yandex purchases remain untouched.
unprocessed = [{ productID: 'unrelated-sku', purchaseToken: 'unrelated-token', developerPayload: '' }];
const unknownRestore = await deliverPendingPurchases();
ok(unknownRestore === 0 && unprocessed.length === 1, 'Unknown purchases are neither granted nor consumed');

// disable_ads remains a separate permanent entitlement and is deliberately not consumed.
unprocessed = [{ productID: AD_FREE_PRODUCT_ID, purchaseToken: 'ad-free-restore-1', developerPayload: '' }];
cacheAdFreeEntitlement(false);
const consumesBeforeRestore = count('payments.consumePurchase');
await deliverPendingPurchases();
ok(hasAdFreeEntitlement(), 'The permanent disable_ads entitlement restores from getPurchases()');
ok(unprocessed.length === 1 && count('payments.consumePurchase') === consumesBeforeRestore, 'The permanent entitlement is never consumed');
unprocessed = [];

cacheAdFreeEntitlement(false);
const adFreePurchasesBefore = count('payments.purchase');
const adFreeConsumesBefore = count('payments.consumePurchase');
const adFreeBought = await buyAdFree();
ok(adFreeBought.ok && hasAdFreeEntitlement(), 'A successful disable_ads checkout enables the permanent entitlement');
ok(count('payments.purchase') === adFreePurchasesBefore + 1, 'disable_ads opens the payment frame once');
ok((lastCall('payments.purchase')?.arg as { id?: string } | undefined)?.id === AD_FREE_PRODUCT_ID, 'The permanent entitlement uses its own SKU');
ok(count('payments.consumePurchase') === adFreeConsumesBefore, 'A newly purchased permanent entitlement is never consumed');
unprocessed = [];

// If cloud sync fails after the payment, keep the token unconsumed and recover on the next launch.
failSetData = true;
const pendingBuy = await buyShopProduct('armor-uncommon');
ok(pendingBuy.ok && pendingBuy.syncPending, 'A confirmed payment reports that cloud receipt sync is pending');
const stuckToken = recordedPurchases.at(-1)!.purchaseToken;
ok(unprocessed.some((purchase) => purchase.purchaseToken === stuckToken), 'A receipt is not consumed while its cloud save fails');
failSetData = false;
const recovered = await deliverPendingPurchases();
ok(recovered === 0, 'Recovery does not count an already queued reward as newly delivered');
ok(!unprocessed.some((purchase) => purchase.purchaseToken === stuckToken), 'Recovery consumes the receipt after the cloud save succeeds');
ok(pendingShopProductRewards()?.products.includes('armor-uncommon') === true, 'The paid item remains queued after recovery');
const recoveredProfile = cloud['orerush.profile'] as { deliveredPurchases?: string[] } | undefined;
ok(recoveredProfile?.deliveredPurchases?.includes(stuckToken) === true, 'The recovered purchase token is confirmed in the cloud profile');

// Catalogue absence blocks checkout; hard-coded prices are never substituted.
resetShopCatalog();
catalogFails = true;
const unavailable = await buyShopProduct('chest-common');
ok(!unavailable.ok && unavailable.reason === 'unavailable', 'Direct purchases require a complete catalogue offer');
catalogFails = false;

export { passed, failures };
