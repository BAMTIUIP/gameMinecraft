/** Complete developer catalogue coverage and its local-only Engine gate. */
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

const { BLOCKS, AIR, BEDROCK, LAVA, WATER, isOpenChest } = await import('../../src/game/blocks');
const { MATERIALS, RARITY, SLOTS } = await import('../../src/game/items');
const { RECIPES, TOOL_TORCH } = await import('../../src/game/recipes');
const { getToolSpec } = await import('../../src/game/tools');
const { getDeveloperCatalog } = await import('../../src/game/devCatalog');
const { Engine } = await import('../../src/game/engine');
const { isDeveloperShopEnabled, setDeveloperShopEnabled } = await import('../../src/game/devShop');

const catalog = getDeveloperCatalog();
const craftableGearKeys = RECIPES
  .filter((recipe) => recipe.kind === 'gear' && recipe.slot && recipe.material)
  .map((recipe) => recipe.key);
const expectedInventoryIds = BLOCKS
  .filter((block) => block && block.id !== AIR && block.id !== BEDROCK && block.id !== LAVA && block.id !== WATER)
  .filter((block) => block.id < 200 && !isOpenChest(block.id))
  .map((block) => block.id);
ok(expectedInventoryIds.every((id) => catalog.itemIds.includes(id)), 'Every obtainable block, resource and mob-drop item is in the developer kit');
ok(catalog.itemIds.every((id) => BLOCKS[id]?.id === id && id < 200 && !isOpenChest(id)), 'Non-items, open chest states and durable tools are kept out of the resource stack list');
ok(catalog.toolIds.includes(TOOL_TORCH) && catalog.toolIds.filter((id) => id !== TOOL_TORCH).every((id) => getToolSpec(id) !== null), 'Every durable tool/weapon plus the hand torch is represented');
ok(catalog.gearVariants.length === Object.keys(MATERIALS).length * SLOTS.length * RARITY.length, 'The catalog covers every slot, material and all five rarity tiers');
ok(craftableGearKeys.every((key) => catalog.gearRecipeKeys.includes(key)), 'All crafted armor recipes, including special gear and both shields, are in the catalog');

const makeEngine = () => {
  const engine = Object.create(Engine.prototype) as any;
  const tools = new Map<number, { id: number; instanceId: number; durability: number }>();
  Object.assign(engine, {
    phase: 'playing',
    inventory: new Map<number, number>(),
    toolInstances: tools,
    bagItems: [],
    nextToolInstanceId: 1,
    hotbar: new Array(10),
    hotbarInstanceIds: new Array(10),
    selected: 0,
    addToHotbar() {},
    addToolInstance(id: number) {
      const instanceId = this.nextToolInstanceId++;
      tools.set(instanceId, { id, instanceId, durability: 100 });
      return true;
    },
    recalcOwnedToolTiers() {},
    syncHotbar() {},
    syncHud() {},
    pushBanner() {},
  });
  return engine;
};

setDeveloperShopEnabled(false);
const gatedEngine = makeEngine();
ok(!isDeveloperShopEnabled() && !gatedEngine.grantDeveloperCatalog() && gatedEngine.inventory.size === 0, 'A production-gated Engine refuses developer inventory grants');

setDeveloperShopEnabled(true);
const engine = makeEngine();
ok(engine.grantDeveloperCatalog(), 'An enabled local developer build grants the complete test kit');
ok(catalog.itemIds.every((id) => engine.inventory.get(id) === 64) && engine.inventory.get(TOOL_TORCH) === 64, 'Every resource and drop stack is granted in a full crafting stack');
ok(catalog.toolIds.filter((id) => id !== TOOL_TORCH).every((id) => [...engine.toolInstances.values()].some((tool: any) => tool.id === id)), 'Every durable tool and weapon is granted as an independent physical instance');
ok(engine.bagItems.length === catalog.gearVariants.length + catalog.gearRecipeKeys.length, 'All random armor rolls and crafted-special armor are added to the gear bag');
setDeveloperShopEnabled(false);

export { passed, failures };
