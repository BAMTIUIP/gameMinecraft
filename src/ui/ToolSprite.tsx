import type { CSSProperties } from 'react';
import { getToolSpec, toolWearStage } from '../game/tools';

const DARK = '#211b1b';

type ToolSpriteProps = {
  id: number;
  size?: number;
  durability?: number;
  className?: string;
  style?: CSSProperties;
  /** Use the same silhouettes for monochrome HUD/stat icons. */
  monochrome?: boolean;
};

type Palette = {
  head: string;
  edge: string;
  accent: string;
  handle: string;
  outline: string;
};

/** The shared diagonal haft used by every hand tool; the broad end is hidden under its head. */
function PixelHaft({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M7 37 11 41 37 15 33 11Z" fill={p.outline} />
      <path d="M11 37 13 39 35 17 33 15Z" fill={p.handle} />
      <path d="M14 34 17 37 19 35 16 32Z" fill={p.accent} />
      <path d="M20 28 23 31 25 29 22 26Z" fill={p.handle} />
      <path d="M26 22 29 25 31 23 28 20Z" fill={p.accent} />
    </g>
  );
}

/** A steeper haft puts its axis under the centre of the horizontal pick head. */
function PickHaft({ p }: { p: Palette }) {
  return (
    <g>
      {/* The haft axis runs directly through the centre socket at x=24. */}
      <path d="M8 37 11 40 25 17 22 14Z" fill={p.outline} />
      <path d="M11 37 13 39 24 17 23 15Z" fill={p.handle} />
      <path d="M11 33 14 36 16 34 13 31Z" fill={p.accent} />
      <path d="M15 27 18 30 20 28 17 25Z" fill={p.handle} />
      <path d="M19 21 22 24 24 22 21 19Z" fill={p.accent} />
    </g>
  );
}

/** Mirrored downturned tips and a compact socket keep the pick head from reading as a T. */
function PickShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scale = [1, 0.96, 0.88, 0.8][wearStage];
  return (
    <g transform={`translate(24 16) scale(${scale} ${scale}) translate(-24 -16)`}>
      {/* The two blades slope down and away from the handle; the right side mirrors the left. */}
      <g>
        <path d="M23 9H18L14 12L9 15H4L2 20L8 23L13 20L18 17L22 14H24V9Z" fill={p.outline} />
        <path d="M23 11H18L14 14L10 17H7L6 20L9 21L13 19L18 16L22 13H24V11Z" fill={p.head} />
        <path d="M4 16H9L14 13L18 10H22L18 13L13 16L9 19H5Z" fill={p.edge} />
      </g>
      <g transform="translate(48 0) scale(-1 1)">
        <path d="M23 9H18L14 12L9 15H4L2 20L8 23L13 20L18 17L22 14H24V9Z" fill={p.outline} />
        <path d="M23 11H18L14 14L10 17H7L6 20L9 21L13 19L18 16L22 13H24V11Z" fill={p.head} />
        <path d="M4 16H9L14 13L18 10H22L18 13L13 16L9 19H5Z" fill={p.edge} />
      </g>
      <path d="M21 12H25V15H23V18H21V15H20Z" fill={p.accent} />
      {wearStage >= 1 && <path d="M4 17 7 19" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 2 && <path d="M41 18 44 16" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 3 && <path d="M5 19 8 21" stroke={p.head} strokeWidth="1.5" />}
    </g>
  );
}

