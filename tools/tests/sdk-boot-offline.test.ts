/**
 * Off-Yandex half of the SDK-connection contract: when the page does not ask for `/sdk.js` at all
 * (dev server, own hosting), `initYandex()` must resolve to null immediately — no waiting, no errors —
 * and the advertising calls must degrade to the documented no-op.
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
g.document = {
  title: '',
  documentElement: { lang: '' },
  addEventListener() {},
  removeEventListener() {},
  // no sdk.js script on the page: this is not Yandex Games at all
  querySelector: () => null,
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaAdvAvailable } = await import('../../src/game/yandex');
const { markAdSessionStart, showFullscreenAd, showRewardedAd } = await import('../../src/game/ads');

const startedAt = Date.now();
const sdk = await initYandex();
const spent = Date.now() - startedAt;
ok(sdk === null, 'Без тега /sdk.js SDK не инициализируется (initYandex → null)');
ok(spent < 1_000, 'Игра не ждёт SDK, которого на странице нет', `${spent} ms`);
ok(!yaAdvAvailable(), 'Реклама недоступна вне платформы');

markAdSessionStart();
const fullscreen = await showFullscreenAd();
ok(fullscreen.skipped === 'offline' && !fullscreen.shown, 'Полноэкранная реклама вне платформы — тихий no-op', JSON.stringify(fullscreen));
const rewarded = await showRewardedAd();
ok(rewarded.skipped === 'offline' && !rewarded.rewarded, 'Rewarded-видео вне платформы не начисляет награду', JSON.stringify(rewarded));

export { passed, failures };
