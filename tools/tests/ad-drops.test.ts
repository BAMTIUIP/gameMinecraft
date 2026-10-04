/** Tests for rewarded shop drops and the distinct-login-day weekly/monthly gate. */

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
let serverNow = Date.UTC(2026, 4, 6, 12);
const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-drops',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
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
const day = (offset: number) => Date.UTC(2026, 4, 6, 12) + offset * DAY_MS;

const { initYandex } = await import('../../src/game/yandex');
await initYandex();
const {
  applyCloudRewardedDrops,
  claimRewardedDrop,
  completePendingRewardedDropItems,
  isRewardedDrop,
  pendingRewardedDropItems,
  recordRewardedDropLogin,
  resetRewardedDropState,
  rewardedDropPeriod,
  rewardedDropReward,
  rewardedDropStatuses,
  watchAndClaimRewardedDrop,
} = await import('../../src/game/adDrops');
const { COAL, COOKED_MEAT, DIAMOND, GOLD, IRON, PLANKS, TORCH } = await import('../../src/game/blocks');

resetRewardedDropState();
const wednesday = day(0);
ok(isRewardedDrop('drop-daily') && isRewardedDrop('drop-weekly') && isRewardedDrop('drop-monthly'), 'Все три магазинных дропа распознаются');
ok(!isRewardedDrop('diamonds-100'), 'Платный пакет не является rewarded-дропом');
ok(rewardedDropPeriod('drop-weekly', wednesday) === '2026-05-04', 'Понедельник по UTC остаётся календарной меткой недельного дропа');
ok(rewardedDropPeriod('drop-monthly', wednesday) === '2026-05', 'Месячная метка использует UTC-месяц');
ok(!rewardedDropStatuses(wednesday)['drop-weekly'].available && rewardedDropStatuses(wednesday)['drop-weekly'].progress === 0, 'Недельный дроп закрыт до семи дней входа');

ok(recordRewardedDropLogin(wednesday), 'Первый запуск записывает уникальный день входа');
ok(!recordRewardedDropLogin(wednesday), 'Повторное открытие в тот же день не увеличивает прогресс');
ok(rewardedDropStatuses(wednesday)['drop-weekly'].progress === 1 && rewardedDropStatuses(wednesday)['drop-monthly'].progress === 1, 'Первый вход добавляет один день к обеим сериям');

const failedAd = await watchAndClaimRewardedDrop(
  'drop-daily',
  async () => ({ shown: true, rewarded: false, skipped: 'error' }),
  wednesday,
  () => 0,
);
ok(!failedAd.ok && failedAd.reason === 'ad', 'Закрытие или ошибка без rewarded-callback не выдаёт награду');
ok(rewardedDropStatuses(wednesday)['drop-daily'].available, 'Неуспешная реклама не отмечает ежедневный дроп полученным');
ok(pendingRewardedDropItems('next-run') === null, 'Неуспешная реклама не ставит припасы в очередь');
const thrownAd = await watchAndClaimRewardedDrop('drop-daily', async () => { throw new Error('SDK unavailable'); }, wednesday);
ok(!thrownAd.ok && thrownAd.reason === 'ad', 'Ошибка SDK безопасно отменяет claim');

const daily = await watchAndClaimRewardedDrop('drop-daily', async () => ({ shown: true, rewarded: true }), wednesday, () => 0);
ok(daily.ok && daily.items.length === 4 && daily.delivery === 'next-run', 'Ежедневный просмотр зачисляет припасы следующему забегу');
ok(daily.ok && daily.items.some(([id, count]) => id === PLANKS && count === 8), 'В ежедневном наборе 8 досок');
ok(daily.ok && daily.items.some(([id, count]) => id === COAL && count === 6), 'В ежедневном наборе 6 угля');
ok(daily.ok && daily.items.some(([id, count]) => id === COOKED_MEAT && count === 3), 'В ежедневном наборе 3 готового мяса');
ok(daily.ok && daily.items.some(([id, count]) => id === TORCH && count === 4), 'В ежедневном наборе 4 факела');
ok(!rewardedDropStatuses(wednesday)['drop-daily'].available, 'Ежедневный дроп блокируется после claim');
ok(rewardedDropStatuses(day(1))['drop-daily'].available, 'Ежедневный дроп снова доступен на следующий UTC-день');
let duplicateAdShown = false;
const duplicate = await watchAndClaimRewardedDrop('drop-daily', async () => {
  duplicateAdShown = true;
  return { shown: true, rewarded: true };
}, wednesday);
ok(!duplicate.ok && duplicate.reason === 'claimed' && !duplicateAdShown, 'Повторное нажатие не запускает рекламу и не выдаёт дроп дважды');

