import * as THREE from 'three';
import { AIR, BEDROCK, DIRT, LOG, STONE } from '../../src/game/blocks';
import { MobSystem, type Mob } from '../../src/game/mobs';
import type { World } from '../../src/game/world';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const blocks = new Map<string, number>();
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const world = {
  get(x: number, y: number, z: number) {
    return blocks.get(key(x, y, z)) ?? AIR;
  },
  set(x: number, y: number, z: number, block: number) {
    if (block === AIR) blocks.delete(key(x, y, z));
    else blocks.set(key(x, y, z), block);
  },
} as unknown as World;
const system = new MobSystem(new THREE.Scene(), world);
const mob = (id: string) => ({ id, breaking: null }) as unknown as Mob;

blocks.set(key(0, 0, 0), DIRT);
const earlyZombie = mob('zombie');
ok(!system.tryBreakBlock(earlyZombie, 0, 0, 0, DIRT, 2, 2.3),
  'На раннем уровне зомби ещё не успевает сломать мягкий блок за 2,3 секунды');
ok(system.tryBreakBlock(earlyZombie, 0, 0, 0, DIRT, 2, 0.05),
  'На раннем уровне зомби ломает землю примерно за 3 секунды');
ok(world.get(0, 0, 0) === AIR, 'Сломанный блок удаляется из мира');

blocks.set(key(1, 0, 0), STONE);
const weakMob = mob('zombie');
ok(!system.tryBreakBlock(weakMob, 1, 0, 0, STONE, 2, 10),
  'На раннем уровне монстр не ломает камень даже при длительной попытке');
ok(world.get(1, 0, 0) === STONE, 'Запрещённый блок остаётся в мире');

blocks.set(key(2, 0, 0), LOG);
const midGameZombie = mob('zombie');
ok(!system.tryBreakBlock(midGameZombie, 2, 0, 0, LOG, 3, 3),
  'На среднем уровне зомби не ломает бревно быстрее заданного времени');
ok(system.tryBreakBlock(midGameZombie, 2, 0, 0, LOG, 3, 0.1),
  'На среднем уровне зомби ломает деревянные блоки');

blocks.set(key(3, 0, 0), STONE);
const lateGameSpider = mob('spider');
ok(!system.tryBreakBlock(lateGameSpider, 3, 0, 0, STONE, 6, 7),
  'На позднем уровне паук ломает камень медленнее зомби');
ok(system.tryBreakBlock(lateGameSpider, 3, 0, 0, STONE, 6, 0.2),
  'На позднем уровне камень в итоге разрушается');

blocks.set(key(4, 0, 0), BEDROCK);
const endGameZombie = mob('zombie');
ok(!system.tryBreakBlock(endGameZombie, 4, 0, 0, BEDROCK, 12, 100),
  'Коренная порода не разрушается даже на максимальном уровне угрозы');
ok(world.get(4, 0, 0) === BEDROCK, 'Коренная порода остаётся нетронутой');

export { passed, failures };
