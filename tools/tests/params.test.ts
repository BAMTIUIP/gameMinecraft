/**
 * Unit test for the "other SDK objects" page (src/game/params.ts + the wrappers in src/game/yandex.ts),
 * https://yandex.ru/dev/games/doc/ru/sdk/sdk-params.
 *
 * The page is about three objects:
 *  - `deviceInfo` — `type` and the `isMobile()`/`isDesktop()`/`isTablet()`/`isTV()` helpers decide whether the game
 *    shows touch controls and expects the TV back button;
 *  - `screen.fullscreen` — `status` + `request()`/`exit()`, always from a user action;
 *  - `clipboard.writeText()` — the "copy result" button, with a fallback off-platform.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });
const count = (name: string) => calls.filter((c) => c.name === name).length;

/* ------------------------------- DOM stubs ------------------------------- */

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

/** minimal DOM for the execCommand fallback of copyText() */
const bodyStub = {
  children: [] as unknown[],
  appendChild(child: unknown) {
    this.children.push(child);
  },
  removeChild(child: unknown) {
    this.children = this.children.filter((c) => c !== child);
  },
};
const documentStub = {
  title: '',
  documentElement: { lang: '' },
  body: bodyStub,
  addEventListener() {},
  removeEventListener() {},
  execCommand: (cmd: string) => {
    record('document.execCommand', cmd);
    return legacyCopyWorks;
  },
  createElement: () => ({
    value: '',
    style: {} as Record<string, string>,
    setAttribute() {},
    select() {
      record('textarea.select');
    },
  }),
};
let legacyCopyWorks = true;

/** the native Fullscreen API, as a browser exposes it */
let nativeElement: unknown = null;
const nativeRoot = {
  requestFullscreen: async () => {
    record('native.requestFullscreen');
    nativeElement = nativeRoot;
  },
};
const documentWithFullscreen = documentStub as typeof documentStub & {
  fullscreenElement?: unknown;
  exitFullscreen?: () => Promise<void>;
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = documentWithFullscreen;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

let deviceType: string | undefined = 'mobile';
let deviceAnswers: { isMobile?: boolean | null; isDesktop?: boolean | null; isTablet?: boolean | null; isTV?: boolean | null } = {};
let userGestureActive = false;
let fullscreenRequestHadGesture = false;
let fullscreenExitHadGesture = false;
const fullscreenStatus = { value: 'off' as string, available: true };
let clipboardFails = false;

const deviceInfoOrNull = () => ({
  get type() {
    record('deviceInfo.type');
    return deviceType;
  },
  isMobile: () => {
    record('deviceInfo.isMobile');
    return deviceAnswers.isMobile ?? deviceType === 'mobile';
  },
  isDesktop: () => {
    record('deviceInfo.isDesktop');
    return deviceAnswers.isDesktop ?? deviceType === 'desktop';
  },
  isTablet: () => {
    record('deviceInfo.isTablet');
    return deviceAnswers.isTablet ?? deviceType === 'tablet';
  },
  isTV: () => {
    record('deviceInfo.isTV');
    return deviceAnswers.isTV ?? deviceType === 'tv';
  },
});

const fullscreenOrNull = () =>
  fullscreenStatus.available
    ? {
        STATUS_ON: 'on',
        STATUS_OFF: 'off',
        get status() {
          return fullscreenStatus.value;
        },
        request: async () => {
          record('screen.fullscreen.request');
          fullscreenRequestHadGesture = userGestureActive;
          if (!userGestureActive) throw new Error('fullscreen request requires a user gesture');
          fullscreenStatus.value = 'on';
        },
        exit: async () => {
          record('screen.fullscreen.exit');
          fullscreenExitHadGesture = userGestureActive;
          if (!userGestureActive) throw new Error('fullscreen exit requires a user gesture');
          fullscreenStatus.value = 'off';
        },
      }
    : undefined;

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
  setData: async () => undefined,
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
      serverTime: () => Date.now(),
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
      features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
      on() {},
      get deviceInfo() {
        return deviceInfoOrNull();
      },
      get screen() {
        return { fullscreen: fullscreenOrNull() };
      },
      clipboard: {
        writeText: async (text: string) => {
          record('clipboard.writeText', text);
          if (clipboardFails) throw new Error('clipboard blocked');
        },
      },
    };
  },
};

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { initYandex, yaDeviceType, yaFullscreenStatus } = await import('../../src/game/yandex');
const { copyText, deviceKind, fullscreenAvailable, fullscreenOn, toggleFullscreen, touchDevice, tvDevice } = await import('../../src/game/params');

await initYandex();

// --- deviceInfo decides what the game is running on ---------------------------------------------
ok(yaDeviceType() === 'mobile', 'ysdk.deviceInfo.type читается', String(yaDeviceType()));
ok(count('deviceInfo.type') >= 1, 'Поле type действительно запрошено у платформы');
ok(deviceKind() === 'mobile', 'Игра узнаёт мобильное устройство от платформы', deviceKind());
ok(touchDevice() === true, 'На телефоне появляются сенсорные элементы управления', String(touchDevice()));
ok(tvDevice() === false, 'На телефоне игра не ждёт события телевизора');

