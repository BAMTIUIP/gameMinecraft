/**
 * Unit test for the SDK markup of requirement 1.19 (https://yandex.ru/dev/games/doc/ru/requirements/1/19).
 *
 * Moderation watches two indicators on the debug panel: the purple Game Ready one and the green/red
 * gamepad one. Both are driven by the engine phase through `yaMarkupForPhase()`, so the mapping has
 * to stay exact — a gamepad that stays green over a finished level or over an ad is a rejection.
 *
 * Part 1 checks the table itself. Part 2 drives the real wrappers against a mocked `features`
 * object and asserts what actually reaches the SDK: `ready()` once per session, and start/stop only
 * when the state really changes.
 */

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string, detail = '') {
  if (cond) passed++;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

/* ------------------------------- browser stubs ------------------------------- */

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    clear: () => storage.clear(),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    },
  },
  configurable: true,
});
g.document = {
  title: '',
  documentElement: { lang: '' },
  querySelector: () => null,
  addEventListener() {},
  removeEventListener() {},
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

/** every call the mocked SDK receives, in order */
const sdkCalls: string[] = [];
g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    features: {
      LoadingAPI: {
        ready() {
          sdkCalls.push('LoadingAPI.ready');
        },
      },
      GameplayAPI: {
        start() {
          sdkCalls.push('GameplayAPI.start');
        },
        stop() {
          sdkCalls.push('GameplayAPI.stop');
        },
      },
    },
    getStorage: () => localStorage,
  }),
};

const { initYandex, yaMarkupForPhase } = await import('../../src/game/yandex');
const { yaLoadingReady, yaGameplayStart, yaGameplayStop } = await import('../../src/game/yandex');
await initYandex();

/* ------------- 1. the phase table (what moderation sees) ------------- */

const phases = ['loading', 'menu', 'playing', 'paused', 'gameover'] as const;
const expected: Record<(typeof phases)[number], { ready: boolean; gameplay: boolean }> = {
  loading: { ready: false, gameplay: false },
  menu: { ready: true, gameplay: false },
  playing: { ready: true, gameplay: true },
  paused: { ready: true, gameplay: false },
  gameover: { ready: true, gameplay: false },
};

for (const phase of phases) {
  const got = yaMarkupForPhase(phase);
  ok(
    got.ready === expected[phase].ready && got.gameplay === expected[phase].gameplay,
    `Фаза ${phase}: разметка SDK ${JSON.stringify(expected[phase])}`,
    JSON.stringify(got),
  );
}

ok(!yaMarkupForPhase('loading').ready, 'На загрузочном экране Game Ready ещё не сообщается');
ok(yaMarkupForPhase('playing').gameplay, 'Во время забега индикатор геймплея зелёный');
for (const phase of ['menu', 'paused', 'gameover'] as const) {
  ok(!yaMarkupForPhase(phase).gameplay, `Фаза ${phase}: индикатор геймплея красный`);
}
ok(yaMarkupForPhase('menu').ready, 'В меню Game Ready уже сообщён — игрок может играть');

/* ------------- 2. what really reaches the SDK ------------- */

// a whole session walked phase by phase — exactly the scenario list of 1.19.3. This runs first,
// while the wrapper is still in its initial state, so the expected sequence is exact.
sdkCalls.length = 0;
const walk: Array<(typeof phases)[number]> = [
  'loading', // own loading screen: nothing is sent yet
  'menu', // menu is up → Game Ready, gamepad red
  'playing', // run started
  'paused', // ad / platform pause / game menu
  'playing', // back to the run
  'gameover', // level finished
  'menu', // back to the menu
  'playing', // a new run
];
for (const phase of walk) {
  const markup = yaMarkupForPhase(phase);
  if (markup.ready) yaLoadingReady();
  if (markup.gameplay) yaGameplayStart();
  else yaGameplayStop();
}
ok(
  sdkCalls.join(',') ===
    [
      'LoadingAPI.ready',
      'GameplayAPI.start',
      'GameplayAPI.stop',
      'GameplayAPI.start',
      'GameplayAPI.stop',
      'GameplayAPI.start',
    ].join(','),
  'Сессия loading→menu→playing→paused→playing→gameover→menu→playing даёт ровно одну последовательность start/stop',
  sdkCalls.join(', '),
);
ok(sdkCalls.filter((c) => c === 'LoadingAPI.ready').length === 1, 'За сессию Game Ready отправлен один раз', sdkCalls.join(', '));

// repeating the same state must not produce another call — the SDK counts them
sdkCalls.length = 0;
yaLoadingReady();
yaLoadingReady();
yaLoadingReady();
ok(
  sdkCalls.filter((c) => c === 'LoadingAPI.ready').length === 0,
  'Повторный LoadingAPI.ready() в SDK не уходит',
  sdkCalls.join(', '),
);
sdkCalls.length = 0;
yaGameplayStart();
yaGameplayStart();
ok(sdkCalls.length === 0, 'Повторный start() не дублируется', sdkCalls.join(', '));
yaGameplayStop();
yaGameplayStop();
ok(sdkCalls.join(',') === 'GameplayAPI.stop', 'Повторный stop() не дублируется', sdkCalls.join(', '));
sdkCalls.length = 0;
yaGameplayStart();
ok(sdkCalls.join(',') === 'GameplayAPI.start', 'Возобновление после паузы снова зеленит индикатор', sdkCalls.join(', '));

export { passed, failures };
