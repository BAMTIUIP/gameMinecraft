/**
 * Leaderboards (https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard).
 *
 * The platform keeps the rating; this module is the thin, polite client around it:
 *
 *  - `ysdk.leaderboards` is used directly — the docs deprecate `ysdk.getLeaderboards()`;
 *  - the board's technical name (`LEADERBOARD_NAME`) exists in the Console, otherwise every call
 *    answers 404 — the README lists what has to be created there;
 *  - the platform limits are respected locally as well: `setScore` — 1 request per second,
 *    `getPlayerEntry` — 60 per 5 minutes, `getEntries` — 20 per 5 minutes. Requests that would break
 *    the limit are either coalesced (the best score is kept and sent once the second has passed) or
 *    answered from the cache (the top list), so a player who spams "refresh" cannot get the game
 *    throttled;
 *  - scoring is available to authorised players only, so an anonymous run simply stays in the local
 *    table (which the game has kept since the very first build — the docs recommend exactly that).
 */

import { getLang, resolveLang } from './i18n';
import {
  yaGetLeaderboardEntries,
  yaGetLeaderboardPlayerEntry,
  yaIsAvailableMethod,
  yaLang,
  yaLeaderboardAvailable,
  yaProfile,
  yaSetLeaderboardScore,
  type YaLeaderboardDescription,
  type YaLeaderboardEntry,
} from './yandex';

/** Technical name of the leaderboard as it must be created in the Console (numeric, DESC). */
export const LEADERBOARD_NAME = 'orerush-best-score';

/** How many rows around the player and in the top the game asks for (docs: 1–10 and 1–20). */
const QUANTITY_TOP = 10;
const QUANTITY_AROUND = 3;

// Platform limits, with a small margin: getEntries 20/5 min → 15 s, getPlayerEntry 60/5 min → 5 s,
// setScore 1/s → 1 s.
const ENTRIES_INTERVAL_MS = 15_000;
const ENTRY_INTERVAL_MS = 5_000;
const SCORE_INTERVAL_MS = 1_000;

export type LeaderboardRow = {
  rank: number;
  score: number;
  /** platform nickname, empty when the player hid their profile */
  name: string;
  hidden: boolean;
  avatar: string | null;
  /** the author of this session */
  me: boolean;
};

export type LeaderboardView = {
  rows: LeaderboardRow[];
  /** the player's place, 0 when they are not on the board yet */
  userRank: number;
  /** leaderboard title from the Console, localised by the SDK */
  title: string;
  /** milliseconds since the data was fetched */
  at: number;
};

const TITLES: Record<string, string> = {
  ru: 'Мировой рейтинг',
  en: 'World ranking',
  tr: 'Dünya sıralaması',
  de: 'Weltrangliste',
  fr: 'Classement mondial',
};

let view: LeaderboardView | null = null;
let entriesAt: number | null = null;
let entryRank: number | null = null;
let entryAt = 0;
let entryRequest: Promise<number | null> | null = null;
let lastScoreAt = 0;
let pendingScore = 0;
let scoreTimer: number | null = null;
/** Shared promise: concurrent submissions must all wait for the availability check before scoring. */
let scoreMethodAvailability: Promise<boolean> | null = null;

export function leaderboardAvailable(): boolean {
  return yaLeaderboardAvailable();
}

/** Milliseconds until the next `getEntries` request is allowed (0 = right now). */
export function leaderboardCooldownLeft(): number {
  return entriesAt === null ? 0 : Math.max(0, ENTRIES_INTERVAL_MS - (Date.now() - entriesAt));
}

export function getLeaderboardView(): LeaderboardView | null {
  return view;
}

/** Test seam: forget everything that was fetched or queued. */
export function resetLeaderboardState() {
  if (scoreTimer !== null) clearTimeout(scoreTimer);
  scoreTimer = null;
  view = null;
  entriesAt = null;
  entryRank = null;
  entryAt = 0;
  entryRequest = null;
  lastScoreAt = 0;
  pendingScore = 0;
  scoreMethodAvailability = null;
}

/** Leaderboard title from the Console in the player's language, with an in-game fallback. */
export function leaderboardTitle(description?: YaLeaderboardDescription | null): string {
  // The Console may hold a title for any platform language, so the raw code is looked up first;
  // the in-game fallback follows the documented reserve sets (rules 2.14 and 8.2.3).
  const platformLang = yaLang();
  const lang = platformLang ?? getLang();
  const fromConsole = description?.title?.[lang] ?? description?.title?.ru ?? description?.title?.en;
  return fromConsole || TITLES[resolveLang(lang)] || TITLES.en;
}

/**
 * Format a score the way the Console describes it: `decimal_offset` moves the decimal point
 * (1234 with offset 2 is 12.34), a `time` board is measured in milliseconds.
 */
