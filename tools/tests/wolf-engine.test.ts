/** Wolf companion equip state, idle/movement follow, defense, resource fetch and E reactions. */
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
const { AIR, FERN, FLOWER_RED, LEAVES, LOG, PLANKS, STONE, TALL_GRASS, WATER } = await import('../../src/game/blocks');
const { Engine } = await import('../../src/game/engine');
const { sfx } = await import('../../src/game/audio');

function makeEngine({ owned = true, token = true }: { owned?: boolean; token?: boolean } = {}) {
  const engine = Object.create(Engine.prototype) as any;
  const world = {
    hasColumn: () => true,
    topSolidY: () => 5,
    get: (_x: number, y: number, _z: number) => y === 5 ? STONE : AIR,
  };
  const collected: any[] = [];
  const popups: string[] = [];
  Object.assign(engine, {
    phase: 'playing',
    petOwned: owned,
    petTokenAvailable: token,
    petEquipped: false,
    petCoatIndex: 0,
    wolfPetRig: null,
    wolfPetLayer: new THREE.Group(),
    scene: new THREE.Group(),
    monkeyProjectiles: [],
    pos: new THREE.Vector3(0, 6.001, 0),
    vel: new THREE.Vector3(),
    yaw: 0,
    time: 0,
    world,
    drops: [],
    openDoors: [],
    target: null,
    mobSys: { mobs: [], showHealthBar() {} },
    stats: { magnet: 0 },
    syncHud() {},
    popup(_x: number, _y: number, _z: number, message: string) { popups.push(message); },
    burst() {},
    mobDied() {},
    collect(drop: any) { collected.push(drop); drop.active = false; drop.petCarried = false; },
  });
  return { engine, collected, popups };
}

// No installed token means no rig and no visible wolf.
{
  const { engine } = makeEngine({ owned: false, token: false });
  ok(engine.setWolfPetEquipped(true) === false, 'An unowned pet cannot be installed');
  ok(engine.wolfPetRig === null && engine.wolfPetLayer.children.length === 0, 'No wolf exists before the pet token is installed');
}

// Equip, greet and remove the pet.
{
  const { engine, popups } = makeEngine();
  const voiceCalls: Array<{ voice: string; state?: string }> = [];
  const originalCreature = sfx.creature;
  (sfx as any).creature = (voice: string, opts?: { state?: string }) => voiceCalls.push({ voice, state: opts?.state });
  ok(engine.setWolfPetEquipped(true) && engine.petEquipped && !engine.petTokenAvailable, 'Installing the token equips the wolf for this run');
  ok(engine.wolfPetRig !== null && engine.wolfPetLayer.children.length === 1, 'Equipping creates exactly one voxel wolf');
  ok(engine.interact() && ['wag', 'bark', 'spin'].includes(engine.wolfPetRig.reaction), 'E-interaction chooses a random pet reaction');
  const playerDx = engine.pos.x - engine.wolfPetRig.group.position.x;
  const playerDz = engine.pos.z - engine.wolfPetRig.group.position.z;
  const facingPlayerYaw = Math.atan2(-playerDx, -playerDz);
  ok(Math.abs(engine.wolfPetRig.yawTarget - facingPlayerYaw) < 1e-9 && engine.wolfPetRig.reactionLookTimer > 0, 'The wolf turns to face the player while showing its random reaction');
  ok(popups.length === 1 && /tail|barks|spins/.test(popups[0]), 'The E-reaction shows its matching translated feedback');
  ok(voiceCalls.some((call) => call.voice === 'wolf' && (call.state ?? 'idle') === 'idle'), 'Petting the wolf uses the wolf idle voice');
  const reaction = engine.wolfPetRig.reaction;
  ok(engine.interact(true) === false && engine.wolfPetRig.reaction === reaction, 'The touch PLACE action does not accidentally pet the wolf');
  ok(engine.setWolfPetEquipped(false) && !engine.petEquipped && engine.petTokenAvailable, 'Removing the pet returns its token to inventory');
  ok(engine.wolfPetRig === null && engine.wolfPetLayer.children.length === 0, 'Unequipping removes the wolf from the world');
  (sfx as any).creature = originalCreature;
}

