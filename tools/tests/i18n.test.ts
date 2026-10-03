/**
 * Localization contract (Yandex Games requirements 2.14 and 8.2.3).
 *
 * The draft declares four languages (EN / RU / FR / DE), and moderation switches the game through
 * every declared language: "🚫 Если хотя бы один язык не переключился (полностью или частично) на
 * выбранный на debug-панели — игра будет отклонена за неперевод"
 * (https://yandex.ru/dev/games/doc/ru/requirements/2/14).
 *
 * This suite is the machine-checkable half of that promise:
 *   1. every language carries every key of the English dictionary (no silent fallback to EN);
 *   2. no value is empty and no placeholder (`{n}`, `{time}`…) is lost in translation;
 *   3. Russian uses Cyrillic and French/German do not use Cyrillic — the "double translation" rule;
 *   4. the data tables behind the block, recipe, mob, material and rarity names are translated too
 *      (those names never go through `t()`, they have their own maps);
 *   5. every `t('…')` literal in the sources points at a key that really exists;
 *   6. auto-detection follows the documented reserve sets: `ru` for be/kk/uk/uz, `en` otherwise.
 */

import { BLOCKS } from '../../src/game/blocks';
import { MOBS } from '../../src/game/mobs';
import { RECIPES } from '../../src/game/recipes';
import {
  LANGS,
  blockName,
  dictFor,
  getLang,
  initLang,
  isLang,
  matName,
  pickaxeLabel,
  rarName,
  recipeText,
  resolveLang,
  setLang,
  t,
  tierLabel,
  type Lang,
} from '../../src/game/i18n';
import { MATERIALS, RARITY } from '../../src/game/items';
import { storageGet, storageRemove, storageSet } from '../../src/game/storage';

/* ------------------------------- environment ------------------------------- */

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};
const g = globalThis as unknown as Record<string, unknown>;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const LANGS_CHECKED: Lang[] = ['ru', 'fr', 'de'];
const en = dictFor('en');
const keys = Object.keys(en).sort();

/* ------------------------------ 1. key parity ------------------------------ */

for (const lang of LANGS_CHECKED) {
  const dict = dictFor(lang);
  const dictKeys = Object.keys(dict).sort();
  const missing = keys.filter((k) => !(k in dict));
  const extra = dictKeys.filter((k) => !(k in en));
  ok(missing.length === 0, `Словарь ${lang} покрывает все ключи английского`, missing.slice(0, 10).join(', '));
  ok(extra.length === 0, `В словаре ${lang} нет лишних ключей`, extra.slice(0, 10).join(', '));
  ok(dictKeys.length === keys.length, `Словарь ${lang} того же размера, что и английский`, `${dictKeys.length} vs ${keys.length}`);
}

/* ------------------------ 2. values and placeholders ----------------------- */

const placeholders = (value: string) => [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort().join(',');

for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
  const dict = dictFor(lang);
  const empty = keys.filter((k) => !String(dict[k] ?? '').trim());
  ok(empty.length === 0, `В словаре ${lang} нет пустых строк`, empty.slice(0, 10).join(', '));
  // Cyrillic must not leak into the Latin dictionaries and vice versa (rule 8.2.3, «двойной перевод»)
  if (lang === 'ru') {
    const latinOnly = keys.filter((k) => {
      const value = String(dict[k] ?? '');
      const latin = (value.match(/[A-Za-z]/g) ?? []).length;
      return latin >= 3 && !/[А-Яа-яЁё]/.test(value);
    });
    ok(latinOnly.length === 0, 'Русские тексты написаны по-русски (без английских фраз)', latinOnly.slice(0, 10).join(', '));
  } else if (lang !== 'en') {
    const cyrillic = keys.filter((k) => /[А-Яа-яЁё]/.test(String(dict[k] ?? '')));
    ok(cyrillic.length === 0, `В словаре ${lang} нет кириллицы`, cyrillic.slice(0, 10).join(', '));
  }
}

for (const lang of LANGS_CHECKED) {
  const dict = dictFor(lang);
  const broken = keys.filter((k) => placeholders(String(en[k])) !== placeholders(String(dict[k])));
  ok(broken.length === 0, `Подстановки {…} сохранены в ${lang}`, broken.slice(0, 10).join(', '));
}

/**
 * Values that legitimately read the same in two languages: international words (FR «RARE»,
 * «NETHERITE»), abbreviations (EN/FR «pts»), Console badges that are proper nouns, and German
 * loanwords the Duden lists («Kills», «Skins»). Everything else that repeats the English text is a
 * missed translation.
 */
