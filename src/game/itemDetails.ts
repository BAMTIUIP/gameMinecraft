import {
  ARROW_ITEM,
  BLOCKS,
  REWARD_PACK_DAILY,
  REWARD_PACK_MONTHLY,
  REWARD_PACK_WEEKLY,
  isArrowId,
  isCookedMeatItem,
  isMeatItem,
  isRawMeatItem,
} from './blocks';
import { bowArrowDamage, meleeAttackInterval, meleeDamage } from './combat';
import { foodHeal } from './food';
import { blockName, matName, rarName, recipeText, t, toolLabelForId, type TKey } from './i18n';
import { AFFIXES, gearColor, MATERIALS, RARITY, SLOT_KEY, type Item } from './items';
import { getItemInvCategory, HAND, RECIPES, TOOL_TORCH } from './recipes';
import { getToolSpec, TOOL_BOW } from './tools';
import type { PetKind } from './pets';

export type ItemDetailStat = { label: string; value: string; color?: string };
export type ItemDetails = { name: string; description: string; color: string; stats: ItemDetailStat[] };
export type ItemDetailContext = {
  count?: number;
  durability?: number;
  maxDurability?: number;
  damage?: number;
  swift?: number;
};

const fmt = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));

function recipeDescription(id: number): string | null {
  const recipe = RECIPES.find((entry) => entry.out?.[0] === id);
  if (!recipe) return null;
  return recipeText(recipe.key, recipe.name, recipe.desc)[1];
}

function quantityStat(count = 1): ItemDetailStat {
  return { label: t('itemStatQuantity'), value: String(Math.max(0, Math.floor(count))) };
}

function durabilityValue(current: number | undefined, max: number): string {
  if (max <= 0) return '∞';
  return `${Math.max(0, Math.min(max, Math.floor(current ?? max)))}/${max}`;
}

export function getItemDetails(id: number, context: ItemDetailContext = {}): ItemDetails {
  const damageBonus = context.damage ?? 0;
  const swift = context.swift ?? 0;

  if (id === HAND) {
    return {
      name: t('emptyHand'),
      description: t('itemDescHand'),
      color: '#ded7c8',
      stats: [{ label: t('itemStatDamage'), value: fmt(meleeDamage(HAND, damageBonus)) }],
    };
  }

  if (id === TOOL_TORCH) {
    return {
      name: t('handTorch'),
      description: t('itemDescTorch'),
      color: '#ffb03a',
      stats: [],
    };
  }

  const spec = getToolSpec(id);
  if (spec) {
    const descriptionKey: Record<typeof spec.kind, TKey> = {
      pickaxe: 'itemDescPickaxe',
      sword: 'itemDescSword',
      axe: 'itemDescAxe',
      shovel: 'itemDescShovel',
      hoe: 'itemDescHoe',
      bow: 'itemDescBow',
    };
    const stats: ItemDetailStat[] = [];
    if (spec.kind === 'bow') {
      stats.push({
        label: t('itemStatArrowDamage'),
        value: fmt(bowArrowDamage(id || TOOL_BOW, ARROW_ITEM, damageBonus)),
      });
    } else {
      stats.push({ label: t('itemStatDamage'), value: fmt(meleeDamage(id, damageBonus)) });
      const swiftFactor = 1 - Math.min(0.4, Math.max(0, swift) / 100);
      const attacksPerSecond = 1 / (meleeAttackInterval(id) * swiftFactor);
      stats.push({ label: t('itemStatAttackSpeed'), value: `${fmt(attacksPerSecond)}/s` });
      if (spec.kind !== 'sword') {
        stats.push({ label: t('itemStatMiningSpeed'), value: `${fmt(spec.speed)}×` });
      }
    }
    stats.push({
      label: t('itemStatDurability'),
      value: durabilityValue(context.durability, context.maxDurability ?? spec.maxDurability),
    });
    return { name: toolLabelForId(id), description: t(descriptionKey[spec.kind]), color: spec.edge, stats };
  }

  if (isArrowId(id)) {
    const name = blockName(id, BLOCKS[id]?.name ?? t('itemDescArrow'));
    const stats: ItemDetailStat[] = [
      { label: t('itemStatArrowDamage'), value: fmt(bowArrowDamage(TOOL_BOW, id, damageBonus)) },
      quantityStat(context.count),
    ];
    return { name, description: recipeDescription(id) ?? t('itemDescArrow'), color: '#d6ccb4', stats };
  }

  const heal = foodHeal(id);
  if (heal > 0 || isMeatItem(id)) {
    const name = blockName(id, BLOCKS[id]?.name ?? t('itemDescFood'));
    const isRaw = isRawMeatItem(id) && !isCookedMeatItem(id);
    const stats = [quantityStat(context.count)];
    if (heal > 0) stats.push({ label: t('itemStatHealing'), value: `+${fmt(heal)} ${t('hp')}`, color: '#93c95d' });
    return {
      name,
      description: t(isRaw ? 'itemDescRawFood' : 'itemDescFood'),
      color: isRaw ? '#df826e' : '#e8b95c',
      stats,
    };
  }

  const def = BLOCKS[id];
  const name = def ? blockName(id, def.name) : t('toolUnknown');
  const category = getItemInvCategory(id);
  const placeable = !!def && def.breakable && def.drop !== 0;
  const description = recipeDescription(id)
    ?? t(category === 'food' ? 'itemDescFood' : placeable ? 'itemDescBuilding' : 'itemDescResource');
  const stats: ItemDetailStat[] = [quantityStat(context.count)];
  stats.push({ label: t('itemStatUse'), value: t(placeable ? 'itemUsePlace' : 'itemUseCraft') });
  if (placeable && def && Number.isFinite(def.hardness)) {
    stats.push({ label: t('itemStatBreakTime'), value: `${fmt(def.hardness)}s` });
  }
  const tint = def?.tint ?? [190, 190, 190];
  const color = `#${tint.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`;
  return { name, description, color, stats };
}

export function getGearDetails(item: Item): ItemDetails {
  const rarity = RARITY[item.rarity];
  const name = `${matName(MATERIALS[item.material].label)} ${t(SLOT_KEY[item.slot])}`;
  const stats: ItemDetailStat[] = [
    { label: t('itemStatArmor'), value: String(item.armor), color: '#d6d9dd' },
    { label: t('itemStatRarity'), value: rarName(item.rarity, rarity.name), color: rarity.color },
  ];
  if (item.damage > 0) stats.push({ label: t('itemStatDamage'), value: String(item.damage), color: '#ff9f72' });
  for (const affix of item.affixes) {
    const def = AFFIXES[affix.id];
    const unit = def.unit === 'hp' ? ` ${t('hp')}` : def.unit;
    stats.push({
      label: t(def.nameKey),
      value: `${fmt(affix.value)}${unit} · ${t(def.descKey)}`,
      color: def.color,
    });
  }
  return {
    name,
    description: t('itemDescGear'),
    color: gearColor(item),
    stats,
  };
}

export function getPetDetails(kind: PetKind | 'wolf' | 'cat' | 'monkey' | 'parrot' | 'owl'): ItemDetails {
  const name = t(kind === 'wolf' ? 'petWolfResource' : kind === 'cat' ? 'petCatResource' : kind === 'monkey' ? 'petMonkeyResource' : kind === 'parrot' ? 'petParrotResource' : 'petOwlResource');
  return {
    name,
    description: t('itemDescPet'),
    color: '#c59b66',
    stats: [
      { label: t('itemStatCompanion'), value: name },
      { label: t('itemStatUse'), value: t('itemPetReady') },
    ],
  };
}
