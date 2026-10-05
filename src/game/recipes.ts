import {
  BLOCKS,
  ANVIL,
  APPLE,
  COCONUT, BANANA,
  ARROW_ITEM,
  STONE_ARROW, IRON_ARROW, GOLD_ARROW, NETHERITE_ARROW, FIRE_ARROW, POISON_ARROW, FREEZE_ARROW, STUN_ARROW,
  BED,
  CAMPFIRE,
  CAT_CLAW,
  CRAB_SHELL,
  FEATHER,
  FISH_SCALE,
  HONEY,
  HAY_BALE,
  WHEAT,
  MEAT_FAMILIES,
  MEAT_SIZES,
  MEAT_ITEM_IDS,
  isMeatItem,
  TURTLE_SHELL,
  WOOL,
  FLOWER_BLUE,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_WHITE,
  LAMP_BLUE,
  LAMP_RED,
  LAMP_YELLOW,
  WEB,
  COAL,
  COBBLE,
  COOKED_MEAT,
  DIAMOND,
  PEDESTAL,
  PEDESTAL_GOLD,
  RAW_MEAT,
  DIAMOND_BLOCK,
  DOOR_IRON,
  DOOR_WOOD,
  FENCE_IRON,
  FENCE_STONE,
  FENCE_WOOD,
  GLASS,
  GOLD,
  GOLD_BLOCK,
  IRON,
  ICE,
  LEAVES,
  LOG,
  PLANKS,
  SAND,
  TORCH,
  BIRCH_LOG,
  PALM_LOG,
  LADDER_OAK,
  LADDER_BIRCH,
  LADDER_PALM,
  LADDER_RED,
  LADDER_BLUE,
  LADDER_YELLOW,
  LADDER_GREEN,
  LADDER_PINK,
  LADDER_PURPLE,
  LADDER_WHITE,
  LADDER_STONE,
  LADDER_IRON,
  CRAFTING_TABLE,
  NETHERITE,
  NETHERITE_INGOT,
  MUSHROOM,
  COAL_BLOCK,
  IRON_BLOCK,
  REDSTONE_BLOCK,
  LAPIS_BLOCK,
  EMERALD_BLOCK,
  QUARTZ_BLOCK,
  REDSTONE,
  LAPIS,
  EMERALD,
  QUARTZ,
  SANDSTONE,
  CHISELED_SANDSTONE,
} from './blocks';
import {
  AXE_TOOLS,
  BOW_TOOLS,
  HOE_TOOLS,
  PICK_TOOLS,
  SHOVEL_TOOLS,
  SWORD_TOOLS,
  TOOL_AXE,
  TOOL_BOW,
  TOOL_HOE,
  TOOL_PICK,
  TOOL_SHOVEL,
  TOOL_SWORD,
  TOOL_TORCH,
  TOOL_MATERIALS,
  getToolSpec,
  isAxeTool,
  isHoeTool,
  isPickTool,
  isShovelTool,
  isSwordTool,
  toolIdFor,
} from './tools';
import { blockName, swordLabel, toolLabelForId, t } from './i18n';
import type { Item, Material, Rarity, Slot } from './items';
import { gearRecipeInputs, RARITY_PRICE_MULTIPLIERS, resourceSellPrice } from './economy';

export {
  AXE_TOOLS,
  BOW_TOOLS,
  HOE_TOOLS,
  PICK_TOOLS,
  SHOVEL_TOOLS,
  SWORD_TOOLS,
  TOOL_AXE,
  TOOL_BOW,
  TOOL_HOE,
  TOOL_PICK,
  TOOL_SHOVEL,
  TOOL_SWORD,
  TOOL_TORCH,
  isAxeTool,
  isHoeTool,
  isPickTool,
  isShovelTool,
  isSwordTool,
};

export type RecipeKind =
  | 'blocks'
  | 'pickaxe'
  | 'time'
  | 'heal'
  | 'gear'
  | 'weapon'
  | 'torch'
  | 'cook'
  | 'food'
  | 'axe'
  | 'shovel'
  | 'hoe'
  | 'bow';

export type Recipe = {
  key: string;
  name: string;
  desc: string;
  inputs: Array<[number, number]>;
  out?: [number, number];
  kind: RecipeKind;
  tier?: number;
  seconds?: number;
  heal?: number;
  slot?: Slot;
  material?: Material;
  /** sword tier index */
  weapon?: number;
  /** explicit tool instance template produced by this recipe */
  toolId?: number;
  accent: string;
  hotkey: string;
  group: 'tools' | 'gear' | 'blocks' | 'food';
};

/** bare hand pseudo-item: always occupies hotbar slot 1 */
export const HAND = -1;
/** hotbar ids above this range are tools, not placeable blocks */
export const isToolId = (id: number) => id >= 200;

const MATERIAL_ITEMS = [PLANKS, COBBLE, IRON, GOLD, DIAMOND, NETHERITE_INGOT] as const;

function materialInputs(tier: number, materialCount: number, woodCount: number): Array<[number, number]> {
  if (tier === 0) return [[PLANKS, woodCount + materialCount]];
  return [[MATERIAL_ITEMS[tier], materialCount], [PLANKS, woodCount]];
}

export const SWORDS = TOOL_MATERIALS.map((material, tier) => ({
  name: swordLabel(tier),
  damage: material.swordDamage,
  color: material.edge,
  inputs: materialInputs(tier, 2, 1),
}));

/** short, localized ingredient/condition hint shown on every durable-tool recipe */
export function toolRecipeDesc(id: number): string {
  const spec = getToolSpec(id);
  if (!spec) return '';
  if (spec.maxDurability <= 0) return t('indestructible');
  const durability = String(spec.maxDurability);
  const repair = spec.repairResource === null ? '' : blockName(spec.repairResource, BLOCKS[spec.repairResource]?.name ?? '');
  return t('toolRecipeDesc').replace('{durability}', durability).replace('{resource}', repair);
}

