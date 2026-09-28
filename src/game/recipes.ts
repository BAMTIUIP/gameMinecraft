import {
  ANVIL,
  APPLE,
  ARROW_ITEM,
  BED,
  CAMPFIRE,
  CAT_CLAW,
  CRAB_SHELL,
  FEATHER,
  FISH_SCALE,
  HONEY,
  TURTLE_SHELL,
  WOOL,
  FLOWER_BLUE,
  FLOWER_RED,
  FLOWER_YELLOW,
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
  LEAVES,
  LOG,
  PLANKS,
  SAND,
  TORCH,
  BIRCH_LOG,
  CRAFTING_TABLE,
} from './blocks';
import type { Material, Slot } from './items';

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
  accent: string;
  hotkey: string;
  group: 'tools' | 'gear' | 'blocks' | 'food';
};

/** bare hand pseudo-item: always occupies hotbar slot 1 */
export const HAND = 199;
/** hotbar ids above this range are tools, not placeable blocks */
export const TOOL_PICK = 200; // legacy alias — wooden pick
export const TOOL_SWORD = 201; // legacy (unused in hotbar now)
export const TOOL_TORCH = 202;
export const TOOL_AXE = 203;
export const TOOL_SHOVEL = 204;
export const TOOL_BOW = 205;
/** per-tier tools: crafting a better one KEEPS the old — sell it or use it */
export const PICK_TOOLS = [210, 211, 212, 213]; // wood/stone/iron/diamond
export const SWORD_TOOLS = [220, 221, 222]; // wood/iron/diamond
export const AXE_TOOLS = [230, 231]; // wood / stone
export const isPickTool = (id: number) => id >= 210 && id <= 213;
export const isSwordTool = (id: number) => id >= 220 && id <= 222;
export const isAxeTool = (id: number) => id === TOOL_AXE || (id >= 230 && id <= 231);
export const isToolId = (id: number) => id >= 200;
/** rough resale value of a tool at the trader */
export function toolSellPrice(id: number): number {
  if (isPickTool(id)) return [30, 90, 220, 520][id - 210];
  if (isSwordTool(id)) return [25, 140, 380][id - 220];
  if (isAxeTool(id)) return id === AXE_TOOLS[0] ? 20 : 60;
  return 30; // torch / shovel / bow
}

export const SWORDS = [
  { name: 'WOODEN SWORD', damage: 9, color: '#b98a4d', inputs: [[PLANKS, 3]] as Array<[number, number]> },
  { name: 'IRON SWORD', damage: 17, color: '#e6c39a', inputs: [[IRON, 2], [PLANKS, 1]] as Array<[number, number]> },
  { name: 'DIAMOND SWORD', damage: 29, color: '#5fe8dc', inputs: [[DIAMOND, 2], [PLANKS, 1]] as Array<[number, number]> },
] as const;

