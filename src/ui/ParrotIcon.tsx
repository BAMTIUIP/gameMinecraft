import { PARROT_COATS } from '../game/pets';

/** Compact coat-aware badge drawn from the same palette as the in-world parrot mesh. */
export function ParrotIcon({ coatIndex = 0, size = 36 }: { coatIndex?: number; size?: number }) {
  const coat = PARROT_COATS[Number.isInteger(coatIndex) ? coatIndex : 0] ?? PARROT_COATS[0];
  const [body, accent, wing] = coat.colors;
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
      <path d="M28 31h7v4h5v7h-4v-3h-4v-4h-5z" fill={wing} />
      <path d="M14 25h19v12H14z" fill={body} stroke={wing} strokeWidth="2" />
      <path d="M11 16h21v15H11z" fill={body} stroke={wing} strokeWidth="2" />
      <path d="M16 12h6V5h5v7h5v6H16z" fill={wing} />
      <path d="M14 23h16v7H14z" fill={accent} />
      <path d="M29 19h7v4h-4v4h-5v-5z" fill="#f4a83a" />
      <path d="M15 19h5v5h-5z" fill="#fff8e8" />
      <path d="M17 20h2v3h-2z" fill="#20301f" />
      <path d="M18 37h4v5h-3v-2h-3v-2h2zM25 37h4v5h-3v-2h-3v-2h2z" fill="#f4a83a" />
    </svg>
  );
}