const TOOL_RESALE_RATE = 0.72;

function bowRecipeValue(tier: number): number {
  if (tier <= 0) return resourceSellPrice(PLANKS) * 3 + resourceSellPrice(LEAVES) * 4;
  const upgradeMaterial = tier === 1 ? COBBLE : tier === 2 ? IRON : tier === 3 ? GOLD : tier === 4 ? DIAMOND : NETHERITE_INGOT;
  const materialCount = tier === 1 ? 3 : tier === 5 ? 1 : 2;
  const plankCount = tier >= 4 ? 1 : 2;
  return bowRecipeValue(tier - 1)
    + resourceSellPrice(upgradeMaterial) * materialCount
    + resourceSellPrice(PLANKS) * plankCount;
}

/** Recipe-based resale value for a tool, discounted for both resale and remaining durability. */
export function toolSellPrice(id: number, currentDurability?: number): number {
  const spec = getToolSpec(id);
  if (!spec) return 30; // torch and old non-durable utility items

  let ingredientValue: number;
  if (spec.kind === 'bow') {
    ingredientValue = bowRecipeValue(spec.tier);
  } else if (spec.tier === 0) {
    ingredientValue = resourceSellPrice(PLANKS) * (spec.kind === 'shovel' || spec.kind === 'hoe' ? 2 : 3);
  } else {
    const materialCount = spec.kind === 'sword' || spec.kind === 'hoe' ? 2 : spec.kind === 'shovel' ? 1 : 3;
    const handleCount = spec.kind === 'sword' ? 1 : 2;
    ingredientValue = resourceSellPrice(MATERIAL_ITEMS[spec.tier]) * materialCount
      + resourceSellPrice(PLANKS) * handleCount;
  }

  const durabilityRatio = spec.maxDurability > 0
    ? Math.max(0, Math.min(1, (currentDurability ?? spec.maxDurability) / spec.maxDurability))
    : 1;
  const conditionFactor = spec.maxDurability > 0 ? 0.25 + durabilityRatio * 0.75 : 1;
  return Math.max(1, Math.round(ingredientValue * TOOL_RESALE_RATE * conditionFactor));
}

function toolInputs(kind: 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'hoe', tier: number): Array<[number, number]> {
  if (tier === 0) return [[PLANKS, kind === 'shovel' || kind === 'hoe' ? 2 : 3]];
  const headCount = kind === 'sword' || kind === 'hoe' ? 2 : kind === 'shovel' ? 1 : 3;
  const handleCount = kind === 'sword' ? 1 : 2;
  return [[MATERIAL_ITEMS[tier], headCount], [PLANKS, handleCount]];
}

function toolRecipe(kind: 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'hoe', tier: number, hotkey = ''): Recipe {
  const toolId = toolIdFor(kind, tier);
  const material = TOOL_MATERIALS[tier];
  const prefix = kind === 'pickaxe' ? 'pick' : kind === 'sword' ? 'sword' : kind;
  const key = kind === 'shovel' && tier === 1 ? 'shovel' : `${prefix}_${material.key}`;
  const recipeKind: RecipeKind = kind === 'sword' ? 'weapon' : kind;
  return {
    key,
    name: toolLabelForId(toolId),
    desc: toolRecipeDesc(toolId),
    inputs: toolInputs(kind, tier),
    kind: recipeKind,
    tier,
    ...(kind === 'sword' ? { weapon: tier } : {}),
    toolId,
    accent: material.edge,
    hotkey,
    group: 'tools',
  };
}

const TOOL_RECIPES: Recipe[] = [
  ...TOOL_MATERIALS.flatMap((_, tier) => [
    toolRecipe('pickaxe', tier, tier < 4 ? String(tier + 2) : ''),
  ]),
  ...TOOL_MATERIALS.flatMap((_, tier) => [
    toolRecipe('sword', tier, tier < 3 ? String(tier + 6) : ''),
  ]),
  ...TOOL_MATERIALS.flatMap((_, tier) => [toolRecipe('axe', tier)]),
  ...TOOL_MATERIALS.flatMap((_, tier) => [toolRecipe('shovel', tier)]),
  ...TOOL_MATERIALS.flatMap((_, tier) => [toolRecipe('hoe', tier)]),
];

function bowRecipe(tier: number): Recipe {
  const id = BOW_TOOLS[tier];
  const material = TOOL_MATERIALS[tier];
  let inputs: Array<[number, number]>;
  if (tier === 0) {
    inputs = [[PLANKS, 3], [LEAVES, 4]];
  } else {
    const upgradeMaterial = tier === 1 ? COBBLE : tier === 2 ? IRON : tier === 3 ? GOLD : tier === 4 ? DIAMOND : NETHERITE_INGOT;
    const materialCount = tier === 1 ? 3 : tier === 5 ? 1 : 2;
    inputs = [[BOW_TOOLS[tier - 1], 1], [upgradeMaterial, materialCount], [PLANKS, tier >= 4 ? 1 : 2]];
  }
  return {
    key: tier === 0 ? 'bow' : `bow_${material.key}`,
    name: toolLabelForId(id),
    desc: toolRecipeDesc(id),
    inputs,
    kind: 'bow',
    tier,
    toolId: id,
    accent: material.edge,
    hotkey: '',
    group: 'tools',
  };
}

const BOW_RECIPES: Recipe[] = TOOL_MATERIALS.map((_, tier) => bowRecipe(tier));

function ladderRecipe(
  key: string,
  id: number,
  inputs: Array<[number, number]>,
  outputCount: number,
  accent: string,
  desc: string,
): Recipe {
  return {
    key,
    name: blockName(id, BLOCKS[id]?.name ?? 'LADDER'),
    desc,
    inputs,
    out: [id, outputCount],
    kind: 'blocks',
    accent,
    hotkey: '',
    group: 'blocks',
  };
}

