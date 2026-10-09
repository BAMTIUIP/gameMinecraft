import type { ReactNode } from 'react';
import { AFFIXES, type AffixId, type Item } from '../game/items';

type GearIconProps = {
  slot: Item['slot'];
  color: string;
  size?: number;
  className?: string;
  affixes?: Item['affixes'];
  patternColors?: string[];
};

/** Crisp, slot-specific armor silhouettes; base fill = material color, affix colors = dots/stripes. */
export function GearIcon({ slot, color, size = 32, className, affixes, patternColors }: GearIconProps) {
  const outline = '#151b18';
  const highlight = '#ffffff';
  const shade = '#101512';
  const common = {
    fill: color,
    stroke: outline,
    strokeWidth: 1.7,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'square' as const,
  };

  // Derive pattern colors from affixes if not explicitly passed
  const colors: string[] =
    patternColors ??
    (affixes ?? [])
      .map((a) => AFFIXES[a.id as AffixId]?.color)
      .filter(Boolean) as string[];
  const affIds: AffixId[] = (affixes ?? []).map((a) => a.id as AffixId);

  let silhouette: ReactNode;
  switch (slot) {
    case 'head':
      silhouette = (
        <>
          <path {...common} d="M5 19v-6h2V9h3V6h12v3h3v4h2v6h-5v-3H10v3z" />
          <path d="M10 8h12v2H10zM8 12h2v4H8z" fill={highlight} fillOpacity=".34" />
          <path d="M6 19h5v4H8v-2H6zM21 19h5v2h-2v2h-3z" fill={shade} fillOpacity=".62" />
        </>
      );
      break;
    case 'chest':
      silhouette = (
        <>
          <path {...common} d="M9 5h5v3h4V5h5l5 5-3 4h-2v13H9V14H7l-3-4z" />
          <path d="M12 8h8v3h-8zM10 14h12v2H10z" fill={highlight} fillOpacity=".3" />
          <path d="M10 20h12v2H10zM14 11h4v10h-4z" fill={shade} fillOpacity=".38" />
        </>
      );
      break;
    case 'legs':
      silhouette = (
        <>
          <path {...common} d="M7 5h18v5h-2v3h-1v14h-6V15h-2v12H8V13H7z" />
          <path d="M9 7h14v2H9zM10 12h4v8h-4zM18 12h4v8h-4z" fill={highlight} fillOpacity=".28" />
          <path d="M9 23h4v3H9zM18 23h4v3h-4z" fill={shade} fillOpacity=".55" />
        </>
      );
      break;
    case 'feet':
      silhouette = (
        <>
          <path {...common} d="M5 5h9v13l3 3v5H4v-4l2-3V5zM19 5h8v14l2 2v5H17v-4l2-3z" />
          <path d="M7 7h5v9H7zM21 7h4v9h-4z" fill={highlight} fillOpacity=".3" />
          <path d="M5 23h10v3H5zM18 23h10v3H18z" fill={shade} fillOpacity=".62" />
        </>
      );
      break;
    case 'hands':
      silhouette = (
        <>
          <path {...common} d="M5 15V9h3V6h3v3h2v8l-2 5H6zM19 17V9h2V6h3v3h3v6l-2 7h-6z" />
          <path d="M8 8h2v7H8zM22 8h2v7h-2z" fill={highlight} fillOpacity=".34" />
          <path d="M6 16h6v2H6zM20 16h6v2h-6z" fill={shade} fillOpacity=".52" />
        </>
      );
      break;
    case 'offhand':
      silhouette = (
        <>
          <path {...common} d="M16 3 27 7v8c0 6-4 11-11 15C9 26 5 21 5 15V7z" />
          <path d="M16 6 24 9v6c0 4-3 8-8 11-5-3-8-7-8-11V9z" fill={highlight} fillOpacity=".18" />
          <path d="M16 11 20 15l-4 4-4-4z" fill={shade} fillOpacity=".55" stroke={outline} strokeWidth="1" />
          <path d="M15 7h2v4h-2z" fill={highlight} fillOpacity=".45" />
        </>
      );
      break;
  }

  const patternNodes: ReactNode[] = [];
  const dotCount = Math.min(4, colors.length);
  for (let i = 0; i < dotCount; i++) {
    const col = colors[i];
    const spacing = 6;
    const startX = 16 - ((dotCount - 1) * spacing) / 2;
    const cx = startX + i * spacing;
    const cy = slot === 'head' ? 17 : slot === 'chest' ? 23 : slot === 'legs' ? 22 : slot === 'feet' ? 21 : slot === 'hands' ? 20 : 22;
    patternNodes.push(<rect key={`dot-${i}`} x={cx - 1} y={cy} width={2} height={2} fill={col} stroke={outline} strokeWidth={0.6} />);
  }
  if (affIds.includes('fire')) {
    const fireCol = AFFIXES.fire.color;
    patternNodes.push(<rect key="stripe-fire" x={14} y={8} width={1} height={14} fill={fireCol} opacity={0.9} />);
    patternNodes.push(<rect key="stripe-fire-2" x={17} y={8} width={1} height={14} fill={fireCol} opacity={0.7} />);
  }
  if (affIds.includes('frost')) {
    const frostCol = AFFIXES.frost.color;
    patternNodes.push(<rect key="stripe-frost" x={7} y={10} width={1} height={10} fill={frostCol} opacity={0.85} />);
    patternNodes.push(<rect key="stripe-frost-2" x={24} y={10} width={1} height={10} fill={frostCol} opacity={0.85} />);
  }
  if (affIds.includes('vamp')) {
    const vampCol = AFFIXES.vamp.color;
    patternNodes.push(<rect key="dot-vamp-l" x={5} y={12} width={1} height={6} fill={vampCol} />);
    patternNodes.push(<rect key="dot-vamp-r" x={26} y={12} width={1} height={6} fill={vampCol} />);
  }
  if (affIds.includes('thorns')) {
    const thCol = AFFIXES.thorns.color;
    patternNodes.push(<rect key="th-1" x={10} y={6} width={2} height={1} fill={thCol} />);
    patternNodes.push(<rect key="th-2" x={20} y={6} width={2} height={1} fill={thCol} />);
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      shapeRendering="crispEdges"
      focusable="false"
    >
      {silhouette}
      {patternNodes}
    </svg>
  );
}
