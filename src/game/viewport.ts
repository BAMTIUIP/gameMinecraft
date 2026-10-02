/**
 * Correct display (requirement 1.10, https://yandex.ru/dev/games/doc/ru/requirements/1/10).
 *
 * The page forbids a browser scrollbar and swipe-to-refresh: the game must fill the window whatever its
 * size is, and the page itself must not move. Most of that is layout (`overflow: hidden`, `100dvh`, a
 * responsive UI, the engine redrawing its canvas on `resize`), but two platform behaviours need an
 * explicit guard:
 *
 *  - **pull-to-refresh** — iOS Safari ignores `overscroll-behavior`, so a downward swipe at the top of
 *    the page reloads the game. The only reliable cure there is a non-passive `touchmove` listener that
 *    calls `preventDefault()`. It must *not* swallow gestures inside the game's own scrollable panels
 *    (the shop, the leaderboard, long menus): the docs allow the game's own scrolling, only the
 *    browser's is forbidden. So the rule is: prevent the gesture unless it started inside an element
 *    that can actually scroll itself;
 *  - **pinch-zoom and rubber-banding** — `maximum-scale=1` in the meta tag covers most of it, and the
 *    `gesturestart`/`gesturechange` events are a second lock for Safari.
 */

/** The nearest ancestor that can scroll the gesture itself (the game's own scrolling is allowed). */
export function scrollableAncestor(target: EventTarget | null): Element | null {
  let el: Element | null = target instanceof Element ? target : null;
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle?.(el);
    if (style) {
      const vertical = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
      const horizontal = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      if (vertical || horizontal) return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Should this touch gesture be swallowed (so the page cannot scroll or refresh)? Multi-finger gestures
 * (pinch) are always swallowed; single-finger ones only when nothing under the finger can scroll.
 */
export function blocksTouchGesture(target: EventTarget | null, touchCount: number): boolean {
  if (touchCount > 1) return true;
  return scrollableAncestor(target) === null;
}

/**
 * Lock the page itself: no browser scroll, no pull-to-refresh, no pinch-zoom. Everything the game wants
 * to scroll it scrolls inside its own panels. Returns a disposer (used by the tests).
 */
export function lockViewport(): () => void {
  const doc = document;
  doc.documentElement.style.overscrollBehavior = 'none';
  if (doc.body) doc.body.style.overscrollBehavior = 'none';

  const onTouchMove = (event: TouchEvent) => {
    if (blocksTouchGesture(event.target, event.touches.length)) event.preventDefault();
  };
  const onGesture = (event: Event) => event.preventDefault();

  doc.addEventListener('touchmove', onTouchMove, { passive: false });
  doc.addEventListener('gesturestart', onGesture as EventListener);
  doc.addEventListener('gesturechange', onGesture as EventListener);

  return () => {
    doc.removeEventListener('touchmove', onTouchMove);
    doc.removeEventListener('gesturestart', onGesture as EventListener);
    doc.removeEventListener('gesturechange', onGesture as EventListener);
  };
}