const LADDER_RECIPES: Recipe[] = [
  ladderRecipe('ladder_oak', LADDER_OAK, [[PLANKS, 4]], 2, '#a87439', 'Two light wooden ladders, ready to mount on a solid wall.'),
  ladderRecipe('ladder_birch', LADDER_BIRCH, [[BIRCH_LOG, 2]], 2, '#d8bd83', 'Pale birch rails with a clean grain.'),
  ladderRecipe('ladder_palm', LADDER_PALM, [[PALM_LOG, 2]], 2, '#b58a4e', 'Tropical palm rails, light enough for a long climb.'),
  ladderRecipe('ladder_red', LADDER_RED, [[LADDER_OAK, 1], [FLOWER_RED, 1]], 1, '#d55248', 'Dye an oak ladder with a red flower.'),
  ladderRecipe('ladder_blue', LADDER_BLUE, [[LADDER_OAK, 1], [FLOWER_BLUE, 1]], 1, '#5d91df', 'Dye an oak ladder with a blue flower.'),
  ladderRecipe('ladder_yellow', LADDER_YELLOW, [[LADDER_OAK, 1], [FLOWER_YELLOW, 1]], 1, '#e4c144', 'Dye an oak ladder with a yellow flower.'),
  ladderRecipe('ladder_green', LADDER_GREEN, [[LADDER_OAK, 1], [LEAVES, 2]], 1, '#68aa59', 'Stain an oak ladder with crushed green leaves.'),
  ladderRecipe('ladder_pink', LADDER_PINK, [[LADDER_OAK, 1], [FLOWER_PINK, 1]], 1, '#e186b1', 'Dye an oak ladder with a pink flower.'),
  ladderRecipe('ladder_purple', LADDER_PURPLE, [[LADDER_OAK, 1], [FLOWER_PURPLE, 1]], 1, '#9d70d1', 'Dye an oak ladder with a purple flower.'),
  ladderRecipe('ladder_white', LADDER_WHITE, [[LADDER_OAK, 1], [FLOWER_WHITE, 1]], 1, '#e7e4dc', 'Bleach an oak ladder with a white daisy.'),
  ladderRecipe('ladder_stone', LADDER_STONE, [[COBBLE, 5], [PLANKS, 2]], 2, '#9da5ac', 'A heavy stone ladder reinforced with oak rungs.'),
  ladderRecipe('ladder_iron', LADDER_IRON, [[IRON, 4], [PLANKS, 2]], 2, '#c2d1d7', 'A reinforced iron ladder with durable wooden rungs.'),
];

const MEAT_COOK_RECIPES: Recipe[] = MEAT_FAMILIES.flatMap((family) =>
  MEAT_SIZES.map((size) => {
    const { raw, cooked } = MEAT_ITEM_IDS[family][size];
    const name = BLOCKS[raw]?.name ?? `${size} ${family} meat`;
    return {
      key: `cook_meat_${raw}`,
      name: `COOK ${name.toUpperCase()}`,
      desc: 'Roast one portion at a nearby campfire.',
      inputs: [[raw, 1]],
      out: [cooked, 1],
      kind: 'cook' as const,
      accent: '#c07c42',
      hotkey: '',
      group: 'food' as const,
    };
  }),
);

const GEAR_SLOT_LABELS: Record<Slot, string> = {
  head: 'HELMET', chest: 'CHESTPLATE', legs: 'LEGGINGS', feet: 'BOOTS', hands: 'GAUNTLETS', offhand: 'SHIELD',
};
function gearSet(material: Material, label: string, accent: string, inputs: Record<Slot, Array<[number, number]>>): Recipe[] {
  return (['head', 'chest', 'legs', 'feet', 'hands', 'offhand'] as Slot[]).map((slot) =>
    gear(`${slot}_${material}`, `${label} ${GEAR_SLOT_LABELS[slot]}`, slot, material, inputs[slot], accent),
  );
}

