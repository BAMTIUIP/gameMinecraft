/**
 * Off-Yandex half of the platform-events contract: without `window.YaGames` there is no `ysdk.on()`,
 * so nothing subscribes, the TV dialog never fires and an exit confirmation is refused instead of
 * crashing. The cloud sync hold must also be harmless outside the platform.
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

const { initYandex, yaDispatchExit, yaOnPlatformEvent, yaPlatformPaused } = await import('../../src/game/yandex');
const { confirmExit, dismissExit, exitPromptShown, onAccountSwitch, onExitPrompt, resetPlatformState, startPlatformEvents } = await import('../../src/game/platform');
const { flushProfile, markProfileDirty, pauseProfileSync, resyncProfile } = await import('../../src/game/profile');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
ok(yaPlatformPaused() === false, 'Без платформы игра не считается приостановленной');

startPlatformEvents();
const offEvent = yaOnPlatformEvent('HISTORY_BACK', () => undefined);
ok(typeof offEvent === 'function', 'Подписка вне платформы безопасна (возвращает функцию отписки)');
offEvent();
const offPrompt = onExitPrompt(() => undefined);
const offAccount = onAccountSwitch(() => undefined);
ok(!exitPromptShown(), 'Диалог выхода сам не появляется');
ok(yaDispatchExit() === false, 'Вне платформы dispatchEvent(EXIT) невозможен', String(yaDispatchExit()));
ok(confirmExit() === false, 'Подтверждение выхода вне платформы возвращает false');
dismissExit();
offPrompt();
offAccount();
resetPlatformState();

markProfileDirty();
pauseProfileSync(true);
ok((await flushProfile(true)) === false, 'Приостановка синхронизации вне платформы ничего не ломает');
pauseProfileSync(false);
ok((await resyncProfile()) === false, 'Пересинхронизация вне платформы сообщает, что облака нет');

export { passed, failures };
