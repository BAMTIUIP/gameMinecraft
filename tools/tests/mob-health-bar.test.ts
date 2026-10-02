import * as THREE from 'three';
import { MobSystem, type Mob } from '../../src/game/mobs';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const scene = new THREE.Scene();
const system = new MobSystem(scene, {} as never);
const mob = {
  def: { scale: 1 },
  modelSize: 1,
  group: new THREE.Group(),
  hp: 5,
  maxHp: 10,
  healthBarBack: null,
  healthBarFill: null,
  healthBarTimer: 0,
} as unknown as Mob;

system.showHealthBar(mob);
ok(mob.healthBarBack?.visible === true && mob.healthBarFill?.visible === true, 'После попадания появляются фон и заполнение полоски HP');
ok(mob.healthBarTimer === 3.2, 'Полоска остаётся видимой несколько секунд после удара');
ok(Math.abs((mob.healthBarFill?.scale.x ?? 0) - 0.41) < 1e-9, 'Заполнение показывает актуальные 50% здоровья');
ok((mob.healthBarFill?.material as THREE.SpriteMaterial).color.getHexString() === 'f2c14e', 'Половина здоровья подсвечивается предупреждающим цветом');

mob.hp = 2;
system.showHealthBar(mob);
ok(Math.abs((mob.healthBarFill?.scale.x ?? 0) - 0.164) < 1e-9, 'Повторный удар обновляет долю оставшегося HP');
ok((mob.healthBarFill?.material as THREE.SpriteMaterial).color.getHexString() === 'e95c55', 'Низкое здоровье подсвечивается красным цветом');

export { passed, failures };
