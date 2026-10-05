import type { TKey } from './i18n';

/**
 * Shared feather palettes and proportions for wild birds and the permanent parrot companion.
 * The order intentionally matches the existing in-world bird variants, so the pet coat picker
 * never creates a look that is absent from the world model.
 */
export type ParrotVariant = {
  id: string;
  nameKey: TKey;
  colors: [string, string, string];
  size: number;
  length: number;
  tail: number;
};

export const PARROT_VARIANTS: readonly ParrotVariant[] = [
  { id: 'macaw', nameKey: 'petParrotCoatMacaw', colors: ['#d83b2f', '#ffe15c', '#255bc2'], size: 1.35, length: 1.12, tail: 2.2 },
  { id: 'green', nameKey: 'petParrotCoatGreen', colors: ['#2ebd52', '#f45858', '#1f7c40'], size: 1.28, length: 1.08, tail: 2.1 },
  { id: 'blue', nameKey: 'petParrotCoatBlue', colors: ['#1e8eea', '#ffd24a', '#1455a8'], size: 1.22, length: 1.06, tail: 1.9 },
  { id: 'cockatiel', nameKey: 'petParrotCoatCockatiel', colors: ['#f0de72', '#ff8b3d', '#d0b24a'], size: 1.15, length: 1.0, tail: 1.55 },
  { id: 'grey', nameKey: 'petParrotCoatGrey', colors: ['#6c6d78', '#f2f0e6', '#484a56'], size: 1.25, length: 1.05, tail: 1.45 },
  { id: 'budgie', nameKey: 'petParrotCoatBudgie', colors: ['#5ec7ec', '#f5f1dc', '#2f8e4a'], size: 1.05, length: 0.95, tail: 1.65 },
];
