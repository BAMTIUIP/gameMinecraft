/**
 * Cloud progress: what exactly the game keeps in the Yandex Games cloud
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-player#ingame-data).
 *
 * Split of responsibilities:
 *  - **cloud (`player.setData`, 200 KB per player)** — the compact player profile: nick, records
 *    table, chosen mode/language and lifetime counters. This is what makes "continue on another
 *    device" work;
 *  - **local (`safeStorage`)** — the full voxel world of "My World". An RLE-packed world is orders
 *    of magnitude larger than 200 KB, so it physically cannot live in the cloud; the docs tell you
 *    to use your own server for that, and the game honestly says so in the UI;
 *  - **stats (`player.setStats` / `incrementStats`, numbers only)** — the same counters, so the
 *    platform sees progress and can build its own analytics.
 *
 * Rate limits are the tricky part (setData: 100 per 5 min, stats: 60 per min), so every write goes
 * through a queue here: changes are coalesced and flushed at most once per few seconds, plus
 * immediately on the moments that matter (run over, save, tab hidden).
 */

import { getLang, setLang, type Lang } from './i18n';
import { loadScores, saveScores, type ScoreEntry } from '../ui/scores';
import {
  yaAvailable,
  yaCloudGet,
  yaCloudSet,
  yaProfile,
  yaRefreshProfile,
  yaServerTime,
  yaStatsIncrement,
  yaStatsGet,
  yaStatsSet,
  type YaProfile,
} from './yandex';
import { storageGet, storageSet } from './storage';

const CLOUD_KEY = 'orerush.profile'; // single key: one getData/setData pair instead of a swarm
const LOCAL_STAMP_KEY = 'orerush.profile.savedAt';
const NAME_KEY = 'orerush.playername.v1';

/** compact enough for the 200 KB budget: profile + records, no world data */
export type CloudProfile = {
  v: 1;
  savedAt: number;
  name?: string;
  best?: number;
  scores?: ScoreEntry[];
  mode?: 'survival' | 'explorer';
  lang?: Lang;
  totals?: Partial<Record<StatKey, number>>;
  /** in-game currency bought in the shop; kept next to the records so it moves between devices */
  diamonds?: number;
  /**
   * Purchase tokens already credited. The purchase itself is consumed right after the save, but if
   * that call fails the platform hands the same token back on the next launch — the list keeps the
   * player from being paid twice for it (see shop.deliverPendingPurchases).
   */
  deliveredPurchases?: string[];
  /** last day the daily bonus was claimed (UTC `YYYY-MM-DD`) and the streak behind it */
  daily?: { last: string; streak: number };
  /** rewarded shop-drop claims, queued voxel supplies, and grants already moved into an inventory */
  adDrops?: {
    claims?: Record<string, unknown>;
    pending?: Record<string, unknown>;
    delivered?: unknown[];
    login?: unknown;
  };
  /** one-shot in-game shop purchases awaiting delivery to an engine inventory */
  shopRewards?: {
    pending?: unknown[];
    delivered?: unknown[];
  };
  /** validated by game/character when the cloud character-creator part applies it */
  character?: unknown;
};

/**
 * A feature module can contribute its own fields to the cloud profile: the daily bonus keeps its
 * date here, and the shop keeps the delivered purchase tokens. Registration keeps those modules free
 * to import this one for `markProfileDirty`, with no import cycle.
 */
export type CloudPart = {
  collect(): Record<string, unknown>;
  apply(cloud: CloudProfile): void;
};

const cloudParts: CloudPart[] = [];

export function registerCloudPart(part: CloudPart) {
  cloudParts.push(part);
}

export type StatKey =
  | 'blocksMined'
  | 'oresFound'
  | 'runs'
  | 'deaths'
  | 'deepest'
  | 'bestScore'
  | 'kills'
  | 'playSeconds'
  /** diamonds bought with real money through the Yandex payment frame */
  | 'diamondsBought'
  /** diamonds spent on in-game rewards */
  | 'diamondsSpent';

