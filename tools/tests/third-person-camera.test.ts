/** Third-person orbit controls keep player facing separate from camera yaw and preserve avatar gear visuals. */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
const globals = globalThis as unknown as Record<string, unknown>;
globals.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
globals.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};

const THREE = await import('three');
const { Engine } = await import('../../src/game/engine');

// The orbit angle wraps and never changes the character's own facing direction.
{
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, { phase: 'playing', thirdPerson: true, thirdPersonOrbitYaw: 0, inventoryOpen: false, yaw: 1.2 });
  engine.orbitThirdPersonCamera(Math.PI / 2);
  ok(Math.abs(engine.thirdPersonOrbitYaw + Math.PI / 2) < 1e-9, 'Mouse/touch orbit changes the camera yaw offset');
  ok(engine.yaw === 1.2, 'Orbiting the camera does not rotate the character or alter movement direction');
  engine.orbitThirdPersonCamera(-4 * Math.PI);
  ok(Math.abs(engine.thirdPersonOrbitYaw + Math.PI / 2) < 1e-9, 'Large orbit deltas wrap without changing the current angle');
  engine.thirdPerson = false;
  engine.orbitThirdPersonCamera(1);
  ok(Math.abs(engine.thirdPersonOrbitYaw + Math.PI / 2) < 1e-9, 'First-person camera controls remain unaffected by the orbit-only input');
}

// The orbit is held during camera inspection, then eases to the back view on movement input.
{
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, {
    thirdPerson: true,
    thirdPersonOrbitYaw: 1.2,
    keys: {},
    tv: false,
    touchMove: { x: 0, y: 0 },
    vel: new THREE.Vector3(),
  });
  engine.updateThirdPersonOrbitReturn(0.1);
  ok(engine.thirdPersonOrbitYaw === 1.2, 'An idle avatar keeps the manually selected orbit angle');
  engine.keys.KeyW = true;
  engine.keys.AltLeft = true;
  engine.updateThirdPersonOrbitReturn(0.1);
  ok(engine.thirdPersonOrbitYaw === 1.2, 'Holding Alt keeps camera inspection active while the player moves');
  engine.keys.AltLeft = false;
  engine.thirdPersonOrbitInputAt = performance.now();
  engine.updateThirdPersonOrbitReturn(0.1);
  ok(engine.thirdPersonOrbitYaw === 1.2, 'A live orbit gesture is not fought by movement recentering');
  engine.thirdPersonOrbitInputAt = performance.now() - 200;
  engine.updateThirdPersonOrbitReturn(0.1);
  ok(engine.thirdPersonOrbitYaw < 1.2 && engine.thirdPersonOrbitYaw > 0, 'Releasing Alt while moving starts a smooth return toward the back view');
  for (let i = 0; i < 20; i++) engine.updateThirdPersonOrbitReturn(0.1);
  ok(engine.thirdPersonOrbitYaw === 0, 'The camera finishes recentering behind the character');
}

// Exercise the actual armor sync path with the avatar's selected hair and a colored leggings item.
{
  const engine = Object.create(Engine.prototype) as any;
  const skirtMaterial = new THREE.MeshLambertMaterial({ color: '#345678' });
  const skirtAccent = new THREE.MeshLambertMaterial({ color: '#345678' });
  const selectedHair = new THREE.Group();
  const otherHair = new THREE.Group();
  const selectedHelmetHair = new THREE.Group();
  const otherHelmetHair = new THREE.Group();
  const avatarHead = new THREE.Group();
  const helmet = { slot: 'head', material: 'iron', rarity: 1, affixes: [{ id: 'fire', value: 3 }] };
  const leggings = { slot: 'legs', material: 'iron', visualColor: '#4d8c5a', rarity: 0, affixes: [] };
  Object.assign(engine, {
    avatarHead,
    avatarLeftArm: new THREE.Group(),
    avatarRightArm: new THREE.Group(),
    avatarLeftLeg: new THREE.Group(),
    avatarRightLeg: new THREE.Group(),
    avatarHairVariants: { short: selectedHair, long: otherHair },
    avatarHelmetHairVariants: { short: selectedHelmetHair, long: otherHelmetHair },
    avatarSkirt: new THREE.Group(),
    avatarAppearance: { skirt: skirtMaterial, skirtAccent },
    characterCustomization: { gender: 'girl', hairstyle: 'short', pantsColor: '#345678' },
    equipped: { head: helmet, legs: leggings },
    avatarArmorModels: {},
    avatarArmorFadeMats: {},
    avatarOpacity: 1,
    setPlayerAvatarOpacity() {},
  });

  engine.syncAvatarArmor();
  ok(
    !selectedHair.visible && !otherHair.visible && selectedHelmetHair.visible && !otherHelmetHair.visible,
    'A helmet switches to only the selected hairstyle’s cropped, below-helmet strands',
  );
  ok(engine.avatarSkirt.visible, 'Leggings keep the girl avatar skirt silhouette visible');
  const skirtBase = `#${skirtMaterial.color.getHexString()}`;
  const skirtAccentBase = `#${skirtAccent.color.getHexString()}`;
  ok(skirtBase === '#4d8c5a', 'The skirt fabric material takes the equipped leggings color');
  ok(skirtAccentBase !== skirtBase && skirtMaterial.map === null && skirtAccent.map === null, 'Unbuffed leggings keep a darker flat hem material without decorative texture marks');
  ok(!engine.avatarArmorModels.legs, 'Girl leggings paint the existing skirt mesh instead of adding floating armor geometry');

  const helmetGroup = engine.avatarArmorModels.head[0].group;
  const visor = helmetGroup.children.find((mesh: THREE.Object3D) => Math.abs(mesh.position.z + 0.175) < 1e-6);
  const rearShell = helmetGroup.children.find((mesh: THREE.Object3D) => Math.abs(mesh.position.z - 0.23) < 1e-6);
  ok(!!visor && !!rearShell, 'The helmet has a distinct forward brow and rear shell');
  const visorHeight = visor ? (visor.geometry as THREE.BoxGeometry).parameters.height : Infinity;
  ok(!!visor && visor.position.y - visorHeight / 2 > 0.15, 'The front brow stays above the configured face texture');
  const rearShellSize = rearShell ? (rearShell.geometry as THREE.BoxGeometry).parameters : null;
  ok(
    !!rearShellSize && rearShellSize.width >= 0.46 && rearShellSize.height >= 0.4,
    'A solid main-color shell covers the full rear of the head beneath its accent pieces',
  );
  let helmetHasPaintedTexture = false;
  let helmetHasFloatingFx = false;
  helmetGroup.traverse((object: THREE.Object3D) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if ((material as THREE.MeshLambertMaterial).map instanceof THREE.DataTexture) helmetHasPaintedTexture = true;
    if (object.userData.armorFx) helmetHasFloatingFx = true;
  });
  ok(helmetHasPaintedTexture && !helmetHasFloatingFx, 'Helmet rarity/buff marks are part of its armor texture, never separate pieces over the face');

  engine.equipped.head = undefined;
  engine.syncAvatarArmor();
  ok(selectedHair.visible && !otherHair.visible && !selectedHelmetHair.visible, 'Removing the helmet restores the full selected hairstyle');
}

export { passed, failures };