/** The axe has one broad cutting blade and a narrow socket, never a square hammer head. */
function AxeShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scale = [1, 0.95, 0.87, 0.78][wearStage];
  return (
    <g transform={`translate(23 16) scale(${scale} ${scale}) translate(-23 -16)`}>
      <path d="M28 6H34V9H37V12H39V15H41V18H39V21H36V23H32V20H29V17H26V16H23V18H20V16H18V12H19V9H22V7H28Z" fill={p.outline} />
      <path d="M28 8H33V11H35V13H38V16H39V18H36V20H33V18H30V16H27V14H24V16H22V14H20V11H21V9H24V8H28Z" fill={p.head} />
      <path d="M27 8H30V11H27V14H24V17H21V15H19V12H20V10H23V8H27Z" fill={p.edge} />
      <path d="M31 11H33V14H31Z" fill={p.accent} />
      {wearStage >= 1 && <path d="M37 15 40 17" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 2 && <path d="M35 19 38 20" stroke={p.head} strokeWidth="1.5" />}
      {wearStage >= 3 && <path d="M38 14 41 16" stroke={p.outline} strokeWidth="2" />}
    </g>
  );
}

/** A proper spade silhouette: broad shoulders taper to a visible point, not a stone block. */
function ShovelShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scale = [1, 0.96, 0.89, 0.8][wearStage];
  return (
    <g transform={`translate(26 19) scale(${scale} ${scale}) translate(-26 -19)`}>
      <path d="M28 6H36L40 10H43V15L40 19H37L33 23L31 28L27 23H24L21 18V13L24 9H28Z" fill={p.outline} />
      <path d="M29 8H35L38 11H41V15L38 18H35L32 22L30 19H27L24 16V13L26 10H29Z" fill={p.head} />
      <path d="M29 8H35L38 11H40V13H32V16H28V12H29Z" fill={p.edge} />
      <path d="M25 13H28V17L30 19L28 21H26L23 17V14H25Z" fill={p.edge} />
      <path d="M32 16V21L31 24L30 21V17Z" fill={p.accent} />
      {wearStage >= 1 && <path d="M30 24 32 27" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 2 && <path d="M37 18 40 17" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 3 && <path d="M29 25 31 28" stroke={p.head} strokeWidth="1.5" />}
    </g>
  );
}

/** A short, flat, one-sided hoe blade: deliberately unlike the pointed axe silhouette. */
function HoeShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scale = [1, 0.96, 0.88, 0.8][wearStage];
  return (
    <g transform={`translate(24 12) scale(${scale} ${scale}) translate(-24 -12)`}>
      <path d="M23 7H38V10H35V13H32V16H28V13H25V11H22V9H23Z" fill={p.outline} />
      <path d="M25 9H36V10H34V12H31V14H29V12H26V11H24V10H25Z" fill={p.head} />
      <path d="M24 8H36V9H24Z" fill={p.edge} />
      <path d="M31 10H33V12H31Z" fill={p.accent} />
      {wearStage >= 1 && <path d="M35 10 38 11" stroke={p.outline} strokeWidth="2" />}
      {wearStage >= 2 && <path d="M32 13 35 14" stroke={p.head} strokeWidth="1.5" />}
      {wearStage >= 3 && <path d="M36 9 39 10" stroke={p.outline} strokeWidth="2" />}
    </g>
  );
}

function SwordShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scaleX = [1, 0.97, 0.91, 0.84][wearStage];
  const scaleY = [1, 0.9, 0.78, 0.65][wearStage];
  return (
    <g>
      {/* Wear shortens and narrows the blade around its guard; the hilt stays intact. */}
      <g transform={`translate(24 26) scale(${scaleX} ${scaleY}) translate(-24 -26)`}>
        <path d="M41 5 44 8 41 14 37 19 32 24 27 29 21 23 26 18 31 13 36 8Z" fill={p.outline} />
        <path d="M40 8 42 9 39 14 35 18 31 22 27 27 24 24 29 19 33 14 37 10Z" fill={p.head} />
        <path d="M40 7 42 9 39 13 36 16 34 15 37 10Z" fill={p.edge} />
        <path d="M34 16 36 17 32 22 30 21Z" fill={p.accent} />
        {wearStage >= 1 && <path d="M37 11 35 14 37 15" fill="none" stroke={p.outline} strokeWidth="2.4" />}
        {wearStage >= 2 && <path d="M33 17 31 20 33 21" fill="none" stroke={p.outline} strokeWidth="2.1" />}
        {wearStage >= 3 && <path d="M29 22 27 25 29 26" fill="none" stroke={p.outline} strokeWidth="2" />}
      </g>
      <path d="M16 22 20 18 33 31 29 35Z" fill={p.outline} />
      <path d="M18 22 20 20 31 31 29 33Z" fill={p.edge} />
      <path d="M20 25 24 29 11 42 7 38Z" fill={p.outline} />
      <path d="M20 27 22 29 11 40 9 38Z" fill={p.handle} />
      <path d="M15 32 18 35 16 37 13 34Z" fill={p.accent} />
      <path d="M7 37 12 37 15 40 11 44 6 44 4 41Z" fill={p.outline} />
      <path d="M8 40H11L12 41 10 42H7L6 41Z" fill={p.edge} />
    </g>
  );
}