// The monkey shares the equipment slot, uses its own voice and has four monkey-only petting reactions.
{
  const { engine, popups } = makeEngine();
  engine.petOwnedKinds = ['wolf', 'monkey'];
  engine.petCoatIndices = { wolf: 0, monkey: 0 };
  engine.petSelectedKind = 'monkey';
  ok(engine.setPetEquipped('monkey', true), 'An owned monkey token equips into the shared pet slot');
  ok(engine.petInventoryKinds().join(',') === 'wolf' && engine.petTokenAvailable, 'Equipping one species hides only its own token while preserving the other species token');
  ok(engine.wolfPetRig?.kind === 'monkey' && engine.wolfPetRig.group.userData.companion === 'monkey-pet', 'The regular monkey model is used for the companion rig');
  const voiceCalls: string[] = [];
  const originalCreature = sfx.creature;
  const originalRandom = Math.random;
  (sfx as any).creature = (voice: string) => voiceCalls.push(voice);
  const reactions = [
    ['monkey-flop', 0],
    ['monkey-hops', 0.26],
    ['monkey-scratch', 0.51],
    ['monkey-spin', 0.76],
  ] as const;
  try {
    for (const [expected, randomValue] of reactions) {
      Math.random = () => randomValue;
      ok(engine.petWolf(), `Petting triggers the ${expected} monkey response`);
      ok(engine.wolfPetRig.reaction === expected, `The ${expected} response is selected independently of wolf reactions`);
    }
  } finally {
    Math.random = originalRandom;
    (sfx as any).creature = originalCreature;
  }
  ok(voiceCalls.length === 4 && voiceCalls.every((voice) => voice === 'monkey'), 'Every monkey petting response uses only the monkey voice');
  ok(popups.length === 4, 'Each monkey response displays matching feedback');
  ok(engine.setPetEquipped('monkey', false) && engine.petTokenAvailable, 'Unequipping the monkey returns the shared pet token');
  ok(engine.petInventoryKinds().join(',') === 'wolf,monkey', 'Unequipping restores both owned species tokens');
  ok(engine.setPetEquipped('wolf', true), 'A second pet token can replace the active species');
  ok(engine.wolfPetRig?.kind === 'wolf' && engine.wolfPetLayer.children.length === 1 && engine.petInventoryKinds().join(',') === 'monkey', 'Replacing a pet removes its world rig and returns its token to the inventory');
  ok(engine.setPetEquipped('monkey', true) && engine.wolfPetRig?.kind === 'monkey' && engine.wolfPetLayer.children.length === 1, 'The returned pet token can immediately replace the active companion again');
}

