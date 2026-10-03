/** Permanent ad-free ownership suppresses interstitials and sticky banners, but not opt-in rewards. */

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

const calls: string[] = [];
let bannerShowing = true; // sticky banners may be enabled by default on the platform
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    getFlags: async (params?: { defaultFlags?: Record<string, string> }) => ({ ...(params?.defaultFlags ?? {}) }),
    adv: {
      showFullscreenAdv: ({ callbacks }: { callbacks: Record<string, (...args: unknown[]) => void> }) => {
        calls.push('adv.showFullscreenAdv');
        callbacks.onClose?.(true);
      },
      showRewardedVideo: ({ callbacks }: { callbacks: Record<string, (...args: unknown[]) => void> }) => {
        calls.push('adv.showRewardedVideo');
        callbacks.onRewarded?.();
        callbacks.onClose?.(true);
      },
      getBannerAdvStatus: async () => {
        calls.push('adv.getBannerAdvStatus');
        return { stickyAdvIsShowing: bannerShowing };
      },
      hideBannerAdv: async () => {
        calls.push('adv.hideBannerAdv');
        bannerShowing = false;
        return { stickyAdvIsShowing: false };
      },
      showBannerAdv: async () => {
        calls.push('adv.showBannerAdv');
        bannerShowing = true;
        return { stickyAdvIsShowing: true };
      },
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

const { initYandex } = await import('../../src/game/yandex');
const { loadFlags } = await import('../../src/game/flags');
const { cacheAdFreeEntitlement, reconcileAdFreePurchases } = await import('../../src/game/adFree');
const { showFullscreenAd, showRewardedAd, syncBanner } = await import('../../src/game/ads');

await initYandex();
await loadFlags();
cacheAdFreeEntitlement(true);
ok(reconcileAdFreePurchases(null), 'При ошибке getPurchases() кэшированное право не сбрасывается');

await syncBanner(true);
ok(!bannerShowing && calls.includes('adv.hideBannerAdv'), 'Покупка активно скрывает sticky-баннер, включённый платформой по умолчанию');
const fullscreen = await showFullscreenAd();
ok(fullscreen.skipped === 'ad-free' && !fullscreen.shown, 'После покупки игровой interstitial не запрашивается', JSON.stringify(fullscreen));
ok(!calls.includes('adv.showFullscreenAdv'), 'SDK не получает запрос fullscreen-рекламы для владельца disable_ads');

const rewarded = await showRewardedAd();
ok(rewarded.rewarded && calls.includes('adv.showRewardedVideo'), 'Добровольное rewarded-видео остаётся доступным для награды', JSON.stringify(rewarded));

cacheAdFreeEntitlement(false);
await syncBanner(true);
ok(bannerShowing && calls.includes('adv.showBannerAdv'), 'После снятия тестового entitlement обычная логика снова показывает sticky-баннер');

export { passed, failures };
