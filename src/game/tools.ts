import {
  COBBLE,
  DIAMOND,
  GOLD,
  IRON,
  PLANKS,
} from './blocks';

/** Material progression is shared by the inventory art, crafted models and combat. */
export type ToolKind = 'pickaxe' | 'sword' | 'axe' | 'shovel' | 'bow';
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
};

/** A zero durability limit marks the unbreakable netherite tier. */
export const TOOL_MATERIALS: readonly ToolMaterial[] = [
  {
    key: 'wood', durability: 48, speed: 1.0,
    head: '#75452e', edge: '#c28b4f', accent: '#f0c56c', handle: '#53331f',
    repairResource: PLANKS, pickDamage: 4, swordDamage: 9, axeDamage: 7, shovelDamage: 4,
  },
  {
    key: 'stone', durability: 96, speed: 1.7,
    head: '#59636a', edge: '#aeb9c0', accent: '#c9e0dc', handle: '#65462b',
    repairResource: COBBLE, pickDamage: 5, swordDamage: 13, axeDamage: 11, shovelDamage: 5,
  },
  {
    key: 'iron', durability: 250, speed: 2.6,
    head: '#8f9ca2', edge: '#e0e5dc', accent: '#f3bb7a', handle: '#5a3c25',
    repairResource: IRON, pickDamage: 7, swordDamage: 19, axeDamage: 16, shovelDamage: 6,
  },
  {
    key: 'gold', durability: 38, speed: 3.3,
    head: '#a65d12', edge: '#f5c548', accent: '#fff0a0', handle: '#54351d',
    repairResource: GOLD, pickDamage: 6, swordDamage: 14, axeDamage: 12, shovelDamage: 5,
  },
  {
    key: 'diamond', durability: 1561, speed: 4.0,
    head: '#087e8a', edge: '#51e1d2', accent: '#c4fff3', handle: '#4b3829',
    repairResource: DIAMOND, pickDamage: 10, swordDamage: 29, axeDamage: 24, shovelDamage: 8,
  },
  {
    key: 'netherite', durability: 0, speed: 4.8,
    head: '#29282d', edge: '#68515a', accent: '#ff7045', handle: '#35251f',
    repairResource: null, pickDamage: 12, swordDamage: 36, axeDamage: 30, shovelDamage: 10,
  },
] as const;

/** Legacy IDs remain aliases so existing v1 saves keep their original meaning. */
export const TOOL_PICK = 200;
export const TOOL_SWORD = 201;
export const TOOL_TORCH = 202;
export const TOOL_AXE = 203;
export const TOOL_SHOVEL = 204;
export const TOOL_BOW = 205;

// The previous four pickaxe IDs stay attached to their original materials.
export const PICK_TOOLS = [210, 211, 212, 214, 213, 215] as const;
// Existing sword IDs are preserved; the missing stone/gold/netherite variants use new IDs.
export const SWORD_TOOLS = [220, 223, 221, 224, 222, 225] as const;
export const AXE_TOOLS = [230, 231, 232, 233, 234, 235] as const;
// ID 204 was the old cobblestone shovel, so keep it at the stone tier.
export const SHOVEL_TOOLS = [240, TOOL_SHOVEL, 241, 242, 243, 244] as const;

export type ToolSpec = ToolMaterial & {
  id: number;
  kind: ToolKind;
  tier: number;
  maxDurability: number;
  attackDamage: number;
};

function makeSpec(id: number, kind: Exclude<ToolKind, 'bow'>, tier: number): ToolSpec {
  const material = TOOL_MATERIALS[tier] ?? TOOL_MATERIALS[0];
  const attackDamage =
    kind === 'pickaxe' ? material.pickDamage :
    kind === 'sword' ? material.swordDamage :
    kind === 'axe' ? material.axeDamage : material.shovelDamage;
  return { ...material, id, kind, tier, maxDurability: material.durability, attackDamage };
}

function tierForId(ids: readonly number[], id: number) {
  return ids.indexOf(id);
}

/** Return material, weapon class and stats for any durable tool/weapon ID. */
export function getToolSpec(id: number): ToolSpec | null {
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

  if (id === TOOL_BOW) {
    const wood = TOOL_MATERIALS[0];
    return { ...wood, id, kind: 'bow', tier: 0, maxDurability: 384, durability: 384, attackDamage: 0 };
  }
  return null;
}

export const isPickTool = (id: number) => id === TOOL_PICK || PICK_TOOLS.includes(id as (typeof PICK_TOOLS)[number]);
export const isSwordTool = (id: number) => id === TOOL_SWORD || SWORD_TOOLS.includes(id as (typeof SWORD_TOOLS)[number]);
export const isAxeTool = (id: number) => id === TOOL_AXE || AXE_TOOLS.includes(id as (typeof AXE_TOOLS)[number]);
export const isShovelTool = (id: number) => SHOVEL_TOOLS.includes(id as (typeof SHOVEL_TOOLS)[number]);
export const isDurabilityTool = (id: number) => getToolSpec(id) !== null;

export function toolIdFor(kind: Exclude<ToolKind, 'bow'>, tier: number): number {
  const ids = kind === 'pickaxe' ? PICK_TOOLS : kind === 'sword' ? SWORD_TOOLS : kind === 'axe' ? AXE_TOOLS : SHOVEL_TOOLS;
  return ids[Math.max(0, Math.min(ids.length - 1, tier))];
}

/** Condition stage used by both pixel art and the 3D mesh. */
export function toolWearStage(current: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, current / max));
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
