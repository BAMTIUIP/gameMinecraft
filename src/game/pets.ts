import { markProfileDirty, registerCloudPart } from './profile';
import { developerShopClaims, isDeveloperShopEnabled } from './devShop';
import { storageGet, storageRemove, storageSet } from './storage';
import type { TKey } from './i18n';
import { PARROT_VARIANTS } from './parrotVariants';
import { OWL_VARIANTS } from './owlVariants';

export type PetKind = 'wolf' | 'cat' | 'monkey' | 'parrot' | 'owl';

/** The equipped companion is represented in the world/slot, not as a duplicate inventory token. */
export function getPetInventoryKinds(ownedKinds: readonly PetKind[], equippedKind: PetKind | null = null): PetKind[] {
  return [...new Set(ownedKinds)].filter((kind) => kind !== equippedKind);
}

/** Permanent Yandex Console SKUs for the account-restored companions. */
export const WOLF_PET_PRODUCT_ID = 'pet-wolf' as const;
export const CAT_PET_PRODUCT_ID = 'pet-cat' as const;
export const MONKEY_PET_PRODUCT_ID = 'pet-monkey' as const;
export const PARROT_PET_PRODUCT_ID = 'pet-parrot' as const;
export const OWL_PET_PRODUCT_ID = 'pet-owl' as const;
export const PET_PRODUCT_IDS = [WOLF_PET_PRODUCT_ID, CAT_PET_PRODUCT_ID, MONKEY_PET_PRODUCT_ID, PARROT_PET_PRODUCT_ID, OWL_PET_PRODUCT_ID] as const;

export type WolfMarking = 'plain' | 'striped' | 'spotted';
export type WolfCoat = {
  id: string;
  nameKey: TKey;
  body: string;
  dark: string;
  light: string;
  muzzle: string;
  belly: string;
  marking: WolfMarking;
};

/** The wolf keeps its reference-inspired coat picker. */
export const WOLF_COATS: readonly WolfCoat[] = [
  { id: 'rusty', nameKey: 'petCoatRusty', body: '#a96a3d', dark: '#50372e', light: '#dfb77f', muzzle: '#e8d1ab', belly: '#ead8ba', marking: 'plain' },
  { id: 'pale', nameKey: 'petCoatPale', body: '#b9ad98', dark: '#645b53', light: '#e8dfcf', muzzle: '#efe6d6', belly: '#f1ecdf', marking: 'plain' },
  { id: 'black', nameKey: 'petCoatBlack', body: '#343740', dark: '#171a21', light: '#9297a0', muzzle: '#c4c7cc', belly: '#b9bdc4', marking: 'plain' },
  { id: 'striped', nameKey: 'petCoatStriped', body: '#c99a58', dark: '#493b2e', light: '#e4bd7f', muzzle: '#efd6ae', belly: '#e9d4ad', marking: 'striped' },
  { id: 'snowy', nameKey: 'petCoatSnowy', body: '#e9e8e0', dark: '#747d83', light: '#fffdf6', muzzle: '#faf5e8', belly: '#fffdf8', marking: 'plain' },
  { id: 'ashen', nameKey: 'petCoatAshen', body: '#89888f', dark: '#45464e', light: '#c1bec6', muzzle: '#e0dce0', belly: '#dedbe0', marking: 'plain' },
  { id: 'woods', nameKey: 'petCoatWoods', body: '#776448', dark: '#3c3329', light: '#b6a176', muzzle: '#d6c49c', belly: '#d4c7a5', marking: 'plain' },
  { id: 'spotted', nameKey: 'petCoatSpotted', body: '#ad7048', dark: '#493328', light: '#e2b37c', muzzle: '#efd7b4', belly: '#e7d5ba', marking: 'spotted' },
  { id: 'chestnut', nameKey: 'petCoatChestnut', body: '#8d4e3c', dark: '#452b2a', light: '#cb8e72', muzzle: '#e1b39b', belly: '#d5aa92', marking: 'plain' },
];

export type CatCoat = {
  id: string;
  nameKey: TKey;
  body: string;
  accent: string;
  legs: string;
  patch: string;
};

