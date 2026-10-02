/**
 * Off-Yandex half of the shortcut contract: without `window.YaGames` there is no `ysdk.shortcut`, so
 * the menu must not show the button, nothing may be written to storage and the reward cannot leak.
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

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync, getDiamonds } = await import('../../src/game/profile');
const { requestShortcut, resetShortcutState, shortcutAccepted, shortcutOffer } = await import('../../src/game/shortcut');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await startProfileSync();

const balance = getDiamonds();
const offer = await shortcutOffer();
ok(offer.available === false && offer.reason === 'offline', 'Вне Яндекса ярлык не предлагается', JSON.stringify(offer));
const result = await requestShortcut();
ok(result === 'unavailable', 'Вне Яндекса окно ярлыка не открывается', result);
ok(getDiamonds() === balance, 'Награда за ярлык вне Яндекса не начисляется', String(getDiamonds()));
ok(!shortcutAccepted(), 'Ярлык не считается добавленным');
ok(!storage.has('orerush.shortcut.v1'), 'Вне Яндекса ничего не записывается в хранилище');
resetShortcutState();
ok((await shortcutOffer()).reason === 'offline', 'Сброс состояния не меняет вердикт вне платформы');

export { passed, failures };