// The monkey prefers nearby tree canopies while following, and attacks with thrown fruit that can stun.
{
  const { engine } = makeEngine();
  engine.petOwnedKinds = ['monkey'];
  engine.petCoatIndices = { wolf: 0, monkey: 0 };
  engine.petSelectedKind = 'monkey';
  engine.world = {
    hasColumn: () => true,
    topSolidY: (x: number, z: number) => (x === 2 && (z === 0 || z === 1)) ? 8 : (x === 2 && z === -1) ? 7 : 5,
    get: (x: number, y: number, z: number) => {
      if (x === 2 && z === 0) return y >= 6 && y <= 7 ? LOG : y === 8 ? LEAVES : y === 5 ? STONE : AIR;
      if (x === 2 && z === 1) return y === 8 ? LEAVES : y === 5 ? STONE : AIR;
      if (x === 2 && z === -1) return y === 7 ? LEAVES : y === 5 ? STONE : AIR;
      return y === 5 ? STONE : AIR;
    },
  };
  ok(engine.setPetEquipped('monkey', true), 'An owned monkey equips for tree-follow and ranged-combat checks');
  ok(engine.setWolfPetFollowTarget(engine.wolfPetRig, false), 'The monkey can choose a normal follow target');
  ok(engine.wolfPetRig.target.y > 8.5, 'When a nearby tree is available, the monkey prefers a canopy perch over the ground', engine.wolfPetRig.target.y.toFixed(2));
  const startY = engine.wolfPetRig.group.position.y;
  const startX = engine.wolfPetRig.group.position.x;
  for (let i = 0; i < 6; i++) engine.updateWolfPet(0.12);
  ok(engine.wolfPetRig.group.position.y < 8.2 && Math.abs(engine.wolfPetRig.group.position.x - startX) > 0.08, 'The monkey starts approaching the tree smoothly instead of snapping to the top immediately', `${engine.wolfPetRig.group.position.x.toFixed(2)},${engine.wolfPetRig.group.position.y.toFixed(2)}`);
  for (let i = 0; i < 18; i++) engine.updateWolfPet(0.12);
  ok(engine.wolfPetRig.group.position.y > 7.5 && engine.wolfPetRig.group.position.y > startY, 'The monkey reaches the elevated tree route instead of staying on the ground', engine.wolfPetRig.group.position.y.toFixed(2));
  engine.wolfPetRig.group.position.set(2.2, 6.001, 0.4);
  engine.wolfPetRig.attackTimer = 0;

  const hostile = {
    x: 6.7, y: 6.001, z: 0.4, hp: 20, hurtFlash: 0, stun: 0,
    vx: 0, vy: 0, vz: 0, onGround: true,
    alive: true, hidden: false, def: { hostile: true },
  };
  engine.mobSys.mobs.push(hostile);
  const voiceCalls: Array<{ voice: string; state?: string }> = [];
  const originalCreature = sfx.creature;
  const originalRandom = Math.random;
  const randomValues = [0.75, 0.5, 0.5, 0.5, 0];
  let randomIndex = 0;
  (sfx as any).creature = (voice: string, opts?: { state?: string }) => voiceCalls.push({ voice, state: opts?.state });
  Math.random = () => randomValues[Math.min(randomIndex++, randomValues.length - 1)];
  try {
    (engine as any).launchMonkeyProjectile(engine.wolfPetRig, hostile);
    for (let i = 0; i < 28; i++) (engine as any).updateMonkeyProjectiles(0.05);
  } finally {
    Math.random = originalRandom;
    (sfx as any).creature = originalCreature;
  }
  ok(hostile.hp < 20, 'The monkey attacks nearby monsters with low-damage thrown fruit', String(hostile.hp));
  ok(hostile.stun > 4.5, 'A lucky monkey hit can stun a monster for five seconds', String(hostile.stun));
  ok(voiceCalls.some((call) => call.voice === 'monkey' && call.state === 'attack'), 'Monkey combat uses the monkey attack voice');
  ok(engine.monkeyProjectiles.length === 0, 'Thrown monkey fruit is consumed on impact instead of becoming a collectible resource');
}

// The cat shares the wolf runtime, but uses cat-only reactions, UI messages and combat sounds.
{
  const { engine, popups } = makeEngine();
  engine.petOwnedKinds = ['wolf', 'cat'];
  engine.petCoatIndices = { wolf: 0, cat: 0 };
  engine.petSelectedKind = 'cat';
  ok(engine.setPetEquipped('cat', true), 'An owned cat token equips into the shared pet slot');
  ok(engine.petInventoryKinds().join(',') === 'wolf' && engine.petTokenAvailable, 'Equipping the cat hides only its own species token while preserving the wolf token');
  ok(engine.wolfPetRig?.kind === 'cat' && engine.wolfPetRig.group.userData.companion === 'cat-pet', 'The companion cat model is used for the shared ground-pet rig');
  const voiceCalls: Array<{ voice: string; state?: string }> = [];
  const originalCreature = sfx.creature;
  const originalRandom = Math.random;
  (sfx as any).creature = (voice: string, opts?: { state?: string }) => voiceCalls.push({ voice, state: opts?.state });
  const reactions = [
    ['cat-purr', 0],
    ['cat-meow', 0.4],
    ['cat-circle', 0.8],
  ] as const;
  try {
    for (const [expected, randomValue] of reactions) {
      Math.random = () => randomValue;
      ok(engine.petWolf(), `Petting triggers the ${expected} cat response`);
      ok(engine.wolfPetRig.reaction === expected, `The ${expected} response is selected independently of wolf reactions`);
    }
    const hostile = {
      x: 2.1, y: 6.001, z: 0, hp: 20, hurtFlash: 0,
      vx: 0, vy: 0, vz: 0, onGround: true,
      alive: true, hidden: false, def: { hostile: true },
    };
    engine.mobSys.mobs.push(hostile);
    engine.updateWolfPet(1.1);
    ok(hostile.hp < 20, 'The cat also damages a hostile monster near the player', String(hostile.hp));
  } finally {
    Math.random = originalRandom;
    (sfx as any).creature = originalCreature;
  }
  ok(popups.length === 3 && popups.every((message) => /purrs|meows|circles/.test(message)), 'Each cat response displays matching translated feedback');
  ok(voiceCalls.filter((call) => call.voice === 'cat' && (call.state ?? 'idle') === 'idle').length === 3, 'Every cat petting response uses the cat voice');
  ok(voiceCalls.some((call) => call.voice === 'cat' && call.state === 'attack'), 'The cat also uses its own attack voice when fighting monsters');
  ok(engine.setPetEquipped('cat', false) && engine.petTokenAvailable, 'Unequipping the cat returns the shared pet token');
}

