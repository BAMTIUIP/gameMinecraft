/** The dropped, held and first-person worn armor paths share the slot-specific enchanted model. */
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
const { makeItem, gearColor } = await import('../../src/game/items');
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
ok(heldModel?.name === `dropped-armor-${heldItem.slot}-${heldItem.material}`, 'The first-person held item uses the same slot/material armor builder as ground loot');
ok(engine.toolGear.visible && gearColor(heldItem) === '#c85c2d', 'Held armor displays the affix-driven enamel used by its inventory icon');
ok(Boolean(firstPersonGauntlet && engine.firstPersonGlove.visible), 'Equipped gloves remain visible in the first-person view model');

const fxKinds: string[] = [];
const animatedOpacity = new Map<string, Array<{ current: number; base: number }>>();
heldModel?.traverse((object: THREE.Object3D) => {
  const fx = object.userData.armorFx as { kind?: string; opacity?: number } | undefined;
  if (!fx?.kind) return;
  fxKinds.push(fx.kind);
  const mesh = object as THREE.Mesh;
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (fx.kind === 'fire-stripe' || fx.kind === 'vamp-haze') {
    const values = animatedOpacity.get(fx.kind) ?? [];
    values.push({ current: material.opacity, base: fx.opacity ?? 0 });
    animatedOpacity.set(fx.kind, values);
  }
});
ok(fxKinds.filter((kind) => kind === 'rarity-gem').length === 5, 'Red mythic armor receives five rarity ornaments');
ok(fxKinds.includes('fire-stripe') && fxKinds.includes('vamp-haze') && fxKinds.includes('magnet-ring') && fxKinds.includes('frost-crystal'), 'Affixes add animated fire stripes, vampiric haze and separate elemental ornaments');
ok(['fire-stripe', 'vamp-haze'].every((kind) => (animatedOpacity.get(kind) ?? []).some(({ current, base }) => Math.abs(current - base) > 0.001)), 'Held armor animates its pulsing fire bands and translucent vampiric haze');
const gloveFxKinds: string[] = [];
firstPersonGauntlet?.traverse((object: THREE.Object3D) => {
  const kind = (object.userData.armorFx as { kind?: string } | undefined)?.kind;
  if (kind) gloveFxKinds.push(kind);
});
ok(gloveFxKinds.includes('fire-stripe') && gloveFxKinds.includes('vamp-haze'), 'The first-person glove shares the equipped item’s animated buff effects');

const dropModel = engine.buildArmorDropModel(heldItem) as THREE.Group;
const modelSignature = (root: THREE.Object3D) => {
  const result: string[] = [];
  root.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const geometry = mesh.geometry as THREE.BoxGeometry;
    const parameters = (geometry as THREE.BoxGeometry).parameters;
    const fx = (mesh.userData.armorFx as { kind?: string } | undefined)?.kind ?? '';
    result.push([
      geometry.type,
      parameters.width,
      parameters.height,
      parameters.depth,
      material.color?.getHexString?.() ?? '',
      fx,
      fx ? '' : `${mesh.position.x},${mesh.position.y},${mesh.position.z}`,
    ].join(':'));
  });
  return result.join('|');
};
ok(!!heldModel && modelSignature(heldModel) === modelSignature(dropModel), 'Held armor meshes, slot silhouette, color and affix effects match the dropped model exactly');

export { passed, failures };