export type ProfileSnapshot = {
  /** platform profile (Yandex) or null when running outside Yandex Games */
  platform: YaProfile | null;
  /** true when the platform cloud profile was applied over the local one */
  cloudApplied: boolean;
};

type Listener = (snapshot: ProfileSnapshot) => void;
const listeners = new Set<Listener>();
let snapshot: ProfileSnapshot = { platform: null, cloudApplied: false };

export function onProfileChange(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of [...listeners]) {
    try {
      fn(snapshot);
    } catch (err) {
      console.error('[profile] listener failed', err);
    }
  }
}

/* ----------------------------- local mirrors ----------------------------- */

function localStamp(): number {
  const raw = storageGet(LOCAL_STAMP_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

/** the player's own name choice always wins over an auto-filled platform nick */
function hasOwnName(): boolean {
  return storageGet(NAME_KEY) !== null;
}

function localScores(): ScoreEntry[] {
  // seed rows are demo content, not the player's progress: never upload them
  return loadScores().filter((entry) => !entry.token.startsWith('seed-'));
}

/* --------------------------------- queue --------------------------------- */

let pendingData: CloudProfile | null = null;
// While the platform's account picker is open, the player is choosing which progress to keep; pushing
// ours at that moment would be wrong (sdk-events). Flushes are held back and resumed after the dialog.
let syncPaused = false;
let pendingStats: Partial<Record<StatKey, number>> = {}; // additive counters → incrementStats
let pendingPeaks: Partial<Record<StatKey, number>> = {}; // lifetime best/deepest → setStats
let flushTimer: number | null = null;
let statsTimer: number | null = null;
let lastFlush = 0;
let lastStatsFlush = 0;

const PEAK_STATS: StatKey[] = ['bestScore', 'deepest'];

// setData: 100 requests / 5 min → one request per 3 s is far below the limit; stats: 60 / min → same
const FLUSH_INTERVAL_MS = 3_000;
const STATS_INTERVAL_MS = 3_000;

/** Build the fresh cloud payload from what the game currently has locally. */
function collect(): CloudProfile {
  const extra = Object.assign({}, ...cloudParts.map((part) => part.collect()));
  return {
    ...(extra as Partial<CloudProfile>),
    v: 1,
    savedAt: yaServerTime(),
    name: storageGet(NAME_KEY) ?? undefined,
    diamonds: diamonds,
    deliveredPurchases: deliveredPurchases(),
    scores: localScores().slice(0, 8),
    ...(storageGet('orerush.mode') ? { mode: storageGet('orerush.mode') as 'survival' | 'explorer' } : {}),
    lang: getLang(),
  };
}

/** Queue a cloud write; flush=false lets it ride along with the next batched request. */
export function markProfileDirty(patch?: Partial<CloudProfile>) {
  if (!yaAvailable()) return;
  const base = pendingData ?? collect();
  pendingData = { ...base, ...patch, v: 1, savedAt: yaServerTime() };
  scheduleFlush();
}

/**
 * Queue numeric counters. Additive keys go to `incrementStats`, lifetime peaks (best score,
 * deepest block) to `setStats` — incrementing a "best" value would be wrong, it is not a counter.
 */
export function bumpStats(increments: Partial<Record<StatKey, number>>) {
  if (!yaAvailable()) return;
  for (const [key, value] of Object.entries(increments) as Array<[StatKey, number]>) {
    if (!Number.isFinite(value) || value === 0) continue;
    if (PEAK_STATS.includes(key)) pendingPeaks[key] = Math.max(pendingPeaks[key] ?? totals[key], value);
    else pendingStats[key] = (pendingStats[key] ?? 0) + value;
  }
  if (Object.keys(pendingStats).length === 0 && Object.keys(pendingPeaks).length === 0) return;
  if (statsTimer === null) {
    const wait = Math.max(0, STATS_INTERVAL_MS - (Date.now() - lastStatsFlush));
    statsTimer = window.setTimeout(() => {
      statsTimer = null;
      void flushStats();
    }, wait);
  }
}

function scheduleFlush() {
  if (syncPaused) return;
  if (flushTimer !== null) return;
  const wait = Math.max(0, FLUSH_INTERVAL_MS - (Date.now() - lastFlush));
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushProfile();
  }, wait);
}

