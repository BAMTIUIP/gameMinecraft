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

const { developerShopClaims, grantDeveloperShopProduct } = await import('../../src/game/devShop');
ok(developerShopClaims().length === 0, 'Тестовый магазин начинает со списка без выданных товаров');
ok(grantDeveloperShopProduct('pet-parrot'), 'Тестовый товар можно выдать бесплатно');
ok(developerShopClaims().includes('pet-parrot'), 'Выданный товар сохранён локально для проверки');
ok(!grantDeveloperShopProduct('pet-parrot'), 'Один тестовый товар нельзя случайно начислить дважды');
ok(developerShopClaims().length === 1, 'Повторная выдача не создаёт дубликат');
ok(!grantDeveloperShopProduct('not a product'), 'Некорректный ID товара отклоняется');
ok(grantDeveloperShopProduct('chest-common', true), 'Расходуемый SKU-припас можно выдать в developer-тесте');
ok(grantDeveloperShopProduct('chest-common', true), 'Повторная выдача расходуемого SKU допустима в developer-тесте');
ok(!developerShopClaims().includes('chest-common'), 'Повторяемый SKU не помечается как одноразовый товар');

export { passed, failures };
