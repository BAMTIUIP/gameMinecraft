export const MAX_AIR_BUBBLES = 6;
const AIR_BUBBLE_INTERVAL = 1;
const AIR_RECOVERY_INTERVAL = 0.72;
const DROWNING_RAMP_SECONDS = 3;
const DROWNING_BASE_DAMAGE_PER_SECOND = 2;
const DROWNING_DAMAGE_STEP = 2;

export type BreathState = {
  bubbles: number;
  /** Partial second toward the next bubble loss while submerged. */
  airClock: number;
  /** Partial recovery interval while breathing at the surface/on land. */
  recoveryClock: number;
  /** Time spent drowning since the last time the head left the water. */
  drowningSeconds: number;
};

export function createBreathState(): BreathState {
  return { bubbles: MAX_AIR_BUBBLES, airClock: 0, recoveryClock: 0, drowningSeconds: 0 };
}

function drowningDamage(seconds: number, elapsed: number) {
  let damage = 0;
  let remaining = seconds;
  let time = elapsed;
  while (remaining > 0) {
    const rampIndex = Math.floor(time / DROWNING_RAMP_SECONDS);
    const untilRamp = DROWNING_RAMP_SECONDS - (time % DROWNING_RAMP_SECONDS);
    const slice = Math.min(remaining, untilRamp);
    damage += slice * (DROWNING_BASE_DAMAGE_PER_SECOND + rampIndex * DROWNING_DAMAGE_STEP);
    remaining -= slice;
    time += slice;
  }
  return damage;
}

/**
 * Advance the player's air supply. One bubble is spent per submerged second; once empty, damage
 * ramps every three seconds. Surfacing immediately stops drowning and restores bubbles one at a time.
 */
export function stepBreath(state: BreathState, submerged: boolean, deltaSeconds: number) {
  const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  let bubbles = Math.max(0, Math.min(MAX_AIR_BUBBLES, Math.floor(state.bubbles)));
  let airClock = Math.max(0, state.airClock);
  let recoveryClock = Math.max(0, state.recoveryClock);
  let drowningSeconds = Math.max(0, state.drowningSeconds);
  let damage = 0;

  if (submerged) {
    recoveryClock = 0;
    let remaining = dt;
    while (remaining > 0 && bubbles > 0) {
      const untilBubble = Math.max(0, AIR_BUBBLE_INTERVAL - airClock);
      const slice = Math.min(remaining, untilBubble);
      airClock += slice;
      remaining -= slice;
      if (airClock >= AIR_BUBBLE_INTERVAL - 1e-9) {
        bubbles -= 1;
        airClock = 0;
      } else {
        break;
      }
    }
    if (bubbles === 0 && remaining > 0) {
      damage = drowningDamage(remaining, drowningSeconds);
      drowningSeconds += remaining;
    }
  } else {
    airClock = 0;
    drowningSeconds = 0;
    let remaining = dt;
    while (remaining > 0 && bubbles < MAX_AIR_BUBBLES) {
      const untilBubble = Math.max(0, AIR_RECOVERY_INTERVAL - recoveryClock);
      const slice = Math.min(remaining, untilBubble);
      recoveryClock += slice;
      remaining -= slice;
      if (recoveryClock >= AIR_RECOVERY_INTERVAL - 1e-9) {
        bubbles += 1;
        recoveryClock = 0;
      } else {
        break;
      }
    }
    if (bubbles === MAX_AIR_BUBBLES) recoveryClock = 0;
  }

  return {
    state: { bubbles, airClock, recoveryClock, drowningSeconds },
    damage,
  };
}
