import {
  COBBLE,
  DIAMOND,
  GOLD,
  IRON,
  PLANKS,
} from './blocks';

/** Material progression is shared by the inventory art, crafted models and combat. */
export type ToolKind = 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'hoe' | 'bow';
export type ToolMaterial = {
  key: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite';
  durability: number;
  speed: number;
  head: string;
  edge: string;
  accent: string;
  handle: string;
  repairResource: number | null;
  pickDamage: number;
  swordDamage: number;
  axeDamage: number;
  shovelDamage: number;
  hoeDamage: number;
  /** Projectile damage for arrows fired by this bow; melee hits still use fist damage. */
  bowDamage: number;
};

/** A zero durability limit marks the unbreakable netherite tier. */
export const TOOL_MATERIALS: readonly ToolMaterial[] = [
  {
    key: 'wood', durability: 55, speed: 1.0,
    head: '#7a472b', edge: '#b8733d', accent: '#8f542c', handle: '#5a321f',
    repairResource: PLANKS, pickDamage: 2, swordDamage: 4, axeDamage: 7, shovelDamage: 2.5, hoeDamage: 1, bowDamage: 6,
  },
  {
    key: 'stone', durability: 105, speed: 1.4,
    head: '#59636a', edge: '#aeb9c0', accent: '#c9e0dc', handle: '#65462b',
    repairResource: COBBLE, pickDamage: 3, swordDamage: 5, axeDamage: 9, shovelDamage: 3.5, hoeDamage: 1, bowDamage: 6.5,
  },
  {
    key: 'iron', durability: 230, speed: 1.9,
    head: '#8f9ca2', edge: '#e0e5dc', accent: '#f3bb7a', handle: '#5a3c25',
    repairResource: IRON, pickDamage: 4, swordDamage: 6, axeDamage: 9, shovelDamage: 4.5, hoeDamage: 1, bowDamage: 7.2,
  },
  {
    key: 'gold', durability: 42, speed: 2.25,
    head: '#a65d12', edge: '#f5c548', accent: '#fff0a0', handle: '#54351d',
    repairResource: GOLD, pickDamage: 2, swordDamage: 4, axeDamage: 7, shovelDamage: 2.5, hoeDamage: 1, bowDamage: 6.8,
  },
  {
    key: 'diamond', durability: 480, speed: 2.65,
    head: '#087e8a', edge: '#51e1d2', accent: '#c4fff3', handle: '#4b3829',
    repairResource: DIAMOND, pickDamage: 5, swordDamage: 7, axeDamage: 9, shovelDamage: 5.5, hoeDamage: 1, bowDamage: 8.4,
  },
  {
    key: 'netherite', durability: 0, speed: 3.0,
    head: '#29282d', edge: '#68515a', accent: '#ff7045', handle: '#35251f',
    repairResource: null, pickDamage: 6, swordDamage: 8, axeDamage: 10, shovelDamage: 6.5, hoeDamage: 1, bowDamage: 9,
  },
] as const;

/** Legacy IDs remain aliases so existing v1 saves keep their original meaning. */
export const TOOL_PICK = 200;
export const TOOL_SWORD = 201;
export const TOOL_TORCH = 202;
export const TOOL_AXE = 203;
export const TOOL_SHOVEL = 204;
export const TOOL_BOW = 205;
export const TOOL_HOE = 206;

// The previous four pickaxe IDs stay attached to their original materials.
export const PICK_TOOLS = [210, 211, 212, 214, 213, 215] as const;
// Existing sword IDs are preserved; the missing stone/gold/netherite variants use new IDs.
export const SWORD_TOOLS = [220, 223, 221, 224, 222, 225] as const;
export const AXE_TOOLS = [230, 231, 232, 233, 234, 235] as const;
// ID 204 was the old cobblestone shovel, so keep it at the stone tier.
export const SHOVEL_TOOLS = [240, TOOL_SHOVEL, 241, 242, 243, 244] as const;
export const HOE_TOOLS = [250, 251, 252, 253, 254, 255] as const;
// Bow ID 205 remains the first-tier bow for saves; later materials use unique IDs.
export const BOW_TOOLS = [TOOL_BOW, 260, 261, 262, 263, 264] as const;

export type ToolSpec = ToolMaterial & {
  id: number;
  kind: ToolKind;
  tier: number;
  maxDurability: number;
  attackDamage: number;
};

