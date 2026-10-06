/** Tests for rewarded ad chest packs and the distinct-login-day weekly/monthly gate. */

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
  availableRewardedDropChestCounts,
  claimRewardedDrop,
  isRewardedDrop,
  openRewardedDropPack,
  pendingRewardedDropItems,
  recordRewardedDropLogin,
  resetRewardedDropState,
  rewardedDropPackContents,
  rewardedDropPeriod,
  rewardedDropStatuses,
  rollbackOpenedRewardedDropPack,
  watchAndClaimRewardedDrop,
} = await import('../../src/game/adDrops');
const {
  COAL,
  COOKED_MEAT,
  DIAMOND,
  GOLD,
  IRON,
  PLANKS,
  REWARD_PACK_DAILY,
  REWARD_PACK_MONTHLY,
  REWARD_PACK_WEEKLY,
  TORCH,
  WHEAT_SEEDS,
} = await import('../../src/game/blocks');
const { HOE_TOOLS } = await import('../../src/game/tools');

resetRewardedDropState();
const wednesday = day(0);
ok(isRewardedDrop('drop-daily') && isRewardedDrop('drop-weekly') && isRewardedDrop('drop-monthly'), 'Все три рекламных пака распознаются');
ok(!isRewardedDrop('diamonds-100'), 'Платный пакет не является rewarded-паком');
ok(rewardedDropPeriod('drop-weekly', wednesday) === '2026-05-04', 'Понедельник по UTC остаётся меткой недельного пака');
ok(rewardedDropPeriod('drop-monthly', wednesday) === '2026-05', 'Месячная метка использует UTC-месяц');
ok(!rewardedDropStatuses(wednesday)['drop-weekly'].available && rewardedDropStatuses(wednesday)['drop-weekly'].progress === 0, 'Недельный пак закрыт до семи дней входа');

ok(recordRewardedDropLogin(wednesday), 'Первый запуск записывает уникальный день входа');
ok(!recordRewardedDropLogin(wednesday), 'Повторное открытие в тот же день не увеличивает прогресс');
ok(rewardedDropStatuses(wednesday)['drop-weekly'].progress === 1 && rewardedDropStatuses(wednesday)['drop-monthly'].progress === 1, 'Первый вход добавляет один день к обеим сериям');

const failedAd = await watchAndClaimRewardedDrop(
  'drop-daily',
  async () => ({ shown: true, rewarded: false, skipped: 'error' }),
  wednesday,
  () => 0,
);
ok(!failedAd.ok && failedAd.reason === 'ad', 'Закрытие или ошибка без rewarded-callback не выдаёт аккаунтный пак');
ok(rewardedDropStatuses(wednesday)['drop-daily'].available, 'Неуспешная реклама не отмечает ежедневный пак полученным');
ok(pendingRewardedDropItems('next-run') === null, 'Ежедневный пак больше не выдаёт прямые припасы до запуска');

const daily = await watchAndClaimRewardedDrop('drop-daily', async () => ({ shown: true, rewarded: true }), wednesday, () => 0);
ok(daily.ok && daily.delivery === 'account' && daily.items.length === 1, 'Ежедневный просмотр выдаёт аккаунтный токен пака');
ok(daily.ok && daily.items[0][0] === REWARD_PACK_DAILY && daily.items[0][1] === 1, 'Ежедневная реклама выдаёт именно мешок ресурсов');
ok(!rewardedDropStatuses(wednesday)['drop-daily'].available, 'Ежедневный пак блокируется после claim');
ok(rewardedDropStatuses(day(1))['drop-daily'].available, 'Ежедневный пак снова доступен на следующий UTC-день');
let duplicateAdShown = false;
const duplicate = await watchAndClaimRewardedDrop('drop-daily', async () => {
  duplicateAdShown = true;
  return { shown: true, rewarded: true };
}, wednesday);
ok(!duplicate.ok && duplicate.reason === 'claimed' && !duplicateAdShown, 'Повторное нажатие не запускает рекламу и не выдаёт второй мешок');
ok(availableRewardedDropChestCounts('survival')['drop-daily'] === 1, 'Аккаунтный мешок доступен в выживании');
ok(availableRewardedDropChestCounts('exploration')['drop-daily'] === 1, 'Тот же мешок доступен и в исследовании');
ok(availableRewardedDropChestCounts('own-world')['drop-daily'] === 1, 'И в своём мире пак тоже доступен');