// The weekly reward needs seven distinct login dates, not a calendar-week rollover.
const beforeWeekReady = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), wednesday);
ok(!beforeWeekReady.ok && beforeWeekReady.reason === 'claimed', 'Рекламный просмотр не запускается до семи дней входа');
for (let offset = 1; offset <= 6; offset += 1) recordRewardedDropLogin(day(offset));
const weekReady = rewardedDropStatuses(day(6))['drop-weekly'];
ok(weekReady.available && weekReady.progress === 7 && weekReady.goal === 7, 'После семи уникальных дней недельный дроп доступен');
const weeklyMin = rewardedDropReward('drop-weekly', () => 0);
const weeklyMax = rewardedDropReward('drop-weekly', () => 1);
ok(weeklyMin.items.some(([id, count]) => id === PLANKS && count === 8) && weeklyMax.items.some(([id, count]) => id === PLANKS && count === 40), 'Недельная реклама выдаёт от одного до пяти наборов припасов');
const weekly = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), day(6), () => 0);
ok(weekly.ok && weekly.items.some(([id, count]) => id === IRON && count === 3), 'Недельные припасы ставятся в очередь после подтверждённого просмотра');
ok(!rewardedDropStatuses(day(6))['drop-weekly'].available && rewardedDropStatuses(day(6))['drop-weekly'].progress === 0, 'После claim недельный прогресс начинается заново');

// Calendar boundaries do not unlock these rewards: a second cycle starts only with new game-entry days.
for (let offset = 7; offset <= 13; offset += 1) recordRewardedDropLogin(day(offset));
ok(rewardedDropStatuses(day(13))['drop-weekly'].available, 'Следующие семь дней входа снова открывают недельный дроп');
const weeklyAgain = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), day(13), () => 0.5);
ok(weeklyAgain.ok && weeklyAgain.items.some(([id, count]) => id === PLANKS && count === 24), 'Вторая недельная supply-награда выдаётся корректно');
for (let offset = 14; offset <= 29; offset += 1) recordRewardedDropLogin(day(offset));
const monthlyProgress = rewardedDropStatuses(day(29))['drop-monthly'];
ok(monthlyProgress.available && monthlyProgress.progress === 30 && monthlyProgress.goal === 30, 'Месячный дроп открывается после тридцати дней входа');
const monthlyMin = rewardedDropReward('drop-monthly', () => 0);
const monthlyMax = rewardedDropReward('drop-monthly', () => 1);
ok(monthlyMin.items.some(([id, count]) => id === DIAMOND && count === 1) && monthlyMax.items.some(([id, count]) => id === DIAMOND && count === 3), 'Месячный supply-набор сохраняет масштабируемые алмазные материалы');
const monthly = await watchAndClaimRewardedDrop('drop-monthly', async () => ({ shown: true, rewarded: true }), day(29), () => 1);
ok(monthly.ok && monthly.delivery === 'own-world' && monthly.items.some(([id, count]) => id === DIAMOND && count === 3), 'Месячный просмотр ставит ресурсные припасы в очередь для собственного мира');
ok(monthly.ok && monthly.items.some(([id, count]) => id === IRON && count === 12), 'Месячный набор содержит железо');
ok(monthly.ok && monthly.items.some(([id, count]) => id === GOLD && count === 4), 'Месячный набор содержит золото');
ok(monthly.ok && monthly.items.some(([id, count]) => id === PLANKS && count === 32), 'Месячный набор содержит 32 доски');
ok(monthly.ok && monthly.items.some(([id, count]) => id === TORCH && count === 16), 'Месячный набор содержит 16 факелов');
ok(!rewardedDropStatuses(day(29))['drop-monthly'].available, 'После получения месячный прогресс сбрасывается');

