/** Rewarded shop-drop tests: no cancelled/error/offline ad pays, periods are server-time gated, and supplies persist. */

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() {
    return storage.size;
  },
};
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const {
  applyCloudRewardedDrops,
  claimRewardedDrop,
  isRewardedDrop,
  rewardedDropPeriod,
  rewardedDropReward,
  rewardedDropStatuses,
  resetRewardedDropState,
  completePendingRewardedDropItems,
  pendingRewardedDropItems,
  watchAndClaimRewardedDrop,
} = await import('../../src/game/adDrops');
const { getDiamonds } = await import('../../src/game/profile');
const { COAL, COOKED_MEAT, GOLD, IRON, PLANKS, TORCH } = await import('../../src/game/blocks');

resetRewardedDropState();
const wednesday = Date.UTC(2026, 4, 6, 12);
const nextWednesday = Date.UTC(2026, 4, 13, 12);
const nextMonth = Date.UTC(2026, 5, 1, 12);
ok(isRewardedDrop('drop-daily') && isRewardedDrop('drop-weekly') && isRewardedDrop('drop-monthly'), 'Три дропа магазина распознаются как rewarded-дропы');
ok(!isRewardedDrop('diamonds-100'), 'Платный пакет алмазов не проходит как rewarded-дроп');
ok(rewardedDropPeriod('drop-weekly', wednesday) === '2026-05-04', 'Неделя привязана к понедельнику по UTC');
ok(rewardedDropPeriod('drop-monthly', wednesday) === '2026-05', 'Месячный период использует UTC-месяц');

const failedAd = await watchAndClaimRewardedDrop(
  'drop-daily',
  async () => ({ shown: true, rewarded: false, skipped: 'error' }),
  wednesday,
  () => 0,
);
ok(!failedAd.ok && failedAd.reason === 'ad', 'Закрытие/ошибка без rewarded-callback не выдаёт награду');
ok(rewardedDropStatuses(wednesday)['drop-daily'].available, 'Неуспешная реклама не отмечает ежедневный дроп полученным');
ok(getDiamonds() === 0, 'Неуспешная реклама не начисляет алмазы');

const thrownAd = await watchAndClaimRewardedDrop('drop-weekly', async () => { throw new Error('SDK unavailable'); }, wednesday, () => 0);
ok(!thrownAd.ok && thrownAd.reason === 'ad' && rewardedDropStatuses(wednesday)['drop-weekly'].available, 'Ошибка SDK оставляет недельный дроп доступным');

const daily = await watchAndClaimRewardedDrop('drop-daily', async () => ({ shown: true, rewarded: true }), wednesday, () => 0);
ok(daily.ok && daily.diamonds === 0 && daily.items.length === 4 && daily.delivery === 'next-run', 'Ежедневное видео сохраняет припасы для следующего забега без алмазов');
ok(daily.ok && daily.items.some(([id, count]) => id === PLANKS && count === 8), 'Ежедневный набор содержит заявленные доски');
ok(daily.ok && daily.items.some(([id, count]) => id === COAL && count === 6), 'Ежедневный набор содержит заявленный уголь');
ok(daily.ok && daily.items.some(([id, count]) => id === COOKED_MEAT && count === 3), 'Ежедневный набор содержит готовую еду');
ok(daily.ok && daily.items.some(([id, count]) => id === TORCH && count === 4), 'Ежедневный набор содержит полезные припасы');
ok(!rewardedDropStatuses(wednesday)['drop-daily'].available, 'Ежедневный дроп заблокирован до следующего UTC-дня');
ok(rewardedDropStatuses(nextWednesday)['drop-daily'].available, 'Ежедневный дроп снова доступен на следующий день');

let duplicateAdShown = false;
const duplicate = await watchAndClaimRewardedDrop('drop-daily', async () => {
  duplicateAdShown = true;
  return { shown: true, rewarded: true };
}, wednesday);
ok(!duplicate.ok && duplicate.reason === 'claimed' && !duplicateAdShown, 'Повторное нажатие не запускает рекламу и не выдаёт дроп дважды');

