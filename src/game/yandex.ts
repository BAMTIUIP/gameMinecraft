
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

/** Deep link from a promo banner in the catalogue (`ysdk.environment.referrer`). */
export type YaReferrer = {
  type: 'promo';
  promoId: string;
  /** free-form hint, e.g. `open_starter_pack` */
  intent?: string;
  /** id of the in-app purchase the promo is about */
  inappId?: string;
};

export type YaEnvironment = {
  app: { id: string };
  i18n: { lang: string };
  payload?: string;
  /** set only when the game was opened from a promo banner in the catalogue */
  referrer?: YaReferrer;
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

/** Advertising surface of the SDK (https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv). */
export type YaAdv = {
  showFullscreenAdv?: (params?: {
    callbacks?: { onOpen?: () => void; onClose?: (wasShown: boolean) => void; onError?: (error: unknown) => void };
  }) => void;
  showRewardedVideo?: (params?: {
    callbacks?: {
      onOpen?: () => void;
      onRewarded?: () => void;
      onClose?: (wasShown: boolean) => void;
      onError?: (error: unknown) => void;
    };
  }) => void;
  getBannerAdvStatus?: () => Promise<{ stickyAdvIsShowing: boolean; reason?: string }>;
  showBannerAdv?: () => Promise<{ stickyAdvIsShowing: boolean; reason?: string }>;
  hideBannerAdv?: () => Promise<{ stickyAdvIsShowing: boolean }>;
};

export type YaAdResult = { shown: boolean; rewarded: boolean; error?: boolean };

/**
 * In-app purchases (https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases). The game processes
 * payments on the client (`signed: false`), so the returned objects are plain, unencrypted data.
 */
export type YaPurchase = {
  productID: string;
  purchaseToken: string;
  developerPayload?: string;
  /**
   * Only present when the SDK was initialised with `signed: true` — then every purchase answer is
   * `{ signature }` instead of readable data. This game handles payments on the client, so a
   * signature-only answer means the payment happened but the reward cannot be granted from here.
   */
  signature?: string;
};

/** An item of the Yandex Console catalogue: the price (and its currency icon) comes from here. */
export type YaProduct = {
  id: string;
  title: string;
  description: string;
  imageURI: string;
  price: string;
  priceValue: string;
  priceCurrencyCode: string;
  getPriceCurrencyImage?: (size?: 'small' | 'medium' | 'svg') => string;
};

export type YaPayments = {
  purchase: (data: { id: string; developerPayload?: string }) => Promise<YaPurchase>;
  getPurchases: () => Promise<YaPurchase[]>;
  getCatalog: () => Promise<YaProduct[]>;
  /** removes a consumed purchase for good: call it only after the reward is saved */
  consumePurchase: (purchaseToken: string) => Promise<void>;
};

/** One row of a leaderboard (`ysdk.leaderboards.*`). */
export type YaLeaderboardEntry = {
  rank: number;
  score: number;
  extraData?: string;
  player?: {
    publicName?: string;
    uniqueID?: string;
    getAvatarSrc?: (size?: 'small' | 'medium' | 'large') => string;
    getAvatarSrcSet?: (size?: 'small' | 'medium' | 'large') => string;
  };
};

export type YaLeaderboardDescription = {
  name: string;
  appID?: string;
  default?: boolean;
  title?: Record<string, string>;
  description?: {
    invert_sort_order?: boolean;
    sort_order?: string;
    score_format?: { options?: { decimal_offset?: number }; type?: 'numeric' | 'time' };
  };
};

export type YaLeaderboardEntries = {
  leaderboard: YaLeaderboardDescription;
  ranges?: Array<{ start: number; size: number }>;
  /** 0 when the player is not in the leaderboard or when the request excluded them */
  userRank?: number;
  entries: YaLeaderboardEntry[];
};

/** `ysdk.shortcut` — the desktop shortcut dialog. */
export type YaShortcut = {
  canShowPrompt: () => Promise<{ canShow?: boolean }>;
  /** 'accepted' means the shortcut was added; other outcomes are a refusal or a closed dialog */
  showPrompt: () => Promise<{ outcome?: string }>;
};

/** Why the platform refuses to show the rating dialog (`ysdk.feedback.canReview()`). */
export type YaReviewReason = 'NO_AUTH' | 'GAME_RATED' | 'REVIEW_ALREADY_REQUESTED' | 'REVIEW_WAS_REQUESTED' | 'UNKNOWN';

export type YaFeedback = {
  /** the docs require this check before requestReview(): only authorised players who have not rated */
  canReview: () => Promise<{ value: boolean; reason?: YaReviewReason }>;
  /** opens the platform's rating dialog; `feedbackSent` = the player actually rated the game */
  requestReview: () => Promise<{ feedbackSent?: boolean; sentFeedback?: boolean }>;
};

/** One recorded moment of someone else's shift, as the platform stores it. */
export type YaSessionTransaction = {
  id?: string;
  payload?: unknown;
  /** milliseconds from the start of that session, pauses taken out */
  time?: number;
};

/** An opponent session returned by `sessions.init()`: who played, how, and how it went. */
export type YaMultiplayerSession = {
  id: string;
  meta?: { meta1?: number; meta2?: number; meta3?: number };
  player?: { avatar?: string; name?: string };
  timeline?: YaSessionTransaction[];
};

/** The `meta1..meta3` ranges used both to pick opponents and to publish our own result. */
export type YaMultiplayerMeta = { min?: number; max?: number };

export type YaMultiplayerInitParams = {
  /** how many opponent sessions to load; the platform returns at most 10 */
  count?: number;
  /** true = the SDK replays transactions through `multiplayer-sessions-*` events */
  isEventBased?: boolean;
  /** caps how long a long opponent pause is replayed, ms */
  maxOpponentTurnTime?: number;
  /** at least one of meta1..meta3 must be given, together with count > 0, or nothing is loaded */
  meta?: { meta1?: YaMultiplayerMeta; meta2?: YaMultiplayerMeta; meta3?: YaMultiplayerMeta };
};

/**
 * `ysdk.multiplayer.sessions` — asynchronous multiplayer
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-multiplayer-sessions).
 *
 * Instead of a live server the platform records a timeline of transactions during a run, stores it,
 * and replays it for the next player: `commit()` queues a payload, `push()` publishes the timeline.
 * A session may be at most 200 KB, so the game commits sparsely (see src/game/multiplayer.ts).
 */
export type YaMultiplayerSessions = {
  init: (params?: YaMultiplayerInitParams) => Promise<YaMultiplayerSession[]>;
  commit: (payload: object) => void;
  /** `meta1..meta3` describe the finished shift (score, depth, blocks); at least one is required */
  push: (meta: { meta1?: number; meta2?: number; meta3?: number }) => Promise<void>;
};

export type YaMultiplayerEvents = {
  /** a batch of opponent transactions that are due right now */
  transaction: (data: { opponentId: string; transactions: YaSessionTransaction[] }) => void;
  /** an opponent's recorded session has ended */
  finish: (opponentId: string) => void;
};

/** `ysdk.leaderboards` — the modern entry point (`getLeaderboards()` is deprecated). */
export type YaLeaderboards = {
  getDescription: (leaderboardName: string) => Promise<YaLeaderboardDescription>;
  /** authorised players only, at most one request per second */
  setScore: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
  /** authorised players only; rejects with LEADERBOARD_PLAYER_NOT_PRESENT for a player without a score */
  getPlayerEntry: (leaderboardName: string) => Promise<YaLeaderboardEntry>;
  getEntries: (
    leaderboardName: string,
    options?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
  ) => Promise<YaLeaderboardEntries>;
};

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
  /** advertising: fullscreen, rewarded video and the sticky banner */
  adv?: YaAdv;
  /** in-app purchases: preload with getPayments() and/or use directly */
  payments?: YaPayments;
  getPayments?: (options?: { signed?: boolean }) => Promise<YaPayments>;
  /** leaderboards: used directly, `getLeaderboards()` is deprecated */
  leaderboards?: YaLeaderboards;
  /** asynchronous multiplayer sessions: opponent replays are recorded and published here */
  multiplayer?: { sessions?: YaMultiplayerSessions };
  /** rating the game: canReview() first, requestReview() once per session */
  feedback?: YaFeedback;
  /** desktop shortcut: canShowPrompt() first, then showPrompt() from a user action */
  shortcut?: YaShortcut;
  auth?: { openAuthDialog?: () => Promise<void> };
  /** safeStorage: a localStorage-compatible store that survives iOS clean-ups */
  getStorage?: () => Promise<Storage>;
  isAvailableMethod?: (method: string) => Promise<boolean>;
  features?: {
    LoadingAPI?: { ready?: () => void };
    GameplayAPI?: { start?: () => void; stop?: () => void };
  };
  /**
   * Platform events: the game must pause on `game_api_pause` and resume on `game_api_resume`,
   * `multiplayer-sessions-*` deliver opponent replay data (see YaMultiplayerEvents), and
   * `HISTORY_BACK` / `EXIT` / `ACCOUNT_SELECTION_DIALOG_*` report the TV back button, the confirmed
   * exit and the account picker (https://yandex.ru/dev/games/doc/ru/sdk/sdk-events).
   */
  on?: (event: YaEventName, listener: (payload?: never) => void) => unknown;
  /** the documented counterpart of `on()`, used by every subscriber that can be torn down */
  off?: (event: YaEventName, listener: (payload?: never) => void) => unknown;
  /** sends a platform event, e.g. `ysdk.dispatchEvent(ysdk.EVENTS.EXIT)` after the player confirmed */
  dispatchEvent?: (event: YaEventName, detail?: object) => unknown;
  /** event name constants; the SDK exposes them, but the string names are the same */
  EVENTS?: Partial<Record<YaPlatformEvent, YaPlatformEvent>>;
  /** device of the player: `type` plus the matching is*() helpers (sdk-params) */
  deviceInfo?: YaDeviceInfo;
  /** browser fullscreen control (sdk-params) */
  screen?: { fullscreen?: YaFullscreen };
  /** writing a string to the clipboard (sdk-params) */
  clipboard?: { writeText?: (text: string) => unknown };
};

