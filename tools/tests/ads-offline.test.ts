/**
 * Off-Yandex half of the advertising contract: on itch, on the developer's own hosting or in plain
 * `npm run dev` there is no `window.YaGames`, so the ad calls must quietly do nothing. This is the
 * configuration the game is played in outside Yandex Games, and a crash here would brick the build.
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });
// no YaGames global and no cached flags: the shipped local configuration is what the game lives with

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaAdvAvailable } = await import('../../src/game/yandex');
const { loadFlags } = await import('../../src/game/flags');
const { showFullscreenAd, showRewardedAd, syncBanner } = await import('../../src/game/ads');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await loadFlags();
ok(!yaAdvAvailable(), 'Реклама недоступна без SDK');

const fullscreen = await showFullscreenAd();
ok(fullscreen.skipped === 'offline' && !fullscreen.shown, 'Полноэкранный блок вне Яндекса не запрашивается', JSON.stringify(fullscreen));
const rewarded = await showRewardedAd();
ok(rewarded.skipped === 'offline' && !rewarded.rewarded, 'Rewarded-видео вне Яндекса не запрашивается', JSON.stringify(rewarded));
let bannerFailed = false;
try {
  await syncBanner(true);
} catch {
  bannerFailed = true;
}
ok(!bannerFailed, 'Управление стики-баннером вне Яндекса не бросает исключений');

export { passed, failures };