export function formatLeaderboardScore(score: number, description?: YaLeaderboardDescription | null): string {
  const format = description?.description?.score_format;
  if (format?.type === 'time') {
    const total = Math.max(0, Math.round(score / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = hours ? String(minutes).padStart(2, '0') : String(minutes);
    return `${hours ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
  }
  const offset = Math.max(0, Math.min(6, format?.options?.decimal_offset ?? 0));
  if (offset === 0) return Math.round(score).toLocaleString();
  const scaled = score / 10 ** offset;
  return scaled.toLocaleString(undefined, { minimumFractionDigits: offset, maximumFractionDigits: offset });
}

function toRow(entry: YaLeaderboardEntry, myId: string | undefined): LeaderboardRow {
  const name = entry.player?.publicName ?? '';
  let avatar: string | null = null;
  try {
    avatar = entry.player?.getAvatarSrc?.('small') ?? null;
  } catch {
    avatar = null;
  }
  return {
    rank: entry.rank,
    score: entry.score,
    name,
    hidden: !name,
    avatar,
    me: Boolean(myId && entry.player?.uniqueID && entry.player.uniqueID === myId),
  };
}

/**
 * The top of the board plus a few rows around the player. Returns the cached view when the platform
 * limit has not passed yet (and null when leaderboards are unavailable), so it is always safe to call
 * from a button.
 */
export async function loadLeaderboard(): Promise<LeaderboardView | null> {
  if (!leaderboardAvailable()) return null;
  if (entriesAt !== null && Date.now() - entriesAt < ENTRIES_INTERVAL_MS) return view;

  // Count every attempt, including failures, and reserve the slot before awaiting so parallel calls
  // cannot exceed the platform's 20-requests-per-5-minutes limit.
  const requestedAt = Date.now();
  entriesAt = requestedAt;
  const result = await yaGetLeaderboardEntries(LEADERBOARD_NAME, {
    quantityTop: QUANTITY_TOP,
    includeUser: true,
    quantityAround: QUANTITY_AROUND,
  });
  if (!result) return view;

  const description = result.leaderboard ?? null;
  const myId = yaProfile()?.id;
  const rows: LeaderboardRow[] = [];
  const seen = new Set<string>();
  for (const entry of result.entries) {
    const id = entry.player?.uniqueID ?? `rank-${entry.rank}`;
    if (seen.has(id)) continue; // the player's row can arrive both in the top and in the around block
    seen.add(id);
    rows.push(toRow(entry, myId));
  }
  rows.sort((a, b) => a.rank - b.rank);
  const mine = rows.find((row) => row.me);
  const userRank = result.userRank && result.userRank > 0 ? result.userRank : (mine?.rank ?? 0);
  view = { rows, userRank, title: leaderboardTitle(description), at: requestedAt };
  return view;
}

/**
 * The player's own place, for the results screen. Cached, and asked at most once per 5 seconds
 * (the platform allows 60 requests per 5 minutes).
 */
export async function loadMyRank(): Promise<number | null> {
  if (!leaderboardAvailable()) return null;
  if (!yaProfile()?.authorized) return null;
  if (entryRequest) return entryRequest;
  if (entryRank !== null && Date.now() - entryAt < ENTRY_INTERVAL_MS) return entryRank;
  if (entryRank === null && Date.now() - entryAt < ENTRY_INTERVAL_MS) return null;

  const request = (async () => {
    if (!(await yaIsAvailableMethod('leaderboards.getPlayerEntry'))) return null;
    const entry = await yaGetLeaderboardPlayerEntry(LEADERBOARD_NAME);
    entryAt = Date.now();
    entryRank = entry?.rank ?? null;
    return entryRank;
  })();
  entryRequest = request;
  try {
    return await request;
  } finally {
    if (entryRequest === request) entryRequest = null;
  }
}

/**
 * Publish a result. `setScore` is allowed once per second, so a second call inside that window does
 * not fail: the best score is remembered and sent as soon as the second is over.
 */
export async function submitLeaderboardScore(score: number, extraData?: string): Promise<'sent' | 'queued' | 'skipped' | 'failed'> {
  if (!leaderboardAvailable()) return 'skipped';
  // scoring is only for authorised players: an anonymous result lives in the local table instead
  if (!yaProfile()?.authorized) return 'skipped';
  // the platform rejects negative scores but accepts 0, and a zero run is still a place on the board
  const rounded = Math.max(0, Math.floor(score));
  if (!Number.isFinite(rounded)) return 'skipped';

  if (!scoreMethodAvailability) {
    scoreMethodAvailability = yaIsAvailableMethod('leaderboards.setScore');
  }
  if (!(await scoreMethodAvailability)) return 'skipped';

  const wait = SCORE_INTERVAL_MS - (Date.now() - lastScoreAt);
  if (wait > 0) {
    pendingScore = Math.max(pendingScore, rounded);
    if (scoreTimer === null) {
      scoreTimer = window.setTimeout(() => {
        scoreTimer = null;
        const next = pendingScore;
        pendingScore = 0;
        void submitLeaderboardScore(next, extraData);
      }, wait);
    }
    return 'queued';
  }

  lastScoreAt = Date.now();
  const saved = await yaSetLeaderboardScore(LEADERBOARD_NAME, rounded, extraData);
  if (saved) {
    // the board is stale now, but the player's own row is what the results screen shows
    entryRank = null;
  }
  return saved ? 'sent' : 'failed';
}