const nextRunBatch = pendingRewardedDropItems('next-run');
ok(Boolean(nextRunBatch?.items.some(([id, count]) => id === PLANKS && count === 40)), 'Ежедневные и недельные доски суммируются для следующего забега');
ok(Boolean(nextRunBatch && !nextRunBatch.items.some(([id]) => id === GOLD || id === DIAMOND)), 'Месячные материалы не попадают в обычный забег');
ok(Boolean(nextRunBatch && pendingRewardedDropItems('next-run')?.keys.length === nextRunBatch.keys.length), 'Припасы не отмечаются полученными до выдачи');
ok(Boolean(nextRunBatch && completePendingRewardedDropItems(nextRunBatch.keys)), 'Успешная выдача подтверждается отдельной записью');
const ownWorldBatch = pendingRewardedDropItems('own-world');
ok(Boolean(ownWorldBatch?.items.some(([id, count]) => id === PLANKS && count === 32)), 'Месячные доски ждут собственного мира');
ok(Boolean(ownWorldBatch && ownWorldBatch.items.some(([id, count]) => id === IRON && count === 74) && ownWorldBatch.items.some(([id, count]) => id === GOLD && count === 13) && ownWorldBatch.items.some(([id, count]) => id === DIAMOND && count === 3)), 'Месячные железо, золото и минеральные алмазы сохраняются');
ok(Boolean(ownWorldBatch && completePendingRewardedDropItems(ownWorldBatch.keys)), 'Месячный grant подтверждается после сохранения мира');
ok(pendingRewardedDropItems('own-world') === null, 'Выданные припасы не дублируются при повторном запуске');

// Cloud login-day union allows progress earned on different devices to be combined.
resetRewardedDropState();
applyCloudRewardedDrops({
  claims: { 'drop-weekly': '2026-05-18' },
  pending: {},
  delivered: [],
  login: {
    last: '2026-06-05',
    days: ['2026-05-30', '2026-06-01', '2026-06-03', '2026-06-05'],
    weeklyClaimedAt: '2026-05-29',
    monthlyClaimedAt: '2026-06-04',
    weeklyCycles: 1,
    monthlyCycles: 1,
  },
});
ok(rewardedDropStatuses(Date.UTC(2026, 5, 5, 12))['drop-weekly'].progress === 4, 'Облачные дни входа объединяются в прогресс');
ok(!rewardedDropStatuses(Date.UTC(2026, 5, 5, 12))['drop-weekly'].available, 'Облачная запись сохраняет ограничение до семи дней');
const claimWithoutProgress = claimRewardedDrop('drop-weekly', Date.UTC(2026, 5, 5, 12), () => 0);
ok(!claimWithoutProgress.ok && claimWithoutProgress.reason === 'claimed', 'Claim без прогресса отклоняется и после облачного слияния');

// A 31-day month can contain two 30-login monthly cycles; the reward receipts must remain distinct.
resetRewardedDropState();
const aprilFirst = Date.UTC(2026, 3, 1, 12);
for (let offset = 0; offset < 30; offset += 1) recordRewardedDropLogin(aprilFirst + offset * DAY_MS);
const mayFirst = Date.UTC(2026, 4, 1, 12);
const firstMonthly = await watchAndClaimRewardedDrop('drop-monthly', async () => ({ shown: true, rewarded: true }), mayFirst, () => 0);
ok(firstMonthly.ok, 'Первый месячный цикл в мае можно получить');
for (let offset = 1; offset <= 30; offset += 1) recordRewardedDropLogin(mayFirst + offset * DAY_MS);
const mayThirtyFirst = Date.UTC(2026, 4, 31, 12);
const secondMonthly = await watchAndClaimRewardedDrop('drop-monthly', async () => ({ shown: true, rewarded: true }), mayThirtyFirst, () => 0);
ok(secondMonthly.ok, 'Второй месячный цикл в том же календарном месяце открывается через 30 новых входов');
const twoMonthlyBatches = pendingRewardedDropItems('own-world');
ok(Boolean(twoMonthlyBatches && twoMonthlyBatches.keys.length === 2 && twoMonthlyBatches.items.find(([id]) => id === IRON)?.[1] === 68), 'Два месячных сундука не перезаписывают сохранённые припасы');

export { passed, failures };
