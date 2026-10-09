// Block registry: ids, atlas tiles, hardness, score value, physics flags.

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const COBBLE = 4;
export const COAL = 5;
export const IRON = 6;
export const GOLD = 7;
export const DIAMOND = 8;
export const LOG = 9;
export const LEAVES = 10;
export const SAND = 11;
export const PLANKS = 12;
export const BEDROCK = 13;
export const LAVA = 14;
export const TORCH = 15;
export const GOLD_BLOCK = 16;
export const DIAMOND_BLOCK = 17;
export const GLASS = 18;
export const DOOR_WOOD = 19;
export const DOOR_IRON = 20;
export const FENCE_WOOD = 21;
export const FENCE_STONE = 22;
export const FENCE_IRON = 23;
export const CAMPFIRE = 24;
export const PEDESTAL = 25;
export const PEDESTAL_GOLD = 26;
/** resources that live in the pack but cannot be placed */
export const RAW_MEAT = 27;
export const COOKED_MEAT = 28;
export const WEB = 29;
export const BONE = 30;
export const FLESH = 31;
export const GUNPOWDER = 32;
export const ARROW_ITEM = 33;
/** a dropped piece of gear waiting on the ground */
export const LOOT_BAG = 34;
/** Legacy upgraded-arrow IDs are reserved by the meat allocator below. */
export const STONE_ARROW = 154;
export const IRON_ARROW = 155;
export const GOLD_ARROW = 156;
export const NETHERITE_ARROW = 157;
export const FIRE_ARROW = 158;
export const POISON_ARROW = 159;
export const FREEZE_ARROW = 160;
export const STUN_ARROW = 161;
/** Canonical ammunition catalogue shared by inventory, visuals and bow loading. */
export const ARROW_IDS = [
  ARROW_ITEM,
  STONE_ARROW,
  IRON_ARROW,
  GOLD_ARROW,
  NETHERITE_ARROW,
  FIRE_ARROW,
  POISON_ARROW,
  FREEZE_ARROW,
  STUN_ARROW,
] as const;
export type ArrowId = (typeof ARROW_IDS)[number];
export const isArrowId = (id: number): id is ArrowId => ARROW_IDS.includes(id as ArrowId);
export const BED = 35;
export const WATER = 36;
export const FLOWER_RED = 37;
export const FLOWER_YELLOW = 38;
export const FLOWER_BLUE = 39;
export const LAMP_RED = 40;
export const LAMP_BLUE = 41;
export const LAMP_YELLOW = 42;
export const SNOW_GRASS = 43;
export const ICE = 44;
export const SNOW_LEAVES = 45;
export const HIVE = 46;
export const TURTLE_EGG = 47;
export const ANVIL = 48;
export const NETHERITE_ORE = 49;
/** resources (non-placeable) */
export const HONEY = 50;
export const NETHERITE = 51;
/** wool IS placeable, Minecraft-style */
export const WOOL = 52;
export const FEATHER = 53;
export const TURTLE_SHELL = 54;
export const CRAB_SHELL = 55;
export const FISH_SCALE = 56;
export const CAT_CLAW = 57;
export const PENGUIN_EGG = 58;
export const TALL_GRASS = 59;
export const FERN = 60;
export const DEAD_BUSH = 61;
export const CACTUS = 62;
export const CACTUS_PALE = 63;
export const BIRCH_LOG = 64;
export const BIRCH_LEAVES = 65;
export const APPLE_LEAVES = 66;
export const APPLE = 67;
export const CRAFTING_TABLE = 68;
export const VOLCANIC_STONE = 69;
export const PALM_LOG = 70;
export const COCONUT_LEAVES = 71;
export const BANANA_LEAVES = 72;
export const VINE = 73;
export const COCONUT = 74;
export const BANANA = 75;
export const DRY_BLOOM = 76;
export const DESERT_THISTLE = 77;
export const BIRD_NEST = 78;
export const CHICKEN_NEST = 79;
export const MUSHROOM = 80;
export const SANDSTONE = 81;
export const CHISELED_SANDSTONE = 82;
export const TERRACOTTA_ORANGE = 83;
export const HAY_BALE = 84;
/** 8 Mineral Ores (Row 1 of reference table) */
export const COAL_ORE = 85;
export const IRON_ORE = 86;
export const REDSTONE_ORE = 87;
export const GOLD_ORE = 88;
export const LAPIS_ORE = 89;
export const DIAMOND_ORE = 90;
export const EMERALD_ORE = 91;
export const QUARTZ_ORE = 92;
/** Missing Crafted Mineral Blocks (Row 3 of reference table; GOLD_BLOCK=16 & DIAMOND_BLOCK=17 already exist) */
export const COAL_BLOCK = 93;
export const IRON_BLOCK = 94;
export const REDSTONE_BLOCK = 95;
export const LAPIS_BLOCK = 96;
export const EMERALD_BLOCK = 97;
export const QUARTZ_BLOCK = 98;
/** Missing Mineral Items / Materials (Row 2 of reference table; COAL=5, IRON=6, GOLD=7, DIAMOND=8 already exist) */
export const REDSTONE = 99;
export const LAPIS = 100;
export const EMERALD = 101;
export const QUARTZ = 102;
/** seasonal canopy and flowering-tree foliage */
export const AUTUMN_LEAVES = 103;
export const CHERRY_LEAVES = 104;
export const FLOWER_PINK = 105;
export const FLOWER_PURPLE = 106;
export const FLOWER_WHITE = 107;
export const JACARANDA_LEAVES = 108;
/** refined netherite alloy used for the final tool tier */
export const NETHERITE_INGOT = 109;
/** Wheat is a carried resource; the three crop states are world-only plant blocks. */
export const WHEAT = 141;
export const WHEAT_SEEDS = 142;
export const WHEAT_CROP_1 = 143;
export const WHEAT_CROP_2 = 144;
export const WHEAT_CROP_3 = 145;
export const WHEAT_CROP_IDS = [WHEAT_CROP_1, WHEAT_CROP_2, WHEAT_CROP_3] as const;
/** Account-bound rewarded-ad packs: daily bag, weekly chest, monthly ornate chest. */
export const REWARD_PACK_DAILY = 273;
export const REWARD_PACK_WEEKLY = 274;
export const REWARD_PACK_MONTHLY = 275;

/** Expanded flora and ruins for forest biomes (reference photos) */
export const FLOWER_TULIP_RED = 276;
export const FLOWER_TULIP_YELLOW = 277;
export const FLOWER_TULIP_PINK = 278;
export const FLOWER_TULIP_ORANGE = 279;
export const FLOWER_TULIP_WHITE = 280;
export const FLOWER_SUNFLOWER = 281;
export const FLOWER_ROSE = 282;
export const FLOWER_LAVENDER = 283;
export const FLOWER_WISTERIA = 284;
export const FLOWER_DAISY = 285;
export const FLOWER_ORCHID = 286;
export const FLOWER_PEONY = 287;
export const BUSH = 288;
export const BUSH_FLOWERING = 289;
export const BERRY_BUSH = 290;
export const TALL_LAVENDER = 291;
export const TALL_SUNFLOWER = 292;
export const WISTERIA_VINE = 293;
export const MOSS_CARPET = 294;
export const LEAF_PILE = 295;
export const MOSSY_COBBLE = 296;
export const MOSSY_STONE_BRICK = 297;
export const CRACKED_STONE_BRICK = 298;
export const STONE_BRICK = 299;

/** tilled soil created by a hoe; it drops dirt when broken */
export const FARMLAND = 126;

