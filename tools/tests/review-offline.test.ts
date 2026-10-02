/**
 * Off-Yandex half of the rating contract: without `window.YaGames` there is no `ysdk.feedback`, so the
 * game must simply never offer the rating button. A crash here would break the itch / own-hosting
 * build, where the whole feedback module does not exist.
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
const { startProfileSync } = await import('../../src/game/profile');
const { requestGameReview, resetReviewState, reviewOffer } = await import('../../src/game/review');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await startProfileSync();

const offer = await reviewOffer();
ok(offer.available === false && offer.reason === 'offline', 'Вне Яндекса оценку не предлагают', JSON.stringify(offer));
const result = await requestGameReview();
ok(result === 'unavailable', 'Вне Яндекса диалог оценки не открывается', result);
ok(!storage.has('orerush.review.v1'), 'Вне Яндекса ничего не записывается в хранилище');
resetReviewState();
ok((await reviewOffer()).reason === 'offline', 'Сброс состояния не меняет вердикт вне платформы');

export { passed, failures };