// Ferns, tall grass and flowers do not count as support: the companion stands on the real block below them.
{
  const { engine } = makeEngine();
  for (const plant of [FERN, TALL_GRASS, FLOWER_RED]) {
    engine.world = {
      hasColumn: () => true,
      topSolidY: () => 6,
      get: (_x: number, y: number) => y === 6 ? plant : y === 5 ? STONE : AIR,
    };
    const ground = engine.wolfPetGroundY(0.5, 0.5, 6.001, 1.35, 0, 'wolf');
    ok(ground !== null && Math.abs(ground - 6.001) < 0.0001, 'Foliage does not make the companion hover on an invisible block', String(ground));
  }
}

// A nearby cliff must not spawn the wolf outside the vertical interaction range when a level spot is available.
{
  const { engine } = makeEngine();
  engine.world = {
    hasColumn: () => true,
    topSolidY: (x: number) => x > 0 ? 12 : 5,
    get: (x: number, y: number) => y === (x > 0 ? 12 : 5) ? STONE : AIR,
  };
  engine.setWolfPetEquipped(true);
  const rig = engine.wolfPetRig;
  ok(Math.abs(rig.group.position.y - engine.pos.y) <= 2.2, 'Spawn selection rejects a nearby hillside seven blocks above the player');
  ok(engine.wolfPetIsNear(2.2), 'The wolf is interactable immediately after equipping beside steep terrain');
}

// An idle wolf catches up, then sits beside a stationary player; while moving it keeps a short trail.
{
  const { engine } = makeEngine();
  engine.setWolfPetEquipped(true);
  engine.updateWolfPet(0.5);
  engine.updateWolfPet(0.02);
  ok(engine.wolfPetRig.sitting, 'A nearby wolf sits when the player stands still');
  const idleDx = Math.abs(engine.wolfPetRig.group.position.x - engine.pos.x);
  const idleDistance = Math.hypot(engine.wolfPetRig.group.position.x - engine.pos.x, engine.wolfPetRig.group.position.z - engine.pos.z);
  ok(idleDistance >= 1.65 && idleDistance <= 2.25 && idleDx > 1.35, 'When idle the wolf sits off to the side about two blocks away', idleDistance.toFixed(2));
  engine.pos.x = 5;
  engine.vel.x = 5;
  for (let i = 0; i < 12; i++) {
    engine.updateWolfPet(0.1);
    engine.pos.x += 0.5; // emulate the player advancing at the same speed as the recorded velocity
  }
  const followDistance = Math.hypot(engine.wolfPetRig.group.position.x - engine.pos.x, engine.wolfPetRig.group.position.z - engine.pos.z);
  ok(engine.wolfPetRig.moving && followDistance >= 1.6 && followDistance <= 2.8, 'The wolf runs behind the moving player and keeps about two blocks of distance', followDistance.toFixed(2));
}

// A seated wolf keeps a fixed world-space anchor when the player only turns the camera.
{
  const { engine } = makeEngine();
  engine.setWolfPetEquipped(true);
  const rig = engine.wolfPetRig;
  engine.updateWolfPetFetch(rig, 0.4, false);
  engine.updateWolfPetFetch(rig, 0.02, false);
  const parkedX = rig.restAnchor.x;
  const parkedZ = rig.restAnchor.z;
  const parkedYaw = rig.restYaw;
  engine.yaw = 1.2; // turn the first-person camera without moving the player
  engine.updateWolfPetFetch(rig, 0.1, false);
  ok(rig.sitting && rig.target.x === parkedX && rig.target.z === parkedZ, 'Turning the camera does not move a seated wolf to a new side');
  ok(rig.yawTarget === parkedYaw, 'A seated wolf keeps its facing instead of turning with the mouse');
  engine.vel.x = 5;
  engine.updateWolfPetFetch(rig, 0.05, true);
  ok(rig.sitting && !rig.moving && rig.moveStartTimer < 0.14, 'A seated wolf waits briefly after the player starts moving');
  engine.updateWolfPetFetch(rig, 0.1, true);
  ok(!rig.sitting && !rig.restAnchorValid, 'The wolf leaves its parked position and resumes following after the short delay');
}

