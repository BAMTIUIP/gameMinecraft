import type { SVGProps } from 'react';

/** Compact forge-dark currency mark; the balance remains saved in the legacy profile field. */
export function NetheriteCoinIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className ?? 'inline-block h-4 w-4 shrink-0 align-[-0.18em]'}
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      {...props}
    >
      <defs>
        <linearGradient id="netherite-coin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d09b69" />
          <stop offset=".35" stopColor="#65534c" />
          <stop offset=".72" stopColor="#312f34" />
          <stop offset="1" stopColor="#bb8057" />
        </linearGradient>
        <linearGradient id="netherite-coin-face" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#69575a" />
          <stop offset=".5" stopColor="#38383e" />
          <stop offset="1" stopColor="#24252b" />
        </linearGradient>
        <linearGradient id="netherite-coin-mark" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4c28a" />
          <stop offset="1" stopColor="#a66b4c" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="13" fill="#171619" stroke="#101014" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="11" fill="url(#netherite-coin-rim)" stroke="#d4a276" strokeWidth=".7" />
      <circle cx="14" cy="14" r="8.8" fill="url(#netherite-coin-face)" stroke="#2b2628" strokeWidth="1" />
      <path d="M9 9h10v2H9zM8 13h3v7H8zM17 13h3v7h-3zM11 18h6v2h-6z" fill="url(#netherite-coin-mark)" />
      <path d="M11 11h6v2h-6zM11 14h2v4h-2zM15 14h2v4h-2z" fill="#d9a77d" />
      <path d="M5 13h1v2H5zM22 13h1v2h-1zM13 4h2v1h-2zM13 23h2v1h-2z" fill="#f0c899" />
    </svg>
  );
}
