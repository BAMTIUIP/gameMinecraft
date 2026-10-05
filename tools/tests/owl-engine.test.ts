/** Eagle owl companion flight/perching, water behavior, whistle care, fetching, coat variations, and dive attacks. */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const THREE = await import('three');
const { AIR, DIRT, STONE, WATER, WHEAT_SEEDS } = await import('../../src/game/blocks');
const { Engine } = await import('../../src/game/engine');
const { sfx } = await import('../../src/game/audio');
const { resetPetsForTests, unlockOwlPet } = await import('../../src/game/pets');
const { OWL_VARIANTS } = await import('../../src/game/owlVariants');
const { buildOwlCompanionBody } = await import('../../src/game/mobs');

let ceilingY: number | null = null;
let waterAtPlayer = false;
const solidCells = new Set<string>();
const world = {
  hasColumn: () => true,
  topSolidY: () => 5,
  get: (x: number, y: number, z: number) => {
    if (ceilingY !== null && y === ceilingY) return STONE;
    if (solidCells.has(`${x},${y},${z}`)) return STONE;
    if (waterAtPlayer && x === 0 && z === 0 && y === 6) return WATER;
    return y === 5 ? STONE : AIR;
  },
};

function makeEngine() {
  const engine = Object.create(Engine.prototype) as any;
  const popups: string[] = [];
  const collected: any[] = [];
  Object.assign(engine, {
    phase: 'playing',
    petOwned: true,
    petOwnedKinds: ['owl'],
    petTokenAvailable: true,
    petEquipped: false,
    petEquippedKind: null,
    petSelectedKind: 'owl',
    petCoatIndices: { wolf: 0, monkey: 0, parrot: 0, owl: 0 },
    petCoatIndex: 0,
    wolfPetRig: null,
    wolfPetLayer: new THREE.Group(),
    pos: new THREE.Vector3(0, 6.001, 0),
    vel: new THREE.Vector3(),
    yaw: 0,
    time: 1,
    playerSprinting: false,
    inWater: false,
    characterCustomization: { gender: 'boy' },
    crouchLerp: 0,
    crawlLerp: 0,
    swimLerp: 0,
    world,
    drops: [],
    inventory: new Map<number, number>(),
    hotbar: [WHEAT_SEEDS],
    selected: 0,
    target: null,
    mobSys: { mobs: [], showHealthBar() {} },
    syncHud() {},
    syncHotbar() {},
    popup(_x: number, _y: number, _z: number, message: string) { popups.push(message); },
    burst() {},
    mobDied(mob: any) { mob.alive = false; },
    collect(drop: any) {
      collected.push(drop);
      drop.active = false;
      drop.petCarried = false;
      if (engine.wolfPetRig?.carrying === drop) engine.wolfPetRig.carrying = null;
    },
  });
  return { engine, popups, collected };
}

const originalCreature = sfx.creature;
const originalUi = sfx.ui;
const originalPickup = sfx.pickup;
const voiceCalls: string[] = [];
(sfx as any).creature = (voice: string) => { if (voice === 'owl' || voice === 'bird') voiceCalls.push(voice); };
(sfx as any).ui = () => {};
(sfx as any).pickup = () => {};

