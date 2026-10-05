/** Smooth water swimming, surface cruising with Space held, and shore mantle exit tests. */
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
const { AIR, DIRT, GRASS, SAND, STONE, WATER } = await import('../../src/game/blocks');
const { Engine } = await import('../../src/game/engine');
const { createBreathState } = await import('../../src/game/breath');
const { createStaminaState } = await import('../../src/game/stamina');

function makeEngine(world: any) {
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, {
    phase: 'playing',
    pos: new THREE.Vector3(0, 5.28, 0),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    time: 1,
    bob: 0,
    keys: {},
    touchMove: { x: 0, y: 0 },
    touchJump: false,
    touchCrawl: false,
    touchCrouch: false,
    touchSprint: false,
    playerSprinting: false,
    inWater: false,
    crawling: false,
    crouching: false,
    crouchLerp: 0,
    crawlLerp: 0,
    swimLerp: 0,
    landDip: 0,
    stepSmooth: 0,
    fallStart: 5.28,
    spawnY: 10,
    staminaState: createStaminaState(),
    breathState: createBreathState(),
    cactusCooldown: 0,
    hunger: 20,
    hungerDamageTimer: 0,
    world,
    characterCustomization: { gender: 'boy' },
    stats: { fire: 0 },
    equipped: {},
    avatarArmorModels: {},
    damage() {},
    burst() {},
    moveAxis(axis: 'x' | 'y' | 'z', delta: number) {
      if (axis === 'x') { engine.pos.x += delta; return { blocked: false, top: 0 }; }
      if (axis === 'y') { engine.pos.y += delta; return { blocked: false, top: 0 }; }
      if (axis === 'z') { engine.pos.z += delta; return { blocked: false, top: 0 }; }
      return { blocked: false, top: 0 };
    },
    collides() { return false; },
  });
  return engine;
}

// 1. nearWaterExitLedge: open water with underwater seabed vs real dry shore bank
{
  // Deep open water: water at Y=5..6, stone floor at Y=4. No shore bank ahead.
  const oceanWorld = {
    hasColumn: () => true,
    topSolidY: () => 4,
    get: (_x: number, y: number, _z: number) => y <= 4 ? STONE : y <= 6 ? WATER : AIR,
  };
  const engine = makeEngine(oceanWorld);
  engine.pos.set(0, 5.28, 0); // swimming at surface of Y=6 water
  // Facing forward (-Z, so dirX = 0, dirZ = -1)
  ok(!engine.nearWaterExitLedge(0, -1), 'In open ocean with seabed beneath, nearWaterExitLedge returns false');

  // Shore bank: at z = -1, Y=6 is GRASS and Y=7 is AIR (dry land).
  const shoreWorld = {
    hasColumn: () => true,
    topSolidY: (x: number, z: number) => z <= -1 ? 6 : 4,
    get: (_x: number, y: number, z: number) => {
      if (z <= -1) return y <= 6 ? GRASS : AIR;
      return y <= 4 ? STONE : y <= 6 ? WATER : AIR;
    },
  };
  const shoreEngine = makeEngine(shoreWorld);
  shoreEngine.pos.set(0, 5.28, 0);
  ok(shoreEngine.nearWaterExitLedge(0, -1), 'Approaching a dry shore bank (GRASS with AIR above), nearWaterExitLedge returns true');
  ok(!shoreEngine.nearWaterExitLedge(0, 1), 'Moving away from shore back into open water returns false');
}

// 2. Continuous smooth surface swimming with Space held in open water
{
  const lakeWorld = {
    hasColumn: () => true,
    topSolidY: () => 3,
    get: (_x: number, y: number, _z: number) => y <= 3 ? STONE : y <= 6 ? WATER : AIR,
  };
  const engine = makeEngine(lakeWorld);
  engine.pos.set(0, 4.0, 0); // submerged in water
  engine.keys['KeyW'] = true;
  engine.keys['Space'] = true;

  // Simulate swimming upward and cruising at surface
  let jitterDetected = false;
  let stayedInWater = true;
  for (let step = 0; step < 60; step++) {
    const prevY = engine.pos.y;
    engine.updatePlayer(0.016);
    if (step > 15) {
      if (!engine.inWater) stayedInWater = false;
      // After reaching surface, pos.y should not bounce up and down violently
      if (Math.abs(engine.pos.y - prevY) > 0.15) jitterDetected = true;
    }
  }

  ok(stayedInWater, 'When swimming forward and holding Space in open water, the player continuously stays inWater without popping out');
  ok(!jitterDetected, 'Surface swimming is smooth and free of vertical jitter/bobbing spikes');
  ok(engine.pos.y >= 5.8 && engine.pos.y <= 6.5, 'Swimmer stabilizes at the surface cruising level');
  ok(!engine.headUnderwater(), 'At the water surface, the player’s head is above water to breathe freely');
}

export { passed, failures };
