/** Chest block-entity storage, stack transfers, break drops and wolf resource runs. */
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
const { AIR, CHEST_PLAINS, CHEST_PLAINS_OPEN, CHEST_STORAGE, CHEST_STORAGE_OPEN, IRON, STONE, WATER } = await import('../../src/game/blocks');
const { Engine } = await import('../../src/game/engine');
const { buildChunkGeometry } = await import('../../src/game/mesher');

function makeWorld(cells = new Map<string, number>(), underwater = false) {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  return {
    seed: 1701,
    hasColumn: () => true,
    get(x: number, y: number, z: number) {
      const saved = cells.get(key(x, y, z));
      if (saved !== undefined) return saved;
      if (underwater && y >= 5 && y <= 10) return WATER;
      if (!underwater && y === 5) return STONE;
      if (underwater && y === 4) return STONE;
      return AIR;
    },
    set(x: number, y: number, z: number, id: number) { cells.set(key(x, y, z), id); },
    topSolidY(x: number, z: number) {
      for (let y = 47; y >= 0; y--) if (this.get(x, y, z) !== AIR && this.get(x, y, z) !== WATER) return y;
      return 0;
    },
  };
}

function makeEngine(world = makeWorld()) {
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, {
    world,
    pos: new THREE.Vector3(0.5, 6.001, 0.5),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    time: 0,
    phase: 'playing',
    sandbox: false,
    petOwned: true,
    petTokenAvailable: true,
    petEquipped: false,
    petCoatIndex: 0,
    wolfPetRig: null,
    wolfPetLayer: new THREE.Group(),
    inventoryOpen: false,
    activeChest: null,
    chestInventories: new Map(),
    chestBonusGear: new Map(),
    inventory: new Map(),
    hotbar: [undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined],
    hotbarInstanceIds: Array(10).fill(undefined),
    selected: 0,
    syncHud() {},
    syncHotbar() {},
    addToHotbar() {},
    rebuildAt() {},
    swingChestLid() {},
    updatePickaxe() {},
    saveWorld() { return true; },
    scene: { remove() {} },
    drops: [],
    openDoors: [],
    target: null,
    mobSys: { mobs: [], showHealthBar() {} },
    stats: { magnet: 0 },
    score: 0,
    scoreBonusMultiplier: 1,
    combo: 0,
    tier: 0,
    health: 100,
    endlessRun: true,
    timeLeft: 60,
    oresFound: 0,
    awardScore(base: number) { this.score += base; return base; },
    comboMult() { return 1; },
    burst() {},
    popup() {},
  });
  return engine;
}

// Biome treasure is seeded and cached once; reusable and already-open legacy chests are empty.
{
  const world = makeWorld();
  const first = makeEngine(world);
  const loot = first.chestInventoryAt(3, 6, -2, CHEST_PLAINS);
  const total = [...loot.values()].reduce((sum: number, count: number) => sum + count, 0);
  ok(total > 0, 'A new biome chest is populated with deterministic loot');
  ok(first.chestInventoryAt(3, 6, -2, CHEST_PLAINS) === loot, 'Repeated chest access returns the same block-entity inventory');
  const second = makeEngine(makeWorld());
  const sameLoot = second.chestInventoryAt(3, 6, -2, CHEST_PLAINS);
  ok(JSON.stringify([...loot]) === JSON.stringify([...sameLoot]), 'A chest at the same seed and cell generates the same loot');
  ok(first.chestInventoryAt(4, 6, -2, CHEST_STORAGE).size === 0, 'A reusable storage chest starts empty');
  ok(first.chestInventoryAt(5, 6, -2, CHEST_PLAINS_OPEN).size === 0, 'An open legacy chest without saved contents stays empty');
  ok(first.chestInventoryAt(6, 6, -2, CHEST_STORAGE_OPEN).size === 0, 'An open storage chest is not assigned generated loot');
}

