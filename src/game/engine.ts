import {
  isRewardedDropChestItem,
  openRewardedDropPack,
  rewardedDropIdFromChestItem,
  rollbackOpenedRewardedDropPack,
  type RewardedDropMode,
} from './adDrops';
import * as THREE from 'three';
import { createBreathState, stepBreath, type BreathState } from './breath';
import { ARROW_IDS, buildArrowModel, isArrowId } from './arrowVisuals';
import { arrowBreaksOnBlock, bowArrowDamage, meleeAttackInterval, meleeDamage } from './combat';
import { canSprint, createStaminaState, stepStamina } from './stamina';
import { storageGet, storageSet } from './storage';
import {
  AIR,
  BED,
  BEDROCK,
  BLOCKS,
  CAMPFIRE,
  COAL,
  COBBLE,
  COOKED_MEAT,
  WHEAT,
  WHEAT_SEEDS,
  WHEAT_CROP_1,
  WHEAT_CROP_2,
  WHEAT_CROP_3,
  DIAMOND,
  DOOR_IRON,
  DOOR_WOOD,
  GLASS,
  IRON,
  DIRT,
  GOLD,
  GOLD_ORE,
  DIAMOND_ORE,
  EMERALD_ORE,
  COAL_ORE,
  IRON_ORE,
  REDSTONE_ORE,
  LAPIS_ORE,
  QUARTZ_ORE,
  REDSTONE,
  LAPIS,
  EMERALD,
  QUARTZ,
  REWARD_PACK_DAILY,
  REWARD_PACK_WEEKLY,
  REWARD_PACK_MONTHLY,
  SHOP_CHEST_COMMON,
  SHOP_CHEST_RARE,
  SHOP_CHEST_EPIC,
  GRASS,
  LAVA,
  LEAVES,
  LOG,
  PICKAXE_TIERS,
  PLANKS,
  RAW_MEAT,
  SAND,
  STONE,
  T,
  TORCH,
  WATER,
  ARROW_ITEM, FIRE_ARROW, POISON_ARROW, FREEZE_ARROW, STUN_ARROW,
  FLOWER_RED,
  FLOWER_YELLOW,
  FLOWER_BLUE,
  FLOWER_PINK,
  FLOWER_PURPLE,
  FLOWER_WHITE,
  FARMLAND,
  CHEST_STORAGE,
  HAY_BALE,
  BIRD_NEST, CHICKEN_NEST,
  ICE,
  ANVIL,
  TURTLE_EGG,
  HONEY,
  NETHERITE,
  NETHERITE_ORE,
  NETHERITE_INGOT,
  HIVE,
  SNOW_GRASS,
  WOOL,
  FEATHER,
  TURTLE_SHELL,
  CRAB_SHELL,
  FISH_SCALE,
  CAT_CLAW,
  PENGUIN_EGG,
  CACTUS,
  CACTUS_PALE,
  BIRCH_LOG,
  APPLE_LEAVES,
  COCONUT_LEAVES, BANANA_LEAVES, PALM_LOG, VINE, COCONUT, BANANA, VOLCANIC_STONE,
  APPLE,
  CRAFTING_TABLE,
  TALL_GRASS,
  FERN,
  DEAD_BUSH,
  MUSHROOM,
  FLOWER_TULIP_RED,
  FLOWER_TULIP_YELLOW,
  FLOWER_TULIP_PINK,
  FLOWER_TULIP_ORANGE,
  FLOWER_TULIP_WHITE,
  FLOWER_SUNFLOWER,
  FLOWER_ROSE,
  FLOWER_LAVENDER,
  FLOWER_WISTERIA,
  FLOWER_DAISY,
  FLOWER_ORCHID,
  FLOWER_PEONY,
  BUSH,
  BUSH_FLOWERING,
  BERRY_BUSH,
  TALL_LAVENDER,
  TALL_SUNFLOWER,
  WISTERIA_VINE,
  MOSS_CARPET,
  LEAF_PILE,
  MOSSY_COBBLE,
  MOSSY_STONE_BRICK,
  CRACKED_STONE_BRICK,
  STONE_BRICK,
  CAVE_MOSS_BLOCK,
  CAVE_VINE,
  CAVE_VINE_GLOW,
  GLOW_BERRY,
  DRIPSTONE_BLOCK,
  POINTED_DRIPSTONE,
  HANGING_ROOTS,
  ROOTED_DIRT,
  DEEPSLATE,
  DEEPSLATE_BRICKS,
  AMETHYST_BLOCK,
  GLOW_LICHEN,
  SPORE_BLOSSOM,
  AZALEA_LEAVES,
  AZALEA_FLOWERING,
  CLAY,
  MUSHROOM_BLOCK_RED,
  MUSHROOM_BLOCK_BROWN,
  MUSHROOM_STEM,
  STALACTITE,
  STALAGMITE,
  isFlower,
  isPlant,
  isInstaBreak,
  isLogId,
  isLeafId,
  WEB,
  BONE,
  FLESH,
  GUNPOWDER,
  LOOT_BAG,
  LADDER_PALETTE,
  blockClass,
  canBreakByHand,
  minimumPickaxeTier,
  isLadder,
  isBreakable,
  isInteractive,
  isMeatItem,
  isRawMeatItem,
  isResource,
  isSolid,
  isTreasureChest,
  isBiomeTreasureChest,
  isOpenChest,
  openChestId,
  isUnderwaterChest,
  baseChestId,
  isInventoryBlockId,
} from './blocks';
import { resourceSellPrice } from './economy';
import { cookedMeatForRaw, foodHeal, meatDropForAnimal } from './food';
import { CHUNK, ORIGIN_X, ORIGIN_Z, SEA, SURFACE_MESH_MIN_Y, WY, World, chunkKey, keyToChunk, type Biome } from './world';
import {
  HAND,
  RECIPES,
  SWORDS,
  TOOL_BOW,
  TOOL_PICK,
  TOOL_SHOVEL,
  TOOL_TORCH,
  PICK_TOOLS,
  SWORD_TOOLS,
  AXE_TOOLS,
  HOE_TOOLS,
  SHOVEL_TOOLS,
  isPickTool,
  isSwordTool,
  isAxeTool,
  toolRecipeDesc,
  toolSellPrice,
  getSalvageForItemId,
  getSalvageForGear,
  gearTraderCost,
  type Recipe,
} from './recipes';
import {
  getToolSpec,
  isDurabilityTool,
  normalizeToolDurability,
  toolRepairCost,
  toolWearRatio,
} from './tools';
import { babyGrowthScale, buildCatCompanionBody, buildMonkeyCompanionBody, buildOwlCompanionBody, buildParrotCompanionBody, MobSystem, type Mob, type MobId, type MobThreatTarget } from './mobs';
import { CHARACTER_HAIRSTYLES, DEFAULT_CHARACTER_CUSTOMIZATION, randomCharacterCustomization, sanitizeCharacterCustomization, type CharacterCustomization, type CharacterHairstyle, type CharacterShoeType } from './character';
import { drawCharacterFace } from './characterVisuals';
import {
  CAT_COATS,
  MONKEY_COATS,
  OWL_COATS,
  PARROT_COATS,
  WOLF_COATS,
  getCatCoatIndex,
  getMonkeyCoatIndex,
  getOwlCoatIndex,
  getParrotCoatIndex,
  getWolfCoatIndex,
  hasCatPet,
  hasMonkeyPet,
  hasOwlPet,
  hasParrotPet,
  hasWolfPet,
  refreshPetStateFromStorage,
  setCatCoatIndex,
  setMonkeyCoatIndex,
  setOwlCoatIndex,
  setParrotCoatIndex,
  setWolfCoatIndex,
  getPetInventoryKinds,
  type MonkeyCoat,
  type PetKind,
  type WolfCoat,
} from './pets';
import { companionSpawnIsClear } from './companionSpawn';
import {
  canSleepInMode,
  canSpawnSurvivalHostiles,
  FIRST_SURVIVAL_DAY_SECONDS,
  isPermanentSurvivalNight,
  SURVIVAL_DAWN_SECONDS,
  SURVIVAL_DAY_SECONDS,
  SURVIVAL_DUSK_SECONDS,
  SURVIVAL_NIGHT_SECONDS,
  survivalHostileCap,
  survivalHostileDamageScale,
  survivalHostileHpScale,
  survivalPhaseSeconds,
  survivalThreatLevel,
} from './survival';
import {
  AFFIXES,
  computeStats,
  damageReduction,
  EMPTY_STATS,
  ensureGearHid,
  gearColor,
  gearSellPrice,
  isGearHotbarId,
  makeItem,
  MATERIALS,
  RARITY,
  rollLoot,
  SLOTS,
  SLOT_KEY,
  type AffixId,
  type Item,
  type Material,
  type Rarity,
  type Slot,
  type Stats,
} from './items';
import { blockName, formatObjectiveTitle, matName, pickaxeLabel, recipeText, toolLabelForId, t, type TKey } from './i18n';
import { yaReady, yaServerTime } from './yandex';
import { deviceKind } from './params';
import { isDeveloperShopEnabled } from './devShop';
import { getDeveloperCatalog } from './devCatalog';
import { animateArmorVisuals, createArmorSurfaceMaterial, resetArmorSurfaceTexture, setArmorSurfaceTexture } from './armorVisuals';

const AFFIX_KEY = Object.fromEntries(
  (Object.keys(AFFIXES) as AffixId[]).map((k) => [k, AFFIXES[k].nameKey]),
) as Record<AffixId, Parameters<typeof t>[0]>;
const RARITY_COLORS = RARITY.map((r) => r.color);
const CAMPFIRE_SMOKE_PUFFS = 20;

import {
  buildChunkGeometrySteps,
  type ChunkGeometry,
  chestLidGeometry,
  CHEST_LID_HINGE_Y,
  CHEST_LID_HINGE_Z,
  CHEST_LID_OPEN_ANGLE,
  type ChestLidSpec,
  type CampfireSpec,
  CAMPFIRE_SMOKE_HEIGHT,
  HAY_CAMPFIRE_SMOKE_HEIGHT,
} from './mesher';
import { crackTileUV, getAtlasTexture, getCloudTexture, getCrackTexture, getSkyTexture, tileUV } from './textures';
import { mulberry32, seedNoise } from './noise';
import {
  initAudio,
  requestMusic,
  resumeAudio,
  sfx,
  stopMusic,
  suspendAudio,
  setMusicMood,
  setSpecialSunSound,
  type CreatureVoice,
  type VoiceState,
} from './audio';
import sunSheetUrl from './assets/sun/sun-sheet.webp';
import sunSoundUrl from './assets/sun/Звук восхода Солнца в Рик и Морти.mp3';

export type Phase = 'loading' | 'menu' | 'playing' | 'paused' | 'gameover';

/**
 * A teammate replayed from an asynchronous multiplayer session
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-multiplayer-sessions): the SDK hands back timelines of
 * other players, the engine draws them as ghost miners in the same world so a survival shift can be
 * played by a squad of up to five.
 */
export type CompanionSeed = {
  id: string;
  name: string;
  color?: string;
  /** Appearance seed changes each local survival squad; it never affects gameplay or network payloads. */
  appearanceSeed?: number;
  /** Local fallback only; never a live network player. */
  localBot?: boolean;
};

export type CompanionActivity = 'walking' | 'mining' | 'fighting';

/** A single recorded moment of a teammate (`multiplayer-sessions-transaction` payload). */
export type CompanionPose = { x: number; y: number; z: number; yaw?: number; health?: number; blocks?: number; activity?: CompanionActivity };

/** What the engine reports into the recorder each tick: enough to replay the run later. */
export type PlayerPose = { x: number; y: number; z: number; yaw: number; health: number; blocks: number };

/** Live state of one teammate, for the squad panel and the results table. */
export type CompanionStatus = {
  id: string;
  name: string;
  health: number;
  blocks: number;
  /** distance to the player in blocks, rounded */
  distance: number;
  /** the recorded session of this teammate ended */
  finished: boolean;
  dead: boolean;
  kind: 'bot' | 'replay';
  activity: CompanionActivity;
};

export type TutorialIcon = 'pickaxe' | 'sword' | 'bow' | 'axe' | 'shovel' | 'hoe' | 'anvil' | 'ladder' | 'trader' | 'workbench';
export type TutorialTip = {
  title: string;
  body: string;
  color: string;
  icon: TutorialIcon;
  key: number;
};

const TUTORIAL_STORAGE_KEY = 'orerush.tutorials.v1';

type ExplorationTaskDefinition = {
  id: string;
  titleKey: TKey;
  target: number;
  rewardScore: number;
  rewardSeconds: number;
  mineBlockIds?: readonly number[];
  collectItemId?: number;
  collectRawMeat?: boolean;
  craftPickaxeTier?: number;
  craftRecipeKey?: string;
  craftRecipeKeys?: readonly string[];
  craftKind?: Recipe['kind'];
  craftTier?: number;
  openChest?: boolean;
};

type ExplorationTask = ExplorationTaskDefinition & { progress: number };

export type HudObjective = {
  id: string;
  titleKey: TKey;
  progress: number;
  target: number;
  rewardScore: number;
  rewardSeconds: number;
  status: 'complete' | 'active' | 'locked';
};

export const EXPLORATION_TASKS: readonly ExplorationTaskDefinition[] = [
  // ---- Phase 1: Surface basics (wood + tools) - 17 missions, early chain preserved ----
  { id: 'wood', titleKey: 'objectiveGatherWood', target: 5, rewardScore: 100, rewardSeconds: 20, mineBlockIds: [LOG, BIRCH_LOG, PALM_LOG] },
  { id: 'planks', titleKey: 'objectiveCraftPlanks', target: 1, rewardScore: 80, rewardSeconds: 15, craftRecipeKey: 'planks' },
  { id: 'wood-pick', titleKey: 'objectiveCraftWoodPickaxe', target: 1, rewardScore: 130, rewardSeconds: 20, craftPickaxeTier: 0 },
  { id: 'wood-axe', titleKey: 'objectiveCraftWoodAxe', target: 1, rewardScore: 120, rewardSeconds: 20, craftKind: 'axe', craftTier: 0 },
  { id: 'wood-shovel', titleKey: 'objectiveCraftWoodShovel', target: 1, rewardScore: 120, rewardSeconds: 20, craftKind: 'shovel', craftTier: 0 },
  { id: 'wood-sword', titleKey: 'objectiveCraftWoodSword', target: 1, rewardScore: 120, rewardSeconds: 20, craftKind: 'weapon', craftTier: 0 },
  { id: 'bird-feather', titleKey: 'objectiveHuntFeather', target: 1, rewardScore: 160, rewardSeconds: 25, collectItemId: FEATHER },
  { id: 'wood-bow', titleKey: 'objectiveCraftBow', target: 1, rewardScore: 180, rewardSeconds: 25, craftKind: 'bow', craftTier: 0 },
  { id: 'stone', titleKey: 'objectiveMineStone', target: 10, rewardScore: 160, rewardSeconds: 25, mineBlockIds: [STONE, COBBLE] },
  { id: 'stone-pick', titleKey: 'objectiveCraftStonePickaxe', target: 1, rewardScore: 220, rewardSeconds: 30, craftPickaxeTier: 1 },
  { id: 'stone-axe', titleKey: 'objectiveCraftStoneAxe', target: 1, rewardScore: 180, rewardSeconds: 25, craftKind: 'axe', craftTier: 1 },
  { id: 'stone-sword', titleKey: 'objectiveCraftStoneSword', target: 1, rewardScore: 180, rewardSeconds: 25, craftKind: 'weapon', craftTier: 1 },
  { id: 'coal', titleKey: 'objectiveMineCoal', target: 5, rewardScore: 250, rewardSeconds: 30, mineBlockIds: [COAL_ORE] },
  { id: 'arrows', titleKey: 'objectiveCraftArrows', target: 1, rewardScore: 160, rewardSeconds: 25, craftRecipeKey: 'arrows' },
  { id: 'hunt-meat', titleKey: 'objectiveHuntMeat', target: 3, rewardScore: 220, rewardSeconds: 35, collectRawMeat: true },
  { id: 'campfire', titleKey: 'objectiveCraftCampfire', target: 1, rewardScore: 100, rewardSeconds: 20, craftRecipeKeys: ['campfire', 'campfire_birch', 'campfire_palm'] },
  { id: 'cooked-meat', titleKey: 'objectiveCookMeat', target: 1, rewardScore: 140, rewardSeconds: 25, craftKind: 'cook' },

  // ---- Phase 2: Early underground - chest early, iron, separated arrow types ----
  { id: 'secret-chest', titleKey: 'objectiveFindChest', target: 1, rewardScore: 220, rewardSeconds: 35, openChest: true },
  { id: 'iron', titleKey: 'objectiveMineIron', target: 4, rewardScore: 320, rewardSeconds: 35, mineBlockIds: [IRON_ORE] },
  { id: 'iron-pick', titleKey: 'objectiveCraftIronPickaxe', target: 1, rewardScore: 380, rewardSeconds: 40, craftPickaxeTier: 2 },
  { id: 'stone-arrows', titleKey: 'objectiveCraftStoneArrows', target: 1, rewardScore: 180, rewardSeconds: 25, craftRecipeKey: 'arrows_stone' },
  { id: 'iron-axe', titleKey: 'objectiveCraftIronAxe', target: 1, rewardScore: 240, rewardSeconds: 30, craftKind: 'axe', craftTier: 2 },
  { id: 'iron-gear', titleKey: 'objectiveCraftIronGear', target: 2, rewardScore: 260, rewardSeconds: 35, craftKind: 'gear', craftTier: 2 },
  { id: 'iron-arrows', titleKey: 'objectiveCraftIronArrows', target: 1, rewardScore: 220, rewardSeconds: 30, craftRecipeKey: 'arrows_iron' },

  // ---- Phase 3: Gold + farming smoke boost - gold before gold arrows, hay for visible smoke ----
  { id: 'gold', titleKey: 'objectiveMineGold', target: 3, rewardScore: 500, rewardSeconds: 45, mineBlockIds: [GOLD_ORE] },
  { id: 'gold-pick', titleKey: 'objectiveCraftGoldPickaxe', target: 1, rewardScore: 600, rewardSeconds: 50, craftPickaxeTier: 3 },
  { id: 'hay-bale', titleKey: 'objectiveCraftHayBale', target: 1, rewardScore: 200, rewardSeconds: 30, craftRecipeKey: 'hay_bale' },
  { id: 'gold-gear', titleKey: 'objectiveCraftGoldGear', target: 2, rewardScore: 320, rewardSeconds: 40, craftKind: 'gear', craftTier: 3 },
  { id: 'gold-arrows', titleKey: 'objectiveCraftGoldArrows', target: 1, rewardScore: 260, rewardSeconds: 35, craftRecipeKey: 'arrows_gold' },
  { id: 'quartz', titleKey: 'objectiveMineQuartz', target: 3, rewardScore: 450, rewardSeconds: 40, mineBlockIds: [QUARTZ_ORE] },
  { id: 'redstone', titleKey: 'objectiveMineRedstone', target: 3, rewardScore: 480, rewardSeconds: 40, mineBlockIds: [REDSTONE_ORE] },

  // ---- Phase 4: Diamond + rare ores ----
  { id: 'diamond', titleKey: 'objectiveMineDiamond', target: 2, rewardScore: 700, rewardSeconds: 55, mineBlockIds: [DIAMOND_ORE] },
  { id: 'diamond-pick', titleKey: 'objectiveCraftDiamondPickaxe', target: 1, rewardScore: 850, rewardSeconds: 65, craftPickaxeTier: 4 },
  { id: 'diamond-axe', titleKey: 'objectiveCraftDiamondAxe', target: 1, rewardScore: 600, rewardSeconds: 50, craftKind: 'axe', craftTier: 4 },
  { id: 'diamond-sword', titleKey: 'objectiveCraftDiamondSword', target: 1, rewardScore: 650, rewardSeconds: 55, craftKind: 'weapon', craftTier: 4 },
  { id: 'chest-hoard', titleKey: 'objectiveFindChestHoard', target: 3, rewardScore: 400, rewardSeconds: 45, openChest: true },
  { id: 'lapis', titleKey: 'objectiveMineLapis', target: 3, rewardScore: 500, rewardSeconds: 45, mineBlockIds: [LAPIS_ORE] },
  { id: 'emerald', titleKey: 'objectiveMineEmerald', target: 3, rewardScore: 550, rewardSeconds: 45, mineBlockIds: [EMERALD_ORE] },
  { id: 'diamond-gear', titleKey: 'objectiveCraftDiamondGear', target: 2, rewardScore: 700, rewardSeconds: 60, craftKind: 'gear', craftTier: 4 },
  { id: 'rare-ores', titleKey: 'objectiveMineRareOres', target: 3, rewardScore: 1000, rewardSeconds: 70, mineBlockIds: [REDSTONE_ORE, LAPIS_ORE, EMERALD_ORE] },

  // ---- Phase 5: Netherite tier - spawns y<32, protected from cave carving ----
  { id: 'ancient-debris', titleKey: 'objectiveMineAncientDebris', target: 6, rewardScore: 1200, rewardSeconds: 100, mineBlockIds: [NETHERITE_ORE] },
  { id: 'netherite-ingots', titleKey: 'objectiveCraftNetheriteIngot', target: 2, rewardScore: 1400, rewardSeconds: 120, craftRecipeKey: 'netherite_ingot' },

  // ---- Phase 6: Special arrows interleaved with netherite gear to avoid 3 arrows in a row ----
  { id: 'fire-arrows', titleKey: 'objectiveCraftFireArrows', target: 1, rewardScore: 300, rewardSeconds: 35, craftRecipeKey: 'arrows_fire' },
  { id: 'poison-arrows', titleKey: 'objectiveCraftPoisonArrows', target: 1, rewardScore: 320, rewardSeconds: 35, craftRecipeKey: 'arrows_poison' },
  { id: 'netherite-sword', titleKey: 'objectiveCraftNetheriteSword', target: 1, rewardScore: 900, rewardSeconds: 75, craftKind: 'weapon', craftTier: 5 },
  { id: 'freeze-arrows', titleKey: 'objectiveCraftFreezeArrows', target: 1, rewardScore: 340, rewardSeconds: 35, craftRecipeKey: 'arrows_freeze' },
  { id: 'stun-arrows', titleKey: 'objectiveCraftStunArrows', target: 1, rewardScore: 360, rewardSeconds: 35, craftRecipeKey: 'arrows_stun' },
  { id: 'netherite-gear', titleKey: 'objectiveCraftNetheriteGear', target: 2, rewardScore: 1000, rewardSeconds: 80, craftKind: 'gear', craftTier: 5 },
  { id: 'netherite-arrows', titleKey: 'objectiveCraftNetheriteArrows', target: 1, rewardScore: 1000, rewardSeconds: 85, craftRecipeKey: 'arrows_netherite' },
  { id: 'netherite-pick', titleKey: 'objectiveCraftNetheritePickaxe', target: 1, rewardScore: 3000, rewardSeconds: 180, craftPickaxeTier: 5 },
];

/** every species collapses onto one of the synthesised voices */
const MOB_VOICE: Partial<Record<MobId, CreatureVoice>> = {
  pig: 'pig', sheep: 'sheep', cow: 'cow', calf: 'cow', chicken: 'chicken',
  deer: 'deer', roe_deer: 'deer', fawn: 'deer', moose: 'moose',
  camel: 'camel', camel_calf: 'camel', monkey: 'monkey', lizard: 'lizard', frog: 'frog',
  rabbit: 'rabbit', hedgehog: 'hedgehog', crab: 'crab', turtle: 'turtle', seal: 'turtle',
  penguin: 'chicken', bird: 'bird', bee: 'bee', cat: 'cat',
  fish: 'fish', jellyfish: 'jellyfish', tumbleweed: 'rustle',
  zombie: 'zombie', skeleton: 'skeleton', archer: 'skeleton', spider: 'spider', spiderling: 'spider', creeper: 'creeper',
  trader: 'trader',
};

/** how chatty a species is while nothing is happening: birds and insects fill the air */
const MOB_VOICE_RATE: Partial<Record<MobId, number>> = {
  bird: 6, bee: 3.5, chicken: 2.2, frog: 2.4,
  crab: 1.6, cat: 1.3, cow: 1.2, sheep: 1.2, pig: 1.1, calf: 1.6, fawn: 1.4,
  deer: 0.9, roe_deer: 0.9, moose: 0.7, camel: 0.8, camel_calf: 1.3, monkey: 1.2,
  rabbit: 0.8, hedgehog: 0.8, lizard: 0.7, turtle: 0.5, seal: 0.9, penguin: 1.1,
  zombie: 0.8, skeleton: 0.5, archer: 0.4, spider: 0.6, spiderling: 0.5, creeper: 0.25,
  fish: 0.9, jellyfish: 0.4, tumbleweed: 0.4, trader: 1,
};

export type HudState = {
  phase: Phase;
  loading: number;
  score: number;
  timeLeft: number;
  health: number;
  hunger: number;
  stamina: number;
  arrowLoadout: number | null;
  airBubbles: number;
  inWater: boolean;
  headUnderwater: boolean;
  breathVisible: boolean;
  combo: number;
  comboMult: number;
  tier: number;
  tierName: string;
  blocksMined: number;
  bestCombo: number;
  deepest: number;
  oresFound: number;
  /** 10 fixed quick slots; `null` = empty hole (sparse hotbar) */
  hotbar: ({ id: number; count: number; instanceId?: number; durability?: number; maxDurability?: number } | null)[];
  selected: number;
  target: { id: number; name: string } | null;
  banner: { text: string; sub: string; color: string; key: number } | null;
  deathCause: 'time' | 'lava' | 'fall' | 'mob' | null;
  fps: number;
  locked: boolean;
  lockFailed: boolean;
  freeLook: boolean;
  thirdPerson?: boolean;
  crouching: boolean;
  crawling: boolean;
  runTime: number;
  /** teammates replayed from asynchronous multiplayer sessions (empty outside co-op) */
  squad: CompanionStatus[];
  inventoryOpen: boolean;
  chest: { id: number; name: string; items: Array<{ id: number; count: number }> } | null;
  tutorialTip: TutorialTip | null;
  explorationObjectives: HudObjective[];
  objectiveIndex: number;
  objectiveCount: number;
  inventory: { id: number; count: number; instanceId?: number; durability?: number; maxDurability?: number }[];
  craftable: string[];
  lastCraft: string | null;
  // --- new: world clock, mobs, gear ---
  survival: boolean;
  daylight: number;
  timeOfDay: number;
  phaseName: 'day' | 'dusk' | 'night' | 'dawn';
  kills: number;
  heldName: string;
  heldKind: 'pick' | 'sword' | 'block' | 'fist' | 'torch' | 'axe' | 'shovel' | 'hoe' | 'bow' | 'gear';
  offers: TradeOffer[];
  sellPrices: Record<number, number>;
  invTab: string;
  tradeNear: boolean;
  anvilNear: boolean;
  workbenchNear: boolean;
  sandbox: boolean;
  endless: boolean;
  swordTier: number;
  equipped: Partial<Record<Slot, Item>>;
  bagItems: Item[];
  /** Permanent Yandex entitlements and the one shared, per-run companion equipment slot. */
  petOwned: boolean;
  petOwnedKinds: PetKind[];
  petInventoryKinds: PetKind[];
  petTokenAvailable: boolean;
  petEquipped: boolean;
  petEquippedKind: PetKind | null;
  petSelectedKind: PetKind;
  petCoatIndices: Record<PetKind, number>;
  /** Selected-kind coat index retained for existing HUD/test consumers. */
  petCoatIndex: number;
  petInteractNear: boolean;
  stats: Stats;
  killedBy: string | null;
  scoreBoost: number;
  oreBoost: number;
};

export type DomRefs = {
  coords?: HTMLElement | null;
  compass?: HTMLElement | null;
  progress?: HTMLElement | null;
  comboBar?: HTMLElement | null;
  healthBar?: HTMLElement | null;
  staminaBar?: HTMLElement | null;
  timeBar?: HTMLElement | null;
  vignette?: HTMLElement | null;
  crosshair?: HTMLElement | null;
};

const RUN_TIME = 150;
export const EXPLORATION_RUN_TIME = 20 * 60;

/** selectable shift lengths (seconds) */
export const SESSION_LENGTHS = [
  { id: 'sprint', labelKey: 'sesSprint' as const, time: 150, sub: '2:30', accent: '#f4b942' },
  { id: 'shift', labelKey: 'sesFull' as const, time: 600, sub: '10:00', accent: '#93c95d' },
  { id: 'marathon', labelKey: 'sesMarathon' as const, time: 1200, sub: '20:00', accent: '#5fe8dc' },
  { id: 'half', labelKey: 'sesHalf' as const, time: 1800, sub: '30:00', accent: '#d9844a' },
  { id: 'hour', labelKey: 'sesHour' as const, time: 3600, sub: '1:00:00', accent: '#c58cff' },
  { id: 'double', labelKey: 'sesDouble' as const, time: 7200, sub: '2:00:00', accent: '#ff5f7a' },
] as const;

export type TradeOffer = { item: Item; cost: Array<[number, number]>; sold: boolean };
const MAX_PARTICLES = 520;
const MAX_DROPS = 44;
const MAX_STUCK_ARROWS = 48;
const CHEST_SLOT_LIMIT = 27;
const CHEST_STACK_LIMIT = 999;
const GRAVITY = 30;
const JUMP_V = 9.4;
const WALK = 4.6;
const SPRINT = 7.1;
const SWIM_SPRINT = WALK * 1.1;
const PLAYER_HALF = 0.3;
const PLAYER_HEIGHT = 1.8;
const CRAWL_HEIGHT = 0.72;
const CRAWL_HALF_WIDTH = 0.33;
const CRAWL_HALF_LENGTH = 0.96;
const CRAWL_BODY_CENTER = 0.96;
const EYE = 1.62;
const BASE_INTERACTION_REACH = 1.5;
const MAX_INTERACTION_REACH = 4.5;
const CLOCK_DAWN_START = 0.22;
const CLOCK_DAY_START = 0.34;
const CLOCK_DUSK_START = 0.76;
const CLOCK_NIGHT_START = 0.88;
const MENU_SURVIVAL_CLOCK = 0.04;
const MENU_EXPLORER_CLOCK = 0.48;
const SURVIVAL_START_CLOCK = CLOCK_DAY_START + 0.01;

type PopupAnchor = 'world' | 'crosshair';
type PopupOptions = { anchor?: PopupAnchor; duration?: number; screenRiseSpeed?: number };
type Popup = {
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  big: boolean;
  anchor: PopupAnchor;
  screenRise: number;
  screenRiseTarget: number;
  screenRiseSpeed: number;
  el: HTMLDivElement;
};
type WeatherKind = 'clear' | 'rain' | 'snow';
type Particle = { weather?: Exclude<WeatherKind, 'clear'>; smoke?: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number; r: number; g: number; b: number };
type ToolInstance = { instanceId: number; id: number; durability: number };

type StuckArrow = {
  id: number;
  x: number;
  y: number;
  z: number;
  blockX: number;
  blockY: number;
  blockZ: number;
  mesh: THREE.Group;
};

type Drop = {
  active: boolean;
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  count?: number;
  mesh: THREE.Mesh;
  /** clearance between the pickup origin and the floor, including bobbing */
  clearance: number;
  /** rolled gear carried by a LOOT_BAG drop */
  gear?: Item | null;
  /** volumetric model used instead of the textured cube (animal/monster loot) */
  fancy?: THREE.Group | null;
  /** minimum age before player can pick up this drop (longer when thrown with G) */
  pickupDelay?: number;
  /** true when thrown by the player via G (avoids duplicate mining score on re-pickup) */
  thrown?: boolean;
  /** a chest resource carried by the wolf (storage contents are not mining-score drops) */
  fromChest?: boolean;
  /** Temporarily ignored after the wolf has repeatedly failed to reach it. */
  wolfPetIgnoreUntil?: number;
  /** durable tool instance carried by this drop */
  toolInstance?: ToolInstance | null;
  /** temporarily carried to the player by the equipped wolf companion */
  petCarried?: boolean;
};

type AvatarArmorAttachment = { parent: THREE.Object3D; group: THREE.Group };
type AvatarFadeMaterial = {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

type WolfPetReaction = 'wag' | 'bark' | 'spin' | 'cat-purr' | 'cat-meow' | 'cat-circle' | 'monkey-flop' | 'monkey-hops' | 'monkey-scratch' | 'monkey-spin' | null;
type ParrotPetMode = 'shoulder' | 'hand' | 'follow' | 'fetch' | 'delivery' | 'attack';
type ParrotAttackStage = 'approach' | 'dive' | 'soar';
type WolfChestTarget = { x: number; y: number; z: number; id: number; standX: number; standY: number; standZ: number; swimming: boolean };
const WOLF_PET_PLAYER_GAP = 1.28;
const WOLF_PET_INTERACTION_RANGE = 2.2;
const WOLF_PET_REST_DELAY = 0.28;
const WOLF_PET_FOLLOW_RESUME_DELAY = 0.14;
const WOLF_PET_FETCH_STALL_SECONDS = 0.42;
const WOLF_PET_FETCH_MOVING_ABANDON_SECONDS = 1.0;
const WOLF_PET_FETCH_RETRY_SECONDS = 4.0;
const WOLF_PET_TELEPORT_REVEAL_SECONDS = 1.0;

type WolfPetRig = {
  kind: PetKind;
  group: THREE.Group;
  model: THREE.Group;
  pose: THREE.Group;
  body: THREE.Object3D | null;
  head: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  tail: THREE.Object3D | null;
  legs: THREE.Object3D[];
  target: THREE.Vector3;
  navWaypoint: THREE.Vector3;
  navGoal: THREE.Vector3;
  navTimer: number;
  restAnchor: THREE.Vector3;
  restYaw: number;
  restAnchorValid: boolean;
  stillTimer: number;
  moveStartTimer: number;
  teleportRevealTimer: number;
  yawTarget: number;
  phase: number;
  hopTimer: number;
  moving: boolean;
  sitting: boolean;
  attackTimer: number;
  attackPoseTimer: number;
  reaction: WolfPetReaction;
  reactionTimer: number;
  reactionAge: number;
  reactionSoundTimer: number;
  fetchTarget: Drop | null;
  chestTarget: WolfChestTarget | null;
  chestScanTimer: number;
  chestBlockedTimer: number;
  chestIgnoredKey: string;
  chestIgnoreUntil: number;
  fetchBlockedDrop: Drop | null;
  fetchBlockedTimer: number;
  fetchNoProgressTimer: number;
  fetchNoPath: boolean;
  carrying: Drop | null;
  swimming: boolean;
  underwater: boolean;
  reactionLookTimer: number;
  /** Monkey-only elevated follow/combat anchor chosen from nearby logs/leaves. */
  monkeyTreeAnchor: THREE.Vector3;
  monkeyTreeAnchorValid: boolean;
  monkeyAmmoCooldown: number;
  /** Bird-only flight, call, feeding and repeat-dive state. */
  parrotMode: ParrotPetMode;
  parrotCalled: boolean;
  parrotIdleTimer: number;
  parrotAttackTarget: Mob | null;
  parrotAttackStage: ParrotAttackStage;
  parrotStageTimer: number;
  parrotHappyTimer: number;
  parrotEatTimer: number;
  parrotSoundTimer: number;
  parrotFollowAnchor: THREE.Vector3;
  parrotFollowAnchorValid: boolean;
};

type MonkeyPetProjectile = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  mesh: THREE.Group;
  itemId: typeof BANANA | typeof COCONUT;
  damage: number;
  stunChance: number;
};

/* =========================== co-op rig helpers =========================== */

/** free the GPU memory of a generated object (companion rigs are rebuilt, never pooled) */
function disposeObject(obj: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => materials.add(entry));
    else if (material) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  const textures = new Set<THREE.Texture>();
  materials.forEach((material) => {
    const textured = material as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
    if (textured.map) textures.add(textured.map);
    if (textured.emissiveMap) textures.add(textured.emissiveMap);
    material.dispose();
  });
  textures.forEach((texture) => texture.dispose());
}

function idHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h / 360;
}

function addCharacterBox(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

type ArmorBoxBuilder = (
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotateZ?: number,
) => THREE.Mesh;

/** Small voxel wolf assembled from reusable cuboids; forward is local -Z, like the mob models. */
function buildWolfPetRig(coat: WolfCoat): WolfPetRig {
  const group = new THREE.Group();
  group.name = 'equipped-wolf-pet';
  group.userData.companion = 'wolf-pet';
  const model = new THREE.Group();
  group.add(model);

  const bodyMat = new THREE.MeshLambertMaterial({ color: coat.body });
  const darkMat = new THREE.MeshLambertMaterial({ color: coat.dark });
  const lightMat = new THREE.MeshLambertMaterial({ color: coat.light });
  const muzzleMat = new THREE.MeshLambertMaterial({ color: coat.muzzle });
  const bellyMat = new THREE.MeshLambertMaterial({ color: coat.belly });
  const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: '#f8f4e8' });
  const eyeMat = new THREE.MeshLambertMaterial({ color: '#151719' });
  const noseMat = new THREE.MeshLambertMaterial({ color: '#17191b' });
  const innerEarMat = new THREE.MeshLambertMaterial({ color: coat.dark });

  const box = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) =>
    addCharacterBox(parent, w, h, d, mat, x, y, z);

  const body = new THREE.Group();
  body.position.set(0, 0.58, 0.02);
  model.add(body);
  box(body, 0.82, 0.48, 0.92, bodyMat, 0, 0, 0.02);
  box(body, 0.52, 0.43, 0.28, bodyMat, 0, 0.02, -0.47);
  box(body, 0.38, 0.34, 0.075, lightMat, 0, -0.035, -0.618);
  box(body, 0.5, 0.16, 0.48, bellyMat, 0, -0.19, -0.025);

  if (coat.marking === 'striped') {
    for (const z of [-0.28, 0, 0.28]) box(body, 0.78, 0.035, 0.09, darkMat, 0, 0.245, z);
  } else if (coat.marking === 'spotted') {
    for (const side of [-1, 1]) {
      box(body, 0.025, 0.12, 0.13, darkMat, side * 0.415, 0.07, -0.17);
      box(body, 0.025, 0.1, 0.11, lightMat, side * 0.415, -0.085, 0.13);
      box(body, 0.025, 0.08, 0.1, darkMat, side * 0.415, 0.12, 0.25);
    }
  }

  const head = new THREE.Group();
  head.position.set(0, 0.91, -0.56);
  model.add(head);
  box(head, 0.48, 0.44, 0.44, bodyMat, 0, 0, 0);
  box(head, 0.3, 0.18, 0.25, muzzleMat, 0, -0.13, -0.3);
  box(head, 0.13, 0.1, 0.065, noseMat, 0, -0.105, -0.445);
  for (const side of [-1, 1]) {
    box(head, 0.085, 0.08, 0.035, eyeWhiteMat, side * 0.14, 0.055, -0.228);
    box(head, 0.038, 0.05, 0.022, eyeMat, side * 0.14, 0.052, -0.255);
    box(head, 0.15, 0.2, 0.14, darkMat, side * 0.16, 0.29, 0.015);
    box(head, 0.065, 0.105, 0.025, innerEarMat, side * 0.16, 0.29, -0.069);
  }

  const jaw = new THREE.Group();
  jaw.position.set(0, -0.19, -0.29);
  head.add(jaw);
  box(jaw, 0.22, 0.055, 0.17, coat.marking === 'plain' ? muzzleMat : lightMat, 0, -0.005, -0.035);
  box(jaw, 0.045, 0.025, 0.035, noseMat, -0.055, 0, -0.105);
  box(jaw, 0.045, 0.025, 0.035, noseMat, 0.055, 0, -0.105);

  const tail = new THREE.Group();
  tail.position.set(0, 0.77, 0.48);
  model.add(tail);
  const tailBase = box(tail, 0.17, 0.17, 0.35, bodyMat, 0, 0, 0.17);
  tailBase.rotation.x = 0.28;
  box(tail, 0.15, 0.15, 0.1, darkMat, 0, 0.035, 0.37);

  const legs: THREE.Group[] = [];
  for (const z of [-0.3, 0.31]) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.25, 0.39, z);
      box(leg, 0.18, 0.37, 0.19, bodyMat, 0, -0.17, 0);
      box(leg, 0.205, 0.1, 0.23, darkMat, 0, -0.35, -0.015);
      model.add(leg);
      legs.push(leg);
    }
  }

  return {
    kind: 'wolf',
    group,
    model,
    pose: model,
    body,
    head,
    jaw,
    tail,
    legs,
    target: new THREE.Vector3(),
    navWaypoint: new THREE.Vector3(),
    navGoal: new THREE.Vector3(),
    navTimer: 0,
    restAnchor: new THREE.Vector3(),
    restYaw: 0,
    restAnchorValid: false,
    stillTimer: 0,
    moveStartTimer: 0,
    teleportRevealTimer: 0,
    yawTarget: 0,
    phase: 0,
    hopTimer: 0,
    moving: false,
    sitting: true,
    attackTimer: 0.35,
    attackPoseTimer: 0,
    reaction: null,
    reactionTimer: 0,
    reactionAge: 0,
    reactionSoundTimer: 0,
    fetchTarget: null,
    chestTarget: null,
    chestScanTimer: 0,
    chestBlockedTimer: 0,
    chestIgnoredKey: '',
    chestIgnoreUntil: 0,
    fetchBlockedDrop: null,
    fetchBlockedTimer: 0,
    fetchNoProgressTimer: 0,
    fetchNoPath: false,
    carrying: null,
    swimming: false,
    underwater: false,
    reactionLookTimer: 0,
    monkeyTreeAnchor: new THREE.Vector3(),
    monkeyTreeAnchorValid: false,
    monkeyAmmoCooldown: 0,
    parrotMode: 'shoulder',
    parrotCalled: false,
    parrotIdleTimer: 0,
    parrotAttackTarget: null,
    parrotAttackStage: 'approach',
    parrotStageTimer: 0,
    parrotHappyTimer: 0,
    parrotEatTimer: 0,
    parrotSoundTimer: 0,
    parrotFollowAnchor: new THREE.Vector3(),
    parrotFollowAnchorValid: false,
  };
}

/** Use the ordinary domestic cat mesh, with one of the fixed saved coat variants. */
function buildCatPetRig(variantIndex: number): WolfPetRig {
  const cat = buildCatCompanionBody(variantIndex);
  const group = new THREE.Group();
  group.name = 'equipped-cat-pet';
  group.userData.companion = 'cat-pet';
  const model = cat.group;
  model.scale.setScalar(0.94);
  group.add(model);
  return {
    kind: 'cat',
    group,
    model,
    pose: model,
    body: model.children.find((part) => part instanceof THREE.Mesh && Math.abs(part.position.y - 0.5) < 0.01) ?? null,
    head: cat.head,
    jaw: null,
    tail: cat.tail,
    legs: cat.legs,
    target: new THREE.Vector3(),
    navWaypoint: new THREE.Vector3(),
    navGoal: new THREE.Vector3(),
    navTimer: 0,
    restAnchor: new THREE.Vector3(),
    restYaw: 0,
    restAnchorValid: false,
    stillTimer: 0,
    moveStartTimer: 0,
    teleportRevealTimer: 0,
    yawTarget: 0,
    phase: 0,
    hopTimer: 0,
    moving: false,
    sitting: true,
    attackTimer: 0.35,
    attackPoseTimer: 0,
    reaction: null,
    reactionTimer: 0,
    reactionAge: 0,
    reactionSoundTimer: 0,
    fetchTarget: null,
    chestTarget: null,
    chestScanTimer: 0,
    chestBlockedTimer: 0,
    chestIgnoredKey: '',
    chestIgnoreUntil: 0,
    fetchBlockedDrop: null,
    fetchBlockedTimer: 0,
    fetchNoProgressTimer: 0,
    fetchNoPath: false,
    carrying: null,
    swimming: false,
    underwater: false,
    reactionLookTimer: 0,
    monkeyTreeAnchor: new THREE.Vector3(),
    monkeyTreeAnchorValid: false,
    monkeyAmmoCooldown: 0,
    parrotMode: 'shoulder',
    parrotCalled: false,
    parrotIdleTimer: 0,
    parrotAttackTarget: null,
    parrotAttackStage: 'approach',
    parrotStageTimer: 0,
    parrotHappyTimer: 0,
    parrotEatTimer: 0,
    parrotSoundTimer: 0,
    parrotFollowAnchor: new THREE.Vector3(),
    parrotFollowAnchorValid: false,
  };
}

/** Use the ordinary jungle monkey mesh, with a palette chosen for this permanent pet. */
function buildMonkeyPetRig(coat: MonkeyCoat): WolfPetRig {
  const group = new THREE.Group();
  group.name = 'equipped-monkey-pet';
  group.userData.companion = 'monkey-pet';
  const model = new THREE.Group();
  const pose = new THREE.Group();
  pose.position.y = 0.36;
  model.add(pose);
  const monkey = buildMonkeyCompanionBody(coat);
  monkey.group.position.y = -0.36;
  pose.add(monkey.group);
  group.add(model);
  return {
    kind: 'monkey',
    group,
    model,
    pose,
    body: null,
    head: monkey.head,
    jaw: null,
    tail: monkey.tail,
    legs: monkey.limbs,
    target: new THREE.Vector3(),
    navWaypoint: new THREE.Vector3(),
    navGoal: new THREE.Vector3(),
    navTimer: 0,
    restAnchor: new THREE.Vector3(),
    restYaw: 0,
    restAnchorValid: false,
    stillTimer: 0,
    moveStartTimer: 0,
    teleportRevealTimer: 0,
    yawTarget: 0,
    phase: 0,
    hopTimer: 0,
    moving: false,
    sitting: true,
    attackTimer: 0.35,
    attackPoseTimer: 0,
    reaction: null,
    reactionTimer: 0,
    reactionAge: 0,
    reactionSoundTimer: 0,
    fetchTarget: null,
    chestTarget: null,
    chestScanTimer: 0,
    chestBlockedTimer: 0,
    chestIgnoredKey: '',
    chestIgnoreUntil: 0,
    fetchBlockedDrop: null,
    fetchBlockedTimer: 0,
    fetchNoProgressTimer: 0,
    fetchNoPath: false,
    carrying: null,
    swimming: false,
    underwater: false,
    reactionLookTimer: 0,
    monkeyTreeAnchor: new THREE.Vector3(),
    monkeyTreeAnchorValid: false,
    monkeyAmmoCooldown: 0,
    parrotMode: 'shoulder',
    parrotCalled: false,
    parrotIdleTimer: 0,
    parrotAttackTarget: null,
    parrotAttackStage: 'approach',
    parrotStageTimer: 0,
    parrotHappyTimer: 0,
    parrotEatTimer: 0,
    parrotSoundTimer: 0,
    parrotFollowAnchor: new THREE.Vector3(),
    parrotFollowAnchorValid: false,
  };
}


function isBirdCompanion(kind: PetKind | null | undefined): boolean {
  return kind === 'parrot' || kind === 'owl';
}

/** Dedicated eagle owl companion mesh and six selectable plumages. */
function buildOwlPetRig(variantIndex: number): WolfPetRig {
  const owl = buildOwlCompanionBody(variantIndex);
  const group = new THREE.Group();
  group.name = 'equipped-owl-pet';
  group.userData.companion = 'owl-pet';
  const model = owl.group;
  model.scale.setScalar(0.64 * owl.modelSize);
  group.add(model);
  const body = model.children.find((part) => part.userData.birdBody) ?? null;
  const tail = model.children.find((part) => part.userData.birdTail) ?? null;
  return {
    kind: 'owl',
    group,
    model,
    pose: model,
    body,
    head: owl.head,
    jaw: null,
    tail,
    legs: owl.legs,
    target: new THREE.Vector3(),
    navWaypoint: new THREE.Vector3(),
    navGoal: new THREE.Vector3(),
    navTimer: 0,
    restAnchor: new THREE.Vector3(),
    restYaw: 0,
    restAnchorValid: false,
    stillTimer: 0,
    moveStartTimer: 0,
    teleportRevealTimer: 0,
    yawTarget: 0,
    phase: 0,
    hopTimer: 0,
    moving: false,
    sitting: false,
    attackTimer: 0.7,
    attackPoseTimer: 0,
    reaction: null,
    reactionTimer: 0,
    reactionAge: 0,
    reactionSoundTimer: 0,
    fetchTarget: null,
    chestTarget: null,
    chestScanTimer: 0,
    chestBlockedTimer: 0,
    chestIgnoredKey: '',
    chestIgnoreUntil: 0,
    fetchBlockedDrop: null,
    fetchBlockedTimer: 0,
    fetchNoProgressTimer: 0,
    fetchNoPath: false,
    carrying: null,
    swimming: false,
    underwater: false,
    reactionLookTimer: 0,
    monkeyTreeAnchor: new THREE.Vector3(),
    monkeyTreeAnchorValid: false,
    monkeyAmmoCooldown: 0,
    parrotMode: 'shoulder',
    parrotCalled: false,
    parrotIdleTimer: 0,
    parrotAttackTarget: null,
    parrotAttackStage: 'approach',
    parrotStageTimer: 0,
    parrotHappyTimer: 0,
    parrotEatTimer: 0,
    parrotSoundTimer: 0,
    parrotFollowAnchor: new THREE.Vector3(),
    parrotFollowAnchorValid: false,
  };
}

/** Use the exact wild-parrot mesh and its shared six-color coat palette for the permanent pet. */
function buildParrotPetRig(variantIndex: number): WolfPetRig {
  const parrot = buildParrotCompanionBody(variantIndex);
  const group = new THREE.Group();
  group.name = 'equipped-parrot-pet';
  group.userData.companion = 'parrot-pet';
  const model = parrot.group;
  model.scale.setScalar(0.64 * parrot.modelSize);
  group.add(model);
  const body = model.children.find((part) => part.userData.birdBody) ?? null;
  const tail = model.children.find((part) => part.userData.birdTail) ?? null;
  const jaw = model.children.find((part) => part instanceof THREE.Mesh && part.position.y < 0.49 && part.position.z < -0.35) ?? null;
  return {
    kind: 'parrot',
    group,
    model,
    pose: model,
    body,
    head: parrot.head,
    jaw,
    tail,
    legs: parrot.legs,
    target: new THREE.Vector3(),
    navWaypoint: new THREE.Vector3(),
    navGoal: new THREE.Vector3(),
    navTimer: 0,
    restAnchor: new THREE.Vector3(),
    restYaw: 0,
    restAnchorValid: false,
    stillTimer: 0,
    moveStartTimer: 0,
    teleportRevealTimer: 0,
    yawTarget: 0,
    phase: 0,
    hopTimer: 0,
    moving: false,
    sitting: false,
    attackTimer: 0.7,
    attackPoseTimer: 0,
    reaction: null,
    reactionTimer: 0,
    reactionAge: 0,
    reactionSoundTimer: 0,
    fetchTarget: null,
    chestTarget: null,
    chestScanTimer: 0,
    chestBlockedTimer: 0,
    chestIgnoredKey: '',
    chestIgnoreUntil: 0,
    fetchBlockedDrop: null,
    fetchBlockedTimer: 0,
    fetchNoProgressTimer: 0,
    fetchNoPath: false,
    carrying: null,
    swimming: false,
    underwater: false,
    reactionLookTimer: 0,
    monkeyTreeAnchor: new THREE.Vector3(),
    monkeyTreeAnchorValid: false,
    monkeyAmmoCooldown: 0,
    parrotMode: 'shoulder',
    parrotCalled: false,
    parrotIdleTimer: 0,
    parrotAttackTarget: null,
    parrotAttackStage: 'approach',
    parrotStageTimer: 0,
    parrotHappyTimer: 0,
    parrotEatTimer: 0,
    parrotSoundTimer: 0,
    parrotFollowAnchor: new THREE.Vector3(),
    parrotFollowAnchorValid: false,
  };
}

const CHARACTER_HEAD_SIZE = 0.4;
const CHARACTER_FACE_SIZE = 0.3;
const CHARACTER_FACE_FRONT_Z = -(CHARACTER_HEAD_SIZE / 2 + 0.008);
// Dampen only the leg swing amplitude; the gait phase and cadence stay identical for all genders.
const GIRL_WALK_LEG_SWING_SCALE = 0.35;

/** Lift the pickaxe forward, then lower the arm into the block instead of pulling it backward. */
function pickaxeStrikeArmAngle(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const smoothStep = (value: number) => {
    const x = Math.max(0, Math.min(1, value));
    return x * x * (3 - 2 * x);
  };
  if (t < 0.2) return 1.05 * smoothStep(t / 0.2);
  if (t < 0.48) return 1.05 * (1 - smoothStep((t - 0.2) / 0.28));
  return 0;
}

/** Shared voxel hair builder used by the player model and local survival teammates. */
function buildCharacterHair(style: CharacterHairstyle, material: THREE.Material, helmetSafe = false): THREE.Group {
  const hair = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    if (!helmetSafe) return addCharacterBox(hair, w, h, d, material, x, y, z);
    // Side plates stop at -0.085; a continuous rear shell covers the back down to -0.2.
    // Keep only hair below the nearest helmet edge so strands cannot show through the shell.
    const helmetHem = z - d / 2 >= 0.12 ? -0.205 : -0.105;
    const bottom = y - h / 2;
    const clippedTop = Math.min(y + h / 2, helmetHem);
    const visibleHeight = clippedTop - bottom;
    if (visibleHeight <= 0) return null;
    return addCharacterBox(hair, w, visibleHeight, d, material, x, bottom + visibleHeight / 2, z);
  };
  // The scalp cap and narrow side/back panels overlap, so no skin-colored gaps show through the hair.
  box(0.5, 0.16, 0.5, 0, 0.22, 0);
  box(0.1, 0.36, 0.5, -0.2, -0.02, 0);
  box(0.1, 0.36, 0.5, 0.2, -0.02, 0);
  box(0.4, 0.36, 0.1, 0, -0.02, 0.2);
  // A short high fringe leaves the textured eyes and brows unobstructed.
  box(0.44, 0.1, 0.08, 0, 0.16, -0.25);

  if (style === 'long') {
    box(0.1, 0.38, 0.42, -0.2, -0.13, -0.015);
    box(0.1, 0.38, 0.42, 0.2, -0.13, -0.015);
    box(0.42, 0.36, 0.1, 0, -0.15, 0.19);
  } else if (style === 'ponytail') {
    box(0.08, 0.31, 0.39, -0.2, -0.08, -0.015);
    box(0.08, 0.31, 0.39, 0.2, -0.08, -0.015);
    box(0.4, 0.29, 0.1, 0, -0.09, 0.19);
    box(0.14, 0.19, 0.14, 0.13, -0.23, 0.28);
    box(0.12, 0.17, 0.12, 0.13, -0.4, 0.3);
  } else if (style === 'spiky') {
    for (const [x, y, rz] of [[-0.15, 0.34, -0.16], [0, 0.38, 0], [0.15, 0.34, 0.16]] as const) {
      const spike = box(0.12, 0.2, 0.14, x, y, 0.01);
      if (spike) spike.rotation.z = rz;
    }
  } else if (style === 'bob') {
    box(0.12, 0.37, 0.43, -0.2, -0.14, -0.015);
    box(0.12, 0.37, 0.43, 0.2, -0.14, -0.015);
    box(0.46, 0.34, 0.1, 0, -0.17, 0.19);
    box(0.44, 0.08, 0.12, 0, -0.31, 0.18);
  } else if (style === 'curly') {
    for (const [x, y, z] of [
      [-0.18, 0.17, -0.08], [-0.1, 0.29, -0.13], [0.04, 0.31, -0.1], [0.18, 0.18, -0.08],
      [-0.21, 0.02, 0.04], [0.21, 0.02, 0.04], [-0.17, 0.16, 0.17], [0, 0.2, 0.22], [0.17, 0.16, 0.17],
    ] as const) box(0.16, 0.16, 0.16, x, y, z);
  } else if (style === 'braids') {
    box(0.08, 0.34, 0.39, -0.2, -0.13, -0.015);
    box(0.08, 0.34, 0.39, 0.2, -0.13, -0.015);
    box(0.4, 0.28, 0.1, 0, -0.1, 0.19);
    for (const side of [-1, 1]) {
      for (const [index, y] of [-0.18, -0.31, -0.44].entries()) {
        box(0.115, 0.15, 0.13, side * (0.21 + (index % 2 ? 0.025 : 0)), y, -0.005 + (index % 2) * 0.04);
      }
    }
  } else if (style === 'bun') {
    box(0.4, 0.3, 0.1, 0, -0.08, 0.19);
    box(0.2, 0.18, 0.2, 0, 0.28, 0.27);
    box(0.16, 0.08, 0.16, 0, 0.31, 0.34);
  } else if (style === 'sidePart') {
    const sweep = box(0.29, 0.12, 0.1, -0.08, 0.13, -0.26);
    if (sweep) sweep.rotation.z = -0.18;
    box(0.11, 0.22, 0.4, -0.2, -0.04, -0.015);
    box(0.12, 0.12, 0.1, 0.1, 0.17, -0.25);
  } else if (style === 'twinTails') {
    box(0.08, 0.24, 0.38, -0.2, -0.05, -0.015);
    box(0.08, 0.24, 0.38, 0.2, -0.05, -0.015);
    for (const side of [-1, 1]) {
      box(0.14, 0.11, 0.14, side * 0.23, 0.12, 0.18);
      box(0.13, 0.2, 0.13, side * 0.24, -0.04, 0.23);
      box(0.12, 0.18, 0.12, side * 0.25, -0.21, 0.25);
    }
  } else {
    box(0.08, 0.2, 0.4, -0.2, 0.02, -0.015);
    box(0.08, 0.2, 0.4, 0.2, 0.02, -0.015);
  }
  return hair;
}

/** Flared hem and back panel make the skirt silhouette unmistakable in third-person view. */
function buildCharacterSkirt(material: THREE.Material, accent: THREE.Material): THREE.Group {
  const skirt = new THREE.Group();
  addCharacterBox(skirt, 0.44, 0.16, 0.34, material, 0, 0.64, 0);
  addCharacterBox(skirt, 0.54, 0.18, 0.39, material, 0, 0.49, 0);
  addCharacterBox(skirt, 0.67, 0.21, 0.44, material, 0, 0.31, 0);
  addCharacterBox(skirt, 0.7, 0.045, 0.46, accent, 0, 0.19, 0);
  addCharacterBox(skirt, 0.16, 0.035, 0.025, accent, 0, 0.56, 0.205);
  return skirt;
}

/** one teammate: a blocky miner with a name tag and a health bar, walked by updateCompanions() */
type CompanionMineTarget = { x: number; y: number; z: number; id: number; standX: number; standY: number; standZ: number };

type CompanionRig = {
  name: string;
  group: THREE.Group;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  tag: THREE.Sprite;
  bar: THREE.Sprite;
  health: number;
  blocks: number;
  finished: boolean;
  localBot: boolean;
  girl: boolean;
  dead: boolean;
  activity: CompanionActivity;
  attackTimer: number;
  mineTimer: number;
  mineScanCooldown: number;
  mineTarget: CompanionMineTarget | null;
  swingTimer: number;
  moving: boolean;
  target: THREE.Vector3;
  yawTarget: number;
  phase: number;
  bob: number;
  setHealth: (hp: number) => void;
};

function buildCompanionRig(seed: CompanionSeed): CompanionRig {
  const customization = seed.localBot
    ? randomCharacterCustomization(seed.appearanceSeed ?? seed.id)
    : { ...DEFAULT_CHARACTER_CUSTOMIZATION };
  const hue = idHue(seed.id);
  const shirt = new THREE.MeshLambertMaterial({ color: customization.shirtColor });
  const shirtDark = new THREE.MeshLambertMaterial({ color: customization.shirtColor });
  if (!seed.localBot) {
    shirt.color.setHSL(seed.color ? idHue(seed.color) : hue, 0.45, 0.46);
    shirtDark.color.setHSL(seed.color ? idHue(seed.color) : hue, 0.5, 0.33);
  } else {
    shirtDark.color.copy(shirt.color).multiplyScalar(0.68);
  }
  const skin = new THREE.MeshLambertMaterial({ color: customization.skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
  const shoes = new THREE.MeshLambertMaterial({ color: customization.shoeColor });
  const shoeSole = new THREE.MeshLambertMaterial({ color: customization.shoeType === 'sneakers' ? '#f1f2ed' : '#202124' });
  const shoeAccent = new THREE.MeshLambertMaterial({ color: customization.shoeColor });
  const hair = new THREE.MeshLambertMaterial({ color: customization.hairColor });
  const skirt = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
  const skirtAccent = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
  skirtAccent.color.multiplyScalar(0.7);

  const group = new THREE.Group();
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) =>
    addCharacterBox(parent, w, h, d, mat, x, y, z);

  const girl = customization.gender === 'girl';
  box(girl ? 0.46 : 0.56, 0.72, 0.28, shirt, 0, 1.02, 0);
  box(girl ? 0.48 : 0.58, 0.16, 0.3, shirtDark, 0, 1.31, 0);
  const head = new THREE.Group();
  head.position.set(0, 1.58, -0.02);
  box(CHARACTER_HEAD_SIZE, CHARACTER_HEAD_SIZE, CHARACTER_HEAD_SIZE, skin, 0, 0, 0, head);
  head.add(buildCharacterHair(customization.hairstyle, hair));
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = faceCanvas.height = 128;
  const faceContext = faceCanvas.getContext('2d');
  if (faceContext) {
    drawCharacterFace(faceContext, customization.expression, customization.glasses);
    const faceTexture = new THREE.CanvasTexture(faceCanvas);
    faceTexture.colorSpace = THREE.SRGBColorSpace;
    faceTexture.magFilter = THREE.NearestFilter;
    faceTexture.minFilter = THREE.NearestFilter;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(CHARACTER_FACE_SIZE, CHARACTER_FACE_SIZE),
      new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    face.position.set(0, -0.005, CHARACTER_FACE_FRONT_Z);
    head.add(face);
  }
  group.add(head);

  const limb = (side: number, kind: 'arm' | 'leg') => {
    const g2 = new THREE.Group();
    if (kind === 'arm') {
      g2.position.set((girl ? 0.37 : 0.43) * side, 1.34, 0);
      box(0.18, 0.62, 0.2, shirt, 0, -0.28, 0, g2);
      box(0.18, 0.18, 0.2, skin, 0, -0.68, 0, g2);
    } else {
      g2.position.set((girl ? 0.14 : 0.16) * side, 0.66, 0);
      const legColor = girl ? skin : pants;
      box(girl ? 0.18 : 0.23, 0.62, 0.24, legColor, 0, -0.31, 0, g2);
      if (customization.shoeType === 'boots') {
        box(0.24, 0.16, 0.28, shoes, 0, -0.6, -0.02, g2);
        box(0.26, 0.04, 0.3, shoeSole, 0, -0.69, -0.02, g2);
      } else if (customization.shoeType === 'sneakers') {
        box(0.26, 0.13, 0.31, shoes, 0, -0.62, -0.035, g2);
        box(0.28, 0.04, 0.33, shoeSole, 0, -0.7, -0.035, g2);
        box(0.26, 0.04, 0.05, shoeAccent, 0, -0.61, -0.13, g2);
      } else {
        box(0.25, 0.065, 0.31, shoeSole, 0, -0.68, -0.02, g2);
        box(0.25, 0.045, 0.055, shoes, 0, -0.61, -0.12, g2);
        box(0.25, 0.045, 0.055, shoes, 0, -0.61, 0.075, g2);
      }
    }
    group.add(g2);
    return g2;
  };
  const leftArm = limb(-1, 'arm');
  const rightArm = limb(1, 'arm');
  const leftLeg = limb(-1, 'leg');
  const rightLeg = limb(1, 'leg');
  if (customization.gender === 'girl') group.add(buildCharacterSkirt(skirt, skirtAccent));

  // name tag: a canvas sprite, so a teammate is identifiable from a distance
  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 256;
  tagCanvas.height = 64;
  const tctx = tagCanvas.getContext('2d')!;
  tctx.fillStyle = 'rgba(9,13,17,0.55)';
  tctx.fillRect(0, 12, 256, 40);
  tctx.font = 'bold 30px monospace';
  tctx.textAlign = 'center';
  tctx.textBaseline = 'middle';
  tctx.fillStyle = '#eaf6ff';
  tctx.fillText(seed.name.slice(0, 16).toUpperCase(), 128, 33);
  const tagTex = new THREE.CanvasTexture(tagCanvas);
  tagTex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthTest: true, toneMapped: false }));
  tag.scale.set(1.9, 0.475, 1);
  group.add(tag);

  // health bar above the tag, redrawn only when the recorded health actually changes
  const barCanvas = document.createElement('canvas');
  barCanvas.width = 128;
  barCanvas.height = 20;
  const bctx = barCanvas.getContext('2d')!;
  const barTex = new THREE.CanvasTexture(barCanvas);
  barTex.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, transparent: true, depthTest: true, toneMapped: false }));
  bar.scale.set(0.95, 0.15, 1);
  bar.visible = false;
  group.add(bar);

  const rig: CompanionRig = {
    name: seed.name,
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    tag,
    bar,
    health: 100,
    blocks: 0,
    finished: false,
    localBot: seed.localBot === true,
    girl,
    dead: false,
    activity: 'walking',
    attackTimer: 0.8,
    mineTimer: 0,
    mineScanCooldown: 0,
    mineTarget: null,
    swingTimer: 0,
    moving: false,
    target: new THREE.Vector3(),
    yawTarget: 0,
    phase: 0,
    bob: 0,
    setHealth: () => undefined,
  };

  let lastDrawn = -1;
  rig.setHealth = (hp: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(hp)));
    rig.health = clamped;
    rig.dead = clamped <= 0;
    if (clamped === lastDrawn) return;
    lastDrawn = clamped;
    bctx.clearRect(0, 0, 128, 20);
    bctx.fillStyle = 'rgba(9,13,17,0.65)';
    bctx.fillRect(0, 0, 128, 20);
    bctx.fillStyle = clamped > 50 ? '#7fe06a' : clamped > 25 ? '#e8c14a' : '#e2564a';
    bctx.fillRect(2, 2, Math.max(0, (124 * clamped) / 100), 16);
    barTex.needsUpdate = true;
  };
  rig.setHealth(100);

  return rig;
}

/** Small, animated orange/yellow flames used for the armour's FIRE affix. */
function buildEnchantedFlames(depthTest = true) {
  const group = new THREE.Group();
  group.name = 'fire-affix-hand-flames';
  const orange = new THREE.MeshBasicMaterial({ color: 0xff6b22, transparent: true, opacity: 0.86, depthTest, depthWrite: false, toneMapped: false });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffc34d, transparent: true, opacity: 0.92, depthTest, depthWrite: false, toneMapped: false });
  const specs = [
    { x: -0.14, y: -0.2, z: 0.03, size: 0.82, phase: 0.1, color: orange },
    { x: 0.02, y: -0.1, z: -0.03, size: 1, phase: 1.7, color: gold },
    { x: 0.16, y: -0.19, z: 0.02, size: 0.74, phase: 2.9, color: orange },
    { x: -0.04, y: 0.06, z: 0.05, size: 0.68, phase: 4.1, color: gold },
    { x: 0.11, y: 0.12, z: -0.02, size: 0.58, phase: 5.3, color: orange },
  ];
  specs.forEach((spec, index) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.072, 0.3, 5), spec.color);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.rotation.z = (index % 2 ? -1 : 1) * 0.16;
    mesh.renderOrder = 8;
    mesh.userData.flame = { x: spec.x, y: spec.y, z: spec.z, size: spec.size, phase: spec.phase };
    group.add(mesh);
  });
  group.visible = false;
  return group;
}

function animateEnchantedFlames(group: THREE.Group, time: number) {
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    const base = mesh.userData.flame as { x: number; y: number; z: number; size: number; phase: number } | undefined;
    if (!base) continue;
    const pulse = 0.8 + Math.sin(time * 15 + base.phase) * 0.16 + Math.sin(time * 27 + base.phase * 1.6) * 0.07;
    mesh.scale.set(base.size * pulse, base.size * (0.82 + pulse * 0.32), base.size * pulse);
    mesh.position.set(base.x + Math.sin(time * 7 + base.phase) * 0.018, base.y + pulse * 0.035, base.z);
    mesh.rotation.z = Math.sin(time * 8 + base.phase) * 0.2;
    mesh.rotation.y = Math.cos(time * 6 + base.phase) * 0.18;
  }
}

export class Engine {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private hudScene!: THREE.Scene;
  private hudCamera!: THREE.PerspectiveCamera;
  private world = new World(1);
  private chunkMeshes = new Map<number, THREE.Mesh>();
  private cutoutMeshes = new Map<number, THREE.Mesh>();
  private material!: THREE.MeshLambertMaterial;
  private cutoutMat!: THREE.MeshLambertMaterial;
  private waterMat!: THREE.MeshBasicMaterial;
  private waterMeshes = new Map<number, THREE.Mesh>();
  private decorMat!: THREE.MeshBasicMaterial;
  private decorMeshes = new Map<number, THREE.Mesh>();
  private geometryBandByKey = new Map<number, number>();
  private meshBandKey = 0;
  private menuWorldStreaming = false;
  private menuWorldStarterSeeded = false;
  private campfireVisuals = new Map<number, {
    group: THREE.Group;
    outerFlames: THREE.InstancedMesh;
    innerFlames: THREE.InstancedMesh;
    smoke: THREE.InstancedMesh;
    fires: Array<{ x: number; y: number; z: number; phase: number; smokeHeight: number; smokeIndex: number }>;
  }>();
  private campfireDummy = new THREE.Object3D();
  private campfireOuterGeometry = new THREE.ConeGeometry(0.19, 0.74, 6);
  private campfireInnerGeometry = new THREE.ConeGeometry(0.12, 0.48, 6);
  private campfireSmokeGeometry = new THREE.SphereGeometry(0.21, 6, 5);
  private campfireOuterMaterial = new THREE.MeshBasicMaterial({ color: 0xff641b, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false });
  private campfireInnerMaterial = new THREE.MeshBasicMaterial({ color: 0xffc64b, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  private campfireSmokeMaterial = new THREE.MeshBasicMaterial({ color: 0xc4bdb5, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false });
  private campfireVisualClock = 0;
  private campfireDamageCooldown = new WeakMap<Mob, number>();
  /** hinged chest lids, kept per chunk next to the meshes they belong to */
  private chestLids = new Map<number, Array<{ cell: string; group: THREE.Group }>>();
  private chestLidByCell = new Map<string, THREE.Group>();
  private chestLidAnims: Array<{ group: THREE.Group; t: number; dur: number; keys: Array<[number, number]> }> = [];
  /** Chest contents are sidecar block-entity state keyed by world cell; empty entries stay present. */
  private chestInventories = new Map<string, Map<number, number>>();
  private chestBonusGear = new Map<string, Item[]>();
  private activeChest: { x: number; y: number; z: number } | null = null;
  /** Horizontal draw distance in blocks (auto-tuned by the frame-time watchdog). */
  private renderDist = 88;
  private minRenderDist = 48;
  private maxRenderDist = 112;

  private setRenderDist(d: number) {
    this.renderDist = Math.max(this.minRenderDist, Math.min(this.maxRenderDist, d));
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.far = this.renderDist * 0.94;
      fog.near = fog.far * 0.38;
    }
  }

  private isPlayerUnderground() {
    return this.pos.y + EYE < SEA - 20;
  }

  private worldRenderDistance() {
    // Keep the broad surface panorama, but tunnel views need far fewer horizontal chunks.
    return this.isPlayerUnderground() ? Math.min(this.renderDist, CHUNK * 3) : this.renderDist;
  }

  private meshBandForPlayer() {
    if (!this.isPlayerUnderground()) {
      // Surface-only band: retain terrain, trees and the top of shallow cuts; deeper rock is meshed
      // only after the player descends, rather than paying for it across every visible surface chunk.
      const minY = SURFACE_MESH_MIN_Y;
      return { key: WY * 2 + minY, minY, maxY: WY };
    }
    // Underground, mesh a moving window around the player. The upper cap stays beyond the fog wall.
    const minY = Math.max(0, Math.floor((this.pos.y + EYE - 64) / 32) * 32);
    return { key: minY, minY, maxY: Math.min(WY, minY + 128) };
  }

  private fx!: HTMLDivElement;
  private popupOverlay!: HTMLDivElement;
  private sunGlare!: HTMLDivElement;
  private popups: Popup[] = [];
  private particles: Particle[] = [];
  private pMesh!: THREE.InstancedMesh;
  private pDummy = new THREE.Object3D();
  private pColor = new THREE.Color();
  private drops: Drop[] = [];
  private stuckArrows: StuckArrow[] = [];
  private dropUVBase = new Float32Array(48);
  private motes!: THREE.Points;
  private clouds!: THREE.Mesh;

  private highlight!: THREE.LineSegments;
  private crackMesh!: THREE.Mesh;
  private crackMat!: THREE.MeshBasicMaterial;
  private crackUVBase = new Float32Array(48);
  private crackStage = -1;
  private pickGroup!: THREE.Group;
  private viewFireFx!: THREE.Group;
  private pickHeadMats: THREE.MeshLambertMaterial[] = [];
  private pickBaseX = 0.44;
  private toolPick!: THREE.Group;
  private toolSword!: THREE.Group;
  private toolCrafted!: THREE.Group;
  private craftedToolKey = '';
  private toolBlock!: THREE.Mesh;
  private toolItem!: THREE.Group;
  private toolLantern!: THREE.Group;
  private toolTorch!: THREE.Group;
  private toolHand!: THREE.Group;
  private toolAxe!: THREE.Group;
  private toolShovel!: THREE.Group;
  private toolHoe!: THREE.Group;
  private toolBow!: THREE.Group;
  private toolGear!: THREE.Group;
  private toolGearKey = '';
  private firstPersonGlove!: THREE.Group;
  private firstPersonGloveKey = '';
  private torchFlame!: THREE.Mesh;
  private torchFlameMat!: THREE.MeshBasicMaterial;
  private torchLight!: THREE.PointLight;
  private swordMat!: THREE.MeshLambertMaterial;
  private axeHeadMat!: THREE.MeshLambertMaterial;
  private axeEdgeMat!: THREE.MeshLambertMaterial;
  private hoeHeadMat!: THREE.MeshLambertMaterial;
  private hoeEdgeMat!: THREE.MeshLambertMaterial;
  private blockUVBase = new Float32Array(48);
  private blockShown = -1;
  private itemShown = -1;
  private itemHasFancy = false;

  private dom: DomRefs = {};
  private onHud: (s: HudState) => void;

  // ---- run state ----
  phase: Phase = 'loading';
  /** the current pause was imposed by the system (hidden tab, focus loss, Yandex) — not chosen by the player */
  private pausedBySystem = false;
  /**
   * Requirement 1.6.3: on a TV the remote must be enough to play. The arrows already move (WASD
   * aliases) and here they also become the look control, since a remote has no mouse; OK (Enter)
   * digs, a short tap of OK uses or places, and a step exactly one block high is taken
   * automatically, because a remote reports one press at a time.
   */
  private readonly tv = deviceKind() === 'tv';
  /** when OK was pressed, to tell a hold (dig) from a tap (use/place) */
  private tvOkDownAt = 0;
  /** a one-shot placement requested by the remote's OK tap */
  private placeOnce = false;
  private score = 0;
  /** One-run score booster purchased from the shop; persisted only with the sandbox world. */
  private scoreBonusMultiplier = 1;
  /** One-run ore seeker booster — makes ores more visible / gives ore cache */
  private oreBoostMultiplier = 1;
  private runTime = RUN_TIME;
  private timeLeft = RUN_TIME;
  private health = 100;
  private hunger = 100;
  private hungerDamageTimer = 0;
  private arrowLoadout: number | null = null;

  equipArrow(id: number) {
    this.arrowLoadout = this.arrowLoadout === id ? null : id;
    this.syncHud(true);
  }
  private combo = 0;
  private comboTimer = 0;
  private bestCombo = 0;
  private blocksMined = 0;
  private oresFound = 0;
  private deepest = 0;
  private tier = 0;
  private inventory = new Map<number, number>();
  /** One durable record per physical tool; duplicate tools never share wear. */
  private toolInstances = new Map<number, ToolInstance>();
  private nextToolInstanceId = 1;
  /** sparse 10-slot quick bar: blocks / tools / HAND / empty holes */
  private hotbar: (number | undefined)[] = [];
  /** parallel instance reference for durable tools; ordinary stack items leave it empty */
  private hotbarInstanceIds: (number | undefined)[] = [];
  private selected = 0;
  private deathCause: HudState['deathCause'] = null;
  // --- world clock / mobs / gear ---
  survival = true;
  private clock = 0.28;
  private daylight = 1;
  private mobSys!: MobSystem;
  /** idle wildlife calls near the player: next one, and a short gap after any call */
  private voiceTimer = 2.4;
  private voiceCooldown = 0;
  private spawnTimer = 0;
  private animalTimer = 0;
  private ambientTimer = 0;
  private dayBirdAudioTimer = 3.5;
  private cricketAudioTimer = 1.8;
  private owlAudioTimer = 14;
  private wolfHowlAudioTimer = 24;
  private kills = 0;
  private killedBy: string | null = null;
  private wasNight = false;
  private survivalNight = 0;
  private firstSurvivalDay = false;
  private swordTier = -1;
  private equipped: Partial<Record<Slot, Item>> = {};
  private bagItems: Item[] = [];
  private petOwned = false;
  private petOwnedKinds: PetKind[] = [];
  private petTokenAvailable = false;
  private petEquipped = false;
  private petEquippedKind: PetKind | null = null;
  private petSelectedKind: PetKind = 'wolf';
  private petCoatIndices: Record<PetKind, number> = { wolf: 0, cat: 0, monkey: 0, parrot: 0, owl: 0 };
  private petCoatIndex = 0;
  private stats: Stats = { ...EMPTY_STATS };
  private attackCd = 0;
  private sunLight!: THREE.DirectionalLight;
  private ambLight!: THREE.AmbientLight;
  private skyMesh!: THREE.Mesh;
  private skyMat!: THREE.MeshBasicMaterial;
  private sunDir = new THREE.Vector3(0, 1, 0);
  private sunMesh!: THREE.Mesh;
  private sunHaloMat!: THREE.MeshBasicMaterial;
  // «особое солнце»: the animated Rick-and-Morty sun (6x6 sprite sheet of the GIF frames) replaces the disc
  private specialSun = false;
  private sunSheetMesh!: THREE.Mesh;
  private sunSheetTex!: THREE.Texture;
  private sunSheetReady = false;
  private sunSoundOn = false;
  private moonMesh!: THREE.Object3D;
  private starMat!: THREE.PointsMaterial;
  private stars!: THREE.Points;
  private thirdPerson = false;
  /** Camera-only yaw offset; player facing and movement keep using this.yaw. */
  private thirdPersonOrbitYaw = 0;
  private thirdPersonOrbitInputAt = 0;
  private thirdPersonCam = new THREE.Vector3();
  private thirdPersonFocus = new THREE.Vector3();
  private thirdPersonCamReady = false;
  private playerAvatar!: THREE.Group;
  private characterCustomization: CharacterCustomization = { ...DEFAULT_CHARACTER_CUSTOMIZATION };
  private avatarHead: THREE.Object3D | null = null;
  private avatarAppearance: {
    skin: THREE.MeshLambertMaterial;
    shirt: THREE.MeshLambertMaterial;
    shirtDark: THREE.MeshLambertMaterial;
    pants: THREE.MeshLambertMaterial;
    shoes: THREE.MeshLambertMaterial;
    shoeSole: THREE.MeshLambertMaterial;
    shoeAccent: THREE.MeshLambertMaterial;
    hair: THREE.MeshLambertMaterial;
    skirt: THREE.MeshLambertMaterial;
    skirtAccent: THREE.MeshLambertMaterial;
  } | null = null;
  private avatarTorso: THREE.Mesh | null = null;
  private avatarTorsoTrim: THREE.Mesh | null = null;
  private avatarSkirt: THREE.Group | null = null;
  private avatarLegPants: THREE.Mesh[] = [];
  private avatarShoeVariants: Array<Record<CharacterShoeType, THREE.Group>> = [];
  private avatarHairVariants: Partial<Record<CharacterHairstyle, THREE.Group>> = {};
  private avatarHelmetHairVariants: Partial<Record<CharacterHairstyle, THREE.Group>> = {};
  private avatarFaceContext: CanvasRenderingContext2D | null = null;
  private avatarFaceTexture: THREE.CanvasTexture | null = null;
  private avatarLeftArm: THREE.Object3D | null = null;
  private avatarRightArm: THREE.Object3D | null = null;
  /** Detached copy of the left arm, rendered in world space only for a first-person hand perch. */
  private firstPersonParrotArm: THREE.Group | null = null;
  private parrotHandArmBlend = 0;
  private avatarLeftLeg: THREE.Object3D | null = null;
  private avatarRightLeg: THREE.Object3D | null = null;
  private avatarArmorModels: Partial<Record<Slot, AvatarArmorAttachment[]>> = {};
  private avatarArmorFadeMats: Partial<Record<Slot, AvatarFadeMaterial[]>> = {};
  private avatarOpacity = 1;
  private avatarHeldRoot!: THREE.Group;
  private avatarFireFx!: THREE.Group;
  private avatarHeldTool!: THREE.Group;
  private avatarHeldToolKey = '';
  private avatarHeldItemGripScratch = new THREE.Vector3();
  private avatarHeldItemPalmScratch = new THREE.Vector3();
  private avatarHeldRootInverseScratch = new THREE.Quaternion();
  private avatarHeldPick!: THREE.Group;
  private avatarHeldAxe!: THREE.Group;
  private avatarHeldSword!: THREE.Group;
  private avatarHeldShovel!: THREE.Group;
  private avatarHeldHoe!: THREE.Group;
  private avatarHeldBow!: THREE.Group;
  private avatarHeldTorch!: THREE.Group;
  private avatarHeldArrow!: THREE.Group;
  private avatarHeldArrowKey = '';
  private avatarHeldBlock!: THREE.Mesh;
  private avatarHeldGear!: THREE.Group;
  private avatarHeldGearKey = '';
  private avatarHeldPickMats: THREE.MeshLambertMaterial[] = [];
  private avatarHeldSwordMat!: THREE.MeshLambertMaterial;
  private avatarHeldAxeHeadMat!: THREE.MeshLambertMaterial;
  private avatarHeldAxeEdgeMat!: THREE.MeshLambertMaterial;
  private avatarHeldHoeHeadMat!: THREE.MeshLambertMaterial;
  private avatarHeldHoeEdgeMat!: THREE.MeshLambertMaterial;
  private avatarHeldBlockMat!: THREE.MeshLambertMaterial;
  private avatarFadeMats: Array<{ material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean }> = [];
  private thirdPersonFogCap!: THREE.Mesh;
  private thirdPersonFogMat!: THREE.MeshBasicMaterial;
  private thirdPersonClipUniforms: Array<{
    active: { value: number };
    start: { value: THREE.Vector3 };
    end: { value: THREE.Vector3 };
    radius: { value: number };
  }> = [];
  private placedTorchLights: THREE.PointLight[] = [];
  private placedTorchScanTimer = 0;
  private weatherKind: WeatherKind = 'clear';
  private weatherTargetKind: WeatherKind = 'clear';
  private weatherIntensity = 0;
  private weatherTargetIntensity = 0;
  private weatherTimer = 0;
  private weatherSpawnAcc = 0;
  /** smoothed visual biome blend for global lighting; prevents one-block biome borders from popping exposure */
  private visualDry = 0;
  private visualWinter = 0;
  private visualClimateReady = false;
  private banner: HudState['banner'] = null;
  private bannerTimer = 0;
  private tutorialTip: TutorialTip | null = null;
  private tutorialTipTimer = 0;
  private tutorialTipQueue: Array<{ id: string; tip: TutorialTip }> = [];
  private tutorialPending = new Set<string>();
  private tutorialSeen = new Set<string>();
  private craftTipScanTimer = 0;
  private explorationObjectives: ExplorationTask[] = [];
  private objectiveIndex = 0;
  private loadTasks: (() => boolean)[] = [];
  private loadTotal = 0;
  private loadProgress = 0;

  // ---- player ----
  /** ghost miners from asynchronous multiplayer sessions; keyed by the platform's opponent id */
  private companionLayer = new THREE.Group();
  private companions = new Map<string, CompanionRig>();
  /** Wolves are created only by equipping the owned pet token; they are never ordinary mob spawns. */
  private wolfPetLayer = new THREE.Group();
  private wolfPetRig: WolfPetRig | null = null;

  /** the multiplayer recorder listens here: it gets the pose a few times per second while playing */
  private poseSink: ((pose: PlayerPose) => void) | null = null;
  private poseAcc = 0;

  private pos = new THREE.Vector3(32, 30, 32);
  private vel = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private onGround = false;
  private fallStart = 0;
  private spawnY = 20;
  private spawnX = 0;
  private spawnZ = 0;
  private coyote = 0;
  private crouching = false;
  private crouchLerp = 0;
  private crawling = false;
  private crawlLerp = 0;
  private crawlYaw = 0;
  private swimLerp = 0;

  /** collision height depends on posture: crawling fits through 1-block gaps */
  private playerHeight(crawling = this.crawling) {
    return crawling ? CRAWL_HEIGHT : PLAYER_HEIGHT;
  }
  private sleeping = false;
  private sleepDark = 0;
  private inLava = false;
  private inWater = false;
  private breathState: BreathState = createBreathState();
  private staminaState = createStaminaState();
  private cactusCooldown = 0;
  private volcanoSmokeTimer = 0;
  private desertWindTimer = 0;
  private hurtTimer = 0;
  /** seconds of immunity granted by a rewarded-video revive (0 = normal play) */
  private reviveShield = 0;
  private bob = 0;
  private stepSmooth = 0;
  private fovTarget = 72;
  private landDip = 0;

  // ---- input ----
  private keys: Record<string, boolean> = {};
  private touchMove = { x: 0, y: 0 };
  private touchJump = false;
  private touchMine = false;
  private touchPlace = false;
  private touchSprint = false;
  private playerSprinting = false;
  private touchCrouch = false;
  private touchCrawl = false;
  private mining = false;
  private placing = false;
  private placeCooldown = 0;
  private locked = false;
  /** pointer lock refused (sandboxed iframe / denied permission) → drag-look fallback */
  private lockFailed = false;
  private hoverX = 0.5;
  private hoverY = 0.5;
  private hoverActive = false;
  private freeLook = true;

  // ---- mining ----
  private target: { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number } | null = null;
  private mineProgress = 0;
  private mineBlockKey = '';
  private mineDenyKey = '';
  private swingT = -1;
  private swingDur = 0.3;
  private swingStep = 0;
  private swingSoundAt = 0.45;

  // ---- fx ----
  private shake = 0;
  private shakeMag = 0;
  private flash = 0;
  private time = 0;
  private raf = 0;
  private last = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 60;
  private slowFrames = 0;
  private fastFrames = 0;
  private basePixelRatio = 1;
  private minPixelRatio = 0.7;
  private disposed = false;
  private lastHudKey = '';
  private menuAngle = 0;
  private warnTick = 0;
  private rand = mulberry32(1);

  constructor(container: HTMLElement, onHud: (s: HudState) => void) {
    this.container = container;
    this.onHud = onHud;
    try {
      const saved = JSON.parse(storageGet(TUTORIAL_STORAGE_KEY) ?? '[]') as unknown;
      if (Array.isArray(saved)) {
        for (const id of saved) if (typeof id === 'string') this.tutorialSeen.add(id);
      }
    } catch {
      // Tutorial persistence is optional; private browsing/storage restrictions must not block play.
    }
  }

  // ================= SETUP =================
  mount() {
    const { w, h } = this.viewportSize();
    const coarseDevice = this.isCoarse();
    // Rendering at DPR 2 costs roughly four times as many pixels as DPR 1; favour frame time on phones.
    // Start near native resolution instead of a costly 1.5x supersample; quality rises only after
    // the frame-time watchdog confirms sustained headroom.
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, coarseDevice ? 0.95 : 1.25);
    this.minPixelRatio = coarseDevice ? 0.5 : 0.58;
    this.minRenderDist = coarseDevice ? 40 : 48;
    this.maxRenderDist = coarseDevice ? 72 : 104;
    this.renderDist = coarseDevice ? 56 : 80;

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.autoClear = false;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color('#bcd7e8');
    // wider view on the big map, with the fog wall just inside the cull radius
    this.scene.fog = new THREE.Fog(fogColor, 48, 124);
    this.scene.background = fogColor;

    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.08, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.hudScene = new THREE.Scene();
    this.hudCamera = new THREE.PerspectiveCamera(68, w / h, 0.01, 12);
    this.hudScene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const dl = new THREE.DirectionalLight(0xfff2d8, 0.78);
    dl.position.set(0.5, 1, 0.7);
    this.hudScene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x9fc0ff, 0.28);
    dl2.position.set(-1, -0.3, -0.6);
    this.hudScene.add(dl2);

    // Lambert terrain keeps baked voxel AO via vertex colours, while real PointLights
    // from hand/placed torches can now illuminate the world locally at night.
    this.material = new THREE.MeshLambertMaterial({ map: getAtlasTexture(), vertexColors: true, fog: true, alphaTest: 0.08 });
    this.cutoutMat = new THREE.MeshLambertMaterial({
      map: getAtlasTexture(),
      vertexColors: true,
      fog: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.waterMat = new THREE.MeshBasicMaterial({
      map: getAtlasTexture(),
      vertexColors: true,
      fog: true,
      transparent: true,
      opacity: 0.66,
      depthWrite: false,
    });
    this.decorMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    this.installThirdPersonClip(this.material);
    this.installThirdPersonClip(this.cutoutMat);
    this.installThirdPersonClip(this.decorMat);

    this.buildSky();
    this.buildParticles();
    this.buildDrops();
    this.buildMotes();
    this.buildHighlight();
    this.buildPickaxe();
    this.buildPlayerAvatar();
    this.buildThirdPersonFogCap();
    this.buildFxLayer();
    this.scene.add(this.companionLayer);
    this.scene.add(this.wolfPetLayer);
    this.bindInput();
    this.layoutViewModel(w / h);
    this.setRenderDist(this.renderDist);
    this.mobSys = new MobSystem(this.scene, this.world);

    this.queueWorldGen(this.pickBalancedSeed());
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private installThirdPersonClip(mat: THREE.Material) {
    const uniforms = {
      active: { value: 0 },
      start: { value: new THREE.Vector3() },
      end: { value: new THREE.Vector3() },
      radius: { value: 1.05 },
    };
    this.thirdPersonClipUniforms.push(uniforms);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tpClipActive = uniforms.active;
      shader.uniforms.tpClipStart = uniforms.start;
      shader.uniforms.tpClipEnd = uniforms.end;
      shader.uniforms.tpClipRadius = uniforms.radius;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTpWorldPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvTpWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      const header =
        '#include <common>\nuniform float tpClipActive;\nuniform vec3 tpClipStart;\nuniform vec3 tpClipEnd;\nuniform float tpClipRadius;\nvarying vec3 vTpWorldPos;';
      const clip = `
if (tpClipActive > 0.5) {
  vec3 seg = tpClipEnd - tpClipStart;
  float len2 = max(dot(seg, seg), 0.0001);
  float tRaw = dot(vTpWorldPos - tpClipStart, seg) / len2;
  if (tRaw > 0.025 && tRaw < 0.985) {
    vec3 closest = tpClipStart + seg * tRaw;
    float taper = smoothstep(0.025, 0.16, tRaw) * (1.0 - smoothstep(0.88, 0.985, tRaw));
    if (length(vTpWorldPos - closest) < tpClipRadius * taper) discard;
  }
}
`;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', header);
      if (shader.fragmentShader.includes('#include <clipping_planes_fragment>')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + clip);
      } else {
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'void main() {\n' + clip);
      }
    };
    mat.needsUpdate = true;
  }

  private pickBalancedSeed(): number {
    const c0x = Math.floor(ORIGIN_X / CHUNK);
    const c0z = Math.floor(ORIGIN_Z / CHUNK);
    let bestSeed = Math.floor(Math.random() * 1e9);
    let bestScore = -Infinity;

    for (let i = 0; i < 56; i++) {
      const candidate = Math.floor(Math.random() * 1e9);
      seedNoise(candidate);
      this.world.reset(candidate);

      const counts: Record<'plains' | 'autumn' | 'winter' | 'jungle' | 'dry' | 'volcanic', number> = {
        plains: 0,
        autumn: 0,
        winter: 0,
        jungle: 0,
        dry: 0,
        volcanic: 0,
      };
      let coreDry = 0;
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const biome = this.world.biomeAt((c0x + dx) * CHUNK + 8, (c0z + dz) * CHUNK + 8);
          const key = biome === 'desert' || biome === 'canyon' ? 'dry' : biome;
          counts[key]++;
          if (key === 'dry' && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) coreDry++;
        }
      }

      const values = Object.values(counts);
      const dominant = Math.max(...values);
      const diversity = values.filter((v) => v > 0).length;
      const hasGreenSpawn = counts.plains + counts.autumn + counts.jungle + counts.winter;
      const target = 49 / 5;
      const balancePenalty = values.reduce((sum, v) => sum + Math.abs(v - target), 0);
      const dryPenalty = Math.max(0, counts.dry - 15) * 4 + coreDry * 3;
      const score = diversity * 26 + hasGreenSpawn * 0.35 - balancePenalty - dryPenalty - Math.max(0, dominant - 19) * 6;

      if (score > bestScore) {
        bestScore = score;
        bestSeed = candidate;
      }
      // Good enough: no biome dominates the starting area and dry biomes are not the core default.
      if (diversity >= 3 && dominant <= 18 && counts.dry <= 15 && coreDry <= 3 && hasGreenSpawn >= 18) return candidate;
    }
    return bestSeed;
  }

  private isCoarse() {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(360, 28, 18),
      new THREE.MeshBasicMaterial({ map: getSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -100;
    this.scene.add(sky);
    this.skyMesh = sky;
    this.skyMat = sky.material as THREE.MeshBasicMaterial;

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(18, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, fog: false, transparent: true, opacity: 0.98, depthWrite: false, side: THREE.DoubleSide }),
    );
    const sunHalo = new THREE.Mesh(
      new THREE.CircleGeometry(46, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd36a,
        fog: false,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    sunHalo.position.z = -0.6;
    sun.add(sunHalo);
    this.sunHaloMat = sunHalo.material as THREE.MeshBasicMaterial;
    sun.frustumCulled = false;
    this.scene.add(sun);
    this.sunMesh = sun;

    // the special sun: one plane that shows the current GIF frame from the sprite sheet
    const sheetTex = new THREE.TextureLoader().load(sunSheetUrl, () => {
      this.sunSheetReady = true;
    });
    sheetTex.repeat.set(1 / 6, 1 / 6);
    sheetTex.colorSpace = THREE.SRGBColorSpace;
    this.sunSheetTex = sheetTex;
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 46),
      new THREE.MeshBasicMaterial({ map: sheetTex, transparent: true, fog: false, depthWrite: false }),
    );
    sheet.visible = false;
    sheet.frustumCulled = false;
    this.scene.add(sheet);
    this.sunSheetMesh = sheet;

    // a proper round moon: soft halo + bright disc + a few dark craters
    const moon = new THREE.Group();
    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(11, 32),
      new THREE.MeshBasicMaterial({ color: 0xaebfe8, fog: false, transparent: true, opacity: 0.018, depthWrite: false, side: THREE.DoubleSide }),
    );
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshBasicMaterial({ color: 0xd6def4, fog: false, transparent: true, opacity: 0.66, depthWrite: false, side: THREE.DoubleSide }),
    );
    disc.position.z = 0.5;
    moon.add(halo);
    moon.add(disc);
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0xb8c4e0,
      fog: false,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const [cx2, cy2, r2] of [
      [-3.2, 2.4, 1.9],
      [2.8, -1.6, 1.4],
      [0.6, 3.6, 1.0],
      [-1.8, -3.0, 1.2],
    ] as const) {
      const crater = new THREE.Mesh(new THREE.CircleGeometry(r2, 20), craterMat);
      crater.position.set(cx2, cy2, 1);
      moon.add(crater);
    }
    moon.frustumCulled = false;
    this.scene.add(moon);
    this.moonMesh = moon;

    const starCount = this.isCoarse() ? 160 : 260;
    const starPos = new Float32Array(starCount * 3);
    const rand = mulberry32(7301);
    for (let i = 0; i < starCount; i++) {
      const a = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.9;
      const r = Math.sqrt(Math.max(0, 1 - y * y)) * 330;
      starPos[i * 3] = Math.cos(a) * r;
      starPos[i * 3 + 1] = y * 330;
      starPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starCanvas = document.createElement('canvas');
    starCanvas.width = starCanvas.height = 16;
    const starCtx = starCanvas.getContext('2d')!;
    const sg = starCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
    sg.addColorStop(0, 'rgba(255,255,255,1)');
    sg.addColorStop(0.35, 'rgba(210,230,255,.85)');
    sg.addColorStop(1, 'rgba(210,230,255,0)');
    starCtx.fillStyle = sg;
    starCtx.fillRect(0, 0, 16, 16);
    const starTex = new THREE.CanvasTexture(starCanvas);
    this.starMat = new THREE.PointsMaterial({
      size: 1.7,
      map: starTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
      fog: false,
      sizeAttenuation: true,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    this.ambLight = new THREE.AmbientLight(0xdfe8ff, 0.55);
    this.scene.add(this.ambLight);
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 1);
    this.sunLight.position.set(-0.5, 1, 0.35);
    this.scene.add(this.sunLight);

    const cloudTex = getCloudTexture();
    cloudTex.repeat.set(3, 3);
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.58, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 118;
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);

    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight(0xffb15a, 0, 15, 1.55);
      light.visible = false;
      this.placedTorchLights.push(light);
      this.scene.add(light);
    }
  }

  private buildParticles() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // white vertex colours + per-instance colour → guarantees tinting on every three build
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    this.pMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pMesh.frustumCulled = false;
    this.pMesh.count = 0;
    const colors = new Float32Array(MAX_PARTICLES * 3).fill(1);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.pMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.pMesh);
  }

  private buildDrops() {
    const base = new THREE.BoxGeometry(1, 1, 1);
    this.dropUVBase = Float32Array.from((base.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>);
    for (let i = 0; i < MAX_DROPS; i++) {
      const geo = base.clone();
      // the shared terrain material has vertexColors on — without a white colour
      // attribute the drops would shade to pure black
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.drops.push({ active: false, id: STONE, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, mesh, clearance: 0.32 });
    }
    base.dispose();
  }

  private buildMotes() {
    const N = 220;
    const pos = new Float32Array(N * 3);
    const rand = mulberry32(99);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 40;
      pos[i * 3 + 1] = rand() * 26;
      pos[i * 3 + 2] = (rand() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,235,0.95)');
    g.addColorStop(1, 'rgba(255,255,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.5,
      sizeAttenuation: true,
      fog: false,
    });
    this.motes = new THREE.Points(geo, mat);
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  private buildHighlight() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0b0d0c, transparent: true, opacity: 0.85, fog: false }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.crackMat = new THREE.MeshBasicMaterial({
      map: getCrackTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      fog: false,
      opacity: 0.92,
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), this.crackMat);
    this.crackMesh.visible = false;
    this.crackUVBase = Float32Array.from((this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>);
    this.scene.add(this.crackMesh);
  }

  private buildPickaxe() {
    this.pickGroup = new THREE.Group();
    this.toolCrafted = new THREE.Group();
    this.toolCrafted.position.set(0.02, -0.02, 0.02);
    this.toolCrafted.rotation.set(0.08, 0.45, 0.48);
    this.toolCrafted.scale.setScalar(0.92);
    this.toolCrafted.visible = false;
    this.pickGroup.add(this.toolCrafted);

    // Chunky pixel geometry keeps the tool readable even after the view-model is reduced.
    // Keep wooden tools warm and readable; the ember-black outline is reserved for metal tiers.
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x4b2a1c, side: THREE.BackSide, fog: false });
    const parts: Array<{ geo: THREE.BoxGeometry; mat: THREE.Material; pos: [number, number, number]; rot?: [number, number, number]; head?: boolean }> = [];

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x86502d });
    const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x5a321f });
    const headColors = [0x9b5f35, 0xa8aeb4, 0xeccaa2, 0x6cf2e4];
    headColors.forEach((c) => this.pickHeadMats.push(new THREE.MeshLambertMaterial({ color: c })));
    const headMat = this.pickHeadMats[0];

    parts.push({ geo: new THREE.BoxGeometry(0.1, 0.92, 0.1), mat: woodMat, pos: [0, -0.3, 0.08], rot: [0.2, 0, 0] });
    parts.push({ geo: new THREE.BoxGeometry(0.105, 0.2, 0.105), mat: woodDarkMat, pos: [0, -0.56, 0.13], rot: [0.2, 0, 0] });
    // A proper pick head: the bar is across the handle and the two ends taper away
    // from it.  It is later turned into the scene so a point, not the flat face,
    // leads the strike.
    parts.push({ geo: new THREE.BoxGeometry(0.66, 0.18, 0.17), mat: headMat, pos: [0, 0.2, -0.02], head: true });
    parts.push({ geo: new THREE.BoxGeometry(0.26, 0.15, 0.15), mat: headMat, pos: [-0.42, 0.15, -0.02], rot: [0, 0, -0.55], head: true });
    parts.push({ geo: new THREE.BoxGeometry(0.26, 0.15, 0.15), mat: headMat, pos: [0.42, 0.15, -0.02], rot: [0, 0, 0.55], head: true });
    // collar where head meets shaft
    parts.push({ geo: new THREE.BoxGeometry(0.15, 0.14, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0x3f4046 }), pos: [0, 0.06, 0.02] });

    this.toolPick = new THREE.Group();
    for (const p of parts) {
      const mesh = new THREE.Mesh(p.geo, p.mat);
      mesh.position.set(...p.pos);
      if (p.rot) mesh.rotation.set(...p.rot);
      if (p.head) mesh.name = 'head';
      this.toolPick.add(mesh);

      // fat black shell = cartoon outline, keeps the tool readable on bright sand
      const shell = new THREE.Mesh(p.geo, outlineMat);
      shell.position.copy(mesh.position);
      shell.rotation.copy(mesh.rotation);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolPick.add(shell);
    }
    // Turn the head partly into depth: one pointed end now leads toward a block,
    // while the other remains visible as a readable pickaxe silhouette.
    this.toolPick.rotation.set(0.18, -0.9, 0.54);
    this.toolPick.position.set(0.02, -0.02, 0.06);
    this.pickGroup.add(this.toolPick);

    // ---- sword ----
    this.toolSword = new THREE.Group();
    const swordMat = new THREE.MeshLambertMaterial({ color: 0xd9dde2 });
    this.swordMat = swordMat;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.05), swordMat);
    blade.position.y = 0.42;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.05), swordMat);
    tip.position.y = 0.96;
    tip.rotation.z = Math.PI / 4;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.09), new THREE.MeshLambertMaterial({ color: 0x8a6a3c }));
    guard.position.y = -0.08;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a4126 }));
    grip.position.y = -0.3;
    for (const part of [blade, tip, guard, grip]) {
      this.toolSword.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.rotation.copy(part.rotation);
      shell.scale.setScalar(1.13);
      shell.renderOrder = -1;
      this.toolSword.add(shell);
    }
    // Blade tilts away from the camera instead of presenting a flat card.
    this.toolSword.rotation.set(0.46, 0.22, 0.42);
    this.toolSword.visible = false;
    this.pickGroup.add(this.toolSword);

    // ---- axe ----
    this.toolAxe = new THREE.Group();
    const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), new THREE.MeshLambertMaterial({ color: 0x9c7743 }));
    axeHandle.position.y = -0.15;
    const axeHeadMat = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    const axeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    this.axeHeadMat = axeHeadMat;
    this.axeEdgeMat = axeEdgeMat;
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.12), axeHeadMat);
    axeHead.position.set(0.16, 0.32, 0);
    const axeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.12), axeEdgeMat);
    axeEdge.position.set(0.33, 0.32, 0);
    for (const part of [axeHandle, axeHead, axeEdge]) {
      this.toolAxe.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolAxe.add(shell);
    }
    // The cutting edge points into the world and a little to screen-left;
    // the butt is no longer the conspicuous right-facing end.
    this.toolAxe.rotation.set(0.3, -1.45, 0.38);
    this.toolAxe.rotateY(-Math.PI / 2);
    this.toolAxe.visible = false;
    this.pickGroup.add(this.toolAxe);

    // ---- shovel ----
    this.toolShovel = new THREE.Group();
    const shHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), new THREE.MeshLambertMaterial({ color: 0x9c7743 }));
    shHandle.position.y = -0.1;
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.06), new THREE.MeshLambertMaterial({ color: 0xb9bec4 }));
    scoop.position.set(0, 0.42, 0);
    for (const part of [shHandle, scoop]) {
      this.toolShovel.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolShovel.add(shell);
    }
    this.toolShovel.rotation.set(0.32, -0.78, 0.34);
    this.toolShovel.rotateY(-Math.PI / 2);
    this.toolShovel.visible = false;
    this.pickGroup.add(this.toolShovel);

    // ---- hoe ----
    // A hoe has a short one-sided blade rather than the broad axe head.
    this.toolHoe = new THREE.Group();
    const hoeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.88, 0.08), new THREE.MeshLambertMaterial({ color: 0x86502d }));
    hoeHandle.position.y = -0.12;
    const hoeHeadMat = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    const hoeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    this.hoeHeadMat = hoeHeadMat;
    this.hoeEdgeMat = hoeEdgeMat;
    const hoeNeck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.13), hoeHeadMat);
    hoeNeck.position.set(0.11, 0.31, 0);
    const hoeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.15), hoeEdgeMat);
    hoeBlade.position.set(0.28, 0.2, 0);
    for (const part of [hoeHandle, hoeNeck, hoeBlade]) {
      this.toolHoe.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.scale.setScalar(1.14);
      shell.renderOrder = -1;
      this.toolHoe.add(shell);
    }
    this.toolHoe.rotation.set(0.32, -1.28, 0.38);
    this.toolHoe.rotateY(-Math.PI / 2);
    this.toolHoe.visible = false;
    this.pickGroup.add(this.toolHoe);

    // ---- bow ----
    this.toolBow = new THREE.Group();
    const bowMat2 = new THREE.MeshLambertMaterial({ color: 0x8a6a3c });
    const limbT = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.09), bowMat2);
    limbT.position.set(0.1, 0.42, 0);
    limbT.rotation.z = -0.5;
    const limbB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.09), bowMat2);
    limbB.position.set(0.1, -0.42, 0);
    limbB.rotation.z = 0.5;
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.11), new THREE.MeshLambertMaterial({ color: 0x6e5129 }));
    const stringMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xe8e2d2 }));
    stringMesh.position.set(0.24, 0, 0);
    for (const part of [limbT, limbB, grip2, stringMesh]) this.toolBow.add(part);
    this.toolBow.rotation.set(0, -0.5, 0.12);
    this.toolBow.visible = false;
    this.pickGroup.add(this.toolBow);

    // ---- bare hand: blocky forearm + fist, Minecraft first-person style ----
    this.toolHand = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x4a7a52 });
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.22), skinMat);
    forearm.position.set(0, -0.14, 0.1);
    forearm.rotation.x = 0.5;
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.25), sleeveMat);
    sleeve.position.set(0, -0.34, 0.22);
    sleeve.rotation.x = 0.5;
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), skinMat);
    fist.position.set(0, 0.12, -0.03);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), skinMat);
    thumb.position.set(-0.13, 0.14, -0.06);
    for (const part of [forearm, sleeve, fist, thumb]) {
      this.toolHand.add(part);
      const shell = new THREE.Mesh(part.geometry, outlineMat);
      shell.position.copy(part.position);
      shell.rotation.copy(part.rotation);
      shell.scale.setScalar(1.12);
      shell.renderOrder = -1;
      this.toolHand.add(shell);
    }
    this.toolHand.rotation.set(0.15, 0.35, 0.25);
    this.toolHand.position.set(0.05, -0.1, 0.05);
    this.toolHand.visible = false;
    this.pickGroup.add(this.toolHand);

    // ---- hand torch ----
    this.toolTorch = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), new THREE.MeshLambertMaterial({ color: 0x8b6a3c }));
    stick.position.y = -0.1;
    const headT = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.15, 0.13),
      new THREE.MeshBasicMaterial({ color: 0xffc84a }),
    );
    headT.position.y = 0.2;
    this.torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.1), this.torchFlameMat);
    flame.position.y = 0.33;
    this.torchFlame = flame;
    for (const part of [stick, headT, flame]) this.toolTorch.add(part);
    const stickShell = new THREE.Mesh(stick.geometry, outlineMat);
    stickShell.position.copy(stick.position);
    stickShell.scale.setScalar(1.15);
    stickShell.renderOrder = -1;
    this.toolTorch.add(stickShell);
    this.toolTorch.rotation.set(0.1, 0.2, 0.35);
    this.toolTorch.position.set(0, 0.05, 0);
    this.toolTorch.visible = false;
    this.pickGroup.add(this.toolTorch);

    // point light so the torch also lights up mobs at night
    this.torchLight = new THREE.PointLight(0xffb050, 0, 14, 1.6);
    this.scene.add(this.torchLight);

    // ---- held block ----
    this.toolBlock = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), this.material.clone());
    this.blockUVBase = Float32Array.from(
      (this.toolBlock.geometry.getAttribute('uv') as THREE.BufferAttribute).array as ArrayLike<number>,
    );
    this.toolBlock.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(this.toolBlock.geometry.getAttribute('position').count * 3).fill(1), 3),
    );
    this.toolBlock.rotation.set(0.35, 0.7, 0.1);
    this.toolBlock.position.set(0, 0.02, 0);
    this.toolBlock.visible = false;
    this.pickGroup.add(this.toolBlock);

    // ---- 3D held Lantern matching logo.png ----
    this.toolLantern = new THREE.Group();
    const lIronDark = new THREE.MeshLambertMaterial({ color: 0x262423 });
    const lIronMid = new THREE.MeshLambertMaterial({ color: 0x363331 });
    const lIronTop = new THREE.MeshLambertMaterial({ color: 0x4b4846 });
    const lGlowOrange = new THREE.MeshBasicMaterial({ color: 0xf27d16 });
    const lGlowGold = new THREE.MeshBasicMaterial({ color: 0xffd836 });
    const lGlowYellow = new THREE.MeshBasicMaterial({ color: 0xffee58 });
    const lGlowWhite = new THREE.MeshBasicMaterial({ color: 0xffffe4 });
    const addLBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.toolLantern.add(m);
    };
    const lby = -0.22;
    for (const dx of [-0.1, 0.1]) {
      for (const dz of [-0.1, 0.1]) {
        addLBox(0.08, 0.03, 0.08, dx, lby + 0.015, dz, lIronDark);
      }
    }
    addLBox(0.3, 0.05, 0.3, 0, lby + 0.055, 0, lIronMid);
    const lgy = lby + 0.21;
    addLBox(0.23, 0.26, 0.23, 0, lgy, 0, lGlowOrange);
    addLBox(0.236, 0.18, 0.236, 0, lgy, 0, lGlowGold);
    addLBox(0.242, 0.12, 0.14, 0, lgy, 0, lGlowYellow);
    addLBox(0.14, 0.12, 0.242, 0, lgy, 0, lGlowYellow);
    addLBox(0.248, 0.052, 0.052, 0, lgy + 0.026, -0.026, lGlowWhite);
    addLBox(0.248, 0.052, 0.052, 0, lgy - 0.026, 0.026, lGlowWhite);
    addLBox(0.052, 0.052, 0.248, -0.026, lgy + 0.026, 0, lGlowWhite);
    addLBox(0.052, 0.052, 0.248, 0.026, lgy - 0.026, 0, lGlowWhite);
    for (const dx of [-0.112, 0.112]) {
      for (const dz of [-0.112, 0.112]) {
        addLBox(0.058, 0.26, 0.058, dx, lgy, dz, lIronDark);
      }
    }
    addLBox(0.32, 0.055, 0.32, 0, lby + 0.365, 0, lIronMid);
    addLBox(0.17, 0.036, 0.17, 0, lby + 0.41, 0, lGlowYellow);
    for (const dx of [-0.068, 0.068]) {
      for (const dz of [-0.068, 0.068]) {
        addLBox(0.054, 0.036, 0.054, dx, lby + 0.41, dz, lIronTop);
      }
    }
    addLBox(0.195, 0.05, 0.195, 0, lby + 0.45, 0, lIronTop);
    addLBox(0.036, 0.065, 0.036, -0.05, lby + 0.505, 0, lIronDark);
    addLBox(0.036, 0.065, 0.036, 0.05, lby + 0.505, 0, lIronDark);
    addLBox(0.136, 0.036, 0.036, 0, lby + 0.545, 0, lIronDark);
    this.toolLantern.rotation.set(0.22, 0.65, 0.08);
    this.toolLantern.position.set(0.02, 0.04, 0);
    this.toolLantern.visible = false;
    this.pickGroup.add(this.toolLantern);

    // ---- 3D held Armor / Gear model ----
    // The selected item is rebuilt from the same slot-specific builder as ground drops.
    this.toolGear = new THREE.Group();
    this.toolGear.rotation.set(0.2, 0.5, 0.05);
    this.toolGear.position.set(0.02, 0.02, 0);
    this.toolGear.scale.setScalar(1.55);
    this.toolGear.visible = false;
    this.pickGroup.add(this.toolGear);

    // Worn hand armor stays visible in first-person even while another tool is held.
    this.firstPersonGlove = new THREE.Group();
    this.firstPersonGlove.position.set(0.05, -0.1, 0.05);
    this.firstPersonGlove.rotation.set(0.15, 0.35, 0.25);
    this.firstPersonGlove.visible = false;
    this.pickGroup.add(this.firstPersonGlove);

    // ---- 3D held Material / Resource Item (Lapis, Emerald, Diamond, Ingots, Drops, etc.) ----
    this.toolItem = new THREE.Group();
    this.toolItem.rotation.set(0.18, 0.55, 0.08);
    this.toolItem.position.set(0.02, 0.04, 0.02);
    this.toolItem.scale.setScalar(1.38);
    this.toolItem.visible = false;
    this.pickGroup.add(this.toolItem);

    this.viewFireFx = buildEnchantedFlames(false);
    this.pickGroup.add(this.viewFireFx);

    this.pickGroup.position.set(0.44, -0.4, -0.72);
    this.pickGroup.rotation.set(0.35, -0.5, 0.22);
    this.hudScene.add(this.pickGroup);
  }

  private buildThirdPersonFogCap() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    grad.addColorStop(0, 'rgba(13,11,8,0.96)');
    grad.addColorStop(0.62, 'rgba(17,14,9,0.88)');
    grad.addColorStop(0.86, 'rgba(22,18,12,0.62)');
    grad.addColorStop(1, 'rgba(22,18,12,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.thirdPersonFogMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.thirdPersonFogCap = new THREE.Mesh(new THREE.CircleGeometry(1, 64), this.thirdPersonFogMat);
    this.thirdPersonFogCap.visible = false;
    this.thirdPersonFogCap.frustumCulled = false;
    this.thirdPersonFogCap.renderOrder = 60;
    this.scene.add(this.thirdPersonFogCap);
  }

  private buildPlayerAvatar() {
    const g = new THREE.Group();
    // YXZ makes yaw apply around world-up before the prone/swim pitch.  With the
    // default XYZ order, a -90° swim pitch locked the body direction, so the
    // puppet looked like it was sliding sideways instead of following the crosshair.
    g.rotation.order = 'YXZ';
    const customization = this.characterCustomization;
    const skin = new THREE.MeshLambertMaterial({ color: customization.skinColor });
    const shirt = new THREE.MeshLambertMaterial({ color: customization.shirtColor });
    const shirtDark = new THREE.MeshLambertMaterial({ color: customization.shirtColor });
    const pants = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
    const shoeMat = new THREE.MeshLambertMaterial({ color: customization.shoeColor });
    const shoeSole = new THREE.MeshLambertMaterial({ color: 0x202124 });
    const shoeAccent = new THREE.MeshLambertMaterial({ color: 0xf1f2ed });
    const hair = new THREE.MeshLambertMaterial({ color: customization.hairColor });
    const skirt = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
    const skirtAccent = new THREE.MeshLambertMaterial({ color: customization.pantsColor });
    skirtAccent.color.multiplyScalar(0.7);
    this.avatarAppearance = { skin, shirt, shirtDark, pants, shoes: shoeMat, shoeSole, shoeAccent, hair, skirt, skirtAccent };

    const addBox = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent = g) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    this.avatarTorso = addBox(0.56, 0.72, 0.28, shirt, 0, 1.02, 0);
    this.avatarTorsoTrim = addBox(0.58, 0.16, 0.3, shirtDark, 0, 1.31, 0);
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.58, -0.02);
    addBox(CHARACTER_HEAD_SIZE, CHARACTER_HEAD_SIZE, CHARACTER_HEAD_SIZE, skin, 0, 0, 0, headGroup);

    for (const style of CHARACTER_HAIRSTYLES) {
      const variant = buildCharacterHair(style, hair);
      const helmetVariant = buildCharacterHair(style, hair, true);
      variant.visible = style === customization.hairstyle && !this.equipped.head;
      helmetVariant.visible = style === customization.hairstyle && !!this.equipped.head;
      this.avatarHairVariants[style] = variant;
      this.avatarHelmetHairVariants[style] = helmetVariant;
      headGroup.add(variant, helmetVariant);
    }

    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 128;
    faceCanvas.height = 128;
    const faceContext = faceCanvas.getContext('2d');
    if (faceContext) {
      this.avatarFaceContext = faceContext;
      drawCharacterFace(faceContext, customization.expression, customization.glasses);
      const faceTexture = new THREE.CanvasTexture(faceCanvas);
      faceTexture.colorSpace = THREE.SRGBColorSpace;
      faceTexture.magFilter = THREE.NearestFilter;
      faceTexture.minFilter = THREE.NearestFilter;
      this.avatarFaceTexture = faceTexture;
      const faceMaterial = new THREE.MeshBasicMaterial({
        map: faceTexture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(CHARACTER_FACE_SIZE, CHARACTER_FACE_SIZE), faceMaterial);
      face.position.set(0, -0.005, CHARACTER_FACE_FRONT_Z);
      headGroup.add(face);
    }
    g.add(headGroup);
    this.avatarHead = headGroup;

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.43, 1.34, 0);
    addBox(0.18, 0.62, 0.2, shirt, 0, -0.28, 0, leftArm);
    addBox(0.18, 0.18, 0.2, skin, 0, -0.68, 0, leftArm);
    g.add(leftArm);
    this.avatarLeftArm = leftArm;

    const rightArm = new THREE.Group();
    rightArm.position.set(0.43, 1.34, 0);
    addBox(0.18, 0.62, 0.2, shirt, 0, -0.28, 0, rightArm);
    addBox(0.18, 0.18, 0.2, skin, 0, -0.68, 0, rightArm);
    g.add(rightArm);
    this.avatarRightArm = rightArm;

    const heldRoot = new THREE.Group();
    heldRoot.position.set(0.02, -0.78, -0.14);
    heldRoot.rotation.set(-0.72, 0.08, -0.18);
    rightArm.add(heldRoot);
    this.avatarHeldRoot = heldRoot;

    const makeHeldGroup = () => {
      const group = new THREE.Group();
      group.visible = false;
      heldRoot.add(group);
      return group;
    };
    this.avatarHeldTool = makeHeldGroup();
    this.avatarHeldTool.position.set(0, -0.02, -0.02);
    const woodHeld = new THREE.MeshLambertMaterial({ color: 0x9c7743 });
    const ironHeld = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    const darkHeld = new THREE.MeshLambertMaterial({ color: 0x262423 });

    this.avatarHeldPick = makeHeldGroup();
    this.avatarHeldPickMats = [new THREE.MeshLambertMaterial({ color: PICKAXE_TIERS[0].color })];
    addBox(0.07, 0.62, 0.07, woodHeld, 0, -0.02, 0, this.avatarHeldPick);
    addBox(0.12, 0.12, 0.46, this.avatarHeldPickMats[0], 0, 0.34, 0, this.avatarHeldPick);
    addBox(0.11, 0.11, 0.2, this.avatarHeldPickMats[0], 0, 0.32, -0.28, this.avatarHeldPick).rotation.x = -0.48;
    addBox(0.11, 0.11, 0.2, this.avatarHeldPickMats[0], 0, 0.32, 0.28, this.avatarHeldPick).rotation.x = 0.48;
    // Align the legacy pick's shaft through the palm and turn its head across the grip.
    this.avatarHeldPick.position.set(-0.033, -0.005, 0.168);
    this.avatarHeldPick.scale.setScalar(0.9);
    this.avatarHeldPick.rotation.set(-1.15, 1.374, 1.092);
    this.avatarHeldPick.rotateY(Math.PI / 2);

    this.avatarHeldAxe = makeHeldGroup();
    this.avatarHeldAxeHeadMat = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    this.avatarHeldAxeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    addBox(0.07, 0.6, 0.07, woodHeld, 0, 0, 0, this.avatarHeldAxe);
    addBox(0.24, 0.22, 0.1, this.avatarHeldAxeHeadMat, 0.12, 0.28, 0, this.avatarHeldAxe);
    addBox(0.07, 0.28, 0.11, this.avatarHeldAxeEdgeMat, 0.28, 0.28, 0, this.avatarHeldAxe);
    this.avatarHeldAxe.rotation.set(0.08, 0, 0.55);
    this.avatarHeldAxe.rotateY(Math.PI / 2);

    this.avatarHeldSword = makeHeldGroup();
    this.avatarHeldSwordMat = new THREE.MeshLambertMaterial({ color: 0xd9dde2 });
    addBox(0.07, 0.68, 0.045, this.avatarHeldSwordMat, 0, 0.28, 0, this.avatarHeldSword);
    addBox(0.25, 0.07, 0.07, woodHeld, 0, -0.08, 0, this.avatarHeldSword);
    addBox(0.08, 0.22, 0.07, darkHeld, 0, -0.22, 0, this.avatarHeldSword);
    this.avatarHeldSword.rotation.set(0.05, 0, 0.25);

    this.avatarHeldShovel = makeHeldGroup();
    addBox(0.06, 0.6, 0.06, woodHeld, 0, 0, 0, this.avatarHeldShovel);
    addBox(0.17, 0.24, 0.055, ironHeld, 0, 0.36, 0, this.avatarHeldShovel);
    this.avatarHeldShovel.rotation.set(0.1, 0, 0.32);
    this.avatarHeldShovel.rotateY(Math.PI / 2);

    this.avatarHeldHoe = makeHeldGroup();
    this.avatarHeldHoeHeadMat = new THREE.MeshLambertMaterial({ color: 0xa8aeb4 });
    this.avatarHeldHoeEdgeMat = new THREE.MeshLambertMaterial({ color: 0xd6d9dd });
    addBox(0.06, 0.6, 0.06, woodHeld, 0, 0, 0, this.avatarHeldHoe);
    addBox(0.2, 0.1, 0.08, this.avatarHeldHoeHeadMat, 0.1, 0.3, 0, this.avatarHeldHoe);
    addBox(0.06, 0.24, 0.09, this.avatarHeldHoeEdgeMat, 0.25, 0.22, 0, this.avatarHeldHoe);
    this.avatarHeldHoe.rotation.set(0.1, -1.12, 0.3);
    this.avatarHeldHoe.rotateY(Math.PI / 2);

    this.avatarHeldBow = makeHeldGroup();
    addBox(0.055, 0.42, 0.07, woodHeld, 0.05, 0.22, 0, this.avatarHeldBow).rotation.z = -0.38;
    addBox(0.055, 0.42, 0.07, woodHeld, 0.05, -0.22, 0, this.avatarHeldBow).rotation.z = 0.38;
    addBox(0.018, 0.78, 0.018, new THREE.MeshBasicMaterial({ color: 0xe8e2d2 }), 0.2, 0, 0, this.avatarHeldBow);
    this.avatarHeldBow.rotation.set(0, 0.15, 0.25);

    this.avatarHeldTorch = makeHeldGroup();
    addBox(0.07, 0.45, 0.07, woodHeld, 0, 0, 0, this.avatarHeldTorch);
    addBox(0.12, 0.13, 0.12, new THREE.MeshBasicMaterial({ color: 0xffc84a }), 0, 0.28, 0, this.avatarHeldTorch);
    addBox(0.09, 0.12, 0.09, new THREE.MeshBasicMaterial({ color: 0xffec8c, transparent: true, opacity: 0.9 }), 0, 0.42, 0, this.avatarHeldTorch);
    this.avatarHeldTorch.rotation.set(0.05, 0, 0.2);

    this.avatarHeldArrow = makeHeldGroup();
    this.avatarHeldArrow.scale.setScalar(0.72);

    this.avatarHeldBlockMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.avatarHeldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), this.avatarHeldBlockMat);
    this.avatarHeldBlock.position.set(0, 0.08, -0.02);
    this.avatarHeldBlock.rotation.set(0.25, 0.55, 0.1);
    this.avatarHeldBlock.visible = false;
    heldRoot.add(this.avatarHeldBlock);
    this.avatarHeldGear = makeHeldGroup();
    this.avatarFireFx = buildEnchantedFlames(true);
    heldRoot.add(this.avatarFireFx);

    const makeShoes = (leg: THREE.Group) => {
      const variants = {} as Record<CharacterShoeType, THREE.Group>;
      const boot = new THREE.Group();
      addBox(0.24, 0.16, 0.28, shoeMat, 0, -0.62, -0.02, boot);
      addBox(0.26, 0.04, 0.31, shoeSole, 0, -0.715, -0.02, boot);
      variants.boots = boot;
      const sneakers = new THREE.Group();
      addBox(0.26, 0.13, 0.31, shoeMat, 0, -0.625, -0.035, sneakers);
      addBox(0.28, 0.04, 0.33, shoeSole, 0, -0.715, -0.035, sneakers);
      addBox(0.265, 0.045, 0.055, shoeAccent, 0, -0.62, -0.12, sneakers);
      variants.sneakers = sneakers;
      const sandals = new THREE.Group();
      addBox(0.25, 0.065, 0.31, shoeSole, 0, -0.685, -0.02, sandals);
      addBox(0.25, 0.045, 0.055, shoeMat, 0, -0.61, -0.12, sandals);
      addBox(0.25, 0.045, 0.055, shoeMat, 0, -0.61, 0.075, sandals);
      variants.sandals = sandals;
      for (const style of ['boots', 'sneakers', 'sandals'] as const) {
        variants[style].visible = style === customization.shoeType;
        leg.add(variants[style]);
      }
      this.avatarShoeVariants.push(variants);
    };

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.15, 0.7, 0);
    this.avatarLegPants.push(addBox(0.22, 0.62, 0.22, pants, 0, -0.25, 0, leftLeg));
    makeShoes(leftLeg);
    g.add(leftLeg);
    this.avatarLeftLeg = leftLeg;

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.15, 0.7, 0);
    this.avatarLegPants.push(addBox(0.22, 0.62, 0.22, pants, 0, -0.25, 0, rightLeg));
    makeShoes(rightLeg);
    g.add(rightLeg);
    this.avatarRightLeg = rightLeg;

    this.avatarSkirt = buildCharacterSkirt(skirt, skirtAccent);
    this.avatarSkirt.visible = customization.gender === 'girl';
    g.add(this.avatarSkirt);

    g.visible = false;
    this.avatarFadeMats = [];
    const avatarMats = new Set<THREE.Material>();
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      const mat = mesh.material;
      if (!mat) return;
      if (Array.isArray(mat)) mat.forEach((m) => avatarMats.add(m));
      else avatarMats.add(mat);
    });
    avatarMats.forEach((material) => {
      this.avatarFadeMats.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
    });
    this.scene.add(g);
    this.playerAvatar = g;
    this.firstPersonParrotArm = leftArm.clone(true);
    this.firstPersonParrotArm.name = 'first-person-parrot-arm';
    this.firstPersonParrotArm.visible = false;
    this.firstPersonParrotArm.frustumCulled = false;
    this.scene.add(this.firstPersonParrotArm);
    this.applyCharacterCustomization();
  }

  /** Build the equipped pieces as voxel plates attached to the animated body parts. */
  private buildEquippedArmor(item: Item): AvatarArmorAttachment[] {
    const attachments: AvatarArmorAttachment[] = [];
    const girl = this.characterCustomization.gender === 'girl';
    // For girls, leggings tint the skirt itself rather than replacing its silhouette with trousers.
    if (girl && item.slot === 'legs') return attachments;
    const color = new THREE.Color(gearColor(item));
    const palette = {
      main: createArmorSurfaceMaterial(item, color),
      shade: new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.58) }),
      highlight: new THREE.MeshLambertMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.34) }),
      trim: new THREE.MeshLambertMaterial({ color: '#30363a' }),
    };
    const makeGroup = (name: string) => {
      const group = new THREE.Group();
      group.name = `avatar-armor-${item.slot}-${name}`;
      return group;
    };
    const box = (
      group: THREE.Object3D,
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      rotateZ = 0,
    ) => {
      const mesh = addCharacterBox(group, width, height, depth, material, x, y, z);
      if (rotateZ) mesh.rotation.z = rotateZ;
      return mesh;
    };
    const attach = (parent: THREE.Object3D | null, group: THREE.Group) => {
      if (parent) attachments.push({ parent, group });
    };

    switch (item.slot) {
      case 'head': {
        const helmet = makeGroup('helmet');
        // Crown and cheek plates frame the head without covering its front plane: the
        // character creator's face texture (expression and glasses included) stays intact.
        box(helmet, 0.46, 0.13, 0.45, palette.main, 0, 0.225, 0.015);
        box(helmet, 0.35, 0.045, 0.34, palette.highlight, 0, 0.305, 0.025);
        box(helmet, 0.085, 0.2, 0.37, palette.shade, -0.19, 0.015, 0.025);
        box(helmet, 0.085, 0.2, 0.37, palette.shade, 0.19, 0.015, 0.025);
        // Close the whole rear of the helmet with a single base-color shell, then
        // layer a contrasting inset, ridge and trim on top. This prevents bare scalp
        // from showing through between the crown, side plates and old neck guard.
        box(helmet, 0.47, 0.4, 0.07, palette.main, 0, 0, 0.23);
        box(helmet, 0.33, 0.24, 0.025, palette.shade, 0, 0.005, 0.285);
        box(helmet, 0.36, 0.04, 0.03, palette.highlight, 0, 0.16, 0.285);
        box(helmet, 0.045, 0.19, 0.03, palette.highlight, 0, 0.005, 0.285);
        box(helmet, 0.36, 0.04, 0.03, palette.trim, 0, -0.16, 0.285);
        // The brow/visor projects over the forehead (-Z), so the facing stays clear.
        box(helmet, 0.26, 0.045, 0.09, palette.highlight, 0, 0.18, -0.175);
        box(helmet, 0.1, 0.045, 0.12, palette.trim, 0, 0.325, 0.015);
        attach(this.avatarHead, helmet);
        break;
      }
      case 'chest': {
        const chest = makeGroup('chestplate');
        const width = girl ? 0.52 : 0.61;
        box(chest, width, 0.67, 0.34, palette.main, 0, 1.03, 0);
        box(chest, width * 0.7, 0.4, 0.055, palette.highlight, 0, 1.04, -0.2);
        box(chest, 0.085, 0.43, 0.065, palette.main, 0, 1.03, -0.24);
        box(chest, width * 0.9, 0.075, 0.36, palette.shade, 0, 0.69, 0);
        box(chest, 0.2, 0.065, 0.075, palette.trim, 0, 1.38, -0.16);
        for (const side of [-1, 1]) {
          box(chest, 0.2, 0.17, 0.34, palette.main, side * (width * 0.48), 1.32, 0);
          box(chest, 0.055, 0.12, 0.35, palette.highlight, side * (width * 0.48), 1.33, -0.01);
        }
        attach(this.playerAvatar, chest);
        break;
      }
      case 'legs': {
        const waist = makeGroup('waist');
        box(waist, girl ? 0.43 : 0.5, 0.1, 0.31, palette.shade, 0, 0.7, 0);
        box(waist, girl ? 0.4 : 0.47, 0.045, 0.33, palette.main, 0, 0.73, 0);
        box(waist, 0.09, 0.06, 0.035, palette.highlight, 0, 0.72, -0.17);
        attach(this.playerAvatar, waist);

        const legWidth = girl ? 0.205 : 0.25;
        for (const leg of [this.avatarLeftLeg, this.avatarRightLeg]) {
          if (!leg) continue;
          const greave = makeGroup('greave');
          box(greave, legWidth, 0.5, 0.255, palette.main, 0, -0.26, 0);
          box(greave, legWidth * 0.72, 0.15, 0.055, palette.highlight, 0, -0.2, -0.155);
          box(greave, legWidth * 0.9, 0.055, 0.27, palette.shade, 0, -0.015, 0);
          box(greave, legWidth * 0.92, 0.04, 0.27, palette.trim, 0, -0.49, 0);
          attach(leg, greave);
        }
        break;
      }
      case 'feet': {
        const bootWidth = girl ? 0.27 : 0.3;
        for (const leg of [this.avatarLeftLeg, this.avatarRightLeg]) {
          if (!leg) continue;
          const boot = makeGroup('armored-boot');
          box(boot, bootWidth, 0.21, 0.36, palette.main, 0, -0.635, -0.025);
          box(boot, bootWidth * 0.76, 0.1, 0.065, palette.highlight, 0, -0.62, -0.19);
          box(boot, bootWidth * 1.04, 0.045, 0.37, palette.trim, 0, -0.735, -0.025);
          box(boot, bootWidth * 0.92, 0.09, 0.28, palette.shade, 0, -0.49, 0.005);
          attach(leg, boot);
        }
        break;
      }
      case 'hands': {
        for (const arm of [this.avatarLeftArm, this.avatarRightArm]) {
          if (!arm) continue;
          const glove = makeGroup('gauntlet');
          box(glove, 0.225, 0.2, 0.245, palette.main, 0, -0.68, -0.005);
          box(glove, 0.235, 0.105, 0.26, palette.shade, 0, -0.515, 0);
          box(glove, 0.17, 0.075, 0.045, palette.highlight, 0, -0.69, -0.15);
          box(glove, 0.025, 0.11, 0.035, palette.trim, 0, -0.69, -0.177);
          attach(arm, glove);
        }
        break;
      }
      case 'offhand': {
        const shield = makeGroup('shield');
        const size = girl ? 0.94 : 1;
        const x = -0.1;
        const y = -0.48;
        const z = -0.17;
        box(shield, 0.32 * size, 0.4 * size, 0.06, palette.trim, x, y, z);
        box(shield, 0.275 * size, 0.35 * size, 0.075, palette.main, x, y, z - 0.035);
        box(shield, 0.245 * size, 0.045, 0.025, palette.highlight, x, y + 0.135 * size, z - 0.08);
        box(shield, 0.04, 0.23 * size, 0.03, palette.shade, x, y, z - 0.082);
        const crest = box(shield, 0.095 * size, 0.095 * size, 0.035, palette.highlight, x, y, z - 0.1);
        crest.rotation.z = Math.PI / 4;
        box(shield, 0.095 * size, 0.07, 0.045, palette.main, x, y - 0.17 * size, z - 0.025, 0.22);
        attach(this.avatarLeftArm, shield);
        break;
      }
    }
    return attachments;
  }

  /** Replace the worn meshes after equipment or character customization changes. */
  private syncAvatarArmor() {
    if (!this.avatarHead || !this.avatarLeftArm || !this.avatarRightArm || !this.avatarLeftLeg || !this.avatarRightLeg) return;

    for (const slot of SLOTS) {
      for (const attachment of this.avatarArmorModels[slot] ?? []) {
        attachment.parent.remove(attachment.group);
        disposeObject(attachment.group);
      }
      delete this.avatarArmorModels[slot];
      delete this.avatarArmorFadeMats[slot];
    }

    const helmetWorn = !!this.equipped.head;
    for (const [style, group] of Object.entries(this.avatarHairVariants) as Array<[CharacterHairstyle, THREE.Group]>) {
      group.visible = !helmetWorn && style === this.characterCustomization.hairstyle;
    }
    for (const [style, group] of Object.entries(this.avatarHelmetHairVariants) as Array<[CharacterHairstyle, THREE.Group]>) {
      group.visible = helmetWorn && style === this.characterCustomization.hairstyle;
    }
    const girl = this.characterCustomization.gender === 'girl';
    if (this.avatarSkirt) this.avatarSkirt.visible = girl;
    if (this.avatarAppearance) {
      const skirtArmor = girl ? this.equipped.legs : undefined;
      if (skirtArmor) {
        const armorColor = new THREE.Color(gearColor(skirtArmor));
        setArmorSurfaceTexture(this.avatarAppearance.skirt, skirtArmor, armorColor);
        setArmorSurfaceTexture(this.avatarAppearance.skirtAccent, skirtArmor, armorColor.clone().multiplyScalar(0.7));
      } else {
        const pantsColor = this.characterCustomization.pantsColor;
        resetArmorSurfaceTexture(this.avatarAppearance.skirt, pantsColor);
        resetArmorSurfaceTexture(this.avatarAppearance.skirtAccent, new THREE.Color(pantsColor).multiplyScalar(0.7));
      }
    }

    for (const slot of SLOTS) {
      const item = this.equipped[slot];
      if (!item) continue;
      const attachments = this.buildEquippedArmor(item);
      if (!attachments.length) continue;
      const materials = new Set<THREE.Material>();
      for (const attachment of attachments) {
        attachment.parent.add(attachment.group);
        attachment.group.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (Array.isArray(mesh.material)) mesh.material.forEach((material) => materials.add(material));
          else materials.add(mesh.material);
        });
      }
      this.avatarArmorModels[slot] = attachments;
      this.avatarArmorFadeMats[slot] = [...materials].map((material) => ({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      }));
    }
    this.setPlayerAvatarOpacity(this.avatarOpacity);
  }

  /** Slot-specific physical model used both for mob loot and armor thrown from the hotbar. */
  private buildArmorDropModel(item: Item): THREE.Group {
    const group = new THREE.Group();
    group.name = `dropped-armor-${item.slot}-${item.material}`;
    const color = new THREE.Color(gearColor(item));
    const main = createArmorSurfaceMaterial(item, color);
    const shade = new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.58) });
    const highlight = new THREE.MeshLambertMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.34) });
    const trim = new THREE.MeshLambertMaterial({ color: '#30363a' });
    const box = (
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      rotateZ = 0,
    ) => {
      const mesh = addCharacterBox(group, width, height, depth, material, x, y, z);
      if (rotateZ) mesh.rotation.z = rotateZ;
      return mesh;
    };

    switch (item.slot) {
      case 'head':
        box(0.42, 0.14, 0.42, main, 0, 0.1, 0.015);
        box(0.33, 0.055, 0.33, highlight, 0, 0.19, 0.025);
        box(0.08, 0.21, 0.34, shade, -0.17, -0.015, 0.02);
        box(0.08, 0.21, 0.34, shade, 0.17, -0.015, 0.02);
        box(0.26, 0.045, 0.09, highlight, 0, 0.055, -0.19);
        box(0.46, 0.36, 0.07, main, 0, 0, 0.23);
        box(0.32, 0.22, 0.025, shade, 0, 0, 0.285);
        box(0.35, 0.04, 0.03, highlight, 0, 0.14, 0.285);
        box(0.045, 0.18, 0.03, highlight, 0, 0, 0.285);
        box(0.35, 0.035, 0.03, trim, 0, -0.15, 0.285);
        box(0.11, 0.045, 0.13, trim, 0, 0.215, 0.015);
        break;
      case 'chest':
        box(0.43, 0.47, 0.23, main, 0, 0, 0);
        box(0.2, 0.13, 0.26, main, -0.29, 0.15, 0);
        box(0.2, 0.13, 0.26, main, 0.29, 0.15, 0);
        box(0.29, 0.29, 0.045, highlight, 0, 0.015, -0.14);
        box(0.065, 0.3, 0.05, shade, 0, 0.015, -0.18);
        box(0.43, 0.055, 0.24, shade, 0, -0.22, 0);
        box(0.16, 0.04, 0.035, trim, 0, 0.25, -0.12);
        break;
      case 'legs':
        box(0.42, 0.075, 0.24, shade, 0, 0.18, 0);
        box(0.15, 0.37, 0.22, main, -0.115, -0.035, 0);
        box(0.15, 0.37, 0.22, main, 0.115, -0.035, 0);
        box(0.11, 0.13, 0.045, highlight, -0.115, -0.03, -0.13);
        box(0.11, 0.13, 0.045, highlight, 0.115, -0.03, -0.13);
        box(0.42, 0.04, 0.25, trim, 0, -0.22, 0);
        break;
      case 'feet':
        box(0.18, 0.22, 0.32, main, -0.12, -0.015, -0.025);
        box(0.18, 0.22, 0.32, main, 0.12, -0.015, -0.025);
        box(0.15, 0.09, 0.055, highlight, -0.12, 0.005, -0.19);
        box(0.15, 0.09, 0.055, highlight, 0.12, 0.005, -0.19);
        box(0.19, 0.04, 0.33, trim, -0.12, -0.14, -0.025);
        box(0.19, 0.04, 0.33, trim, 0.12, -0.14, -0.025);
        break;
      case 'hands':
        box(0.16, 0.19, 0.19, main, -0.13, 0, 0);
        box(0.16, 0.19, 0.19, main, 0.13, 0, 0);
        box(0.18, 0.08, 0.2, shade, -0.13, 0.13, 0);
        box(0.18, 0.08, 0.2, shade, 0.13, 0.13, 0);
        box(0.12, 0.06, 0.035, highlight, -0.13, -0.005, -0.115);
        box(0.12, 0.06, 0.035, highlight, 0.13, -0.005, -0.115);
        break;
      case 'offhand': {
        box(0.36, 0.46, 0.055, trim, 0, 0, 0);
        box(0.31, 0.41, 0.07, main, 0, 0, -0.035);
        box(0.26, 0.045, 0.025, highlight, 0, 0.16, -0.08);
        box(0.045, 0.27, 0.03, shade, 0, 0, -0.08);
        const crest = box(0.1, 0.1, 0.035, highlight, 0, 0, -0.1);
        crest.rotation.z = Math.PI / 4;
        box(0.12, 0.08, 0.045, main, 0, -0.2, -0.025, 0.22);
        break;
      }
    }

    group.rotation.set(0.2, 0, -0.12);
    return group;
  }

  private buildFirstPersonGlove(item: Item): THREE.Group {
    const group = new THREE.Group();
    group.name = 'first-person-equipped-gauntlet';
    const color = new THREE.Color(gearColor(item));
    const main = createArmorSurfaceMaterial(item, color);
    const shade = new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.58) });
    const highlight = new THREE.MeshLambertMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), 0.34) });
    const trim = new THREE.MeshLambertMaterial({ color: '#30363a' });
    const box: ArmorBoxBuilder = (width, height, depth, material, x, y, z, rotateZ = 0) => {
      const mesh = addCharacterBox(group, width, height, depth, material, x, y, z);
      if (rotateZ) mesh.rotation.z = rotateZ;
      return mesh;
    };

    box(0.24, 0.36, 0.22, shade, 0, -0.22, 0.08);
    box(0.29, 0.12, 0.28, trim, 0, -0.045, 0.08);
    box(0.27, 0.24, 0.29, main, 0, 0.12, -0.03);
    box(0.21, 0.09, 0.06, highlight, 0, 0.17, -0.19);
    for (const x of [-0.09, -0.03, 0.03, 0.09]) {
      box(0.035, 0.105, 0.045, shade, x, 0.045, -0.18);
    }
    box(0.095, 0.14, 0.14, main, -0.145, 0.1, -0.015, -0.42);
    box(0.035, 0.25, 0.05, highlight, 0.11, -0.19, -0.035);
    box(0.22, 0.035, 0.035, trim, 0, -0.105, -0.08);
    return group;
  }

  private applyCharacterCustomization() {
    const appearance = this.avatarAppearance;
    if (!appearance) return;
    const customization = this.characterCustomization;
    appearance.skin.color.set(customization.skinColor);
    appearance.shirt.color.set(customization.shirtColor);
    appearance.shirtDark.color.copy(appearance.shirt.color).multiplyScalar(0.68);
    appearance.pants.color.set(customization.gender === 'girl' ? customization.skinColor : customization.pantsColor);
    appearance.skirt.color.set(customization.pantsColor);
    appearance.skirtAccent.color.copy(appearance.skirt.color).multiplyScalar(0.7);
    appearance.shoes.color.set(customization.shoeColor);
    appearance.hair.color.set(customization.hairColor);
    appearance.shoeSole.color.set(customization.shoeType === 'sneakers' ? '#f1f2ed' : '#202124');
    appearance.shoeAccent.color.set(customization.shoeType === 'sneakers' ? '#f1f2ed' : customization.shoeColor);

    const girl = customization.gender === 'girl';
    if (this.avatarSkirt) this.avatarSkirt.visible = girl;
    if (this.avatarTorso) this.avatarTorso.scale.x = girl ? 0.82 : 1.04;
    if (this.avatarTorsoTrim) this.avatarTorsoTrim.scale.x = girl ? 0.82 : 1.04;
    if (this.avatarLeftArm) this.avatarLeftArm.position.x = girl ? -0.37 : -0.43;
    if (this.avatarRightArm) this.avatarRightArm.position.x = girl ? 0.37 : 0.43;
    if (this.avatarLeftLeg) this.avatarLeftLeg.position.x = girl ? -0.14 : -0.15;
    if (this.avatarRightLeg) this.avatarRightLeg.position.x = girl ? 0.14 : 0.15;
    for (const pants of this.avatarLegPants) pants.scale.x = girl ? 0.78 : 1;
    for (const variants of this.avatarShoeVariants) {
      for (const [style, group] of Object.entries(variants) as Array<[CharacterShoeType, THREE.Group]>) {
        group.visible = style === customization.shoeType;
      }
    }
    const helmetWorn = !!this.equipped.head;
    for (const [style, group] of Object.entries(this.avatarHairVariants) as Array<[CharacterHairstyle, THREE.Group]>) {
      group.visible = !helmetWorn && style === customization.hairstyle;
    }
    for (const [style, group] of Object.entries(this.avatarHelmetHairVariants) as Array<[CharacterHairstyle, THREE.Group]>) {
      group.visible = helmetWorn && style === customization.hairstyle;
    }
    if (this.avatarFaceContext) drawCharacterFace(this.avatarFaceContext, customization.expression, customization.glasses);
    if (this.avatarFaceTexture) this.avatarFaceTexture.needsUpdate = true;
    this.syncAvatarArmor();
  }

  /** swap the first-person model to match the selected hotbar slot */
  private syncViewModel() {
    if (!this.toolPick) return;
    const kind = this.heldKind();
    const heldId = this.hotbar[this.selected];
    const craftedSpec = heldId === undefined ? null : getToolSpec(heldId);
    const holdingCraftedTool = !!craftedSpec;
    if (craftedSpec && heldId !== undefined) {
      const durability = this.heldToolDurability(heldId);
      const wear = toolWearRatio(durability, craftedSpec.maxDurability);
      const wearStep = Math.round(wear * 24);
      const signature = `${heldId}:${wearStep}`;
      if (signature !== this.craftedToolKey) {
        this.clearToolModel(this.toolCrafted);
        this.toolCrafted.add(this.buildToolModel(heldId, wearStep / 24));
        this.craftedToolKey = signature;
      }
      // Lean the business end slightly away from the forearm and into the world;
      // the grip stays near the hand while the head/blade no longer lies along the arm.
      this.toolCrafted.position.set(0.02, -0.03, -0.035);
      // Keep the pick's successful size, but give the shovel and the other
      // long-handled tools enough breathing room in the lower-right hand area.
      const viewScale =
        craftedSpec.kind === 'shovel' ? 0.68 :
        craftedSpec.kind === 'hoe' ? 0.78 :
        craftedSpec.kind === 'axe' ? 0.84 :
        craftedSpec.kind === 'sword' ? 0.82 : 0.92;
      this.toolCrafted.scale.setScalar(viewScale);
      if (craftedSpec.kind === 'pickaxe') this.toolCrafted.rotation.set(-0.17, -0.95, 0.48);
      else if (craftedSpec.kind === 'axe') this.toolCrafted.rotation.set(-0.34, -1.45, 0.34);
      else if (craftedSpec.kind === 'shovel') this.toolCrafted.rotation.set(-0.35, -0.78, 0.32);
      else if (craftedSpec.kind === 'hoe') this.toolCrafted.rotation.set(-0.36, -1.28, 0.38);
      // Present the sword diagonally with its grip close to the hand and the
      // blade leaning into the scene, not flat against the forearm.
      else if (craftedSpec.kind === 'sword') this.toolCrafted.rotation.set(-0.34, -0.68, 0.46);
      else this.toolCrafted.rotation.set(-0.36, 0.15, 0.28);
      // Keep the earlier pickaxe view-model pose; only roll the other long-handled tools.
      if (
        craftedSpec.kind === 'axe' ||
        craftedSpec.kind === 'shovel' ||
        craftedSpec.kind === 'hoe'
      ) {
        this.toolCrafted.rotateY(-Math.PI / 2);
      }
    }
    const holdingLanternBlock = kind === 'block' && heldId === TORCH;
    const isCandidateItem =
      kind === 'block' && heldId !== undefined && !holdingLanternBlock && !BLOCKS[heldId]?.solid;
    if (isCandidateItem && heldId !== undefined && heldId !== this.itemShown) {
      this.itemShown = heldId;
      this.clearToolModel(this.toolItem);
      const fancy = this.buildFancyDrop(heldId);
      if (fancy) {
        this.toolItem.add(fancy);
        this.itemHasFancy = true;
      } else {
        this.itemHasFancy = false;
      }
    }
    const holdingFancyItem = isCandidateItem && this.itemHasFancy;
    if (holdingFancyItem && heldId !== undefined) {
      if (isArrowId(heldId)) {
        // The arrow crosses the hand diagonally, point forward and up instead of reading as a tiny cube.
        this.toolItem.position.set(0.02, -0.02, 0.02);
        this.toolItem.rotation.set(-0.65, 0.5, 0.15);
        this.toolItem.scale.setScalar(0.9);
      } else {
        this.toolItem.position.set(0.02, 0.04, 0.02);
        this.toolItem.rotation.set(0.18, 0.55, 0.08);
        this.toolItem.scale.setScalar(1.38);
      }
    }

    this.toolCrafted.visible = holdingCraftedTool;
    this.toolPick.visible = kind === 'pick' && !holdingCraftedTool;
    this.toolHand.visible = kind === 'fist';
    this.toolSword.visible = kind === 'sword' && !holdingCraftedTool;
    this.toolBlock.visible = kind === 'block' && !holdingLanternBlock && !holdingFancyItem;
    this.toolItem.visible = holdingFancyItem;
    this.toolLantern.visible = holdingLanternBlock;
    this.toolTorch.visible = kind === 'torch';
    this.toolAxe.visible = kind === 'axe' && !holdingCraftedTool;
    this.toolShovel.visible = kind === 'shovel' && !holdingCraftedTool;
    this.toolHoe.visible = kind === 'hoe' && !holdingCraftedTool;
    this.toolBow.visible = kind === 'bow' && !holdingCraftedTool;
    const heldGear = kind === 'gear' && heldId !== undefined
      ? this.bagItems.find((item) => item.hid === heldId)
      : undefined;
    this.toolGear.visible = !!heldGear;
    if (heldGear) {
      const signature = `${heldGear.uid}:${gearColor(heldGear)}:${heldGear.rarity}:${heldGear.affixes.map((affix) => `${affix.id}-${affix.value}`).join(',')}`;
      if (signature !== this.toolGearKey) {
        this.clearToolModel(this.toolGear);
        this.toolGear.add(this.buildArmorDropModel(heldGear));
        this.toolGearKey = signature;
      }
      animateArmorVisuals(this.toolGear, this.time);
    }

    const wornGlove = this.equipped.hands;
    const showFirstPersonGlove = !!wornGlove && !this.thirdPerson && (this.phase === 'playing' || this.phase === 'paused');
    this.firstPersonGlove.visible = showFirstPersonGlove;
    if (wornGlove) {
      const signature = `${wornGlove.uid}:${gearColor(wornGlove)}:${wornGlove.rarity}:${wornGlove.affixes.map((affix) => `${affix.id}-${affix.value}`).join(',')}`;
      if (signature !== this.firstPersonGloveKey) {
        this.clearToolModel(this.firstPersonGlove);
        this.firstPersonGlove.add(this.buildFirstPersonGlove(wornGlove));
        this.firstPersonGloveKey = signature;
      }
      if (showFirstPersonGlove) animateArmorVisuals(this.firstPersonGlove, this.time);
    }
    if (kind === 'torch' || holdingLanternBlock) {
      // flame flicker + world light following the player
      const f = 0.85 + Math.sin(this.time * 11) * 0.12 + Math.sin(this.time * 23) * 0.06;
      if (kind === 'torch') {
        this.torchFlame.scale.set(f, 1.1 + (f - 0.85) * 1.6, f);
        this.torchFlameMat.opacity = 0.72 + f * 0.2;
      }
      this.torchLight.visible = true;
      this.torchLight.intensity = 3.1 + (1 - this.daylight) * 2.3;
      this.torchLight.distance = 15 + (1 - this.daylight) * 3;
      this.torchLight.position.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
      if (kind === 'torch' && Math.random() < 0.06) {
        this.burst(this.pos.x + (Math.random() - 0.5) * 0.3, this.pos.y + 1.75, this.pos.z + (Math.random() - 0.5) * 0.3, [255, 176, 58], 1, 0.7);
      }
    } else {
      this.torchLight.visible = false;
      this.torchLight.intensity = 0;
    }
    if (kind === 'sword' && this.swordMat) {
      this.swordMat.color.set(SWORDS[Math.max(0, this.heldSwordTier())].color);
    }
    if (kind === 'pick') {
      const c = PICKAXE_TIERS[this.heldPickTier()].color;
      this.pickHeadMats.forEach((m2) => m2.color.set(c));
    }
    if (kind === 'axe' && this.axeHeadMat && this.axeEdgeMat) {
      const tier = this.heldAxeTier();
      if (tier === 0) {
        this.axeHeadMat.color.set('#b8733d');
        this.axeEdgeMat.color.set('#c98a50');
      } else {
        this.axeHeadMat.color.set('#a8aeb4');
        this.axeEdgeMat.color.set('#d6d9dd');
      }
    }
    if (kind === 'hoe' && this.hoeHeadMat && this.hoeEdgeMat) {
      const spec = getToolSpec(this.hotbar[this.selected] ?? -1);
      if (spec?.tier === 0) {
        this.hoeHeadMat.color.set('#b8733d');
        this.hoeEdgeMat.color.set('#c98a50');
      } else {
        this.hoeHeadMat.color.set('#a8aeb4');
        this.hoeEdgeMat.color.set('#d6d9dd');
      }
    }
    if (kind === 'block') {
      const id = this.hotbar[this.selected];
      if (id !== undefined && id !== this.blockShown) {
        this.blockShown = id;
        const def = BLOCKS[id];
        const uv = this.toolBlock.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const base = this.blockUVBase;
        for (let f = 0; f < 6; f++) {
          const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
          const [u0, v0, u1, v1] = tileUV(tile);
          for (let i = 0; i < 4; i++) {
            const idx = f * 4 + i;
            uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
          }
        }
        uv.needsUpdate = true;
      }
    }
    if (this.viewFireFx) {
      this.viewFireFx.visible = this.stats.fire > 0;
      animateEnchantedFlames(this.viewFireFx, this.time);
    }
    this.syncThirdPersonHeldItem();
  }

  /** Solve each held model's local transform so its grip lands at the right palm center. */
  private positionAvatarHeldItemAtGrip(item: THREE.Object3D, gripX: number, gripY: number, gripZ: number) {
    this.avatarHeldRootInverseScratch.copy(this.avatarHeldRoot.quaternion).invert();
    this.avatarHeldItemPalmScratch
      .set(0, -0.68, 0)
      .sub(this.avatarHeldRoot.position)
      .applyQuaternion(this.avatarHeldRootInverseScratch);
    this.avatarHeldItemGripScratch
      .set(gripX, gripY, gripZ)
      .multiply(item.scale)
      .applyQuaternion(item.quaternion);
    item.position.copy(this.avatarHeldItemPalmScratch).sub(this.avatarHeldItemGripScratch);
  }

  private syncThirdPersonHeldItem() {
    if (!this.avatarHeldRoot) return;
    const all = [
      this.avatarHeldPick,
      this.avatarHeldAxe,
      this.avatarHeldSword,
      this.avatarHeldShovel,
      this.avatarHeldHoe,
      this.avatarHeldBow,
      this.avatarHeldTorch,
    ];
    for (const g of all) if (g) g.visible = false;
    if (this.avatarHeldTool) this.avatarHeldTool.visible = false;
    if (this.avatarHeldArrow) this.avatarHeldArrow.visible = false;
    if (this.avatarHeldBlock) this.avatarHeldBlock.visible = false;
    if (this.avatarHeldGear) this.avatarHeldGear.visible = false;
    const kind = this.heldKind();
    const heldId = this.hotbar[this.selected];
    const craftedSpec = heldId === undefined ? null : getToolSpec(heldId);
    if (craftedSpec && heldId !== undefined) {
      const durability = this.heldToolDurability(heldId);
      const wear = toolWearRatio(durability, craftedSpec.maxDurability);
      const wearStep = Math.round(wear * 24);
      const signature = `${heldId}:${wearStep}`;
      if (signature !== this.avatarHeldToolKey) {
        this.clearToolModel(this.avatarHeldTool);
        this.avatarHeldTool.add(this.buildToolModel(heldId, wearStep / 24));
        this.avatarHeldToolKey = signature;
      }
      this.avatarHeldTool.scale.setScalar(0.72);
      if (craftedSpec.kind === 'pickaxe') {
        // Keep the haft 45° forward/up while the mirrored head tips point out toward the block.
        this.avatarHeldTool.rotation.set(-0.05, -0.09, 0.175);
      } else if (craftedSpec.kind === 'axe') this.avatarHeldTool.rotation.set(0.65, -1.15, 0.32);
      else if (craftedSpec.kind === 'hoe') this.avatarHeldTool.rotation.set(0.65, -1.08, 0.32);
      else if (craftedSpec.kind === 'shovel') this.avatarHeldTool.rotation.set(0.58, -0.65, 0.32);
      // The sword grip is at y=-0.24 in its model; keep the blade leaning forward.
      else if (craftedSpec.kind === 'sword') this.avatarHeldTool.rotation.set(0.38, -0.05, 0.32);
      else this.avatarHeldTool.rotation.set(0.33, 0.05, 0.32);

      // Local haft-axis rolls keep the pick tips and tool edges aimed outward from the avatar.
      if (
        craftedSpec.kind === 'pickaxe' ||
        craftedSpec.kind === 'axe' ||
        craftedSpec.kind === 'hoe'
      ) {
        this.avatarHeldTool.rotateY(Math.PI / 2);
      } else if (craftedSpec.kind === 'shovel') {
        this.avatarHeldTool.rotateY(-Math.PI / 2);
      }
      const gripX = craftedSpec.kind === 'sword' ? 0 : craftedSpec.kind === 'bow' ? -0.2 : -0.025;
      const gripY = craftedSpec.kind === 'sword' ? -0.22 : craftedSpec.kind === 'bow' ? 0.02 : -0.25;
      const gripZ = craftedSpec.kind === 'bow' ? 0.02 : 0;
      this.positionAvatarHeldItemAtGrip(this.avatarHeldTool, gripX, gripY, gripZ);
      this.avatarHeldTool.visible = true;
      return;
    }
    if (kind === 'pick') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldPick, 0, -0.02, 0);
      this.avatarHeldPick.visible = true;
      const c = PICKAXE_TIERS[this.heldPickTier()].color;
      this.avatarHeldPickMats.forEach((m) => m.color.set(c));
    } else if (kind === 'axe') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldAxe, 0, 0, 0);
      this.avatarHeldAxe.visible = true;
      const tier = this.heldAxeTier();
      if (tier === 0) {
        this.avatarHeldAxeHeadMat.color.set('#b98a4d');
        this.avatarHeldAxeEdgeMat.color.set('#c09a61');
      } else {
        this.avatarHeldAxeHeadMat.color.set('#a8aeb4');
        this.avatarHeldAxeEdgeMat.color.set('#d6d9dd');
      }
    } else if (kind === 'sword') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldSword, 0, -0.22, 0);
      this.avatarHeldSword.visible = true;
      this.avatarHeldSwordMat.color.set(SWORDS[Math.max(0, this.heldSwordTier())].color);
    } else if (kind === 'shovel') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldShovel, 0, 0, 0);
      this.avatarHeldShovel.visible = true;
    } else if (kind === 'hoe') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldHoe, 0, 0, 0);
      this.avatarHeldHoe.visible = true;
      const spec = getToolSpec(heldId ?? -1);
      if (spec?.tier === 0) {
        this.avatarHeldHoeHeadMat.color.set('#b8733d');
        this.avatarHeldHoeEdgeMat.color.set('#c98a50');
      } else {
        this.avatarHeldHoeHeadMat.color.set('#a8aeb4');
        this.avatarHeldHoeEdgeMat.color.set('#d6d9dd');
      }
    } else if (kind === 'bow') {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldBow, 0.05, 0, 0);
      this.avatarHeldBow.visible = true;
    } else if (kind === 'torch' || heldId === TORCH) {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldTorch, 0, 0, 0);
      this.avatarHeldTorch.visible = true;
    } else if (kind === 'block' && heldId !== undefined && isArrowId(heldId)) {
      const signature = String(heldId);
      if (signature !== this.avatarHeldArrowKey) {
        this.clearToolModel(this.avatarHeldArrow);
        this.avatarHeldArrow.add(buildArrowModel(heldId));
        this.avatarHeldArrowKey = signature;
      }
      this.avatarHeldArrow.scale.setScalar(0.72);
      this.avatarHeldArrow.rotation.set(0.72, Math.PI, 0.04);
      this.positionAvatarHeldItemAtGrip(this.avatarHeldArrow, 0, 0, 0);
      this.avatarHeldArrow.visible = true;
    } else if (kind === 'gear' && heldId !== undefined) {
      const item = this.bagItems.find((gear) => gear.hid === heldId);
      if (!item) return;
      const signature = `${item.uid}:${gearColor(item)}:${item.rarity}:${item.affixes.map((affix) => `${affix.id}-${affix.value}`).join(',')}`;
      if (signature !== this.avatarHeldGearKey) {
        this.clearToolModel(this.avatarHeldGear);
        this.avatarHeldGear.add(this.buildArmorDropModel(item));
        this.avatarHeldGearKey = signature;
      }
      this.avatarHeldGear.scale.setScalar(0.78);
      this.avatarHeldGear.rotation.set(0.22, -0.12, 0.28);
      this.positionAvatarHeldItemAtGrip(this.avatarHeldGear, 0, 0, 0);
      this.avatarHeldGear.visible = true;
      animateArmorVisuals(this.avatarHeldGear, this.time);
    } else if (kind === 'block' && heldId !== undefined) {
      this.positionAvatarHeldItemAtGrip(this.avatarHeldBlock, 0, 0, 0);
      this.avatarHeldBlock.visible = true;
      const tint = BLOCKS[heldId]?.tint ?? [210, 210, 210];
      this.avatarHeldBlockMat.color.setRGB(tint[0] / 255, tint[1] / 255, tint[2] / 255, THREE.SRGBColorSpace);
    }
  }

  private buildFxLayer() {
    this.fx = document.createElement('div');
    this.fx.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:5;';
    this.sunGlare = document.createElement('div');
    this.sunGlare.style.cssText =
      'position:absolute;inset:-14%;pointer-events:none;opacity:0;transition:opacity 70ms linear;mix-blend-mode:screen;background:radial-gradient(circle at 50% 50%, rgba(255,255,235,.82) 0%, rgba(255,224,90,.36) 7%, rgba(255,178,42,.12) 19%, rgba(255,190,30,0) 38%),linear-gradient(90deg, rgba(255,230,110,0) 0%, rgba(255,230,110,.24) 48%, rgba(255,248,196,.36) 50%, rgba(255,230,110,.24) 52%, rgba(255,230,110,0) 100%),linear-gradient(0deg, rgba(255,230,110,0) 0%, rgba(255,230,110,.11) 49%, rgba(255,248,196,.22) 50%, rgba(255,230,110,.11) 51%, rgba(255,230,110,0) 100%);';
    this.fx.appendChild(this.sunGlare);
    this.container.appendChild(this.fx);
    for (let i = 0; i < 16; i++) this.createPopup();
    this.popupOverlay = document.createElement('div');
    this.popupOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:21;';
    this.container.appendChild(this.popupOverlay);
  }

  private createPopup(): Popup {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:0;top:0;will-change:transform,opacity;font-family:var(--font-display);font-weight:700;white-space:nowrap;text-shadow:2px 2px 0 rgba(0,0,0,.75);opacity:0;transform:translate3d(-999px,-999px,0);';
    this.fx.appendChild(el);
    const popup: Popup = {
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      life: 0,
      max: 1,
      text: '',
      color: '#fff',
      big: false,
      anchor: 'world',
      screenRise: 0,
      screenRiseTarget: 0,
      screenRiseSpeed: 0,
      el,
    };
    this.popups.push(popup);
    return popup;
  }

  // ================= WORLD GEN QUEUE =================
  private menuClockForMode() {
    return this.survival ? MENU_SURVIVAL_CLOCK : MENU_EXPLORER_CLOCK;
  }

  private setMenuClockForMode() {
    this.clock = this.menuClockForMode();
    this.updateClock(0);
    this.wasNight = this.isNightClock();
  }

  private queueWorldGen(seed: number, dynamicMenu = false) {
    this.loadTasks = [];
    this.menuWorldStreaming = false;
    this.menuWorldStarterSeeded = false;
    this.dirtyChunks.clear();
    this.dirtyMeshJob = null;
    this.activeStreamJob = null;
    this.activeStreamKey = null;
    this.loadProgress = 0;
    this.weatherKind = 'clear';
    this.weatherTargetKind = 'clear';
    this.weatherIntensity = 0;
    this.weatherTargetIntensity = 0;
    this.weatherTimer = 6;
    this.weatherSpawnAcc = 0;
    this.visualClimateReady = false;
    seedNoise(seed);
    this.chestInventories.clear();
    this.chestBonusGear.clear();
    this.activeChest = null;
    this.world.reset(seed);
    this.rand = mulberry32(seed);
    this.setMenuClockForMode();
    const c0x = Math.floor(ORIGIN_X / CHUNK);
    const c0z = Math.floor(ORIGIN_Z / CHUNK);
    if (dynamicMenu) {
      // Keep the menu interactive and draw the camera-facing surface before returning from the
      // Generate World click. This is only a shallow 3×3 preview; caves and distant chunks stream later.
      const x = ORIGIN_X + 0.5;
      const z = ORIGIN_Z + 0.5;
      this.pos.set(x, this.world.heightAt(ORIGIN_X, ORIGIN_Z) + 1.02, z);
      this.spawnX = x;
      this.spawnY = this.pos.y;
      this.spawnZ = z;
      this.yaw = this.world.spawnYawFor(x, z);
      this.pitch = -0.14;
      this.meshBandKey = this.meshBandForPlayer().key;
      this.loadTotal = 0;
      this.loadProgress = 1;
      this.phase = 'menu';
      this.menuWorldStreaming = true;

      const previewRadius = 1;
      const menuOrbitRadius = 34 + Math.sin(this.menuAngle * 0.45) * 8;
      const previewCenterX = Math.floor((ORIGIN_X + Math.cos(this.menuAngle) * menuOrbitRadius * 0.5) / CHUNK);
      const previewCenterZ = Math.floor((ORIGIN_Z + Math.sin(this.menuAngle) * menuOrbitRadius * 0.5) / CHUNK);
      const previewOffsets: Array<[number, number]> = [];
      for (let dz = -previewRadius; dz <= previewRadius; dz++)
        for (let dx = -previewRadius; dx <= previewRadius; dx++) previewOffsets.push([dx, dz]);
      previewOffsets.sort(([ax, az], [bx, bz]) => ax * ax + az * az - (bx * bx + bz * bz));
      for (const [dx, dz] of previewOffsets) this.world.genSurface(previewCenterX + dx, previewCenterZ + dz);
      for (const [dx, dz] of previewOffsets) this.world.decorate(previewCenterX + dx, previewCenterZ + dz, true);
      const band = this.meshBandForPlayer();
      for (const [dx, dz] of previewOffsets) {
        const cx = previewCenterX + dx;
        const cz = previewCenterZ + dz;
        const steps = buildChunkGeometrySteps(this.world, cx, cz, 0, band.minY, band.maxY);
        const result = steps.next();
        if (result.done) this.installChunkGeometry(cx, cz, result.value, band.key);
      }

      this.lastLoadPct = -1;
      requestMusic();
      this.syncHud(true);
      return;
    }
    const R = 2; // Start with 5×5 chunks, then expand to 49 surface chunks behind the menu
    const offsets: Array<[number, number]> = [];
    for (let r = 0; r <= R; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) === r) offsets.push([dx, dz]);
        }
      }
    }
    // Prioritize the spawn and work outward so the useful scene appears before distant chunks.
    for (const [dx, dz] of offsets) {
      const cx = c0x + dx;
      const cz = c0z + dz;
      this.loadTasks.push(() => this.world.advanceTerrain(cx, cz, 1));
    }
    for (const [dx, dz] of offsets) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) >= R) continue;
      const cx = c0x + dx;
      const cz = c0z + dz;
      this.loadTasks.push(() => {
        this.world.decorate(cx, cz);
        return true;
      });
    }
    this.loadTasks.push(() => {
      const [x, y, z] = this.world.findSpawn();
      this.pos.set(x, y, z);
      this.yaw = this.world.spawnYawFor(x, z);
      this.pitch = -0.14;
      this.visualClimateReady = false;
      this.setMenuClockForMode();
      this.meshBandKey = this.meshBandForPlayer().key;
      this.seedStarterWildlife(x, z, this.yaw);
      this.menuWorldStarterSeeded = true;
      return true;
    });
    for (const [dx, dz] of offsets) {
      const cx = c0x + dx;
      const cz = c0z + dz;
      this.loadTasks.push(this.createChunkMeshTask(cx, cz));
    }
    // Requirement 2.14: the platform language is read from the SDK at startup, so the first screen
    // must not appear before the SDK has settled — otherwise the menu opens in the browser's language
    // and then flips, which is exactly what the 文 indicator on the debug panel rejects. The SDK
    // always settles; the deadline is only a belt against a pathological platform, and past it the
    // documented «small delay while loading» applies.
    const sdkWaitStarted = performance.now();
    this.loadTasks.push(() => yaReady() || performance.now() - sdkWaitStarted > Engine.SDK_SETTLE_TIMEOUT_MS);
    this.loadTotal = this.loadTasks.length;
    this.menuWorldStreaming = true;
    this.phase = 'loading';
  }

  // ================= CHUNK STREAMING =================
  /** Generate neighbours and mesh one chunk incrementally to avoid >16 ms frame spikes. */
  private *streamChunkBuildSteps(cx: number, cz: number, band: ReturnType<Engine['meshBandForPlayer']>): Generator<void, void, void> {
    // Complete the requested chunk first; nearby support chunks are filled from the centre outward.
    for (let radius = 0; radius <= 2; radius++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) + Math.abs(dz) !== radius) continue;
          while (!this.world.advanceTerrain(cx + dx, cz + dz, 1)) yield;
        }
      }
    }
    const wasDecorated = this.world.isDecorated(cx, cz);
    this.world.decorate(cx, cz);
    // Decoration can spill structures, trees and lamps into neighbouring chunks.
    if (!wasDecorated) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const key = chunkKey(cx + dx, cz + dz);
          if (this.chunkMeshes.has(key) || this.cutoutMeshes.has(key) || this.waterMeshes.has(key) || this.decorMeshes.has(key))
            this.dirtyChunks.add(key);
        }
      }
    }
    const geometry = yield* buildChunkGeometrySteps(this.world, cx, cz, 256, band.minY, band.maxY);
    this.installChunkGeometry(cx, cz, geometry, band.key);
  }

  private refreshMeshBand() {
    const band = this.meshBandForPlayer();
    if (band.key === this.meshBandKey) return;
    this.meshBandKey = band.key;

    const pcx = Math.floor(this.pos.x / CHUNK);
    const pcz = Math.floor(this.pos.z / CHUNK);
    const radius = this.isPlayerUnderground() ? 2 : 3;
    const near = (key: number) => {
      const [cx, cz] = keyToChunk(key);
      return Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= radius;
    };
    const keys = new Set<number>([...this.geometryBandByKey.keys()].filter(near));
    for (const key of this.dirtyChunks) if (near(key)) keys.add(key);
    if (this.dirtyMeshJob && near(this.dirtyMeshJob.key)) keys.add(this.dirtyMeshJob.key);
    this.dirtyChunks.clear();
    this.dirtyMeshJob = null;
    this.activeStreamJob = null;
    this.activeStreamKey = null;
    // Keep the old band visible while only nearby chunks are rebuilt. Far surface chunks retain
    // their cached mesh and are converted lazily if they become visible again.
    this.meshedEmpty.clear();
    const nearestFirst = [...keys].sort((a, b) => {
      const [ax, az] = keyToChunk(a), [bx, bz] = keyToChunk(b);
      return (ax - pcx) ** 2 + (az - pcz) ** 2 - ((bx - pcx) ** 2 + (bz - pcz) ** 2);
    });
    for (const key of nearestFirst) {
      const [cx, cz] = keyToChunk(key);
      if (this.world.hasTerrain(cx, cz)) this.dirtyChunks.add(key);
      else this.geometryBandByKey.delete(key);
    }
  }

  /**
   * The world streams in around the player: every frame we spend a small time
   * budget generating + meshing the nearest missing chunks, and drop meshes
   * that fell far behind. The map never ends.
   */
  private streamChunks(px: number, pz: number, maxChunkRadius = this.isPlayerUnderground() ? 2 : 3, forceRadius = false) {
    this.refreshMeshBand();
    const t0 = performance.now();
    const pcx = Math.floor(px / CHUNK);
    const pcz = Math.floor(pz / CHUNK);
    const renderDistance = this.worldRenderDistance();
    const radius = Math.min(Math.ceil(renderDistance / CHUNK), maxChunkRadius);
    const farSq = renderDistance * renderDistance;

    // Surface: at most 7×7 (49) chunks. Underground: a tighter 5×5 window. During a menu seed
    // change, finish the complete surface square even if adaptive quality temporarily shortened fog.
    if (!this.activeStreamJob) {
      outer: for (let r = 0; r <= radius; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const cx = pcx + dx;
            const cz = pcz + dz;
            const centerX = cx * CHUNK + CHUNK / 2;
            const centerZ = cz * CHUNK + CHUNK / 2;
            if (!forceRadius && (centerX - px) ** 2 + (centerZ - pz) ** 2 >= farSq) continue;
            const key = chunkKey(cx, cz);
            const oldBand = this.geometryBandByKey.get(key);
            if (oldBand !== undefined && oldBand !== this.meshBandKey && this.world.hasTerrain(cx, cz)) {
              this.dirtyChunks.add(key);
              continue;
            }
            const hasMesh = this.chunkMeshes.has(key) || this.cutoutMeshes.has(key) || this.waterMeshes.has(key) || this.decorMeshes.has(key) || this.meshedEmpty.has(key);
            const meshMatchesBand = oldBand === this.meshBandKey;
            // A shallow menu preview already has a mesh but still needs its full-depth terrain job.
            if (hasMesh && meshMatchesBand && this.world.hasTerrain(cx, cz)) continue;
            if (this.dirtyChunks.has(key) || this.dirtyMeshJob?.key === key) continue;
            this.activeStreamKey = key;
            this.activeStreamJob = this.streamChunkBuildSteps(cx, cz, this.meshBandForPlayer());
            break outer;
          }
        }
      }
    }
    if (this.activeStreamJob) {
      const budgetMs = this.phase === 'menu' ? 4 : this.fps < 54 ? 1.5 : 2.8;
      while (this.activeStreamJob && performance.now() - t0 < budgetMs) {
        const result = this.activeStreamJob.next();
        if (result.done) {
          this.activeStreamJob = null;
          this.activeStreamKey = null;
          break;
        }
      }
    }

    // unload meshes far beyond the horizon (world data stays cached)
    if ((this.frameNo & 31) === 0) {
      const drop = (renderDistance / CHUNK + 2) ** 2;
      if (this.activeStreamKey !== null) {
        const [scx, scz] = keyToChunk(this.activeStreamKey);
        if ((scx - pcx) ** 2 + (scz - pcz) ** 2 > drop) {
          this.activeStreamJob = null;
          this.activeStreamKey = null;
        }
      }
      for (const [key, mesh] of this.chunkMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.chunkMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.cutoutMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.cutoutMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.waterMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.waterMeshes.delete(key);
        }
      }
      for (const [key, mesh] of this.decorMeshes) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          this.decorMeshes.delete(key);
          this.clearChestLids(key);
          this.clearCampfireVisuals(key);
        }
      }
      for (const key of [...this.campfireVisuals.keys()]) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) this.clearCampfireVisuals(key);
      }
      for (const key of this.meshedEmpty) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) this.meshedEmpty.delete(key);
      }
      for (const key of [...this.geometryBandByKey.keys()]) {
        const [cx, cz] = keyToChunk(key);
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > drop) {
          this.geometryBandByKey.delete(key);
          this.clearChestLids(key);
          this.clearCampfireVisuals(key);
        }
      }
    }
  }

  /** chunks that produced no geometry (all air) — remembered so we don't retry every frame */
  private meshedEmpty = new Set<number>();
  private frameNo = 0;

  /**
   * Deferred remeshing: simulations (fluids, gravity, trees) mark chunks dirty
   * and a fixed per-frame budget rebuilds them — a lava spill can touch dozens
   * of chunks without ever spiking a frame.
   */
  private dirtyChunks = new Set<number>();
  private dirtyMeshJob: { key: number; cx: number; cz: number; bandKey: number; steps: Generator<void, ChunkGeometry, void> } | null = null;
  private activeStreamJob: Generator<void, void, void> | null = null;
  private activeStreamKey: number | null = null;

  private markDirtyAt(x: number, z: number) {
    this.worldChangedAt = performance.now();
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    const lx = x - cx * CHUNK;
    const lz = z - cz * CHUNK;
    this.dirtyChunks.add(chunkKey(cx, cz));
    // only touch neighbours when the edit sits on a chunk border
    if (lx === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (lx === CHUNK - 1) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (lz === CHUNK - 1) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  private flushDirtyChunks() {
    const started = performance.now();
    const budgetMs = this.fps < 54 ? 1 : 2;
    while (performance.now() - started < budgetMs) {
      if (!this.dirtyMeshJob) {
        const next = this.dirtyChunks.values().next();
        if (next.done) return;
        const key = next.value;
        this.dirtyChunks.delete(key);
        const [cx, cz] = keyToChunk(key);
        if (!this.world.hasTerrain(cx, cz)) continue;
        const band = this.meshBandForPlayer();
        this.dirtyMeshJob = { key, cx, cz, bandKey: band.key, steps: buildChunkGeometrySteps(this.world, cx, cz, 256, band.minY, band.maxY) };
      }
      const result = this.dirtyMeshJob.steps.next();
      if (result.done) {
        const { cx, cz, bandKey } = this.dirtyMeshJob;
        this.installChunkGeometry(cx, cz, result.value, bandKey);
        this.dirtyMeshJob = null;
      }
    }
  }

  private static chestCellKey(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }

  /** drop one chunk's lid meshes; the geometry itself is shared per chest family */
  private clearChestLids(key: number) {
    const list = this.chestLids.get(key);
    if (!list) return;
    for (const entry of list) {
      this.scene.remove(entry.group);
      if (this.chestLidByCell.get(entry.cell) === entry.group) this.chestLidByCell.delete(entry.cell);
    }
    this.chestLids.delete(key);
  }

  private clearAllChestLids() {
    for (const key of [...this.chestLids.keys()]) this.clearChestLids(key);
    this.chestLidByCell.clear();
    this.chestLidAnims.length = 0;
  }

  private clearCampfireVisuals(key: number) {
    const visuals = this.campfireVisuals.get(key);
    if (!visuals) return;
    this.scene.remove(visuals.group);
    visuals.group.clear();
    this.campfireVisuals.delete(key);
  }

  private clearAllCampfireVisuals() {
    for (const key of [...this.campfireVisuals.keys()]) this.clearCampfireVisuals(key);
  }

  /** Instancing keeps each chunk's animated flames and 30/60-block smoke to three draw calls. */
  private spawnCampfireVisuals(key: number, specs: CampfireSpec[]) {
    this.clearCampfireVisuals(key);
    if (!specs.length) return;
    const group = new THREE.Group();
    group.frustumCulled = false;
    const outerFlames = new THREE.InstancedMesh(this.campfireOuterGeometry, this.campfireOuterMaterial, specs.length * 2);
    const innerFlames = new THREE.InstancedMesh(this.campfireInnerGeometry, this.campfireInnerMaterial, specs.length);
    const smoke = new THREE.InstancedMesh(this.campfireSmokeGeometry, this.campfireSmokeMaterial, specs.length * CAMPFIRE_SMOKE_PUFFS);
    for (const mesh of [outerFlames, innerFlames, smoke]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
    }
    outerFlames.renderOrder = 5;
    innerFlames.renderOrder = 5;
    smoke.renderOrder = 3;
    const fires = specs.map((spec, index) => ({
      x: spec.x,
      y: spec.y,
      z: spec.z,
      phase: (spec.x * 1.71 + spec.z * 2.37) % (Math.PI * 2),
      smokeHeight: spec.hayBoost ? HAY_CAMPFIRE_SMOKE_HEIGHT : CAMPFIRE_SMOKE_HEIGHT,
      smokeIndex: index * CAMPFIRE_SMOKE_PUFFS,
    }));
    this.scene.add(group);
    this.campfireVisuals.set(key, { group, outerFlames, innerFlames, smoke, fires });
    this.updateCampfireVisuals(0);
  }

  private updateCampfireVisuals(dt: number) {
    this.campfireVisualClock += dt;
    const dummy = this.campfireDummy;
    for (const visual of this.campfireVisuals.values()) {
      if (!visual.group.visible) continue;
      for (let index = 0; index < visual.fires.length; index++) {
        const fire = visual.fires[index];
        const phase = fire.phase;
        const outerBase = index * 2;
        for (let flame = 0; flame < 2; flame++) {
          const flamePhase = phase + (flame === 0 ? 0 : 2.3);
          const size = flame === 0 ? 1 : 0.82;
          const pulse = 0.82 + Math.sin(this.campfireVisualClock * 13 + flamePhase) * 0.13 + Math.sin(this.campfireVisualClock * 21 + flamePhase * 1.7) * 0.055;
          dummy.position.set(
            fire.x + 0.5 + (flame === 0 ? -0.08 : 0.08) + Math.sin(this.campfireVisualClock * 6 + flamePhase) * 0.018,
            fire.y + 0.16 + (flame === 0 ? 0.57 : 0.53) + Math.sin(this.campfireVisualClock * 12 + flamePhase) * 0.035,
            fire.z + 0.5 + (flame === 0 ? 0.015 : -0.035) + Math.cos(this.campfireVisualClock * 7 + flamePhase) * 0.012,
          );
          dummy.rotation.set(0, this.campfireVisualClock * 0.35 + flamePhase, Math.sin(this.campfireVisualClock * 8 + flamePhase) * 0.08);
          dummy.scale.set(size * pulse, size * (0.88 + pulse * 0.22), size * pulse);
          dummy.updateMatrix();
          visual.outerFlames.setMatrixAt(outerBase + flame, dummy.matrix);
        }

        const innerPhase = phase + 1.2;
        const innerPulse = 0.82 + Math.sin(this.campfireVisualClock * 13 + innerPhase) * 0.13 + Math.sin(this.campfireVisualClock * 21 + innerPhase * 1.7) * 0.055;
        dummy.position.set(
          fire.x + 0.5 + 0.005 + Math.sin(this.campfireVisualClock * 6 + innerPhase) * 0.018,
          fire.y + 0.16 + 0.48 + Math.sin(this.campfireVisualClock * 12 + innerPhase) * 0.035,
          fire.z + 0.5 + 0.015 + Math.cos(this.campfireVisualClock * 7 + innerPhase) * 0.012,
        );
        dummy.rotation.set(0, this.campfireVisualClock * 0.35 + innerPhase, Math.sin(this.campfireVisualClock * 8 + innerPhase) * 0.08);
        dummy.scale.set(innerPulse, 0.88 + innerPulse * 0.22, innerPulse);
        dummy.updateMatrix();
        visual.innerFlames.setMatrixAt(index, dummy.matrix);

        for (let puffIndex = 0; puffIndex < CAMPFIRE_SMOKE_PUFFS; puffIndex++) {
          const offset = puffIndex / CAMPFIRE_SMOKE_PUFFS;
          // slower rise so puffs linger and the column reads clearly
          const progress = (this.campfireVisualClock * 0.055 + offset) % 1;
          const drift = 0.12 + progress * 0.72;
          const theta = this.campfireVisualClock * 0.62 + offset * Math.PI * 2 + phase;
          const swayX = Math.sin(this.campfireVisualClock * 0.9 + phase + offset * 3.1) * (0.08 + progress * 0.22);
          const swayZ = Math.cos(this.campfireVisualClock * 0.75 + phase * 1.3 + offset * 2.7) * (0.08 + progress * 0.22);
          dummy.position.set(
            fire.x + 0.5 + Math.cos(theta) * drift + swayX,
            fire.y + 0.16 + 0.35 + progress * (fire.smokeHeight - 0.35),
            fire.z + 0.5 + Math.sin(theta) * drift + swayZ,
          );
          dummy.rotation.set(0, theta, 0);
          // larger, more readable puffs: dense near fire, big soft cloud high up
          const puffSize = 0.78 + progress * 2.6;
          dummy.scale.setScalar(puffSize);
          dummy.updateMatrix();
          visual.smoke.setMatrixAt(fire.smokeIndex + puffIndex, dummy.matrix);
        }
      }
      visual.outerFlames.instanceMatrix.needsUpdate = true;
      visual.innerFlames.instanceMatrix.needsUpdate = true;
      visual.smoke.instanceMatrix.needsUpdate = true;
    }
  }

  /** build the swinging lid meshes for a freshly meshed chunk */
  private spawnChestLids(key: number, specs: ChestLidSpec[]) {
    this.clearChestLids(key);
    if (!specs.length) return;
    const list: Array<{ cell: string; group: THREE.Group }> = [];
    for (const spec of specs) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(chestLidGeometry(spec.base), this.decorMat));
      group.position.set(spec.x + 0.5, spec.y + CHEST_LID_HINGE_Y, spec.z + 0.5 + CHEST_LID_HINGE_Z);
      group.rotation.x = spec.open ? CHEST_LID_OPEN_ANGLE : 0;
      this.scene.add(group);
      const cell = Engine.chestCellKey(spec.x, spec.y, spec.z);
      this.chestLidByCell.set(cell, group);
      list.push({ cell, group });
    }
    this.chestLids.set(key, list);
  }

  /** swing one chest lid; `keys` are [fraction of the swing, rotation] pairs */
  private swingChestLid(x: number, y: number, z: number, from: number, keys: Array<[number, number]>, dur: number) {
    const group = this.chestLidByCell.get(Engine.chestCellKey(x, y, z));
    if (!group) return;
    group.rotation.x = from;
    this.chestLidAnims = this.chestLidAnims.filter((anim) => anim.group !== group);
    this.chestLidAnims.push({ group, t: 0, dur, keys });
  }

  private updateChestLids(dt: number) {
    if (!this.chestLidAnims.length) return;
    for (let i = this.chestLidAnims.length - 1; i >= 0; i--) {
      const anim = this.chestLidAnims[i];
      anim.t += dt;
      const k = Math.min(1, anim.t / anim.dur);
      let from = anim.keys[0];
      for (let s = 1; s < anim.keys.length; s++) {
        const to = anim.keys[s];
        if (k <= to[0]) {
          const local = (k - from[0]) / Math.max(1e-4, to[0] - from[0]);
          const eased = local * local * (3 - 2 * local);
          anim.group.rotation.x = from[1] + (to[1] - from[1]) * eased;
          break;
        }
        from = to;
      }
      if (k >= 1) {
        anim.group.rotation.x = anim.keys[anim.keys.length - 1][1];
        this.chestLidAnims.splice(i, 1);
      }
    }
  }

  private createChunkMeshTask(cx: number, cz: number): () => boolean {
    let job: { bandKey: number; steps: Generator<void, ChunkGeometry, void> } | null = null;
    return () => {
      if (!job) {
        const band = this.meshBandForPlayer();
        job = { bandKey: band.key, steps: buildChunkGeometrySteps(this.world, cx, cz, 256, band.minY, band.maxY) };
      }
      const started = performance.now();
      let result = job.steps.next();
      while (!result.done && performance.now() - started < 2.2) result = job.steps.next();
      if (!result.done) return false;
      this.installChunkGeometry(cx, cz, result.value, job.bandKey);
      return true;
    };
  }

  private installChunkGeometry(cx: number, cz: number, geo: ChunkGeometry, bandKey = this.meshBandKey) {
    const key = chunkKey(cx, cz);
    this.clearCampfireVisuals(key);
    for (const meshes of [this.chunkMeshes, this.cutoutMeshes, this.waterMeshes, this.decorMeshes]) {
      const old = meshes.get(key);
      if (!old) continue;
      this.scene.remove(old);
      old.geometry.dispose();
      meshes.delete(key);
    }
    if (geo.solid) {
      const mesh = new THREE.Mesh(geo.solid, this.material);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.chunkMeshes.set(key, mesh);
    }
    if (geo.cutout) {
      const mesh = new THREE.Mesh(geo.cutout, this.cutoutMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.cutoutMeshes.set(key, mesh);
    }
    if (geo.water) {
      const mesh = new THREE.Mesh(geo.water, this.waterMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.waterMeshes.set(key, mesh);
    }
    if (geo.decor) {
      const mesh = new THREE.Mesh(geo.decor, this.decorMat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.decorMeshes.set(key, mesh);
    }
    this.spawnChestLids(key, geo.chestLids);
    this.spawnCampfireVisuals(key, geo.campfires);
    this.geometryBandByKey.set(key, bandKey);
    if (!geo.solid && !geo.cutout && !geo.water && !geo.decor && !geo.chestLids.length && !geo.campfires.length) this.meshedEmpty.add(key);
    else this.meshedEmpty.delete(key);
  }

  private updateChunkVisibility() {
    const renderDistance = this.worldRenderDistance();
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.far = renderDistance * 0.94;
      fog.near = fog.far * 0.38;
    }
    // distance culling is stable frame-to-frame — refresh it at 20Hz
    if ((this.frameNo % 3) !== 0) return;
    const cam = this.camera.position;
    const far = renderDistance * renderDistance;
    for (const [key, m] of this.chunkMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.cutoutMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.waterMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, m] of this.decorMeshes) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      m.visible = dx * dx + dz * dz < far;
    }
    for (const [key, list] of this.chestLids) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      const near = dx * dx + dz * dz < far;
      for (const entry of list) entry.group.visible = near;
    }
    for (const [key, visuals] of this.campfireVisuals) {
      const [cx, cz] = keyToChunk(key);
      const dx = cx * CHUNK + CHUNK / 2 - cam.x;
      const dz = cz * CHUNK + CHUNK / 2 - cam.z;
      visuals.group.visible = dx * dx + dz * dz < far;
    }
  }

  private rebuildAt(x: number, z: number) {
    // Defer edits to the frame-budgeted mesher rather than rebuilding a full 300-block column inline.
    this.markDirtyAt(x, z);
  }

  // ================= INPUT =================
  private togglePerspective() {
    this.thirdPerson = !this.thirdPerson;
    this.thirdPersonOrbitYaw = 0;
    this.thirdPersonOrbitInputAt = 0;
    this.thirdPersonCamReady = false;
    if (!this.thirdPerson) this.restoreThirdPersonOccluders();
    sfx.ui(true);
    this.syncHud(true);
    // Camera-only action: do not touch phase or Yandex GameplayAPI state.
  }

  /** Touch-screen equivalent of V; keep the keyboard path and camera behavior shared. */
  toggleTouchPerspective() {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    this.togglePerspective();
  }

  /** Touch posture buttons are toggles so movement can continue without holding another finger down. */
  toggleTouchCrouch() {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    this.touchCrouch = !(this.crouching || this.touchCrouch);
    if (this.touchCrouch) {
      this.touchCrawl = false;
      this.keys['KeyC'] = false;
    }
    sfx.ui(true);
    this.syncHud(true);
  }

  /** Crawl keeps the same collision check as the C-key path and refuses to enter a blocked space. */
  toggleTouchCrawl() {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    const shouldCrawl = !(this.crawling || this.touchCrawl);
    if (shouldCrawl && this.collides(this.pos.x, this.pos.y, this.pos.z, true, this.yaw)) {
      sfx.ui(false);
      return;
    }
    this.touchCrawl = shouldCrawl;
    this.keys['KeyC'] = false;
    if (shouldCrawl) this.touchCrouch = false;
    sfx.ui(true);
    this.syncHud(true);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    const c = e.code;
    if (this.keys[c]) return;

    // Inventory is a live overlay: allow craft/close shortcuts but never feed gameplay movement or actions.
    if (this.inventoryOpen) {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape'].includes(c)) e.preventDefault();
      if (c === 'KeyE' || c === 'Tab' || c === 'KeyI' || c === 'Escape') {
        this.keys[c] = true;
        e.preventDefault();
        this.closeInventory();
        return;
      }
      if (c === 'KeyV' && this.phase === 'playing') {
        this.keys[c] = true;
        this.togglePerspective();
        return;
      }
      if (c.startsWith('Digit')) {
        this.keys[c] = true; // suppress key-repeat crafting while the key is held
        const r = RECIPES.find((rr) => rr.hotkey === c.slice(5));
        if (r) this.craft(r.key);
      }
      return;
    }

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c) && this.phase === 'playing') {
      e.preventDefault();
    }
    this.keys[c] = true;

    // E = doors / windows / trader; TAB (or I) = inventory / workbench
    if (c === 'KeyE') {
      if (this.phase === 'playing') this.interact();
      return;
    }
    if (c === 'Tab' || c === 'KeyI') {
      if (this.phase === 'playing') {
        e.preventDefault();
        this.openInventory();
      }
      return;
    }
    if (this.phase !== 'playing') return;
    // OK on the remote (requirement 1.6.3): hold to dig, tap to use the thing in front or place the
    // selected block. The engine reads the same flags the mouse sets, so nothing else has to change.
    if (this.tv && (c === 'Enter' || c === 'NumpadEnter')) {
      this.tvOkDownAt = performance.now();
      this.mining = true;
      e.preventDefault();
      return;
    }
    if (c === 'KeyV') {
      this.togglePerspective();
      return;
    }
    if (c === 'KeyB') {
      e.preventDefault();
      this.whistleParrot();
      return;
    }
    if (c === 'KeyF') this.tryPlace();
    if (c === 'KeyG') {
      this.dropHeldItem();
      return;
    }
    if (c.startsWith('Digit')) {
      const n = parseInt(c.slice(5), 10);
      // 1-9 → slots 1-9, 0 → slot 10
      if (n >= 1 && n <= 9) this.selectSlot(n - 1);
      else if (n === 0) this.selectSlot(9);
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  private onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement;
    this.lockPending = false;
    if (this.locked) this.lockFailed = false; // lock works — kill the fallback
    if (!this.locked && this.phase === 'playing') {
      this.mining = false;
      this.placing = false;
      // Inventory deliberately releases pointer lock while the live world keeps running.
      // Outside inventory, Esc = player pause; focus loss = system pause.
      if (!this.inventoryOpen && !this.isCoarse() && !this.lockFailed) this.pause(!document.hasFocus() || document.hidden);
    }
    this.syncHud(true);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    if (e.button === 1) e.preventDefault();
    // every click is a fresh chance to grab the pointer — user gesture context
    if (!this.locked && !this.isCoarse()) {
      this.lockFailed = false;
      this.requestLock();
    }
    if (this.thirdPerson && e.altKey) {
      e.preventDefault(); // Alt-drag is reserved for orbiting the camera.
      return;
    }
    if (e.button === 0) this.mining = true; // LMB = hit / mine / shoot
    else if (e.button === 2 || e.button === 1) {
      // RMB (and middle) = place, always — no more mode-dependent behaviour
      this.placing = true;
      this.tryPlace();
    }
  };
  private onKeyUpTv = (e: KeyboardEvent) => {
    if (!this.tv || (e.code !== 'Enter' && e.code !== 'NumpadEnter')) return;
    const held = performance.now() - this.tvOkDownAt;
    this.mining = false;
    if (held > 260) return; // a hold: that was digging, nothing else to do
    // a short tap: use what is in front (door, trader, chest) or place the selected block
    if (!this.interact()) this.placeOnce = true;
  };

  /** Is there a step exactly one block high in front (walkable with a jump)? */
  private tvStepAhead(): boolean {
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);
    const x = this.pos.x + dirX * 0.6;
    const z = this.pos.z + dirZ * 0.6;
    return this.collides(x, this.pos.y, z, this.crawling, this.yaw) && !this.collides(x, this.pos.y + 1.05, z, this.crawling, this.yaw);
  }

  /**
   * Is the way ahead too tall for a single jump, but the player's own column free to rise?
   * That is the two-block-deep pit: without an automatic jump the remote has no key for it at all,
   * and the run would be over (requirement 1.6.3 — arrows alone must be enough to finish the game).
   * A ceiling right above the head still stops the jump, so the player never bonks into stone.
   */
  private tvClimbAhead(): boolean {
    const dirX = -Math.sin(this.yaw);
    const dirZ = -Math.cos(this.yaw);
    const x = this.pos.x + dirX * 0.6;
    const z = this.pos.z + dirZ * 0.6;
    const ahead = this.collides(x, this.pos.y, z, this.crawling, this.yaw) || this.collides(x, this.pos.y + 1.05, z, this.crawling, this.yaw);
    if (!ahead) return false;
    return !this.collides(this.pos.x, this.pos.y + 2.05, this.pos.z, this.crawling, this.yaw);
  }

  /**
   * On a TV the remote sends one press at a time, so the game jumps by itself while the player
   * walks forward: over a one-block step, and out of a pit whose walls leave room to rise.
   */
  private tvAutoJump(): boolean {
    return this.tvStepAhead() || this.tvClimbAhead();
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mining = false;
    if (e.button === 2 || e.button === 1) this.placing = false;
  };
  private onMouseMove = (e: MouseEvent) => {
    if (this.inventoryOpen) return;
    if (this.locked) {
      if (this.thirdPerson && e.altKey) {
        this.orbitThirdPersonCamera(e.movementX * 0.0028);
        return;
      }
      this.look(e.movementX * 0.0028, e.movementY * 0.0028);
      return;
    }
    if (this.phase !== 'playing' || this.isCoarse()) return;
    if (this.thirdPerson && e.altKey && e.buttons !== 0) {
      this.orbitThirdPersonCamera(e.movementX * 0.0058);
      return;
    }
    // lock unavailable → remember the cursor for edge-steering fallback,
    // and while any button is held give precise 1:1 drag aiming
    const r = this.renderer.domElement.getBoundingClientRect();
    this.hoverX = (e.clientX - r.left) / r.width;
    this.hoverY = (e.clientY - r.top) / r.height;
    this.hoverActive = true;
    if (this.lockFailed && (this.mining || this.placing)) {
      this.look(e.movementX * 0.0058, e.movementY * 0.0058);
    }
  };
  private onMouseLeave = () => {
    this.hoverActive = false;
  };

  /** hands-free steering — only as a fallback when pointer lock is unavailable */
  private updateHoverLook(dt: number) {
    if (this.inventoryOpen || !this.lockFailed) return; // browser lock works → cursor stays pinned centre
    if (this.locked || !this.hoverActive || this.isCoarse()) return;
    if (this.mining || this.placing) return; // drag aiming takes over
    if (this.phase !== 'playing' || !this.freeLook) return;
    const dead = 0.13;
    const ax = this.hoverX * 2 - 1;
    const ay = this.hoverY * 2 - 1;
    const curve = (v: number) => {
      const a = Math.abs(v);
      if (a < dead) return 0;
      const n = (a - dead) / (1 - dead);
      return Math.sign(v) * n * n * 1.9;
    };
    const dx = curve(ax) * dt * 2.35;
    const dy = curve(ay) * dt * 1.75;
    if (dx || dy) this.look(dx, dy);
  }

  /** «особое солнце» on/off: the GIF sun and its looped sound replace the plain disc */
  setSpecialSun(v: boolean) {
    this.specialSun = v;
    if (!v) this.syncSpecialSunSound();
  }
  get specialSunEnabled() {
    return this.specialSun;
  }
  private updateSpecialSunFrame() {
    if (!this.sunSheetTex) return;
    // GIF frames are 40 ms apart on average; 36 frames in a 6x6 grid, row 0 is the top row
    const frame = Math.floor(this.time / 0.04) % 36;
    const col = frame % 6;
    const row = Math.floor(frame / 6);
    this.sunSheetTex.offset.set(col / 6, 1 - (row + 1) / 6);
  }
  /** the sun sound loops only while the game is running: not in menus, pauses or game over */
  private syncSpecialSunSound() {
    const want = this.specialSun && this.phase === 'playing';
    if (want === this.sunSoundOn) return;
    this.sunSoundOn = want;
    setSpecialSunSound(want, sunSoundUrl);
  }

  setFreeLook(v: boolean) {
    this.freeLook = v;
    this.syncHud(true);
  }
  get freeLookEnabled() {
    return this.freeLook;
  }
  private onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    // cycle through all 10 fixed slots — an empty hole selects the bare hand
    this.selectSlot((this.selected + dir + 10) % 10);
  };
  private onContext = (e: Event) => e.preventDefault();
  /**
   * A usable pixel size for the renderer.
   *
   * Requirement 1.14 lists «перестаёт отвечать после сворачивания браузера» and «при изменении
   * размера» among the reasons a game is taken down. A minimised window, a hidden tab or a container
   * collapsed by an overlay reports `clientWidth === 0`, and `0 || window.innerWidth` used to fall
   * through to `0` as well — then `aspect = 0 / 0` is `NaN`, `updateProjectionMatrix()` writes it into
   * the projection matrix and the frame renders nothing at all. The next real resize fixed it, but a
   * player who came back to a black canvas had already reloaded the game. One pixel is enough to keep
   * the matrix finite; the following resize restores the true size.
   */
  private viewportSize(): { w: number; h: number } {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth || 1);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight || 1);
    return { w, h };
  }
  private onResize = () => {
    const { w, h } = this.viewportSize();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.hudCamera.aspect = w / h;
    this.hudCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.layoutViewModel(w / h);
  };

  /** keeps the first-person pickaxe on screen for portrait phones as well as widescreens */
  private layoutViewModel(aspect: number) {
    if (!this.pickGroup) return;
    const portrait = aspect < 1;
    this.pickBaseX = portrait ? 0.2 : aspect < 1.35 ? 0.32 : 0.42;
    this.pickGroup.scale.setScalar(portrait ? 0.68 : aspect < 1.35 ? 0.76 : 0.82);
  }

  private onBlur = () => {
    // window lost focus → browsers swallow the keyup; drop every held key so
    // crouch/sprint/crawl can't get stuck on
    this.keys = {};
    this.mining = false;
    this.placing = false;
  };

  /** Yandex Games requirement: hidden tab ⇒ game paused + audio silenced */
  private onVisibility = () => {
    if (document.hidden) this.systemPause();
    else resumeAudio(); // the run itself waits for the player (or for the platform's resume event)
  };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('keyup', this.onKeyUpTv);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContext);
    el.addEventListener('mouseleave', this.onMouseLeave);
  }

  requestLock() {
    if (this.inventoryOpen) return;
    initAudio();
    const el = this.renderer.domElement;
    if (this.isCoarse() || this.lockFailed) return;
    if (document.pointerLockElement === el) return;
    this.lockPending = true;
    const fail = () => {
      this.lockPending = false;
      this.lockFailed = true;
      this.syncHud(true);
    };
    window.setTimeout(() => {
      this.lockPending = false;
      if (!this.locked) this.lockFailed = true;
      this.syncHud(true);
    }, 900);
    try {
      const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(fail);
    } catch {
      fail();
    }
  }
  private lockPending = false;

  private onPointerLockError = () => {
    this.lockPending = false;
    this.lockFailed = true;
    this.syncHud(true);
  };

  // public input API (touch UI)
  look(dx: number, dy: number) {
    if (this.inventoryOpen) return;
    this.yaw -= dx;
    this.pitch -= dy;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }
  /** Rotate the third-person camera around the avatar without turning the avatar itself. */
  orbitThirdPersonCamera(dx: number): boolean {
    if (!this.thirdPerson || this.inventoryOpen || this.phase !== 'playing') return false;
    this.thirdPersonOrbitYaw = THREE.MathUtils.euclideanModulo(
      this.thirdPersonOrbitYaw - dx + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    this.thirdPersonOrbitInputAt = performance.now();
    return true;
  }
  private updateThirdPersonOrbitReturn(dt: number) {
    if (!this.thirdPerson || this.thirdPersonOrbitYaw === 0) return;
    const keys = this.keys;
    const orbitModifierHeld = keys['AltLeft'] || keys['AltRight'];
    const movementInput =
      keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'] || keys['ArrowUp'] || keys['ArrowDown'] ||
      (!this.tv && (keys['ArrowLeft'] || keys['ArrowRight'])) || Math.hypot(this.touchMove.x, this.touchMove.y) > 0.08;
    const moving = movementInput || Math.hypot(this.vel.x, this.vel.z) > 0.12;
    const orbitGestureActive = this.thirdPersonOrbitInputAt > 0 && performance.now() - this.thirdPersonOrbitInputAt < 160;
    if (!moving || orbitModifierHeld || orbitGestureActive) return;
    // Once movement resumes after camera inspection, glide back behind the avatar.
    this.thirdPersonOrbitYaw = THREE.MathUtils.damp(this.thirdPersonOrbitYaw, 0, 4, dt);
    if (Math.abs(this.thirdPersonOrbitYaw) < 0.002) this.thirdPersonOrbitYaw = 0;
  }
  setMove(x: number, y: number) {
    this.touchMove.x = this.inventoryOpen ? 0 : x;
    this.touchMove.y = this.inventoryOpen ? 0 : y;
  }
  setJump(v: boolean) {
    this.touchJump = !this.inventoryOpen && v;
  }
  setMining(v: boolean) {
    if (this.inventoryOpen) {
      this.mining = false;
      return;
    }
    initAudio();
    this.mining = v;
  }
  setSprint(v: boolean) {
    this.touchSprint = !this.inventoryOpen && v;
  }
  setPlacing(v: boolean) {
    if (this.inventoryOpen) {
      this.placing = false;
      this.touchPlace = false;
      return;
    }
    // touch: the PLACE button doubles as the door/window toggle
    if (v && !this.interact(true)) this.tryPlace();
    this.placing = v;
  }
  selectSlot(i: number) {
    // 10 fixed slots — selecting an empty hole falls back to the bare hand
    if (i < 0 || i >= 10) return;
    this.selected = i;
    sfx.ui(true);
    this.syncHotbar(true);
  }

  /**
   * First empty hotbar slot (0-9), or -1 when the bar is full.
   * The hotbar is sparse: slots can hold blocks, tools, the HAND pseudo-item or be empty.
   */
  private firstFreeSlot(): number {
    for (let i = 0; i < 10; i++) if (this.hotbar[i] === undefined) return i;
    return -1;
  }

  /**
   * Unified hotbar placement (drag&drop + click):
   * - fromSlot defined → the item is dragged from another hotbar slot:
   *   occupied target → swap, empty target → move.
   * - fromSlot undefined → the item comes from the inventory list:
   *   placed into the target slot, evicting the occupant (which stays owned in
   *   the inventory). The HAND pseudo-item can never be pushed out of the bar.
   */
  placeInSlot(id: number, slot: number | undefined, fromSlot?: number, instanceId?: number) {
    if (id === undefined || id === null) return;
    const target = slot !== undefined ? Math.max(0, Math.min(9, Math.trunc(slot))) : this.firstFreeSlot();
    if (target < 0) {
      sfx.ui(false);
      return;
    }
    const durable = isDurabilityTool(id);
    let resolvedInstanceId = instanceId;
    if (durable && resolvedInstanceId === undefined) {
      resolvedInstanceId = [...this.toolInstances.values()].find((it) => it.id === id)?.instanceId;
    }

    if (fromSlot !== undefined) {
      if (this.hotbar[fromSlot] !== id) return;
      if (durable && this.hotbarInstanceIds[fromSlot] !== resolvedInstanceId) return;
      if (target === fromSlot) return;
      const occupant = this.hotbar[target];
      const occupantInstanceId = this.hotbarInstanceIds[target];
      this.hotbar[fromSlot] = occupant; // swap if occupied, clear if empty
      this.hotbarInstanceIds[fromSlot] = occupantInstanceId;
      this.hotbar[target] = id;
      this.hotbarInstanceIds[target] = durable ? resolvedInstanceId : undefined;
    } else {
      // from the inventory list — ownership must exist (the HAND only lives in the bar)
      const owned =
        id === HAND
          ? this.hotbar.includes(HAND)
          : isGearHotbarId(id)
            ? this.bagItems.some((b) => b.hid === id)
            : durable
              ? resolvedInstanceId !== undefined && this.toolInstances.get(resolvedInstanceId)?.id === id
              : (this.inventory.get(id) ?? 0) > 0;
      if (!owned) return;
      const occupant = this.hotbar[target];
      if (occupant === HAND) {
        sfx.ui(false); // the hand is permanent — clear that slot first
        return;
      }
      // One placement per physical tool; same-material duplicates remain distinct.
      if (durable && resolvedInstanceId !== undefined) {
        const existing = this.hotbarInstanceIds.indexOf(resolvedInstanceId);
        if (existing >= 0 && existing !== target) {
          this.hotbar[existing] = undefined;
          this.hotbarInstanceIds[existing] = undefined;
        }
      } else if (!durable) {
        const existing = this.hotbar.indexOf(id);
        if (existing >= 0 && existing !== target) {
          this.hotbar[existing] = undefined;
          this.hotbarInstanceIds[existing] = undefined;
        }
      }
      // The evicted occupant keeps its ownership in the inventory — just clear the slot.
      this.hotbar[target] = id;
      this.hotbarInstanceIds[target] = durable ? resolvedInstanceId : undefined;
    }

    this.selected = target;
    sfx.ui(true);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /**
   * Remove an item from a hotbar slot (drag it back toward the inventory area).
   * Blocks/tools keep their ownership in the inventory list.
   * The HAND pseudo-item can't disappear — it slides back to slot 1.
   */
  removeFromSlot(slot: number) {
    const i = Math.max(0, Math.min(9, Math.trunc(slot) || 0));
    const id = this.hotbar[i];
    if (id === undefined) return;
    if (id === HAND) {
      if (i === 0) return;
      if (this.hotbar[0] !== undefined) {
        sfx.ui(false);
        return;
      }
      this.hotbar[0] = HAND;
      this.hotbarInstanceIds[0] = undefined;
      this.hotbar[i] = undefined;
      this.hotbarInstanceIds[i] = undefined;
    } else {
      this.hotbar[i] = undefined;
      this.hotbarInstanceIds[i] = undefined;
    }
    if (this.selected === i) this.selected = 0;
    sfx.ui(true);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  setDom(refs: DomRefs) {
    this.dom = refs;
  }

  // ================= SANDBOX: MY WORLD (save / load, no timer) =================
  sandbox = false;
  private endlessRun = false;
  private static SAVE_KEY = 'orerush.myworld.v1';
  /**
   * How long the loader waits for the SDK before showing the first screen anyway (requirement 2.14:
   * the platform language must be known at startup). `YaGames.init()` answers in milliseconds; this
   * only guards against a platform that never settles, where the documented «small delay while
   * loading» is the better outcome than a loader that never ends.
   */
  private static SDK_SETTLE_TIMEOUT_MS = 4_000;
  /** How long after the last terrain edit the sandbox is written to storage (requirement 1.9). */
  private static WORLD_AUTOSAVE_DELAY = 1_500;

  static hasSavedWorld(): boolean {
    try {
      return storageGet(Engine.SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  private static rleEnc(arr: Uint8Array | Uint16Array | Int16Array): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < arr.length) {
      const v = arr[i];
      let n = 1;
      while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
      out.push(n, v);
      i += n;
    }
    return out;
  }

  private static rleDec(pairs: number[], len: number, into: Uint8Array | Uint16Array | Int16Array) {
    let idx = 0;
    for (let i = 0; i < pairs.length && idx < len; i += 2) {
      const n = pairs[i];
      const v = pairs[i + 1];
      for (let k = 0; k < n && idx < len; k++) into[idx++] = v;
    }
  }

  /**
   * Snapshot the whole run into localStorage; returns false on quota errors. `silent` is the
   * automatic save taken when the page is being hidden or left (requirement 1.9: a refresh must not
   * lose the built world) — it keeps quiet, because the player is no longer looking at the game.
   */
  /**
   * Requirement 1.9: «прогресс сохраняется сразу после действия игрока». Mining and building are the
   * player's actions in a sandbox, so the world is stored a moment after the last edit instead of
   * waiting for the page to be hidden — a killed tab or a crashed browser must not undo the shift.
   */
  private worldChangedAt = 0;

  /** Is the sandbox due for its delayed autosave? (requirement 1.9) */
  private worldAutosaveDue(now: number): boolean {
    return this.sandbox === true && this.worldChangedAt > 0 && now - this.worldChangedAt > Engine.WORLD_AUTOSAVE_DELAY;
  }

  saveWorld(silent = false): boolean {
    this.worldChangedAt = 0;
    try {
      const chunks: Array<[number, number, number[], number[]]> = [];
      for (const [key, ch] of this.world.chunks) {
        // Streaming may be partway through a chunk; never persist its incomplete terrain buffer.
        if (ch.state < 1) continue;
        chunks.push([key, ch.state, Engine.rleEnc(ch.blocks), Engine.rleEnc(ch.height)]);
      }
      const data = {
        v: 4,
        savedAt: yaServerTime(),
        seed: this.world.seed,
        clock: this.clock,
        pos: [this.pos.x, this.pos.y, this.pos.z],
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        score: this.score,
        scoreBonusMultiplier: this.scoreBonusMultiplier,
        oreBoostMultiplier: this.oreBoostMultiplier,
        inventory: Array.from(this.inventory.entries()),
        toolInstances: Array.from(this.toolInstances.values()),
        nextToolInstanceId: this.nextToolInstanceId,
        hotbar: this.hotbar.slice(),
        hotbarInstanceIds: this.hotbarInstanceIds.slice(),
        selected: this.selected,
        tier: this.tier,
        swordTier: this.swordTier,
        equipped: this.equipped,
        bagItems: this.bagItems,
        hive: Array.from(this.hiveHoney.entries()),
        chests: Array.from(this.chestInventories, ([cell, items]) => [cell, Array.from(items.entries())]),
        chestBonusGear: Array.from(this.chestBonusGear.entries()),
        birdNests: this.birdNests,
        vineTips: Array.from(this.vineTips.entries()),
        kills: this.kills,
        blocksMined: this.blocksMined,
        survivalNight: this.survivalNight,
        firstSurvivalDay: this.firstSurvivalDay,
        chunks,
      };
      if (!storageSet(Engine.SAVE_KEY, JSON.stringify(data))) throw new Error('save failed');
      if (!silent) {
        this.pushBanner(t('worldSaved'), '', '#93c95d');
        sfx.upgrade();
      }
      return true;
    } catch {
      if (!silent) {
        this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
        sfx.ui(false);
      }
      return false;
    }
  }

  /** restore a saved sandbox world and jump straight into it */
  loadWorld(): boolean {
    let data: ReturnType<typeof JSON.parse>;
    try {
      const raw = storageGet(Engine.SAVE_KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!data || (data.v !== 1 && data.v !== 2 && data.v !== 3 && data.v !== 4)) return false;

    // fresh run scaffolding first (clears mobs/doors/trees/fluids/meshes)
    this.startRun(undefined, true);

    // then overwrite the world with the saved chunks
    this.world.reset(data.seed);
    this.chestInventories.clear();
    this.chestBonusGear.clear();
    this.activeChest = null;
    for (const [key, state, blocksRLE, heightRLE] of data.chunks) {
      const blocks = new Uint16Array(CHUNK * WY * CHUNK);
      const height = new Int16Array(CHUNK * CHUNK);
      Engine.rleDec(blocksRLE, blocks.length, blocks);
      Engine.rleDec(heightRLE, height.length, height);
      this.world.chunks.set(key, { blocks, height, state });
    }
    if (Array.isArray(data.chests)) {
      for (const entry of data.chests) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
        const items = new Map<number, number>();
        for (const rawPair of entry[1]) {
          if (!Array.isArray(rawPair)) continue;
          const id = Math.floor(Number(rawPair[0]));
          const count = Math.min(CHEST_STACK_LIMIT, Math.floor(Number(rawPair[1])));
          if (id > AIR && BLOCKS[id] && Number.isFinite(count) && count > 0) items.set(id, count);
        }
        this.chestInventories.set(entry[0], items);
      }
    }
    if (Array.isArray(data.chestBonusGear)) {
      for (const entry of data.chestBonusGear) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) continue;
        const items = entry[1].filter((item: unknown) => item && typeof item === 'object').map((item: Item) => ensureGearHid(item));
        if (items.length) this.chestBonusGear.set(entry[0], items);
      }
    }
    this.clearAllMeshes();

    // player + progress state
    this.pos.set(data.pos[0], data.pos[1], data.pos[2]);
    this.spawnX = data.pos[0];
    this.spawnY = data.pos[1];
    this.spawnZ = data.pos[2];
    this.yaw = data.yaw;
    this.pitch = data.pitch;
    this.health = data.health;
    this.score = data.score;
    this.scoreBonusMultiplier = Number.isFinite(data.scoreBonusMultiplier)
      ? Math.max(1, Math.min(5, Number(data.scoreBonusMultiplier)))
      : 1;
    this.oreBoostMultiplier = Number.isFinite((data as any).oreBoostMultiplier)
      ? Math.max(1, Math.min(5, Number((data as any).oreBoostMultiplier)))
      : 1;
    this.inventory = new Map(Array.isArray(data.inventory) ? data.inventory : []);
    const desiredToolCounts = new Map<number, number>();
    for (const [id, count] of this.inventory) {
      if (isDurabilityTool(id) && count > 0) desiredToolCounts.set(id, Math.max(0, Math.floor(count)));
    }
    this.toolInstances.clear();
    this.nextToolInstanceId = 1;
    const madeCounts = new Map<number, number>();
    const maxInstanceId = { value: 0 };
    const savedInstances: unknown[] = Array.isArray(data.toolInstances) ? data.toolInstances : [];
    for (const raw of savedInstances) {
      if (!raw || typeof raw !== 'object') continue;
      const record = raw as Partial<ToolInstance>;
      const id = Number(record.id);
      const instanceId = Number(record.instanceId);
      const spec = getToolSpec(id);
      const wanted = desiredToolCounts.get(id) ?? 0;
      const made = madeCounts.get(id) ?? 0;
      if (!spec || !Number.isInteger(instanceId) || instanceId <= 0 || made >= wanted || this.toolInstances.has(instanceId)) continue;
      const durability = normalizeToolDurability(id, record.durability);
      if (spec.maxDurability > 0 && durability <= 0) continue;
      this.toolInstances.set(instanceId, { id, instanceId, durability });
      madeCounts.set(id, made + 1);
      maxInstanceId.value = Math.max(maxInstanceId.value, instanceId);
    }
    // v1 saves have no instance table. Create one full-condition record for each
    // owned tool copy; v2 saves are also repaired defensively if a record is missing.
    for (const [id, wanted] of desiredToolCounts) {
      let made = madeCounts.get(id) ?? 0;
      const spec = getToolSpec(id)!;
      while (made < wanted) {
        let instanceId = Math.max(this.nextToolInstanceId, maxInstanceId.value + 1);
        while (this.toolInstances.has(instanceId)) instanceId++;
        const item = { id, instanceId, durability: spec.maxDurability };
        this.toolInstances.set(instanceId, item);
        made++;
        madeCounts.set(id, made);
        maxInstanceId.value = Math.max(maxInstanceId.value, instanceId);
      }
      if (made > 0) this.inventory.set(id, made);
      else this.inventory.delete(id);
    }
    this.nextToolInstanceId = Math.max(1, Number(data.nextToolInstanceId) || 1, maxInstanceId.value + 1);

    // Normalize the quick bar; JSON round-trips empty holes as null. Older saves
    // have only a type ID, so bind each visible tool to one distinct instance.
    const rawBar: unknown[] = Array.isArray(data.hotbar) ? (data.hotbar as unknown[]) : [HAND];
    this.hotbar = rawBar.slice(0, 10).map((x) => {
      if (typeof x !== 'number') return undefined;
      // In v1–v3, id 199 was HAND; v4 reclaims it for large cooked crab.
      return data.v < 4 && x === 199 ? HAND : x;
    });
    const rawInstanceBar: unknown[] = Array.isArray(data.hotbarInstanceIds) ? data.hotbarInstanceIds : [];
    this.hotbarInstanceIds = Array.from({ length: this.hotbar.length }, () => undefined);
    const usedInstances = new Set<number>();
    for (let i = 0; i < this.hotbar.length; i++) {
      const id = this.hotbar[i];
      if (id === undefined || !isDurabilityTool(id)) continue;
      const rawInstanceId = Number(rawInstanceBar[i]);
      const savedInstance = Number.isInteger(rawInstanceId) ? this.toolInstances.get(rawInstanceId) : undefined;
      const instance = savedInstance?.id === id && !usedInstances.has(rawInstanceId)
        ? savedInstance
        : [...this.toolInstances.values()].find((item) => item.id === id && !usedInstances.has(item.instanceId));
      if (instance) {
        this.hotbarInstanceIds[i] = instance.instanceId;
        usedInstances.add(instance.instanceId);
      } else {
        this.hotbar[i] = undefined;
      }
    }
    this.selected = Math.max(0, Math.min(9, Number(data.selected) || 0));
    const oldTier = Math.max(0, Math.min(PICKAXE_TIERS.length - 1, Number(data.tier) || 0));
    this.tier = data.v === 1 && oldTier >= 3 ? oldTier + 1 : oldTier;
    const oldSwordTier = Number(data.swordTier);
    this.swordTier = data.v === 1 ? (oldSwordTier === 1 ? 2 : oldSwordTier === 2 ? 4 : oldSwordTier) : oldSwordTier;
    this.equipped = data.equipped ?? {};
    this.bagItems = (data.bagItems ?? []).map((it: Item) => ensureGearHid(it));
    this.stats = computeStats(this.equipped);
    this.syncAvatarArmor();
    this.hiveHoney = new Map(data.hive ?? []);
    this.birdNests = (Array.isArray(data.birdNests) ? data.birdNests : []).slice(0, 6);
    this.vineTips = new Map((Array.isArray(data.vineTips) ? data.vineTips : []).slice(0, 128));
    this.kills = data.kills ?? 0;
    this.blocksMined = data.blocksMined ?? 0;
    this.survivalNight = data.survivalNight ?? 0;
    this.firstSurvivalDay = data.firstSurvivalDay ?? false;
    this.clock = data.clock ?? 0.3;
    this.visualClimateReady = false;
    this.updateClock(0);
    this.wasNight = this.isNightClock();
    this.recalcOwnedToolTiers();
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  private clearAllMeshes() {
    const wipe = (m2: Map<number, THREE.Mesh>) => {
      for (const [, mesh] of m2) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
      }
      m2.clear();
    };
    wipe(this.chunkMeshes);
    wipe(this.cutoutMeshes);
    wipe(this.waterMeshes);
    wipe(this.decorMeshes);
    this.clearAllChestLids();
    this.clearAllCampfireVisuals();
    this.meshedEmpty.clear();
    this.geometryBandByKey.clear();
    this.dirtyChunks.clear();
    this.dirtyMeshJob = null;
    this.activeStreamJob = null;
    this.activeStreamKey = null;
  }

  // ================= PHASE CONTROL =================
  startRun(seconds?: number, sandbox = false): boolean {
    // Starting from a freshly regenerated menu seed needs only the spawn surface. Deep terrain stays
    // in the streaming queue and will be completed before a nearby underground chunk is needed.
    const deferStarterWildlife = this.menuWorldStreaming && !this.menuWorldStarterSeeded;
    if (deferStarterWildlife) {
      const cx = Math.floor(ORIGIN_X / CHUNK);
      const cz = Math.floor(ORIGIN_Z / CHUNK);
      this.world.genSurface(cx, cz);
      this.world.decorate(cx, cz, true);
    }
    if (this.activeChest) this.closeActiveChest();
    const survivalRun = this.survival;
    this.clearWolfPetRig();
    refreshPetStateFromStorage();
    this.petOwnedKinds = [];
    if (hasWolfPet()) this.petOwnedKinds.push('wolf');
    if (hasCatPet()) this.petOwnedKinds.push('cat');
    if (hasMonkeyPet()) this.petOwnedKinds.push('monkey');
    if (hasParrotPet()) this.petOwnedKinds.push('parrot');
    if (hasOwlPet()) this.petOwnedKinds.push('owl');
    this.petOwned = this.petOwnedKinds.length > 0;
    this.petTokenAvailable = this.petOwned;
    this.petEquipped = false;
    this.petEquippedKind = null;
    this.playerSprinting = false;
    this.petSelectedKind = this.petOwnedKinds[0] ?? 'wolf';
    this.petCoatIndices = { wolf: getWolfCoatIndex(), cat: getCatCoatIndex(), monkey: getMonkeyCoatIndex(), parrot: getParrotCoatIndex(), owl: getOwlCoatIndex() };
    this.petCoatIndex = this.petCoatIndices[this.petSelectedKind];
    this.sandbox = sandbox;
    this.endlessRun = sandbox || survivalRun;
    initAudio();
    requestMusic();
    if (survivalRun) this.runTime = 0;
    else this.runTime = seconds && seconds > 0 ? seconds : EXPLORATION_RUN_TIME;
    this.score = 0;
    this.scoreBonusMultiplier = 1;
    this.oreBoostMultiplier = 1;
    this.timeLeft = this.runTime;
    this.explorationObjectives = !survivalRun && !sandbox
      ? EXPLORATION_TASKS.map((task) => ({ ...task, progress: 0 }))
      : [];
    this.objectiveIndex = 0;
    this.health = 100;
    this.breathState = createBreathState();
    this.staminaState = createStaminaState();
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.blocksMined = 0;
    this.oresFound = 0;
    this.deepest = 0;
    this.tier = 0;
    this.inventory.clear();
    this.toolInstances.clear();
    this.nextToolInstanceId = 1;
    this.hotbar = [];
    this.hotbarInstanceIds = [];
    this.selected = 0;
    this.deathCause = null;
    this.inventoryOpen = false;
    this.activeChest = null;
    this.lastCraft = null;
    this.tutorialTip = null;
    this.tutorialTipTimer = 0;
    this.tutorialTipQueue.length = 0;
    this.tutorialPending.clear();
    this.craftTipScanTimer = 0;
    this.vel.set(0, 0, 0);
    this.mineProgress = 0;
    this.mineBlockKey = '';
    this.mineDenyKey = '';
    this.swingT = -1;
    this.shake = 0;
    this.shakeMag = 0;
    this.flash = 0;
    this.warnTick = 0;
    this.hurtTimer = 0;
    this.reviveShield = 0;
    this.inLava = false;
    this.cactusCooldown = 0;
    this.particles.length = 0;
    this.pMesh.count = 0;
    this.drops.forEach((d) => {
      d.active = false;
      d.mesh.visible = false;
      d.toolInstance = null;
      d.petCarried = false;
      if (d.fancy) {
        this.scene.remove(d.fancy);
        disposeObject(d.fancy);
        d.fancy = null;
      }
    });
    this.popups.forEach((p) => {
      p.life = 0;
      p.el.style.opacity = '0';
    });
    [DIRT, COBBLE, SAND, PLANKS, STONE, LEAVES].forEach((id) => this.inventory.set(id, 0));
    // the bare hand starts in slot 1 — it can be dragged to any slot later
    this.hotbar = [HAND];
    this.selected = 0;
    this.swordTier = -1;
    this.equipped = {};
    this.syncAvatarArmor();
    this.bagItems = [];
    this.stats = { ...EMPTY_STATS };
    this.kills = 0;
    this.killedBy = null;
    this.attackCd = 0;
    this.survivalNight = 0;
    this.firstSurvivalDay = survivalRun;
    if (survivalRun) this.clock = SURVIVAL_START_CLOCK;
    else if (sandbox) this.clock = MENU_EXPLORER_CLOCK;
    this.visualClimateReady = false;
    this.sleeping = false;
    this.sleepDark = 0;
    this.crouching = false;
    this.crouchLerp = 0;
    this.crawling = false;
    this.crawlLerp = 0;
    this.touchCrouch = false;
    this.touchCrawl = false;
    this.crawlYaw = this.yaw;
    this.swimLerp = 0;
    this.spawnTimer = 3;
    this.animalTimer = 1;
    this.ambientTimer = 1.5;
    this.mobSys.clear();
    this.clearFallingTrees();
    this.clearDoors();
    this.gravQueue.length = 0;
    this.gravSet.clear();
    this.fluidQueue.length = 0;
    this.fluidSet.clear();
    this.fluidLevel.clear();
    this.vineTips.clear();
    this.birdNests.length = 0;
    this.birdNestTimer = 10;
    this.guardedSites.clear();
    this.clearArrows();
    this.rollTraderOffers();
    // traders now wander in from the wild as you travel (see wanderTraderTimer)
    this.wanderTraderTimer = 15;
    this.stockedWater.clear();
    this.travelDir.x = 0;
    this.travelDir.z = 0;
    this.travelSpeed = 0;
    this.turtleEggs.length = 0;
    this.eggTimer = 12;
    this.hiveHoney.clear();
    this.hiveBees.clear();
    this.predTimer = 0;
    this.spiderEggs.length = 0;
    this.spiderTimer = 10;
    const [x, y, z] = this.world.findSpawn();
    this.pos.set(x, y, z);
    this.spawnY = y;
    this.spawnX = x;
    this.spawnZ = z;
    this.fallStart = y;
    this.yaw = this.world.spawnYawFor(x, z);
    this.pitch = -0.1;
    this.updateClock(0);
    this.wasNight = this.isNightClock();
    if (!deferStarterWildlife) this.seedStarterWildlife(x, z, this.yaw);
    this.menuWorldStarterSeeded = !deferStarterWildlife;
    this.deepest = 0;
    this.phase = 'playing';
    this.banner = null;
    this.pushBanner(t('shiftStart'), t('shiftStartSub'), '#f4b942');
    this.updatePickaxe();
    sfx.start();
    this.requestLock();
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** Apply persisted shop supplies after a fresh run or sandbox world has loaded. */
  grantShopRewardItems(items: Array<readonly [number, number]>): boolean {
    const inventoryBefore = new Map(this.inventory);
    const hotbarBefore = this.hotbar.slice();
    const hotbarInstancesBefore = this.hotbarInstanceIds.slice();
    let received = 0;
    for (const [id, rawCount] of items) {
      const count = Math.floor(rawCount);
      if (!Number.isInteger(id) || id <= AIR || !BLOCKS[id] || count <= 0) continue;
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
      this.addToHotbar(id);
      received += count;
    }
    if (!received) return false;
    if (this.sandbox && !this.saveWorld(true)) {
      // Do not consume a queued monthly grant when the persistent sandbox could not store it.
      this.inventory = inventoryBefore;
      this.hotbar = hotbarBefore;
      this.hotbarInstanceIds = hotbarInstancesBefore;
      this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
      this.syncHotbar(true);
      this.syncHud(true);
      return false;
    }
    this.pushBanner(t('shopDropItemsBannerTitle'), t('shopDropItemsBannerSub'), '#62e8dc');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  rewardedDropMode(): RewardedDropMode {
    return this.sandbox ? 'own-world' : this.survival ? 'survival' : 'exploration';
  }

  inventoryCount(id: number): number {
    return Math.max(0, this.inventory.get(id) ?? 0);
  }

  /**
   * Account-bound reward chests/bags mirror the unopened packs of this mode: the inventory count is set to
   * the number still waiting (never stacked), so restarting a run or reloading a world cannot duplicate them.
   */
  syncRewardedPackTokens(entries: ReadonlyArray<readonly [number, number]>): boolean {
    let changed = false;
    let gained = 0;
    for (const [id, rawCount] of entries) {
      if (!isRewardedDropChestItem(id)) continue;
      const count = Math.max(0, Math.floor(rawCount));
      const had = this.inventory.get(id) ?? 0;
      if (had === count) continue;
      if (count > 0) {
        this.inventory.set(id, count);
        this.addToHotbar(id);
      } else {
        this.inventory.delete(id);
      }
      gained += Math.max(0, count - had);
      changed = true;
    }
    if (!changed) return false;
    if (gained > 0) this.pushBanner(t('rewardPackReadyTitle'), t('rewardPackReadySub'), '#f4b942');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** Apply paid shop products after a run/world has loaded; the receipts stay queued on save failure. */
  grantShopProductRewards(products: readonly string[]): boolean {
    const inventoryBefore = new Map(this.inventory);
    const hotbarBefore = this.hotbar.slice();
    const hotbarInstancesBefore = this.hotbarInstanceIds.slice();
    const toolsBefore = new Map(this.toolInstances);
    const bagBefore = this.bagItems.slice();
    const nextToolIdBefore = this.nextToolInstanceId;
    const tierBefore = this.tier;
    const swordTierBefore = this.swordTier;
    const scoreBonusBefore = this.scoreBonusMultiplier;
    const oreBoostBefore = this.oreBoostMultiplier;
    let received = 0;

    const grantBlocks = (items: readonly (readonly [number, number])[]) => {
      for (const [id, count] of items) {
        if (!BLOCKS[id] || !Number.isInteger(count) || count <= 0) continue;
        this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
        this.addToHotbar(id);
        received += count;
      }
    };
    const grantArmorSet = (material: Material, rarity: Rarity, slots: readonly Slot[] = ['head', 'chest', 'legs', 'feet']) => {
      for (const slot of slots) {
        this.bagItems.push(ensureGearHid(makeItem(slot, material, rarity, Math.random)));
        received += 1;
      }
    };

    for (const product of products) {
      switch (product) {
        case 'armor-uncommon':
          grantArmorSet('iron', 0);
          break;
        case 'armor-rare':
          grantArmorSet('gold', 1);
          break;
        case 'armor-epic':
          grantArmorSet('netherite', 2);
          break;
        case 'netherite-pickaxe':
          if (this.addToolInstance(PICK_TOOLS[5])) received += 1;
          break;
        case 'netherite-armor':
          grantArmorSet('netherite', 3, ['head', 'chest', 'legs', 'feet', 'hands', 'offhand']);
          break;
        // Apply any receipts that were queued by the previous diamond-tier shop unchanged.
        case 'diamond-pickaxe':
          if (this.addToolInstance(PICK_TOOLS[4])) received += 1;
          break;
        case 'diamond-armor':
          grantArmorSet('diamond', 3, ['head', 'chest', 'legs', 'feet', 'hands', 'offhand']);
          break;
        case 'chest-common':
          grantBlocks([[SHOP_CHEST_COMMON, 1]]);
          break;
        case 'chest-rare':
          grantBlocks([[PLANKS, 24], [COAL, 12], [COOKED_MEAT, 8], [TORCH, 12], [IRON, 5], [GOLD, 2], [CHEST_STORAGE, 1]]);
          this.bagItems.push(ensureGearHid(makeItem('chest', 'iron', 1, Math.random)));
          received += 1;
          break;
        case 'chest-epic':
          grantBlocks([[PLANKS, 32], [TORCH, 16], [IRON, 10], [GOLD, 5], [DIAMOND, 2], [CHEST_STORAGE, 2]]);
          this.bagItems.push(ensureGearHid(makeItem('chest', 'netherite', 2, Math.random)));
          received += 1;
          break;
        case 'booster-start':
          // Starter kit for next run — now more generous so visible in explorer inventory
          grantBlocks([[PLANKS, 24], [COAL, 12], [COOKED_MEAT, 8], [TORCH, 12], [APPLE, 3]]);
          if (this.addToolInstance(PICK_TOOLS[1])) received += 1;
          if (this.addToolInstance(PICK_TOOLS[0])) received += 1;
          break;
        case 'booster-ore':
          // Ore cache + temporary ore seeker: grants ores and marks next run with ore highlight
          grantBlocks([[COAL, 24], [IRON, 16], [GOLD, 8], [DIAMOND, 4], [REDSTONE, 8], [LAPIS, 6]]);
          this.oreBoostMultiplier += 0.5;
          received += 1;
          break;
        case 'booster-score':
          this.scoreBonusMultiplier += 0.25;
          received += 1;
          break;
      }
    }
    if (!received) return false;

    this.recalcOwnedToolTiers();
    if (this.sandbox && !this.saveWorld(true)) {
      this.inventory = inventoryBefore;
      this.hotbar = hotbarBefore;
      this.hotbarInstanceIds = hotbarInstancesBefore;
      this.toolInstances = toolsBefore;
      this.bagItems = bagBefore;
      this.nextToolInstanceId = nextToolIdBefore;
      this.tier = tierBefore;
      this.swordTier = swordTierBefore;
      this.scoreBonusMultiplier = scoreBonusBefore;
      this.oreBoostMultiplier = oreBoostBefore;
      this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
      this.syncHotbar(true);
      this.syncHud(true);
      return false;
    }

    this.pushBanner(t('shopItemBannerTitle'), t('shopItemBannerSub'), '#f4b942');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  openRewardedPack(itemId: number): boolean {
    const isShopChest = itemId === SHOP_CHEST_COMMON || itemId === SHOP_CHEST_RARE || itemId === SHOP_CHEST_EPIC;
    const dropId = rewardedDropIdFromChestItem(itemId);
    if (this.phase !== 'playing' || (!dropId && !isShopChest)) {
      sfx.ui(false);
      return false;
    }
    const owned = this.inventory.get(itemId) ?? 0;
    if (owned <= 0) {
      sfx.ui(false);
      return false;
    }

    // Shop chests: fixed loot, no adDrop receipt needed
    if (isShopChest) {
      const inventoryBefore = new Map(this.inventory);
      const hotbarBefore = this.hotbar.slice();
      const hotbarInstancesBefore = this.hotbarInstanceIds.slice();
      const bagBefore = this.bagItems.slice();
      const toolsBefore = new Map(this.toolInstances);
      const nextToolIdBefore = this.nextToolInstanceId;
      const tierBefore = this.tier;
      const swordTierBefore = this.swordTier;

      const grantBlocks = (items: readonly (readonly [number, number])[]) => {
        for (const [id, count] of items) {
          if (!BLOCKS[id] || count <= 0) continue;
          this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
          this.addToHotbar(id);
        }
      };

      if (itemId === SHOP_CHEST_COMMON) {
        grantBlocks([[PLANKS, 16], [COAL, 10], [COOKED_MEAT, 5], [TORCH, 8], [CHEST_STORAGE, 1]] as any);
      } else if (itemId === SHOP_CHEST_RARE) {
        grantBlocks([[PLANKS, 24], [COAL, 12], [COOKED_MEAT, 8], [TORCH, 12], [IRON, 5], [GOLD, 2], [CHEST_STORAGE, 1]] as any);
        this.bagItems.push(ensureGearHid(makeItem('chest', 'iron', 1, Math.random())));
      } else if (itemId === SHOP_CHEST_EPIC) {
        grantBlocks([[PLANKS, 32], [TORCH, 16], [IRON, 10], [GOLD, 5], [DIAMOND, 2], [CHEST_STORAGE, 2]] as any);
        this.bagItems.push(ensureGearHid(makeItem('chest', 'netherite', 2, Math.random())));
      }

      if (owned - 1 > 0) this.inventory.set(itemId, owned - 1);
      else this.inventory.delete(itemId);
      if ((this.inventory.get(itemId) ?? 0) <= 0) {
        for (let i = 0; i < this.hotbar.length; i += 1) {
          if (this.hotbar[i] === itemId) {
            this.hotbar[i] = undefined;
            this.hotbarInstanceIds[i] = undefined;
          }
        }
      }
      this.recalcOwnedToolTiers();
      if (this.sandbox && !this.saveWorld(true)) {
        this.inventory = inventoryBefore;
        this.hotbar = hotbarBefore;
        this.hotbarInstanceIds = hotbarInstancesBefore;
        this.toolInstances = toolsBefore;
        this.bagItems = bagBefore;
        this.nextToolInstanceId = nextToolIdBefore;
        this.tier = tierBefore;
        this.swordTier = swordTierBefore;
        this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
        this.syncHotbar(true);
        this.syncHud(true);
        return false;
      }
      const accent = itemId === SHOP_CHEST_COMMON ? '#c4a060' : itemId === SHOP_CHEST_RARE ? '#6ab0e0' : '#c080ff';
      this.pushBanner(t('rewardPackOpenedTitle'), blockName(itemId, BLOCKS[itemId]?.name ?? ''), accent);
      this.popup(this.pos.x, this.pos.y + 1.45, this.pos.z, t('rewardPackOpenedPopup'), accent, true);
      this.syncHotbar(true);
      this.syncHud(true);
      return true;
    }

    const mode = this.rewardedDropMode();
    const opened = openRewardedDropPack(dropId!, mode);
    if (!opened.ok) {
      if (opened.reason === 'storage') this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
      else sfx.ui(false);
      return false;
    }

    const inventoryBefore = new Map(this.inventory);
    const hotbarBefore = this.hotbar.slice();
    const hotbarInstancesBefore = this.hotbarInstanceIds.slice();
    const toolsBefore = new Map(this.toolInstances);
    const bagBefore = this.bagItems.slice();
    const nextToolIdBefore = this.nextToolInstanceId;
    const tierBefore = this.tier;
    const swordTierBefore = this.swordTier;

    for (const [id, count] of opened.items) {
      if (!BLOCKS[id] || !Number.isInteger(count) || count <= 0) continue;
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
      this.addToHotbar(id);
    }
    for (const toolId of opened.tools) this.addToolInstance(toolId);
    for (const gear of opened.gear) this.bagItems.push(ensureGearHid(gear));

    if (owned - 1 > 0) this.inventory.set(itemId, owned - 1);
    else this.inventory.delete(itemId);
    if ((this.inventory.get(itemId) ?? 0) <= 0) {
      for (let i = 0; i < this.hotbar.length; i += 1) {
        if (this.hotbar[i] === itemId) {
          this.hotbar[i] = undefined;
          this.hotbarInstanceIds[i] = undefined;
        }
      }
    }
    this.recalcOwnedToolTiers();

    if (this.sandbox && !this.saveWorld(true)) {
      this.inventory = inventoryBefore;
      this.hotbar = hotbarBefore;
      this.hotbarInstanceIds = hotbarInstancesBefore;
      this.toolInstances = toolsBefore;
      this.bagItems = bagBefore;
      this.nextToolInstanceId = nextToolIdBefore;
      this.tier = tierBefore;
      this.swordTier = swordTierBefore;
      rollbackOpenedRewardedDropPack(opened.receiptKey, mode);
      this.pushBanner(t('saveFailed'), t('saveFailedSub'), '#e2564a');
      this.syncHotbar(true);
      this.syncHud(true);
      return false;
    }

    const accent = itemId === REWARD_PACK_DAILY ? '#f4b942' : itemId === REWARD_PACK_WEEKLY ? '#62e8dc' : '#8fb8ff';
    this.pushBanner(t('rewardPackOpenedTitle'), blockName(itemId, BLOCKS[itemId]?.name ?? ''), accent);
    this.popup(this.pos.x, this.pos.y + 1.45, this.pos.z, t('rewardPackOpenedPopup'), accent, true);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  private seedStarterWildlife(x: number, z: number, yaw: number) {
    const fwdAngle = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
    const biome = this.world.biomeAt(Math.floor(x), Math.floor(z));
    const isDry = biome === 'desert' || biome === 'canyon';
    const species: MobId[] =
      biome === 'winter'
        ? ['penguin', 'seal', 'rabbit', 'fawn']
        : isDry
          ? ['tumbleweed', 'tumbleweed', 'camel', 'camel_calf', 'lizard']
          : biome === 'jungle'
            ? ['bird', 'monkey', 'bee', 'frog', 'rabbit']
            : ['cow', 'sheep', 'chicken', 'rabbit', 'cat', 'deer'];
    const preferredGround = isDry ? [SAND] : biome === 'winter' ? [SNOW_GRASS] : [GRASS];
    for (const id of species) {
      const spot = this.mobSys.findSpawnPoint(x, z, 6, 22, fwdAngle, preferredGround, id);
      if (spot) this.mobSys.spawn(id, spot[0], spot[1], spot[2]);
    }
  }

  regenerate(seed?: number) {
    const nextSeed = seed ?? this.pickBalancedSeed();
    this.mobSys?.clear();
    this.clearFallingTrees();
    this.clearDoors();
    this.clearAllMeshes();
    this.queueWorldGen(nextSeed, true);
  }

  pause(bySystem = false) {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.pausedBySystem = bySystem;
    this.mining = false;
    this.placing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.ui(false);
    this.syncHud(true);
  }

  resume(bySystem = false) {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.pausedBySystem = false;
    if (!bySystem) sfx.ui(true);
    // a pointer-lock request needs a user gesture; after a platform resume there usually was none, and a
    // refused request would only flag lockFailed — the HUD's "click to capture the mouse" covers that case
    if (!this.inventoryOpen && (!bySystem || navigator.userActivation?.isActive)) this.requestLock();
    this.syncHud(true);
  }

  /**
   * Yandex Games asks the game to pause (ad or purchase window, tab switch, minimised window, focus moved
   * to another window) — or the tab was hidden: freeze the run and silence the audio. The platform calls
   * GameplayAPI.stop() for these on its own, so the game has to actually stop. This remains true when the
   * live inventory is open: a system pause always takes precedence over crafting.
   */
  systemPause() {
    this.pause(true);
    suspendAudio();
  }

  /**
   * …and the counterpart: the platform calls GameplayAPI.start() on its own, so a run that *the system*
   * froze continues. A pause the player chose (Esc or menu) is never undone behind their back.
   */
  systemResume() {
    resumeAudio();
    if (this.phase === 'paused' && this.pausedBySystem) this.resume(true);
  }

  toMenu() {
    if (this.activeChest) this.closeActiveChest();
    this.clearWolfPetRig();
    this.petEquipped = false;
    this.petEquippedKind = null;
    this.petTokenAvailable = this.petOwned;
    this.phase = 'menu';
    this.inventoryOpen = false;
    this.sandbox = false;
    this.endlessRun = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.mining = false;
    this.setMenuClockForMode();
    requestMusic();
    this.syncHud(true);
  }

  setCharacterCustomization(value: CharacterCustomization) {
    this.characterCustomization = sanitizeCharacterCustomization(value);
    this.applyCharacterCustomization();
  }

  setSurvival(v: boolean) {
    this.survival = v;
    if (this.phase === 'menu' || this.phase === 'loading') this.setMenuClockForMode();
    if (!v) {
      // explorer mode clears anything hostile already walking around
      for (let i = this.mobSys.mobs.length - 1; i >= 0; i--) {
        const m = this.mobSys.mobs[i];
        if (m.def.hostile) this.mobSys.remove(m);
      }
    }
    this.syncHud(true);
  }

  /** Register the sink that records what the player does (see src/game/multiplayer.ts). */
  onPose(fn: ((pose: PlayerPose) => void) | null) {
    this.poseSink = fn;
  }

  setRunTime(seconds: number) {
    this.runTime = seconds;
    if (this.phase === 'menu' || this.phase === 'loading') this.timeLeft = seconds;
    this.syncHud(true);
  }

  endRun(cause: 'time' | 'lava' | 'fall' | 'mob') {
    if (this.phase !== 'playing') return;
    if (this.activeChest) this.closeActiveChest();
    this.sleeping = false;
    this.sleepDark = 0;
    this.phase = 'gameover';
    this.deathCause = cause;
    this.mining = false;
    this.addShake(cause === 'time' ? 0.25 : 1.1);
    this.flash = 1;
    if (document.pointerLockElement) document.exitPointerLock();
    if (cause !== 'mob') this.killedBy = null;
    if (cause === 'time') sfx.win();
    else sfx.gameOver();
    // let the jingle breathe, then bring the theme back under the score screen
    window.setTimeout(() => {
      if (this.phase === 'gameover') requestMusic();
    }, 1800);
    // End-of-run feedback uses a dissolve/fire color rather than a blood-like death burst.
    const endColor = cause === 'time' ? [255, 220, 120] : cause === 'lava' ? [255, 140, 40] : [143, 204, 216];
    this.burst(this.pos.x, this.pos.y + 1, this.pos.z, endColor, 34, 5);
    this.syncHud(true);
  }

  /**
   * Reward of a rewarded video: continue the same run instead of ending it. Called by the app after
   * `onRewarded` fired, so the platform really counted the view (see src/game/ads.ts).
   */
  reviveAfterAd(seconds = 60): boolean {
    if (this.phase !== 'gameover') return false;
    if (this.activeChest) this.closeActiveChest();
    const cause = this.deathCause;
    this.phase = 'playing';
    this.deathCause = null;
    this.killedBy = null;
    this.flash = 0;
    this.sleeping = false;
    this.sleepDark = 0;
    this.mining = false;
    this.placing = false;
    this.inventoryOpen = false;
    this.health = Math.max(this.health, 50);
    if (this.runTime > 0) this.timeLeft = Math.max(this.timeLeft, seconds);
    // death in lava or in the void would repeat instantly, so those two come back at the spawn
    if (cause === 'lava' || cause === 'fall') {
      this.pos.set(this.spawnX, this.spawnY, this.spawnZ);
      this.vel.set(0, 0, 0);
    }
    this.reviveShield = 3;
    this.pushBanner(t('adRevived'), t('adRevivedSub'), '#5fe8dc');
    sfx.upgrade();
    stopMusic(0.3);
    this.requestLock();
    this.syncHud(true);
    return true;
  }

  private gameOverState(): HudState['deathCause'] {
    return this.deathCause;
  }

  // ================= LOOP =================
  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const elapsed = Math.max(0, (t - this.last) / 1000);
    this.last = t;
    let dt = elapsed;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 1 / 60;
    this.time += dt;
    this.updateSpecialSunFrame();
    this.syncSpecialSunSound();
    this.frameNo++;

    // Store the sandbox shortly after the player stops editing it (requirement 1.9). Silent: the
    // player is still building, and a banner over the crosshair would only be in the way.
    if (this.worldAutosaveDue(t)) this.saveWorld(true);

    // Track real frame gaps for quality decisions; keep simulation dt capped after stalls.
    this.fpsAcc += Math.min(elapsed, 0.5);
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (this.fps < 56) {
        this.slowFrames++;
        this.fastFrames = 0;
        if (this.slowFrames >= 2) {
          // Reduce GPU fill cost first, then the visible horizon. Never wait for catastrophic FPS.
          const pixelRatio = this.renderer.getPixelRatio();
          if (pixelRatio > this.minPixelRatio + 0.01)
            this.renderer.setPixelRatio(Math.max(this.minPixelRatio, pixelRatio - Math.max(0.14, pixelRatio * 0.18)));
          else if (this.renderDist > this.minRenderDist + 1)
            this.setRenderDist(this.renderDist - 8);
          this.slowFrames = 0;
        }
      } else if (this.fps >= 59) {
        this.fastFrames++;
        this.slowFrames = 0;
        if (this.fastFrames >= 4) {
          if (this.renderer.getPixelRatio() < this.basePixelRatio - 0.01)
            this.renderer.setPixelRatio(Math.min(this.basePixelRatio, this.renderer.getPixelRatio() + 0.08));
          else if (this.renderDist < this.maxRenderDist) this.setRenderDist(this.renderDist + 4);
          this.fastFrames = 0;
        }
      } else {
        this.slowFrames = 0;
        this.fastFrames = 0;
      }
    }

    if (this.phase === 'loading') this.stepLoading();
    else if (this.phase === 'menu') this.updateMenu(dt);
    else if (this.phase === 'playing') this.updatePlay(dt);
    else if (this.phase === 'paused') this.updateIdle(dt);
    else this.updateGameOver(dt);

    this.updateCompanions(dt);
    this.updateWolfPet(dt);
    if (this.poseSink && this.phase === 'playing') {
      this.poseAcc += dt;
      if (this.poseAcc >= 0.25) {
        this.poseAcc = 0;
        this.poseSink(this.playerPose());
      }
    }
    this.render();
  };

  private stepLoading() {
    // Time-slice CPU-heavy terrain and mesh work so loading never freezes the animation loop.
    const t0 = performance.now();
    while (this.loadTasks.length && performance.now() - t0 < 7) {
      const done = this.loadTasks[0]();
      if (done) this.loadTasks.shift();
    }
    this.loadProgress = this.loadTotal ? 1 - this.loadTasks.length / this.loadTotal : 0;
    if (!this.loadTasks.length) {
      this.phase = 'menu';
      this.loadProgress = 1;
      requestMusic();
      this.syncHud(true);
    } else {
      // re-render React only when the visible percentage actually changes
      const pct = Math.round(this.loadProgress * 100);
      if (pct !== this.lastLoadPct) {
        this.lastLoadPct = pct;
        this.syncHud(true);
      }
    }
  }
  private lastLoadPct = -1;

  private updateMenu(dt: number) {
    this.menuAngle += dt * 0.06;
    const cx = ORIGIN_X,
      cz = ORIGIN_Z;
    const r = 34 + Math.sin(this.menuAngle * 0.45) * 8;
    const h = this.world.getHeight(cx, cz) || 18;
    const ax = cx + Math.cos(this.menuAngle) * r;
    const az = cz + Math.sin(this.menuAngle) * r;
    let camY = h + 20 + Math.sin(this.menuAngle * 0.7) * 3;
    camY = Math.max(camY, this.world.topSolidY(Math.floor(ax), Math.floor(az)) + 4);
    this.camera.position.set(ax, camY, az);
    this.camera.lookAt(cx, h - 2, cz);
    this.camera.fov += (66 - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
    this.updateAmbient(dt);
    if (this.menuWorldStreaming) {
      this.streamChunks(ORIGIN_X + 0.5, ORIGIN_Z + 0.5, 3, true);
      this.flushDirtyChunks();
      this.finishMenuWorldStreamingIfReady();
    }
    this.syncHud(false);
  }

  private finishMenuWorldStreamingIfReady() {
    if (!this.menuWorldStreaming) return;
    const centerX = Math.floor(ORIGIN_X / CHUNK);
    const centerZ = Math.floor(ORIGIN_Z / CHUNK);
    if (!this.menuWorldStarterSeeded) {
      let coreReady = true;
      for (let dz = -1; dz <= 1 && coreReady; dz++)
        for (let dx = -1; dx <= 1; dx++)
          if (!this.world.hasTerrain(centerX + dx, centerZ + dz)) { coreReady = false; break; }
      if (coreReady) {
        const [x, , z] = this.world.findSpawn();
        this.spawnX = x;
        this.spawnZ = z;
        this.spawnY = this.world.getHeight(Math.floor(x), Math.floor(z)) + 1.02;
        this.yaw = this.world.spawnYawFor(x, z);
        this.seedStarterWildlife(x, z, this.yaw);
        this.menuWorldStarterSeeded = true;
      }
    }
    if (!this.menuWorldStarterSeeded) return;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++)
        if (this.geometryBandByKey.get(chunkKey(centerX + dx, centerZ + dz)) !== this.meshBandKey) return;
    this.menuWorldStreaming = false;
  }

  private updateIdle(dt: number) {
    this.updateAmbient(dt);
    this.updateParticles(dt);
    this.syncHud(false);
  }

  private updateGameOver(dt: number) {
    this.updateAmbient(dt);
    this.updateParticles(dt);
    this.updateDrops(dt, true);
    // slow cinematic orbit around the player
    this.menuAngle += dt * 0.22;
    const eye = this.pos.y + EYE;
    const r = 4.2;
    const camPos = new THREE.Vector3(this.pos.x + Math.cos(this.menuAngle) * r, eye + 1.1, this.pos.z + Math.sin(this.menuAngle) * r);
    const gx = Math.floor(camPos.x),
      gz = Math.floor(camPos.z);
    if (this.world.inBounds(gx, 0, gz)) camPos.y = Math.max(camPos.y, this.world.topSolidY(gx, gz) + 1.4);
    this.camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(this.pos.x, this.pos.y + 0.9, this.pos.z);
    this.camera.rotation.z += Math.sin(this.time * 0.6) * 0.01;
    this.updateShake(dt);
    this.syncHud(false);
  }

  private updatePlay(dt: number) {
    // ---- sleeping: cinematic time-lapse to dawn ----
    if (this.sleeping) {
      this.sleepDark = Math.min(1, this.sleepDark + dt * 2.2);
      // the shift clock keeps ticking — sleep isn't free time (endless modes have no shift clock)
      if (!this.endlessRun) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.endRun('time');
          return;
        }
      }
      // fast-forward the sun; wake at early morning (clock ≈ 0.3)
      this.clock = (this.clock + dt * 0.22) % 1;
      this.updateClock(0);
      if (this.clock > 0.28 && this.clock < 0.5) {
        this.sleeping = false;
        this.health = Math.min(100, this.health + 25);
        this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+25 ${t('hp')}`, '#93c95d', true);
        this.pushBanner(t('sunRises'), t('sunRisesSub'), '#ffc86a');
        sfx.start();
      }
      this.updateMobs(dt);
      this.updateParticles(dt);
      this.updateAmbient(dt);
      this.updateCamera(dt);
      this.syncHud(false);
      return;
    }
    this.sleepDark = Math.max(0, this.sleepDark - dt * 1.6);

    this.updateHoverLook(dt);
    this.updateClock(dt);
    this.updatePlayer(dt);
    this.updateTarget();
    if (this.placing || this.placeOnce || this.touchPlace || this.keys['KeyF']) {
      this.placeOnce = false;
      this.tryPlace();
    }
    if (this.attackCd > 0) this.attackCd -= dt;
    this.streamChunks(this.pos.x, this.pos.z);
    if (this.menuWorldStreaming) this.finishMenuWorldStreamingIfReady();
    this.updateMobs(dt);
    this.updateGuards(dt);
    this.updateNature(dt);
    this.updateHiveFx(dt);
    this.updateArrows(dt);
    this.updateStuckArrows();
    this.updateFallingTrees(dt);
    this.updateChestLids(dt);
    this.updateBlockGravity();
    this.growVines(dt);
    this.growWheatCrops(dt);
    this.updateFluids();
    this.flushDirtyChunks();
    this.updateMining(dt);

    // night / dawn announcements
    const isNight = this.isNightClock();
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      if (this.survival) {
        if (isNight) {
          this.survivalNight += 1;
          this.firstSurvivalDay = false;
          this.strengthenExistingHostiles();
          this.pushBanner(t('nightFalls'), t('nightFallsSub'), '#6f8bd8');
        } else {
          this.pushBanner(t('sunRises'), t('sunRisesSub'), '#ffc86a');
        }
      }
    }
    this.updateDrops(dt, false);
    this.updateParticles(dt);
    this.updateAmbient(dt);
    this.updateShake(dt);
    this.updateCamera(dt);

    // endless modes have no shift clock — stay as long as you like
    if (!this.endlessRun) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 10.5) {
        this.warnTick -= dt;
        if (this.warnTick <= 0) {
          this.warnTick = this.timeLeft <= 5 ? 0.32 : 0.7;
          sfx.tickWarn();
        }
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endRun('time');
        return;
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.syncHud(true);
      }
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.banner = null;
        this.syncHud(true);
      }
    }
    this.updateTutorialTip(dt);
    this.updateCraftReadyTip(dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.reviveShield = Math.max(0, this.reviveShield - dt);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.syncHud(false);
  }

  // ================= PLAYER =================
  private angleDelta(to: number, from: number) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  private playerHalfExtents(crawling = this.crawling, yaw = this.crawlYaw) {
    if (!crawling) return { halfX: PLAYER_HALF, halfZ: PLAYER_HALF };
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // The prone third-person body is long in the facing direction.  Use the
    // oriented body's AABB for physics too, otherwise the visual avatar can
    // slide through walls while the tiny standing footprint still fits.
    return {
      halfX: Math.abs(sin) * CRAWL_HALF_LENGTH + Math.abs(cos) * CRAWL_HALF_WIDTH,
      halfZ: Math.abs(cos) * CRAWL_HALF_LENGTH + Math.abs(sin) * CRAWL_HALF_WIDTH,
    };
  }

  private collides(px: number, py: number, pz: number, crawling = this.crawling, yaw = this.crawlYaw) {
    const { halfX, halfZ } = this.playerHalfExtents(crawling, yaw);
    const minX = Math.floor(px - halfX),
      maxX = Math.floor(px + halfX);
    const minY = Math.floor(py),
      maxY = Math.floor(py + this.playerHeight(crawling) - 0.001);
    const minZ = Math.floor(pz - halfZ),
      maxZ = Math.floor(pz + halfZ);
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        for (let x = minX; x <= maxX; x++) if (isSolid(this.world.get(x, y, z))) return true;
    return this.mobSys.collidesWithMob(px, py, pz, halfX, halfZ, this.playerHeight(crawling));
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number) {
    if (amount === 0) return { blocked: false, top: 0 };
    const p = this.pos;
    const start = p[axis];
    const startX = p.x;
    const startY = p.y;
    const startZ = p.z;
    p[axis] += amount;
    const { halfX, halfZ } = this.playerHalfExtents();
    const minX = Math.floor(p.x - halfX),
      maxX = Math.floor(p.x + halfX);
    const minY = Math.floor(p.y),
      maxY = Math.floor(p.y + this.playerHeight() - 0.001);
    const minZ = Math.floor(p.z - halfZ),
      maxZ = Math.floor(p.z + halfZ);
    let blocked = false;
    let top = 0;
    let best = amount > 0 ? Infinity : -Infinity;
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (!isSolid(this.world.get(x, y, z))) continue;
          blocked = true;
          top = Math.max(top, y + 1);
          const coord = axis === 'y' ? y : axis === 'x' ? x : z;
          best = amount > 0 ? Math.min(best, coord) : Math.max(best, coord);
        }
      }
    }
    if (blocked) {
      const eps = 0.0005;
      if (axis === 'y') p.y = amount > 0 ? best - this.playerHeight() - eps : best + 1 + eps;
      else if (axis === 'x') p.x = amount > 0 ? best - halfX - eps : best + 1 + halfX + eps;
      else p.z = amount > 0 ? best - halfZ - eps : best + 1 + halfZ + eps;
      this.vel[axis] = 0;
      if (axis === 'y' && amount < 0) this.onGround = true;
    }
    if (this.mobSys.collidesAlongMobPath(
      startX, startY, startZ, p.x, p.y, p.z, halfX, halfZ, this.playerHeight(),
    )) {
      // Sweep intermediate positions so a lag spike cannot carry the player through a small animal.
      p[axis] = start;
      this.vel[axis] = 0;
      blocked = true;
      if (axis === 'y' && amount < 0) this.onGround = true;
    }
    return { blocked, top };
  }

  private nearWaterExitLedge(dirX: number, dirZ: number): boolean {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.05) return false;
    dirX /= len;
    dirZ /= len;
    const sideX = dirZ;
    const sideZ = -dirX;
    const front = PLAYER_HALF + 0.48;
    const baseY = Math.floor(this.pos.y + 0.1);
    for (const side of [-0.22, 0, 0.22]) {
      const x = Math.floor(this.pos.x + dirX * front + sideX * side);
      const z = Math.floor(this.pos.z + dirZ * front + sideZ * side);
      // Check for a real solid bank block with dry open AIR above it (not water!)
      // so holding forward + jump only mantles when actually climbing out onto dry land.
      for (let y = baseY - 1; y <= baseY + 2; y++) {
        const solid = isSolid(this.world.get(x, y, z));
        if (!solid) continue;
        const above1 = this.world.get(x, y + 1, z);
        const above2 = this.world.get(x, y + 2, z);
        const isDryAirAbove = above1 !== WATER && !isSolid(above1) && above2 !== WATER && !isSolid(above2);
        if (!isDryAirAbove) continue;
        const stepHeight = (y + 1) - this.pos.y;
        if (stepHeight >= -0.2 && stepHeight <= 1.85) return true;
      }
    }
    return false;
  }

  private updatePlayer(dt: number) {
    const k = this.keys;
    const wasInWater = this.inWater;
    let fx = 0,
      fz = 0;
    if (k['KeyW'] || k['ArrowUp']) fz += 1;
    if (k['KeyS'] || k['ArrowDown']) fz -= 1;
    // On a TV the remote has four arrows and no mouse: left/right turn the view instead of strafing
    // (strafe stays on A/D for keyboards), so the whole game can be played from the remote.
    if (k['KeyA'] || (k['ArrowLeft'] && !this.tv)) fx -= 1;
    if (k['KeyD'] || (k['ArrowRight'] && !this.tv)) fx += 1;
    if (this.tv && this.phase === 'playing' && !this.crawling) {
      const turn = 2.3; // rad/s — comfortable for a remote's repeated presses
      if (k['ArrowLeft']) this.yaw += turn * dt;
      if (k['ArrowRight']) this.yaw -= turn * dt;
    }
    fx += this.touchMove.x;
    fz += -this.touchMove.y;
    // C = crawl (prone, fits 1-block gaps); CTRL = crouch; touch buttons toggle those same states.
    const wantCrawl = !!k['KeyC'] || this.touchCrawl;
    if (wantCrawl && !this.crawling) {
      // Lie down in the direction the player is facing; do not pick a sideways
      // fallback, because that makes the avatar appear to clip through walls.
      if (!this.collides(this.pos.x, this.pos.y, this.pos.z, true, this.yaw)) {
        this.crawlYaw = this.yaw;
        this.crawling = true;
      }
    } else if (!wantCrawl && this.crawling) {
      // stand up only if there is headroom for the full-height box
      this.crawling = false;
      if (this.collides(this.pos.x, this.pos.y, this.pos.z, false, this.yaw)) this.crawling = true; // stuck in a tunnel — stay prone
    }
    if (this.crawling) {
      // While prone, rotate the body only as far as the elongated crawl
      // footprint still fits.  This prevents a lying avatar from sweeping
      // through nearby blocks just because the camera was turned.
      const delta = this.angleDelta(this.yaw, this.crawlYaw);
      const maxTurn = dt * 5.6;
      const step = Math.max(-maxTurn, Math.min(maxTurn, delta));
      if (Math.abs(step) > 0.0001) {
        const candidate = this.crawlYaw + step;
        if (!this.collides(this.pos.x, this.pos.y, this.pos.z, true, candidate)) this.crawlYaw = candidate;
        else {
          const smaller = this.crawlYaw + step * 0.35;
          if (!this.collides(this.pos.x, this.pos.y, this.pos.z, true, smaller)) this.crawlYaw = smaller;
        }
      }
    } else {
      this.crawlYaw = this.yaw;
    }
    this.crouching = !this.crawling && !!(k['ControlLeft'] || k['ControlRight'] || this.touchCrouch);
    const sprintIntent =
      !this.crouching && !this.crawling && (k['ShiftLeft'] || k['ShiftRight'] || this.touchSprint) && fz > 0.1;
    const len = Math.hypot(fx, fz);
    if (len > 1) {
      fx /= len;
      fz /= len;
    }
    const swimmingMove = wasInWater && !this.crawling;
    const sprint = sprintIntent && len > 0.2 && canSprint(this.staminaState);

    const sin = Math.sin(this.yaw),
      cos = Math.cos(this.yaw);
    // forward = -Z rotated by yaw
    const wx = fx * cos - fz * sin;
    const wz = -fx * sin - fz * cos;

    const speed = this.crawling ? WALK * 0.3 : this.crouching ? WALK * 0.45 : swimmingMove ? (sprint ? SWIM_SPRINT : WALK * 0.78) : sprint ? SPRINT : WALK;
    const accel = swimmingMove ? 28 : this.onGround ? 58 : 16;
    const targetVX = wx * speed;
    const targetVZ = wz * speed;
    const maxD = accel * dt;
    this.vel.x += Math.max(-maxD, Math.min(maxD, targetVX - this.vel.x));
    this.vel.z += Math.max(-maxD, Math.min(maxD, targetVZ - this.vel.z));
    if (this.onGround && len < 0.05) {
      // standing on ice? barely any grip — you keep gliding
      const under = this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.5), Math.floor(this.pos.z));
      const fr = Math.pow(under === ICE ? 0.35 : 0.0008, dt);
      this.vel.x *= fr;
      this.vel.z *= fr;
    }

    // jump — with coyote time so edge-of-a-ledge jumps still feel fair. On a TV a single-block step
    // is climbed automatically while walking forward: a remote sends one press at a time and the
    // player should not have to fight the terrain with it.
    const autoStep = this.tv && fz > 0.1 && this.onGround && this.tvAutoJump();
    const jumpHeld = (k['Space'] || this.touchJump || autoStep) && !this.crouching && !this.crawling;
    if (jumpHeld && !wasInWater && (this.onGround || this.coyote > 0)) {
      this.vel.y = JUMP_V;
      this.onGround = false;
      this.coyote = 0;
      sfx.jump();
      this.burst(this.pos.x, this.pos.y + 0.05, this.pos.z, [210, 200, 180], 6, 1.6);
    }

    // gravity (lighter while holding jump for variable height; in water buoyancy governs vertical motion)
    let g = wasInWater ? 0 : GRAVITY;
    if (!wasInWater && this.vel.y > 0 && !jumpHeld) g *= 1.9;
    this.vel.y -= g * dt;
    this.vel.y = Math.max(-52, this.vel.y);
    // Vines and crafted ladders share a gentle climb assist; W/Space climbs ladders, S descends.
    const vr = PLAYER_HALF + 0.13;
    let onVine = false;
    let onLadder = false;
    for (const xx of [this.pos.x - vr, this.pos.x + vr])
      for (const zz of [this.pos.z - vr, this.pos.z + vr])
        for (const yy of [this.pos.y + 0.35, this.pos.y + 1.25]) {
          const climbBlock = this.world.get(Math.floor(xx), Math.floor(yy), Math.floor(zz));
          if (climbBlock === VINE) onVine = true;
          else if (isLadder(climbBlock)) onLadder = true;
        }
    if (onVine || onLadder) {
      const climbUp = jumpHeld || (onLadder && fz > 0.1);
      const climbDown = onLadder && fz < -0.1;
      this.vel.y = climbUp ? Math.max(this.vel.y, 3.5) : climbDown ? Math.min(this.vel.y, -2.2) : Math.max(this.vel.y, -1.5);
      this.fallStart = this.pos.y;
    }

    const wasGround = this.onGround;
    this.onGround = false;

    const ox = this.pos.x,
      oz = this.pos.z;

    // crouch edge-guard: refuse steps that would carry you over a drop
    if (this.crouching && this.onGround) {
      const supported = (px: number, pz: number) =>
        isSolid(this.world.get(Math.floor(px), Math.floor(this.pos.y - 0.6), Math.floor(pz))) ||
        isSolid(this.world.get(Math.floor(px), Math.floor(this.pos.y - 1.4), Math.floor(pz)));
      if (this.vel.x !== 0 && !supported(this.pos.x + Math.sign(this.vel.x) * (PLAYER_HALF + 0.06) + this.vel.x * dt, this.pos.z))
        this.vel.x = 0;
      if (this.vel.z !== 0 && !supported(this.pos.x, this.pos.z + Math.sign(this.vel.z) * (PLAYER_HALF + 0.06) + this.vel.z * dt))
        this.vel.z = 0;
    }

    const rx = this.moveAxis('x', this.vel.x * dt);
    const rz = this.moveAxis('z', this.vel.z * dt);

    // step assist: glide up single blocks so traversal stays fluid (not while prone)
    if (wasGround && !this.crawling && (rx.blocked || rz.blocked)) {
      const target = Math.max(rx.top, rz.top);
      if (target > this.pos.y && target - this.pos.y <= 1.02) {
        const oy = this.pos.y;
        this.pos.y = target;
        if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
          this.pos.y = oy;
        } else {
          this.moveAxis('x', this.vel.x * dt - (this.pos.x - ox));
          this.moveAxis('z', this.vel.z * dt - (this.pos.z - oz));
          this.stepSmooth = Math.max(this.stepSmooth, target - oy);
          this.onGround = true;
        }
      }
    }

    this.moveAxis('y', this.vel.y * dt);

    // landing
    if (this.onGround && !wasGround) {
      const fall = this.fallStart - this.pos.y;
      const hard = fall > 3.2;
      sfx.land(hard);
      this.landDip = Math.min(0.42, fall * 0.035);
      if (hard) {
        this.addShake(Math.min(0.55, fall * 0.045));
        this.burst(this.pos.x, this.pos.y + 0.06, this.pos.z, [196, 182, 158], 10, 2.2);
      }
      if (fall > 5) {
        const dmg = Math.round((fall - 5) * 7.5);
        if (dmg > 0) this.damage(dmg, 'fall');
      }
    }
    if (!this.onGround && this.vel.y > 0) this.fallStart = Math.max(this.fallStart, this.pos.y);
    if (this.onGround) this.fallStart = this.pos.y;

    // water: buoyant swim, no damage
    this.inWater = false;
    {
      const bx = Math.floor(this.pos.x);
      const bz = Math.floor(this.pos.z);
      for (const probe of [0.08, 0.38, 0.75, 1.15]) {
        if (this.world.get(bx, Math.floor(this.pos.y + probe), bz) === WATER) {
          this.inWater = true;
          break;
        }
      }
    }
    if (this.inWater) {
      const forwardIntent = fz > 0.12;
      const nearShore = jumpHeld && forwardIntent && this.nearWaterExitLedge(wx, wz);
      const surfaceY = this.visualWaterSurfaceY();
      let targetVy = -0.55;
      if (forwardIntent && Math.abs(this.pitch) > 0.16) {
        // Looking down while swimming dives head-first; looking up rises without
        // turning the body into a standing/walking pose.
        targetVy = Math.max(-2.9, Math.min(2.55, Math.sin(this.pitch) * 3.9));
      }
      if (nearShore) {
        // True shore exit ledge detected: assist the player smoothly up onto the dry bank.
        targetVy = Math.max(targetVy, 4.9);
      } else if (jumpHeld) {
        if (surfaceY !== null && this.pos.y + 0.72 >= surfaceY) {
          // Open water surface: hold the swimmer smoothly at the surface cruising level,
          // keeping the head in the air, legs in water, without leaping out or jittering.
          const surfaceFloatY = surfaceY - 0.72;
          const floatDiff = surfaceFloatY - this.pos.y;
          targetVy = Math.max(-0.6, Math.min(1.4, floatDiff * 6.0));
        } else {
          // Submerged in water: Space provides smooth, continuous upward ascent.
          targetVy = Math.max(targetVy, 2.75);
        }
      } else if (surfaceY !== null && this.pos.y + 0.8 >= surfaceY && (!forwardIntent || Math.abs(this.pitch) <= 0.16)) {
        // Natural surface buoyancy when idle or swimming horizontally near the surface
        const surfaceFloatY = surfaceY - 0.72;
        const floatDiff = surfaceFloatY - this.pos.y;
        targetVy = Math.max(-0.7, Math.min(1.0, floatDiff * 4.5));
      }
      const vyBlend = Math.min(1, dt * (nearShore ? 12 : jumpHeld ? 8.5 : 4.6));
      this.vel.y += (targetVy - this.vel.y) * vyBlend;
      this.vel.x *= Math.pow(0.38, dt);
      this.vel.z *= Math.pow(0.38, dt);
      this.fallStart = this.pos.y; // water breaks any fall
    }

    const breath = stepBreath(this.breathState, this.headUnderwater(), dt);
    this.breathState = breath.state;
    if (breath.damage > 0) {
      this.killedBy = t('drowning');
      this.damage(breath.damage, 'mob');
    }

    // lava / void hazard
    this.inLava = false;
    const fx0 = Math.floor(this.pos.x - PLAYER_HALF),
      fx1 = Math.floor(this.pos.x + PLAYER_HALF);
    const fy0 = Math.floor(this.pos.y),
      fy1 = Math.floor(this.pos.y + PLAYER_HEIGHT);
    const fz0 = Math.floor(this.pos.z - PLAYER_HALF),
      fz1 = Math.floor(this.pos.z + PLAYER_HALF);
    for (let y = fy0; y <= fy1; y++)
      for (let z = fz0; z <= fz1; z++)
        for (let x = fx0; x <= fx1; x++) if (this.world.get(x, y, z) === LAVA) this.inLava = true;
    if (this.inLava) {
      // you can still swim for the ledge — holding jump claws you upward
      this.vel.y = jumpHeld ? Math.max(this.vel.y, 4.1) : Math.min(this.vel.y, 2.0);
      this.vel.x *= Math.pow(0.12, dt);
      this.vel.z *= Math.pow(0.12, dt);
      this.hurtTimer = 0.35;
      this.flash = Math.max(this.flash, 0.55);
      this.damage(26 * dt, 'lava');
      if (Math.random() < dt * 22) {
        this.burst(this.pos.x + (Math.random() - 0.5) * 0.6, this.pos.y + 0.3, this.pos.z + (Math.random() - 0.5) * 0.6, [255, 140, 40], 2, 2);
      }
    }

    // Cactus spines hurt on body contact, even though the solid block stops
    // the player just short of its centre. Explorer mode remains harmless.
    this.cactusCooldown = Math.max(0, this.cactusCooldown - dt);
    if (this.survival && this.cactusCooldown <= 0) {
      const reach = PLAYER_HALF + 0.12;
      let touching = false;
      for (let y = fy0; y <= fy1 && !touching; y++)
        for (let z = Math.floor(this.pos.z - reach); z <= Math.floor(this.pos.z + reach) && !touching; z++)
          for (let x = Math.floor(this.pos.x - reach); x <= Math.floor(this.pos.x + reach); x++) {
            const block = this.world.get(x, y, z);
            if (block === CACTUS || block === CACTUS_PALE) {
              touching = true;
              break;
            }
          }
      if (touching) {
        this.cactusCooldown = 0.75;
        this.killedBy = blockName(CACTUS, 'Cactus');
        this.damage(4, 'mob');
      }
    }

    // no world bounds any more — the map streams in forever
    if (this.pos.y < -6) this.damage(200, 'fall');

    this.deepest = Math.max(this.deepest, Math.round(this.spawnY - this.pos.y));
    this.coyote = this.onGround ? 0.11 : Math.max(0, this.coyote - dt);
    const planar = Math.hypot(this.vel.x, this.vel.z);
    this.bob += dt * (this.inWater ? 1.9 + planar * 1.75 + (jumpHeld ? 1.25 : 0) : this.onGround ? planar * 1.55 : 3.2);
    this.stepSmooth = Math.max(0, this.stepSmooth - dt * 3.4);
    const sprinting = sprint && planar > 0.5;
    this.playerSprinting = sprinting;
    this.staminaState = stepStamina(this.staminaState, sprinting, dt);
    // Hunger drains slowly while exploring; at zero it causes periodic starvation damage.
    this.hunger = Math.max(0, this.hunger - dt * (sprinting ? 0.11 : 0.055));
    if (this.hunger <= 0) {
      this.hungerDamageTimer -= dt;
      if (this.hungerDamageTimer <= 0) { this.hungerDamageTimer = 4; this.damage(2, 'mob'); }
    } else this.hungerDamageTimer = 0;
    this.fovTarget = sprinting ? 82 : 72;
  }

  private damage(amount: number, cause: 'lava' | 'fall' | 'mob') {
    if (this.phase !== 'playing') return;
    // right after a rewarded revive the player can land right in the middle of a mob pack:
    // a couple of seconds of immunity are better than an instant second death
    if (this.reviveShield > 0) return;
    this.health -= amount;
    if (amount > 3) {
      this.hurtTimer = 0.3;
      this.flash = Math.max(this.flash, Math.min(0.9, amount / 40));
      this.addShake(Math.min(0.6, amount / 45));
      sfx.hurt();
    }
    if (this.health <= 0) {
      this.health = 0;
      this.endRun(cause);
    } else if (amount > 3) {
      this.syncHud(true);
    }
  }

  private setPlayerAvatarOpacity(opacity: number) {
    const o = Math.max(0.05, Math.min(1, opacity));
    this.avatarOpacity = o;
    const fading = o < 0.985;
    const apply = (rec: AvatarFadeMaterial) => {
      const m = rec.material;
      m.opacity = rec.opacity * o;
      const targetTransparent = rec.transparent || fading;
      const targetDepthWrite = fading ? false : rec.depthWrite;
      if (m.transparent !== targetTransparent || m.depthWrite !== targetDepthWrite) {
        m.transparent = targetTransparent;
        m.depthWrite = targetDepthWrite;
        m.needsUpdate = true;
      }
    };
    this.avatarFadeMats.forEach(apply);
    for (const records of Object.values(this.avatarArmorFadeMats)) records?.forEach(apply);
  }

  private updatePlayerAvatarOpacity(cameraDist: number) {
    if (!this.thirdPerson || !this.playerAvatar?.visible) {
      this.setPlayerAvatarOpacity(1);
      return;
    }
    const near = 0.85;
    const far = 2.35;
    const t2 = Math.max(0, Math.min(1, (cameraDist - near) / (far - near)));
    const smooth = t2 * t2 * (3 - 2 * t2);
    this.setPlayerAvatarOpacity(0.18 + 0.82 * smooth);
  }

  private visualWaterSurfaceY() {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const top = Math.floor(this.pos.y + 2.4);
    const bottom = Math.floor(this.pos.y - 1.4);
    for (let y = top; y >= bottom; y--) {
      if (this.world.get(x, y, z) === WATER && this.world.get(x, y + 1, z) !== WATER) return y + 1;
    }
    return null;
  }

  private updatePlayerAvatar(dt: number) {
    if (!this.playerAvatar) return;
    const visible = this.thirdPerson && (this.phase === 'playing' || this.phase === 'paused');
    this.playerAvatar.visible = visible;
    const parrotCallStationary = Math.hypot(this.vel.x, this.vel.z) <= 0.45 && Math.abs(this.vel.y) <= 0.72;
    const companion = this.wolfPetRig;
    const activeBird = !!companion && isBirdCompanion(companion.kind) && this.petEquipped && companion.parrotCalled && !this.playerSprinting && !this.inWater && parrotCallStationary;
    this.parrotHandArmBlend += ((activeBird ? 1 : 0) - this.parrotHandArmBlend) * Math.min(1, dt * 9);
    const firstPersonArmVisible = !this.thirdPerson
      && (this.phase === 'playing' || this.phase === 'paused')
      && this.parrotHandArmBlend > 0.005;
    if (this.firstPersonParrotArm) this.firstPersonParrotArm.visible = firstPersonArmVisible;
    if (this.avatarFireFx) {
      this.avatarFireFx.visible = visible && this.stats.fire > 0;
      animateEnchantedFlames(this.avatarFireFx, this.time);
    }
    // The first-person view shows only a detached left-arm copy; update the hidden avatar pose
    // while that arm is extended so its world transform stays aligned with the bird's perch.
    if (!visible && !firstPersonArmVisible) return;
    if (visible) {
      for (const attachments of Object.values(this.avatarArmorModels)) {
        for (const attachment of attachments ?? []) animateArmorVisuals(attachment.group, this.time);
      }
      if (this.avatarSkirt && this.characterCustomization.gender === 'girl' && this.equipped.legs) {
        animateArmorVisuals(this.avatarSkirt, this.time);
      }
    }

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const crawl = clamp01(this.crawlLerp);
    const swim = clamp01(this.swimLerp) * (1 - crawl * 0.85);
    const yawBlend = this.yaw + this.angleDelta(this.crawlYaw, this.yaw) * crawl;
    const forwardX = -Math.sin(yawBlend);
    const forwardZ = -Math.cos(yawBlend);
    const waterSurface = swim > 0.01 ? this.visualWaterSurfaceY() : null;
    const nearSurface = waterSurface !== null && this.pos.y + 1.12 > waterSurface - 0.38;
    const underWater = swim > 0.01 && !nearSurface;
    const crawlShift = CRAWL_BODY_CENTER * crawl;
    const swimShift = CRAWL_BODY_CENTER * swim;
    const bodyShift = Math.max(crawlShift, swimShift);
    let avatarY = this.pos.y + crawl * 0.44;
    if (swim > 0.01) {
      // Visual-only water clamp: physics stays untouched, but the third-person
      // puppet no longer rises high above the water when Space is held.  Near
      // the surface the body stays submerged, leaving mostly head and arms visible.
      const followPhysicsY = this.pos.y + 0.52;
      const surfaceY = waterSurface !== null ? waterSurface - 0.14 : followPhysicsY;
      const swimY = nearSurface ? Math.min(followPhysicsY, surfaceY) : followPhysicsY;
      avatarY = mix(avatarY, swimY, swim);
    }
    this.playerAvatar.position.set(this.pos.x - forwardX * bodyShift, avatarY, this.pos.z - forwardZ * bodyShift);

    const crawlSpeed = WALK * 0.3;
    const swimSpeed = WALK * 0.78;
    const planarSpeed = Math.hypot(this.vel.x, this.vel.z);
    const uprightMove = Math.min(1, planarSpeed / WALK);
    const crawlMove = Math.min(1, planarSpeed / Math.max(0.01, crawlSpeed));
    const swimMove = Math.min(1, (planarSpeed + Math.abs(this.vel.y) * 0.45) / Math.max(0.01, swimSpeed));
    const surfaceSwimPitch = -Math.PI * 0.5 + Math.sin(this.bob * 2.15) * 0.025;
    const underwaterSwimPitch = -Math.PI * 0.5 + Math.max(-0.72, Math.min(0.62, this.pitch * 0.62));
    // On the surface, looking above the character means “swim forward”, not
    // “stand up out of the water”.  Only underwater does the puppet pitch fully
    // with the crosshair.
    const swimPitch = underWater ? underwaterSwimPitch : surfaceSwimPitch;
    const bodyPitch = mix(-Math.PI * 0.5 * crawl, swimPitch, swim);
    const crawlRoll = crawl * Math.min(0.14, crawlMove * 0.07) * Math.sin(this.bob * 4.2);
    const swimRoll = swim * Math.sin(this.bob * 2.8) * 0.025;
    this.playerAvatar.rotation.set(bodyPitch, yawBlend, mix(crawlRoll, swimRoll, swim));

    const squat = 1 - this.crouchLerp * 0.16;
    this.playerAvatar.scale.set(1, Math.max(0.78, squat), 1);

    const uprightSwing = Math.sin(this.bob * 2.35) * 0.55 * uprightMove;
    const uprightLegSwing = uprightSwing * (this.characterCustomization.gender === 'girl' ? GIRL_WALK_LEG_SWING_SCALE : 1);
    const miningSwing = this.swingT >= 0 ? Math.sin(Math.min(1, this.swingT) * Math.PI) * 0.95 : 0;
    const miningArmSwing = this.swingT >= 0 && this.heldKind() === 'pick'
      ? pickaxeStrikeArmAngle(this.swingT)
      : -miningSwing;

    const rightX = Math.cos(yawBlend);
    const rightZ = -Math.sin(yawBlend);
    const localForward = this.vel.x * forwardX + this.vel.z * forwardZ;
    const localSide = this.vel.x * rightX + this.vel.z * rightZ;
    const forwardAmt = Math.min(1, Math.abs(localForward) / Math.max(0.01, crawlSpeed));
    const sideAmt = Math.min(1, Math.abs(localSide) / Math.max(0.01, crawlSpeed));
    const fSign = localForward < -0.04 ? -1 : 1;
    const sSign = localSide < -0.04 ? -1 : 1;
    const wave = Math.sin(this.bob * 4.15);
    const wave2 = Math.cos(this.bob * 4.15);
    const activeCrawl = Math.min(1, forwardAmt + sideAmt);

    const crawlLeftArmX = -0.42 + fSign * wave * 0.48 * forwardAmt - 0.22 * sideAmt;
    const crawlRightArmX = -0.42 - fSign * wave * 0.48 * forwardAmt - 0.22 * sideAmt + miningArmSwing * 0.22;
    const crawlLeftLegX = 0.26 - fSign * wave * 0.32 * forwardAmt + 0.12 * sideAmt;
    const crawlRightLegX = 0.26 + fSign * wave * 0.32 * forwardAmt + 0.12 * sideAmt;
    const crawlLeftArmZ = sSign * (0.28 + wave2 * 0.24) * sideAmt + 0.1 * (1 - activeCrawl);
    const crawlRightArmZ = sSign * (-0.28 + wave2 * 0.24) * sideAmt - 0.1 * (1 - activeCrawl);
    const crawlLeftLegZ = sSign * (-0.18 + wave * 0.16) * sideAmt;
    const crawlRightLegZ = sSign * (0.18 + wave * 0.16) * sideAmt;

    const swimStroke = Math.sin(this.bob * 3.35);
    const swimKick = Math.sin(this.bob * 6.25);
    const swimSide = Math.min(1, Math.abs(localSide) / Math.max(0.01, swimSpeed));
    const swimForward = Math.min(1, Math.max(Math.abs(localForward), planarSpeed * 0.55) / Math.max(0.01, swimSpeed));
    const swimActive = Math.min(1, swimMove + (this.keys['Space'] || this.touchJump ? 0.45 : 0));
    // In swim pose the spine (+Y) points toward the crosshair.  Arms rotate
    // toward +Y too, so the silhouette reads as head + hands first and legs behind.
    const swimLeftArmX = 2.46 + swimStroke * 0.34 * swimForward - 0.08 * swimSide;
    const swimRightArmX = 2.46 - swimStroke * 0.34 * swimForward - 0.08 * swimSide - miningSwing * 0.08;
    const swimLeftLegX = 0.22 + swimKick * 0.24 * swimActive;
    const swimRightLegX = 0.22 - swimKick * 0.24 * swimActive;
    const swimLeftArmZ = sSign * (0.1 + Math.cos(this.bob * 3.35) * 0.18) * swimSide - 0.08 * swimForward;
    const swimRightArmZ = sSign * (-0.1 + Math.cos(this.bob * 3.35) * 0.18) * swimSide + 0.08 * swimForward;
    const swimLeftLegZ = sSign * -0.08 * swimSide;
    const swimRightLegZ = sSign * 0.08 * swimSide;

    let leftLegX = mix(uprightLegSwing, crawlLeftLegX, crawl);
    let rightLegX = mix(-uprightLegSwing, crawlRightLegX, crawl);
    let leftArmX = mix(-uprightSwing * 0.7, crawlLeftArmX, crawl);
    let rightArmX = mix(uprightSwing * 0.7 + miningArmSwing * (1 - crawl * 0.45), crawlRightArmX, crawl);
    let leftLegZ = crawlLeftLegZ * crawl;
    let rightLegZ = crawlRightLegZ * crawl;
    let leftArmZ = crawlLeftArmZ * crawl;
    let rightArmZ = crawlRightArmZ * crawl;
    leftLegX = mix(leftLegX, swimLeftLegX, swim);
    rightLegX = mix(rightLegX, swimRightLegX, swim);
    leftArmX = mix(leftArmX, swimLeftArmX, swim);
    rightArmX = mix(rightArmX, swimRightArmX, swim);
    leftLegZ = mix(leftLegZ, swimLeftLegZ, swim);
    rightLegZ = mix(rightLegZ, swimRightLegZ, swim);
    leftArmZ = mix(leftArmZ, swimLeftArmZ, swim);
    rightArmZ = mix(rightArmZ, swimRightArmZ, swim);
    // Hold the character's left arm out as a perch while the parrot answers the whistle.
    leftArmX = mix(leftArmX, 1.45, this.parrotHandArmBlend);
    leftArmZ = mix(leftArmZ, 0.035, this.parrotHandArmBlend);

    if (this.avatarLeftLeg) this.avatarLeftLeg.rotation.set(leftLegX, 0, leftLegZ);
    if (this.avatarRightLeg) this.avatarRightLeg.rotation.set(rightLegX, 0, rightLegZ);
    if (this.avatarLeftArm) this.avatarLeftArm.rotation.set(leftArmX, 0, leftArmZ);
    if (this.avatarRightArm) this.avatarRightArm.rotation.set(rightArmX, 0, rightArmZ);
    if (firstPersonArmVisible && this.firstPersonParrotArm && this.avatarLeftArm) {
      this.playerAvatar.updateMatrixWorld(true);
      this.avatarLeftArm.matrixWorld.decompose(
        this.firstPersonParrotArm.position,
        this.firstPersonParrotArm.quaternion,
        this.firstPersonParrotArm.scale,
      );
    }
    if (this.avatarHead) {
      const uprightHead = Math.max(-0.65, Math.min(0.65, this.pitch * 0.45));
      const crawlHead = Math.max(-0.25, Math.min(0.58, this.pitch * 0.22 + 0.26));
      const swimHead = underWater ? Math.max(-0.36, Math.min(0.48, this.pitch * 0.18)) : 0.16;
      this.avatarHead.rotation.set(mix(mix(uprightHead, crawlHead, crawl), swimHead, swim), 0, 0);
    }
  }

  private restoreThirdPersonOccluders() {
    for (const u of this.thirdPersonClipUniforms) u.active.value = 0;
    if (this.thirdPersonFogCap) this.thirdPersonFogCap.visible = false;
  }

  private isCameraObstacle(x: number, y: number, z: number) {
    return this.world.inBounds(x, y, z) && isSolid(this.world.get(x, y, z));
  }

  private resolveThirdPersonCamera(focus: THREE.Vector3, desired: THREE.Vector3) {
    const seg = new THREE.Vector3().subVectors(desired, focus);
    const dist = seg.length();
    if (dist < 0.35) return desired.clone();
    const dir = seg.multiplyScalar(1 / dist);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
    else right.normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const offsets: Array<[number, number]> = [
      [0, 0],
      [0.24, 0],
      [-0.24, 0],
      [0, 0.24],
      [0, -0.18],
      [0.17, 0.17],
      [-0.17, 0.17],
    ];
    const p = new THREE.Vector3();
    const step = 0.14;
    let hitT = Infinity;
    scan: for (let t = 0.42; t <= dist; t += step) {
      for (const [ox, oy] of offsets) {
        p.copy(focus).addScaledVector(dir, t).addScaledVector(right, ox).addScaledVector(up, oy);
        if (this.isCameraObstacle(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) {
          hitT = t;
          break scan;
        }
      }
    }
    if (hitT !== Infinity) {
      // Same idea as the referenced CameraCorrection: shorten the camera arm to
      // just before the hit point instead of carving a see-through hole in walls.
      const safeDist = Math.max(0.58, hitT - 0.34);
      return focus.clone().addScaledVector(dir, safeDist);
    }
    return desired.clone();
  }

  private updateCamera(dt: number) {
    const bobAmt = this.onGround ? Math.min(1, Math.hypot(this.vel.x, this.vel.z) / WALK) : 0;
    const bobY = Math.sin(this.bob * 2.2) * 0.055 * bobAmt;
    const bobX = Math.cos(this.bob * 1.1) * 0.045 * bobAmt;
    // smooth crouch dip + crawl drop (eye down to ~0.55 over the feet)
    this.crouchLerp += ((this.crouching ? 1 : 0) - this.crouchLerp) * Math.min(1, dt * 11);
    this.crawlLerp += ((this.crawling ? 1 : 0) - this.crawlLerp) * Math.min(1, dt * 9);
    this.swimLerp += ((this.inWater && !this.crawling ? 1 : 0) - this.swimLerp) * Math.min(1, dt * 7.5);
    const eyeDrop = this.crouchLerp * 0.42 + this.crawlLerp * (EYE - 0.52) + this.swimLerp * 0.5;
    const targetY = this.pos.y + EYE - eyeDrop - this.landDip + this.stepSmooth * 0.35 + bobY;
    // Third-person should not inherit the first-person head-bob/step bounce:
    // it made normal walking and sprinting feel like the camera was shaking.
    const thirdPersonTargetY = this.pos.y + EYE - eyeDrop - this.landDip * 0.16 + this.stepSmooth * 0.08;
    this.landDip = Math.max(0, this.landDip - dt * 1.6);
    this.updatePlayerAvatar(dt);

    if (this.thirdPerson && this.phase === 'playing') {
      this.updateThirdPersonOrbitReturn(dt);
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      const cameraYaw = this.yaw + this.thirdPersonOrbitYaw;
      const forward = new THREE.Vector3(-Math.sin(cameraYaw) * cp, sp, -Math.cos(cameraYaw) * cp).normalize();
      const rawFocus = new THREE.Vector3(this.pos.x, thirdPersonTargetY + 0.05, this.pos.z);
      if (!this.thirdPersonCamReady) this.thirdPersonFocus.copy(rawFocus);
      else this.thirdPersonFocus.lerp(rawFocus, 1 - Math.pow(0.0004, dt));
      const focus = this.thirdPersonFocus;
      const dist = this.crawling ? 3.6 : this.crouching ? 4.3 : 5.3;
      const desired = focus.clone().addScaledVector(forward, -dist);
      desired.y += 0.48;
      desired.y = Math.max(desired.y, this.pos.y + 0.58);
      const corrected = this.resolveThirdPersonCamera(focus, desired);
      if (!this.thirdPersonCamReady) {
        this.thirdPersonCam.copy(corrected);
        this.thirdPersonCamReady = true;
      } else {
        const currentDist = this.thirdPersonCam.distanceTo(focus);
        const correctedDist = corrected.distanceTo(focus);
        // Move inward fast, but no longer instantly.  If the camera itself ends
        // up inside a block, only then snap to the safe correction point.
        const inward = correctedDist < currentDist - 0.12;
        const alpha = inward ? 1 - Math.pow(0.00002, dt) : 1 - Math.pow(0.003, dt);
        const candidate = this.thirdPersonCam.clone().lerp(corrected, alpha);
        if (this.isCameraObstacle(Math.floor(candidate.x), Math.floor(candidate.y), Math.floor(candidate.z))) this.thirdPersonCam.copy(corrected);
        else this.thirdPersonCam.copy(candidate);
      }
      this.camera.position.copy(this.thirdPersonCam);
      this.updatePlayerAvatarOpacity(this.camera.position.distanceTo(focus));
      this.camera.lookAt(focus.clone().addScaledVector(forward, 9));
      this.camera.fov += ((this.fovTarget + 4) - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
      this.restoreThirdPersonOccluders();
    } else {
      this.thirdPersonCamReady = false;
      this.restoreThirdPersonOccluders();
      this.updatePlayerAvatarOpacity(Infinity);
      this.camera.position.set(this.pos.x + bobX * 0.35, targetY, this.pos.z);
      this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * 1.1) * 0.012 * bobAmt);
      this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    const sh = this.shakeMag * this.shake * (this.thirdPerson ? 0.32 : 1);
    if (sh > 0.0001) {
      this.camera.position.x += (Math.random() - 0.5) * sh * 0.55;
      this.camera.position.y += (Math.random() - 0.5) * sh * 0.55;
      this.camera.position.z += (Math.random() - 0.5) * sh * 0.55;
      this.camera.rotation.z += (Math.random() - 0.5) * sh * 0.09;
      this.camera.rotation.x += (Math.random() - 0.5) * sh * 0.035;
    }
    if (this.inLava) {
      this.camera.rotation.z += Math.sin(this.time * 12) * 0.012;
    }
  }

  private updateShake(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 3.1);
    if (this.shake === 0) this.shakeMag = 0;
  }

  private addShake(mag: number) {
    this.shakeMag = Math.min(1.4, Math.max(this.shakeMag * this.shake, 0) + mag);
    this.shake = 1;
  }

  private chooseWeather(biome: Biome) {
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    if (dry) {
      this.weatherTargetKind = 'clear';
      this.weatherTargetIntensity = 0;
      this.weatherTimer = 8 + this.rand() * 14;
      return;
    }
    const roll = this.rand();
    if (biome === 'winter') {
      this.weatherTargetKind = roll < 0.34 ? 'snow' : 'clear';
      this.weatherTargetIntensity = this.weatherTargetKind === 'snow' ? 0.45 + this.rand() * 0.45 : 0;
    } else {
      const rainChance = biome === 'jungle' ? 0.34 : 0.2;
      this.weatherTargetKind = roll < rainChance ? 'rain' : 'clear';
      this.weatherTargetIntensity = this.weatherTargetKind === 'rain' ? 0.35 + this.rand() * (biome === 'jungle' ? 0.55 : 0.42) : 0;
    }
    this.weatherTimer = this.weatherTargetKind === 'clear' ? 18 + this.rand() * 34 : 28 + this.rand() * 58;
  }

  private updateWeather(dt: number, biome: Biome) {
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    this.weatherTimer -= dt;
    if (dry || this.weatherTimer <= 0 || (biome === 'winter' && this.weatherKind === 'rain') || (biome !== 'winter' && this.weatherKind === 'snow')) {
      this.chooseWeather(biome);
    }
    if (this.weatherTargetKind !== 'clear') this.weatherKind = this.weatherTargetKind;
    const k = 1 - Math.pow(0.001, dt / (this.weatherTargetKind === 'clear' ? 4.5 : 6.5));
    this.weatherIntensity += (this.weatherTargetIntensity - this.weatherIntensity) * k;
    if (this.weatherIntensity < 0.035 && this.weatherTargetKind === 'clear') this.weatherKind = 'clear';
    this.spawnWeatherParticles(dt, biome);
  }

  private spawnWeatherParticles(dt: number, biome: Biome) {
    if (this.weatherKind === 'clear' || this.weatherIntensity <= 0.05) return;
    const dry = biome === 'desert' || biome === 'canyon' || biome === 'volcanic';
    if (dry) return;
    const surface = this.world.getHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (this.pos.y < surface - 1) return;
    const rain = this.weatherKind === 'rain';
    const rate = (rain ? 46 : 22) * this.weatherIntensity * (this.isCoarse() ? 0.55 : 1);
    this.weatherSpawnAcc += dt * rate;
    while (this.weatherSpawnAcc >= 1 && this.particles.length < MAX_PARTICLES - 32) {
      this.weatherSpawnAcc -= 1;
      const a = this.rand() * Math.PI * 2;
      const r = 4 + this.rand() * 25;
      const x = this.camera.position.x + Math.cos(a) * r;
      const z = this.camera.position.z + Math.sin(a) * r;
      const y = this.camera.position.y + 12 + this.rand() * 16;
      if (rain) {
        this.particles.push({
          weather: 'rain',
          x,
          y,
          z,
          vx: -2.3 - this.rand() * 1.6,
          vy: -18 - this.rand() * 8,
          vz: 0.6 + (this.rand() - 0.5) * 1.2,
          life: 1.2,
          max: 1.2,
          size: 0.045 + this.rand() * 0.02,
          r: 0.55,
          g: 0.72,
          b: 1,
        });
      } else {
        this.particles.push({
          weather: 'snow',
          x,
          y,
          z,
          vx: -0.35 + (this.rand() - 0.5) * 0.45,
          vy: -0.8 - this.rand() * 0.9,
          vz: (this.rand() - 0.5) * 0.55,
          life: 8.5,
          max: 8.5,
          size: 0.055 + this.rand() * 0.045,
          r: 0.9,
          g: 0.96,
          b: 1,
        });
      }
    }
  }

  private updatePlacedTorchLights(dt: number) {
    this.placedTorchScanTimer -= dt;
    if (this.placedTorchScanTimer > 0) return;
    this.placedTorchScanTimer = 0.85;
    if (!this.placedTorchLights.length) return;

    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y + 1);
    const pz = Math.floor(this.pos.z);
    const underground = this.pos.y < this.world.getHeight(px, pz) - 2;
    if (this.daylight > 0.78 && !underground) {
      for (const light of this.placedTorchLights) {
        light.visible = false;
        light.intensity = 0;
      }
      return;
    }
    const radius = 16;
    const y0 = Math.max(1, py - 8);
    const y1 = Math.min(WY - 1, py + 8);
    const found: Array<{ x: number; y: number; z: number; d2: number }> = [];
    for (let z = pz - radius; z <= pz + radius; z++) {
      for (let x = px - radius; x <= px + radius; x++) {
        const dx = x + 0.5 - this.pos.x;
        const dz = z + 0.5 - this.pos.z;
        const flat = dx * dx + dz * dz;
        if (flat > radius * radius) continue;
        for (let y = y0; y <= y1; y++) {
          if (this.world.get(x, y, z) !== TORCH) continue;
          const dy = y + 0.5 - (this.pos.y + 1.1);
          found.push({ x, y, z, d2: flat + dy * dy });
        }
      }
    }
    found.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.placedTorchLights.length; i++) {
      const light = this.placedTorchLights[i];
      const f = found[i];
      if (!f) {
        light.visible = false;
        light.intensity = 0;
        continue;
      }
      light.visible = true;
      light.position.set(f.x + 0.5, f.y + 0.55, f.z + 0.5);
      light.distance = 15 + (1 - this.daylight) * 3;
      light.intensity = 2.2 + (1 - this.daylight) * 1.5;
    }
  }

  private updateAmbientSoundscape(dt: number, biomeHere: Biome) {
    if (this.phase !== 'playing' || this.inventoryOpen) return;
    const night = this.isNightClock();
    if (!night) {
      this.cricketAudioTimer = Math.min(this.cricketAudioTimer, 2.5);
      this.owlAudioTimer = Math.min(this.owlAudioTimer, 8);
      this.wolfHowlAudioTimer = Math.min(this.wolfHowlAudioTimer, 12);
      this.dayBirdAudioTimer -= dt;
      if (this.dayBirdAudioTimer <= 0) {
        this.dayBirdAudioTimer = 10 + Math.random() * 17;
        if (!this.inWater && biomeHere !== 'desert' && Math.random() < 0.8) sfx.ambientBird();
        else if (Math.random() < 0.35) sfx.creature('rustle', { volume: 0.4, pan: (Math.random() - 0.5) * 0.3 });
      }
      return;
    }

    this.dayBirdAudioTimer = Math.min(this.dayBirdAudioTimer, 4);
    this.cricketAudioTimer -= dt;
    if (this.cricketAudioTimer <= 0) {
      this.cricketAudioTimer = 4.2 + Math.random() * 5.5;
      sfx.crickets();
    }
    this.owlAudioTimer -= dt;
    if (this.owlAudioTimer <= 0) {
      this.owlAudioTimer = 18 + Math.random() * 19;
      if (biomeHere !== 'desert' && Math.random() < 0.75) sfx.owl();
    }
    this.wolfHowlAudioTimer -= dt;
    if (this.wolfHowlAudioTimer <= 0) {
      this.wolfHowlAudioTimer = this.survival ? 30 + Math.random() * 25 : 42 + Math.random() * 28;
      if (Math.random() < (this.survival ? 0.8 : 0.45)) sfx.wolfHowl();
    }
  }

  private updateAmbient(dt: number) {
    const biomeHere = this.world.biomeAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    this.updateWeather(dt, biomeHere);
    this.updatePlacedTorchLights(dt);
    this.updateCampfireVisuals(dt);
    this.updateAmbientSoundscape(dt, biomeHere);
    // Grey smoke rises only from active volcanic craters within sight.
    this.volcanoSmokeTimer -= dt;
    if (this.volcanoSmokeTimer <= 0) {
      this.volcanoSmokeTimer = 0.18;
      const volcano = this.world.volcanoAt(this.pos.x, this.pos.z);
      if (volcano?.active && volcano.distance < 48 && this.world.hasColumn(Math.floor(volcano.x), Math.floor(volcano.z))) {
        const y = this.world.getHeight(Math.floor(volcano.x), Math.floor(volcano.z)) + 2.2;
        for (let i = 0; i < 2 && this.particles.length < MAX_PARTICLES; i++) {
          this.particles.push({
            smoke: true, x: volcano.x + (Math.random() - 0.5) * 2, y,
            z: volcano.z + (Math.random() - 0.5) * 2,
            vx: (Math.random() - 0.5) * 0.7, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.7,
            life: 2.6, max: 2.6, size: 0.24, r: 0.3, g: 0.29, b: 0.28,
          });
        }
      }
    }
    // Soft ground-level dust gusts in hot desert regions.
    this.desertWindTimer -= dt;
    if (this.desertWindTimer <= 0) {
      this.desertWindTimer = 0.09;
      if (this.world.biomeAt(Math.floor(this.pos.x),Math.floor(this.pos.z)) === 'desert' && Math.random()<0.65 && this.particles.length<MAX_PARTICLES) {
        this.particles.push({x:this.pos.x+(Math.random()-0.5)*18,y:this.pos.y+Math.random()*1.8,z:this.pos.z+(Math.random()-0.5)*18,
          vx:1.1+Math.random()*1.1,vy:0.08+Math.random()*0.15,vz:(Math.random()-0.5)*0.35,
          life:1.1+Math.random()*0.8,max:1.8,size:0.025+Math.random()*0.025,r:0.72,g:0.62,b:0.43});
      }
    }
    // clouds drift: deserts stay cloudless and harsh; rain/snow thickens the ceiling.
    const mat = this.clouds.material as THREE.MeshBasicMaterial;
    (mat.map as THREE.Texture).offset.x = (this.time * 0.0035) % 1;
    (mat.map as THREE.Texture).offset.y = (this.time * 0.0012) % 1;
    this.clouds.position.x = this.camera.position.x;
    this.clouds.position.z = this.camera.position.z;
    this.clouds.position.y = this.camera.position.y + 112;
    const drySky = biomeHere === 'desert' || biomeHere === 'canyon' || biomeHere === 'volcanic';
    const cloudTarget = drySky ? 0 : Math.min(0.46, 0.04 + this.daylight * 0.24 + this.weatherIntensity * 0.28);
    mat.opacity += (cloudTarget - mat.opacity) * Math.min(1, dt * 1.7);
    this.clouds.visible = mat.opacity > 0.025;

    // motes wrap around the camera (updated at half rate — they drift slowly)
    if ((this.frameNo & 1) === 0) {
    const attr = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const cx = this.camera.position.x,
      cy = this.camera.position.y,
      cz = this.camera.position.z;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += Math.sin(this.time * 0.4 + i) * 0.004;
      arr[i + 1] += 0.006 + Math.cos(this.time * 0.3 + i) * 0.003;
      arr[i + 2] += Math.cos(this.time * 0.35 + i) * 0.004;
      const dx = arr[i] - cx,
        dy = arr[i + 1] - cy,
        dz = arr[i + 2] - cz;
      if (dx > 20) arr[i] -= 40;
      if (dx < -20) arr[i] += 40;
      if (dz > 20) arr[i + 2] -= 40;
      if (dz < -20) arr[i + 2] += 40;
      if (dy > 13) arr[i + 1] -= 26;
      if (dy < -13) arr[i + 1] += 26;
    }
    attr.needsUpdate = true;
    (this.motes.material as THREE.PointsMaterial).opacity = 0.28 + Math.sin(this.time * 1.6) * 0.1;
    }

    // pickaxe idle + swing
    const idle = Math.sin(this.time * 2.1) * 0.012;
    let sx = 0,
      sy = 0,
      sz = 0,
      px = 0,
      py = 0;
    if (this.swingT >= 0) {
      this.swingT += dt / this.swingDur;
      if (this.swingT >= 1) this.swingT = -1;
      else {
        const t = this.swingT;
        const k = Math.sin(Math.min(1, t) * Math.PI);
        const impact = t > this.swingSoundAt && t < this.swingSoundAt + 0.18;
        if (t >= this.swingSoundAt && !this.swingSoundDone) {
          this.swingSoundDone = true;
          sfx.swing(this.swingStep % 6);
          const tg = this.target;
          if (tg && this.phase === 'playing' && isBreakable(tg.id)) {
            sfx.crack(this.swingStep % 5);
            this.addShake(0.05);
            this.burst(
              tg.x + 0.5 + tg.nx * 0.5,
              tg.y + 0.5 + tg.ny * 0.5,
              tg.z + 0.5 + tg.nz * 0.5,
              BLOCKS[tg.id].tint,
              3,
              1.5,
            );
          }
        }
        const swingKind = this.heldKind();
        // A sword makes a compact thrust/slash; a pick drops straight into the
        // block; axe and hoe use a wider diagonal working motion.
        sx = -k * (swingKind === 'axe' || swingKind === 'hoe' ? 0.92 : swingKind === 'sword' ? 0.72 : 1.0);
        sy = k * (swingKind === 'axe' || swingKind === 'hoe' ? 0.28 : swingKind === 'sword' ? 0.16 : 0.32);
        sz = k * (swingKind === 'axe' ? 0.62 : swingKind === 'hoe' ? 0.46 : swingKind === 'sword' ? 0.18 : 0.28);
        px = k * (swingKind === 'axe' || swingKind === 'hoe' ? 0.08 : 0.06);
        py = -k * (swingKind === 'axe' || swingKind === 'hoe' ? 0.2 : 0.16) + (impact ? 0.02 : 0);
      }
    }
    this.syncViewModel();
    // Keep the view model in the lower-right hand area.  The smaller scale and
    // extra depth leave the crosshair and most of the world unobstructed.
    this.pickGroup.rotation.set(0.3 + sx + idle, -0.2 + sy, 0.2 + sz + idle * 0.6);
    this.pickGroup.position.x = this.pickBaseX + px;
    this.pickGroup.position.y = -0.56 + py + idle * 0.6;
    this.pickGroup.position.z = -1.08 + Math.max(0, sx) * -0.14;

    // popups
    this.updatePopups(dt);
  }

  // ================= MINING =================
  private eyeV = new THREE.Vector3();
  private dirV = new THREE.Vector3();

  private interactionReach() {
    return Math.min(MAX_INTERACTION_REACH, BASE_INTERACTION_REACH + this.stats.reach);
  }

  private playerAabb() {
    const { halfX, halfZ } = this.playerHalfExtents();
    return {
      minX: this.pos.x - halfX,
      maxX: this.pos.x + halfX,
      minY: this.pos.y,
      maxY: this.pos.y + this.playerHeight(),
      minZ: this.pos.z - halfZ,
      maxZ: this.pos.z + halfZ,
    };
  }

  private distanceFromPlayerAabb(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
    const p = this.playerAabb();
    const dx = minX > p.maxX ? minX - p.maxX : p.minX > maxX ? p.minX - maxX : 0;
    const dy = minY > p.maxY ? minY - p.maxY : p.minY > maxY ? p.minY - maxY : 0;
    const dz = minZ > p.maxZ ? minZ - p.maxZ : p.minZ > maxZ ? p.minZ - maxZ : 0;
    return Math.hypot(dx, dy, dz);
  }

  private blockReachDistance(x: number, y: number, z: number) {
    return this.distanceFromPlayerAabb(x, y, z, x + 1, y + 1, z + 1);
  }

  private mobReachDistance(m: Mob) {
    const half = (m.id === 'spider' || m.id === 'spiderling' ? 0.55 : 0.45) * m.def.scale;
    const h = (m.def.hostile ? (m.id === 'spider' || m.id === 'spiderling' ? 0.95 : 1.95) : 1.35) * m.def.scale;
    return this.distanceFromPlayerAabb(m.x - half, m.y, m.z - half, m.x + half, m.y + h, m.z + half);
  }

  private updateTarget() {
    // First-person mines from the eyes. Third-person uses the screen-centre
    // camera ray but ignores the transparent camera→avatar corridor, so the
    // highlighted block is exactly what the crosshair sits on.
    const cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch);
    this.dirV.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    this.eyeV.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    const reach = this.interactionReach();
    if (this.thirdPerson && this.phase === 'playing') {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      const focus = new THREE.Vector3(this.pos.x, this.pos.y + EYE - this.crawlLerp * (EYE - 0.52) + 0.05, this.pos.z);
      const skip = Math.max(0, this.camera.position.distanceTo(focus) - 0.35);
      const hit = this.raycast(this.camera.position, camDir, skip + reach + EYE + 0.25, skip);
      if (hit && this.blockReachDistance(hit.x, hit.y, hit.z) <= reach + 0.02) {
        this.target = hit;
        return;
      }
    }
    const hit = this.raycast(this.eyeV, this.dirV, reach + EYE);
    this.target = hit && this.blockReachDistance(hit.x, hit.y, hit.z) <= reach + 0.02 ? hit : null;
  }

  private raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, minDist = 0) {
    let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x),
      stepY = Math.sign(dir.y),
      stepZ = Math.sign(dir.z);
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    const voxBoundX = x + (stepX > 0 ? 1 : 0);
    const voxBoundY = y + (stepY > 0 ? 1 : 0);
    const voxBoundZ = z + (stepZ > 0 ? 1 : 0);
    let tMaxX = dir.x === 0 ? Infinity : (voxBoundX - origin.x) / dir.x;
    let tMaxY = dir.y === 0 ? Infinity : (voxBoundY - origin.y) / dir.y;
    let tMaxZ = dir.z === 0 ? Infinity : (voxBoundZ - origin.z) / dir.z;
    let nx = 0,
      ny = 0,
      nz = 0;
    let t = 0;
    for (let i = 0; i < 128; i++) {
      const id = this.world.get(x, y, z);
      // the crosshair ray passes straight through water — you can mine underwater
      if (t >= minDist && id !== AIR && id !== WATER && this.world.inBounds(x, y, z)) {
        return { x, y, z, nx, ny, nz, id };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
      if (t > maxDist) break;
    }
    return null;
  }

  private updateMining(dt: number) {
    const wantMining = this.mining || this.touchMine;
    // bow: LMB shoots instead of mining
    if (wantMining && this.heldKind() === 'bow') {
      this.tryShoot();
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineDenyKey = '';
      return;
    }
    // a mob under the crosshair always wins over the block behind it
    if (wantMining && this.tryAttack()) {
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      this.mineDenyKey = '';
      return;
    }
    const target = this.target;
    if (!target) {
      this.highlight.visible = false;
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      this.mineDenyKey = '';
      return;
    }
    this.highlight.visible = true;
    this.highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    const pulse = 1 + Math.sin(this.time * 9) * 0.006;
    this.highlight.scale.setScalar(pulse);
    const hlMat = this.highlight.material as THREE.LineBasicMaterial;
    hlMat.opacity = wantMining ? 0.95 : 0.6;

    const def = BLOCKS[target.id];
    if (!isBreakable(target.id)) {
      hlMat.color.setHex(isTreasureChest(target.id) ? 0xf4b942 : 0xe2564a);
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      this.mineDenyKey = '';
      return;
    }
    const heldId = this.hotbar[this.selected] ?? -1;
    const heldSpec = getToolSpec(heldId);
    const requiredTier = minimumPickaxeTier(target.id);
    const needsPickaxe = requiredTier !== null && (heldSpec?.kind !== 'pickaxe' || heldSpec.tier < requiredTier);
    const needsAnyTool = requiredTier === null && !heldSpec && !canBreakByHand(target.id);
    if (needsPickaxe || needsAnyTool) {
      hlMat.color.setHex(0xe2564a);
      this.crackMesh.visible = false;
      this.mineProgress = 0;
      this.mineBlockKey = '';
      if (wantMining) {
        const key = `${target.x},${target.y},${target.z}:${heldId}:${requiredTier ?? 'tool'}`;
        if (key !== this.mineDenyKey) {
          this.mineDenyKey = key;
          const message = requiredTier !== null
            ? t('needPickaxe').replace('{tool}', pickaxeLabel(requiredTier))
            : t('needToolToMine');
          this.popup(target.x + 0.5, target.y + 1.1, target.z + 0.5, message, '#e2564a', false, {
            anchor: 'crosshair',
            duration: 2.1,
            screenRiseSpeed: 16,
          });
        }
      } else {
        this.mineDenyKey = '';
      }
      return;
    }
    this.mineDenyKey = '';
    hlMat.color.setHex(0x0b0d0c);

    if (wantMining) {
      // Flowers, meadow grass, ferns, dead bushes, and eggs break in exactly ONE hit
      if (isInstaBreak(target.id)) {
        this.mineProgress = 0;
        this.startSwing(0.05);
        this.breakBlock(target.x, target.y, target.z, target.id);
        this.updateTarget();
        return;
      }
      const key = `${target.x},${target.y},${target.z}`;
      if (key !== this.mineBlockKey) {
        this.mineBlockKey = key;
        this.mineProgress = 0;
        // first whack on an occupied hive wakes the swarm
        if (target.id === HIVE) this.angerBees(target.x, target.y, target.z);
      }
      if (this.swingT < 0) this.startSwing(def.hardness);
      // Use the selected tool's own tier speed. This also keeps shovel/hoe names
      // and their actual efficiency tied to the same physical instance.
      const tierSpeed = (heldSpec?.speed ?? PICKAXE_TIERS[0].speed) * this.toolMultiplier(target.id) * (1 + this.stats.miner / 100);
      this.mineProgress += (dt * tierSpeed) / Math.max(0.05, def.hardness);
      if (this.mineProgress >= 1) {
        this.mineProgress = 0;
        this.breakBlock(target.x, target.y, target.z, target.id);
        this.updateTarget();
      }
    } else {
      this.mineProgress = Math.max(0, this.mineProgress - dt * 2.2);
    }

    const stage = Math.min(9, Math.floor(this.mineProgress * 10));
    if (this.mineProgress > 0.01) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      if (stage !== this.crackStage) {
        this.crackStage = stage;
        const [u0, v0, u1, v1] = crackTileUV(stage);
        const uv = this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const base = this.crackUVBase;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, u0 + (u1 - u0) * base[i * 2], v0 + (v1 - v0) * base[i * 2 + 1]);
        }
        uv.needsUpdate = true;
      }
    } else {
      this.crackMesh.visible = false;
      this.crackStage = -1;
    }
  }

  private startSwing(hardness: number) {
    const heldSpec = getToolSpec(this.hotbar[this.selected] ?? -1);
    const tierSpeed = heldSpec?.speed ?? PICKAXE_TIERS[this.tier].speed;
    this.swingDur = Math.max(0.13, Math.min(0.42, (hardness * 0.32) / tierSpeed));
    this.swingT = 0;
    this.swingStep++;
    this.swingSoundAt = 0.42;
    this.swingSoundDone = false;
  }
  private swingSoundDone = false;

  private breakBlock(x: number, y: number, z: number, id: number) {
    const def = BLOCKS[id];
    if (id === WHEAT_CROP_1 || id === WHEAT_CROP_2 || id === WHEAT_CROP_3) this.wheatCropGrowth.delete(Engine.packCell(x, y, z));
    if (isTreasureChest(id)) this.spillChestContents(x, y, z, id);
    this.world.set(x, y, z, AIR);
    if (id === BED) {
      // A bed is 2 blocks long: breaking either half removes the partner half too
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (this.world.get(x + dx, y, z + dz) === BED) {
          this.world.set(x + dx, y, z + dz, AIR);
          this.rebuildAt(x + dx, z + dz);
        }
      }
    }
    if (id === DOOR_WOOD || id === DOOR_IRON) {
      // A door is 2 blocks tall: breaking either half removes the other half too
      for (const dy of [1, -1]) {
        if (this.world.get(x, y + dy, z) === id) {
          this.world.set(x, y + dy, z, AIR);
        }
      }
    }
    if (id === VINE) {
      // Sever a single hanging strand: the severed section and everything
      // beneath it falls, while the upper part stays attached to the canopy.
      for (let yy = y - 1; yy >= 1 && this.world.get(x, yy, z) === VINE; yy--)
        this.world.set(x, yy, z, AIR);
      if (this.world.get(x, y + 1, z) === VINE && this.vineTips.size < 128)
        this.vineTips.set(Engine.packCell(x, y + 1, z), { x, y: y + 1, z, t: 4 + Math.random() * 4 });
    }
    // cutting a trunk? everything above comes down as one physical piece
    const extraLogs = isLogId(id) && isLogId(this.world.get(x, y + 1, z))
      ? this.fellTree(x, y, z)
      : 0;
    this.rebuildAt(x, z);
    this.blocksMined++;
    this.damageHeldTool(1);

    const tint = def.tint;
    this.burst(x + 0.5, y + 0.5, z + 0.5, tint, isLeafId(id) ? 8 : 16, id === STONE ? 3.4 : 2.6);
    this.addShake(id >= 5 && id <= 8 ? 0.34 : 0.2);
    sfx.breakBlock(id === DIRT || id === SAND || id === GRASS || isPlant(id) ? 0.8 : isLeafId(id) ? 1.5 : 1);

    this.combo++;
    this.comboTimer = 3.0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    // neighbours may have just lost their support / adjacent fluids start flowing
    this.enqueueSupportCheck(x, y, z);
    this.enqueueFluid(x, y, z);

    // Mature wheat yields grain and replanting seeds; immature stalks return only a seed.
    if (id === WHEAT_CROP_1 || id === WHEAT_CROP_2 || id === WHEAT_CROP_3) {
      if (id === WHEAT_CROP_3) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, WHEAT, null, { count: 1 + Math.floor(Math.random() * 3) });
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, WHEAT_SEEDS, null, { count: id === WHEAT_CROP_3 ? 1 + Math.floor(Math.random() * 3) : 1 });
    } else if (id === BIRD_NEST || id === CHICKEN_NEST) {
      this.birdNests = this.birdNests.filter((n) => n.x !== x || n.y !== y || n.z !== z);
    }
    if (id === HIVE) {
      const key = Engine.packCell(x, y, z);
      const stored = this.hiveHoney.get(key) ?? 0;
      this.hiveHoney.delete(key);
      this.hiveBees.delete(key); // occupants spill out via their own task logic
      for (let i = 0; i < stored; i++) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, HONEY);
      if (stored > 0) this.burst(x + 0.5, y + 0.5, z + 0.5, [244, 184, 58], 12, 2.6);
      this.angerBees(x, y, z);
    } else if (isTreasureChest(id)) {
      // Contents and the reusable chest item were spilled before the block was removed.
    } else if (id === COCONUT_LEAVES || id === BANANA_LEAVES) {
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, id === COCONUT_LEAVES ? COCONUT : BANANA);
    } else if (id === APPLE_LEAVES) {
      // apple leaves guarantee fresh apples!
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      if (Math.random() < 0.4) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, LEAVES);
    } else {
      const dropId = def.drop;
      if (dropId) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, dropId);
      if (id === LEAVES && Math.random() < 0.08) {
        this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, APPLE);
      }
    }

    if (id === DIAMOND_ORE || id === GOLD_ORE || id === EMERALD_ORE || id === DIAMOND || id === GOLD) {
      const isDia = id === DIAMOND_ORE || id === DIAMOND;
      const isEm = id === EMERALD_ORE;
      this.burst(
        x + 0.5,
        y + 0.5,
        z + 0.5,
        isDia ? [120, 245, 235] : isEm ? [60, 235, 110] : [255, 220, 90],
        22,
        4.4,
      );
      this.addShake(0.6);
      this.pushBanner(
        isDia || isEm ? t('diamond') : t('gold'),
        this.endlessRun ? '' : `+${Math.round(def.timeBonus)}${t('secShort')} ${t('secondsOnClock')}`,
        isDia ? '#5fe8dc' : isEm ? '#2bd45e' : '#f7d34b',
      );
    }
    this.recordExplorerMining(id, 1 + extraLogs);
    this.syncHotbar(false);
    this.syncHud(true);
  }

  // ================= FALLING TREES =================
  private fallingTrees: Array<{
    group: THREE.Group;
    pivot: THREE.Vector3;
    axis: THREE.Vector3;
    angle: number;
    vel: number;
    creak: boolean;
    blocks: Array<{ dx: number; dy: number; dz: number; id: number }>;
  }> = [];
  private blockGeoCache = new Map<number, THREE.BoxGeometry>();

  /** shared unit-cube geometry with the block's atlas UVs baked in */
  private getBlockGeometry(id: number, sideTileOverride?: number): THREE.BoxGeometry {
    const cacheKey = sideTileOverride !== undefined ? id * 1000 + sideTileOverride : id;
    let geo = this.blockGeoCache.get(cacheKey);
    if (geo) return geo;
    geo = new THREE.BoxGeometry(1, 1, 1);
    geo.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3).fill(1), 3),
    );
    const def = BLOCKS[id];
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const base = this.dropUVBase;
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? def.top : f === 3 ? def.bottom : (sideTileOverride ?? def.side);
      const [u0, v0, u1, v1] = tileUV(tile);
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
      }
    }
    uv.needsUpdate = true;
    this.blockGeoCache.set(cacheKey, geo);
    return geo;
  }

  /** detach the trunk + canopy above (x,y,z) from the world and let it topple over */
  private fellTree(x: number, y: number, z: number): number {
    // 1. collect the trunk going up (allowing 1-block lean / branches for giant trees)
    const logs: Array<{ pos: [number, number, number]; id: number }> = [];
    const logSeen = new Set<string>();
    const key = (px: number, py: number, pz: number) => `${px},${py},${pz}`;
    const stack: Array<[number, number, number]> = [[x, y + 1, z]];
    while (stack.length && logs.length < 96) {
      const [cx, cy, cz] = stack.pop()!;
      const k = key(cx, cy, cz);
      if (logSeen.has(k)) continue;
      logSeen.add(k);
      const bid = this.world.get(cx, cy, cz);
      if (!isLogId(bid)) continue;
      logs.push({ pos: [cx, cy, cz], id: bid });
      for (let dy = 0; dy <= 1; dy++)
        for (let dz2 = -1; dz2 <= 1; dz2++)
          for (let dx2 = -1; dx2 <= 1; dx2++) {
            if (dx2 === 0 && dy === 0 && dz2 === 0) continue;
            if (cy + dy > y) stack.push([cx + dx2, cy + dy, cz + dz2]);
          }
    }
    if (!logs.length) return 0;

    // 2. gather the whole leaf canopy — wide first ring around the logs, then
    //    flood through connected leaves so nothing is left hovering.  Keep a
    //    separate leaf-seen set: the trunk search probes neighbouring leaves,
    //    and reusing that set made some canopy blocks get skipped and float.
    const leaves: Array<{ pos: [number, number, number]; id: number }> = [];
    const seen = new Set<string>(logs.map((l) => key(l.pos[0], l.pos[1], l.pos[2])));
    const xs = logs.map((l) => l.pos[0]);
    const ys = logs.map((l) => l.pos[1]);
    const zs = logs.map((l) => l.pos[2]);
    const minLeafX = Math.min(...xs) - 6;
    const maxLeafX = Math.max(...xs) + 6;
    const minLeafY = Math.min(...ys) - 2;
    const maxLeafY = Math.min(WY - 1, Math.max(...ys) + 8);
    const minLeafZ = Math.min(...zs) - 6;
    const maxLeafZ = Math.max(...zs) + 6;
    const leafLimit = 900;
    const addLeaf = (px: number, py: number, pz: number, out: Array<[number, number, number]>) => {
      if (leaves.length >= leafLimit) return;
      if (px < minLeafX || px > maxLeafX || py < minLeafY || py > maxLeafY || pz < minLeafZ || pz > maxLeafZ) return;
      const k = key(px, py, pz);
      if (seen.has(k)) return;
      seen.add(k);
      const bid = this.world.get(px, py, pz);
      if (isLeafId(bid)) {
        leaves.push({ pos: [px, py, pz], id: bid });
        out.push([px, py, pz]);
      }
    };
    let frontier: Array<[number, number, number]> = [];
    for (const l of logs) {
      const [cx, cy, cz] = l.pos;
      for (let dy = -2; dy <= 3; dy++)
        for (let dz2 = -3; dz2 <= 3; dz2++)
          for (let dx2 = -3; dx2 <= 3; dx2++) addLeaf(cx + dx2, cy + dy, cz + dz2, frontier);
    }
    for (let pass = 0; pass < 12 && frontier.length && leaves.length < leafLimit; pass++) {
      const next: Array<[number, number, number]> = [];
      for (const [cx, cy, cz] of frontier) {
        for (let dy = -1; dy <= 1; dy++)
          for (let dz2 = -1; dz2 <= 1; dz2++)
            for (let dx2 = -1; dx2 <= 1; dx2++) {
              if (leaves.length >= leafLimit) break;
              addLeaf(cx + dx2, cy + dy, cz + dz2, next);
            }
      }
      frontier = next;
    }

    // 3. pull the blocks out of the world, remember which chunks need remeshing
    const chunks = new Set<number>();
    const markChunks = (px: number, pz: number) => {
      const cx = Math.floor(px / CHUNK);
      const cz = Math.floor(pz / CHUNK);
      for (let dz2 = -1; dz2 <= 1; dz2++)
        for (let dx2 = -1; dx2 <= 1; dx2++) chunks.add(chunkKey(cx + dx2, cz + dz2));
    };
    const all = [...logs.map((l) => [l.pos, l.id] as const), ...leaves.map((l) => [l.pos, l.id] as const)];
    for (const [[px, py, pz]] of all) {
      this.world.set(px, py, pz, AIR);
      markChunks(px, pz);
    }
    // anything the canopy grab missed loses support and crumbles on its own
    for (const [[px, py, pz]] of all) this.enqueueSupportCheck(px, py, pz);
    // Rebuild all affected chunks through the incremental mesh queue; a canopy may span many cells.
    for (const ck of chunks) this.dirtyChunks.add(ck);

    // 4. rebuild the tree as one mesh group hinged at the stump
    const pivot = new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
    const group = new THREE.Group();
    group.position.copy(pivot);
    const blocks: Array<{ dx: number; dy: number; dz: number; id: number }> = [];
    for (const [[px, py, pz], id] of all) {
      const mesh = new THREE.Mesh(this.getBlockGeometry(id), this.material);
      mesh.position.set(px + 0.5 - pivot.x, py + 0.5 - pivot.y, pz + 0.5 - pivot.z);
      group.add(mesh);
      blocks.push({ dx: mesh.position.x, dy: mesh.position.y, dz: mesh.position.z, id });
    }
    this.scene.add(group);

    // 5. topple away from the player
    let fx = pivot.x - this.pos.x;
    let fz = pivot.z - this.pos.z;
    const fl = Math.hypot(fx, fz);
    if (fl < 0.01) {
      fx = 1;
      fz = 0;
    } else {
      fx /= fl;
      fz /= fl;
    }
    const axis = new THREE.Vector3(fz, 0, -fx).normalize();

    this.fallingTrees.push({ group, pivot, axis, angle: 0, vel: 0.28, creak: false, blocks });
    if (this.fallingTrees.length > 4) this.finishTree(this.fallingTrees.shift()!);
    sfx.crack(3);
    return logs.length;
  }

  private updateFallingTrees(dt: number) {
    for (let i = this.fallingTrees.length - 1; i >= 0; i--) {
      const ft = this.fallingTrees[i];
      // gravity torque: the further it tips, the faster it goes
      ft.vel += (1.4 + Math.sin(Math.min(ft.angle, 1.5)) * 6.5) * dt;
      ft.angle += ft.vel * dt;
      if (!ft.creak && ft.angle > 0.3) {
        ft.creak = true;
        sfx.swing(2);
      }
      if (ft.angle >= Math.PI / 2 - 0.03) {
        this.fallingTrees.splice(i, 1);
        this.finishTree(ft);
        continue;
      }
      ft.group.setRotationFromAxisAngle(ft.axis, ft.angle);
    }
  }

  private treeTmp = new THREE.Vector3();
  /** impact: the felled tree shatters into drops and particles along its length */
  private finishTree(ft: { group: THREE.Group; pivot: THREE.Vector3; axis: THREE.Vector3; blocks: Array<{ dx: number; dy: number; dz: number; id: number }> }) {
    const q = new THREE.Quaternion().setFromAxisAngle(ft.axis, Math.PI / 2 - 0.05);
    let logs = 0;
    for (const b of ft.blocks) {
      this.treeTmp.set(b.dx, b.dy, b.dz).applyQuaternion(q).add(ft.pivot);
      const wx = this.treeTmp.x;
      const wy = Math.max(1, this.treeTmp.y);
      const wz = this.treeTmp.z;
      if (isLogId(b.id)) {
        logs++;
        this.spawnDrop(wx, wy + 0.3, wz, b.id === BIRCH_LOG ? BIRCH_LOG : LOG);
        this.burst(wx, wy, wz, BLOCKS[b.id]?.tint ?? BLOCKS[LOG].tint, 5, 2.4);
      } else if (b.id === COCONUT_LEAVES || b.id === BANANA_LEAVES) {
        if (Math.random() < 0.35) this.spawnDrop(wx, wy + 0.2, wz, b.id === COCONUT_LEAVES ? COCONUT : BANANA);
        this.burst(wx, wy, wz, BLOCKS[b.id].tint, 3, 2);
      } else if (b.id === APPLE_LEAVES) {
        // apple leaves drop fresh apples!
        this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        if (Math.random() < 0.5) this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        if (Math.random() < 0.3) this.spawnDrop(wx, wy + 0.2, wz, LEAVES);
        this.burst(wx, wy, wz, [220, 60, 50], 4, 2);
      } else {
        // leaves mostly puff away; some drop as a resource
        if (Math.random() < 0.3) this.spawnDrop(wx, wy + 0.2, wz, LEAVES);
        if (b.id === LEAVES && Math.random() < 0.06) this.spawnDrop(wx, wy + 0.2, wz, APPLE);
        this.burst(wx, wy, wz, BLOCKS[b.id]?.tint ?? BLOCKS[LEAVES].tint, 3, 2);
      }
    }
    this.scene.remove(ft.group);
    ft.group.clear();
    this.addShake(Math.min(0.7, 0.25 + logs * 0.07));
    sfx.land(true);
    sfx.breakBlock(0.6);
  }

  private clearFallingTrees() {
    for (const ft of this.fallingTrees) {
      this.scene.remove(ft.group);
      ft.group.clear();
    }
    this.fallingTrees.length = 0;
  }

  // ================= DOORS & WINDOWS (E to toggle) =================
  private openDoors: Array<{ x: number; y: number; z: number; id: number; mesh: THREE.Mesh }> = [];

  private clearDoors() {
    for (const d of this.openDoors) {
      this.scene.remove(d.mesh);
    }
    this.openDoors.length = 0;
  }

  /** nearest living trader within reach, if any */
  traderNear(): Mob | null {
    for (const m of this.mobSys.mobs) {
      if (!m.alive || m.id !== 'trader') continue;
      if (Math.hypot(m.x - this.pos.x, m.y - this.pos.y, m.z - this.pos.z) < 3.6) return m;
    }
    return null;
  }

  /** E — pet the equipped wolf, trade with the trader, or use a nearby world object. */
  interact(skipPet = false): boolean {
    if (this.phase !== 'playing') return false;
    // A nearby companion must not consume the E action intended for the chest under the crosshair.
    if (!skipPet && this.petInteractionAvailable() && !isTreasureChest(this.target?.id ?? AIR)) return this.petWolf();
    // trader first — walking up to him and pressing E opens the trade tab
    if (this.traderNear()) {
      this.queueTutorialTip('mechanic:trader', t('tutorialTraderTitle'), t('tutorialTraderBody'), '#d98cff', 'trader');
      this.invTab = 'trade';
      this.openInventory();
      return true;
    }
    const tg = this.target;
    // workbench / crafting table → open the workbench dismantle view
    if (tg && tg.id === CRAFTING_TABLE) {
      this.queueTutorialTip('mechanic:workbench', t('tutorialWorkbenchTitle'), t('tutorialWorkbenchBody'), '#f4b942', 'workbench');
      this.invTab = 'workbench';
      this.openInventory();
      return true;
    }
    // anvil → open the smithing tab
    if (tg && tg.id === ANVIL) {
      this.queueTutorialTip('mechanic:anvil', t('tutorialAnvilTitle'), t('tutorialAnvilBody'), '#d6d9dd', 'anvil');
      this.invTab = 'anvil';
      this.openInventory();
      return true;
    }
    // Generated and player-placed chests share the same storage interface.
    if (tg && isTreasureChest(tg.id)) {
      this.openChestAt(tg.x, tg.y, tg.z, tg.id);
      return true;
    }
    // Beds may skip the night in Explorer mode, but Survival must play every night through.
    if (tg && tg.id === BED) {
      if (!canSleepInMode(this.survival, this.daylight)) {
        const message = this.survival ? t('sleepSurvivalDisabled') : t('sleepOnlyNight');
        this.popup(tg.x + 0.5, tg.y + 1.2, tg.z + 0.5, message, '#a8c0ff');
        sfx.ui(false);
      } else if (!this.sleeping) {
        this.sleeping = true;
        this.mining = false;
        this.placing = false;
        this.pushBanner(t('sleeping'), t('sleepingSub'), '#a8c0ff');
        sfx.ui(true);
      }
      return true;
    }
    if (tg && isInteractive(tg.id)) {
      this.openDoorAt(tg.x, tg.y, tg.z, tg.id, tg.nx, tg.nz);
      return true;
    }
    // close any opened panels within reach
    let closed = false;
    for (let i = this.openDoors.length - 1; i >= 0; i--) {
      const d = this.openDoors[i];
      const dist = Math.hypot(d.x + 0.5 - this.pos.x, d.y + 0.5 - (this.pos.y + 1), d.z + 0.5 - this.pos.z);
      if (dist > 3.4) continue;
      if (this.world.get(d.x, d.y, d.z) !== AIR) continue;
      // don't close a door onto yourself
      const px = this.pos.x,
        pz = this.pos.z,
        py = this.pos.y;
      if (
        d.x + 1 > px - PLAYER_HALF &&
        d.x < px + PLAYER_HALF &&
        d.z + 1 > pz - PLAYER_HALF &&
        d.z < pz + PLAYER_HALF &&
        d.y + 1 > py &&
        d.y < py + PLAYER_HEIGHT
      )
        continue;
      this.world.set(d.x, d.y, d.z, d.id);
      this.scene.remove(d.mesh);
      this.openDoors.splice(i, 1);
      this.rebuildAt(d.x, d.z);
      closed = true;
    }
    if (closed) {
      sfx.place();
      this.updateTarget();
      this.syncHud(true);
    }
    return closed;
  }

  /** Generate the original biome-cache loot once, then keep it as block-entity state until claimed. */
  private chestInventoryAt(x: number, y: number, z: number, id: number): Map<number, number> {
    const key = Engine.chestCellKey(x, y, z);
    this.chestInventories ??= new Map();
    const saved = this.chestInventories.get(key);
    if (saved) return saved;

    const loot = new Map<number, number>();
    this.chestInventories.set(key, loot);
    const base = baseChestId(id);
    // Open biome chests without sidecar data are from v1/v2 saves: they were already looted.
    // Reusable storage chests and newly placed chests start empty.
    if (!isBiomeTreasureChest(base) || isOpenChest(id)) return loot;

    const underwater = isUnderwaterChest(base);
    const seed = (this.world.seed ^ Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791) ^ Math.imul(base, 2654435761)) >>> 0;
    const rand = mulberry32(seed);
    const commonPool = underwater
      ? [
          { id: FISH_SCALE, weight: 18, min: 1, max: 4 },
          { id: CRAB_SHELL, weight: 8, min: 1, max: 2 },
          { id: TURTLE_SHELL, weight: 5, min: 1, max: 1 },
          { id: IRON, weight: 16, min: 1, max: 3 },
          { id: GOLD, weight: 12, min: 1, max: 2 },
          { id: COAL, weight: 12, min: 2, max: 5 },
          { id: REDSTONE, weight: 9, min: 1, max: 3 },
          { id: LAPIS, weight: 7, min: 1, max: 3 },
          { id: QUARTZ, weight: 6, min: 1, max: 2 },
          { id: DIAMOND, weight: 5, min: 1, max: 1 },
          { id: NETHERITE, weight: 2, min: 1, max: 1 },
        ]
      : [
          { id: COAL, weight: 22, min: 2, max: 6 },
          { id: IRON, weight: 20, min: 1, max: 4 },
          { id: REDSTONE, weight: 13, min: 1, max: 4 },
          { id: LAPIS, weight: 11, min: 1, max: 3 },
          { id: GOLD, weight: 10, min: 1, max: 3 },
          { id: QUARTZ, weight: 8, min: 1, max: 3 },
          { id: DIAMOND, weight: 7, min: 1, max: 2 },
          { id: EMERALD, weight: 5, min: 1, max: 2 },
          { id: NETHERITE, weight: 2, min: 1, max: 1 },
        ];
    const totalWeight = commonPool.reduce((sum, entry) => sum + entry.weight, 0);
    const pulls = 3 + Math.floor(rand() * 3);
    for (let pull = 0; pull < pulls; pull++) {
      let roll = rand() * totalWeight;
      let reward = commonPool[commonPool.length - 1];
      for (const entry of commonPool) {
        roll -= entry.weight;
        if (roll < 0) {
          reward = entry;
          break;
        }
      }
      const count = reward.min + Math.floor(rand() * (reward.max - reward.min + 1));
      loot.set(reward.id, (loot.get(reward.id) ?? 0) + count);
    }

    // Some caches also contain a mineable ore block, not only ingots and gems.
    if (rand() < (underwater ? 0.16 : 0.2)) {
      const ores = [
        { id: COAL_ORE, weight: 24 }, { id: IRON_ORE, weight: 22 }, { id: REDSTONE_ORE, weight: 16 },
        { id: LAPIS_ORE, weight: 12 }, { id: GOLD_ORE, weight: 10 }, { id: QUARTZ_ORE, weight: 8 },
        { id: DIAMOND_ORE, weight: 5 }, { id: EMERALD_ORE, weight: 3 },
      ];
      let oreRoll = rand() * ores.reduce((sum, ore) => sum + ore.weight, 0);
      let oreId = ores[0].id;
      for (const ore of ores) {
        oreRoll -= ore.weight;
        if (oreRoll < 0) {
          oreId = ore.id;
          break;
        }
      }
      const oreCount = oreId === COAL_ORE || oreId === IRON_ORE || oreId === REDSTONE_ORE ? 1 + Math.floor(rand() * 2) : 1;
      loot.set(oreId, (loot.get(oreId) ?? 0) + oreCount);
    }

    // Keep the old rare armour bonus available: it is claimed when a player opens
    // the cache, or spills as a loot bag if they break the chest first.
    if (rand() < (underwater ? 0.055 : 0.075)) {
      const materialRoll = rand();
      const material: Material = materialRoll < 0.3 ? 'iron' : materialRoll < 0.52 ? 'gold' : materialRoll < 0.94 ? 'diamond' : 'netherite';
      const slot: Slot = (['head', 'chest', 'legs', 'feet', 'hands', 'offhand'] as Slot[])[Math.floor(rand() * 6)];
      const rarityRoll = rand();
      const rarity: Rarity = rarityRoll < 0.035 ? 4 : rarityRoll < 0.27 ? 3 : 2;
      this.chestBonusGear ??= new Map();
      this.chestBonusGear.set(key, [makeItem(slot, material, rarity, rand)]);
    }
    if (rand() < 0.025) loot.set(NETHERITE_INGOT, (loot.get(NETHERITE_INGOT) ?? 0) + 1);
    return loot;
  }

  /** Spill the complete block-entity inventory and reusable block exactly once on destruction. */
  private spillChestContents(x: number, y: number, z: number, id: number): boolean {
    if (!isTreasureChest(id)) return false;
    const key = Engine.chestCellKey(x, y, z);
    const contents = new Map(this.chestInventoryAt(x, y, z, id));
    const bonus = (this.chestBonusGear?.get(key) ?? []).slice();
    this.chestInventories.delete(key);
    this.chestBonusGear.delete(key);
    if (this.activeChest?.x === x && this.activeChest.y === y && this.activeChest.z === z) {
      this.closeActiveChest();
      this.inventoryOpen = false;
      this.invTab = 'tools';
    }
    for (const [itemId, count] of contents) {
      if (count > 0) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, itemId, null, { count });
    }
    for (const gear of bonus) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, LOOT_BAG, gear);
    this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, CHEST_STORAGE);
    return true;
  }

  private closeActiveChest() {
    const active = this.activeChest;
    if (!active) return;
    const id = this.world.get(active.x, active.y, active.z);
    if (isTreasureChest(id) && isOpenChest(id)) {
      const base = baseChestId(id);
      this.world.set(active.x, active.y, active.z, base);
      this.rebuildAt(active.x, active.z);
      this.swingChestLid(active.x, active.y, active.z, CHEST_LID_OPEN_ANGLE,
        [[0, CHEST_LID_OPEN_ANGLE], [1, 0]], 0.32);
      sfx.creak(false);
    }
    this.activeChest = null;
  }

  /** Open either a generated treasure cache or a reusable player-placed storage chest. */
  private openChestAt(x: number, y: number, z: number, id: number) {
    this.recordExplorerChest();
    if (this.world.get(x, y, z) !== id || !isTreasureChest(id)) return false;
    const base = baseChestId(id);
    const key = Engine.chestCellKey(x, y, z);
    const [br, bg, bb] = BLOCKS[base].tint;
    this.chestInventoryAt(x, y, z, id);

    if (!isOpenChest(id)) {
      this.world.set(x, y, z, openChestId(base));
      this.rebuildAt(x, z);
      this.swingChestLid(x, y, z, 0, [[0, 0], [1, CHEST_LID_OPEN_ANGLE]], 0.62);
      sfx.creak(true);
    } else {
      this.swingChestLid(
        x, y, z, CHEST_LID_OPEN_ANGLE,
        [[0, CHEST_LID_OPEN_ANGLE], [0.3, CHEST_LID_OPEN_ANGLE + 0.2], [1, CHEST_LID_OPEN_ANGLE]],
        0.5,
      );
      sfx.creak(false);
    }

    const bonus = this.chestBonusGear?.get(key) ?? [];
    if (bonus.length) {
      this.bagItems.push(...bonus.map((item) => ensureGearHid(item)));
      this.chestBonusGear.delete(key);
    }
    this.activeChest = { x, y, z };
    this.target = null;
    this.pushBanner(t('chestOpened'), blockName(base, BLOCKS[base].name), `rgb(${br}, ${bg}, ${bb})`);
    this.openInventory();
    this.syncHud(true);
    return true;
  }

  private activeChestItems(): Map<number, number> | null {
    const active = this.activeChest;
    if (!active) return null;
    const id = this.world.get(active.x, active.y, active.z);
    if (!isTreasureChest(id)) return null;
    return this.chestInventoryAt(active.x, active.y, active.z, id);
  }

  /** Transfer a stack amount between the opened chest and the player's pack. */
  transferChestItem(id: number, amount: number, toChest: boolean): boolean {
    const chest = this.activeChestItems();
    if (!chest || !Number.isInteger(id) || id <= AIR || (id >= 200 && !isArrowId(id) && !isMeatItem(id)) || !BLOCKS[id] || getToolSpec(id)) {
      sfx.ui(false);
      return false;
    }
    const requested = Math.max(1, Math.floor(Number(amount) || 1));
    if (toChest) {
      const owned = this.inventory.get(id) ?? 0;
      const stored = chest.get(id) ?? 0;
      if (owned <= 0 || (!stored && chest.size >= CHEST_SLOT_LIMIT)) {
        sfx.ui(false);
        return false;
      }
      const moved = Math.min(requested, owned, CHEST_STACK_LIMIT - stored);
      if (moved <= 0) {
        sfx.ui(false);
        return false;
      }
      const remaining = owned - moved;
      if (remaining > 0) this.inventory.set(id, remaining);
      else this.inventory.delete(id);
      chest.set(id, stored + moved);
    } else {
      const stored = chest.get(id) ?? 0;
      if (stored <= 0) {
        sfx.ui(false);
        return false;
      }
      const moved = Math.min(requested, stored);
      const remaining = stored - moved;
      if (remaining > 0) chest.set(id, remaining);
      else chest.delete(id);
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + moved);
      this.addToHotbar(id);
    }
    sfx.pickup(1);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** Move every stack from the active chest into the player's inventory. */
  takeAllFromChest(): boolean {
    const chest = this.activeChestItems();
    if (!chest || chest.size === 0) {
      sfx.ui(false);
      return false;
    }
    for (const [id, count] of chest) {
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
      this.addToHotbar(id);
    }
    chest.clear();
    sfx.pickup(3);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  private openDoorAt(x: number, y: number, z: number, id: number, nx: number, nz: number) {
    // doors open as a whole vertical stack (2-tall doors feel like one door)
    const cells: Array<[number, number, number]> = [[x, y, z]];
    if (id !== GLASS) {
      for (const dy of [1, -1, 2, -2]) {
        if (this.world.get(x, y + dy, z) === id) cells.push([x, y + dy, z]);
      }
    }
    // pick the swing direction: panel hugs the side of the frame
    let horizN: [number, number] = [nx, nz];
    if (nx === 0 && nz === 0) {
      horizN = Math.abs(this.dirV.x) > Math.abs(this.dirV.z) ? [Math.sign(this.dirV.x), 0] : [0, Math.sign(this.dirV.z)];
    }
    const alongX = horizN[0] !== 0; // door plane was YZ → open panel lies along X wall

    for (const [cx, cy, cz] of cells) {
      const isBottomDoor =
        (id === DOOR_WOOD || id === DOOR_IRON) && cells.some(([, cy2]) => cy2 === cy + 1);
      const sideTile = isBottomDoor ? (id === DOOR_WOOD ? T.doorWoodBottom : T.doorIronBottom) : undefined;
      this.world.set(cx, cy, cz, AIR);
      const mesh = new THREE.Mesh(this.getBlockGeometry(id, sideTile), this.cutoutMat);
      if (alongX) {
        mesh.scale.set(1, 1, 0.13);
        mesh.position.set(cx + 0.5, cy + 0.5, cz + 0.935);
      } else {
        mesh.scale.set(0.13, 1, 1);
        mesh.position.set(cx + 0.935, cy + 0.5, cz + 0.5);
      }
      this.scene.add(mesh);
      this.openDoors.push({ x: cx, y: cy, z: cz, id, mesh });
    }
    this.rebuildAt(x, z);
    sfx.place();
    this.burst(x + 0.5, y + 0.5, z + 0.5, BLOCKS[id].tint, 4, 1.4);
    this.updateTarget();
    this.syncHud(true);
  }

  // ================= FLUID FLOW =================
  /** cells that might need to flow; level map caps lateral creep at 4 blocks.
   *  Numeric packed keys — no string alloc/GC churn in the hot path. */
  private fluidQueue: number[] = [];
  private fluidSet = new Set<number>();
  private fluidLevel = new Map<number, number>();

  private static packCell(x: number, y: number, z: number) {
    return ((x + 32768) * 64 + y) * 65536 + (z + 32768);
  }
  private static unpackCell(k: number): [number, number, number] {
    const z = (k % 65536) - 32768;
    const rest = Math.floor(k / 65536);
    const y = rest % 64;
    const x = Math.floor(rest / 64) - 32768;
    return [x, y, z];
  }

  private enqueueFluid(x: number, y: number, z: number) {
    for (const [dx, dy, dz] of [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      const px = x + dx;
      const py = y + dy;
      const pz = z + dz;
      const id = this.world.get(px, py, pz);
      if (id !== WATER && id !== LAVA) continue;
      const k = Engine.packCell(px, py, pz);
      if (this.fluidSet.has(k)) continue;
      this.fluidSet.add(k);
      this.fluidQueue.push(k);
    }
  }

  private updateFluids() {
    if (!this.fluidQueue.length) return;
    // lava is thick: it only flows every 4th frame
    let budget = 16;
    const defer: number[] = [];
    while (this.fluidQueue.length && budget > 0) {
      const k = this.fluidQueue.shift()!;
      this.fluidSet.delete(k);
      const [x, y, z] = Engine.unpackCell(k);
      const id = this.world.get(x, y, z);
      if (id !== WATER && id !== LAVA) continue;
      if (id === LAVA && (this.frameNo & 3) !== 0 &&
          ![[x,y-1,z],[x+1,y,z],[x-1,y,z],[x,y,z+1],[x,y,z-1],[x,y+1,z]]
            .some(([ax,ay,az]) => { const b = this.world.get(ax,ay,az); return b === WATER || b === ICE; })) {
        // Keep slow lava flow, but never delay a water contact behind its flow tick.
        defer.push(k);
        continue;
      }
      budget--;
      const level = this.fluidLevel.get(k) ?? 0;
      const mark = (px: number, pz: number) => this.markDirtyAt(px, pz);
      // Only player-disturbed / newly flowing fluid enters this queue. Generated
      // oceans and lava pools are never scanned or put into a reaction queue.
      const adjacent: Array<[number, number, number]> = [
        [x, y - 1, z], [x + 1, y, z], [x - 1, y, z],
        [x, y, z + 1], [x, y, z - 1], [x, y + 1, z],
      ];
      let reacted = false;
      for (const [ax, ay, az] of adjacent) {
        const other = this.world.get(ax, ay, az);
        if (id === LAVA && (other === WATER || other === ICE)) {
          // Ice melts to water; the contacting lava hardens, leaving the water.
          if (other === ICE) { this.world.set(ax, ay, az, WATER); mark(ax, az); }
          this.world.set(x, y, z, VOLCANIC_STONE);
          this.fluidLevel.delete(k);
          this.burst(x + 0.5, y + 0.5, z + 0.5, [85, 45, 49], 8, 2);
          mark(x, z);
          reacted = true;
          break;
        }
        if (id === WATER && other === LAVA) {
          this.world.set(ax, ay, az, VOLCANIC_STONE);
          this.fluidLevel.delete(Engine.packCell(ax, ay, az));
          this.burst(ax + 0.5, ay + 0.5, az + 0.5, [85, 45, 49], 8, 2);
          mark(ax, az);
          reacted = true;
          break;
        }
      }
      if (reacted) continue; // one bounded reaction per fluid update
      const flow = (px: number, py: number, pz: number, lvl: number) => {
        const target = this.world.get(px, py, pz);
        if (target === WATER && id === LAVA || target === ICE && id === LAVA) {
          if (target === ICE) { this.world.set(px, py, pz, WATER); mark(px, pz); }
          this.world.set(x, y, z, VOLCANIC_STONE);
          this.fluidLevel.delete(k);
          mark(x, z);
          return true;
        }
        if (target === LAVA && id === WATER) {
          this.world.set(px, py, pz, VOLCANIC_STONE);
          this.fluidLevel.delete(Engine.packCell(px, py, pz));
          mark(px, pz);
          return true;
        }
        if (target === AIR || (id === WATER && isFlower(target))) {
          this.world.set(px, py, pz, id);
          this.fluidLevel.set(Engine.packCell(px, py, pz), lvl);
          this.enqueueFluid(px, py, pz);
          mark(px, pz);
          return true;
        }
        return false;
      };
      if (flow(x, y - 1, z, 0)) continue;
      if (level < 4) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          flow(x + dx, y, z + dz, level + 1);
          if (this.world.get(x, y, z) !== id) break;
        }
      }
    }
    for (const k of defer) {
      if (!this.fluidSet.has(k)) {
        this.fluidSet.add(k);
        this.fluidQueue.push(k);
      }
    }
  }

  // ================= TURTLE/PENGUIN EGGS, BEES, PREDATION =================
  private birdNests: Array<{ x: number; y: number; z: number; kind: 'bird' | 'chicken'; t: number; brooding?: boolean }> = [];
  private birdNestTimer = 10;
  private turtleEggs: Array<{
    x: number;
    y: number;
    z: number;
    t: number;
    kind: 'turtle' | 'penguin';
    /** penguin eggs hatch only while a parent broods on top */
    brooding?: boolean;
  }> = [];
  private eggTimer = 12;
  private beeTimer = 0;
  private predTimer = 0;
  private spiderTimer = 10;
  /** spider egg sacs waiting to hatch into spiderlings */
  private spiderEggs: Array<{ x: number; y: number; z: number; t: number }> = [];
  /** honey stored per placed hive (packed cell → count, max 3) */
  private hiveHoney = new Map<number, number>();
  /** bees currently inside each hive (sleeping or brewing) — max 5 */
  private hiveBees = new Map<number, number>();
  private hiveFxTimer = 0;

  private hiveEnter(key: number): boolean {
    const n = this.hiveBees.get(key) ?? 0;
    if (n >= 5) return false; // full house
    this.hiveBees.set(key, n + 1);
    return true;
  }
  private hiveLeave(key: number) {
    const n = this.hiveBees.get(key) ?? 0;
    if (n <= 1) this.hiveBees.delete(key);
    else this.hiveBees.set(key, n - 1);
  }

  /** attacking a hive: every bee inside (or nearby) comes out ANGRY — task 5 */
  private angerBees(hx: number, hy: number, hz: number) {
    for (const m of this.mobSys.mobs) {
      if (!m.alive || m.id !== 'bee') continue;
      const insideThis =
        m.hidden && Math.floor(m.taskX) === hx && m.taskY === hy && Math.floor(m.taskZ) === hz;
      const nearby = !m.hidden && Math.hypot(m.x - hx, m.z - hz) < 8;
      if (!insideThis && !nearby) continue;
      if (m.hidden) {
        // burst out of the entrance
        m.hidden = false;
        m.x = hx + 0.5;
        m.y = hy - 0.1;
        m.z = hz + 0.7;
        m.vy = 2.5;
      }
      m.task = 5; // angry!
      m.taskT = 10; // give up after 10s
      m.taskX = 2; // stings left
      this.burst(m.x, m.y + 0.4, m.z, [244, 100, 40], 6, 2);
    }
    if (this.survival || true) sfx.crack(4);
  }

  /** ambient FX on occupied hive entrances: honey drips by day, sleep Zzz at night */
  private updateHiveFx(dt: number) {
    this.hiveFxTimer -= dt;
    if (this.hiveFxTimer > 0) return;
    this.hiveFxTimer = 0.9;
    const night = this.daylight < 0.35;
    for (const [key, count] of this.hiveBees) {
      if (count <= 0) continue;
      const [hx, hy, hz] = Engine.unpackCell(key);
      // skip far-away hives
      if (Math.hypot(hx - this.pos.x, hz - this.pos.z) > 36) continue;
      const ex = hx + 0.5;
      const ey = hy + 0.35; // entrance hole height
      const ez = hz + 0.55;
      if (night) {
        // slow pale "Zzz" motes drifting up from the entrance
        this.burst(ex, ey + 0.25, ez, [200, 210, 240], 1 + (count > 2 ? 1 : 0), 0.4);
      } else {
        // busy hive: honey-coloured working sparkles at the hole
        this.burst(ex, ey, ez, [244, 184, 58], 1 + Math.min(2, count - 1), 0.7);
      }
    }
  }

  /** nearest hive block within r, or null */
  private findHiveNear(x: number, y: number, z: number, r: number): [number, number, number] | null {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    for (let dy = -3; dy <= 4; dy++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (this.world.get(bx + dx, by + dy, bz + dz) === HIVE) return [bx + dx, by + dy, bz + dz];
    return null;
  }

  private updateBirdNests(dt: number) {
    // Placing nests is rare; checking a handful of adults and at most six nests
    // every few seconds has no world-generation or per-voxel overhead.
    this.birdNestTimer -= dt;
    if (this.birdNestTimer <= 0) {
      this.birdNestTimer = 10 + Math.random() * 6;
      if (this.daylight > 0.35 && this.birdNests.length < 6) {
        for (const parent of this.mobSys.mobs) {
          if (!parent.alive || parent.grow > 0 || parent.task === 6 || !parent.onGround ||
            (parent.id !== 'bird' && parent.id !== 'chicken') ||
            Math.hypot(parent.x - this.pos.x, parent.z - this.pos.z) > 42) continue;
          const x = Math.floor(parent.x), z = Math.floor(parent.z);
          const y = Math.floor(parent.y + 0.12);
          if (y <= 1 || y >= WY - 2 || this.world.get(x, y, z) !== AIR) continue;
          const below = this.world.get(x, y - 1, z);
          if (parent.id === 'bird' ? !isLeafId(below) : below !== GRASS) continue;
          if (this.birdNests.some((n) => Math.hypot(n.x - x, n.z - z) < 6)) continue;
          if (parent.id === 'chicken') {
            // Hens choose cover: under a tree or beside tall meadow grass.
            let sheltered = false;
            for (let dx = -2; dx <= 2 && !sheltered; dx++)
              for (let dz = -2; dz <= 2 && !sheltered; dz++) {
                if (dx || dz) {
                  const plant = this.world.get(x + dx, y, z + dz);
                  if (plant === TALL_GRASS || plant === FERN) sheltered = true;
                }
                for (let dy = 2; dy <= 7 && !sheltered; dy++)
                  if (isLeafId(this.world.get(x + dx, y + dy, z + dz))) sheltered = true;
              }
            if (!sheltered) continue;
          }
          const kind = parent.id;
          this.world.set(x, y, z, kind === 'bird' ? BIRD_NEST : CHICKEN_NEST);
          this.birdNests.push({ x, y, z, kind, t: 32 + Math.random() * 18, brooding: true });
          // Parent settles onto the nest; the hatch timer only runs while a
          // matching adult is actually brooding nearby.
          parent.task = 6;
          parent.taskX = x + 0.5;
          parent.taskY = y;
          parent.taskZ = z + 0.5;
          parent.taskT = 999;
          parent.tx = x + 0.5;
          parent.tz = z + 0.5;
          parent.think = 2;
          this.markDirtyAt(x, z);
          this.burst(x + 0.5, y + 0.3, z + 0.5, kind === 'bird' ? [100, 69, 42] : [211, 177, 92], 4, 0.8);
          break;
        }
      }
    }
    for (let i = this.birdNests.length - 1; i >= 0; i--) {
      const nest = this.birdNests[i];
      const expected = nest.kind === 'bird' ? BIRD_NEST : CHICKEN_NEST;
      if (this.world.get(nest.x, nest.y, nest.z) !== expected ||
          !(nest.kind === 'bird' ? isLeafId(this.world.get(nest.x, nest.y - 1, nest.z)) :
            this.world.get(nest.x, nest.y - 1, nest.z) === GRASS)) {
        if (this.world.get(nest.x, nest.y, nest.z) === expected) {
          this.world.set(nest.x, nest.y, nest.z, AIR); this.markDirtyAt(nest.x, nest.z);
        }
        for (const parent of this.mobSys.mobs) {
          if (parent.alive && parent.id === nest.kind && parent.task === 6 &&
              Math.hypot(parent.x - (nest.x + 0.5), parent.z - (nest.z + 0.5)) < 2.5) {
            parent.task = 0; parent.think = 0.5;
          }
        }
        this.birdNests.splice(i, 1);
        continue;
      }
      // Don't spawn chicks far outside the active wildlife area.
      if (Math.hypot(nest.x - this.pos.x, nest.z - this.pos.z) > 48) continue;
      nest.brooding = this.mobSys.mobs.some((parent) =>
        parent.alive && parent.id === nest.kind && parent.grow <= 0 && parent.task === 6 &&
        Math.hypot(parent.x - (nest.x + 0.5), parent.z - (nest.z + 0.5)) < 1.45 &&
        Math.abs(parent.y - nest.y) < 1.4,
      );
      if (!nest.brooding) {
        let closest: Mob | null = null;
        let best = 10;
        for (const parent of this.mobSys.mobs) {
          if (!parent.alive || parent.id !== nest.kind || parent.grow > 0 || parent.task === 6) continue;
          const d = Math.hypot(parent.x - (nest.x + 0.5), parent.z - (nest.z + 0.5));
          if (d < best && Math.abs(parent.y - nest.y) < 4) { best = d; closest = parent; }
        }
        if (closest) {
          closest.task = 6;
          closest.taskX = nest.x + 0.5;
          closest.taskY = nest.y;
          closest.taskZ = nest.z + 0.5;
          closest.taskT = 999;
          closest.tx = closest.taskX;
          closest.tz = closest.taskZ;
          closest.think = 2;
        }
        continue; // eggs stay cold: no progress without a brooding parent
      }
      nest.t -= dt;
      if (nest.t > 0 || this.mobSys.mobs.length >= this.mobSys.maxMobs - 2) continue;
      this.world.set(nest.x, nest.y, nest.z, AIR);
      this.markDirtyAt(nest.x, nest.z);
      this.birdNests.splice(i, 1);
      for (const parent of this.mobSys.mobs) {
        if (parent.alive && parent.id === nest.kind && parent.task === 6 &&
            Math.hypot(parent.x - (nest.x + 0.5), parent.z - (nest.z + 0.5)) < 2.5) {
          parent.task = 0;
          parent.think = 0.6;
          parent.jumpCd = 1.2;
        }
      }
      for (let b = 0; b < 2; b++) {
        const baby = this.mobSys.spawn(nest.kind, nest.x + 0.35 + b * 0.3, nest.y + 0.05, nest.z + 0.5);
        if (baby) {
          baby.grow = 60;
          baby.group.scale.setScalar(baby.def.scale * baby.modelSize * 0.35);
          baby.jumpCd = 2;
        }
      }
      this.burst(nest.x + 0.5, nest.y + 0.3, nest.z + 0.5, [239, 232, 207], 8, 1.2);
      if (Math.hypot(this.pos.x - nest.x - 0.5, this.pos.z - nest.z - 0.5) < 4)
        this.popup(nest.x + 0.5, nest.y + 0.6, nest.z + 0.5, t('eggHatched'), '#f1d797');
    }
  }

  /** Crush every type of egg under any part of the player's feet (not just
   * the voxel beneath the centre). Spider egg sacs are world objects, too. */
  private crushEggsUnderfoot() {
    if (!this.onGround) return;
    const fy = Math.floor(this.pos.y + 0.08);
    const margin = PLAYER_HALF - 0.02;
    let lastCrushed: [number, number, number] | null = null;
    for (let x = Math.floor(this.pos.x - margin); x <= Math.floor(this.pos.x + margin); x++)
      for (let z = Math.floor(this.pos.z - margin); z <= Math.floor(this.pos.z + margin); z++) {
        const id = this.world.get(x, fy, z);
        if (id !== TURTLE_EGG && id !== PENGUIN_EGG && id !== BIRD_NEST && id !== CHICKEN_NEST) continue;
        this.world.set(x, fy, z, AIR);
        this.birdNests = this.birdNests.filter((n) => n.x !== x || n.y !== fy || n.z !== z);
        this.turtleEggs = this.turtleEggs.filter((n) => n.x !== x || n.y !== fy || n.z !== z);
        if (id === PENGUIN_EGG || id === BIRD_NEST || id === CHICKEN_NEST) for (const parent of this.mobSys.mobs) {
          const expectedParent = id === PENGUIN_EGG ? 'penguin' : id === BIRD_NEST ? 'bird' : 'chicken';
          if (parent.id === expectedParent && parent.task === 6 &&
              Math.hypot(parent.x - x - 0.5, parent.z - z - 0.5) < 2.5) {
            parent.task = 0;
            parent.think = 0;
          }
        }
        this.markDirtyAt(x, z);
        this.burst(x + 0.5, fy + 0.25, z + 0.5, [231, 228, 210], 10, 1.8);
        lastCrushed = [x, fy, z];
      }
    // Spider egg sacs are tracked separately, rather than voxel blocks.
    for (let i = this.spiderEggs.length - 1; i >= 0; i--) {
      const egg = this.spiderEggs[i];
      if (Math.abs(egg.x - this.pos.x) > margin + 0.25 ||
          Math.abs(egg.z - this.pos.z) > margin + 0.25 ||
          Math.abs(egg.y - this.pos.y) > 0.55) continue;
      this.spiderEggs.splice(i, 1);
      this.burst(egg.x, egg.y + 0.15, egg.z, [235, 237, 232], 10, 1.8);
      lastCrushed = [egg.x - 0.5, egg.y, egg.z - 0.5];
    }
    if (lastCrushed) {
      const [x, y, z] = lastCrushed;
      this.popup(x + 0.5, y + 0.7, z + 0.5, t('eggCrushed'), '#e2564a');
      sfx.crack(1);
      this.addShake(0.12);
    }
  }

  private fruitFallTimer = 5;
  private updateNature(dt: number) {
    this.crushEggsUnderfoot();
    // Hedgehogs forage for fallen apples: carry one on their back, then eat it.
    for (const hedgehog of this.mobSys.mobs) {
      if (!hedgehog.alive || hedgehog.id !== 'hedgehog') continue;
      const carried = hedgehog.group.userData.carriedApple as THREE.Mesh | undefined;
      if (carried) {
        hedgehog.group.userData.appleEatTime = (hedgehog.group.userData.appleEatTime ?? 8) - dt;
        if (hedgehog.group.userData.appleEatTime <= 0) {
          hedgehog.group.remove(carried);
          carried.geometry.dispose();
          (carried.material as THREE.Material).dispose();
          delete hedgehog.group.userData.carriedApple;
          hedgehog.group.userData.appleEatTime = 8;
        }
        continue;
      }
      // In the summer forest, pause to nibble a nearby mushroom. The plant stays
      // in place throughout the chew and is removed only on the final bite.
      if (!this.world.isWinter(Math.floor(hedgehog.x), Math.floor(hedgehog.z))) {
        const bx = Math.floor(hedgehog.x), bz = Math.floor(hedgehog.z), by = Math.floor(hedgehog.y);
        if (hedgehog.group.userData.mushroomNibble === undefined) {
          outer: for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) for (let dy=-1;dy<=1;dy++) {
            if (this.world.get(bx+dx,by+dy,bz+dz) === MUSHROOM) {
              hedgehog.group.userData.mushroomNibble = {x:bx+dx,y:by+dy,z:bz+dz,t:4.6};
              break outer;
            }
          }
        }
        const nibble = hedgehog.group.userData.mushroomNibble as {x:number;y:number;z:number;t:number}|undefined;
        if (nibble) {
          nibble.t -= dt;
          if (nibble.t <= 0) {
            if (this.world.get(nibble.x,nibble.y,nibble.z) === MUSHROOM) {
              this.world.set(nibble.x,nibble.y,nibble.z,AIR);
              this.markDirtyAt(nibble.x,nibble.z);
            }
            delete hedgehog.group.userData.mushroomNibble;
          }
          continue;
        }
      }
      const apple = this.drops.find((d) => d.active && d.id === APPLE && Math.hypot(d.x - hedgehog.x, d.z - hedgehog.z) < 1.1 && Math.abs(d.y - hedgehog.y) < 1.5);
      if (apple) {
        apple.active = false; this.scene.remove(apple.mesh);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,0.18), new THREE.MeshLambertMaterial({color:'#d84c38'}));
        mesh.position.set(0,0.72,0.12); hedgehog.group.add(mesh);
        hedgehog.group.userData.carriedApple = mesh;
        hedgehog.group.userData.appleEatTime = 8;
      }
    }
    // Occasionally a ripe fruit drops from a nearby living tree canopy.
    this.fruitFallTimer -= dt;
    if (this.fruitFallTimer <= 0) {
      this.fruitFallTimer = 7 + Math.random() * 13;
      if (Math.random() < 0.7) {
        const px = Math.floor(this.pos.x), pz = Math.floor(this.pos.z);
        for (let attempt = 0; attempt < 16; attempt++) {
          const x = px + Math.floor(Math.random() * 25) - 12;
          const z = pz + Math.floor(Math.random() * 25) - 12;
          const y = Math.floor(this.pos.y) + 2 + Math.floor(Math.random() * 11);
          const leaf = this.world.get(x, y, z);
          const fruit = leaf === APPLE_LEAVES ? APPLE : leaf === COCONUT_LEAVES ? COCONUT : leaf === BANANA_LEAVES ? BANANA : 0;
          if (fruit && this.world.get(x, y - 1, z) === AIR) {
            this.spawnDrop(x + 0.5, y - 0.15, z + 0.5, fruit);
            break;
          }
        }
      }
    }
    // ---- egg laying: turtles ONLY on sand, penguins ONLY on snowy ground ----
    this.eggTimer -= dt;
    if (this.eggTimer <= 0) {
      this.eggTimer = 14 + Math.random() * 10;
      if (this.turtleEggs.length < 6) {
        const layers = this.mobSys.mobs.filter(
          (m) => m.alive && (m.id === 'turtle' || m.id === 'penguin') && m.grow <= 0,
        );
        for (const tu of layers) {
          const bx = Math.floor(tu.x);
          const bz = Math.floor(tu.z);
          const by = Math.floor(tu.y);
          const ground = this.world.get(bx, by - 1, bz);
          const okGround = tu.id === 'turtle' ? ground === SAND : ground === SNOW_GRASS || ground === ICE;
          if (okGround && this.world.get(bx, by, bz) === AIR) {
            // penguins lay their own egg type and will brood it
            this.world.set(bx, by, bz, tu.id === 'turtle' ? TURTLE_EGG : PENGUIN_EGG);
            this.turtleEggs.push({
              x: bx,
              y: by,
              z: bz,
              t: 50 + Math.random() * 30,
              kind: tu.id === 'turtle' ? 'turtle' : 'penguin',
            });
            if (tu.id === 'penguin') {
              // the parent settles onto the nest (task 6 = brooding)
              tu.task = 6;
              tu.taskX = bx + 0.5;
              tu.taskZ = bz + 0.5;
            }
            this.markDirtyAt(bx, bz);
            this.burst(bx + 0.5, by + 0.3, bz + 0.5, [230, 235, 225], 5, 1.4);
            break;
          }
        }
      }
    }
    // ---- hatch / verify ----
    for (let i = this.turtleEggs.length - 1; i >= 0; i--) {
      const egg = this.turtleEggs[i];
      const expect = egg.kind === 'penguin' ? PENGUIN_EGG : TURTLE_EGG;
      if (this.world.get(egg.x, egg.y, egg.z) !== expect) {
        this.turtleEggs.splice(i, 1); // mined or crushed
        continue;
      }
      // penguin eggs only develop while a parent broods on the nest
      if (egg.kind === 'penguin') {
        egg.brooding = this.mobSys.mobs.some(
          (p) =>
            p.alive &&
            p.id === 'penguin' &&
            p.grow <= 0 &&
            Math.hypot(p.x - (egg.x + 0.5), p.z - (egg.z + 0.5)) < 1.2,
        );
        if (!egg.brooding) continue; // timer frozen without a warm belly
      }
      egg.t -= dt;
      if (egg.t <= 0) {
        this.world.set(egg.x, egg.y, egg.z, AIR);
        this.markDirtyAt(egg.x, egg.z);
        this.turtleEggs.splice(i, 1);
        // release the brooding parent back to normal life
        if (egg.kind === 'penguin') {
          for (const p of this.mobSys.mobs) {
            if (p.alive && p.id === 'penguin' && p.task === 6 && Math.hypot(p.x - (egg.x + 0.5), p.z - (egg.z + 0.5)) < 2) {
              p.task = 0;
              p.think = 0;
            }
          }
        }
        // babies match whoever laid the clutch, then grow up over ~60s
        const n = 1 + (Math.random() < 0.6 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0);
        for (let b = 0; b < n; b++) {
          const a = Math.random() * Math.PI * 2;
          const baby = this.mobSys.spawn(
            egg.kind,
            egg.x + 0.5 + Math.cos(a) * (0.6 + Math.random() * 0.8),
            egg.y + 0.2,
            egg.z + 0.5 + Math.sin(a) * (0.6 + Math.random() * 0.8),
          );
          if (baby) {
            baby.grow = 60; // starts at 35% size, reaches adult in a minute
            baby.group.scale.setScalar(baby.def.scale * 0.35);
          }
        }
        this.burst(egg.x + 0.5, egg.y + 0.4, egg.z + 0.5, [230, 235, 225], 10, 2);
        if (Math.hypot(this.pos.x - egg.x - 0.5, this.pos.y + 0.8 - egg.y - 0.5, this.pos.z - egg.z - 0.5) <= 2) {
          this.popup(egg.x + 0.5, egg.y + 0.8, egg.z + 0.5, t('eggHatched'), '#7ab88a');
          sfx.pickup(2);
        }
      }
    }
    this.updateBirdNests(dt);

    // ---- cave spiders: weave webs & lay eggs that hatch into spiderlings ----
    this.spiderTimer -= dt;
    if (this.spiderTimer <= 0) {
      this.spiderTimer = 8;
      if (this.survival) {
        for (const m of this.mobSys.mobs) {
          if (!m.alive || m.id !== 'spider') continue;
          const sx = Math.floor(m.x);
          const sy = Math.floor(m.y);
          const sz = Math.floor(m.z);
          // "in a cave" = solid roof somewhere above
          const roofed = this.world.topSolidY(sx, sz) > sy + 1;
          if (!roofed) continue;
          const r = Math.random();
          if (r < 0.3) {
            // weave: drop a collectible web strand nearby
            this.spawnDrop(m.x + (Math.random() - 0.5), m.y + 0.4, m.z + (Math.random() - 0.5), WEB);
            this.burst(m.x, m.y + 0.6, m.z, [238, 240, 245], 4, 1);
          } else if (r < 0.42 && this.spiderEggs.length < 4) {
            // lay an egg sac on the cave floor
            this.spiderEggs.push({ x: m.x, y: m.y + 0.2, z: m.z, t: 30 + Math.random() * 25 });
            this.burst(m.x, m.y + 0.3, m.z, [238, 240, 245], 6, 1.4);
          }
        }
      }
    }
    for (let i = this.spiderEggs.length - 1; i >= 0; i--) {
      const egg = this.spiderEggs[i];
      egg.t -= dt;
      // faint pulsing web glow so the sac is spottable in the dark
      if (Math.random() < dt * 2) this.burst(egg.x, egg.y + 0.2, egg.z, [238, 240, 245], 1, 0.4);
      if (egg.t <= 0) {
        this.spiderEggs.splice(i, 1);
        const n = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let b = 0; b < n; b++) {
          this.mobSys.spawn('spiderling', egg.x + (Math.random() - 0.5), egg.y, egg.z + (Math.random() - 0.5));
        }
        this.burst(egg.x, egg.y + 0.3, egg.z, [196, 52, 42], 10, 2);
        sfx.crack(3);
      }
    }

    // ---- bee state machine: roam → pollinate a flower → carry pollen to a hive ----
    this.beeTimer -= dt;
    if (this.beeTimer <= 0) {
      this.beeTimer = 0.55;
      const beeNight = this.daylight < 0.35;
      for (const m of this.mobSys.mobs) {
        if (!m.alive || m.id !== 'bee') continue;

        // ---- task 5: ANGRY — chase the player and sting (1 dmg, max 2 stings) ----
        if (m.task === 5) {
          m.taskT -= 0.55;
          const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
          if (m.taskT <= 0 || m.taskX <= 0 || d > 12) {
            // calmed down (or you outran it) → fly back home
            m.task = 0;
            m.think = 0;
          } else {
            m.tx = this.pos.x;
            m.tz = this.pos.z;
            m.think = 2;
            if (m.group.visible && Math.random() < 0.5)
              this.burst(m.x, m.y + 0.4, m.z, [244, 100, 40], 1, 0.6);
            if (d < 1.3 && Math.abs(m.y - (this.pos.y + 1)) < 1.6) {
              // sting!
              m.taskX -= 1;
              this.killedBy = t('mob_bee');
              this.damage(1, 'mob');
              this.burst(this.pos.x, this.pos.y + 1.4, this.pos.z, [244, 100, 40], 5, 2);
              sfx.crack(2);
              // bounce away after the hit
              const bx2 = m.x - this.pos.x;
              const bz2 = m.z - this.pos.z;
              const bd = Math.hypot(bx2, bz2) || 1;
              m.vx += (bx2 / bd) * 5;
              m.vz += (bz2 / bd) * 5;
              m.vy += 2;
            }
          }
          continue;
        }

        // ---- night: every bee heads home and sleeps INSIDE the hive till dawn ----
        if (beeNight && m.task !== 4 && m.task !== 3) {
          const hive = this.findHiveNear(m.x, m.y, m.z, 20);
          if (hive) {
            m.task = 4;
            m.taskX = hive[0] + 0.5;
            m.taskY = hive[1];
            m.taskZ = hive[2] + 0.5;
          } else {
            m.task = 0; // no hive — just idle in the dark
            m.tx = m.x;
            m.tz = m.z;
            m.think = 3;
            continue;
          }
        }
        if (m.task === 4) {
          if (m.hidden) {
            // asleep inside the hive: pinned to the hive cell, invisible
            if (!beeNight || this.world.get(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)) !== HIVE) {
              // dawn (or hive broken) → pop out just below the entrance
              this.hiveLeave(Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)));
              m.hidden = false;
              m.x = m.taskX;
              m.y = m.taskY - 0.2;
              m.z = m.taskZ + 0.6;
              m.vy = 1.5;
              m.task = 0;
              this.burst(m.x, m.y + 0.3, m.z, [244, 192, 80], 4, 1);
            }
            continue;
          }
          // still flying home
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 3;
          const closeH =
            Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.2 && Math.abs(m.y + 0.4 - m.taskY) < 2.2;
          if (closeH) {
            // crawl inside and vanish for the night (if there's room — max 5)
            const hk = Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ));
            if (this.hiveEnter(hk)) {
              m.hidden = true;
              m.x = m.taskX;
              m.y = m.taskY;
              m.z = m.taskZ;
              m.vx = 0;
              m.vy = 0;
              m.vz = 0;
            } else {
              // hive full — doze on top of it instead
              m.tx = m.taskX;
              m.tz = m.taskZ;
              m.think = 3;
            }
          } else if (!beeNight) {
            m.task = 0; // dawn caught the bee mid-flight — back to work
          }
          continue; // no sparkles at night
        }

        if (Math.random() < 0.4 && m.group.visible) this.burst(m.x, m.y + 0.4, m.z, [244, 192, 80], 1, 0.5);

        if (m.task === 0) {
          // roam: look for a flower within 6 blocks
          const bx = Math.floor(m.x);
          const by = Math.floor(m.y);
          const bz = Math.floor(m.z);
          outer2: for (let dy = -2; dy <= 2; dy++)
            for (let dz = -6; dz <= 6; dz++)
              for (let dx = -6; dx <= 6; dx++) {
                if (isFlower(this.world.get(bx + dx, by + dy, bz + dz))) {
                  m.task = 1;
                  m.taskX = bx + dx + 0.5;
                  m.taskY = by + dy;
                  m.taskZ = bz + dz + 0.5;
                  m.taskT = 30; // pollination: exactly 30s of game time
                  break outer2;
                }
              }
        } else if (m.task === 1) {
          // pollinating: hover at the bloom, sparkle. HARD CAP 30s of game time —
          // when it expires the bee ALWAYS heads for a hive.
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          m.taskT -= 0.55;
          const near = Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.4;
          if (near && m.group.visible) this.burst(m.taskX, m.taskY + 0.7, m.taskZ, [255, 220, 120], 3, 1, 0.25);
          const flowerGone = !isFlower(this.world.get(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ)));
          if (m.taskT <= 0 || flowerGone) {
            // time's up → fly to the hive with whatever pollen was gathered
            const hive = this.findHiveNear(m.x, m.y, m.z, 14);
            if (hive) {
              m.task = 2;
              m.taskX = hive[0] + 0.5;
              m.taskY = hive[1];
              m.taskZ = hive[2] + 0.5;
              m.taskT = 30; // hard cap on the flight home
            } else m.task = 0; // no hive around — back to roaming
          }
        } else if (m.task === 2) {
          // flying home with pollen
          m.tx = m.taskX;
          m.tz = m.taskZ;
          m.think = 2;
          m.taskT -= 0.55;
          const hx = Math.floor(m.taskX);
          const hz = Math.floor(m.taskZ);
          if (this.world.get(hx, m.taskY, hz) !== HIVE || m.taskT <= 0) {
            m.task = 0; // hive gone / lost interest
          } else if (Math.hypot(m.x - m.taskX, m.z - m.taskZ) < 1.5 && Math.abs(m.y - m.taskY) < 2.5) {
            // arrived → crawl INSIDE and brew honey (only if there's room, max 5)
            const hk2 = Engine.packCell(Math.floor(m.taskX), m.taskY, Math.floor(m.taskZ));
            if (this.hiveEnter(hk2)) {
              m.task = 3;
              m.taskT = 30;
              m.hidden = true;
              m.x = m.taskX;
              m.y = m.taskY;
              m.z = m.taskZ;
              m.vx = 0;
              m.vy = 0;
              m.vz = 0;
            } else {
              m.task = 0; // full hive — drop the pollen, try later
            }
          }
        } else if (m.task === 3) {
          // hidden inside the hive, making honey — then it flies back out
          m.taskT -= 0.55;
          const hx = Math.floor(m.taskX);
          const hz = Math.floor(m.taskZ);
          const hiveGone = this.world.get(hx, m.taskY, hz) !== HIVE;
          if (hiveGone || m.taskT <= 0) {
            if (!hiveGone && m.taskT <= 0) {
              const key = Engine.packCell(hx, m.taskY, hz);
              const cur = this.hiveHoney.get(key) ?? 0;
              if (cur < 3) {
                this.hiveHoney.set(key, cur + 1);
                this.burst(m.taskX, m.taskY + 0.5, m.taskZ, [244, 184, 58], 8, 1.6);
                sfx.pickup(1);
              }
            }
            // emerge from the entrance (or spill out of the wreckage)
            this.hiveLeave(Engine.packCell(hx, m.taskY, hz));
            m.hidden = false;
            m.x = m.taskX;
            m.y = m.taskY - 0.2;
            m.z = m.taskZ + 0.6;
            m.vy = 1.5;
            m.task = beeNight ? 4 : 0; // if night fell during the brew — go back in to sleep
            if (m.task === 4) {
              m.taskX = hx + 0.5;
              m.taskZ = hz + 0.5;
            }
            this.burst(m.x, m.y + 0.3, m.z, [244, 192, 80], 4, 1);
          }
        }
      }
    }

    // ---- predation: crabs raid eggs & fish, turtles eat fish and defend nests ----
    this.predTimer -= dt;
    if (this.predTimer <= 0) {
      this.predTimer = 2;
      const crabs: Mob[] = [];
      const turtles: Mob[] = [];
      const fish: Mob[] = [];
      for (const m of this.mobSys.mobs) {
        if (!m.alive) continue;
        if (m.id === 'crab') crabs.push(m);
        else if (m.id === 'turtle' && m.grow <= 0) turtles.push(m);
        else if (m.id === 'fish') fish.push(m);
      }
      // crabs: nearest egg within reach gets eaten; otherwise snack on shallow fish
      for (const c of crabs) {
        let ate = false;
        for (let i = this.turtleEggs.length - 1; i >= 0; i--) {
          const egg = this.turtleEggs[i];
          const d = Math.hypot(egg.x + 0.5 - c.x, egg.z + 0.5 - c.z);
          if (d < 1.6 && Math.abs(egg.y - c.y) < 1.5) {
            this.world.set(egg.x, egg.y, egg.z, AIR);
            this.markDirtyAt(egg.x, egg.z);
            this.turtleEggs.splice(i, 1);
            this.burst(egg.x + 0.5, egg.y + 0.3, egg.z + 0.5, [230, 235, 225], 10, 2);
            ate = true;
            break;
          } else if (d < 9) {
            // crab senses a nest — scuttle toward it
            c.tx = egg.x + 0.5;
            c.tz = egg.z + 0.5;
            c.think = 3;
          }
        }
        if (!ate && Math.random() < 0.35) {
          for (const f of fish) {
            if (Math.hypot(f.x - c.x, f.y - c.y, f.z - c.z) < 1.5) {
              this.mobSys.remove(f);
              this.burst(f.x, f.y + 0.3, f.z, [94, 156, 216], 8, 2);
              break;
            }
          }
        }
      }
      // turtles: eat fish; attack any crab that is threatening a nest
      for (const tu of turtles) {
        if (Math.random() < 0.3) {
          for (const f of fish) {
            if (Math.hypot(f.x - tu.x, f.y - tu.y, f.z - tu.z) < 1.4) {
              this.mobSys.remove(f);
              this.burst(f.x, f.y + 0.3, f.z, [94, 156, 216], 8, 2);
              break;
            }
          }
        }
        for (const c of crabs) {
          if (!c.alive) continue;
          // is this crab menacing any nest?
          const menacing = this.turtleEggs.some((e) => Math.hypot(e.x + 0.5 - c.x, e.z + 0.5 - c.z) < 5);
          if (!menacing) continue;
          const d = Math.hypot(c.x - tu.x, c.z - tu.z);
          if (d < 1.8) {
            // snap! the crab becomes lunch
            this.mobSys.remove(c);
            this.burst(c.x, c.y + 0.3, c.z, [216, 90, 58], 12, 2.4);
            const crabMeat = meatDropForAnimal(c.id, c.variant, Math.abs(c.group.scale.x));
            if (crabMeat) this.spawnDrop(c.x, c.y + 0.4, c.z, crabMeat.rawId);
          } else if (d < 8) {
            tu.tx = c.x;
            tu.tz = c.z;
            tu.think = 3;
          }
        }
      }
    }
  }

  // ================= ANVIL & WORKBENCH =================
  anvilNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -1; dy <= 2; dy++)
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === ANVIL) return true;
    return false;
  }

  workbenchNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === CRAFTING_TABLE) return true;
    return false;
  }

  private findGearByUid(uid: string): { item: Item; equippedSlot: Slot | null } | null {
    const bagIdx = this.bagItems.findIndex((x) => x.uid === uid);
    if (bagIdx >= 0) return { item: this.bagItems[bagIdx], equippedSlot: null };
    for (const slot of Object.keys(this.equipped) as Slot[]) {
      const it = this.equipped[slot];
      if (it && it.uid === uid) return { item: it, equippedSlot: slot };
    }
    return null;
  }

  /** diamond gear + 1 netherite scrap → netherite gear (stats ×1.5, affixes kept) */
  upgradeToNetherite(uid: string) {
    const found = this.findGearByUid(uid);
    if (!found || found.item.material !== 'diamond') return;
    if ((this.inventory.get(NETHERITE) ?? 0) < 1) {
      sfx.ui(false);
      return;
    }
    this.inventory.set(NETHERITE, (this.inventory.get(NETHERITE) ?? 0) - 1);
    const it = found.item;
    it.material = 'netherite';
    it.visualColor = undefined;
    it.armor = Math.round(it.armor * 1.5);
    it.damage = Math.round(it.damage * 1.5);
    if (found.equippedSlot) {
      this.stats = computeStats(this.equipped);
      this.syncAvatarArmor();
    }
    sfx.upgrade();
    this.addShake(0.35);
    this.flash = 0.4;
    this.pushBanner(matName('NETHERITE'), `${t(('slot_' + it.slot) as never)} · ⛨${it.armor}`, '#8a6a58');
    this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [138, 106, 88], 20, 4);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /** hammer 4 iron into any piece for +2 armour */
  reinforceItem(uid: string) {
    const found = this.findGearByUid(uid);
    if (!found) return;
    if ((this.inventory.get(IRON) ?? 0) < 4) {
      sfx.ui(false);
      return;
    }
    this.inventory.set(IRON, (this.inventory.get(IRON) ?? 0) - 4);
    found.item.armor += 2;
    if (found.equippedSlot) this.stats = computeStats(this.equipped);
    sfx.place();
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, '+2 ⛨', '#d6d9dd');
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /** Repair one individual tool/weapon at a nearby anvil using its matching raw material. */
  repairTool(instanceId: number) {
    if (!this.anvilNear() && this.invTab !== 'anvil') {
      sfx.ui(false);
      return false;
    }
    const instance = this.toolInstances.get(instanceId);
    if (!instance) return false;
    const spec = getToolSpec(instance.id);
    if (!spec || spec.maxDurability <= 0 || !spec.repairResource) return false;
    const cost = toolRepairCost(instance.id, instance.durability);
    if (cost <= 0) return false;
    const available = this.inventory.get(spec.repairResource) ?? 0;
    if (available < cost) {
      sfx.ui(false);
      return false;
    }
    const remaining = available - cost;
    if (remaining > 0) this.inventory.set(spec.repairResource, remaining);
    else this.inventory.delete(spec.repairResource);
    const restored = spec.maxDurability - instance.durability;
    instance.durability = spec.maxDurability;
    sfx.upgrade();
    this.pushBanner(t('toolRepaired'), `${toolLabelForId(instance.id)} · +${restored}`, spec.edge);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  // ================= STRUCTURE GUARDS =================
  private guardedSites = new Set<number>();
  private guardTimer = 0;
  /** smoothed travel direction — wildlife spawns ahead of where you're going */
  private travelDir = { x: 0, z: 0 };
  private travelSpeed = 0;
  /** water bodies already stocked with a fish school (packed cell keys) */
  private stockedWater = new Set<number>();
  private wanderTraderTimer = 30;
  private stockTimer = 0;

  /**
   * Fish schools: whenever a new water area comes near, drop a whole school
   * (4–7 fish) into it at once — ponds feel alive the moment you see them.
   * Region key = 8×8-block water cell, so big lakes get several schools.
   */
  private stockWaterAhead(biasAngle: number | null) {
    this.stockTimer -= 1;
    if (this.stockTimer > 0) return;
    this.stockTimer = 30; // every ~0.5s
    // probe a point near / ahead of the player
    const a = biasAngle !== null ? biasAngle + (Math.random() * 2 - 1) * 0.9 : Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 26;
    const wx = this.pos.x + Math.cos(a) * r;
    const wz = this.pos.z + Math.sin(a) * r;
    const water = this.world.findWaterNear(wx, wz, 8);
    if (!water) return;
    const regionKey = Engine.packCell(Math.floor(water[0] / 8), 0, Math.floor(water[2] / 8));
    if (this.stockedWater.has(regionKey)) {
      // A school may have swum away or been recycled after the player left.
      if (this.mobSys.mobs.some((m) => m.alive && m.id === 'fish' && Math.hypot(m.x - water[0], m.z - water[2]) < 9)) return;
      this.stockedWater.delete(regionKey);
    }
    if (this.mobSys.mobs.filter((m) => m.alive && m.id === 'fish').length >= 36) return;
    this.stockedWater.add(regionKey);
    if (this.stockedWater.size > 400) this.stockedWater.clear(); // stale far-away regions
    // Small fish travel in larger, tighter schools; larger species mingle in
    // smaller groups. A few deeper pools harbour drifting jellyfish.
    const frySchool = Math.random() < 0.5;
    const school = frySchool ? 9 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < school; i++) {
      const fx = water[0] + (Math.random() - 0.5) * (frySchool ? 2.5 : 5);
      const fz = water[2] + (Math.random() - 0.5) * (frySchool ? 2.5 : 5);
      const fy = Math.max(2, water[1] - 1);
      const px = Math.floor(fx), pz = Math.floor(fz);
      const inWater = this.world.get(px, fy, pz) === WATER;
      const vi = frySchool ? 5 : Math.floor(Math.random() * 5);
      this.mobSys.spawn('fish', inWater ? fx : water[0], fy, inWater ? fz : water[2], vi);
    }
    if (this.world.get(Math.floor(water[0]), water[1] - 2, Math.floor(water[2])) === WATER && Math.random() < 0.32) {
      this.mobSys.spawn('jellyfish', water[0], water[1] - 1, water[2]);
    }
  }

  private updateGuards(dt: number) {
    if (!this.survival) return;
    this.guardTimer -= dt;
    if (this.guardTimer > 0) return;
    this.guardTimer = 1.5;
    for (let i = 0; i < this.world.structureSites.length; i++) {
      const s = this.world.structureSites[i];
      if (this.guardedSites.has(i)) continue;
      const d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
      if (d > 26) continue;
      this.guardedSites.add(i);
      // sunlight-proof garrison so the guards survive the day shift
      const picks: MobId[] = s.kind === 'tower' ? ['spider', 'creeper', 'spider'] : ['spider', 'creeper'];
      for (const id of picks) {
        const p = this.mobSys.findSpawnPoint(s.x, s.z, 2, 7, null, undefined, id);
        if (p) this.mobSys.spawn(id, p[0], p[1], p[2]);
      }
    }
  }

  // ================= BLOCK GRAVITY =================
  /** blocks with no support below AND on all four sides crumble into drops */
  private gravQueue: number[] = [];
  private gravSet = new Set<number>();

  private gravKey(x: number, y: number, z: number) {
    return Engine.packCell(x, y, z);
  }

  private enqueueSupportCheck(x: number, y: number, z: number) {
    const push = (px: number, py: number, pz: number) => {
      if (!this.world.inBounds(px, py, pz)) return;
      const k = this.gravKey(px, py, pz);
      if (this.gravSet.has(k)) return;
      this.gravSet.add(k);
      this.gravQueue.push(k);
    };
    push(x + 1, y, z);
    push(x - 1, y, z);
    push(x, y + 1, z);
    push(x, y, z + 1);
    push(x, y, z - 1);
  }

  private vineTips = new Map<number, { x: number; y: number; z: number; t: number }>();
  private wheatCropGrowth = new Map<number, { x: number; y: number; z: number; stage: number; timer: number }>();

  private growWheatCrops(dt: number) {
    for (const [key, crop] of this.wheatCropGrowth) {
      const expectedId = crop.stage === 1 ? WHEAT_CROP_1 : crop.stage === 2 ? WHEAT_CROP_2 : WHEAT_CROP_3;
      if (this.world.get(crop.x, crop.y, crop.z) !== expectedId) {
        this.wheatCropGrowth.delete(key);
        continue;
      }
      crop.timer -= dt;
      if (crop.timer > 0) continue;
      if (crop.stage >= 3) {
        this.wheatCropGrowth.delete(key);
        continue;
      }
      crop.stage += 1;
      crop.timer = crop.stage === 3 ? 32 : 24;
      this.world.set(crop.x, crop.y, crop.z, crop.stage === 2 ? WHEAT_CROP_2 : WHEAT_CROP_3);
      this.markDirtyAt(crop.x, crop.z);
    }
  }

  private growVines(dt: number) {
    for (const [key, tip] of this.vineTips) {
      if (Math.hypot(tip.x - this.pos.x, tip.z - this.pos.z) > 80) {
        this.vineTips.delete(key);
        continue;
      }
      tip.t -= dt;
      if (tip.t > 0) continue;
      this.vineTips.delete(key);
      if (this.world.get(tip.x, tip.y, tip.z) !== VINE ||
          tip.y <= 1 || this.world.get(tip.x, tip.y - 1, tip.z) !== AIR) continue;
      let anchorY = tip.y;
      while (anchorY + 1 < WY && this.world.get(tip.x, anchorY + 1, tip.z) === VINE) anchorY++;
      if (!isLeafId(this.world.get(tip.x, anchorY + 1, tip.z))) continue;
      this.world.set(tip.x, tip.y - 1, tip.z, VINE);
      this.markDirtyAt(tip.x, tip.z);
      this.vineTips.set(Engine.packCell(tip.x, tip.y - 1, tip.z),
        { ...tip, y: tip.y - 1, t: 4 + Math.random() * 4 });
    }
  }

  private updateBlockGravity() {
    if (!this.gravQueue.length) return;
    let crumbled = false;
    let budget = 18;
    while (this.gravQueue.length && budget-- > 0) {
      const k = this.gravQueue.shift()!;
      this.gravSet.delete(k);
      const [x, y, z] = Engine.unpackCell(k);
      const id = this.world.get(x, y, z);
      if (id === AIR || id === BEDROCK || id === LAVA || id === WATER || id === VINE || y <= 1) continue;
      if (id === SAND) {
        // Sand is gravity-driven: drop it into the first supported cell below.
        let fallY=y;
        while (fallY>1 && this.world.get(x,fallY-1,z)===AIR) {
          this.world.set(x,fallY,z,AIR); this.world.set(x,fallY-1,z,SAND); fallY--;
        }
        if (fallY!==y) { this.markDirtyAt(x,z); this.enqueueSupportCheck(x,fallY,z); this.enqueueSupportCheck(x,y,z); }
        continue;
      }
      if (isLadder(id)) {
        // Ladders hang only from a horizontal solid face; a floor beneath is not support.
        const attached =
          isSolid(this.world.get(x - 1, y, z)) || isSolid(this.world.get(x + 1, y, z)) ||
          isSolid(this.world.get(x, y, z - 1)) || isSolid(this.world.get(x, y, z + 1));
        if (attached) continue;
      } else if (isLeafId(id)) {
        // Palm crowns reach three blocks out; all leaf kinds recognise
        // their matching living trunk or adjacent solid structure block.
        let alive =
          isSolid(this.world.get(x, y - 1, z)) ||
          isSolid(this.world.get(x, y + 1, z)) ||
          isSolid(this.world.get(x + 1, y, z)) ||
          isSolid(this.world.get(x - 1, y, z)) ||
          isSolid(this.world.get(x, y, z + 1)) ||
          isSolid(this.world.get(x, y, z - 1));
        const reach = id === COCONUT_LEAVES || id === BANANA_LEAVES ? 3 : 2;
        for (let dy = -2; dy <= 2 && !alive; dy++)
          for (let dz2 = -reach; dz2 <= reach && !alive; dz2++)
            for (let dx2 = -reach; dx2 <= reach; dx2++)
              if ((reach === 3 ?
                this.world.get(x + dx2, y + dy, z + dz2) === PALM_LOG :
                isLogId(this.world.get(x + dx2, y + dy, z + dz2)))) {
                alive = true;
                break;
              }
        if (alive) continue;
      } else if (
        // regular blocks & hanging lanterns: supported from below, above, or any side
        isSolid(this.world.get(x, y - 1, z)) ||
        isSolid(this.world.get(x, y + 1, z)) ||
        isSolid(this.world.get(x + 1, y, z)) ||
        isSolid(this.world.get(x - 1, y, z)) ||
        isSolid(this.world.get(x, y, z + 1)) ||
        isSolid(this.world.get(x, y, z - 1))
      )
        continue;

      // unsupported → crumble
      const chestSpilled = isTreasureChest(id) && this.spillChestContents(x, y, z, id);
      this.world.set(x, y, z, AIR);
      const def = BLOCKS[id];
      if (!chestSpilled && def.drop) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, def.drop);
      this.burst(x + 0.5, y + 0.5, z + 0.5, def.tint, 6, 2.2);
      this.markDirtyAt(x, z);
      crumbled = true;
      this.enqueueSupportCheck(x, y, z);
    }
    if (crumbled) sfx.breakBlock(0.9);
  }

  /** Minecraft-style hoe use: till exposed grass/dirt into farmland instantly. */
  private tryTill() {
    const tg = this.target;
    if (!tg || (tg.id !== GRASS && tg.id !== DIRT)) return false;
    // A crop/solid block above the soil prevents tilling, matching Minecraft's
    // rule that the target needs an open space above it.
    if (this.world.get(tg.x, tg.y + 1, tg.z) !== AIR) return false;
    this.world.set(tg.x, tg.y, tg.z, FARMLAND);
    this.rebuildAt(tg.x, tg.z);
    this.placeCooldown = 0.18;
    this.startSwing(0.05);
    this.damageHeldTool(1);
    sfx.place();
    this.burst(tg.x + 0.5, tg.y + 1.02, tg.z + 0.5, [116, 79, 54], 5, 1.2);
    this.updateTarget();
    this.syncHotbar(true);
    return true;
  }

  private tryPlace() {
    if (this.phase !== 'playing') return;
    if (this.placeCooldown > 0) return;
    const id = this.hotbar[this.selected];
    if (!id || id === HAND) return;
    // Right-clicking while holding Armor in hand equips it immediately
    if (isGearHotbarId(id)) {
      const g = this.bagItems.find((b) => b.hid === id);
      if (g) {
        this.equip(g.uid);
        this.placeCooldown = 0.25;
      }
      return;
    }
    // Raw meat can be roasted directly from the selected slot by right-clicking its campfire.
    const cookedId = cookedMeatForRaw(id);
    if (cookedId !== null) {
      const target = this.target;
      const count = this.inventory.get(id) ?? 0;
      if (target?.id === CAMPFIRE && count > 0) {
        this.inventory.set(id, count - 1);
        this.inventory.set(cookedId, (this.inventory.get(cookedId) ?? 0) + 1);
        this.placeCooldown = 0.38;
        this.startSwing(0.45);
        sfx.place();
        this.burst(target.x + 0.5, target.y + 0.55, target.z + 0.5, [255, 152, 52], 8, 1.1);
        this.popup(target.x + 0.5, target.y + 1.2, target.z + 0.5, `${blockName(cookedId, BLOCKS[cookedId]?.name ?? 'Cooked meat')}!`, '#ffc15e', true);
        this.recordExplorerCook();
        this.syncHotbar(true);
        this.syncHud(true);
      }
      return;
    }
    // Right-clicking while holding prepared food consumes one portion.
    const healAmount = foodHeal(id);
    if (healAmount > 0) {
      const count = this.inventory.get(id) ?? 0;
      if (count > 0) {
        this.inventory.set(id, count - 1);
        this.health = Math.min(100, this.health + healAmount);
        this.hunger = Math.min(100, this.hunger + Math.max(18, healAmount * 2));
        this.placeCooldown = 0.32;
        this.startSwing(0.45);
        sfx.pickup(4);
        this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${healAmount} ${t('hp')}`, '#93c95d', true);
        this.syncHotbar(true);
        this.syncHud(true);
      }
      return;
    }
    if (this.heldKind() === 'hoe') {
      this.tryTill();
      return;
    }
    const t2 = this.target;
    if (!t2) return;
    if (id === WHEAT_SEEDS) {
      const cropY = t2.y + 1;
      const count = this.inventory.get(WHEAT_SEEDS) ?? 0;
      if (t2.id !== FARMLAND || count <= 0 || this.world.get(t2.x, cropY, t2.z) !== AIR) return;
      this.world.set(t2.x, cropY, t2.z, WHEAT_CROP_1);
      this.wheatCropGrowth.set(Engine.packCell(t2.x, cropY, t2.z), { x: t2.x, y: cropY, z: t2.z, stage: 1, timer: 24 });
      this.inventory.set(WHEAT_SEEDS, count - 1);
      this.rebuildAt(t2.x, t2.z);
      this.placeCooldown = 0.2;
      sfx.place();
      this.burst(t2.x + 0.5, cropY + 0.3, t2.z + 0.5, [127, 174, 62], 5, 0.8);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    if (id >= TOOL_PICK || isResource(id)) return; // tools/resources don't place as blocks
    if ((this.inventory.get(id) ?? 0) <= 0) {
      if (this.placeCooldown <= 0) {
        sfx.ui(false);
        this.placeCooldown = 0.4;
      }
      return;
    }
    const px = t2.x + t2.nx,
      py = t2.y + t2.ny,
      pz = t2.z + t2.nz;
    if (!this.world.inBounds(px, py, pz)) return;
    const targetCell = this.world.get(px, py, pz);
    if (targetCell !== AIR && targetCell !== WATER) return; // building displaces water
    if (isLadder(id)) {
      const attached =
        isSolid(this.world.get(px - 1, py, pz)) || isSolid(this.world.get(px + 1, py, pz)) ||
        isSolid(this.world.get(px, py, pz - 1)) || isSolid(this.world.get(px, py, pz + 1));
      if (!attached) {
        sfx.ui(false);
        this.placeCooldown = 0.3;
        return;
      }
    }
    // don't entomb the player
    const minX = this.pos.x - PLAYER_HALF - 0.02,
      maxX = this.pos.x + PLAYER_HALF + 0.02;
    const minY = this.pos.y - 0.02,
      maxY = this.pos.y + PLAYER_HEIGHT + 0.02;
    const minZ = this.pos.z - PLAYER_HALF - 0.02,
      maxZ = this.pos.z + PLAYER_HALF + 0.02;
    if (!isLadder(id) && px + 1 > minX && px < maxX && py + 1 > minY && py < maxY && pz + 1 > minZ && pz < maxZ) return;

    // Placing lava into a water cell is itself a contact, not a free swap.
    const placed = id === LAVA && targetCell === WATER ? VOLCANIC_STONE : id;
    this.world.set(px, py, pz, placed);
    if (placed === CHEST_STORAGE) this.chestInventories.set(Engine.chestCellKey(px, py, pz), new Map());
    if (placed === BED) {
      // Place the 2nd block (head) of the 2-block Minecraft bed along player's facing direction
      const pref: [number, number] =
        Math.abs(this.dirV.x) >= Math.abs(this.dirV.z)
          ? [this.dirV.x >= 0 ? 1 : -1, 0]
          : [0, this.dirV.z >= 0 ? 1 : -1];
      const candidates: Array<[number, number]> = [
        pref,
        [-pref[0], -pref[1]],
        [-pref[1], pref[0]],
        [pref[1], -pref[0]],
      ];
      for (const [bdx, bdz] of candidates) {
        const hx = px + bdx;
        const hz = pz + bdz;
        if (this.world.inBounds(hx, py, hz) && this.world.get(hx, py, hz) === AIR) {
          this.world.set(hx, py, hz, BED);
          this.rebuildAt(hx, hz);
          break;
        }
      }
    } else if (
      (placed === DOOR_WOOD || placed === DOOR_IRON) &&
      this.world.inBounds(px, py + 1, pz) &&
      this.world.get(px, py + 1, pz) === AIR &&
      this.world.get(px, py - 1, pz) !== placed
    ) {
      this.world.set(px, py + 1, pz, placed);
    }
    this.inventory.set(id, (this.inventory.get(id) ?? 0) - 1);
    this.enqueueFluid(px, py, pz); // placing next to fluid disturbs it
    this.rebuildAt(px, pz);
    this.placeCooldown = 0.18;
    this.startSwing(0.5);
    sfx.place();
    if (isLadder(id)) {
      this.queueTutorialTip('mechanic:ladder', t('tutorialLadderTitle'), t('tutorialLadderBody'), '#93c95d', 'ladder');
    }
    this.burst(px + 0.5, py + 0.5, pz + 0.5, BLOCKS[placed].tint, 5, 1.6);
    this.syncHotbar(true);
  }

  // ================= DROPS =================
  /** pretty 3D miniatures for animal & monster loot (instead of textured cubes) */
  private static fancyBox(
    g: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    rx = 0,
    rz = 0,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    g.add(m);
  }

  private buildToolModel(id: number, wearRatio = 0): THREE.Group {
    const spec = getToolSpec(id);
    const group = new THREE.Group();
    if (!spec) return group;

    const wear = Number.isFinite(wearRatio) ? Math.max(0, Math.min(1, wearRatio)) : 0;
    const materialCache = new Map<string, THREE.MeshLambertMaterial>();
    const outlineColor = spec.tier === 0 ? '#4b2a1c' : '#17171a';
    const material = (color: string, glow = false) => {
      const key = `${color}:${glow}`;
      let found = materialCache.get(key);
      if (!found) {
        found = new THREE.MeshLambertMaterial({
          color,
          emissive: glow ? color : '#000000',
          emissiveIntensity: glow ? 0.34 : 0,
        });
        materialCache.set(key, found);
      }
      return found;
    };
    const addBox = (
      w: number, h: number, d: number, x: number, y: number, z: number,
      color: string, outline = true, glow = false, parent: THREE.Group = group,
    ) => {
      // Keep each box's outline and colored face together so rotations and wear deformation
      // affect the complete part instead of leaving the dark pixel shell behind.
      const part = new THREE.Group();
      part.position.set(x, y, z);
      if (outline) {
        part.add(new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.14, h * 1.14, d * 1.14),
          material(outlineColor),
        ));
      }
      part.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color, glow)));
      parent.add(part);
      return part;
    };
    const addSegment = (
      x1: number, y1: number, x2: number, y2: number, width: number, color: string,
      parent: THREE.Group = group,
    ) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);
      const segment = addBox(width, length, width, (x1 + x2) / 2, (y1 + y2) / 2, 0, color, true, false, parent);
      segment.rotation.z = -Math.atan2(dx, dy);
      return segment;
    };
    const pivot = (x: number, y: number, z = 0) => {
      const part = new THREE.Group();
      part.position.set(x, y, z);
      group.add(part);
      return part;
    };
    const addAt = (
      parent: THREE.Group, w: number, h: number, d: number,
      x: number, y: number, z: number, color: string, outline = true, glow = false,
    ) => addBox(
      w, h, d,
      x - parent.position.x,
      y - parent.position.y,
      z - parent.position.z,
      color, outline, glow, parent,
    );

    if (spec.kind === 'bow') {
      // The grip is the bow's pivot. Worn limbs contract around it and the chips remain
      // on the curved wood instead of being emitted as unrelated floating cubes.
      const bow = pivot(-0.2, 0.02);
      const curve: Array<[number, number]> = [
        [0.08, 0.46], [-0.03, 0.32], [-0.09, 0.1], [-0.06, -0.15], [0.04, -0.4],
      ];
      for (let i = 0; i < curve.length - 1; i++) {
        addSegment(...curve[i], ...curve[i + 1], 0.075, spec.handle, bow);
      }
      addSegment(0.08, 0.46, 0.04, -0.4, 0.018, '#e4d9c7', bow);
      addBox(0.1, 0.2, 0.1, 0, 0, 0.02, spec.edge, true, false, bow);
      addBox(0.105, 0.05, 0.12, 0, 0, 0.025, spec.accent, false, false, bow);
      bow.scale.setScalar(1 - wear * 0.12);
      if (wear >= 0.08) {
        const chip = addBox(0.022, 0.065, 0.009, -0.057, 0.22, 0.043, '#342522', false, false, bow);
        chip.rotation.z = -0.28;
      }
      if (wear >= 0.42) {
        const chip = addBox(0.022, 0.07, 0.009, -0.005, -0.23, 0.043, '#342522', false, false, bow);
        chip.rotation.z = 0.25;
      }
      if (wear >= 0.76) {
        addBox(0.025, 0.035, 0.009, 0.052, 0.1, 0.017, '#b9a88d', false, false, bow);
      }
    } else if (spec.kind === 'sword') {
      // Blade deformation is pivoted at the guard: it gets narrower and genuinely shorter
      // as condition falls, while the grip, pommel and guard remain attached and intact.
      const blade = new THREE.Group();
      group.add(blade);
      addBox(0.13, 0.68, 0.08, 0, 0.35, 0, spec.head, true, false, blade);
      addBox(0.085, 0.57, 0.09, -0.016, 0.39, 0.045, spec.edge, true, false, blade);
      addBox(0.045, 0.38, 0.012, -0.016, 0.43, 0.093, spec.accent, false, spec.tier === 5, blade);
      addBox(0.18, 0.14, 0.11, 0, 0.79, 0, spec.head, true, false, blade);
      addBox(0.28, 0.085, 0.13, 0, -0.025, 0, spec.edge);
      addBox(0.095, 0.29, 0.105, 0, -0.22, 0, spec.handle);
      addBox(0.14, 0.07, 0.14, 0, -0.4, 0, spec.head);
      addBox(0.045, 0.055, 0.115, 0, -0.22, 0.06, spec.accent, false);
      blade.scale.set(1 - wear * 0.15, 1 - wear * 0.42, 1 - wear * 0.08);
      if (wear >= 0.08) {
        addBox(0.022, 0.065, 0.009, 0.044, 0.53, 0.103, '#392b28', false, false, blade);
      }
      if (wear >= 0.42) {
        addBox(0.02, 0.055, 0.009, -0.045, 0.31, 0.103, '#392b28', false, false, blade);
      }
      if (wear >= 0.76) {
        addBox(0.025, 0.055, 0.009, 0.043, 0.19, 0.103, '#392b28', false, false, blade);
      }
    } else {
      // Shared wrapped haft: diagonal leather bands make the silhouette read at small scale.
      const haft = addBox(0.095, 0.78, 0.095, -0.025, -0.17, 0, spec.handle);
      haft.rotation.z = -0.13;
      for (let i = 0; i < 3; i++) {
        const band = addBox(0.112, 0.04, 0.112, -0.025, -0.37 + i * 0.12, 0, i === 1 ? spec.accent : '#34251d', false);
        band.rotation.z = -0.13;
      }
      addBox(0.13, 0.1, 0.13, -0.025, -0.58, 0, spec.head);

      if (spec.kind === 'pickaxe') {
        const head = pivot(0, 0.37);
        addAt(head, 0.68, 0.15, 0.19, 0, 0.37, 0, spec.head);
        addAt(head, 0.23, 0.17, 0.2, -0.39, 0.33, 0, spec.head).rotation.z = -0.45;
        addAt(head, 0.23, 0.17, 0.2, 0.39, 0.33, 0, spec.head).rotation.z = 0.45;
        addAt(head, 0.42, 0.045, 0.205, 0, 0.415, 0.012, spec.edge, false);
        addAt(head, 0.1, 0.1, 0.205, 0, 0.36, 0.02, spec.accent, false, spec.tier === 5);
        head.scale.set(1 - wear * 0.24, 1 - wear * 0.2, 1 - wear * 0.08);
        if (wear >= 0.08) addAt(head, 0.06, 0.025, 0.01, 0.45, 0.38, 0.109, '#332a29', false);
        if (wear >= 0.42) addAt(head, 0.055, 0.025, 0.01, -0.45, 0.38, 0.109, '#332a29', false);
        if (wear >= 0.76) addAt(head, 0.045, 0.022, 0.01, 0.39, 0.32, 0.11, '#332a29', false);
      } else if (spec.kind === 'axe') {
        const head = pivot(0.14, 0.34);
        addAt(head, 0.32, 0.28, 0.2, 0.17, 0.34, 0, spec.head);
        addAt(head, 0.15, 0.36, 0.21, 0.34, 0.32, 0, spec.edge);
        addAt(head, 0.06, 0.24, 0.22, 0.41, 0.32, 0, spec.accent, false, spec.tier === 5);
        addAt(head, 0.19, 0.08, 0.205, 0.12, 0.47, 0.01, spec.edge, false);
        head.scale.set(1 - wear * 0.26, 1 - wear * 0.18, 1 - wear * 0.08);
        if (wear >= 0.08) addAt(head, 0.024, 0.065, 0.01, 0.39, 0.35, 0.114, '#332a29', false);
        if (wear >= 0.42) addAt(head, 0.03, 0.06, 0.01, 0.37, 0.22, 0.114, '#332a29', false);
        if (wear >= 0.76) addAt(head, 0.026, 0.055, 0.01, 0.34, 0.43, 0.114, '#332a29', false);
      } else if (spec.kind === 'hoe') {
        const head = pivot(0.11, 0.34);
        addAt(head, 0.27, 0.13, 0.16, 0.11, 0.34, 0, spec.head);
        addAt(head, 0.1, 0.3, 0.18, 0.28, 0.22, 0, spec.edge);
        addAt(head, 0.05, 0.23, 0.19, 0.34, 0.22, 0, spec.accent, false, spec.tier === 5);
        head.scale.set(1 - wear * 0.22, 1 - wear * 0.22, 1 - wear * 0.08);
        if (wear >= 0.08) addAt(head, 0.025, 0.055, 0.01, 0.35, 0.25, 0.103, '#332a29', false);
        if (wear >= 0.42) addAt(head, 0.025, 0.05, 0.01, 0.32, 0.17, 0.103, '#332a29', false);
        if (wear >= 0.76) addAt(head, 0.025, 0.05, 0.01, 0.28, 0.34, 0.103, '#332a29', false);
      } else {
        const head = pivot(0.02, 0.43);
        addAt(head, 0.3, 0.34, 0.2, 0.02, 0.43, 0, spec.head);
        addAt(head, 0.23, 0.11, 0.21, 0.02, 0.56, 0.01, spec.edge, false);
        addAt(head, 0.12, 0.08, 0.215, 0.02, 0.4, 0.015, spec.accent, false, spec.tier === 5);
        head.scale.set(1 - wear * 0.2, 1 - wear * 0.25, 1 - wear * 0.08);
        if (wear >= 0.08) addAt(head, 0.045, 0.022, 0.01, 0.09, 0.57, 0.12, '#332a29', false);
        if (wear >= 0.42) addAt(head, 0.04, 0.022, 0.01, -0.04, 0.56, 0.12, '#332a29', false);
        if (wear >= 0.76) addAt(head, 0.04, 0.022, 0.01, 0.02, 0.51, 0.12, '#332a29', false);
      }
    }

    return group;
  }

  private clearToolModel(group: THREE.Group) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => materials.add(m));
      else materials.add(mesh.material);
    });
    group.clear();
    geometries.forEach((geometry) => geometry.dispose());
    const textures = new Set<THREE.Texture>();
    materials.forEach((material) => {
      const textured = material as THREE.Material & { map?: THREE.Texture | null; emissiveMap?: THREE.Texture | null };
      if (textured.map) textures.add(textured.map);
      if (textured.emissiveMap) textures.add(textured.emissiveMap);
      material.dispose();
    });
    textures.forEach((texture) => texture.dispose());
  }

  private buildFancyDrop(id: number, durability?: number): THREE.Group | null {
    if (isArrowId(id)) return buildArrowModel(id);
    const toolSpec = getToolSpec(id);
    if (toolSpec) {
      const wear = toolWearRatio(durability ?? toolSpec.maxDurability, toolSpec.maxDurability);
      const model = new THREE.Group();
      model.add(this.buildToolModel(id, wear));
      model.rotation.set(0.18, 0, -0.16);
      return model;
    }
    const g = new THREE.Group();
    const B = Engine.fancyBox;
    if (isLadder(id)) {
      const palette = LADDER_PALETTE[id];
      for (const x of [-0.18, 0.18]) B(g, x, 0, 0, 0.06, 0.78, 0.07, palette.dark);
      for (const y of [-0.28, -0.1, 0.08, 0.26]) {
        B(g, 0, y, 0, 0.43, 0.065, 0.08, palette.dark);
        B(g, 0, y + 0.008, 0.018, 0.39, 0.035, 0.05, palette.light);
      }
      g.rotation.set(0.16, 0.24, -0.08);
      return g;
    }
    switch (id) {
      case WOOL: {
        // fluffy cloud of offset puffs
        B(g, 0, 0, 0, 0.3, 0.24, 0.3, 0xeeeeeb);
        B(g, 0.12, 0.08, -0.06, 0.2, 0.18, 0.2, 0xf8f8f5);
        B(g, -0.11, 0.06, 0.08, 0.18, 0.16, 0.18, 0xe0e0dc);
        B(g, 0.02, 0.15, 0.05, 0.16, 0.13, 0.16, 0xffffff);
        break;
      }
      case FEATHER: {
        // quill + vane, tilted
        B(g, 0, 0, 0, 0.04, 0.42, 0.04, 0xc8c4b8, 0, 0.5);
        B(g, 0.07, 0.08, 0, 0.16, 0.3, 0.03, 0xf2f2f6, 0, 0.5);
        B(g, 0.12, 0.2, 0, 0.1, 0.16, 0.03, 0xdcdce4, 0, 0.5);
        break;
      }
      case TURTLE_SHELL: {
        // domed carapace with scute plates
        B(g, 0, 0, 0, 0.42, 0.12, 0.5, 0x4d8c5a);
        B(g, 0, 0.09, 0, 0.32, 0.1, 0.38, 0x5a9e68);
        B(g, 0, 0.17, 0, 0.2, 0.08, 0.24, 0x7ab88a);
        B(g, 0, -0.07, 0, 0.36, 0.04, 0.44, 0xd8cfa8); // pale rim
        break;
      }
      case CRAB_SHELL: {
        B(g, 0, 0, 0, 0.38, 0.1, 0.3, 0xd85a3a);
        B(g, 0, 0.08, 0, 0.28, 0.09, 0.22, 0xf2836a);
        B(g, 0.2, 0.02, -0.08, 0.08, 0.06, 0.1, 0xa83c22); // spike
        B(g, -0.2, 0.02, -0.08, 0.08, 0.06, 0.1, 0xa83c22);
        break;
      }
      case FISH_SCALE: {
        B(g, 0, 0, 0, 0.22, 0.26, 0.04, 0x6eaadc, 0.2);
        B(g, 0, 0.08, 0.01, 0.16, 0.12, 0.03, 0x9ecdf2, 0.2);
        break;
      }
      case CAT_CLAW: {
        // curved talon from three angled segments
        B(g, 0, 0.1, 0, 0.09, 0.16, 0.09, 0xc8bca4);
        B(g, 0.05, -0.02, 0, 0.07, 0.16, 0.07, 0xe6dcc8, 0, -0.5);
        B(g, 0.13, -0.13, 0, 0.05, 0.14, 0.05, 0xf2ecda, 0, -0.9);
        break;
      }
      case HONEY: {
        // amber droplet
        B(g, 0, 0, 0, 0.22, 0.26, 0.22, 0xf4b83a);
        B(g, 0, 0.16, 0, 0.12, 0.14, 0.12, 0xf4b83a);
        B(g, 0.05, 0.05, 0.05, 0.08, 0.08, 0.08, 0xffd97a); // glint
        break;
      }
      case RAW_MEAT: {
        B(g, 0, 0, 0, 0.34, 0.16, 0.26, 0xd2574c);
        B(g, 0.05, 0.05, 0, 0.16, 0.1, 0.14, 0xf0938a); // marbling
        B(g, -0.15, 0, 0, 0.06, 0.18, 0.28, 0xf8e3d4); // fat rim
        break;
      }
      case COOKED_MEAT: {
        B(g, 0, 0, 0, 0.34, 0.16, 0.26, 0x9a5a2c);
        B(g, 0.04, 0.05, 0, 0.18, 0.09, 0.14, 0xc07c42);
        B(g, -0.08, 0.07, 0.04, 0.12, 0.03, 0.05, 0x5a3116); // grill marks
        break;
      }
      case BONE: {
        B(g, 0, 0, 0, 0.09, 0.4, 0.09, 0xe8e2d2, 0, 0.4);
        B(g, -0.1, 0.2, 0, 0.12, 0.12, 0.12, 0xf4efe2, 0, 0.4);
        B(g, 0.1, -0.2, 0, 0.12, 0.12, 0.12, 0xf4efe2, 0, 0.4);
        break;
      }
      case FLESH: {
        B(g, 0, 0, 0, 0.3, 0.14, 0.26, 0x7a9a4a);
        B(g, 0.06, 0.06, -0.03, 0.14, 0.08, 0.12, 0x5a7a34);
        B(g, -0.07, 0.04, 0.06, 0.1, 0.06, 0.08, 0xa05a4a); // raw patch
        break;
      }
      case GUNPOWDER: {
        // little grey mound
        B(g, 0, -0.05, 0, 0.3, 0.1, 0.3, 0x4a4a52);
        B(g, 0, 0.03, 0, 0.2, 0.1, 0.2, 0x55555c);
        B(g, 0.02, 0.1, -0.02, 0.1, 0.08, 0.1, 0x7a7a84);
        break;
      }
      case WEB: {
        // spun silk bundle
        B(g, 0, 0, 0, 0.26, 0.2, 0.26, 0xeef0f5);
        B(g, 0.08, 0.06, 0.08, 0.14, 0.12, 0.14, 0xffffff);
        B(g, -0.09, -0.04, -0.05, 0.12, 0.1, 0.12, 0xd8dce6);
        break;
      }
      case FLOWER_RED:
      case FLOWER_YELLOW:
      case FLOWER_BLUE:
      case FLOWER_PINK:
      case FLOWER_PURPLE:
      case FLOWER_WHITE: {
        const petal = id === FLOWER_RED ? 0xe2564a
          : id === FLOWER_YELLOW ? 0xf4c842
            : id === FLOWER_BLUE ? 0x5e8cff
              : id === FLOWER_PINK ? 0xf28bb5
                : id === FLOWER_PURPLE ? 0xa875df
                  : 0xfff8e8;
        const core = id === FLOWER_YELLOW ? 0xb8722a : 0xf4c842;
        B(g, 0, -0.12, 0, 0.05, 0.24, 0.05, 0x4d8c31, 0, 0.3);
        B(g, 0.07, -0.16, 0, 0.1, 0.04, 0.06, 0x5f9738);
        if (id === FLOWER_PURPLE) {
          for (let i = 0; i < 3; i++) {
            B(g, (i % 2 ? 0.04 : -0.04), -0.03 + i * 0.09, 0, 0.1, 0.09, 0.1, petal);
            B(g, (i % 2 ? -0.04 : 0.04), 0.005 + i * 0.09, 0.025, 0.07, 0.07, 0.07, 0xd9a3f0);
          }
        } else {
          B(g, 0, 0.05, 0, 0.11, 0.11, 0.11, core);
          B(g, 0.11, 0.05, 0, 0.11, 0.09, 0.09, petal);
          B(g, -0.11, 0.05, 0, 0.11, 0.09, 0.09, petal);
          B(g, 0, 0.05, 0.11, 0.09, 0.09, 0.11, petal);
          B(g, 0, 0.05, -0.11, 0.09, 0.09, 0.11, petal);
          if (id === FLOWER_WHITE) {
            B(g, 0.08, 0.05, 0.08, 0.08, 0.08, 0.08, petal);
            B(g, -0.08, 0.05, 0.08, 0.08, 0.08, 0.08, petal);
            B(g, 0.08, 0.05, -0.08, 0.08, 0.08, 0.08, petal);
            B(g, -0.08, 0.05, -0.08, 0.08, 0.08, 0.08, petal);
          }
          B(g, 0, 0.14, 0, 0.08, 0.05, 0.08, petal);
        }
        break;
      }
      case FLOWER_TULIP_RED:
      case FLOWER_TULIP_YELLOW:
      case FLOWER_TULIP_PINK:
      case FLOWER_TULIP_ORANGE:
      case FLOWER_TULIP_WHITE: {
        const cmap: Record<number, number> = {
          [FLOWER_TULIP_RED]: 0xd42a2a,
          [FLOWER_TULIP_YELLOW]: 0xe8c628,
          [FLOWER_TULIP_PINK]: 0xe46a9a,
          [FLOWER_TULIP_ORANGE]: 0xe86a18,
          [FLOWER_TULIP_WHITE]: 0xf0f0e8,
        };
        const col = cmap[id] ?? 0xd42a2a;
        B(g, 0, -0.14, 0, 0.04, 0.28, 0.04, 0x4a8a2a);
        B(g, 0, 0.02, 0, 0.14, 0.16, 0.14, col);
        B(g, 0, 0.12, 0, 0.10, 0.08, 0.10, col ^ 0x222222);
        B(g, 0, -0.08, 0, 0.03, 0.12, 0.03, 0x5a9a3a);
        break;
      }
      case FLOWER_SUNFLOWER:
      case TALL_SUNFLOWER: {
        const tall = id === TALL_SUNFLOWER;
        B(g, 0, -0.16, 0, 0.04, tall?0.36:0.28, 0.04, 0x4a8a2a);
        B(g, 0.05, -0.06, 0, 0.06, 0.08, 0.06, 0x5a9a3a);
        B(g, 0, 0.08, 0, 0.18, 0.05, 0.18, 0xe8c628);
        B(g, 0, 0.08, 0, 0.10, 0.10, 0.10, 0x8a6018);
        B(g, 0, 0.16, 0, 0.12, 0.04, 0.12, 0xffea4a);
        break;
      }
      case FLOWER_ROSE: {
        B(g, 0, -0.14, 0, 0.04, 0.28, 0.04, 0x4a8a2a);
        B(g, 0, 0.04, 0, 0.12, 0.14, 0.12, 0xb81e12);
        B(g, 0, 0.12, 0, 0.10, 0.08, 0.10, 0xe23628);
        B(g, 0.06, 0.06, 0, 0.06, 0.06, 0.06, 0xff7a6a);
        break;
      }
      case FLOWER_LAVENDER:
      case TALL_LAVENDER: {
        const tall = id === TALL_LAVENDER;
        B(g, 0, -0.16, 0, 0.03, tall?0.38:0.30, 0.03, 0x5a7a4a);
        for(let k=0;k<(tall?5:3);k++){
          const y = -0.04 + k*0.09;
          B(g, 0, y, 0, 0.09, 0.07, 0.09, 0x8a6ab8);
          B(g, 0.04, y+0.02, 0, 0.05, 0.05, 0.05, 0xb89ae0);
        }
        break;
      }
      case FLOWER_WISTERIA:
      case WISTERIA_VINE: {
        B(g, 0, 0.12, 0, 0.04, 0.18, 0.04, 0x6a5a4a);
        for(let k=0;k<4;k++){
          const y = 0.06 - k*0.11;
          B(g, (k%2?0.06:-0.06), y, 0, 0.11, 0.07, 0.11, 0x9a7ac8);
          B(g, (k%2?-0.04:0.04), y-0.02, 0.02, 0.07, 0.05, 0.07, 0xc8a0f0);
        }
        break;
      }
      case FLOWER_DAISY: {
        B(g, 0, -0.14, 0, 0.04, 0.28, 0.04, 0x4a8a2a);
        B(g, 0, 0.02, 0, 0.08, 0.08, 0.08, 0xe8c628);
        B(g, 0.12, 0.02, 0, 0.09, 0.07, 0.09, 0xf0f0e8);
        B(g, -0.12, 0.02, 0, 0.09, 0.07, 0.09, 0xf0f0e8);
        B(g, 0, 0.02, 0.12, 0.09, 0.07, 0.09, 0xf0f0e8);
        B(g, 0, 0.02, -0.12, 0.09, 0.07, 0.09, 0xf0f0e8);
        break;
      }
      case FLOWER_ORCHID: {
        B(g, 0, -0.14, 0, 0.04, 0.26, 0.04, 0x4a8a2a);
        B(g, 0, 0.04, 0, 0.10, 0.12, 0.10, 0xe46a9a);
        B(g, 0, 0.12, 0, 0.08, 0.06, 0.08, 0xff9abe);
        B(g, 0, -0.02, 0.08, 0.07, 0.07, 0.04, 0xffffff);
        break;
      }
      case FLOWER_PEONY: {
        B(g, 0, -0.14, 0, 0.04, 0.26, 0.04, 0x4a8a2a);
        B(g, 0, 0.02, 0, 0.18, 0.14, 0.18, 0xe46a9a);
        B(g, 0, 0.10, 0, 0.14, 0.10, 0.14, 0xff9abe);
        B(g, 0.05, 0.06, 0.05, 0.06, 0.06, 0.06, 0xffffff);
        break;
      }
      case BUSH:
      case BUSH_FLOWERING:
      case BERRY_BUSH: {
        B(g, 0, -0.06, 0, 0.22, 0.18, 0.22, 0x3a7a2a);
        B(g, 0, 0.06, 0, 0.18, 0.14, 0.18, 0x5a9a3a);
        B(g, 0.10, 0.02, 0.06, 0.10, 0.10, 0.10, 0x4a8a2a);
        B(g, -0.10, 0.04, -0.04, 0.10, 0.08, 0.10, 0x2a5a1a);
        if (id === BUSH_FLOWERING) {
          B(g, 0.08, 0.12, 0.05, 0.06, 0.06, 0.06, 0xf0f0e8);
          B(g, -0.07, 0.10, 0.04, 0.05, 0.05, 0.05, 0xff9abe);
        }
        if (id === BERRY_BUSH) {
          B(g, 0.09, 0.10, 0.04, 0.04, 0.04, 0.04, 0xd42a2a);
          B(g, -0.08, 0.08, 0.06, 0.04, 0.04, 0.04, 0xd42a2a);
        }
        break;
      }
      case MOSS_CARPET: {
        B(g, 0, -0.12, 0, 0.32, 0.06, 0.28, 0x4a9a3a);
        B(g, 0.08, -0.09, 0.05, 0.12, 0.04, 0.10, 0x6cbb4a);
        B(g, -0.09, -0.08, -0.04, 0.10, 0.03, 0.08, 0x3a7a2a);
        break;
      }
      case LEAF_PILE: {
        B(g, 0, -0.12, 0, 0.30, 0.07, 0.26, 0xc87a2a);
        B(g, 0.06, -0.08, 0.04, 0.14, 0.05, 0.12, 0xe89a3a);
        B(g, -0.07, -0.06, -0.03, 0.12, 0.04, 0.10, 0xa85a1a);
        break;
      }
      case TALL_GRASS: {
        // diverse tall grass: 4 blades with bend and varying green
        B(g, 0, -0.08, 0, 0.05, 0.32, 0.05, 0x4a8a2a, 0, 0.18);
        B(g, 0.07, -0.02, 0.02, 0.06, 0.28, 0.05, 0x6cbb4a, 0, -0.22);
        B(g, -0.06, 0.02, -0.01, 0.05, 0.26, 0.05, 0x5a9a3a, 0, 0.28);
        B(g, 0.03, 0.10, -0.04, 0.04, 0.18, 0.04, 0x78c64e, 0, -0.15);
        break;
      }
      case FERN: {
        // improved fern: central stem + feathery fronds
        B(g, 0, -0.08, 0, 0.04, 0.30, 0.04, 0x3a6a2a);
        B(g, -0.08, 0.06, 0, 0.12, 0.04, 0.06, 0x5a9a4a, 0, 0.35);
        B(g, -0.12, 0.00, 0.02, 0.10, 0.03, 0.05, 0x6cbb5a, 0, 0.45);
        B(g, 0.08, 0.08, 0, 0.12, 0.04, 0.06, 0x5a9a4a, 0, -0.35);
        B(g, 0.12, 0.02, -0.02, 0.10, 0.03, 0.05, 0x6cbb5a, 0, -0.45);
        B(g, 0, 0.14, 0, 0.14, 0.04, 0.06, 0x7acc6a, 0, 0);
        break;
      }
      case CAVE_VINE:
      case CAVE_VINE_GLOW: {
        const glow = id === CAVE_VINE_GLOW;
        B(g, 0, 0, 0, 0.06, 0.36, 0.06, 0x3a7a2a);
        B(g, 0.06, 0.08, 0, 0.08, 0.10, 0.08, 0x5a9a3a);
        if (glow) {
          B(g, 0, -0.12, 0, 0.10, 0.08, 0.10, 0xf0d860);
          B(g, 0, -0.18, 0, 0.06, 0.06, 0.06, 0xfff0a0);
        }
        break;
      }
      case GLOW_BERRY: {
        B(g, 0, 0, 0, 0.12, 0.12, 0.12, 0xf0d860);
        B(g, 0, 0.08, 0, 0.08, 0.08, 0.08, 0xfff0a0);
        break;
      }
      case HANGING_ROOTS: {
        B(g, 0, 0, 0, 0.06, 0.32, 0.06, 0x7a5a3a);
        B(g, 0.05, -0.04, 0, 0.04, 0.24, 0.04, 0x8a6a4a);
        break;
      }
      case SPORE_BLOSSOM: {
        B(g, 0, -0.08, 0, 0.04, 0.20, 0.04, 0x5a9a4a);
        B(g, 0, 0.04, 0, 0.16, 0.10, 0.16, 0xe46a9a);
        B(g, 0, 0.12, 0, 0.12, 0.06, 0.12, 0xff9abe);
        break;
      }
      case POINTED_DRIPSTONE:
      case STALACTITE:
      case STALAGMITE: {
        B(g, 0, 0, 0, 0.10, 0.32, 0.10, 0x8a7565);
        B(g, 0, -0.12, 0, 0.06, 0.16, 0.06, 0x9a8a7a);
        break;
      }
      case GLOW_LICHEN: {
        B(g, 0, 0, 0, 0.28, 0.06, 0.24, 0x6a9a5a);
        B(g, 0, 0.04, 0, 0.18, 0.04, 0.16, 0x8abb6a);
        break;
      }
      case DEAD_BUSH: {
        B(g, 0, 0, 0, 0.05, 0.24, 0.05, 0xa4845c, 0, 0.3);
        B(g, 0.05, 0.06, 0, 0.12, 0.04, 0.06, 0x88663e);
        break;
      }
      case COCONUT: {
        B(g, 0, 0, 0, 0.24, 0.22, 0.24, 0x75502e);
        B(g, 0, 0.11, 0, 0.14, 0.07, 0.14, 0xb89261);
        break;
      }
      case BANANA: {
        B(g, 0, 0, 0, 0.07, 0.26, 0.07, 0xf3d34f, 0, 0.7);
        B(g, 0.1, -0.08, 0, 0.08, 0.17, 0.07, 0xe6c035, 0, 0.4);
        break;
      }
      case APPLE: {
        // glossy red apple with stem and green leaf
        B(g, 0, 0, 0, 0.24, 0.24, 0.24, 0xe23628);
        B(g, 0, 0.12, 0, 0.18, 0.06, 0.18, 0xff5c4e); // top round
        B(g, 0.05, 0.04, 0.05, 0.09, 0.1, 0.09, 0xff7a6c); // glint
        B(g, 0, 0.17, 0, 0.04, 0.09, 0.04, 0x5c3d18, 0, 0.3); // stem
        B(g, 0.07, 0.17, 0, 0.09, 0.04, 0.06, 0x56a832, 0, 0.3); // leaf
        break;
      }
      case COAL: {
        // 3D Ember-Core Anthracite Shard Cluster: 3 jagged dark carbon spires + glowing orange ember heart
        B(g, 0, 0.03, 0, 0.14, 0.30, 0.14, 0x222636, 0.08, -0.08);
        B(g, -0.09, -0.02, 0.03, 0.12, 0.22, 0.12, 0x161924, 0, 0.28);
        B(g, 0.09, -0.01, -0.02, 0.12, 0.24, 0.12, 0x2c3145, -0.1, -0.26);
        // Glowing orange-gold ember fissure core
        B(g, 0, -0.01, 0.05, 0.09, 0.12, 0.08, 0xff771a);
        B(g, 0, 0.01, 0.07, 0.05, 0.07, 0.05, 0xffe270);
        break;
      }
      case IRON: {
        // 3D Dwarven Twin-Flanged Steel Bar with Brass Rivets
        B(g, 0, 0, 0, 0.34, 0.09, 0.14, 0x5c667a); // recessed gunmetal web
        B(g, 0, 0.055, 0, 0.34, 0.03, 0.17, 0xeef4fc); // top silver-steel rail
        B(g, 0, -0.055, 0, 0.34, 0.03, 0.17, 0x9aa6ba); // bottom steel rail
        B(g, -0.11, 0, 0, 0.07, 0.15, 0.19, 0xd6e0ed); // left flange collar
        B(g, 0.11, 0, 0, 0.07, 0.15, 0.19, 0xd6e0ed); // right flange collar
        B(g, -0.04, 0.07, 0, 0.035, 0.03, 0.06, 0xf0b442); // brass rivet L
        B(g, 0.04, 0.07, 0, 0.035, 0.03, 0.06, 0xf0b442); // brass rivet R
        break;
      }
      case REDSTONE: {
        // 3D Volatile Arcane Crimson Energy Crystal & Orbiting Sparks
        B(g, 0, 0.02, 0, 0.12, 0.32, 0.12, 0xc91230, 0.12, 0.18);
        B(g, 0, 0.02, 0, 0.18, 0.18, 0.18, 0xf01e42, 0.12, 0.18);
        B(g, 0, 0.02, 0, 0.09, 0.22, 0.15, 0xff6680, 0.12, 0.18);
        // Orbiting scarlet-pink energy motes
        B(g, -0.15, 0.13, 0.06, 0.06, 0.06, 0.06, 0xff2e4c);
        B(g, 0.15, 0.11, -0.05, 0.06, 0.06, 0.06, 0xff8598);
        B(g, -0.13, -0.10, -0.06, 0.05, 0.05, 0.05, 0xff2e4c);
        B(g, 0.13, -0.09, 0.06, 0.05, 0.05, 0.05, 0xff8598);
        break;
      }
      case GOLD: {
        // 3D Gleaming Beveled Pure-Gold Bullion Ingot (stepped trapezoidal gold bar with stamped mint ridges)
        B(g, 0, -0.045, 0, 0.36, 0.055, 0.21, 0xb8760b); // deep amber-gold base bevel
        B(g, 0, 0.005, 0, 0.32, 0.055, 0.175, 0xe8ad15); // warm gold middle body
        B(g, 0, 0.048, 0, 0.27, 0.035, 0.14, 0xfcd12a); // radiant sun-gold top table
        // Two raised stamped gold bullion bands + white-gold specular edge glint
        B(g, -0.065, 0.07, 0, 0.05, 0.018, 0.11, 0xffe975);
        B(g, 0.065, 0.07, 0, 0.05, 0.018, 0.11, 0xffe975);
        B(g, 0, 0.068, -0.045, 0.23, 0.014, 0.025, 0xfffbe0);
        break;
      }
      case LAPIS: {
        // 3D Faceted Royal Sapphire-Lazuli Gemstone (multi-tiered diamond/marquise-cut azure crystal)
        B(g, 0, 0, 0, 0.18, 0.28, 0.10, 0x142e8c, 0.08, 0.18); // deep ultramarine outer pavilion
        B(g, 0, 0, 0, 0.22, 0.20, 0.11, 0x1e46c7, 0.08, 0.18); // royal cobalt girdle
        B(g, 0, 0.01, 0, 0.15, 0.22, 0.13, 0x3369f5, 0.08, 0.18); // vivid azure crown facets
        B(g, 0, 0.01, 0, 0.10, 0.15, 0.15, 0x6ba1ff, 0.08, 0.18); // bright sky-blue central table
        B(g, -0.02, 0.05, 0.065, 0.045, 0.065, 0.03, 0xe0f0ff, 0.08, 0.18); // crisp white-azure gem shine
        break;
      }
      case DIAMOND: {
        // 3D 4-Pointed Star-Prism Ice Crystal
        B(g, 0, 0, 0, 0.11, 0.34, 0.11, 0x42e8f5); // vertical star spear
        B(g, 0, 0, 0, 0.32, 0.11, 0.11, 0x42e8f5); // horizontal star spear
        B(g, 0, 0, 0, 0.11, 0.11, 0.28, 0x1fa6bd); // depth star spear
        B(g, 0, 0, 0, 0.18, 0.18, 0.15, 0x8cfaff, 0, Math.PI / 4); // diagonal prism core
        B(g, 0, 0, 0, 0.10, 0.10, 0.17, 0xffffff); // brilliant white heart
        break;
      }
      case EMERALD: {
        // 3D Twin-Spire Jade Beryl Cluster on Dark Rock Matrix
        B(g, 0, -0.12, 0, 0.22, 0.08, 0.18, 0x323642); // dark rock matrix base
        B(g, 0.03, 0.03, 0, 0.12, 0.30, 0.11, 0x15b856, 0, -0.1); // tall main jade spire
        B(g, 0.03, 0.05, 0, 0.07, 0.26, 0.13, 0x5ef298, 0, -0.1); // bright mint facet
        B(g, -0.08, -0.02, 0.02, 0.09, 0.20, 0.09, 0x0f8f42, 0.08, 0.36); // angled side spire
        B(g, -0.08, 0, 0.02, 0.05, 0.16, 0.10, 0x8affb8, 0.08, 0.36); // side spire highlight
        break;
      }
      case QUARTZ: {
        // 3D Radiating 3-Pronged Rose-Ivory Geode Crown
        B(g, 0, -0.11, 0, 0.22, 0.08, 0.16, 0x4a1e2b); // dark volcanic geode base
        B(g, 0, 0.04, 0, 0.10, 0.28, 0.10, 0xf7f0f2); // central tall quartz needle
        B(g, 0, 0.07, 0, 0.06, 0.24, 0.11, 0xffffff); // pure white tip
        B(g, -0.09, 0.01, 0.02, 0.09, 0.22, 0.09, 0xdecbcf, 0.08, 0.42); // left angled needle
        B(g, 0.09, 0.01, -0.02, 0.09, 0.22, 0.09, 0xe8d8dc, -0.08, -0.42); // right angled needle
        break;
      }
      case NETHERITE: {
        // Broken scrap shard, distinct from the finished tool-grade alloy.
        B(g, 0, -0.02, 0, 0.34, 0.10, 0.19, 0x261c1f);
        B(g, 0, 0.04, 0, 0.28, 0.06, 0.14, 0x453338);
        B(g, 0.045, 0.075, 0, 0.11, 0.025, 0.06, 0xff7045);
        break;
      }
      case NETHERITE_INGOT: {
        // Finished ember-forged ingot: heavy dark steel with a molten seam.
        B(g, 0, -0.02, 0, 0.37, 0.11, 0.22, 0x20191e);
        B(g, 0, 0.035, 0, 0.31, 0.07, 0.18, 0x493a42);
        B(g, 0, 0.075, 0, 0.22, 0.025, 0.12, 0x8c6e71);
        B(g, 0, 0.09, 0.068, 0.24, 0.025, 0.025, 0xff7045);
        B(g, 0, 0.11, 0.069, 0.08, 0.015, 0.028, 0xffd06a);
        break;
      }
      default: {
        if (isPickTool(id)) {
          const tierIdx = id - PICK_TOOLS[0];
          const headCol = [0xb98a4d, 0x9aa0a6, 0xd6d9dd, 0x5fe8dc][tierIdx] ?? 0xb98a4d;
          B(g, 0, -0.02, 0, 0.05, 0.38, 0.05, 0x8b6234, 0, 0.3);
          B(g, -0.04, 0.14, 0, 0.32, 0.07, 0.07, headCol, 0, 0.3);
          break;
        }
        if (isSwordTool(id)) {
          const tierIdx = id - SWORD_TOOLS[0];
          const bladeCol = [0xb98a4d, 0xd6d9dd, 0x5fe8dc][tierIdx] ?? 0xd6d9dd;
          B(g, 0.04, -0.13, 0, 0.05, 0.13, 0.05, 0x6e4f2a, 0, 0.3);
          B(g, 0.01, -0.06, 0, 0.18, 0.04, 0.06, 0x4a351d, 0, 0.3);
          B(g, -0.05, 0.11, 0, 0.08, 0.3, 0.04, bladeCol, 0, 0.3);
          break;
        }
        if (isAxeTool(id)) {
          const headCol = id === AXE_TOOLS[0] ? 0xb98a4d : 0x9aa0a6;
          B(g, 0, -0.02, 0, 0.05, 0.36, 0.05, 0x8b6234, 0, 0.25);
          B(g, 0.06, 0.1, 0, 0.16, 0.14, 0.06, headCol, 0, 0.25);
          break;
        }
        if (id === TOOL_SHOVEL) {
          B(g, 0, -0.04, 0, 0.05, 0.34, 0.05, 0x8b6234, 0, 0.25);
          B(g, -0.04, 0.14, 0, 0.14, 0.15, 0.04, 0xa8aeb4, 0, 0.25);
          break;
        }
        if (id === TOOL_BOW) {
          B(g, 0, 0, 0, 0.05, 0.38, 0.05, 0x8b6234, 0, 0.2);
          B(g, 0.06, 0, 0, 0.02, 0.36, 0.02, 0xe8e2d2, 0, 0.2);
          break;
        }
        if (id === TOOL_TORCH) {
          B(g, 0, -0.03, 0, 0.06, 0.28, 0.06, 0x8b6234);
          B(g, 0, 0.14, 0, 0.08, 0.09, 0.08, 0xffb03a);
          break;
        }
        return null;
      }
    }
    return g;
  }

  /**
   * Throw the currently held item (block, material, food, weapon/tool, or armor)
   * forward onto the ground when pressing G.
   */
  dropHeldItem() {
    if (this.phase !== 'playing') return;
    const id = this.hotbar[this.selected];
    if (id === undefined || id === HAND || isRewardedDropChestItem(id)) {
      sfx.ui(false);
      return;
    }

    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const sx = this.pos.x + fx * 0.65;
    const sy = this.pos.y + 1.15;
    const sz = this.pos.z + fz * 0.65;
    const tvx = fx * 5.2;
    const tvy = 2.5 + Math.max(-0.2, this.dirV.y) * 2.4;
    const tvz = fz * 5.2;

    if (isGearHotbarId(id)) {
      const idx = this.bagItems.findIndex((b) => b.hid === id);
      if (idx < 0) {
        this.hotbar[this.selected] = undefined;
        this.syncHotbar(true);
        this.syncHud(true);
        return;
      }
      const [gear] = this.bagItems.splice(idx, 1);
      this.hotbar[this.selected] = undefined;
      this.spawnDrop(sx, sy, sz, LOOT_BAG, gear, { vx: tvx, vy: tvy, vz: tvz, pickupDelay: 1.35, thrown: true });
      this.startSwing(0.45);
      sfx.place();
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }

    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) {
      this.hotbar[this.selected] = undefined;
      this.hotbarInstanceIds[this.selected] = undefined;
      sfx.ui(false);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }

    if (isDurabilityTool(id)) {
      const heldInstance = this.getToolInstanceAt(this.selected);
      const droppedInstance = heldInstance ? this.removeToolInstance(heldInstance.instanceId) : null;
      if (!droppedInstance) {
        sfx.ui(false);
        return;
      }
      this.recalcOwnedToolTiers();
      this.spawnDrop(sx, sy, sz, id, null, {
        vx: tvx, vy: tvy, vz: tvz, pickupDelay: 1.35, thrown: true, toolInstance: droppedInstance,
      });
      this.startSwing(0.45);
      sfx.place();
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }

    if (count - 1 <= 0) {
      this.inventory.delete(id);
      this.hotbar[this.selected] = undefined;
      this.hotbarInstanceIds[this.selected] = undefined;
    } else {
      this.inventory.set(id, count - 1);
    }

    if (!isInventoryBlockId(id) && !isArrowId(id) && !isMeatItem(id)) {
      this.recalcOwnedToolTiers();
    }

    this.spawnDrop(sx, sy, sz, id, null, { vx: tvx, vy: tvy, vz: tvz, pickupDelay: 1.35, thrown: true });
    this.startSwing(0.45);
    sfx.place();
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private recalcOwnedToolTiers() {
    let bestPick = 0;
    let bestSword = -1;
    for (const instance of this.toolInstances.values()) {
      const spec = getToolSpec(instance.id);
      if (spec?.kind === 'pickaxe') bestPick = Math.max(bestPick, spec.tier);
      if (spec?.kind === 'sword') bestSword = Math.max(bestSword, spec.tier);
    }
    this.tier = bestPick;
    this.updatePickaxe();
    this.swordTier = bestSword;
  }

  private spawnDrop(
    x: number,
    y: number,
    z: number,
    id: number,
    gear: Item | null = null,
    opts?: { vx?: number; vy?: number; vz?: number; pickupDelay?: number; thrown?: boolean; fromChest?: boolean; toolInstance?: ToolInstance; count?: number },
  ): Drop {
    const d = this.drops.find((dd) => !dd.active) ?? this.drops[0];
    d.active = true;
    d.id = id;
    d.gear = gear ? ensureGearHid(gear) : null;
    d.toolInstance = opts?.toolInstance ? { ...opts.toolInstance } : null;
    d.age = 0;
    d.count = Math.max(1, Math.floor(opts?.count ?? 1));
    d.pickupDelay = opts?.pickupDelay ?? 0.22;
    d.thrown = opts?.thrown ?? false;
    d.fromChest = opts?.fromChest ?? false;
    d.petCarried = false;
    d.wolfPetIgnoreUntil = 0;
    d.x = x;
    d.y = y;
    d.z = z;
    const a = this.rand() * Math.PI * 2;
    const sp = 1.4 + this.rand() * 1.5;
    d.vx = opts?.vx ?? Math.cos(a) * sp;
    d.vz = opts?.vz ?? Math.sin(a) * sp;
    d.vy = opts?.vy ?? 3.4 + this.rand() * 1.8;
    // volumetric loot models replace the textured cube where available
    if (d.fancy) {
      this.scene.remove(d.fancy);
      disposeObject(d.fancy);
      d.fancy = null;
    }
    const fancy = d.gear
      ? this.buildArmorDropModel(d.gear)
      : this.buildFancyDrop(id, d.toolInstance?.durability);
    if (fancy) {
      d.fancy = fancy;
      // Miniature parts extend below their group's origin (especially flower
      // stems). Account for their full bounds, the display scale and bobbing.
      const bounds = new THREE.Box3().setFromObject(fancy);
      d.clearance = Math.max(0.14, -bounds.min.y * 0.3 * 2.6 + 0.08);
      fancy.position.set(x, y, z);
      this.scene.add(fancy);
      d.mesh.visible = false;
    } else {
      d.clearance = 0.32; // a spinning cube's lowest corner plus bobbing
      d.mesh.visible = true;
      this.applyDropUV(d, id);
    }
    return d;
  }

  private applyDropUV(d: Drop, id: number) {
    const def = BLOCKS[id];
    const uv = d.mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const base = this.dropUVBase;
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z ; 4 verts each
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? def.top : f === 3 ? def.bottom : def.side;
      const [u0, v0, u1, v1] = tileUV(tile);
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, u0 + (u1 - u0) * base[idx * 2], v0 + (v1 - v0) * base[idx * 2 + 1]);
      }
    }
    uv.needsUpdate = true;
  }

  private updateDrops(dt: number, frozen: boolean) {
    if (this.placeCooldown > 0) this.placeCooldown -= dt;
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + 1.1, this.pos.z);
    for (const d of this.drops) {
      if (!d.active) continue;
      d.age += dt;
      if (!frozen && !d.petCarried) {
        const dist = Math.hypot(d.x - eye.x, d.y - eye.y, d.z - eye.z);
        const delay = d.pickupDelay ?? 0.22;
        // attraction radius: short by default, extended by the MAGNET affix
        const magnetR = 2.1 + this.stats.magnet;
        if (d.age > delay + 0.04 && dist < magnetR) {
          const sd = Math.max(0.001, dist);
          const pull = (34 / Math.max(1.6, dist * 1.1)) * 6;
          const damp = Math.pow(0.02, dt);
          d.vx = (d.vx + ((eye.x - d.x) / sd) * pull * dt) * damp;
          d.vy = (d.vy + ((eye.y - d.y) / sd) * pull * dt) * damp;
          d.vz = (d.vz + ((eye.z - d.z) / sd) * pull * dt) * damp;
        } else {
          d.vy -= GRAVITY * 0.62 * dt;
          d.vx *= Math.pow(0.25, dt);
          d.vz *= Math.pow(0.25, dt);
        }
        const nx = d.x + d.vx * dt,
          ny = d.y + d.vy * dt,
          nz = d.z + d.vz * dt;
        if (isSolid(this.world.get(Math.floor(nx), Math.floor(d.y), Math.floor(d.z)))) d.vx *= -0.35;
        else d.x = nx;
        const floorY = Math.floor(ny - d.clearance);
        let hitFloor: number | null = null;
        for (let yy = Math.floor(d.y - d.clearance); yy >= floorY; yy--) {
          if (isSolid(this.world.get(Math.floor(d.x), yy, Math.floor(d.z)))) {
            hitFloor = yy;
            break;
          }
        }
        if (hitFloor !== null && d.vy < 0) {
          d.y = hitFloor + 1 + d.clearance;
          d.vy = 0;
        } else if (isSolid(this.world.get(Math.floor(d.x), Math.floor(ny), Math.floor(d.z)))) {
          d.vy *= -0.3;
        } else d.y = ny;
        if (isSolid(this.world.get(Math.floor(d.x), Math.floor(d.y), Math.floor(nz)))) d.vz *= -0.35;
        else d.z = nz;

        if (d.age > delay && dist < 1.35) {
          this.collect(d);
          continue;
        }
        // uncollected drops eventually despawn (loot bags linger much longer)
        if (d.age > (d.id === LOOT_BAG ? 150 : 60)) {
          d.active = false;
          d.mesh.visible = false;
          d.toolInstance = null;
          d.petCarried = false;
          if (d.fancy) {
            this.scene.remove(d.fancy);
            disposeObject(d.fancy);
            d.fancy = null;
          }
          continue;
        }
      }
      const s = 0.28 + Math.sin(d.age * 5) * 0.02;
      if (d.fancy) {
        // fancy models bob & spin upright (no X tumble — they read better level)
        d.fancy.position.set(d.x, d.y + Math.sin(d.age * 3) * 0.06, d.z);
        if (d.gear) animateArmorVisuals(d.fancy, this.time);
        d.fancy.rotation.y += dt * 2;
        d.fancy.scale.setScalar(s * 2.6);
      } else {
        d.mesh.position.set(d.x, d.y + Math.sin(d.age * 3) * 0.06, d.z);
        d.mesh.rotation.y += dt * 2.4;
        d.mesh.rotation.x += dt * 0.9;
        d.mesh.scale.setScalar(s);
      }
    }
  }

  private collect(d: Drop) {
    d.active = false;
    d.mesh.visible = false;
    d.petCarried = false;
    if (this.wolfPetRig?.carrying === d) this.wolfPetRig.carrying = null;
    if (this.wolfPetRig?.fetchTarget === d) this.wolfPetRig.fetchTarget = null;
    const carriedTool = d.toolInstance;
    d.toolInstance = null;
    if (d.fancy) {
      this.scene.remove(d.fancy);
      disposeObject(d.fancy);
      d.fancy = null;
    }
    // a loot bag holds a rolled piece of gear
    if (d.id === LOOT_BAG && d.gear) {
      const it = ensureGearHid(d.gear);
      d.gear = null;
      this.bagItems.push(it);
      if (!d.thrown) {
        this.pushBanner(
          t('looted'),
          `${t(('slot_' + it.slot) as never)} · ${it.affixes.map((a) => t(AFFIX_KEY[a.id])).join(' + ') || '—'}`,
          RARITY_COLORS[it.rarity],
        );
        this.burst(d.x, d.y, d.z, [217, 140, 255], 14, 3);
        sfx.upgrade();
      } else {
        sfx.pickup(3);
      }
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    const itemCount = Math.max(1, Math.floor(d.count ?? 1));
    this.recordExplorerCollect(d.id, itemCount);
    // Picking up a dropped weapon or tool; durable items keep their exact wear/identity.
    if (d.id >= 200 && !isArrowId(d.id) && !isMeatItem(d.id)) {
      if (isDurabilityTool(d.id)) {
        this.addToolInstance(d.id, carriedTool?.durability, carriedTool?.instanceId);
      } else {
        this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + itemCount);
        this.addToHotbar(d.id);
      }
      this.recalcOwnedToolTiers();
      sfx.pickup(4);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    if (d.thrown || d.fromChest) {
      this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + itemCount);
      this.addToHotbar(d.id);
      sfx.pickup(d.thrown ? 2 : 1);
      this.syncHotbar(true);
      this.syncHud(true);
      return;
    }
    const def = BLOCKS[d.id];
    const comboMult = this.comboMult();
    const tierMult = PICKAXE_TIERS[this.tier].mult;
    const gained = this.awardScore(Math.max(1, Math.round(def.score * comboMult * tierMult)) * itemCount);
    this.inventory.set(d.id, (this.inventory.get(d.id) ?? 0) + itemCount);
    this.addToHotbar(d.id);
    if ((d.id >= 5 && d.id <= 8) || (d.id >= REDSTONE && d.id <= QUARTZ)) this.oresFound += itemCount;
    if (!this.endlessRun && def.timeBonus > 0) {
      const bonus = def.timeBonus * itemCount;
      this.timeLeft += bonus;
      this.popup(d.x, d.y + 0.6, d.z, `+${bonus}${t('secShort')}`, '#7ee7a0', true);
    }
    const heal = d.id === DIAMOND || d.id === EMERALD ? 16
      : d.id === GOLD || d.id === LAPIS || d.id === QUARTZ ? 8
        : d.id === IRON || d.id === REDSTONE ? 4
          : d.id === COAL ? 2 : 0;
    if (heal > 0) this.health = Math.min(100, this.health + heal * itemCount);

    this.popup(d.x, d.y + 0.3, d.z, `+${gained}`, gained >= 200 ? '#f7d34b' : gained >= 40 ? '#8fe3ff' : '#ffffff', gained >= 100);
    this.burst(d.x, d.y, d.z, def.tint, Math.min(18, 8 + itemCount), 2.4);
    sfx.pickup(this.combo);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private comboMult() {
    return 1 + Math.min(this.combo, 24) * 0.14;
  }

  /** Apply active shop score boosts consistently to every score source. */
  private awardScore(base: number): number {
    const gained = Math.max(0, Math.round(base * this.scoreBonusMultiplier));
    this.score += gained;
    return gained;
  }

  private addToHotbar(id: number) {
    if (isDurabilityTool(id) || this.hotbar.includes(id)) return;
    const f = this.firstFreeSlot();
    if (f < 0) return;
    this.hotbar[f] = id;
    this.hotbarInstanceIds[f] = undefined;
  }

  private addToolInstance(id: number, durability?: unknown, instanceId?: number): ToolInstance | null {
    const spec = getToolSpec(id);
    if (!spec) return null;
    let uid = Number.isInteger(instanceId) && (instanceId as number) > 0 && !this.toolInstances.has(instanceId as number)
      ? (instanceId as number)
      : this.nextToolInstanceId;
    while (this.toolInstances.has(uid)) uid++;
    this.nextToolInstanceId = Math.max(this.nextToolInstanceId, uid + 1);
    const value = normalizeToolDurability(id, durability ?? spec.maxDurability);
    if (spec.maxDurability > 0 && value <= 0) return null;
    const item: ToolInstance = { instanceId: uid, id, durability: value };
    this.toolInstances.set(uid, item);
    this.inventory.set(id, (this.inventory.get(id) ?? 0) + 1);
    this.addToolToHotbar(id, uid);
    return item;
  }

  private addToolToHotbar(id: number, instanceId: number, slot?: number) {
    const instance = this.toolInstances.get(instanceId);
    if (!instance || instance.id !== id || this.hotbarInstanceIds.includes(instanceId)) return;
    const target = slot === undefined ? this.firstFreeSlot() : Math.max(0, Math.min(9, Math.trunc(slot)));
    if (target < 0 || this.hotbar[target] === HAND) return;
    this.hotbar[target] = id;
    this.hotbarInstanceIds[target] = instanceId;
  }

  private getToolInstanceAt(slot: number): ToolInstance | undefined {
    const id = this.hotbar[slot];
    const instanceId = this.hotbarInstanceIds[slot];
    if (id === undefined || instanceId === undefined) return undefined;
    const instance = this.toolInstances.get(instanceId);
    return instance?.id === id ? instance : undefined;
  }

  private removeToolInstance(instanceId: number): ToolInstance | null {
    const instance = this.toolInstances.get(instanceId);
    if (!instance) return null;
    this.toolInstances.delete(instanceId);
    const count = (this.inventory.get(instance.id) ?? 0) - 1;
    if (count > 0) this.inventory.set(instance.id, count);
    else this.inventory.delete(instance.id);
    for (let i = 0; i < this.hotbar.length; i++) {
      if (this.hotbarInstanceIds[i] === instanceId) {
        this.hotbar[i] = undefined;
        this.hotbarInstanceIds[i] = undefined;
        if (this.selected === i) this.selected = 0;
      }
    }
    return { ...instance };
  }

  private heldToolDurability(id = this.hotbar[this.selected] ?? -1): number {
    const spec = getToolSpec(id);
    if (!spec) return 0;
    if (spec.maxDurability <= 0) return 0;
    return this.getToolInstanceAt(this.selected)?.durability ?? spec.maxDurability;
  }

  private damageHeldTool(amount = 1) {
    const id = this.hotbar[this.selected] ?? -1;
    const spec = getToolSpec(id);
    const instance = this.getToolInstanceAt(this.selected);
    if (!spec || spec.maxDurability <= 0 || !instance) return;
    const previousDurability = instance.durability;
    instance.durability = Math.max(0, instance.durability - Math.max(1, amount));
    if (previousDurability > spec.maxDurability * 0.5 && instance.durability <= spec.maxDurability * 0.5) {
      this.queueTutorialTip(
        'mechanic:low-durability',
        t('tutorialLowDurability'),
        `${toolLabelForId(id)} · ${t('tutorialRepairTool')}`,
        '#f4b942',
        'anvil',
      );
    }
    if (instance.durability <= 0) {
      const broken = this.removeToolInstance(instance.instanceId);
      if (broken) {
        this.pushBanner(t('toolBroken'), toolLabelForId(id), '#e2564a');
        this.burst(this.pos.x, this.pos.y + 1.1, this.pos.z, [238, 92, 64], 8, 1.8);
        sfx.breakBlock(0.8);
      }
      this.recalcOwnedToolTiers();
    }
    this.syncHotbar(true);
    this.syncHud(true);
  }

  // ================= DAY / NIGHT =================
  /** 0 = midnight, 0.5 = noon */
  private clockPhase(clock = this.clock): HudState['phaseName'] {
    if (this.survival && isPermanentSurvivalNight(this.survivalNight)) return 'night';
    if (clock >= CLOCK_DAWN_START && clock < CLOCK_DAY_START) return 'dawn';
    if (clock >= CLOCK_DAY_START && clock < CLOCK_DUSK_START) return 'day';
    if (clock >= CLOCK_DUSK_START && clock < CLOCK_NIGHT_START) return 'dusk';
    return 'night';
  }

  private clockPhaseProgress(clock = this.clock) {
    if (this.survival && isPermanentSurvivalNight(this.survivalNight)) {
      const nightSpan = 1 - CLOCK_NIGHT_START + CLOCK_DAWN_START;
      const nightProgress = ((clock - CLOCK_NIGHT_START + 1) % 1) / nightSpan;
      return Math.max(0, Math.min(1, nightProgress));
    }
    if (clock >= CLOCK_DAWN_START && clock < CLOCK_DAY_START) return (clock - CLOCK_DAWN_START) / (CLOCK_DAY_START - CLOCK_DAWN_START);
    if (clock >= CLOCK_DAY_START && clock < CLOCK_DUSK_START) return (clock - CLOCK_DAY_START) / (CLOCK_DUSK_START - CLOCK_DAY_START);
    if (clock >= CLOCK_DUSK_START && clock < CLOCK_NIGHT_START) return (clock - CLOCK_DUSK_START) / (CLOCK_NIGHT_START - CLOCK_DUSK_START);
    if (clock >= CLOCK_NIGHT_START) return (clock - CLOCK_NIGHT_START) / (1 - CLOCK_NIGHT_START + CLOCK_DAWN_START);
    return (clock + 1 - CLOCK_NIGHT_START) / (1 - CLOCK_NIGHT_START + CLOCK_DAWN_START);
  }

  private phaseSeconds(phase: HudState['phaseName']) {
    if (this.survival) {
      if (phase === 'day' && this.firstSurvivalDay) return FIRST_SURVIVAL_DAY_SECONDS;
      return survivalPhaseSeconds(phase, this.survivalNight);
    }
    if (phase === 'dawn') return SURVIVAL_DAWN_SECONDS;
    if (phase === 'day') return this.firstSurvivalDay ? FIRST_SURVIVAL_DAY_SECONDS : SURVIVAL_DAY_SECONDS;
    if (phase === 'dusk') return SURVIVAL_DUSK_SECONDS;
    return SURVIVAL_NIGHT_SECONDS;
  }

  private phaseSpan(phase: HudState['phaseName']) {
    if (phase === 'dawn') return CLOCK_DAY_START - CLOCK_DAWN_START;
    if (phase === 'day') return CLOCK_DUSK_START - CLOCK_DAY_START;
    if (phase === 'dusk') return CLOCK_NIGHT_START - CLOCK_DUSK_START;
    return 1 - CLOCK_NIGHT_START + CLOCK_DAWN_START;
  }

  private isNightClock(clock = this.clock) {
    return this.clockPhase(clock) === 'night';
  }

  private sampleVisualClimate() {
    const px = Math.floor(this.pos.x);
    const pz = Math.floor(this.pos.z);
    // Blend a small neighbourhood instead of using the exact block under the player.
    // Desert/plains/canyon borders often run through villages and tree lines, so a
    // single-step biome flip used to change the whole scene exposure instantly.
    const samples: Array<[number, number, number]> = [
      [0, 0, 1.8],
      [14, 0, 1],
      [-14, 0, 1],
      [0, 14, 1],
      [0, -14, 1],
      [10, 10, 0.7],
      [-10, 10, 0.7],
      [10, -10, 0.7],
      [-10, -10, 0.7],
    ];
    let dry = 0;
    let winter = 0;
    let total = 0;
    for (const [dx, dz, w] of samples) {
      const b = this.world.biomeAt(px + dx, pz + dz);
      if (b === 'desert' || b === 'canyon' || b === 'volcanic') dry += w;
      else if (b === 'winter') winter += w;
      total += w;
    }
    return { dry: dry / total, winter: winter / total };
  }

  private updateVisualClimate(dt: number) {
    const target = this.sampleVisualClimate();
    if (!this.visualClimateReady || (dt <= 0 && this.phase !== 'playing' && this.phase !== 'paused')) {
      this.visualDry = target.dry;
      this.visualWinter = target.winter;
      this.visualClimateReady = true;
      return;
    }
    if (dt <= 0) return;
    const k = 1 - Math.pow(0.001, dt / 7.5);
    this.visualDry += (target.dry - this.visualDry) * k;
    this.visualWinter += (target.winter - this.visualWinter) * k;
  }

  private updateClock(dt: number) {
    if (this.survival && isPermanentSurvivalNight(this.survivalNight)) {
      // Keep the celestial clock on the dark arc even when loading an older save
      // whose saved time happened to be daytime when the permanent-night threshold is reached.
      const nightStart = CLOCK_NIGHT_START;
      const nightSpan = 1 - CLOCK_NIGHT_START + CLOCK_DAWN_START;
      let nightProgress = (this.clock - nightStart + 1) % 1;
      if (nightProgress > nightSpan) nightProgress = 0;
      if (dt > 0) nightProgress = (nightProgress + (dt * nightSpan) / this.phaseSeconds('night')) % nightSpan;
      this.clock = (nightStart + nightProgress) % 1;
    } else if (dt > 0) {
      const phase = this.clockPhase();
      this.clock = (this.clock + (dt * this.phaseSpan(phase)) / this.phaseSeconds(phase)) % 1;
    }
    const smooth01 = (v: number) => {
      const t2 = Math.max(0, Math.min(1, v));
      return t2 * t2 * (3 - 2 * t2);
    };

    const phase = this.clockPhase();
    setMusicMood(this.survival && phase === 'night' ? 'tense' : 'calm');
    const prog = this.clockPhaseProgress();
    const sunAngle = this.clock * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(sunAngle);
    if (phase === 'dawn') this.daylight = 0.06 + 0.94 * smooth01(prog);
    else if (phase === 'day') this.daylight = 1;
    else if (phase === 'dusk') this.daylight = 1 - 0.94 * smooth01(prog);
    else this.daylight = 0.06;

    const d = this.daylight;
    if (this.skyMesh) this.skyMesh.position.copy(this.camera.position);
    if (this.stars) this.stars.position.copy(this.camera.position);
    this.updateVisualClimate(dt);
    const dry = Math.max(0, Math.min(1, this.visualDry));
    const winter = Math.max(0, Math.min(1, this.visualWinter * (1 - dry)));
    const weather = this.weatherIntensity * (1 - dry * 0.85);

    const night = new THREE.Color(0x050914);
    const dawn = new THREE.Color(0xff9c66).lerp(new THREE.Color(0xffba72), dry).lerp(new THREE.Color(0xffaa82), winter);
    const day = new THREE.Color(0xe8f8ff).lerp(new THREE.Color(0xf0fbff), dry).lerp(new THREE.Color(0xe5f5ff), winter);
    const storm = new THREE.Color(0x8799a8).lerp(new THREE.Color(0xbcc9d8), winter);
    const c = new THREE.Color();
    if (phase === 'night') c.copy(night);
    else if (phase === 'dawn') c.copy(night).lerp(dawn, smooth01(prog)).lerp(day, smooth01(Math.max(0, prog - 0.45) / 0.55) * 0.55);
    else if (phase === 'dusk') c.copy(day).lerp(dawn, smooth01(prog) * 0.72).lerp(night, smooth01(Math.max(0, prog - 0.38) / 0.62));
    else c.copy(day);
    if (weather > 0) c.lerp(storm, Math.min(0.72, weather * 0.62));

    const fog = this.scene.fog as THREE.Fog;
    const isUnder = this.headUnderwater();
    if (isUnder) {
      // underwater — dark blurred water boundary, not bright blue hole; filter shows where water ends
      const waterFog = new THREE.Color(0x061e32).lerp(new THREE.Color(0x0b2f4a), d * 0.35);
      fog.color.copy(waterFog);
      this.scene.background = waterFog;
      fog.near = 2;
      fog.far = Math.min(36, this.renderDist * 0.42);
      if (this.skyMat) this.skyMat.color.copy(waterFog).multiplyScalar(0.45);
    } else {
      // detect deep underground to hide sky leaking through unloaded chunk holes
      let surfaceH = 64;
      try {
        surfaceH = this.world.getHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
      } catch {}
      const isDeepUnderground = this.pos.y < surfaceH - 10;
      const isCave = this.pos.y < surfaceH - 4 && this.pos.y < 48;
      if (isDeepUnderground) {
        // dark cave void — no bright sky, unloaded chunks appear as dark blurred fog, but ore still visible
        const caveFog = new THREE.Color(0x0a1418).lerp(new THREE.Color(0x111c22), Math.min(1, (surfaceH - this.pos.y) / 40) * 0.5);
        caveFog.lerp(night, (1 - d) * 0.35);
        fog.color.copy(caveFog);
        this.scene.background = caveFog;
        fog.far = Math.min(this.renderDist * 0.78, 84);
        fog.near = fog.far * 0.22;
        if (this.skyMat) this.skyMat.color.copy(caveFog).multiplyScalar(0.35);
      } else if (isCave) {
        // shallow cave / overhang — muted, desaturated sky to avoid sharp blue rectangles
        const caveBlend = new THREE.Color(0x1a2a32);
        caveBlend.lerp(c, 0.22 + d * 0.18);
        fog.color.copy(caveBlend);
        this.scene.background = caveBlend;
        fog.far = this.renderDist * (0.68 + d * 0.14) * (1 - weather * 0.16);
        fog.near = fog.far * 0.28;
        if (this.skyMat) this.skyMat.color.copy(caveBlend).multiplyScalar(0.5);
      } else {
        // surface: make distant void dark blurred, not bright blue hole — fog darker than sky, background dark
        const surfaceVoidDark = new THREE.Color(0x1a2a36);
        const surfaceFog = c.clone().lerp(surfaceVoidDark, 0.38 + (1 - d) * 0.18);
        fog.color.copy(surfaceFog);
        this.scene.background = surfaceFog;
        const nightHaze = 0.66 + d * 0.54;
        const weatherHaze = 1 - weather * 0.16;
        fog.far = this.renderDist * nightHaze * weatherHaze;
        fog.near = fog.far * (0.34 + weather * 0.07);
        if (this.skyMat) this.skyMat.color.copy(c).multiplyScalar(0.86 + dry * 0.06 - winter * 0.02 + d * (0.55 + dry * 0.03));
      }
    }

    const sunDir = new THREE.Vector3(Math.cos(sunAngle) * 0.84, sunHeight * 0.96, -0.34).normalize();
    this.sunDir.copy(sunDir);
    const moonDir = sunDir.clone().multiplyScalar(-1);
    const celestialR = 255;
    if (this.sunMesh) {
      this.sunMesh.position.copy(this.camera.position).addScaledVector(sunDir, celestialR);
      this.sunMesh.lookAt(this.camera.position);
      this.sunMesh.visible = sunDir.y > 0.02 && d > 0.18;
      const mat = this.sunMesh.material as THREE.MeshBasicMaterial;
      const sunOpacity = Math.max(0, Math.min(1, (d - 0.18) / 0.32)) * (1 - weather * 0.5);
      mat.opacity = sunOpacity;
      mat.visible = !this.specialSun;
      mat.color.copy(new THREE.Color(d < 0.45 ? 0xffa347 : 0xffd24a).lerp(new THREE.Color(0xffc933), dry));
      if (this.sunHaloMat) {
        const dayHalo = d > 0.84 && sunDir.y > 0.52 ? Math.min(1, (d - 0.84) / 0.16) : 0;
        this.sunHaloMat.opacity = sunOpacity * dayHalo * (0.2 + dry * 0.1) * (1 - weather * 0.45);
      }
      const sc = 1 + (d > 0.65 ? dry * 0.18 : 0);
      this.sunMesh.scale.setScalar(sc);
      if (this.sunSheetMesh) {
        this.sunSheetMesh.position.copy(this.sunMesh.position);
        this.sunSheetMesh.lookAt(this.camera.position);
        this.sunSheetMesh.visible = this.specialSun && this.sunMesh.visible && this.sunSheetReady;
        (this.sunSheetMesh.material as THREE.MeshBasicMaterial).opacity = sunOpacity;
        // a small breathing pulse on top of the GIF's own animation
        this.sunSheetMesh.scale.setScalar(sc * (1 + 0.035 * Math.sin(this.time * 6)));
      }
    }
    if (this.moonMesh) {
      this.moonMesh.position.copy(this.camera.position).addScaledVector(moonDir, celestialR);
      this.moonMesh.lookAt(this.camera.position);
      this.moonMesh.visible = moonDir.y > -0.03 && d < 0.72;
    }
    if (this.starMat) {
      this.starMat.opacity = smooth01((0.48 - d) / 0.48) * (1 - Math.min(0.85, weather * 0.85));
    }

    const lightDir = sunDir.y > -0.04 ? sunDir : moonDir;
    if (this.sunLight) {
      this.sunLight.position.copy(lightDir);
      const dayLightColor = new THREE.Color(0xfff2cf).lerp(new THREE.Color(0xffdfa0), dry).lerp(new THREE.Color(0xeaf6ff), winter * 0.25);
      this.sunLight.color.copy(sunDir.y > -0.04 ? dayLightColor : new THREE.Color(0x88a6d8));
      const sunPower = sunDir.y > -0.04 ? 0.22 + d * (1.14 + dry * 0.08 - winter * 0.04) : 0.04 + (1 - d) * 0.065;
      this.sunLight.intensity = sunPower * (1 - weather * 0.32);
    }
    if (this.ambLight) {
      const ambient = (0.09 + d * (0.58 + dry * 0.08 - winter * 0.03)) * (1 - weather * 0.22) + dry * (d > 0.5 ? 0.09 : 0);
      this.ambLight.intensity = ambient;
      const ambientColor = new THREE.Color(d < 0.25 ? 0x9fb8ff : 0xf0f6ff).lerp(new THREE.Color(0xffedc8), dry).lerp(new THREE.Color(0xe8f5ff), winter * 0.35);
      this.ambLight.color.copy(ambientColor);
    }

    const tint = new THREE.Color();
    if (d < 0.22) tint.setRGB(0.58 + d * 1.35, 0.64 + d * 1.12, 0.86 + d * 0.62);
    else tint.setRGB(1.055 + dry * 0.005 - winter * 0.02, 1.045 - dry * 0.015, 1.0 - dry * 0.08 + winter * 0.04);
    if (weather > 0) tint.lerp(new THREE.Color(0xb7c1ca), weather * 0.24);
    this.material.color.copy(tint);
    if (this.cutoutMat) this.cutoutMat.color.copy(tint);
    if (this.decorMat) this.decorMat.color.copy(tint);
    if (this.waterMat) this.waterMat.color.copy(new THREE.Color(d < 0.22 ? 0x8aa7d8 : 0xffffff).lerp(storm, weather * 0.18));
  }

  phaseName(): HudState['phaseName'] {
    return this.clockPhase();
  }

  // ================= MOBS =================
  private survivalThreatLevel() {
    return survivalThreatLevel(this.survivalNight);
  }

  private hostileHpScale() {
    return survivalHostileHpScale(this.survivalNight);
  }

  private hostileDamageScale() {
    return survivalHostileDamageScale(this.survivalNight);
  }

  /** Existing cave mobs also toughen when a new survival night begins. */
  private strengthenExistingHostiles() {
    const hpScale = this.hostileHpScale();
    for (const mob of this.mobSys.mobs) {
      if (!mob.alive || !mob.def.hostile) continue;
      const previousMax = Math.max(1, mob.maxHp);
      const healthFraction = Math.max(0, Math.min(1, mob.hp / previousMax));
      mob.maxHp = Math.ceil(mob.def.hp * hpScale);
      mob.hp = Math.max(1, Math.ceil(mob.maxHp * healthFraction));
    }
  }

  /** Pick a hostile mob based on threat level and random roll. */
  private pickSurvivalHostile(roll: number, threat: number): MobId {
    // Early game (threat 0-2): basic hostiles
    if (threat < 3) {
      if (roll < 0.30) return 'zombie';
      if (roll < 0.50) return 'skeleton';
      if (roll < 0.65) return 'spider';
      if (roll < 0.80) return 'archer';
      if (roll < 0.90) return 'husk';
      return 'creeper';
    }
    
    // Mid game (threat 3-5): add medium-tier hostiles
    if (threat < 6) {
      if (roll < 0.20) return 'zombie';
      if (roll < 0.35) return 'skeleton';
      if (roll < 0.48) return 'spider';
      if (roll < 0.58) return 'archer';
      if (roll < 0.68) return 'creeper';
      if (roll < 0.76) return 'husk';
      if (roll < 0.84) return 'stray';
      if (roll < 0.92) return 'slime';
      return 'cave_spider';
    }
    
    // Late game (threat 6-8): add high-tier hostiles
    if (threat < 9) {
      if (roll < 0.15) return 'zombie';
      if (roll < 0.25) return 'skeleton';
      if (roll < 0.35) return 'spider';
      if (roll < 0.43) return 'archer';
      if (roll < 0.51) return 'creeper';
      if (roll < 0.58) return 'husk';
      if (roll < 0.65) return 'stray';
      if (roll < 0.72) return 'slime';
      if (roll < 0.79) return 'cave_spider';
      if (roll < 0.86) return 'witch';
      if (roll < 0.93) return 'phantom';
      return 'drowned';
    }
    
    // End game (threat 9+): elite hostiles
    if (roll < 0.10) return 'zombie';
    if (roll < 0.18) return 'skeleton';
    if (roll < 0.26) return 'spider';
    if (roll < 0.32) return 'archer';
    if (roll < 0.38) return 'creeper';
    if (roll < 0.44) return 'husk';
    if (roll < 0.50) return 'stray';
    if (roll < 0.56) return 'slime';
    if (roll < 0.62) return 'cave_spider';
    if (roll < 0.68) return 'witch';
    if (roll < 0.74) return 'phantom';
    if (roll < 0.80) return 'drowned';
    if (roll < 0.85) return 'silverfish';
    if (roll < 0.89) return 'enderman';
    if (roll < 0.93) return 'blaze';
    if (roll < 0.96) return 'guardian';
    if (roll < 0.98) return 'wither_skeleton';
    if (roll < 0.99) return 'magma_cube';
    return 'ghast';
  }

  /** is the listener's head under water right now? */
  private headUnderwater() {
    return this.world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + EYE), Math.floor(this.pos.z)) === WATER;
  }

  /**
   * Play a mob's voice out in the world: quieter with distance, panned to the
   * side it stands on, and dulled while the player's head is underwater.
   */
  private playMobVoice(m: Mob, state: VoiceState, volume = 1) {
    if (this.phase !== 'playing') return;
    const voice = MOB_VOICE[m.id];
    if (!voice) return;
    const dx = m.x - this.pos.x;
    const dy = m.y + 0.4 - (this.pos.y + EYE * 0.75);
    const dz = m.z - this.pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 34) return;
    // fade with distance; anything practically on top of the player is centred
    const falloff = Math.max(0.05, 1 - dist / 34);
    const rightX = -this.dirV.z;
    const rightZ = this.dirV.x;
    const rightLen = Math.hypot(rightX, rightZ) || 1;
    const pan = dist < 1.2 ? 0 : Math.max(-0.7, Math.min(0.7, ((dx * rightX + dz * rightZ) / rightLen / dist) * 0.8));
    this.voiceCooldown = Math.max(this.voiceCooldown, 0.16);
    sfx.creature(voice, {
      state,
      volume: falloff * volume,
      pan,
      // babies answer in a higher voice; adults vary a little so repeats never sound looped
      pitch: (m.grow > 0 ? 1.32 : 1) * (0.94 + Math.random() * 0.12),
      underwater: this.headUnderwater(),
    });
  }

  /**
   * Idle wildlife calls: every second or two one nearby animal speaks up —
   * birds and insects most of all, so the woods around the player feel alive.
   */
  private updateCreatureVoices(dt: number) {
    this.voiceCooldown = Math.max(0, this.voiceCooldown - dt);
    this.voiceTimer -= dt;
    if (this.voiceTimer > 0 || this.voiceCooldown > 0) return;
    this.voiceTimer = 1 + Math.random() * 1.9;
    let best: Mob | null = null;
    let bestScore = 0;
    for (const m of this.mobSys.mobs) {
      if (!m.alive || m.hidden || !MOB_VOICE[m.id]) continue;
      const dist = Math.hypot(m.x - this.pos.x, m.y - this.pos.y, m.z - this.pos.z);
      if (dist > 30) continue;
      const rate = MOB_VOICE_RATE[m.id] ?? 0.8;
      if (rate <= 0) continue;
      const score = rate * (m.grow > 0 ? 1.25 : 1) * Math.max(0.05, 1 - dist / 32) * (0.45 + Math.random());
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    // smaller wildlife sings more softly
    if (best) this.playMobVoice(best, 'idle', best.id === 'bird' || best.id === 'bee' ? 0.75 : 1);
  }

  private updateCampfireDamage(dt: number) {
    for (const mob of this.mobSys.mobs) {
      if (!mob.alive || mob.hidden) continue;
      const half = Math.max(0.18, mob.collisionHalf * Math.abs(mob.group.scale.x));
      const height = Math.max(0.35, mob.collisionHeight * Math.abs(mob.group.scale.y));
      const minX = Math.floor(mob.x - half), maxX = Math.floor(mob.x + half);
      const minZ = Math.floor(mob.z - half), maxZ = Math.floor(mob.z + half);
      const minY = Math.floor(mob.y - 0.2), maxY = Math.floor(mob.y + Math.min(height, 1.25));
      let touchingFire = false;
      for (let y = minY; y <= maxY && !touchingFire; y++) {
        for (let z = minZ; z <= maxZ && !touchingFire; z++) {
          for (let x = minX; x <= maxX; x++) {
            if (this.world.get(x, y, z) !== CAMPFIRE) continue;
            if (mob.x + half <= x || mob.x - half >= x + 1 || mob.z + half <= z || mob.z - half >= z + 1) continue;
            if (mob.y + height <= y + 0.12 || mob.y >= y + 1.15) continue;
            touchingFire = true;
            break;
          }
        }
      }
      if (!touchingFire) {
        this.campfireDamageCooldown.delete(mob);
        continue;
      }
      const cooldown = (this.campfireDamageCooldown.get(mob) ?? 0) - dt;
      if (cooldown > 0) {
        this.campfireDamageCooldown.set(mob, cooldown);
        continue;
      }
      this.campfireDamageCooldown.set(mob, 0.72);
      mob.hp -= 1;
      mob.hurtFlash = 0.16;
      this.mobSys.showHealthBar(mob);
      this.burst(mob.x, mob.y + 0.18, mob.z, [255, 139, 38], 2, 0.65, 0.18);
      if (mob.hp <= 0) this.mobDied(mob, true);
    }
  }

  private updateMobs(dt: number) {
    const night = this.isNightClock();
    const threat = this.survivalThreatLevel();

    // The first survival day is peaceful. From night one onward, hostiles may spawn at night
    // or underground by day; an exposed surface is never a daytime spawn point.
    if (this.survival) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = night ? Math.max(0.55, 1.4 - threat * 0.1) : 6;
        const surfaceH = this.world.getHeight(Math.floor(this.pos.x), Math.floor(this.pos.z));
        const underground = this.pos.y < surfaceH - 4;
        const spawnAllowed = canSpawnSurvivalHostiles(this.survivalNight, night, underground);
        const cap = survivalHostileCap(this.survivalNight, night, underground);
        if (spawnAllowed && this.mobSys.count(true) < cap) {
          // Choose first so both the surface and cave searches use the exact hostile's footprint.
          const roll = Math.random();
          const id: MobId = this.pickSurvivalHostile(roll, threat);
          const p = underground
            ? this.findCaveSpawn(id)
            : this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 16, 38, null, undefined, id);
          if (p) {
            const m = this.mobSys.spawn(id, p[0], p[1], p[2]);
            if (m && threat > 0) {
              m.maxHp = Math.ceil(m.maxHp * this.hostileHpScale());
              m.hp = m.maxHp;
            }
          }
        }
      }
    }
    // ---- travel direction tracking (for ahead-of-player spawning) ----
    const hv = Math.hypot(this.vel.x, this.vel.z);
    this.travelSpeed += (hv - this.travelSpeed) * Math.min(1, dt * 2);
    if (hv > 1.5) {
      const k = Math.min(1, dt * 1.5);
      this.travelDir.x += (this.vel.x / hv - this.travelDir.x) * k;
      this.travelDir.z += (this.vel.z / hv - this.travelDir.z) * k;
    }
    const moving = this.travelSpeed > 2.2 && Math.hypot(this.travelDir.x, this.travelDir.z) > 0.4;
    const biasAngle = moving ? Math.atan2(this.travelDir.z, this.travelDir.x) : null;

    // ---- fish schools: stock each water body the moment you approach it ----
    this.stockWaterAhead(biasAngle);

    // ---- biome-aware wildlife ----
    // Keep separate local quotas: a handful of land animals must not consume
    // all the slots before birds and insects have arrived nearby.
    const nearby = this.mobSys.mobs.filter((m) =>
      m.alive && !m.def.hostile && !m.hidden && Math.hypot(m.x - this.pos.x, m.z - this.pos.z) < 36,
    );
    const landCount = nearby.filter((m) => !m.def.aquatic && !['bird', 'bee', 'crab', 'turtle', 'penguin'].includes(m.id)).length;
    const birds = nearby.filter((m) => m.id === 'bird').length;
    const bees = nearby.filter((m) => m.id === 'bee').length;
    const budget = this.survival ? 24 : 30;
    this.animalTimer -= dt;
    if (this.animalTimer <= 0) {
      this.animalTimer = (this.survival ? 2.8 : 2.1) * (moving ? 0.6 : 1);
      if (landCount < (this.survival ? 6 : 8) && this.mobSys.count(false) < budget) {
        const water = this.world.findWaterNear(this.pos.x, this.pos.z, 26);
        const shoreCount = nearby.filter((m) => ['crab', 'turtle', 'penguin', 'seal', 'frog'].includes(m.id)).length;
        if (water && shoreCount < 3 && Math.random() < 0.35) {
          const winterShore = this.world.isWinter(Math.floor(water[0]), Math.floor(water[2]));
          const shoreBiome = this.world.biomeAt(Math.floor(water[0]), Math.floor(water[2]));
          const p = this.mobSys.findSpawnPoint(water[0], water[2], 1, 6, null,
            winterShore ? [ICE, SNOW_GRASS] : [SAND, GRASS]);
          if (p && Math.hypot(p[0] - water[0], p[2] - water[2]) < 6) {
            const id: MobId = winterShore ? (Math.random() < 0.55 ? 'penguin' : 'seal') :
              shoreBiome === 'jungle' || Math.random() < 0.42 ? 'frog' : (Math.random() < 0.55 ? 'crab' : 'turtle');
            this.mobSys.spawn(id, p[0], p[1], p[2]);
          }
        } else {
          const p = moving
            ? this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 10, 25, biasAngle, [GRASS, SAND, STONE, VOLCANIC_STONE, SNOW_GRASS])
            : this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 9, 28, null, [GRASS, SAND, STONE, VOLCANIC_STONE, SNOW_GRASS]);
          if (p) {
            const biome = this.world.biomeAt(Math.floor(p[0]), Math.floor(p[2]));
            const high = this.world.getHeight(Math.floor(p[0]), Math.floor(p[2])) > 26;
            // Pasture species belong on green ground only. Arctic wildlife
            // lives around ice; camels and lizards inhabit the dry regions.
            const ground = this.world.get(Math.floor(p[0]), Math.floor(p[1] - 1), Math.floor(p[2]));
            const pasture = ground === GRASS;
            const list: MobId[] = biome === 'winter'
              ? ['rabbit', 'deer', 'roe_deer', 'fawn', 'moose', 'hedgehog']
              : biome === 'desert' || biome === 'canyon'
                ? ['lizard', 'lizard', 'camel', 'camel', 'camel_calf', 'tumbleweed', 'tumbleweed', 'tumbleweed']
                : biome === 'jungle'
                  ? ['monkey', 'monkey', 'monkey', 'frog', 'frog', 'lizard', 'pig', 'rabbit', 'hedgehog']
                  : biome === 'volcanic'
                    ? ['lizard', 'lizard', 'rabbit']
                    : high ? (pasture ? ['sheep', 'sheep', 'rabbit', 'deer'] : ['rabbit'])
                      : pasture ? ['pig', 'sheep', 'cow', 'chicken', 'rabbit', 'cat', 'deer', 'roe_deer', 'fawn', 'hedgehog'] : ['rabbit'];
            const spawnedId = list[Math.floor(Math.random() * list.length)];
            const spawned = this.mobSys.spawn(spawnedId, p[0], p[1], p[2]);
            if (spawnedId === 'cow' && Math.random() < 0.55 && spawned) {
              const a = Math.random() * Math.PI * 2;
              const calf = this.mobSys.spawn('calf', p[0] + Math.cos(a) * 1.6, p[1], p[2] + Math.sin(a) * 1.6);
              if (calf) {
                calf.grow = 60;
                calf.group.scale.setScalar(calf.def.scale * calf.modelSize * babyGrowthScale(calf.id, 0));
              }
            } else if ((spawnedId === 'deer' || spawnedId === 'roe_deer') && Math.random() < 0.48 && spawned) {
              const a = Math.random() * Math.PI * 2;
              const fawn = this.mobSys.spawn('fawn', p[0] + Math.cos(a) * 1.35, p[1], p[2] + Math.sin(a) * 1.35);
              if (fawn) {
                fawn.grow = 70;
                fawn.group.scale.setScalar(fawn.def.scale * fawn.modelSize * babyGrowthScale(fawn.id, 0));
              }
            } else if (spawnedId === 'camel' && Math.random() < 0.48 && spawned) {
              const a = Math.random() * Math.PI * 2;
              const camelCalf = this.mobSys.spawn('camel_calf', p[0] + Math.cos(a) * 1.8, p[1], p[2] + Math.sin(a) * 1.8);
              if (camelCalf) {
                camelCalf.grow = 80;
                camelCalf.group.scale.setScalar(camelCalf.def.scale * 0.78);
              }
            }
          }
        }
      }
    }

    // A separate, faster trickle of birds and bees keeps the sky alive even
    // when the ground-animal quota is already full.
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = (this.survival ? 1.5 : 1.2) * (moving ? 0.7 : 1);
      const beeTarget = this.daylight < 0.35 || this.world.isWinter(Math.floor(this.pos.x), Math.floor(this.pos.z)) ? 0 : 4;
      if (this.mobSys.count(false) < budget && (birds < 4 || bees < beeTarget)) {
        const id: MobId = birds < 4 && (bees >= beeTarget || birds / 4 <= bees / beeTarget) ? 'bird' : 'bee';
        if (id === 'bee') {
          const flower = this.world.findFlowerNear(this.pos.x, this.pos.z, 24);
          if (flower && this.world.biomeAt(Math.floor(flower[0]), Math.floor(flower[2])) !== 'winter')
            this.mobSys.spawn('bee', flower[0], flower[1] + 0.3, flower[2]);
        } else {
          const p = this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 8, 26, biasAngle,
            [GRASS, SAND, STONE, SNOW_GRASS, VOLCANIC_STONE], 'bird');
          if (p) this.mobSys.spawn('bird', p[0], p[1], p[2]);
        }
      }
    }

    // ---- recycle wildlife left far behind (frees the cap for new land) ----
    if ((this.frameNo & 63) === 0) {
      for (let i = this.mobSys.mobs.length - 1; i >= 0; i--) {
        const m = this.mobSys.mobs[i];
        if (!m.alive || m.def.hostile || m.id === 'trader') continue;
        const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
        if (d > 48) this.mobSys.remove(m); // free old slots for birds and insects nearby
      }
    }

    // ---- wandering traders cross your path out in the wild ----
    this.wanderTraderTimer -= dt;
    if (this.wanderTraderTimer <= 0) {
      this.wanderTraderTimer = 45 + Math.random() * 50;
      const traders = this.mobSys.mobs.filter((m) => m.alive && m.id === 'trader');
      // keep at most 2 alive; drop ones left far behind
      for (const tr of traders) {
        if (Math.hypot(tr.x - this.pos.x, tr.z - this.pos.z) > 90) this.mobSys.remove(tr);
      }
      if (traders.length < 2) {
        const p = this.mobSys.findSpawnPoint(this.pos.x, this.pos.z, 20, 38, biasAngle, undefined, 'trader');
        // never in water — solid dry ground only
        if (p && this.world.get(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])) !== WATER) {
          this.mobSys.spawn('trader', p[0], p[1], p[2]);
        }
      }
    }

    const playerExtents = this.playerHalfExtents();
    this.mobSys.update(
      dt,
      this.pos.x,
      this.pos.y,
      this.pos.z,
      this.daylight,
      this.survivalThreatLevel(),
      (m, dmg, targetId) => targetId ? this.companionHit(targetId, m, dmg) : this.mobHit(m, dmg),
      (m) => this.mobDied(m, true),
      (m) => this.mobShoot(m),
      (x, y, z) => { this.markDirtyAt(x, z); this.enqueueSupportCheck(x, y, z); },
      (x, y, z, food) => {
        const tint = BLOCKS[food]?.tint ?? [220, 180, 100];
        const particles = tint[0] > tint[1] * 1.25 && tint[0] > tint[2] * 1.25 ? [245, 190, 80] : tint;
        this.burst(x, y, z, particles, 2, 0.35, 0.25);
      },
      this.localBotThreatTargets(),
      {
        x: this.pos.x,
        y: this.pos.y,
        z: this.pos.z,
        halfX: playerExtents.halfX,
        halfZ: playerExtents.halfZ,
        height: this.playerHeight(),
      },
    );

    this.updateCampfireDamage(dt);
    this.updateCreatureVoices(dt);
  }

  /** Dark-cave spawn: a clear air pocket with solid floor and creature separation. */
  private findCaveSpawn(id: MobId): [number, number, number] | null {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 16;
      const x = Math.floor(this.pos.x + Math.cos(a) * r);
      const z = Math.floor(this.pos.z + Math.sin(a) * r);
      if (!this.world.hasColumn(x, z)) continue;
      const surf = this.world.getHeight(x, z);
      // probe a few depths around the player's own level
      const y0 = Math.max(2, Math.floor(this.pos.y) - 6 + Math.floor(Math.random() * 10));
      for (let y = y0; y < Math.min(surf - 3, y0 + 6); y++) {
        if (
          isSolid(this.world.get(x, y - 1, z)) &&
          this.world.get(x, y, z) === AIR &&
          this.world.get(x, y + 1, z) === AIR &&
          this.world.get(x, y + 2, z) === AIR
        ) {
          const candidate: [number, number, number] = [x + 0.5, y, z + 0.5];
          if (this.mobSys.canSpawnAt(id, candidate[0], candidate[1], candidate[2])) return candidate;
        }
      }
    }
    return null;
  }

  private mobHit(m: Mob, dmg: number) {
    if (this.phase !== 'playing') return;
    if (this.survival && m.def.hostile) dmg *= this.hostileDamageScale();
    const red = damageReduction(this.stats.armor);
    let taken = dmg * (1 - red);
    if (m.def.explodes) {
      const threat = this.survivalThreatLevel();
      const explosionScale = this.creeperExplosionScale(threat);
      const explosionRadius = 3.4 * explosionScale.radius;

      this.addShake(1.1 * explosionScale.radius);
      this.flash = 0.9;
      this.burst(m.x, m.y + 0.6, m.z, [90, 90, 90], 34, 6);
      this.burst(m.x, m.y + 0.6, m.z, [255, 170, 60], 18, 5);
      const d = Math.hypot(m.x - this.pos.x, m.z - this.pos.z);
      taken *= explosionScale.damage * Math.max(0.2, 1 - d / explosionRadius);
      // a wall between you and the blast soaks most of it
      if (!this.mobSys.lineOfSight(m, this.pos.x, this.pos.y + 1.2, this.pos.z)) taken *= 0.15;

      // Destroy blocks based on explosion radius and threat level
      if (explosionScale.destroyBlocks) {
        this.destroyBlocksInRadius(m.x, m.y + 0.6, m.z, explosionScale.destroyRadius);
      }
    } else {
      this.addShake(0.3);
      this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [248, 207, 115], 6, 2);
      if (m.def.hostile) this.playMobVoice(m, 'attack', 0.9);
    }
    // thorns reflect
    if (this.stats.thorns > 0 && m.alive) {
      const back = (dmg * this.stats.thorns) / 100;
      m.hp -= back;
      m.hurtFlash = 0.16;
      this.mobSys.showHealthBar(m);
      if (m.hp <= 0) this.mobDied(m, false);
    }
    this.killedBy = t(m.def.nameKey);
    this.damage(taken, 'mob');
  }

  /** Calculate creeper explosion modifiers based on threat level. */
  private creeperExplosionScale(threat: number): { damage: number; radius: number; destroyBlocks: boolean; destroyRadius: number } {
    // Early game (threat 0-2): normal explosion
    if (threat < 3) {
      return { damage: 1.0, radius: 1.0, destroyBlocks: false, destroyRadius: 0 };
    }
    // Mid game (threat 3-5): stronger explosion, small block destruction
    if (threat < 6) {
      return { damage: 1.3, radius: 1.2, destroyBlocks: true, destroyRadius: 2 };
    }
    // Late game (threat 6-8): much stronger, medium block destruction
    if (threat < 9) {
      return { damage: 1.6, radius: 1.5, destroyBlocks: true, destroyRadius: 3 };
    }
    // End game (threat 9+): devastating explosion, large block destruction
    return { damage: 2.0, radius: 1.8, destroyBlocks: true, destroyRadius: 4 };
  }

  /** Destroy blocks in a radius around an explosion. */
  private destroyBlocksInRadius(cx: number, cy: number, cz: number, radius: number) {
    if (radius <= 0) return;
    const r2 = radius * radius;
    const minX = Math.floor(cx - radius);
    const maxX = Math.floor(cx + radius);
    const minY = Math.floor(cy - radius);
    const maxY = Math.floor(cy + radius);
    const minZ = Math.floor(cz - radius);
    const maxZ = Math.floor(cz + radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const dz = z + 0.5 - cz;
          const dist2 = dx * dx + dy * dy + dz * dz;
          if (dist2 > r2) continue;

          const block = this.world.get(x, y, z);
          if (block === 0) continue;

          // Don't destroy bedrock or important blocks
          if (block === BEDROCK) continue;

          // Soft blocks (dirt, grass, sand) always break
          // Hard blocks (stone, ores) only break at higher threat levels
          const isSoft = block === DIRT || block === GRASS || block === SAND || block === SNOW_GRASS;
          const isMedium = isLogId(block) || isLeafId(block) || block === PLANKS || block === DOOR_WOOD;

          if (isSoft || (isMedium && radius >= 3) || radius >= 4) {
            this.world.set(x, y, z, 0);
            this.burst(x + 0.5, y + 0.5, z + 0.5, [120, 100, 80], 3, 2);
          }
        }
      }
    }
  }

  /** player swings at whatever the crosshair is on */
  private tryAttack() {
    if (this.attackCd > 0) return false;
    const reach = this.interactionReach();
    const m = this.mobSys.raycast(this.eyeV.x, this.eyeV.y, this.eyeV.z, this.dirV.x, this.dirV.y, this.dirV.z, reach + EYE);
    if (!m || this.mobReachDistance(m) > reach + 0.02) return false;
    if (m.id === 'trader') return true; // he's a merchant, not target practice

    const swift = 1 - Math.min(0.4, this.stats.swift / 100);
    const heldId = this.hotbar[this.selected] ?? HAND;
    const cooldown = meleeAttackInterval(heldId);
    this.attackCd = cooldown * swift;
    this.startSwing(0.6);

    let dmg = this.attackDamage();
    // Like Java combat, a melee critical is deliberate: the player must strike while falling.
    const crit = !this.onGround && !this.inWater && this.vel.y < -0.25;
    if (crit) dmg *= 1.5;
    m.hp -= dmg;
    m.hurtFlash = 0.18;
    this.mobSys.showHealthBar(m);
    // knockback
    const kx = m.x - this.pos.x;
    const kz = m.z - this.pos.z;
    const kd = Math.hypot(kx, kz) || 1;
    m.vx += (kx / kd) * 7;
    m.vz += (kz / kd) * 7;
    if (m.onGround) m.vy = 4.2;

    // --- affixes ---
    if (this.stats.fire > 0) {
      m.burn = Math.max(m.burn, 3.5);
      this.burst(m.x, m.y + 0.9, m.z, [255, 150, 40], 8, 3);
    }
    if (this.stats.frost > 0) m.slow = 2.5;
    if (this.stats.vamp > 0) {
      this.health = Math.min(100, this.health + this.stats.vamp);
      this.popup(this.pos.x, this.pos.y + 1.6, this.pos.z, `+${this.stats.vamp.toFixed(0)}`, '#ff5f7a');
    }

    // Friendly, model-matched hit puffs; scale both count and spread to the animal.
    // Red coats use soft cream particles so hits never resemble blood.
    if (!m.def.hostile) {
      const hex = m.def.body.replace('#', '');
      const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const color = rgb[0] > rgb[1] * 1.35 && rgb[0] > rgb[2] * 1.2 ? [238, 224, 190] : rgb;
      const size = Math.max(0.3, Math.min(1.35, m.def.scale));
      this.burst(m.x, m.y + 0.65 * size, m.z, color, Math.max(2, Math.round((crit ? 9 : 5) * size)), (crit ? 2.3 : 1.5) * size);
    } else {
      // Gold sparks make hostile hits read as stylized impacts rather than blood-like splashes.
      this.burst(m.x, m.y + 0.9, m.z, [248, 207, 115], crit ? 14 : 7, crit ? 4 : 2.6);
    }
    this.popup(m.x, m.y + 1.5, m.z, `${Math.round(dmg)}`, crit ? '#ffd24a' : '#ffffff', crit);
    this.addShake(crit ? 0.32 : 0.16);
    sfx.breakBlock(1.4);
    this.playMobVoice(m, 'hurt');
    this.damageHeldTool(1);

    if (m.hp <= 0) this.mobDied(m, false);
    return true;
  }

  attackDamage() {
    return meleeDamage(this.hotbar[this.selected] ?? HAND, this.stats.damage);
  }

  // ================= ARROWS =================
  private arrows: Array<{
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    mesh: THREE.Group;
    /** Player arrow stats are captured at launch so switching bows cannot change an in-flight shot. */
    damage?: number;
    /** true = shot by a skeleton archer, hurts the player */
    hostile?: boolean;
    /** which arrow item was spent on the shot (ARROW_ITEM when nothing was equipped) */
    arrowId?: number | null;
  }> = [];
  private monkeyProjectiles: MonkeyPetProjectile[] = [];

  /** skeleton archer fires the standard arrow model at the player */
  private mobShoot(m: Mob) {
    const arrowId = ARROW_ITEM;
    const mesh = buildArrowModel(arrowId);
    const ox = m.x;
    const oy = m.y + 1.4;
    const oz = m.z;
    let dx = this.pos.x - ox;
    let dy = this.pos.y + 1.1 - oy;
    let dz = this.pos.z - oz;
    const len = Math.hypot(dx, dy, dz) || 1;
    // slight inaccuracy so it's dodgeable
    dx = dx / len + (Math.random() - 0.5) * 0.08;
    dy = dy / len + (Math.random() - 0.5) * 0.06 + 0.03;
    dz = dz / len + (Math.random() - 0.5) * 0.08;
    const sp = 22;
    const a = { x: ox + dx, y: oy, z: oz + dz, vx: dx * sp, vy: dy * sp, vz: dz * sp, life: 2.2, mesh, hostile: true, arrowId };
    mesh.position.set(a.x, a.y, a.z);
    this.scene.add(mesh);
    this.arrows.push(a);
    sfx.swing(3);
  }

  private tryShoot() {
    if (this.attackCd > 0) return;
    // The active hotbar is the player's arrow pool: when a bow is drawn, use the first
    // loaded arrow stack in that row, rather than silently choosing a random inventory stack.
    const arrowId = (this.arrowLoadout !== null && isArrowId(this.arrowLoadout) && (this.inventory.get(this.arrowLoadout) ?? 0) > 0 ? this.arrowLoadout : null)
      ?? this.hotbar.find((id): id is (typeof ARROW_IDS)[number] => id !== undefined && isArrowId(id) && (this.inventory.get(id) ?? 0) > 0)
      ?? ARROW_IDS.find((id) => (this.inventory.get(id) ?? 0) > 0)
      ?? ARROW_ITEM;
    if ((this.inventory.get(arrowId) ?? 0) <= 0) {
      this.queueTutorialTip('mechanic:bow-ammo', t('tutorialBowTitle'), t('tutorialBowAmmo'), '#c7a879', 'bow');
      this.attackCd = 0.4;
      sfx.ui(false);
      return;
    }
    this.queueTutorialTip('mechanic:bow-fire', t('tutorialBowTitle'), t('tutorialBowFire'), '#c7a879', 'bow');
    this.inventory.set(arrowId, (this.inventory.get(arrowId) ?? 0) - 1);
    const spec = getToolSpec(this.hotbar[this.selected] ?? TOOL_BOW);
    const tier = spec?.kind === 'bow' ? spec.tier : 0;
    // Early bows shoot more slowly and hit lightly; later materials trade resources for reach and power.
    const cooldowns = [0.82, 0.76, 0.70, 0.62, 0.64, 0.58];
    const speeds = [27, 29, 31, 32, 33, 35];
    const swift = 1 - Math.min(0.4, this.stats.swift / 100);
    this.attackCd = cooldowns[tier] * swift;
    this.startSwing(0.4);
    sfx.swing(4);
    this.damageHeldTool(1);
    const mesh = buildArrowModel(arrowId);
    const sp = speeds[tier];
    const a = {
      x: this.eyeV.x + this.dirV.x * 0.6,
      y: this.eyeV.y - 0.12 + this.dirV.y * 0.6,
      z: this.eyeV.z + this.dirV.z * 0.6,
      vx: this.dirV.x * sp,
      vy: this.dirV.y * sp + 0.6,
      vz: this.dirV.z * sp,
      life: 2.4,
      mesh,
      damage: bowArrowDamage(spec?.id ?? TOOL_BOW, arrowId, this.stats.damage),
      arrowId,
    };
    mesh.position.set(a.x, a.y, a.z);
    this.scene.add(mesh);
    this.arrows.push(a);
    this.syncHotbar(true);
  }

  private updateArrows(dt: number) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      a.vy -= 13 * dt;
      const steps = 2; // sub-steps prevent tunnelling at 34 m/s
      let dead = a.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        a.x += (a.vx * dt) / steps;
        a.y += (a.vy * dt) / steps;
        a.z += (a.vz * dt) / steps;
        // hostile arrows hunt the player instead of mobs
        if (a.hostile) {
          const pd = Math.hypot(a.x - this.pos.x, a.y - (this.pos.y + 1), a.z - this.pos.z);
          if (pd < 0.85) {
            const red = damageReduction(this.stats.armor);
            this.killedBy = t('mob_archer');
            const threatDamage = this.survival ? this.hostileDamageScale() : 1;
            this.damage(7 * threatDamage * (1 - red), 'mob');
            this.burst(a.x, a.y, a.z, [248, 207, 115], 6, 2);
            dead = true;
            break;
          }
          if (isSolid(this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) {
            this.resolveArrowBlockImpact(a);
            dead = true;
            break;
          }
          continue;
        }
        // hit a mob?
        const hit = this.mobSys.inRadius(a.x, a.y, a.z, 0.75).filter((m) => m.id !== 'trader')[0];
        if (hit) {
          const dmg = a.damage ?? 6;
          hit.hp -= dmg;
          hit.hurtFlash = 0.18;
          this.mobSys.showHealthBar(hit);
          hit.vx += a.vx * 0.06;
          hit.vz += a.vz * 0.06;
          // Elemental arrow payloads: fire and poison deal an immediate secondary tick;
          // freeze and stun interrupt movement so the shot has a tactical effect.
          if (a.arrowId === FIRE_ARROW) { hit.burn = 5; hit.burnTick = 0; hit.hp -= 0; hit.hurtFlash = 0.45; this.burst(a.x, a.y, a.z, [255, 90, 25], 8, 1.4); }
          if (a.arrowId === POISON_ARROW) { hit.poison = 5; hit.poisonTick = 0; hit.hurtFlash = 0.5; this.burst(a.x, a.y, a.z, [120, 220, 70], 8, 1.1); }
          if (a.arrowId === FREEZE_ARROW) { hit.vx *= 0.12; hit.vz *= 0.12; this.burst(a.x, a.y, a.z, [100, 220, 255], 10, 1.2); }
          if (a.arrowId === STUN_ARROW) { hit.stun = 5; hit.vx = 0; hit.vz = 0; hit.hurtFlash = 0.65; this.burst(a.x, a.y, a.z, [250, 220, 80], 10, 1.2); }
          // the arrow lodges in the target and recovers as the same ammunition when the mob dies
          hit.stuckArrows++;
          hit.stuckArrowIds.push(a.arrowId ?? ARROW_ITEM);
          if (this.stats.fire > 0) hit.burn = Math.max(hit.burn, 3);
          if (this.stats.frost > 0) hit.slow = 2;
          this.popup(hit.x, hit.y + 1.5, hit.z, `${Math.round(dmg)}`, '#93c95d', false);
          this.burst(a.x, a.y, a.z, [220, 220, 200], 5, 2);
          sfx.crack(2);
          if (hit.hp <= 0) this.mobDied(hit, false);
          dead = true;
          break;
        }
        if (isSolid(this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z)))) {
          this.resolveArrowBlockImpact(a);
          dead = true;
          break;
        }
      }
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
      if (dead) {
        this.scene.remove(a.mesh);
        disposeObject(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
  }

  private resolveArrowBlockImpact(a: { x: number; y: number; z: number; vx: number; vy: number; vz: number; arrowId?: number | null }) {
    const blockId = this.world.get(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z));
    if (arrowBreaksOnBlock(blockId)) {
      this.burst(a.x, a.y, a.z, [207, 177, 139], 7, 1.1);
      sfx.crack(2);
      return;
    }
    this.burst(a.x, a.y, a.z, [200, 190, 160], 3, 1.3);
    this.stickArrowInBlock(a);
  }

  private stickArrowInBlock(a: { x: number; y: number; z: number; vx: number; vy: number; vz: number; arrowId?: number | null }) {
    const candidateId = a.arrowId ?? ARROW_ITEM;
    const id = isArrowId(candidateId) ? candidateId : ARROW_ITEM;
    const direction = new THREE.Vector3(a.vx, a.vy, a.vz);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    else direction.normalize();

    // The model's point is on local +Z. Place it just through the block face, with
    // most of the shaft and its fletching visible on the side the shot came from.
    const center = new THREE.Vector3(a.x, a.y, a.z).addScaledVector(direction, -0.35);
    const mesh = buildArrowModel(id);
    mesh.scale.setScalar(0.82);
    mesh.position.copy(center);
    mesh.lookAt(center.clone().add(direction));
    mesh.userData.stuckInBlock = true;
    this.scene.add(mesh);

    this.stuckArrows.push({
      id,
      x: center.x,
      y: center.y,
      z: center.z,
      blockX: Math.floor(a.x),
      blockY: Math.floor(a.y),
      blockZ: Math.floor(a.z),
      mesh,
    });
    // Bound scene/GPU memory in long-running games; the oldest embedded arrow
    // falls free as a pickup rather than disappearing when the visual cap is hit.
    if (this.stuckArrows.length > MAX_STUCK_ARROWS) this.removeStuckArrow(0, true);
  }

  private removeStuckArrow(index: number, returnToWorld: boolean) {
    const [arrow] = this.stuckArrows.splice(index, 1);
    if (!arrow) return;
    this.scene.remove(arrow.mesh);
    disposeObject(arrow.mesh);
    if (returnToWorld) this.spawnDrop(arrow.x, arrow.y, arrow.z, arrow.id);
  }

  private updateStuckArrows() {
    let collected = false;
    const eyeX = this.pos.x;
    const eyeY = this.pos.y + 1.1;
    const eyeZ = this.pos.z;
    for (let i = this.stuckArrows.length - 1; i >= 0; i--) {
      const arrow = this.stuckArrows[i];
      // Breaking/removing the supporting block releases the same arrow type as a pickup.
      if (!isSolid(this.world.get(arrow.blockX, arrow.blockY, arrow.blockZ))) {
        this.removeStuckArrow(i, true);
        continue;
      }
      // An embedded arrow is an ordinary collectible: walk within 1.35 blocks to reclaim it.
      if (Math.hypot(arrow.x - eyeX, arrow.y - eyeY, arrow.z - eyeZ) > 1.35) continue;
      this.removeStuckArrow(i, false);
      this.inventory.set(arrow.id, (this.inventory.get(arrow.id) ?? 0) + 1);
      this.addToHotbar(arrow.id);
      collected = true;
    }
    if (collected) {
      sfx.pickup(1);
      this.syncHotbar(true);
      this.syncHud(true);
    }
  }

  private launchMonkeyProjectile(rig: WolfPetRig, target: Mob) {
    const itemId = Math.random() < 0.5 ? BANANA : COCONUT;
    const mesh = this.buildFancyDrop(itemId) ?? new THREE.Group();
    mesh.scale.setScalar(itemId === COCONUT ? 0.84 : 0.9);
    const ox = rig.group.position.x;
    const oy = rig.group.position.y + 0.96;
    const oz = rig.group.position.z;
    let dx = target.x - ox;
    let dz = target.z - oz;
    const horizontalDistance = Math.hypot(dx, dz) || 1;
    dx = dx / horizontalDistance + (Math.random() - 0.5) * 0.035;
    dz = dz / horizontalDistance + (Math.random() - 0.5) * 0.035;
    const speed = itemId === COCONUT ? 16.8 : 15.5;
    const gravity = itemId === COCONUT ? 10.5 : 9.3;
    const travelTime = Math.max(0.14, horizontalDistance / speed);
    const targetY = target.y + 0.92;
    const vy = Math.max(-1.1, Math.min(4.2, (targetY - oy + 0.5 * gravity * travelTime * travelTime) / travelTime + (Math.random() - 0.5) * 0.12));
    const projectile: MonkeyPetProjectile = {
      x: ox + dx * 0.34,
      y: oy,
      z: oz + dz * 0.34,
      vx: dx * speed,
      vy,
      vz: dz * speed,
      life: itemId === COCONUT ? 1.6 : 1.45,
      mesh,
      itemId,
      damage: itemId === COCONUT ? 1.8 : 1.2,
      stunChance: itemId === COCONUT ? 0.26 : 0.16,
    };
    if (target.alive && !target.hidden && target.def.hostile) {
      target.hp -= projectile.damage;
      target.hurtFlash = 0.18;
      target.vx += dx * 0.45;
      target.vz += dz * 0.45;
      if (Math.random() < projectile.stunChance) {
        target.stun = Math.max(target.stun, 5);
        target.vx = 0;
        target.vz = 0;
      }
      this.mobSys.showHealthBar(target);
      if (target.hp <= 0) this.mobDied(target, false);
    }
    mesh.position.set(projectile.x, projectile.y, projectile.z);
    mesh.lookAt(projectile.x + projectile.vx, projectile.y + projectile.vy, projectile.z + projectile.vz);
    this.scene.add(mesh);
    this.monkeyProjectiles.push(projectile);
    sfx.creature('monkey', { state: 'attack', volume: 0.3, pitch: 0.98 + Math.random() * 0.18 });
  }

  private updateMonkeyProjectiles(dt: number) {
    if (this.phase !== 'playing') return;
    for (let i = this.monkeyProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.monkeyProjectiles[i];
      projectile.life -= dt;
      projectile.vy -= (projectile.itemId === COCONUT ? 10.5 : 9.3) * dt;
      let dead = projectile.life <= 0;
      for (let step = 0; step < 2 && !dead; step++) {
        projectile.x += (projectile.vx * dt) / 2;
        projectile.y += (projectile.vy * dt) / 2;
        projectile.z += (projectile.vz * dt) / 2;
        if (isSolid(this.world.get(Math.floor(projectile.x), Math.floor(projectile.y), Math.floor(projectile.z)))) {
          this.burst(projectile.x, projectile.y, projectile.z, projectile.itemId === COCONUT ? [146, 98, 58] : [242, 207, 86], 5, 1.0);
          dead = true;
          break;
        }
      }
      projectile.mesh.position.set(projectile.x, projectile.y, projectile.z);
      projectile.mesh.lookAt(projectile.x + projectile.vx, projectile.y + projectile.vy, projectile.z + projectile.vz);
      if (dead) {
        this.scene.remove(projectile.mesh);
        disposeObject(projectile.mesh);
        this.monkeyProjectiles.splice(i, 1);
      }
    }
  }

  private clearStuckArrows() {
    for (let i = this.stuckArrows.length - 1; i >= 0; i--) this.removeStuckArrow(i, false);
  }

  private clearArrows() {
    for (const a of this.arrows) {
      this.scene.remove(a.mesh);
      disposeObject(a.mesh);
    }
    this.arrows.length = 0;
    this.clearStuckArrows();
  }

  private mobDied(m: Mob, burned: boolean) {
    if (!m.alive) return;
    // Tumbleweeds are rolling plants, not animals: one hit breaks them cleanly,
    // with no meat, kill count, score, or animal-drop logic.
    if (m.id === 'tumbleweed') {
      this.burst(m.x, m.y + 0.25, m.z, [214, 180, 114], 6, 0.75, 0.42);
      this.mobSys.remove(m);
      return;
    }
    this.kills++;
    const def = m.def;
    // Species and rendered carcass size determine both the meat label and the cooked healing value.
    if (!def.hostile && def.id !== 'jellyfish' && def.id !== 'frog') {
      const meat = meatDropForAnimal(def.id, m.variant, Math.abs(m.group.scale.x));
      if (meat) {
        const itemId = burned ? meat.cookedId : meat.rawId;
        for (let i = 0; i < meat.count; i++) this.spawnDrop(m.x, m.y + 0.6, m.z, itemId);
      }
      // species loot (Minecraft-style, percentage rolls)
      const dropAt = (id: number, chance: number, count = 1) => {
        if (Math.random() < chance) for (let i = 0; i < count; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, id);
      };
      switch (def.id) {
        case 'sheep':
          dropAt(WOOL, 0.9, 1 + (Math.random() < 0.5 ? 1 : 0));
          break;
        case 'chicken':
        case 'bird':
          dropAt(FEATHER, 0.7, 1 + (Math.random() < 0.4 ? 1 : 0));
          break;
        case 'turtle':
          dropAt(TURTLE_SHELL, 0.4);
          break;
        case 'crab':
          dropAt(CRAB_SHELL, 0.55);
          break;
        case 'fish':
          dropAt(FISH_SCALE, 0.75, 1 + (Math.random() < 0.5 ? 1 : 0));
          break;
        case 'cat':
          dropAt(CAT_CLAW, 0.55);
          break;
        case 'penguin':
          dropAt(FEATHER, 0.6, 2);
          break;
      }
    }
    // monster-specific ingredients stay right where the mob fell
    if (def.hostile) {
      const ing =
        def.id === 'spider' ? WEB : def.id === 'skeleton' ? BONE : def.id === 'zombie' ? FLESH : GUNPOWDER;
      const n = 1 + (Math.random() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, ing);
      if (def.id === 'skeleton' && Math.random() < 0.5) {
        for (let i = 0; i < 3; i++) this.spawnDrop(m.x, m.y + 0.5, m.z, ARROW_ITEM);
      }
    }
    // Every arrow you shot into it clatters back out with its original type.
    for (let i = 0; i < m.stuckArrows; i++) {
      this.spawnDrop(m.x, m.y + 0.6, m.z, m.stuckArrowIds[i] ?? ARROW_ITEM);
    }
    m.stuckArrows = 0;
    m.stuckArrowIds.length = 0;
    const gained = this.awardScore(Math.round(def.score * this.comboMult() * (1 + this.stats.greed / 100)));
    this.combo++;
    this.comboTimer = 3;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const nearby = Math.hypot(m.x - this.pos.x, m.y - this.pos.y, m.z - this.pos.z);
    if (nearby < 22) this.popup(m.x, m.y + 1.4, m.z, `+${gained}`, def.hostile ? '#ff9f5a' : '#93c95d', def.hostile);
    // Death is a brief dissolve; non-burned mobs leave pale-blue pixels, not red splashes.
    this.burst(m.x, m.y + 0.8, m.z, burned ? [255, 140, 40] : [143, 204, 216], 18, 3.6);
    if (nearby < 16) sfx.breakBlock(def.hostile ? 0.7 : 1.2);
    if (nearby < 12) this.addShake(0.24);

    // loot: gear drops as a physical bag AT the death spot — walk over to grab it
    if (def.hostile) {
      // Deeper survival nights count as a stronger enemy tier, unlocking rare materials and rarity.
      const it = rollLoot(def.level + this.survivalThreatLevel(), (Math.random() * 1e9) | 0);
      if (it) this.spawnDrop(m.x, m.y + 0.7, m.z, LOOT_BAG, it);
    }
    this.playMobVoice(m, 'death', 1.05);
    this.mobSys.remove(m);
    this.syncHud(true);
  }

  // ================= EQUIPMENT =================
  equip(uid: string) {
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = this.bagItems[i];
    const prev = this.equipped[it.slot];
    this.equipped[it.slot] = it;
    this.bagItems.splice(i, 1);
    if (prev) this.bagItems.push(prev);
    this.stats = computeStats(this.equipped);
    this.syncAvatarArmor();
    sfx.ui(true);
    this.syncHud(true);
  }

  unequip(slot: Slot) {
    const it = this.equipped[slot];
    if (!it) return;
    delete this.equipped[slot];
    this.bagItems.push(it);
    this.stats = computeStats(this.equipped);
    this.syncAvatarArmor();
    sfx.ui(false);
    this.syncHud(true);
  }

  // ================= HELD ITEM =================
  /** tier of the pick currently in hand (0 if none) */
  heldPickTier(): number {
    const spec = getToolSpec(this.hotbar[this.selected] ?? -1);
    return spec?.kind === 'pickaxe' ? spec.tier : 0;
  }
  heldSwordTier(): number {
    const spec = getToolSpec(this.hotbar[this.selected] ?? -1);
    return spec?.kind === 'sword' ? spec.tier : -1;
  }
  heldAxeTier(): number {
    const spec = getToolSpec(this.hotbar[this.selected] ?? -1);
    return spec?.kind === 'axe' ? spec.tier : 0;
  }
  heldShovelTier(): number {
    const spec = getToolSpec(this.hotbar[this.selected] ?? -1);
    return spec?.kind === 'shovel' ? spec.tier : 0;
  }

  heldKind(): HudState['heldKind'] {
    const id = this.hotbar[this.selected];
    if (id === HAND || id === undefined) return 'fist';
    if (isGearHotbarId(id)) return 'gear';
    if (id === TOOL_TORCH) return 'torch';
    const spec = getToolSpec(id);
    if (spec?.kind === 'pickaxe') return 'pick';
    if (spec?.kind === 'sword') return 'sword';
    if (spec?.kind === 'axe') return 'axe';
    if (spec?.kind === 'shovel') return 'shovel';
    if (spec?.kind === 'hoe') return 'hoe';
    if (spec?.kind === 'bow') return 'bow';
    return 'block';
  }

  heldName(): string {
    const k = this.heldKind();
    if (k === 'gear') {
      const id = this.hotbar[this.selected] ?? -1;
      const g = this.bagItems.find((b) => b.hid === id);
      if (g) return `${t(SLOT_KEY[g.slot])} · ${matName(MATERIALS[g.material].label)}`;
      return t('gear');
    }
    if (k === 'pick' || k === 'sword' || k === 'axe' || k === 'shovel' || k === 'hoe') {
      return toolLabelForId(this.hotbar[this.selected] ?? -1);
    }
    if (k === 'torch') return t('handTorch');
    if (k === 'bow') return `${toolLabelForId(this.hotbar[this.selected] ?? TOOL_BOW)} · ${this.inventory.get(ARROW_ITEM) ?? 0}`;
    if (k === 'fist') return t('emptyHand'); // bare hand (slot 1 or empty)
    const id = this.hotbar[this.selected] ?? -1;
    return blockName(id, BLOCKS[id]?.name ?? '');
  }

  /** how effective the held tool is against a given block */
  private toolMultiplier(blockId: number): number {
    const cls = blockClass(blockId);
    switch (this.heldKind()) {
      case 'pick':
        return cls === 'stone' ? 1.5 : cls === 'earth' ? 0.72 : cls === 'wood' ? 0.65 : 0.55;
      case 'axe':
        // The material's speed stat already supplies progression; this is its woodcutting bonus.
        return cls === 'wood' ? 1.55 : cls === 'earth' ? 0.65 : 0.42;
      case 'shovel':
        return cls === 'earth' ? 1.45 : cls === 'wood' ? 0.55 : 0.35;
      case 'hoe':
        // Minecraft-style hoes are efficient on leaves and organic blocks.
        return isLeafId(blockId) || blockId === HAY_BALE || isPlant(blockId) ? 1.35 : 0.35;
      case 'sword':
        return 0.18;
      case 'bow':
        return 0.12;
      case 'fist':
        // bare hands: noticeably worse than even a wooden pick
        return cls === 'wood' || cls === 'earth' ? 0.45 : 0.3;
      default:
        return 0.5;
    }
  }

  // ================= TRADER =================
  offers: TradeOffer[] = [];
  sellPrice(id: number): number {
    return resourceSellPrice(id);
  }

  /** sell a tool straight out of the hotbar or inventory */
  sellTool(id: number, instanceId?: number) {
    if (isInventoryBlockId(id)) return;
    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) return; // nothing owned — never sell an air slot
    let durability: number | undefined;
    if (isDurabilityTool(id)) {
      const instance = instanceId !== undefined ? this.toolInstances.get(instanceId) : [...this.toolInstances.values()].find((it) => it.id === id);
      if (!instance || instance.id !== id) return;
      durability = instance.durability;
      this.removeToolInstance(instance.instanceId);
      this.recalcOwnedToolTiers();
    } else {
      const i = this.hotbar.indexOf(id);
      if (i >= 0) {
        this.hotbar[i] = undefined;
        this.hotbarInstanceIds[i] = undefined;
      }
      if (count - 1 > 0) this.inventory.set(id, count - 1);
      else this.inventory.delete(id);
      if (this.selected === i) this.selected = 0;
    }
    const gained = this.awardScore(toolSellPrice(id, durability));
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b');
    sfx.pickup(5);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  /** sell a piece of gear (from the bag) to the trader */
  sellGear(uid: string) {
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = this.bagItems[i];
    this.bagItems.splice(i, 1);
    const gained = this.awardScore(gearSellPrice(it));
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b');
    sfx.pickup(6);
    this.syncHud(true);
  }

  /** dismantle unwanted gear at the workbench back into raw materials */
  salvageGear(uid: string): boolean {
    if (!this.workbenchNear() && this.invTab !== 'workbench') {
      sfx.ui(false);
      return false;
    }
    const i = this.bagItems.findIndex((x) => x.uid === uid);
    let it: Item | undefined;
    if (i >= 0) {
      it = this.bagItems[i];
      this.bagItems.splice(i, 1);
    } else {
      // Allow dismantling even if dragged directly from an equipped slot
      for (const s of Object.keys(this.equipped) as Slot[]) {
        if (this.equipped[s]?.uid === uid) {
          it = this.equipped[s];
          delete this.equipped[s];
          this.stats = computeStats(this.equipped);
          this.syncAvatarArmor();
          break;
        }
      }
    }
    if (!it) return false;

    const outputs = getSalvageForGear(it);
    const parts: string[] = [];
    for (const [id, count] of outputs) {
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + count);
      this.addToHotbar(id);
      parts.push(`+${count} ${blockName(id, BLOCKS[id]?.name ?? '')}`);
    }

    sfx.breakBlock(0.8);
    this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [220, 220, 230], 12, 2.5);
    this.pushBanner(t('salvaged'), parts.join(', '), '#93c95d');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** dismantle any craftable item/tool/weapon/block at the workbench back into reduced crafting ingredients */
  salvageItem(id: number, instanceId?: number): boolean {
    if (!this.workbenchNear() && this.invTab !== 'workbench') {
      sfx.ui(false);
      return false;
    }
    if (isGearHotbarId(id)) {
      const g = this.bagItems.find((b) => b.hid === id);
      return g ? this.salvageGear(g.uid) : false;
    }
    const info = getSalvageForItemId(id);
    if (!info) {
      sfx.ui(false);
      return false;
    }
    const owned = this.inventory.get(id) ?? 0;
    if (owned <= 0) {
      sfx.ui(false);
      return false;
    }
    if (isDurabilityTool(id)) {
      const instance = instanceId !== undefined ? this.toolInstances.get(instanceId) : [...this.toolInstances.values()].find((it) => it.id === id);
      if (!instance || instance.id !== id) {
        sfx.ui(false);
        return false;
      }
      this.removeToolInstance(instance.instanceId);
      this.recalcOwnedToolTiers();
    } else {
      const consume = Math.min(owned, Math.max(1, info.inputsUsed));
      const remaining = owned - consume;
      if (remaining <= 0) {
        this.inventory.delete(id);
        const hbIdx = this.hotbar.indexOf(id);
        if (hbIdx >= 0) {
          this.hotbar[hbIdx] = undefined;
          this.hotbarInstanceIds[hbIdx] = undefined;
        }
      } else {
        this.inventory.set(id, remaining);
      }
    }

    const parts: string[] = [];
    for (const [outId, outCount] of info.outputs) {
      this.inventory.set(outId, (this.inventory.get(outId) ?? 0) + outCount);
      this.addToHotbar(outId);
      parts.push(`+${outCount} ${blockName(outId, BLOCKS[outId]?.name ?? '')}`);
    }

    sfx.breakBlock(0.8);
    this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [220, 220, 230], 12, 2.5);
    this.pushBanner(t('salvaged'), parts.join(', '), '#93c95d');
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /** sell the entire stack of a resource to the trader for score */
  sellResource(id: number) {
    const count = this.inventory.get(id) ?? 0;
    if (count <= 0) {
      sfx.ui(false);
      return;
    }
    const gained = this.awardScore(this.sellPrice(id) * count);
    this.inventory.set(id, 0);
    this.popup(this.pos.x, this.pos.y + 1.5, this.pos.z, `+${gained}`, '#f7d34b', gained > 400);
    sfx.pickup(6);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  buyOffer(index: number) {
    const offer = this.offers[index];
    if (!offer || offer.sold) return;
    for (const [id, n] of offer.cost) {
      if ((this.inventory.get(id) ?? 0) < n) {
        sfx.ui(false);
        return;
      }
    }
    for (const [id, n] of offer.cost) this.inventory.set(id, (this.inventory.get(id) ?? 0) - n);
    offer.sold = true;
    this.bagItems.push(offer.item);
    sfx.upgrade();
    this.pushBanner(t('looted'), `${t(('slot_' + offer.item.slot) as never)}`, RARITY_COLORS[offer.item.rarity]);
    this.syncHotbar(true);
    this.syncHud(true);
  }

  private rollTraderOffers() {
    const rand = mulberry32((Math.random() * 1e9) | 0);
    const slots: Slot[] = ['hands', 'chest', 'offhand', 'head', 'legs', 'feet'];
    this.offers = [];
    for (let i = 0; i < 3; i++) {
      const rarityRoll = rand();
      const rarity: Rarity = rarityRoll < 0.28 ? 0 : rarityRoll < 0.53 ? 1 : rarityRoll < 0.75 ? 2 : rarityRoll < 0.93 ? 3 : 4;
      const material = rand() < 0.36 ? 'gold' : rand() < 0.7 ? 'iron' : 'diamond';
      const item = makeItem(slots[Math.floor(rand() * slots.length)], material, rarity, rand);
      this.offers.push({ item, cost: gearTraderCost(rarity, material, item.slot), sold: false });
    }
  }

  /** true when a placed campfire burns within 4 blocks of the player */
  campfireNear(): boolean {
    const px = Math.floor(this.pos.x);
    const py = Math.floor(this.pos.y);
    const pz = Math.floor(this.pos.z);
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++)
          if (this.world.get(px + dx, py + dy, pz + dz) === CAMPFIRE) return true;
    return false;
  }

  // ================= INVENTORY & CRAFTING =================
  inventoryOpen = false;
  invTab: string = 'all';
  private lastCraft: string | null = null;

  private craftSignature() {
    let s = '';
    for (const r of RECIPES) s += r ? (this.canCraft(r) ? '1' : '0') : 'x';
    return s;
  }

  inventoryList() {
    const out: Array<{ id: number; count: number; instanceId?: number; durability?: number; maxDurability?: number }> = [];
    this.inventory.forEach((count, id) => {
      if (count <= 0) return;
      const spec = getToolSpec(id);
      if (!spec) {
        out.push({ id, count });
        return;
      }
      const instances = [...this.toolInstances.values()].filter((item) => item.id === id);
      for (const item of instances) {
        out.push({ id, count: 1, instanceId: item.instanceId, durability: item.durability, maxDurability: spec.maxDurability });
      }
    });
    out.sort((a, b) => b.count - a.count || a.id - b.id || (a.instanceId ?? 0) - (b.instanceId ?? 0));
    return out;
  }

  canCraft(r: Recipe) {
    if (!r || !Array.isArray(r.inputs)) return false;
    // Any tool or item can be crafted at any time if you have the ingredients —
    // no prerequisite tier, no previous-recipe unlock, no duplicate limit.
    if (r.kind === 'cook' && !this.campfireNear()) return false;
    return r.inputs.every(([id, n]) => (this.inventory.get(id) ?? 0) >= n);
  }

  private craftedGearFromRecipe(recipe: Recipe): Item | null {
    if (recipe.kind !== 'gear' || !recipe.slot || !recipe.material) return null;
    const item = makeItem(recipe.slot, recipe.material, 0, Math.random, true);
    item.recipeKey = recipe.key;
    item.visualColor = recipe.accent;
    if (recipe.key === 'turtle_helmet') item.armor += 3;
    if (recipe.key === 'claw_gloves') item.affixes.push({ id: 'swift', value: 12 });
    if (recipe.key === 'crab_shield') item.armor += 2;
    return ensureGearHid(item);
  }

  /** Grant the full gatherable/crafted/dropped catalogue in the temporary developer QA mode. */
  grantDeveloperCatalog(): boolean {
    if (!isDeveloperShopEnabled() || this.phase !== 'playing') {
      sfx.ui(false);
      return false;
    }
    const catalog = getDeveloperCatalog();
    for (const id of catalog.itemIds) {
      this.inventory.set(id, 64);
      this.addToHotbar(id);
    }
    this.inventory.set(TOOL_TORCH, 64);
    this.addToHotbar(TOOL_TORCH);

    for (const id of catalog.toolIds) {
      if (id === TOOL_TORCH || [...this.toolInstances.values()].some((tool) => tool.id === id)) continue;
      this.addToolInstance(id);
    }
    for (const variant of catalog.gearVariants) {
      if (this.bagItems.some((item) => !item.crafted && item.slot === variant.slot && item.material === variant.material && item.rarity === variant.rarity)) continue;
      this.bagItems.push(ensureGearHid(makeItem(variant.slot, variant.material, variant.rarity, Math.random)));
    }
    for (const key of catalog.gearRecipeKeys) {
      const recipe = RECIPES.find((entry) => entry && entry.key === key);
      if (!recipe) continue;
      const item = this.craftedGearFromRecipe(recipe);
      if (!item) continue;
      if (this.bagItems.some((owned) => owned.crafted && owned.slot === item.slot && owned.material === item.material && owned.visualColor === item.visualColor)) continue;
      this.bagItems.push(item);
    }

    this.recalcOwnedToolTiers();
    this.syncHotbar(true);
    this.pushBanner(t('devKitTitle'), t('devKitGranted'), '#ff5364');
    this.syncHud(true);
    sfx.upgrade();
    return true;
  }

  craft(key: string): boolean {
    const r = RECIPES.find((rr) => rr.key === key);
    if (!r || !this.canCraft(r)) {
      sfx.ui(false);
      return false;
    }
    for (const [id, n] of r.inputs) {
      if (getToolSpec(id)) {
        // Upgraded bows consume the previous physical bow, including its wear record and hotbar slot.
        for (let i = 0; i < n; i++) {
          const instance = [...this.toolInstances.values()].find((item) => item.id === id);
          if (instance) this.removeToolInstance(instance.instanceId);
        }
      } else {
        this.inventory.set(id, (this.inventory.get(id) ?? 0) - n);
      }
    }
    this.lastCraft = r.key;
    const [localizedName, localizedDesc] = recipeText(r.key, r.name, r.desc);
    const rName = r.toolId ? toolLabelForId(r.toolId) : localizedName;
    const rDesc = r.toolId ? toolRecipeDesc(r.toolId) : localizedDesc;

    if (r.out) {
      const [id, n] = r.out;
      this.inventory.set(id, (this.inventory.get(id) ?? 0) + n);
      this.addToHotbar(id);
    }
    if (r.kind === 'axe' || r.kind === 'hoe') {
      // Crafted items get individual wear records; duplicates remain independently repairable.
      const tool = r.toolId ?? (r.kind === 'axe' ? AXE_TOOLS[r.tier ?? 0] : HOE_TOOLS[r.tier ?? 0]);
      this.addToolInstance(tool);
      sfx.upgrade();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 235, 160], 12, 3);
    } else if (r.kind === 'shovel' || r.kind === 'bow') {
      const tool = r.toolId ?? (r.kind === 'shovel' ? SHOVEL_TOOLS[r.tier ?? 0] : TOOL_BOW);
      this.addToolInstance(tool);
      sfx.upgrade();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 235, 160], 12, 3);
    } else if (r.kind === 'torch') {
      this.inventory.set(TOOL_TORCH, (this.inventory.get(TOOL_TORCH) ?? 0) + 1);
      sfx.upgrade();
      this.pushBanner(t('handTorch'), rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.3, this.pos.z, [255, 176, 58], 12, 3);
    } else if (r.kind === 'food') {
      this.health = Math.min(100, this.health + (r.heal ?? 0));
      sfx.pickup(4);
      this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.heal} ${t('hp')}`, '#93c95d', true);
    } else if (r.kind === 'gear' && r.slot && r.material) {
      const it = this.craftedGearFromRecipe(r);
      if (!it) return false;
      this.bagItems.push(it);
      sfx.upgrade();
      this.pushBanner(rName, `+${it.armor} ${t('armorTotal')}`, r.accent);
    } else if (r.kind === 'weapon' && r.weapon !== undefined) {
      this.swordTier = Math.max(this.swordTier, r.weapon);
      // Each copy owns its own durability record and can occupy its own quick slot.
      const toolId = r.toolId ?? SWORD_TOOLS[r.weapon];
      this.addToolInstance(toolId);
      sfx.upgrade();
      this.addShake(0.4);
      this.pushBanner(rName, rDesc, r.accent);
    } else if (r.kind === 'pickaxe' && r.tier !== undefined) {
      this.tier = Math.max(this.tier, r.tier);
      // The pickaxe is a real physical instance with its own wear record.
      const toolId = r.toolId ?? PICK_TOOLS[r.tier];
      this.addToolInstance(toolId);
      this.updatePickaxe();
      this.flash = 0.5;
      this.addShake(0.55);
      this.burst(this.pos.x, this.pos.y + 1.2, this.pos.z, [255, 235, 160], 34, 5.5);
      sfx.upgrade();
      this.pushBanner(pickaxeLabel(r.tier), rDesc, PICKAXE_TIERS[r.tier].color);
    } else if (r.kind === 'time') {
      sfx.upgrade();
      if (!this.endlessRun) {
        this.timeLeft += r.seconds ?? 0;
        this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.seconds}${t('secShort')}`, '#7ee7a0', true);
        this.pushBanner(t('overdrive'), `+${r.seconds}${t('secShort')} ${t('secondsOnClock')}`, '#7ee7a0');
      } else {
        this.pushBanner(rName, rDesc, r.accent);
      }
    } else if (r.kind === 'heal') {
      this.health = Math.min(100, this.health + (r.heal ?? 0));
      sfx.upgrade();
      this.popup(this.pos.x, this.pos.y + 1.4, this.pos.z, `+${r.heal} ${t('hp')}`, '#e2564a', true);
      this.pushBanner(t('patchedUp'), `+${r.heal} ${t('health')}`, '#e2564a');
    } else {
      sfx.place();
      this.pushBanner(rName, rDesc, r.accent);
      this.burst(this.pos.x, this.pos.y + 1.1, this.pos.z, [255, 240, 190], 14, 3);
    }
    this.recordExplorerCraft(r);
    this.syncHotbar(true);
    this.syncHud(true);
    return true;
  }

  /**
   * Click-to-assign: put an owned inventory item into a hotbar slot
   * (or the first free slot when `slot` is omitted). Delegates to placeInSlot.
   */
  assignToHotbar(id: number, slot?: number) {
    this.placeInSlot(id, slot);
  }

  private ensurePetRuntimeState(kind: PetKind) {
    if (!Array.isArray(this.petOwnedKinds)) this.petOwnedKinds = [];
    if (this.petOwned && this.petOwnedKinds.length === 0) this.petOwnedKinds.push(kind);
    this.petOwnedKinds = [...new Set(this.petOwnedKinds.filter((owned): owned is PetKind => owned === 'wolf' || owned === 'cat' || owned === 'monkey' || owned === 'parrot' || owned === 'owl'))];
    if (!this.petCoatIndices) this.petCoatIndices = { wolf: this.petCoatIndex ?? 0, cat: 0, monkey: 0, parrot: 0, owl: 0 };
    if (!Number.isFinite(this.petCoatIndices.cat)) this.petCoatIndices.cat = getCatCoatIndex();
    if (!Number.isFinite(this.petCoatIndices.parrot)) this.petCoatIndices.parrot = getParrotCoatIndex();
    if (!Number.isFinite(this.petCoatIndices.owl)) this.petCoatIndices.owl = getOwlCoatIndex();
    if (this.petEquippedKind === undefined) this.petEquippedKind = null;
    if (this.petSelectedKind !== 'wolf' && this.petSelectedKind !== 'cat' && this.petSelectedKind !== 'monkey' && this.petSelectedKind !== 'parrot' && this.petSelectedKind !== 'owl') this.petSelectedKind = this.petOwnedKinds[0] ?? kind;
    this.petOwned = this.petOwnedKinds.length > 0;
    this.petTokenAvailable = getPetInventoryKinds(this.petOwnedKinds, this.petEquipped ? this.petEquippedKind : null).length > 0;
  }

  private petInventoryKinds(): PetKind[] {
    return getPetInventoryKinds(this.petOwnedKinds, this.petEquipped ? this.petEquippedKind : null);
  }

  /** Equip one owned per-run companion token in the shared slot; only one pet follows at a time. */
  setPetEquipped(kind: PetKind, equipped: boolean): boolean {
    this.ensurePetRuntimeState(kind);
    if (equipped) {
      if (this.petEquipped && this.petEquippedKind === kind) return true;
      if (this.phase !== 'playing' || !this.petInventoryKinds().includes(kind)) {
        sfx.ui(false);
        return false;
      }
      // Replacing an occupied slot removes the old rig; the old species' token is
      // automatically visible again because inventory tokens are derived per species.
      if (this.petEquipped) this.clearWolfPetRig();
      this.petSelectedKind = kind;
      this.petCoatIndex = this.petCoatIndices[kind];
      this.petEquipped = true;
      this.petEquippedKind = kind;
      this.petTokenAvailable = this.petInventoryKinds().length > 0;
      this.createWolfPetRig(kind);
      sfx.ui(true);
    } else {
      if (!this.petEquipped || this.petEquippedKind !== kind) return false;
      this.petEquipped = false;
      this.petEquippedKind = null;
      this.petSelectedKind = kind;
      this.petCoatIndex = this.petCoatIndices[kind];
      this.petTokenAvailable = this.petInventoryKinds().length > 0;
      this.clearWolfPetRig();
      sfx.ui(false);
    }
    this.syncHud(true);
    return true;
  }

  /** Compatibility wrapper retained for wolf-token callers. */
  setWolfPetEquipped(equipped: boolean): boolean {
    return this.setPetEquipped('wolf', equipped);
  }

  setCatPetEquipped(equipped: boolean): boolean {
    return this.setPetEquipped('cat', equipped);
  }

  setMonkeyPetEquipped(equipped: boolean): boolean {
    return this.setPetEquipped('monkey', equipped);
  }

  setParrotPetEquipped(equipped: boolean): boolean {
    return this.setPetEquipped('parrot', equipped);
  }

  setOwlPetEquipped(equipped: boolean): boolean {
    return this.setPetEquipped('owl', equipped);
  }

  /** Select a pet token; while the slot is occupied this also replaces the active species. */
  selectPetKind(kind: PetKind): boolean {
    this.ensurePetRuntimeState(kind);
    if (!this.petOwnedKinds.includes(kind)) return false;
    if (this.petEquipped) return this.setPetEquipped(kind, true);
    if (this.petSelectedKind === kind) return true;
    this.petSelectedKind = kind;
    this.petCoatIndex = this.petCoatIndices[kind];
    this.syncHud(true);
    return true;
  }

  /** Cycle a species' independent coat palette; every species keeps its own saved appearance. */
  cyclePetCoat(kind: PetKind, direction = 1): boolean {
    this.ensurePetRuntimeState(kind);
    if (!this.petOwnedKinds.includes(kind) || !Number.isFinite(direction) || direction === 0) return false;
    const coats = kind === 'wolf' ? WOLF_COATS : kind === 'cat' ? CAT_COATS : kind === 'monkey' ? MONKEY_COATS : kind === 'parrot' ? PARROT_COATS : OWL_COATS;
    const current = this.petCoatIndices[kind];
    const delta = direction < 0 ? -1 : 1;
    const requested = (current + delta + coats.length) % coats.length;
    const saved = kind === 'wolf'
      ? setWolfCoatIndex(requested)
      : kind === 'cat'
        ? setCatCoatIndex(requested)
        : kind === 'monkey'
          ? setMonkeyCoatIndex(requested)
          : kind === 'parrot'
            ? setParrotCoatIndex(requested)
            : setOwlCoatIndex(requested);
    if (saved === current) return false;
    this.petCoatIndices[kind] = saved;
    if (kind === this.petSelectedKind || kind === this.petEquippedKind) this.petCoatIndex = saved;
    if (this.wolfPetRig?.kind === kind) this.rebuildWolfPetRigForCoat();
    this.syncHud(true);
    return true;
  }

  cycleOwlPetCoat(direction = 1): boolean {
    return this.cyclePetCoat('owl', direction);
  }

  cycleParrotPetCoat(direction = 1): boolean {
    return this.cyclePetCoat('parrot', direction);
  }

  /** Wolf-specific compatibility wrapper. */
  cycleWolfPetCoat(direction = 1): boolean {
    return this.cyclePetCoat('wolf', direction);
  }

  openInventory() {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    // A platform/ad pause is authoritative; inventory must not resume it behind the SDK's back.
    if (this.phase === 'paused' && this.pausedBySystem) return;
    if (!this.traderNear() && this.invTab === 'trade') this.invTab = 'tools';
    this.inventoryOpen = true;
    // Opening the bag from the manual pause screen resumes the live world as well.
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.pausedBySystem = false;
    }
    // Stay still while crafting, but keep physics and the world simulation running.
    for (const key of [
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'KeyC', 'KeyF',
    ]) this.keys[key] = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchJump = false;
    this.touchPlace = false;
    this.touchSprint = false;
    this.touchCrouch = false;
    this.touchCrawl = false;
    this.hoverActive = false;
    this.vel.x = 0;
    this.vel.z = 0;
    this.mining = false;
    this.placing = false;
    this.lastCraft = null;
    if (document.pointerLockElement) document.exitPointerLock();
    sfx.ui(true);
    this.syncHud(true);
  }

  closeInventory() {
    if (!this.inventoryOpen) return;
    if (this.activeChest) this.closeActiveChest();
    this.inventoryOpen = false;
    if (this.sandbox) this.saveWorld(true);
    this.invTab = 'tools';
    // A real platform pause may have arrived while the live inventory was open.
    if (this.phase === 'paused' && !this.pausedBySystem) this.phase = 'playing';
    if (this.phase === 'playing') {
      this.pausedBySystem = false;
      sfx.ui(false);
      this.requestLock();
    }
    this.syncHud(true);
  }

  private updatePickaxe() {
    const c = PICKAXE_TIERS[this.tier].color;
    this.pickHeadMats.forEach((m) => m.color.set(c));
  }

  // ================= PARTICLES =================
  burst(x: number, y: number, z: number, rgb: [number, number, number] | number[], count: number, power = 3, sizeScale = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = (0.4 + Math.random() * 0.9) * power;
      const jitter = () => (Math.random() - 0.5) * 46;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.7,
        y: y + (Math.random() - 0.5) * 0.7,
        z: z + (Math.random() - 0.5) * 0.7,
        vx: Math.cos(a) * Math.cos(b) * sp,
        vy: Math.sin(b) * sp + power * 0.55,
        vz: Math.sin(a) * Math.cos(b) * sp,
        life: 0.5 + Math.random() * 0.75,
        max: 1.25,
        size: (0.07 + Math.random() * 0.11) * sizeScale,
        r: Math.max(0, Math.min(1, (rgb[0] + jitter()) / 255)),
        g: Math.max(0, Math.min(1, (rgb[1] + jitter()) / 255)),
        b: Math.max(0, Math.min(1, (rgb[2] + jitter()) / 255)),
      });
    }
  }

  private updateParticles(dt: number) {
    const arr = this.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr[i] = arr[arr.length - 1];
        arr.pop();
        continue;
      }
      if (p.weather) {
        if (p.weather === 'snow') {
          p.vx += Math.sin(this.time * 1.7 + p.x * 0.31) * dt * 0.08;
          p.vz += Math.cos(this.time * 1.3 + p.z * 0.27) * dt * 0.08;
        } else {
          p.vy -= 3.2 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const ground = this.world.getHeight(Math.floor(p.x), Math.floor(p.z)) + 0.08;
        if (p.y <= ground || Math.abs(p.x - this.pos.x) > 34 || Math.abs(p.z - this.pos.z) > 34) {
          arr[i] = arr[arr.length - 1];
          arr.pop();
        }
        continue;
      }
      if (!p.smoke) p.vy -= GRAVITY * 0.72 * dt;
      else { p.vx += (Math.random() - 0.5) * dt; p.vz += (Math.random() - 0.5) * dt; }
      const nx = p.x + p.vx * dt,
        ny = p.y + p.vy * dt,
        nz = p.z + p.vz * dt;
      if (!p.smoke && isSolid(this.world.get(Math.floor(nx), Math.floor(p.y), Math.floor(p.z)))) {
        p.vx *= -0.32;
      } else p.x = nx;
      if (!p.smoke && isSolid(this.world.get(Math.floor(p.x), Math.floor(ny), Math.floor(p.z)))) {
        if (p.vy < 0) {
          p.vy *= -0.28;
          p.vx *= 0.72;
          p.vz *= 0.72;
        } else p.vy = 0;
      } else p.y = ny;
      if (!p.smoke && isSolid(this.world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(nz)))) {
        p.vz *= -0.32;
      } else p.z = nz;
    }

    const n = arr.length;
    this.pMesh.count = n;
    for (let i = 0; i < n; i++) {
      const p = arr[i];
      const k = Math.min(1, p.life / (p.weather ? p.max : 0.42));
      const s = p.size * (0.45 + k * 0.75);
      this.pDummy.position.set(p.x, p.y, p.z);
      if (p.weather === 'rain') {
        this.pDummy.rotation.set(0.2, 0, -0.16);
        this.pDummy.scale.set(s * 0.34, s * 5.8, s * 0.34);
      } else if (p.weather === 'snow') {
        this.pDummy.rotation.set(p.x * 1.7 + this.time, p.y * 1.3, p.z * 1.7);
        this.pDummy.scale.set(s * 1.15, s * 0.32, s * 1.15);
      } else {
        this.pDummy.rotation.set(p.x * 3 + this.time, p.y * 3, p.z * 3);
        this.pDummy.scale.setScalar(s);
      }
      this.pDummy.updateMatrix();
      this.pMesh.setMatrixAt(i, this.pDummy.matrix);
      const nightWeatherDim = p.weather ? (0.2 + Math.min(1, this.daylight) * 0.72) : 1;
      this.pColor.setRGB(p.r * nightWeatherDim, p.g * nightWeatherDim, p.b * nightWeatherDim, THREE.SRGBColorSpace);
      this.pMesh.setColorAt(i, this.pColor);
    }
    if (n > 0) {
      this.pMesh.instanceMatrix.needsUpdate = true;
      if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    }
  }

  // ================= POPUPS =================
  private popup(x: number, y: number, z: number, text: string, color: string, big = false, options: PopupOptions = {}) {
    const anchor = options.anchor ?? 'world';
    if (anchor === 'crosshair') {
      // A repeated denial starts a fresh message; gently stack active ones upward instead of reusing
      // their DOM node, so each warning remains readable for its own full lifetime.
      for (const active of this.popups) {
        if (active.life <= 0 || active.anchor !== 'crosshair') continue;
        active.screenRiseTarget += Math.max(28, active.el.offsetHeight + 8);
      }
    }
    const p = this.popups.find((pp) => pp.life <= 0) ?? this.createPopup();
    const parent = anchor === 'crosshair' ? this.popupOverlay : this.fx;
    if (p.el.parentElement !== parent) parent.appendChild(p.el);
    p.x = x + (Math.random() - 0.5) * 0.5;
    p.y = y;
    p.z = z + (Math.random() - 0.5) * 0.5;
    p.vy = anchor === 'world' ? 1.35 : 0;
    p.life = options.duration ?? (big ? 1.25 : 0.95);
    p.max = p.life;
    p.text = text;
    p.color = color;
    p.big = big;
    p.anchor = anchor;
    p.screenRise = 0;
    p.screenRiseTarget = 0;
    p.screenRiseSpeed = options.screenRiseSpeed ?? 0;
    p.el.textContent = text;
    p.el.style.color = color;
    p.el.style.fontSize = anchor === 'crosshair' ? '18px' : big ? '30px' : '21px';
    p.el.style.letterSpacing = big ? '1px' : '0.5px';
    p.el.style.whiteSpace = anchor === 'crosshair' ? 'normal' : 'nowrap';
    p.el.style.maxWidth = anchor === 'crosshair' ? 'min(88vw, 30rem)' : 'none';
    p.el.style.textAlign = anchor === 'crosshair' ? 'center' : 'left';
    p.el.style.lineHeight = anchor === 'crosshair' ? '1.25' : 'normal';
    p.el.style.padding = anchor === 'crosshair' ? '5px 9px' : '0';
    p.el.style.background = anchor === 'crosshair' ? 'rgba(8,11,10,.86)' : 'transparent';
    p.el.style.border = anchor === 'crosshair' ? '1px solid rgba(226,86,74,.58)' : '0';
    p.el.style.borderRadius = anchor === 'crosshair' ? '3px' : '0';
  }

  private pushBanner(text: string, sub: string, color: string) {
    this.banner = { text, sub, color, key: Math.random() };
    this.bannerTimer = 2.6;
    this.syncHud(true);
  }

  private queueTutorialTip(id: string, title: string, body: string, color: string, icon: TutorialIcon) {
    if (this.tutorialSeen.has(id) || this.tutorialPending.has(id)) return;
    const tip = { title, body, color, icon, key: Math.random() };
    this.tutorialPending.add(id);
    const queued = { id, tip };
    if (this.tutorialTip) this.tutorialTipQueue.push(queued);
    else this.activateTutorialTip(queued);
  }

  private activateTutorialTip(entry: { id: string; tip: TutorialTip }) {
    this.tutorialPending.delete(entry.id);
    this.tutorialSeen.add(entry.id);
    this.tutorialTip = entry.tip;
    this.tutorialTipTimer = 5.5;
    try {
      storageSet(TUTORIAL_STORAGE_KEY, JSON.stringify([...this.tutorialSeen]));
    } catch {
      // Keep the hint visible even when storage is unavailable.
    }
    this.syncHud(true);
  }

  private updateTutorialTip(dt: number) {
    // Keep interaction tips waiting behind inventory screens, then let the player read them on return.
    if (this.inventoryOpen) return;
    if (!this.tutorialTip) {
      const next = this.tutorialTipQueue.shift();
      if (next) this.activateTutorialTip(next);
      return;
    }
    this.tutorialTipTimer -= dt;
    if (this.tutorialTipTimer > 0) return;
    this.tutorialTip = null;
    const next = this.tutorialTipQueue.shift();
    if (next) this.activateTutorialTip(next);
    else this.syncHud(true);
  }

  private updateCraftReadyTip(dt: number) {
    if (this.tutorialTip || this.tutorialTipQueue.length) return;
    this.craftTipScanTimer -= dt;
    if (this.craftTipScanTimer > 0) return;
    this.craftTipScanTimer = 0.55;

    const order: Array<{ kind: 'pickaxe' | 'weapon' | 'bow' | 'axe' | 'shovel' | 'hoe'; icon: TutorialIcon }> = [
      { kind: 'pickaxe', icon: 'pickaxe' },
      { kind: 'weapon', icon: 'sword' },
      { kind: 'bow', icon: 'bow' },
      { kind: 'axe', icon: 'axe' },
      { kind: 'shovel', icon: 'shovel' },
      { kind: 'hoe', icon: 'hoe' },
    ];
    for (const entry of order) {
      const id = `craft:${entry.kind}`;
      if (this.tutorialSeen.has(id) || this.tutorialPending.has(id)) continue;
      const recipe = RECIPES.find((candidate) => candidate.kind === entry.kind && candidate.toolId !== undefined && this.canCraft(candidate));
      if (!recipe) continue;
      const label = recipe.toolId ? toolLabelForId(recipe.toolId) : recipe.name;
      const openHint = this.isCoarse() ? t('tutorialOpenInventoryTouch') : t('tutorialOpenInventory');
      this.queueTutorialTip(id, t('tutorialCraftReady'), `${label} · ${openHint}`, recipe.accent, entry.icon);
      return;
    }
  }

  private objectiveHudState(): HudObjective[] {
    if (!this.explorationObjectives.length) return [];
    const len = this.explorationObjectives.length;
    const start = Math.max(0, Math.min(this.objectiveIndex - 1, len - 3));
    return this.explorationObjectives.slice(start, start + 3).map((task, offset) => {
      const index = start + offset;
      return {
        id: task.id,
        titleKey: task.titleKey,
        progress: task.progress,
        target: task.target,
        rewardScore: task.rewardScore,
        rewardSeconds: task.rewardSeconds,
        status: index < this.objectiveIndex ? 'complete' : index === this.objectiveIndex ? 'active' : 'locked',
      };
    });
  }

  private recordExplorerMining(blockId: number, amount = 1) {
    if (!this.explorationObjectives.length || amount <= 0) return;
    for (const task of this.explorationObjectives) {
      if (task.mineBlockIds?.includes(blockId)) task.progress = Math.min(task.target, task.progress + amount);
    }
    this.advanceExplorerObjectives();
  }

  private recordExplorerChest() {
    for (const task of this.explorationObjectives) if (task.openChest) task.progress = Math.min(task.target, task.progress + 1);
    this.advanceExplorerObjectives();
  }

  private recordExplorerCollect(itemId: number, amount = 1) {
    if (!this.explorationObjectives?.length || amount <= 0) return;
    for (const task of this.explorationObjectives) {
      const collectedRequiredItem = task.collectItemId === itemId;
      const collectedRawMeat = task.collectRawMeat && isRawMeatItem(itemId);
      if (collectedRequiredItem || collectedRawMeat) task.progress = Math.min(task.target, task.progress + amount);
    }
    this.advanceExplorerObjectives();
  }

  private recordExplorerCraft(recipe: Recipe) {
    if (!this.explorationObjectives.length) return;
    const gearMaterialTier: Record<string, number> = {
      wood: 0, leather: 0, stone: 1, iron: 2, gold: 3, diamond: 4, netherite: 5,
      redstone: 2, lapis: 2, emerald: 3,
    };
    for (const task of this.explorationObjectives) {
      const craftedPickaxe = task.craftPickaxeTier !== undefined && recipe.kind === 'pickaxe' && recipe.tier === task.craftPickaxeTier;
      const craftedRecipe = task.craftRecipeKey !== undefined && recipe.key === task.craftRecipeKey;
      const craftedRecipeVariant = task.craftRecipeKeys?.includes(recipe.key) ?? false;
      let craftedKind = task.craftKind !== undefined && recipe.kind === task.craftKind && (task.craftTier === undefined || recipe.tier === task.craftTier);
      if (!craftedKind && task.craftKind === 'gear' && recipe.kind === 'gear' && task.craftTier !== undefined) {
        const mat = (recipe as any).material as string | undefined;
        const matTier = mat ? gearMaterialTier[mat] : undefined;
        if (matTier !== undefined && matTier === task.craftTier) craftedKind = true;
      }
      if (craftedPickaxe || craftedRecipe || craftedRecipeVariant || craftedKind) task.progress = Math.min(task.target, task.progress + 1);
    }
    this.advanceExplorerObjectives();
  }

  /** Roasting raw meat at a campfire counts toward the cooking missions (any meat type). */
  private recordExplorerCook() {
    if (!this.explorationObjectives.length) return;
    for (const task of this.explorationObjectives) {
      if (task.craftKind === 'cook') task.progress = Math.min(task.target, task.progress + 1);
    }
    this.advanceExplorerObjectives();
  }

  private advanceExplorerObjectives() {
    let lastCompleted: ExplorationTask | null = null;
    let lastScoreAward = 0;
    while (this.objectiveIndex < this.explorationObjectives.length) {
      const task = this.explorationObjectives[this.objectiveIndex];
      if (task.progress < task.target) break;
      lastCompleted = task;
      this.objectiveIndex++;
      lastScoreAward = this.awardScore(task.rewardScore);
      if (!this.endlessRun) this.timeLeft += task.rewardSeconds;
    }
    if (!lastCompleted) return;
    const rewardTime = `${Math.floor(lastCompleted.rewardSeconds / 60)}:${String(lastCompleted.rewardSeconds % 60).padStart(2, '0')}`;
    const reward = t('objectiveReward')
      .replace('{score}', String(lastScoreAward))
      .replace('{time}', rewardTime);
    this.popup(this.pos.x, this.pos.y + 1.7, this.pos.z, `+${lastScoreAward} · +${lastCompleted.rewardSeconds}${t('secShort')}`, '#93c95d', true);
    this.pushBanner(t('objectiveComplete'), `${formatObjectiveTitle(lastCompleted.titleKey, lastCompleted.target)} · ${reward}`, '#93c95d');
  }

  private tmpV = new THREE.Vector3();
  private updatePopups(dt: number) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const p of this.popups) {
      if (p.life <= 0) {
        if (p.el.style.opacity !== '0') p.el.style.opacity = '0';
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.life = 0;
        p.el.style.opacity = '0';
        continue;
      }
      let sx: number;
      let sy: number;
      if (p.anchor === 'crosshair') {
        p.screenRise += (p.screenRiseTarget - p.screenRise) * Math.min(1, dt * 14) + p.screenRiseSpeed * dt;
        sx = w * 0.5;
        sy = h * 0.5 - p.screenRise;
      } else {
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.25, dt);
        this.tmpV.set(p.x, p.y, p.z).project(this.camera);
        if (this.tmpV.z > 1) {
          p.el.style.opacity = '0';
          continue;
        }
        sx = (this.tmpV.x * 0.5 + 0.5) * w;
        sy = (-this.tmpV.y * 0.5 + 0.5) * h;
      }
      const k = p.life / p.max;
      const pop = k > 0.86 ? 1 + (1 - k / 0.86) * -0.35 : 1;
      p.el.style.transform = `translate3d(${sx}px,${sy}px,0) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
      const opacity = p.anchor === 'crosshair' ? Math.min(1, p.life / 0.9) : Math.min(1, k * 2.2);
      p.el.style.opacity = String(opacity);
    }
  }

  // ================= HUD SYNC =================
  private writeDom() {
    const d = this.dom;
    if (d.coords) {
      const txt = `${Math.floor(this.pos.x)} · ${Math.floor(this.pos.y)} · ${Math.floor(this.pos.z)}`;
      if (d.coords.textContent !== txt) d.coords.textContent = txt;
    }
    if (d.compass) {
      // arrow points back to the spawn point
      const dx = this.spawnX - this.pos.x;
      const dz = this.spawnZ - this.pos.z;
      const dist = Math.hypot(dx, dz);
      const bearing = Math.atan2(dx, -dz) - this.yaw;
      d.compass.style.transform = `rotate(${(bearing * 180) / Math.PI}deg)`;
      d.compass.style.opacity = dist < 6 ? '0.25' : '1';
    }
    if (d.progress) d.progress.style.setProperty('--p', this.mineProgress.toFixed(3));
    if (d.comboBar) d.comboBar.style.transform = `scaleX(${Math.max(0, Math.min(1, this.comboTimer / 3)).toFixed(3)})`;
    if (d.healthBar) d.healthBar.style.width = `${Math.max(0, Math.min(100, this.health)).toFixed(1)}%`;
    if (d.staminaBar) d.staminaBar.style.width = `${Math.max(0, Math.min(100, this.staminaState.stamina)).toFixed(1)}%`;
    if (d.timeBar) d.timeBar.style.width = `${Math.max(0, Math.min(100, (this.timeLeft / this.runTime) * 100)).toFixed(2)}%`;
    if (d.vignette) {
      if (this.sleepDark > 0.01) {
        // closing eyelids while asleep
        d.vignette.style.opacity = String((this.sleepDark * 0.92).toFixed(3));
        d.vignette.style.background =
          'radial-gradient(ellipse at 50% 50%, rgba(4,6,10,.55) 30%, rgba(2,3,6,.99) 90%)';
      } else {
        const lava = this.inLava ? 0.72 : 0;
        const hurt = this.hurtTimer > 0 ? this.hurtTimer * 1.6 : 0;
        const low = this.health < 35 ? (1 - this.health / 35) * (0.25 + Math.sin(this.time * 5) * 0.12) : 0;
        const urgent = this.timeLeft < 10 ? (1 - this.timeLeft / 10) * (0.18 + Math.sin(this.time * 8) * 0.1) : 0;
        d.vignette.style.opacity = String(Math.max(this.flash * 0.55, lava, hurt, low, urgent).toFixed(3));
        d.vignette.style.background =
          lava > 0.4
            ? 'radial-gradient(circle at 50% 55%, rgba(255,110,20,0) 20%, rgba(226,60,12,.85) 100%)'
            : 'radial-gradient(circle at 50% 55%, rgba(190,20,20,0) 34%, rgba(178,26,26,.78) 100%)';
      }
    }
    if (d.crosshair) {
      const s = 1 + this.mineProgress * 0.5 + (this.swingT >= 0 ? 0.16 : 0);
      d.crosshair.style.transform = `translate(-50%,-50%) scale(${s.toFixed(3)}) rotate(${(this.mineProgress * 45).toFixed(1)}deg)`;
      d.crosshair.style.opacity = this.target ? '1' : '0.55';
    }
  }

  private syncHotbar(force: boolean) {
    // Sparse 10-slot bar: blocks, tools & gear vanish when no longer owned;
    // each durable tool slot must reference one live physical instance.
    for (let i = 0; i < this.hotbar.length; i++) {
      const id = this.hotbar[i];
      if (id === undefined) {
        this.hotbarInstanceIds[i] = undefined;
        continue;
      }
      if (id === HAND) {
        this.hotbarInstanceIds[i] = undefined;
        continue;
      }
      if (isGearHotbarId(id)) {
        if (!this.bagItems.some((b) => b.hid === id)) {
          this.hotbar[i] = undefined;
          this.hotbarInstanceIds[i] = undefined;
        }
      } else if (isDurabilityTool(id)) {
        const instanceId = this.hotbarInstanceIds[i];
        const instance = instanceId === undefined ? undefined : this.toolInstances.get(instanceId);
        if (!instance || instance.id !== id) {
          this.hotbar[i] = undefined;
          this.hotbarInstanceIds[i] = undefined;
        }
      } else if ((this.inventory.get(id) ?? 0) <= 0) {
        this.hotbar[i] = undefined;
        this.hotbarInstanceIds[i] = undefined;
      }
    }
    while (this.hotbar.length > 10) this.hotbar.pop();
    this.hotbarInstanceIds.length = this.hotbar.length;
    if (!this.hotbar.includes(HAND)) {
      const f = this.firstFreeSlot();
      if (f >= 0) {
        this.hotbar[f] = HAND;
        this.hotbarInstanceIds[f] = undefined;
      }
    }
    this.selected = Math.max(0, Math.min(9, this.selected));
    if (force) this.lastHudKey = '';
  }

  private lastHudCheck = 0;

  private syncHud(force: boolean) {
    // cheap DOM writes every frame; the expensive React-state key only ~7x/sec
    if (!force) {
      const now = performance.now();
      if (now - this.lastHudCheck < 140) {
        this.writeDom();
        return;
      }
      this.lastHudCheck = now;
    }
    const targetBlock = this.target;
    const activeChest = this.activeChest ?? null;
    const activeChestBlock = activeChest ? this.world.get(activeChest.x, activeChest.y, activeChest.z) : AIR;
    const activeChestItems = activeChest && isTreasureChest(activeChestBlock)
      ? (this.chestInventories?.get(Engine.chestCellKey(activeChest.x, activeChest.y, activeChest.z)) ?? new Map<number, number>())
      : null;
    const chestSignature = activeChestItems
      ? `${activeChest!.x},${activeChest!.y},${activeChest!.z}:` + [...activeChestItems].sort((a, b) => a[0] - b[0]).map(([id, count]) => `${id}x${count}`).join(',')
      : '-';
    const wearKey = [...this.toolInstances.values()].map((item) => `${item.instanceId}:${item.durability}`).join(',');
    const objectiveKey = `${this.objectiveIndex}/${this.explorationObjectives.map((task) => task.progress).join(',')}`;
    const key = [
      this.phase,
      Math.round(this.loadProgress * 100),
      this.score,
      Math.ceil(this.timeLeft),
      Math.ceil(this.health),
      Math.round(this.hunger),
      Math.round(this.staminaState.stamina),
      this.breathState.bubbles,
      this.inWater ? 1 : 0,
      this.headUnderwater() ? 1 : 0,
      this.phase === 'playing' && (this.headUnderwater() || this.breathState.bubbles < 6) ? 1 : 0,
      this.combo,
      this.tier,
      this.blocksMined,
      Math.round(this.deepest),
      this.oresFound,
      this.selected,
      this.banner?.key ?? 0,
      this.tutorialTip?.key ?? 0,
      this.deathCause ?? '-',
      this.fps,
      this.locked || this.lockPending ? 1 : 0,
      this.lockFailed ? 1 : 0,
      this.thirdPerson ? 1 : 0,
      this.crouching ? 1 : 0,
      this.crawling ? 1 : 0,
      this.inventoryOpen ? 1 : 0,
      chestSignature,
      this.petOwned ? 1 : 0,
      this.petOwnedKinds.join(','),
      this.petInventoryKinds().join(','),
      this.petTokenAvailable ? 1 : 0,
      this.petEquipped ? 1 : 0,
      this.petEquippedKind ?? '-',
      this.petSelectedKind,
      this.petCoatIndices.wolf,
      this.petCoatIndices.cat,
      this.petCoatIndices.monkey,
      this.petCoatIndices.parrot,
      this.petCoatIndices.owl,
      this.petCoatIndex,
      this.petInteractionAvailable() ? 1 : 0,
      this.lastCraft ?? '-',
      targetBlock ? targetBlock.id : 0,
      this.hotbar.map((id, i) => `${id ?? -1}:${this.inventory.get(id ?? -1) ?? 0}:${this.hotbarInstanceIds[i] ?? -1}`).join('|'),
      wearKey,
      this.craftSignature(),
      objectiveKey,
      // the squad panel has to react to teammate health / blocks moving, not just to own stats
      this.companions.size
        ? [...this.companions]
            .map(([id, rig]) => `${id}:${Math.round(rig.health)}:${rig.blocks}:${rig.finished ? 1 : 0}:${rig.dead ? 1 : 0}:${rig.activity}:${Math.round(rig.group.position.distanceTo(this.pos))}`)
            .join('|')
        : '-',
    ].join('~');
    if (!force && key === this.lastHudKey) {
      this.writeDom();
      return;
    }
    this.lastHudKey = key;
    this.onHud({
      phase: this.phase,
      loading: this.loadProgress,
      score: this.score,
      timeLeft: this.timeLeft,
      health: Math.max(0, Math.ceil(this.health)),
      hunger: Math.round(this.hunger),
      stamina: this.staminaState.stamina,
      arrowLoadout: this.arrowLoadout,
      airBubbles: this.breathState.bubbles,
      inWater: this.inWater,
      headUnderwater: this.headUnderwater(),
      breathVisible: this.phase === 'playing' && (this.headUnderwater() || this.breathState.bubbles < 6),
      combo: this.combo,
      comboMult: this.comboMult(),
      tier: this.tier,
      tierName: pickaxeLabel(this.tier),
      blocksMined: this.blocksMined,
      bestCombo: this.bestCombo,
      deepest: Math.round(this.deepest),
      oresFound: this.oresFound,
      // sparse hotbar: pad to 10 fixed slots, empty holes become null
      hotbar: Array.from({ length: 10 }, (_, i) => {
        const id = this.hotbar[i];
        if (id === undefined) return null;
        if (isGearHotbarId(id)) return { id, count: 1 };
        const instance = this.getToolInstanceAt(i);
        const spec = getToolSpec(id);
        return {
          id,
          count: this.inventory.get(id) ?? 0,
          ...(instance && spec ? { instanceId: instance.instanceId, durability: instance.durability, maxDurability: spec.maxDurability } : {}),
        };
      }),
      selected: this.selected,
      target: targetBlock && targetBlock.id !== AIR
        ? {
            id: targetBlock.id,
            name: isTreasureChest(targetBlock.id)
              ? `${blockName(baseChestId(targetBlock.id), BLOCKS[baseChestId(targetBlock.id)].name)} · ${
                  isOpenChest(targetBlock.id) ? t('chestEmptyHint') : t('chestOpenHint')
                }`
              : blockName(targetBlock.id, BLOCKS[targetBlock.id].name),
          }
        : null,
      banner: this.banner,
      deathCause: this.gameOverState(),
      fps: this.fps,
      locked: this.locked || this.lockPending,
      lockFailed: this.lockFailed,
      freeLook: this.freeLook,
      thirdPerson: this.thirdPerson,
      crouching: this.crouching,
      crawling: this.crawling,
      runTime: this.runTime,
      squad: this.companionStatus(),
      survival: this.survival,
      daylight: this.daylight,
      timeOfDay: this.clock,
      phaseName: this.phaseName(),
      kills: this.kills,
      heldName: this.heldName(),
      heldKind: this.heldKind(),
      swordTier: this.swordTier,
      equipped: { ...this.equipped },
      bagItems: this.bagItems.slice(),
      petOwned: this.petOwned,
      petOwnedKinds: [...this.petOwnedKinds],
      petInventoryKinds: this.petInventoryKinds(),
      petTokenAvailable: this.petTokenAvailable,
      petEquipped: this.petEquipped,
      petEquippedKind: this.petEquippedKind,
      petSelectedKind: this.petSelectedKind,
      petCoatIndices: { ...this.petCoatIndices },
      petCoatIndex: this.petCoatIndices[this.petSelectedKind],
      petInteractNear: this.phase === 'playing' && this.petInteractionAvailable(),
      stats: this.stats,
      killedBy: this.killedBy,
      offers: this.offers,
      sellPrices: Object.fromEntries(BLOCKS.filter((block) => block !== undefined).map((block) => [block.id, this.sellPrice(block.id)])),
      invTab: this.invTab,
      tradeNear: this.phase === 'playing' || this.inventoryOpen ? this.traderNear() !== null : false,
      anvilNear: this.phase === 'playing' || this.inventoryOpen ? this.anvilNear() : false,
      workbenchNear: this.phase === 'playing' || this.inventoryOpen ? this.workbenchNear() : false,
      sandbox: this.sandbox,
      endless: this.endlessRun,
      inventoryOpen: this.inventoryOpen,
      chest: activeChestItems && activeChest
        ? {
            id: baseChestId(activeChestBlock),
            name: blockName(baseChestId(activeChestBlock), BLOCKS[baseChestId(activeChestBlock)]?.name ?? t('chestStorageTitle')),
            items: [...activeChestItems].map(([id, count]) => ({ id, count })).sort((a, b) => a.id - b.id),
          }
        : null,
      tutorialTip: this.tutorialTip,
      explorationObjectives: this.objectiveHudState(),
      objectiveIndex: this.objectiveIndex,
      objectiveCount: this.explorationObjectives.length,
      inventory: this.inventoryList(),
      craftable: RECIPES.filter((r) => this.canCraft(r)).map((r) => r.key),
      lastCraft: this.lastCraft,
      scoreBoost: this.scoreBonusMultiplier,
      oreBoost: this.oreBoostMultiplier,
    });
    this.writeDom();
  }

  private updateSunGlare() {
    // Completely off at night/dawn/dusk: no moon or evening halo. The flare is
    // allowed only in bright daytime and only when looking almost exactly at the sun.
    if (!this.sunGlare || this.daylight < 0.88 || this.sunDir.y < 0.58 || this.weatherIntensity > 0.45) {
      if (this.sunGlare) {
        this.sunGlare.style.opacity = '0';
        this.sunGlare.style.display = 'none';
      }
      return;
    }
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const dot = forward.dot(this.sunDir);
    const t2 = Math.max(0, Math.min(1, (dot - 0.993) / 0.007));
    const glare = 0.62 * t2 * t2 * (3 - 2 * t2) * Math.min(1, (this.daylight - 0.88) / 0.12) * (1 - this.weatherIntensity);
    this.sunGlare.style.display = glare > 0.002 ? 'block' : 'none';
    this.sunGlare.style.opacity = glare.toFixed(3);
  }

  // ================= RENDER =================
  private render() {
    this.updateChunkVisibility();
    this.updateClock(0);
    this.updateSunGlare();
    const cur = this.phase === 'playing' ? (this.locked ? 'none' : 'crosshair') : 'default';
    if (this.renderer.domElement.style.cursor !== cur) this.renderer.domElement.style.cursor = cur;
    const mining = this.mining || this.touchMine;
    this.pickGroup.visible = (this.phase === 'playing' || this.phase === 'paused') && !this.thirdPerson;
    this.highlight.visible = this.highlight.visible && this.phase === 'playing';
    this.crackMesh.visible = this.crackMesh.visible && this.phase === 'playing' && mining;
    if (this.phase !== 'playing') {
      this.crackMesh.visible = false;
      this.highlight.visible = false;
    }
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.hudScene, this.hudCamera);
  }

  /* ========================= asynchronous co-op ========================= */

  /**
   * Create the ghost miners for the sessions the platform handed over. Called once per run with the
   * teammates found by `ysdk.multiplayer.sessions.init()`; extra rigs are removed, new ones appear
   * at the world spawn until their first recorded transaction arrives.
   */
  private findLocalBotSpawn(angle: number): [number, number, number] | null {
    // Search full rings rather than placing every local survival miner on the same player-relative point.
    for (let ring = 0; ring <= 20; ring++) {
      const radius = 2.5 + ring * 0.72;
      const spokes = ring === 0 ? 12 : 16;
      for (let spoke = 0; spoke < spokes; spoke++) {
        const theta = angle + (spoke / spokes) * Math.PI * 2 + ring * 0.17;
        const x = this.pos.x + Math.cos(theta) * radius;
        const z = this.pos.z + Math.sin(theta) * radius;
        const y = this.companionGroundY(x, z, this.pos.y, 4);
        if (y === null) continue;
        if (this.mobSys.collidesWithMob(x, y, z, 0.3, 0.3, 1.8, undefined, 0.45)) continue;
        const occupied = [...this.companions.values()]
          .filter((other) => !other.dead && Math.abs(other.group.position.y - y) <= 1.8)
          .map((other) => ({ x: other.group.position.x, z: other.group.position.z }));
        if (companionSpawnIsClear(x, z, occupied)) return [x, y, z];
      }
    }
    return null;
  }

  setCompanions(seeds: CompanionSeed[]) {
    const wanted = new Set(seeds.map((s) => s.id));
    for (const [id, rig] of [...this.companions]) {
      if (wanted.has(id)) continue;
      this.companionLayer.remove(rig.group);
      disposeObject(rig.group);
      this.companions.delete(id);
    }
    for (const seed of seeds) {
      if (this.companions.has(seed.id)) continue;
      const rig = buildCompanionRig(seed);
      const angle = idHue(seed.id) * Math.PI * 2;
      let spawnX = this.pos.x + Math.cos(angle) * 2.5;
      let spawnZ = this.pos.z + Math.sin(angle) * 2.5;
      let spawnY: number | null = null;
      if (rig.localBot) {
        const spawnPoint = this.findLocalBotSpawn(angle);
        if (spawnPoint) [spawnX, spawnY, spawnZ] = spawnPoint;
        else {
          // Last-resort location still gets its own ring and stays well away from the player.
          const occupied = [...this.companions.values()]
            .filter((other) => !other.dead)
            .map((other) => ({ x: other.group.position.x, z: other.group.position.z }));
          let fallbackFound = false;
          for (let attempt = 0; attempt < 160; attempt++) {
            const theta = angle + attempt * 2.399963229728653;
            const radius = 14 + Math.floor(attempt / 16) * 1.8;
            const candidateX = this.pos.x + Math.cos(theta) * radius;
            const candidateZ = this.pos.z + Math.sin(theta) * radius;
            if (!companionSpawnIsClear(candidateX, candidateZ, occupied)) continue;
            if (this.mobSys.collidesWithMob(candidateX, this.pos.y, candidateZ, 0.3, 0.3, 1.8, undefined, 0.45)) continue;
            spawnX = candidateX;
            spawnZ = candidateZ;
            spawnY = this.companionGroundY(spawnX, spawnZ, this.pos.y, 12);
            fallbackFound = true;
            break;
          }
          if (!fallbackFound) {
            // Four miners cannot exhaust this outer ring, but keep the emergency point separated too.
            const radius = 48 + this.companions.size * 2;
            const theta = angle + (this.companions.size + 1) * 2.399963229728653;
            spawnX = this.pos.x + Math.cos(theta) * radius;
            spawnZ = this.pos.z + Math.sin(theta) * radius;
            spawnY = this.companionGroundY(spawnX, spawnZ, this.pos.y, 60);
          }
        }
      }
      rig.group.position.set(spawnX, spawnY ?? this.pos.y, spawnZ);
      rig.target.copy(rig.group.position);
      this.companions.set(seed.id, rig);
      this.companionLayer.add(rig.group);
    }
  }

  /** Move a teammate to a recorded position; the rig walks there instead of teleporting. */
  moveCompanion(id: string, pose: CompanionPose) {
    const rig = this.companions.get(id);
    if (!rig || ![pose.x, pose.y, pose.z].every(Number.isFinite)) return;
    if (pose.activity && pose.activity !== rig.activity) {
      rig.activity = pose.activity;
      rig.mineTarget = null;
      rig.mineTimer = 0;
      rig.mineScanCooldown = 0;
    }
    if (rig.localBot) {
      const groundY = this.companionGroundY(pose.x, pose.z, rig.group.position.y, 3.5);
      rig.target.set(pose.x, groundY ?? rig.group.position.y, pose.z);
    } else {
      rig.target.set(pose.x, pose.y, pose.z);
    }
    if (typeof pose.yaw === 'number' && Number.isFinite(pose.yaw)) rig.yawTarget = pose.yaw;
    if (typeof pose.health === 'number') rig.setHealth(pose.health);
    if (typeof pose.blocks === 'number') rig.blocks = pose.blocks;
  }

  clearCompanions() {
    for (const rig of this.companions.values()) {
      this.companionLayer.remove(rig.group);
      disposeObject(rig.group);
    }
    this.companions.clear();
  }

  /** Everything the local player does that a replay needs to reproduce the shift. */
  playerPose(): PlayerPose {
    return { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, health: this.health, blocks: this.blocksMined };
  }

  /** Squad panel data: teammates sorted by how close they are to the player. */
  companionStatus(): CompanionStatus[] {
    const out: CompanionStatus[] = [];
    for (const [id, rig] of this.companions) {
      out.push({
        id,
        name: rig.name,
        health: rig.health,
        blocks: rig.blocks,
        distance: Math.round(rig.group.position.distanceTo(this.pos)),
        finished: rig.finished,
        dead: rig.dead,
        kind: rig.localBot ? 'bot' : 'replay',
        activity: rig.activity,
      });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  /** Mark a teammate's recorded session as over (the platform's `multiplayer-sessions-finish`). */
  finishCompanion(id: string) {
    const rig = this.companions.get(id);
    if (rig) rig.finished = true;
  }

  /** Find safe surface ground for a local companion. A bot never interpolates through terrain or hovers. */
  private companionGroundY(x: number, z: number, referenceY: number | null, maxDelta = 1.35): number | null {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    if (!this.world.hasColumn(bx, bz)) return null;
    const surfaceY = this.world.topSolidY(bx, bz);
    const surfaceBlock = this.world.get(bx, surfaceY, bz);
    if (surfaceBlock === WATER || surfaceBlock === LAVA || surfaceY <= 0) return null;
    const groundY = surfaceY + 1.001;
    if (referenceY !== null && Math.abs(groundY - referenceY) > maxDelta) return null;
    // Keep the miner's full 0.56-block-wide, two-block-tall body clear of ceilings and branches.
    const minX = Math.floor(x - 0.28);
    const maxX = Math.floor(x + 0.28);
    const minZ = Math.floor(z - 0.28);
    const maxZ = Math.floor(z + 0.28);
    for (let cy = Math.floor(groundY + 0.02); cy <= Math.floor(groundY + 1.78); cy++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (isSolid(this.world.get(cx, cy, cz))) return null;
        }
      }
    }
    return groundY;
  }

  /** Highest actual solid support in a column; non-solid foliage never becomes a fake floor. */
  private petGroundSurfaceY(x: number, z: number): number | null {
    const top = this.world.topSolidY(x, z);
    for (let y = top; y >= 0; y--) {
      const block = this.world.get(x, y, z);
      if (block === WATER || block === LAVA) return null;
      if (isSolid(block)) return y;
    }
    return null;
  }

  private petFootprintExtents(angle: number, kind: PetKind = this.wolfPetRig?.kind ?? 'wolf') {
    const halfWidth = kind === 'wolf' ? 0.43 : kind === 'cat' ? 0.34 : 0.34;
    const halfLength = kind === 'wolf' ? 1.05 : kind === 'cat' ? 0.92 : 0.84;
    const sin = Math.abs(Math.sin(angle));
    const cos = Math.abs(Math.cos(angle));
    return {
      x: cos * halfWidth + sin * halfLength,
      z: cos * halfLength + sin * halfWidth,
    };
  }

  /** Companion-sized oriented body test; allows a one-block climb but never places the mesh in terrain. */
  private wolfPetGroundY(
    x: number,
    z: number,
    referenceY: number | null,
    maxDelta = 1.35,
    yaw = this.wolfPetRig?.group.rotation.y ?? this.yaw,
    kind: PetKind = this.wolfPetRig?.kind ?? 'wolf',
  ): number | null {
    const desired = this.petFootprintExtents(yaw, kind);
    const current = this.petFootprintExtents(this.wolfPetRig?.group.rotation.y ?? yaw, kind);
    // Sweep both the current and desired headings so the long mesh can turn without clipping corners.
    const radiusX = Math.max(desired.x, current.x);
    const radiusZ = Math.max(desired.z, current.z);
    const minX = Math.floor(x - radiusX);
    const maxX = Math.floor(x + radiusX);
    const minZ = Math.floor(z - radiusZ);
    const maxZ = Math.floor(z + radiusZ);
    let surfaceY = -Infinity;
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (!this.world.hasColumn(cx, cz)) return null;
        const columnTop = this.petGroundSurfaceY(cx, cz);
        if (columnTop === null) return null;
        surfaceY = Math.max(surfaceY, columnTop);
      }
    }
    if (surfaceY <= 0) return null;
    const groundY = surfaceY + 1.001;
    if (referenceY !== null && Math.abs(groundY - referenceY) > maxDelta) return null;

    // The footprint's highest adjacent block acts as a one-block step, just like the miner's mantle.
    for (let cy = Math.floor(groundY + 0.03); cy <= Math.floor(groundY + 1.43); cy++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (!this.world.hasColumn(cx, cz) || isSolid(this.world.get(cx, cy, cz))) return null;
        }
      }
    }
    return groundY;
  }

  private petFollowGroundY(
    kind: PetKind,
    x: number,
    z: number,
    referenceY: number | null,
    yaw = this.wolfPetRig?.group.rotation.y ?? this.yaw,
    maxDelta = WOLF_PET_INTERACTION_RANGE,
  ): number | null {
    // Every ground pet (wolf, cat, monkey) walks on the same sized footsteps and climbs at most
    // one block, so they behave as a cohesive pack around the miner.
    return this.wolfPetGroundY(x, z, referenceY, maxDelta, yaw, kind);
  }

  private petStepLimits(_kind: PetKind) {
    return { rise: 1.05, drop: -2.65, groundDelta: 3.3 };
  }

  private buildPetRig(kind: PetKind): WolfPetRig {
    return kind === 'wolf'
      ? buildWolfPetRig(WOLF_COATS[this.petCoatIndices.wolf] ?? WOLF_COATS[0])
      : kind === 'cat'
        ? buildCatPetRig(this.petCoatIndices.cat)
        : kind === 'monkey'
          ? buildMonkeyPetRig(MONKEY_COATS[this.petCoatIndices.monkey] ?? MONKEY_COATS[0])
          : kind === 'parrot'
            ? buildParrotPetRig(this.petCoatIndices.parrot)
            : buildOwlPetRig(this.petCoatIndices.owl);
  }

  private createWolfPetRig(kind: PetKind) {
    const rig = this.buildPetRig(kind);
    if (isBirdCompanion(kind)) {
      const shoulderPoint = kind === 'owl' ? this.owlShoulderPoint() : this.parrotShoulderPoint();
      rig.group.position.copy(shoulderPoint);
      rig.group.rotation.y = this.yaw;
      rig.yawTarget = this.yaw;
      rig.target.copy(rig.group.position);
      rig.navWaypoint.copy(rig.group.position);
      rig.navGoal.copy(rig.group.position);
      this.wolfPetLayer.add(rig.group);
      this.wolfPetRig = rig;
      return;
    }
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const candidates: Array<[number, number]> = [[0.45, 1.85], [0.45, -1.85], [1.2, 1.7], [1.2, -1.7], [0, 2.1]];
    let spawn: [number, number, number] | null = null;
    for (const [behind, side] of candidates) {
      const x = this.pos.x - forwardX * behind + sideX * side;
      const z = this.pos.z - forwardZ * behind + sideZ * side;
      const y = kind === 'monkey'
        ? this.wolfPetGroundY(x, z, this.pos.y, WOLF_PET_INTERACTION_RANGE, this.yaw, 'monkey')
        : this.petFollowGroundY(kind, x, z, this.pos.y, this.yaw, WOLF_PET_INTERACTION_RANGE);
      if (y === null || Math.hypot(x - this.pos.x, z - this.pos.z) < 1.35) continue;
      spawn = [x, y, z];
      break;
    }
    if (!spawn) {
      for (const radius of [2.1, 2.8, 3.6, 4.5]) {
        for (let spoke = 0; spoke < 12; spoke++) {
          const angle = this.yaw + (spoke / 12) * Math.PI * 2;
          const x = this.pos.x + Math.cos(angle) * radius;
          const z = this.pos.z + Math.sin(angle) * radius;
          const y = kind === 'monkey'
            ? this.wolfPetGroundY(x, z, this.pos.y, WOLF_PET_INTERACTION_RANGE, this.yaw, 'monkey')
            : this.petFollowGroundY(kind, x, z, this.pos.y, this.yaw, WOLF_PET_INTERACTION_RANGE);
          if (y === null) continue;
          spawn = [x, y, z];
          break;
        }
        if (spawn) break;
      }
    }
    const [spawnX, spawnY, spawnZ] = spawn ?? [this.pos.x + sideX * 2.1, this.pos.y, this.pos.z + sideZ * 2.1];
    rig.group.position.set(spawnX, spawnY, spawnZ);
    rig.group.rotation.y = this.yaw;
    rig.yawTarget = this.yaw;
    rig.target.copy(rig.group.position);
    rig.navWaypoint.copy(rig.group.position);
    rig.navGoal.copy(rig.group.position);
    this.wolfPetLayer.add(rig.group);
    this.wolfPetRig = rig;
  }

  private clearWolfPetRig() {
    const rig = this.wolfPetRig;
    if (!rig) return;
    if (rig.carrying) rig.carrying.petCarried = false;
    if (rig.fetchTarget) rig.fetchTarget.petCarried = false;
    this.wolfPetLayer.remove(rig.group);
    disposeObject(rig.group);
    this.wolfPetRig = null;
  }

  private rebuildWolfPetRigForCoat() {
    const current = this.wolfPetRig;
    if (!current) return;
    const next = this.buildPetRig(current.kind);
    next.group.position.copy(current.group.position);
    next.group.rotation.copy(current.group.rotation);
    next.target.copy(current.target);
    next.navWaypoint.copy(current.navWaypoint);
    next.navGoal.copy(current.navGoal);
    next.navTimer = current.navTimer;
    next.restAnchor.copy(current.restAnchor);
    next.restYaw = current.restYaw;
    next.restAnchorValid = current.restAnchorValid;
    next.stillTimer = current.stillTimer;
    next.moveStartTimer = current.moveStartTimer;
    next.teleportRevealTimer = current.teleportRevealTimer;
    next.yawTarget = current.yawTarget;
    next.phase = current.phase;
    next.hopTimer = current.hopTimer;
    next.moving = current.moving;
    next.sitting = current.sitting;
    next.attackTimer = current.attackTimer;
    next.attackPoseTimer = current.attackPoseTimer;
    next.reaction = current.reaction;
    next.reactionTimer = current.reactionTimer;
    next.reactionAge = current.reactionAge;
    next.reactionSoundTimer = current.reactionSoundTimer;
    next.chestTarget = current.chestTarget;
    next.chestScanTimer = current.chestScanTimer;
    next.chestBlockedTimer = current.chestBlockedTimer;
    next.chestIgnoredKey = current.chestIgnoredKey;
    next.chestIgnoreUntil = current.chestIgnoreUntil;
    next.fetchTarget = current.fetchTarget;
    next.fetchBlockedDrop = current.fetchBlockedDrop;
    next.fetchBlockedTimer = current.fetchBlockedTimer;
    next.fetchNoProgressTimer = current.fetchNoProgressTimer;
    next.fetchNoPath = current.fetchNoPath;
    next.carrying = current.carrying;
    next.swimming = current.swimming;
    next.underwater = current.underwater;
    next.reactionLookTimer = current.reactionLookTimer;
    next.monkeyTreeAnchor.copy(current.monkeyTreeAnchor);
    next.monkeyTreeAnchorValid = current.monkeyTreeAnchorValid;
    next.monkeyAmmoCooldown = current.monkeyAmmoCooldown;
    next.parrotMode = current.parrotMode;
    next.parrotCalled = current.parrotCalled;
    next.parrotIdleTimer = current.parrotIdleTimer;
    next.parrotAttackTarget = current.parrotAttackTarget;
    next.parrotAttackStage = current.parrotAttackStage;
    next.parrotStageTimer = current.parrotStageTimer;
    next.parrotHappyTimer = current.parrotHappyTimer;
    next.parrotEatTimer = current.parrotEatTimer;
    next.parrotSoundTimer = current.parrotSoundTimer;
    next.parrotFollowAnchor.copy(current.parrotFollowAnchor);
    next.parrotFollowAnchorValid = current.parrotFollowAnchorValid;
    this.wolfPetLayer.remove(current.group);
    disposeObject(current.group);
    this.wolfPetLayer.add(next.group);
    this.wolfPetRig = next;
  }

  private wolfPetIsNear(radius: number): boolean {
    const rig = this.wolfPetRig;
    if (!this.petEquipped || !rig || !rig.group.visible || isBirdCompanion(rig.kind)) return false;
    return Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z) <= radius
      && Math.abs(rig.group.position.y - this.pos.y) <= 2.2;
  }

  private petInteractionAvailable(): boolean {
    const rig = this.wolfPetRig;
    if (!this.petEquipped || !rig || !rig.group.visible) return false;
    if (isBirdCompanion(rig.kind)) {
      return rig.parrotMode === 'hand' && rig.group.position.distanceTo(this.parrotHandPoint()) <= 0.72;
    }
    return this.wolfPetIsNear(WOLF_PET_INTERACTION_RANGE);
  }

  /** B whistle (and the mobile CALL button) brings an equipped bird companion onto the outstretched left hand. */
  whistleParrot(): boolean {
    const rig = this.wolfPetRig;
    if (!rig || this.phase !== 'playing' || !this.petEquipped || !isBirdCompanion(rig.kind)) {
      sfx.ui(false);
      return false;
    }
    rig.parrotCalled = true;
    rig.parrotMode = 'hand';
    rig.parrotIdleTimer = 0;
    rig.parrotAttackTarget = null;
    rig.reaction = null;
    sfx.creature(rig.kind === 'owl' ? 'owl' : 'bird', { state: 'idle', volume: 0.82, pitch: rig.kind === 'owl' ? 0.96 + Math.random() * 0.1 : 1.08 + Math.random() * 0.12 });
    this.popup(this.pos.x, this.pos.y + 2.0, this.pos.z, t(rig.kind === 'owl' ? 'petOwlWhistle' : 'petParrotWhistle'), '#f3d49a', false, { duration: 1.0 });
    this.syncHud(true);
    return true;
  }

  private interactParrot(): boolean {
    const rig = this.wolfPetRig;
    if (!rig || !isBirdCompanion(rig.kind) || !this.petInteractionAvailable()) return false;
    const seeds = this.inventory.get(WHEAT_SEEDS) ?? 0;
    const feedingSeeds = this.hotbar?.[this.selected] === WHEAT_SEEDS;
    if (seeds > 0 && feedingSeeds) {
      if (seeds > 1) this.inventory.set(WHEAT_SEEDS, seeds - 1);
      else this.inventory.delete(WHEAT_SEEDS);
      rig.parrotEatTimer = 1.0;
      rig.parrotHappyTimer = 1.1;
      rig.parrotSoundTimer = 0;
      this.popup(this.pos.x, this.pos.y + 2.0, this.pos.z, t(rig.kind === 'owl' ? 'petOwlFed' : 'petParrotFed'), '#f3d49a', false, { duration: 1.35 });
      sfx.creature(rig.kind === 'owl' ? 'owl' : 'bird', { state: 'idle', volume: 0.86, pitch: rig.kind === 'owl' ? 0.92 + Math.random() * 0.12 : 0.96 + Math.random() * 0.16 });
      this.syncHotbar(true);
    } else {
      rig.parrotHappyTimer = 0.85;
      this.popup(this.pos.x, this.pos.y + 2.0, this.pos.z, t(rig.kind === 'owl' ? 'petOwlPetted' : 'petParrotPetted'), '#f3d49a', false, { duration: 1.2 });
      sfx.creature(rig.kind === 'owl' ? 'owl' : 'bird', { state: 'idle', volume: 0.82, pitch: rig.kind === 'owl' ? 0.96 + Math.random() * 0.12 : 1.08 + Math.random() * 0.16 });
    }
    this.syncHud(true);
    return true;
  }

  private petWolf(): boolean {
    const rig = this.wolfPetRig;
    if (isBirdCompanion(rig?.kind)) return this.interactParrot();
    if (!rig || !this.wolfPetIsNear(WOLF_PET_INTERACTION_RANGE)) return false;
    if (rig.kind === 'wolf') {
      const reactions = ['wag', 'bark', 'spin'] as const;
      rig.reaction = reactions[Math.floor(Math.random() * reactions.length)];
      rig.reactionTimer = rig.reaction === 'spin' ? 1.05 : 1.45;
    } else if (rig.kind === 'cat') {
      const reactions = ['cat-purr', 'cat-meow', 'cat-circle'] as const;
      rig.reaction = reactions[Math.floor(Math.random() * reactions.length)];
      rig.reactionTimer = rig.reaction === 'cat-circle' ? 1.05 : 1.45;
    } else {
      const reactions = ['monkey-flop', 'monkey-hops', 'monkey-scratch', 'monkey-spin'] as const;
      rig.reaction = reactions[Math.floor(Math.random() * reactions.length)];
      rig.reactionTimer = rig.reaction === 'monkey-flop' ? 2.55
        : rig.reaction === 'monkey-hops' ? 2.25
          : rig.reaction === 'monkey-scratch' ? 1.45
            : 1.55;
    }
    rig.reactionAge = 0;
    rig.reactionSoundTimer = 0.48;
    rig.reactionLookTimer = rig.reaction === 'spin' || rig.reaction === 'cat-circle' || rig.reaction === 'monkey-spin' ? 0.42 : rig.reactionTimer;
    const lookX = this.pos.x - rig.group.position.x;
    const lookZ = this.pos.z - rig.group.position.z;
    if (Math.hypot(lookX, lookZ) > 0.001) rig.yawTarget = Math.atan2(-lookX, -lookZ);
    const messageByReaction: Record<Exclude<WolfPetReaction, null>, TKey> = {
      wag: 'petReactionWag',
      bark: 'petReactionBark',
      spin: 'petReactionSpin',
      'cat-purr': 'petCatReactionPurr',
      'cat-meow': 'petCatReactionMeow',
      'cat-circle': 'petCatReactionCircle',
      'monkey-flop': 'petMonkeyReactionFlop',
      'monkey-hops': 'petMonkeyReactionHops',
      'monkey-scratch': 'petMonkeyReactionScratch',
      'monkey-spin': 'petMonkeyReactionSpin',
    };
    if (rig.kind === 'monkey') {
      sfx.creature('monkey', { state: 'idle', volume: 0.86, pitch: 0.96 + Math.random() * 0.16 });
    } else if (rig.kind === 'cat') {
      sfx.creature('cat', { state: 'idle', volume: 0.82, pitch: 1.05 + Math.random() * 0.18 });
    } else {
      sfx.creature('wolf', { state: 'idle', volume: 0.8, pitch: 1 + Math.random() * 0.12 });
    }
    this.popup(this.pos.x, this.pos.y + 2.1, this.pos.z, t(messageByReaction[rig.reaction!]), '#f3d49a', false, { duration: 1.5 });
    this.syncHud(true);
    return true;
  }

  private setWolfPetFollowTarget(rig: WolfPetRig, movingPlayer: boolean): boolean {
    let forwardX = -Math.sin(this.yaw);
    let forwardZ = -Math.cos(this.yaw);
    if (movingPlayer) {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.15) {
        // Trail the miner's actual travel vector, not the camera yaw (which may be strafing or backing up).
        forwardX = this.vel.x / speed;
        forwardZ = this.vel.z / speed;
      }
    }
    const sideX = -forwardZ;
    const sideZ = forwardX;
    const targetYaw = Math.atan2(-forwardX, -forwardZ);
    const candidates: Array<[number, number]> = movingPlayer
      ? [[2.0, 0.25], [2.1, 0.65], [2.1, -0.65], [2.55, 0], [1.8, 1.05], [1.8, -1.05]]
      : [[0.45, 1.85], [0.45, -1.85], [1.1, 1.75], [1.1, -1.75], [0, 2.05]];
    for (const [behind, lateral] of candidates) {
      const x = this.pos.x - forwardX * behind + sideX * lateral;
      const z = this.pos.z - forwardZ * behind + sideZ * lateral;
      if (Math.hypot(x - this.pos.x, z - this.pos.z) < WOLF_PET_PLAYER_GAP) continue;
      const y = this.petFollowGroundY(rig.kind, x, z, this.pos.y, targetYaw, WOLF_PET_INTERACTION_RANGE);
      if (y === null) continue;
      rig.target.set(x, y, z);
      return true;
    }
    // If the preferred side is over water, in a wall, or over a ledge, choose another safe side.
    for (const radius of [2.0, 2.4, 3.0, 3.7, 4.5]) {
      for (let spoke = 0; spoke < 12; spoke++) {
        const angle = targetYaw + (spoke / 12) * Math.PI * 2;
        const x = this.pos.x + Math.cos(angle) * radius;
        const z = this.pos.z + Math.sin(angle) * radius;
        const y = this.petFollowGroundY(rig.kind, x, z, this.pos.y, targetYaw, WOLF_PET_INTERACTION_RANGE);
        if (y === null) continue;
        rig.target.set(x, y, z);
        return true;
      }
    }
    return false;
  }

  /** Reappear beside and slightly ahead of the player so a distant catch-up is visible in first person. */
  private setWolfPetTeleportTarget(rig: WolfPetRig): boolean {
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const candidates: Array<[number, number]> = [
      [1.05, 1.55], [1.05, -1.55], [1.65, 1.1], [1.65, -1.1],
      [0.25, 1.95], [0.25, -1.95], [1.95, 0.35], [1.95, -0.35],
      [0, 2.15], [0, -2.15],
    ];
    for (const [ahead, lateral] of candidates) {
      const x = this.pos.x + forwardX * ahead + sideX * lateral;
      const z = this.pos.z + forwardZ * ahead + sideZ * lateral;
      if (Math.hypot(x - this.pos.x, z - this.pos.z) < 1.5) continue;
      const facePlayerYaw = Math.atan2(-(this.pos.x - x), -(this.pos.z - z));
      const y = rig.kind === 'monkey'
        ? this.wolfPetGroundY(x, z, this.pos.y, WOLF_PET_INTERACTION_RANGE, facePlayerYaw, 'monkey')
        : this.petFollowGroundY(rig.kind, x, z, this.pos.y, facePlayerYaw, WOLF_PET_INTERACTION_RANGE);
      if (y === null) continue;
      rig.target.set(x, y, z);
      rig.yawTarget = facePlayerYaw;
      return true;
    }
    return false;
  }

  private wolfPetWaterSurfaceY(x: number, z: number, referenceY: number): number | null {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    if (!this.world.hasColumn(bx, bz)) return null;
    const top = Math.min(WY - 1, Math.floor(referenceY + 9));
    const bottom = Math.max(0, Math.floor(referenceY - 18));
    for (let y = top; y >= bottom; y--) {
      if (this.world.get(bx, y, bz) === WATER && this.world.get(bx, y + 1, bz) !== WATER) return y + 1;
    }
    return null;
  }

  /** Swimming uses a 3D body sweep; water is passable, but the wolf still never enters solid blocks. */
  private wolfPetSwimClear(x: number, y: number, z: number, yaw: number): boolean {
    const petHeight = this.wolfPetRig?.kind === 'monkey' ? 1.28 : this.wolfPetRig?.kind === 'cat' ? 1.42 : 1.55;
    if (y < 0 || y + petHeight >= WY) return false;
    const kind = this.wolfPetRig?.kind ?? 'wolf';
    const desired = this.petFootprintExtents(yaw, kind);
    const current = this.petFootprintExtents(this.wolfPetRig?.group.rotation.y ?? yaw, kind);
    const radiusX = Math.max(desired.x, current.x);
    const radiusZ = Math.max(desired.z, current.z);
    const minX = Math.floor(x - radiusX);
    const maxX = Math.floor(x + radiusX);
    const minZ = Math.floor(z - radiusZ);
    const maxZ = Math.floor(z + radiusZ);
    for (let cy = Math.floor(y + 0.02); cy <= Math.floor(y + 1.5); cy++) {
      for (let cz = minZ; cz <= maxZ; cz++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (!this.world.hasColumn(cx, cz) || isSolid(this.world.get(cx, cy, cz))) return false;
        }
      }
    }
    return true;
  }

  private wolfPetIsInWater(rig: WolfPetRig): boolean {
    const x = Math.floor(rig.group.position.x);
    const z = Math.floor(rig.group.position.z);
    if (!this.world.hasColumn(x, z)) return false;
    return [0.25, 0.62, 1.02].some((probe) => this.world.get(x, Math.floor(rig.group.position.y + probe), z) === WATER);
  }

  /** Pick a clear water-space beside the player, tracking their depth when they dive. */
  private setWolfPetSwimTarget(rig: WolfPetRig, movingPlayer: boolean, teleport = false): boolean {
    const underwater = this.headUnderwater();
    rig.swimming = true;
    rig.underwater = underwater;
    let forwardX = -Math.sin(this.yaw);
    let forwardZ = -Math.cos(this.yaw);
    if (movingPlayer) {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.15) {
        forwardX = this.vel.x / speed;
        forwardZ = this.vel.z / speed;
      }
    }
    const sideX = -forwardZ;
    const sideZ = forwardX;
    const targetYaw = Math.atan2(-forwardX, -forwardZ);
    const candidates: Array<[number, number]> = teleport
      ? [[1.05, 1.55], [1.05, -1.55], [1.65, 1.1], [1.65, -1.1], [0.25, 1.95], [0.25, -1.95], [0, 2.15], [0, -2.15]]
      : movingPlayer
        ? [[2.0, 0.25], [2.1, 0.65], [2.1, -0.65], [2.55, 0], [1.8, 1.05], [1.8, -1.05], [1.4, 1.25], [1.4, -1.25]]
        : [[0.45, 1.65], [0.45, -1.65], [1.0, 1.55], [1.0, -1.55], [0, 1.45], [0, -1.45]];
    for (const [distance, lateral] of candidates) {
      const x = teleport
        ? this.pos.x + forwardX * distance + sideX * lateral
        : this.pos.x - forwardX * distance + sideX * lateral;
      const z = teleport
        ? this.pos.z + forwardZ * distance + sideZ * lateral
        : this.pos.z - forwardZ * distance + sideZ * lateral;
      if (Math.hypot(x - this.pos.x, z - this.pos.z) < WOLF_PET_PLAYER_GAP) continue;
      const surfaceY = this.wolfPetWaterSurfaceY(x, z, this.pos.y);
      if (surfaceY === null) continue;
      const targetY = underwater ? Math.min(this.pos.y, surfaceY - 1.15) : surfaceY - 0.72;
      if (this.world.get(Math.floor(x), Math.floor(targetY + 0.3), Math.floor(z)) !== WATER) continue;
      const facePlayerYaw = teleport ? Math.atan2(-(this.pos.x - x), -(this.pos.z - z)) : targetYaw;
      if (!this.wolfPetSwimClear(x, targetY, z, facePlayerYaw)) continue;
      rig.target.set(x, targetY, z);
      rig.yawTarget = facePlayerYaw;
      return true;
    }
    return false;
  }

  private wolfPetSwimStepUpY(x: number, z: number, referenceY: number, yaw: number): number | null {
    const kind = this.wolfPetRig?.kind ?? 'wolf';
    const desired = this.petFootprintExtents(yaw, kind);
    const current = this.petFootprintExtents(this.wolfPetRig?.group.rotation.y ?? yaw, kind);
    const radiusX = Math.max(desired.x, current.x);
    const radiusZ = Math.max(desired.z, current.z);
    const minX = Math.floor(x - radiusX);
    const maxX = Math.floor(x + radiusX);
    const minZ = Math.floor(z - radiusZ);
    const maxZ = Math.floor(z + radiusZ);
    let highestGround = -Infinity;
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (!this.world.hasColumn(cx, cz)) return null;
        for (let cy = Math.min(WY - 1, Math.floor(referenceY + 1.2)); cy >= Math.max(0, Math.floor(referenceY - 1.8)); cy--) {
          if (!isSolid(this.world.get(cx, cy, cz))) continue;
          highestGround = Math.max(highestGround, cy);
          break;
        }
      }
    }
    const stepY = highestGround + 1.001;
    return stepY > referenceY + 0.04 && stepY - referenceY <= 1.05 ? stepY : null;
  }

  private moveWolfPetSwimming(rig: WolfPetRig, dt: number, speed: number) {
    rig.moving = false;
    rig.navTimer = 0;
    const pos = rig.group.position;
    const dx = rig.target.x - pos.x;
    const dy = rig.target.y - pos.y;
    const dz = rig.target.z - pos.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.12) return;
    const stride = Math.min(distance, Math.max(0, speed * dt));
    if (stride <= 0) return;
    const horizontalDistance = Math.hypot(dx, dz);
    const horizontalStride = distance > 0 ? stride * horizontalDistance / distance : 0;
    const baseAngle = Math.atan2(dz, dx);
    const stepY = distance > 0 ? dy / distance * stride : 0;
    const playerDistanceAtStart = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
    for (const turn of [0, 0.42, -0.42, 0.86, -0.86, 1.28, -1.28]) {
      const angle = baseAngle + turn;
      const stepX = Math.cos(angle) * horizontalStride;
      const stepZ = Math.sin(angle) * horizontalStride;
      const yaw = horizontalStride > 0.001 ? Math.atan2(-stepX, -stepZ) : rig.yawTarget;
      const subdivisions = Math.max(1, Math.ceil(Math.max(Math.abs(stepX), Math.abs(stepY), Math.abs(stepZ)) / 0.14));
      let clear = true;
      let endY = pos.y;
      for (let part = 1; part <= subdivisions; part++) {
        const progress = part / subdivisions;
        const x = pos.x + stepX * progress;
        const z = pos.z + stepZ * progress;
        let y = pos.y + stepY * progress;
        if (stepY > 0) y = Math.max(y, endY);
        const playerDistance = Math.hypot(x - this.pos.x, z - this.pos.z);
        if (playerDistance < WOLF_PET_PLAYER_GAP && playerDistance < playerDistanceAtStart + 0.025) {
          clear = false;
          break;
        }
        if (!this.wolfPetSwimClear(x, y, z, yaw)) {
          const stepUp = stepY > 0.001 ? this.wolfPetSwimStepUpY(x, z, endY, yaw) : null;
          if (stepUp === null || !this.wolfPetSwimClear(x, stepUp, z, yaw)) {
            clear = false;
            break;
          }
          y = stepUp;
        }
        endY = y;
      }
      if (!clear) continue;
      pos.set(pos.x + stepX, endY, pos.z + stepZ);
      if (horizontalStride > 0.001) rig.yawTarget = yaw;
      rig.moving = true;
      return;
    }
  }

  private updateWolfPetSwimFollow(rig: WolfPetRig, dt: number, movingPlayer: boolean) {
    rig.swimming = true;
    rig.underwater = this.headUnderwater();
    rig.sitting = false;
    if (movingPlayer) {
      if (rig.restAnchorValid) {
        rig.moveStartTimer += dt;
        if (rig.moveStartTimer < WOLF_PET_FOLLOW_RESUME_DELAY) {
          rig.target.copy(rig.restAnchor);
          rig.moving = false;
          return;
        }
      }
      rig.moveStartTimer = 0;
      rig.stillTimer = 0;
      rig.restAnchorValid = false;
      if (!this.setWolfPetSwimTarget(rig, true)) {
        rig.target.copy(rig.group.position);
        rig.moving = false;
        return;
      }
      this.moveWolfPetSwimming(rig, dt, 5.2);
      return;
    }

    rig.moveStartTimer = 0;
    rig.stillTimer += dt;
    if (!rig.restAnchorValid && rig.stillTimer < WOLF_PET_REST_DELAY) {
      rig.target.copy(rig.group.position);
      rig.moving = false;
      return;
    }
    if (!rig.restAnchorValid) {
      if (!this.setWolfPetSwimTarget(rig, false)) rig.target.copy(rig.group.position);
      rig.restAnchor.copy(rig.target);
      rig.restYaw = rig.yawTarget;
      rig.restAnchorValid = true;
    }
    rig.target.copy(rig.restAnchor);
    rig.yawTarget = rig.restYaw;
    this.moveWolfPetSwimming(rig, dt, 4.4);
  }

  /** If the player has reached shore first, keep paddling toward the dry follow position. */
  private updateWolfPetSwimLandFollow(rig: WolfPetRig, dt: number, movingPlayer: boolean) {
    rig.swimming = true;
    rig.underwater = false;
    rig.sitting = false;
    rig.restAnchorValid = false;
    rig.stillTimer = 0;
    rig.moveStartTimer = 0;
    if (!this.setWolfPetFollowTarget(rig, movingPlayer)) {
      rig.target.copy(rig.group.position);
      rig.moving = false;
      return;
    }
    this.moveWolfPetSwimming(rig, dt, movingPlayer ? 6.2 : 4.4);
  }

  /** A small A* surface search used when direct steering meets a wall or a blocked doorway. */
  private findWolfPetWaypoint(rig: WolfPetRig, goalX: number, goalZ: number): THREE.Vector3 | null {
    const startX = Math.floor(rig.group.position.x);
    const startZ = Math.floor(rig.group.position.z);
    const goalCellX = Math.floor(goalX);
    const goalCellZ = Math.floor(goalZ);
    const limits = this.petStepLimits(rig.kind);
    const key = (x: number, z: number) => `${x},${z}`;
    const startKey = key(startX, startZ);
    const goalKey = key(goalCellX, goalCellZ);
    if (startKey === goalKey) return null;

    type Node = { x: number; z: number; y: number; g: number; f: number };
    const heuristic = (x: number, z: number) => Math.abs(goalCellX - x) + Math.abs(goalCellZ - z);
    const start: Node = { x: startX, z: startZ, y: rig.group.position.y, g: 0, f: heuristic(startX, startZ) };
    const open: Node[] = [start];
    const bestCost = new Map<string, number>([[startKey, 0]]);
    const parents = new Map<string, string>();
    const nodes = new Map<string, Node>([[startKey, start]]);
    const closed = new Set<string>();
    let found: string | null = null;

    for (let expanded = 0; open.length > 0 && expanded < 520; expanded++) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIndex].f) bestIndex = i;
      const current = open.splice(bestIndex, 1)[0];
      const currentKey = key(current.x, current.z);
      if (closed.has(currentKey)) continue;
      if (currentKey === goalKey) {
        found = currentKey;
        break;
      }
      closed.add(currentKey);

      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = current.x + dx;
        const z = current.z + dz;
        if (Math.abs(x - startX) > 12 || Math.abs(z - startZ) > 12) continue;
        const nextKey = key(x, z);
        if (closed.has(nextKey)) continue;
        const centerX = x + 0.5;
        const centerZ = z + 0.5;
        const playerDistance = Math.hypot(centerX - this.pos.x, centerZ - this.pos.z);
        if (playerDistance < WOLF_PET_PLAYER_GAP && nextKey !== startKey) continue;
        const groundY = this.wolfPetGroundY(centerX, centerZ, current.y, limits.groundDelta, Math.atan2(-dx, -dz), rig.kind);
        if (groundY === null) continue;
        const rise = groundY - current.y;
        // Every ground pet climbs at most one block, just like the miner's mantle.
        if (rise > limits.rise || rise < limits.drop) continue;
        const cost = current.g + 1 + Math.max(0, rise) * 0.35 + Math.max(0, -rise) * 0.12;
        if (cost >= (bestCost.get(nextKey) ?? Infinity)) continue;
        const next: Node = { x, z, y: groundY, g: cost, f: cost + heuristic(x, z) };
        bestCost.set(nextKey, cost);
        parents.set(nextKey, currentKey);
        nodes.set(nextKey, next);
        open.push(next);
      }
    }

    if (!found) return null;
    let cursor = found;
    while (parents.get(cursor) !== startKey) {
      const parent = parents.get(cursor);
      if (!parent) return null;
      cursor = parent;
    }
    const first = nodes.get(cursor);
    return first ? new THREE.Vector3(first.x + 0.5, first.y, first.z + 0.5) : null;
  }

  private moveWolfPet(rig: WolfPetRig, dt: number, speed: number) {
    rig.moving = false;
    const pos = rig.group.position;
    const limits = this.petStepLimits(rig.kind);
    rig.navTimer = Math.max(0, rig.navTimer - dt);
    const navGoalShift = Math.hypot(rig.navGoal.x - rig.target.x, rig.navGoal.z - rig.target.z);
    const navDistance = Math.hypot(rig.navWaypoint.x - pos.x, rig.navWaypoint.z - pos.z);
    if (rig.navTimer > 0 && (navGoalShift > 1.15 || navDistance < 0.24)) rig.navTimer = 0;

    const tryStep = (destinationX: number, destinationZ: number): boolean => {
      const dx = destinationX - pos.x;
      const dz = destinationZ - pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) return true;
      const stride = Math.min(distance, Math.max(0, speed * dt));
      if (stride <= 0) return false;
      const angle = Math.atan2(dz, dx);
      const playerDistanceAtStart = Math.hypot(pos.x - this.pos.x, pos.z - this.pos.z);
      rig.yawTarget = Math.atan2(-dx, -dz);
      for (const turn of [0, 0.42, -0.42, 0.86, -0.86, 1.28, -1.28]) {
        const moveAngle = angle + turn;
        const stepX = Math.cos(moveAngle) * stride;
        const stepZ = Math.sin(moveAngle) * stride;
        const subdivisions = Math.max(1, Math.ceil(stride / 0.16));
        let lastGroundY = pos.y;
        let steppedUp = false;
        let clear = true;
        for (let part = 1; part <= subdivisions; part++) {
          const progress = part / subdivisions;
          const x = pos.x + stepX * progress;
          const z = pos.z + stepZ * progress;
          const playerDistance = Math.hypot(x - this.pos.x, z - this.pos.z);
          // Keep a full step of breathing room around the miner; if already too close, only allow
          // moves that increase separation so the wolf can get itself unstuck safely.
          if (playerDistance < WOLF_PET_PLAYER_GAP && playerDistance < playerDistanceAtStart + 0.025) {
            clear = false;
            break;
          }
          const stepYaw = Math.atan2(-stepX, -stepZ);
          const groundY = this.wolfPetGroundY(x, z, lastGroundY, limits.groundDelta, stepYaw, rig.kind);
          if (groundY === null) {
            clear = false;
            break;
          }
          const rise = groundY - lastGroundY;
          if (rise > limits.rise || rise < limits.drop) {
            clear = false;
            break;
          }
          if (groundY > pos.y + 0.12) steppedUp = true;
          lastGroundY = groundY;
        }
        if (!clear) continue;
        pos.set(pos.x + stepX, lastGroundY, pos.z + stepZ);
        if (steppedUp) rig.hopTimer = Math.max(rig.hopTimer, 0.28);
        rig.yawTarget = Math.atan2(-stepX, -stepZ);
        rig.moving = true;
        return true;
      }
      return false;
    };

    if (rig.navTimer > 0 && tryStep(rig.navWaypoint.x, rig.navWaypoint.z)) return;
    rig.navTimer = 0;
    if (tryStep(rig.target.x, rig.target.z)) return;

    const waypoint = this.findWolfPetWaypoint(rig, rig.target.x, rig.target.z);
    if (!waypoint) return;
    rig.navWaypoint.copy(waypoint);
    rig.navGoal.copy(rig.target);
    rig.navTimer = 1.8;
    tryStep(waypoint.x, waypoint.z);
  }

  private isWolfPetFetchDropCandidate(drop: Drop): boolean {
    if (!drop.active || drop.petCarried || drop.thrown || drop.id === LOOT_BAG || drop.id <= AIR || (drop.id >= 200 && !isArrowId(drop.id) && !isMeatItem(drop.id)) || !BLOCKS[drop.id]) return false;
    if (drop.age < (drop.pickupDelay ?? 0.22) + 0.18) return false;
    if ((drop.wolfPetIgnoreUntil ?? 0) > this.time) return false;
    const playerDistance = Math.hypot(drop.x - this.pos.x, drop.z - this.pos.z);
    const playerPickupDistance = Math.hypot(drop.x - this.pos.x, drop.y - (this.pos.y + 1.1), drop.z - this.pos.z);
    return playerDistance <= 11 && playerPickupDistance >= 1.5 && Math.abs(drop.y - this.pos.y) <= 5;
  }

  private closestWolfFetchDrop(rig: WolfPetRig): Drop | null {
    let best: Drop | null = null;
    let bestScore = Infinity;
    for (const drop of this.drops) {
      if (!this.isWolfPetFetchDropCandidate(drop)) continue;
      const playerDistance = Math.hypot(drop.x - this.pos.x, drop.z - this.pos.z);
      const petDistance = Math.hypot(drop.x - rig.group.position.x, drop.z - rig.group.position.z);
      const score = petDistance + playerDistance * 0.08;
      if (score < bestScore) {
        best = drop;
        bestScore = score;
      }
    }
    return best;
  }

  private wolfChestHasLoot(target: WolfChestTarget): boolean {
    const id = this.world.get(target.x, target.y, target.z);
    if (!isTreasureChest(id) || baseChestId(id) !== baseChestId(target.id)) return false;
    const chest = this.chestInventoryAt(target.x, target.y, target.z, id);
    return [...chest].some(([itemId, count]) => count > 0 && itemId > AIR && isInventoryBlockId(itemId) && !!BLOCKS[itemId] && !getToolSpec(itemId));
  }

  /** Find a nearby stocked chest and one clear adjacent position the wolf can reach. */
  private closestWolfChestTarget(rig: WolfPetRig): WolfChestTarget | null {
    let best: WolfChestTarget | null = null;
    let bestScore = Infinity;
    const playerX = this.pos.x;
    const playerY = this.pos.y;
    const playerZ = this.pos.z;
    const minX = Math.floor(playerX) - 10;
    const maxX = Math.floor(playerX) + 10;
    const minZ = Math.floor(playerZ) - 10;
    const maxZ = Math.floor(playerZ) + 10;
    const minY = Math.max(0, Math.floor(playerY) - 10);
    const maxY = Math.min(WY - 1, Math.floor(playerY) + 10);
    const sides: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (!this.world.hasColumn(x, z)) continue;
        for (let y = minY; y <= maxY; y++) {
          const id = this.world.get(x, y, z);
          if (!isTreasureChest(id)) continue;
          const playerDistance = Math.hypot(x + 0.5 - playerX, y + 0.5 - (playerY + 0.85), z + 0.5 - playerZ);
          if (playerDistance > 10) continue;
          const key = Engine.chestCellKey(x, y, z);
          if (key === rig.chestIgnoredKey && this.time < rig.chestIgnoreUntil) continue;
          const chestTargetBase: WolfChestTarget = { x, y, z, id, standX: 0, standY: 0, standZ: 0, swimming: false };
          if (!this.wolfChestHasLoot(chestTargetBase)) continue;

          // Underwater caches should be approached as swimming targets even if the wolf could
          // technically walk along the seabed. Ordinary land chests prefer a grounded approach.
          const submerged = isUnderwaterChest(id) || this.world.get(x, y + 1, z) === WATER;
          for (const [dx, dz] of sides) {
            for (const offset of [1.85, 2.1]) {
              const standX = x + 0.5 + dx * offset;
              const standZ = z + 0.5 + dz * offset;
              if (Math.hypot(standX - playerX, standZ - playerZ) < WOLF_PET_PLAYER_GAP + 0.2) continue;
              const faceYaw = Math.atan2(-(x + 0.5 - standX), -(z + 0.5 - standZ));
              const cellX = Math.floor(standX);
              const cellZ = Math.floor(standZ);
              if (!this.world.hasColumn(cellX, cellZ)) continue;

              if (submerged) {
                for (const standY of [y + 0.05, y - 0.45, y + 0.55, y - 0.95]) {
                  if (this.world.get(cellX, Math.floor(standY + 0.3), cellZ) !== WATER) continue;
                  if (!this.wolfPetSwimClear(standX, standY, standZ, faceYaw)) continue;
                  const score = Math.hypot(standX - rig.group.position.x, standY - rig.group.position.y, standZ - rig.group.position.z) + playerDistance * 0.08;
                  if (score < bestScore) {
                    best = { ...chestTargetBase, standX, standY, standZ, swimming: true };
                    bestScore = score;
                  }
                }
                continue;
              }

              const groundY = this.wolfPetGroundY(standX, standZ, rig.group.position.y, 10, faceYaw);
              if (groundY !== null) {
                const score = Math.hypot(standX - rig.group.position.x, groundY - rig.group.position.y, standZ - rig.group.position.z) + playerDistance * 0.08;
                if (score < bestScore) {
                  best = { ...chestTargetBase, standX, standY: groundY, standZ, swimming: false };
                  bestScore = score;
                }
                continue;
              }

              // If the dry route is blocked by shore terrain, allow a nearby water approach.
              for (const standY of [y + 0.05, y - 0.45, y + 0.55]) {
                if (this.world.get(cellX, Math.floor(standY + 0.3), cellZ) !== WATER) continue;
                if (!this.wolfPetSwimClear(standX, standY, standZ, faceYaw)) continue;
                const score = Math.hypot(standX - rig.group.position.x, standY - rig.group.position.y, standZ - rig.group.position.z) + playerDistance * 0.08;
                if (score < bestScore) {
                  best = { ...chestTargetBase, standX, standY, standZ, swimming: true };
                  bestScore = score;
                }
              }
            }
          }
        }
      }
    }
    return best;
  }

  private setWolfPetChestLid(target: WolfChestTarget, open: boolean) {
    const currentId = this.world.get(target.x, target.y, target.z);
    if (!isTreasureChest(currentId)) return;
    const active = this.activeChest;
    // Never close the lid while the player has this very chest open in their inventory.
    if (!open && active?.x === target.x && active.y === target.y && active.z === target.z) return;
    if (isOpenChest(currentId) === open) return;
    const base = baseChestId(currentId);
    this.world.set(target.x, target.y, target.z, open ? openChestId(base) : base);
    this.rebuildAt(target.x, target.z);
    this.swingChestLid(
      target.x,
      target.y,
      target.z,
      open ? 0 : CHEST_LID_OPEN_ANGLE,
      [[0, open ? 0 : CHEST_LID_OPEN_ANGLE], [1, open ? CHEST_LID_OPEN_ANGLE : 0]],
      open ? 0.42 : 0.3,
    );
    sfx.creak(open);
    if (!open && this.sandbox) this.saveWorld(true);
  }

  /** The wolf can reach into a stocked chest itself, but brings only one item per trip. */
  private updateWolfPetChest(rig: WolfPetRig, dt: number): boolean {
    rig.chestScanTimer = Math.max(0, rig.chestScanTimer - dt);
    if (rig.chestTarget) {
      const target = rig.chestTarget;
      const playerDistance = Math.hypot(target.x + 0.5 - this.pos.x, target.y + 0.5 - (this.pos.y + 0.85), target.z + 0.5 - this.pos.z);
      if (playerDistance > 10 || !this.wolfChestHasLoot(target) ||
          (Engine.chestCellKey(target.x, target.y, target.z) === rig.chestIgnoredKey && this.time < rig.chestIgnoreUntil)) {
        rig.chestTarget = null;
        rig.chestBlockedTimer = 0;
        rig.chestScanTimer = 0;
      }
    }
    if (!rig.chestTarget && rig.chestScanTimer <= 0) {
      rig.chestTarget = this.closestWolfChestTarget(rig);
      rig.chestScanTimer = 0.48;
    }
    const target = rig.chestTarget;
    if (!target) return false;

    rig.fetchTarget = null;
    rig.fetchBlockedDrop = null;
    rig.fetchBlockedTimer = 0;
    rig.fetchNoProgressTimer = 0;
    rig.fetchNoPath = false;
    rig.restAnchorValid = false;
    rig.stillTimer = 0;
    rig.moveStartTimer = 0;
    rig.sitting = false;
    rig.target.set(target.standX, target.standY, target.standZ);
    const dx = target.standX - rig.group.position.x;
    const dy = target.standY - rig.group.position.y;
    const dz = target.standZ - rig.group.position.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance <= 0.48) {
      const currentId = this.world.get(target.x, target.y, target.z);
      const chest = this.chestInventoryAt(target.x, target.y, target.z, currentId);
      const item = [...chest].find(([id, count]) => id > AIR && isInventoryBlockId(id) && count > 0 && !!BLOCKS[id] && !getToolSpec(id));
      if (!item) {
        this.setWolfPetChestLid(target, false);
        rig.chestTarget = null;
        rig.chestBlockedTimer = 0;
        rig.chestScanTimer = 0;
        return true;
      }
      this.setWolfPetChestLid(target, true);
      const [id, count] = item;
      if (count > 1) chest.set(id, count - 1);
      else chest.delete(id);
      const drop = this.spawnDrop(rig.group.position.x, rig.group.position.y + 0.7, rig.group.position.z, id, null, { count: 1, pickupDelay: 0, fromChest: true });
      drop.petCarried = true;
      rig.carrying = drop;
      rig.chestBlockedTimer = 0;
      rig.chestScanTimer = 0.5;
      rig.moving = false;
      sfx.pickup(1);
      if (this.activeChest?.x === target.x && this.activeChest.y === target.y && this.activeChest.z === target.z) this.syncHud(true);
      if (this.sandbox) this.saveWorld(true);
      return true;
    }

    rig.yawTarget = Math.atan2(-(target.x + 0.5 - rig.group.position.x), -(target.z + 0.5 - rig.group.position.z));
    if (target.swimming || this.wolfPetIsInWater(rig)) {
      rig.swimming = true;
      rig.underwater = target.swimming;
      this.moveWolfPetSwimming(rig, dt, 5.4);
    } else {
      if (rig.swimming) {
        rig.swimming = false;
        rig.underwater = false;
      }
      this.moveWolfPet(rig, dt, 5.1);
    }
    if (rig.moving) rig.chestBlockedTimer = 0;
    else rig.chestBlockedTimer += dt;
    if (rig.chestBlockedTimer >= 1.8) {
      rig.chestIgnoredKey = Engine.chestCellKey(target.x, target.y, target.z);
      rig.chestIgnoreUntil = this.time + WOLF_PET_FETCH_RETRY_SECONDS;
      rig.chestTarget = null;
      rig.chestBlockedTimer = 0;
      rig.chestScanTimer = 0;
      return false;
    }
    return true;
  }

  private nearestWolfThreat(): Mob | null {
    let best: Mob | null = null;
    let bestDistance = 9.5;
    for (const mob of this.mobSys.mobs) {
      if (!mob.alive || mob.hidden || !mob.def.hostile) continue;
      const playerDistance = Math.hypot(mob.x - this.pos.x, mob.z - this.pos.z);
      if (playerDistance >= bestDistance || Math.abs(mob.y - this.pos.y) > 5) continue;
      best = mob;
      bestDistance = playerDistance;
    }
    return best;
  }

  private updateWolfPetCombat(rig: WolfPetRig, dt: number, target: Mob) {
    const dx = target.x - rig.group.position.x;
    const dz = target.z - rig.group.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    rig.sitting = false;
    const swimming = this.inWater || this.wolfPetIsInWater(rig);
    if (swimming) {
      if (!rig.swimming) {
        rig.restAnchorValid = false;
        rig.navTimer = 0;
      }
      rig.swimming = true;
      rig.underwater = this.inWater && this.headUnderwater();
    } else if (rig.swimming) {
      rig.swimming = false;
      rig.underwater = false;
      rig.restAnchorValid = false;
      rig.navTimer = 0;
    }
    if (distance > 1.25) {
      const standX = target.x - (dx / distance) * 0.92;
      const standZ = target.z - (dz / distance) * 0.92;
      const targetYaw = Math.atan2(-dx, -dz);
      if (swimming) {
        const surfaceY = this.wolfPetWaterSurfaceY(standX, standZ, this.pos.y);
        const swimY = this.inWater && surfaceY !== null
          ? this.headUnderwater() ? Math.min(this.pos.y, surfaceY - 1.15) : surfaceY - 0.72
          : this.wolfPetGroundY(standX, standZ, rig.group.position.y, 5, targetYaw) ?? this.pos.y;
        if (this.wolfPetSwimClear(standX, swimY, standZ, targetYaw)) rig.target.set(standX, swimY, standZ);
        this.moveWolfPetSwimming(rig, dt, 7.7);
      } else {
        const groundY = this.wolfPetGroundY(standX, standZ, rig.group.position.y, 5, targetYaw);
        if (groundY !== null) rig.target.set(standX, groundY, standZ);
        this.moveWolfPet(rig, dt, 7.7);
      }
      return;
    }

    rig.target.copy(rig.group.position);
    rig.moving = false;
    rig.yawTarget = Math.atan2(-dx, -dz);
    rig.attackTimer -= dt;
    if (rig.attackTimer > 0) return;
    rig.attackTimer = 1.08;
    rig.attackPoseTimer = 0.32;
    if (rig.jaw) rig.jaw.rotation.x = -0.28;
    target.hp -= 4.2;
    target.hurtFlash = 0.18;
    this.mobSys.showHealthBar(target);
    target.vx += (target.x - rig.group.position.x) / distance * 1.7;
    target.vz += (target.z - rig.group.position.z) / distance * 1.7;
    if (target.onGround) target.vy = Math.max(target.vy, 1.6);
    this.burst(target.x, target.y + 0.42, target.z, [206, 178, 128], 4, 1.25, 0.62);
    sfx.creature(rig.kind === 'cat' ? 'cat' : 'wolf', { state: 'attack', volume: rig.kind === 'cat' ? 0.32 : 0.34, pitch: rig.kind === 'cat' ? 1.04 + Math.random() * 0.16 : 0.88 + Math.random() * 0.12 });
    if (target.hp <= 0) this.mobDied(target, false);
  }

  /**
   * The monkey fights like the cat/wolf but keeps its ranged fruit attack: it steps back when a
   * monster gets too close, keeps a comfortable throwing distance, and pelts the threat from there.
   * Movement uses the same ground-follow rules as the cat/wolf — no more tree-only perches.
   */
  private updateMonkeyPetCombat(rig: WolfPetRig, dt: number, target: Mob) {
    const dx = target.x - rig.group.position.x;
    const dz = target.z - rig.group.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    rig.sitting = false;
    const swimming = this.inWater || this.wolfPetIsInWater(rig);
    if (swimming) {
      if (!rig.swimming) {
        rig.restAnchorValid = false;
        rig.navTimer = 0;
      }
      rig.swimming = true;
      rig.underwater = this.inWater && this.headUnderwater();
    } else if (rig.swimming) {
      rig.swimming = false;
      rig.underwater = false;
      rig.restAnchorValid = false;
      rig.navTimer = 0;
    }
    const desiredRange = 4.8;
    if (distance < 2.8) {
      const retreatX = rig.group.position.x - (dx / distance) * 1.85;
      const retreatZ = rig.group.position.z - (dz / distance) * 1.85;
      const retreatYaw = Math.atan2(dx, dz);
      if (swimming) {
        const surfaceY = this.wolfPetWaterSurfaceY(retreatX, retreatZ, this.pos.y);
        const swimY = this.inWater && surfaceY !== null
          ? Math.min(this.pos.y, surfaceY - 1.15)
          : this.wolfPetGroundY(retreatX, retreatZ, rig.group.position.y, 5, retreatYaw) ?? this.pos.y;
        if (this.wolfPetSwimClear(retreatX, swimY, retreatZ, retreatYaw)) rig.target.set(retreatX, swimY, retreatZ);
        this.moveWolfPetSwimming(rig, dt, 8.9);
      } else {
        const retreatY = this.wolfPetGroundY(retreatX, retreatZ, rig.group.position.y, 5, retreatYaw);
        if (retreatY !== null) rig.target.set(retreatX, retreatY, retreatZ);
        this.moveWolfPet(rig, dt, 8.9);
      }
      return;
    }
    if (distance > 6.8 || distance < 3.9) {
      const standX = target.x - (dx / distance) * desiredRange;
      const standZ = target.z - (dz / distance) * desiredRange;
      const targetYaw = Math.atan2(-dx, -dz);
      if (swimming) {
        const surfaceY = this.wolfPetWaterSurfaceY(standX, standZ, this.pos.y);
        const swimY = this.inWater && surfaceY !== null
          ? Math.min(this.pos.y, surfaceY - 1.15)
          : this.wolfPetGroundY(standX, standZ, rig.group.position.y, 5, targetYaw) ?? this.pos.y;
        if (this.wolfPetSwimClear(standX, swimY, standZ, targetYaw)) rig.target.set(standX, swimY, standZ);
        this.moveWolfPetSwimming(rig, dt, 8.2);
      } else {
        const standY = this.wolfPetGroundY(standX, standZ, rig.group.position.y, 5, targetYaw);
        if (standY !== null) rig.target.set(standX, standY, standZ);
        this.moveWolfPet(rig, dt, 8.2);
      }
      rig.yawTarget = Math.atan2(-dx, -dz);
      return;
    }

    rig.target.copy(rig.group.position);
    rig.moving = false;
    rig.yawTarget = Math.atan2(-dx, -dz);
    rig.attackTimer -= dt;
    rig.monkeyAmmoCooldown = Math.max(0, rig.monkeyAmmoCooldown - dt);
    if (rig.attackTimer > 0 || rig.monkeyAmmoCooldown > 0) return;
    rig.attackTimer = 1.34;
    rig.monkeyAmmoCooldown = 0.22;
    rig.attackPoseTimer = 0.34;
    this.launchMonkeyProjectile(rig, target);
  }

  private updateWolfPetFetch(rig: WolfPetRig, dt: number, movingPlayer: boolean) {
    if (rig.fetchTarget && (!rig.fetchTarget.active || rig.fetchTarget.petCarried || rig.fetchTarget.thrown)) {
      rig.fetchTarget = null;
      rig.fetchBlockedDrop = null;
      rig.fetchBlockedTimer = 0;
      rig.fetchNoProgressTimer = 0;
      rig.fetchNoPath = false;
    }

    // In water, shadow the player first. If the player reaches shore before the pet, keep swimming
    // toward the dry follow point; a pending drop is retried once the wolf is back on land.
    const wolfInWater = this.wolfPetIsInWater(rig);
    if (this.inWater || wolfInWater) {
      if (!rig.swimming) {
        rig.restAnchorValid = false;
        rig.stillTimer = 0;
        rig.moveStartTimer = 0;
        rig.navTimer = 0;
      }
      rig.fetchBlockedTimer = 0;
      rig.fetchNoProgressTimer = 0;
      rig.fetchNoPath = false;
      if (this.inWater) {
        const swimmingMovement = movingPlayer || (this.headUnderwater() && Math.abs(this.vel.y) > 0.25);
        this.updateWolfPetSwimFollow(rig, dt, swimmingMovement);
      } else this.updateWolfPetSwimLandFollow(rig, dt, movingPlayer);
      return;
    }
    if (rig.swimming) {
      rig.swimming = false;
      rig.underwater = false;
      rig.restAnchorValid = false;
      rig.stillTimer = 0;
      rig.moveStartTimer = 0;
      rig.navTimer = 0;
    }

    if (!rig.fetchTarget) rig.fetchTarget = this.closestWolfFetchDrop(rig);
    if (rig.fetchTarget) {
      rig.restAnchorValid = false;
      rig.stillTimer = 0;
      rig.moveStartTimer = 0;
      const drop = rig.fetchTarget;
      if (rig.fetchBlockedDrop !== drop) {
        rig.fetchBlockedDrop = drop;
        rig.fetchBlockedTimer = 0;
        rig.fetchNoPath = false;
        rig.navTimer = 0;
      }
      rig.target.set(drop.x, drop.y, drop.z);
      const distance = Math.hypot(drop.x - rig.group.position.x, drop.z - rig.group.position.z);
      rig.sitting = false;
      if (distance <= 0.72) {
        drop.petCarried = true;
        drop.vx = drop.vy = drop.vz = 0;
        rig.carrying = drop;
        rig.fetchTarget = null;
        rig.fetchBlockedDrop = null;
        rig.fetchBlockedTimer = 0;
        rig.fetchNoProgressTimer = 0;
        rig.fetchNoPath = false;
        sfx.pickup(1);
        return;
      }

      if (!rig.fetchNoPath) this.moveWolfPet(rig, dt, 7.1);
      else rig.moving = false;
      if (rig.moving) {
        rig.fetchBlockedTimer = 0;
        rig.fetchNoProgressTimer = 0;
      } else {
        rig.fetchBlockedTimer += dt;
        if (movingPlayer) rig.fetchNoProgressTimer += dt;
        else rig.fetchNoProgressTimer = 0;
        if (!rig.fetchNoPath && rig.navTimer <= 0) rig.fetchNoPath = true;

        if (movingPlayer && rig.fetchNoProgressTimer >= WOLF_PET_FETCH_MOVING_ABANDON_SECONDS) {
          drop.wolfPetIgnoreUntil = Math.max(drop.wolfPetIgnoreUntil ?? 0, this.time + WOLF_PET_FETCH_RETRY_SECONDS);
          rig.fetchTarget = null;
          rig.fetchBlockedDrop = null;
          rig.fetchBlockedTimer = 0;
          rig.fetchNoProgressTimer = 0;
          rig.fetchNoPath = false;
        } else if (rig.fetchBlockedTimer >= WOLF_PET_FETCH_STALL_SECONDS) {
          drop.wolfPetIgnoreUntil = Math.max(drop.wolfPetIgnoreUntil ?? 0, this.time + WOLF_PET_FETCH_RETRY_SECONDS);
          rig.fetchTarget = this.closestWolfFetchDrop(rig);
          rig.fetchBlockedDrop = null;
          rig.fetchBlockedTimer = 0;
          rig.fetchNoPath = false;
          rig.navTimer = 0;
        }
      }
      if (rig.fetchTarget) return;
    }

    if (movingPlayer) {
      rig.fetchNoProgressTimer = 0;
      if (rig.restAnchorValid) {
        rig.moveStartTimer += dt;
        if (rig.moveStartTimer < WOLF_PET_FOLLOW_RESUME_DELAY) {
          rig.target.copy(rig.restAnchor);
          rig.moving = false;
          return;
        }
      }
      rig.moveStartTimer = 0;
      rig.stillTimer = 0;
      rig.restAnchorValid = false;
      rig.sitting = false;
      this.setWolfPetFollowTarget(rig, true);
      this.moveWolfPet(rig, dt, 7.8);
      return;
    }

    // Let the player finish turning/stopping before choosing a parked position. Once seated, the
    // anchor and facing stay fixed in world space until movement resumes.
    rig.moveStartTimer = 0;
    rig.fetchNoProgressTimer = 0;
    rig.stillTimer += dt;
    if (!rig.restAnchorValid && rig.stillTimer < WOLF_PET_REST_DELAY) {
      rig.target.copy(rig.group.position);
      rig.navTimer = 0;
      rig.moving = false;
      rig.sitting = false;
      return;
    }
    if (!rig.restAnchorValid) {
      if (!this.setWolfPetFollowTarget(rig, false)) rig.target.copy(rig.group.position);
      rig.restAnchor.copy(rig.target);
      rig.restYaw = this.yaw;
      rig.restAnchorValid = true;
    }
    rig.target.copy(rig.restAnchor);
    this.moveWolfPet(rig, dt, 4.9);
    const playerDistance = Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z);
    rig.sitting = !rig.moving && playerDistance < 2.35;
    if (rig.sitting) rig.yawTarget = rig.restYaw;
  }

  private updateWolfPetDelivery(rig: WolfPetRig, dt: number, movingPlayer: boolean) {
    const drop = rig.carrying;
    if (!drop || !drop.active) {
      rig.carrying = null;
      this.updateWolfPetFetch(rig, dt, movingPlayer);
      return;
    }
    const distance = Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z);
    if (distance <= 2.05) {
      rig.carrying = null;
      drop.petCarried = false;
      drop.x = this.pos.x;
      drop.y = this.pos.y + 0.8;
      drop.z = this.pos.z;
      this.collect(drop);
      if (rig.chestTarget) this.setWolfPetChestLid(rig.chestTarget, false);
      rig.chestTarget = null;
      rig.reaction = rig.kind === 'cat' ? 'cat-purr' : 'wag';
      rig.reactionTimer = 0.75;
      return;
    }
    rig.sitting = false;
    const wolfInWater = this.wolfPetIsInWater(rig);
    if (this.inWater || wolfInWater) {
      if (!rig.swimming) {
        rig.restAnchorValid = false;
        rig.navTimer = 0;
      }
      rig.swimming = true;
      rig.underwater = this.inWater && this.headUnderwater();
      const targetFound = this.inWater
        ? this.setWolfPetSwimTarget(rig, movingPlayer)
        : this.setWolfPetFollowTarget(rig, movingPlayer);
      if (targetFound) this.moveWolfPetSwimming(rig, dt, 7.8);
      else {
        rig.target.copy(rig.group.position);
        rig.moving = false;
      }
      return;
    }
    if (rig.swimming) {
      rig.swimming = false;
      rig.underwater = false;
      rig.restAnchorValid = false;
      rig.navTimer = 0;
    }
    this.setWolfPetFollowTarget(rig, false);
    this.moveWolfPet(rig, dt, 7.8);
  }

  /** A parrot uses a small swept voxel body; water is forbidden flight space, not a swimming medium. */
  private parrotFlightClear(x: number, y: number, z: number): boolean {
    const radius = 0.23;
    const height = 0.62;
    if (y < 0 || y + height >= WY) return false;
    for (let cy = Math.floor(y + 0.03); cy <= Math.floor(y + height); cy++) {
      for (let cz = Math.floor(z - radius); cz <= Math.floor(z + radius); cz++) {
        for (let cx = Math.floor(x - radius); cx <= Math.floor(x + radius); cx++) {
          if (!this.world.hasColumn(cx, cz)) return false;
          const block = this.world.get(cx, cy, cz);
          if (block === WATER || isSolid(block)) return false;
        }
      }
    }
    return true;
  }

  private parrotFlightPathClear(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const distance = from.distanceTo(to);
    const steps = Math.max(1, Math.ceil(distance / 0.14));
    for (let step = 1; step <= steps; step++) {
      const progress = step / steps;
      if (!this.parrotFlightClear(
        from.x + (to.x - from.x) * progress,
        from.y + (to.y - from.y) * progress,
        from.z + (to.z - from.z) * progress,
      )) return false;
    }
    return true;
  }

  /** The resting perch is on the character's left shoulder, outside the head silhouette. */
  private parrotShoulderPoint(): THREE.Vector3 {
    if (this.thirdPerson && this.playerAvatar && this.avatarLeftArm) {
      this.playerAvatar.updateMatrixWorld(true);
      return this.playerAvatar.localToWorld(this.avatarLeftArm.position.clone().add(new THREE.Vector3(0, 0, -0.035)));
    }
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const shoulderOffset = this.characterCustomization.gender === 'girl' ? 0.37 : 0.43;
    return new THREE.Vector3(
      this.pos.x - sideX * shoulderOffset + forwardX * 0.035,
      this.pos.y + 1.32,
      this.pos.z - sideZ * shoulderOffset + forwardZ * 0.035,
    );
  }

  /** The eagle owl perches slightly higher due to its larger body structure. */
  private owlShoulderPoint(): THREE.Vector3 {
    if (this.thirdPerson && this.playerAvatar && this.avatarLeftArm) {
      this.playerAvatar.updateMatrixWorld(true);
      return this.playerAvatar.localToWorld(this.avatarLeftArm.position.clone().add(new THREE.Vector3(0, 0.02, -0.035)));
    }
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const shoulderOffset = this.characterCustomization.gender === 'girl' ? 0.37 : 0.43;
    return new THREE.Vector3(
      this.pos.x - sideX * shoulderOffset + forwardX * 0.035,
      this.pos.y + 1.34,
      this.pos.z - sideZ * shoulderOffset + forwardZ * 0.035,
    );
  }

  /** The whistle pose extends the left arm forward; land just above the fingertips, not the torso. */
  private parrotHandPoint(): THREE.Vector3 {
    if (this.playerAvatar && this.avatarLeftArm && this.parrotHandArmBlend > 0.05) {
      this.playerAvatar.updateMatrixWorld(true);
      return this.avatarLeftArm.localToWorld(new THREE.Vector3(0, -0.77, 0)).add(new THREE.Vector3(0, 0.02, 0));
    }
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const shoulderOffset = this.characterCustomization.gender === 'girl' ? 0.37 : 0.43;
    const crouchScale = Math.max(0.78, 1 - this.crouchLerp * 0.16);
    const avatarY = this.pos.y + this.crawlLerp * 0.44;
    const bodyShift = CRAWL_BODY_CENTER * Math.max(this.crawlLerp, this.swimLerp);
    const fingertipY = 1.34 - 0.77 * Math.cos(1.45) + 0.02;
    return new THREE.Vector3(
      this.pos.x - forwardX * bodyShift - sideX * shoulderOffset + forwardX * 0.77,
      avatarY + fingertipY * crouchScale,
      this.pos.z - forwardZ * bodyShift - sideZ * shoulderOffset + forwardZ * 0.77,
    );
  }

  /** The summoned bird turns back toward the character once it lands on the left fingertips. */
  private parrotFacingPlayerYaw(point: THREE.Vector3): number {
    const dx = this.pos.x - point.x;
    const dz = this.pos.z - point.z;
    return Math.atan2(-dx, -dz);
  }

  /**
   * A small, continuously moving orbit keeps the bird visibly aloft above a swimmer instead of
   * pinning it to the player's exact X/Z. Try nearby lanes so a bank or low ledge can be skirted.
   */
  private parrotWaterHoverPoint(): THREE.Vector3 {
    const surface = this.wolfPetWaterSurfaceY(this.pos.x, this.pos.z, this.pos.y);
    const coatIndex = this.wolfPetRig?.kind === 'owl' ? this.petCoatIndices.owl : this.petCoatIndices.parrot;
    const orbitDirection = coatIndex % 2 === 0 ? 1 : -1;
    const orbit = this.time * 0.78 * orbitDirection;
    const radius = 0.58 + Math.sin(this.time * 0.63) * 0.14;
    const bob = Math.sin(this.time * 1.55) * 0.14;
    const centerY = surface === null
      ? this.pos.y + 2.45 + bob
      : Math.max(this.pos.y + 2.32, surface + 1.08) + bob;
    const offsets = [0, 0.42, -0.42, 0.82, -0.82, Math.PI];
    const heights = surface === null
      ? [centerY, centerY + 0.28, centerY - 0.22]
      : [centerY, Math.max(this.pos.y + 2.2, surface + 0.84) + bob, surface + 0.34];
    for (const angleOffset of offsets) {
      const angle = orbit + angleOffset;
      const x = this.pos.x + Math.cos(angle) * radius;
      const z = this.pos.z + Math.sin(angle) * radius;
      for (const y of heights) {
        if (this.parrotFlightClear(x, y, z)) return new THREE.Vector3(x, y, z);
      }
    }
    // A fully enclosed shoreline has no valid orbit lane; stay at the highest clear point over
    // the swimmer rather than ever dropping into water.
    for (let y = centerY + 0.25; y < Math.min(WY - 1, centerY + 5); y += 0.28) {
      if (this.parrotFlightClear(this.pos.x, y, this.pos.z)) return new THREE.Vector3(this.pos.x, y, this.pos.z);
    }
    return new THREE.Vector3(this.pos.x, centerY, this.pos.z);
  }

  /**
   * Keep a little height above the character and orbit behind them. The drifting side and bob make
   * course corrections feel like a living bird; swept steering handles blocks between waypoints.
   */
  private parrotFollowPoint(): THREE.Vector3 {
    if (this.inWater) return this.parrotWaterHoverPoint();
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const sideX = Math.cos(this.yaw);
    const sideZ = -Math.sin(this.yaw);
    const phase = this.time * 0.62;
    const behind = 1.16 + Math.cos(phase) * 0.22;
    const lateral = Math.sin(phase) * 0.66;
    const bob = Math.sin(this.time * 1.7) * 0.23 + Math.sin(this.time * 0.53) * 0.08;
    return new THREE.Vector3(
      this.pos.x - forwardX * behind + sideX * lateral,
      this.pos.y + 2.54 + bob,
      this.pos.z - forwardZ * behind + sideZ * lateral,
    );
  }

  /** A short trailing filter softens player bob, swimming jitter and changing orbit targets. */
  private parrotFollowTarget(rig: WolfPetRig, desired: THREE.Vector3, dt: number): THREE.Vector3 {
    const anchor = rig.parrotFollowAnchor;
    // Treat large world jumps as teleports; normal movement should retain a little lag.
    if (!rig.parrotFollowAnchorValid || anchor.distanceToSquared(desired) > 100) {
      anchor.copy(desired);
      rig.parrotFollowAnchorValid = true;
    } else {
      const responseSeconds = this.inWater ? 0.36 : 0.2;
      const blend = 1 - Math.exp(-Math.max(0, dt) / responseSeconds);
      anchor.lerp(desired, blend);
    }
    return anchor;
  }

  /** Low ceilings keep the parrot perched; an obstacle only at the exact target is routed around. */
  private parrotHasFlightRoom(rig: WolfPetRig, destination = this.parrotFollowPoint()): boolean {
    const baseY = Math.max(this.pos.y + 2.02, destination.y - 0.22);
    const lanes: Array<[number, number]> = [
      [0, 0], [0.48, 0], [-0.48, 0], [0, 0.48], [0, -0.48],
      [0.72, 0.38], [-0.72, 0.38], [0.72, -0.38], [-0.72, -0.38],
    ];
    const heights = [baseY, baseY + 0.3];
    const overheadAir = lanes.some(([x, z]) => heights.some((y) => this.parrotFlightClear(this.pos.x + x, y, this.pos.z + z)));
    // In water the first update moves the bird to a safe surface orbit; otherwise it must already
    // occupy clear air. Wall avoidance and vertical maneuvers happen in moveParrotFlight().
    return overheadAir && (this.inWater || this.parrotFlightClear(rig.group.position.x, rig.group.position.y, rig.group.position.z));
  }

  /** Approach the shoulder through clear air; do not lerp the pet through a wall or roof. */
  private moveParrotToShoulder(rig: WolfPetRig, dt: number, speed: number): boolean {
    const shoulder = rig.kind === 'owl' ? this.owlShoulderPoint() : this.parrotShoulderPoint();
    const distance = rig.group.position.distanceTo(shoulder);
    if (distance > 0.22 && this.parrotFlightClear(shoulder.x, shoulder.y, shoulder.z)) {
      this.moveParrotFlight(rig, shoulder, dt, speed);
    } else if (distance > 0.22) {
      rig.moving = false;
    }
    const perched = rig.group.position.distanceTo(shoulder) <= 0.3;
    rig.sitting = perched;
    if (perched) rig.moving = false;
    rig.yawTarget = this.yaw;
    return perched;
  }

  /** 3D obstacle-aware steering for the bird; it slides around a wall rather than entering it. */
  private moveParrotFlight(rig: WolfPetRig, destination: THREE.Vector3, dt: number, speed: number): boolean {
    rig.target.copy(destination);
    const pos = rig.group.position;
    const dx = destination.x - pos.x;
    const dy = destination.y - pos.y;
    const dz = destination.z - pos.z;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 0.1) {
      rig.moving = false;
      return true;
    }
    const stride = Math.min(distance, Math.max(0, speed * dt));
    const desired = new THREE.Vector3(dx / distance, dy / distance, dz / distance);
    const horizontal = Math.hypot(dx, dz);
    const side = horizontal > 0.001
      ? new THREE.Vector3(-dz / horizontal, 0, dx / horizontal)
      : new THREE.Vector3(Math.cos(rig.group.rotation.y), 0, -Math.sin(rig.group.rotation.y));
    // Stable preference per destination gives a natural left/right bank instead of always choosing
    // the same side. If the route is blocked, the extra lift/drop candidates let the parrot go over
    // low obstacles or duck under a ledge before trying a wider curve.
    const sideBias = Math.sin(destination.x * 17.13 + destination.z * 31.71 + destination.y * 4.37) >= 0 ? 1 : -1;
    const maneuvers: Array<[number, number, boolean?]> = [
      [0, 0],
      [sideBias * 0.32, 0], [-sideBias * 0.32, 0],
      [sideBias * 0.62, 0], [-sideBias * 0.62, 0],
      [sideBias * 1.25, 0], [-sideBias * 1.25, 0],
      [sideBias * 2.4, 0], [-sideBias * 2.4, 0],
      [sideBias * 4.0, 0], [-sideBias * 4.0, 0],
      [sideBias, 0, true], [-sideBias, 0, true], // near-pure sidesteps for narrow gaps
      [0, 0.52], [0, -0.36],
      [sideBias * 0.38, 0.4], [-sideBias * 0.38, 0.4],
      [sideBias * 0.38, -0.28], [-sideBias * 0.38, -0.28],
      [sideBias * 0.92, 0.55], [-sideBias * 0.92, 0.55], [sideBias * 0.92, -0.4], [-sideBias * 0.92, -0.4],
    ];
    // Shorter sweeps let it make a cautious sideways step when the wingtip is close to a wall,
    // rather than freezing at the first blocked full-stride attempt.
    for (const strideScale of [1, 0.72, 0.48, 0.28]) {
      const safeStride = stride * strideScale;
      for (const [sideStep, verticalStep, sideOnly] of maneuvers) {
        const direction = sideOnly
          ? side.clone().multiplyScalar(Math.sign(sideStep))
          : desired.clone().addScaledVector(side, sideStep);
        direction.y += verticalStep;
        direction.normalize();
        const stepX = direction.x * safeStride;
        const stepY = direction.y * safeStride;
        const stepZ = direction.z * safeStride;
        const end = new THREE.Vector3(pos.x + stepX, pos.y + stepY, pos.z + stepZ);
        if (!this.parrotFlightPathClear(pos, end)) continue;
        pos.copy(end);
        rig.moving = true;
        if (Math.hypot(stepX, stepZ) > 0.001) rig.yawTarget = Math.atan2(-stepX, -stepZ);
        return true;
      }
    }
    rig.moving = false;
    return false;
  }

  private closestParrotFetchDrop(rig: WolfPetRig): Drop | null {
    let best: Drop | null = null;
    let bestScore = Infinity;
    for (const drop of this.drops) {
      // Parrots fetch loose drops only. They never scan, open, or carry anything out of a chest.
      if (drop.fromChest || !this.isWolfPetFetchDropCandidate(drop)) continue;
      const playerDistance = Math.hypot(drop.x - this.pos.x, drop.z - this.pos.z);
      const petDistance = Math.hypot(drop.x - rig.group.position.x, drop.y - rig.group.position.y, drop.z - rig.group.position.z);
      const score = petDistance + playerDistance * 0.08;
      if (score < bestScore) {
        best = drop;
        bestScore = score;
      }
    }
    return best;
  }

  /** Add a small, randomly chosen swoop/arc before a pickup so the bird doesn't fly like a magnet. */
  private parrotFetchApproachPoint(rig: WolfPetRig, pickup: THREE.Vector3): THREE.Vector3 {
    let dx = pickup.x - rig.group.position.x;
    let dz = pickup.z - rig.group.position.z;
    let length = Math.hypot(dx, dz);
    if (length < 0.05) {
      dx = -Math.sin(this.yaw);
      dz = -Math.cos(this.yaw);
      length = 1;
    }
    const dirX = dx / length;
    const dirZ = dz / length;
    const sideX = -dirZ;
    const sideZ = dirX;
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    const sideDistance = 0.52 + Math.random() * 0.62;
    const retreat = 0.36 + Math.random() * 0.36;
    const swoop = Math.random();
    const lift = swoop < 0.28 ? 0.62 : swoop < 0.52 ? -0.22 : 0.16 + Math.random() * 0.24;
    const choices: Array<[number, number]> = [
      [sideSign, lift], [-sideSign, lift], [sideSign, 0.5], [-sideSign, 0.5],
      [sideSign, -0.1], [-sideSign, -0.1], [0, 0.58], [0, -0.18],
    ];
    for (const [side, vertical] of choices) {
      const point = new THREE.Vector3(
        pickup.x - dirX * retreat + sideX * sideDistance * side,
        pickup.y + vertical,
        pickup.z - dirZ * retreat + sideZ * sideDistance * side,
      );
      if (this.parrotFlightClear(point.x, point.y, point.z)) return point;
    }
    return pickup.clone();
  }

  private updateParrotCombat(rig: WolfPetRig, target: Mob, dt: number) {
    if (rig.parrotAttackTarget !== target) {
      rig.parrotAttackTarget = target;
      rig.parrotAttackStage = 'approach';
      rig.parrotStageTimer = 0;
    }
    rig.parrotMode = 'attack';
    rig.parrotIdleTimer = 0;
    const hover = new THREE.Vector3(target.x, target.y + 2.05, target.z);
    const dive = new THREE.Vector3(target.x, target.y + 0.62, target.z);
    if (rig.parrotAttackStage === 'approach') {
      this.moveParrotFlight(rig, hover, dt, 8.8);
      if (rig.group.position.distanceTo(hover) < 0.52) rig.parrotAttackStage = 'dive';
      return;
    }
    if (rig.parrotAttackStage === 'dive') {
      this.moveParrotFlight(rig, dive, dt, 10.5);
      if (rig.group.position.distanceTo(dive) <= 0.64) {
        const dx = target.x - rig.group.position.x;
        const dz = target.z - rig.group.position.z;
        const distance = Math.hypot(dx, dz) || 1;
        target.hp -= 2.4;
        target.hurtFlash = 0.18;
        this.mobSys.showHealthBar(target);
        target.vx += (target.x - rig.group.position.x) / distance * 1.35;
        target.vz += (target.z - rig.group.position.z) / distance * 1.35;
        if (target.onGround) target.vy = Math.max(target.vy, 1.0);
        this.burst(target.x, target.y + 0.42, target.z, [238, 194, 82], 4, 0.9, 0.5);
        sfx.creature(rig.kind === 'owl' ? 'owl' : 'bird', { state: 'attack', volume: 0.42, pitch: rig.kind === 'owl' ? 0.9 + Math.random() * 0.12 : 0.95 + Math.random() * 0.14 });
        rig.parrotAttackStage = 'soar';
        rig.parrotStageTimer = 0.62;
        rig.attackPoseTimer = 0.3;
        if (target.hp <= 0) this.mobDied(target, false);
      }
      return;
    }
    this.moveParrotFlight(rig, hover, dt, 8.4);
    rig.parrotStageTimer = Math.max(0, rig.parrotStageTimer - dt);
    if (rig.parrotStageTimer <= 0 && rig.group.position.distanceTo(hover) < 0.58) {
      rig.parrotAttackStage = 'dive';
    }
  }

  private updateParrotPet(rig: WolfPetRig, dt: number) {
    rig.swimming = false;
    rig.underwater = false;
    if (this.inWater) {
      // Water always takes priority over a pending whistle interaction: the parrot stays airborne
      // above the swimmer instead of perching on a hand or entering the water to follow a target.
      rig.parrotCalled = false;
      const hover = this.parrotWaterHoverPoint();
      if (!this.parrotFlightClear(rig.group.position.x, rig.group.position.y, rig.group.position.z)) {
        // Only make an emergency relocation if the bird is actually inside a block or water.
        // Being lower than the orbit target is handled by smooth flight, not a positional snap.
        rig.group.position.copy(hover);
        rig.parrotFollowAnchorValid = false;
        rig.group.rotation.y = this.yaw;
        rig.yawTarget = this.yaw;
      }
    }
    const playerSpeed = Math.hypot(this.vel.x, this.vel.z);
    const playerMoving = playerSpeed > 0.45 || Math.abs(this.vel.y) > 0.72;
    const sprinting = this.playerSprinting;
    if ((sprinting || playerMoving) && rig.parrotCalled) {
      rig.parrotCalled = false;
      rig.parrotMode = 'follow';
      rig.parrotIdleTimer = 0;
      rig.parrotAttackTarget = null;
    }

    if (rig.fetchTarget && (!rig.fetchTarget.active || rig.fetchTarget.petCarried || rig.fetchTarget.thrown || rig.fetchTarget.fromChest)) {
      rig.fetchTarget = null;
      rig.fetchBlockedDrop = null;
      rig.fetchBlockedTimer = 0;
    }
    const playerDistance = Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z);
    // Only the owl defends the player; the parrot is a peaceful helper and never attacks monsters.
    const threat = rig.kind === 'owl' ? this.nearestWolfThreat() : null;
    const followPoint = this.parrotFollowTarget(rig, this.parrotFollowPoint(), dt);
    const hasFlightRoom = this.parrotHasFlightRoom(rig, followPoint);

    // A called parrot catches up promptly; ordinary long-distance pet catch-up mirrors the wolf.
    if (!rig.carrying && playerDistance > 18 && (rig.parrotCalled || !threat)) {
      const catchup = rig.parrotCalled ? this.parrotHandPoint() : followPoint;
      if (this.parrotFlightClear(catchup.x, catchup.y, catchup.z)) {
        rig.group.position.copy(catchup);
        rig.group.rotation.y = this.yaw;
        rig.yawTarget = this.yaw;
        rig.navTimer = 0;
        rig.parrotIdleTimer = 0;
      }
    }

    if (threat && !rig.carrying && hasFlightRoom) {
      rig.fetchTarget = null;
      rig.fetchBlockedDrop = null;
      this.updateParrotCombat(rig, threat, dt);
    } else if (rig.carrying) {
      rig.parrotMode = 'delivery';
      rig.parrotAttackTarget = null;
      const deliveryPoint = this.parrotHandPoint();
      if (rig.navTimer !== 2 && rig.navTimer !== 3) {
        rig.navTimer = 2;
        rig.navGoal.copy(deliveryPoint);
        rig.navWaypoint.copy(this.parrotFetchApproachPoint(rig, deliveryPoint));
      } else if (rig.navTimer === 2 && rig.navGoal.distanceTo(deliveryPoint) > 1.35) {
        // If the player has moved on, smoothly re-arc toward their new position instead of chasing
        // the stale point directly through the scene.
        rig.navGoal.copy(deliveryPoint);
        rig.navWaypoint.copy(this.parrotFetchApproachPoint(rig, deliveryPoint));
      }
      if (rig.navTimer === 2 && rig.group.position.distanceTo(rig.navWaypoint) <= 0.46) rig.navTimer = 3;
      const deliveryRoutePoint = rig.navTimer === 2 ? rig.navWaypoint : deliveryPoint;
      if (this.parrotHasFlightRoom(rig, deliveryPoint)) this.moveParrotFlight(rig, deliveryRoutePoint, dt, 7.8);
      else {
        const perched = this.moveParrotToShoulder(rig, dt, 9.0);
        rig.parrotMode = perched ? 'shoulder' : 'delivery';
      }
      const closeToPlayer = Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z) <= 1.72
        && Math.abs(rig.group.position.y - (this.pos.y + 1.0)) <= 1.25;
      if (closeToPlayer && rig.carrying?.active) {
        const drop = rig.carrying;
        rig.carrying = null;
        drop.petCarried = false;
        drop.x = this.pos.x;
        drop.y = this.pos.y + 0.8;
        drop.z = this.pos.z;
        this.collect(drop);
        rig.parrotHappyTimer = 0.7;
      }
    } else if (rig.parrotCalled && !sprinting && !this.inWater && this.parrotHasFlightRoom(rig, this.parrotHandPoint())) {
      rig.parrotMode = 'hand';
      rig.parrotIdleTimer = 0;
      rig.parrotAttackTarget = null;
      const hand = this.parrotHandPoint();
      this.moveParrotFlight(rig, hand, dt, 7.0);
      rig.sitting = !rig.moving;
    } else if (hasFlightRoom) {
      rig.parrotAttackTarget = null;
      if (!rig.fetchTarget) rig.fetchTarget = this.closestParrotFetchDrop(rig);
      if (rig.fetchTarget) {
        const drop = rig.fetchTarget;
        rig.parrotMode = 'fetch';
        rig.parrotIdleTimer = 0;
        const fetchPoint = new THREE.Vector3(drop.x, drop.y + 0.18, drop.z);
        rig.fetchTarget = drop;
        if (rig.fetchBlockedDrop !== drop) {
          rig.fetchBlockedDrop = drop;
          rig.fetchBlockedTimer = 0;
          rig.navTimer = 0;
          rig.navGoal.copy(fetchPoint);
          rig.navWaypoint.copy(this.parrotFetchApproachPoint(rig, fetchPoint));
        } else rig.navGoal.copy(fetchPoint);
        if (rig.navTimer < 1 && rig.group.position.distanceTo(rig.navWaypoint) <= 0.42) rig.navTimer = 1;
        const distance = rig.group.position.distanceTo(fetchPoint);
        if (rig.navTimer >= 1 && distance <= 0.62) {
          drop.petCarried = true;
          drop.vx = drop.vy = drop.vz = 0;
          rig.carrying = drop;
          rig.fetchTarget = null;
          rig.fetchBlockedDrop = null;
          rig.fetchBlockedTimer = 0;
          rig.navTimer = 2;
          const deliveryPoint = this.parrotHandPoint();
          rig.navGoal.copy(deliveryPoint);
          rig.navWaypoint.copy(this.parrotFetchApproachPoint(rig, deliveryPoint));
          sfx.pickup(1);
          rig.moving = false;
        } else {
          const routePoint = rig.navTimer < 1 ? rig.navWaypoint : fetchPoint;
          const moved = this.moveParrotFlight(rig, routePoint, dt, 8.2);
          rig.fetchBlockedTimer = moved ? 0 : rig.fetchBlockedTimer + dt;
          if (rig.fetchBlockedTimer > 2.0) {
            drop.wolfPetIgnoreUntil = Math.max(drop.wolfPetIgnoreUntil ?? 0, this.time + WOLF_PET_FETCH_RETRY_SECONDS);
            rig.fetchTarget = null;
            rig.fetchBlockedDrop = null;
            rig.fetchBlockedTimer = 0;
            rig.navTimer = 0;
          }
        }
      } else if (this.inWater || playerMoving || sprinting) {
        rig.parrotMode = 'follow';
        rig.parrotIdleTimer = 0;
        this.moveParrotFlight(rig, followPoint, dt, this.inWater ? 7.6 : sprinting ? 8.4 : 7.4);
      } else {
        rig.parrotIdleTimer += dt;
        if (rig.parrotIdleTimer < WOLF_PET_REST_DELAY) {
          rig.parrotMode = 'follow';
          this.moveParrotFlight(rig, followPoint, dt, 5.8);
        } else {
          const perched = this.moveParrotToShoulder(rig, dt, 5.8);
          rig.parrotMode = perched ? 'shoulder' : 'follow';
        }
      }
    } else if (this.inWater) {
      rig.parrotMode = 'follow';
      rig.parrotIdleTimer = 0;
      rig.parrotAttackTarget = null;
      this.moveParrotFlight(rig, this.parrotWaterHoverPoint(), dt, 7.4);
    } else {
      // No overhead clearance: approach the shoulder through any clear route until the player
      // reaches open air; never snap through the nearby blocks.
      const perched = this.moveParrotToShoulder(rig, dt, 8.4);
      rig.parrotMode = perched ? 'shoulder' : 'follow';
      rig.parrotIdleTimer = 0;
      rig.parrotAttackTarget = null;
      rig.fetchTarget = null;
      rig.fetchBlockedDrop = null;
    }

    rig.parrotHappyTimer = Math.max(0, rig.parrotHappyTimer - dt);
    rig.parrotEatTimer = Math.max(0, rig.parrotEatTimer - dt);
    rig.parrotSoundTimer = Math.max(0, rig.parrotSoundTimer - dt);
    if (rig.parrotEatTimer > 0 && rig.parrotSoundTimer <= 0) {
      sfx.creature(rig.kind === 'owl' ? 'owl' : 'bird', { state: 'idle', volume: 0.58, pitch: rig.kind === 'owl' ? 0.95 + Math.random() * 0.1 : 1.02 + Math.random() * 0.12 });
      rig.parrotSoundTimer = 0.36;
    }

    const perched = !rig.moving && (rig.parrotMode === 'shoulder' || rig.parrotMode === 'hand');
    rig.swimming = false;
    rig.underwater = false;
    rig.phase += dt * (perched ? 2.1 : 13.5);
    rig.attackPoseTimer = Math.max(0, rig.attackPoseTimer - dt);

    const isOwl = rig.kind === 'owl';
    const diving = rig.parrotMode === 'attack' && rig.parrotAttackStage === 'dive';

    // Dynamic flight flapping rhythms: periodic bursts of energetic wingbeats
    // alternated with buoyant soaring glides. Over water or in active flight,
    // flap bursts occur regularly so the bird genuinely flies instead of statically hovering.
    const flapRate = isOwl ? 11.2 : 14.8;
    const cyclePeriod = isOwl ? 2.8 : 2.4;
    const cycleTime = (this.time + (isOwl ? 0.45 : 0)) % cyclePeriod;
    const waterHover = this.inWater;
    const activeFlapDuration = diving ? cyclePeriod : waterHover ? cyclePeriod * 0.72 : (rig.moving ? cyclePeriod * 0.62 : cyclePeriod * 0.52);

    let burstWeight = 0;
    if (cycleTime < activeFlapDuration) {
      const burstProgress = cycleTime / activeFlapDuration;
      burstWeight = Math.pow(Math.sin(burstProgress * Math.PI), 0.45);
    }

    const flapWave = Math.sin(this.time * flapRate);
    const strokeCenter = isOwl ? 0.52 : 0.56;
    const flapAmplitude = isOwl ? 0.44 : 0.40;
    const activeFlapAngle = strokeCenter + flapWave * flapAmplitude;
    const gentleGlideAngle = (isOwl ? 0.40 : 0.44) + Math.sin(this.time * 2.6) * 0.04;
    const flightWingAngle = gentleGlideAngle * (1 - burstWeight) + activeFlapAngle * burstWeight;

    const flightBob = (burstWeight * Math.sin(this.time * flapRate - 0.45) * (isOwl ? 0.042 : 0.035))
      + (1 - burstWeight) * Math.sin(this.time * 2.4) * 0.022;

    rig.model.position.y = perched
      ? Math.sin(rig.phase * 1.8) * (rig.parrotHappyTimer > 0 ? 0.045 : 0.018)
      : flightBob;

    rig.model.rotation.x = diving ? -0.55 : rig.moving ? Math.max(-0.22, Math.min(0.22, -(rig.target.y - rig.group.position.y) * 0.12)) : 0;
    if (rig.head) {
      rig.head.rotation.x = rig.parrotEatTimer > 0 ? Math.sin(this.time * 28) * 0.16 : rig.parrotHappyTimer > 0 ? Math.sin(this.time * 12) * 0.1 : 0;
      rig.head.rotation.z = rig.parrotHappyTimer > 0 ? Math.sin(this.time * 10) * 0.08 : 0;
    }
    if (rig.jaw) rig.jaw.rotation.x = rig.parrotEatTimer > 0 ? Math.abs(Math.sin(this.time * 23)) * 0.32 : 0;

    const wingPoseBlend = Math.min(1, dt * 10);
    rig.legs.forEach((wing, index) => {
      // Fold both wings down and tuck their span against the body on a perch. They open and flap
      // again only after takeoff, with periodic flap bursts and glides in active flight.
      const foldedDown = index === 0 ? 1.05 : -1.05;
      const flying = (index === 0 ? -1 : 1) * flightWingAngle;
      const targetWingAngle = perched ? foldedDown : flying;
      const targetWingSpan = perched ? 0.72 : 1;
      wing.rotation.z += (targetWingAngle - wing.rotation.z) * wingPoseBlend;
      wing.scale.x += (targetWingSpan - wing.scale.x) * wingPoseBlend;
      if (!perched) {
        wing.rotation.y = (index === 0 ? 0.08 : -0.08) * flapWave * burstWeight;
      } else {
        wing.rotation.y = 0;
      }
    });
    if (rig.tail) {
      rig.tail.rotation.y = Math.sin(rig.phase * (perched ? 3.0 : 1.8)) * (perched ? 0.09 : 0.17);
      rig.tail.rotation.x = (0.50 + (burstWeight * flapWave * 0.1)) + (diving ? -0.18 : 0);
    }

    if (rig.parrotMode === 'hand' && rig.group.position.distanceTo(this.parrotHandPoint()) < 0.9) {
      rig.yawTarget = this.parrotFacingPlayerYaw(rig.group.position);
    } else if (perched || !rig.moving) rig.yawTarget = this.yaw;
    let yawDelta = rig.yawTarget - rig.group.rotation.y;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    const bankTarget = rig.moving && !perched ? Math.max(-0.34, Math.min(0.34, -yawDelta * 0.42)) : 0;
    rig.model.rotation.z += (bankTarget - rig.model.rotation.z) * Math.min(1, dt * 5.5);
    rig.group.rotation.y += yawDelta * Math.min(1, dt * 8);
    this.syncWolfPetCarriedDrop(rig);
  }

  private syncWolfPetCarriedDrop(rig: WolfPetRig) {
    const drop = rig.carrying;
    if (!drop || !drop.active || !drop.petCarried) return;
    const forwardX = -Math.sin(rig.group.rotation.y);
    const forwardZ = -Math.cos(rig.group.rotation.y);
    const offset = isBirdCompanion(rig.kind) ? 0.18 : 0.38;
    drop.x = rig.group.position.x + forwardX * offset;
    drop.y = rig.group.position.y + (isBirdCompanion(rig.kind) ? 0.56 : 0.76);
    drop.z = rig.group.position.z + forwardZ * offset;
    drop.vx = drop.vy = drop.vz = 0;
  }

  private updateWolfPet(dt: number) {
    this.updateMonkeyProjectiles(dt);
    const rig = this.wolfPetRig;
    if (!rig) return;
    if (!this.petEquipped) {
      this.clearWolfPetRig();
      return;
    }
    if (this.phase !== 'playing') {
      rig.group.visible = this.phase === 'paused';
      return;
    }

    rig.group.visible = true;
    if (isBirdCompanion(rig.kind)) {
      this.updateParrotPet(rig, dt);
      return;
    }
    const movingPlayer = Math.hypot(this.vel.x, this.vel.z) > 0.72 || Math.abs(this.vel.y) > 0.72;
    const playerDistance = Math.hypot(rig.group.position.x - this.pos.x, rig.group.position.z - this.pos.z);
    if (!rig.carrying && playerDistance > 14) {
      const teleportTargetFound = this.inWater
        ? this.setWolfPetSwimTarget(rig, movingPlayer, true)
        : this.setWolfPetTeleportTarget(rig);
      if (teleportTargetFound) {
        if (!this.inWater) {
          rig.swimming = false;
          rig.underwater = false;
        }
        rig.group.position.copy(rig.target);
        rig.group.rotation.y = rig.yawTarget;
        rig.navTimer = 0;
        rig.restAnchor.copy(rig.target);
        rig.restYaw = rig.yawTarget;
        rig.restAnchorValid = true;
        rig.stillTimer = 0;
        rig.moveStartTimer = 0;
        rig.teleportRevealTimer = WOLF_PET_TELEPORT_REVEAL_SECONDS;
        rig.reaction = rig.kind === 'cat' ? 'cat-purr' : 'wag';
        rig.reactionTimer = WOLF_PET_TELEPORT_REVEAL_SECONDS;
      }
    }

    const threat = (rig.kind === 'wolf' || rig.kind === 'cat' || rig.kind === 'monkey') ? this.nearestWolfThreat() : null;
    if (threat && !rig.carrying) {
      rig.teleportRevealTimer = 0;
      rig.restAnchorValid = false;
      rig.moveStartTimer = 0;
      rig.fetchTarget = null;
      if (rig.kind === 'monkey') this.updateMonkeyPetCombat(rig, dt, threat);
      else this.updateWolfPetCombat(rig, dt, threat);
    } else if (rig.carrying) {
      this.updateWolfPetDelivery(rig, dt, movingPlayer);
    } else if (rig.teleportRevealTimer > 0) {
      if (this.inWater && !rig.swimming) {
        rig.restAnchorValid = false;
        rig.stillTimer = 0;
        rig.moveStartTimer = 0;
      } else if (!this.inWater && rig.swimming) {
        rig.restAnchorValid = false;
        rig.stillTimer = 0;
        rig.moveStartTimer = 0;
      }
      rig.swimming = this.inWater;
      rig.underwater = this.inWater && this.headUnderwater();
      rig.teleportRevealTimer = Math.max(0, rig.teleportRevealTimer - dt);
      rig.target.copy(rig.group.position);
      rig.moving = false;
      rig.sitting = false;
    } else if (!this.updateWolfPetChest(rig, dt)) {
      this.updateWolfPetFetch(rig, dt, movingPlayer);
    }

    if (rig.reactionTimer > 0) {
      rig.reactionAge += dt;
      rig.reactionTimer = Math.max(0, rig.reactionTimer - dt);
    }
    if (rig.reactionTimer === 0) {
      rig.reaction = null;
      rig.reactionAge = 0;
      rig.reactionLookTimer = 0;
    }
    if (rig.kind === 'monkey'
      && (rig.reaction === 'monkey-flop' || rig.reaction === 'monkey-hops' || rig.reaction === 'monkey-spin')
      && rig.reactionTimer > 0) {
      rig.reactionSoundTimer -= dt;
      if (rig.reactionSoundTimer <= 0) {
        sfx.creature('monkey', { state: 'idle', volume: 0.68, pitch: 0.94 + Math.random() * 0.18 });
        rig.reactionSoundTimer = rig.reaction === 'monkey-flop' ? 0.48 : 0.55;
      }
    }

    rig.phase += dt * (rig.moving || rig.swimming ? 8.4 : 1.7);
    rig.hopTimer = Math.max(0, rig.hopTimer - dt);
    rig.attackPoseTimer = Math.max(0, rig.attackPoseTimer - dt);
    const walking = rig.moving;
    const hop = rig.hopTimer > 0 ? Math.sin((1 - rig.hopTimer / 0.28) * Math.PI) * 0.28 : 0;
    const bob = rig.swimming ? Math.sin(rig.phase * 1.65) * 0.035 : walking ? Math.abs(Math.sin(rig.phase * 2.2)) * 0.035 : 0;
    rig.model.position.y = bob + hop;
    rig.model.rotation.x = rig.swimming
      ? rig.underwater ? Math.max(-0.28, Math.min(0.28, this.pitch * 0.24)) : 0.08
      : 0;

    if (rig.kind === 'wolf' || rig.kind === 'cat') {
      const cat = rig.kind === 'cat';
      if (rig.body) {
        rig.body.position.y = rig.sitting ? (cat ? 0.46 : 0.5) : (cat ? 0.54 : 0.58);
        rig.body.rotation.x = rig.sitting ? (cat ? 0.18 : 0.12) : 0;
      }
      if (rig.swimming) {
        const paddle = Math.sin(rig.phase * 2.5) * (cat ? 0.4 : 0.48);
        rig.legs.forEach((leg, index) => {
          leg.rotation.x = paddle * (index < 2 ? 1 : -1);
        });
      } else if (walking || !rig.sitting) {
        const swing = walking ? Math.sin(rig.phase * 2.3) * (cat ? 0.64 : 0.56) : 0;
        rig.legs.forEach((leg, index) => {
          const frontBack = index < 2 ? 1 : -1;
          leg.rotation.x = swing * frontBack;
        });
      } else {
        rig.legs.forEach((leg, index) => {
          leg.rotation.x = index < 2 ? 0 : (cat ? -0.88 : -1.02);
        });
      }
      const wagReaction = cat ? rig.reaction === 'cat-purr' : rig.reaction === 'wag';
      const vocalReaction = cat ? rig.reaction === 'cat-meow' : rig.reaction === 'bark';
      const wag = wagReaction ? (cat ? 0.52 : 0.8) : rig.sitting ? (cat ? 0.27 : 0.19) : (cat ? 0.18 : 0.08);
      if (rig.tail) {
        rig.tail.rotation.y = Math.sin(this.time * (wagReaction ? (cat ? 11 : 16) : (cat ? 5.5 : 7))) * wag;
        rig.tail.rotation.x = rig.swimming ? (cat ? -0.18 : -0.3) : wagReaction ? (cat ? -0.55 : -0.24) : (cat ? -0.35 : -0.08);
      }
      if (rig.head) rig.head.rotation.x = vocalReaction ? Math.sin(this.time * 18) * (cat ? 0.2 : 0.16) : 0;
      if (rig.jaw) rig.jaw.rotation.x = vocalReaction ? Math.abs(Math.sin(this.time * 18)) * 0.42 : 0;
    } else {
      const leftArm = rig.legs[0];
      const leftFoot = rig.legs[1];
      const rightArm = rig.legs[2];
      const rightFoot = rig.legs[3];
      rightArm.position.y = 0.51;
      leftArm.position.y = 0.51;
      rig.pose.rotation.set(0, 0, 0);
      if (rig.swimming) {
        const paddle = Math.sin(rig.phase * 2.5) * 0.52;
        leftArm.rotation.x = paddle;
        rightArm.rotation.x = -paddle;
        leftFoot.rotation.x = -paddle * 0.72;
        rightFoot.rotation.x = paddle * 0.72;
      } else if (walking) {
        const swing = Math.sin(rig.phase * 2.3) * 0.48;
        leftArm.rotation.x = -swing;
        rightArm.rotation.x = swing;
        leftFoot.rotation.x = swing;
        rightFoot.rotation.x = -swing;
        leftArm.rotation.z = rightArm.rotation.z = 0;
      } else {
        leftArm.rotation.x = rightArm.rotation.x = 0;
        leftArm.rotation.z = rightArm.rotation.z = 0;
        leftFoot.rotation.x = rightFoot.rotation.x = rig.sitting ? -0.12 : 0;
      }
      leftArm.rotation.z = rightArm.rotation.z = 0;
      if (rig.reaction === 'monkey-flop') {
        const fall = Math.min(1, rig.reactionAge / 0.24);
        rig.pose.rotation.x = fall * 1.43;
        rig.model.position.y = bob + 0.025;
        leftArm.rotation.z = Math.sin(rig.reactionAge * 18) * 1.18;
        rightArm.rotation.z = Math.sin(rig.reactionAge * 22 + 1.7) * 1.22;
        leftFoot.rotation.x = Math.sin(rig.reactionAge * 20 + 0.6) * 1.3;
        rightFoot.rotation.x = Math.sin(rig.reactionAge * 17 + 2.1) * 1.28;
      } else if (rig.reaction === 'monkey-hops') {
        const bounce = Math.abs(Math.sin(rig.reactionAge * 7.8));
        rig.model.position.y = bob + bounce * 0.36;
        rig.pose.rotation.x = Math.sin(rig.reactionAge * 7.8) * 0.08;
        leftArm.rotation.z = Math.sin(rig.reactionAge * 12) * 0.55;
        rightArm.rotation.z = -Math.sin(rig.reactionAge * 12 + 0.7) * 0.55;
        leftFoot.rotation.x = Math.sin(rig.reactionAge * 7.8 + Math.PI) * 0.38;
        rightFoot.rotation.x = -Math.sin(rig.reactionAge * 7.8 + Math.PI) * 0.38;
      } else if (rig.reaction === 'monkey-scratch') {
        const oneHop = rig.reactionAge < 0.36 ? Math.sin(Math.PI * rig.reactionAge / 0.36) : 0;
        rig.model.position.y = bob + oneHop * 0.42;
        if (rig.reactionAge > 0.3) rightArm.position.y = 0.72;
        rightArm.rotation.z = rig.reactionAge > 0.3 ? 2.72 + Math.sin(rig.reactionAge * 19) * 0.16 : 0;
        if (rig.head) rig.head.rotation.z = rig.reactionAge > 0.3 ? Math.sin(rig.reactionAge * 5.5) * 0.11 : 0;
      } else if (rig.reaction === 'monkey-spin') {
        rig.pose.rotation.z = Math.sin(rig.reactionAge * 10) * 0.04;
      }
      if (rig.attackPoseTimer > 0) {
        const jab = Math.sin((1 - rig.attackPoseTimer / 0.32) * Math.PI);
        rightArm.rotation.z = Math.max(rightArm.rotation.z, jab * 1.9);
      }
      if (rig.tail) {
        const tailWag = rig.reaction === 'wag' ? 0.58 : rig.swimming ? 0.34 : walking ? 0.22 : 0.13;
        rig.tail.rotation.y = Math.sin(this.time * (rig.reaction === 'wag' ? 15 : walking ? 6 : 2.7)) * tailWag;
        rig.tail.rotation.x = -0.2 + (rig.swimming ? -0.09 : Math.sin(this.time * 2.1) * 0.035);
      }
      if (rig.head && rig.reaction !== 'monkey-scratch') rig.head.rotation.z = 0;
    }

    if (rig.reactionLookTimer > 0) {
      rig.reactionLookTimer = Math.max(0, rig.reactionLookTimer - dt);
      const faceX = this.pos.x - rig.group.position.x;
      const faceZ = this.pos.z - rig.group.position.z;
      if (Math.hypot(faceX, faceZ) > 0.001) rig.yawTarget = Math.atan2(-faceX, -faceZ);
    }
    if ((rig.reaction === 'spin' || rig.reaction === 'cat-circle' || rig.reaction === 'monkey-spin') && rig.reactionLookTimer <= 0) {
      rig.group.rotation.y += dt * (rig.kind === 'monkey' ? 8.5 : rig.kind === 'cat' ? 9 : 7.5);
    } else {
      let dy = rig.yawTarget - rig.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      rig.group.rotation.y += dy * Math.min(1, dt * 6);
    }
    this.syncWolfPetCarriedDrop(rig);
  }

  private botMinePriority(id: number): number {
    if (isLogId(id)) return 8;
    if (id === DIAMOND_ORE || id === EMERALD_ORE || id === GOLD_ORE || id === NETHERITE_ORE) return 6;
    if (id === IRON_ORE || id === COAL_ORE || id === REDSTONE_ORE || id === LAPIS_ORE || id === QUARTZ_ORE) return 5;
    if (id === STONE || id === COBBLE || id === VOLCANIC_STONE) return 3;
    if (id === DIRT || id === GRASS || id === SAND) return 1;
    return 0;
  }

  /** Pick an exposed, reachable tree/stone/ore block instead of inventing a resource count. */
  private findLocalBotMineTarget(rig: CompanionRig): CompanionMineTarget | null {
    const bx = Math.floor(rig.group.position.x);
    const by = Math.floor(rig.group.position.y);
    const bz = Math.floor(rig.group.position.z);
    const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    let best: { target: CompanionMineTarget; score: number } | null = null;
    for (let y = Math.max(1, by - 1); y <= by + 3; y++) {
      for (let z = bz - 4; z <= bz + 4; z++) {
        for (let x = bx - 4; x <= bx + 4; x++) {
          const id = this.world.get(x, y, z);
          const priority = this.botMinePriority(id);
          if (!priority || !isBreakable(id) || !BLOCKS[id]) continue;
          const blockCenterDistance = Math.hypot(x + 0.5 - rig.group.position.x, z + 0.5 - rig.group.position.z);
          if (blockCenterDistance > 4.8) continue;
          let bestFace: CompanionMineTarget | null = null;
          let faceDistance = Infinity;
          for (const [dx, dz] of faces) {
            const sx = x + dx;
            const sz = z + dz;
            if (this.world.get(sx, y, sz) !== AIR) continue;
            if (isSolid(this.world.get(sx, y + 1, sz)) || isSolid(this.world.get(sx, y + 2, sz))) continue;
            const standX = sx + 0.5;
            const standZ = sz + 0.5;
            const standY = this.companionGroundY(standX, standZ, rig.group.position.y, 2.1);
            if (standY === null) continue;
            const d = Math.hypot(standX - rig.group.position.x, standZ - rig.group.position.z);
            if (d < faceDistance) {
              faceDistance = d;
              bestFace = { x, y, z, id, standX, standY, standZ };
            }
          }
          if (!bestFace) continue;
          const verticalPenalty = Math.abs(y + 0.5 - (rig.group.position.y + 1.05));
          const score = priority * 2.2 - faceDistance * 1.25 - verticalPenalty * 0.9;
          if (!best || score > best.score) best = { target: bestFace, score };
        }
      }
    }
    return best?.target ?? null;
  }

  private moveLocalBot(rig: CompanionRig, dt: number) {
    rig.moving = false;
    const pos = rig.group.position;
    const dx = rig.target.x - pos.x;
    const dz = rig.target.z - pos.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) return;
    const stride = Math.min(distance, (rig.activity === 'fighting' ? 2.05 : rig.activity === 'mining' ? 1.05 : 1.5) * dt);
    const angle = Math.atan2(dz, dx);
    // If a tree or a one-block ridge blocks the straight line, walk around it rather than popping through.
    for (const turn of [0, 0.48, -0.48, 0.92, -0.92, 1.38, -1.38, Math.PI]) {
      const moveAngle = angle + turn;
      const stepX = Math.cos(moveAngle) * stride;
      const stepZ = Math.sin(moveAngle) * stride;
      const nextX = pos.x + stepX;
      const nextZ = pos.z + stepZ;
      const groundY = this.companionGroundY(nextX, nextZ, pos.y, 1.28);
      if (groundY === null) continue;
      pos.set(nextX, groundY, nextZ);
      rig.yawTarget = Math.atan2(-stepX, -stepZ);
      rig.moving = true;
      return;
    }
  }

  private updateLocalBotCombat(rig: CompanionRig, dt: number) {
    let target: Mob | null = null;
    let bestDistance = 16;
    for (const mob of this.mobSys.mobs) {
      if (!mob.alive || mob.hidden || !mob.def.hostile) continue;
      const d = Math.hypot(mob.x - rig.group.position.x, mob.z - rig.group.position.z);
      if (d < bestDistance && Math.abs(mob.y - rig.group.position.y) < 5) {
        target = mob;
        bestDistance = d;
      }
    }
    if (!target) {
      rig.attackTimer = Math.min(rig.attackTimer, 0.35);
      this.moveLocalBot(rig, dt);
      return;
    }

    const dx = target.x - rig.group.position.x;
    const dz = target.z - rig.group.position.z;
    const distance = Math.hypot(dx, dz) || 1;
    rig.yawTarget = Math.atan2(-dx, -dz);
    if (distance > 1.55) {
      const standX = target.x - (dx / distance) * 1.25;
      const standZ = target.z - (dz / distance) * 1.25;
      const groundY = this.companionGroundY(standX, standZ, rig.group.position.y, 4);
      if (groundY !== null) rig.target.set(standX, groundY, standZ);
      this.moveLocalBot(rig, dt);
      return;
    }

    rig.target.copy(rig.group.position);
    rig.attackTimer -= dt;
    if (rig.attackTimer > 0) return;
    rig.attackTimer = 1.08;
    rig.swingTimer = 0.38;
    target.hp -= 2.8;
    target.hurtFlash = 0.18;
    this.mobSys.showHealthBar(target);
    target.vx += (target.x - rig.group.position.x) / distance * 1.4;
    target.vz += (target.z - rig.group.position.z) / distance * 1.4;
    if (target.hp <= 0) this.mobDied(target, false);
  }

  private mineLocalBotBlock(rig: CompanionRig, target: CompanionMineTarget) {
    if (this.world.get(target.x, target.y, target.z) !== target.id) return false;
    this.world.set(target.x, target.y, target.z, AIR);
    const extraLogs = isLogId(target.id) && isLogId(this.world.get(target.x, target.y + 1, target.z))
      ? this.fellTree(target.x, target.y, target.z)
      : 0;
    if (extraLogs === 0) {
      this.rebuildAt(target.x, target.z);
      const drop = BLOCKS[target.id]?.drop ?? 0;
      if (drop > 0) this.spawnDrop(target.x + 0.5, target.y + 0.5, target.z + 0.5, drop);
    }
    this.enqueueSupportCheck(target.x, target.y, target.z);
    this.enqueueFluid(target.x, target.y, target.z);
    this.burst(target.x + 0.5, target.y + 0.5, target.z + 0.5, BLOCKS[target.id]?.tint ?? [170, 170, 170], 7, 1.2);
    rig.blocks += 1 + extraLogs;
    rig.mineTarget = null;
    rig.mineTimer = 0;
    rig.mineScanCooldown = 0.55;
    this.syncHud(true);
    return true;
  }

  private updateLocalBot(rig: CompanionRig, dt: number) {
    rig.swingTimer = Math.max(0, rig.swingTimer - dt);
    if (rig.dead || this.phase !== 'playing') {
      rig.moving = false;
      return;
    }

    if (rig.activity === 'fighting') {
      this.updateLocalBotCombat(rig, dt);
      return;
    }

    if (rig.activity === 'mining') {
      rig.mineScanCooldown = Math.max(0, rig.mineScanCooldown - dt);
      if (rig.mineTarget && this.world.get(rig.mineTarget.x, rig.mineTarget.y, rig.mineTarget.z) !== rig.mineTarget.id) {
        rig.mineTarget = null;
        rig.mineTimer = 0;
      }
      if (!rig.mineTarget && rig.mineScanCooldown <= 0) {
        rig.mineTarget = this.findLocalBotMineTarget(rig);
        rig.mineScanCooldown = rig.mineTarget ? 0.6 : 1.1;
        if (rig.mineTarget) rig.target.set(rig.mineTarget.standX, rig.mineTarget.standY, rig.mineTarget.standZ);
      }
      if (rig.mineTarget) {
        const target = rig.mineTarget;
        const dist = Math.hypot(target.standX - rig.group.position.x, target.standZ - rig.group.position.z);
        if (dist > 0.4) {
          this.moveLocalBot(rig, dt);
          return;
        }
        rig.target.copy(rig.group.position);
        rig.yawTarget = Math.atan2(-(target.x + 0.5 - rig.group.position.x), -(target.z + 0.5 - rig.group.position.z));
        const previousPulse = Math.floor(rig.mineTimer / 0.52);
        rig.mineTimer += dt;
        if (Math.floor(rig.mineTimer / 0.52) > previousPulse) rig.swingTimer = 0.3;
        const hardness = BLOCKS[target.id]?.hardness ?? 1;
        const workSeconds = Math.max(1.3, Math.min(5.5, 1.05 + hardness * 0.72));
        if (rig.mineTimer >= workSeconds) this.mineLocalBotBlock(rig, target);
        return;
      }
    }

    this.moveLocalBot(rig, dt);
  }

  /** Melee mobs may attack only local fallback bots; replayed Yandex sessions are never live targets. */
  private localBotThreatTargets(): MobThreatTarget[] {
    const targets: MobThreatTarget[] = [];
    if (this.phase !== 'playing') return targets;
    for (const [id, rig] of this.companions) {
      if (!rig.localBot || rig.dead) continue;
      targets.push({ id, x: rig.group.position.x, y: rig.group.position.y, z: rig.group.position.z });
    }
    return targets;
  }

  private companionHit(id: string, mob: Mob, damage: number) {
    const rig = this.companions.get(id);
    if (!rig || !rig.localBot || rig.dead || this.phase !== 'playing') {
      this.mobHit(mob, damage);
      return;
    }
    const taken = Math.max(1, damage * (this.survival ? this.hostileDamageScale() : 1));
    rig.setHealth(rig.health - taken);
    rig.swingTimer = 0;
    if (rig.dead) {
      rig.activity = 'walking';
      rig.mineTarget = null;
      rig.group.rotation.z = Math.PI / 2;
      rig.group.position.y = Math.max(0, rig.group.position.y - 0.28);
      rig.target.copy(rig.group.position);
      // A nearby player is still in range of a creeper blast even when the bot drew its attention.
      if (mob.def.explodes && Math.hypot(mob.x - this.pos.x, mob.z - this.pos.z) < 3.4) this.mobHit(mob, damage);
    }
    this.syncHud(true);
  }

  private updateCompanions(dt: number) {
    if (!this.companions.size) return;
    for (const rig of this.companions.values()) {
      const before = rig.group.position.clone();
      if (rig.localBot) this.updateLocalBot(rig, dt);
      else rig.group.position.lerp(rig.target, Math.min(1, dt * 4.5));
      const moved = rig.group.position.distanceTo(before);
      rig.phase += moved * 4.2 + dt * 1.2;
      if (!rig.dead && rig.swingTimer > 0) {
        const swing = Math.sin((1 - rig.swingTimer / 0.38) * Math.PI);
        rig.rightArm.rotation.x = -1.05 * swing;
        rig.leftArm.rotation.x = 0.12 * swing;
        rig.leftLeg.rotation.x = 0;
        rig.rightLeg.rotation.x = 0;
      } else if (!rig.dead) {
        const walking = rig.moving && moved > 0.0005;
        const swing = walking ? Math.sin(rig.phase * 2.4) * 0.55 : Math.sin(rig.phase * 0.6) * 0.06;
        const legSwing = swing * (rig.girl ? GIRL_WALK_LEG_SWING_SCALE : 1);
        rig.leftLeg.rotation.x = legSwing;
        rig.rightLeg.rotation.x = -legSwing;
        rig.leftArm.rotation.x = -swing * 0.8;
        rig.rightArm.rotation.x = swing * 0.8;
      }
      let dy = rig.yawTarget - rig.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      rig.group.rotation.y += dy * Math.min(1, dt * 6);
      const dist = rig.group.position.distanceTo(this.pos);
      rig.group.visible = dist < 96;
      rig.tag.visible = dist < 48;
      rig.bar.visible = dist < 48 && rig.health < 100;
      if (!rig.group.visible) continue;
      rig.tag.position.y = 2.25;
      rig.bar.position.y = 2.02;
      rig.bob += dt;
      if (!rig.localBot) {
        rig.group.position.y = rig.target.y + (rig.moving && moved > 0.0005 ? Math.abs(Math.sin(rig.phase * 2.4)) * 0.045 : 0);
      }
      rig.moving = false;
    }
  }

  dispose() {
    this.clearArrows();
    if (this.firstPersonParrotArm) this.scene.remove(this.firstPersonParrotArm);
    this.firstPersonParrotArm = null;
    this.clearWolfPetRig();
    this.clearCompanions();
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('keyup', this.onKeyUpTv);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    const el = this.renderer?.domElement;
    this.restoreThirdPersonOccluders();
    if (el) {
      el.removeEventListener('mousedown', this.onMouseDown);
      el.removeEventListener('wheel', this.onWheel);
      el.removeEventListener('contextmenu', this.onContext);
      el.removeEventListener('mouseleave', this.onMouseLeave);
    }
    this.renderer?.dispose();
    if (el && el.parentElement) el.parentElement.removeChild(el);
    if (this.fx?.parentElement) this.fx.parentElement.removeChild(this.fx);
    if (this.popupOverlay?.parentElement) this.popupOverlay.parentElement.removeChild(this.popupOverlay);
  }
}

export { RUN_TIME };