// Follow the player's actual travel vector when strafing, and reappear ahead-side after a long catch-up.
{
  const { engine } = makeEngine();
  engine.setWolfPetEquipped(true);
  engine.vel.x = 5;
  engine.vel.z = 0;
  engine.setWolfPetFollowTarget(engine.wolfPetRig, true);
  ok(engine.wolfPetRig.target.x < -1.5 && Math.abs(engine.wolfPetRig.target.z) < 1, 'The wolf trails the movement vector instead of crossing in front during a strafe');

  const vertical = makeEngine();
  vertical.engine.setWolfPetEquipped(true);
  vertical.engine.vel.y = 1.5;
  vertical.engine.updateWolfPet(0.1);
  ok(vertical.engine.wolfPetRig.moving && !vertical.engine.wolfPetRig.restAnchorValid, 'Vertical climbing or jumping motion also resumes the wolf follow behavior');

  engine.vel.x = 0;
  engine.wolfPetRig.group.position.set(20, 6.001, 20);
  engine.updateWolfPet(0.1);
  const revealX = engine.wolfPetRig.group.position.x - engine.pos.x;
  const revealZ = engine.wolfPetRig.group.position.z - engine.pos.z;
  ok(Math.hypot(revealX, revealZ) >= 1.5 && Math.hypot(revealX, revealZ) <= 3, 'A far wolf teleports back into a visible nearby position');
  ok(revealZ < -0.5 && Math.abs(revealX) > 0.5 && engine.wolfPetRig.teleportRevealTimer > 0, 'The catch-up reappears ahead-left/right and pauses briefly for first-person visibility');
  const lockedTeleportYaw = engine.wolfPetRig.restYaw;
  engine.yaw = 1.2;
  engine.updateWolfPet(0.9);
  engine.updateWolfPet(0.3);
  ok(engine.wolfPetRig.sitting && engine.wolfPetRig.yawTarget === lockedTeleportYaw, 'After the visible catch-up pause, an idle wolf keeps its teleport-side facing');
}

// An inaccessible resource is blacklisted so another item can be fetched instead; a moving player is not held by a blocked drop.
{
  const { engine } = makeEngine();
  engine.setWolfPetEquipped(true);
  const rig = engine.wolfPetRig;
  rig.group.position.set(0.5, 6.001, 0.5);
  engine.world = {
    hasColumn: (x: number) => x < 1 || x > 3, // a solid strip of unloaded columns blocks the first item
    topSolidY: () => 5,
    get: (_x: number, y: number, _z: number) => y === 5 ? STONE : AIR,
  };
  const blocked = {
    id: PLANKS, active: true, petCarried: false, thrown: false,
    x: 2.1, y: 6.8, z: 0.5, vx: 0, vy: 0, vz: 0, age: 1, pickupDelay: 0.22,
  };
  const reachable = {
    id: STONE, active: true, petCarried: false, thrown: false,
    x: -3, y: 6.8, z: 0.5, vx: 0, vy: 0, vz: 0, age: 1, pickupDelay: 0.22,
  };
  engine.drops.push(blocked, reachable);
  engine.updateWolfPetFetch(rig, 0.5, false);
  ok(blocked.wolfPetIgnoreUntil > engine.time && rig.fetchTarget === reachable, 'A target beyond an impassable column barrier is ignored and the wolf switches to another resource');

  const another = { ...reachable, x: 3.5, z: 1.5, id: PLANKS, active: true, petCarried: false };
  engine.drops.push(another);
  engine.moveWolfPet = (movingRig: any) => { movingRig.moving = false; movingRig.navTimer = 0; };
  rig.fetchTarget = blocked;
  rig.fetchBlockedDrop = blocked;
  rig.fetchBlockedTimer = 0;
  rig.fetchNoProgressTimer = 0;
  rig.fetchNoPath = false;
  engine.vel.x = 3;
  engine.updateWolfPetFetch(rig, 0.5, true);
  rig.fetchTarget = another;
  rig.fetchBlockedDrop = another;
  rig.fetchBlockedTimer = 0;
  rig.fetchNoPath = false;
  engine.updateWolfPetFetch(rig, 0.5, true);
  ok(!rig.fetchTarget && blocked.wolfPetIgnoreUntil > engine.time && another.wolfPetIgnoreUntil > engine.time, 'After about one second of failed attempts while moving, the wolf gives up the inaccessible target');
  ok(!reachable.wolfPetIgnoreUntil, 'Giving up on an inaccessible item does not blacklist a different resource');
}

