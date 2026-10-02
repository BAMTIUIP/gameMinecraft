/**
 * Unit test for the shop and the paid flows (src/game/shop.ts + the payments part of yandex.ts).
 *
 * The payment SDK is mocked in-process, so the test can pin down the two things a browser run shows
 * only by luck:
 *  - the order "credit → save → consume" (the docs: a consumed purchase cannot be restored, so the
 *    reward must be in the player's data first);
 *  - exactly-once delivery, including the case where `consumePurchase()` fails and the platform
 *    returns the very same token on the next launch (requirement 1.13.1).
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((c) => c.name === name).length;
const lastCall = (name: string) => [...calls].reverse().find((c) => c.name === name);

/* ------------------------------- DOM stubs ------------------------------- */

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ru', userActivation: { isActive: true } },
  configurable: true,
});

/* ------------------------------ SDK mock ------------------------------ */

type TestPurchase = { productID: string; purchaseToken: string; developerPayload?: string };

let cloud: Record<string, unknown> = {};
const stats: Record<string, number> = {};

let unprocessed: TestPurchase[] = []; // what getPurchases() returns
const recordedPurchases: TestPurchase[] = []; // everything purchase() ever produced
let purchaseRejects = false;
let consumeFails = false;
let catalogFails = false;
let catalogCalls = 0;
let failSetData = false;

const CATALOG = [
  {
    id: 'diamonds-100',
    title: 'Горсть алмазов',
    description: '100 алмазов',
    imageURI: 'img-100.png',
    price: '99 ₽',
    priceValue: '99',
    priceCurrencyCode: 'RUB',
    getPriceCurrencyImage: (size: string) => `icon-${size}.png`,
  },
  {
    id: 'diamonds-599',
    title: 'Мешок алмазов',
    description: '599 алмазов',
    imageURI: 'img-599.png',
    price: '499 ₽',
    priceValue: '499',
    priceCurrencyCode: 'RUB',
  },
];

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'SHOPPER',
  getPhoto: () => 'photo-url',
  getPayingStatus: () => 'paying',
  getData: async (keys?: string[]) => {
    record('player.getData', keys);
    return keys ? Object.fromEntries(keys.filter((k) => k in cloud).map((k) => [k, cloud[k]])) : { ...cloud };
  },
  setData: async (data: Record<string, unknown>, flush?: boolean) => {
    record('player.setData', { keys: Object.keys(data), flush: flush ?? false });
    if (failSetData) throw new Error('network down');
    Object.assign(cloud, data);
  },
  getStats: async () => ({ ...stats }),
  setStats: async (next: Record<string, number>) => {
    record('player.setStats', next);
    Object.assign(stats, next);
  },
  incrementStats: async (inc: Record<string, number>) => {
    record('player.incrementStats', inc);
    for (const [k, v] of Object.entries(inc)) stats[k] = (stats[k] ?? 0) + v;
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
    return unprocessed.map((p) => ({ ...p }));
  },
  purchase: async (data: { id: string; developerPayload?: string }) => {
    record('payments.purchase', data);
    if (purchaseRejects) throw new Error('PURCHASE_CANCELLED');
    const purchase: TestPurchase = {
      productID: data.id,
      purchaseToken: `token-${data.id}-${recordedPurchases.length + 1}`,
      developerPayload: data.developerPayload ?? '',
    };
    recordedPurchases.push(purchase);
    unprocessed.push(purchase); // the platform keeps it until the game consumes it
    return { ...purchase };
  },
  consumePurchase: async (token: string) => {
    record('payments.consumePurchase', token);
    if (consumeFails) throw new Error('consume failed');
    unprocessed = unprocessed.filter((p) => p.purchaseToken !== token);
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
        record('ysdk.getPayments');
        return payments;
      },
      features: { LoadingAPI: { ready: () => record('LoadingAPI.ready') }, GameplayAPI: { start() {}, stop() {} } },
      on() {},
    };
  },
};

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

// import AFTER the stubs: the modules read window/localStorage at call time, not at import time
const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync, getDiamonds, addDiamonds, flushProfile } = await import('../../src/game/profile');
const {
  DIAMOND_PACKS,
  REVIVE_DIAMOND_PRICE,
  buyDiamondPack,
  buyRevive,
  deliverPendingPurchases,
  diamondsBalance,
  loadShopCatalog,
  paymentsAvailable,
  resetShopCatalog,
} = await import('../../src/game/shop');

await initYandex();
await startProfileSync();
ok(paymentsAvailable(), 'Внутри Яндекса платёжный слой считается доступным');
ok(DIAMOND_PACKS['diamonds-100'] === 100 && DIAMOND_PACKS['diamonds-5999'] === 5999, 'Товары магазина сопоставлены с количеством алмазов');

