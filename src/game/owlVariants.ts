import type { TKey } from './i18n';

/**
 * Shared plumage palettes and proportions for the eagle owl companion.
 * Featuring classic Eurasian, Snowy, Barn, Forest, Midnight, and Tawny plumage styles.
 */
export type OwlVariant = {
  id: string;
  nameKey: TKey;
  body: string;
  chest: string;
  wings: string;
  eyes: string;
  tufts: string;
  beak: string;
  size: number;
  length: number;
  tail: number;
};

export const OWL_VARIANTS: readonly OwlVariant[] = [
  {
    id: 'eurasian',
    nameKey: 'petOwlCoatEurasian',
    body: '#7a5230',
    chest: '#dfc49c',
    wings: '#422b19',
    eyes: '#f59e0b',
    tufts: '#382314',
    beak: '#2d241e',
    size: 1.35,
    length: 1.1,
    tail: 1.5,
  },
  {
    id: 'snowy',
    nameKey: 'petOwlCoatSnowy',
    body: '#f4f5f7',
    chest: '#ffffff',
    wings: '#a3a8b2',
    eyes: '#ffd600',
    tufts: '#8e94a0',
    beak: '#2c2d30',
    size: 1.4,
    length: 1.12,
    tail: 1.45,
  },
  {
    id: 'barn',
    nameKey: 'petOwlCoatBarn',
    body: '#c9873d',
    chest: '#faf0e6',
    wings: '#8f5528',
    eyes: '#241b18',
    tufts: '#a86930',
    beak: '#d4a373',
    size: 1.25,
    length: 1.05,
    tail: 1.4,
  },
  {
    id: 'forest',
    nameKey: 'petOwlCoatForest',
    body: '#544332',
    chest: '#cfbe9f',
    wings: '#31271f',
    eyes: '#f5a623',
    tufts: '#251c14',
    beak: '#1f1c19',
    size: 1.38,
    length: 1.12,
    tail: 1.55,
  },
  {
    id: 'midnight',
    nameKey: 'petOwlCoatMidnight',
    body: '#3a3b4c',
    chest: '#b3b0cf',
    wings: '#20212e',
    eyes: '#54e0d4',
    tufts: '#181824',
    beak: '#191c24',
    size: 1.3,
    length: 1.08,
    tail: 1.5,
  },
  {
    id: 'tawny',
    nameKey: 'petOwlCoatTawny',
    body: '#964d2b',
    chest: '#edd8b7',
    wings: '#582a17',
    eyes: '#ffb834',
    tufts: '#4b2010',
    beak: '#302018',
    size: 1.28,
    length: 1.06,
    tail: 1.45,
  },
];
