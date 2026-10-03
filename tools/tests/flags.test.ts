/**
 * Unit test for remote config (src/game/flags.ts).
 *
 * Verifies the precedence documented on https://yandex.ru/dev/games/doc/ru/sdk/sdk-config:
 * remote config → cached remote config → local configuration (defaultFlags), and that the local
 * configuration is always shipped so a failed fetch cannot leave the game without a value.
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

/** what the "remote config in the Yandex Console" would answer for this player group */
let remote: Record<string, string> | null = { 'adv.enabled': 'false', 'ui.showFps': 'false' };

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    getFlags: async (params?: { defaultFlags?: Record<string, string>; clientFeatures?: Array<{ name: string; value: string }> }) => {
      record('ysdk.getFlags', params);
      return remote;
    },
    getPlayer: async () => ({
      isAuthorized: () => true,
      getUniqueID: () => 'uid',
      getName: () => 'NICK',
      getPhoto: () => '',
      getPayingStatus: () => 'paying',
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
const { startProfileSync } = await import('../../src/game/profile');

await initYandex();

// --- 1. before any fetch: local configuration only -------------------------------------------
ok(flag('shop.enabled') === LOCAL_FLAGS['shop.enabled'], 'До загрузки флагов действует локальная конфигурация');
ok(LOCAL_FLAGS['ui.showFps'] === 'false' && flagBool('ui.showFps') === false, 'Локальная production-конфигурация не включает FPS-отладку');
ok(Object.keys(LOCAL_FLAGS).length >= 8, 'Локальная конфигурация непустая', `${Object.keys(LOCAL_FLAGS).length} ключей`);
ok(Object.values(LOCAL_FLAGS).every((v) => typeof v === 'string'), 'Все значения локальной конфигурации — строки (контракт SDK)');

// --- 2. remote config wins over the cache and over the local configuration -------------------
storage.set('orerush.flags.v1', JSON.stringify({ savedAt: Date.now() - 60_000, flags: { 'game.exploreMinutes': '5' } }));
remote = { 'adv.enabled': 'false', 'ui.showFps': 'false', 'multiplayer.maxPlayers': '5' };
const loaded = await loadFlags('paying');
const call = calls.find((c) => c.name === 'ysdk.getFlags')?.arg as {
  defaultFlags?: Record<string, string>;
  clientFeatures?: Array<{ name: string; value: string }>;
};
ok(!!call, 'ysdk.getFlags() вызван');
ok((call?.defaultFlags?.['adv.enabled'] ?? null) === LOCAL_FLAGS['adv.enabled'], 'defaultFlags содержит локальную конфигурацию');
const featureNames = (call?.clientFeatures ?? []).map((f) => f.name);
ok(featureNames.includes('payingStatus'), 'Клиентский параметр payingStatus передан', JSON.stringify(featureNames));
ok(featureNames.includes('lang'), 'Клиентский параметр lang передан');
ok(loaded['adv.enabled'] === 'false' && flagBool('adv.enabled') === false, 'Удалённая конфигурация имеет приоритет над кэшем и локальной');
ok(flag('game.exploreMinutes') === LOCAL_FLAGS['game.exploreMinutes'], 'Ключ, которого нет в свежей конфигурации, берётся из локальной');
ok(flagNumber('multiplayer.maxPlayers') === 5, 'flagNumber() разбирает числовые флаги');
ok(flagNumber('nonexistent', 3) === 3, 'flagNumber() возвращает fallback для неизвестного ключа');

// --- 3. flags are cached for the next offline start ------------------------------------------
const cached = JSON.parse(storage.get('orerush.flags.v1') ?? '{}') as { flags?: Record<string, string> };
ok(cached.flags?.['adv.enabled'] === 'false', 'Удалённая конфигурация сохранена в кэш');

// --- 4. player profile + flags together (the boot order the game uses) -----------------------
await startProfileSync();
const snapshotFlags = allFlags();
ok(typeof snapshotFlags === 'object' && Object.keys(snapshotFlags).length > 0, 'Полный набор флагов доступен приложению');

export { passed, failures, calls };