/**
 * Requirement 1.9 (https://yandex.ru/dev/games/doc/ru/requirements/1/9): progress is written right
 * after the player's action, not on a timer. Every progress-changing action in the game calls this
 * after it has updated the local mirrors, so a refresh a moment later already sees the change — and
 * an authorised player has it in the cloud as well. Each cloud write goes through the same queue
 * (which coalesces bursts and respects the platform's rate limits) but skips the debounce.
 */
export function saveProgressNow(): void {
  void flushProfile(true);
}

/**
 * Send everything that has piled up. `immediate` also asks the platform to write right away.
 * Returns true only when every pending change reached the platform — the shop relies on that
 * guarantee before it consumes a purchase (docs: save the reward first, consume second).
 */
export async function flushProfile(immediate = false): Promise<boolean> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (syncPaused) {
    // nothing may leave the game while the account picker is open; the caller (the shop) sees `false`
    // and therefore does not consume the purchase — the documented "save first, consume second" order
    return false;
  }
  const payload = pendingData;
  pendingData = null;
  let saved = true;

  if (payload) {
    lastFlush = Date.now();
    storageSet(LOCAL_STAMP_KEY, String(payload.savedAt));
    saved = await yaCloudSet({ [CLOUD_KEY]: payload }, immediate);
    // on failure the payload is not silently dropped: it is re-queued for the next attempt
    if (!saved) pendingData = payload;
  }

  const statsSaved = await flushStats();
  emit();
  return saved && statsSaved;
}

async function flushStats(): Promise<boolean> {
  const stats = pendingStats;
  const peaks = pendingPeaks;
  pendingStats = {};
  pendingPeaks = {};
  if (!Object.keys(stats).length && !Object.keys(peaks).length) return true;
  lastStatsFlush = Date.now();
  let ok2 = true;

  const ok = Object.keys(stats).length ? await yaStatsIncrement(stats) : true;
  if (!ok) {
    ok2 = false;
    for (const [key, value] of Object.entries(stats) as Array<[StatKey, number]>) {
      pendingStats[key] = (pendingStats[key] ?? 0) + value;
    }
  }
  if (Object.keys(peaks).length) {
    const absolute: Record<string, number> = {};
    for (const [key, value] of Object.entries(peaks) as Array<[StatKey, number]>) {
      absolute[key] = Math.max(value, totals[key]);
    }
    const peaksOk = await yaStatsSet(absolute);
    // a failed peak write is retried from the local totals on the next run end
    if (!peaksOk) {
      ok2 = false;
      for (const key of Object.keys(absolute) as StatKey[]) pendingPeaks[key] = Math.max(pendingPeaks[key] ?? 0, absolute[key]);
    }
  }
  return ok2;
}

/* ---------------------------------- boot --------------------------------- */

let started = false;

/**
 * Called once the SDK is up: pull the cloud profile, merge it with the local one (the newer
 * `savedAt` wins) and remember the platform profile for the UI. Safe to call outside Yandex: it
 * then only reports `platform: null` and does nothing else.
 */
export async function startProfileSync(): Promise<ProfileSnapshot> {
  if (started) return snapshot;
  started = true;

  const platform = await yaRefreshProfile();
  snapshot = { platform, cloudApplied: false };

  if (!yaAvailable()) {
    emit();
    return snapshot;
  }

  const remote = await yaCloudGet([CLOUD_KEY]);
  const cloud = remote?.[CLOUD_KEY] as CloudProfile | undefined;
  const stamp = localStamp();

  const cloudOurs = cloud && cloud.v === 1;
  if (cloudOurs && cloud.savedAt > stamp) {
    applyCloud(cloud);
    snapshot = { ...snapshot, cloudApplied: true };
  } else {
    // local is newer (or the cloud is empty): make sure the cloud learns about this player
    markProfileDirty();
  }

  // numeric stats live next to the data blob: pull them too, so peaks never regress when the
  // same account plays on a second device
  const stats = await yaStatsGet();
  if (stats) applyTotals(stats as Partial<Record<StatKey, number>>);
  if (cloudOurs && cloud.totals) applyTotals(cloud.totals);

  // the local mirror keeps lifetime counters available offline and on the next boot
  storageSet(TOTALS_KEY, JSON.stringify(totals));

  // platform nick/avatar can now be shown in the menu
  snapshot = { ...snapshot, platform: yaProfile() };
  emit();
  return snapshot;
}