// Placeable climbable ladders: natural woods plus flower-dyed color variants.
export const LADDER_OAK = 127;
export const LADDER_BIRCH = 128;
export const LADDER_PALM = 129;
export const LADDER_RED = 130;
export const LADDER_BLUE = 131;
export const LADDER_YELLOW = 132;
export const LADDER_GREEN = 133;
export const LADDER_PINK = 134;
export const LADDER_PURPLE = 135;
export const LADDER_WHITE = 136;
export const LADDER_STONE = 137;
export const LADDER_IRON = 138;
export const LADDER_IDS = [
  LADDER_OAK, LADDER_BIRCH, LADDER_PALM, LADDER_RED, LADDER_BLUE,
  LADDER_YELLOW, LADDER_GREEN, LADDER_PINK, LADDER_PURPLE, LADDER_WHITE,
  LADDER_STONE, LADDER_IRON,
] as const;
// The 12 ladder IDs are intentionally contiguous so this frequent geometry/collision predicate stays O(1).
export const isLadder = (id: number) => id >= LADDER_OAK && id <= LADDER_IRON;
export const LADDER_PALETTE: Record<number, { dark: number; light: number }> = {
  [LADDER_OAK]: { dark: 0x52351f, light: 0xa87439 },
  [LADDER_BIRCH]: { dark: 0x7a623e, light: 0xd8bd83 },
  [LADDER_PALM]: { dark: 0x5a4328, light: 0xb58a4e },
  [LADDER_RED]: { dark: 0x662b2b, light: 0xd55248 },
  [LADDER_BLUE]: { dark: 0x263d69, light: 0x5d91df },
  [LADDER_YELLOW]: { dark: 0x705721, light: 0xe4c144 },
  [LADDER_GREEN]: { dark: 0x2c4c32, light: 0x68aa59 },
  [LADDER_PINK]: { dark: 0x60344e, light: 0xe186b1 },
  [LADDER_PURPLE]: { dark: 0x44305c, light: 0x9d70d1 },
  [LADDER_WHITE]: { dark: 0x70716f, light: 0xe7e4dc },
  [LADDER_STONE]: { dark: 0x41454a, light: 0x9da5ac },
  [LADDER_IRON]: { dark: 0x37434a, light: 0xc2d1d7 },
};

/** biome-skinned treasure chests are non-solid block entities stored in the world grid. */
export const CHEST_PLAINS = 110;
export const CHEST_WINTER = 111;
export const CHEST_AUTUMN = 112;
export const CHEST_JUNGLE = 113;
export const CHEST_DESERT = 114;
export const CHEST_CANYON = 115;
export const CHEST_VOLCANIC = 116;
export const CHEST_UNDERWATER = 117;
export type ChestBiome = 'plains' | 'winter' | 'autumn' | 'jungle' | 'desert' | 'canyon' | 'volcanic';
export const CHEST_BY_BIOME: Record<ChestBiome, number> = {
  plains: CHEST_PLAINS,
  winter: CHEST_WINTER,
  autumn: CHEST_AUTUMN,
  jungle: CHEST_JUNGLE,
  desert: CHEST_DESERT,
  canyon: CHEST_CANYON,
  volcanic: CHEST_VOLCANIC,
};
/**
 * A looted chest swaps its block id for the matching "open" variant, so the
 * opened state lives in the chunk grid and therefore rides along in world saves.
 */
export const CHEST_PLAINS_OPEN = 118;
export const CHEST_WINTER_OPEN = 119;
export const CHEST_AUTUMN_OPEN = 120;
export const CHEST_JUNGLE_OPEN = 121;
export const CHEST_DESERT_OPEN = 122;
export const CHEST_CANYON_OPEN = 123;
export const CHEST_VOLCANIC_OPEN = 124;
export const CHEST_UNDERWATER_OPEN = 125;
/** distance between a closed chest id and its opened counterpart */
export const CHEST_STORAGE = 139;
export const CHEST_STORAGE_OPEN = 140;
/** distance between a closed chest id and its opened counterpart */
export const CHEST_OPEN_OFFSET = CHEST_PLAINS_OPEN - CHEST_PLAINS;
export const isTreasureChest = (id: number) =>
  (id >= CHEST_PLAINS && id <= CHEST_UNDERWATER_OPEN) || id === CHEST_STORAGE || id === CHEST_STORAGE_OPEN;
export const isOpenChest = (id: number) =>
  (id >= CHEST_PLAINS_OPEN && id <= CHEST_UNDERWATER_OPEN) || id === CHEST_STORAGE_OPEN;
export const isUnderwaterChest = (id: number) => id === CHEST_UNDERWATER || id === CHEST_UNDERWATER_OPEN;
export const isBiomeTreasureChest = (id: number) => {
  const base = id >= CHEST_PLAINS_OPEN && id <= CHEST_UNDERWATER_OPEN ? id - CHEST_OPEN_OFFSET : id;
  return base >= CHEST_PLAINS && base <= CHEST_UNDERWATER;
};
/** closed ↔ open counterpart of a treasure or storage chest id */
export const baseChestId = (id: number) =>
  id === CHEST_STORAGE_OPEN ? CHEST_STORAGE : isOpenChest(id) ? id - CHEST_OPEN_OFFSET : id;
export const openChestId = (id: number) => {
  const base = baseChestId(id);
  return base === CHEST_STORAGE ? CHEST_STORAGE_OPEN : base + CHEST_OPEN_OFFSET;
};

export const isOreBlock = (id: number) =>
  (id >= COAL_ORE && id <= QUARTZ_ORE) || id === NETHERITE_ORE;

/** Minimum pickaxe tier (wood=0, stone=1, iron=2, diamond=4) for mining stone and ore/block tiers. */
const MIN_PICKAXE_TIER: Partial<Record<number, number>> = {
  [STONE]: 0,
  [COBBLE]: 0,
  [COAL_ORE]: 1,
  [COAL_BLOCK]: 1,
  [IRON_ORE]: 1,
  [IRON_BLOCK]: 1,
  [QUARTZ_ORE]: 1,
  [GOLD_ORE]: 2,
  [GOLD_BLOCK]: 2,
  // Diamond ore follows the iron-pick progression; its compressed block needs diamond.
  [DIAMOND_ORE]: 2,
  [VOLCANIC_STONE]: 2,
  [REDSTONE_ORE]: 4,
  [LAPIS_ORE]: 4,
  [EMERALD_ORE]: 4,
  [REDSTONE_BLOCK]: 4,
  [LAPIS_BLOCK]: 4,
  [EMERALD_BLOCK]: 4,
  [DIAMOND_BLOCK]: 4,
  [NETHERITE_ORE]: 4,
};

export const minimumPickaxeTier = (id: number): number | null => MIN_PICKAXE_TIER[id] ?? null;

export const isMineralItem = (id: number) =>
  (id >= COAL && id <= DIAMOND) ||
  (id >= REDSTONE && id <= QUARTZ) ||
  id === NETHERITE || id === NETHERITE_INGOT;

export const isFluid = (id: number) => id === WATER || id === LAVA;
export const isFlower = (id: number) =>
  id === FLOWER_RED || id === FLOWER_YELLOW || id === FLOWER_BLUE ||
  id === FLOWER_PINK || id === FLOWER_PURPLE || id === FLOWER_WHITE ||
  id === DRY_BLOOM || id === DESERT_THISTLE ||
  id === FLOWER_TULIP_RED || id === FLOWER_TULIP_YELLOW || id === FLOWER_TULIP_PINK ||
  id === FLOWER_TULIP_ORANGE || id === FLOWER_TULIP_WHITE ||
  id === FLOWER_SUNFLOWER || id === FLOWER_ROSE || id === FLOWER_LAVENDER ||
  id === FLOWER_WISTERIA || id === FLOWER_DAISY || id === FLOWER_ORCHID || id === FLOWER_PEONY;
export const isPlant = (id: number) => isFlower(id) ||
  id === TALL_GRASS || id === FERN || id === DEAD_BUSH || id === VINE || id === MUSHROOM ||
  id === BUSH || id === BUSH_FLOWERING || id === BERRY_BUSH ||
  id === TALL_LAVENDER || id === TALL_SUNFLOWER || id === WISTERIA_VINE ||
  id === MOSS_CARPET || id === LEAF_PILE ||
  (id >= WHEAT_CROP_1 && id <= WHEAT_CROP_3);
export const isCactus = (id: number) => id === CACTUS || id === CACTUS_PALE;
export const isInstaBreak = (id: number) => isPlant(id) || isCactus(id) || id === TURTLE_EGG || id === PENGUIN_EGG || id === BIRD_NEST || id === CHICKEN_NEST || id === MUSHROOM;
export const isLogId = (id: number) => id === LOG || id === BIRCH_LOG || id === PALM_LOG;
export const isLeafId = (id: number) =>
  id === LEAVES || id === SNOW_LEAVES || id === BIRCH_LEAVES || id === APPLE_LEAVES ||
  id === COCONUT_LEAVES || id === BANANA_LEAVES || id === AUTUMN_LEAVES || id === CHERRY_LEAVES ||
  id === JACARANDA_LEAVES;
