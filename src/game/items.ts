import { mulberry32 } from './noise';
import { matName, rarName, type TKey } from './i18n';
import { yaServerTime } from './yandex';

export type Slot = 'head' | 'chest' | 'legs' | 'feet' | 'hands' | 'offhand';
export const SLOTS: Slot[] = ['head', 'chest', 'legs', 'feet', 'hands', 'offhand'];

export type AffixId = 'fire' | 'frost' | 'thorns' | 'vamp' | 'swift' | 'tough' | 'greed' | 'miner' | 'magnet' | 'reach';

export type Affix = {
  id: AffixId;
  nameKey: TKey;
  descKey: TKey;
  color: string;
  /** scalar rolled per-item */
  min: number;
  max: number;
  /** how the number reads in the tooltip */
  unit: string;
};

export const AFFIXES: Record<AffixId, Affix> = {
  fire: { id: 'fire', nameKey: 'aff_fire', descKey: 'aff_fireD', color: '#ff8a2b', min: 2, max: 7, unit: '/s' },
  frost: { id: 'frost', nameKey: 'aff_frost', descKey: 'aff_frostD', color: '#7fd4ff', min: 18, max: 48, unit: '%' },
  thorns: { id: 'thorns', nameKey: 'aff_thorns', descKey: 'aff_thornsD', color: '#c58cff', min: 12, max: 40, unit: '%' },
  vamp: { id: 'vamp', nameKey: 'aff_vamp', descKey: 'aff_vampD', color: '#ff5f7a', min: 1, max: 4, unit: 'hp' },
  swift: { id: 'swift', nameKey: 'aff_swift', descKey: 'aff_swiftD', color: '#93c95d', min: 6, max: 18, unit: '%' },
  tough: { id: 'tough', nameKey: 'aff_tough', descKey: 'aff_toughD', color: '#9aa0a6', min: 2, max: 8, unit: 'ar' },
  greed: { id: 'greed', nameKey: 'aff_greed', descKey: 'aff_greedD', color: '#f7d34b', min: 8, max: 30, unit: '%' },
  miner: { id: 'miner', nameKey: 'aff_miner', descKey: 'aff_minerD', color: '#5fe8dc', min: 8, max: 28, unit: '%' },
  magnet: { id: 'magnet', nameKey: 'aff_magnet', descKey: 'aff_magnetD', color: '#8fb8ff', min: 3, max: 8, unit: 'm' },
  reach: { id: 'reach', nameKey: 'aff_reach', descKey: 'aff_reachD', color: '#f0b45a', min: 0.35, max: 0.9, unit: 'm' },
};

export type Rarity = 0 | 1 | 2 | 3;
export const RARITY = [
  { name: 'COMMON', color: '#b6c2b8', glow: 'rgba(182,194,184,.25)' },
  { name: 'STURDY', color: '#93c95d', glow: 'rgba(147,201,93,.3)' },
  { name: 'RARE', color: '#5ea8ff', glow: 'rgba(94,168,255,.35)' },
  { name: 'MYTHIC', color: '#d98cff', glow: 'rgba(217,140,255,.4)' },
] as const;

export type Material = 'leather' | 'iron' | 'gold' | 'diamond' | 'netherite';
export const MATERIALS: Record<Material, { label: string; color: string; armor: number; dmg: number }> = {
  leather: { label: 'LEATHER', color: '#a3763f', armor: 2, dmg: 1 },
  iron: { label: 'IRON', color: '#d6d9dd', armor: 5, dmg: 4 },
  gold: { label: 'GOLD', color: '#f7d34b', armor: 4, dmg: 6 },
  diamond: { label: 'DIAMOND', color: '#5fe8dc', armor: 9, dmg: 9 },
  netherite: { label: 'NETHERITE', color: '#8a6a58', armor: 14, dmg: 14 },
};

export const GEAR_ID_BASE = 300;
export const isGearHotbarId = (id: number) => id >= GEAR_ID_BASE;

export type Item = {
  uid: string;
  /** numeric hotbar id (>= 300) so gear can sit in the hotbar and be held/thrown */
  hid: number;
  slot: Slot;
  material: Material;
  rarity: Rarity;
  armor: number;
  /** offhand/weapon damage contribution */
  damage: number;
  affixes: Array<{ id: AffixId; value: number }>;
  /** true for crafted base gear (no random affixes) */
  crafted: boolean;
};

export const SLOT_KEY: Record<Slot, TKey> = {
  head: 'slot_head',
  chest: 'slot_chest',
  legs: 'slot_legs',
  feet: 'slot_feet',
  hands: 'slot_hands',
  offhand: 'slot_offhand',
};

/** how much of the material's armour value each slot carries */
const SLOT_WEIGHT: Record<Slot, number> = {
  head: 0.8,
  chest: 1.3,
  legs: 1.0,
  feet: 0.65,
  hands: 0.6,
  offhand: 0.9,
};

let uidCounter = 0;
let gearHidCounter = GEAR_ID_BASE;
export function newUid() {
  return `i${yaServerTime().toString(36)}${(uidCounter++).toString(36)}`;
}
export function ensureGearHid(it: Item): Item {
  if (typeof it.hid !== 'number' || it.hid < GEAR_ID_BASE) {
    it.hid = gearHidCounter++;
  } else if (it.hid >= gearHidCounter) {
    gearHidCounter = it.hid + 1;
  }
  return it;
}

