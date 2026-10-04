import { MONKEY_COATS } from '../game/pets';

/** Tiny palette-aware face icon for the paid companion token and shared pet equipment slot. */
export function MonkeyIcon({ coatIndex = 0, size = 36 }: { coatIndex?: number; size?: number }) {
  const coat = MONKEY_COATS[Number.isInteger(coatIndex) ? coatIndex : 0] ?? MONKEY_COATS[0];
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
      <path d="M7 17h6v-5h6V8h10v4h6v5h6v15h-5v7H12v-7H7z" fill={coat.body} stroke={coat.limbs} strokeWidth="2" />
      <path d="M4 20h6v12H5v-3H3v-6h2zM38 20h6v3h2v6h-2v3h-6z" fill={coat.body} stroke={coat.limbs} strokeWidth="2" />
      <path d="M8 22h5v7H8zM35 22h5v7h-5z" fill={coat.face} />
      <path d="M15 17h18v16H15z" fill={coat.face} />
      <path d="M17 20h4v5h-4zM27 20h4v5h-4z" fill="#f7f1df" />
      <path d="M18 21h2v4h-2zM28 21h2v4h-2z" fill="#211c19" />
      <path d="M20 28h8v4h-8zM22 32h4v2h-4z" fill="#713f32" />
      <path d="M13 37h22v4H13z" fill={coat.limbs} />
      <path d="M18 39h4v3h-4zM27 39h4v3h-4z" fill={coat.body} />
    </svg>
  );
}
