/**
 * Unit test for the desktop-shortcut dialog (src/game/shortcut.ts + `ysdk.shortcut` wrappers).
 *
 * The documentation's order is mandatory: `shortcut.canShowPrompt()` first, then `showPrompt()`, and a
 * reward may be paid when `outcome === 'accepted'`. Availability depends on the device and the browser,
 * so the button has to stay hidden whenever the platform says no. On top of that the game keeps a
 * two-week silence after the dialog was shown and pays the thank-you exactly once.
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru', userActivation: { isActive: true } }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

let canShow = true;
let outcome = 'accepted';
let showThrows = false;

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

const stats: Record<string, number> = {};

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
      shortcut: {
        canShowPrompt: async () => {
          record('shortcut.canShowPrompt');
          return { canShow };
        },
        showPrompt: async () => {
          record('shortcut.showPrompt');
          if (showThrows) throw new Error('shortcut dialog failed');
          return { outcome };
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

// counters of the profile module live in the module itself, so the balance is read through getDiamonds()
const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync, getDiamonds, bumpStats, flushProfile } = await import('../../src/game/profile');
const { SHORTCUT_REWARD, requestShortcut, resetShortcutState, shortcutAccepted, shortcutOffer } = await import('../../src/game/shortcut');

await initYandex();
await startProfileSync();
const startBalance = getDiamonds();

// --- the platform can show the dialog: the offer is available and cached ------------------------
const offer = await shortcutOffer();
ok(offer.available === true, 'Платформа разрешила показать окно ярлыка', JSON.stringify(offer));
ok(count('shortcut.canShowPrompt') === 1, 'canShowPrompt() вызван один раз');
await shortcutOffer();
ok(count('shortcut.canShowPrompt') === 1, 'Повторная проверка берётся из кэша сессии');

// --- the dialog opens only from a call the game makes on a user action --------------------------
ok(!shortcutAccepted(), 'До диалога ярлык не считается добавленным');
const accepted = await requestShortcut();
ok(accepted === 'accepted', 'showPrompt() вернул accepted', accepted);
ok(count('shortcut.showPrompt') === 1, 'Окно ярлыка открыто один раз');
ok(shortcutAccepted(), 'Факт добавления ярлыка сохранён');
ok(getDiamonds() === startBalance + SHORTCUT_REWARD, 'За ярлык начислена награда', `${startBalance} → ${getDiamonds()}`);
const saved = JSON.parse(storage.get('orerush.shortcut.v1') ?? '{}') as { at?: number; accepted?: boolean };
ok(typeof saved.at === 'number' && saved.accepted === true, 'Состояние ярлыка записано в хранилище', storage.get('orerush.shortcut.v1') ?? '');
await flushProfile(true);
ok((stats.diamondsBought ?? 0) === 0, 'Подарок не попал в статистику покупок (diamondsBought)', JSON.stringify(stats));

// --- a second call in the same session never reaches the platform -------------------------------
const again = await requestShortcut();
ok(again === 'unavailable' && count('shortcut.showPrompt') === 1, 'Повторный вызов не открывает окно снова', again);
const offerAfter = await shortcutOffer();
ok(offerAfter.available === false && offerAfter.reason === 'done', 'После диалога кнопка больше не предлагается', JSON.stringify(offerAfter));

// --- a new session: the player already has the shortcut, so there is nothing to offer -----------
resetShortcutState();
const later = await shortcutOffer();
ok(later.available === false && later.reason === 'accepted', 'Тем, у кого ярлык уже есть, его не предлагают', JSON.stringify(later));
ok(count('shortcut.canShowPrompt') === 1, 'Платформа даже не опрашивается');

// --- the dialog was closed: quiet for two weeks, then the offer may return ----------------------
storage.set('orerush.shortcut.v1', JSON.stringify({ at: Date.now(), accepted: false }));
resetShortcutState();
const quiet = await shortcutOffer();
ok(quiet.available === false && quiet.reason === 'cooldown', 'Две недели после закрытого окна ярлык не предлагают', JSON.stringify(quiet));

storage.set('orerush.shortcut.v1', JSON.stringify({ at: Date.now() - 15 * 24 * 60 * 60 * 1000, accepted: false }));
resetShortcutState();
const back = await shortcutOffer();
ok(back.available === true, 'Через две недели предложение возвращается', JSON.stringify(back));

// --- the device cannot add a shortcut: no button -------------------------------------------------
resetShortcutState();
canShow = false;
const unsupported = await shortcutOffer();
ok(unsupported.available === false, 'Если устройство не умеет ярлыки, кнопки нет', JSON.stringify(unsupported));
ok((await requestShortcut()) === 'unavailable', 'Без разрешения canShowPrompt окно не открывается');
ok(count('shortcut.showPrompt') === 1, 'showPrompt() без проверки не вызывается (требование документации)');

// --- a closed dialog is a normal outcome, and the reward is not paid ----------------------------
storage.delete('orerush.shortcut.v1');
resetShortcutState();
canShow = true;
outcome = 'dismissed';
const balanceBefore = getDiamonds();
const dismissed = await requestShortcut();
ok(dismissed === 'dismissed', 'Закрытое окно — обычный исход, а не ошибка', dismissed);
ok(getDiamonds() === balanceBefore, 'Без добавления ярлыка награда не начисляется', String(getDiamonds()));
ok(!shortcutAccepted(), 'Закрытое окно не считается добавлением');

// --- a failure is silent and allows a retry next session ----------------------------------------
storage.delete('orerush.shortcut.v1');
resetShortcutState();
showThrows = true;
const failed = await requestShortcut();
ok(failed === 'failed', 'Сбой платформы возвращает failed, а не исключение', failed);
ok(!storage.has('orerush.shortcut.v1'), 'При сбое состояние не записывается');
showThrows = false;
resetShortcutState();
ok((await shortcutOffer()).available === true, 'В следующей сессии предложение снова доступно');

// --- the reward is paid once even if the platform returns accepted twice ------------------------
storage.set('orerush.shortcut.v1', JSON.stringify({ at: 0, accepted: true }));
resetShortcutState();
const balanceBeforeSecond = getDiamonds();
const repeated = await requestShortcut();
ok(repeated === 'unavailable', 'Уже добавленный ярлык повторно не предлагается', repeated);
ok(getDiamonds() === balanceBeforeSecond, 'Награда не начисляется дважды', String(getDiamonds()));

bumpStats({ runs: 0 }); // keep the stats object touched, as other suites do

export { passed, failures };