/** The cat companion reuses the in-world cat silhouettes and their familiar Minecraft-like coats. */
export const CAT_COATS: readonly CatCoat[] = [
  { id: 'ginger-tabby', nameKey: 'petCatCoatGingerTabby', body: '#c99556', accent: '#f3dcc0', legs: '#855931', patch: '#3a2a20' },
  { id: 'tuxedo', nameKey: 'petCatCoatTuxedo', body: '#1d1d22', accent: '#f4efe4', legs: '#121216', patch: '#f4efe4' },
  { id: 'calico', nameKey: 'petCatCoatCalico', body: '#f0e8d8', accent: '#efe3d0', legs: '#d0b58c', patch: '#c58b45' },
  { id: 'ocelot', nameKey: 'petCatCoatOcelot', body: '#d09a5a', accent: '#f2e0bb', legs: '#9b6f3a', patch: '#6c4d2e' },
  { id: 'siamese', nameKey: 'petCatCoatSiamese', body: '#b8a08a', accent: '#f4eadb', legs: '#5c4638', patch: '#3f3026' },
  { id: 'marmalade', nameKey: 'petCatCoatMarmalade', body: '#d86d34', accent: '#f6e4ce', legs: '#944425', patch: '#f3f0e4' },
];

export type MonkeyCoat = {
  id: string;
  nameKey: TKey;
  body: string;
  face: string;
  limbs: string;
};

/** Body/face/limb palettes are applied to the regular in-world monkey model. */
export const MONKEY_COATS: readonly MonkeyCoat[] = [
  { id: 'classic', nameKey: 'petMonkeyCoatClassic', body: '#8b6444', face: '#d3a97c', limbs: '#674729' },
  { id: 'golden', nameKey: 'petMonkeyCoatGolden', body: '#c4873d', face: '#f0c686', limbs: '#875126' },
  { id: 'russet', nameKey: 'petMonkeyCoatRusset', body: '#a54f31', face: '#e4a16c', limbs: '#713820' },
  { id: 'midnight', nameKey: 'petMonkeyCoatMidnight', body: '#45434e', face: '#c39c91', limbs: '#292933' },
  { id: 'cream', nameKey: 'petMonkeyCoatCream', body: '#d2b992', face: '#f2dcb5', limbs: '#816b55' },
  { id: 'silver', nameKey: 'petMonkeyCoatSilver', body: '#858b8c', face: '#d2b49e', limbs: '#555e62' },
];

/** The companion's six palettes are the same variants used by the existing wild bird model. */
export const PARROT_COATS = PARROT_VARIANTS;

/** The eagle owl companion features six distinct plumages. */
export const OWL_COATS = OWL_VARIANTS;

const STORAGE_KEY = 'orerush.pets.v1';
type PetState = {
  wolfOwned: boolean;
  catOwned: boolean;
  monkeyOwned: boolean;
  parrotOwned: boolean;
  owlOwned: boolean;
  wolfCoatIndex: number;
  catCoatIndex: number;
  monkeyCoatIndex: number;
  parrotCoatIndex: number;
  owlCoatIndex: number;
};
let cached: PetState | undefined;

const emptyState = (): PetState => ({
  wolfOwned: false, catOwned: false, monkeyOwned: false, parrotOwned: false, owlOwned: false,
  wolfCoatIndex: 0, catCoatIndex: 0, monkeyCoatIndex: 0, parrotCoatIndex: 0, owlCoatIndex: 0,
});

export function normalizeWolfCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < WOLF_COATS.length ? index : 0;
}

export function normalizeCatCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < CAT_COATS.length ? index : 0;
}

export function normalizeMonkeyCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < MONKEY_COATS.length ? index : 0;
}

export function normalizeParrotCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < PARROT_COATS.length ? index : 0;
}

export function normalizeOwlCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < OWL_COATS.length ? index : 0;
}

