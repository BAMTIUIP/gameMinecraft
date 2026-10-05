/**
 * Requirement 1.9 for the sandbox: «прогресс сохраняется сразу после действия игрока»
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/9). In a voxel game the player's action is
 * mining and building, so the world must reach storage shortly after the last edit — not only when
 * the page is hidden, which is the one case a killed tab never reports.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { Engine } = await import('../../src/game/engine');

const DELAY = (Engine as unknown as { WORLD_AUTOSAVE_DELAY: number }).WORLD_AUTOSAVE_DELAY;
ok(DELAY > 0 && DELAY <= 5_000, 'Задержка автосохранения мира разумная', String(DELAY));

/** a stub engine carrying only what the autosave decision reads */
function makeEngine(sandbox: boolean, changedAt: number) {
  const engine = Object.create(Engine.prototype) as unknown as Record<string, unknown>;
  Object.assign(engine, { sandbox, worldChangedAt: changedAt });
  return engine as unknown as {
    worldAutosaveDue(now: number): boolean;
    saveWorld(silent?: boolean): boolean;
    markDirtyAt(x: number, z: number): void;
  };
}

const now = 1_000_000;

// nothing changed: no writes at all
ok(!makeEngine(true, 0).worldAutosaveDue(now + 10_000), 'Без изменений мира автосохранение не запускается');

// an edit a moment ago: wait, the player is still building
const fresh = makeEngine(true, now);
ok(!fresh.worldAutosaveDue(now + 100), 'Сразу после правки сохранения не происходит — игрок ещё строит');
ok(fresh.worldAutosaveDue(now + DELAY + 1), 'Через заданную задержку мир сохраняется');

// outside the sandbox the world is not the player's to keep
ok(!makeEngine(false, now).worldAutosaveDue(now + DELAY + 1), 'В обычном забеге автосохранение мира выключено');

// the write clears the stamp, so the next edit starts a new wait
const written = makeEngine(true, now);
ok(written.worldAutosaveDue(now + DELAY + 1), 'Перед записью мир считается требующим сохранения');
written.saveWorld(true);
ok(!written.worldAutosaveDue(now + DELAY + 1), 'После записи метка сбрасывается и повторных сохранений нет');

// an edit stamps the world: markDirtyAt is the terrain-edit hook
const edited = makeEngine(true, 0);
(edited as unknown as { dirtyChunks: Set<string> }).dirtyChunks = new Set<string>();
const before = performance.now();
edited.markDirtyAt(0, 0);
ok(
  (edited as unknown as { worldChangedAt: number }).worldChangedAt >= before,
  'Правка terrain отмечает мир как изменённый',
  String((edited as unknown as { worldChangedAt: number }).worldChangedAt),
);

export { passed, failures };
