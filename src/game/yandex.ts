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

type YSDK = {
  environment: YaEnvironment;
  /** Server-synchronised Unix timestamp in milliseconds (tamper-resistant). */
  serverTime?: () => number;
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
