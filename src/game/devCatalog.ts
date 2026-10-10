import { AIR, BEDROCK, BLOCKS, LAVA, WATER, isArrowId, isMeatItem, isOpenChest, isInventoryBlockId } from './blocks';
import { RARITY, MATERIALS, SLOTS, type Material, type Rarity, type Slot } from './items';
import { RECIPES, TOOL_TORCH } from './recipes';
import { getToolSpec } from './tools';

export type DeveloperGearVariant = { slot: Slot; material: Material; rarity: Rarity };
export type DeveloperCatalog = {
  itemIds: number[];
  toolIds: number[];
  gearVariants: DeveloperGearVariant[];
  gearRecipeKeys: string[];
};

/** Complete local test inventory: obtainable blocks/drops, every durable tool, and gear rolls. */
export function getDeveloperCatalog(): DeveloperCatalog {
  const itemIds = BLOCKS
    .filter((block) => block && block.id !== AIR && block.id !== BEDROCK && block.id !== LAVA && block.id !== WATER)
    .filter((block) => isInventoryBlockId(block.id) && !isOpenChest(block.id))
    .map((block) => block.id);
  const toolIds = Array.from({ length: 100 }, (_, index) => 200 + index)
    .filter((id) => getToolSpec(id) !== null);
  toolIds.push(TOOL_TORCH);

  const gearVariants = (Object.keys(MATERIALS) as Material[]).flatMap((material) =>
    SLOTS.flatMap((slot) => RARITY.map((_, rarity) => ({ slot, material, rarity: rarity as Rarity }))),
  );
  const gearRecipeKeys = RECIPES
    .filter((recipe) => recipe && recipe.kind === 'gear' && recipe.slot && recipe.material)
    .map((recipe) => recipe.key);

  return {
    itemIds: [...new Set(itemIds)].sort((a, b) => a - b),
    toolIds: [...new Set(toolIds)].sort((a, b) => a - b),
    gearVariants,
    gearRecipeKeys,
  };
}
