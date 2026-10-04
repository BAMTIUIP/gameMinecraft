/** Off-Yandex daily reward uses local UTC time and keeps the free supply grant available. */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
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
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaServerTime } = await import('../../src/game/yandex');
const { startProfileSync, flushProfile } = await import('../../src/game/profile');
const { DAILY_BASE, dailyReward, utcDay, watchAndClaimDailyReward } = await import('../../src/game/daily');
const { pendingRewardedDropItems } = await import('../../src/game/adDrops');

const sdk = await initYandex();
ok(sdk === null, 'Outside Yandex Games, SDK initialization returns null');
const before = Date.now();
ok(Math.abs(yaServerTime() - before) < 5_000, 'Without the platform, time uses the device clock', String(yaServerTime()));
await startProfileSync();

const view = dailyReward();
ok(view.available && view.items.length === 4 && view.items[0][1] === 8 * DAILY_BASE, 'The daily supply reward is available offline');
ok(view.today === utcDay(), 'The daily date uses UTC YYYY-MM-DD', view.today);
const failed = await watchAndClaimDailyReward(async () => ({ shown: false, rewarded: false, skipped: 'offline' }));
ok(!failed.ok && failed.reason === 'ad', 'An unverified offline ad gives no supplies');
const claim = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: true }));
ok(claim.ok && claim.items.length === 4, 'A verified rewarded callback grants supplies without the platform');
const queued = pendingRewardedDropItems('next-run');
ok(Boolean(queued?.items.length === 4), 'The local reward is queued for the next run');
ok(!dailyReward().available, 'A successful claim cannot be repeated on the same day');
const duplicate = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: true }));
ok(!duplicate.ok, 'A second same-day attempt remains blocked');
const flushed = await flushProfile(true);
ok(flushed, 'Profile saving does not crash outside Yandex Games');
ok(Boolean(storage.get('orerush.daily.v1')), 'The daily guard is stored locally');

export { passed, failures };
