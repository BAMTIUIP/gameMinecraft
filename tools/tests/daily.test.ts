/** Daily rewarded-ad supplies, UTC reset, streak sizing and cloud reconciliation. */

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
const savedBonus = (key: string) => {
  const state = JSON.parse(storage.get('orerush.rewarded-drops.v1') ?? '{}') as { pending?: Record<string, { items?: number[][] }> };
  return state.pending?.[key]?.items ?? [];
};

const { initYandex, yaServerTime } = await import('../../src/game/yandex');
const { markProfileDirty, startProfileSync, flushProfile } = await import('../../src/game/profile');
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
const { PLANKS, COAL, COOKED_MEAT, TORCH } = await import('../../src/game/blocks');

await initYandex();
ok(yaServerTime() === BASE, 'The trusted clock comes from the SDK');
ok(utcDay() === day(0), 'The daily date uses the UTC server day', utcDay());
ok(DAILY_BASE === 1 && DAILY_STREAK_BONUS === 1 && DAILY_MAX === 2, 'The daily streak is capped at a two-bundle supply reward');
ok(dailySecondsUntilReset(BASE) === 12 * 60 * 60, 'The countdown reaches the next UTC midnight');

const first = dailyReward();
ok(first.available && first.streak === 1 && first.items.length === 4, 'The first daily ad offer is one supplies bundle', JSON.stringify(first));
ok(dailyState() === null, 'No daily claim is stored before a verified video');
ok(first.items.some(([id, count]) => id === PLANKS && count === 8), 'The base bundle includes planks');
ok(first.items.some(([id, count]) => id === COAL && count === 6), 'The base bundle includes coal');
ok(first.items.some(([id, count]) => id === COOKED_MEAT && count === 3) && first.items.some(([id, count]) => id === TORCH && count === 4), 'The base bundle includes food and torches');

const failed = await watchAndClaimDailyReward(async () => ({ shown: true, rewarded: false, skipped: 'error' }));
ok(!failed.ok && failed.reason === 'ad', 'An uncompleted video gives no daily reward');
ok(dailyReward().available && dailyState() === null, 'An unsuccessful video does not save the claim');
const thrown = await watchAndClaimDailyReward(async () => { throw new Error('SDK offline'); });
ok(!thrown.ok && thrown.reason === 'ad', 'An ad SDK error gives no reward');

const firstClaim = await watchAndClaimDailyReward(rewarded);
ok(firstClaim.ok && firstClaim.streak === 1 && firstClaim.items.length === 4, 'A verified callback grants the first supply bundle');
const firstPending = savedBonus(`bonus:daily:${day(0)}`);
ok(firstPending.length === 4 && firstPending.some(([id, count]) => id === PLANKS && count === 8), 'The daily supplies are durably queued for the next run');
const saved = JSON.parse(storage.get('orerush.daily.v1') ?? '{}') as { last?: string; streak?: number; at?: number };
ok(saved.last === day(0) && saved.streak === 1 && saved.at === BASE, 'The daily claim date/streak is saved after the ad');

let duplicateAdShown = false;
const twice = await watchAndClaimDailyReward(async () => {
  duplicateAdShown = true;
  return { shown: true, rewarded: true };
});
ok(!twice.ok && twice.reason === 'claimed' && !duplicateAdShown, 'A second same-day claim neither opens another ad nor grants supplies');

const realNow = Date.now;
Date.now = () => BASE + 30 * DAY_MS;
ok(!dailyReward().available, 'Changing the device clock does not reopen the reward');
Date.now = realNow;

serverNow = BASE + DAY_MS;
const streak2 = dailyReward();
ok(streak2.available && streak2.streak === 2 && streak2.items.some(([id, count]) => id === PLANKS && count === 16), 'The next-day streak earns a double supply bundle');
const secondClaim = await watchAndClaimDailyReward(rewarded);
ok(secondClaim.ok && secondClaim.items.some(([id, count]) => id === COAL && count === 12), 'The second verified ad queues twice the coal');