export const RECIPES: Recipe[] = [
  ...TOOL_RECIPES,
  {
    key: 'planks',
    name: 'OAK PLANKS',
    desc: 'Split an oak log into building boards',
    inputs: [[LOG, 1]],
    out: [PLANKS, 4],
    kind: 'blocks',
    accent: '#c09a61',
    hotkey: '1',
    group: 'blocks',
  },
  {
    key: 'planks_birch',
    name: 'BIRCH PLANKS',
    desc: 'Split a birch log into building boards',
    inputs: [[BIRCH_LOG, 1]],
    out: [PLANKS, 4],
    kind: 'blocks',
    accent: '#e6e4dc',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'crafting_table',
    name: 'WORKBENCH',
    desc: 'Place anywhere, press E to craft · 4 planks',
    inputs: [[PLANKS, 4]],
    out: [CRAFTING_TABLE, 1],
    kind: 'blocks',
    accent: '#c09a61',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'lantern',
    name: 'LANTERN',
    desc: 'Lights up the shaft — place it anywhere',
    inputs: [
      [COAL, 1],
      [PLANKS, 1],
    ],
    out: [TORCH, 4],
    kind: 'blocks',
    accent: '#f4b942',
    hotkey: '2',
    group: 'blocks',
  },
  {
    key: 'netherite_ingot',
    name: 'NETHERITE INGOT',
    desc: 'Forge 4 ancient scraps with 4 gold ingots',
    inputs: [[NETHERITE, 4], [GOLD, 4]],
    out: [NETHERITE_INGOT, 1],
    kind: 'blocks',
    accent: '#ff7045',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'overdrive',
    name: 'SHIFT OVERDRIVE',
    desc: 'Burns gold for +25 seconds on the clock',
    inputs: [
      [GOLD, 2],
      [COAL, 1],
    ],
    kind: 'time',
    seconds: 25,
    accent: '#7ee7a0',
    hotkey: '9',
    group: 'tools',
  },
  {
    key: 'patch',
    name: 'FIELD PATCH',
    desc: 'Iron splints and leaf bandages · +35 HP',
    inputs: [
      [IRON, 2],
      [LEAVES, 4],
    ],
    kind: 'heal',
    heal: 35,
    accent: '#e2564a',
    hotkey: '0',
    group: 'tools',
  },

  ...BOW_RECIPES,
  {
    key: 'arrows',
    name: 'ARROWS ×8',
    desc: 'Minecraft recipe: stick + flint + feather',
    inputs: [
      [PLANKS, 1],
      [COBBLE, 1],
      [FEATHER, 1],
    ],
    out: [ARROW_ITEM, 8],
    kind: 'blocks',
    accent: '#e8e2d2',
    hotkey: '',
    group: 'tools',
  },
  { key: 'arrows_stone', name: 'STONE ARROWS ×8', desc: 'Stone arrowheads · stronger impact', inputs: [[PLANKS, 1], [COBBLE, 2], [FEATHER, 1]], out: [STONE_ARROW, 8], kind: 'blocks', accent: '#aeb7c0', hotkey: '', group: 'tools' },
  { key: 'arrows_iron', name: 'IRON ARROWS ×8', desc: 'Iron arrowheads · piercing shot', inputs: [[PLANKS, 1], [IRON, 1], [FEATHER, 1]], out: [IRON_ARROW, 8], kind: 'blocks', accent: '#d5e3e8', hotkey: '', group: 'tools' },
  { key: 'arrows_gold', name: 'GOLDEN ARROWS ×8', desc: 'Golden arrowheads · bright tracer', inputs: [[PLANKS, 1], [GOLD, 1], [FEATHER, 1]], out: [GOLD_ARROW, 8], kind: 'blocks', accent: '#f4c34f', hotkey: '', group: 'tools' },
  { key: 'arrows_netherite', name: 'NETHERITE ARROWS ×8', desc: 'Netherite arrowheads · devastating shot', inputs: [[PLANKS, 1], [NETHERITE_INGOT, 1], [FEATHER, 1]], out: [NETHERITE_ARROW, 8], kind: 'blocks', accent: '#ff765b', hotkey: '', group: 'tools' },
  { key: 'arrows_fire', name: 'FIRE ARROWS ×8', desc: 'Burning arrows · ignites targets', inputs: [[ARROW_ITEM, 8], [TORCH, 1]], out: [FIRE_ARROW, 8], kind: 'blocks', accent: '#ff7338', hotkey: '', group: 'tools' },
  { key: 'arrows_poison', name: 'POISON ARROWS ×8', desc: 'Poison arrows · damage over time', inputs: [[ARROW_ITEM, 8], [FLOWER_PURPLE, 1]], out: [POISON_ARROW, 8], kind: 'blocks', accent: '#9d70d1', hotkey: '', group: 'tools' },
  { key: 'arrows_freeze', name: 'FREEZE ARROWS ×8', desc: 'Freezing arrows · slows targets', inputs: [[ARROW_ITEM, 8], [ICE, 1]], out: [FREEZE_ARROW, 8], kind: 'blocks', accent: '#76dff5', hotkey: '', group: 'tools' },
  { key: 'arrows_stun', name: 'STUN ARROWS ×8', desc: 'Stunning arrows · briefly stuns targets', inputs: [[ARROW_ITEM, 8], [GOLD, 1]], out: [STUN_ARROW, 8], kind: 'blocks', accent: '#f6dc72', hotkey: '', group: 'tools' },
  {
    key: 'torch_hand',
    name: 'HAND TORCH',
    desc: 'Carry fire — lights caves and the night around you',
    inputs: [
      [COAL, 1],
      [PLANKS, 1],
    ],
    kind: 'torch',
    accent: '#ffb03a',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'hay_bale',
    name: 'HAY BALE',
    desc: 'Compress nine wheat into a bale; place it under a campfire to double its smoke column.',
    inputs: [[WHEAT, 9]],
    out: [HAY_BALE, 1],
    kind: 'blocks',
    accent: '#d8b64b',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'campfire',
    name: 'CAMPFIRE',
    desc: 'Place it, then cook raw meat while standing close',
    inputs: [
      [LOG, 2],
      [COAL, 1],
    ],
    out: [CAMPFIRE, 1],
    kind: 'blocks',
    accent: '#ff8a2b',
    hotkey: '',
    group: 'food',
  },
  , { key: 'campfire_birch', name: 'BIRCH CAMPFIRE', desc: 'Campfire made with birch logs', inputs: [[BIRCH_LOG, 2], [COAL, 1]], out: [CAMPFIRE, 1], kind: 'blocks', accent: '#ff8a2b', hotkey: '', group: 'food' },
  { key: 'campfire_palm', name: 'PALM CAMPFIRE', desc: 'Campfire made with palm logs', inputs: [[PALM_LOG, 2], [COAL, 1]], out: [CAMPFIRE, 1], kind: 'blocks', accent: '#ff8a2b', hotkey: '', group: 'food' },
  {
    key: 'cook_meat',
    name: 'COOK MEAT',
    desc: 'Needs a lit campfire within 4 blocks',
    inputs: [[RAW_MEAT, 1]],
    out: [COOKED_MEAT, 1],
    kind: 'cook',
    accent: '#c07c42',
    hotkey: '',
    group: 'food',
  },
  ...MEAT_COOK_RECIPES,
  {
    key: 'eat_apple',
    name: 'EAT APPLE',
    desc: 'Sweet crisp orchard fruit — restores 20 HP',
    inputs: [[APPLE, 1]],
    kind: 'food',
    heal: 20,
    accent: '#e23628',
    hotkey: '',
    group: 'food',
  },
  {
    key: 'eat_coconut', name: 'EAT COCONUT', desc: 'Fresh coconut — restores 22 HP',
    inputs: [[COCONUT, 1]], kind: 'food', heal: 22, accent: '#9a7449', hotkey: '', group: 'food',
  },
  {
    key: 'eat_banana', name: 'EAT BANANA', desc: 'Sweet banana — restores 16 HP',
    inputs: [[BANANA, 1]], kind: 'food', heal: 16, accent: '#f2cf51', hotkey: '', group: 'food',
  },
  {
    key: 'eat_meat',
    name: 'EAT STEAK',
    desc: 'A hot meal — restores 30 HP',
    inputs: [[COOKED_MEAT, 1]],
    kind: 'food',
    heal: 30,
    accent: '#e2564a',
    hotkey: '',
    group: 'food',
  },
  {
    key: 'eat_honey',
    name: 'EAT HONEY',
    desc: 'Sweet energy from a bee hive — +15 HP',
    inputs: [[HONEY, 1]],
    kind: 'food',
    heal: 15,
    accent: '#f4b83a',
    hotkey: '',
    group: 'food',
  },
  {
    key: 'anvil',
    name: 'ANVIL',
    desc: 'Place it, press E — upgrade & reinforce gear',
    inputs: [
      [IRON, 5],
      [COBBLE, 2],
    ],
    out: [ANVIL, 1],
    kind: 'blocks',
    accent: '#787c88',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'bed',
    name: 'BED',
    desc: 'Minecraft classic: 3 wool + 3 planks · E at night to sleep',
    inputs: [
      [PLANKS, 3],
      [WOOL, 3],
    ],
    out: [BED, 1],
    kind: 'blocks',
    accent: '#c2453a',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'wool_block',
    name: 'WOOL BLOCK',
    desc: 'Soft building block, spun from fleece',
    inputs: [[WEB, 4]],
    out: [WOOL, 1],
    kind: 'blocks',
    accent: '#eeeeeb',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'honey_elixir',
    name: 'HONEY ELIXIR',
    desc: 'Potion of golden light — restores 50 HP',
    inputs: [
      [HONEY, 2],
      [FLOWER_RED, 1],
    ],
    kind: 'food',
    heal: 50,
    accent: '#ffd97a',
    hotkey: '',
    group: 'food',
  },
  {
    key: 'turtle_helmet',
    name: 'TURTLE SHELL HELMET',
    desc: 'Minecraft-style scute helmet — sturdy head plate',
    inputs: [
      [TURTLE_SHELL, 1],
      [FISH_SCALE, 2],
    ],
    kind: 'gear',
    slot: 'head',
    material: 'iron',
    accent: '#4d8c5a',
    hotkey: '',
    group: 'gear',
  },
  {
    key: 'crab_shield',
    name: 'CRAB SHELL SHIELD',
    desc: 'Chitin buckler for the off-hand',
    inputs: [
      [CRAB_SHELL, 1],
      [IRON, 2],
    ],
    kind: 'gear',
    slot: 'offhand',
    material: 'iron',
    accent: '#d85a3a',
    hotkey: '',
    group: 'gear',
  },
  {
    key: 'claw_gloves',
    name: 'CLAW GAUNTLETS',
    desc: 'Lynx claws stitched into web silk — swift strikes',
    inputs: [
      [CAT_CLAW, 2],
      [WEB, 2],
    ],
    kind: 'gear',
    slot: 'hands',
    material: 'leather',
    accent: '#e6dcc8',
    hotkey: '',
    group: 'gear',
  },
  {
    key: 'lamp_red',
    name: 'RED LAMP',
    desc: 'Warm crimson glow for the den',
    inputs: [
      [FLOWER_RED, 2],
      [GLASS, 1],
      [COAL, 1],
    ],
    out: [LAMP_RED, 2],
    kind: 'blocks',
    accent: '#ff6e64',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'lamp_blue',
    name: 'BLUE LAMP',
    desc: 'Cool moonlight shade',
    inputs: [
      [FLOWER_BLUE, 2],
      [GLASS, 1],
      [COAL, 1],
    ],
    out: [LAMP_BLUE, 2],
    kind: 'blocks',
    accent: '#6e96ff',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'lamp_yellow',
    name: 'GOLDEN LAMP',
    desc: 'Sunny parlour light',
    inputs: [
      [FLOWER_YELLOW, 2],
      [GLASS, 1],
      [COAL, 1],
    ],
    out: [LAMP_YELLOW, 2],
    kind: 'blocks',
    accent: '#ffdc64',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'pedestal',
    name: 'STONE PEDESTAL',
    desc: 'Glowing column — home lighting on a stand',
    inputs: [
      [COBBLE, 2],
      [COAL, 1],
    ],
    out: [PEDESTAL, 2],
    kind: 'blocks',
    accent: '#b9b9c0',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'pedestal_gold',
    name: 'GILDED PEDESTAL',
    desc: 'A trophy light for the throne room',
    inputs: [
      [GOLD, 1],
      [COBBLE, 2],
    ],
    out: [PEDESTAL_GOLD, 2],
    kind: 'blocks',
    accent: '#f7d34b',
    hotkey: '',
    group: 'blocks',
  },

  // ---------------- building ----------------
  {
    key: 'glass',
    name: 'WINDOW PANE',
    desc: 'Sand fired with coal — see-through glazing. E opens it.',
    inputs: [
      [SAND, 2],
      [COAL, 1],
    ],
    out: [GLASS, 4],
    kind: 'blocks',
    accent: '#bfe4f0',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'door_wood',
    name: 'WOODEN DOOR',
    desc: 'Stack two for a full doorway · E to open',
    inputs: [[PLANKS, 3]],
    out: [DOOR_WOOD, 2],
    kind: 'blocks',
    accent: '#c09a61',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'door_iron',
    name: 'IRON DOOR',
    desc: 'Monster-proof entrance · E to open',
    inputs: [
      [IRON, 3],
      [PLANKS, 1],
    ],
    out: [DOOR_IRON, 2],
    kind: 'blocks',
    accent: '#c8ccd2',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'fence_wood',
    name: 'WOODEN FENCE',
    desc: 'Cheap picket line for your yard',
    inputs: [[PLANKS, 2]],
    out: [FENCE_WOOD, 3],
    kind: 'blocks',
    accent: '#c09a61',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'fence_stone',
    name: 'STONE FENCE',
    desc: 'Low rampart wall — mobs cannot chew it',
    inputs: [[COBBLE, 2]],
    out: [FENCE_STONE, 3],
    kind: 'blocks',
    accent: '#9aa0a6',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'fence_iron',
    name: 'IRON BARS',
    desc: 'Prison-grade fencing for the keep',
    inputs: [
      [IRON, 1],
      [COBBLE, 1],
    ],
    out: [FENCE_IRON, 4],
    kind: 'blocks',
    accent: '#c8ccd2',
    hotkey: '',
    group: 'blocks',
  },
  ...LADDER_RECIPES,

  // ---------------- armour ----------------
  // Full leather set: the game uses leaves as its early-game hide/fibre resource.
  gear('helmet_leather', 'LEATHER HELMET', 'head', 'leather', [[LEAVES, 5]], '#a3763f'),
  gear('chest_leather', 'LEATHER TUNIC', 'chest', 'leather', [[LEAVES, 8]], '#a3763f'),
  gear('legs_leather', 'LEATHER LEGGINGS', 'legs', 'leather', [[LEAVES, 7]], '#a3763f'),
  gear('feet_leather', 'LEATHER BOOTS', 'feet', 'leather', [[LEAVES, 4]], '#a3763f'),
  gear('hands_leather', 'LEATHER GLOVES', 'hands', 'leather', [[LEAVES, 3]], '#a3763f'),
  gear('legs_iron', 'IRON LEGGINGS', 'legs', 'iron', [[IRON, 4]], '#d6d9dd'),
  gear('feet_iron', 'IRON BOOTS', 'feet', 'iron', [[IRON, 3]], '#d6d9dd'),
  gear('hands_iron', 'IRON GAUNTLETS', 'hands', 'iron', [[IRON, 3], [LEAVES, 2]], '#d6d9dd'),
  gear('head_iron', 'IRON HELMET', 'head', 'iron', [[IRON, 4]], '#d6d9dd'),
  gear('chest_iron', 'IRON CHESTPLATE', 'chest', 'iron', [[IRON, 6]], '#d6d9dd'),
  gear('shield_wood', 'WOODEN SHIELD', 'offhand', 'wood', [[PLANKS, 6]], '#8b623d'),
  gear('shield_leather', 'LEATHER SHIELD', 'offhand', 'leather', [[LEAVES, 5], [PLANKS, 2]], '#a3763f'),
  gear('shield_iron', 'IRON SHIELD', 'offhand', 'iron', [[IRON, 3], [PLANKS, 3]], '#d6d9dd'),
  gear('chest_diamond', 'DIAMOND CHESTPLATE', 'chest', 'diamond', [[DIAMOND, 5]], '#5fe8dc'),
  gear('head_diamond', 'DIAMOND HELMET', 'head', 'diamond', [[DIAMOND, 4]], '#5fe8dc'),
  gear('hands_diamond', 'DIAMOND GAUNTLETS', 'hands', 'diamond', [[DIAMOND, 3]], '#5fe8dc'),
  gear('shield_diamond', 'DIAMOND SHIELD', 'offhand', 'diamond', [[DIAMOND, 3], [IRON, 2]], '#5fe8dc'),
  gear('legs_diamond', 'DIAMOND LEGGINGS', 'legs', 'diamond', [[DIAMOND, 5]], '#5fe8dc'),
  gear('feet_diamond', 'DIAMOND BOOTS', 'feet', 'diamond', [[DIAMOND, 4]], '#5fe8dc'),
  ...gearSet('gold', 'GOLD', '#f7d34b', {
    head: [[GOLD, 5]], chest: [[GOLD, 8]], legs: [[GOLD, 7]], feet: [[GOLD, 4]],
    hands: [[GOLD, 3], [LEAVES, 2]], offhand: [[GOLD, 4], [PLANKS, 3]],
  }),
  ...gearSet('emerald', 'EMERALD', '#34d47a', {
    head: [[EMERALD, 4]], chest: [[EMERALD, 7]], legs: [[EMERALD, 6]], feet: [[EMERALD, 4]],
    hands: [[EMERALD, 3]], offhand: [[EMERALD, 3], [IRON, 2]],
  }),
  ...gearSet('redstone', 'REDSTONE', '#dc514b', {
    head: [[REDSTONE, 10]], chest: [[REDSTONE, 16]], legs: [[REDSTONE, 14]], feet: [[REDSTONE, 8]],
    hands: [[REDSTONE, 6]], offhand: [[REDSTONE, 8], [IRON, 2]],
  }),
  ...gearSet('lapis', 'LAPIS', '#416de0', {
    head: [[LAPIS, 4], [IRON, 1]], chest: [[LAPIS, 7], [IRON, 2]], legs: [[LAPIS, 6], [IRON, 2]],
    feet: [[LAPIS, 3], [IRON, 1]], hands: [[LAPIS, 3], [IRON, 1]], offhand: [[LAPIS, 4], [IRON, 2], [PLANKS, 2]],
  }),
  ...gearSet('netherite', 'NETHERITE', '#8a6a58', {
    head: [[DIAMOND, 4], [NETHERITE, 1]], chest: [[DIAMOND, 5], [NETHERITE, 1]],
    legs: [[DIAMOND, 5], [NETHERITE, 1]], feet: [[DIAMOND, 4], [NETHERITE, 1]],
    hands: [[DIAMOND, 3], [NETHERITE, 1]], offhand: [[DIAMOND, 3], [IRON, 2], [NETHERITE, 1]],
  }),

  // ---------------- mineral blocks (Row 3 of reference table) ----------------
  {
    key: 'coal_block',
    name: 'COAL BLOCK',
    desc: 'Compacted coal block — fuel & dark building stone',
    inputs: [[COAL, 4]],
    out: [COAL_BLOCK, 1],
    kind: 'blocks',
    accent: '#4a4c58',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'iron_block',
    name: 'IRON BLOCK',
    desc: 'Solid forged iron block — heavy metallic plating',
    inputs: [[IRON, 4]],
    out: [IRON_BLOCK, 1],
    kind: 'blocks',
    accent: '#dcdedf',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'redstone_block',
    name: 'REDSTONE BLOCK',
    desc: 'Glowing block of compacted redstone dust',
    inputs: [[REDSTONE, 4]],
    out: [REDSTONE_BLOCK, 1],
    kind: 'blocks',
    accent: '#e0241a',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'gold_block',
    name: 'GOLD BLOCK',
    desc: 'Compressed wealth — a monument to the run',
    inputs: [[GOLD, 4]],
    out: [GOLD_BLOCK, 1],
    kind: 'blocks',
    accent: '#f7d34b',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'lapis_block',
    name: 'LAPIS BLOCK',
    desc: 'Deep royal ultramarine stone block crafted from lapis lazuli',
    inputs: [[LAPIS, 4]],
    out: [LAPIS_BLOCK, 1],
    kind: 'blocks',
    accent: '#3e6df2',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'diamond_block',
    name: 'DIAMOND BLOCK',
    desc: 'The trophy block. Mine it back for 1400.',
    inputs: [[DIAMOND, 4]],
    out: [DIAMOND_BLOCK, 1],
    kind: 'blocks',
    accent: '#5fe8dc',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'emerald_block',
    name: 'EMERALD BLOCK',
    desc: 'Precious faceted emerald block — gleaming treasure',
    inputs: [[EMERALD, 4]],
    out: [EMERALD_BLOCK, 1],
    kind: 'blocks',
    accent: '#2bd45e',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'quartz_block',
    name: 'QUARTZ BLOCK',
    desc: 'Smooth marble-white block crafted from 4 nether quartz',
    inputs: [[QUARTZ, 4]],
    out: [QUARTZ_BLOCK, 1],
    kind: 'blocks',
    accent: '#f0ebe3',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'sandstone_block',
    name: 'SANDSTONE',
    desc: 'Compress 4 sand into solid desert sandstone',
    inputs: [[SAND, 4]],
    out: [SANDSTONE, 1],
    kind: 'blocks',
    accent: '#ded09c',
    hotkey: '',
    group: 'blocks',
  },
  {
    key: 'chiseled_sandstone_block',
    name: 'CHISELED SANDSTONE',
    desc: 'Carved hieroglyphic sandstone block',
    inputs: [[SANDSTONE, 2]],
    out: [CHISELED_SANDSTONE, 2],
    kind: 'blocks',
    accent: '#e4d6a2',
    hotkey: '',
    group: 'blocks',
  },
];

