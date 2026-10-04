import {
  APPLE,
  ARROW_ITEM,
  BANANA,
  BIRCH_LOG,
  BONE,
  CACTUS,
  CACTUS_PALE,
  CAT_CLAW,
  COAL,
  COAL_BLOCK,
  COBBLE,
  COOKED_MEAT,
  CHISELED_SANDSTONE,
  DOOR_WOOD,
  FENCE_STONE,
  FENCE_WOOD,
  COCONUT,
  CRAB_SHELL,
  DIAMOND,
  DIAMOND_BLOCK,
  DIRT,
  EMERALD,
  EMERALD_BLOCK,
  FEATHER,
  FISH_SCALE,
  FLESH,
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_RED,
  FLOWER_WHITE,
  FLOWER_YELLOW,
  GOLD,
  GOLD_BLOCK,
  GUNPOWDER,
  HONEY,
  IRON,
  IRON_BLOCK,
  LAPIS,
  LAPIS_BLOCK,
  LEAVES,
  LOG,
  NETHERITE,
  NETHERITE_INGOT,
  NETHERITE_ORE,
  PALM_LOG,
  PLANKS,
  QUARTZ,
  QUARTZ_BLOCK,
  RAW_MEAT,
  REDSTONE,
  REDSTONE_BLOCK,
  SAND,
  STONE,
  TURTLE_SHELL,
  VOLCANIC_STONE,
  WEB,
  WOOL,
  BLOCKS,
} from './blocks';
import type { Material, Slot } from './items';

/**
 * Five quality multipliers shared by trader purchases and gear resale. A higher rarity
 * always costs more and is worth more, without allowing a buy/sell score loop to profit.
 */
export const RARITY_PRICE_MULTIPLIERS = [1, 1.55, 2.25, 3.2, 4.6] as const;

/**
 * Resource and block prices are leaderboard points paid when selling to the trader. The relative
 * tiers follow Minecraft's acquisition chain: diamonds are deep-underground and Fortune-limited,
 * while Ancient Debris is nonrenewable, Nether-only, diamond-pick gated, and has no Fortune bonus.
 * References: minecraft.wiki/w/Diamond_Ore, minecraft.wiki/w/Ancient_Debris,
 * minecraft.wiki/w/Netherite_Scrap. The game's own four-item block recipes are preserved below.
 */
export const RESOURCE_SELL_PRICES: Readonly<Record<number, number>> = {
  [COAL]: 40,
  [IRON]: 100,
  [REDSTONE]: 140,
  [GOLD]: 220,
  [LAPIS]: 170,
  [DIAMOND]: 550,
  [EMERALD]: 650,
  [QUARTZ]: 130,

  // Mineral blocks in this game compress four material items, so keep their resale equal to 4×.
  [COAL_BLOCK]: 160,
  [IRON_BLOCK]: 400,
  [REDSTONE_BLOCK]: 560,
  [GOLD_BLOCK]: 880,
  [LAPIS_BLOCK]: 680,
  [DIAMOND_BLOCK]: 2200,
  [EMERALD_BLOCK]: 2600,
  [QUARTZ_BLOCK]: 520,

  [LOG]: 12,
  [BIRCH_LOG]: 12,
  [PALM_LOG]: 12,
  [RAW_MEAT]: 18,
  [COOKED_MEAT]: 18,
  [WEB]: 35,
  [BONE]: 30,
  [FLESH]: 15,
  [GUNPOWDER]: 60,
  // Eight arrows use one feather, one cobble and one plank; do not let the bundle out-sell them.
  [ARROW_ITEM]: 1,
  [FLOWER_RED]: 8,
  [FLOWER_YELLOW]: 8,
  [FLOWER_BLUE]: 8,
  [FLOWER_PINK]: 8,
  [FLOWER_PURPLE]: 9,
  [FLOWER_WHITE]: 8,
  [HONEY]: 25,

  // Ancient debris is Nether-only and requires a diamond-tier tool; scrap is the refined bottleneck.
  [NETHERITE_ORE]: 3600,
  [NETHERITE]: 4000,
  // 4 scraps + 4 gold ingots -> 1 ingot.
  [NETHERITE_INGOT]: 4 * 4000 + 4 * 220,

  [APPLE]: 12,
  [COCONUT]: 15,
  [BANANA]: 12,
  [VOLCANIC_STONE]: 7,
  [CACTUS]: 8,
  [CACTUS_PALE]: 8,
  [WOOL]: 10,
  [FEATHER]: 6,
  [TURTLE_SHELL]: 45,
  [CRAB_SHELL]: 32,
  [FISH_SCALE]: 8,
  [CAT_CLAW]: 40,
  [COBBLE]: 4,
  [STONE]: 5,
  [SAND]: 3,
  [DIRT]: 2,
  [LEAVES]: 2,
  // One log crafts four planks, keeping the conversion value-neutral (12 -> 4 × 3).
  [PLANKS]: 3,
  // Small building recipes produce multiple pieces; keep their aggregate resale at or below inputs.
  [DOOR_WOOD]: 4,
  [FENCE_WOOD]: 2,
  [FENCE_STONE]: 2,
  [CHISELED_SANDSTONE]: 5,
};

