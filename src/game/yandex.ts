
import { hasSafeStorage, installSafeStorage } from './storage';

export { hasSafeStorage };

/**
 * Yandex Games SDK bridge.
 *
 * Connection and initialisation follow the official guide
 * https://yandex.ru/dev/games/doc/ru/sdk/sdk-about (requirement 1.19.1):
 *  1. index.html loads the SDK with a plain synchronous `<script src="/sdk.js">` in <head>
 *     (relative path — the build is uploaded to Yandex as an archive), so `window.YaGames`
 *     already exists by the time any of our (deferred) module code runs;
 *  2. `const ysdk = await YaGames.init()` runs exactly once, as early as possible (main.tsx);
 *  3. no SDK method is used before init() has resolved. What the game reports earlier
 *     (LoadingAPI.ready, GameplayAPI.start/stop) is remembered and replayed right after init()
 *     instead of being lost — the "ysdk is not defined" trap from the guide's troubleshooting.
 *
 * Game loading / gameplay markup follow https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events.
 * The platform also pauses the game on its own (ads, purchase windows, tab switch, minimised
 * window, focus moved to another window) and then calls GameplayAPI.stop()/start() itself —
 * yaOnPause()/yaOnResume() let the game follow, so what the platform believes matches what the
 * player sees (https://yandex.ru/dev/games/doc/ru/sdk/sdk-events#pause-resume).
 *
 * Safe no-op everywhere else (local dev, itch, plain hosting): without /sdk.js there is no
 * `window.YaGames`, so initYandex() resolves to null at once and every call degrades to nothing.
 */

export type YaEnvironment = {
  app: { id: string };
  i18n: { lang: string };
  payload?: string;
  referrer?: { type: 'promo'; promoId: string; intent?: string; inappId?: string };
};

/** Payment activity of a Yandex Games user, used to pick the right monetisation offer. */
export type YaPayingStatus = 'paying' | 'partially_paying' | 'not_paying' | 'unknown';

/**
 * `ysdk.getPlayer()` object — profile + cloud saves + numeric stats
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-player). Every method may reject (network, rate
 * limit, no signed access), so all calls here are wrapped and degrade to null/false.
 */
export type YaPlayer = {
  isAuthorized: () => boolean;
  getUniqueID: () => string;
  getName: () => string;
  getPhoto: (size: 'small' | 'medium' | 'large') => string;
  getPayingStatus: () => YaPayingStatus;
  getData: (keys?: string[]) => Promise<Record<string, unknown>>;
  setData: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
  getStats: (keys?: string[]) => Promise<Record<string, number>>;
  setStats: (stats: Record<string, number>) => Promise<void>;
  incrementStats: (increments: Record<string, number>) => Promise<Record<string, number>>;
};

/**
 * Remote config (https://yandex.ru/dev/games/doc/ru/sdk/sdk-config): a flat map of string values.
 * The platform merges the remote config over `defaultFlags`, so the game always has a usable value.
 */
export type YaFlags = Record<string, string>;

/** Client parameter used to target a flag at a player group, e.g. paying status or language. */
export type YaClientFeature = { name: string; value: string };

/** Snapshot of the platform profile, safe to render from React. */
export type YaProfile = {
  authorized: boolean;
  id: string;
  name: string;
  photo: string;
  paying: YaPayingStatus;
};

type YSDK = {
  environment: YaEnvironment;
  /** Server-synchronised Unix timestamp in milliseconds (tamper-resistant). */
  serverTime?: () => number;
  /** interface language / auth / profile; rate-limited (getPlayer: 20 calls per 5 minutes) */
  getPlayer?: (options?: { scoped?: boolean; signed?: boolean }) => Promise<YaPlayer>;
  /** remote config flags: single flat string map, fetched once at startup */
  getFlags?: (params?: { defaultFlags?: YaFlags; clientFeatures?: YaClientFeature[] }) => Promise<YaFlags>;
  auth?: { openAuthDialog?: () => Promise<void> };
  /** safeStorage: a localStorage-compatible store that survives iOS clean-ups */
  getStorage?: () => Promise<Storage>;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  features?: {
    LoadingAPI?: { ready?: () => void };
    GameplayAPI?: { start?: () => void; stop?: () => void };
  };
  /** platform events: the game must pause on `game_api_pause` and resume on `game_api_resume` */
  on?: (event: 'game_api_pause' | 'game_api_resume', listener: () => void) => unknown;
};