deviceType = 'tablet';
ok(deviceKind() === 'tablet' && touchDevice() === true && tvDevice() === false, 'Планшет: сенсорное управление, но не ТВ', deviceKind());

deviceType = 'tv';
ok(deviceKind() === 'tv' && tvDevice() === true, 'Телевизор распознан (там приходит HISTORY_BACK)', deviceKind());
ok(touchDevice() === false, 'На телевизоре сенсорные элементы не показываются');

deviceType = 'desktop';
ok(deviceKind() === 'desktop' && touchDevice() === false, 'Компьютер: платформа сказала «desktop», сенсор выключен', deviceKind());

// --- when only the is*() helpers answer ----------------------------------------------------------
deviceType = undefined;
deviceAnswers = { isMobile: false, isTablet: true, isTV: false };
ok(deviceKind() === 'tablet', 'Без type игра спрашивает isTablet()', deviceKind());
ok(count('deviceInfo.isTablet') >= 1, 'Хелпер isTablet() вызван', String(count('deviceInfo.isTablet')));
deviceAnswers = { isMobile: false, isDesktop: true, isTablet: false, isTV: false };
ok(deviceKind() === 'desktop', 'Без type игра использует isDesktop()', deviceKind());
ok(count('deviceInfo.isDesktop') >= 1, 'Хелпер isDesktop() вызван', String(count('deviceInfo.isDesktop')));
deviceAnswers = {};
deviceType = 'desktop';

// --- screen.fullscreen ---------------------------------------------------------------------------
ok(yaFullscreenStatus() === 'off', 'Статус полного экрана читается из SDK', String(yaFullscreenStatus()));
ok(fullscreenOn() === false, 'Игра знает, что полный экран выключен');
ok(fullscreenAvailable() === true, 'Кнопка полного экрана доступна');
userGestureActive = true;
const requestFullscreen = toggleFullscreen();
userGestureActive = false;
const turnedOn = await requestFullscreen;
ok(count('screen.fullscreen.request') === 1, 'Переключение вызвало screen.fullscreen.request', String(count('screen.fullscreen.request')));
ok(fullscreenRequestHadGesture, 'Запрос полного экрана отправлен до потери пользовательского жеста');
ok(turnedOn === true && fullscreenOn() === true, 'После запроса экран считается полным', String(turnedOn));
userGestureActive = true;
const exitFullscreen = toggleFullscreen();
userGestureActive = false;
const turnedOff = await exitFullscreen;
ok(count('screen.fullscreen.exit') === 1, 'Повторное переключение вызвало screen.fullscreen.exit', String(count('screen.fullscreen.exit')));
ok(fullscreenExitHadGesture, 'Выход из полного экрана вызван из пользовательского жеста');
ok(turnedOff === false && fullscreenOn() === false, 'Полный экран выключен снова', String(turnedOff));
ok(count('native.requestFullscreen') === 0, 'Внутри платформы нативный Fullscreen API не трогается');

// --- clipboard -----------------------------------------------------------------------------------
const copied = await copyText('ВЫЖИВАНИЕ · счёт 1234 · блоков 321 · глубина 12 — ORE RUSH');
ok(copied === true, 'copyText() сообщает об успехе');
const text = calls.filter((c) => c.name === 'clipboard.writeText').at(-1)?.arg;
ok(typeof text === 'string' && text.includes('1234'), 'Строка итога ушла в ysdk.clipboard.writeText', String(text));
ok(count('document.execCommand') === 0, 'Резервный способ не нужен, когда платформа справилась');

// --- the platform clipboard refuses: the fallback takes over --------------------------------------
clipboardFails = true;
(g.navigator as { clipboard?: unknown }).clipboard = {
  writeText: async (value: string) => {
    record('navigator.clipboard', value);
  },
};
ok((await copyText('итог')) === true, 'При отказе sdks-буфера работает navigator.clipboard');
ok(count('navigator.clipboard') === 1, 'Резервный буфер получил текст', String(count('navigator.clipboard')));
delete (g.navigator as { clipboard?: unknown }).clipboard;
legacyCopyWorks = true;
ok((await copyText('итог')) === true, 'Последний резерв — execCommand(copy)');
ok(count('document.execCommand') === 1, 'execCommand вызван один раз', String(count('document.execCommand')));
legacyCopyWorks = false;
clipboardFails = true;
ok((await copyText('итог')) === false, 'Когда ничего не сработало, кнопка честно сообщает о неудаче');
ok(bodyStub.children.length === 0, 'Временное поле удаляется после резервного копирования');
ok((await copyText('')) === false, 'Пустая строка в буфер не пишется');
const workingExecCommand = documentStub.execCommand;
documentStub.execCommand = () => {
  throw new Error('legacy clipboard blocked');
};
ok((await copyText('ошибка')) === false, 'Исключение старого clipboard API обрабатывается');
ok(bodyStub.children.length === 0, 'Временное поле удаляется и при исключении');
documentStub.execCommand = workingExecCommand;

export { passed, failures };
