/**
 * Off-Yandex half of the promo contract: without `window.YaGames` there is no `ysdk.environment`,
 * so no campaign can exist and the remote-config request must not carry a promo feature.
 */

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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaAppId, yaPayload, yaReferrer } = await import('../../src/game/yandex');
const { initLang } = await import('../../src/game/i18n');
const { promoAction, promoClientFeature, promoEntry } = await import('../../src/game/promo');
const { allFlags, loadFlags } = await import('../../src/game/flags');

initLang();
const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
ok(yaReferrer() === null, 'Вне Яндекса referrer отсутствует');
ok(yaAppId() === null && yaPayload() === null, 'Вне Яндекса environment пуст');
ok(promoEntry() === null, 'Вне Яндекса акции нет', JSON.stringify(promoEntry()));
ok(promoAction() === null, 'Вне Яндекса переход по акции ничего не открывает', JSON.stringify(promoAction()));
ok(promoClientFeature() === null, 'Вне Яндекса clientFeature не добавляется');

await loadFlags();
ok(allFlags()['shop.enabled'] === 'true', 'Вне Яндекса конфигурация остаётся локальной', JSON.stringify(allFlags()['shop.enabled']));

export { passed, failures };
