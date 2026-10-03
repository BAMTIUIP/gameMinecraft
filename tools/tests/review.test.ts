/**
 * Unit test for the rating dialog (src/game/review.ts + the `ysdk.feedback` wrappers).
 *
 * The documentation sets two hard rules that this test pins down: the platform may be asked exactly
 * once per session, and `canReview()` must be called before `requestReview()` — otherwise the answer
 * comes back with «use canReview before requestReview». On top of that the game keeps its own week of
 * silence after the dialog was shown, so a player is not asked on every run.
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

let canReviewValue = true;
let canReviewReason: string | undefined;
let canReviewGate: Promise<void> | null = null;
let feedbackSent = true;
let requestThrows = false;

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
      feedback: {
        canReview: async () => {
          record('feedback.canReview');
          if (canReviewGate) await canReviewGate;
          return canReviewReason ? { value: canReviewValue, reason: canReviewReason } : { value: canReviewValue };
        },
        requestReview: async () => {
          record('feedback.requestReview');
          if (requestThrows) throw new Error('review window failed');
          return { feedbackSent };
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

// import AFTER the stubs: the modules read window/localStorage at call time, not at import time
const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const { requestGameReview, resetReviewState, reviewOffer } = await import('../../src/game/review');

await initYandex();
await startProfileSync();

// --- the platform allows it: the offer is available, and the answer is cached -------------------
const offer = await reviewOffer();
ok(offer.available === true && offer.reason === null, 'Платформа разрешила запросить оценку', JSON.stringify(offer));
ok(count('feedback.canReview') === 1, 'canReview() вызван один раз');
await reviewOffer();
ok(count('feedback.canReview') === 1, 'Повторная проверка берётся из кэша сессии');

// --- the dialog opens only from a user action ---------------------------------------------------
const result = await requestGameReview();
ok(result === 'sent', 'requestReview() вернул, что игрок оценил игру', result);
ok(count('feedback.requestReview') === 1, 'Диалог оценки открыт один раз');
const stampRaw = storage.get('orerush.review.v1');
ok(!!stampRaw, 'Факт запроса сохранён (чтобы не спрашивать снова)');
const stamp = JSON.parse(stampRaw ?? '{}') as { at?: number; sent?: boolean };
ok(typeof stamp.at === 'number' && stamp.sent === true, 'В хранилище записаны время и результат', stampRaw ?? '');

// --- the second request in the same session is rejected before reaching the platform -------------
const second = await requestGameReview();
ok(second === 'unavailable', 'Повторный запрос в той же сессии отклоняется игрой', second);
ok(count('feedback.requestReview') === 1, 'Платформа больше не тревожится (правило «один раз за сессию»)');
const offerAfter = await reviewOffer();
ok(offerAfter.available === false && offerAfter.reason === 'done', 'После запроса кнопка оценки больше не предлагается', JSON.stringify(offerAfter));

// --- a new session inside the quiet period: no offer, no platform call --------------------------
resetReviewState();
const quiet = await reviewOffer();
ok(quiet.available === false && quiet.reason === 'cooldown', 'В течение недели после запроса оценку не предлагают', JSON.stringify(quiet));
ok(count('feedback.canReview') === 1, 'При тишине платформа даже не опрашивается');

// --- a week later, but this player already rated the game ---------------------------------------
storage.set('orerush.review.v1', JSON.stringify({ at: Date.now() - 8 * 24 * 60 * 60 * 1000, sent: true }));
resetReviewState();
canReviewValue = false;
canReviewReason = 'GAME_RATED';
const rated = await reviewOffer();
ok(rated.available === false && rated.reason === 'GAME_RATED', 'Платформа называет причину отказа', JSON.stringify(rated));
ok(count('feedback.canReview') === 2, 'После тишины запрос к платформе повторяется');
const blocked = await requestGameReview();
ok(blocked === 'unavailable', 'Запрос оценки не отправляется без разрешения canReview()', blocked);
ok(count('feedback.requestReview') === 1, 'requestReview() без canReview не вызывается (требование документации)');

// --- an unauthorised player gets no button, only the reason -------------------------------------
resetReviewState();
canReviewReason = 'NO_AUTH';
const guest = await reviewOffer();
ok(guest.available === false && guest.reason === 'NO_AUTH', 'Неавторизованному оценку не предлагают', JSON.stringify(guest));

// --- the player closed the dialog: the game thanks politely and stays quiet ---------------------
storage.delete('orerush.review.v1');
resetReviewState();
canReviewValue = true;
canReviewReason = undefined;
feedbackSent = false;
const dismissed = await requestGameReview();
ok(dismissed === 'dismissed', 'Закрытый диалог — не ошибка, а обычный исход', dismissed);
ok(count('feedback.requestReview') === 2, 'Диалог действительно был показан');
const afterDismiss = await reviewOffer();
ok(afterDismiss.available === false, 'После закрытия диалога оценку больше не предлагают в этой сессии');

// --- a failure is silent, and does not poison the next session ----------------------------------
storage.delete('orerush.review.v1');
resetReviewState();
requestThrows = true;
const failed = await requestGameReview();
ok(failed === 'failed', 'Сбой платформы возвращает failed, а не исключение', failed);
ok(!storage.has('orerush.review.v1'), 'При сбое тишина не записывается — в следующей сессии можно попробовать снова');
requestThrows = false;
resetReviewState();
const retry = await reviewOffer();
ok(retry.available === true, 'В следующей сессии оценку снова можно предложить', JSON.stringify(retry));

// --- simultaneous taps cannot make duplicate platform requests ---------------------------------
storage.delete('orerush.review.v1');
resetReviewState();
feedbackSent = true;
let releaseCanReview!: () => void;
canReviewGate = new Promise<void>((resolve) => {
  releaseCanReview = resolve;
});
const canReviewCallsBeforeRace = count('feedback.canReview');
const requestCallsBeforeRace = count('feedback.requestReview');
const firstTap = requestGameReview();
const secondTap = requestGameReview();
releaseCanReview();
const [firstTapResult, secondTapResult] = await Promise.all([firstTap, secondTap]);
canReviewGate = null;
ok(firstTapResult === 'sent' && secondTapResult === 'sent', 'Пара одновременных кликов получает один результат');
ok(count('feedback.canReview') === canReviewCallsBeforeRace + 1, 'Параллельные клики делят одну проверку canReview()');
ok(count('feedback.requestReview') === requestCallsBeforeRace + 1, 'Параллельные клики открывают только один SDK-диалог');

export { passed, failures };
