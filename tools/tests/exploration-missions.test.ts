/** Exploration mission order: stone → stone pickaxe → coal must come before the campfire, and any cooked meat counts. */
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
const { Engine, EXPLORATION_TASKS } = await import('../../src/game/engine');
const { STONE, COAL_ORE } = await import('../../src/game/blocks');
const { RECIPES } = await import('../../src/game/recipes');

const order = EXPLORATION_TASKS.map((task) => task.id);
const campfireAt = order.indexOf('campfire');
ok(campfireAt > 0, 'Campfire mission exists');
for (const id of ['stone', 'stone-pick', 'coal']) {
  const at = order.indexOf(id);
  ok(at >= 0 && at < campfireAt, `${id} mission comes before the campfire`, `index ${at}, campfire ${campfireAt}`);
}
ok(order.indexOf('stone') < order.indexOf('stone-pick') && order.indexOf('stone-pick') < order.indexOf('coal'),
  'Order is stone → stone pickaxe → coal');
ok(order.indexOf('cooked-meat') > campfireAt && order.indexOf('hunt-meat') > campfireAt, 'Cooking missions come after the campfire');
ok(new Set(order).size === order.length, 'Mission ids are unique (no duplicate missions)');

function makeEngine() {
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, {
    endlessRun: false,
    timeLeft: 1200,
    pos: new THREE.Vector3(),
    explorationObjectives: EXPLORATION_TASKS.map((task) => ({ ...task, progress: 0 })),
    objectiveIndex: 0,
    score: 0,
    scoreBonusMultiplier: 1,
    popup() {},
    pushBanner() {},
    awardScore(base: number) { engine.score += base; return base; },
  });
  return engine;
}

const taskOf = (engine: any, id: string) => engine.explorationObjectives.find((task: any) => task.id === id);
const cookRecipes = RECIPES.filter((r: any) => r && r.kind === 'cook');

// Cooking through the crafting menu, using one of the real per-meat recipes.
{
  const engine = makeEngine();
  engine.objectiveIndex = engine.explorationObjectives.findIndex((task: any) => task.id === 'cooked-meat');
  engine.recordExplorerCraft(cookRecipes[0]);
  ok(taskOf(engine, 'cooked-meat').progress === 1, 'Crafting a cooked-meat recipe completes the cooked-meat mission');
}

// Right-click roasting at a campfire (the path that used to be ignored).
{
  const engine = makeEngine();
  engine.objectiveIndex = engine.explorationObjectives.findIndex((task: any) => task.id === 'cooked-meat');
  for (let i = 0; i < 3; i++) engine.recordExplorerCook();
  ok(taskOf(engine, 'cooked-meat').progress === 1, 'Roasting meat at the campfire completes the cooked-meat mission');
  ok(taskOf(engine, 'hunt-meat').progress === 3, 'Roasting three portions completes the batch mission', `progress ${taskOf(engine, 'hunt-meat').progress}`);
}

// Full chain: stone → stone pickaxe → coal → campfire → meat, with cooked meat counted.
{
  const engine = makeEngine();
  const idx = (id: string) => engine.explorationObjectives.findIndex((task: any) => task.id === id);
  engine.explorationObjectives.slice(0, idx('stone')).forEach((task: any) => { task.progress = task.target; });
  engine.objectiveIndex = idx('stone');
  engine.recordExplorerMining(STONE, 10);
  ok(engine.objectiveIndex === idx('stone-pick'), 'Mining 10 stone unlocks the stone pickaxe mission');
  engine.recordExplorerCraft({ kind: 'pickaxe', tier: 1, key: 'stone_pickaxe' });
  ok(engine.objectiveIndex === idx('coal'), 'Crafting the stone pickaxe unlocks the coal mission');
  engine.recordExplorerMining(COAL_ORE, 5);
  ok(engine.objectiveIndex === idx('campfire'), 'Mining 5 coal unlocks the campfire mission');
  engine.recordExplorerCraft(RECIPES.find((r: any) => r && r.key === 'campfire'));
  ok(engine.objectiveIndex === idx('cooked-meat'), 'Crafting the campfire unlocks the cooking missions');
  engine.recordExplorerCook();
  engine.recordExplorerCook();
  engine.recordExplorerCook();
  ok(engine.objectiveIndex === idx('arrows'), 'Cooking three portions completes both cooking missions');
}

export { passed, failures };
