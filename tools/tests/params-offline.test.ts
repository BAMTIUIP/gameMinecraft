/**
 * Off-Yandex half of the sdk-params contract: without `window.YaGames` there is no `deviceInfo`,
 * no `screen.fullscreen` and no `clipboard`, so the game falls back to the browser — the device is
 * guessed from the user agent, fullscreen goes through the native Fullscreen API and the clipboard
 * through `navigator.clipboard` or `execCommand('copy')`.
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

const records: string[] = [];
const bodyStub = {
  children: [] as unknown[],
  appendChild(child: unknown) {
    this.children.push(child);
  },
  removeChild(child: unknown) {
    this.children = this.children.filter((c) => c !== child);
  },
};
let nativeElement: unknown = null;
const documentStub = {
  title: '',
  // the native API sits on the element (documentElement), as in a browser
  documentElement: { lang: '' } as { lang: string; requestFullscreen?: () => Promise<void> },
  body: bodyStub,
  addEventListener() {},
  removeEventListener() {},
  execCommand: (cmd: string) => {
    records.push(`execCommand:${cmd}`);
    return true;
  },
  createElement: () => ({ value: '', style: {}, setAttribute() {}, select() {} }),
  get fullscreenElement() {
    return nativeElement;
  },
  exitFullscreen: undefined as undefined | (() => Promise<void>),
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = documentStub;
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ru', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' },
  configurable: true,
});
// window.matchMedia is absent on purpose: the game must survive a bare environment
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex, yaCopyText, yaDeviceType, yaFullscreenStatus } = await import('../../src/game/yandex');
const { copyText, deviceKind, fullscreenAvailable, fullscreenOn, toggleFullscreen, touchDevice, tvDevice } = await import('../../src/game/params');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
ok(yaDeviceType() === null && yaFullscreenStatus() === null, 'Объектов deviceInfo и screen.fullscreen нет');
ok((await yaCopyText('текст')) === false, 'Без платформы ysdk.clipboard недоступен', String(await yaCopyText('x')));

// --- the device is guessed from the user agent ---------------------------------------------------
ok(deviceKind() === 'mobile', 'Вне Яндекса устройство определяется по user agent', deviceKind());
ok(touchDevice() === true, 'Телефон получает сенсорное управление и без платформы');
ok(tvDevice() === false, 'Телефон не считается телевизором');
(g.navigator as { userAgent?: string }).userAgent = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36';
ok(deviceKind() === 'tv' && tvDevice() === true, 'Телевизор по user agent распознан', deviceKind());
(g.navigator as { userAgent?: string }).userAgent = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)';
ok(deviceKind() === 'tablet' && touchDevice() === true, 'Планшет по user agent — сенсорное управление', deviceKind());
(g.navigator as { userAgent?: string }).userAgent = 'Mozilla/5.0 (X11; Linux x86_64)';
ok(deviceKind() === 'desktop' && touchDevice() === false, 'Компьютер по user agent — без сенсора', deviceKind());

// --- fullscreen through the native API -----------------------------------------------------------
ok(fullscreenAvailable() === false, 'Без Fullscreen API переключатель недоступен');
let toggled = await toggleFullscreen(); // no detail expression: it would toggle a second time
ok(toggled === false, 'Переключение без API ничего не ломает', String(toggled));
documentStub.documentElement.requestFullscreen = async () => {
  nativeElement = documentStub.documentElement;
};
documentStub.exitFullscreen = async () => {
  nativeElement = null;
};
ok(fullscreenAvailable() === true, 'С Fullscreen API переключатель доступен');
ok(fullscreenOn() === false, 'Изначально экран оконный');
toggled = await toggleFullscreen();
ok(toggled === true, 'Нативный запрос полного экрана сработал', String(toggled));
ok(fullscreenOn() === true, 'Экран стал полным');
toggled = await toggleFullscreen();
ok(toggled === false, 'Выход из полного экрана сработал', String(toggled));
ok(fullscreenOn() === false, 'Экран снова оконный');

// --- clipboard without the platform --------------------------------------------------------------
(g.navigator as { clipboard?: unknown }).clipboard = {
  writeText: async (value: string) => {
    records.push(`clipboard:${value}`);
  },
};
ok((await copyText('ВЫЖИВАНИЕ · счёт 10')) === true, 'Вне Яндекса работает navigator.clipboard');
ok(records.some((r) => r.startsWith('clipboard:ВЫЖИВАНИЕ')), 'Текст дошёл до буфера', records.join(' | '));
delete (g.navigator as { clipboard?: unknown }).clipboard;
ok((await copyText('резерв')) === true, 'Без navigator.clipboard срабатывает execCommand');
ok(records.includes('execCommand:copy'), 'execCommand(copy) вызван', records.join(' | '));

export { passed, failures };
