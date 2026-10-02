/** Survival pacing and hostile progression shared by the engine and deterministic tests. */

/** Survival day lengths are 70% of the original settings (a 30% shorter daytime phase). */
export const SURVIVAL_DAY_SECONDS = Math.round(340 * 0.7);
export const FIRST_SURVIVAL_DAY_SECONDS = Math.round(480 * 0.7);

export function survivalThreatLevel(survivalNight: number): number {
  return Math.max(0, Math.floor(survivalNight) - 1);
}

export function survivalHostileHpScale(survivalNight: number): number {
  return 1 + survivalThreatLevel(survivalNight) * 0.22;
}

export function survivalHostileDamageScale(survivalNight: number): number {
  return 1 + survivalThreatLevel(survivalNight) * 0.16;
}

/** The first survival day is peaceful; after the first night, daytime spawns are cave-only. */
export function canSpawnSurvivalHostiles(
  survivalNight: number,
  night: boolean,
  underground: boolean,
): boolean {
  return survivalNight >= 1 && (night || underground);
}

/** Spawn ceiling: each later night adds three monsters, capped to keep the world bounded. */
export function survivalHostileCap(survivalNight: number, night: boolean, underground: boolean): number {
  const threat = survivalThreatLevel(survivalNight);
  if (night) return Math.min(34, 12 + Math.max(0, Math.floor(survivalNight)) * 3);
  if (underground) return Math.min(15, 7 + threat);
  return 0;
}

/** A hostile caught in direct daylight on an exposed surface is consumed by sunlight. */
export function shouldDieInDaylight(hostile: boolean, daylight: number, exposed: boolean): boolean {
  return hostile && daylight > 0.55 && exposed;
}