function normalizeState(value: unknown): PetState {
  if (!value || typeof value !== 'object') return emptyState();
  const raw = value as {
    owned?: unknown;
    wolfOwned?: unknown;
    catOwned?: unknown;
    monkeyOwned?: unknown;
    parrotOwned?: unknown;
    owlOwned?: unknown;
    wolfCoatIndex?: unknown;
    catCoatIndex?: unknown;
    monkeyCoatIndex?: unknown;
    parrotCoatIndex?: unknown;
    owlCoatIndex?: unknown;
  };
  const ownedList = Array.isArray(raw.owned) ? raw.owned : [];
  return {
    wolfOwned: raw.wolfOwned === true || ownedList.includes('wolf'),
    catOwned: raw.catOwned === true || ownedList.includes('cat'),
    monkeyOwned: raw.monkeyOwned === true || ownedList.includes('monkey'),
    parrotOwned: raw.parrotOwned === true || ownedList.includes('parrot'),
    owlOwned: raw.owlOwned === true || ownedList.includes('owl'),
    wolfCoatIndex: normalizeWolfCoatIndex(raw.wolfCoatIndex),
    catCoatIndex: normalizeCatCoatIndex(raw.catCoatIndex),
    monkeyCoatIndex: normalizeMonkeyCoatIndex(raw.monkeyCoatIndex),
    parrotCoatIndex: normalizeParrotCoatIndex(raw.parrotCoatIndex),
    owlCoatIndex: normalizeOwlCoatIndex(raw.owlCoatIndex),
  };
}

function state(): PetState {
  if (cached === undefined) {
    try {
      cached = normalizeState(JSON.parse(storageGet(STORAGE_KEY) ?? 'null'));
    } catch {
      cached = emptyState();
    }
  }
  return cached;
}

function productIdFor(kind: PetKind) {
  return kind === 'wolf'
    ? WOLF_PET_PRODUCT_ID
    : kind === 'cat'
      ? CAT_PET_PRODUCT_ID
      : kind === 'monkey'
        ? MONKEY_PET_PRODUCT_ID
        : kind === 'parrot'
          ? PARROT_PET_PRODUCT_ID
          : OWL_PET_PRODUCT_ID;
}

function hasDeveloperPet(kind: PetKind): boolean {
  return isDeveloperShopEnabled() && developerShopClaims().includes(productIdFor(kind));
}

function cloudState(value: PetState) {
  return {
    owned: [value.wolfOwned && 'wolf', value.catOwned && 'cat', value.monkeyOwned && 'monkey', value.parrotOwned && 'parrot', value.owlOwned && 'owl'].filter(Boolean),
    // Appearance has no cloud meaning unless its permanent Yandex entitlement is owned.
    wolfCoatIndex: value.wolfOwned ? value.wolfCoatIndex : 0,
    catCoatIndex: value.catOwned ? value.catCoatIndex : 0,
    monkeyCoatIndex: value.monkeyOwned ? value.monkeyCoatIndex : 0,
    parrotCoatIndex: value.parrotOwned ? value.parrotCoatIndex : 0,
    owlCoatIndex: value.owlOwned ? value.owlCoatIndex : 0,
  };
}

function write(next: PetState): boolean {
  const normalized = normalizeState(next);
  if (!storageSet(STORAGE_KEY, JSON.stringify(normalized))) return false;
  cached = normalized;
  markProfileDirty({ pets: cloudState(normalized) });
  return true;
}

/** Reload after Yandex installs safeStorage, before cloud data is reconciled. */
export function refreshPetStateFromStorage(): void {
  cached = undefined;
  state();
}

export function hasPet(kind: PetKind): boolean {
  const current = state();
  const owned = kind === 'wolf'
    ? current.wolfOwned
    : kind === 'cat'
      ? current.catOwned
      : kind === 'monkey'
        ? current.monkeyOwned
        : kind === 'parrot'
          ? current.parrotOwned
          : current.owlOwned;
  return owned || hasDeveloperPet(kind);
}
export function hasWolfPet(): boolean { return hasPet('wolf'); }
export function hasCatPet(): boolean { return hasPet('cat'); }
export function hasMonkeyPet(): boolean { return hasPet('monkey'); }
export function hasParrotPet(): boolean { return hasPet('parrot'); }
export function hasOwlPet(): boolean { return hasPet('owl'); }

/** Permanently unlock a companion. Repeating a restore is idempotent. */
export function unlockPet(kind: PetKind): boolean {
  const current = state();
  if (kind === 'wolf') return current.wolfOwned || write({ ...current, wolfOwned: true });
  if (kind === 'cat') return current.catOwned || write({ ...current, catOwned: true });
  if (kind === 'monkey') return current.monkeyOwned || write({ ...current, monkeyOwned: true });
  if (kind === 'parrot') return current.parrotOwned || write({ ...current, parrotOwned: true });
  return current.owlOwned || write({ ...current, owlOwned: true });
}
export function unlockWolfPet(): boolean { return unlockPet('wolf'); }
export function unlockCatPet(): boolean { return unlockPet('cat'); }
export function unlockMonkeyPet(): boolean { return unlockPet('monkey'); }
export function unlockParrotPet(): boolean { return unlockPet('parrot'); }
export function unlockOwlPet(): boolean { return unlockPet('owl'); }

