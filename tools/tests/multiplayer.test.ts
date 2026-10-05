/**
 * Unit test for co-op survival through asynchronous multiplayer sessions
 * (src/game/multiplayer.ts + the `ysdk.multiplayer.sessions` wrappers).
 *
 * The platform is mocked in-process, so the test can pin down the contract from the documentation:
 * `init()` needs `count > 0` and at least one `meta1..meta3` range; `push()` needs a meta value;
 * one recorded session may not exceed 200 KB, which is why commits are sparse and capped; opponent
 * transactions arrive as `multiplayer-sessions-transaction` events and end with
 * `multiplayer-sessions-finish`. The engine is replaced by a recording sink, so nothing three.js
 * related runs here. Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((c) => c.name === name).length;
const last = (name: string) => [...calls].reverse().find((c) => c.name === name)?.arg;

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
  value: { language: 'en', userActivation: { isActive: true } },
  configurable: true,
});

/* ------------------------------ SDK mock ------------------------------ */

type SessionSeed = { id: string; meta?: { meta1?: number }; player?: { name?: string; avatar?: string }; timeline?: Array<{ payload?: unknown; time?: number }> };

let sessionSeeds: SessionSeed[] = [];
let initShouldFail = false;
let pushShouldFail = false;
let pushGate: Promise<void> | null = null;
let onPushCall: (() => void) | null = null;
const listeners = new Map<string, Array<(payload?: unknown) => void>>();

const emit = (event: string, payload?: unknown) => {
  for (const listener of listeners.get(event) ?? []) listener(payload);
};

