/** Held, dropped and worn armor share painted buff/rarity textures instead of detached effect meshes. */
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
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en', userAgent: 'node' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};

const THREE = await import('three');
const { makeItem, gearColor, MATERIALS } = await import('../../src/game/items');
const { Engine } = await import('../../src/game/engine');
const { mulberry32 } = await import('../../src/game/noise');

const heldItem = makeItem('head', 'iron', 4, mulberry32(0x4129));
heldItem.affixes = [
  { id: 'fire', value: 5 },
  { id: 'vamp', value: 3 },
  { id: 'magnet', value: 6 },
  { id: 'frost', value: 25 },
];
const wornHands = makeItem('hands', 'diamond', 4, mulberry32(0x91a7));
wornHands.affixes = [
  { id: 'fire', value: 4 },
  { id: 'vamp', value: 2 },
  { id: 'swift', value: 11 },
  { id: 'thorns', value: 18 },
];

const engine = Object.create(Engine.prototype) as any;
const group = () => new THREE.Group();
Object.assign(engine, {
  toolPick: group(),
  toolCrafted: group(),
  toolHand: group(),
  toolSword: group(),
  toolBlock: group(),
  toolItem: group(),
  toolLantern: group(),
  toolTorch: group(),
  toolAxe: group(),
  toolShovel: group(),
  toolHoe: group(),
  toolBow: group(),
  toolGear: group(),
  firstPersonGlove: group(),
  toolGearKey: '',
  firstPersonGloveKey: '',
  bagItems: [heldItem],
  equipped: { hands: wornHands },
  hotbar: [heldItem.hid],
  selected: 0,
  phase: 'playing',
  thirdPerson: false,
  time: 1.2,
  stats: { fire: 0 },
  viewFireFx: null,
  torchLight: { visible: false, intensity: 0 },
  heldKind: () => 'gear',
  syncThirdPersonHeldItem() {},
});

engine.syncViewModel();
const heldModel = engine.toolGear.children[0] as THREE.Group | undefined;
const firstPersonGauntlet = engine.firstPersonGlove.children[0] as THREE.Group | undefined;
ok(heldModel?.name === `dropped-armor-${heldItem.slot}-${heldItem.material}`, 'First-person held armor uses the same slot/material model builder as ground loot');
ok(engine.toolGear.visible && gearColor(heldItem) === MATERIALS[heldItem.material].color, 'Held armor keeps the material colour shared with its inventory icon');
ok(Boolean(firstPersonGauntlet && engine.firstPersonGlove.visible), 'Equipped gloves remain visible in the first-person view model');

function surfaceMaterial(root: THREE.Object3D | undefined): THREE.MeshLambertMaterial | null {
  if (!root) return null;
  let found: THREE.MeshLambertMaterial | null = null;
  root.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || found) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const match = materials.find((material) => material.userData.armorSurfaceFx);
    if (match) found = match as THREE.MeshLambertMaterial;
  });
  return found;
}

function pixel(texture: THREE.Texture | null, x: number, y: number): string | null {
  const data = (texture as THREE.DataTexture | null)?.image?.data as Uint8Array | undefined;
  if (!data) return null;
  const index = (y * 64 + x) * 4;
  return `#${[data[index], data[index + 1], data[index + 2]].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

const armorSurface = surfaceMaterial(heldModel);
const surfaceFx = armorSurface?.userData.armorSurfaceFx as { baseIntensity: number; hasFire: boolean; hasVamp: boolean } | undefined;
ok(armorSurface?.map instanceof THREE.DataTexture && armorSurface.emissiveMap instanceof THREE.DataTexture, 'Armor panels use painted diffuse and emissive surface textures');
ok(Boolean(surfaceFx?.hasFire && surfaceFx.hasVamp), 'Buff animation is attached to the armor-surface material');
ok(pixel(armorSurface?.map ?? null, 0, 0) === gearColor(heldItem), 'The armor texture base pixels match the item color exactly');
ok(pixel(armorSurface?.map ?? null, 14, 20) === '#ff8a2b' && pixel(armorSurface?.emissiveMap ?? null, 14, 20) === '#ff8a2b', 'Fire stripes are colored and emissive pixels in the armor texture');
ok(pixel(armorSurface?.map ?? null, 14, 8) === '#ff5364', 'Rarity points are painted into the helmet panel texture, not placed over the face');
ok(Math.abs((armorSurface?.emissiveIntensity ?? 0) - (surfaceFx?.baseIntensity ?? 0)) > 0.005, 'The painted fire and vampiric pixels pulse through surface emissive intensity');

const strayFxMeshes: string[] = [];
heldModel?.traverse((object: THREE.Object3D) => {
  if (object.userData.armorFx || object.name === 'armor-vampiric-haze' || object.name === 'armor-magnetic-orbit') {
    strayFxMeshes.push(object.name || 'unnamed armor effect');
  }
});
ok(strayFxMeshes.length === 0, 'Buff and rarity visuals no longer create floating meshes around the armor or face');

const gloveSurface = surfaceMaterial(firstPersonGauntlet);
const gloveFx = gloveSurface?.userData.armorSurfaceFx as { hasFire?: boolean; hasVamp?: boolean } | undefined;
ok(Boolean(gloveSurface?.map instanceof THREE.DataTexture && gloveFx?.hasFire && gloveFx.hasVamp), 'First-person gloves use the equipped item’s animated painted buff texture');

const dropModel = engine.buildArmorDropModel(heldItem) as THREE.Group;
const hashTexture = (texture: THREE.Texture | null | undefined) => {
  const data = (texture as THREE.DataTexture | null | undefined)?.image?.data as Uint8Array | undefined;
  if (!data) return '';
  let hash = 2166136261;
  for (const value of data) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(16);
};
const modelSignature = (root: THREE.Object3D) => {
  const result: string[] = [];
  root.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const geometry = mesh.geometry as THREE.BoxGeometry;
    const parameters = geometry.parameters;
    result.push([
      geometry.type,
      parameters.width,
      parameters.height,
      parameters.depth,
      material.color?.getHexString?.() ?? '',
      hashTexture((material as THREE.MeshLambertMaterial).map),
      hashTexture((material as THREE.MeshLambertMaterial).emissiveMap),
      `${mesh.position.x},${mesh.position.y},${mesh.position.z}`,
    ].join(':'));
  });
  return result.join('|');
};
ok(!!heldModel && modelSignature(heldModel) === modelSignature(dropModel), 'Held armor matches the dropped model in silhouette, color and painted affix textures');

export { passed, failures };