function gear(
  key: string,
  name: string,
  slot: Slot,
  material: Material,
  inputs: Array<[number, number]>,
  accent: string,
): Recipe {
  return {
    key,
    name,
    desc: `${slot.toUpperCase()} · ${material.toUpperCase()} plating`,
    inputs,
    kind: 'gear',
    slot,
    material,
    accent,
    hotkey: '',
    group: 'gear',
  };
}

export type InvCategory = 'all' | 'tools' | 'food' | 'armor' | 'blocks' | 'pets';

/**
 * Categorize any owned inventory item id into one of the general inventory tabs:
 * - 'tools': weapons, tools, arrows, workbench, anvil
 * - 'food': food, fruits, meat, honey, flowers/potions, campfire
 * - 'armor': gear items (id >= 300)
 * - 'blocks': building blocks & raw materials
 */
export function getItemInvCategory(id: number): Exclude<InvCategory, 'all' | 'pets'> {
  if (id >= 300) return 'armor';
  // Food must win before the numeric tool/arrow range: cooked meat ids are
  // generated dynamically and can overlap the high item range.
  if (
    isMeatItem(id) ||
    id === APPLE ||
    id === COCONUT ||
    id === BANANA ||
    id === HONEY ||
    id === MUSHROOM ||
    id === FLOWER_RED ||
    id === FLOWER_YELLOW ||
    id === FLOWER_BLUE ||
    id === FLOWER_PINK ||
    id === FLOWER_PURPLE ||
    id === FLOWER_WHITE ||
    id === CAMPFIRE
  ) {
    return 'food';
  }
  if (id >= 154 || id === ARROW_ITEM || id === CRAFTING_TABLE || id === ANVIL) return 'tools';
  return 'blocks';
}