export const isResource = (id: number) =>
  isArrowId(id) ||
  isMineralItem(id) ||
  (id >= RAW_MEAT && id <= LOOT_BAG) ||
  id === HONEY ||
  (id >= FEATHER && id <= CAT_CLAW) ||
  id === APPLE || id === COCONUT || id === BANANA || id === WHEAT || id === WHEAT_SEEDS || isMeatItem(id);

/** rough material class — tools are specialised per class */
export type BlockClass = 'stone' | 'earth' | 'wood' | 'other';
export function blockClass(id: number): BlockClass {
  switch (id) {
    case VOLCANIC_STONE:
    case SANDSTONE:
    case CHISELED_SANDSTONE:
    case TERRACOTTA_ORANGE:
    case STONE:
    case COBBLE:
    case MOSSY_COBBLE:
    case STONE_BRICK:
    case MOSSY_STONE_BRICK:
    case CRACKED_STONE_BRICK:
    case COAL:
    case IRON:
    case GOLD:
    case DIAMOND:
    case COAL_ORE:
    case IRON_ORE:
    case REDSTONE_ORE:
    case GOLD_ORE:
    case LAPIS_ORE:
    case DIAMOND_ORE:
    case EMERALD_ORE:
    case QUARTZ_ORE:
    case NETHERITE_ORE:
    case COAL_BLOCK:
    case IRON_BLOCK:
    case REDSTONE_BLOCK:
    case GOLD_BLOCK:
    case LAPIS_BLOCK:
    case DIAMOND_BLOCK:
    case EMERALD_BLOCK:
    case QUARTZ_BLOCK:
    case FENCE_STONE:
    case PEDESTAL:
    case PEDESTAL_GOLD:
    case DOOR_IRON:
    case FENCE_IRON:
    case LADDER_STONE:
    case LADDER_IRON:
      return 'stone';
    case DIRT:
    case GRASS:
    case SAND:
    case SNOW_GRASS:
    case HAY_BALE:
    case FARMLAND:
      return 'earth';
    case ICE:
      return 'stone';
    case PALM_LOG:
    case COCONUT_LEAVES:
    case BANANA_LEAVES:
    case LOG:
    case BIRCH_LOG:
    case PLANKS:
    case LEAVES:
    case BIRCH_LEAVES:
    case APPLE_LEAVES:
    case SNOW_LEAVES:
    case AUTUMN_LEAVES:
    case CHERRY_LEAVES:
    case JACARANDA_LEAVES:
    case DOOR_WOOD:
    case FENCE_WOOD:
    case CAMPFIRE:
    case CRAFTING_TABLE:
    case CACTUS:
    case CACTUS_PALE:
    case LADDER_OAK:
    case LADDER_BIRCH:
    case LADDER_PALM:
    case LADDER_RED:
    case LADDER_BLUE:
    case LADDER_YELLOW:
    case LADDER_GREEN:
    case LADDER_PINK:
    case LADDER_PURPLE:
    case LADDER_WHITE:
    case CHEST_STORAGE:
    case CHEST_STORAGE_OPEN:
      return 'wood';
    default:
      return 'other';
  }
}

/** Soil, organic plants and wood can be broken by hand; mineral blocks still require tools. */
export const canBreakByHand = (id: number) =>
  id === DIRT || id === GRASS || id === SNOW_GRASS || id === FARMLAND || id === SAND || id === WEB ||
  isPlant(id) || isCactus(id) || isTreasureChest(id) || blockClass(id) === 'wood';

export const T = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  cobble: 4,
  coal: 5,
  iron: 6,
  gold: 7,
  diamond: 8,
  logSide: 9,
  logTop: 10,
  leaves: 11,
  sand: 12,
  planks: 13,
  bedrock: 14,
  lava: 15,
  torch: 16,
  goldBlock: 17,
  diamondBlock: 18,
  glass: 19,
  doorWood: 20,
  doorIron: 21,
  fenceWood: 22,
  fenceStone: 23,
  fenceIron: 24,
  campfire: 25,
  pedestal: 26,
  pedestalGold: 27,
  meatRaw: 28,
  meatCooked: 29,
  web: 30,
  bone: 31,
  flesh: 32,
  gunpowder: 33,
  arrowItem: 34,
  lootBag: 35,
  bed: 36,
  water: 37,
  flowerRed: 38,
  flowerYellow: 39,
  flowerBlue: 40,
  lampRed: 41,
  lampBlue: 42,
  lampYellow: 43,
  snowTop: 44,
  snowSide: 45,
  ice: 46,
  snowLeaves: 47,
  hive: 48,
  turtleEgg: 49,
  anvil: 50,
  netheriteOre: 51,
  honey: 52,
  netherite: 53,
  wool: 54,
  feather: 55,
  turtleShell: 56,
  crabShell: 57,
  fishScale: 58,
  catClaw: 59,
  penguinEgg: 60,
  birchLogSide: 61,
  birchLogTop: 62,
  birchLeaves: 63,
  appleLeaves: 64,
  cactusSide: 65,
  cactusTop: 66,
  cactusPaleSide: 67,
  cactusPaleTop: 68,
  tallGrass: 69,
  fern: 70,
  deadBush: 71,
  apple: 72,
  craftingTableTop: 73,
  craftingTableSide: 74,
  craftingTableFront: 75,
  volcanicStone: 76,
  palmLogSide: 77,
  palmLogTop: 78,
  coconutLeaves: 79,
  bananaLeaves: 80,
  vine: 81,
  coconut: 82,
  banana: 83,
  dryBloom: 84,
  desertThistle: 85,
  birdNest: 86,
  chickenNest: 87,
  mushroom: 88,
  sandstoneTop: 89,
  sandstoneSide: 90,
  sandstoneBottom: 91,
  chiseledSandstoneSide: 92,
  terracottaOrange: 93,
  hayBaleTop: 94,
  hayBaleSide: 95,
  doorWoodBottom: 96,
  doorIronBottom: 97,
  redstoneOre: 98,
  lapisOre: 99,
  emeraldOre: 100,
  quartzOre: 101,
  coalBlock: 102,
  ironBlock: 103,
  redstoneBlock: 104,
  lapisBlock: 105,
  emeraldBlock: 106,
  quartzBlock: 107,
  coalItem: 108,
  ironIngot: 109,
  redstone: 110,
  goldIngot: 111,
  lapis: 112,
  diamondGem: 113,
  emerald: 114,
  quartz: 115,
  autumnLeaves: 116,
  cherryLeaves: 117,
  flowerPink: 118,
  flowerPurple: 119,
  flowerWhite: 120,
  jacarandaLeaves: 121,
  netheriteIngot: 122,
  farmland: 123,
  rewardBag: 124,
  rewardChest: 125,
  rewardChestOrnate: 126,
  // ---- Expanded flora and ruins (reference photos) ----
  flowerTulipRed: 127,
  flowerTulipYellow: 128,
  flowerTulipPink: 129,
  flowerTulipOrange: 130,
  flowerTulipWhite: 131,
  flowerSunflower: 132,
  flowerRose: 133,
  flowerLavender: 134,
  flowerWisteria: 135,
  flowerDaisy: 136,
  flowerOrchid: 137,
  flowerPeony: 138,
  bush: 139,
  bushFlowering: 140,
  berryBush: 141,
  tallLavender: 142,
  tallSunflower: 143,
  wisteriaVine: 144,
  mossCarpet: 145,
  leafPile: 146,
  mossyCobble: 147,
  mossyStoneBrick: 148,
  crackedStoneBrick: 149,
  stoneBrick: 150,
  pumpkin: 151,
};

export type BlockDef = {
  id: number;
  name: string;
  top: number;
  side: number;
  bottom: number;
  /** seconds to break with a wooden pickaxe */
  hardness: number;
  score: number;
  /** bonus seconds granted on pickup */
  timeBonus: number;
  solid: boolean;
  breakable: boolean;
  /** drops this block id instead (0 = nothing) */
  drop: number;
  tint: [number, number, number];
  emissive?: number;
};

