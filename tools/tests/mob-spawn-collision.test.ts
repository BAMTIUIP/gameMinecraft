import * as THREE from 'three';
import { AIR, STONE } from '../../src/game/blocks';
import { MobSystem } from '../../src/game/mobs';
import type { World } from '../../src/game/world';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const world = {
  hasColumn: () => true,
  topSolidY: () => 2,
  get(x: number, y: number, z: number) {
    if (y <= 2) return STONE;
    if (x === 6 && y <= 6 && z === 0) return STONE;
    return AIR;
  },
  isWinter: () => false,
  biomeAt: () => 'plains',
  getHeight: () => 2,
} as unknown as World;

const system = new MobSystem(new THREE.Scene(), world);
const pig = system.spawn('pig', 0.5, 3, 0.5);
ok(pig !== null, 'Свободное место принимает первое животное');
ok(system.spawn('sheep', 0.5, 3, 0.5) === null, 'Прямой спавн животного отклоняет уже занятую точку');
ok(system.spawn('bee', 0.5, 3, 0.5) === null, 'Насекомое не появляется внутри другого существа');
ok(system.spawn('creeper', 0.5, 3, 0.5) === null, 'Монстр не появляется в занятом месте');
ok(system.findSpawnPoint(0.5, 0.5, 0, 0, null, undefined, 'rabbit') === null,
  'Поиск точки спавна не возвращает фиксированную занятую позицию');

const remoteAnimal = system.spawn('cow', 4.5, 3, 0.5);
ok(remoteAnimal !== null, 'Разнесённое животное успешно появляется');
const pigHalf = pig ? system.mobHalf(pig) : 0;
const pigHeight = pig ? system.mobHeight(pig) : 0;
ok(!!pig && system.collidesWithMob(pig.x + pigHalf + 0.1, pig.y, pig.z, 0.2, 0.2, 1.2),
  'AABB-коллизия обнаруживает животное на пути персонажа');
ok(!!pig && !system.collidesWithMob(pig.x + pigHalf + 0.6, pig.y, pig.z, 0.2, 0.2, 1.2),
  'AABB-коллизия не блокирует свободное место рядом с животным');
ok(!!pig && system.collidesAlongMobPath(
  pig.x - pigHalf - 0.6, pig.y, pig.z,
  pig.x + pigHalf + 0.6, pig.y, pig.z,
  0.1, 0.1, 1.2,
), 'Подшаги обнаруживают животное даже если между стартом и концом большой проход');
ok(!!pig && pigHeight > 0 && !system.canSpawnAt('zombie', 6.5, 3, 0.5),
  'Спавн блокируется твёрдой стеной, если габарит монстра её задевает');
ok(!!pig && system.canSpawnAt('zombie', 10.5, 3, 0.5),
  'Спавн разрешён в свободном, разнесённом от животных месте');

const sameBee = new MobSystem(new THREE.Scene(), world);
const bee = sameBee.spawn('bee', 12.5, 3, 0.5);
ok(bee !== null && sameBee.spawn('bee', 12.5, 3, 0.5) === null,
  'Пчёлы с одинаковой точкой-цветком не складываются друг на друга');
const sameFish = new MobSystem(new THREE.Scene(), world);
const fish = sameFish.spawn('fish', 16.5, 3, 0.5, 4);
ok(fish !== null && sameFish.spawn('fish', 16.5, 3, 0.5, 4) === null,
  'Водные существа также не дублируются в одной точке');

const otherBody = pig ? {
  x: pig.x + pigHalf + 0.1,
  y: pig.y,
  z: pig.z,
  halfX: 0.3,
  halfZ: 0.3,
  height: 1.8,
} : undefined;
ok(!!pig && !!otherBody && system.collidesWithMob(
  pig.x,
  pig.y,
  pig.z,
  pigHalf,
  pigHalf,
  pigHeight,
  pig,
  0,
  otherBody,
), 'Существа учитывают AABB игрока при собственном перемещении');

export { passed, failures };
