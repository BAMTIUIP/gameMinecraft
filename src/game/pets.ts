import { markProfileDirty, registerCloudPart } from './profile';
import { developerShopClaims, isDeveloperShopEnabled } from './devShop';
import { storageGet, storageRemove, storageSet } from './storage';
import type { TKey } from './i18n';

export type PetKind = 'wolf' | 'monkey';

/** Permanent Yandex Console SKUs for the account-restored companions. */
export const WOLF_PET_PRODUCT_ID = 'pet-wolf' as const;
export const MONKEY_PET_PRODUCT_ID = 'pet-monkey' as const;
export const PET_PRODUCT_IDS = [WOLF_PET_PRODUCT_ID, MONKEY_PET_PRODUCT_ID] as const;

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

const STORAGE_KEY = 'orerush.pets.v1';
type PetState = {
  wolfOwned: boolean;
  monkeyOwned: boolean;
  wolfCoatIndex: number;
  monkeyCoatIndex: number;
};
let cached: PetState | undefined;

const emptyState = (): PetState => ({ wolfOwned: false, monkeyOwned: false, wolfCoatIndex: 0, monkeyCoatIndex: 0 });

export function normalizeWolfCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < WOLF_COATS.length ? index : 0;
}

export function normalizeMonkeyCoatIndex(value: unknown): number {
  const index = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  return Number.isInteger(index) && index >= 0 && index < MONKEY_COATS.length ? index : 0;
}

function normalizeState(value: unknown): PetState {
  if (!value || typeof value !== 'object') return emptyState();
  const raw = value as {
    owned?: unknown;
    wolfOwned?: unknown;
    monkeyOwned?: unknown;
    wolfCoatIndex?: unknown;
    monkeyCoatIndex?: unknown;
  };
  const ownedList = Array.isArray(raw.owned) ? raw.owned : [];
  return {
    wolfOwned: raw.wolfOwned === true || ownedList.includes('wolf'),
    monkeyOwned: raw.monkeyOwned === true || ownedList.includes('monkey'),
    wolfCoatIndex: normalizeWolfCoatIndex(raw.wolfCoatIndex),
    monkeyCoatIndex: normalizeMonkeyCoatIndex(raw.monkeyCoatIndex),
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
  return kind === 'wolf' ? WOLF_PET_PRODUCT_ID : MONKEY_PET_PRODUCT_ID;
}

function hasDeveloperPet(kind: PetKind): boolean {
  return isDeveloperShopEnabled() && developerShopClaims().includes(productIdFor(kind));
}

function cloudState(value: PetState) {
  return {
    owned: [value.wolfOwned && 'wolf', value.monkeyOwned && 'monkey'].filter(Boolean),
    // Appearance has no cloud meaning unless its permanent Yandex entitlement is owned.
    wolfCoatIndex: value.wolfOwned ? value.wolfCoatIndex : 0,
    monkeyCoatIndex: value.monkeyOwned ? value.monkeyCoatIndex : 0,
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
  return (kind === 'wolf' ? current.wolfOwned : current.monkeyOwned) || hasDeveloperPet(kind);
}
export function hasWolfPet(): boolean { return hasPet('wolf'); }
export function hasMonkeyPet(): boolean { return hasPet('monkey'); }

/** Permanently unlock a companion. Repeating a restore is idempotent. */
export function unlockPet(kind: PetKind): boolean {
  const current = state();
  if (kind === 'wolf') return current.wolfOwned || write({ ...current, wolfOwned: true });
  return current.monkeyOwned || write({ ...current, monkeyOwned: true });
}
export function unlockWolfPet(): boolean { return unlockPet('wolf'); }
export function unlockMonkeyPet(): boolean { return unlockPet('monkey'); }

export function getPetCoatIndex(kind: PetKind): number {
  return kind === 'wolf' ? state().wolfCoatIndex : state().monkeyCoatIndex;
}
export function getWolfCoatIndex(): number { return getPetCoatIndex('wolf'); }
export function getMonkeyCoatIndex(): number { return getPetCoatIndex('monkey'); }

export function setPetCoatIndex(kind: PetKind, index: number): number {
  const current = state();
  const owned = hasPet(kind);
  const nextIndex = kind === 'wolf' ? normalizeWolfCoatIndex(index) : normalizeMonkeyCoatIndex(index);
  const currentIndex = kind === 'wolf' ? current.wolfCoatIndex : current.monkeyCoatIndex;
  if (!owned || currentIndex === nextIndex) return currentIndex;
  const next = kind === 'wolf'
    ? { ...current, wolfCoatIndex: nextIndex }
    : { ...current, monkeyCoatIndex: nextIndex };
  const permanentlyOwnedForKind = kind === 'wolf' ? current.wolfOwned : current.monkeyOwned;
  if (!permanentlyOwnedForKind) {
    // Developer-shop pets are local-only test grants; keep their appearance local too.
    if (!storageSet(STORAGE_KEY, JSON.stringify(normalizeState(next)))) return currentIndex;
    cached = normalizeState(next);
    return nextIndex;
  }
  return write(next) ? nextIndex : currentIndex;
}
export function setWolfCoatIndex(index: number): number { return setPetCoatIndex('wolf', index); }
export function setMonkeyCoatIndex(index: number): number { return setPetCoatIndex('monkey', index); }

function readRemote(value: unknown): { state: PetState; hasWolfCoat: boolean; hasMonkeyCoat: boolean } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { owned?: unknown; wolfOwned?: unknown; monkeyOwned?: unknown; wolfCoatIndex?: unknown; monkeyCoatIndex?: unknown };
  const normalized = normalizeState(raw);
  return {
    state: normalized,
    hasWolfCoat: Number.isInteger(raw.wolfCoatIndex)
      && Number(raw.wolfCoatIndex) >= 0
      && Number(raw.wolfCoatIndex) < WOLF_COATS.length,
    hasMonkeyCoat: Number.isInteger(raw.monkeyCoatIndex)
      && Number(raw.monkeyCoatIndex) >= 0
      && Number(raw.monkeyCoatIndex) < MONKEY_COATS.length,
  };
}

/** Ownership is monotonic; an older cloud snapshot can never revoke a paid companion. */
export function applyCloudPetState(value: unknown, stale = false): void {
  const incoming = readRemote(value);
  if (!incoming) return;
  const local = state();
  const developerOnlyWolf = !local.wolfOwned && !incoming.state.wolfOwned && hasDeveloperPet('wolf');
  const developerOnlyMonkey = !local.monkeyOwned && !incoming.state.monkeyOwned && hasDeveloperPet('monkey');
  const next: PetState = {
    wolfOwned: local.wolfOwned || incoming.state.wolfOwned,
    monkeyOwned: local.monkeyOwned || incoming.state.monkeyOwned,
    wolfCoatIndex: !stale && incoming.hasWolfCoat && !developerOnlyWolf
      ? incoming.state.wolfCoatIndex
      : local.wolfCoatIndex,
    monkeyCoatIndex: !stale && incoming.hasMonkeyCoat && !developerOnlyMonkey
      ? incoming.state.monkeyCoatIndex
      : local.monkeyCoatIndex,
  };
  if (next.wolfOwned === local.wolfOwned && next.monkeyOwned === local.monkeyOwned
    && next.wolfCoatIndex === local.wolfCoatIndex && next.monkeyCoatIndex === local.monkeyCoatIndex) return;
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