const weeklyMin = rewardedDropReward('drop-weekly', () => 0);
const weeklyMax = rewardedDropReward('drop-weekly', () => 1);
const monthlyMin = rewardedDropReward('drop-monthly', () => 0);
const monthlyMax = rewardedDropReward('drop-monthly', () => 1);
ok(weeklyMin.diamonds === 1 && weeklyMax.diamonds === 5, 'Недельная награда соответствует диапазону 1–5 алмазов');
ok(monthlyMin.diamonds === 10 && monthlyMax.diamonds === 50, 'Месячная награда соответствует диапазону 10–50 алмазов');

const weekly = await watchAndClaimRewardedDrop('drop-weekly', async () => ({ shown: true, rewarded: true }), wednesday, () => 0);
ok(weekly.ok && weekly.diamonds === 1 && getDiamonds() === 1, 'Недельные алмазы начисляются только после подтверждённого просмотра');
ok(weekly.ok && weekly.items.length === 0, 'Недельный бесплатный пак содержит только 1–5 алмазов из действующего списка наград');
ok(!rewardedDropStatuses(wednesday)['drop-weekly'].available, 'Недельный дроп блокируется до следующей недели');
ok(rewardedDropStatuses(nextWednesday)['drop-weekly'].available, 'Недельный дроп снова доступен на следующей неделе');

const monthly = await watchAndClaimRewardedDrop('drop-monthly', async () => ({ shown: true, rewarded: true }), wednesday, () => 1);
ok(monthly.ok && monthly.diamonds === 50 && monthly.delivery === 'own-world' && getDiamonds() === 51, 'Месячная награда начисляет 10–50 алмазов и резервирует предметы для своего мира');
ok(monthly.ok && monthly.items.some(([id, count]) => id === IRON && count === 12), 'Месячный набор содержит железо');
ok(monthly.ok && monthly.items.some(([id, count]) => id === GOLD && count === 4), 'Месячный набор содержит золото');
ok(monthly.ok && monthly.items.some(([id, count]) => id === PLANKS && count === 32), 'Месячный набор содержит 32 доски');
ok(monthly.ok && monthly.items.some(([id, count]) => id === TORCH && count === 16), 'Месячный набор содержит 16 факелов');
ok(!rewardedDropStatuses(wednesday)['drop-monthly'].available && rewardedDropStatuses(nextMonth)['drop-monthly'].available, 'Месячный дроп блокируется до следующего UTC-месяца');

const nextRunBatch = pendingRewardedDropItems('next-run');
ok(Boolean(nextRunBatch?.items.some(([id, count]) => id === PLANKS && count === 8)), 'Ежедневные доски выдаются в следующем забеге');
ok(Boolean(nextRunBatch && !nextRunBatch.items.some(([id]) => id === IRON || id === GOLD)), 'Месячные материалы не попадают в обычный забег вместо своего мира');
ok(Boolean(nextRunBatch && pendingRewardedDropItems('next-run')?.keys.length === nextRunBatch.keys.length), 'Припасы не помечаются полученными до успешного добавления в инвентарь');
ok(Boolean(nextRunBatch && completePendingRewardedDropItems(nextRunBatch.keys)), 'Успешная выдача ежедневных припасов подтверждается отдельно');
const ownWorldBatch = pendingRewardedDropItems('own-world');
ok(Boolean(ownWorldBatch?.items.some(([id, count]) => id === PLANKS && count === 32)), 'Месячные доски ждут загрузки собственного мира');
ok(Boolean(ownWorldBatch && ownWorldBatch.items.some(([id, count]) => id === IRON && count === 12) && ownWorldBatch.items.some(([id, count]) => id === GOLD && count === 4)), 'Месячные железо и золото выдаются в собственный мир');
ok(Boolean(ownWorldBatch && completePendingRewardedDropItems(ownWorldBatch.keys)), 'Сохранённый мир подтверждает месячный grant после успешного сохранения');
ok(pendingRewardedDropItems('own-world') === null, 'Выданные в инвентарь припасы не дублируются при повторном запуске');

applyCloudRewardedDrops({ claims: { 'drop-weekly': '2026-05-11' }, pending: {}, delivered: [] });
ok(!rewardedDropStatuses(nextWednesday)['drop-weekly'].available, 'Облачная запись не позволяет повторно получить недельный дроп на другом устройстве');
const duplicateCloudClaim = claimRewardedDrop('drop-weekly', nextWednesday, () => 0);
ok(!duplicateCloudClaim.ok && duplicateCloudClaim.reason === 'claimed', 'Облачное слияние также блокирует повторный локальный claim');

export { passed, failures };
