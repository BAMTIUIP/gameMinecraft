/** Mission chain: wooden sword → bird feather → wooden bow → arrows → hunt meat → campfire → cook. */
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
const { STONE, COAL_ORE, FEATHER, MEAT_ITEM_IDS } = await import('../../src/game/blocks');
const { RECIPES } = await import('../../src/game/recipes');
const { LANGS, formatObjectiveTitle, setLang } = await import('../../src/game/i18n');

const order = EXPLORATION_TASKS.map((task) => task.id);
const idx = (id: string) => order.indexOf(id);
ok(EXPLORATION_TASKS.length === 37, 'Explorer has 37 missions', `got ${EXPLORATION_TASKS.length}`);
ok(
  idx('wood-sword') < idx('bird-feather') && idx('bird-feather') < idx('wood-bow') &&
  idx('wood-bow') < idx('stone') && idx('stone') < idx('stone-pick') &&
  idx('stone-pick') < idx('coal') && idx('coal') < idx('arrows') &&
  idx('arrows') < idx('hunt-meat') && idx('hunt-meat') < idx('campfire') &&
  idx('campfire') < idx('cooked-meat'),
  'Early missions guide the player from a wooden sword and feather to bow, arrows, hunting, then cooking',
  JSON.stringify(order.slice(0, 14)),
);
ok(new Set(order).size === order.length, 'Mission ids are unique (no duplicate missions)');

for (const { id: lang } of LANGS) {
  setLang(lang);
  for (const task of EXPLORATION_TASKS) {
    const title = formatObjectiveTitle(task.titleKey, task.target);
    ok(!/\{[a-zA-Z0-9_]+\}/.test(title), `Mission title has no unresolved placeholders (${lang}/${task.id})`, title);
  }
}
setLang('ru');
ok(formatObjectiveTitle('objectiveMineStone', 10) === 'Добудь каменных блоков: 10', 'Russian mission target renders as the actual number');
setLang('en');

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
const rawChicken = MEAT_ITEM_IDS.chicken.small.raw;

// The feather mission only completes when the player actually collects a feather, not merely meat.
{
  const engine = makeEngine();
  engine.objectiveIndex = idx('bird-feather');
  engine.recordExplorerCollect(rawChicken);
  ok(taskOf(engine, 'bird-feather').progress === 0, 'Raw meat alone does not satisfy the feather hunt');
  engine.recordExplorerCollect(FEATHER);
  ok(taskOf(engine, 'bird-feather').progress === 1, 'Picking up a feather completes the bird-hunt mission');
  ok(engine.objectiveIndex === idx('wood-bow'), 'The bow mission unlocks after collecting the feather');
  ok(taskOf(engine, 'hunt-meat').progress === 1, 'Meat gathered during the first hunt is saved for the later hunting mission');
}

// The basic bow comes before the basic arrows, whose real recipe consumes a feather.
{
  const engine = makeEngine();
  engine.objectiveIndex = idx('wood-bow');
  const bow = RECIPES.find((recipe: any) => recipe?.key === 'bow');
  const arrows = RECIPES.find((recipe: any) => recipe?.key === 'arrows');
  ok(!!bow && bow.kind === 'bow' && bow.tier === 0, 'Bow mission is tied to crafting the wooden bow');
  ok(!!arrows && arrows.inputs.some(([id, count]: [number, number]) => id === FEATHER && count === 1), 'Basic arrows really require one feather');
  engine.recordExplorerCraft(bow);
  ok(engine.objectiveIndex === idx('stone'), 'Crafting the wooden bow completes that mission');
}

// Cooking cannot complete the hunt-meat step; collecting raw meat can.
{
  const engine = makeEngine();
  engine.objectiveIndex = idx('hunt-meat');
  engine.recordExplorerCook();
  ok(engine.objectiveIndex === idx('hunt-meat'), 'Cooking does not skip the prerequisite meat hunt');
  engine.recordExplorerCollect(rawChicken, 3);
  ok(taskOf(engine, 'hunt-meat').progress === 3, 'Collecting three portions of raw meat completes the hunt');
  ok(engine.objectiveIndex === idx('campfire'), 'The campfire mission follows the meat hunt');
}

// Cooking through the crafting menu, using one of the real per-meat recipes.
{
  const engine = makeEngine();
  engine.objectiveIndex = idx('cooked-meat');
  engine.recordExplorerCraft(cookRecipes[0]);
  ok(taskOf(engine, 'cooked-meat').progress === 1, 'Crafting a cooked-meat recipe completes the cooking mission');
}

// Right-click roasting at a campfire also counts as cooking.
{
  const engine = makeEngine();
  engine.objectiveIndex = idx('cooked-meat');
  engine.recordExplorerCook();
  ok(taskOf(engine, 'cooked-meat').progress === 1, 'Roasting meat at the campfire completes the cooking mission');
}

// Full resource chain: stone → stone pickaxe → coal → basic arrows → hunted meat → campfire → cooking.
{
  const engine = makeEngine();
  const taskIndex = (id: string) => engine.explorationObjectives.findIndex((task: any) => task.id === id);
  engine.explorationObjectives.slice(0, taskIndex('stone')).forEach((task: any) => { task.progress = task.target; });
  engine.objectiveIndex = taskIndex('stone');
  engine.recordExplorerMining(STONE, 10);
  ok(engine.objectiveIndex === taskIndex('stone-pick'), 'Mining 10 stone unlocks the stone pickaxe mission');
  engine.recordExplorerCraft({ kind: 'pickaxe', tier: 1, key: 'stone_pickaxe' });
  ok(engine.objectiveIndex === taskIndex('coal'), 'Crafting the stone pickaxe unlocks the coal mission');
  engine.recordExplorerMining(COAL_ORE, 5);
  ok(engine.objectiveIndex === taskIndex('arrows'), 'Mining 5 coal unlocks the basic-arrow mission');
  engine.recordExplorerCraft(RECIPES.find((recipe: any) => recipe?.key === 'arrows'));
  ok(engine.objectiveIndex === taskIndex('hunt-meat'), 'Crafting basic arrows unlocks the hunting mission');
  engine.recordExplorerCollect(rawChicken, 3);
  ok(engine.objectiveIndex === taskIndex('campfire'), 'Collecting raw meat unlocks the campfire mission');
  engine.recordExplorerCraft(RECIPES.find((recipe: any) => recipe?.key === 'campfire'));
  ok(engine.objectiveIndex === taskIndex('cooked-meat'), 'The cooking mission only follows the campfire and hunt');
  engine.recordExplorerCook();
  ok(engine.objectiveIndex === taskIndex('stone-arrows'), 'Cooking meat completes the early survival chain');
}

export { passed, failures };
