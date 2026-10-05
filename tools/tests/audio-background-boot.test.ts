/**
 * Requirement 1.3, the boot case: «переключение на другую вкладку в том же окне браузера»
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/3). A player can open the game in a
 * background tab — a middle click, "open in new tab", restoring a session — and never focus it.
 * The document is hidden from the very first line of code, so the audio must start out held;
 * otherwise the menu theme would play into a tab nobody is looking at.
 *
 * This is a separate file on purpose: `document.hidden` is read once when src/game/audio.ts is
 * first evaluated, so the state has to be true before the import, not after.
 */

type Call = { name: string };
const calls: Call[] = [];
const record = (name: string) => calls.push({ name });
const count = (name: string) => calls.filter((c) => c.name === name).length;

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

const listeners = new Map<string, Array<() => void>>();
const addEventListener = (event: string, fn: () => void) => {
  listeners.set(event, [...(listeners.get(event) ?? []), fn]);
};
const fire = (target: 'window' | 'document', event: string) => {
  for (const fn of [...(listeners.get(event) ?? [])]) fn();
};

/** true while the tab is in the background; the player's switch flips it */
let documentHidden = true;

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
// the page is opened in a background tab: hidden before a single line of game code runs
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

/** the fake AudioContext: `running` until somebody suspends it */
let contextState = 'suspended';
class FakeContext {
  state = 'suspended';
  destination = {};
  createGain() {
    return { gain: { value: 0 }, connect() {} };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) };
  }
  get sampleRate() {
    return 8000;
  }
  async suspend() {
    record('ctx.suspend');
    contextState = 'suspended';
    this.state = 'suspended';
  }
  async resume() {
    record('ctx.resume');
    contextState = 'running';
    this.state = 'running';
  }
}
g.AudioContext = FakeContext;

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { audioSuspended, initAudio, resumeAudio, suspendAudio } = await import('../../src/game/audio');

initAudio();
ok(audioSuspended(), 'Игра, открытая в фоновой вкладке, сразу держит звук выключенным');
ok(count('ctx.resume') === 0, 'Звук не запускается, пока вкладка не видима');

// the player finally switches to the tab: only now may the sound come back
documentHidden = false;
fire('document', 'visibilitychange');
fire('window', 'focus');
ok(!audioSuspended(), 'Переход на вкладку включает звук');
ok(count('ctx.resume') === 1, 'Контекст возобновлён один раз', String(count('ctx.resume')));

// ...and the ordinary focus loss still works afterwards
fire('window', 'blur');
ok(audioSuspended(), 'После возврата обычная потеря фокуса снова глушит звук');
fire('window', 'focus');
ok(!audioSuspended(), 'И снова возвращает его');

// a tab that becomes visible while the window is still unfocused stays silent
fire('window', 'blur');
documentHidden = true;
fire('document', 'visibilitychange');
documentHidden = false;
fire('document', 'visibilitychange');
ok(audioSuspended(), 'Видимая вкладка без фокуса не включает звук сама');

// the holds stay independent: a game pause under a hidden document is not lifted by focus alone
suspendAudio();
fire('window', 'blur');
fire('window', 'focus');
ok(audioSuspended(), 'Удержание игры сильнее удержания фокуса');
resumeAudio();
ok(!audioSuspended(), 'Снятие удержания игры возвращает звук');

export { passed, failures };