const d = (o: Partial<BlockDef> & { id: number; name: string }): BlockDef => {
  const side = o.side ?? T.stone;
  return {
    hardness: 1,
    score: 1,
    timeBonus: 0,
    solid: true,
    breakable: true,
    drop: o.id,
    tint: [255, 255, 255],
    ...o,
    top: o.top ?? side,
    side,
    bottom: o.bottom ?? side,
  };
};

export type MeatSize = 'small' | 'medium' | 'large';
export type MeatFamily = 'chicken' | 'pork' | 'beef' | 'mutton' | 'fish' | 'salmon' | 'rabbit' | 'venison' | 'crab';
export type MeatItemInfo = { id: number; family: MeatFamily; size: MeatSize; cooked: boolean };

export const MEAT_FAMILIES: readonly MeatFamily[] = [
  'chicken', 'pork', 'beef', 'mutton', 'fish', 'salmon', 'rabbit', 'venison', 'crab',
];
export const MEAT_SIZES: readonly MeatSize[] = ['small', 'medium', 'large'];
export const MEAT_FAMILY_NAMES: Record<MeatFamily, string> = {
  chicken: 'Chicken', pork: 'Pork', beef: 'Beef', mutton: 'Mutton', fish: 'Fish',
  salmon: 'Salmon', rabbit: 'Rabbit', venison: 'Venison', crab: 'Crab',
};
const MEAT_SIZE_NAMES: Record<MeatSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };
const RAW_MEAT_TINTS: Record<MeatFamily, [number, number, number]> = {
  chicken: [196, 132, 111], pork: [213, 133, 129], beef: [190, 73, 67], mutton: [173, 94, 83],
  fish: [91, 157, 190], salmon: [219, 112, 91], rabbit: [180, 126, 91], venison: [156, 92, 60], crab: [210, 83, 56],
};
const COOKED_MEAT_TINTS: Record<MeatFamily, [number, number, number]> = {
  chicken: [186, 132, 83], pork: [169, 105, 66], beef: [143, 77, 48], mutton: [154, 91, 59],
  fish: [181, 151, 94], salmon: [190, 105, 65], rabbit: [157, 107, 65], venison: [130, 75, 45], crab: [178, 86, 50],
};

let nextMeatId = 146;
let nextRelocatedMeatId = 265;
const allocateMeatId = () => {
  const candidate = nextMeatId++;
  // Preserve legacy arrow IDs; relocate only the eight meat entries that used to alias them.
  return isArrowId(candidate) ? nextRelocatedMeatId++ : candidate;
};
export const MEAT_ITEM_IDS = {} as Record<MeatFamily, Record<MeatSize, { raw: number; cooked: number }>>;
export const MEAT_ITEM_BY_ID: Record<number, MeatItemInfo> = {};
const meatBlockDefs: BlockDef[] = [];
for (const family of MEAT_FAMILIES) {
  MEAT_ITEM_IDS[family] = {} as Record<MeatSize, { raw: number; cooked: number }>;
  for (const size of MEAT_SIZES) {
    const raw = allocateMeatId();
    const cooked = allocateMeatId();
    MEAT_ITEM_IDS[family][size] = { raw, cooked };
    MEAT_ITEM_BY_ID[raw] = { id: raw, family, size, cooked: false };
    MEAT_ITEM_BY_ID[cooked] = { id: cooked, family, size, cooked: true };
    const sizeName = MEAT_SIZE_NAMES[size];
    const familyName = MEAT_FAMILY_NAMES[family];
    meatBlockDefs.push(
      d({ id: raw, name: `${sizeName} Raw ${familyName}`, side: T.meatRaw, hardness: 1, score: 5, solid: false, breakable: false, drop: 0, tint: RAW_MEAT_TINTS[family] }),
      d({ id: cooked, name: `Cooked ${sizeName} ${familyName}`, side: T.meatCooked, hardness: 1, score: 5, solid: false, breakable: false, drop: 0, tint: COOKED_MEAT_TINTS[family] }),
    );
  }
}
export const MEAT_ITEM_FIRST = 146;
export const MEAT_ITEM_LAST = Math.max(nextMeatId - 1, nextRelocatedMeatId - 1);
export const isMeatItem = (id: number) => id === RAW_MEAT || id === COOKED_MEAT || MEAT_ITEM_BY_ID[id] !== undefined;
export const isRawMeatItem = (id: number) => id === RAW_MEAT || (MEAT_ITEM_BY_ID[id] !== undefined && !MEAT_ITEM_BY_ID[id].cooked);
export const isCookedMeatItem = (id: number) => id === COOKED_MEAT || (MEAT_ITEM_BY_ID[id] !== undefined && MEAT_ITEM_BY_ID[id].cooked);
export function cookedMeatId(rawId: number): number | null {
  if (rawId === RAW_MEAT) return COOKED_MEAT;
  const info = MEAT_ITEM_BY_ID[rawId];
  return info && !info.cooked ? MEAT_ITEM_IDS[info.family][info.size].cooked : null;
}
export function allRawMeatIds(): number[] {
  return [RAW_MEAT, ...Object.values(MEAT_ITEM_IDS).flatMap((sizes) => Object.values(sizes).map((pair) => pair.raw))];
}

