/**
 * Unit test for the leaderboard layer (src/game/leaderboard.ts + the `ysdk.leaderboards` wrappers).
 *
 * Covers what the browser check cannot show deterministically: the platform rate limits (setScore
 * 1/s, getPlayerEntry 60/5 min, getEntries 20/5 min), the coalescing of a burst of scores, the local
 * cache, the "player hid their profile" case and the format of the score as the Console describes it.
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
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ru', userActivation: { isActive: true } },
  configurable: true,
});

/* ------------------------------ SDK mock ------------------------------ */

let authorized = true;
let scoreMethodAvailable = true;
let scoreAvailabilityGate: Promise<boolean> | null = null;
let playerEntryMethodAvailable = true;
let playerEntryGate: Promise<void> | null = null;
let onPlayerEntryCall: (() => void) | null = null;
let playerEntryPresent = true;
let entriesShouldFail = false;
let ranked = false;

const DESCRIPTION = {
  name: 'orerush-best-score',
  appID: '0',
  default: true,
  title: { ru: 'Лучшие шахтёры', en: 'Top miners' },
  description: { sort_order: 'DESC', invert_sort_order: false, score_format: { type: 'numeric', options: { decimal_offset: 0 } } },
};

/** the entries the platform hands back: the top plus a block around the player (with an overlap) */
function entriesPayload() {
  const entries = [
    { rank: 1, score: 15000, player: { publicName: 'DEEP DIGGER', uniqueID: 'uid-1', getAvatarSrc: () => 'avatar-1.png' } },
    { rank: 2, score: 9000, player: { publicName: 'CLOUD MINER', uniqueID: 'uid-2', getAvatarSrc: () => 'avatar-2.png' } },
    // the platform may repeat the player's row: once in the top, once in the "around" block
    { rank: 3, score: 5000, player: { publicName: 'SHOPPER', uniqueID: 'uid-me', getAvatarSrc: () => 'avatar-me.png' } },
    { rank: 3, score: 5000, player: { publicName: 'SHOPPER', uniqueID: 'uid-me', getAvatarSrc: () => 'avatar-me.png' } },
    { rank: 4, score: 0, player: { publicName: '', uniqueID: 'uid-hidden' } },
  ];
  return { leaderboard: DESCRIPTION, ranges: [{ start: 0, size: entries.length }], userRank: 3, entries };
}

