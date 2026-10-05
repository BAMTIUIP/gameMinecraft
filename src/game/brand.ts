/**
 * The game's name, in one place.
 *
 * Requirement 5.1.3 (https://yandex.ru/dev/games/doc/ru/requirements/5/1/3): the name has to be
 * *identical* in the game itself and in every draft material — the text fields, the icon, every promo
 * image — for each language declared in the draft. Even a different article, a paronym, a reordered
 * word or a changed spelling counts as a different name and the game is rejected.
 *
 * The name therefore never gets translated and never gets typed twice: the menu logo, the tab title
 * and the share line all read it from here, and `tools/tests/i18n.test.ts` checks that every
 * dictionary still starts its `docTitle` with it and still carries it in `shareTemplate`. What *is*
 * translated is the tagline after the name — the documentation explicitly allows mentioning the genre
 * and the key features next to the name.
 */
export const GAME_NAME = 'ORE RUSH';

/**
 * The menu logo prints the name on two lines; it is split here so the two halves can never drift
 * apart from the name itself.
 */
export const GAME_NAME_LINES: readonly string[] = ['ORE', 'RUSH'];
