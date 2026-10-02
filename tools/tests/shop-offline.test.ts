/**
 * Off-Yandex half of the shop contract: with no `window.YaGames` there is no payment frame, so the
 * shop must stay a preview — no purchases, no catalogue, no crash — while the diamonds already on the
 * account (bought on Yandex or granted by a build script) remain spendable in the paid revive.
 * A crash here would brick the itch / own-hosting build.
 */

const storage = new Map<string, string>();
storage.set('orerush.diamonds.v1', '150'); // bought earlier, on a platform build

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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync, getDiamonds } = await import('../../src/game/profile');
const { buyDiamondPack, buyRevive, deliverPendingPurchases, diamondsBalance, loadShopCatalog, paymentsAvailable } = await import('../../src/game/shop');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await startProfileSync();
ok(!paymentsAvailable(), 'Покупки недоступны без SDK');

const catalog = await loadShopCatalog();
ok(catalog.size === 0, 'Каталог вне Яндекса пуст (магазин работает на подписях UI)');
ok((await deliverPendingPurchases()) === 0, 'Незакрытых покупок вне Яндекса нет');
const buy = await buyDiamondPack('diamonds-100');
ok(buy.ok === false && buy.reason === 'unavailable', 'Попытка покупки вне Яндекса отклоняется как недоступная', JSON.stringify(buy));
ok(diamondsBalance() === 150, 'Баланс локальных алмазов не изменился', String(diamondsBalance()));

ok(buyRevive() === true, 'Возрождение за локальные алмазы работает и вне платформы');
ok(getDiamonds() === 50, 'Возрождение списало ровно 100 алмазов', String(getDiamonds()));
const poor = await buyDiamondPack('diamonds-100');
ok(poor.reason === 'unavailable' && getDiamonds() === 50, 'Отказ в покупке не трогает баланс');

export { passed, failures };