/**
 * Compute reduced ingredients returned when dismantling a craftable item at the Workbench.
 * Returns null if the item is a non-craftable raw material.
 */
export function getSalvageForItemId(id: number): { inputsUsed: number; outputs: Array<[number, number]> } | null {
  const tool = getToolSpec(id);
  if (tool) {
    if (tool.kind === 'bow') {
      if (tool.tier === 0) return { inputsUsed: 1, outputs: [[PLANKS, 2], [LEAVES, 2]] };
      return { inputsUsed: 1, outputs: [[PLANKS, 1], [MATERIAL_ITEMS[tool.tier], 1]] };
    }
    if (tool.tier === 0) return { inputsUsed: 1, outputs: [[PLANKS, 2]] };
    const materialId = MATERIAL_ITEMS[tool.tier];
    const materialCount = tool.kind === 'pickaxe' || tool.kind === 'axe' || tool.kind === 'hoe' ? 2 : 1;
    return { inputsUsed: 1, outputs: [[materialId, materialCount], [PLANKS, 1]] };
  }
  if (id === TOOL_TORCH) return { inputsUsed: 1, outputs: [[PLANKS, 1]] };

  // 5. Crafted blocks & items from RECIPES
  switch (id) {
    case CRAFTING_TABLE:
      return { inputsUsed: 1, outputs: [[PLANKS, 2]] };
    case ANVIL:
      return { inputsUsed: 1, outputs: [[IRON, 3], [COBBLE, 1]] };
    case BED:
      return { inputsUsed: 1, outputs: [[PLANKS, 2], [WOOL, 2]] };
    case CAMPFIRE:
      return { inputsUsed: 1, outputs: [[LOG, 1], [COAL, 1]] };
    case WOOL:
      return { inputsUsed: 1, outputs: [[WEB, 2]] };
    case COAL_BLOCK:
      return { inputsUsed: 1, outputs: [[COAL, 2]] };
    case IRON_BLOCK:
      return { inputsUsed: 1, outputs: [[IRON, 2]] };
    case REDSTONE_BLOCK:
      return { inputsUsed: 1, outputs: [[REDSTONE, 2]] };
    case GOLD_BLOCK:
      return { inputsUsed: 1, outputs: [[GOLD, 2]] };
    case LAPIS_BLOCK:
      return { inputsUsed: 1, outputs: [[LAPIS, 2]] };
    case DIAMOND_BLOCK:
      return { inputsUsed: 1, outputs: [[DIAMOND, 2]] };
    case EMERALD_BLOCK:
      return { inputsUsed: 1, outputs: [[EMERALD, 2]] };
    case QUARTZ_BLOCK:
      return { inputsUsed: 1, outputs: [[QUARTZ, 2]] };
    case NETHERITE_INGOT:
      return { inputsUsed: 1, outputs: [[NETHERITE, 2], [GOLD, 2]] };
    case SANDSTONE:
      return { inputsUsed: 1, outputs: [[SAND, 2]] };
    case CHISELED_SANDSTONE:
      return { inputsUsed: 1, outputs: [[SANDSTONE, 1]] };
    case DOOR_WOOD:
      return { inputsUsed: 1, outputs: [[PLANKS, 1]] };
    case DOOR_IRON:
      return { inputsUsed: 1, outputs: [[IRON, 1]] };
    case FENCE_WOOD:
      return { inputsUsed: 1, outputs: [[PLANKS, 1]] };
    case FENCE_STONE:
      return { inputsUsed: 1, outputs: [[COBBLE, 1]] };
    case FENCE_IRON:
      return { inputsUsed: 1, outputs: [[COBBLE, 1]] };
    case LADDER_OAK:
      return { inputsUsed: 1, outputs: [[PLANKS, 2]] };
    case LADDER_BIRCH:
      return { inputsUsed: 1, outputs: [[BIRCH_LOG, 1]] };
    case LADDER_PALM:
      return { inputsUsed: 1, outputs: [[PALM_LOG, 1]] };
    case LADDER_RED:
    case LADDER_BLUE:
    case LADDER_YELLOW:
    case LADDER_GREEN:
    case LADDER_PINK:
    case LADDER_PURPLE:
    case LADDER_WHITE:
      return { inputsUsed: 1, outputs: [[LADDER_OAK, 1]] };
    case LADDER_STONE:
      return { inputsUsed: 1, outputs: [[COBBLE, 3]] };
    case LADDER_IRON:
      return { inputsUsed: 1, outputs: [[IRON, 2]] };
    case LAMP_RED:
      return { inputsUsed: 1, outputs: [[FLOWER_RED, 1], [GLASS, 1]] };
    case LAMP_BLUE:
      return { inputsUsed: 1, outputs: [[FLOWER_BLUE, 1], [GLASS, 1]] };
    case LAMP_YELLOW:
      return { inputsUsed: 1, outputs: [[FLOWER_YELLOW, 1], [GLASS, 1]] };
    case PEDESTAL:
      return { inputsUsed: 1, outputs: [[COBBLE, 1]] };
    case PEDESTAL_GOLD:
      return { inputsUsed: 1, outputs: [[COBBLE, 1]] };
    case GLASS:
      return { inputsUsed: 1, outputs: [[SAND, 1]] };
    case TORCH:
      return { inputsUsed: 1, outputs: [[PLANKS, 1]] };
    case ARROW_ITEM:
      return { inputsUsed: 1, outputs: [[FEATHER, 1]] };
    case HAY_BALE:
      return { inputsUsed: 1, outputs: [[WHEAT, 5]] };
    case PLANKS:
      return { inputsUsed: 2, outputs: [[LOG, 1]] };
    default:
      return null;
  }
}

