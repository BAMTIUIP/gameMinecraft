/**
 * Unit test for the daily reward (src/game/daily.ts, https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time).
 *
 * The docs' point is that a time-gated reward has to be counted with `ysdk.serverTime()`: the device
 * clock can be moved, server time cannot. So the test drives a controllable server clock while the
 * local `Date.now()` stays put (and even gets rolled forward), checks the calendar-day rule of the
 * docs' example (UTC `YYYY-MM-DD`), the streak, the cap, and the cloud merge that stops a second
 * device from claiming the same day twice.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });

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

const DAY_MS = 86_400_000;
const BASE = Date.UTC(2026, 9, 2, 12, 0, 0); // 2026-10-02 12:00 UTC
let serverNow = BASE;

/** the cloud blob handed to the game at startup; the test fills it in before startProfileSync() */
let cloudBlob: Record<string, unknown> | null = null;
const cloudSaved = new Map<string, unknown>();

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => (cloudBlob ? { ...cloudBlob } : {}),
  setData: async (data: Record<string, unknown>) => {
    record('player.setData', data);
    for (const [key, value] of Object.entries(data)) cloudSaved.set(key, value);
  },
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
      serverTime: () => serverNow,
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
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

const day = (offsetDays: number) => new Date(BASE + offsetDays * DAY_MS).toISOString().slice(0, 10);

const { initYandex, yaServerTime } = await import('../../src/game/yandex');
const { getDiamonds, startProfileSync, flushProfile } = await import('../../src/game/profile');
const { DAILY_BASE, DAILY_MAX, applyCloudDaily, claimDailyReward, dailyReward, dailyState, resetDailyState, utcDay } = await import('../../src/game/daily');

await initYandex();
ok(yaServerTime() === BASE, 'Серверное время берётся из SDK, а не из часов устройства', `${yaServerTime()} vs ${Date.now()}`);
ok(utcDay() === day(0), 'Дата считается в UTC по серверному времени', utcDay());

// --- the first launch: the bonus is ready -------------------------------------------------------
const first = dailyReward();
ok(first.available && first.amount === DAILY_BASE && first.streak === 1, 'Первый день: базовый бонус доступен', JSON.stringify(first));
ok(dailyState() === null, 'До начисления состояние пустое');
ok(getDiamonds() === 0, 'Баланс до начисления нулевой', String(getDiamonds()));

const claim = claimDailyReward();
ok(claim.ok && claim.amount === DAILY_BASE && claim.streak === 1, 'Бонус начислен за первый день', JSON.stringify(claim));
ok(getDiamonds() === DAILY_BASE, 'Алмазы пришли на баланс', String(getDiamonds()));
const saved = JSON.parse(storage.get('orerush.daily.v1') ?? '{}') as { last?: string; streak?: number; at?: number };
ok(saved.last === day(0) && saved.streak === 1 && saved.at === BASE, 'Дата и серия сохранены', storage.get('orerush.daily.v1') ?? '');

// --- the same day: no second claim --------------------------------------------------------------
const twice = dailyReward();
ok(!twice.available && twice.reason === 'claimed', 'Повторно в тот же день бонус не предлагается', JSON.stringify(twice));
const second = claimDailyReward();
ok(!second.ok && getDiamonds() === DAILY_BASE, 'Второе начисление в тот же день невозможно', String(getDiamonds()));

// --- the device clock is rolled forward: the trusted day decides --------------------------------
const realNow = Date.now;
Date.now = () => BASE + 30 * DAY_MS; // the player moved the system clock a month ahead
ok(!dailyReward().available, 'Перевод часов устройства вперёд не открывает бонус заново');
Date.now = realNow;

// --- the next day: the streak grows -------------------------------------------------------------
serverNow = BASE + DAY_MS;
const streak2 = dailyReward();
ok(streak2.available && streak2.streak === 2 && streak2.amount === DAILY_BASE + 5, 'На следующий день серия растёт и бонус больше', JSON.stringify(streak2));
claimDailyReward();
ok(getDiamonds() === DAILY_BASE + DAILY_BASE + 5, 'Второй день начислен по новой ставке', String(getDiamonds()));

