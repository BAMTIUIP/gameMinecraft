const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};

const iconCanvases: Array<{ ops: string[] }> = [];
function makeCanvas() {
  const ops: string[] = [];
  let path: string[] = [];
  const context = {
    imageSmoothingEnabled: true,
    fillStyle: '#000000',
    clearRect: (...args: number[]) => ops.push(`clear:${args.join(',')}`),
    fillRect(this: { fillStyle: string }, ...args: number[]) { ops.push(`rect:${this.fillStyle}:${args.join(',')}`); },
    beginPath: () => { path = []; },
    moveTo: (x: number, y: number) => path.push(`M${x},${y}`),
    lineTo: (x: number, y: number) => path.push(`L${x},${y}`),
    closePath: () => path.push('Z'),
    fill(this: { fillStyle: string }) { ops.push(`poly:${this.fillStyle}:${path.join('')}`); },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: () => `data:image/mock,${encodeURIComponent(ops.join('|'))}`,
  };
  iconCanvases.push({ ops });
  return canvas;
}

const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });
globals.document = {
  title: '',
  documentElement: { lang: '' },
  addEventListener() {},
  removeEventListener() {},
  createElement: (tag: string) => tag === 'canvas' ? makeCanvas() : { style: {}, classList: { add() {}, remove() {} } },
};

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};

const THREE = await import('three');
const { ARROW_IDS, buildArrowModel, getArrowTheme, isArrowId } = await import('../../src/game/arrowVisuals');
const { getBlockIcon } = await import('../../src/game/textures');
const { Engine } = await import('../../src/game/engine');
const { sfx } = await import('../../src/game/audio');
const { getItemInvCategory, isToolId } = await import('../../src/game/recipes');
const { AIR, STONE, BLOCKS, isMeatItem, isResource } = await import('../../src/game/blocks');

ok(ARROW_IDS.length === 9, 'The shared visual catalogue includes all nine arrow types');
ok(ARROW_IDS.every((id) => isArrowId(id)), 'Every catalogued arrow ID is recognized');
ok(!isArrowId(-1) && !isArrowId(999), 'Non-arrow items are not treated as ammunition');
ok(ARROW_IDS.every((id) => !isMeatItem(id)), 'Arrow IDs do not alias dynamically generated meat items');
ok(ARROW_IDS.every((id) => BLOCKS[id]?.id === id && isResource(id)), 'Every arrow has a correctly indexed block definition and stays a non-placeable resource');
ok(ARROW_IDS.every((id) => getItemInvCategory(id) === 'tools'), 'All arrow types belong to the tools inventory tab');
ok(ARROW_IDS.every((id) => !isToolId(id)), 'Arrows remain stackable ammunition rather than being treated as durable tools');
ok(new Set(ARROW_IDS.map((id) => getArrowTheme(id).kind)).size === ARROW_IDS.length, 'Every arrow has its own visual theme');

const iconUrls = ARROW_IDS.map((id) => getBlockIcon(id));
ok(new Set(iconUrls).size === ARROW_IDS.length, 'Inventory icons are individually redrawn for each arrow type');
ok(ARROW_IDS.every((id, index) => getBlockIcon(id) === iconUrls[index]), 'Arrow icons reuse their cached pixel-art data URLs');
ok(iconCanvases.length === ARROW_IDS.length && iconCanvases.every(({ ops }) => ops.length > 12), 'Each icon draws a complete pixel arrow with separate shaft, feathers and point details');

const signatures = new Set<string>();
for (const id of ARROW_IDS) {
  const model = buildArrowModel(id);
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) meshes.push(mesh);
  });
  const colors = meshes.map((mesh) => {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const shaded = material as THREE.MeshLambertMaterial;
    return `${mesh.geometry.type}:${shaded.color.getHexString()}:${shaded.emissive.getHexString()}`;
  });
  signatures.add(colors.join('|'));
  ok(model.userData.arrowId === id && meshes.length >= 18, `Arrow ${id} has a complete typed 3D model`);
  ok(meshes.some((mesh) => mesh.geometry instanceof THREE.ConeGeometry), `Arrow ${id} has a pointed head rather than a cube placeholder`);
}
ok(signatures.size === ARROW_IDS.length, 'All nine 3D arrows have distinguishable geometry/material signatures');

