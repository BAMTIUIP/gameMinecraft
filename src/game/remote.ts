/**
 * TV adaptation (requirement 1.6.3, https://yandex.ru/dev/games/doc/ru/requirements/1/6/3).
 *
 * The page asks for five things and this module is the game-side answer to three of them:
 *
 *  - **arrows on the remote** — `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`. In gameplay the engine
 *    already treats them as WASD aliases (movement), and here they become menu navigation: focus moves
 *    to the nearest interactive element in the pressed direction, which is exactly what a remote with
 *    no pointer needs. Movement of the focus is spatial, so it matches what the player sees;
 *  - **OK** — `Enter`. It activates whatever item is focused, and inside a run it swings the tool, so a
 *    remote alone is enough to play;
 *  - **Back** — the platform reports it as `HISTORY_BACK` (see `platform.ts`). The docs describe the
 *    behaviour: in the start menu it opens the leave confirmation, and during a run a single press
 *    pauses the game and shows the in-game menu, while a second press (within a couple of seconds)
 *    opens the leave confirmation. `backIntent()` below is that rule as a pure function.
 *
 * Two more points of the page need no code of their own but are pinned by checks: the game fills the
 * whole screen (the canvas is full-viewport and the fullscreen toggle lives in the settings) and it
 * links to no other games of the developer.
 */

import { deviceKind } from './params';

/** Is the player on a TV? The platform reports it as `deviceInfo.type === 'tv'`. */
export function tvMode(): boolean {
  return deviceKind() === 'tv';
}

/* ------------------------------- Back button ------------------------------- */

/** a second Back press inside this window counts as "leave the game" */
export const DOUBLE_BACK_MS = 2_500;

export type BackAction = 'exit' | 'pause';

/**
 * What the Back button means right now.
 *  - a run is on screen and no Back was pressed recently → pause and open the in-game menu;
 *  - the same press again within `DOUBLE_BACK_MS` → the leave dialog;
 *  - the player is already in a menu (start menu, pause menu, results) → the leave dialog right away.
 */
export function backIntent(
  phase: string,
  lastBackAt: number,
  now: number,
  windowMs = DOUBLE_BACK_MS,
): BackAction {
  if (phase !== 'playing') return 'exit';
  return lastBackAt > 0 && now - lastBackAt <= windowMs ? 'exit' : 'pause';
}

/* --------------------------- spatial focus movement --------------------------- */

export type Direction = 'up' | 'down' | 'left' | 'right';

export type FocusRect = { x: number; y: number; w: number; h: number };

export type FocusBox = { id: string; rect: FocusRect };

const center = (rect: FocusRect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

/**
 * Pick the element the focus should move to: the closest one in the pressed direction, measured by the
 * distance along that axis plus half of the perpendicular offset — the classic spatial-navigation
 * score. Returns null when nothing lies that way.
 */
export function pickCandidate(current: FocusRect | null, boxes: FocusBox[], direction: Direction): string | null {
  if (!boxes.length) return null;
  const from = current ? center(current) : { x: 0, y: 0 };
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;

  let best: { id: string; score: number } | null = null;
  for (const box of boxes) {
    const to = center(box.rect);
    const primary = (horizontal ? to.x - from.x : to.y - from.y) * sign;
    if (primary <= 1) continue; // behind or on the same line
    const perpendicular = horizontal ? Math.abs(to.y - from.y) : Math.abs(to.x - from.x);
    const score = primary + perpendicular * 0.5;
    if (!best || score < best.score) best = { id: box.id, score };
  }
  return best?.id ?? null;
}

/* ------------------------------- DOM plumbing ------------------------------- */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = window.getComputedStyle?.(el);
  return !style || (style.visibility !== 'hidden' && style.display !== 'none');
}

/** The scope of the navigation: the top-most modal dialog when one is open, the page otherwise. */
function navScope(): ParentNode {
  const dialogs = Array.from(document.querySelectorAll('[aria-modal="true"], [role="dialog"]')).filter(isVisible);
  return (dialogs.at(-1) as ParentNode | undefined) ?? document;
}

function candidates(scope: ParentNode): Array<{ el: HTMLElement; box: FocusBox }> {
  const nodes = Array.from(scope.querySelectorAll(FOCUSABLE)).filter((el) => isVisible(el)) as HTMLElement[];
  return nodes.map((el, index) => {
    const rect = el.getBoundingClientRect();
    return { el, box: { id: String(index), rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height } } };
  });
}

/**
 * The attribute that marks the element a remote should land on when a dialog opens. The leave dialog
 * uses it for its safe answer, so the first OK press cannot end the game by accident.
 */
export const REMOTE_PRIMARY_ATTR = 'data-remote-primary';

/** The class that paints the focus ring for remote users (see index.css). */
export const REMOTE_FOCUS_CLASS = 'remote-focus';

function paintFocus(el: HTMLElement | null) {
  for (const node of Array.from(document.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`))) {
    node.classList.remove(REMOTE_FOCUS_CLASS);
  }
  // Browsers do not always treat a programmatic focus as "keyboard" focus, and on a TV the player has
  // no other way to see where they are: the ring is painted explicitly.
  el?.classList.add(REMOTE_FOCUS_CLASS);
}

/** Move the focus in the pressed direction. Returns false when there is nothing that way. */
export function moveFocus(direction: Direction): boolean {
  const scope = navScope();
  const list = candidates(scope);
  if (!list.length) return false;
  const active = document.activeElement as HTMLElement | null;
  const current = list.find((item) => item.el === active);
  const currentRect = current?.box.rect ?? null;
  const targetId = pickCandidate(currentRect, list.map((item) => item.box), direction);
  const target = targetId === null ? null : list[Number(targetId)];
  if (!target) return false;
  target.el.focus({ preventScroll: true });
  paintFocus(target.el);
  return true;
}

/**
 * Focus the first interactive element of the current scope (what a remote does when a menu opens).
 * An element marked with `data-remote-primary` wins: dialogs put it on the answer that is safe to
 * accept blindly.
 */
export function focusFirst(): boolean {
  const scope = navScope();
  const list = candidates(scope);
  const preferred = list.find((item) => item.el.hasAttribute(REMOTE_PRIMARY_ATTR));
  const target = preferred ?? list[0];
  if (!target) return false;
  target.el.focus({ preventScroll: true });
  paintFocus(target.el);
  return true;
}

/** The element a remote's OK press should activate: the focused one, else the first one. */
export function activateFocused(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (active && typeof active.click === 'function' && active !== document.body) {
    active.click();
    return true;
  }
  if (!focusFirst()) return false;
  (document.activeElement as HTMLElement).click();
  return true;
}

/**
 * Bind the remote keys. `isActive` decides whether menu navigation should run at all: during a run
 * without an open inventory the arrows must keep moving the player, so the caller switches this off.
 * Inputs (the nickname field) keep their typing: arrow keys inside them are never hijacked.
 */
export function installRemoteKeys(isActive: () => boolean): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (!isActive()) return;
    const direction: Direction | null =
      event.code === 'ArrowUp'
        ? 'up'
        : event.code === 'ArrowDown'
          ? 'down'
          : event.code === 'ArrowLeft'
            ? 'left'
            : event.code === 'ArrowRight'
              ? 'right'
              : null;
    if (direction) {
      // a remote repeats a held arrow: let the repeat move the focus one step at a time
      if (moveFocus(direction) && !event.repeat) event.preventDefault();
      else event.preventDefault();
      return;
    }
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (event.repeat) return;
      if (activateFocused()) event.preventDefault();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
