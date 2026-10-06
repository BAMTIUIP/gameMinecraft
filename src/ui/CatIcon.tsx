import { CAT_COATS } from '../game/pets';

/** Tiny palette-aware cat face for the companion token and shared pet slot. */
export function CatIcon({ coatIndex = 0, size = 36 }: { coatIndex?: number; size?: number }) {
  const coat = CAT_COATS[Number.isInteger(coatIndex) ? coatIndex : 0] ?? CAT_COATS[0];
  return (
    <svg
      width={size}
      height={size * (40 / 48)}
      viewBox="0 0 48 40"
      role="img"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    >
      <path d="M6 14h5V5h7v5h4V4h4v6h4V5h7v9h5v20H6z" fill={coat.body} stroke={coat.legs} strokeWidth="2" />
      <path d="M12 9h4v6h-4zM32 9h4v6h-4z" fill={coat.accent} />
      <path d="M10 17h6v6h-6zM32 17h6v6h-6z" fill="#f8f1e5" />
      <path d="M12 18h3v4h-3zM34 18h3v4h-3z" fill="#182128" />
      <path d="M16 24h16v8H16z" fill={coat.accent} />
      <path d="M20 24h8v4h-8z" fill="#2b2220" />
      <path d="M7 27h5v4H7zM36 27h5v4h-5zM22 11h4v3h-4z" fill={coat.patch} />
      <path d="M9 31h7v4H9zM32 31h7v4h-7z" fill={coat.legs} />
    </svg>
  );
}
