const values = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => void values.set(key, String(value)),
  removeItem: (key: string) => void values.delete(key),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { developerShopClaims, grantDeveloperShopProduct, setDeveloperShopEnabled } = await import('../../src/game/devShop');
const { hasWolfPet, resetPetsForTests, setWolfCoatIndex } = await import('../../src/game/pets');
resetPetsForTests();
ok(developerShopClaims().length === 0, 'Тестовый магазин начинает со списка без выданных товаров');
ok(grantDeveloperShopProduct('pet-parrot'), 'Тестовый товар можно выдать бесплатно');
ok(developerShopClaims().includes('pet-parrot'), 'Выданный товар сохранён локально для проверки');
ok(!grantDeveloperShopProduct('pet-parrot'), 'Один тестовый товар нельзя случайно начислить дважды');
ok(developerShopClaims().length === 1, 'Повторная выдача не создаёт дубликат');
ok(!grantDeveloperShopProduct('not a product'), 'Некорректный ID товара отклоняется');
ok(grantDeveloperShopProduct('chest-common', true), 'Расходуемый SKU-припас можно выдать в developer-тесте');
ok(grantDeveloperShopProduct('chest-common', true), 'Повторная выдача расходуемого SKU допустима в developer-тесте');
ok(!developerShopClaims().includes('chest-common'), 'Повторяемый SKU не помечается как одноразовый товар');

ok(!hasWolfPet(), 'Developer claim is ignored unless the local developer shop is enabled');
setDeveloperShopEnabled(true);
ok(grantDeveloperShopProduct('pet-wolf'), 'The developer shop can grant its wolf test SKU');
ok(hasWolfPet(), 'A developer wolf claim unlocks the pet for a new test run');
ok(setWolfCoatIndex(4) === 4, 'Developer wolf test grants can cycle through the coat variants');
ok(JSON.parse(values.get('orerush.pets.v1') ?? 'null')?.wolfOwned !== true, 'The local wolf test claim does not write paid ownership into pet/cloud state');
setDeveloperShopEnabled(false);
ok(!hasWolfPet(), 'A developer-only wolf claim is ignored outside the developer shop mode');

export { passed, failures };
