import { OWL_COATS } from '../game/pets';

/** Compact coat-aware badge drawn from the same palette as the in-world eagle owl mesh. */
export function OwlIcon({ coatIndex = 0, size = 36 }: { coatIndex?: number; size?: number }) {
  const coat = OWL_COATS[Number.isInteger(coatIndex) ? coatIndex : 0] ?? OWL_COATS[0];
  const { body, chest, wings, eyes, tufts, beak } = coat;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    >
      {/* Ear tufts */}
      <path d="M10 6h6v8h-6zM32 6h6v8h-6z" fill={tufts} />
      <path d="M12 9h2v4h-2zM34 9h2v4h-2z" fill={chest} />

      {/* Main body and head silhouette */}
      <path d="M10 12h28v26H10z" fill={body} stroke={wings} strokeWidth="2" />

      {/* Folded wings on the sides */}
      <path d="M8 20h5v16H8zM35 20h5v16h-5z" fill={wings} />
      <path d="M10 26h4v8h-4zM34 26h4v8h-4z" fill={body} opacity=".7" />

      {/* Facial discs */}
      <path d="M13 15h10v11H13zM25 15h10v11H25z" fill={chest} />

      {/* Large luminous owl eyes */}
      <path d="M15 17h6v7h-6zM27 17h6v7h-6z" fill={eyes} />
      <path d="M17 19h3v4h-3zM29 19h3v4h-3z" fill="#15151c" />
      <path d="M17 19h1v1h-1zM29 19h1v1h-1z" fill="#ffffff" />

      {/* Hooked beak */}
      <path d="M22 22h4v7h-4z" fill={beak} />
      <path d="M23 27h2v3h-2z" fill="#181512" />

      {/* Chest / belly plumage with barring */}
      <path d="M17 28h14v10H17z" fill={chest} />
      <path d="M19 30h4v2h-4zM25 30h4v2h-4z" fill={wings} />
      <path d="M18 34h5v2h-5zM25 34h5v2h-5z" fill={wings} />

      {/* Feet / talons */}
      <path d="M16 38h5v4h-5zM27 38h5v4h-5z" fill={beak} />
    </svg>
  );
}
