/**
 * Unit test for advertising (src/game/ads.ts).
 *
 * Covers the parts a browser check cannot reach deterministically: the cooldown, the "one ad at a
 * time" lock, and the rewarded contract — the reward is only paid when the platform counted the view
 * (`onRewarded` + `onClose(true)`), never on a skipped or failed ad.
 */

type Call = { name: string; arg: unknown };
const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });

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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

/** the ad currently on screen; the test decides when the player closes it */
let onScreen: { kind: string; callbacks: Record<string, (...args: unknown[]) => void> } | null = null;

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    getFlags: async (params?: { defaultFlags?: Record<string, string> }) => params?.defaultFlags ?? {},
    adv: {
      showFullscreenAdv: ({ callbacks }: never) => {
        record('adv.showFullscreenAdv');
        onScreen = { kind: 'fullscreen', callbacks };
      },
      showRewardedVideo: ({ callbacks }: never) => {
        record('adv.showRewardedVideo');
        onScreen = { kind: 'rewarded', callbacks };
      },
      getBannerAdvStatus: async () => ({ stickyAdvIsShowing: false }),
      showBannerAdv: async () => ({ stickyAdvIsShowing: true }),
      hideBannerAdv: async () => ({ stickyAdvIsShowing: false }),
    },
    features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
    on() {},
  }),
};

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

// all ad flags on, cooldown at its floor
storage.set(
  'orerush.flags.v1',
  JSON.stringify({
    savedAt: Date.now(),
    flags: { 'adv.enabled': 'true', 'adv.interstitial.enabled': 'true', 'adv.rewarded.enabled': 'true' },
  }),
);

const { initYandex } = await import('../../src/game/yandex');
const { loadFlags } = await import('../../src/game/flags');
const { showFullscreenAd, showRewardedAd, fullscreenCooldownLeft, adInFlight, markAdSessionStart } = await import('../../src/game/ads');

await initYandex();
await loadFlags('paying');

// --- the session grace period: no fullscreen ad right after the boot ---------------------------
markAdSessionStart();
ok(fullscreenCooldownLeft() > 0, 'В начале сессии полноэкранная реклама придержана');
const tooEarly = await showFullscreenAd();
ok(tooEarly.skipped === 'cooldown' && !tooEarly.shown, 'Пока идёт грейс-период, реклама не запрашивается', JSON.stringify(tooEarly));
ok(!calls.some((c) => c.name === 'adv.showFullscreenAdv'), 'SDK при этом не вызывается вовсе');

// --- a rewarded video pays out only when the platform counted the view --------------------------
const rewarded = showRewardedAd();
await new Promise((r) => setTimeout(r, 10));
ok(calls.some((c) => c.name === 'adv.showRewardedVideo'), 'showRewardedVideo() вызван');
ok(adInFlight(), 'Пока реклама на экране, стоит блокировка от повторного показа');
const second = await showRewardedAd();
ok(second.skipped === 'busy', 'Повторный запрос во время показа отклоняется', JSON.stringify(second));
onScreen!.callbacks.onRewarded?.();
onScreen!.callbacks.onClose?.(true);
const outcome = await rewarded;
ok(outcome.shown && outcome.rewarded, 'Награда начислена после onRewarded + onClose(true)', JSON.stringify(outcome));
ok(!adInFlight(), 'После закрытия блокировка снята');

// --- closing the video early pays nothing -------------------------------------------------------
const skipped = showRewardedAd();
await new Promise((r) => setTimeout(r, 10));
onScreen!.callbacks.onClose?.(false);
const skippedOutcome = await skipped;
ok(!skippedOutcome.rewarded, 'Закрытая досрочно видеореклама не даёт награду', JSON.stringify(skippedOutcome));

// --- an error leaves the game in a usable state --------------------------------------------------
const failing = showRewardedAd();
await new Promise((r) => setTimeout(r, 10));
onScreen!.callbacks.onError?.(new Error('no fill'));
const failed = await failing;
ok(failed.skipped === 'error' && !failed.rewarded, 'Ошибка рекламы не даёт награду и не ломает состояние', JSON.stringify(failed));

// --- the fullscreen cooldown: after a shown ad the next one waits --------------------------------
// rewind the clock instead of waiting three minutes
markAdSessionStart();
const realNow = Date.now;
let fakeNow = realNow();
Date.now = () => fakeNow;
fakeNow += 60_000; // past the session grace
const shownAd = showFullscreenAd();
await new Promise((r) => setTimeout(r, 10));
onScreen!.callbacks.onClose?.(true);
const shownOutcome = await shownAd;
ok(shownOutcome.shown, 'Полноэкранная реклама показана после грейс-периода', JSON.stringify(shownOutcome));
ok(fullscreenCooldownLeft() > 0, 'После показа включается кулдаун', `${fullscreenCooldownLeft().toFixed(0)} c`);
const again = await showFullscreenAd();
ok(again.skipped === 'cooldown', 'Второй полноэкранный показ в кулдаун не проходит', JSON.stringify(again));
Date.now = realNow;

export { passed, failures, calls };