declare global {
  interface Window {
    YaGames?: {
      /**
       * `signed: true` makes the purchase methods return encrypted data only, for server-side
       * verification. The game has no purchases, so it keeps the default (`signed: false`).
       */
      init: (options?: { signed?: boolean }) => Promise<YSDK>;
    };
  }
}

let ysdk: YSDK | null = null;
let initPromise: Promise<YSDK | null> | null = null;

// What the game has reported vs. what the SDK has actually been told. Reports made while the
// SDK is still starting up are kept here and delivered by flush() as soon as init() resolves.
let loadingReady = false;
let loadingReadySent = false;
let gameplayActive = false;
let gameplaySent = false;

type Listener = () => void;
const pauseListeners = new Set<Listener>();
const resumeListeners = new Set<Listener>();

function emit(listeners: Set<Listener>) {
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch (err) {
      console.error('[Yandex SDK] pause/resume handler failed', err);
    }
  }
}

/** subscribe to the platform's pause / resume events once, as soon as init() has resolved */
function subscribePauseResume(sdk: YSDK) {
  try {
    sdk.on?.('game_api_pause', () => emit(pauseListeners));
    sdk.on?.('game_api_resume', () => emit(resumeListeners));
  } catch (err) {
    console.error('[Yandex SDK] ysdk.on() failed', err);
  }
}

/**
 * The platform asks the game to pause: ad or purchase window shown, tab switched, window minimised,
 * focus moved to another window. Returns an unsubscribe function. Never fires outside Yandex Games.
 */
export function yaOnPause(cb: Listener): () => void {
  pauseListeners.add(cb);
  return () => {
    pauseListeners.delete(cb);
  };
}

/** …and lets it continue. Same contract as yaOnPause(). */
export function yaOnResume(cb: Listener): () => void {
  resumeListeners.add(cb);
  return () => {
    resumeListeners.delete(cb);
  };
}

/** Bring the SDK up to date with the game's state. No-op until init() has resolved. */
function flush() {
  const features = ysdk?.features;
  if (!features) return;
  if (loadingReady && !loadingReadySent) {
    loadingReadySent = true;
    try {
      features.LoadingAPI?.ready?.();
    } catch {
      /* ignore */
    }
  }
  if (gameplayActive !== gameplaySent) {
    gameplaySent = gameplayActive;
    try {
      if (gameplayActive) features.GameplayAPI?.start?.();
      else features.GameplayAPI?.stop?.();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Initialise the SDK once; resolves to null when not on Yandex Games.
 * Call it as early as possible — every later call returns the same promise.
 */
export function initYandex(): Promise<YSDK | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // /sdk.js is a blocking <script> ahead of our module, so the global is either already
    // here or this isn't Yandex Games — there is nothing to wait for.
    const YaGames = window.YaGames;
    if (!YaGames) return null;
    try {
      ysdk = await YaGames.init();
    } catch (err) {
      console.error('[Yandex SDK] YaGames.init() failed', err);
      return null;
    }
    subscribePauseResume(ysdk); // first thing after init: don't miss a platform pause
    void applySafeStorage(ysdk); // iOS-safe localStorage, as early as possible
    flush(); // replay what the game reported while the SDK was starting up
    return ysdk;
  })();
  return initPromise;
}

/** environment variables (app id, interface language, payload, referrer) */
export function yaEnvironment(): YaEnvironment | null {
  return ysdk?.environment ?? null;
}