/** `ysdk.deviceInfo` (sdk-params): the device the game is running on. */
export type YaDeviceType = 'desktop' | 'mobile' | 'tablet' | 'tv';

export type YaDeviceInfo = {
  type?: YaDeviceType;
  isMobile?: () => boolean;
  isDesktop?: () => boolean;
  isTablet?: () => boolean;
  isTV?: () => boolean;
};

/**
 * `ysdk.screen.fullscreen` (sdk-params). Browsers refuse to switch the mode without a user gesture,
 * which is why the game only ever calls `request()`/`exit()` from a click.
 */
export type YaFullscreen = {
  STATUS_ON?: string;
  STATUS_OFF?: string;
  status?: string;
  request?: () => Promise<void> | void;
  exit?: () => Promise<void> | void;
};

/** Events the platform can send the game (sdk-events). */
export type YaPlatformEvent =
  /** back button on a TV: the game shows its own "leave?" dialog */
  | 'HISTORY_BACK'
  /** the player confirmed leaving in that dialog: the game must report it back */
  | 'EXIT'
  /** the account picker opened: pause progress sync while the player chooses */
  | 'ACCOUNT_SELECTION_DIALOG_OPENED'
  /** the account picker closed: the progress under the player may have changed */
  | 'ACCOUNT_SELECTION_DIALOG_CLOSED';

