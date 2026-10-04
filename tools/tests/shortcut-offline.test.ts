/** Off-Yandex shortcut contract: no platform prompt and no one-time supply bonus are claimed. */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
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

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const { requestShortcut, resetShortcutState, shortcutAccepted, shortcutOffer } = await import('../../src/game/shortcut');
const { pendingRewardedDropItems } = await import('../../src/game/adDrops');

const sdk = await initYandex();
ok(sdk === null, 'Outside Yandex Games, SDK initialization returns null');
await startProfileSync();

const offer = await shortcutOffer();
ok(!offer.available && offer.reason === 'offline', 'The shortcut is not offered offline', JSON.stringify(offer));
const result = await requestShortcut();
ok(result === 'unavailable', 'The shortcut prompt cannot open offline', result);
ok(!shortcutAccepted(), 'The shortcut is not marked accepted');
ok(!storage.has('orerush.shortcut.v1'), 'No shortcut acceptance state is stored offline');
ok(!pendingRewardedDropItems('next-run'), 'The shortcut supply bundle is not queued offline');
resetShortcutState();
ok((await shortcutOffer()).reason === 'offline', 'Resetting module state does not change the offline result');

export { passed, failures };