const SHARED_WITH_EN: Record<string, string[]> = {
  ru: [],
  fr: [
    'shopRarityRare',
    'shopPetCapybaraTitle',
    'objectiveReward',
    'squadBlocks',
    'promoBadge',
    'local',
    'pause',
    'score',
    'combo',
    'air',
    'mob_creeper',
    'mob_zombie',
    'upgradeNeth',
    'pts',
    'sesSprint',
    'sesMarathon',
  ],
  de: [
    'shop',
    'characterHairBob',
    'characterFaceCool',
    'characterFaceNeutral',
    'shopTabSkins',
    'shopPetCapybaraTitle',
    'shopSkinNomadTitle',
    'squadBlocks',
    'sprint',
    'pause',
    'kills',
    'aff_frost',
    'aff_magnet',
    'mob_creeper',
    'mob_zombie',
    'gold',
    'sesSprint',
    'sesMarathon',
  ],
};

for (const lang of LANGS_CHECKED) {
  const dict = dictFor(lang);
  const allowed = new Set(SHARED_WITH_EN[lang]);
  const missed = keys.filter((k) => {
    const value = String(dict[k] ?? '');
    return !allowed.has(k) && value === String(en[k]) && (value.match(/[A-Za-zА-Яа-яЁё]/g) ?? []).length >= 3;
  });
  ok(missed.length === 0, `В ${lang} нет строк, оставшихся английскими`, missed.slice(0, 10).join(', '));

  // uppercase headings must not have a stray lowercase letter inside («BOUgez»)
  const casing = keys.filter((k) => {
    const letters = String(dict[k] ?? '').replace(/\{[a-zA-Z0-9_]+\}/g, '').replace(/[^A-Za-zА-Яа-яЁё]/g, '');
    if (letters.length < 4) return false;
    const upper = (letters.match(/[A-ZА-ЯЁ]/g) ?? []).length;
    return upper / letters.length > 0.8 && /[a-zа-яё]/.test(letters);
  });
  ok(casing.length === 0, `В ${lang} нет случайной строчной буквы внутри заглавных надписей`, casing.slice(0, 10).join(', '));

  // common English gaming filler must not sit inside a translated sentence
  const anglicisms = keys.filter((k) => {
    const value = String(dict[k] ?? '');
    return /\b(rewarded|drops?|boosts?|boosters?|runs?)\b/i.test(value) || (lang === 'ru' && /дроп/i.test(value));
  });
  ok(anglicisms.length === 0, `В ${lang} нет английских игровых слов внутри перевода`, anglicisms.slice(0, 10).join(', '));
}

/* --------------------------- 3. data-table coverage ------------------------- */

const blockIds = Object.values(BLOCKS)
  .map((block) => block.id)
  .filter((id) => id !== 0); // AIR has no in-game label
for (const lang of LANGS_CHECKED) {
  setLang(lang);
  const untranslated = blockIds.filter((id) => blockName(id, '__EN__') === '__EN__');
  ok(untranslated.length === 0, `Названия всех блоков переведены (${lang})`, untranslated.slice(0, 10).join(', '));

  const missingRecipes = RECIPES.filter((recipe) => {
    const [name, desc] = recipeText(recipe.key, '__EN_NAME__', '__EN_DESC__');
    // tool recipes deliberately take their name/description from the localized tool label
    return name === '__EN_NAME__' && desc === '__EN_DESC__';
  }).map((recipe) => recipe.key);
  ok(missingRecipes.length === 0, `Все рецепты переведены (${lang})`, missingRecipes.slice(0, 10).join(', '));

  const mobs = Object.values(MOBS).filter((mob) => !String(t(mob.nameKey)).trim() || t(mob.nameKey) === mob.nameKey);
  ok(mobs.length === 0, `Имена всех мобов переведены (${lang})`, mobs.map((m) => m.id).join(', '));

  // materials and rarities have their own maps; a handful of words are international
  // (FR «NETHERITE», DE «GOLD»), so the expected wording is spelled out per language
  const materialExpect: Record<string, Record<string, string>> = {
    ru: { LEATHER: 'КОЖА', IRON: 'ЖЕЛЕЗО', GOLD: 'ЗОЛОТО', DIAMOND: 'АЛМАЗ', WOOD: 'ДЕРЕВО', STONE: 'КАМЕНЬ', NETHERITE: 'НЕЗЕРИТ' },
    fr: { LEATHER: 'CUIR', IRON: 'FER', GOLD: 'OR', DIAMOND: 'DIAMANT', WOOD: 'BOIS', STONE: 'PIERRE', NETHERITE: 'NETHERITE' },
    de: { LEATHER: 'LEDER', IRON: 'EISEN', GOLD: 'GOLD', DIAMOND: 'DIAMANT', WOOD: 'HOLZ', STONE: 'STEIN', NETHERITE: 'NETHERIT' },
  };
  const rarityExpect: Record<string, string[]> = {
    ru: ['ОБЫЧНЫЙ', 'ПРОЧНЫЙ', 'РЕДКИЙ', 'МИФИЧЕСКИЙ'],
    fr: ['COMMUN', 'SOLIDE', 'RARE', 'MYTHIQUE'],
    de: ['GEWÖHNLICH', 'ROBUST', 'SELTEN', 'MYTHISCH'],
  };
  const badMaterials = Object.values(MATERIALS).filter((m) => matName(m.label) !== materialExpect[lang][m.label]);
  ok(badMaterials.length === 0, `Названия материалов переведены (${lang})`, badMaterials.map((m) => `${m.label}=${matName(m.label)}`).join(', '));

  const badRarities = RARITY.map((r, i) => rarName(i, r.name)).filter((name, i) => name !== rarityExpect[lang][i]);
  ok(badRarities.length === 0, `Редкости переведены (${lang})`, badRarities.join(', '));

  const tiers = [0, 1, 2, 3, 4, 5].map((i) => tierLabel(i));
  ok(tiers.every(Boolean) && new Set(tiers).size === tiers.length, `Ступени инструментов переведены (${lang})`, tiers.join(', '));
  ok(pickaxeLabel(0) !== t('tier_wood'), `Кирка собирает название из локализованной ступени (${lang})`, pickaxeLabel(0));
}

