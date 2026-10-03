/** Functional diamond-store receipts: charging, durable delivery, and cloud deduplication. */
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

const { addDiamonds, getDiamonds } = await import('../../src/game/profile');
const { buyShopItem, SHOP_ITEM_PRICES } = await import('../../src/game/shop');
const { Engine } = await import('../../src/game/engine');
const {
  applyCloudShopRewards,
  completePendingShopRewards,
  pendingShopProductRewards,
  queueShopReward,
  resetShopRewards,
} = await import('../../src/game/shopRewards');

const createEngineShell = () => {
  const engine = Object.create(Engine.prototype) as any;
  Object.assign(engine, {
    inventory: new Map<number, number>(),
    hotbar: [],
    hotbarInstanceIds: [],
    toolInstances: new Map(),
    bagItems: [],
    nextToolInstanceId: 0,
    tier: 'wood',
    swordTier: 'wood',
    scoreBonusMultiplier: 1,
    sandbox: false,
    recalcOwnedToolTiers() {},
    pushBanner() {},
    syncHotbar() {},
    syncHud() {},
  });
  return engine;
};

resetShopRewards();
addDiamonds(1_000);
ok(getDiamonds() === 1_000, 'Test account begins with a known in-game diamond balance');
const purchased = buyShopItem('chest-common');
ok(purchased.ok && purchased.cost === SHOP_ITEM_PRICES['chest-common'], 'Common chest uses the displayed diamond price');
ok(getDiamonds() === 801, 'Successful checkout charges the wallet once');
const queued = pendingShopProductRewards();
ok(Boolean(queued && queued.products.length === 1 && queued.products[0] === 'chest-common'), 'A successful purchase is durably queued for delivery');
ok(Boolean(queued && completePendingShopRewards(queued.keys)), 'The engine can acknowledge delivered receipts');
ok(pendingShopProductRewards() === null, 'Acknowledged receipts leave the pending queue');
ok(!queued || !completePendingShopRewards(queued.keys), 'The same receipt cannot be acknowledged twice');

ok(SHOP_ITEM_PRICES['netherite-pickaxe'] === 2_999 && SHOP_ITEM_PRICES['netherite-armor'] === 4_999, 'Netherite replacements retain the previous premium prices');
ok(SHOP_ITEM_PRICES['armor-epic'] === 1_999 && SHOP_ITEM_PRICES['chest-epic'] === 1_799, 'Epic gear keeps its previous checkout prices during the material upgrade');
const epicArmorEngine = createEngineShell();
const epicArmorGranted = epicArmorEngine.grantShopProductRewards(['armor-epic']);
ok(epicArmorGranted && epicArmorEngine.bagItems.length === 4 && epicArmorEngine.bagItems.every((item: any) => item.material === 'netherite' && item.rarity === 3), 'Epic armor now grants four mythic netherite pieces');
const epicChestEngine = createEngineShell();
const epicChestGranted = epicChestEngine.grantShopProductRewards(['chest-epic']);
ok(epicChestGranted && epicChestEngine.bagItems.length === 1 && epicChestEngine.bagItems[0].material === 'netherite', 'The epic loot chest grants a mythic netherite chest piece');
addDiamonds(3_000);
const netheritePickaxe = buyShopItem('netherite-pickaxe');
ok(netheritePickaxe.ok && netheritePickaxe.cost === 2_999, 'The netherite pickaxe uses its displayed legacy price and queues successfully');
const pickaxeReceipt = pendingShopProductRewards();
ok(Boolean(pickaxeReceipt?.products.includes('netherite-pickaxe')), 'The new netherite pickaxe ID is durably queued');
if (pickaxeReceipt) completePendingShopRewards(pickaxeReceipt.keys);

const beforeInsufficient = getDiamonds();
const insufficient = buyShopItem('netherite-armor');
ok(!insufficient.ok && insufficient.reason === 'not-enough', 'Insufficient funds refuse the netherite armor set');
ok(getDiamonds() === beforeInsufficient, 'A refused checkout never changes the wallet');
const unavailable = buyShopItem('pet-parrot');
ok(!unavailable.ok && unavailable.reason === 'unavailable', 'Work-in-progress pets cannot be purchased');
ok(getDiamonds() === beforeInsufficient, 'Unavailable products do not charge netherite coins');

const legacyKey = queueShopReward('diamond-armor');
const legacyQueue = pendingShopProductRewards();
ok(Boolean(legacyKey && legacyQueue?.keys.includes(legacyKey) && legacyQueue.products.includes('diamond-armor')), 'A pre-migration diamond-armor receipt remains valid for delivery');
const legacyEngine = createEngineShell();
const legacyArmorGranted = legacyEngine.grantShopProductRewards(['diamond-armor']);
ok(legacyArmorGranted && legacyEngine.bagItems.length === 6 && legacyEngine.bagItems.every((item: any) => item.material === 'diamond'), 'Legacy receipts still receive the original six-piece diamond armor set');
if (legacyQueue) completePendingShopRewards(legacyQueue.keys);

const second = buyShopItem('booster-score');
ok(second.ok && second.cost === SHOP_ITEM_PRICES['booster-score'], 'A score booster queues as a paid in-game product');
const secondQueue = pendingShopProductRewards();
ok(Boolean(secondQueue?.products.includes('booster-score')), 'The next-run booster remains pending until the engine applies it');

// Cloud merge unions receipts and lets a delivered marker win over stale pending copies.
const pendingKey = secondQueue?.keys[0] ?? '';
applyCloudShopRewards({
  pending: pendingKey ? [{ id: pendingKey, productId: 'booster-score' }] : [],
  delivered: pendingKey ? [pendingKey] : [],
});
ok(pendingShopProductRewards() === null, 'A cloud-delivered marker prevents a stale receipt from being granted again');

export { passed, failures };
