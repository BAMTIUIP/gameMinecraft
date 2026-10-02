/**
 * Off-Yandex half of the leaderboard contract: without `window.YaGames` there is no
 * `ysdk.leaderboards`, so the game must keep working with its own local table — the panel hides the
 * world tab, nothing is submitted, nothing throws. A crash here would break the itch / own-hosting
 * build, where the whole ranking section simply does not exist.
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });
// deliberately no YaGames global

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { initYandex } = await import('../../src/game/yandex');
const { startProfileSync } = await import('../../src/game/profile');
const {
  formatLeaderboardScore,
  leaderboardAvailable,
  leaderboardCooldownLeft,
  leaderboardTitle,
  loadLeaderboard,
  loadMyRank,
  submitLeaderboardScore,
} = await import('../../src/game/leaderboard');

const sdk = await initYandex();
ok(sdk === null, 'Вне Яндекс Игр SDK не инициализируется (initYandex → null)');
await startProfileSync();
ok(!leaderboardAvailable(), 'Лидерборды вне платформы недоступны');
ok((await loadLeaderboard()) === null, 'Список лидерборда вне Яндекса не запрашивается');
ok((await loadMyRank()) === null, 'Место в рейтинге вне Яндекса не запрашивается');
ok((await submitLeaderboardScore(9999)) === 'skipped', 'Результат вне Яндекса не отправляется');
ok(leaderboardCooldownLeft() === 0, 'Кулдаун вне Яндекса не блокирует интерфейс');
ok(leaderboardTitle(null).length > 0, 'Запасное название рейтинга доступно и без Консоли', leaderboardTitle(null));
ok(formatLeaderboardScore(4200, null).replace(/\D/g, '') === '4200', 'Форматирование счёта работает без описания из Консоли');

export { passed, failures };
