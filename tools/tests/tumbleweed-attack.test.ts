import { Engine } from '../../src/game/engine';
import { MOBS } from '../../src/game/mobs';
import { HAND } from '../../src/game/recipes';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

// Exercise the real melee path with a lightweight engine shell: slot one contains only the bare hand,
// and the raycast returns a tumbleweed directly in front of the player.
const engine = Object.create(Engine.prototype) as any;
const tumbleweed = {
  id: 'tumbleweed',
  def: MOBS.tumbleweed,
  hp: MOBS.tumbleweed.hp,
  hurtFlash: 0,
  x: 0,
  y: 0,
  z: -1.5,
  vx: 0,
  vy: 0,
  vz: 0,
  onGround: false,
};
let deathCalls = 0;
engine.phase = 'playing';
engine.attackCd = 0;
engine.interactionReach = () => 4;
engine.eyeV = { x: 0, y: 1, z: 0 };
engine.dirV = { x: 0, y: 0, z: -1 };
engine.mobSys = { raycast: () => tumbleweed, showHealthBar: () => {} };
engine.mobReachDistance = () => 1;
engine.hotbar = [HAND];
engine.selected = 0;
engine.stats = { swift: 0, damage: 0, fire: 0, frost: 0, vamp: 0 };
engine.pos = { x: 0, y: 0, z: 0 };
engine.vel = { y: 0 };
engine.onGround = true;
engine.inWater = false;
engine.startSwing = () => {};
engine.burst = () => {};
engine.popup = () => {};
engine.addShake = () => {};
engine.playMobVoice = () => {};
engine.damageHeldTool = () => {};
engine.mobDied = (mob: { id: string }) => {
  if (mob.id === 'tumbleweed') deathCalls += 1;
};

ok(engine.heldKind() === 'fist', 'Пустая рука остаётся выбранным способом атаки');
ok(engine.tryAttack() === true, 'Атака рукой попадает по перекрёстной цели tumbleweed');
ok(tumbleweed.hp <= 0 && deathCalls === 1, 'Один удар рукой ломает tumbleweed');

export { passed, failures };
