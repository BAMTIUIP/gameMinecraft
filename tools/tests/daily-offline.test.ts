/**
 * Off-Yandex half of the daily-reward contract: without the platform there is no server clock, so the
 * game falls back to the device clock (`yaServerTime()`), the bonus still works for a local player,
 * and nothing pretends to be a cloud record.
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

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaServerTime } = await import('../../src/game/yandex');
const { getDiamonds, startProfileSync, flushProfile } = await import('../../src/game/profile');
const { DAILY_BASE, dailyReward, utcDay, watchAndClaimDailyReward } = await import('../../src/game/daily');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
const before = Date.now();
ok(Math.abs(yaServerTime() - before) < 5_000, 'Без сервера время берётся с часов устройства', String(yaServerTime()));
await startProfileSync();

const view = dailyReward();
ok(view.available && view.amount === DAILY_BASE, 'Вне Яндекса ежедневный бонус работает по местному времени', JSON.stringify(view));
ok(view.today === utcDay(), 'Дата считается тем же способом (UTC YYYY-MM-DD)', view.today);
const failed = await watchAndClaimDailyReward(async () => ({ shown: false, rewarded: false, skipped: 'offline' }));
ok(!failed.ok && failed.reason === 'ad' && getDiamonds() === 0, 'Вне платформы неуспешная реклама не выдаёт бонус');
const claim = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: true }));
ok(claim.ok && getDiamonds() === DAILY_BASE, 'Подтверждённый просмотр начисляет бонус и без платформы', String(getDiamonds()));
ok(!dailyReward().available, 'Повторно в тот же день бонус не предлагается');
const balance = getDiamonds();
const duplicate = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: true }));
ok(!duplicate.ok && getDiamonds() === balance, 'Второе начисление ничего не меняет', String(getDiamonds()));
const flushed = await flushProfile(true);
ok(flushed, 'Запись профиля вне Яндекса не падает');
ok(!!storage.get('orerush.daily.v1'), 'Состояние бонуса лежит в локальном хранилище');

export { passed, failures };