export type YaEventName =
  | 'game_api_pause'
  | 'game_api_resume'
  | 'multiplayer-sessions-transaction'
  | 'multiplayer-sessions-finish'
  | YaPlatformEvent;

declare global {
  interface Window {
    YaGames?: {
      /**
       * `signed: true` would make the purchase methods return encrypted `signature` data only,
       * for server-side verification. The game checks payments on the client (there is no game
       * server), so it keeps the documented default (`signed: false`) and reads plain data.
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
// The platform pauses the game for its own overlays (the startup full-screen ad among them) and can
// do it before the game has finished booting; the flag lets a slow start avoid starting into a pause.
let platformPaused = false;

type Listener = () => void;
const pauseListeners = new Set<Listener>();
const resumeListeners = new Set<Listener>();
const platformListeners = new Map<YaPlatformEvent, Set<Listener>>();
const platformSubscriptions = new Map<YaPlatformEvent, () => void>();

function emit(listeners: Set<Listener>, source = 'event') {
  for (const cb of [...listeners]) {
    try {
      cb();
    } catch (err) {
      console.error(`[Yandex SDK] ${source} handler failed`, err);
    }
  }
}

/** Subscribe to the startup-critical pause pair once, then attach pending event listeners. */
function subscribePauseResume(sdk: YSDK) {
  try {
    sdk.on?.('game_api_pause', () => {
      platformPaused = true;
      emit(pauseListeners, 'game_api_pause');
    });
    sdk.on?.('game_api_resume', () => {
      platformPaused = false;
      emit(resumeListeners, 'game_api_resume');
    });
  } catch (err) {
    console.error('[Yandex SDK] game_api_pause/resume subscription failed', err);
  }
  for (const event of platformListeners.keys()) attachPlatformEvent(event);
}

/** Keep one SDK listener per event while at least one game-side subscriber exists. */
function attachPlatformEvent(event: YaPlatformEvent) {
  const sdk = ysdk;
  const on = sdk?.on;
  if (platformSubscriptions.has(event) || !platformListeners.get(event)?.size || !sdk || !on) return;
  const handler: Listener = () => {
    const listeners = platformListeners.get(event);
    if (listeners) emit(listeners, event);
  };
  try {
    const returned = on.call(sdk, event, handler);
    platformSubscriptions.set(event, () => {
      try {
        if (sdk.off) sdk.off(event, handler);
        else if (typeof returned === 'function') returned();
      } catch (err) {
        console.warn(`[Yandex SDK] ysdk.off(${event}) failed`, err);
      }
    });
  } catch (err) {
    console.warn(`[Yandex SDK] ysdk.on(${event}) failed`, err);
  }
}

function detachPlatformEvent(event: YaPlatformEvent) {
  const unsubscribe = platformSubscriptions.get(event);
  if (!unsubscribe) return;
  platformSubscriptions.delete(event);
  unsubscribe();
}

/**
 * Is the platform holding the game now? True between `game_api_pause` and `game_api_resume` — the
 * startup full-screen ad works exactly like that, so a game whose sound or loop starts right away
 * must not start into this state (sdk-events).
 */
export function yaPlatformPaused(): boolean {
  return platformPaused;
}

/**
 * Subscribe to a platform event (`HISTORY_BACK`, `EXIT`, `ACCOUNT_SELECTION_DIALOG_*`). The listener
 * is registered once with the SDK and can be removed: the returned function drops it on both sides,
 * the game's registry and the SDK's `off()`. Returns a no-op outside Yandex Games.
 */
export function yaOnPlatformEvent(event: YaPlatformEvent, cb: Listener): () => void {
  const listeners = platformListeners.get(event) ?? new Set<Listener>();
  const wasEmpty = listeners.size === 0;
  platformListeners.set(event, listeners);
  listeners.add(cb);
  if (wasEmpty) attachPlatformEvent(event);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    listeners.delete(cb);
    if (!listeners.size) {
      platformListeners.delete(event);
      detachPlatformEvent(event);
    }
  };
}

/**
 * Report a confirmed exit back to the platform: `ysdk.dispatchEvent(ysdk.EVENTS.EXIT)`, as sdk-events
 * requires after the player confirms leaving in the game's own dialog.
 */
export function yaDispatchExit(): boolean {
  try {
    if (!ysdk?.dispatchEvent) return false;
    const event = ysdk.EVENTS?.EXIT ?? 'EXIT';
    void Promise.resolve(ysdk.dispatchEvent(event)).catch((err) => {
      console.warn('[Yandex SDK] dispatchEvent(EXIT) failed', err);
    });
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] dispatchEvent(EXIT) failed', err);
    return false;
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
/**
 * The SDK script may arrive after the game code: the docs show both connections
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-example), and in the asynchronous one `/sdk.js` is
 * injected with `s.async = true; s.onload = initSDK;`. So when the global is not there yet but the
 * page really does ask for the SDK script, wait for it instead of deciding "this is not Yandex
 * Games" too early. Without the script tag (dev server, itch, own hosting) nothing is awaited.
 */
async function waitForYaGames(timeoutMs = 5_000): Promise<Window['YaGames'] | undefined> {
  if (window.YaGames) return window.YaGames;
  let wantsSdk = false;
  try {
    wantsSdk = !!document.querySelector?.('script[src*="sdk.js"]');
  } catch {
    wantsSdk = false;
  }
  if (!wantsSdk) return undefined;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (window.YaGames) return window.YaGames;
  }
  console.warn('[Yandex SDK] /sdk.js did not appear within the wait window');
  return undefined;
}

/**
 * Run a platform callback without letting a throw escape into the SDK. The docs' example deliberately
 * throws inside a callback to make the point: «it should not abort other code execution». A broken
 * handler of ours must therefore break nothing but itself.
 */
function safeCall(label: string, run: () => void) {
  try {
    run();
  } catch (err) {
    console.error(`[Yandex SDK] ${label} callback failed`, err);
  }
}

export function initYandex(): Promise<YSDK | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Synchronous connection (the usual one): /sdk.js is a blocking <script> ahead of our module, so
    // the global is already here. Asynchronous connection: wait for it, as sdk-example describes.
    const YaGames = await waitForYaGames();
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
/**
 * `ysdk.environment.referrer` — the promo deep link (https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment).
 * `type` is always `promo`; `promoId` identifies the campaign, `intent` hints at the screen to open and
 * `inappId` names the purchase the promo is about.
 */
export function yaReferrer(): YaReferrer | null {
  const referrer = ysdk?.environment?.referrer;
  if (!referrer || referrer.type !== 'promo' || typeof referrer.promoId !== 'string') return null;
  return referrer;
}

export function yaAppId(): string | null {
  return ysdk?.environment?.app?.id ?? null;
}

/**
 * `ysdk.environment.payload` — the free-form `payload` query parameter of the game URL
 * (`?payload=test`), used for hand-made campaign links.
 */
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
 * `ysdk.deviceInfo.type` (sdk-params): `desktop`, `mobile`, `tablet` or `tv`. Null outside the
 * platform — the caller then falls back to its own guesses.
 */
export function yaDeviceType(): YaDeviceType | null {
  try {
    const type = ysdk?.deviceInfo?.type;
    return type === 'desktop' || type === 'mobile' || type === 'tablet' || type === 'tv' ? type : null;
  } catch {
    return null;
  }
}

/**
 * `ysdk.deviceInfo.isMobile()` / `isDesktop()` / `isTablet()` / `isTV()`. The docs keep both the field
 * and helpers, so the game asks them when they exist and treats an absent answer as "unknown".
 */
export function yaDeviceFlag(flag: 'mobile' | 'desktop' | 'tablet' | 'tv'): boolean | null {
  try {
    const info = ysdk?.deviceInfo;
    if (!info) return null;
    const fn = flag === 'mobile'
      ? info.isMobile
      : flag === 'desktop'
        ? info.isDesktop
        : flag === 'tablet'
          ? info.isTablet
          : info.isTV;
    const value = fn?.call(info);
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

/** Current fullscreen status as the platform reports it: `'on' | 'off'`, or null without the SDK. */
export function yaFullscreenStatus(): 'on' | 'off' | null {
  try {
    const fullscreen = ysdk?.screen?.fullscreen;
    if (!fullscreen) return null;
    const status = fullscreen.status;
    if (status === fullscreen.STATUS_ON || status === 'on') return 'on';
    if (status === fullscreen.STATUS_OFF || status === 'off') return 'off';
    return null;
  } catch {
    return null;
  }
}

/** Ask the platform for fullscreen. Must be called from a user action (browser rule). */
export async function yaRequestFullscreen(): Promise<boolean> {
  try {
    const fullscreen = ysdk?.screen?.fullscreen;
    const request = fullscreen?.request;
    if (!request) return false;
    await request.call(fullscreen);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] fullscreen request failed', err);
    return false;
  }
}

/** …and the way back. */
export async function yaExitFullscreen(): Promise<boolean> {
  try {
    const fullscreen = ysdk?.screen?.fullscreen;
    const exit = fullscreen?.exit;
    if (!exit) return false;
    await exit.call(fullscreen);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] fullscreen exit failed', err);
    return false;
  }
}

/** `ysdk.clipboard.writeText(text)` (sdk-params). Returns false when the platform has no clipboard. */
export async function yaCopyText(text: string): Promise<boolean> {
  try {
    const write = ysdk?.clipboard?.writeText;
    if (!write) return false;
    await write(text);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] clipboard.writeText failed', err);
    return false;
  }
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
 * Refreshes at most once per 20 s, so callers may fire it freely. `force=true` discards the memoised
 * Player object before fetching again; use it after authentication or account selection, when the
 * SDK may have changed which account that object represents.
 */
export async function yaRefreshProfile(force = false): Promise<YaProfile | null> {
  const now = Date.now();
  if (!force && profile && now - lastProfileFetch < 20_000) return profile;
  if (force) playerPromise = null;
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

/* ============================== advertising ============================== */

/** Is a fullscreen ad block available? */
export function yaAdvAvailable(): boolean {
  return typeof ysdk?.adv?.showFullscreenAdv === 'function';
}

/** Is a rewarded-video block available? Keep it separate from fullscreen availability. */
export function yaRewardedAdAvailable(): boolean {
  return typeof ysdk?.adv?.showRewardedVideo === 'function';
}

/** `adv.showFullscreenAdv()` — resolves when the ad closed (or when the platform refused to show it). */
export function yaShowFullscreenAdv(): Promise<YaAdResult> {
  return new Promise((resolve) => {
    const adv = ysdk?.adv;
    if (!adv?.showFullscreenAdv) {
      resolve({ shown: false, rewarded: false, error: true });
      return;
    }
    let settled = false;
    const settle = (result: YaAdResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      // All callbacks of the example are passed: onOpen reports a real opening, onClose carries the
      // authoritative `wasShown`, and onError may arrive on its own (too frequent, no fill): the game
      // must never be left waiting behind an ad. Each of them is guarded, so a throw inside a callback
      // cannot abort the SDK or the game.
      adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => safeCall('onOpen', () => undefined),
          onClose: (wasShown) => safeCall('onClose', () => settle({ shown: wasShown === true, rewarded: false })),
          onError: (error) =>
            safeCall('onError', () => {
              console.warn('[Yandex SDK] fullscreen ad error', error);
              settle({ shown: false, rewarded: false, error: true });
            }),
        },
      });
    } catch (err) {
      console.warn('[Yandex SDK] showFullscreenAdv() threw', err);
      settle({ shown: false, rewarded: false, error: true });
    }
  });
}