export function getPetCoatIndex(kind: PetKind): number {
  const current = state();
  return kind === 'wolf'
    ? current.wolfCoatIndex
    : kind === 'cat'
      ? current.catCoatIndex
      : kind === 'monkey'
        ? current.monkeyCoatIndex
        : kind === 'parrot'
          ? current.parrotCoatIndex
          : current.owlCoatIndex;
}
export function getWolfCoatIndex(): number { return getPetCoatIndex('wolf'); }
export function getCatCoatIndex(): number { return getPetCoatIndex('cat'); }
export function getMonkeyCoatIndex(): number { return getPetCoatIndex('monkey'); }
export function getParrotCoatIndex(): number { return getPetCoatIndex('parrot'); }
export function getOwlCoatIndex(): number { return getPetCoatIndex('owl'); }

export function setPetCoatIndex(kind: PetKind, index: number): number {
  const current = state();
  const owned = hasPet(kind);
  const nextIndex = kind === 'wolf'
    ? normalizeWolfCoatIndex(index)
    : kind === 'cat'
      ? normalizeCatCoatIndex(index)
      : kind === 'monkey'
        ? normalizeMonkeyCoatIndex(index)
        : kind === 'parrot'
          ? normalizeParrotCoatIndex(index)
          : normalizeOwlCoatIndex(index);
  const currentIndex = kind === 'wolf'
    ? current.wolfCoatIndex
    : kind === 'cat'
      ? current.catCoatIndex
      : kind === 'monkey'
        ? current.monkeyCoatIndex
        : kind === 'parrot'
          ? current.parrotCoatIndex
          : current.owlCoatIndex;
  if (!owned || currentIndex === nextIndex) return currentIndex;
  const next = kind === 'wolf'
    ? { ...current, wolfCoatIndex: nextIndex }
    : kind === 'cat'
      ? { ...current, catCoatIndex: nextIndex }
      : kind === 'monkey'
        ? { ...current, monkeyCoatIndex: nextIndex }
        : kind === 'parrot'
          ? { ...current, parrotCoatIndex: nextIndex }
          : { ...current, owlCoatIndex: nextIndex };
  const permanentlyOwnedForKind = kind === 'wolf'
    ? current.wolfOwned
    : kind === 'cat'
      ? current.catOwned
      : kind === 'monkey'
        ? current.monkeyOwned
        : kind === 'parrot'
          ? current.parrotOwned
          : current.owlOwned;
  if (!permanentlyOwnedForKind) {
    // Developer-shop pets are local-only test grants; keep their appearance local too.
    if (!storageSet(STORAGE_KEY, JSON.stringify(normalizeState(next)))) return currentIndex;
    cached = normalizeState(next);
    return nextIndex;
  }
  return write(next) ? nextIndex : currentIndex;
}
export function setWolfCoatIndex(index: number): number { return setPetCoatIndex('wolf', index); }
export function setCatCoatIndex(index: number): number { return setPetCoatIndex('cat', index); }
export function setMonkeyCoatIndex(index: number): number { return setPetCoatIndex('monkey', index); }
export function setParrotCoatIndex(index: number): number { return setPetCoatIndex('parrot', index); }
export function setOwlCoatIndex(index: number): number { return setPetCoatIndex('owl', index); }