export function makeItem(slot: Slot, material: Material, rarity: Rarity, rand: () => number, crafted = false): Item {
  const m = MATERIALS[material];
  const rarMul = 1 + rarity * 0.22;
  const armor = Math.max(1, Math.round(m.armor * SLOT_WEIGHT[slot] * rarMul));
  const damage = slot === 'offhand' ? Math.round(m.dmg * 0.4 * rarMul) : 0;

  const affixes: Array<{ id: AffixId; value: number }> = [];
  if (!crafted) {
    const count = rarity === 0 ? (rand() < 0.4 ? 1 : 0) : rarity === 1 ? 1 : rarity === 2 ? 2 : 3;
    const basePool = (Object.keys(AFFIXES) as AffixId[]).filter((id) => id !== 'reach');
    // Extra interaction reach is a rare armour perk, like magnetism: it only rolls on rare/mythic gear.
    const pool = rarity >= 2 ? ([...basePool, 'reach'] as AffixId[]) : basePool;
    // gauntlets favour the offensive rolls — that's the "fire gloves" fantasy
    const weighted = slot === 'hands' ? ([...pool, 'fire', 'fire', 'frost', 'vamp'] as AffixId[]) : pool;
    const used = new Set<AffixId>();
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const id = weighted[Math.floor(rand() * weighted.length)];
        if (used.has(id)) continue;
        used.add(id);
        const a = AFFIXES[id];
        const roll = a.min + rand() * (a.max - a.min);
        const scaled = roll * (0.72 + rarity * 0.17);
        affixes.push({ id, value: Math.max(1, Math.round(scaled * 10) / 10) });
        break;
      }
    }
  }

  return { uid: newUid(), hid: gearHidCounter++, slot, material, rarity, armor, damage, affixes, crafted };
}

/**
 * Drop odds rise gently with enemy strength. The weakest zombie has a 5.5% gear chance
 * (about one item per 18 kills), rather than flooding the inventory with armor.
 */
export function gearDropChance(level: number): number {
  const tier = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return Math.min(0.0925, 0.055 + (tier - 1) * 0.0075);
}

function rollGearMaterial(level: number, rand: () => number): Material {
  const tier = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const roll = rand();
  if (tier <= 1) return roll < 0.78 ? 'leather' : 'iron';
  if (tier === 2) return roll < 0.72 ? 'leather' : 'iron';
  if (tier === 3) return roll < 0.58 ? 'leather' : roll < 0.95 ? 'iron' : 'gold';
  if (tier === 4) return roll < 0.4 ? 'leather' : roll < 0.84 ? 'iron' : roll < 0.99 ? 'gold' : 'diamond';
  if (tier === 5) return roll < 0.28 ? 'leather' : roll < 0.7 ? 'iron' : roll < 0.95 ? 'gold' : 'diamond';
  return roll < 0.18 ? 'leather' : roll < 0.56 ? 'iron' : roll < 0.83 ? 'gold' : roll < 0.98 ? 'diamond' : 'netherite';
}

function rollGearRarity(level: number, rand: () => number): Rarity {
  const tier = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  const roll = rand();
  // Green is the entry drop. Better rarities are locked behind stronger monsters / later nights.
  if (tier <= 1) return 1;
  if (tier === 2) return roll < 0.92 ? 1 : 2;
  if (tier === 3) return roll < 0.85 ? 1 : roll < 0.99 ? 2 : 3;
  if (tier === 4) return roll < 0.78 ? 1 : roll < 0.97 ? 2 : 3;
  if (tier === 5) return roll < 0.68 ? 1 : roll < 0.93 ? 2 : 3;
  return roll < 0.58 ? 1 : roll < 0.88 ? 2 : 3;
}

/** Loot table used when a monster dies; higher-tier gear only comes from stronger monsters. */
export function rollLoot(level: number, seed: number): Item | null {
  const rand = mulberry32(seed);
  if (rand() >= gearDropChance(level)) return null;
  const slot = SLOTS[Math.floor(rand() * SLOTS.length)];
  const material = rollGearMaterial(level, rand);
  const rarity = rollGearRarity(level, rand);
  return makeItem(slot, material, rarity, rand);
}

export type Stats = {
  armor: number;
  damage: number;
  fire: number;
  frost: number;
  thorns: number;
  vamp: number;
  swift: number;
  greed: number;
  miner: number;
  magnet: number;
  reach: number;
};

export const EMPTY_STATS: Stats = {
  armor: 0,
  damage: 0,
  fire: 0,
  frost: 0,
  thorns: 0,
  vamp: 0,
  swift: 0,
  greed: 0,
  miner: 0,
  magnet: 0,
  reach: 0,
};

export function computeStats(equipped: Partial<Record<Slot, Item>>): Stats {
  const s: Stats = { ...EMPTY_STATS };
  for (const slot of SLOTS) {
    const it = equipped[slot];
    if (!it) continue;
    s.armor += it.armor;
    s.damage += it.damage;
    for (const a of it.affixes) {
      switch (a.id) {
        case 'fire':
          s.fire += a.value;
          break;
        case 'frost':
          s.frost += a.value;
          break;
        case 'thorns':
          s.thorns += a.value;
          break;
        case 'vamp':
          s.vamp += a.value;
          break;
        case 'swift':
          s.swift += a.value;
          break;
        case 'tough':
          s.armor += a.value;
          break;
        case 'greed':
          s.greed += a.value;
          break;
        case 'miner':
          s.miner += a.value;
          break;
        case 'magnet':
          s.magnet += a.value;
          break;
        case 'reach':
          s.reach += a.value;
          break;
      }
    }
  }
  return s;
}

/** flat armour → damage reduction (diminishing, caps at 80%) */
export function damageReduction(armor: number) {
  return Math.min(0.8, armor / (armor + 26));
}

export function itemLabel(it: Item): string {
  return `${matName(MATERIALS[it.material].label)} ${rarName(it.rarity, RARITY[it.rarity].name)}`;
}