const player = {
  isAuthorized: () => authorized,
  getUniqueID: () => 'uid-me',
  getName: () => 'SHOPPER',
  getPhoto: () => 'photo.png',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
  setData: async (data: Record<string, unknown>) => record('player.setData', data),
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
      serverTime: () => Date.now(),
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
      isAvailableMethod: async (method: string) => {
        record('ysdk.isAvailableMethod', method);
        if (method === 'leaderboards.setScore') return scoreAvailabilityGate ?? scoreMethodAvailable;
        if (method === 'leaderboards.getPlayerEntry') return playerEntryMethodAvailable;
        return true;
      },
      leaderboards: {
        getDescription: async (name: string) => {
          record('leaderboards.getDescription', name);
          return DESCRIPTION;
        },
        setScore: async (name: string, score: number, extraData?: string) => {
          record('leaderboards.setScore', { name, score, extraData });
          ranked = true;
        },
        getPlayerEntry: async (name: string) => {
          record('leaderboards.getPlayerEntry', name);
          onPlayerEntryCall?.();
          if (playerEntryGate) await playerEntryGate;
          if (!playerEntryPresent) {
            const err = new Error('player not present') as Error & { code: string };
            err.code = 'LEADERBOARD_PLAYER_NOT_PRESENT';
            throw err;
          }
          return { rank: 3, score: 5000, extraData: '', player: { publicName: 'SHOPPER', uniqueID: 'uid-me' } };
        },
        getEntries: async (name: string, options?: unknown) => {
          record('leaderboards.getEntries', { name, options });
          if (entriesShouldFail) throw new Error('temporary leaderboard outage');
          return entriesPayload();
        },
      },
      features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
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
const { initYandex, yaRefreshProfile } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const {
  LEADERBOARD_NAME,
  formatLeaderboardScore,
  leaderboardAvailable,
  leaderboardCooldownLeft,
  leaderboardTitle,
  loadLeaderboard,
  loadMyRank,
  resetLeaderboardState,
  submitLeaderboardScore,
} = await import('../../src/game/leaderboard');

await initYandex();
await startProfileSync();
ok(leaderboardAvailable(), 'Внутри Яндекса лидерборды считаются доступными');
ok(LEADERBOARD_NAME === 'orerush-best-score', 'Техническое название лидерборда совпадает с тем, что создаётся в Консоли', LEADERBOARD_NAME);

// --- the top: sorted, deduplicated, the player's row marked -------------------------------------
const view = await loadLeaderboard();
ok(view !== null, 'Список лидерборда загружается');
ok(count('leaderboards.getEntries') === 1, 'getEntries() вызван один раз');
const options = calls.find((c) => c.name === 'leaderboards.getEntries')?.arg as { name?: string; options?: { quantityTop?: number; quantityAround?: number; includeUser?: boolean } };
ok(options?.name === LEADERBOARD_NAME, 'Запрос уходит к лидерборду из Консоли', String(options?.name));
ok(options?.options?.includeUser === true && (options?.options?.quantityTop ?? 0) > 0, 'Запрос включает игрока и топ', JSON.stringify(options?.options));
ok(view?.rows.length === 4, 'Дубликат записи игрока схлопнут', `строк: ${view?.rows.length}`);
ok(view?.rows[0].rank === 1 && view?.rows[3].rank === 4, 'Строки отсортированы по месту');
ok(view?.rows[2].me === true && view?.rows[2].name === 'SHOPPER', 'Своя строка помечена и подписана ником игрока');
ok(view?.rows[2].avatar === 'avatar-me.png', 'Аватар берётся из getAvatarSrc()', String(view?.rows[2].avatar));
ok(view?.rows[3].hidden === true && view?.rows[3].name === '', 'Скрытый игрок распознан (в интерфейсе — «Игрок скрыт»)');
ok(view?.userRank === 3, 'Место игрока взято из ответа', String(view?.userRank));
ok(view?.title === 'Лучшие шахтёры', 'Название лидерборда локализовано по языку игрока', String(view?.title));
ok(leaderboardCooldownLeft() > 0, 'После запроса действует пауза до следующего обращения к платформе', String(leaderboardCooldownLeft()));

// --- the cache: no second request until the platform limit has passed ---------------------------
const cached = await loadLeaderboard();
ok(count('leaderboards.getEntries') === 1, 'Повторный вызов в кулдаун не уходит в сеть');
ok(cached === view, 'Повторный вызов отдаёт кэшированный список');
const realNow = Date.now;
let fakeNow = realNow();
Date.now = () => fakeNow;
fakeNow += 20_000; // past the 15 s window the platform allows for getEntries
const refreshed = await loadLeaderboard();
ok(count('leaderboards.getEntries') === 2, 'После кулдауна список запрашивается снова');
ok(refreshed?.rows.length === 4, 'Обновлённый список корректен');
Date.now = realNow;

// --- the format from the Console ----------------------------------------------------------------
const timeBoard = { ...DESCRIPTION, description: { ...DESCRIPTION.description, score_format: { type: 'time' as const, options: { decimal_offset: 0 } } } };
ok(formatLeaderboardScore(90_000, timeBoard) === '1:30', 'Лидерборд-время показывается в минутах и секундах', formatLeaderboardScore(90_000, timeBoard));
ok(formatLeaderboardScore(3_723_000, timeBoard) === '1:02:03', 'Часы появляются только при необходимости', formatLeaderboardScore(3_723_000, timeBoard));
const decimalBoard = { ...DESCRIPTION, description: { ...DESCRIPTION.description, score_format: { type: 'numeric' as const, options: { decimal_offset: 2 } } } };
const decimal = formatLeaderboardScore(1234, decimalBoard);
const decimalValue = Number(decimal.replace(/[^\d.,]/g, '').replace(',', '.'));
ok(Math.abs(decimalValue - 12.34) < 1e-9, 'decimal_offset сдвигает десятичную часть', decimal);
ok(formatLeaderboardScore(12345, null).replace(/\D/g, '') === '12345', 'Без описания счёт показывается как есть', formatLeaderboardScore(12345, null));
ok(leaderboardTitle(null).length > 0, 'Есть запасное название, если Консоль не отдала локализованное', leaderboardTitle(null));

// --- the player's own place ---------------------------------------------------------------------
const rank = await loadMyRank();
ok(rank === 3, 'Место игрока для экрана итогов приходит из getPlayerEntry()', String(rank));
const entryAvailabilityCheck = calls.findIndex(
  (c) => c.name === 'ysdk.isAvailableMethod' && c.arg === 'leaderboards.getPlayerEntry',
);
const entryRequest = calls.findIndex((c) => c.name === 'leaderboards.getPlayerEntry');
ok(entryAvailabilityCheck >= 0 && entryAvailabilityCheck < entryRequest, 'Доступность getPlayerEntry проверяется до запроса');
const rankCalls = count('leaderboards.getPlayerEntry');
const rankAvailabilityCalls = calls.filter(
  (c) => c.name === 'ysdk.isAvailableMethod' && c.arg === 'leaderboards.getPlayerEntry',
).length;
await loadMyRank();
ok(count('leaderboards.getPlayerEntry') === rankCalls, 'Повторный запрос места не спамит лимит 60/5мин');
ok(
  calls.filter((c) => c.name === 'ysdk.isAvailableMethod' && c.arg === 'leaderboards.getPlayerEntry').length === rankAvailabilityCalls,
  'Закэшированное место не требует повторной проверки доступности',
);

// --- no entry yet: the platform raises LEADERBOARD_PLAYER_NOT_PRESENT ---------------------------
resetLeaderboardState();
playerEntryPresent = false;
ok((await loadMyRank()) === null, 'Игрок без результата получает null, а не исключение');
playerEntryPresent = true;
resetLeaderboardState();
playerEntryMethodAvailable = false;
const entriesBeforeUnavailable = count('leaderboards.getPlayerEntry');
ok(
  (await loadMyRank()) === null && count('leaderboards.getPlayerEntry') === entriesBeforeUnavailable,
  'Если isAvailableMethod запрещает getPlayerEntry, запрос не уходит',
);
playerEntryMethodAvailable = true;
resetLeaderboardState();

// Concurrent callers share one in-flight getPlayerEntry request.
let releaseEntry: (() => void) | null = null;
playerEntryGate = new Promise<void>((resolve) => {
  releaseEntry = resolve;
});
const entryStarted = new Promise<void>((resolve) => {
  onPlayerEntryCall = resolve;
});
const beforeConcurrentEntry = count('leaderboards.getPlayerEntry');
const firstRank = loadMyRank();
await entryStarted;
const secondRank = loadMyRank();
releaseEntry?.();
const concurrentRanks = await Promise.all([firstRank, secondRank]);
ok(
  count('leaderboards.getPlayerEntry') === beforeConcurrentEntry + 1 && concurrentRanks[0] === 3 && concurrentRanks[1] === 3,
  'Параллельные запросы места разделяют один сетевой вызов и получают общий ответ',
);
playerEntryGate = null;
onPlayerEntryCall = null;
resetLeaderboardState();

// --- submitting a score -------------------------------------------------------------------------
// Concurrent callers also wait for the same isAvailableMethod check before any score is sent.
let releaseScoreCheck: ((available: boolean) => void) | null = null;
scoreAvailabilityGate = new Promise<boolean>((resolve) => {
  releaseScoreCheck = resolve;
});
const beforeConcurrentScore = count('leaderboards.setScore');
const beforeScoreAvailabilityChecks = calls.filter(
  (c) => c.name === 'ysdk.isAvailableMethod' && c.arg === 'leaderboards.setScore',
).length;
const concurrentScoreA = submitLeaderboardScore(300, 'run A');
const concurrentScoreB = submitLeaderboardScore(400, 'run B');
releaseScoreCheck?.(true);
const concurrentScoreResults = await Promise.all([concurrentScoreA, concurrentScoreB]);
ok(
  count('leaderboards.setScore') === beforeConcurrentScore + 1 &&
    concurrentScoreResults.includes('sent') && concurrentScoreResults.includes('queued'),
  'Параллельные результаты не обходят лимит setScore (1 запрос в секунду)',
);
ok(
  calls.filter((c) => c.name === 'ysdk.isAvailableMethod' && c.arg === 'leaderboards.setScore').length === beforeScoreAvailabilityChecks + 1,
  'Параллельная отправка разделяет проверку доступности setScore',
);
scoreAvailabilityGate = null;
resetLeaderboardState(); // cancel the queued follow-up before testing other cases

ok((await submitLeaderboardScore(-5)) === 'sent', 'Отрицательный результат обрезается до нуля, а не отклоняется');
const zeroArg = calls.filter((c) => c.name === 'leaderboards.setScore').at(-1)?.arg as { score?: number } | undefined;
ok(zeroArg?.score === 0, 'На платформу уходит 0 — она не принимает отрицательные результаты', String(zeroArg?.score));
await new Promise((r) => setTimeout(r, 1100)); // setScore: 1 request per second
const unauth = authorized;
authorized = false;
await yaRefreshProfile(true);
ok((await submitLeaderboardScore(7777)) === 'skipped', 'Без авторизации результат не уходит в лидерборд (требование метода)');
authorized = unauth;
await yaRefreshProfile(true);

scoreMethodAvailable = false;
resetLeaderboardState(); // the "method unavailable" answer is cached per session, so ask again
const scoreCallsBefore = count('leaderboards.setScore');
ok(
  (await submitLeaderboardScore(8000)) === 'skipped' && count('leaderboards.setScore') === scoreCallsBefore,
  'Если isAvailableMethod говорит «нет», результат не отправляется',
);
scoreMethodAvailable = true;
resetLeaderboardState(); // forget the cached "method unavailable" answer, the platform was asked once

const sent = await submitLeaderboardScore(12_345, '42 BLK · IRON');
ok(sent === 'sent', 'Результат отправлен в лидерборд', sent);
const scoreArg = calls.filter((c) => c.name === 'leaderboards.setScore').at(-1)?.arg as { name?: string; score?: number; extraData?: string };
ok(scoreArg?.name === LEADERBOARD_NAME && scoreArg?.score === 12_345, 'setScore получает имя лидерборда и счёт', JSON.stringify(scoreArg));
ok(scoreArg?.extraData === '42 BLK · IRON', 'extraData с описанием результата уходит вместе со счётом', String(scoreArg?.extraData));

// --- a burst inside one second is coalesced, not dropped ----------------------------------------
const before = count('leaderboards.setScore');
const first = await submitLeaderboardScore(100);
const second = await submitLeaderboardScore(250);
ok(first === 'queued' && second === 'queued', 'Второй результат в ту же секунду ставится в очередь, а не отклоняется', `${first}/${second}`);
ok(count('leaderboards.setScore') === before, 'Лимит setScore (1 запрос в секунду) не нарушается');
await new Promise((r) => setTimeout(r, 1300));
const queuedArg = calls.filter((c) => c.name === 'leaderboards.setScore').at(-1)?.arg as { score?: number } | undefined;
ok(count('leaderboards.setScore') === before + 1, 'Накопленный результат уходит после паузы в секунду');
ok(queuedArg?.score === 250, 'Из очереди отправляется лучший результат', String(queuedArg?.score));

// --- everything can be forgotten (used by the tests and on sign-out) ----------------------------
resetLeaderboardState();
ok(leaderboardCooldownLeft() === 0, 'После сброса запросы разрешены сразу');
await loadLeaderboard();
ok(count('leaderboards.getEntries') === 3, 'После сброса список запрашивается заново', String(count('leaderboards.getEntries')));

// --- failed requests still consume a platform slot ----------------------------------------------
resetLeaderboardState();
const realDateNow = Date.now;
let failureClock = realDateNow();
Date.now = () => failureClock;
entriesShouldFail = true;
const beforeFailure = count('leaderboards.getEntries');
ok((await loadLeaderboard()) === null, 'При сбое сети возвращается null без ранее загруженного списка');
ok(leaderboardCooldownLeft() > 0, 'Неудачный запрос тоже включает защитный кулдаун');
await loadLeaderboard();
ok(count('leaderboards.getEntries') === beforeFailure + 1, 'Повторный вызов после сбоя не обходит лимит getEntries');
failureClock += 14_999;
await loadLeaderboard();
ok(count('leaderboards.getEntries') === beforeFailure + 1, 'Кулдаун после ошибки действует до 15 секунд');
failureClock += 1;
entriesShouldFail = false;
ok((await loadLeaderboard()) !== null, 'Список можно загрузить после истечения кулдауна');
ok(count('leaderboards.getEntries') === beforeFailure + 2, 'Повтор после кулдауна делает ровно один запрос');
Date.now = realDateNow;

export { passed, failures };