/** Yandex interface language (ISO 639-1) or null outside Yandex */
export function yaLang(): string | null {
  return ysdk?.environment?.i18n?.lang ?? null;
}

/** `?payload=...` from the game URL, if any */
export function yaPayload(): string | null {
  return ysdk?.environment?.payload ?? null;
}

/**
 * Current trusted Yandex server time. Use this for persisted timestamps and
 * time-gated platform features; game simulation itself remains delta-time based.
 * Outside Yandex Games, gracefully fall back to the local clock.
 */
export function yaServerTime(): number {
  try {
    const now = ysdk?.serverTime?.();
    if (typeof now === 'number' && Number.isFinite(now) && now > 0) return now;
  } catch {
    // SDK unavailable or temporarily unable to provide server time.
  }
  return Date.now();
}

/**
 * LoadingAPI.ready(): everything is loaded and the player can interact — no loading screen any more
 * (required, requirement 1.19.2). Tie it to real readiness, never to a timer. Sent once per session.
 */
export function yaLoadingReady() {
  loadingReady = true;
  flush();
}

/**
 * GameplayAPI.start(): the player starts or resumes playing — run start, unpause, menu closed, back on the
 * tab. The run must really be going at that very moment (https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events#gameplay).
 */
export function yaGameplayStart() {
  gameplayActive = true;
  flush();
}

/** GameplayAPI.stop(): pause, menu, run over, left the tab — the run must really be stopped */
export function yaGameplayStop() {
  gameplayActive = false;
  flush();
}

/* ===================== storage (safeStorage) ===================== */

/**
 * `ysdk.getStorage()` — a localStorage-compatible store that the platform keeps reliable on iOS
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-player#progress-loss). Inside an uploaded archive the
 * SDK already wraps localStorage itself; this covers the "own domain" integration, where it does not.
 */
async function applySafeStorage(ysdk: YSDK) {
  if (!ysdk.getStorage) return;
  try {
    const storage = await ysdk.getStorage();
    if (storage && typeof storage.getItem === 'function') installSafeStorage(storage);
  } catch (err) {
    console.warn('[Yandex SDK] getStorage() failed, keeping native localStorage', err);
  }
}

// alias for the imported helper so the SDK wrapper above can share its name with the import

/* ===================== player: profile, auth, cloud data ===================== */

let playerPromise: Promise<YaPlayer | null> | null = null;
let profile: YaProfile | null = null;
let lastProfileFetch = 0;

/** True when the game runs inside Yandex Games (SDK initialised). */
export function yaAvailable(): boolean {
  return ysdk !== null;
}

/**
 * `ysdk.getPlayer()` — memoised: the method is rate-limited to 20 calls per 5 minutes
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-player#limits), so the object is created once and
 * reused. `fallbackToSigned: false`: this game verifies nothing on its own server yet, so plain
 * (unsigned) data keeps working for everyone.
 */
export function yaGetPlayer(): Promise<YaPlayer | null> {
  if (playerPromise) return playerPromise;
  playerPromise = (async () => {
    if (!ysdk?.getPlayer) return null;
    try {
      return await ysdk.getPlayer();
    } catch (err) {
      console.warn('[Yandex SDK] getPlayer() failed', err);
      return null;
    }
  })();
  return playerPromise;
}

/**
 * Read the platform profile (name, avatar, authorisation, paying status) and cache it for the UI.
 * Refreshes at most once per 20 s, so callers may fire it freely; pass force=true after
 * openAuthDialog() to pick up the just-authorised user.
 */
export async function yaRefreshProfile(force = false): Promise<YaProfile | null> {
  const now = Date.now();
  if (!force && profile && now - lastProfileFetch < 20_000) return profile;
  const player = await yaGetPlayer();
  if (!player) return profile;
  try {
    lastProfileFetch = now;
    const authorized = player.isAuthorized();
    profile = {
      authorized,
      id: safeString(() => player.getUniqueID()),
      // an unauthorised player has no name/photo: keep them empty, the game falls back to its own
      name: authorized ? safeString(() => player.getName()) : '',
      photo: authorized ? safeString(() => player.getPhoto('small')) : '',
      paying: safeString(() => player.getPayingStatus()) as YaPayingStatus || 'unknown',
    };
    return profile;
  } catch (err) {
    console.warn('[Yandex SDK] profile read failed', err);
    return profile;
  }
}

