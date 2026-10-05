/**
 * Requirement 1.6.3 on a TV: the remote sends one event at a time, so «некоторые действия»
 * (прыжки) must be automatic — arrows alone have to be enough to finish the game
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/6/3).
 *
 * The engine jumps by itself while the player walks forward: over a one-block step (that already
 * existed) and, since this test, out of a pit whose walls still leave room to rise. Before that a
 * player who fell into a two-block-deep hole had no key for a jump at all and the run was over.
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

const THREE = await import('three');
const { AIR, STONE } = await import('../../src/game/blocks');
const { Engine } = await import('../../src/game/engine');

/**
 * A world from a column map: `"x,z"` → the highest solid block index in that column. The player
 * stands at (0.5, feet, 0.5) facing -Z (yaw 0), so "ahead" is the column at x=0, z=-1.
 */
function makeEngine(columns: Record<string, number>, feet: number, ceiling?: number) {
  const top = (x: number, z: number) => columns[`${Math.floor(x)},${Math.floor(z)}`] ?? feet - 1;
  const world = {
    seed: 1,
    hasColumn: () => true,
    get(x: number, y: number, z: number) {
      if (y < 0) return STONE;
      if (y <= top(x, z)) return STONE;
      if (ceiling !== undefined && y >= ceiling) return STONE;
      return AIR;
    },
    set() {},
    topSolidY(x: number, z: number) {
      return top(x, z);
    },
  };
  const engine = Object.create(Engine.prototype) as unknown as Record<string, unknown>;
  Object.assign(engine, {
    world,
    pos: new THREE.Vector3(0.5, feet + 0.001, 0.5),
    vel: new THREE.Vector3(),
    yaw: 0,
    crawling: false,
    crawlYaw: 0,
    tv: true,
    onGround: true,
    mobSys: { mobs: [], showHealthBar() {}, collidesWithMob: () => false },
  });
  return engine as unknown as {
    tvStepAhead(): boolean;
    tvClimbAhead(): boolean;
    tvAutoJump(): boolean;
  };
}

// flat ground: nothing to climb, no wasted jumps
const flat = makeEngine({}, 6);
ok(!flat.tvAutoJump(), 'На ровной земле автопрыжок не срабатывает');

// a one-block step ahead: the pre-existing behaviour
const step = makeEngine({ '0,-1': 6 }, 6);
ok(step.tvStepAhead(), 'Шаг в один блок впереди распознаётся');
ok(step.tvAutoJump(), 'Одноблоковый шаг преодолевается автопрыжком');

// a two-block wall ahead: too tall for one jump, but the player's own column can rise
const wall = makeEngine({ '0,-1': 7, '0,0': 5 }, 6);
ok(!wall.tvStepAhead(), 'Двухблочная стена не считается шагом в один блок');
ok(wall.tvClimbAhead(), 'Но в своей колонне игроку есть куда подняться');
ok(wall.tvAutoJump(), 'Поэтому яма глубиной два блока преодолима без отдельной кнопки прыжка');

// the same wall with a ceiling right above the head: jumping would only bonk into stone
const capped = makeEngine({ '0,-1': 7, '0,0': 5 }, 6, 8);
ok(!capped.tvAutoJump(), 'Под низким потолком автопрыжок не срабатывает — иначе игрок упирается в камень');

// standing at the bottom of a three-block pit: repeated jumps climb out
const pit = makeEngine({ '0,0': 3, '0,-1': 5 }, 4);
ok(pit.tvClimbAhead(), 'Из ямы глубиной три блока тоже можно выбраться автопрыжками');

export { passed, failures };