serverNow = BASE + 3 * DAY_MS;
const afterGap = dailyReward();
ok(afterGap.available && afterGap.streak === 1 && afterGap.items.some(([id, count]) => id === PLANKS && count === 8), 'A missed day resets the reward to one supply bundle');
await watchAndClaimDailyReward(rewarded);
for (let offset = 4; offset <= 9; offset += 1) {
  serverNow = BASE + offset * DAY_MS;
  const view = dailyReward();
  const expectedBundles = Math.min(DAILY_MAX, DAILY_BASE + DAILY_STREAK_BONUS * Math.max(0, view.streak - 1));
  const planks = view.items.find(([id]) => id === PLANKS)?.[1] ?? 0;
  ok(planks === 8 * expectedBundles, `Supply quantity remains capped at two bundles on day ${offset}`, String(planks));
  const result = await watchAndClaimDailyReward(rewarded);
  ok(result.ok, `A verified video queues supplies on day ${offset}`);
}
ok(dailyState()?.streak === 7, 'The streak continues beyond the two-bundle payout cap', JSON.stringify(dailyState()));

storage.set('orerush.daily.v1', JSON.stringify({ last: day(40), streak: 3, at: BASE }));
resetDailyState();
const future = dailyReward();
ok(!future.available && future.reason === 'clock', 'A future local claim safely blocks the reward', JSON.stringify(future));

// Drain the queued profile write before arranging the stale-cloud fixture.
await flushProfile(true);
storage.set('orerush.daily.v1', JSON.stringify({ last: day(5), streak: 2, at: BASE + 5 * DAY_MS }));
serverNow = BASE + 6 * DAY_MS + 20_000;
storage.set('orerush.profile.savedAt', String(serverNow - 10_000));
resetDailyState();
cloudBlob = {
  'orerush.profile': {
    v: 1,
    savedAt: serverNow - 15_000,
    name: 'CLOUD OLDER PROFILE',
    daily: { last: day(6), streak: 3 },
  },
};
markProfileDirty({ name: 'LOCAL NEWER PROFILE' });
const staleProfile = await startProfileSync();
ok(!staleProfile.cloudApplied, 'A stale profile shell does not replace newer local fields');
ok(dailyState()?.last === day(6) && dailyState()?.streak === 3, 'A newer remote daily claim merges despite the older profile timestamp');
ok(!dailyReward().available && dailyReward().reason === 'claimed', 'A claim from another device cannot be earned again');
await flushProfile(true);
const reconciled = calls.filter((call) => call.name === 'player.setData').at(-1)?.arg as Record<string, { daily?: { last?: string }; name?: string }> | undefined;
ok(
  reconciled?.['orerush.profile']?.daily?.last === day(6)
    && reconciled['orerush.profile'].name === 'LOCAL NEWER PROFILE',
  'The profile flush retains the remote claim and independent newer local edit',
  JSON.stringify(reconciled),
);

serverNow = BASE + 12 * DAY_MS;
await watchAndClaimDailyReward(rewarded);
await flushProfile(true);
const pushed = calls.filter((call) => call.name === 'player.setData').at(-1)?.arg as Record<string, { daily?: { last?: string }; adDrops?: { pending?: Record<string, unknown> } }> | undefined;
ok(pushed?.['orerush.profile']?.daily?.last === day(12), 'The daily claim date is synchronized to the profile');
ok(Boolean(pushed?.['orerush.profile']?.adDrops?.pending), 'The queued supply reward is synchronized alongside the claim');
ok(!('diamonds' in ((pushed?.['orerush.profile'] ?? {}) as object)), 'The cloud profile contains no retired in-game wallet');

serverNow = BASE + 13 * DAY_MS;
await watchAndClaimDailyReward(rewarded);
const localAfterClaim = { ...(dailyState() ?? { last: '', streak: 0 }) };
applyCloudDaily({ last: day(5), streak: 9 });
resetDailyState();
ok(dailyState()?.last === localAfterClaim.last && dailyState()?.streak === localAfterClaim.streak, 'An older cloud copy cannot roll back the local streak');
applyCloudDaily({ last: localAfterClaim.last, streak: 9 });
ok((dailyState()?.streak ?? 0) === 9, 'A longer streak wins for the same claim date');
applyCloudDaily({ last: 'not-a-date', streak: 99 });
ok((dailyState()?.streak ?? 0) === 9, 'An invalid cloud date is ignored');
applyCloudDaily({ last: '2026-02-30', streak: 99 });
ok((dailyState()?.streak ?? 0) === 9, 'An impossible calendar day is ignored');
storage.set('orerush.daily.v1', JSON.stringify({ last: '2026-02-30', streak: 99, at: BASE }));
resetDailyState();
ok(dailyState() === null && dailyReward().available, 'A corrupt local date does not permanently block the daily reward');

export { passed, failures };