export const RECIPES: Recipe[] = [
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
    key: 'pick_wood',
    name: 'WOODEN PICKAXE',
    desc: 'Your first real tool — 3 planks + 2 sticks',
    inputs: [[PLANKS, 3]],
    kind: 'pickaxe',
    tier: 0,
    accent: '#b98a4d',
    hotkey: '2',
    group: 'tools',
  },
  {
    key: 'pick_stone',
    name: 'STONE PICKAXE',
    desc: '1.7x mining speed · 1.15x score',
    inputs: [
      [COBBLE, 3],
      [PLANKS, 2],
    ],
    kind: 'pickaxe',
    tier: 1,
    accent: '#9aa0a6',
    hotkey: '3',
    group: 'tools',
  },
  {
    key: 'pick_iron',
    name: 'IRON PICKAXE',
    desc: '2.6x mining speed · 1.40x score',
    inputs: [
      [IRON, 3],
      [PLANKS, 2],
    ],
    kind: 'pickaxe',
    tier: 2,
    accent: '#e6c39a',
    hotkey: '4',
    group: 'tools',
  },
  {
    key: 'pick_diamond',
    name: 'DIAMOND PICKAXE',
    desc: '4.0x mining speed · 1.80x score',
    inputs: [
      [DIAMOND, 3],
      [PLANKS, 2],
    ],
    kind: 'pickaxe',
    tier: 3,
    accent: '#5fe8dc',
    hotkey: '5',
    group: 'tools',
  },
  {
    key: 'sword_wood',
    name: SWORDS[0].name,
    desc: '9 damage · slot 2 in the hotbar',
    inputs: SWORDS[0].inputs as unknown as Array<[number, number]>,
    kind: 'weapon',
    weapon: 0,
    accent: SWORDS[0].color,
    hotkey: '6',
    group: 'tools',
  },
  {
    key: 'sword_iron',
    name: SWORDS[1].name,
    desc: '17 damage · cuts monsters down fast',
    inputs: SWORDS[1].inputs as unknown as Array<[number, number]>,
    kind: 'weapon',
    weapon: 1,
    accent: SWORDS[1].color,
    hotkey: '7',
    group: 'tools',
  },
  {
    key: 'sword_diamond',
    name: SWORDS[2].name,
    desc: '29 damage · one-shots most of the night',
    inputs: SWORDS[2].inputs as unknown as Array<[number, number]>,
    kind: 'weapon',
    weapon: 2,
    accent: SWORDS[2].color,
    hotkey: '8',
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

  {
    key: 'axe_wood',
    name: 'WOODEN AXE',
    desc: 'Crafted from planks only — chops trees 2.0x faster',
    inputs: [
      [PLANKS, 3],
    ],
    kind: 'axe',
    tier: 0,
    accent: '#b98a4d',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'axe_stone',
    name: 'STONE AXE',
    desc: 'Crafted with cobblestone — chops trees 2.8x faster',
    inputs: [
      [PLANKS, 2],
      [COBBLE, 3],
    ],
    kind: 'axe',
    tier: 1,
    accent: '#9aa0a6',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'shovel',
    name: 'SHOVEL',
    desc: 'Digs earth and sand 2.6x faster',
    inputs: [
      [PLANKS, 2],
      [COBBLE, 1],
    ],
    kind: 'shovel',
    accent: '#9aa0a6',
    hotkey: '',
    group: 'tools',
  },
  {
    key: 'bow',
    name: 'BOW',
    desc: 'Ranged weapon — needs arrows in the pack',
    inputs: [
      [PLANKS, 3],
      [LEAVES, 4],
    ],
    kind: 'bow',
    accent: '#93c95d',
    hotkey: '',
    group: 'tools',
  },
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

  // ---------------- armour ----------------
  gear('helmet_leather', 'LEATHER HELMET', 'head', 'leather', [[LEAVES, 5]], '#a3763f'),
  gear('chest_leather', 'LEATHER TUNIC', 'chest', 'leather', [[LEAVES, 8]], '#a3763f'),
  gear('legs_iron', 'IRON LEGGINGS', 'legs', 'iron', [[IRON, 4]], '#d6d9dd'),
  gear('feet_iron', 'IRON BOOTS', 'feet', 'iron', [[IRON, 3]], '#d6d9dd'),
  gear('hands_iron', 'IRON GAUNTLETS', 'hands', 'iron', [[IRON, 3], [LEAVES, 2]], '#d6d9dd'),
  gear('head_iron', 'IRON HELMET', 'head', 'iron', [[IRON, 4]], '#d6d9dd'),
  gear('chest_iron', 'IRON CHESTPLATE', 'chest', 'iron', [[IRON, 6]], '#d6d9dd'),
  gear('shield_iron', 'IRON SHIELD', 'offhand', 'iron', [[IRON, 3], [PLANKS, 3]], '#d6d9dd'),
  gear('chest_diamond', 'DIAMOND CHESTPLATE', 'chest', 'diamond', [[DIAMOND, 5]], '#5fe8dc'),
  gear('head_diamond', 'DIAMOND HELMET', 'head', 'diamond', [[DIAMOND, 4]], '#5fe8dc'),
  gear('hands_diamond', 'DIAMOND GAUNTLETS', 'hands', 'diamond', [[DIAMOND, 3]], '#5fe8dc'),
  gear('shield_diamond', 'DIAMOND SHIELD', 'offhand', 'diamond', [[DIAMOND, 3], [IRON, 2]], '#5fe8dc'),

  // ---------------- trophies ----------------
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
