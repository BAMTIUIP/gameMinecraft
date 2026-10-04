import { WOLF_COATS } from '../game/pets';

export function WolfIcon({ coatIndex = 0, size = 36 }: { coatIndex?: number; size?: number }) {
  const coat = WOLF_COATS[Number.isInteger(coatIndex) ? coatIndex : 0] ?? WOLF_COATS[0];
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
      <path d="M4 14h4V3h11v8h10V3h11v11h4v20H4z" fill={coat.body} stroke={coat.dark} strokeWidth="2" />
      <path d="M11 7h4v7h-4zM33 7h4v7h-4z" fill={coat.light} />
      <path d="M9 17h6v6H9zM33 17h6v6h-6z" fill="#f6f0e2" />
      <path d="M11 18h3v4h-3zM34 18h3v4h-3z" fill="#191a1b" />
      {coat.marking === 'striped' && <path d="M17 13h3v5h-3zM28 13h3v5h-3z" fill={coat.dark} />}
      {coat.marking === 'spotted' && <path d="M8 26h4v4H8zM36 26h4v4h-4z" fill={coat.dark} />}
      <path d="M15 24h18v9H15z" fill={coat.muzzle} />
      <path d="M20 24h8v5h-8z" fill="#17191b" />
      <path d="M21 25h3v2h-3z" fill="#fff" opacity=".65" />
      <path d="M7 31h8v4H7zM33 31h8v4h-8z" fill={coat.dark} />
    </svg>
  );
}