function readRemote(value: unknown): { state: PetState; hasWolfCoat: boolean; hasCatCoat: boolean; hasMonkeyCoat: boolean; hasParrotCoat: boolean; hasOwlCoat: boolean } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    owned?: unknown;
    wolfOwned?: unknown;
    catOwned?: unknown;
    monkeyOwned?: unknown;
    parrotOwned?: unknown;
    owlOwned?: unknown;
    wolfCoatIndex?: unknown;
    catCoatIndex?: unknown;
    monkeyCoatIndex?: unknown;
    parrotCoatIndex?: unknown;
    owlCoatIndex?: unknown;
  };
  const normalized = normalizeState(raw);
  return {
    state: normalized,
    hasWolfCoat: Number.isInteger(raw.wolfCoatIndex)
      && Number(raw.wolfCoatIndex) >= 0
      && Number(raw.wolfCoatIndex) < WOLF_COATS.length,
    hasCatCoat: Number.isInteger(raw.catCoatIndex)
      && Number(raw.catCoatIndex) >= 0
      && Number(raw.catCoatIndex) < CAT_COATS.length,
    hasMonkeyCoat: Number.isInteger(raw.monkeyCoatIndex)
      && Number(raw.monkeyCoatIndex) >= 0
      && Number(raw.monkeyCoatIndex) < MONKEY_COATS.length,
    hasParrotCoat: Number.isInteger(raw.parrotCoatIndex)
      && Number(raw.parrotCoatIndex) >= 0
      && Number(raw.parrotCoatIndex) < PARROT_COATS.length,
    hasOwlCoat: Number.isInteger(raw.owlCoatIndex)
      && Number(raw.owlCoatIndex) >= 0
      && Number(raw.owlCoatIndex) < OWL_COATS.length,
  };
}

/** Ownership is monotonic; an older cloud snapshot can never revoke a paid companion. */
export function applyCloudPetState(value: unknown, stale = false): void {
  const incoming = readRemote(value);
  if (!incoming) return;
  const local = state();
  const developerOnlyWolf = !local.wolfOwned && !incoming.state.wolfOwned && hasDeveloperPet('wolf');
  const developerOnlyCat = !local.catOwned && !incoming.state.catOwned && hasDeveloperPet('cat');
  const developerOnlyMonkey = !local.monkeyOwned && !incoming.state.monkeyOwned && hasDeveloperPet('monkey');
  const developerOnlyParrot = !local.parrotOwned && !incoming.state.parrotOwned && hasDeveloperPet('parrot');
  const developerOnlyOwl = !local.owlOwned && !incoming.state.owlOwned && hasDeveloperPet('owl');
  const next: PetState = {
    wolfOwned: local.wolfOwned || incoming.state.wolfOwned,
    catOwned: local.catOwned || incoming.state.catOwned,
    monkeyOwned: local.monkeyOwned || incoming.state.monkeyOwned,
    parrotOwned: local.parrotOwned || incoming.state.parrotOwned,
    owlOwned: local.owlOwned || incoming.state.owlOwned,
    wolfCoatIndex: !stale && incoming.hasWolfCoat && !developerOnlyWolf
      ? incoming.state.wolfCoatIndex
      : local.wolfCoatIndex,
    catCoatIndex: !stale && incoming.hasCatCoat && !developerOnlyCat
      ? incoming.state.catCoatIndex
      : local.catCoatIndex,
    monkeyCoatIndex: !stale && incoming.hasMonkeyCoat && !developerOnlyMonkey
      ? incoming.state.monkeyCoatIndex
      : local.monkeyCoatIndex,
    parrotCoatIndex: !stale && incoming.hasParrotCoat && !developerOnlyParrot
      ? incoming.state.parrotCoatIndex
      : local.parrotCoatIndex,
    owlCoatIndex: !stale && incoming.hasOwlCoat && !developerOnlyOwl
      ? incoming.state.owlCoatIndex
      : local.owlCoatIndex,
  };
  if (next.wolfOwned === local.wolfOwned && next.catOwned === local.catOwned && next.monkeyOwned === local.monkeyOwned && next.parrotOwned === local.parrotOwned && next.owlOwned === local.owlOwned
    && next.wolfCoatIndex === local.wolfCoatIndex && next.catCoatIndex === local.catCoatIndex && next.monkeyCoatIndex === local.monkeyCoatIndex
    && next.parrotCoatIndex === local.parrotCoatIndex && next.owlCoatIndex === local.owlCoatIndex) return;
  const normalized = normalizeState(next);
  if (!storageSet(STORAGE_KEY, JSON.stringify(normalized))) return;
  cached = normalized;
  if (JSON.stringify(cloudState(normalized)) !== JSON.stringify(cloudState(incoming.state))) {
    markProfileDirty({ pets: cloudState(normalized) });
  }
}

/** Test seam for isolated entitlement / cloud merge coverage. */
export function resetPetsForTests() {
  cached = emptyState();
  storageRemove(STORAGE_KEY);
}

registerCloudPart({
  collect: () => ({ pets: cloudState(state()) }),
  apply: (cloud) => applyCloudPetState(cloud.pets),
  mergeStale: (cloud) => applyCloudPetState(cloud.pets, true),
});
