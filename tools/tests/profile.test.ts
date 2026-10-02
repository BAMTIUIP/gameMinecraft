/**
 * Unit test for the cloud-progress layer (src/game/profile.ts + src/game/yandex.ts).
 *
 * The SDK is mocked in-process, so the test can assert on batching and on the platform rate limits
 * (setData 100/5 min, stats 60/min) that a real run would only reveal in the developer console.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((c) => c.name === name).length;

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
g.localStorage = localStorageStub;
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
// Node 22 defines navigator as a getter-only global: redefine it instead of assigning
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en', userActivation: { isActive: true } },
  configurable: true,
});

/* ------------------------------ SDK mock ------------------------------ */

let cloud: Record<string, unknown> = {};
let stats: Record<string, number> = {};
let authorized = true;

const player = {
  isAuthorized: () => authorized,
  getUniqueID: () => 'uid-1',
  getName: () => 'PLATFORM NICK',
  getPhoto: () => 'photo-url',
  getPayingStatus: () => 'not_paying',
  getData: async (keys?: string[]) => {
    record('player.getData', keys);
    return keys ? Object.fromEntries(keys.filter((k) => k in cloud).map((k) => [k, cloud[k]])) : { ...cloud };
  },
  setData: async (data: Record<string, unknown>, flush?: boolean) => {
    record('player.setData', { keys: Object.keys(data), flush: flush ?? false });
    Object.assign(cloud, data);
  },
  getStats: async () => {
    record('player.getStats');
    return { ...stats };
  },
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

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'en' } },
      serverTime: () => Date.now(),
      getPlayer: async (options?: unknown) => {
        record('ysdk.getPlayer', options);
        return player;
      },
      auth: { openAuthDialog: async () => record('auth.openAuthDialog') },
      getStorage: async () => localStorageStub,
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
const { startProfileSync, markProfileDirty, bumpStats, addTotals, flushProfile, getTotals } = await import('../../src/game/profile');

await initYandex();
ok(count('YaGames.init') === 1, 'initYandex() инициализирует SDK ровно один раз');

// --- local progress is newer than the cloud: it must be pushed, not overwritten ------------
storage.set('orerush.mode', 'survival');
storage.set('orerush.profile.savedAt', String(Date.now()));
storage.set(
  'orerush.highscores.v1',
  JSON.stringify([{ name: 'LOCAL', score: 555, blocks: 1, tier: 'IRON', depth: 2, combo: 1, date: Date.now(), token: 'run-1' }]),
);
cloud = {
  'orerush.profile': { v: 1, savedAt: Date.now() - 60_000, scores: [{ name: 'OLD', score: 1 }], name: 'STALE' },
};

const snapshot = await startProfileSync();
ok(snapshot.platform?.name === 'PLATFORM NICK', 'Профиль платформы прочитан', JSON.stringify(snapshot.platform));
ok(count('ysdk.getPlayer') === 1, 'getPlayer() вызывается один раз (лимит 20/5мин)', `вызовов: ${count('ysdk.getPlayer')}`);
ok(count('player.getData') >= 1, 'Облачные данные читаются через player.getData()');

await flushProfile(true);
const pushed = calls.filter((c) => c.name === 'player.setData').pop()?.arg as { keys: string[] } | undefined;
ok(!!pushed && pushed.keys.includes('orerush.profile'), 'Локальный прогресс уходит в облако одним ключом');
ok(
  !JSON.stringify(cloud['orerush.profile'] ?? {}).includes('"score":1}'),
  'Устаревшие облачные рекорды не перезаписывают свежие локальные',
  JSON.stringify(cloud['orerush.profile']).slice(0, 120),
);

// --- batching: many changes, few requests --------------------------------------------------
const before = count('player.setData');
for (let i = 0; i < 5; i += 1) markProfileDirty({ name: `N${i}` });
await flushProfile(true);
const after = count('player.setData');
ok(after - before <= 1, 'Пять изменений профиля батчатся в один setData', `запросов: ${after - before}`);

// --- stats: counters are incremented, peaks are set ---------------------------------------
stats = {};
bumpStats({ blocksMined: 3 });
bumpStats({ blocksMined: 4, runs: 1 });
bumpStats({ bestScore: 120, deepest: 30 });
await flushProfile(true);
const increments = calls.filter((c) => c.name === 'player.incrementStats').map((c) => c.arg as Record<string, number>);
ok(
  increments.length >= 1 && increments[increments.length - 1].blocksMined === 7,
  'Счётчики агрегируются до одного incrementStats',
  JSON.stringify(increments[increments.length - 1]),
);
ok(
  !Object.keys(increments[increments.length - 1]).includes('bestScore'),
  'Лучший счёт не инкрементируется (это рекорд, а не счётчик)',
);
const setStats = calls.filter((c) => c.name === 'player.setStats').map((c) => c.arg as Record<string, number>);
ok(setStats.length >= 1 && setStats[setStats.length - 1].bestScore === 120, 'Рекорды отправляются через setStats', JSON.stringify(setStats));
ok(stats.blocksMined === 7, 'Инкремент статистики дошёл до платформы', JSON.stringify(stats));

// --- lifetime totals merge with cloud peaks -------------------------------------------------
cloud = {};
stats = { bestScore: 900, blocksMined: 50 };
const totalsBefore = getTotals();
ok(typeof totalsBefore.bestScore === 'number', 'Локальные итоги читаются');
addTotals({ bestScore: 100 });
ok(getTotals().bestScore >= 100, 'Локальный рекорд растёт');
const totalRequests = calls.filter((c) => c.name.startsWith('player.')).length;
ok(totalRequests <= 20, 'Число запросов к player.* в пределах разумного', `запросов: ${totalRequests}`);

await flushProfile(true);
ok(typeof cloud['orerush.profile'] === 'object', 'Профиль лежит в облаке под ключом orerush.profile');
const stored = cloud['orerush.profile'] as { totals?: { bestScore?: number }; scores?: unknown[] };
ok((stored.totals?.bestScore ?? 0) >= 100, 'Итоговые показатели едут вместе с профилем', JSON.stringify(stored.totals));

// --- a guest (not authorised) must not leak the platform nick -------------------------------
authorized = false;
const { yaRefreshProfile } = await import('../../src/game/yandex');
const guest = await yaRefreshProfile(true);
ok(guest?.authorized === false && guest.name === '', 'У неавторизованного игрока нет имени и аватара из профиля');

export { passed, failures, calls };
