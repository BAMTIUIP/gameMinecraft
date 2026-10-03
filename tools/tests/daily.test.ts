/** Daily-bonus ad gate, small payout, UTC reset, and cloud merge. */

type Call = { name: string; arg: unknown };
const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

const DAY_MS = 86_400_000;
const BASE = Date.UTC(2026, 9, 2, 12);
let serverNow = BASE;
let cloudBlob: Record<string, unknown> | null = null;
const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-daily',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => cloudBlob ?? {},
  setData: async (data: Record<string, unknown>) => record('player.setData', data),
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};
g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
    serverTime: () => serverNow,
    getPlayer: async () => player,
    getStorage: async () => localStorageStub,
    features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
    on() {},
  }),
};

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}
const day = (offset: number) => new Date(BASE + offset * DAY_MS).toISOString().slice(0, 10);
const rewarded = async () => ({ shown: true, rewarded: true });

const { initYandex, yaServerTime } = await import('../../src/game/yandex');
const { getDiamonds, startProfileSync, flushProfile } = await import('../../src/game/profile');
const {
  DAILY_BASE,
  DAILY_MAX,
  DAILY_STREAK_BONUS,
  applyCloudDaily,
  dailyReward,
  dailySecondsUntilReset,
  dailyState,
  resetDailyState,
  utcDay,
  watchAndClaimDailyReward,
} = await import('../../src/game/daily');

await initYandex();
ok(yaServerTime() === BASE, 'Серверное время берётся из SDK');
ok(utcDay() === day(0), 'Дата считается в UTC по серверному времени', utcDay());
ok(DAILY_BASE === 1 && DAILY_STREAK_BONUS === 1 && DAILY_MAX === 2, 'Дневная выплата ограничена одним-двумя алмазами');
ok(dailySecondsUntilReset(BASE) === 12 * 60 * 60, 'Отсчёт показывает секунды до полуночи UTC');

const first = dailyReward();
ok(first.available && first.amount === 1 && first.streak === 1, 'Первый бонус доступен за один алмаз', JSON.stringify(first));
ok(dailyState() === null && getDiamonds() === 0, 'До подтверждённой рекламы ничего не начислено');

const failed = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: false, skipped: 'error' }));
ok(!failed.ok && failed.reason === 'ad', 'Закрытая или неуспешная реклама не даёт ежедневную награду');
ok(dailyReward().available && dailyState() === null && getDiamonds() === 0, 'Неуспешный просмотр не сохраняет claim и не меняет баланс');
const thrown = await watchAndClaimDailyReward(async () => { throw new Error('SDK offline'); });
ok(!thrown.ok && thrown.reason === 'ad' && getDiamonds() === 0, 'Ошибка рекламного SDK также ничего не начисляет');

const firstClaim = await watchAndClaimDailyReward(rewarded);
ok(firstClaim.ok && firstClaim.amount === 1 && firstClaim.streak === 1, 'После rewarded-callback выдан первый бонус');
ok(getDiamonds() === 1, 'На баланс начислен один алмаз');
const saved = JSON.parse(storage.get('orerush.daily.v1') ?? '{}') as { last?: string; streak?: number; at?: number };
ok(saved.last === day(0) && saved.streak === 1 && saved.at === BASE, 'Дата и серия сохранены после показа');

let duplicateAdShown = false;
const twice = await watchAndClaimDailyReward(async () => {
  duplicateAdShown = true;
  return { shown: true, rewarded: true };
});
ok(!twice.ok && twice.reason === 'claimed' && !duplicateAdShown, 'Повторный claim за день не запускает рекламу и не платит');

const realNow = Date.now;
Date.now = () => BASE + 30 * DAY_MS;
ok(!dailyReward().available, 'Перевод системных часов не открывает бонус заново');
Date.now = realNow;

serverNow = BASE + DAY_MS;
const streak2 = dailyReward();
ok(streak2.available && streak2.streak === 2 && streak2.amount === 2, 'На следующий день бонус достигает лимита двух алмазов');
const secondClaim = await watchAndClaimDailyReward(rewarded);
ok(secondClaim.ok && getDiamonds() === 3, 'Второй день начисляет ровно два алмаза');

serverNow = BASE + 3 * DAY_MS;
const afterGap = dailyReward();
ok(afterGap.available && afterGap.streak === 1 && afterGap.amount === 1, 'Пропущенный день сбрасывает streak к одному алмазу');
await watchAndClaimDailyReward(rewarded);
for (let offset = 4; offset <= 9; offset += 1) {
  serverNow = BASE + offset * DAY_MS;
  const view = dailyReward();
  const expected = Math.min(DAILY_MAX, DAILY_BASE + DAILY_STREAK_BONUS * Math.max(0, view.streak - 1));
  ok(view.amount === expected && view.amount >= 1 && view.amount <= 2, `Награда остаётся в диапазоне 1–2 на дне ${offset}`, String(view.amount));
  const result = await watchAndClaimDailyReward(rewarded);
  ok(result.ok, `Rewarded-видео зачисляет бонус на дне ${offset}`);
}
ok(dailyState()?.streak === 7, 'Серия продолжает считаться, хотя размер выплаты уже ограничен', JSON.stringify(dailyState()));

storage.set('orerush.daily.v1', JSON.stringify({ last: day(40), streak: 3, at: BASE }));
resetDailyState();
const future = dailyReward();
ok(!future.available && future.reason === 'clock', 'Запись из будущего безопасно блокирует выплату', JSON.stringify(future));

storage.set('orerush.daily.v1', JSON.stringify({ last: day(5), streak: 2, at: BASE + 5 * DAY_MS }));
storage.set('orerush.profile.savedAt', String(BASE + 5 * DAY_MS));
resetDailyState();
serverNow = BASE + 6 * DAY_MS;
cloudBlob = { 'orerush.profile': { v: 1, savedAt: BASE + 6 * DAY_MS, daily: { last: day(6), streak: 3 } } };
await startProfileSync();
ok(dailyState()?.last === day(6) && dailyState()?.streak === 3, 'Облачный профиль применяет более позднюю дату');
ok(!dailyReward().available && dailyReward().reason === 'claimed', 'Claim с другого устройства нельзя получить повторно');

serverNow = BASE + 12 * DAY_MS;
await watchAndClaimDailyReward(rewarded);
await flushProfile(true);
const pushed = calls.filter((call) => call.name === 'player.setData').at(-1)?.arg as Record<string, { daily?: { last?: string } }> | undefined;
ok(pushed?.['orerush.profile']?.daily?.last === day(12), 'Дата ежедневной награды синхронизируется с профилем');

serverNow = BASE + 13 * DAY_MS;
await watchAndClaimDailyReward(rewarded);
const localAfterClaim = { ...(dailyState() ?? { last: '', streak: 0 }) };
applyCloudDaily({ last: day(5), streak: 9 });
resetDailyState();
ok(dailyState()?.last === localAfterClaim.last && dailyState()?.streak === localAfterClaim.streak, 'Старая облачная запись не откатывает локальную серию');
applyCloudDaily({ last: localAfterClaim.last, streak: 9 });
ok((dailyState()?.streak ?? 0) === 9, 'При равной дате более длинная серия сохраняется');
applyCloudDaily({ last: 'not-a-date', streak: 99 });
ok((dailyState()?.streak ?? 0) === 9, 'Некорректная облачная дата игнорируется');

export { passed, failures };