const openedDailySurvival = openRewardedDropPack('drop-daily', 'survival');
ok(openedDailySurvival.ok && openedDailySurvival.chestItemId === REWARD_PACK_DAILY, 'Мешок открывается в survival');
ok(openedDailySurvival.ok && openedDailySurvival.items.some(([id, count]) => id === PLANKS && count === 12), 'В мешке есть доски');
ok(openedDailySurvival.ok && openedDailySurvival.items.some(([id, count]) => id === COAL && count === 6), 'В мешке есть уголь');
ok(openedDailySurvival.ok && openedDailySurvival.items.some(([id, count]) => id === COOKED_MEAT && count === 4), 'В мешке есть еда');
ok(openedDailySurvival.ok && openedDailySurvival.items.some(([id, count]) => id === TORCH && count === 4), 'В мешке есть факелы');
ok(openedDailySurvival.ok && openedDailySurvival.items.some(([id, count]) => id === WHEAT_SEEDS && count === 4), 'В мешке есть семена');
ok(openedDailySurvival.ok && openedDailySurvival.tools.join(',') === String(HOE_TOOLS[0]), 'В мешке лежит деревянная тяпка');
ok(availableRewardedDropChestCounts('survival')['drop-daily'] === 0, 'После открытия в survival мешок исчезает только в survival');
ok(availableRewardedDropChestCounts('exploration')['drop-daily'] === 1 && availableRewardedDropChestCounts('own-world')['drop-daily'] === 1, 'Другие режимы сохраняют право открыть тот же пак');
const openedDailyAgain = openRewardedDropPack('drop-daily', 'survival');
ok(!openedDailyAgain.ok && openedDailyAgain.reason === 'claimed', 'Повторно открыть мешок в том же режиме нельзя');
const openedDailyOwnWorld = openRewardedDropPack('drop-daily', 'own-world');
ok(openedDailyOwnWorld.ok, 'Мешок отдельно открывается в своём мире');
ok(openedDailyOwnWorld.ok && rollbackOpenedRewardedDropPack(openedDailyOwnWorld.receiptKey, 'own-world'), 'Открытие можно откатить, если сохранение мира сорвалось');
ok(availableRewardedDropChestCounts('own-world')['drop-daily'] === 1, 'Откат возвращает право открыть пак в своём мире');

const beforeWeekReady = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), wednesday);
ok(!beforeWeekReady.ok && beforeWeekReady.reason === 'claimed', 'Реклама не запускается до семи дней входа');
for (let offset = 1; offset <= 6; offset += 1) recordRewardedDropLogin(day(offset));
const weekReady = rewardedDropStatuses(day(6))['drop-weekly'];
ok(weekReady.available && weekReady.progress === 7 && weekReady.goal === 7, 'После семи уникальных дней недельный пак доступен');
const weeklyPreview = rewardedDropPackContents('drop-weekly', () => 0);
ok(weeklyPreview.chestItemId === REWARD_PACK_WEEKLY, 'Недельный preview использует сундук припасов');
ok(weeklyPreview.items.some(([id, count]) => id === IRON && count === 6), 'Недельный пак несёт немного железа');
ok(weeklyPreview.items.some(([id, count]) => id === WHEAT_SEEDS && count === 8), 'Недельный пак несёт больше семян');
ok(weeklyPreview.tools.join(',') === String(HOE_TOOLS[2]), 'Недельный пак несёт железную тяпку');
ok(weeklyPreview.gear.length === 3, 'Недельный пак несёт три детали доспехов');
ok(new Set(weeklyPreview.gear.map((gear) => gear.slot)).size === 3, 'В недельном паке слоты доспехов не повторяются');
ok(weeklyPreview.gear.filter((gear) => gear.material === 'iron' && gear.affixes.length === 0).length === 2, 'Две детали недельного пака — обычные железные');
ok(weeklyPreview.gear.some((gear) => gear.rarity === 0 && gear.affixes.length > 0), 'Одна недельная деталь имеет зелёную редкость и бафф');
const weekly = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), day(6), () => 0);
ok(weekly.ok && weekly.items[0][0] === REWARD_PACK_WEEKLY, 'Недельный просмотр выдаёт аккаунтный сундук');
ok(availableRewardedDropChestCounts('survival')['drop-weekly'] === 1, 'Недельный сундук доступен в survival');
ok(!rewardedDropStatuses(day(6))['drop-weekly'].available && rewardedDropStatuses(day(6))['drop-weekly'].progress === 0, 'После claim недельный прогресс начинается заново');

