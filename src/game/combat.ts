import {
  ARROW_ITEM,
  GOLD_ARROW,
  IRON_ARROW,
  NETHERITE_ARROW,
  STONE_ARROW,
  blockClass,
  type BlockClass,
} from './blocks';
import { getToolSpec } from './tools';

/** Full-strength, unarmoured Java-style attack values in this game's HP units. */
export function meleeDamage(toolId: number, gearDamage = 0): number {
  const spec = getToolSpec(toolId);
  // A bow or an ordinary held item is still only a fist for melee attacks.
  const base = spec && spec.kind !== 'bow' ? spec.attackDamage : 1;
  const safeGearDamage = Number.isFinite(gearDamage) ? Math.max(0, gearDamage) : 0;
  // Equipment remains useful without allowing a damage affix to dwarf the weapon itself.
  const gearBonus = Math.min(3, safeGearDamage * 0.25);
  return base + gearBonus;
}

/** Minimum time between deliberate, fully-powered melee swings, in seconds. */
export function meleeAttackInterval(toolId: number): number {
  const spec = getToolSpec(toolId);
  if (!spec) return 0.25; // unarmed / improvised: 4 attacks per second

  switch (spec.kind) {
    case 'sword': return 0.625; // 1.6 attacks/s
    case 'axe': return spec.tier <= 1 ? 1.25 : spec.tier === 2 ? 1 / 0.9 : 1;
    case 'pickaxe': return 1 / 1.2;
    case 'shovel': return 1;
    case 'hoe': return spec.tier === 0 || spec.tier === 3 ? 1 : spec.tier === 1 ? 0.5 : spec.tier === 2 ? 1 / 3 : 0.25;
    case 'bow': return 0.25;
  }
}

const ARROW_DAMAGE_MULTIPLIER: Readonly<Record<number, number>> = {
  [ARROW_ITEM]: 1,
  [STONE_ARROW]: 1.1,
  [IRON_ARROW]: 1.2,
  [GOLD_ARROW]: 1.25,
  [NETHERITE_ARROW]: 1.35,
};

/**
 * Consistent bow hit damage. This build releases a shot on click rather than charging it,
 * so arrows use the normal fully-charged base and do not roll a surprise critical hit.
 * Elemental arrows keep their power in their status effects; material arrows add modest damage.
 */
export function bowArrowDamage(bowId: number, arrowId: number, gearDamage = 0): number {
  const spec = getToolSpec(bowId);
  const base = spec?.kind === 'bow' ? spec.bowDamage : 6;
  const safeGearDamage = Number.isFinite(gearDamage) ? Math.max(0, gearDamage) : 0;
  const gearBonus = Math.min(1.5, safeGearDamage * 0.15);
  return (base + gearBonus) * (ARROW_DAMAGE_MULTIPLIER[arrowId] ?? 1);
}

const ARROW_BREAK_CHANCE: Readonly<Record<BlockClass, number>> = {
  stone: 0.32,
  earth: 0.06,
  wood: 0.12,
  other: 0.18,
};

/** Strong impact surfaces break more arrows; soft ground and wood are comparatively forgiving. */
export function arrowBreakChance(blockId: number): number {
  return ARROW_BREAK_CHANCE[blockClass(blockId)];
}

/** Injectable random source keeps the material rule deterministic in regression tests. */
export function arrowBreaksOnBlock(blockId: number, random: () => number = Math.random): boolean {
  return random() < arrowBreakChance(blockId);
}