// --- the catalogue: prices come from the Console, and it is fetched once -----------------------
let catalog = await loadShopCatalog();
ok(catalogCalls === 1, 'Каталог запрошен один раз');
const pack100 = catalog.get('diamonds-100');
ok(pack100?.label === '99 ₽', 'Цена взята из каталога как есть (п. 1.13.2)', JSON.stringify(pack100));
ok(pack100?.currencyIcon === 'icon-small.png', 'Иконка портальной валюты взята из getPriceCurrencyImage', String(pack100?.currencyIcon));
ok(catalog.get('diamonds-599')?.currencyIcon === null, 'Товар без иконки не ломает каталог');
ok(catalog.get('diamonds-100')?.fromCatalog === true, 'Товар помечен как полученный из каталога');
await loadShopCatalog();
ok(catalogCalls === 1, 'Второй вызов берёт каталог из памяти, а не из сети');

// --- a failed catalogue is not cached forever --------------------------------------------------
resetShopCatalog();
catalogFails = true;
let catalogThrew = false;
let failedCatalog: Map<string, unknown> | null = null;
try {
  failedCatalog = await loadShopCatalog();
} catch {
  catalogThrew = true;
}
ok(!catalogThrew && failedCatalog?.size === 0, 'Недоступный каталог возвращает пустую карту без исключения');
catalogFails = false;
catalog = await loadShopCatalog();
ok(catalog.size === 2, 'После сбоя каталог запрашивается снова и наполняется', `${catalog.size} товаров`);
ok(catalogCalls === 3, 'Пустой каталог не кэшируется навсегда (следующий заход в магазин повторит запрос)', `запросов: ${catalogCalls}`);

// --- an unprocessed purchase is delivered at start: credit → save → consume ---------------------
unprocessed = [{ productID: 'diamonds-100', purchaseToken: 'pending-1', developerPayload: '' }];
const setDataBefore = count('player.setData');
const delivered = await deliverPendingPurchases();
ok(delivered === 100, 'Незакрытая покупка доставлена (возвращает 100 алмазов)', String(delivered));
ok(diamondsBalance() === 100, 'Алмазы зачислены на баланс', String(diamondsBalance()));
const saveIdx = calls.findIndex((c, i) => i >= setDataBefore && c.name === 'player.setData');
const consumeIdx = calls.findIndex((c) => c.name === 'payments.consumePurchase');
ok(saveIdx >= 0 && saveIdx < consumeIdx, 'Награда сохранена в облако ДО погашения покупки (порядок из документации)');
ok(String((lastCall('player.setData')?.arg as { flush?: boolean } | undefined)?.flush) === 'true', 'Сохранение перед погашением идёт с flush=true');
ok(unprocessed.length === 0, 'Токен покупки погашен');
const cloudProfile = cloud['orerush.profile'] as { deliveredPurchases?: string[]; diamonds?: number } | undefined;
ok(cloudProfile?.deliveredPurchases?.includes('pending-1') === true, 'Погашенный токен записан в облачный профиль (защита от повторной выдачи)');
ok(cloudProfile?.diamonds === 100, 'Баланс алмазов уехал в облако вместе с профилем', String(cloudProfile?.diamonds));

// --- the same token comes back after a failed consume: retry the consume, never re-credit -------
consumeFails = true;
unprocessed = [{ productID: 'diamonds-100', purchaseToken: 'pending-1', developerPayload: '' }];
const beforeRetry = diamondsBalance();
const retryDelivered = await deliverPendingPurchases();
ok(retryDelivered === 0, 'Повторная доставка того же токена не начисляет алмазы второй раз', String(retryDelivered));
ok(diamondsBalance() === beforeRetry, 'Баланс после повторной доставки не изменился', String(diamondsBalance()));
consumeFails = false;
const finalRetry = await deliverPendingPurchases();
ok(finalRetry === 0 && unprocessed.length === 0, 'Следующий запуск только погашает токен, не начисляя награду снова');

// --- an unknown product is left alone (it may belong to another system) -------------------------
unprocessed = [{ productID: 'skins-pack', purchaseToken: 'unknown-1', developerPayload: '' }];
const unknownDelivered = await deliverPendingPurchases();
ok(unknownDelivered === 0, 'Неизвестный товар не начисляется');
ok(unprocessed.length === 1, 'Неизвестный товар остаётся неконсумированным (не теряем чужую покупку)');
ok(diamondsBalance() === beforeRetry, 'Баланс после неизвестного товара не изменился');
unprocessed = [];
resetShopCatalog(); // keep the catalogue checks independent of the shop flow below

