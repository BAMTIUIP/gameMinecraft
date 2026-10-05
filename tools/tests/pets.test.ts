/** Permanent wolf ownership, cloud merge semantics and the nine selectable coat variants. */
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
};
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const {
  MONKEY_COATS,
  OWL_COATS,
  PARROT_COATS,
  WOLF_COATS,
  applyCloudPetState,
  getMonkeyCoatIndex,
  getOwlCoatIndex,
  getParrotCoatIndex,
  getWolfCoatIndex,
  getPetInventoryKinds,
  hasMonkeyPet,
  hasOwlPet,
  hasParrotPet,
  hasWolfPet,
  normalizeMonkeyCoatIndex,
  normalizeOwlCoatIndex,
  normalizeParrotCoatIndex,
  normalizeWolfCoatIndex,
  refreshPetStateFromStorage,
  resetPetsForTests,
  setMonkeyCoatIndex,
  setOwlCoatIndex,
  setParrotCoatIndex,
  setWolfCoatIndex,
  unlockMonkeyPet,
  unlockOwlPet,
  unlockParrotPet,
  unlockWolfPet,
} = await import('../../src/game/pets');
const { PARROT_VARIANTS } = await import('../../src/game/parrotVariants');
const { OWL_VARIANTS } = await import('../../src/game/owlVariants');

resetPetsForTests();
ok(WOLF_COATS.length === 9, 'All nine reference-inspired wolf coats are available');
ok(MONKEY_COATS.length >= 4, 'The monkey has several independent fur-color variants');
ok(PARROT_COATS.length === 6 && PARROT_COATS.map((coat) => coat.id).join(',') === PARROT_VARIANTS.map((coat) => coat.id).join(','), 'The six pet coats are exactly the variants used by wild parrots');
ok(OWL_COATS.length === 6 && OWL_COATS.map((coat) => coat.id).join(',') === OWL_VARIANTS.map((coat) => coat.id).join(','), 'The six eagle owl plumages are available');
ok(!hasWolfPet(), 'A new profile does not own a wolf');
ok(!hasMonkeyPet(), 'A new profile does not own a monkey');
ok(!hasParrotPet(), 'A new profile does not own a parrot');
ok(!hasOwlPet(), 'A new profile does not own an owl');
ok(unlockWolfPet() && hasWolfPet(), 'Unlocking the pet creates permanent ownership');
ok(unlockMonkeyPet() && hasMonkeyPet(), 'The monkey has its own permanent entitlement');
ok(unlockParrotPet() && hasParrotPet(), 'The parrot has its own permanent entitlement');
ok(unlockOwlPet() && hasOwlPet(), 'The owl has its own permanent entitlement');
ok(getPetInventoryKinds(['wolf', 'monkey', 'parrot', 'owl'], 'wolf').join(',') === 'monkey,parrot,owl', 'Equipping the wolf leaves the other species tokens in the inventory list');
ok(getPetInventoryKinds(['wolf', 'monkey', 'parrot', 'owl'], 'owl').join(',') === 'wolf,monkey,parrot', 'Equipping the owl returns the other tokens to inventory');
ok(getPetInventoryKinds(['wolf', 'wolf', 'monkey']).join(',') === 'wolf,monkey', 'Species tokens are unique even if a saved ownership list contains duplicates');
ok(JSON.parse(storage.get('orerush.pets.v1') ?? '{}').wolfOwned === true
  && JSON.parse(storage.get('orerush.pets.v1') ?? '{}').monkeyOwned === true
  && JSON.parse(storage.get('orerush.pets.v1') ?? '{}').parrotOwned === true
  && JSON.parse(storage.get('orerush.pets.v1') ?? '{}').owlOwned === true, 'All permanent entitlements are stored locally');

ok(setWolfCoatIndex(8) === 8 && getWolfCoatIndex() === 8, 'The selected wolf coat is persisted for the player');
ok(setMonkeyCoatIndex(5) === 5 && getMonkeyCoatIndex() === 5, 'The monkey palette index is persisted independently of the wolf');
ok(setParrotCoatIndex(5) === 5 && getParrotCoatIndex() === 5, 'The parrot palette index is persisted independently of the other pets');
ok(setOwlCoatIndex(4) === 4 && getOwlCoatIndex() === 4, 'The owl plumage index is persisted independently of the other pets');
ok(normalizeWolfCoatIndex(-1) === 0 && normalizeWolfCoatIndex(99) === 0, 'Invalid wolf coat indices normalize safely');
ok(normalizeMonkeyCoatIndex(-1) === 0 && normalizeMonkeyCoatIndex(99) === 0, 'Invalid monkey coat indices normalize safely');
ok(normalizeParrotCoatIndex(-1) === 0 && normalizeParrotCoatIndex(99) === 0, 'Invalid parrot coat indices normalize safely');
ok(normalizeOwlCoatIndex(-1) === 0 && normalizeOwlCoatIndex(99) === 0, 'Invalid owl coat indices normalize safely');

applyCloudPetState({ owned: [], wolfCoatIndex: 2 }, true);
ok(hasWolfPet() && getWolfCoatIndex() === 8, 'A stale cloud snapshot cannot revoke ownership or overwrite the local coat');
applyCloudPetState({ owned: [], wolfCoatIndex: 4 });
ok(hasWolfPet() && getWolfCoatIndex() === 4, 'A fresh cloud snapshot may update the coat but cannot revoke ownership');
applyCloudPetState({ owned: ['wolf'], wolfCoatIndex: 6 });
ok(hasWolfPet() && getWolfCoatIndex() === 6, 'Cloud ownership and coat selection restore together');

// Force a cache reload to ensure the local saved entitlement is enough for a later run.
refreshPetStateFromStorage();
ok(hasWolfPet() && getWolfCoatIndex() === 6 && hasMonkeyPet() && getMonkeyCoatIndex() === 5
  && hasParrotPet() && getParrotCoatIndex() === 5 && hasOwlPet() && getOwlCoatIndex() === 4, 'All pet entitlements and independent appearances survive a storage refresh');

// Legacy cloud snapshots used a wolf-only boolean rather than the multi-species ownership list.
resetPetsForTests();
applyCloudPetState({ wolfOwned: true, wolfCoatIndex: 3 });
ok(hasWolfPet() && !hasMonkeyPet() && getWolfCoatIndex() === 3, 'Legacy wolf-only cloud ownership restores without inventing a monkey');

export { passed, failures }; 
