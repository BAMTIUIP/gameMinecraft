/**
 * The no-Web-Audio half of requirement 1.3: a browser without the AudioContext API must not break the
 * game, and the audio holds (including the focus hold) must stay harmless no-ops.
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

const listeners = new Map<string, Array<() => void>>();
const addEventListener = (event: string, fn: () => void) => {
  listeners.set(event, [...(listeners.get(event) ?? []), fn]);
};
const fire = (event: string) => {
  for (const fn of [...(listeners.get(event) ?? [])]) fn();
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener, removeEventListener() {}, hidden: false };
g.addEventListener = addEventListener;
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
// deliberately no AudioContext / webkitAudioContext

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { audioSuspended, holdAudioForAd, initAudio, isMuted, resumeAudio, suspendAudio } = await import('../../src/game/audio');
const { markAdSessionStart, showFullscreenAd } = await import('../../src/game/ads');
const { initYandex } = await import('../../src/game/yandex');

await initYandex();
initAudio(); // must not throw without the API
ok(!isMuted(), 'Без Web Audio игра считает себя не заглушённой');
fire('blur');
ok(audioSuspended(), 'Событие потери фокуса без звуковой системы безопасно');
fire('focus');
ok(!audioSuspended(), 'Возврат фокуса без звуковой системы безопасен');
suspendAudio();
resumeAudio();
holdAudioForAd(true);
holdAudioForAd(false);
ok(!audioSuspended(), 'Обе защёлки снимаются без ошибок');
markAdSessionStart();
const skipped = await showFullscreenAd();
ok(skipped.skipped === 'offline', 'Реклама вне платформы по-прежнему тихий no-op', JSON.stringify(skipped));

export { passed, failures };