/** Cached profile, readable synchronously from React (null before the first refresh resolves). */
export function yaProfile(): YaProfile | null {
  return profile;
}

/**
 * `ysdk.auth.openAuthDialog()`. Returns true when the player is authorised afterwards. The game
 * must explain the benefits before calling it (requirement 1.2), so the call is only reachable from
 * the explicit "sign in" button in the menu.
 */
export async function yaOpenAuthDialog(): Promise<boolean> {
  const dialog = ysdk?.auth?.openAuthDialog;
  if (!dialog) return false;
  try {
    await dialog.call(ysdk!.auth);
  } catch (err) {
    // the player closed the window / refused — this is a normal outcome, not an error state
    console.info('[Yandex SDK] auth dialog closed', err);
    return false;
  }
  playerPromise = null; // the Player object must be re-created for the authorised user
  const next = await yaRefreshProfile(true);
  return next?.authorized ?? false;
}

/** `player.getData(keys)` — cloud saves. null when unavailable (outside Yandex, network, rate limit). */
export async function yaCloudGet(keys?: string[]): Promise<Record<string, unknown> | null> {
  const player = await yaGetPlayer();
  if (!player) return null;
  try {
    const data = await player.getData(keys);
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    console.warn('[Yandex SDK] player.getData() failed', err);
    return null;
  }
}

/**
 * `player.setData(data, flush)` — 200 KB per player, 100 requests per 5 minutes: the caller
 * (game/profile.ts) batches and throttles writes instead of calling this per change.
 */
export async function yaCloudSet(data: Record<string, unknown>, flush = false): Promise<boolean> {
  const player = await yaGetPlayer();
  if (!player) return false;
  try {
    await player.setData(data, flush);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] player.setData() failed', err);
    return false;
  }
}

/** `player.incrementStats()` — numeric lifetime counters (60 requests per minute). */
export async function yaStatsIncrement(increments: Record<string, number>): Promise<boolean> {
  const player = await yaGetPlayer();
  if (!player) return false;
  try {
    await player.incrementStats(increments);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] player.incrementStats() failed', err);
    return false;
  }
}

/** `player.getStats()` — the player's stored numeric counters. */
export async function yaStatsGet(keys?: string[]): Promise<Record<string, number> | null> {
  const player = await yaGetPlayer();
  if (!player) return null;
  try {
    const stats = await player.getStats(keys);
    return stats && typeof stats === 'object' ? stats : null;
  } catch (err) {
    console.warn('[Yandex SDK] player.getStats() failed', err);
    return null;
  }
}

/** `player.setStats()` — overwrite numeric counters (absolute values). */
export async function yaStatsSet(stats: Record<string, number>): Promise<boolean> {
  const player = await yaGetPlayer();
  if (!player) return false;
  try {
    await player.setStats(stats);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] player.setStats() failed', err);
    return false;
  }
}

/**
 * `ysdk.getFlags()` — remote config for feature flags, live-ops and A/B tests. Called once at
 * startup (as the docs advise): a failure returns null and the caller keeps its local defaults.
 */
export async function yaGetFlags(
  defaultFlags: YaFlags,
  clientFeatures: YaClientFeature[] = [],
): Promise<YaFlags | null> {
  if (!ysdk?.getFlags) return null;
  try {
    const flags = await ysdk.getFlags({ defaultFlags, clientFeatures });
    return flags && typeof flags === 'object' ? { ...defaultFlags, ...flags } : null;
  } catch (err) {
    console.warn('[Yandex SDK] getFlags() failed, keeping local config', err);
    return null;
  }
}

function safeString(read: () => string): string {
  try {
    const value = read();
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
