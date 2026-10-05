/** Survival pacing and hostile progression shared by the engine and deterministic tests. */

/** Survival day lengths are 70% of the original settings (a 30% shorter daytime phase). */
export const SURVIVAL_DAY_SECONDS = Math.round(340 * 0.7);
export const FIRST_SURVIVAL_DAY_SECONDS = Math.round(480 * 0.7);
export const SURVIVAL_DAWN_SECONDS = 95;
export const SURVIVAL_DUSK_SECONDS = 95;
export const SURVIVAL_NIGHT_SECONDS = 95;

/** The tenth night starts the permanent-night endgame. */
export const SURVIVAL_PERMANENT_NIGHT = 10;

/** The normal post-first-day cycle length, kept constant as daylight is transferred into night. */
export const SURVIVAL_BASE_CYCLE_SECONDS =
  SURVIVAL_DAY_SECONDS + SURVIVAL_DAWN_SECONDS + SURVIVAL_DUSK_SECONDS + SURVIVAL_NIGHT_SECONDS;

export type SurvivalPhase = 'dawn' | 'day' | 'dusk' | 'night';

const BASE_PHASE_SECONDS: Record<SurvivalPhase, number> = {
  dawn: SURVIVAL_DAWN_SECONDS,
  day: SURVIVAL_DAY_SECONDS,
  dusk: SURVIVAL_DUSK_SECONDS,
  night: SURVIVAL_NIGHT_SECONDS,
};

/** True once the day/night cycle has collapsed into an endless night. */
export function isPermanentSurvivalNight(survivalNight: number): boolean {
  return Math.floor(Number.isFinite(survivalNight) ? survivalNight : 0) >= SURVIVAL_PERMANENT_NIGHT;
}

/**
 * Distribute the normal daylight portion into longer nights over nights 1–10.
 * Night 1 is unchanged; each following night transfers an equal share of the
 * 428 daylight seconds into night. Night 10 has no dawn, day, or dusk at all.
 */
export function survivalPhaseSeconds(phase: SurvivalPhase, survivalNight: number): number {
  const night = Math.max(1, Math.floor(Number.isFinite(survivalNight) ? survivalNight : 1));
  if (isPermanentSurvivalNight(night)) return phase === 'night' ? SURVIVAL_BASE_CYCLE_SECONDS : 0;

  const progress = (night - 1) / (SURVIVAL_PERMANENT_NIGHT - 1);
  if (phase === 'night') {
    return SURVIVAL_NIGHT_SECONDS + (SURVIVAL_BASE_CYCLE_SECONDS - SURVIVAL_NIGHT_SECONDS) * progress;
  }
  return BASE_PHASE_SECONDS[phase] * (1 - progress);
}

/** A bed may only skip the night in Explorer mode, never in Survival mode. */
export function canSleepInMode(survivalMode: boolean, daylight: number): boolean {
  return !survivalMode && daylight <= 0.5;
}

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
