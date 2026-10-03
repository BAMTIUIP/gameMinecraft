/**
 * Unit test for requirement 1.3 — «При потере фокуса звук из игры останавливается»
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/3).
 *
 * The moderation check lists three situations: the window is minimised, another tab is chosen, the
 * browser's tab picker is open. All of them end with the same two signals — `blur` and a hidden
 * document — and the game holds its audio while any of them lasts. The holds are independent: an ad on
 * screen keeps the game silent even after focus returns, and returning to a background tab does not
 * unmute it behind the player's back.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string };

const calls: Call[] = [];
const record = (name: string) => calls.push({ name });
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

/** the events the game subscribes to, so the test can fire them like a browser would */
const listeners = new Map<string, Array<() => void>>();
const addEventListener = (event: string, fn: () => void) => {
  listeners.set(event, [...(listeners.get(event) ?? []), fn]);
};
const fire = (target: 'window' | 'document', event: string) => {
  for (const fn of [...(listeners.get(event) ?? [])]) fn();
};
let documentHidden = false;

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = {
  title: '',
  documentElement: { lang: '' },
  addEventListener,
  removeEventListener() {},
  get hidden() {
    return documentHidden;
  },
};
g.addEventListener = addEventListener;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
const sdkListeners = new Map<string, Array<() => void>>();
const emitSdkEvent = (event: string) => {
  for (const listener of [...(sdkListeners.get(event) ?? [])]) listener();
};
g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
    serverTime: () => Date.now(),
    on: (event: string, listener: () => void) => {
      sdkListeners.set(event, [...(sdkListeners.get(event) ?? []), listener]);
    },
  }),
};

/* --------------------------- AudioContext stub --------------------------- */

let contextState = 'suspended';
const gainStub = { gain: { value: 0, setTargetAtTime() {} }, connect() {} };
const bufferStub = { getChannelData: () => new Float32Array(8) };

class FakeAudioContext {
  get state() {
    return contextState;
  }
  get sampleRate() {
    return 48_000;
  }
  get currentTime() {
    return 0;
  }
  get destination() {
    return {};
  }
  createGain() {
    return gainStub;
  }
  createBuffer() {
    return bufferStub;
  }
  async suspend() {
    record('ctx.suspend');
    contextState = 'suspended';
  }
  async resume() {
    record('ctx.resume');
    contextState = 'running';
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
      detune: { value: 0 },
      connect() {},
      start() {},
      stop() {},
      onended: null as null | (() => void),
    };
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {}, stop() {}, onended: null as null | (() => void) };
  }
  createBiquadFilter() {
    return { type: 'lowpass', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 0 }, connect() {} };
  }
}

(g as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { audioSuspended, holdAudioForAd, initAudio, resumeAudio, setMuted, suspendAudio } = await import('../../src/game/audio');
const { initYandex, yaOnPause, yaOnResume } = await import('../../src/game/yandex');
await initYandex();
const offPlatformPause = yaOnPause(suspendAudio);
const offPlatformResume = yaOnResume(resumeAudio);

initAudio();
contextState = 'running'; // the player interacted: the menu theme is playing

// --- the window loses focus: sound stops ---------------------------------------------------------
fire('window', 'blur');
ok(count('ctx.suspend') === 1 && audioSuspended(), 'Потеря фокуса окна останавливает звук (blur → suspend)', String(count('ctx.suspend')));
ok(contextState === 'suspended', 'Аудиоконтекст действительно приостановлен', contextState);

// --- and comes back when the player returns ------------------------------------------------------
fire('window', 'focus');
ok(count('ctx.resume') === 1 && !audioSuspended(), 'Возврат фокуса возобновляет звук (focus → resume)', String(count('ctx.resume')));

// --- another tab is chosen -----------------------------------------------------------------------
documentHidden = true;
fire('document', 'visibilitychange');
ok(count('ctx.suspend') === 2 && audioSuspended(), 'Переключение вкладки останавливает звук', String(count('ctx.suspend')));
documentHidden = false;
fire('document', 'visibilitychange');
ok(count('ctx.resume') === 2 && !audioSuspended(), 'Возвращение на вкладку возобновляет звук', String(count('ctx.resume')));

// --- the tab picker: the window is blurred while the document stays visible -----------------------
fire('window', 'blur');
ok(audioSuspended(), 'Меню выбора вкладок (blur без hidden) держит звук выключенным');
fire('document', 'visibilitychange'); // visible does not mean focused: keep the independent blur hold
ok(audioSuspended(), 'Событие видимой вкладки не снимает удержание blur до focus');

// --- platform pause / engine pause hold independently -------------------------------------------
suspendAudio();
fire('window', 'focus');
ok(audioSuspended(), 'Пауза от игры не снимается возвратом фокуса', `hidden=${documentHidden}`);
resumeAudio();
ok(!audioSuspended(), 'Игра сняла свою паузу — звук вернулся', String(count('ctx.resume')));
const platformPauseBefore = count('ctx.suspend');
emitSdkEvent('game_api_pause');
ok(audioSuspended() && count('ctx.suspend') > platformPauseBefore, 'SDK game_api_pause приостанавливает звук');
const platformResumeBefore = count('ctx.resume');
emitSdkEvent('game_api_resume');
ok(!audioSuspended() && count('ctx.resume') > platformResumeBefore, 'SDK game_api_resume возобновляет звук');
offPlatformPause();
offPlatformResume();

// --- an ad holds the audio on its own ------------------------------------------------------------
holdAudioForAd(true);
ok(audioSuspended() && count('ctx.suspend') >= 3, 'Во время рекламы звук игры выключен', String(count('ctx.suspend')));
fire('window', 'focus');
ok(audioSuspended(), 'Возврат фокуса под рекламой не включает звук игры');
holdAudioForAd(false);
ok(!audioSuspended(), 'После закрытия рекламы звук игры возвращается');

// --- blur during an ad: releasing the ad does not unmute a hidden tab ----------------------------
holdAudioForAd(true);
fire('window', 'blur');
holdAudioForAd(false);
ok(audioSuspended(), 'После рекламы звук не возвращается, пока окно без фокуса');
fire('window', 'focus');
ok(!audioSuspended(), 'И только возврат фокуса включает его снова');

// --- muting by the player is not the same as holding ---------------------------------------------
const beforeMute = count('ctx.suspend');
setMuted(true);
ok(!audioSuspended() && count('ctx.suspend') === beforeMute, 'Кнопка «без звука» не трогает приостановку контекста', String(count('ctx.suspend') - beforeMute));
setMuted(false);

// --- a second initAudio() does not fight the state ------------------------------------------------
initAudio();
ok(!audioSuspended(), 'Повторная инициализация звука ничего не ломает');

export { passed, failures };
