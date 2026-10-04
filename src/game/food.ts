import {
  APPLE,
  BANANA,
  COCONUT,
  COOKED_MEAT,
  HONEY,
  MEAT_FAMILY_NAMES,
  MEAT_ITEM_BY_ID,
  MEAT_ITEM_IDS,
  RAW_MEAT,
  type MeatFamily,
  type MeatSize,
} from './blocks';

export type AnimalMeatDrop = { family: MeatFamily; size: MeatSize; rawId: number; cookedId: number; count: number };

const FAMILY_HEAL: Record<MeatFamily, number> = {
  chicken: 16,
  pork: 21,
  beef: 26,
  mutton: 20,
  fish: 15,
  salmon: 23,
  rabbit: 13,
  venison: 23,
  crab: 17,
};
const SIZE_HEAL: Record<MeatSize, number> = { small: 0.65, medium: 1, large: 1.35 };

/** One unit of a cooked dish restores more health when it came from a larger carcass. */
export function cookedMeatHeal(id: number): number {
  if (id === COOKED_MEAT) return 30;
  const info = MEAT_ITEM_BY_ID[id];
  if (!info?.cooked) return 0;
  return Math.max(1, Math.round(FAMILY_HEAL[info.family] * SIZE_HEAL[info.size]));
}

/** Raw meat -> its matching cooked dish, with the legacy generic meat still supported. */
export function cookedMeatForRaw(id: number): number | null {
  if (id === RAW_MEAT) return COOKED_MEAT;
  const info = MEAT_ITEM_BY_ID[id];
  return info && !info.cooked ? MEAT_ITEM_IDS[info.family][info.size].cooked : null;
}

/** Food that can be eaten directly from the selected hotbar slot. */
export function foodHeal(id: number): number {
  if (id === APPLE) return 20;
  if (id === COCONUT) return 22;
  if (id === BANANA) return 16;
  if (id === HONEY) return 15;
  return cookedMeatHeal(id);
}

/**
 * Animal-to-food mapping used by the death-drop path. Size is read from the final rendered model
 * scale (so calves/fawns and fish variants produce appropriately sized portions).
 */
export function meatDropForAnimal(id: string, variant: number, renderedScale: number): AnimalMeatDrop | null {
  let family: MeatFamily | null = null;
  if (id === 'cow' || id === 'calf') family = 'beef';
  else if (id === 'pig') family = 'pork';
  else if (id === 'sheep') family = 'mutton';
  else if (id === 'chicken' || id === 'bird' || id === 'penguin') family = 'chicken';
  else if (id === 'rabbit') family = 'rabbit';
  else if (id === 'deer' || id === 'roe_deer' || id === 'moose' || id === 'fawn' || id === 'camel' || id === 'camel_calf') family = 'venison';
  else if (id === 'crab') family = 'crab';
  else if (id === 'fish') family = variant === 4 ? 'salmon' : 'fish';
  else if (id === 'seal') family = 'fish';
  if (!family) return null;

  let size: MeatSize = renderedScale < 0.62 ? 'small' : renderedScale < 1.15 ? 'medium' : 'large';
  // Salmon are visibly plumper than minnows even though the fish species share a small base model.
  if (id === 'fish' && variant === 4 && size === 'small') size = 'medium';
  const ids = MEAT_ITEM_IDS[family][size];
  const count = size === 'small' ? 1 : size === 'medium' ? 2 : 3;
  return { family, size, rawId: ids.raw, cookedId: ids.cooked, count };
}

export function meatItemLabel(id: number): string | null {
  const info = MEAT_ITEM_BY_ID[id];
  if (!info) return id === RAW_MEAT ? 'Raw Meat' : id === COOKED_MEAT ? 'Cooked Meat' : null;
  const size = info.size[0].toUpperCase() + info.size.slice(1);
  const animal = MEAT_FAMILY_NAMES[info.family];
  return info.cooked ? `Cooked ${size} ${animal}` : `${size} Raw ${animal}`;
}