// The wolf swims at the surface and tracks the player's depth when they dive.
{
  const waterWorld = (topWaterY: number) => ({
    hasColumn: () => true,
    topSolidY: () => topWaterY,
    get: (_x: number, y: number, _z: number) => y === 4 ? STONE : y >= 5 && y <= topWaterY ? WATER : AIR,
  });
  const surface = makeEngine();
  surface.engine.pos.set(0, 5.001, 0);
  surface.engine.setWolfPetEquipped(true);
  surface.engine.world = waterWorld(5);
  surface.engine.inWater = true;
  surface.engine.updateWolfPet(0.5);
  ok(surface.engine.wolfPetRig.swimming && !surface.engine.wolfPetRig.underwater, 'The wolf enters a surface-swimming state beside a player in shallow water');
  ok(Math.abs(surface.engine.wolfPetRig.target.y - 5.28) < 0.05, 'At the surface, the wolf floats with its body at the waterline', surface.engine.wolfPetRig.target.y.toFixed(2));

  const diver = makeEngine();
  diver.engine.pos.set(0, 6.001, 0);
  diver.engine.setWolfPetEquipped(true);
  diver.engine.world = waterWorld(8);
  diver.engine.inWater = true;
  diver.engine.vel.y = -0.5;
  diver.engine.updateWolfPet(0.1);
  ok(diver.engine.wolfPetRig.swimming && diver.engine.wolfPetRig.underwater, 'The wolf recognizes when the player dives below the water surface');
  ok(Math.abs(diver.engine.wolfPetRig.target.y - diver.engine.pos.y) < 0.02, 'Underwater, the wolf follows the player at the same depth');
  diver.engine.pos.y = 5.5;
  diver.engine.updateWolfPet(0.1);
  ok(Math.abs(diver.engine.wolfPetRig.target.y - diver.engine.pos.y) < 0.02, 'The wolf follows a further descent instead of staying at the surface');

  const shore = makeEngine();
  shore.engine.pos.set(3, 6.001, 0);
  shore.engine.setWolfPetEquipped(true);
  shore.engine.world = {
    hasColumn: () => true,
    topSolidY: () => 5,
    get: (x: number, y: number, _z: number) => y === 4 ? STONE : y === 5 ? (x <= 1 ? WATER : STONE) : AIR,
  };
  shore.engine.wolfPetRig.group.position.set(0, 5.28, 0);
  shore.engine.wolfPetRig.swimming = true;
  shore.engine.updateWolfPetFetch(shore.engine.wolfPetRig, 0.1, false);
  ok(shore.engine.wolfPetRig.swimming && shore.engine.wolfPetRig.target.y >= 6 && shore.engine.wolfPetRig.moving, 'If the player gets ashore first, the wolf keeps swimming toward a safe land follow point');
  for (let i = 0; i < 24; i++) shore.engine.updateWolfPetFetch(shore.engine.wolfPetRig, 0.1, false);
  ok(!shore.engine.wolfPetRig.swimming && shore.engine.wolfPetRig.group.position.y >= 6, 'The wolf mantles onto the bank and resumes its land follow after swimming');
}