/** `adv.showRewardedVideo()` — `rewarded` is only true when the platform counted the view. */
export function yaShowRewardedVideo(): Promise<YaAdResult> {
  return new Promise((resolve) => {
    const adv = ysdk?.adv;
    if (!adv?.showRewardedVideo) {
      resolve({ shown: false, rewarded: false, error: true });
      return;
    }
    let settled = false;
    let rewarded = false;
    const settle = (result: YaAdResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      adv.showRewardedVideo({
        callbacks: {
          onRewarded: () =>
            safeCall('onRewarded', () => {
              rewarded = true;
            }),
          onClose: (wasShown) =>
            safeCall('onClose', () => settle({ shown: wasShown === true, rewarded })),
          onError: (error) =>
            safeCall('onError', () => {
              console.warn('[Yandex SDK] rewarded video error', error);
              // `onRewarded` is the SDK's authoritative confirmation; a later close/error must not
              // revoke a reward the player has already earned.
              settle({ shown: false, rewarded, error: true });
            }),
        },
      });
    } catch (err) {
      console.warn('[Yandex SDK] showRewardedVideo() threw', err);
      settle({ shown: false, rewarded: false, error: true });
    }
  });
}

export type YaBannerStatus = { showing: boolean; reason?: string };

/** `adv.getBannerAdvStatus()` — null when banner control is unavailable. */
export async function yaGetBannerAdvStatus(): Promise<YaBannerStatus | null> {
  const adv = ysdk?.adv;
  if (!adv?.getBannerAdvStatus) return null;
  try {
    const status = await adv.getBannerAdvStatus();
    return { showing: status?.stickyAdvIsShowing === true, reason: status?.reason };
  } catch (err) {
    console.warn('[Yandex SDK] getBannerAdvStatus() failed', err);
    return null;
  }
}

