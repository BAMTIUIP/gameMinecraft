/** Parrot companion flight/perching, water behavior, whistle care, fetching and dive attacks. */
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
const { resetPetsForTests, unlockParrotPet } = await import('../../src/game/pets');

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
    petOwnedKinds: ['parrot'],
    petTokenAvailable: true,
    petEquipped: false,
    petEquippedKind: null,
    petSelectedKind: 'parrot',
    petCoatIndices: { wolf: 0, monkey: 0, parrot: 0 },
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
(sfx as any).creature = (voice: string) => { if (voice === 'bird') voiceCalls.push(voice); };
(sfx as any).ui = () => {};
(sfx as any).pickup = () => {};
const voiceCalls: string[] = [];

try {
  resetPetsForTests();
  unlockParrotPet();
  ceilingY = null;
  waterAtPlayer = false;
  solidCells.clear();

  // Shoulder and fingertip points are derived from the actual animated left-arm hierarchy.
  {
    const { engine } = makeEngine();
    const avatar = new THREE.Group();
    avatar.position.copy(engine.pos);
    avatar.rotation.order = 'YXZ';
    avatar.rotation.y = engine.yaw;
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.43, 1.34, 0);
    avatar.add(leftArm);
    Object.assign(engine, { thirdPerson: true, playerAvatar: avatar, avatarLeftArm: leftArm, parrotHandArmBlend: 1 });
    const shoulder = engine.parrotShoulderPoint();
    ok(shoulder.x < 0 && Math.abs(shoulder.y - (engine.pos.y + 1.34)) < 0.01, 'The resting perch tracks the character’s actual left shoulder joint');
    leftArm.rotation.x = 1.45;
    const hand = engine.parrotHandPoint();
    ok(hand.x < 0 && hand.z < -0.7 && Math.abs(hand.y - (engine.pos.y + 1.267)) < 0.02, 'The whistle perch tracks the end of the animated, forward-extended left hand');
  }

  // Swept steering can find a clear curved route around an obstacle without entering its voxel.
  {
    const { engine } = makeEngine();
    engine.setPetEquipped('parrot', true);
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
    ok(remainedClear, 'Obstacle-aware flight never enters a solid voxel');
    ok(rig.group.position.distanceTo(destination) < 1.0, 'The parrot finds a curved or rising route past the obstacle', JSON.stringify({ position: rig.group.position.toArray(), distance: rig.group.position.distanceTo(destination) }));
    solidCells.clear();
  }

  // Equip creates the same six-coat in-world parrot mesh and the stationary bird settles on a shoulder.
  {
    const { engine, popups, collected } = makeEngine();
    ok(engine.setPetEquipped('parrot', true), 'An owned parrot equips into the shared pet slot');
    ok(engine.cyclePetCoat('parrot', 1) && engine.wolfPetRig.model.userData.variant === 1, 'The pet coat picker rebuilds the exact shared wild-parrot variant');
    const rig = engine.wolfPetRig;
    ok(rig?.kind === 'parrot' && rig.group.userData.companion === 'parrot-pet', 'The equipped pet is built from the shared parrot model');
    const shoulder = engine.parrotShoulderPoint();
    ok(shoulder.x < 0 && shoulder.y > engine.pos.y + 1.2, 'The idle perch is on the character’s left shoulder, outside the head centerline');
    ok(engine.parrotFollowPoint().y > engine.pos.y + 2.45, 'Free follow flight keeps the parrot higher above the player');
    engine.updateParrotPet(rig, 0.4);
    ok(rig.parrotMode === 'shoulder' && !rig.swimming, 'An idle parrot perches on the shoulder and never enters swimming state');
    ok(rig.legs[0].rotation.z > 0 && rig.legs[1].rotation.z < 0, 'A shoulder-perched parrot folds its wings down');
    ok(rig.yawTarget === engine.yaw, 'A shoulder-perched parrot faces the same direction as the player');

    // A two-block cave leaves too little room for the bird's wings, so it stays perched.
    ceilingY = 8;
    engine.vel.set(0, 0, -3);
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'shoulder' && !rig.moving, 'Low cave clearance makes the parrot perch instead of clipping its wings');
    engine.whistleParrot();
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'shoulder' && engine.parrotFlightClear(rig.group.position.x, rig.group.position.y, rig.group.position.z), 'A whistle in a cramped cave waits on the shoulder instead of clipping through a roof');
    rig.parrotCalled = false;

    // Back in open air, the bird takes flight behind the player.
    ceilingY = null;
    engine.updateParrotPet(rig, 0.1);
    ok(rig.parrotMode === 'follow' && rig.moving && !rig.swimming, 'The parrot flies after a moving player without swimming');
    ok(rig.group.position.z > engine.pos.z - 0.2, 'With the player facing forward, the parrot follows from behind');

    // A water block covers the player's feet; the parrot relocates to clear air above the water surface.
    engine.vel.set(0, 0, 0);
    engine.inWater = true;
    waterAtPlayer = true;
    const waterHoverPoint = engine.parrotWaterHoverPoint();
    engine.updateParrotPet(rig, 0.1);
    for (let i = 0; i < 3; i++) engine.updateParrotPet(rig, 0.1);
    ok(!rig.swimming && rig.group.position.y > engine.pos.y + 2.3 && waterHoverPoint.y > engine.pos.y + 2.3, 'The parrot smoothly settles higher in clear air above a submerged player', JSON.stringify({ birdY: rig.group.position.y, playerY: engine.pos.y, targetY: waterHoverPoint.y }));
    const firstWaterOrbit = rig.group.position.clone();
    engine.time += 0.8;
    engine.updateParrotPet(rig, 0.1);
    ok(Math.hypot(rig.group.position.x - firstWaterOrbit.x, rig.group.position.z - firstWaterOrbit.z) > 0.1, 'Above water the parrot gently circles instead of staying fixed on one point');
    engine.whistleParrot();
    engine.updateParrotPet(rig, 0.1);
    ok(!rig.parrotCalled && rig.parrotMode === 'follow' && rig.group.position.y > engine.pos.y + 2.3, 'Water overrides a hand call and keeps the parrot high above the player');

    // B calls the bird to the outstretched left hand, where E feeds it with selected wheat seeds or pets it.
    engine.inWater = false;
    waterAtPlayer = false;
    engine.vel.set(0, 0, 0);
    ok(engine.whistleParrot() && rig.parrotCalled, 'The whistle calls the equipped parrot');
    for (let i = 0; i < 5; i++) engine.updateParrotPet(rig, 0.1);
    const leftHand = engine.parrotHandPoint();
    ok(leftHand.x < 0 && leftHand.z < -0.6, 'The whistle perch is extended forward from the character’s left hand');
    ok(rig.parrotMode === 'hand' && engine.petInteractionAvailable(), 'After the whistle the parrot settles on the left fingertips and becomes interactable');
    ok(rig.legs[0].rotation.z > 0 && rig.legs[1].rotation.z < 0, 'A hand-perched parrot folds its wings down while resting');
    ok(Math.abs(rig.yawTarget - engine.parrotFacingPlayerYaw(rig.group.position)) < 0.001, 'The hand-perched bird turns to face the player');

    engine.inventory.set(WHEAT_SEEDS, 2);
    engine.hotbar[0] = WHEAT_SEEDS;
    ok(engine.interact() && engine.inventory.get(WHEAT_SEEDS) === 1 && rig.parrotEatTimer > 0, 'E feeds the hand-perched parrot and consumes one wheat seed');
    engine.hotbar[0] = DIRT;
    ok(engine.interact() && engine.inventory.get(WHEAT_SEEDS) === 1 && rig.parrotHappyTimer > 0, 'E pets the parrot when seeds are not selected');
    ok(popups.some((message) => message.includes('eats')) && popups.some((message) => message.includes('stroke')), 'Feeding and petting both provide interaction feedback');

    // First person renders a detached copy of the animated left arm at the exact world-space perch.
    engine.playerAvatar = new THREE.Group();
    const firstPersonLeftArm = new THREE.Group();
    firstPersonLeftArm.position.set(-0.43, 1.34, 0);
    firstPersonLeftArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), new THREE.MeshBasicMaterial({ color: 0x888888 })));
    engine.playerAvatar.add(firstPersonLeftArm);
    const firstPersonArm = firstPersonLeftArm.clone(true);
    Object.assign(engine, {
      thirdPerson: false,
      parrotHandArmBlend: 0,
      avatarLeftArm: firstPersonLeftArm,
      firstPersonParrotArm: firstPersonArm,
      avatarRightArm: null,
      avatarLeftLeg: null,
      avatarRightLeg: null,
      avatarHead: null,
      avatarFireFx: null,
      avatarSkirt: null,
      avatarArmorModels: {},
      crawlYaw: 0,
      keys: {},
      pitch: 0,
      bob: 0,
      swingT: -1,
      touchJump: false,
    });
    engine.vel.set(0, 0, 0);
    engine.updatePlayerAvatar(0.1);
    ok(firstPersonArm.visible && !engine.playerAvatar.visible && firstPersonArm.position.x < 0, 'First person shows only the left arm beneath the perched bird, not the whole avatar');
    ok(firstPersonLeftArm.localToWorld(new THREE.Vector3(0, -0.77, 0)).distanceTo(engine.parrotHandPoint().sub(new THREE.Vector3(0, 0.02, 0))) < 0.001, 'The first-person arm tip and parrot perch share the same world position');

    // Starting to walk cancels the hand interaction, retracts the arm, and launches the bird smoothly.
    engine.playerSprinting = false;
    engine.vel.set(1, 0, 0);
    engine.updatePlayerAvatar(0.1);
    ok(engine.parrotHandArmBlend < 0.2 && firstPersonArm.visible, 'The first-person left arm smoothly begins retracting as soon as the player walks');
    engine.updateParrotPet(rig, 0.1);
    ok(!rig.parrotCalled && rig.parrotMode === 'follow' && rig.moving, 'Walking ends the hand perch and makes the parrot take off');
    ok(rig.legs[0].rotation.z < 0 && rig.legs[1].rotation.z > 0, 'The parrot spreads its wings again when it becomes airborne');
    engine.updatePlayerAvatar(0.1);
    engine.updatePlayerAvatar(0.1);
    ok(!firstPersonArm.visible, 'The first-person arm view fades out after it returns to rest');

    // Sprinting also keeps the hand perch released.
    engine.vel.set(0, 0, 0);
    ok(engine.whistleParrot(), 'The parrot can be called again after settling');
    for (let i = 0; i < 5; i++) engine.updateParrotPet(rig, 0.1);
    engine.playerSprinting = true;
    engine.vel.set(4, 0, 0);
    engine.updateParrotPet(rig, 0.1);
    ok(!rig.parrotCalled && rig.parrotMode === 'follow' && rig.moving, 'Running also ends the hand interaction and launches the parrot');

    // The bird only fetches loose drops (never chest contents), then brings them back to the player.
    engine.playerSprinting = false;
    engine.vel.set(0, 0, 0);
    engine.mobSys.mobs = [];
    engine.closestWolfChestTarget = () => { throw new Error('Parrots must not inspect chests'); };
    const drop = { active: true, id: DIRT, x: 4.1, y: 6.15, z: 2.3, vx: 0, vy: 0, vz: 0, age: 1, mesh: { visible: true }, clearance: 0.2 };
    const routeStart = rig.group.position.clone();
    engine.drops.push(drop);
    engine.updateParrotPet(rig, 0.1);
    const waypoint = rig.navWaypoint.clone();
    const routeCross = (waypoint.x - routeStart.x) * (drop.z - routeStart.z) - (waypoint.z - routeStart.z) * (drop.x - routeStart.x);
    ok(Math.abs(routeCross) > 0.12, 'The parrot chooses a curved, side-offset approach to loose resources');
    for (let i = 1; i < 40 && drop.active; i++) {
      engine.updateParrotPet(rig, 0.1);
      engine.time += 0.1;
    }
    ok(collected.includes(drop) && !drop.active, 'The flying parrot picks up and delivers a loose resource');

    // Hostiles are attacked in repeated dives, with a climb back into the air between hits.
    const monster = { alive: true, hidden: false, def: { hostile: true }, x: 0, y: 6.001, z: -3, hp: 50, vx: 0, vy: 0, vz: 0, hurtFlash: 0, onGround: true };
    engine.mobSys.mobs = [monster];
    const hpBefore = monster.hp;
    for (let i = 0; i < 55; i++) {
      engine.updateParrotPet(rig, 0.1);
      engine.time += 0.1;
    }
    ok(monster.hp < hpBefore, 'The parrot repeatedly dive-attacks nearby monsters');
    ok(voiceCalls.some((voice) => voice === 'bird'), 'Parrot calls, feeding, petting and attacks use bird chirps');

    ok(engine.setPetEquipped('parrot', false) && !engine.petEquipped && engine.wolfPetRig === null, 'Unequipping removes the parrot rig and returns its token');
  }
} finally {
  solidCells.clear();
  (sfx as any).creature = originalCreature;
  (sfx as any).ui = originalUi;
  (sfx as any).pickup = originalPickup;
}

export { passed, failures };
