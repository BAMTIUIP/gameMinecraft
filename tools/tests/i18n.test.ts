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

import { GAME_NAME, GAME_NAME_LINES } from '../../src/game/brand';
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
  toolLabelForId,
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

/* ---------------- 0. no development leftovers in the texts (1.15) ----------- */

/**
 * Requirement 1.15: the game must look finished. A "Coming soon" / "Скоро появится" / "Bientôt
 * disponible" / "Kommt bald" line, a `beta` or a `TODO` is exactly the marker moderation rejects a
 * draft for, so no dictionary may carry one.
 */
const UNFINISHED = /(coming soon|bient[oô]t disponible|kommt bald|скоро появ|в разработке|заглушка|черновик|\bbeta\b|\bwip\b|\btodo\b|\btbd\b|not implemented|placeholder)/i;

for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
  const dict = dictFor(lang);
  const marked = keys.filter((k) => UNFINISHED.test(String(dict[k] ?? '')));
  ok(marked.length === 0, `В словаре ${lang} нет текстов «в разработке»`, marked.slice(0, 10).join(', '));
}

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

/* ----------- 1b. no technical text leaks onto the screen (1.14) ----------- */

/**
 * Requirement 1.14 rejects «технические надписи на экране». `t()` falls back to the raw key when a
 * key is missing, and `toolLabelForId()` used to fall back to `TOOL #207` for a legacy id — both put
 * code on the player's screen. Every `t()` call in the game is a literal key that section 1 already
 * proves exists, so the remaining leak was that fallback.
 */
{
  const technical = keys.filter((k) => /#\s*\d/.test(String(en[k] ?? '')));
  ok(technical.length === 0, 'В английском словаре нет технических пометок вида «#207»', technical.slice(0, 10).join(', '));
  for (const lang of LANGS_CHECKED) {
    const dict = dictFor(lang);
    const marked = keys.filter((k) => /#\s*\d/.test(String(dict[k] ?? '')));
    ok(marked.length === 0, `В словаре ${lang} нет технических пометок вида «#207»`, marked.slice(0, 10).join(', '));
  }
}

/**
 * A legacy save or a hand-edited profile can still carry a tool id the game no longer ships.
 * Requirement 1.14 forbids technical text on screen, so such a label must degrade to a translated
 * «unknown tool» and never to `TOOL #207`.
 */
{
  const unknownIds = [-1, 0, 1, 42, 199, 9999];
  for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
    setLang(lang);
    for (const id of unknownIds) {
      const label = toolLabelForId(id);
      ok(!/#\s*\d/.test(label) && !/\d/.test(label), `Неизвестный инструмент ${id} на ${lang} подписан без технических цифр`, label);
      ok(label.trim().length > 0, `Подпись неизвестного инструмента ${id} на ${lang} не пустая`, label);
    }
  }
  setLang('en');
  ok(toolLabelForId(9999) === toolLabelForId(9998), 'Любой неизвестный id даёт одну и ту же подпись', `${toolLabelForId(9999)} vs ${toolLabelForId(9998)}`);
  ok(toolLabelForId(202) === t('handTorch'), 'id 202 — ручной факел, а не «неизвестный инструмент»', toolLabelForId(202));
}

/* ---------------- 1c. the game's name is the same everywhere (5.1.3) ---------------- */

/**
 * Requirement 5.1.3: the name has to be identical in the game and in every draft material, in every
 * declared language. A translator who «improves» it in one dictionary, or a tagline that replaces the
 * name instead of following it, is a rejection. Only the tagline after the name may be translated.
 */
{
  ok(GAME_NAME_LINES.join(' ') === GAME_NAME, 'Логотип меню складывается в название игры', GAME_NAME_LINES.join(' '));
  for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
    const dict = dictFor(lang);
    const title = String(dict.docTitle ?? '');
    ok(title.startsWith(`${GAME_NAME} `), `Заголовок страницы на ${lang} начинается с названия игры`, title);
    ok(title.length > GAME_NAME.length, `После названия на ${lang} идёт переведённая подпись жанра`, title);
    const share = String(dict.shareTemplate ?? '');
    ok(share.includes(GAME_NAME), `Текст «поделиться» на ${lang} содержит точное название игры`, share);
  }
  // the shell's <title> is what a player sees before the dictionaries load: it must carry the same name
  const shell = readFileSync('index.html', 'utf8');
  const shellTitle = /<title>([^<]*)<\/title>/.exec(shell)?.[1] ?? '';
  ok(shellTitle.startsWith(`${GAME_NAME} `), 'index.html объявляет то же название игры', shellTitle);
}

/* --------- 1d. no English left in the Russian texts (8.2.3) --------- */

/**
 * Requirement 8.2.3: «двойной перевод недопустим» — the text in the game has to match the chosen
 * language. The documentation lists what may stay untranslated: key names, abbreviations, proper
 * names without an official translation, UI additions (AD / NEW) and the game's own name. Everything
 * else that is written in Latin letters inside the Russian dictionary is an English label that a
 * player would read instead of Russian.
 *
 * Placeholders are stripped first: `{count}` or `{time}` are variable names, not on-screen text.
 */
{
  const ALLOWED = new Set([
    // the game's own name (requirement 5.1.3) — it is never translated
    'ORE', 'RUSH',
    // key names — the documentation does not ask for them to be translated
    'TAB', 'ESC', 'CTRL', 'ALT', 'SHIFT', 'ENTER', 'SPACE',
    // abbreviations and UI additions
    'DEV', 'AD', 'NEW', 'FPS', 'SDK', 'ID', 'OK',
    // proper names
    'YANDEX', 'GAMES',
  ]);
  const placeholders = /\{[a-zA-Z0-9_]+\}/g;
  const ru = dictFor('ru');
  const english: string[] = [];
  // the dictionary's own keys, not the English ones: a label that exists only in Russian is still shown
  for (const key of Object.keys(ru)) {
    const value = String(ru[key] ?? '').replace(placeholders, ' ');
    for (const match of value.matchAll(/[A-Za-z][A-Za-z'’-]{1,}/g)) {
      if (!ALLOWED.has(match[0].toUpperCase())) english.push(`${key}: ${match[0]}`);
    }
  }
  ok(english.length === 0, 'В русском словаре нет непереведённых английских надписей (п. 8.2.3)', english.slice(0, 12).join(', '));
}

/* --------- 1e. no erotica and no insults in any language (8.3.5) --------- */

/**
 * Requirement 8.3.5 (https://yandex.ru/dev/games/doc/ru/requirements/8/3/5): neither the game nor its
 * materials may carry erotic content, objects imitating genitals, calls to undress, or anything
 * insulting a person or a group by sex, nationality or religion. The texts of the game are the only
 * part of that this repository owns, so every dictionary is scanned for it.
 *
 * The list is deliberately short and unambiguous — whole words only, no substrings. A substring search
 * is useless here: German «Bruststück» (a piece of armour) contains «brust», French «ci-dessous»
 * contains «dessous», and English «Striped» contains «strip». Anything vague enough to need a human
 * judgement is left to the manual check described in the README.
 */
{
  const FORBIDDEN = [
    // explicit / erotic
    'porn', 'erotic', 'erotik', 'nude', 'nackt', 'naked', 'lingerie', 'dessous', 'strip', 'breast',
    'brust', 'poitrine', 'buttock', 'genital', 'penis', 'vagina', 'orgasm', 'masturbat', 'fetish',
    'sexy', 'seduction', 'topless', 'nsfw', 'sex', 'adult', '18+',
    'секс', 'эротик', 'порно', 'нюд', 'голый', 'голая', 'огол', 'раздева', 'раздень', 'разделся',
    'белье', 'интим', 'взросл',
    // insults by sex, nationality or religion
    'жид', 'хач', 'чурк', 'нацист', 'фашист', 'расист',
    'nigger', 'faggot', 'retard', 'bitch', 'whore', 'slut',
  ];
  const boundary = (word) =>
    new RegExp(`(?<![A-Za-zÀ-ÿА-Яа-я0-9-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÀ-ÿА-Яа-я0-9-])`, 'i');
  const found: string[] = [];
  for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
    const dict = dictFor(lang);
    for (const key of Object.keys(dict)) {
      const value = String(dict[key] ?? '');
      for (const word of FORBIDDEN) {
        if (boundary(word).test(value)) found.push(`${lang}:${key}: ${word}`);
      }
    }
  }
  ok(found.length === 0, 'Ни в одном словаре нет эротики и оскорблений (п. 8.3.5)', found.slice(0, 12).join(', '));
}

/* ------- 1f. no toilet or otherwise unpleasant content (8.3.6) ------- */

/**
 * Requirement 8.3.6 (https://yandex.ru/dev/games/doc/ru/requirements/8/3/6): the media materials must
 * be safe for every age, and a game whose materials focus on toilet content, scary characters or blood
 * is taken down. The texts are the part of that this repository owns.
 *
 * Whole words only, and «pet» is deliberately absent from the English list: the game sells animal
 * companions, and a substring or over-eager root would flag the shop.
 */
{
  const UNPLEASANT = [
    // toilet content — the documentation names faeces, the processes, the attributes and the words
    'какашк', 'фекал', 'мочеиспус', 'дефека', 'унитаз', 'скибиди', 'пука', 'пердел', 'говн', 'дерьм',
    'подгузн', 'сперм', 'рвот', 'блеват',
    'poop', 'feces', 'fecal', 'urine', 'urination', 'defecat', 'toilet', 'skibidi', 'fart', 'diaper',
    'sperm', 'vomit', 'puke', 'sewage',
    'caca', 'crotte', 'pipi', 'prout', 'toilette', 'vomi',
    'kacke', 'kot', 'scheiss', 'urin', 'furz', 'windel', 'kotze', 'erbrochen', 'klo',
  ];
  const boundary = (word) =>
    new RegExp(`(?<![A-Za-zÀ-ÿА-Яа-я0-9-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-zÀ-ÿА-Яа-я0-9-])`, 'i');
  const found: string[] = [];
  for (const lang of ['en', ...LANGS_CHECKED] as Lang[]) {
    const dict = dictFor(lang);
    for (const key of Object.keys(dict)) {
      const value = String(dict[key] ?? '');
      for (const word of UNPLEASANT) {
        if (boundary(word).test(value)) found.push(`${lang}:${key}: ${word}`);
      }
    }
  }
  ok(found.length === 0, 'Ни в одном словаре нет туалетной и неприятной лексики (п. 8.3.6)', found.slice(0, 12).join(', '));
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
 * «NETHERITE»), official Minecraft mob names, abbreviations (EN/FR «pts»), Console badges that are
 * proper nouns, and German loanwords the Duden lists («Kills», «Skins»). Everything else that repeats
 * the English text is a missed translation.
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
    'mob_blaze',
    'mob_enderman',
    'mob_ghast',
    'mob_phantom',
    'mob_slime',
    'petCatCoatOcelot', // «ocelot» is the French animal name too
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
    'mob_enderman',
    'mob_ghast',
    'mob_phantom',
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
    ru: { LEATHER: 'КОЖА', IRON: 'ЖЕЛЕЗО', GOLD: 'ЗОЛОТО', DIAMOND: 'АЛМАЗ', WOOD: 'ДЕРЕВО', STONE: 'КАМЕНЬ', NETHERITE: 'НЕЗЕРИТ', REDSTONE: 'РЕДСТОУН', LAPIS: 'ЛАЗУРИТ', EMERALD: 'ИЗУМРУД' },
    fr: { LEATHER: 'CUIR', IRON: 'FER', GOLD: 'OR', DIAMOND: 'DIAMANT', WOOD: 'BOIS', STONE: 'PIERRE', NETHERITE: 'NETHERITE', REDSTONE: 'REDSTONE', LAPIS: 'LAPIS-LAZULI', EMERALD: 'ÉMERAUDE' },
    de: { LEATHER: 'LEDER', IRON: 'EISEN', GOLD: 'GOLD', DIAMOND: 'DIAMANT', WOOD: 'HOLZ', STONE: 'STEIN', NETHERITE: 'NETHERIT', REDSTONE: 'REDSTONE', LAPIS: 'LAPISLAZULI', EMERALD: 'SMARAGD' },
  };
  const rarityExpect: Record<string, string[]> = {
    ru: ['НЕОБЫЧНЫЙ', 'РЕДКИЙ', 'ЭПИЧЕСКИЙ', 'ЛЕГЕНДАРНЫЙ', 'МИФИЧЕСКИЙ'],
    fr: ['PEU COMMUN', 'RARE', 'ÉPIQUE', 'LÉGENDAIRE', 'MYTHIQUE'],
    de: ['UNGEWÖHNLICH', 'SELTEN', 'EPISCH', 'LEGENDÄR', 'MYTHISCH'],
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
