import type { CSSProperties } from 'react';
import { getToolSpec, toolWearStage } from '../game/tools';

const DARK = '#211b1b';

type ToolSpriteProps = {
  id: number;
  size?: number;
  durability?: number;
  className?: string;
  style?: CSSProperties;
};

/** Original ember-forged pixel silhouettes; the same sprite is used throughout the UI. */
export function ToolSprite({ id, size = 32, durability, className = '', style }: ToolSpriteProps) {
  const spec = getToolSpec(id);
  if (!spec) return null;
  const stage = spec.maxDurability > 0
    ? toolWearStage(durability ?? spec.maxDurability, spec.maxDurability)
    : 0;
  const { head, edge, accent, handle } = spec;
  // Wood should read as a simple, warm plank tool rather than a dark, ornate relic.
  const outline = spec.tier === 0 ? '#4b2a1c' : DARK;
  const shaft = [
    [13, 33], [16, 30], [19, 27], [22, 24], [25, 21], [28, 18], [31, 15],
  ];

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`pixelated shrink-0 ${className}`}
      style={{ imageRendering: 'pixelated', ...style }}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {/* The pick head is intentionally inset. Its diagonal handle and long head
          used to touch the icon frame and stop reading as a pickaxe at small sizes. */}
      <g transform={spec.kind === 'pickaxe' ? 'translate(4 4) scale(0.83)' : undefined}>
      {spec.kind === 'bow' ? (
        <g>
          <path d="M13 7h4v3h3v5h3v8h-3v7h-3v5h-4v4h-4v-5h4v-4h3v-5h3v-8h-3v-5h-3v-3h-4z" fill={outline} />
          <path d="M13 9h3v3h3v5h2v6h-2v6h-3v5h-3v2h-2v-2h3v-5h3v-6h2v-6h-2v-5h-3v-3h-3z" fill={head} />
          <path d="M13 10h2v4h3v5h2v4h-2v5h-3v5h-2v2h-1v-2h2v-5h3v-5h2v-4h-2v-5h-3v-4h-1z" fill={edge} />
          <path d="M13 8 13 39" stroke="#e7dcc8" strokeWidth="1.5" />
          <path d="M13 8 13 39" stroke={accent} strokeWidth="0.7" />
          <rect x="10" y="37" width="5" height="4" fill={handle} />
          <rect x="11" y="37" width="2" height="2" fill={edge} />
        </g>
      ) : (
        <g>
          {spec.kind === 'sword' ? (
            <g>
              <path d="M20 26 34 12l7-4-3 8-14 14z" fill={outline} />
              <path d="M22 25 35 12l4-2-2 5-13 13z" fill={head} />
              <path d="M25 25 36 14l2-4-4 2-11 11z" fill={edge} />
              <path d="M28 19 36 11" stroke={accent} strokeWidth="1.6" />
              <path d="M13 28 17 24l9 9-4 4z" fill={outline} />
              <path d="M14 28 17 26l7 7-2 2z" fill={edge} />
              <rect x="10" y="31" width="7" height="6" fill={outline} />
              <rect x="11" y="32" width="5" height="4" fill={handle} />
              <rect x="12" y="33" width="2" height="2" fill={accent} />
            </g>
          ) : (
            <g>
              {shaft.map(([x, y], i) => (
                <g key={i}>
                  <rect x={x - 1} y={y - 1} width="7" height="7" fill={outline} />
                  <rect x={x} y={y} width="5" height="5" fill={handle} />
                  <rect x={x + 1} y={y + 1} width="2" height="3" fill={i % 2 ? accent : handle} />
                </g>
              ))}
              {spec.kind === 'pickaxe' && (
                <g>
                  {/* Full centered pick head: both pointed ends stay inside the 48px icon. */}
                  <path d="M8 13 12 8h24l4 5-4 5h-7l-5-3-5 3h-7z" fill={outline} />
                  <path d="M11 13 14 10h20l3 3-2 3h-6l-5-3-5 3h-6z" fill={head} />
                  <path d="M14 10h20v2H14zM11 13h6v2h-6zM31 13h6v2h-6z" fill={edge} />
                  <path d="M21 11h6v1h-6z" fill={accent} />
                </g>
              )}
              {spec.kind === 'axe' && (
                <g>
                  <path d="M10 8h18l5 4v6l-5 5H17l-4-4h-5V13z" fill={outline} />
                  <path d="M11 10h15l4 3v4l-4 4h-8l-4-4h-3z" fill={head} />
                  <path d="M10 10h15v2H11v5H9v-4z" fill={edge} />
                  <path d="M12 12h4v5h-4z" fill={accent} />
                </g>
              )}
              {spec.kind === 'hoe' && (
                <g>
                  <path d="M24 8h14v4h3v5h-4v5h-8v-4h-5z" fill={outline} />
                  <path d="M26 10h10v3h3v3h-3v4h-7v-4h-3z" fill={head} />
                  <path d="M27 10h8v2h-8zM34 13h5v2h-5z" fill={edge} />
                  <path d="M15 39 18 40 30 16 26 14z" fill={outline} />
                  <path d="M17 37 19 38 29 16 27 15z" fill={handle} />
                  <path d="M20 32h3v2h-3zM23 26h3v2h-3z" fill={accent} />
                </g>
              )}
              {spec.kind === 'shovel' && (
                <g>
                  <path d="M25 7h12v4h3v10h-3v4H25v-4h-3V11h3z" fill={outline} />
                  <path d="M27 9h8v3h3v7h-3v3h-8v-3h-2v-7h2z" fill={head} />
                  <path d="M27 10h7v2h-7zM26 13h2v4h-2z" fill={edge} />
                  <rect x="30" y="10" width="3" height="2" fill={accent} />
                </g>
              )}
            </g>
          )}
        </g>
      )}

      {stage >= 1 && (
        <g fill="#261b1d">
          <rect x="33" y="13" width="3" height="2" />
          <rect x="17" y="28" width="2" height="2" />
        </g>
      )}
      {stage >= 2 && (
        <g>
          <path d="M29 13 26 17 29 19 25 23" fill="none" stroke="#23191b" strokeWidth="2.2" />
          <path d="M29 13 26 17" fill="none" stroke={accent} strokeWidth="0.8" />
          <rect x="20" y="30" width="3" height="2" fill="#2a201e" />
        </g>
      )}
      {stage >= 3 && (
        <g>
          <path d="M34 11 31 15 34 17 30 21" fill="none" stroke="#171518" strokeWidth="3.2" />
          <path d="M34 11 31 15" fill="none" stroke="#ff7045" strokeWidth="1.2" />
          <rect x="36" y="15" width="3" height="3" fill="#282126" />
          <rect x="21" y="27" width="3" height="3" fill="#302322" />
        </g>
      )}
      </g>
    </svg>
  );
}

type DurabilityBarProps = {
  current: number;
  max: number;
  className?: string;
  title?: string;
};

export function DurabilityBar({ current, max, className = '', title }: DurabilityBarProps) {
  if (max <= 0) {
    return (
      <span className={`inline-flex items-center justify-center font-display leading-none text-[#ff8a5a] ${className}`} title={title}>
        ∞
      </span>
    );
  }
  const ratio = Math.max(0, Math.min(1, current / max));
  const color = ratio > 0.55 ? '#91d05e' : ratio > 0.25 ? '#f4b942' : '#ef6254';
  return (
    <span
      className={`block overflow-hidden rounded-sm bg-black/70 ${className}`}
      title={title}
      role="img"
      aria-label={`${Math.ceil(ratio * 100)}% durability`}
    >
      <span className="block h-full transition-[width] duration-200" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />
    </span>
  );
}