/** `adv.showBannerAdv()` — on by default; used here to bring the banner back in the menu. */
export async function yaShowBannerAdv(): Promise<YaBannerStatus | null> {
  const adv = ysdk?.adv;
  if (!adv?.showBannerAdv) return null;
  try {
    const status = await adv.showBannerAdv();
    return { showing: status?.stickyAdvIsShowing === true, reason: status?.reason };
  } catch (err) {
    console.warn('[Yandex SDK] showBannerAdv() failed', err);
    return null;
  }
}

/** `adv.hideBannerAdv()` — used while a run is on, so the banner never covers the HUD. */
export async function yaHideBannerAdv(): Promise<YaBannerStatus | null> {
  const adv = ysdk?.adv;
  if (!adv?.hideBannerAdv) return null;
  try {
    const status = await adv.hideBannerAdv();
    return { showing: status?.stickyAdvIsShowing === true };
  } catch (err) {
    console.warn('[Yandex SDK] hideBannerAdv() failed', err);
    return null;
  }
}

/* ============================ in-app purchases ============================ */

let paymentsPromise: Promise<YaPayments | null> | null = null;

/**
 * `ysdk.getPayments()` preloads everything the payment methods need, so the first `purchase()` is not
 * delayed by the network (the docs recommend it). Falls back to the lazily-initialised
 * `ysdk.payments` object, and to null when purchases are unavailable (outside Yandex, no contract).
 */