setLang('en');

/* -------------------------- 4. t() call sites exist ------------------------- */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// the suite is bundled into a temp file and executed by tools/tests/run.mjs with the repo root as cwd
const ROOT = process.cwd();
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

const unknownKeys = new Set<string>();
for (const file of sourceFiles(path.join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) {
    if (!(match[1] in en)) unknownKeys.add(`${path.relative(ROOT, file)}: ${match[1]}`);
  }
}
ok(unknownKeys.size === 0, 'Все вызовы t(\'…\') ссылаются на существующие ключи', [...unknownKeys].slice(0, 10).join(', '));

/* ------------------------ 5. language auto-detection ------------------------ */

ok(resolveLang('ru') === 'ru' && resolveLang('ru-RU') === 'ru', 'Код ru распознан');
ok(resolveLang('en-US') === 'en' && resolveLang('en') === 'en', 'Код en распознан');
ok(resolveLang('fr-CA') === 'fr' && resolveLang('de-AT') === 'de', 'Коды fr и de распознаны с регионом');
for (const code of ['be', 'kk', 'uk', 'uz', 'uk-UA', 'kk-KZ']) {
  ok(resolveLang(code) === 'ru', `Резервный язык для ${code} — русский (документация, наборы языков)`);
}
for (const code of ['tr', 'ja', 'zh', 'es', 'pl', 'ar', '']) {
  ok(resolveLang(code) === 'en', `Резервный язык для «${code}» — английский`);
}
ok(resolveLang(null) === 'en' && resolveLang(undefined) === 'en', 'Пустой код языка не ломает автоопределение');
ok(isLang('ru') && isLang('de') && !isLang('uk') && !isLang(42), 'isLang принимает только четыре языка игры');

ok(LANGS.length === 4 && LANGS.map((l) => l.id).join(',') === 'en,ru,fr,de', 'В игре ровно четыре языка', LANGS.map((l) => l.id).join(','));
const endonyms: Record<string, string> = { en: 'ENGLISH', ru: 'РУССКИЙ', fr: 'FRANÇAIS', de: 'DEUTSCH' };
for (const entry of LANGS) {
  ok(entry.label === endonyms[entry.id], `Название языка ${entry.id} написано на нём самом (п. 8.2.3)`, entry.label);
  ok(entry.flag === entry.id.toUpperCase(), `Метка языка ${entry.id} совпадает с кодом ISO 639-1`);
}
ok(new Set(LANGS.map((l) => l.label)).size === 4, 'Названия языков в переключателе уникальны');

/* --------------------------- 6. switcher round-trip ------------------------- */

storageRemove('orerush.lang');
setLang('fr');
ok(getLang() === 'fr' && storageGet('orerush.lang') === 'fr', 'Ручной выбор языка сохраняется в хранилище');
storageRemove('orerush.lang');
Object.defineProperty(globalThis, 'navigator', { value: { language: 'uk-UA' }, configurable: true });
ok(initLang() === 'ru', 'Без сохранённого выбора браузерный uk-UA даёт русский язык');
Object.defineProperty(globalThis, 'navigator', { value: { language: 'tr-TR' }, configurable: true });
ok(initLang() === 'en', 'Без сохранённого выбора браузерный tr-TR даёт английский язык');
storageSet('orerush.lang', 'de');
ok(initLang() === 'de', 'Сохранённый выбор игрока важнее автоопределения');
storageRemove('orerush.lang');
setLang('en');

export { passed, failures };