const BLOCK_DEFS: BlockDef[] = [
  d({ id: AIR, name: 'Air', side: T.stone, solid: false, breakable: false, drop: 0, score: 0 }),
  d({
    id: GRASS,
    name: 'Grass',
    top: T.grassTop,
    side: T.grassSide,
    bottom: T.dirt,
    hardness: 0.5,
    score: 4,
    drop: DIRT,
    tint: [124, 189, 107],
  }),
  d({ id: DIRT, name: 'Dirt', side: T.dirt, hardness: 0.45, score: 2, tint: [134, 96, 67] }),
  d({
    id: STONE,
    name: 'Stone',
    side: T.stone,
    hardness: 1.15,
    score: 6,
    drop: COBBLE,
    tint: [128, 128, 132],
  }),
  d({ id: COBBLE, name: 'Cobblestone', side: T.cobble, hardness: 1.1, score: 5, tint: [122, 122, 126] }),
  d({
    id: COAL,
    name: 'Coal',
    side: T.coalItem,
    hardness: 1.5,
    score: 45,
    timeBonus: 2,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [70, 68, 72],
  }),
  d({
    id: IRON,
    name: 'Iron Ingot',
    side: T.ironIngot,
    hardness: 1.9,
    score: 110,
    timeBonus: 3.5,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [216, 220, 226],
  }),
  d({
    id: GOLD,
    name: 'Gold Ingot',
    side: T.goldIngot,
    hardness: 2.1,
    score: 240,
    timeBonus: 5,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [250, 214, 92],
  }),
  d({
    id: DIAMOND,
    name: 'Diamond',
    side: T.diamondGem,
    hardness: 2.6,
    score: 620,
    timeBonus: 9,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [96, 232, 224],
  }),
  d({ id: LOG, name: 'Oak Log', top: T.logTop, side: T.logSide, hardness: 0.85, score: 14, tint: [112, 84, 51] }),
  d({ id: LEAVES, name: 'Leaves', side: T.leaves, hardness: 0.22, score: 3, tint: [86, 152, 62] }),
  d({ id: SAND, name: 'Sand', side: T.sand, hardness: 0.45, score: 3, tint: [219, 205, 152] }),
  d({ id: PLANKS, name: 'Planks', side: T.planks, hardness: 0.8, score: 8, tint: [178, 141, 84] }),
  d({
    id: BEDROCK,
    name: 'Bedrock',
    side: T.bedrock,
    hardness: Infinity,
    score: 0,
    breakable: false,
    tint: [60, 60, 64],
  }),
  d({
    id: LAVA,
    name: 'Lava',
    side: T.lava,
    hardness: Infinity,
    score: 0,
    breakable: false,
    solid: false,
    drop: 0,
    tint: [255, 122, 34],
    emissive: 1,
  }),
  d({
    id: TORCH,
    name: 'Lantern',
    side: T.torch,
    hardness: 0.16,
    score: 2,
    solid: false,
    tint: [255, 208, 110],
    emissive: 1,
  }),
  d({
    id: GOLD_BLOCK,
    name: 'Gold Block',
    side: T.goldBlock,
    hardness: 2.2,
    score: 500,
    tint: [250, 214, 92],
  }),
  d({
    id: DIAMOND_BLOCK,
    name: 'Diamond Block',
    side: T.diamondBlock,
    hardness: 2.8,
    score: 1400,
    tint: [120, 245, 235],
  }),
  d({ id: GLASS, name: 'Window', side: T.glass, hardness: 0.35, score: 4, tint: [200, 230, 240] }),
  d({ id: DOOR_WOOD, name: 'Wooden Door', side: T.doorWood, hardness: 0.8, score: 6, tint: [178, 141, 84] }),
  d({ id: DOOR_IRON, name: 'Iron Door', side: T.doorIron, hardness: 1.6, score: 10, tint: [206, 210, 215] }),
  d({ id: FENCE_WOOD, name: 'Wooden Fence', side: T.fenceWood, hardness: 0.7, score: 4, tint: [178, 141, 84] }),
  d({ id: FENCE_STONE, name: 'Stone Fence', side: T.fenceStone, hardness: 1.1, score: 5, tint: [128, 128, 132] }),
  d({ id: FENCE_IRON, name: 'Iron Fence', side: T.fenceIron, hardness: 1.4, score: 7, tint: [206, 210, 215] }),
  d({
    id: CAMPFIRE,
    name: 'Campfire',
    side: T.campfire,
    hardness: 0.5,
    score: 6,
    tint: [255, 150, 60],
    emissive: 1,
    solid: false,
  }),
  d({ id: PEDESTAL, name: 'Stone Pedestal', side: T.pedestal, hardness: 0.9, score: 8, tint: [200, 200, 205], emissive: 1 }),
  d({ id: PEDESTAL_GOLD, name: 'Gilded Pedestal', side: T.pedestalGold, hardness: 1.1, score: 16, tint: [250, 214, 92], emissive: 1 }),
  d({ id: RAW_MEAT, name: 'Raw Meat', side: T.meatRaw, hardness: 1, score: 5, solid: false, breakable: false, drop: 0, tint: [220, 90, 80] }),
  d({ id: COOKED_MEAT, name: 'Cooked Meat', side: T.meatCooked, hardness: 1, score: 10, solid: false, breakable: false, drop: 0, tint: [190, 120, 60] }),
  d({ id: WEB, name: 'Spider Web', side: T.web, hardness: 0.2, score: 12, solid: false, breakable: true, drop: WEB, tint: [230, 230, 235] }),
  d({ id: BONE, name: 'Bone', side: T.bone, hardness: 1, score: 10, solid: false, breakable: false, drop: 0, tint: [232, 226, 214] }),
  d({ id: FLESH, name: 'Rotten Flesh', side: T.flesh, hardness: 1, score: 6, solid: false, breakable: false, drop: 0, tint: [140, 170, 90] }),
  d({ id: GUNPOWDER, name: 'Gunpowder', side: T.gunpowder, hardness: 1, score: 20, solid: false, breakable: false, drop: 0, tint: [90, 90, 95] }),
  d({ id: ARROW_ITEM, name: 'Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [200, 190, 170] }),

  d({ id: LOOT_BAG, name: 'Loot', side: T.lootBag, hardness: 1, score: 0, solid: false, breakable: false, drop: 0, tint: [217, 140, 255] }),
  d({ id: BED, name: 'Bed', top: T.bed, side: T.planks, bottom: T.planks, hardness: 0.6, score: 8, tint: [200, 70, 60] }),
  d({ id: WATER, name: 'Water', side: T.water, hardness: Infinity, score: 0, breakable: false, solid: false, drop: 0, tint: [70, 130, 220] }),
  d({ id: FLOWER_RED, name: 'Red Flower', side: T.flowerRed, hardness: 0.1, score: 3, solid: false, tint: [226, 86, 74] }),
  d({ id: FLOWER_YELLOW, name: 'Yellow Flower', side: T.flowerYellow, hardness: 0.1, score: 3, solid: false, tint: [244, 200, 66] }),
  d({ id: FLOWER_BLUE, name: 'Blue Flower', side: T.flowerBlue, hardness: 0.1, score: 3, solid: false, tint: [94, 140, 255] }),
  d({ id: LAMP_RED, name: 'Red Lamp', side: T.lampRed, hardness: 0.4, score: 8, tint: [255, 110, 100], emissive: 1 }),
  d({ id: LAMP_BLUE, name: 'Blue Lamp', side: T.lampBlue, hardness: 0.4, score: 8, tint: [110, 150, 255], emissive: 1 }),
  d({ id: LAMP_YELLOW, name: 'Yellow Lamp', side: T.lampYellow, hardness: 0.4, score: 8, tint: [255, 220, 100], emissive: 1 }),
  d({
    id: SNOW_GRASS,
    name: 'Snowy Grass',
    top: T.snowTop,
    side: T.snowSide,
    bottom: T.dirt,
    hardness: 0.5,
    score: 4,
    drop: DIRT,
    tint: [235, 240, 248],
  }),
  d({ id: ICE, name: 'Ice', side: T.ice, hardness: 0.6, score: 5, drop: 0, tint: [160, 200, 240] }),
  d({
    id: SNOW_LEAVES,
    name: 'Frosted Leaves',
    side: T.snowLeaves,
    hardness: 0.22,
    score: 3,
    drop: LEAVES,
    tint: [200, 220, 215],
  }),
  d({ id: HIVE, name: 'Bee Hive', side: T.hive, hardness: 0.6, score: 12, drop: HONEY, tint: [230, 180, 70] }),
  d({
    id: TURTLE_EGG,
    name: 'Turtle Egg',
    side: T.turtleEgg,
    hardness: 0.1,
    score: 4,
    solid: false,
    drop: 0,
    tint: [230, 235, 225],
  }),
  d({ id: ANVIL, name: 'Anvil', side: T.anvil, hardness: 1.8, score: 15, tint: [80, 82, 90] }),
  d({
    id: NETHERITE_ORE,
    name: 'Ancient Debris',
    side: T.netheriteOre,
    hardness: 3.6,
    score: 4000,
    timeBonus: 12,
    drop: NETHERITE,
    tint: [110, 70, 55],
  }),
  d({ id: HONEY, name: 'Honey', side: T.honey, hardness: 1, score: 10, solid: false, breakable: false, drop: 0, tint: [244, 180, 60] }),
  d({
    id: NETHERITE,
    name: 'Netherite Scrap',
    side: T.netherite,
    hardness: 1,
    score: 4400,
    timeBonus: 12,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [90, 60, 50],
  }),
  d({ id: WOOL, name: 'Wool', side: T.wool, hardness: 0.4, score: 5, tint: [238, 238, 235] }),
  d({ id: FEATHER, name: 'Feather', side: T.feather, hardness: 1, score: 4, solid: false, breakable: false, drop: 0, tint: [240, 240, 244] }),
  d({ id: TURTLE_SHELL, name: 'Turtle Shell', side: T.turtleShell, hardness: 1, score: 30, solid: false, breakable: false, drop: 0, tint: [77, 140, 90] }),
  d({ id: CRAB_SHELL, name: 'Crab Shell', side: T.crabShell, hardness: 1, score: 22, solid: false, breakable: false, drop: 0, tint: [216, 90, 58] }),
  d({ id: FISH_SCALE, name: 'Fish Scale', side: T.fishScale, hardness: 1, score: 6, solid: false, breakable: false, drop: 0, tint: [110, 170, 220] }),
  d({ id: CAT_CLAW, name: 'Lynx Claw', side: T.catClaw, hardness: 1, score: 28, solid: false, breakable: false, drop: 0, tint: [230, 220, 200] }),
  d({
    id: PENGUIN_EGG,
    name: 'Penguin Egg',
    side: T.penguinEgg,
    hardness: 0.1,
    score: 4,
    solid: false,
    drop: 0,
    tint: [225, 232, 240],
  }),
  d({ id: TALL_GRASS, name: 'Tall Grass', side: T.tallGrass, hardness: 0.05, score: 2, solid: false, drop: 0, tint: [95, 151, 56] }),
  d({ id: FERN, name: 'Fern', side: T.fern, hardness: 0.05, score: 3, solid: false, drop: 0, tint: [65, 130, 45] }),
  d({ id: DEAD_BUSH, name: 'Dead Bush', side: T.deadBush, hardness: 0.05, score: 2, solid: false, drop: 0, tint: [180, 150, 100] }),
  d({ id: CACTUS, name: 'Cactus', side: T.cactusSide, top: T.cactusTop, bottom: T.cactusTop, hardness: 0.45, score: 6, tint: [85, 155, 60] }),
  d({ id: CACTUS_PALE, name: 'Pale Cactus', side: T.cactusPaleSide, top: T.cactusPaleTop, bottom: T.cactusPaleTop, hardness: 0.45, score: 6, tint: [120, 170, 120] }),
  d({ id: BIRCH_LOG, name: 'Birch Log', side: T.birchLogSide, top: T.birchLogTop, bottom: T.birchLogTop, hardness: 0.8, score: 14, drop: LOG, tint: [230, 230, 235] }),
  d({ id: BIRCH_LEAVES, name: 'Birch Leaves', side: T.birchLeaves, hardness: 0.2, score: 3, drop: LEAVES, tint: [120, 185, 65] }),
  d({ id: APPLE_LEAVES, name: 'Apple Leaves', side: T.appleLeaves, hardness: 0.25, score: 5, drop: APPLE, tint: [220, 60, 50] }),
  d({ id: APPLE, name: 'Apple', side: T.apple, hardness: 1, score: 8, solid: false, breakable: false, drop: 0, tint: [225, 55, 45] }),
  d({ id: CRAFTING_TABLE, name: 'Workbench', top: T.craftingTableTop, side: T.craftingTableSide, bottom: T.planks, hardness: 0.8, score: 8, tint: [180, 140, 85] }),
  d({ id: VOLCANIC_STONE, name: 'Volcanic Stone', side: T.volcanicStone, hardness: 1.3, score: 8, tint: [66, 61, 65] }),
  d({ id: PALM_LOG, name: 'Palm Trunk', side: T.palmLogSide, top: T.palmLogTop, bottom: T.palmLogTop, hardness: 0.9, score: 12, drop: LOG, tint: [150, 110, 69] }),
  d({ id: COCONUT_LEAVES, name: 'Coconut Palm Leaves', side: T.coconutLeaves, hardness: 0.22, score: 4, drop: COCONUT, tint: [65, 154, 71] }),
  d({ id: BANANA_LEAVES, name: 'Banana Palm Leaves', side: T.bananaLeaves, hardness: 0.22, score: 4, drop: BANANA, tint: [100, 174, 58] }),
  d({ id: VINE, name: 'Jungle Vine', side: T.vine, hardness: 0.1, score: 2, solid: false, drop: 0, tint: [58, 124, 48] }),
  d({ id: COCONUT, name: 'Coconut', side: T.coconut, hardness: 1, score: 12, solid: false, breakable: false, drop: 0, tint: [126, 91, 58] }),
  d({ id: BANANA, name: 'Banana', side: T.banana, hardness: 1, score: 10, solid: false, breakable: false, drop: 0, tint: [240, 205, 66] }),
  d({ id: DRY_BLOOM, name: 'Dried Desert Bloom', side: T.dryBloom, hardness: 0.06, score: 3, solid: false, tint: [184, 128, 81] }),
  d({ id: DESERT_THISTLE, name: 'Desert Thistle', side: T.desertThistle, hardness: 0.08, score: 3, solid: false, tint: [172, 143, 85] }),
  d({ id: BIRD_NEST, name: 'Twig Nest', side: T.birdNest, hardness: 0.08, score: 4, solid: false, drop: 0, tint: [102, 68, 42] }),
  d({ id: CHICKEN_NEST, name: 'Straw Nest', side: T.chickenNest, hardness: 0.08, score: 4, solid: false, drop: 0, tint: [208, 173, 83] }),
  d({ id: MUSHROOM, name: 'Forest Mushroom', side: T.mushroom, hardness: 0.08, score: 3, solid: false, drop: 0, tint: [202, 95, 68] }),
  d({
    id: SANDSTONE,
    name: 'Sandstone',
    top: T.sandstoneTop,
    side: T.sandstoneSide,
    bottom: T.sandstoneBottom,
    hardness: 0.9,
    score: 6,
    tint: [222, 206, 156],
  }),
  d({
    id: CHISELED_SANDSTONE,
    name: 'Chiseled Sandstone',
    top: T.sandstoneTop,
    side: T.chiseledSandstoneSide,
    bottom: T.sandstoneTop,
    hardness: 0.95,
    score: 8,
    tint: [228, 212, 162],
  }),
  d({
    id: TERRACOTTA_ORANGE,
    name: 'Orange Terracotta',
    side: T.terracottaOrange,
    hardness: 1.0,
    score: 7,
    tint: [186, 98, 56],
  }),
  d({
    id: HAY_BALE,
    name: 'Hay Bale',
    top: T.hayBaleTop,
    side: T.hayBaleSide,
    bottom: T.hayBaleTop,
    hardness: 0.5,
    score: 6,
    tint: [216, 182, 74],
  }),
  // ---- 8 Mineral Ores (Row 1 of reference table) ----
  d({
    id: COAL_ORE,
    name: 'Coal Ore',
    side: T.coal,
    hardness: 1.5,
    score: 45,
    timeBonus: 2,
    drop: COAL,
    tint: [70, 68, 72],
  }),
  d({
    id: IRON_ORE,
    name: 'Iron Ore',
    side: T.iron,
    hardness: 1.9,
    score: 110,
    timeBonus: 3.5,
    drop: IRON,
    tint: [206, 168, 130],
  }),
  d({
    id: REDSTONE_ORE,
    name: 'Redstone Ore',
    side: T.redstoneOre,
    hardness: 2.0,
    score: 160,
    timeBonus: 4,
    drop: REDSTONE,
    tint: [215, 36, 36],
  }),
  d({
    id: GOLD_ORE,
    name: 'Gold Ore',
    side: T.gold,
    hardness: 2.1,
    score: 240,
    timeBonus: 5,
    drop: GOLD,
    tint: [250, 214, 92],
  }),
  d({
    id: LAPIS_ORE,
    name: 'Lapis Lazuli Ore',
    side: T.lapisOre,
    hardness: 2.0,
    score: 190,
    timeBonus: 4.5,
    drop: LAPIS,
    tint: [45, 92, 220],
  }),
  d({
    id: DIAMOND_ORE,
    name: 'Diamond Ore',
    side: T.diamond,
    hardness: 2.6,
    score: 620,
    timeBonus: 9,
    drop: DIAMOND,
    tint: [96, 232, 224],
  }),
  d({
    id: EMERALD_ORE,
    name: 'Emerald Ore',
    side: T.emeraldOre,
    hardness: 2.7,
    score: 700,
    timeBonus: 10,
    drop: EMERALD,
    tint: [40, 216, 96],
  }),
  d({
    id: QUARTZ_ORE,
    name: 'Nether Quartz Ore',
    side: T.quartzOre,
    hardness: 1.8,
    score: 150,
    timeBonus: 4,
    drop: QUARTZ,
    tint: [236, 226, 216],
  }),
  // ---- Crafted Mineral Blocks (Row 3 of reference table) ----
  d({
    id: COAL_BLOCK,
    name: 'Coal Block',
    side: T.coalBlock,
    hardness: 1.8,
    score: 180,
    tint: [32, 32, 36],
  }),
  d({
    id: IRON_BLOCK,
    name: 'Iron Block',
    side: T.ironBlock,
    hardness: 2.2,
    score: 440,
    tint: [224, 226, 230],
  }),
  d({
    id: REDSTONE_BLOCK,
    name: 'Redstone Block',
    side: T.redstoneBlock,
    hardness: 2.0,
    score: 600,
    tint: [196, 24, 20],
    emissive: 1,
  }),
  d({
    id: LAPIS_BLOCK,
    name: 'Lapis Lazuli Block',
    side: T.lapisBlock,
    hardness: 2.0,
    score: 720,
    tint: [38, 76, 198],
  }),
  d({
    id: EMERALD_BLOCK,
    name: 'Emerald Block',
    side: T.emeraldBlock,
    hardness: 2.8,
    score: 1600,
    tint: [42, 218, 98],
  }),
  d({
    id: QUARTZ_BLOCK,
    name: 'Quartz Block',
    side: T.quartzBlock,
    hardness: 1.6,
    score: 520,
    tint: [240, 235, 228],
  }),
  // ---- Missing Mineral Items / Materials (Row 2 of reference table) ----
  d({
    id: REDSTONE,
    name: 'Redstone',
    side: T.redstone,
    hardness: 1.0,
    score: 160,
    timeBonus: 4,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [215, 28, 28],
  }),
  d({
    id: LAPIS,
    name: 'Lapis Lazuli',
    side: T.lapis,
    hardness: 1.0,
    score: 190,
    timeBonus: 4.5,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [42, 88, 218],
  }),
  d({
    id: EMERALD,
    name: 'Emerald',
    side: T.emerald,
    hardness: 1.0,
    score: 700,
    timeBonus: 10,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [38, 214, 92],
  }),
  d({
    id: QUARTZ,
    name: 'Nether Quartz',
    side: T.quartz,
    hardness: 1.0,
    score: 150,
    timeBonus: 4,
    solid: false,
    breakable: false,
    drop: 0,
    tint: [238, 230, 220],
  }),
  // ---- seasonal foliage and extra wildflowers ----
  d({ id: AUTUMN_LEAVES, name: 'Autumn Leaves', side: T.autumnLeaves, hardness: 0.22, score: 3, drop: LEAVES, tint: [226, 126, 43] }),
  d({ id: CHERRY_LEAVES, name: 'Cherry Blossoms', side: T.cherryLeaves, hardness: 0.22, score: 4, drop: LEAVES, tint: [236, 154, 184] }),
  d({ id: FLOWER_PINK, name: 'Pink Flower', side: T.flowerPink, hardness: 0.1, score: 3, solid: false, tint: [245, 132, 176] }),
  d({ id: FLOWER_PURPLE, name: 'Purple Flower', side: T.flowerPurple, hardness: 0.1, score: 3, solid: false, tint: [161, 113, 224] }),
  d({ id: FLOWER_WHITE, name: 'White Daisy', side: T.flowerWhite, hardness: 0.1, score: 3, solid: false, tint: [244, 240, 224] }),
  d({ id: JACARANDA_LEAVES, name: 'Jacaranda Blossoms', side: T.jacarandaLeaves, hardness: 0.22, score: 4, drop: LEAVES, tint: [164, 114, 194] }),
  d({ id: NETHERITE_INGOT, name: 'Netherite Ingot', side: T.netheriteIngot, hardness: 1, score: 18750, solid: false, breakable: false, drop: 0, tint: [128, 81, 76] }),
  d({ id: CHEST_PLAINS, name: 'Oak Treasure Chest', side: T.planks, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [155, 91, 43] }),
  d({ id: CHEST_WINTER, name: 'Frostbound Treasure Chest', side: T.ice, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [104, 157, 184] }),
  d({ id: CHEST_AUTUMN, name: 'Amber Treasure Chest', side: T.autumnLeaves, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [190, 91, 39] }),
  d({ id: CHEST_JUNGLE, name: 'Overgrown Treasure Chest', side: T.leaves, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [71, 122, 69] }),
  d({ id: CHEST_DESERT, name: 'Sun-baked Treasure Chest', side: T.sandstoneSide, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [204, 150, 67] }),
  d({ id: CHEST_CANYON, name: 'Redstone Treasure Chest', side: T.sandstoneSide, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [155, 73, 48] }),
  d({ id: CHEST_VOLCANIC, name: 'Ember Treasure Chest', side: T.volcanicStone, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [74, 59, 61] }),
  d({ id: CHEST_UNDERWATER, name: 'Barnacled Sea Chest', side: T.netherite, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [75, 121, 107] }),
  // ---- looted states: same chest, lid hinged open, contents gone ----
  d({ id: CHEST_PLAINS_OPEN, name: 'Oak Treasure Chest (open)', side: T.planks, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [155, 91, 43] }),
  d({ id: CHEST_WINTER_OPEN, name: 'Frostbound Treasure Chest (open)', side: T.ice, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [104, 157, 184] }),
  d({ id: CHEST_AUTUMN_OPEN, name: 'Amber Treasure Chest (open)', side: T.autumnLeaves, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [190, 91, 39] }),
  d({ id: CHEST_JUNGLE_OPEN, name: 'Overgrown Treasure Chest (open)', side: T.leaves, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [71, 122, 69] }),
  d({ id: CHEST_DESERT_OPEN, name: 'Sun-baked Treasure Chest (open)', side: T.sandstoneSide, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [204, 150, 67] }),
  d({ id: CHEST_CANYON_OPEN, name: 'Redstone Treasure Chest (open)', side: T.sandstoneSide, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [155, 73, 48] }),
  d({ id: CHEST_VOLCANIC_OPEN, name: 'Ember Treasure Chest (open)', side: T.volcanicStone, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [74, 59, 61] }),
  d({ id: CHEST_UNDERWATER_OPEN, name: 'Barnacled Sea Chest (open)', side: T.netherite, hardness: 1, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [75, 121, 107] }),
  d({ id: FARMLAND, name: 'Farmland', top: T.farmland, side: T.dirt, bottom: T.dirt, hardness: 0.45, score: 2, drop: DIRT, tint: [116, 79, 54] }),
  d({ id: LADDER_OAK, name: 'Oak Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [155, 105, 54] }),
  d({ id: LADDER_BIRCH, name: 'Birch Ladder', side: T.birchLogSide, hardness: 0.35, score: 2, solid: false, tint: [210, 184, 126] }),
  d({ id: LADDER_PALM, name: 'Palm Ladder', side: T.palmLogSide, hardness: 0.35, score: 2, solid: false, tint: [174, 132, 73] }),
  d({ id: LADDER_RED, name: 'Red Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [213, 82, 72] }),
  d({ id: LADDER_BLUE, name: 'Blue Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [93, 145, 223] }),
  d({ id: LADDER_YELLOW, name: 'Yellow Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [228, 193, 68] }),
  d({ id: LADDER_GREEN, name: 'Green Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [104, 170, 90] }),
  d({ id: LADDER_PINK, name: 'Pink Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [225, 134, 177] }),
  d({ id: LADDER_PURPLE, name: 'Purple Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [158, 112, 210] }),
  d({ id: LADDER_WHITE, name: 'White Ladder', side: T.planks, hardness: 0.35, score: 2, solid: false, tint: [231, 228, 220] }),
  d({ id: LADDER_STONE, name: 'Stone Ladder', side: T.cobble, hardness: 0.6, score: 3, solid: false, tint: [157, 165, 172] }),
  d({ id: LADDER_IRON, name: 'Iron Ladder', side: T.iron, hardness: 0.8, score: 4, solid: false, tint: [194, 209, 215] }),
  d({ id: CHEST_STORAGE, name: 'Storage Chest', side: T.planks, hardness: 0.7, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [145, 91, 51] }),
  d({ id: CHEST_STORAGE_OPEN, name: 'Storage Chest (open)', side: T.planks, hardness: 0.7, score: 0, solid: false, breakable: true, drop: CHEST_STORAGE, tint: [145, 91, 51] }),
  d({ id: WHEAT, name: 'Wheat', side: T.tallGrass, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [226, 191, 76] }),
  d({ id: WHEAT_SEEDS, name: 'Wheat Seeds', side: T.tallGrass, hardness: 1, score: 1, solid: false, breakable: false, drop: 0, tint: [164, 146, 64] }),
  d({ id: WHEAT_CROP_1, name: 'Wheat Crop (young)', side: T.tallGrass, hardness: 0.08, score: 0, solid: false, breakable: true, drop: 0, tint: [132, 174, 75] }),
  d({ id: WHEAT_CROP_2, name: 'Wheat Crop (growing)', side: T.tallGrass, hardness: 0.08, score: 0, solid: false, breakable: true, drop: 0, tint: [178, 172, 64] }),
  d({ id: WHEAT_CROP_3, name: 'Wheat Crop (ripe)', side: T.tallGrass, hardness: 0.08, score: 0, solid: false, breakable: true, drop: 0, tint: [226, 191, 76] }),
  d({ id: REWARD_PACK_DAILY, name: 'Daily Resource Bag', side: T.rewardBag, hardness: 1, score: 0, solid: false, breakable: false, drop: 0, tint: [214, 165, 95] }),
  d({ id: REWARD_PACK_WEEKLY, name: 'Weekly Supply Chest', side: T.rewardChest, hardness: 1, score: 0, solid: false, breakable: false, drop: 0, tint: [167, 120, 74] }),
  d({ id: REWARD_PACK_MONTHLY, name: 'Monthly Rich Chest', side: T.rewardChestOrnate, hardness: 1, score: 0, solid: false, breakable: false, drop: 0, tint: [126, 154, 198] }),
  // ---- Expanded forest flora & ruin materials (reference photos) ----
  d({ id: FLOWER_TULIP_RED, name: 'Red Tulip', side: T.flowerTulipRed, hardness: 0.1, score: 3, solid: false, tint: [212, 42, 42] }),
  d({ id: FLOWER_TULIP_YELLOW, name: 'Yellow Tulip', side: T.flowerTulipYellow, hardness: 0.1, score: 3, solid: false, tint: [232, 198, 40] }),
  d({ id: FLOWER_TULIP_PINK, name: 'Pink Tulip', side: T.flowerTulipPink, hardness: 0.1, score: 3, solid: false, tint: [228, 106, 154] }),
  d({ id: FLOWER_TULIP_ORANGE, name: 'Orange Tulip', side: T.flowerTulipOrange, hardness: 0.1, score: 3, solid: false, tint: [232, 106, 24] }),
  d({ id: FLOWER_TULIP_WHITE, name: 'White Tulip', side: T.flowerTulipWhite, hardness: 0.1, score: 3, solid: false, tint: [240, 240, 232] }),
  d({ id: FLOWER_SUNFLOWER, name: 'Sunflower', side: T.flowerSunflower, hardness: 0.1, score: 4, solid: false, tint: [240, 192, 48] }),
  d({ id: FLOWER_ROSE, name: 'Rose', side: T.flowerRose, hardness: 0.1, score: 4, solid: false, tint: [196, 30, 30] }),
  d({ id: FLOWER_LAVENDER, name: 'Lavender', side: T.flowerLavender, hardness: 0.1, score: 3, solid: false, tint: [122, 90, 186] }),
  d({ id: FLOWER_WISTERIA, name: 'Wisteria', side: T.flowerWisteria, hardness: 0.1, score: 3, solid: false, tint: [154, 122, 200] }),
  d({ id: FLOWER_DAISY, name: 'Daisy', side: T.flowerDaisy, hardness: 0.1, score: 3, solid: false, tint: [240, 240, 232] }),
  d({ id: FLOWER_ORCHID, name: 'Blue Orchid', side: T.flowerOrchid, hardness: 0.1, score: 4, solid: false, tint: [106, 90, 186] }),
  d({ id: FLOWER_PEONY, name: 'Peony', side: T.flowerPeony, hardness: 0.1, score: 4, solid: false, tint: [212, 90, 138] }),
  d({ id: BUSH, name: 'Shrub', side: T.bush, hardness: 0.15, score: 3, solid: false, tint: [58, 122, 42] }),
  d({ id: BUSH_FLOWERING, name: 'Flowering Shrub', side: T.bushFlowering, hardness: 0.15, score: 4, solid: false, tint: [90, 140, 70] }),
  d({ id: BERRY_BUSH, name: 'Berry Bush', side: T.berryBush, hardness: 0.15, score: 4, solid: false, tint: [100, 130, 60] }),
  d({ id: TALL_LAVENDER, name: 'Tall Lavender', side: T.tallLavender, hardness: 0.12, score: 3, solid: false, tint: [122, 90, 186] }),
  d({ id: TALL_SUNFLOWER, name: 'Tall Sunflower', side: T.tallSunflower, hardness: 0.12, score: 4, solid: false, tint: [240, 192, 48] }),
  d({ id: WISTERIA_VINE, name: 'Wisteria Vine', side: T.wisteriaVine, hardness: 0.1, score: 2, solid: false, tint: [154, 122, 200] }),
  d({ id: MOSS_CARPET, name: 'Moss Carpet', side: T.mossCarpet, hardness: 0.1, score: 2, solid: false, tint: [74, 154, 58] }),
  d({ id: LEAF_PILE, name: 'Leaf Litter', side: T.leafPile, hardness: 0.08, score: 2, solid: false, tint: [200, 122, 40] }),
  d({ id: MOSSY_COBBLE, name: 'Mossy Cobblestone', side: T.mossyCobble, hardness: 1.1, score: 6, tint: [106, 122, 106] }),
  d({ id: MOSSY_STONE_BRICK, name: 'Mossy Stone Bricks', side: T.mossyStoneBrick, hardness: 1.2, score: 7, tint: [108, 124, 108] }),
  d({ id: CRACKED_STONE_BRICK, name: 'Cracked Stone Bricks', side: T.crackedStoneBrick, hardness: 1.1, score: 6, tint: [110, 114, 116] }),
  d({ id: STONE_BRICK, name: 'Stone Bricks', side: T.stoneBrick, hardness: 1.2, score: 7, tint: [122, 126, 128] }),
  ...meatBlockDefs,
  d({ id: STONE_ARROW, name: 'Stone Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [170,180,190] }),
  d({ id: IRON_ARROW, name: 'Iron Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [210,225,230] }),
  d({ id: GOLD_ARROW, name: 'Golden Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [250,205,70] }),
  d({ id: NETHERITE_ARROW, name: 'Netherite Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [245,100,70] }),
  d({ id: FIRE_ARROW, name: 'Fire Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [255,90,30] }),
  d({ id: POISON_ARROW, name: 'Poison Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [150,220,80] }),
  d({ id: FREEZE_ARROW, name: 'Freeze Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [100,220,255] }),
  d({ id: STUN_ARROW, name: 'Stun Arrow', side: T.arrowItem, hardness: 1, score: 2, solid: false, breakable: false, drop: 0, tint: [240,220,80] }),
];

/** ID-indexed sparse table; item-only IDs can live beyond the tool range without shifting BLOCKS[id]. */
export const BLOCKS: BlockDef[] = [];
for (const def of BLOCK_DEFS) {
  if (BLOCKS[def.id]) throw new Error(`Duplicate block/item ID ${def.id}: ${BLOCKS[def.id].name} and ${def.name}`);
  BLOCKS[def.id] = def;
}

/** blocks rendered in the alpha-tested "cutout" pass (see-through gaps / fancy leaves) */
export const isCutout = (id: number) =>
  id === GLASS ||
  id === DOOR_WOOD ||
  id === DOOR_IRON ||
  id === FENCE_WOOD ||
  id === FENCE_STONE ||
  id === FENCE_IRON ||
  isLadder(id) ||
  id === WEB ||
  isLeafId(id);

/** world props the player can interact with E */
export const isInteractive = (id: number) =>
  id === DOOR_WOOD || id === DOOR_IRON || id === GLASS || id === CRAFTING_TABLE || isTreasureChest(id);

export const isOpaque = (id: number) =>
  id !== AIR &&
  id !== WATER &&
  id !== TORCH &&
  id !== BED &&
  id !== CAMPFIRE &&
  !(
    isCutout(id) ||
    isPlant(id) ||
    id === TURTLE_EGG ||
    id === PENGUIN_EGG || id === BIRD_NEST || id === CHICKEN_NEST ||
    isTreasureChest(id)
  );
export const isSolid = (id: number) => BLOCKS[id]?.solid ?? false;
export const isBreakable = (id: number) => BLOCKS[id]?.breakable ?? false;

export const PICKAXE_TIERS = [
  { name: 'WOOD', speed: 1.0, mult: 1.0, at: 0, color: '#c28b4f' },
  { name: 'STONE', speed: 1.4, mult: 1.12, at: 250, color: '#aeb9c0' },
  { name: 'IRON', speed: 1.9, mult: 1.28, at: 1100, color: '#e0e5dc' },
  { name: 'GOLD', speed: 2.25, mult: 1.2, at: 1800, color: '#f5c548' },
  { name: 'DIAMOND', speed: 2.65, mult: 1.55, at: 3200, color: '#51e1d2' },
  { name: 'NETHERITE', speed: 3.0, mult: 1.8, at: 5400, color: '#ff7045' },
] as const;