export function yaGetPayments(): Promise<YaPayments | null> {
  if (paymentsPromise) return paymentsPromise;
  const request = (async () => {
    if (!ysdk?.getPayments && !ysdk?.payments) return null;
    try {
      if (ysdk.getPayments) return await ysdk.getPayments();
      return ysdk.payments ?? null;
    } catch (err) {
      console.warn('[Yandex SDK] getPayments() failed', err);
      return null;
    }
  })();
  paymentsPromise = request;
  // Share an in-flight preload, but don't cache an unavailable result forever: the shop may retry
  // after a transient network failure when the player opens it again.
  void request.then((payments) => {
    if (!payments && paymentsPromise === request) paymentsPromise = null;
  });
  return request;
}

/** Is there a payment flow at all? (the shop hides behind this outside Yandex Games) */
export function yaPaymentsAvailable(): boolean {
  return Boolean(ysdk?.getPayments || ysdk?.payments) && Boolean(ysdk);
}

/**
 * `payments.purchase({ id })` — opens the payment frame. Rejects when the player closes the window,
 * when the product is unknown or when the payment provider fails; the caller must treat all of those
 * as "no purchase" and must not credit anything.
 */
export async function yaPurchase(id: string, developerPayload?: string): Promise<YaPurchase | null> {
  const payments = await yaGetPayments();
  if (!payments?.purchase) return null;
  try {
    const purchase = await payments.purchase(developerPayload === undefined ? { id } : { id, developerPayload });
    if (!purchase) return null;
    if (!purchase.purchaseToken && typeof purchase.signature === 'string') {
      // `signed: true`: the player has paid, but the receipt is encrypted for a server this game does
      // not have. Never report it as a cancellation — the shop would say "отменено" about real money.
      console.error(
        '[Yandex SDK] purchase() answered with a signature only — payments must be initialised with `signed: false` for client-side processing',
      );
      throw new Error('purchase-signature-not-supported');
    }
    if (!purchase.purchaseToken) return null;
    return purchase;
  } catch (err) {
    // a cancelled purchase is a normal outcome, not an error state
    console.info('[Yandex SDK] purchase not completed', err);
    return null;
  }
}

/**
 * `payments.getPurchases()` — also the mandatory start-up check for unprocessed purchases
 * (requirement 1.13.1): whatever was paid for but not consumed must be delivered on the next launch.
 */
export async function yaGetPurchases(): Promise<YaPurchase[] | null> {
  const payments = await yaGetPayments();
  if (!payments?.getPurchases) return null;
  try {
    const purchases = await payments.getPurchases();
    return Array.isArray(purchases) ? purchases.filter((p) => p && typeof p.purchaseToken === 'string') : [];
  } catch (err) {
    console.warn('[Yandex SDK] getPurchases() failed', err);
    return null;
  }
}

/** `payments.getCatalog()` — product titles, descriptions and prices configured in the Console. */
export async function yaGetCatalog(): Promise<YaProduct[] | null> {
  const payments = await yaGetPayments();
  if (!payments?.getCatalog) return null;
  try {
    const catalog = await payments.getCatalog();
    return Array.isArray(catalog) ? catalog : null;
  } catch (err) {
    console.warn('[Yandex SDK] getCatalog() failed', err);
    return null;
  }
}

