export type CompanionSpawnPosition = { x: number; z: number };

/** Keep newly placed local survival miners far enough apart to avoid starting in one stack. */
export function companionSpawnIsClear(
  x: number,
  z: number,
  occupied: readonly CompanionSpawnPosition[],
  minDistance = 1.5,
) {
  if (![x, z, minDistance].every(Number.isFinite) || minDistance < 0) return false;
  return occupied.every((point) => Math.hypot(point.x - x, point.z - z) >= minDistance);
}