try {
  resetPetsForTests();
  unlockOwlPet();
  ceilingY = null;
  waterAtPlayer = false;
  solidCells.clear();
  voiceCalls.length = 0;

  // Owl 3D model builder and plumage variants
  {
    ok(OWL_VARIANTS.length === 6, 'Eagle owl has 6 distinct plumage colorways');
    for (let i = 0; i < OWL_VARIANTS.length; i++) {
      const owlRig = buildOwlCompanionBody(i);
      ok(owlRig !== null && owlRig.group.children.length > 0, `buildOwlCompanionBody builds variant ${i} (${OWL_VARIANTS[i].id})`);
    }
  }

  // Obstacle avoidance in flight
  {
    const { engine } = makeEngine();
    engine.setPetEquipped('owl', true);
    const rig = engine.wolfPetRig;
    rig.group.position.set(0.5, 8.3, 0.5);
    const obstacle = '1,8,0';
    solidCells.add(obstacle);
    const destination = new THREE.Vector3(3.5, 8.3, 0.5);
    let remainedClear = true;
    for (let i = 0; i < 32 && rig.group.position.distanceTo(destination) > 0.22; i++) {
      engine.moveParrotFlight(rig, destination, 0.1, 5.0);
      remainedClear = remainedClear && engine.parrotFlightClear(rig.group.position.x, rig.group.position.y, rig.group.position.z);
    }
    ok(remainedClear, 'Obstacle-aware flight for owl never enters a solid voxel');
    ok(rig.group.position.distanceTo(destination) < 1.0, 'The eagle owl finds a curved or rising route past the obstacle');
    solidCells.clear();
  }

  // Equip creates the owl mesh and the stationary bird settles on shoulder.
  {
    const { engine, popups, collected } = makeEngine();
    ok(engine.setPetEquipped('owl', true), 'An owned eagle owl equips into the shared pet slot');
    ok(engine.cyclePetCoat('owl', 1) && engine.wolfPetRig.model.userData.variant === 1, 'The pet coat picker rebuilds the exact owl variant');
    const rig = engine.wolfPetRig;
    ok(rig?.kind === 'owl' && rig.group.userData.companion === 'owl-pet', 'The equipped pet is built from the shared owl model');
    const shoulder = engine.parrotShoulderPoint();
    ok(shoulder.x < 0 && shoulder.y > engine.pos.y + 1.2, 'The idle perch is on the character’s left shoulder, outside the head centerline');
    ok(engine.parrotFollowPoint().y > engine.pos.y + 2.45, 'Free follow flight keeps the owl higher above the player');
    engine.updateParrotPet(rig, 0.4);
    ok(rig.parrotMode === 'shoulder' && !rig.swimming, 'An idle eagle owl perches on the shoulder and never enters swimming state');
    ok(rig.legs[0].rotation.z > 0.9 && rig.legs[1].rotation.z < -0.9 && rig.legs[0].scale.x < 0.8 && rig.legs[1].scale.x < 0.8, 'A shoulder-perched owl lowers and tucks its wings against its body');
    ok(rig.yawTarget === engine.yaw, 'A shoulder-perched owl faces the same direction as the player');

    // Cave low clearance
    ceilingY = 8;
    engine.vel.set(0, 0, -3);
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'shoulder' && !rig.moving, 'Low cave clearance makes the owl perch instead of clipping its wings');
    engine.whistleParrot();
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'shoulder' && engine.parrotFlightClear(rig.group.position.x, rig.group.position.y, rig.group.position.z), 'A whistle in a cramped cave waits on the shoulder instead of clipping through a roof');
    rig.parrotCalled = false;

    // Open air follow
    ceilingY = null;
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'follow' && rig.moving && !rig.swimming, 'The eagle owl flies after a moving player without swimming');
    ok(rig.group.position.z > engine.pos.z - 0.2, 'With the player facing forward, the owl follows from behind');

    // Water hover
    engine.vel.set(0, 0, 0);
    engine.inWater = true;
    waterAtPlayer = true;
    const waterHoverPoint = engine.parrotWaterHoverPoint();
    engine.updateParrotPet(rig, 0.1);
    for (let i = 0; i < 3; i++) engine.updateParrotPet(rig, 0.1);
    ok(!rig.swimming && rig.group.position.y > engine.pos.y + 2.3 && waterHoverPoint.y > engine.pos.y + 2.3, 'The eagle owl smoothly settles higher in clear air above a submerged player');
    const firstWaterOrbit = rig.group.position.clone();
    engine.time += 0.8;
    engine.updateParrotPet(rig, 0.1);
    ok(Math.hypot(rig.group.position.x - firstWaterOrbit.x, rig.group.position.z - firstWaterOrbit.z) > 0.1, 'Above water the owl gently circles instead of staying fixed on one point');
    engine.whistleParrot();
    engine.updateParrotPet(rig, 0.1);
    ok(!rig.parrotCalled && rig.parrotMode === 'follow' && rig.group.position.y > engine.pos.y + 2.3, 'Water overrides a hand call and keeps the owl high above the player');

    // Whistle to hand & interact (feeding and petting)
    engine.inWater = false;
    waterAtPlayer = false;
    engine.vel.set(0, 0, 0);
    ok(engine.whistleParrot() && rig.parrotCalled, 'The whistle calls the equipped eagle owl');
    for (let i = 0; i < 5; i++) engine.updateParrotPet(rig, 0.1);
    const leftHand = engine.parrotHandPoint();
    ok(leftHand.x < 0 && leftHand.z < -0.6, 'The whistle perch is extended forward from the character’s left hand');
    ok(rig.parrotMode === 'hand' && engine.petInteractionAvailable(), 'After the whistle the owl settles on the left fingertips and becomes interactable');
    ok(rig.legs[0].rotation.z > 0.9 && rig.legs[1].rotation.z < -0.9 && rig.legs[0].scale.x < 0.8 && rig.legs[1].scale.x < 0.8, 'A hand-perched owl lowers and tucks its wings against its body');

    engine.inventory.set(WHEAT_SEEDS, 2);
    engine.hotbar[0] = WHEAT_SEEDS;
    ok(engine.interact() && engine.inventory.get(WHEAT_SEEDS) === 1 && rig.parrotEatTimer > 0, 'E feeds the hand-perched owl and consumes one wheat seed');
    engine.hotbar[0] = DIRT;
    ok(engine.interact() && engine.inventory.get(WHEAT_SEEDS) === 1 && rig.parrotHappyTimer > 0, 'E pets the eagle owl when seeds are not selected');
    ok(popups.some((message) => message.includes('eats')) && popups.some((message) => message.includes('stroke')), 'Feeding and petting both provide interaction feedback');

    // Walking / takeoff from hand perch
    engine.playerSprinting = false;
    engine.vel.set(1, 0, 0);
    engine.updateParrotPet(rig, 0.1);
    ok(!rig.parrotCalled && rig.parrotMode === 'follow' && rig.moving, 'Walking ends the hand perch and makes the owl take off');
    ok(rig.legs[0].rotation.z < 0 && rig.legs[1].rotation.z > 0 && rig.legs[0].scale.x > 0.95 && rig.legs[1].scale.x > 0.95, 'The owl spreads its wings again when it becomes airborne');

    // Fetching loose resources
    engine.playerSprinting = false;
    engine.vel.set(0, 0, 0);
    engine.mobSys.mobs = [];
    const drop = { active: true, id: DIRT, x: 4.1, y: 6.15, z: 2.3, vx: 0, vy: 0, vz: 0, age: 1, mesh: { visible: true }, clearance: 0.2 };
    engine.drops.push(drop);
    for (let i = 0; i < 40 && drop.active; i++) {
      engine.updateParrotPet(rig, 0.1);
      engine.time += 0.1;
    }
    ok(collected.includes(drop) && !drop.active, 'The flying eagle owl picks up and delivers a loose resource');

    // Combat dive attacks
    const monster = { alive: true, hidden: false, def: { hostile: true }, x: 0, y: 6.001, z: -3, hp: 50, vx: 0, vy: 0, vz: 0, hurtFlash: 0, onGround: true };
    engine.mobSys.mobs = [monster];
    const hpBefore = monster.hp;
    for (let i = 0; i < 55; i++) {
      engine.updateParrotPet(rig, 0.1);
      engine.time += 0.1;
    }
    ok(monster.hp < hpBefore, 'The eagle owl repeatedly dive-attacks nearby monsters');
    ok(voiceCalls.some((voice) => voice === 'owl'), 'Owl calls, feeding, petting and attacks use owl hoot sounds');

    ok(engine.setPetEquipped('owl', false) && !engine.petEquipped && engine.wolfPetRig === null, 'Unequipping removes the owl rig and returns its token');
  }
} finally {
  solidCells.clear();
  (sfx as any).creature = originalCreature;
  (sfx as any).ui = originalUi;
  (sfx as any).pickup = originalPickup;
}

export { passed, failures };
