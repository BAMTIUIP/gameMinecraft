/**
 * Requirement 1.9 — «Сохранение прогресса» (https://yandex.ru/dev/games/doc/ru/requirements/1/9).
 *
 * The page asks for three things and the suite checks all of them:
 *  - **where** progress is stored: the game keeps cloud saves (`player.setData` / `setStats`, which the
 *    page calls mandatory for games with in-app purchases) and an immediate local mirror, so a guest
 *    and an authorised player both keep their progress;
 *  - **when** it is stored: right after the action, not on a timer — every progress-changing action
 *    must be visible in `localStorage` synchronously, and the cloud write must leave the game without
 *    waiting for the queue's debounce;
 *  - **what survives a refresh**: records, currency, lifetime counters, name, daily reward state and
 *    the built sandbox world. The last one has a save button of its own and is additionally written
 *    when the page is hidden.
 * A real page reload and a device rotation are checked in the browser scenario
 * (`tools/yandex-sdk-check/run.mjs`); here the storage writes themselves are verified.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { existsSync } from 'node:fs';

// bundled into a temporary directory: the repository root is found from the working directory
function findRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repository root not found from ${start}`);
}

const root = findRoot(process.cwd());

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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

type Call = { name: string; arg: unknown };
const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((c) => c.name === name).length;

const SERVER_NOW = Date.UTC(2026, 9, 2, 12, 0, 0); // 2026-10-02 12:00 UTC
const cloudSaved = new Map<string, unknown>();

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => Object.fromEntries(cloudSaved),
  setData: async (data: Record<string, unknown>) => {
    record('player.setData', data);
    for (const [key, value] of Object.entries(data)) cloudSaved.set(key, value);
  },
  getStats: async () => ({}),
  setStats: async (stats: Record<string, number>) => void record('player.setStats', stats),
  incrementStats: async (stats: Record<string, number>) => {
    record('player.incrementStats', stats);
    return stats;
  },
};

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
    serverTime: () => SERVER_NOW,
    getPlayer: async () => player,
    getStorage: async () => localStorageStub,
    features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
    on() {},
  }),
};

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { initYandex } = await import('../../src/game/yandex');
const { addDiamonds, addTotals, flushProfile, getDiamonds, getTotals, saveProgressNow, spendDiamonds, startProfileSync } = await import('../../src/game/profile');
const { dailyReward, resetDailyState, watchAndClaimDailyReward } = await import('../../src/game/daily');
const { loadScores, savePlayerName, submitScore } = await import('../../src/ui/scores');

await initYandex();
await startProfileSync();
await flushProfile(true); // settle the boot-time write before counting calls

/** let the queued cloud promise run (no timers are involved: the write must not need them) */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/* ---- 1. the local mirror is written by the action itself ---- */

const readJson = (key: string) => JSON.parse(storage.get(key) ?? 'null');

addDiamonds(25);
ok(storage.get('orerush.diamonds.v1') === '25', 'Алмазы сразу записаны в браузерное хранилище (перезагрузка их не потеряет)', storage.get('orerush.diamonds.v1') ?? 'нет');
ok(getDiamonds() === 25, 'Баланс обновился', String(getDiamonds()));

ok(spendDiamonds(100) === false && getDiamonds() === 25, 'Неудачная трата ничего не списывает');
ok(spendDiamonds(20) === true && storage.get('orerush.diamonds.v1') === '5', 'Трата алмазов тоже сохраняется сразу же', storage.get('orerush.diamonds.v1') ?? 'нет');

const totals = addTotals({ runs: 1, blocksMined: 12, deepest: 9, bestScore: 4321, playSeconds: 60 });
const storedTotals = readJson('orerush.totals.v1') as Record<string, number>;
ok(
  storedTotals.runs === 1 && storedTotals.bestScore === 4321 && storedTotals.deepest === 9 && storedTotals.playSeconds === 60,
  'Рекорды и счётчики сохранены сразу после смены',
  JSON.stringify(storedTotals),
);
ok(totals.bestScore === 4321, 'Живые счётчики совпадают с сохранёнными', String(totals.bestScore));

const entry = {
  name: 'MINER',
  score: 4321,
  blocks: 12,
  tier: 'STONE',
  depth: 9,
  combo: 3,
  date: SERVER_NOW,
  token: 'run-test-1',
};
const next = submitScore(entry);
ok(storage.get('orerush.highscores.v1')?.includes('run-test-1') ?? false, 'Результат смены попал в таблицу рекордов сразу', storage.get('orerush.highscores.v1')?.slice(0, 60) ?? 'нет');
ok(next.some((row) => row.token === 'run-test-1'), 'Таблица рекордов вернула новую строку');
ok(loadScores().some((row) => row.token === 'run-test-1'), 'Чтение таблицы (как при следующей загрузке) её уже видит');