function BowShape({ p, wearStage }: { p: Palette; wearStage: number }) {
  const scale = [1, 0.98, 0.94, 0.9][wearStage];
  return (
    <g transform={`translate(12 24) scale(${scale}) translate(-12 -24)`}>
      <path d="M10 7H15V10H19V14H22V20H24V28H22V34H19V38H15V41H10V37H14V33H17V28H19V22H17V17H14V13H10Z" fill={p.outline} />
      <path d="M12 9H15V12H18V16H20V21H22V27H20V33H17V36H14V39H12V37H15V33H18V27H19V22H18V17H15V13H12Z" fill={p.head} />
      <path d="M12 10H14V13H17V17H19V22H20V27H18V22H17V18H14V14H12Z" fill={p.edge} />
      <path d="M12 8V40" stroke="#e7dcc8" strokeWidth="1.5" />
      <path d="M12 8V40" stroke={p.accent} strokeWidth="0.7" />
      <rect x="10" y="37" width="5" height="4" fill={p.handle} />
      {wearStage >= 1 && <path d="M14 13 16 16 14 18" fill="none" stroke={p.outline} strokeWidth="1.5" />}
      {wearStage >= 2 && <path d="M17 31 15 33 16 35" fill="none" stroke={p.outline} strokeWidth="1.5" />}
      {wearStage >= 3 && <path d="M12 22V26" stroke={p.handle} strokeWidth="2" />}
    </g>
  );
}

/**
 * Unified pixel-art tool sprite. The silhouettes are redrawn on one 48px grid;
 * they are not cropped source images, so the pickaxe and every other tool keep
 * their full head and handle inside the same tile.
 */
export function ToolSprite({ id, size = 32, durability, className = '', style, monochrome = false }: ToolSpriteProps) {
  const spec = getToolSpec(id);
  if (!spec) return null;
  const stage = spec.maxDurability > 0
    ? toolWearStage(durability ?? spec.maxDurability, spec.maxDurability)
    : 0;
  const p: Palette = monochrome
    ? { head: 'currentColor', edge: 'currentColor', accent: 'currentColor', handle: 'currentColor', outline: 'currentColor' }
    : {
      head: spec.head,
      edge: spec.edge,
      accent: spec.accent,
      handle: spec.handle,
      outline: spec.tier === 0 ? '#4b2a1c' : DARK,
    };

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
      {spec.kind === 'bow' ? (
        <BowShape p={p} wearStage={stage} />
      ) : spec.kind === 'sword' ? (
        <SwordShape p={p} wearStage={stage} />
      ) : (
        <g>
          {spec.kind === 'pickaxe' ? <PickHaft p={p} /> : <PixelHaft p={p} />}
          {spec.kind === 'pickaxe' && <PickShape p={p} wearStage={stage} />}
          {spec.kind === 'axe' && <AxeShape p={p} wearStage={stage} />}
          {spec.kind === 'shovel' && <ShovelShape p={p} wearStage={stage} />}
          {spec.kind === 'hoe' && <HoeShape p={p} wearStage={stage} />}
        </g>
      )}
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