/**
 * `payments.consumePurchase(token)` — irreversible. The docs are explicit: save the reward to the
 * player's data first, consume second. Otherwise a failed save loses the purchase for good.
 */
export async function yaConsumePurchase(purchaseToken: string): Promise<boolean> {
  const payments = await yaGetPayments();
  if (!payments?.consumePurchase) return false;
  try {
    await payments.consumePurchase(purchaseToken);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] consumePurchase() failed', err);
    return false;
  }
}

/* ============================== leaderboards ============================== */

/*
 * `ysdk.leaderboards` is used directly: the docs mark `ysdk.getLeaderboards()` as deprecated.
 * Every method is rate-limited by the platform (`setScore` — 1/s, `getPlayerEntry` — 60/5 min,
 * `getEntries` — 20/5 min), so the pacing lives one level above, in src/game/leaderboard.ts.
 */

export function yaLeaderboards(): YaLeaderboards | null {
  return ysdk?.leaderboards ?? null;
}

export function yaLeaderboardAvailable(): boolean {
  return Boolean(ysdk?.leaderboards);
}

/** Availability gate for leaderboard methods whose SDK docs require `isAvailableMethod()`. */
export async function yaIsAvailableMethod(method: string): Promise<boolean> {
  if (!ysdk?.isAvailableMethod) return true; // older builds: assume yes and let the call decide
  try {
    return (await ysdk.isAvailableMethod(method)) === true;
  } catch (err) {
    console.warn('[Yandex SDK] isAvailableMethod() failed', method, err);
    return false;
  }
}

export async function yaGetLeaderboardDescription(name: string): Promise<YaLeaderboardDescription | null> {
  const leaderboards = yaLeaderboards();
  if (!leaderboards?.getDescription) return null;
  try {
    return (await leaderboards.getDescription(name)) ?? null;
  } catch (err) {
    // a missing leaderboard answers 404 — the Console must have it under this technical name
    console.warn('[Yandex SDK] leaderboards.getDescription() failed', name, err);
    return null;
  }
}

/** Post the player's score; false when the platform refused (unauthorised, rate limit, no board). */
export async function yaSetLeaderboardScore(name: string, score: number, extraData?: string): Promise<boolean> {
  const leaderboards = yaLeaderboards();
  if (!leaderboards?.setScore) return false;
  try {
    await leaderboards.setScore(name, score, extraData);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] leaderboards.setScore() failed', name, err);
    return false;
  }
}

/** The player's own row, or null when they have no score yet / are not authorised. */
export async function yaGetLeaderboardPlayerEntry(name: string): Promise<YaLeaderboardEntry | null> {
  const leaderboards = yaLeaderboards();
  if (!leaderboards?.getPlayerEntry) return null;
  try {
    return (await leaderboards.getPlayerEntry(name)) ?? null;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'LEADERBOARD_PLAYER_NOT_PRESENT') console.warn('[Yandex SDK] leaderboards.getPlayerEntry() failed', name, err);
    return null;
  }
}

export async function yaGetLeaderboardEntries(
  name: string,
  options?: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
): Promise<YaLeaderboardEntries | null> {
  const leaderboards = yaLeaderboards();
  if (!leaderboards?.getEntries) return null;
  try {
    const result = await leaderboards.getEntries(name, options);
    return result && Array.isArray(result.entries) ? result : null;
  } catch (err) {
    console.warn('[Yandex SDK] leaderboards.getEntries() failed', name, err);
    return null;
  }
}

/* ============================ desktop shortcut ============================ */

/*
 * `ysdk.shortcut` (https://yandex.ru/dev/games/doc/ru/sdk/sdk-shortcut). Availability depends on the
 * device, the browser and the platform, so the check comes first; the prompt itself is opened only
 * from a click (see src/game/shortcut.ts).
 */

export async function yaCanShowShortcutPrompt(): Promise<boolean | null> {
  if (!ysdk?.shortcut?.canShowPrompt) return null;
  try {
    const result = await ysdk.shortcut.canShowPrompt();
    return result?.canShow === true;
  } catch (err) {
    console.warn('[Yandex SDK] shortcut.canShowPrompt() failed', err);
    return null;
  }
}

/** `shortcut.showPrompt()` — returns whether the player accepted, or null when the call failed. */
export async function yaShowShortcutPrompt(): Promise<{ accepted: boolean } | null> {
  if (!ysdk?.shortcut?.showPrompt) return null;
  try {
    const result = await ysdk.shortcut.showPrompt();
    return { accepted: result?.outcome === 'accepted' };
  } catch (err) {
    console.warn('[Yandex SDK] shortcut.showPrompt() failed', err);
    return null;
  }
}

/* ================================ reviews ================================= */