function makeSpec(id: number, kind: ToolKind, tier: number): ToolSpec {
  const material = TOOL_MATERIALS[tier] ?? TOOL_MATERIALS[0];
  const attackDamage =
    kind === 'pickaxe' ? material.pickDamage :
    kind === 'sword' ? material.swordDamage :
    kind === 'axe' ? material.axeDamage :
    kind === 'shovel' ? material.shovelDamage :
    kind === 'hoe' ? material.hoeDamage : 1;
  return { ...material, id, kind, tier, maxDurability: material.durability, attackDamage };
}

function tierForId(ids: readonly number[], id: number) {
  return ids.indexOf(id);
}

/** Return material, weapon class and stats for any durable tool/weapon ID. */
export function getToolSpec(id: number): ToolSpec | null {
  // Bow IDs are fixed ranges; avoid a six-element scan on the hot path used by mining/render updates.
  const bowTier = id === TOOL_BOW ? 0 : id >= BOW_TOOLS[1] && id <= BOW_TOOLS[BOW_TOOLS.length - 1] ? id - BOW_TOOLS[1] + 1 : -1;
  if (bowTier >= 0) return makeSpec(id, 'bow', bowTier);

  let tier = tierForId(PICK_TOOLS, id);
  if (id === TOOL_PICK) tier = 0;
  if (tier >= 0) return makeSpec(id, 'pickaxe', tier);

  tier = tierForId(SWORD_TOOLS, id);
  if (id === TOOL_SWORD) tier = 0;
  if (tier >= 0) return makeSpec(id, 'sword', tier);

  tier = tierForId(AXE_TOOLS, id);
  if (id === TOOL_AXE) tier = 1; // the legacy generic axe used the stone tier
  if (tier >= 0) return makeSpec(id, 'axe', tier);

  tier = tierForId(SHOVEL_TOOLS, id);
  if (tier >= 0) return makeSpec(id, 'shovel', tier);

  tier = tierForId(HOE_TOOLS, id);
  if (id === TOOL_HOE) tier = 0;
  if (tier >= 0) return makeSpec(id, 'hoe', tier);

  return null;
}

export const isPickTool = (id: number) => id === TOOL_PICK || PICK_TOOLS.includes(id as (typeof PICK_TOOLS)[number]);
export const isSwordTool = (id: number) => id === TOOL_SWORD || SWORD_TOOLS.includes(id as (typeof SWORD_TOOLS)[number]);
export const isAxeTool = (id: number) => id === TOOL_AXE || AXE_TOOLS.includes(id as (typeof AXE_TOOLS)[number]);
export const isShovelTool = (id: number) => SHOVEL_TOOLS.includes(id as (typeof SHOVEL_TOOLS)[number]);
export const isHoeTool = (id: number) => id === TOOL_HOE || HOE_TOOLS.includes(id as (typeof HOE_TOOLS)[number]);
export const isBowTool = (id: number) => BOW_TOOLS.includes(id as (typeof BOW_TOOLS)[number]);
export const isDurabilityTool = (id: number) => getToolSpec(id) !== null;

export function toolIdFor(kind: Exclude<ToolKind, 'bow'>, tier: number): number {
  const ids = kind === 'pickaxe' ? PICK_TOOLS : kind === 'sword' ? SWORD_TOOLS : kind === 'axe' ? AXE_TOOLS : kind === 'shovel' ? SHOVEL_TOOLS : HOE_TOOLS;
  return ids[Math.max(0, Math.min(ids.length - 1, tier))];
}

/** Continuous normalized wear used to deform held and dropped 3D models. */
export function toolWearRatio(current: number, max: number): number {
  if (max <= 0) return 0;
  const safeCurrent = Number.isFinite(current) ? current : max;
  return 1 - Math.max(0, Math.min(1, safeCurrent / max));
}

/** Condition stage used by compact pixel-art icons. */
export function toolWearStage(current: number, max: number): number {
  const ratio = 1 - toolWearRatio(current, max);
  if (ratio > 0.72) return 0;
  if (ratio > 0.44) return 1;
  if (ratio > 0.2) return 2;
  return 3;
}

export function toolRepairCost(id: number, current: number): number {
  const spec = getToolSpec(id);
  if (!spec || spec.maxDurability <= 0 || !spec.repairResource) return 0;
  const missing = Math.max(0, spec.maxDurability - Math.min(spec.maxDurability, current));
  return missing <= 0 ? 0 : Math.max(1, Math.ceil((missing / spec.maxDurability) * 4));
}

export function normalizeToolDurability(id: number, value: unknown): number {
  const spec = getToolSpec(id);
  if (!spec || spec.maxDurability <= 0) return 0;
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : spec.maxDurability;
  return Math.max(0, Math.min(spec.maxDurability, n));
}