// Sandbox saves use v3 and preserve the sidecar resource counts, including an empty chest entry.
{
  const engine = makeEngine();
  (engine.world as any).chunks = new Map();
  engine.world.seed = 1701;
  Object.assign(engine, {
    clock: 0,
    yaw: 0,
    pitch: 0,
    health: 100,
    score: 0,
    scoreBonusMultiplier: 1,
    toolInstances: new Map(),
    nextToolInstanceId: 1,
    hotbar: [],
    hotbarInstanceIds: [],
    selected: 0,
    tier: 0,
    swordTier: -1,
    equipped: {},
    bagItems: [],
    hiveHoney: new Map(),
    birdNests: [],
    vineTips: new Map(),
    kills: 0,
    blocksMined: 0,
    survivalNight: false,
    firstSurvivalDay: false,
  });
  engine.chestInventories.set('4,6,4', new Map([[IRON, 7]]));
  engine.chestInventories.set('8,6,4', new Map());
  engine.saveWorld = Engine.prototype.saveWorld;
  const savedOk = engine.saveWorld(true);
  ok(savedOk, 'A sandbox world with chest block-entities can be saved');
  const saved = JSON.parse(storage.get('orerush.myworld.v1') ?? 'null');
  ok(saved?.v === 3, 'Chest contents use the v3 save format');
  ok(saved.chests.some((entry: any[]) => entry[0] === '4,6,4' && entry[1][0][0] === IRON && entry[1][0][1] === 7), 'Saved data includes the chest stack amount');
  ok(saved.chests.some((entry: any[]) => entry[0] === '8,6,4' && entry[1].length === 0), 'Saved data preserves an initialized empty chest');
}

// Partial and bulk transfer keep stack counts consistent in both directions.
{
  const engine = makeEngine();
  engine.activeChest = { x: 1, y: 6, z: 1 };
  (engine.world as any).get = (x: number, y: number, z: number) => x === 1 && y === 6 && z === 1 ? CHEST_STORAGE_OPEN : AIR;
  const key = Engine.chestCellKey(1, 6, 1);
  const chest = new Map([[IRON, 3]]);
  engine.chestInventories.set(key, chest);
  engine.inventory.set(IRON, 8);
  ok(engine.transferChestItem(IRON, 3, true), 'The player can put a full requested amount into the chest');
  ok(engine.inventory.get(IRON) === 5 && chest.get(IRON) === 6, 'Depositing subtracts from the pack and adds to the chest');
  ok(engine.transferChestItem(IRON, 2, false), 'The player can take a partial stack from the chest');
  ok(engine.inventory.get(IRON) === 7 && chest.get(IRON) === 4, 'Partial withdrawal preserves the remaining chest stack');
  ok(engine.takeAllFromChest(), 'Take all succeeds for a non-empty chest');
  ok(engine.inventory.get(IRON) === 11 && chest.size === 0, 'Take all transfers every remaining item and empties the chest');
  ok(!engine.takeAllFromChest(), 'Take all on an empty chest is rejected');
}

// Breaking a container spills saved stacks plus the reusable block; an empty chest drops only itself.
{
  const runBreak = (contents: Map<number, number>) => {
    const world = makeWorld(new Map([['2,6,2', CHEST_STORAGE]]));
    const engine = makeEngine(world);
    const key = Engine.chestCellKey(2, 6, 2);
    engine.chestInventories.set(key, contents);
    engine.chestBonusGear.set(key, []);
    const drops: Array<{ id: number; count?: number }> = [];
    engine.spawnDrop = (_x: number, _y: number, _z: number, id: number, _gear: unknown, opts: any) => {
      drops.push({ id, count: opts?.count });
      return {};
    };
    for (const method of ['rebuildAt', 'damageHeldTool', 'burst', 'addShake', 'enqueueSupportCheck', 'enqueueFluid', 'recordExplorerMining', 'syncHotbar', 'syncHud']) engine[method] = () => {};
    engine.blocksMined = 0;
    engine.combo = 0;
    engine.comboTimer = 0;
    engine.bestCombo = 0;
    engine.birdNests = [];
    engine.vineTips = new Map();
    engine.breakBlock(2, 6, 2, CHEST_STORAGE);
    return { engine, drops, world };
  };
  const filled = runBreak(new Map([[IRON, 4]]));
  ok(filled.drops.length === 2 && filled.drops.some((drop) => drop.id === IRON && drop.count === 4), 'Breaking a filled chest spills its entire saved resource stack');
  ok(filled.drops.some((drop) => drop.id === CHEST_STORAGE), 'Breaking a filled chest also drops the reusable chest block');
  ok(filled.engine.chestInventories.size === 0 && filled.world.get(2, 6, 2) === AIR, 'A broken chest is removed and its sidecar contents are cleared');
  const empty = runBreak(new Map());
  ok(empty.drops.length === 1 && empty.drops[0].id === CHEST_STORAGE, 'An empty chest drops only its reusable block');

  const falling = makeEngine(makeWorld(new Map([['2,6,2', CHEST_STORAGE], ['2,5,2', AIR]])));
  falling.chestInventories.set('2,6,2', new Map([[IRON, 2]]));
  const gravityDrops: Array<{ id: number; count?: number }> = [];
  falling.spawnDrop = (_x: number, _y: number, _z: number, id: number, _gear: unknown, opts: any) => {
    gravityDrops.push({ id, count: opts?.count });
    return {};
  };
  falling.gravQueue = [Engine.packCell(2, 6, 2)];
  falling.gravSet = new Set(falling.gravQueue);
  falling.markDirtyAt = () => {};
  falling.enqueueSupportCheck = () => {};
  falling.updateBlockGravity();
  ok(gravityDrops.some((drop) => drop.id === IRON && drop.count === 2) && gravityDrops.some((drop) => drop.id === CHEST_STORAGE), 'An unsupported chest also spills its contents instead of leaving an orphaned inventory');
}

