import { markProfileDirty, registerCloudPart, saveProgressNow } from './profile';
import { storageGet, storageSet } from './storage';

export type CharacterGender = 'boy' | 'girl';
export type CharacterHairstyle =
  | 'short'
  | 'long'
  | 'ponytail'
  | 'spiky'
  | 'bob'
  | 'curly'
  | 'braids'
  | 'bun'
  | 'sidePart'
  | 'twinTails';
export type CharacterShoeType = 'sneakers' | 'boots' | 'sandals';
export type CharacterExpression = 'smile' | 'happy' | 'cool' | 'surprised' | 'wink' | 'neutral' | 'sad' | 'thoughtful' | 'scared' | 'angry';
export type CharacterGlasses = 'none' | 'round' | 'square' | 'sunglasses';

export type CharacterCustomization = {
  gender: CharacterGender;
  shirtColor: string;
  pantsColor: string;
  shoeType: CharacterShoeType;
  shoeColor: string;
  hairstyle: CharacterHairstyle;
  hairColor: string;
  skinColor: string;
  expression: CharacterExpression;
  glasses: CharacterGlasses;
};

/** Fixed, readable palettes keep the block-world character legible and cloud data compact. */
export const CHARACTER_COLORS = {
  shirt: ['#e2564a', '#3f9b72', '#3f79bd', '#f3b442', '#8c58bd', '#f2f2f2', '#273541'],
  pants: ['#2f4f7a', '#493443', '#475046', '#64412e', '#20272e', '#b58e4b', '#8794a3'],
  shoes: ['#2a221c', '#f2f2ee', '#d9484c', '#54b7ba', '#b48745', '#6f55a7', '#304966'],
  skin: ['#f3d5b5', '#d8a878', '#b9774d', '#8d563d', '#55352b', '#f8e0cf'],
  hair: ['#38251c', '#654331', '#a8753d', '#d7aa61', '#ead38c', '#b83f35', '#41335d', '#25292c'],
} as const;

export const CHARACTER_HAIRSTYLES: readonly CharacterHairstyle[] = [
  'short', 'long', 'ponytail', 'spiky', 'bob', 'curly', 'braids', 'bun', 'sidePart', 'twinTails',
];

export const CHARACTER_GLASSES: readonly CharacterGlasses[] = ['none', 'round', 'square', 'sunglasses'];

/** Pixel-art expressions are drawn from eyes, brows and mouth blocks, never system emoji glyphs. */
export const CHARACTER_EXPRESSIONS: ReadonlyArray<{ id: CharacterExpression }> = [
  { id: 'smile' },
  { id: 'happy' },
  { id: 'sad' },
  { id: 'thoughtful' },
  { id: 'scared' },
  { id: 'angry' },
  { id: 'surprised' },
  { id: 'wink' },
  { id: 'neutral' },
  { id: 'cool' },
];

export const DEFAULT_CHARACTER_CUSTOMIZATION: CharacterCustomization = {
  gender: 'boy',
  shirtColor: '#3f9b72',
  pantsColor: '#2f4f7a',
  shoeType: 'boots',
  shoeColor: '#2a221c',
  hairstyle: 'short',
  hairColor: '#654331',
  skinColor: '#d8a878',
  expression: 'smile',
  glasses: 'none',
};

const STORAGE_KEY = 'orerush.character.v1';

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function paletteColor(value: unknown, palette: readonly string[], fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.toLowerCase();
  return palette.includes(normalized) ? normalized : fallback;
}

/** Treat both localStorage and cloud data as untrusted; unsupported values fall back safely. */
export function sanitizeCharacterCustomization(value: unknown): CharacterCustomization {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const expressionIds = CHARACTER_EXPRESSIONS.map(({ id }) => id);
  return {
    gender: isOneOf(raw.gender, ['boy', 'girl']) ? raw.gender : DEFAULT_CHARACTER_CUSTOMIZATION.gender,
    shirtColor: paletteColor(raw.shirtColor, CHARACTER_COLORS.shirt, DEFAULT_CHARACTER_CUSTOMIZATION.shirtColor),
    pantsColor: paletteColor(raw.pantsColor, CHARACTER_COLORS.pants, DEFAULT_CHARACTER_CUSTOMIZATION.pantsColor),
    shoeType: isOneOf(raw.shoeType, ['sneakers', 'boots', 'sandals']) ? raw.shoeType : DEFAULT_CHARACTER_CUSTOMIZATION.shoeType,
    shoeColor: paletteColor(raw.shoeColor, CHARACTER_COLORS.shoes, DEFAULT_CHARACTER_CUSTOMIZATION.shoeColor),
    hairstyle: isOneOf(raw.hairstyle, CHARACTER_HAIRSTYLES) ? raw.hairstyle : DEFAULT_CHARACTER_CUSTOMIZATION.hairstyle,
    hairColor: paletteColor(raw.hairColor, CHARACTER_COLORS.hair, DEFAULT_CHARACTER_CUSTOMIZATION.hairColor),
    skinColor: paletteColor(raw.skinColor, CHARACTER_COLORS.skin, DEFAULT_CHARACTER_CUSTOMIZATION.skinColor),
    expression: isOneOf(raw.expression, expressionIds) ? raw.expression : DEFAULT_CHARACTER_CUSTOMIZATION.expression,
    glasses: isOneOf(raw.glasses, CHARACTER_GLASSES) ? raw.glasses : DEFAULT_CHARACTER_CUSTOMIZATION.glasses,
  };
}

/** Stable random appearance from the same palettes and options offered by the character creator. */
export function randomCharacterCustomization(seed: string | number): CharacterCustomization {
  const source = String(seed);
  let state = 2_166_136_261;
  for (let i = 0; i < source.length; i++) state = Math.imul(state ^ source.charCodeAt(i), 16_777_619) >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  const pick = <T,>(values: readonly T[]): T => values[Math.floor(random() * values.length)];
  return {
    gender: pick(['boy', 'girl'] as const),
    shirtColor: pick(CHARACTER_COLORS.shirt),
    pantsColor: pick(CHARACTER_COLORS.pants),
    shoeType: pick(['sneakers', 'boots', 'sandals'] as const),
    shoeColor: pick(CHARACTER_COLORS.shoes),
    hairstyle: pick(CHARACTER_HAIRSTYLES),
    hairColor: pick(CHARACTER_COLORS.hair),
    skinColor: pick(CHARACTER_COLORS.skin),
    expression: pick(CHARACTER_EXPRESSIONS).id,
    glasses: pick(CHARACTER_GLASSES),
  };
}

function localCharacter(): CharacterCustomization {
  if (cached) return cached;
  try {
    cached = sanitizeCharacterCustomization(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'));
  } catch {
    cached = { ...DEFAULT_CHARACTER_CUSTOMIZATION };
  }
  return cached;
}

let cached: CharacterCustomization | null = null;

function writeLocal(value: unknown): CharacterCustomization {
  const next = sanitizeCharacterCustomization(value);
  cached = next;
  storageSet(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getCharacterCustomization(): CharacterCustomization {
  return { ...localCharacter() };
}

/** Save on-device first, then queue the same appearance in the player's cloud profile. */
export function saveCharacterCustomization(value: CharacterCustomization): CharacterCustomization {
  const next = writeLocal(value);
  markProfileDirty({ character: next });
  saveProgressNow();
  return { ...next };
}

registerCloudPart({
  collect: () => ({ character: getCharacterCustomization() }),
  apply: (cloud) => {
    const remote = (cloud as typeof cloud & { character?: unknown }).character;
    if (remote && typeof remote === 'object') writeLocal(remote);
  },
});
