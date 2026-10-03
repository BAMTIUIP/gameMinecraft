export const MAX_STAMINA = 100;
/** A full bar lasts about eleven seconds of continuous sprint before forced recovery. */
export const STAMINA_DRAIN_PER_SECOND = 9;
export const STAMINA_RECOVERY_PER_SECOND = 16;
/** A short recovery buffer prevents sprinting from flickering on and off at zero. */
export const STAMINA_SPRINT_RESUME = 35;

export type StaminaState = {
  /** Remaining stamina, from 0 (exhausted) to 100 (fresh). */
  stamina: number;
  /** At zero, sprinting stays locked until enough stamina has returned. */
  exhausted: boolean;
};

export function createStaminaState(): StaminaState {
  return { stamina: MAX_STAMINA, exhausted: false };
}

export function canSprint(state: StaminaState): boolean {
  return !state.exhausted && state.stamina > 0;
}

/** Drain stamina during a sprint/swim and restore it while walking, resting, or swimming normally. */
export function stepStamina(state: StaminaState, sprinting: boolean, deltaSeconds: number): StaminaState {
  const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  let stamina = Math.max(0, Math.min(MAX_STAMINA, Number.isFinite(state.stamina) ? state.stamina : MAX_STAMINA));
  let exhausted = Boolean(state.exhausted) || stamina <= 0;

  if (sprinting && !exhausted) {
    stamina = Math.max(0, stamina - STAMINA_DRAIN_PER_SECOND * dt);
    if (stamina <= 0) exhausted = true;
  } else {
    stamina = Math.min(MAX_STAMINA, stamina + STAMINA_RECOVERY_PER_SECOND * dt);
    if (exhausted && stamina >= STAMINA_SPRINT_RESUME) exhausted = false;
  }

  return { stamina, exhausted };
}