// The world-pickup builder routes arrows through the same model used by hand-held items.
const engine = Object.create(Engine.prototype) as unknown as { buildFancyDrop: (id: number) => THREE.Group | null };
for (const id of ARROW_IDS) {
  const dropped = engine.buildFancyDrop(id);
  ok(dropped instanceof THREE.Group && dropped.userData.arrowId === id, `Dropped arrow ${id} uses its matching miniature model`);
}

const impactEngine = Object.create(Engine.prototype) as unknown as {
  scene: THREE.Scene;
  stuckArrows: Array<{ id: number; x: number; y: number; z: number; blockX: number; blockY: number; blockZ: number; mesh: THREE.Group }>;
  world: { get: (x: number, y: number, z: number) => number };
  pos: THREE.Vector3;
  inventory: Map<number, number>;
  addToHotbar: (id: number) => void;
  syncHotbar: (force: boolean) => void;
  syncHud: (force: boolean) => void;
  spawnDrop: (x: number, y: number, z: number, id: number) => void;
  stickArrowInBlock: (arrow: { x: number; y: number; z: number; vx: number; vy: number; vz: number; arrowId?: number }) => void;
  updateStuckArrows: () => void;
};
const impactScene = new THREE.Scene();
let impactBlock = STONE;
const recoveredArrows: number[] = [];
const pickedArrows: number[] = [];
const impactPos = new THREE.Vector3(100, 100, 100);
Object.assign(impactEngine, {
  scene: impactScene,
  stuckArrows: [],
  pos: impactPos,
  inventory: new Map<number, number>(),
  addToHotbar: (id: number) => pickedArrows.push(id),
  syncHotbar() {},
  syncHud() {},
  world: { get: () => impactBlock },
  spawnDrop: (_x: number, _y: number, _z: number, id: number) => recoveredArrows.push(id),
});
const impactArrowId = ARROW_IDS[4];
impactEngine.stickArrowInBlock({ x: 4.4, y: 7.2, z: 9.3, vx: 0, vy: 0, vz: -18, arrowId: impactArrowId });
const embeddedArrow = impactEngine.stuckArrows[0]?.mesh;
ok(embeddedArrow?.parent === impactScene && embeddedArrow.userData.arrowId === impactArrowId && embeddedArrow.userData.stuckInBlock === true, 'A missed projectile leaves its matching 3D model embedded in the solid block');
impactBlock = AIR;
impactEngine.updateStuckArrows();
ok(impactEngine.stuckArrows.length === 0 && embeddedArrow?.parent === null && recoveredArrows[0] === impactArrowId, 'Removing the supporting block releases the original arrow type as a pickup');

impactBlock = STONE;
impactEngine.stickArrowInBlock({ x: 4.4, y: 7.2, z: 9.3, vx: 0, vy: 0, vz: -18, arrowId: ARROW_IDS[2] });
const walkUpArrow = impactEngine.stuckArrows[0]?.mesh;
impactEngine.updateStuckArrows();
ok(impactEngine.stuckArrows.length === 1 && walkUpArrow?.parent === impactScene, 'A stuck arrow remains embedded while the player is still far away');
const originalPickupSound = sfx.pickup;
sfx.pickup = () => {};
impactPos.set(4.4, 6.1, 9.65);
impactEngine.updateStuckArrows();
sfx.pickup = originalPickupSound;
ok(impactEngine.stuckArrows.length === 0 && walkUpArrow?.parent === null, 'Walking close removes the embedded arrow without breaking its supporting block');
ok(impactEngine.inventory.get(ARROW_IDS[2]) === 1 && pickedArrows[0] === ARROW_IDS[2], 'Proximity pickup adds the exact arrow type directly to the inventory and hotbar');

export { passed, failures };