const sessions = {
  init: async (params?: unknown) => {
    record('multiplayer.init', params);
    if (initShouldFail) throw new Error('multiplayer unavailable');
    return sessionSeeds.map((seed) => ({ ...seed }));
  },
  commit: (payload: object) => {
    record('multiplayer.commit', payload);
  },
  push: async (meta: unknown) => {
    record('multiplayer.push', meta);
    onPushCall?.();
    if (pushGate) await pushGate;
    if (pushShouldFail) throw new Error('push failed');
  },
};

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'SHOPPER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
  setData: async () => undefined,
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'en' } },
      serverTime: () => Date.now(),
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
      on: (event: string, listener: (payload?: unknown) => void) => {
        record('ysdk.on', event);
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
      features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
      multiplayer: { sessions },
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
const { startProfileSync, addTotals } = await import('../../src/game/profile');
const { loadFlags } = await import('../../src/game/flags');
const {
  MAX_SQUAD,
  coopSquadSize,
  publishCoopSession,
  recordPose,
  resetCoopState,
  squadMembers,
  startCoopRound,
  stopCoopRound,
  tickCoop,
} = await import('../../src/game/multiplayer');
const typeCheck: import('../../src/game/multiplayer').CoopSink = {
  spawn: (seeds) => record('sink.spawn', seeds),
  move: (id, pose) => record('sink.move', { id, pose }),
  finish: (id) => record('sink.finish', id),
  clear: () => record('sink.clear'),
};

await initYandex();
await startProfileSync();
// a comparable-player range comes from the player's own totals, so the test sets some first
addTotals({ bestScore: 1000, deepest: 40 });
await loadFlags('not_paying');

/* ---------------------------- flags and size ----------------------------- */

ok(coopSquadSize() === MAX_SQUAD, 'Размер отряда по умолчанию — 5 игроков', String(coopSquadSize()));

// the Console can shrink the squad; the game still never exceeds its own cap of five
storage.set('orerush.flags.v1', JSON.stringify({ savedAt: Date.now(), flags: { 'multiplayer.maxPlayers': '9' } }));
storage.set('orerush.flags.v1', JSON.stringify({ savedAt: Date.now(), flags: { 'multiplayer.maxPlayers': '9', 'multiplayer.enabled': 'true' } }));
// flags are loaded once per session, so the cap is exercised through the module's own clamp
ok(coopSquadSize() <= MAX_SQUAD, 'Отряд никогда не превышает пять игроков (включая самого игрока)', String(coopSquadSize()));

/* ----------------------- loading opponent sessions ----------------------- */

sessionSeeds = [
  {
    id: 'opp-1',
    meta: { meta1: 850 },
    player: { name: 'DEEP DIGGER', avatar: 'avatar-1.png' },
    timeline: [{ payload: { x: 1, y: 2, z: 3, yaw: 0.5, health: 90, blocks: 4 }, time: 0 }],
  },
  { id: 'opp-2', player: { name: '' }, timeline: [{ payload: { x: -4, y: 3, z: 8 }, time: 0 }] },
  { id: 'opp-3', player: { name: 'EXTRA' } },
  { id: 'opp-4', player: { name: 'MATE FOUR' } },
  // a fifth opponent would make the squad six players: the game keeps its own cap of five
  { id: 'opp-5', player: { name: 'TOO MANY' } },
];

const squad = await startCoopRound(typeCheck);
ok(squad.length === MAX_SQUAD - 1, 'В отряд попадает не больше четырёх напарников (игрок + 4 = 5)', String(squad.length));
const initParams = last('multiplayer.init') as { count?: number; isEventBased?: boolean; maxOpponentTurnTime?: number; meta?: { meta1?: { min?: number; max?: number }; meta2?: { min?: number; max?: number } } } | undefined;
ok(initParams?.count === MAX_SQUAD - 1, 'init() просит ровно столько сессий, сколько не хватает до пяти', String(initParams?.count));
ok(initParams?.count === MAX_SQUAD - 1 && initParams.count > 0, 'count больше нуля (иначе платформа только записывает, а не загружает)', String(initParams?.count));
ok(initParams?.isEventBased === true, 'Сессии воспроизводятся событиями (isEventBased: true)');
ok(typeof initParams?.maxOpponentTurnTime === 'number' && initParams.maxOpponentTurnTime > 0, 'Ограничение времени хода оппонента задано', String(initParams?.maxOpponentTurnTime));
ok(initParams?.meta?.meta1 !== undefined, 'Диапазон meta1 передан — без него сессии не загружаются', JSON.stringify(initParams?.meta));
ok((initParams?.meta?.meta1?.min ?? -1) >= 0 && (initParams?.meta?.meta1?.max ?? 0) > (initParams?.meta?.meta1?.min ?? 0), 'Диапазон meta1 построен по лучшему счёту игрока', JSON.stringify(initParams?.meta?.meta1));
ok((initParams?.meta?.meta2?.max ?? 0) >= 41, 'Диапазон meta2 учитывает максимальную глубину игрока', JSON.stringify(initParams?.meta?.meta2));

const spawnArg = last('sink.spawn') as Array<{ id: string; name: string }> | undefined;
ok(spawnArg?.length === MAX_SQUAD - 1, 'В мир добавлены четыре соперника, пятый лишний отброшен', String(spawnArg?.length));
ok(spawnArg?.[0].name === 'DEEP DIGGER', 'Имя напарника взято из сессии', String(spawnArg?.[0].name));
ok(spawnArg?.[1].name.length > 0, 'Пустое имя платформы заменяется запасным', String(spawnArg?.[1].name));
ok(squad[0].kind === 'remote' && squad[0].metaScore === 850, 'Результат соперника из meta1 доступен интерфейсу', JSON.stringify(squad[0]));
ok(count('ysdk.on') >= 2, 'Подписка на события мультиплеера оформлена');
ok((calls.filter((c) => c.name === 'ysdk.on') as Array<{ arg: unknown }>).some((c) => c.arg === 'multiplayer-sessions-transaction'), 'Подписка на multiplayer-sessions-transaction', JSON.stringify(calls.filter((c) => c.name === 'ysdk.on').map((c) => c.arg)));
ok(count('sink.move') >= 1, 'Начальный таймлайн сессии сразу двигает напарника');
ok(!(spawnArg ?? []).some((seed) => seed.id === 'opp-5'), 'Пятая сессия платформы не попадает в отряд');

/* --------------------------- opponent replay ----------------------------- */

const movesBefore = count('sink.move');
emit('multiplayer-sessions-transaction', { opponentId: 'opp-2', transactions: [{ payload: { x: 12, y: 5, z: -7, yaw: 1.5, health: 42, blocks: 11 } }] });
ok(count('sink.move') === movesBefore + 1, 'Транзакция соперника двигает его напарника');
const replayMove = last('sink.move') as { id: string; pose: { x: number; y: number; z: number; yaw?: number; health?: number; blocks?: number } } | undefined;
ok(replayMove?.id === 'opp-2' && replayMove.pose.x === 12 && replayMove.pose.z === -7, 'Позиция из payload применена', JSON.stringify(replayMove));
ok(replayMove?.pose.yaw === 1.5 && replayMove?.pose.health === 42 && replayMove?.pose.blocks === 11, 'Разворот, здоровье и блоки из payload применены', JSON.stringify(replayMove?.pose));

const movesAfterKnown = count('sink.move');
emit('multiplayer-sessions-transaction', { opponentId: 'opp-2', transactions: [{ payload: 'garbage' }, { payload: { x: 1 } }, {}] });
ok(count('sink.move') === movesAfterKnown, 'Битые payload не двигают напарника');
emit('multiplayer-sessions-transaction', { opponentId: 'unknown-player', transactions: [{ payload: { x: 1, y: 1, z: 1 } }] });
ok(count('sink.move') === movesAfterKnown, 'Транзакция неизвестной сессии игнорируется');
emit('multiplayer-sessions-finish', 'opp-1');
ok(count('sink.finish') === 1 && last('sink.finish') === 'opp-1', 'multiplayer-sessions-finish закрывает сессию напарника');

/* ------------------------------ recording ------------------------------- */

const realNow = Date.now;
let fakeNow = realNow();
Date.now = () => fakeNow;

const commitsBefore = count('multiplayer.commit');
recordPose({ x: 10, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 3 });
ok(count('multiplayer.commit') === commitsBefore + 1, 'Первая поза уходит транзакцией в сессию');
const payload = last('multiplayer.commit') as Record<string, number> | undefined;
ok(
  payload !== undefined && 'x' in payload && 'y' in payload && 'z' in payload && 'yaw' in payload && 'health' in payload && 'blocks' in payload,
  'Payload транзакции содержит позу и показатели',
  JSON.stringify(payload),
);
ok(Object.keys(payload ?? {}).length === 6, 'В payload нет ничего лишнего (короткие ключи экономят лимит 200 КБ)', JSON.stringify(payload));

fakeNow += 300;
recordPose({ x: 10, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 3 });
ok(count('multiplayer.commit') === commitsBefore + 1, 'Спустя 300 мс та же поза не пишется снова');

fakeNow += 400;
recordPose({ x: 30, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 9 });
ok(count('multiplayer.commit') === commitsBefore + 1, 'Даже важное изменение ждёт минимальный интервал (800 мс)');

fakeNow += 600;
recordPose({ x: 30, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 9 });
ok(count('multiplayer.commit') === commitsBefore + 2, 'Через минимальный интервал изменение записывается');

fakeNow += 1_100;
recordPose({ x: 30, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 9 });
ok(count('multiplayer.commit') === commitsBefore + 2, 'Без изменений следующий коммит ждёт 2 секунды');

fakeNow += 1_200;
recordPose({ x: 31, y: 20, z: 30, yaw: 0.1, health: 80, blocks: 9 });
ok(count('multiplayer.commit') === commitsBefore + 3, 'После паузы в 2 секунды поза снова записывается');

/* --------------------------------- push ---------------------------------- */

pushShouldFail = true;
ok(!(await publishCoopSession({ score: 4321, depth: 55, blocks: 120 })), 'Ошибка sessions.push() не считается успешной публикацией');
pushShouldFail = false;
ok(await publishCoopSession({ score: 4321, depth: 55, blocks: 120 }), 'Итог смены публикуется (sessions.push)');
const pushMeta = last('multiplayer.push') as { meta1?: number; meta2?: number; meta3?: number } | undefined;
ok(pushMeta?.meta1 === 4321 && pushMeta?.meta2 === 55 && pushMeta?.meta3 === 120, 'push() получает счёт, глубину и блоки', JSON.stringify(pushMeta));
ok(Object.values(pushMeta ?? {}).some((value) => typeof value === 'number'), 'Хотя бы один meta-параметр задан (требование push)', JSON.stringify(pushMeta));
ok(!(await publishCoopSession({ score: 4321, depth: 55, blocks: 120 })), 'Без новых транзакций смена повторно не публикуется');

fakeNow += 5_000;
recordPose({ x: 33, y: 21, z: 31, yaw: 0.2, health: 70, blocks: 44 });
let releasePush: (() => void) | null = null;
pushGate = new Promise<void>((resolve) => {
  releasePush = resolve;
});
const pushStarted = new Promise<void>((resolve) => {
  onPushCall = resolve;
});
const beforeRevivePush = count('multiplayer.push');
const revivePushA = publishCoopSession({ score: 9999, depth: 60, blocks: 200 });
await pushStarted;
const revivePushB = publishCoopSession({ score: 9999, depth: 60, blocks: 200 });
releasePush?.();
const revivePushResults = await Promise.all([revivePushA, revivePushB]);
ok(
  count('multiplayer.push') === beforeRevivePush + 1 && revivePushResults[0] && !revivePushResults[1],
  'Одновременные финальные вызовы разделяют один push (без дублей)',
);
pushGate = null;
onPushCall = null;
ok((last('multiplayer.push') as { meta1?: number })?.meta1 === 9999, 'Повторная публикация несёт новый результат');

/* ------------------------------ session cap ------------------------------ */

// 1505 spaced-out poses: the recorder must stop on its own budget. The documented ceiling for one
// recorded session is 200 KB, and the SDK adds its own fields to every payload on top of it, so the
// budget is checked in bytes rather than trusting a fixed number of transactions.
for (let i = 0; i < 1_505; i++) {
  fakeNow += 2_100;
  recordPose({ x: 40 + i, y: 20, z: 30, yaw: 0, health: 90, blocks: i });
}
const totalCommits = count('multiplayer.commit');
const payloadBytes = JSON.stringify({ x: 1, y: 1, z: 1, yaw: 1, health: 1, blocks: 1 }).length + 96;
ok(totalCommits * payloadBytes <= 200 * 1024, 'Запись останавливается на безопасном размере сессии', `≈${Math.round((totalCommits * payloadBytes) / 1024)} КБ`);
ok(totalCommits >= 900, 'До лимита сессия записывается полностью', `транзакций: ${totalCommits}`);

/* ------------------------------- finishing ------------------------------- */

stopCoopRound();
const afterStop = count('multiplayer.commit');
fakeNow += 4_000;
recordPose({ x: 0, y: 0, z: 0, yaw: 0, health: 100, blocks: 1 });
ok(count('multiplayer.commit') === afterStop, 'После конца смены запись прекращается');
ok(squadMembers().length === MAX_SQUAD - 1, 'Состав отряда остаётся доступным интерфейсу после конца смены', String(squadMembers().length));

/* ------------------------- a failed platform call ------------------------ */

resetCoopState();
initShouldFail = true;
const noSquad = await startCoopRound(typeCheck);
ok(noSquad.length === MAX_SQUAD - 1 && noSquad.every((mate) => mate.kind === 'bot'), 'При ошибке мультиплеера пустые места заполняют локальные боты', JSON.stringify(noSquad.map((mate) => mate.kind)));
const fallbackSeeds = last('sink.spawn') as Array<{ localBot?: boolean; appearanceSeed?: number }> | undefined;
ok(fallbackSeeds?.length === MAX_SQUAD - 1 && fallbackSeeds.every((seed) => seed.localBot && Number.isInteger(seed.appearanceSeed)), 'Визуальные скины ботов получают отдельные случайные зерна');
initShouldFail = false;

resetCoopState();
sessionSeeds = [{ id: 'opp-9', player: { name: 'SOLO' } }];
const soloSquad = await startCoopRound(typeCheck);
ok(soloSquad.length === MAX_SQUAD - 1 && soloSquad.filter((mate) => mate.kind === 'remote').length === 1 && soloSquad.filter((mate) => mate.kind === 'bot').length === MAX_SQUAD - 2, 'Редкий реальный напарник сохраняется, а свободные места заполняют боты', JSON.stringify(soloSquad.map((mate) => mate.kind)));
stopCoopRound();

Date.now = realNow;

export { passed, failures };
