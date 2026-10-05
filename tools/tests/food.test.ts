/** Focused coverage for crop-to-food recipes, size-aware meat, and the expanded armor sets. */
import {
  BLOCKS,
  HAY_BALE,
  MEAT_FAMILIES,
  MEAT_ITEM_IDS,
  MEAT_ITEM_LAST,
  MEAT_SIZES,
  WHEAT,
  isMeatItem,
} from '../../src/game/blocks';
import { cookedMeatForRaw, cookedMeatHeal, foodHeal, meatDropForAnimal, meatItemLabel } from '../../src/game/food';
import { gearRecipeInputs, ingredientSellValue } from '../../src/game/economy';
import { MATERIALS, type Material, type Slot } from '../../src/game/items';
import { HAND, getItemInvCategory, isToolId, RECIPES } from '../../src/game/recipes';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const slots: Slot[] = ['head', 'chest', 'legs', 'feet', 'hands', 'offhand'];
const setMaterials: Material[] = ['gold', 'emerald', 'redstone', 'lapis', 'netherite'];
for (const material of setMaterials) {
  for (const slot of slots) {
    const recipe = RECIPES.find((entry) => entry.kind === 'gear' && entry.material === material && entry.slot === slot);
    ok(!!recipe, `${material} ${slot} has a complete armor/shield recipe`);
    if (!recipe) continue;
    const expected = gearRecipeInputs(material, slot);
    ok(JSON.stringify(recipe.inputs) === JSON.stringify(expected), `${material} ${slot} recipe matches the economy ingredient table`);
    ok(ingredientSellValue(expected) > 0, `${material} ${slot} uses priced materials`);
  }
}
for (const slot of slots) {
  const diamondPiece = RECIPES.find((entry) => entry.kind === 'gear' && entry.material === 'diamond' && entry.slot === slot);
  ok(!!diamondPiece, `diamond ${slot} recipe is present, including leggings and boots`);
}

const hayBale = RECIPES.find((entry) => entry.key === 'hay_bale');
ok(!!hayBale && hayBale.out?.[0] === HAY_BALE && hayBale.inputs.length === 1 && hayBale.inputs[0][0] === WHEAT && hayBale.inputs[0][1] === 9,
  'Nine wheat craft one hay bale');

for (const family of MEAT_FAMILIES) {
  for (const size of MEAT_SIZES) {
    const pair = MEAT_ITEM_IDS[family][size];
    const recipe = RECIPES.find((entry) => entry.key === `cook_meat_${pair.raw}`);
    ok(isMeatItem(pair.raw) && isMeatItem(pair.cooked), `${family} ${size} raw/cooked ids are food items`);
    ok(BLOCKS[pair.raw]?.id === pair.raw && BLOCKS[pair.cooked]?.id === pair.cooked, `${family} ${size} meat definitions are indexed by their unique IDs`);
    ok(!isToolId(pair.raw) && !isToolId(pair.cooked), `${family} ${size} meat stacks are not misclassified as durable tools`);
    ok(cookedMeatForRaw(pair.raw) === pair.cooked, `${family} ${size} raw meat maps to its matching cooked dish`);
    ok(!!recipe && recipe.kind === 'cook' && recipe.out?.[0] === pair.cooked, `${family} ${size} has its own campfire cooking recipe`);
    ok(getItemInvCategory(pair.raw) === 'food' && getItemInvCategory(pair.cooked) === 'food', `${family} ${size} meat is in the food tab`);
    ok(cookedMeatHeal(pair.cooked) > 0 && cookedMeatHeal(pair.raw) === 0, `${family} ${size} cooked portion heals while raw meat does not`);
    const label = meatItemLabel(pair.raw) ?? '';
    ok(label.toLowerCase().includes(family) && label.toLowerCase().includes(size), `${family} ${size} raw meat name identifies animal and carcass size`, label);
  }
}

const salmon = meatDropForAnimal('fish', 4, 0.5);
const ordinaryFish = meatDropForAnimal('fish', 3, 0.5);
ok(salmon?.family === 'salmon' && salmon.size === 'medium' && salmon.count === 2, 'Salmon variant drops medium salmon meat even when its base fish model is small');
ok(ordinaryFish?.family === 'fish' && ordinaryFish.size === 'small' && ordinaryFish.count === 1, 'Other fish variants drop small generic fish meat');
const largeCow = meatDropForAnimal('cow', 0, 1.25);
const calf = meatDropForAnimal('calf', 0, 0.5);
ok(largeCow?.family === 'beef' && largeCow.size === 'large' && largeCow.count === 3, 'Large adult cattle yields several large beef portions');
ok(calf?.family === 'beef' && calf.size === 'small' && calf.count === 1, 'A calf yields one small beef portion');
ok(foodHeal(MEAT_ITEM_IDS.beef.large.cooked) > foodHeal(MEAT_ITEM_IDS.beef.small.cooked), 'Carcass size increases health restored per cooked portion');
ok(HAND !== MEAT_ITEM_LAST && HAND < 0, 'The permanent hand marker cannot overlap the 54 new meat item ids');
ok(getItemInvCategory(MEAT_ITEM_LAST) === 'food' && isMeatItem(MEAT_ITEM_LAST), 'The last meat item remains usable rather than being mistaken for the hand marker');
ok(Object.keys(MATERIALS).includes('redstone') && BLOCKS[MEAT_ITEM_IDS.salmon.medium.raw]?.name.toLowerCase().includes('salmon'), 'New material and salmon item definitions are registered');

export { passed, failures };
