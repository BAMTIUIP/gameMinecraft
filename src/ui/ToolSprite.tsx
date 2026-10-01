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

/** The shared eight-bit haft used by every hand tool. */
function PixelHaft({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M7 37 11 42 35 19 31 15Z" fill={p.outline} />
      <path d="M11 37 13 40 33 20 30 18Z" fill={p.handle} />
      <path d="M14 35 17 38 19 36 16 33Z" fill={p.accent} />
      <path d="M20 29 23 32 25 30 22 27Z" fill={p.handle} />
      <path d="M26 23 29 26 31 24 28 21Z" fill={p.accent} />
    </g>
  );
}

/** A clear, symmetrical pixel pickaxe head with both ends inside the 48px tile. */
function PickShape({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M7 11 11 7H29L33 10H38L42 13V17H38L35 20H30L27 17H17L13 20H8V17H4V13H7Z" fill={p.outline} />
      <path d="M10 12 13 9H28L31 12H36L39 14V16H36L33 18H31L27 15H17L13 18H10V16H7V14H10Z" fill={p.head} />
      <path d="M13 9H28L31 12H35V14H12Z" fill={p.edge} />
      <path d="M7 14H13V16H8Z" fill={p.edge} />
      <path d="M35 14H39V16H36Z" fill={p.edge} />
      <path d="M22 10H27V12H22Z" fill={p.accent} />
    </g>
  );
}

function AxeShape({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M26 8H36V11H40V15H43V23H40V27H32V25H27V21H24V16H22V12H26Z" fill={p.outline} />
      <path d="M28 10H35V13H38V16H41V21H37V24H33V22H29V19H26V15H25V13H28Z" fill={p.head} />
      <path d="M28 10H35V13H38V16H27V14H28Z" fill={p.edge} />
      <path d="M37 16H41V21H38V23H35V20H37Z" fill={p.edge} />
      <path d="M29 13H33V16H29Z" fill={p.accent} />
    </g>
  );
}

function ShovelShape({ p }: { p: Palette }) {
  return (
    <g>
      {/* Broad scoop, with a tapered lower edge so it cannot read as a mallet. */}
      <path d="M28 10H37V13H40V17H42V27H40V32H37V35H29V33H25V29H23V18H26V13H28Z" fill={p.outline} />
      <path d="M29 12H35V15H38V18H40V26H38V30H35V32H30V30H27V27H25V19H28V15H29Z" fill={p.head} />
      <path d="M29 12H35V15H38V18H28V16H29Z" fill={p.edge} />
      <path d="M25 19H28V26H26V24H25Z" fill={p.edge} />
      <path d="M30 29H37V31H30Z" fill={p.accent} />
    </g>
  );
}

function HoeShape({ p }: { p: Palette }) {
  return (
    <g>
      {/* Short crossbar plus a single hanging blade, like a Minecraft hoe. */}
      <path d="M23 8H37V11H41V14H44V19H38V28H32V20H23V18H19V13H23Z" fill={p.outline} />
      <path d="M25 10H36V13H39V15H41V17H36V26H34V18H25V16H22V14H25Z" fill={p.head} />
      <path d="M25 10H36V13H39V15H25Z" fill={p.edge} />
      <path d="M36 16H41V18H36Z" fill={p.accent} />
    </g>
  );
}

function SwordShape({ p }: { p: Palette }) {
  return (
    <g>
      {/* The same diagonal axis as the tools: grip at bottom-left, tip top-right. */}
      <path d="M23 28 32 12 42 5 39 15 30 31Z" fill={p.outline} />
      <path d="M26 27 34 13 39 9 37 15 29 28Z" fill={p.head} />
      <path d="M29 25 35 13 39 9 36 16 30 27Z" fill={p.edge} />
      <path d="M34 14 38 10 36 16Z" fill={p.accent} />
      <path d="M20 27 25 22 32 29 28 33Z" fill={p.outline} />
      <path d="M22 27 25 24 29 29 27 31Z" fill={p.edge} />
      <path d="M10 38 14 34 24 34 27 37 23 41 14 41Z" fill={p.outline} />
      <path d="M13 37 15 35 22 35 24 37 22 39 15 39Z" fill={p.handle} />
      <path d="M16 36H20V38H16Z" fill={p.accent} />
    </g>
  );
}

function BowShape({ p }: { p: Palette }) {
  return (
    <g>
      <path d="M10 7H15V10H19V14H22V20H24V28H22V34H19V38H15V41H10V37H14V33H17V28H19V22H17V17H14V13H10Z" fill={p.outline} />
      <path d="M12 9H15V12H18V16H20V21H22V27H20V33H17V36H14V39H12V37H15V33H18V27H19V22H18V17H15V13H12Z" fill={p.head} />
      <path d="M12 10H14V13H17V17H19V22H20V27H18V22H17V18H14V14H12Z" fill={p.edge} />
      <path d="M12 8V40" stroke="#e7dcc8" strokeWidth="1.5" />
      <path d="M12 8V40" stroke={p.accent} strokeWidth="0.7" />
      <rect x="10" y="37" width="5" height="4" fill={p.handle} />
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
        <BowShape p={p} />
      ) : spec.kind === 'sword' ? (
        <SwordShape p={p} />
      ) : (
        <g>
          <PixelHaft p={p} />
          {spec.kind === 'pickaxe' && <PickShape p={p} />}
          {spec.kind === 'axe' && <AxeShape p={p} />}
          {spec.kind === 'shovel' && <ShovelShape p={p} />}
          {spec.kind === 'hoe' && <HoeShape p={p} />}
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
          <path d="M29 13 26 17" fill="none" stroke={p.accent} strokeWidth="0.8" />
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