/**
 * Return the trader's resale value for any inventory block/resource. Unlisted building items
 * inherit a modest value from their mining score; important resources and crafted conversions
 * are explicit above so their prices cannot drift with unrelated score tuning.
 */
export function resourceSellPrice(id: number): number {
  const explicit = RESOURCE_SELL_PRICES[id];
  if (explicit !== undefined) return explicit;
  return Math.max(1, Math.round((BLOCKS[id]?.score ?? 1) * 0.8));
}

export type GearIngredient = [number, number];

type GearInputsBySlot = Readonly<Partial<Record<Slot, readonly GearIngredient[]>>>;
const COMMON_GEAR_INPUTS: Readonly<Record<Material, GearInputsBySlot>> = {
  wood: {
    head: [[PLANKS, 4]],
    chest: [[PLANKS, 6]],
    legs: [[PLANKS, 5]],
    feet: [[PLANKS, 3]],
    hands: [[PLANKS, 3]],
    offhand: [[PLANKS, 6]],
  },
  leather: {
    head: [[LEAVES, 5]],
    chest: [[LEAVES, 8]],
    legs: [[LEAVES, 7]],
    feet: [[LEAVES, 4]],
    hands: [[LEAVES, 3]],
    offhand: [[LEAVES, 5], [PLANKS, 2]],
  },
  iron: {
    head: [[IRON, 4]],
    chest: [[IRON, 6]],
    legs: [[IRON, 4]],
    feet: [[IRON, 3]],
    hands: [[IRON, 3], [LEAVES, 2]],
    offhand: [[IRON, 3], [PLANKS, 3]],
  },
  gold: {
    head: [[GOLD, 4]],
    chest: [[GOLD, 6]],
    legs: [[GOLD, 4]],
    feet: [[GOLD, 3]],
    hands: [[GOLD, 3], [LEAVES, 2]],
    offhand: [[GOLD, 3], [PLANKS, 3]],
  },
  diamond: {
    head: [[DIAMOND, 4]],
    chest: [[DIAMOND, 5]],
    legs: [[DIAMOND, 5]],
    feet: [[DIAMOND, 4]],
    hands: [[DIAMOND, 3]],
    offhand: [[DIAMOND, 3], [IRON, 2]],
  },
  // Netherite gear is upgraded from its diamond piece using one scrap in this game's anvil flow.
  netherite: {},
};

const SPECIAL_GEAR_INPUTS: Readonly<Record<string, readonly GearIngredient[]>> = {
  turtle_helmet: [[TURTLE_SHELL, 1], [FISH_SCALE, 2]],
  crab_shield: [[CRAB_SHELL, 1], [IRON, 2]],
  claw_gloves: [[CAT_CLAW, 2], [WEB, 2]],
};

/**
 * Ingredients represented by an armor piece. These mirror the craft recipes, and let both
 * trader prices and resale values follow actual resource rarity instead of a flat material tag.
 */
export function gearRecipeInputs(material: Material, slot: Slot, recipeKey?: string): GearIngredient[] {
  const special = recipeKey ? SPECIAL_GEAR_INPUTS[recipeKey] : undefined;
  if (special) return special.map(([id, count]) => [id, count]);
  if (material === 'netherite') {
    return [...gearRecipeInputs('diamond', slot), [NETHERITE, 1]];
  }
  const inputs = COMMON_GEAR_INPUTS[material][slot] ?? [[PLANKS, 3]];
  return inputs.map(([id, count]) => [id, count]);
}

/** Material value of a recipe input list, in the same points paid by the trader. */
export function ingredientSellValue(inputs: readonly GearIngredient[]): number {
  return inputs.reduce((total, [id, count]) => total + resourceSellPrice(id) * count, 0);
}