// The wolf can mantle a single voxel like the player, then route around a taller wall without clipping into it.
{
  const { engine } = makeEngine();
  engine.setWolfPetEquipped(true);
  engine.world = {
    hasColumn: () => true,
    topSolidY: (x: number, z: number) => x === 2 && z === 0 ? 6 : 5,
    get: (x: number, y: number, z: number) => y === 5 || (x === 2 && z === 0 && y === 6) ? STONE : AIR,
  };
  engine.pos.set(-4, 6.001, 0.5);
  const jumper = engine.wolfPetRig;
  jumper.group.position.set(1.4, 6.001, 0.5);
  jumper.target.set(3.5, 7.001, 0.5);
  engine.moveWolfPet(jumper, 0.1, 4);
  ok(jumper.group.position.y >= 7 && jumper.hopTimer > 0, 'The wolf hops up onto a one-block ledge instead of stopping at its side');

  const { engine: pathEngine } = makeEngine();
  pathEngine.setWolfPetEquipped(true);
  pathEngine.world = {
    hasColumn: () => true,
    topSolidY: (x: number, z: number) => x === 2 && z === 0 ? 7 : 5,
    get: (x: number, y: number, z: number) => y === 5 || (x === 2 && z === 0 && y >= 6 && y <= 7) ? STONE : AIR,
  };
  pathEngine.pos.set(-5, 6.001, 0.5);
  const navigator = pathEngine.wolfPetRig;
  navigator.group.position.set(0.5, 6.001, 0.5);
  navigator.target.set(4.5, 6.001, 0.5);
  for (let i = 0; i < 90; i++) {
    pathEngine.moveWolfPet(navigator, 0.1, 4);
    let turn = navigator.yawTarget - navigator.group.rotation.y;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    navigator.group.rotation.y += turn * 0.6; // emulate the pet's in-frame turn smoothing
  }
  const wallCell = Math.floor(navigator.group.position.x) === 2 && Math.floor(navigator.group.position.z) === 0;
  const routeDistance = Math.hypot(navigator.group.position.x - navigator.target.x, navigator.group.position.z - navigator.target.z);
  ok(!wallCell, 'The wolf never enters a two-block-high solid wall');
  ok(routeDistance < 1.1, 'The wolf finds a clear route around the wall instead of getting stuck', `${routeDistance.toFixed(2)} @ ${navigator.group.position.x.toFixed(2)},${navigator.group.position.z.toFixed(2)} nav=${navigator.navTimer.toFixed(2)} to=${navigator.navWaypoint.x.toFixed(2)},${navigator.navWaypoint.z.toFixed(2)} goal=${navigator.navGoal.x.toFixed(2)},${navigator.navGoal.z.toFixed(2)}`);
}

// A hostile nearby is attacked; otherwise a mature, uncollected resource drop is fetched and delivered.
{
  const { engine, collected } = makeEngine();
  engine.setWolfPetEquipped(true);
  const voiceCalls: Array<{ voice: string; state?: string }> = [];
  const originalCreature = sfx.creature;
  (sfx as any).creature = (voice: string, opts?: { state?: string }) => voiceCalls.push({ voice, state: opts?.state });
  const hostile = {
    x: 2.1, y: 6.001, z: 0, hp: 20, hurtFlash: 0,
    vx: 0, vy: 0, vz: 0, onGround: true,
    alive: true, hidden: false, def: { hostile: true },
  };
  engine.mobSys.mobs.push(hostile);
  engine.updateWolfPet(1.1);
  ok(hostile.hp < 20, 'The wolf damages a hostile monster near the player', String(hostile.hp));
  ok(voiceCalls.some((call) => call.voice === 'wolf' && call.state === 'attack'), 'The wolf uses its own attack voice when fighting monsters');

  engine.mobSys.mobs.length = 0;
  engine.wolfPetRig.group.position.set(1.3, 6.001, 0);
  const drop = {
    id: PLANKS, active: true, petCarried: false, thrown: false,
    x: 2, y: 6.8, z: 0, vx: 0, vy: 0, vz: 0,
    age: 1, pickupDelay: 0.22,
  };
  engine.drops.push(drop);
  ok(engine.closestWolfFetchDrop(engine.wolfPetRig) === drop, 'A nearby drop outside the player pickup radius stays eligible for the wolf');
  engine.updateWolfPet(0.5);
  ok(engine.wolfPetRig.carrying === drop && drop.petCarried, 'With no nearby monsters, the wolf picks up an ignored resource drop');
  engine.updateWolfPet(0.05);
  ok(collected.length === 1 && collected[0] === drop && !drop.active, 'The wolf delivers the resource to the player one item at a time');
  (sfx as any).creature = originalCreature;
}

export { passed, failures };
