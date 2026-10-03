/** Off-Yandex shop contract: no payment SDK means no catalogue or checkout, without breaking the game. */
const storage = new Map<string, string>();
storage.set('orerush.diamonds.v1', '150'); // stale wallet from an older build; boot must retire it

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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex } = await import('../../src/game/yandex');
const profile = await import('../../src/game/profile');
const shop = await import('../../src/game/shop');

const sdk = await initYandex();
ok(sdk === null, 'Outside Yandex Games the SDK does not initialize');
await profile.startProfileSync();
ok(!shop.paymentsAvailable(), 'Purchases are unavailable without the platform SDK');
ok(storage.has('orerush.diamonds.v1') === false, 'The retired local wallet is removed during profile startup');

const catalog = await shop.loadShopCatalog();
ok(catalog.size === 0, 'The shop has no catalogue offers outside Yandex Games');
ok((await shop.deliverPendingPurchases()) === 0, 'There are no platform receipts to restore offline');
const buy = await shop.buyShopProduct('chest-common');
ok(!buy.ok && buy.reason === 'unavailable', 'Direct SKU checkout is rejected when platform payments are unavailable', JSON.stringify(buy));
ok(!('getDiamonds' in profile) && !('addDiamonds' in profile), 'The old in-game wallet API no longer exists');

export { passed, failures };