/*
 * `ysdk.feedback` (https://yandex.ru/dev/games/doc/ru/sdk/sdk-review). The rating dialog may be shown
 * once per session and only after canReview() said yes, so both calls are wrapped here and the pacing
 * lives in src/game/review.ts.
 */

/** `feedback.canReview()` — null when the method is missing (an old SDK build or outside Yandex). */
export async function yaCanReview(): Promise<{ value: boolean; reason?: YaReviewReason } | null> {
  if (!ysdk?.feedback?.canReview) return null;
  try {
    const result = await ysdk.feedback.canReview();
    return { value: result?.value === true, ...(result?.reason ? { reason: result.reason } : {}) };
  } catch (err) {
    console.warn('[Yandex SDK] feedback.canReview() failed', err);
    return null;
  }
}

/**
 * `feedback.requestReview()` — opens the dialog. Returns null when the call failed; otherwise whether
 * the player rated the game (`feedbackSent`; some builds name the field `sentFeedback`).
 */
export async function yaRequestReview(): Promise<{ sent: boolean } | null> {
  if (!ysdk?.feedback?.requestReview) return null;
  try {
    const result = await ysdk.feedback.requestReview();
    return { sent: result?.feedbackSent === true || result?.sentFeedback === true };
  } catch (err) {
    console.warn('[Yandex SDK] feedback.requestReview() failed', err);
    return null;
  }
}

/* ========================= asynchronous multiplayer ========================= */

export function yaMultiplayerSessions(): YaMultiplayerSessions | null {
  return ysdk?.multiplayer?.sessions ?? null;
}

export function yaMultiplayerAvailable(): boolean {
  return Boolean(yaMultiplayerSessions()?.init && yaMultiplayerSessions()?.commit);
}

/**
 * `sessions.init()` — loads opponent sessions (their recorded timelines) before the shift starts.
 * Fails quietly: a broken multiplayer must never keep the player from playing.
 */
export async function yaMultiplayerInit(params: YaMultiplayerInitParams): Promise<YaMultiplayerSession[]> {
  const sessions = yaMultiplayerSessions();
  if (!sessions?.init) return [];
  try {
    const loaded = await sessions.init(params);
    return Array.isArray(loaded) ? loaded.filter((s) => s && typeof s.id === 'string') : [];
  } catch (err) {
    console.warn('[Yandex SDK] multiplayer.sessions.init() failed', err);
    return [];
  }
}

/** `sessions.commit(payload)` — queue one transaction; the SDK fills in its id and time. */
export function yaMultiplayerCommit(payload: object): boolean {
  const sessions = yaMultiplayerSessions();
  if (!sessions?.commit) return false;
  try {
    sessions.commit(payload);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] multiplayer.sessions.commit() failed', err);
    return false;
  }
}

/** `sessions.push(meta)` — publish the finished shift so it can be replayed for other players. */
export async function yaMultiplayerPush(meta: { meta1?: number; meta2?: number; meta3?: number }): Promise<boolean> {
  const sessions = yaMultiplayerSessions();
  if (!sessions?.push) return false;
  try {
    await sessions.push(meta);
    return true;
  } catch (err) {
    console.warn('[Yandex SDK] multiplayer.sessions.push() failed', err);
    return false;
  }
}

/**
 * Subscribe to the replay events (used when `isEventBased: true`). Returns an unsubscribe function;
 * outside Yandex Games it is a no-op.
 */
export function yaOnMultiplayer(events: Partial<YaMultiplayerEvents>): () => void {
  if (!ysdk?.on) return () => undefined;
  const onTransaction = (payload?: never) => {
    const data = payload as unknown as { opponentId?: string; transactions?: YaSessionTransaction[] };
    const opponentId = data?.opponentId;
    const transactions = data?.transactions;
    if (typeof opponentId !== 'string' || !opponentId || !Array.isArray(transactions)) return;
    safeCall('multiplayer-sessions-transaction', () => events.transaction?.({ opponentId, transactions }));
  };
  const onFinish = (payload?: never) => {
    const opponentId = typeof payload === 'string' ? payload : (payload as unknown as { opponentId?: string })?.opponentId;
    if (opponentId) safeCall('multiplayer-sessions-finish', () => events.finish?.(opponentId));
  };
  try {
    ysdk.on('multiplayer-sessions-transaction', onTransaction);
    ysdk.on('multiplayer-sessions-finish', onFinish);
  } catch (err) {
    console.warn('[Yandex SDK] multiplayer event subscription failed', err);
    return () => undefined;
  }
  // the documented off() pair: the round can be torn down without leaving listeners on the SDK
  return () => {
    try {
      ysdk?.off?.('multiplayer-sessions-transaction', onTransaction);
      ysdk?.off?.('multiplayer-sessions-finish', onFinish);
    } catch (err) {
      console.warn('[Yandex SDK] ysdk.off() failed', err);
    }
  };
}

function safeString(read: () => string): string {
  try {
    const value = read();
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
