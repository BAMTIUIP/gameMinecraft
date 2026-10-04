import {
  BLOCKS,
  COAL,
  COAL_BLOCK,
  DIAMOND,
  DIAMOND_BLOCK,
  EMERALD,
  EMERALD_BLOCK,
  GOLD,
  GOLD_BLOCK,
  IRON,
  IRON_BLOCK,
  LAPIS,
  LAPIS_BLOCK,
  LOG,
  NETHERITE,
  NETHERITE_INGOT,
  NETHERITE_ORE,
  PLANKS,
  QUARTZ,
  QUARTZ_BLOCK,
  REDSTONE,
  REDSTONE_BLOCK,
} from '../../src/game/blocks';
import { RECIPES, gearTraderCost, toolSellPrice, PICK_TOOLS, SWORD_TOOLS, AXE_TOOLS, SHOVEL_TOOLS, HOE_TOOLS, BOW_TOOLS } from '../../src/game/recipes';
import { gearSellPrice, type Material, type Rarity, type Slot } from '../../src/game/items';
import { getToolSpec } from '../../src/game/tools';
import { gearRecipeInputs, ingredientSellValue, RARITY_PRICE_MULTIPLIERS, resourceSellPrice } from '../../src/game/economy';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

// Every inventory block has a stable positive merchant price, including ids that use the score fallback.
for (const block of BLOCKS) {
  const price = resourceSellPrice(block.id);
  ok(Number.isInteger(price) && price > 0, `Sell price exists for ${block.name} (#${block.id})`, String(price));
}

// Mineral blocks use this game's four-item compression recipe; netherite scrap is deliberately above one.
// diamond block, and an ingot reflects its four scraps plus four gold inputs.
const mineralPairs: Array<[number, number]> = [
  [COAL, COAL_BLOCK], [IRON, IRON_BLOCK], [REDSTONE, REDSTONE_BLOCK], [GOLD, GOLD_BLOCK],
  [LAPIS, LAPIS_BLOCK], [DIAMOND, DIAMOND_BLOCK], [EMERALD, EMERALD_BLOCK], [QUARTZ, QUARTZ_BLOCK],
];
for (const [item, block] of mineralPairs) {
  ok(resourceSellPrice(block) === resourceSellPrice(item) * 4, `Mineral block #${block} preserves its four-item recipe value`);
}
ok(resourceSellPrice(NETHERITE) > resourceSellPrice(DIAMOND_BLOCK), 'One Netherite Scrap sells for more than a Diamond Block');
ok(resourceSellPrice(NETHERITE_ORE) > resourceSellPrice(DIAMOND_BLOCK), 'Unrefined Ancient Debris also outvalues a Diamond Block');
ok(
  resourceSellPrice(NETHERITE_INGOT) === 4 * resourceSellPrice(NETHERITE) + 4 * resourceSellPrice(GOLD),
  'Netherite Ingot resale matches the four-scrap, four-gold recipe',
);
ok(resourceSellPrice(PLANKS) * 4 === resourceSellPrice(LOG), 'Crafting four planks from one log does not inflate sale value');

// Check every direct-output recipe for accidental point creation through crafting and resale.
for (const recipe of RECIPES) {
  if (!recipe.out) continue;
  const [outputId, outputCount] = recipe.out;
  const inputValue = recipe.inputs.reduce((sum, [id, count]) => sum + resourceSellPrice(id) * count, 0);
  const outputValue = resourceSellPrice(outputId) * outputCount;
  ok(outputValue <= inputValue, `Recipe ${recipe.key} does not create resale points`, `${outputValue} output > ${inputValue} input`);
}

// Gear resale and trader costs use the actual material + slot recipe and scale across all five tiers.
const slots: Slot[] = ['head', 'chest', 'legs', 'feet', 'hands', 'offhand'];
const tradeMaterials: Material[] = ['iron', 'gold', 'diamond'];
for (const material of tradeMaterials) {
  for (const slot of slots) {
    const buyValues = RARITY_PRICE_MULTIPLIERS.map((_, index) => {
      const rarity = index as Rarity;
      const cost = gearTraderCost(rarity, material, slot);
      return ingredientSellValue(cost);
    });
    ok(buyValues.every((value, index) => index === 0 || value > buyValues[index - 1]), `${material} ${slot} trader cost rises with rarity`);

    const recipeValue = ingredientSellValue(gearRecipeInputs(material, slot));
    for (const rarityIndex of [0, 1, 2, 3, 4] as const) {
      const rarity = rarityIndex as Rarity;
      const affixCount = rarity === 0 ? 1 : rarity;
      const resale = gearSellPrice({
        material,
        slot,
        rarity,
        recipeKey: undefined,
        affixes: Array.from({ length: affixCount }, () => ({ id: 'swift' as const, value: 10 })),
      });
      ok(resale < buyValues[rarityIndex], `${material} ${slot} ${rarity} gear cannot be bought and resold for a point profit`, `${resale} resale >= ${buyValues[rarityIndex]} purchase`);
      if (rarity === 0) ok(resale < recipeValue, `${material} ${slot} common gear resale is discounted from its ingredients`);
    }
  }
}

// Durability and recipe tier affect tool resale; a worn tool never sells for its full-condition price.
const toolGroups = [PICK_TOOLS, SWORD_TOOLS, AXE_TOOLS, SHOVEL_TOOLS, HOE_TOOLS, BOW_TOOLS] as const;
for (const tools of toolGroups) {
  const tierValues = tools.map((id) => toolSellPrice(id));
  ok(tierValues.every((value, index) => index === 0 || value > tierValues[index - 1]), `Tool resale rises with material tier (${tools[0]})`);
  for (const id of tools.slice(0, -1)) {
    const spec = getToolSpec(id);
    if (!spec || spec.maxDurability <= 0) continue;
    const full = toolSellPrice(id, spec.maxDurability);
    const worn = toolSellPrice(id, Math.floor(spec.maxDurability / 2));
    ok(worn < full, `Worn tool #${id} sells for less than a new one`);
  }
}

const netheriteInputs = gearRecipeInputs('netherite', 'chest');
ok(netheriteInputs.some(([id, count]) => id === NETHERITE && count === 1), 'Netherite armor value includes the scrap consumed by the anvil upgrade');

export { passed, failures };