/** Adopt cloud data: records, nick (only if the player never chose one), mode, language, counters. */
function applyCloud(cloud: CloudProfile) {
  if (Array.isArray(cloud.scores) && cloud.scores.length) saveScores(cloud.scores.slice(0, 8));
  if (cloud.name && !hasOwnName()) storageSet(NAME_KEY, cloud.name);
  if (cloud.mode && storageGet('orerush.mode') === null) storageSet('orerush.mode', cloud.mode);
  if (cloud.lang && storageGet('orerush.lang') === null) setLang(cloud.lang);
  if (cloud.totals) applyTotals(cloud.totals);
  if (typeof cloud.diamonds === 'number' && Number.isFinite(cloud.diamonds)) {
    // never lose currency: the higher of the two balances wins on a merge
    diamonds = Math.max(diamonds, Math.floor(cloud.diamonds));
    storageSet(DIAMONDS_KEY, String(diamonds));
  }
  for (const part of cloudParts) part.apply(cloud);
  if (Array.isArray(cloud.deliveredPurchases) && cloud.deliveredPurchases.length) {
    // tokens are only ever added, so the union is the safe merge
    const merged = [...new Set([...deliveredPurchases(), ...cloud.deliveredPurchases])].slice(-DELIVERED_LIMIT);
    storageSet(DELIVERED_KEY, JSON.stringify(merged));
  }
  storageSet(LOCAL_STAMP_KEY, String(cloud.savedAt));
}

/** Hold back (or resume) cloud writes while the platform's account picker is open. */
export function pauseProfileSync(paused: boolean) {
  syncPaused = paused;
  if (!paused) {
    markProfileDirty();
    scheduleFlush();
  }
}

/**
 * The account picker just closed: the progress under the player may have changed, so re-request the
 * player and adopt the cloud profile of the chosen account. The docs describe exactly this step
 * ("перезапрашиваем данные игрока" after `ACCOUNT_SELECTION_DIALOG_CLOSED`).
 */
export async function resyncProfile(): Promise<boolean> {
  if (!yaAvailable()) return false;
  const platform = await yaRefreshProfile(true);
  snapshot = { ...snapshot, platform };
  const remote = await yaCloudGet([CLOUD_KEY]);
  const cloud = remote?.[CLOUD_KEY] as CloudProfile | undefined;
  if (cloud && cloud.v === 1) {
    // the cloud record belongs to the account the player has just chosen: it wins even over a local
    // stamp that looks newer, because that stamp was written under the previous account
    applyCloud(cloud);
    storageSet(TOTALS_KEY, JSON.stringify(totals));
    snapshot = { ...snapshot, cloudApplied: true };
  } else {
    markProfileDirty();
  }
  emit();
  return snapshot.cloudApplied;
}

/* --------------------------- delivered purchases -------------------------- */

/**
 * Tokens of the purchases whose reward has already been paid out. Normally they disappear as soon as
 * `consumePurchase()` succeeds; the list only matters when that call fails, and then it is what stops
 * the platform's "unprocessed purchases" retry from paying for the same pack twice.
 */
const DELIVERED_KEY = 'orerush.purchases.v1';
const DELIVERED_LIMIT = 25;

function deliveredPurchases(): string[] {
  const raw = storageGet(DELIVERED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((token): token is string => typeof token === 'string') : [];
  } catch {
    return [];
  }
}

export function hasDeliveredPurchase(token: string): boolean {
  return !!token && deliveredPurchases().includes(token);
}

