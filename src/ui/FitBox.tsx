import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Requirement 1.10 (https://yandex.ru/dev/games/doc/ru/requirements/1/10): at any window size the
 * screen has to show its buttons whole — moderation shrinks the window along each axis and checks that
 * nothing important is cut off or overlapped. Full-screen menus here are tall (title, modes, records,
 * buttons), so on a short window they used to spill past the bottom edge and rely on their own scroll.
 *
 * FitBox measures the content and, when it does not fit, scales it down just enough to fit. The scale
 * is capped at `MIN_SCALE`; if even that is not enough, the box scrolls — the docs allow the game's own
 * scrolling as a last resort. `transform` does not change layout sizes, so the natural height stays
 * measurable and the box stops scrolling as soon as the scaled content fits.
 */
const MIN_SCALE = 0.42;

export function FitBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState(0);

  useLayoutEffect(() => {
    let followUp = 0;
    const measure = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const style = window.getComputedStyle(outer);
      const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      const available = outer.clientHeight - padding;
      const natural = inner.scrollHeight;
      if (natural <= 0 || available <= 0) {
        setScale(1);
        setNatural(0);
        return;
      }
      setNatural(natural);
      // a hair of margin: fonts and late layout shifts must not push a row past the screen edge
      const next = natural > available ? Math.max(MIN_SCALE, (available / natural) * 0.995) : 1;
      setScale(next);
      // a resize must not leave the box scrolled into the middle of the menu
      outer.scrollTop = 0;
    };

    // the viewport can change in several steps (resize event, media queries, reflow): measure at once,
    // again on the next frame and once more after the dust settles
    const schedule = () => {
      measure();
      window.cancelAnimationFrame(followUp);
      followUp = window.requestAnimationFrame(() => {
        measure();
        window.setTimeout(measure, 200);
      });
    };

    schedule();
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (observer) {
      if (outerRef.current) observer.observe(outerRef.current);
      if (innerRef.current) observer.observe(innerRef.current);
    }
    const timer = window.setTimeout(schedule, 300); // web fonts
    return () => {
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      window.clearTimeout(timer);
      window.cancelAnimationFrame(followUp);
    };
  }, []);

  return (
    // The spacer takes the *scaled* height, so the layout box of the scaled content never sticks out:
    // `margin: auto` centres it while it fits and collapses when it does not, letting the box scroll
    // from the top (own scrolling, which the docs allow) instead of hiding the first rows.
    <div
      ref={outerRef}
      data-fit-outer
      data-fit-scale={scale}
      className={`relative flex h-full w-full flex-col overflow-y-auto overscroll-contain ${className}`}
    >
      <div className="m-auto w-full" style={{ height: natural ? Math.ceil(natural * scale) : undefined }}>
        <div
          ref={innerRef}
          data-fit-inner
          className="w-full"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
