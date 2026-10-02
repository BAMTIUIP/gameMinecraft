/**
 * Gate half of the advertising contract (src/game/ads.ts): when the remote-config flag turns ads off
 * or the game runs outside Yandex Games, no ad request may reach the platform at all — and the game
 * keeps working as if advertising did not exist.
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
// deliberately no window.YaGames: the game is not on Yandex Games in this scenario

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

// the Yandex Console switched advertising off for this player group
storage.set('orerush.flags.v1', JSON.stringify({ savedAt: Date.now(), flags: { 'adv.enabled': 'false' } }));

const { initYandex } = await import('../../src/game/yandex');
const { loadFlags } = await import('../../src/game/flags');
const { showFullscreenAd, showRewardedAd, fullscreenCooldownLeft, adInFlight } = await import('../../src/game/ads');

await initYandex();
const flags = await loadFlags('unknown');
ok(flags['adv.enabled'] === 'false', 'Флаг adv.enabled=false применился из удалённой конфигурации');

const fullscreen = await showFullscreenAd();
ok(fullscreen.skipped === 'flag' && !fullscreen.shown, 'При выключенной рекламе полноэкранный блок не запрашивается', JSON.stringify(fullscreen));
const rewarded = await showRewardedAd();
ok(rewarded.skipped === 'flag' && !rewarded.rewarded, 'Rewarded-видео тоже не запрашивается при выключенной рекламе', JSON.stringify(rewarded));
ok(Number.isFinite(fullscreenCooldownLeft()) && fullscreenCooldownLeft() >= 0, 'Кулдаун в выключенном состоянии считается корректно');
ok(!adInFlight(), 'Состояние «реклама на экране» не выставляется');

export { passed, failures };
