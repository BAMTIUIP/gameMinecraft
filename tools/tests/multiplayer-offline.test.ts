/**
 * Off-Yandex half of the co-op contract: without `window.YaGames` there are no recorded sessions and
 * nobody to publish to, so the game fills the squad with local teammates. Same rigs, same panel, same
 * survival shift — the feature has to stay playable on itch / own hosting, and a missing platform must
 * never throw. This is also the mode the Arena preview runs in, so it is the one the user sees.
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no YaGames global

type Move = { id: string; pose: { x: number; y: number; z: number; activity?: string } };
const moves: Move[] = [];

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const { loadFlags } = await import('../../src/game/flags');
const { MAX_SQUAD, coopSquadSize, publishCoopSession, recordPose, resetCoopState, squadMembers, startCoopRound, stopCoopRound, tickCoop } = await import('../../src/game/multiplayer');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await startProfileSync();
await loadFlags();

const sink = {
  spawn: (seeds: Array<{ id: string }>) => void (spawned = seeds.map((s) => s.id)),
  move: (id: string, pose: { x: number; y: number; z: number; activity?: string }) => void moves.push({ id, pose }),
  finish: () => undefined,
  clear: () => undefined,
};
let spawned: string[] = [];

ok(coopSquadSize() === MAX_SQUAD, 'Размер отряда по умолчанию — пять игроков', String(coopSquadSize()));

const squad = await startCoopRound(sink);
ok(squad.length === MAX_SQUAD - 1, 'Локальный отряд — четыре напарника рядом с игроком', String(squad.length));
ok(squad.every((mate) => mate.kind === 'bot'), 'Все напарники помечены как локальные', JSON.stringify(squad.map((m) => m.kind)));
ok(spawned.length === squad.length, 'Напарники добавлены в мир', JSON.stringify(spawned));
ok(squadMembers().length === squad.length, 'Состав отряда доступен интерфейсу');

const before = moves.length;
tickCoop({ x: 100, y: 40, z: -100, yaw: 0, health: 90, blocks: 5 });
ok(moves.length > before, 'Такт кооператива двигает локальных напарников');
const firstMove = moves.at(-1)!;
const radius = Math.hypot(firstMove.pose.x - 100, firstMove.pose.z + 100);
ok(radius >= 2 && radius <= 12, 'Напарник держится рядом с игроком', `радиус: ${radius.toFixed(1)}`);
ok(Math.abs(firstMove.pose.y - 40) <= 1.5, 'Напарник не проваливается и не улетает по высоте', String(firstMove.pose.y));
ok(['walking', 'mining', 'fighting'].includes(firstMove.pose.activity ?? ''), 'Локальный напарник получает занятие вместо случайного телепорта', String(firstMove.pose.activity));
const fakeNowStart = Date.now;
let botNow = fakeNowStart();
Date.now = () => botNow;
botNow += 5_000;
const afterWalk = moves.length;
tickCoop({ x: 100, y: 40, z: -100, yaw: 0, health: 90, blocks: 5 });
ok(moves.length > afterWalk && moves.slice(afterWalk).some((move) => move.pose.activity === 'mining'), 'После прогулки локальный бот переходит к добыче');
Date.now = fakeNowStart;

// the recorder is off outside the platform: nothing to publish, nothing to record
const commits = moves.length;
recordPose({ x: 100, y: 40, z: -100, yaw: 0, health: 90, blocks: 5 });
ok(moves.length === commits, 'Вне платформы поза не пишется в сессию');
ok(publishCoopSession({ score: 100, depth: 5, blocks: 2 }) === false, 'Вне платформы смена никуда не публикуется');
ok(squadMembers().length === squad.length, 'После попытки публикации состав отряда не изменился');

stopCoopRound();
ok(squadMembers().length === squad.length, 'Состав отряда переживает конец смены (для таблицы итогов)', String(squadMembers().length));
const afterStop = moves.length;
tickCoop({ x: 0, y: 0, z: 0, yaw: 0, health: 100, blocks: 0 });
ok(moves.length === afterStop, 'После конца смены локальные напарники больше не ходят');

resetCoopState();
ok(squadMembers().length === 0, 'Сброс состояния очищает отряд');

export { passed, failures };