// A submerged chest hides the water face that would otherwise be drawn through its body.
{
  const geometry = buildChunkGeometry({
    get(x: number, y: number, z: number) {
      if (x === 0 && y === 6 && z === 0) return WATER;
      if (x === 1 && y === 6 && z === 0) return CHEST_STORAGE;
      return AIR;
    },
  } as any, 0, 0);
  const normals = geometry.water?.getAttribute('normal');
  let positiveXFaces = 0;
  if (normals) for (let i = 0; i < normals.count; i++) if (normals.getX(i) > 0.9) positiveXFaces++;
  ok(positiveXFaces === 0, 'Water does not render a +X face into the adjacent chest voxel', String(positiveXFaces));
  geometry.water?.dispose();
  geometry.solid?.dispose();
  geometry.cutout?.dispose();
  geometry.decor?.dispose();
}

// Stack-count drops are awarded as a single pickup with the matching amount.
{
  const engine = makeEngine();
  engine.tier = 0;
  engine.inventory = new Map();
  engine.oresFound = 0;
  engine.wolfPetRig = null;
  engine.syncHotbar = () => {};
  engine.syncHud = () => {};
  engine.addToHotbar = () => {};
  const drop = { active: true, id: IRON, count: 4, mesh: { visible: true }, x: 0, y: 6, z: 0, fancy: null, petCarried: false, thrown: false };
  engine.collect(drop);
  ok(engine.inventory.get(IRON) === 4 && engine.oresFound === 4, 'Collecting a stack drop adds and counts every resource in the stack');
}

// A nearby wolf selects a stocked chest, swims to an underwater cache, and takes only one item.
{
  const cells = new Map<string, number>([['5,6,0', CHEST_STORAGE], ['5,7,0', WATER]]);
  const world = makeWorld(cells, true);
  const engine = makeEngine(world);
  const chestKey = Engine.chestCellKey(5, 6, 0);
  const chest = new Map([[IRON, 3]]);
  engine.chestInventories.set(chestKey, chest);
  engine.spawnDrop = (x: number, y: number, z: number, id: number, _gear: unknown, opts: any) => ({
    active: true, id, x, y, z, vx: 0, vy: 0, vz: 0, age: 0, count: opts?.count ?? 1,
    mesh: { visible: true }, clearance: 0.3, petCarried: false, fancy: null,
  });
  engine.collect = (drop: any) => { engine.collected = drop; drop.active = false; drop.petCarried = false; };
  engine.rebuildAt = () => {};
  engine.swingChestLid = () => {};
  engine.setWolfPetEquipped(true);
  const rig = engine.wolfPetRig;
  ok(engine.updateWolfPetChest(rig, 0.1), 'A nearby stocked chest triggers the wolf chest behavior');
  ok(rig.chestTarget?.x === 5 && rig.chestTarget?.swimming, 'The wolf targets the chest through a water approach');
  ok(rig.swimming, 'The wolf enters its swim state while going to the underwater chest');
  rig.group.position.set(rig.chestTarget.standX, rig.chestTarget.standY, rig.chestTarget.standZ);
  engine.updateWolfPetChest(rig, 0.1);
  ok(chest.get(IRON) === 2, 'The wolf removes exactly one resource from the chest per visit');
  ok(rig.carrying?.id === IRON && rig.carrying?.count === 1 && rig.carrying.petCarried, 'The wolf carries one physical resource item back to the player');
  rig.group.position.set(engine.pos.x + 1, engine.pos.y, engine.pos.z);
  engine.updateWolfPetDelivery(rig, 0.1, false);
  ok(engine.collected?.id === IRON && engine.collected?.count === 1, 'The carried resource is delivered through the normal collection path');
  ok(chest.get(IRON) === 2, 'Delivery does not remove a second resource from the chest');
}

export { passed, failures };