/** Remember that this token's reward is already on the balance (and queue the cloud write). */
export function markPurchaseDelivered(token: string) {
  if (!token) return;
  const next = [...new Set([...deliveredPurchases(), token])].slice(-DELIVERED_LIMIT);
  storageSet(DELIVERED_KEY, JSON.stringify(next));
  markProfileDirty({ deliveredPurchases: next });
}

/* ------------------------------ diamonds --------------------------------- */

const DIAMONDS_KEY = 'orerush.diamonds.v1';
let diamonds = readDiamonds();

function readDiamonds(): number {
  const raw = storageGet(DIAMONDS_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function writeDiamonds(next: number) {
  diamonds = Math.max(0, Math.floor(next));
  storageSet(DIAMONDS_KEY, String(diamonds)); // the local mirror first: a refresh must never lose it
  markProfileDirty({ diamonds });
  emit();
  saveProgressNow(); // earned or spent currency is progress — saved right after the action (1.9)
}

/** Current in-game currency balance (0 outside the shop's reach). */
export function getDiamonds(): number {
  return diamonds;
}

/** Credit diamonds — used when a pack is bought or an unprocessed purchase is delivered. */
export function addDiamonds(amount: number, reason: 'purchase' | 'grant' = 'grant') {
  if (!Number.isFinite(amount) || amount <= 0) return diamonds;
  writeDiamonds(diamonds + Math.floor(amount));
  if (reason === 'purchase') bumpStats({ diamondsBought: Math.floor(amount) });
  return diamonds;
}

/** Try to spend diamonds; returns false (and changes nothing) when the balance is too low. */
export function spendDiamonds(amount: number): boolean {
  const cost = Math.max(0, Math.floor(amount));
  if (cost === 0) return true;
  if (diamonds < cost) return false;
  writeDiamonds(diamonds - cost);
  bumpStats({ diamondsSpent: cost });
  return true;
}

/* ----------------------------- lifetime totals ---------------------------- */

const TOTALS_KEY = 'orerush.totals.v1';

export type Totals = Record<StatKey, number>;

const EMPTY_TOTALS: Totals = {
  blocksMined: 0,
  oresFound: 0,
  runs: 0,
  deaths: 0,
  deepest: 0,
  bestScore: 0,
  kills: 0,
  playSeconds: 0,
  diamondsBought: 0,
  diamondsSpent: 0,
};

let totals: Totals = loadTotals();

function loadTotals(): Totals {
  const raw = storageGet(TOTALS_KEY);
  if (!raw) return { ...EMPTY_TOTALS };
  try {
    const parsed = JSON.parse(raw) as Partial<Totals>;
    const merged = { ...EMPTY_TOTALS };
    for (const key of Object.keys(merged) as StatKey[]) {
      const value = parsed[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) merged[key] = value;
    }
    return merged;
  } catch {
    return { ...EMPTY_TOTALS };
  }
}

function applyTotals(remote: Partial<Record<StatKey, number>>) {
  for (const key of Object.keys(totals) as StatKey[]) {
    const value = remote[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > totals[key]) totals[key] = value;
  }
  storageSet(TOTALS_KEY, JSON.stringify(totals));
}

/** Lifetime counters: max() for "best" style keys, sum() for counters. Local mirror is instant. */
export function addTotals(increments: Partial<Record<StatKey, number>>) {
  let changed = false;
  for (const [key, value] of Object.entries(increments) as Array<[StatKey, number]>) {
    if (!Number.isFinite(value) || value === 0) continue;
    const isPeak = key === 'bestScore' || key === 'deepest';
    const next = isPeak ? Math.max(totals[key], value) : totals[key] + value;
    if (next !== totals[key]) {
      totals[key] = next;
      changed = true;
    }
  }
  if (!changed) return totals;
  storageSet(TOTALS_KEY, JSON.stringify(totals));
  bumpStats(increments);
  markProfileDirty({ totals });
  saveProgressNow(); // lifetime records are progress too (1.9)
  return totals;
}

export function getTotals(): Totals {
  return { ...totals };
}

/** progress made inside a run is mirrored into the cloud payload as absolute lifetime values */
export function setProfileTotals(peaks: Partial<Record<StatKey, number>>) {
  addTotals(peaks);
}