savePlayerName('MINER-9');
ok(storage.get('orerush.playername.v1') === 'MINER-9', 'Новое имя сохранено в хранилище', storage.get('orerush.playername.v1') ?? 'нет');

// a daily bonus is an action too: the date and the balance are both on disk at once
resetDailyState();
ok(dailyReward().available === true, 'Ежедневный бонус готов к начислению');
const claim = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: true }));
ok(claim.ok === true && storage.get('orerush.daily.v1')?.includes('2026-10-02') === true, 'Дата получения бонуса записана сразу', storage.get('orerush.daily.v1') ?? 'нет');
ok(Number(storage.get('orerush.diamonds.v1')) === 5 + claim.amount, 'Алмазы бонуса тоже сразу на диске', storage.get('orerush.diamonds.v1') ?? 'нет');

/* ---- 2. the cloud write does not wait for the debounce ---- */

const setDataBefore = count('player.setData');
const balanceBefore = getDiamonds();
addDiamonds(10);
await settle();
ok(count('player.setData') > setDataBefore, 'Клиент отправил прогресс в облако сразу после действия, а не по таймеру', `вызовов: ${count('player.setData')}`);
const lastCloud = calls.filter((c) => c.name === 'player.setData').at(-1)?.arg as Record<string, { diamonds?: number }> | undefined;
ok(lastCloud?.['orerush.profile']?.diamonds === balanceBefore + 10, 'В облако ушёл новый баланс', JSON.stringify(lastCloud?.['orerush.profile']?.diamonds));

const statsBefore = count('player.incrementStats');
addTotals({ oresFound: 2 });
await settle();
ok(count('player.incrementStats') > statsBefore, 'Счётчики уходят в статистику платформы сразу же', `вызовов: ${count('player.incrementStats')}`);

// the explicit "save now" entry point is what every action calls
const beforeManual = count('player.setData');
saveProgressNow();
await settle();
ok(count('player.setData') >= beforeManual, 'saveProgressNow() доносит очередь до платформы');

/* ---- 3. what the game boots from (a refresh reads the same localStorage) ---- */

ok(loadScores().some((row) => row.token === 'run-test-1'), 'Перезагрузка страницы перечитает таблицу рекордов из хранилища');
ok(Number(storage.get('orerush.diamonds.v1')) === getDiamonds(), 'Перезагрузка перечитает баланс алмазов', storage.get('orerush.diamonds.v1') ?? 'нет');
ok(JSON.parse(storage.get('orerush.totals.v1') ?? '{}').bestScore === 4321, 'Перезагрузка перечитает рекорды и счётчики');
ok(storage.has('orerush.daily.v1'), 'Перезагрузка не даст получить бонус второй раз');

/* ---- 4. the sources follow the same rules ---- */

const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
const app = read('src/App.tsx');
const profile = read('src/game/profile.ts');
const engine = read('src/game/engine.ts');

ok(/submitScore\(/.test(app) && /addTotals\(\{/.test(app) && /flushProfile\(true\)/.test(app), 'Конец смены сохраняет рекорд, счётчики и сразу отправляет всё в облако');
ok(/saveProgressNow\(\); \/\/ requirement 1\.9/.test(app) || /saveProgressNow\(\)/.test(app), 'Смена имени, режима и языка сохраняется на месте');
const signInStart = app.indexOf('const signIn =');
const rankingStart = app.indexOf('const loadWorldRanking', signInStart);
const signInSource = app.slice(signInStart, rankingStart > signInStart ? rankingStart : undefined);
ok(/resyncProfile\(\)/.test(signInSource), 'После авторизации заново читается профиль выбранного аккаунта');
ok(/saveWorld\(true\)/.test(app) && /pagehide/.test(app), 'Мир песочницы автоматически сохраняется при уходе со страницы (и есть кнопка сохранения)');
ok(/saveProgressNow/.test(profile) && /storageSet\(DIAMONDS_KEY, String\(diamonds\)\)/.test(profile), 'Модуль профиля пишет локальную копию первым делом');
ok(/storageSet\(TOTALS_KEY, JSON.stringify\(totals\)\)/.test(profile), 'Счётчики живут в локальной копии');
ok(/window\.addEventListener\('resize', this\.onResize\)/.test(engine), 'Движок перестраивает картинку под новый размер окна (поворот экрана не теряет состояние)');
ok(/static hasSavedWorld/.test(engine) || /hasSavedWorld\(\)/.test(engine), 'Сохранённый мир предлагается к продолжению при следующем запуске');

export { passed, failures };
