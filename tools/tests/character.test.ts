const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
};
const global = globalThis as unknown as Record<string, unknown>;
global.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
global.document = { title: '', documentElement: { lang: '' } };

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const {
  CHARACTER_COLORS,
  CHARACTER_EXPRESSIONS,
  CHARACTER_GLASSES,
  CHARACTER_HAIRSTYLES,
  DEFAULT_CHARACTER_CUSTOMIZATION, 
  randomCharacterCustomization,
  getCharacterCustomization,
  sanitizeCharacterCustomization,
  saveCharacterCustomization,
} = await import('../../src/game/character');

const clean = sanitizeCharacterCustomization({
  gender: 'girl',
  shirtColor: '#e2564a',
  pantsColor: '#493443',
  shoeType: 'sandals',
  shoeColor: '#54b7ba',
  hairstyle: 'twinTails',
  hairColor: '#b83f35',
  skinColor: '#8d563d',
  expression: 'thoughtful',
  glasses: 'round',
});
ok(clean.gender === 'girl' && clean.shoeType === 'sandals' && clean.hairstyle === 'twinTails', 'Допустимые параметры конструктора сохраняются');
ok(clean.shirtColor === '#e2564a' && clean.hairColor === '#b83f35' && clean.skinColor === '#8d563d' && clean.expression === 'thoughtful' && clean.glasses === 'round', 'Цвета, текстурное выражение и очки проходят проверку');

const invalid = sanitizeCharacterCustomization({ gender: 'alien', shirtColor: '#ffffff', shoeType: 'hoverboard', hairstyle: 'alienHair', glasses: 'laser', expression: 'alienFace' });
ok(invalid.gender === DEFAULT_CHARACTER_CUSTOMIZATION.gender, 'Неизвестный тип персонажа безопасно заменяется значением по умолчанию');
ok(invalid.shirtColor === DEFAULT_CHARACTER_CUSTOMIZATION.shirtColor, 'Облачные цвета вне палитры не принимаются');
ok(invalid.shoeType === DEFAULT_CHARACTER_CUSTOMIZATION.shoeType && invalid.expression === DEFAULT_CHARACTER_CUSTOMIZATION.expression && invalid.glasses === DEFAULT_CHARACTER_CUSTOMIZATION.glasses, 'Неизвестные обувь, лицо и очки заменяются значениями по умолчанию');
ok(invalid.hairstyle === DEFAULT_CHARACTER_CUSTOMIZATION.hairstyle, 'Неизвестная причёска заменяется значением по умолчанию');
ok(CHARACTER_COLORS.shirt.some((color) => color === clean.shirtColor) && CHARACTER_EXPRESSIONS.some(({ id }) => id === clean.expression), 'Варианты интерфейса совпадают с поддерживаемой моделью');
ok(CHARACTER_HAIRSTYLES.length >= 9 && CHARACTER_GLASSES.length === 4 && CHARACTER_COLORS.hair.length >= 6, 'Расширенные варианты волос и очков доступны конструктору');

const oldProfile = sanitizeCharacterCustomization({ gender: 'girl', hairstyle: 'long', expression: 'wink' });
ok(oldProfile.hairColor === DEFAULT_CHARACTER_CUSTOMIZATION.hairColor && oldProfile.glasses === 'none', 'Старые облачные облики автоматически получают новые настройки по умолчанию');
const seededBot = randomCharacterCustomization('survival-bot-1');
ok(JSON.stringify(seededBot) === JSON.stringify(randomCharacterCustomization('survival-bot-1')), 'Скин бота воспроизводим в пределах одного забега');
ok(JSON.stringify(seededBot) !== JSON.stringify(randomCharacterCustomization('survival-bot-2')), 'Разные survival-боты получают разные случайные облики');

saveCharacterCustomization(clean);
const restored = getCharacterCustomization();
ok(JSON.stringify(restored) === JSON.stringify(clean), 'Выбранный персонаж сразу сохраняется локально для следующего запуска');
ok(storage.has('orerush.character.v1'), 'Настройки лежат в отдельном ключе, независимо от мира и инвентаря');

export { passed, failures };