for (let offset = 7; offset <= 13; offset += 1) recordRewardedDropLogin(day(offset));
ok(rewardedDropStatuses(day(13))['drop-weekly'].available, 'Следующие семь дней входа снова открывают недельный пак');
const weeklyAgain = claimRewardedDrop('drop-weekly', day(13), () => 0.5);
ok(weeklyAgain.ok && availableRewardedDropChestCounts('survival')['drop-weekly'] === 2, 'Второй недельный сундук копится отдельным аккаунтным токеном');

for (let offset = 14; offset <= 29; offset += 1) recordRewardedDropLogin(day(offset));
const monthlyProgress = rewardedDropStatuses(day(29))['drop-monthly'];
ok(monthlyProgress.available && monthlyProgress.progress === 30 && monthlyProgress.goal === 30, 'Месячный пак открывается после тридцати дней входа');
const monthlyPreview = rewardedDropPackContents('drop-monthly', () => 0);
ok(monthlyPreview.chestItemId === REWARD_PACK_MONTHLY, 'Месячный preview использует богатый сундук');
ok(monthlyPreview.items.some(([id, count]) => id === DIAMOND && count === 2), 'Богатый сундук содержит алмазы');
ok(monthlyPreview.items.some(([id, count]) => id === WHEAT_SEEDS && count === 12), 'Богатый сундук содержит ещё больше семян');
ok(monthlyPreview.gear.length === 2, 'Богатый сундук содержит две детали доспехов');
ok(new Set(monthlyPreview.gear.map((gear) => gear.slot)).size === 2, 'В богатом сундуке слоты тоже не повторяются');
ok(monthlyPreview.gear.some((gear) => gear.rarity === 0 && gear.affixes.length > 0), 'В богатом сундуке есть зелёная часть с баффом');
ok(monthlyPreview.gear.some((gear) => gear.rarity === 1 && gear.affixes.length > 0), 'В богатом сундуке есть синяя часть с баффом');
const monthly = await watchAndClaimRewardedDrop('drop-monthly', async () => ({ shown: true, rewarded: true }), day(29), () => 1);
ok(monthly.ok && monthly.items[0][0] === REWARD_PACK_MONTHLY && monthly.delivery === 'account', 'Месячный просмотр выдаёт богатый аккаунтный сундук');
ok(availableRewardedDropChestCounts('own-world')['drop-monthly'] === 1, 'Богатый сундук можно отдельно открыть в своём мире');
ok(!rewardedDropStatuses(day(29))['drop-monthly'].available, 'После получения месячный прогресс сбрасывается');
ok(pendingRewardedDropItems('own-world') === null, 'Аккаунтные сундуки не создают прямых pending-припасов');

resetRewardedDropState();
applyCloudRewardedDrops({
  claims: { 'drop-daily': '2026-05-06' },
  pending: {},
  delivered: [],
  packs: [
    { key: 'drop-daily:2026-05-06', id: 'drop-daily', seed: 123, opened: { survival: true } },
    { key: 'drop-weekly:2026-05-04#1', id: 'drop-weekly', seed: 456, opened: { exploration: true } },
  ],
  login: {
    last: '2026-06-05',
    days: ['2026-05-30', '2026-06-01', '2026-06-03', '2026-06-05'],
    weeklyClaimedAt: '2026-05-29',
    monthlyClaimedAt: '2026-06-04',
    weeklyCycles: 1,
    monthlyCycles: 1,
  },
});
ok(availableRewardedDropChestCounts('survival')['drop-daily'] === 0 && availableRewardedDropChestCounts('exploration')['drop-daily'] === 1, 'Облачное состояние хранит, в каком режиме ежедневный мешок уже открыт');
ok(availableRewardedDropChestCounts('survival')['drop-weekly'] === 1 && availableRewardedDropChestCounts('exploration')['drop-weekly'] === 0, 'Открытый на другом устройстве режим weekly-пака тоже учитывается');
ok(rewardedDropStatuses(Date.UTC(2026, 5, 5, 12))['drop-weekly'].progress === 4, 'Облачные дни входа объединяются в прогресс');

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
ok(availableRewardedDropChestCounts('own-world')['drop-monthly'] === 2, 'Два месячных богатых сундука копятся независимо и не перезаписывают друг друга');

export { passed, failures };
