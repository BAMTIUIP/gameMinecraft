/**
 * Unit test for the connection variants and callback contract of the SDK examples
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-example).
 *
 * The page shows two connections and one rule:
 *  - synchronous — `<script src="/sdk.js">` ahead of the game, `YaGames.init()` once;
 *  - asynchronous — the script is injected with `s.async = true`, so the game code may run *before*
 *    the SDK appears; the game has to wait for it instead of deciding "not Yandex Games" at once;
 *  - a callback of ours that throws must not abort other code, and `onClose(wasShown)` / `onError`
 *    must always settle the ad promise — even when the platform calls them in an unusual order.
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
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });

/** the SDK script tag is on the page, as in both examples */
let scriptTags: Array<{ src: string }> = [{ src: '/sdk.js' }];
g.document = {
  title: '',
  documentElement: { lang: '' },
  addEventListener() {},
  removeEventListener() {},
  querySelector: (selector: string) => {
    if (!selector.includes('sdk.js')) return null;
    return scriptTags.length ? { src: scriptTags[0].src } : null;
  },
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

/** how the example's async variant behaves: the global appears with a delay */
let sdkDelayMs = 0;

const advCalls: Array<{ method: string; callbacks: Record<string, unknown> }> = [];
/** platform subscriptions, so the test can invoke them the way the SDK does */
const listeners = new Map<string, Array<(payload?: unknown) => void>>();
const emit = (event: string, payload?: unknown) => {
  for (const listener of [...(listeners.get(event) ?? [])]) listener(payload);
};

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
  setData: async () => undefined,
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

function installSdk() {
  (globalThis as unknown as { YaGames?: unknown }).YaGames = {
    init: async () => {
      record('YaGames.init');
      return {
        environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
        serverTime: () => Date.now(),
        getPlayer: async () => player,
        getStorage: async () => localStorageStub,
        features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
        on: (event: string, listener: (payload?: unknown) => void) => {
          listeners.set(event, [...(listeners.get(event) ?? []), listener]);
        },
        adv: {
          showFullscreenAdv: (params?: { callbacks?: Record<string, unknown> }) => {
            record('adv.showFullscreenAdv', params ? Object.keys(params.callbacks ?? {}) : null);
            advCalls.push({ method: 'fullscreen', callbacks: params?.callbacks ?? {} });
          },
          showRewardedVideo: (params?: { callbacks?: Record<string, unknown> }) => {
            record('adv.showRewardedVideo', params ? Object.keys(params.callbacks ?? {}) : null);
            advCalls.push({ method: 'rewarded', callbacks: params?.callbacks ?? {} });
          },
        },
      };
    },
  };
}

// the SDK is deliberately *not* installed here: the test installs it later, like the async example

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { initYandex, yaOnMultiplayer, yaReady } = await import('../../src/game/yandex');
const { showFullscreenAd, showRewardedAd } = await import('../../src/game/ads');
const { loadFlags } = await import('../../src/game/flags');
const { getTotals } = await import('../../src/game/profile');

// --- asynchronous connection: the game starts before the SDK and waits for it -------------------
sdkDelayMs = 400;
setTimeout(installSdk, sdkDelayMs);
const startedAt = Date.now();
ok(yaReady() === false, 'Дораждения SDK игра ещё не считает платформу готовой (2.14)');
const sdk = await initYandex();
ok(yaReady() === true, 'После init() флаг yaReady() поднят — язык платформы известен (2.14)');
ok(yaReady() === true, 'Повторный initYandex() не сбрасывает флаг готовности');
const waited = Date.now() - startedAt;
ok(!!sdk, 'Асинхронное подключение: игра дождалась SDK, появившегося позже', String(waited));
ok(waited >= 300, 'Ожидание действительно было (не мгновенный отказ)', `${waited} ms`);
ok(count('YaGames.init') === 1, 'YaGames.init() вызван ровно один раз', String(count('YaGames.init')));
const parallel = await Promise.all([initYandex(), initYandex(), initYandex()]);
ok(parallel.every((s) => !!s) && count('YaGames.init') === 1, 'Параллельные вызовы initYandex() не инициализируют SDK повторно', String(count('YaGames.init')));

await loadFlags();
// the session grace period only holds the very beginning of the session: move the clock past it, the
// way a real player does by spending thirty seconds in the menu
const realNow = Date.now;
let clockOffset = 120_000;
Date.now = () => realNow() + clockOffset;
const advance = (ms: number) => {
  clockOffset += ms;
};

// --- the fullscreen call passes all three callbacks of the example ------------------------------
const fullscreen = showFullscreenAd();
await new Promise((r) => setTimeout(r, 10));
const fullscreenCall = advCalls.find((c) => c.method === 'fullscreen');
ok(!!fullscreenCall, 'showFullscreenAdv() вызван');
const names = Object.keys(fullscreenCall?.callbacks ?? {});
ok(
  names.includes('onClose') && names.includes('onOpen') && names.includes('onError'),
  'Переданы все колбэки примера (onClose, onOpen, onError)',
  names.join(','),
);
const recorded = calls.filter((c) => c.name === 'adv.showFullscreenAdv').at(-1)?.arg as string[] | null;
ok(Array.isArray(recorded) && recorded.length === 3, 'Мок увидел три колбэка', JSON.stringify(recorded));

// --- onClose(wasShown) is authoritative ----------------------------------------------------------
(fullscreenCall?.callbacks.onOpen as () => void)?.();
(fullscreenCall?.callbacks.onClose as (wasShown: boolean) => void)?.(false);
const closed = await fullscreen;
ok(closed.shown === false && closed.skipped === undefined, 'onClose(false) — реклама не показывалась, это не ошибка', JSON.stringify(closed));

// --- a handler of ours that throws must not abort other code (the example's rule) ---------------
const seen: string[] = [];
const offFirst = yaOnMultiplayer({
  transaction: () => {
    throw new Error('broken transaction handler');
  },
});
const offSecond = yaOnMultiplayer({
  transaction: (data) => seen.push(data.opponentId),
});
let escaped = false;
try {
  emit('multiplayer-sessions-transaction', { opponentId: 'opp-1', transactions: [] });
} catch {
  escaped = true;
}
ok(!escaped, 'Исключение в одном обработчике не пробивается наружу (защита колбэков)');
ok(seen.join(',') === 'opp-1', 'Второй обработчик всё равно получил событие', seen.join(','));
offFirst();
offSecond();
// --- onError alone settles the promise (no fill / too frequent) ----------------------------------
advance(200_000); // the previous ad has aged out of the 180 s cooldown from the local config
const third = showFullscreenAd();
await new Promise((r) => setTimeout(r, 10));
const thirdCall = advCalls.filter((c) => c.method === 'fullscreen').at(-1);
(thirdCall?.callbacks.onError as (error: unknown) => void)?.(new Error('too frequent'));
const thirdResult = await third;
ok(thirdResult.skipped === 'error' && thirdResult.shown === false, 'onError сам по себе завершает ожидание', JSON.stringify(thirdResult));

// --- rewarded video: onRewarded is authoritative; without it, onClose(false) gives nothing -------
const rewarded = showRewardedAd();
await new Promise((r) => setTimeout(r, 10));
const rewardedCall = advCalls.filter((c) => c.method === 'rewarded').at(-1);
const rewardedNames = Object.keys(rewardedCall?.callbacks ?? {});
ok(
  rewardedNames.includes('onRewarded') && rewardedNames.includes('onClose') && rewardedNames.includes('onError'),
  'В rewarded-видео переданы onRewarded, onClose и onError',
  rewardedNames.join(','),
);
(rewardedCall?.callbacks.onRewarded as () => void)?.();
(rewardedCall?.callbacks.onClose as (wasShown: boolean) => void)?.(true);
const rewardedResult = await rewarded;
ok(rewardedResult.rewarded === true, 'onRewarded + onClose(true) дают награду', JSON.stringify(rewardedResult));

const skipped = showRewardedAd();
await new Promise((r) => setTimeout(r, 10));
const skippedCall = advCalls.filter((c) => c.method === 'rewarded').at(-1);
(skippedCall?.callbacks.onClose as (wasShown: boolean) => void)?.(false);
const skippedResult = await skipped;
ok(skippedResult.rewarded === false, 'Закрытие без callback onRewarded не даёт награду', JSON.stringify(skippedResult));
ok(typeof getTotals().runs === 'number', 'Игровые данные после всех колбэков доступны (игра не сломалась)');

export { passed, failures };
