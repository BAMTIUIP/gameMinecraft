/** Durable direct-purchase receipts, delivery grants and cloud deduplication. */
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

const shopModule = await import('../../src/game/shop');
const { Engine } = await import('../../src/game/engine');
const {
  SHOP_PRODUCT_IDS,
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
    tier: 0,
    swordTier: -1,
    scoreBonusMultiplier: 1,
    sandbox: false,
    recalcOwnedToolTiers() {},
    pushBanner() {},
    syncHotbar() {},
    syncHud() {},
    addToHotbar() {},
  });
  return engine;
};

resetShopRewards();
ok(SHOP_PRODUCT_IDS.includes('armor-uncommon') && SHOP_PRODUCT_IDS.includes('chest-common'), 'The paid catalogue lists individual reward SKUs');
ok(!SHOP_PRODUCT_IDS.some((id) => id.startsWith('diamonds-')), 'Coin-pack SKUs are absent from the supported products');
ok(!('buyDiamondPack' in shopModule) && !('buyShopItem' in shopModule), 'The old wallet and in-game charge APIs no longer exist');

const queuedId = queueShopReward('chest-common');
let queued = pendingShopProductRewards();
ok(Boolean(queuedId && queued?.products.length === 1 && queued.products[0] === 'chest-common'), 'A direct product receipt is durably queued for delivery');
ok(Boolean(queued && completePendingShopRewards(queued.keys)), 'The engine can acknowledge delivered receipts');
ok(pendingShopProductRewards() === null, 'Acknowledged receipts leave the pending queue');
ok(!queued || !completePendingShopRewards(queued.keys), 'The same receipt cannot be acknowledged twice');

const epicArmorEngine = createEngineShell();
const epicArmorGranted = epicArmorEngine.grantShopProductRewards(['armor-epic']);
ok(epicArmorGranted && epicArmorEngine.bagItems.length === 4 && epicArmorEngine.bagItems.every((item: any) => item.material === 'netherite' && item.rarity === 3), 'The epic armor SKU grants four mythic netherite pieces');
const epicChestEngine = createEngineShell();
const epicChestGranted = epicChestEngine.grantShopProductRewards(['chest-epic']);
ok(epicChestGranted && epicChestEngine.bagItems.length === 1 && epicChestEngine.bagItems[0].material === 'netherite', 'The epic chest SKU grants its mythic netherite chest piece');
const chestRewardsEngine = createEngineShell();
const chestRewardsGranted = chestRewardsEngine.grantShopProductRewards(['chest-common', 'chest-rare']);
ok(chestRewardsGranted && chestRewardsEngine.inventory.size > 0 && chestRewardsEngine.bagItems.length === 1, 'Common and rare direct SKUs grant their matching resources and gear');

const netheritePick = queueShopReward('netherite-pickaxe');
const pickReceipt = pendingShopProductRewards();
ok(Boolean(netheritePick && pickReceipt?.products.includes('netherite-pickaxe')), 'The netherite pickaxe reward can be queued by its direct SKU');
if (pickReceipt) completePendingShopRewards(pickReceipt.keys);

const unsupported = queueShopReward('diamonds-100');
ok(unsupported === null, 'A retired coin-pack ID cannot create a reward receipt');
const unknown = queueShopReward('pet-parrot');
ok(unknown === null, 'An unrelated or unsupported SKU cannot create a reward receipt');

// Older queued gear receipts remain valid for delivery after the catalogue transition.
const legacyKey = queueShopReward('diamond-armor');
const legacyQueue = pendingShopProductRewards();
ok(Boolean(legacyKey && legacyQueue?.keys.includes(legacyKey) && legacyQueue.products.includes('diamond-armor')), 'An already queued legacy gear receipt is retained');
const legacyEngine = createEngineShell();
const legacyArmorGranted = legacyEngine.grantShopProductRewards(['diamond-armor']);
ok(legacyArmorGranted && legacyEngine.bagItems.length === 6 && legacyEngine.bagItems.every((item: any) => item.material === 'diamond'), 'Legacy receipts still deliver the originally purchased six-piece diamond armor set');
if (legacyQueue) completePendingShopRewards(legacyQueue.keys);

const boosterId = queueShopReward('booster-score');
const boosterQueue = pendingShopProductRewards();
ok(Boolean(boosterId && boosterQueue?.products.includes('booster-score')), 'A score booster remains pending until the engine accepts it');

const pendingKey = boosterQueue?.keys[0] ?? '';
applyCloudShopRewards({
  pending: pendingKey ? [{ id: pendingKey, productId: 'booster-score' }] : [],
  delivered: pendingKey ? [pendingKey] : [],
});
ok(pendingShopProductRewards() === null, 'A cloud-delivered marker wins over a stale pending copy');

export { passed, failures };
