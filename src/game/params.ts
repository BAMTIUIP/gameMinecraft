/**
 * Other SDK objects: device info, browser fullscreen and the clipboard
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-params).
 *
 * The page describes three small objects and the game uses each for what it is good at:
 *
 *  - **`deviceInfo`** — `type` plus the `isMobile()` / `isTablet()` / `isTV()` helpers. The game asks
 *    the platform first and only then falls back to its own guesses (pointer type, user agent), so
 *    the touch controls appear on exactly the devices the platform calls mobile or tablet;
 *  - **`screen.fullscreen`** — `status`, `request()`, `exit()`. Browsers forbid switching the mode
 *    without a user gesture and the catalogue has its own button in the corner, so the game only
 *    exposes its own toggle in the settings dialog and always calls it from a click. Outside Yandex
 *    Games the same toggle drives the native Fullscreen API;
 *  - **`clipboard.writeText()`** — used by the "copy result" button on the results screen: after a
 *    shift the player can put a line with their score, blocks and depth on the clipboard with one
 *    click. A fallback to `navigator.clipboard` keeps the button alive off-platform.
 */

import {
  yaCopyText,
  yaDeviceFlag,
  yaDeviceType,
  yaExitFullscreen,
  yaFullscreenStatus,
  yaRequestFullscreen,
  type YaDeviceType,
} from './yandex';

/* ------------------------------- device info ------------------------------ */

function guessDevice(): YaDeviceType {
  try {
    const nav = navigator as Navigator & { userAgent?: string };
    const ua = nav.userAgent ?? '';
    if (/smart-tv|smarttv|hbbtv|netcast|viera|bravia|tv;/i.test(ua)) return 'tv';
    if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
    if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

/** The device the game runs on: the platform's answer when available, our own guess otherwise. */
export function deviceKind(): YaDeviceType {
  const platform = yaDeviceType();
  if (platform) return platform;
  if (yaDeviceFlag('mobile')) return 'mobile';
  if (yaDeviceFlag('tablet')) return 'tablet';
  if (yaDeviceFlag('tv')) return 'tv';
  if (yaDeviceFlag('desktop')) return 'desktop';
  return guessDevice();
}

/** Should the game show touch controls? Mobile and tablet per the platform, pointer type otherwise. */
export function touchDevice(): boolean {
  const kind = deviceKind();
  if (kind === 'mobile' || kind === 'tablet') return true;
  if (kind === 'desktop' || kind === 'tv') {
    // the platform was explicit; on a desktop with a touchscreen the coarse pointer still wins
    if (yaDeviceType()) return false;
  }
  try {
    return window.matchMedia?.('(pointer: coarse)').matches ?? false;
  } catch {
    return false;
  }
}

/** A TV: the platform sends `HISTORY_BACK` there, and the game answers with its own exit dialog. */
export function tvDevice(): boolean {
  return deviceKind() === 'tv';
}

/* -------------------------------- fullscreen ------------------------------- */

function nativeFullscreen(): { element: Element | null; request?: () => Promise<void>; exit?: () => Promise<void> } {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const element = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  const root = document.documentElement as HTMLElement & {
    requestFullscreen?: () => Promise<void>;
    webkitRequestFullscreen?: () => Promise<void>;
  };
  const d = document as Document & { exitFullscreen?: () => Promise<void>; webkitExitFullscreen?: () => Promise<void> };
  return {
    element,
    request: root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root),
    exit: d.exitFullscreen?.bind(document) ?? d.webkitExitFullscreen?.bind(document),
  };
}

/** Is the browser in fullscreen right now — by the platform's account or by the DOM's? */
export function fullscreenOn(): boolean {
  const platform = yaFullscreenStatus();
  if (platform) return platform === 'on';
  try {
    return !!nativeFullscreen().element;
  } catch {
    return false;
  }
}

/** Can the game offer a fullscreen toggle at all? */
export function fullscreenAvailable(): boolean {
  if (yaFullscreenStatus() !== null) return true;
  try {
    const native = nativeFullscreen();
    return !!(native.request || native.exit);
  } catch {
    return false;
  }
}

/**
 * Switch the fullscreen mode: through the platform object inside Yandex Games, through the native
 * Fullscreen API outside. Must be called from a user action — browsers refuse otherwise.
 */
export async function toggleFullscreen(): Promise<boolean> {
  const platformStatus = yaFullscreenStatus();
  if (platformStatus !== null) {
    // Invoke the platform method before the first await so the browser's user-activation is preserved.
    const request = platformStatus === 'on' ? yaExitFullscreen() : yaRequestFullscreen();
    const ok = await request;
    if (ok) return fullscreenOn();
    // the platform refused: still report the state we are in
    return fullscreenOn();
  }
  try {
    const native = nativeFullscreen();
    if (native.element) await native.exit?.();
    else await native.request?.();
  } catch (err) {
    console.warn('[params] native fullscreen failed', err);
    return fullscreenOn();
  }
  return fullscreenOn();
}

/* --------------------------------- clipboard ------------------------------- */

/**
 * Put a line of text on the clipboard: `ysdk.clipboard.writeText()` on the platform, the standard
 * `navigator.clipboard` elsewhere. `document.execCommand('copy')` is the last resort for browsers
 * that only expose the old API; the button says honestly when nothing worked.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  if (await yaCopyText(text)) return true;
  try {
    const clipboard = (navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    /* the modern API is missing or blocked: try the old trick below */
  }
  let area: HTMLTextAreaElement | null = null;
  let appended = false;
  try {
    area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    appended = true;
    area.select();
    return document.execCommand?.('copy') ?? false;
  } catch {
    return false;
  } finally {
    if (appended && area) {
      try {
        document.body.removeChild(area);
      } catch {
        /* a blocked fallback should not leave its temporary textarea in the game UI */
      }
    }
  }
}
