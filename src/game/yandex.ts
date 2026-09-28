/**
 * Yandex Games SDK bridge.
 * Safe no-op everywhere else (local dev, itch, plain hosting): every call
 * resolves gracefully when the SDK script isn't present.
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
};

declare global {
  interface Window {
    YaGames?: { init: () => Promise<YSDK> };
  }
}

let ysdk: YSDK | null = null;
let initPromise: Promise<YSDK | null> | null = null;
let readySent = false;
let gameplayActive = false;

/** initialise the SDK once; resolves null when not on Yandex Games */
export function initYandex(): Promise<YSDK | null> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // the sdk script may still be loading — give it a short grace period
      for (let i = 0; i < 20 && !window.YaGames; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!window.YaGames) return null;
      ysdk = await window.YaGames.init();
      return ysdk;
    } catch {
      return null;
    }
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

/** tell Yandex the game finished loading and is interactive (required) */
export function yaLoadingReady() {
  if (readySent) return;
  readySent = true;
  try {
    ysdk?.features?.LoadingAPI?.ready?.();
  } catch {
    /* ignore */
  }
}

/** GameplayAPI: call on actual play start / on pause, menus, game over */
export function yaGameplayStart() {
  if (gameplayActive) return;
  gameplayActive = true;
  try {
    ysdk?.features?.GameplayAPI?.start?.();
  } catch {
    /* ignore */
  }
}

export function yaGameplayStop() {
  if (!gameplayActive) return;
  gameplayActive = false;
  try {
    ysdk?.features?.GameplayAPI?.stop?.();
  } catch {
    /* ignore */
  }
}
