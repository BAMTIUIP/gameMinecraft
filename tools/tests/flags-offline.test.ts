/**
 * Offline half of the remote-config contract (src/game/flags.ts).
 *
 * When the platform does not answer (no network, or the game is not on Yandex Games at all), the
 * last successfully fetched configuration keeps working, and the local configuration shipped in the
 * code fills every gap. A flag must never be missing — that is what the SDK docs ask for.
 */

const calls: Array<{ name: string; arg: unknown }> = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });

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

/** the "remote config server" answers nothing at all here */
let remote: Record<string, string> | null = null;

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    getFlags: async (params?: unknown) => {
      record('ysdk.getFlags', params);
      return remote;
    },
    getPlayer: async () => ({
      isAuthorized: () => false,
      getUniqueID: () => 'uid',
      getName: () => '',
      getPhoto: () => '',
      getPayingStatus: () => 'unknown',
      getData: async () => ({}),
      setData: async () => undefined,
      getStats: async () => ({}),
      setStats: async () => undefined,
      incrementStats: async () => ({}),
    }),
    features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
    on() {},
  }),
};

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex } = await import('../../src/game/yandex');
const { LOCAL_FLAGS, loadFlags, flag, flagBool, flagNumber, allFlags } = await import('../../src/game/flags');

await initYandex();

// --- 1. the last configuration the player actually had keeps working ---------------------------
storage.set(
  'orerush.flags.v1',
  JSON.stringify({ savedAt: Date.now() - 60_000, flags: { 'game.exploreMinutes': '5', 'adv.enabled': 'false' } }),
);
remote = null;
await loadFlags('unknown');

ok(flag('game.exploreMinutes') === '5', 'При недоступном сервере берётся кэш прошлой конфигурации', flag('game.exploreMinutes'));
ok(flagBool('adv.enabled') === false, 'Флаг из кэша продолжает действовать офлайн');
ok(flagBool('shop.enabled') === true, 'Флаг, которого нет ни в кэше, ни на сервере, остаётся локальным');
const call = calls.find((c) => c.name === 'ysdk.getFlags')?.arg as { defaultFlags?: Record<string, string> } | undefined;
ok(
  (call?.defaultFlags?.['shop.enabled'] ?? null) === LOCAL_FLAGS['shop.enabled'],
  'Локальная конфигурация всё равно передаётся в defaultFlags',
);
ok(Object.keys(allFlags()).length >= Object.keys(LOCAL_FLAGS).length, 'Полный набор флагов доступен приложению в любой момент');
ok(flagNumber('multiplayer.maxPlayers') === 5, 'Числовой флаг из локальной конфигурации читается без сервера');

// --- 2. a second call in the same session makes no extra network request ----------------------
const before = calls.length;
await loadFlags('unknown');
ok(calls.length === before, 'Флаги запрашиваются один раз за сессию, как советует документация');

export { passed, failures, calls };