// --- a normal purchase: the payment frame opens, diamonds arrive, the token is consumed ---------
const buyIndex = count('payments.purchase');
const purchaseResult = await buyDiamondPack('diamonds-599');
ok(purchaseResult.ok === true && purchaseResult.diamonds === 699, 'Покупка набора начисляет его алмазы', JSON.stringify(purchaseResult));
ok(count('payments.purchase') === buyIndex + 1, 'Покупка открывает платёжное окно ровно один раз');
const purchaseArg = lastCall('payments.purchase')?.arg as { id?: string; developerPayload?: string } | undefined;
ok(purchaseArg?.id === 'diamonds-599', 'В платёжное окно уходит id товара из Консоли', String(purchaseArg?.id));
ok(typeof purchaseArg?.developerPayload === 'string' && purchaseArg.developerPayload.length > 0, 'Покупка помечена developerPayload');
ok(count('payments.consumePurchase') >= 1 && unprocessed.length === 0, 'Оплаченная покупка погашена сразу после сохранения');

// --- a cancelled purchase changes nothing ------------------------------------------------------
purchaseRejects = true;
const balanceBeforeCancel = diamondsBalance();
const cancelled = await buyDiamondPack('diamonds-100');
ok(cancelled.ok === false && cancelled.reason === 'cancelled', 'Отмена платёжного окна — обычный исход, а не ошибка', JSON.stringify(cancelled));
ok(diamondsBalance() === balanceBeforeCancel, 'После отмены баланс не меняется', String(diamondsBalance()));
purchaseRejects = false;

// --- an unknown product id never reaches the platform -------------------------------------------
const purchaseCallsBefore = count('payments.purchase');
const badProduct = await buyDiamondPack('diamonds-999999');
ok(badProduct.ok === false && badProduct.reason === 'failed', 'Неизвестный id товара не считается покупкой', JSON.stringify(badProduct));
ok(count('payments.purchase') === purchaseCallsBefore, 'Платёжное окно для неизвестного товара не открывается');

// --- the cloud save fails: the purchase stays unconsumed and is delivered on the next launch -----
failSetData = true;
const undeclared = await buyDiamondPack('diamonds-100');
ok(undeclared.ok === false && undeclared.reason === 'failed', 'Неудачное сохранение не выдаёт покупку за успешную', JSON.stringify(undeclared));
const stuckToken = recordedPurchases.at(-1)!.purchaseToken;
ok(!recordedPurchases.slice(0, -1).some((p) => p.purchaseToken === stuckToken), 'У неудачной покупки свой токен');
ok(unprocessed.some((p) => p.purchaseToken === stuckToken), 'Токен остался неконсумированным — покупку восстановит следующий запуск');
failSetData = false;
const recovered = await deliverPendingPurchases();
const balanceAfterRecovery = diamondsBalance();
ok(recovered === 0, 'Восстановление уже начисленной покупки не платит второй раз', String(recovered));
ok(unprocessed.length === 0 && diamondsBalance() === balanceAfterRecovery, 'Токен всё равно погашается, баланс не растёт');

// --- the paid revive spends the balance and refuses to go negative ------------------------------
// bring the balance down below the revive price by actually spending it
let guard = 0;
while (diamondsBalance() >= REVIVE_DIAMOND_PRICE && buyRevive() && guard++ < 100) {
  /* each call spends one revive worth of diamonds */
}
const leftover = diamondsBalance();
ok(leftover < REVIVE_DIAMOND_PRICE, 'Баланс опущен ниже цены возрождения', String(leftover));
const statsBefore = { ...stats };
const poor = buyRevive();
ok(poor === false && diamondsBalance() === leftover, 'Возрождение не проходит при нехватке алмазов и не уводит баланс в минус', String(diamondsBalance()));
addDiamonds(REVIVE_DIAMOND_PRICE - leftover);
ok(diamondsBalance() === REVIVE_DIAMOND_PRICE, 'Баланс доведён ровно до цены возрождения', String(diamondsBalance()));
const rich = buyRevive();
ok(rich === true && diamondsBalance() === 0, 'Возрождение за 100 алмазов списывает ровно цену', String(diamondsBalance()));
await flushProfile(true); // stats are batched: the counters reach the platform on the next flush
ok((stats.diamondsSpent ?? 0) > (statsBefore.diamondsSpent ?? 0), 'Трата алмазов попадает в статистику diamondsSpent', JSON.stringify(stats));
ok((stats.diamondsBought ?? 0) >= 799, 'Купленные алмазы попадают в статистику diamondsBought', JSON.stringify(stats));
ok(getDiamonds() === 0, 'Баланс читается через profile.getDiamonds()');

export { passed, failures };
