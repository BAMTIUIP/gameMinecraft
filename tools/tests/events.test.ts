/**
 * Unit test for the platform events (src/game/platform.ts + the wrappers in src/game/yandex.ts),
 * https://yandex.ru/dev/games/doc/ru/sdk/sdk-events.
 *
 * What the page requires and this test pins down:
 *  - `game_api_pause` / `game_api_resume` reach the game and are reported by `yaPlatformPaused()`
 *    (the startup full-screen ad has no callback of its own, only this pair);
 *  - `HISTORY_BACK` (TV) opens the game's own dialog and does **not** leave the game; `EXIT` is sent
 *    with `ysdk.dispatchEvent()` only after the player confirms;
 *  - `ACCOUNT_SELECTION_DIALOG_*` holds the cloud sync back while the player picks a save, and after
 *    the dialog closes the player and the cloud progress are requested again;
 *  - subscriptions made with `on()` can be removed with `off()`.
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

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

/** live subscriptions, as the real SDK keeps them: on() adds, off() removes */
const sdkListeners = new Map<string, Array<(payload?: unknown) => void>>();
const emit = (event: string, payload?: unknown) => {
  for (const listener of [...(sdkListeners.get(event) ?? [])]) listener(payload);
};

/** the cloud blob the platform hands back; the test swaps it to imitate another account */
let cloudBlob: Record<string, unknown> = {};
let playerFetches = 0;

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async (keys?: string[]) => {
    record('player.getData', keys ?? null);
    return { ...cloudBlob };
  },
  setData: async (data: Record<string, unknown>, flush?: boolean) => {
    record('player.setData', { keys: Object.keys(data), flush: flush ?? false });
    Object.assign(cloudBlob, data);
  },
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
      getPlayer: async () => {
        playerFetches += 1;
        record('ysdk.getPlayer');
        return player;
      },
      getStorage: async () => localStorageStub,
      features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
      on: (event: string, listener: (payload?: unknown) => void) => {
        record('ysdk.on', event);
        sdkListeners.set(event, [...(sdkListeners.get(event) ?? []), listener]);
      },
      off: (event: string, listener: (payload?: unknown) => void) => {
        record('ysdk.off', event);
        sdkListeners.set(event, (sdkListeners.get(event) ?? []).filter((cb) => cb !== listener));
      },
      dispatchEvent: (event: string) => {
        record('ysdk.dispatchEvent', event);
        return Promise.resolve();
      },
      EVENTS: {
        EXIT: 'EXIT',
        HISTORY_BACK: 'HISTORY_BACK',
        ACCOUNT_SELECTION_DIALOG_OPENED: 'ACCOUNT_SELECTION_DIALOG_OPENED',
        ACCOUNT_SELECTION_DIALOG_CLOSED: 'ACCOUNT_SELECTION_DIALOG_CLOSED',
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

const { initYandex, yaOnMultiplayer, yaOnPause, yaOnPlatformEvent, yaOnResume, yaPlatformPaused } = await import('../../src/game/yandex');
const { confirmExit, dismissExit, exitPromptShown, onAccountSwitch, onExitPrompt, resetPlatformState, startPlatformEvents } = await import('../../src/game/platform');
const { flushProfile, getDiamonds, markProfileDirty, pauseProfileSync, resyncProfile } = await import('../../src/game/profile');

await initYandex();

// --- pause / resume: the pair the startup ad is made of -----------------------------------------
const seen: string[] = [];
const offPause = yaOnPause(() => seen.push('pause'));
const offResume = yaOnResume(() => seen.push('resume'));
ok(yaPlatformPaused() === false, 'До событий платформа не держит игру');
emit('game_api_pause');
ok(yaPlatformPaused() === true, 'game_api_pause помечает игру приостановленной');
emit('game_api_resume');
ok(yaPlatformPaused() === false, 'game_api_resume снимает приостановку');
ok(seen.join(',') === 'pause,resume', 'Подписчики паузы и возобновления получили события', seen.join(','));
offPause();
offResume();
emit('game_api_pause');
emit('game_api_resume');
ok(seen.length === 2, 'После отписки обработчики не вызываются', seen.join(','));

// --- HISTORY_BACK: the game's own dialog instead of a silent exit -------------------------------
const stopPlatformEvents = startPlatformEvents();
ok(count('ysdk.on') >= 4, 'Игра подписалась на платформенные события через on()', String(count('ysdk.on')));
const eventSubscriptionsBefore = count('ysdk.on');
const eventUnsubscriptionsBefore = count('ysdk.off');
const offExtraHistoryListener = yaOnPlatformEvent('HISTORY_BACK', () => undefined);
offExtraHistoryListener();
ok(
  count('ysdk.on') === eventSubscriptionsBefore && count('ysdk.off') === eventUnsubscriptionsBefore,
  'Общий SDK-listener остаётся, пока на событие есть другие игровые подписчики',
);
const prompts: number[] = [];
const offPrompt = onExitPrompt(() => prompts.push(Date.now()));
emit('HISTORY_BACK');
ok(prompts.length === 1 && exitPromptShown() === true, 'Кнопка «Назад» открывает диалог игры', JSON.stringify(prompts));
ok(count('ysdk.dispatchEvent') === 0, 'Сам по себе HISTORY_BACK выход не подтверждает');
dismissExit();
ok(exitPromptShown() === false, '«Остаться» закрывает диалог');
emit('HISTORY_BACK');
ok(confirmExit() === true, '«Выйти» подтверждает выход');
ok(exitPromptShown() === false, 'После подтверждения диалог закрыт');
const exitCall = calls.filter((c) => c.name === 'ysdk.dispatchEvent').at(-1);
ok(exitCall?.arg === 'EXIT', 'Платформе отправлен ysdk.dispatchEvent(EXIT)', JSON.stringify(exitCall));
offPrompt();
emit('HISTORY_BACK');
ok(prompts.length === 2, 'После отписки диалог больше не открывается', JSON.stringify(prompts.length));

// --- account picker: sync on hold, then the chosen progress is re-read ---------------------------
const phases: string[] = [];
let accountResync: Promise<boolean> | null = null;
const offAccount = onAccountSwitch((phase) => {
  phases.push(phase);
  if (phase === 'opened') pauseProfileSync(true);
  else accountResync = resyncProfile().finally(() => pauseProfileSync(false));
});
markProfileDirty({ name: 'UNSAVED OLD ACCOUNT' });
emit('ACCOUNT_SELECTION_DIALOG_OPENED');
ok(phases.join(',') === 'opened', 'Открытие диалога выбора аккаунта доходит до игры', phases.join(','));
const writesWhileOpen = count('player.setData');
const flushedWhileOpen = await flushProfile(true);
ok(flushedWhileOpen === false, 'Во время выбора аккаунта запись в облако не проходит');
ok(count('player.setData') === writesWhileOpen, 'Во время диалога ничего не отправлено', String(count('player.setData')));

// The selected account has its own save. Re-read it before releasing the old account's queued writes.
cloudBlob = { 'orerush.profile': { v: 1, savedAt: Date.now() + 60_000, diamonds: 500, totals: { bestScore: 4000 } } };
const readsBefore = count('player.getData');
const playerFetchesBefore = playerFetches;
emit('ACCOUNT_SELECTION_DIALOG_CLOSED');
await accountResync;
ok(phases.join(',') === 'opened,closed', 'Закрытие диалога доходит до игры', phases.join(','));
ok(playerFetches > playerFetchesBefore, 'После смены аккаунта заново получен объект Player (getPlayer)', `${playerFetchesBefore} → ${playerFetches}`);
ok(count('player.getData') > readsBefore, 'Прогресс запрошен заново (player.getData)', String(count('player.getData') - readsBefore));
ok(getDiamonds() === 500, 'Принят прогресс выбранного аккаунта (алмазы из облака)', String(getDiamonds()));
const writesAfterResync = count('player.setData');
await flushProfile(true);
ok(count('player.setData') === writesAfterResync, 'Старый queued-профиль не отправляется в выбранный аккаунт');
offAccount();

// --- on()/off() in pairs for the multiplayer subscription ---------------------------------------
const events: string[] = [];
const offMultiplayer = yaOnMultiplayer({ transaction: (data) => events.push(data.opponentId) });
emit('multiplayer-sessions-transaction', { opponentId: 'opp-1', transactions: [] });
ok(events.join(',') === 'opp-1', 'Подписка на события мультиплеера работает', events.join(','));
offMultiplayer();
ok(count('ysdk.off') >= 2, 'Отписка вызывает ysdk.off()', String(count('ysdk.off')));
emit('multiplayer-sessions-transaction', { opponentId: 'opp-2', transactions: [] });
ok(events.length === 1, 'После отписки события мультиплеера не приходят', events.join(','));

// --- the full teardown used by tests ------------------------------------------------------------
const offBeforePlatformStop = count('ysdk.off');
stopPlatformEvents();
ok(count('ysdk.off') >= offBeforePlatformStop + 3, 'При остановке пары on()/off() снимают подписки платформенных событий');
resetPlatformState();
ok(exitPromptShown() === false, 'Сброс состояния платформы не оставляет висящих диалогов');

export { passed, failures };
