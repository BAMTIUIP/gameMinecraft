/**
 * Banner visibility is driven by React phase changes; SDK calls are asynchronous, so the latest
 * requested visibility must win if menu/run transitions happen while a status query or show call waits.
 */

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
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

type BannerStatus = { stickyAdvIsShowing: boolean };
let bannerShowing = false;
let firstStatusResolve: ((status: BannerStatus) => void) | null = null;
let releaseShow: (() => void) | null = null;
let holdNextShow = false;
let statusCalls = 0;
let showCalls = 0;
let hideCalls = 0;

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'en' } },
    serverTime: () => Date.now(),
    getFlags: async (params?: { defaultFlags?: Record<string, string> }) => params?.defaultFlags ?? {},
    adv: {
      getBannerAdvStatus: async (): Promise<BannerStatus> => {
        statusCalls += 1;
        if (statusCalls === 1) return new Promise((resolve) => (firstStatusResolve = resolve));
        return { stickyAdvIsShowing: bannerShowing };
      },
      showBannerAdv: async (): Promise<BannerStatus> => {
        showCalls += 1;
        bannerShowing = true;
        if (holdNextShow) {
          holdNextShow = false;
          await new Promise<void>((resolve) => (releaseShow = resolve));
        }
        return { stickyAdvIsShowing: bannerShowing };
      },
      hideBannerAdv: async (): Promise<BannerStatus> => {
        hideCalls += 1;
        bannerShowing = false;
        return { stickyAdvIsShowing: false };
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
const { syncBanner } = await import('../../src/game/ads');
await initYandex();
await loadFlags();

// The first (menu) status query is deliberately held; a run starts before it answers.
const menuSync = syncBanner(true);
const runSync = syncBanner(false);
firstStatusResolve?.({ stickyAdvIsShowing: false });
await Promise.all([menuSync, runSync]);
ok(!bannerShowing && showCalls === 0, 'Поздний ответ проверки меню не показывает баннер уже во время забега', `${showCalls} show calls`);
ok(statusCalls === 2, 'После смены фазы статус перечитан для актуального желания', String(statusCalls));

// Now hold a show request itself; a run begins while it is pending, so the banner must be hidden again.
holdNextShow = true;
const nextMenuSync = syncBanner(true);
for (let i = 0; i < 20 && showCalls === 0; i += 1) await Promise.resolve();
const nextRunSync = syncBanner(false);
releaseShow?.();
await Promise.all([nextMenuSync, nextRunSync]);
ok(!bannerShowing && showCalls === 1 && hideCalls === 1, 'Поздно завершившийся show сразу компенсируется hide для новой фазы', `${showCalls} show / ${hideCalls} hide`);

export { passed, failures };