/** Trader gear costs its matching recipe materials, scaled by the same rarity tier as resale. */
export function gearTraderCost(rarity: Rarity, material: Material, slot: Slot): Array<[number, number]> {
  const rarityMultiplier = RARITY_PRICE_MULTIPLIERS[rarity] ?? 1;
  return gearRecipeInputs(material, slot).map(([id, count]) => [id, Math.ceil(count * rarityMultiplier)]);
}

/**
 * Compute reduced ingredients returned when dismantling an Armor/Gear piece at the Workbench.
 * Matches the item's crafting recipe in RECIPES (or material fallback) in reduced quantity.
 */
export function getSalvageForGear(it: Item): Array<[number, number]> {
  if (it.material === 'netherite') {
    return [
      [NETHERITE, 1],
      [DIAMOND, 2],
    ];
  }
  // Preserve the exact ingredients for special crafted gear (shells, claws, etc.); old saves
  // without a recipe key still fall back to their matching material/slot recipe.
  const matched = (it.recipeKey ? RECIPES.find((r) => r.kind === 'gear' && r.key === it.recipeKey) : undefined)
    ?? RECIPES.find((r) => r.kind === 'gear' && r.slot === it.slot && r.material === it.material);
  if (matched && matched.inputs.length > 0) {
    return matched.inputs.map(([ingId, count]) => [ingId, Math.max(1, Math.floor(count * 0.6))]);
  }
  if (it.material === 'diamond') return [[DIAMOND, 2]];
  if (it.material === 'gold') return [[GOLD, 2]];
  if (it.material === 'iron') return [[IRON, 2]];
  return [[LEAVES, 3]];
}