// --- a missed day resets the streak -------------------------------------------------------------
serverNow = BASE + 3 * DAY_MS;
const afterGap = dailyReward();
ok(afterGap.available && afterGap.streak === 1 && afterGap.amount === DAILY_BASE, 'Пропущенный день сбрасывает серию', JSON.stringify(afterGap));
claimDailyReward(); // day 3: a fresh streak of one

// --- the streak cap -----------------------------------------------------------------------------
serverNow = BASE + 4 * DAY_MS;
claimDailyReward(); // day 4, streak 2
for (let d = 5; d <= 9; d += 1) {
  serverNow = BASE + d * DAY_MS;
  // consecutive claims since day 3: streak = d - 2, so the daily rate is base + 5·(d-3)
  const expected = Math.min(DAILY_MAX, DAILY_BASE + 5 * (d - 3));
  ok(dailyReward().amount === expected, `Ставка на ${d}-й день: ${expected} алмазов`, String(dailyReward().amount));
  if (d === 8) ok(dailyReward().amount === DAILY_MAX, 'На шестой день серии ставка упирается в максимум', String(dailyReward().amount));
  claimDailyReward();
}
ok(dailyState()?.streak === 7, 'Серия продолжает считаться после максимума', JSON.stringify(dailyState()));

// --- a stored date from the future is not trusted -----------------------------------------------
storage.set('orerush.daily.v1', JSON.stringify({ last: day(40), streak: 3, at: BASE }));
resetDailyState();
const future = dailyReward();
ok(!future.available && future.reason === 'clock', 'Дата из будущего блокирует начисление', JSON.stringify(future));

// --- cloud merge: the same day on a second device -----------------------------------------------
storage.set('orerush.daily.v1', JSON.stringify({ last: day(5), streak: 2, at: BASE + 5 * DAY_MS }));
// the local mirror says this device last saved on day 5; the cloud blob below was written on day 6,
// so the profile merge (requirement 1.9 writes the mirror eagerly now) does pull it in
storage.set('orerush.profile.savedAt', String(BASE + 5 * DAY_MS));
resetDailyState();
serverNow = BASE + 6 * DAY_MS; // the other device claimed "today" (day 6)
cloudBlob = {
  'orerush.profile': {
    v: 1,
    savedAt: BASE + 6 * DAY_MS,
    daily: { last: day(6), streak: 3 },
  },
};
await startProfileSync();
ok(dailyState()?.last === day(6) && dailyState()?.streak === 3, 'Облако даёт более позднюю дату и серию', JSON.stringify(dailyState()));
ok(!dailyReward().available && dailyReward().reason === 'claimed', 'День, полученный на другом устройстве, не начисляется повторно', JSON.stringify(dailyReward()));

// the daily record travels with the profile, so the next device sees it too
serverNow = BASE + 12 * DAY_MS;
claimDailyReward();
await flushProfile(true);
const pushed = calls.filter((c) => c.name === 'player.setData').at(-1)?.arg as Record<string, { daily?: { last?: string } }> | undefined;
ok(pushed?.['orerush.profile']?.daily?.last === day(12), 'Дата бонуса уходит в облако вместе с профилем', JSON.stringify(pushed?.['orerush.profile']?.daily));

// --- the merge rules on their own: an older cloud record loses, a longer streak wins ------------
serverNow = BASE + 7 * DAY_MS;
claimDailyReward();
const localAfterClaim = { ...(dailyState() ?? { last: '', streak: 0 }) };
applyCloudDaily({ last: day(5), streak: 9 });
resetDailyState();
ok(
  dailyState()?.last === localAfterClaim.last && dailyState()?.streak === localAfterClaim.streak,
  'Более старая облачная запись не откатывает серию',
  JSON.stringify(dailyState()),
);
applyCloudDaily({ last: localAfterClaim.last, streak: 9 });
ok((dailyState()?.streak ?? 0) === 9, 'При той же дате выигрывает более длинная серия', JSON.stringify(dailyState()));
applyCloudDaily({ last: 'not-a-date', streak: 99 });
ok((dailyState()?.streak ?? 0) === 9, 'Испорченная облачная запись игнорируется', JSON.stringify(dailyState()));

export { passed, failures };
