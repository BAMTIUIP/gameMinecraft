// Tiny procedural WebAudio SFX kit — no assets, all synthesised.

type Ctx = AudioContext & { _unlocked?: boolean };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC() as Ctx;
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 0.5);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
}

/** suspend / resume the whole audio context (tab hidden ⇄ visible) */
export function suspendAudio() {
  if (ctx && ctx.state === 'running') void ctx.suspend();
}
export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
  if (m) stopMusic(0.25, false);
  else if (musicEnabled && musicWanted) startMusic();
}
/** remembers that the current phase wants a soundtrack */
let musicWanted = false;
export function isMuted() {
  return muted;
}

function now() {
  return ctx ? ctx.currentTime : 0;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol = 0.2,
  slideTo?: number,
  delay = 0,
) {
  if (!ctx || !master || muted) return;
  const t = now() + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, freq = 900, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
  if (!ctx || !master || !noiseBuf || muted) return;
  const t = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/* =======================================================================
   MENU MUSIC — a slow, cave-lit chiptune loop scheduled ahead of time.
   ======================================================================= */

let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicNext = 0;
let musicStep = 0;
let musicOn = false;

// C minor pentatonic-ish, two bars of chords + a wandering lead
const BASS = [65.41, 65.41, 77.78, 77.78, 87.31, 87.31, 77.78, 65.41];
const PAD = [
  [130.81, 155.56, 196.0],
  [130.81, 155.56, 196.0],
  [155.56, 196.0, 233.08],
  [155.56, 196.0, 233.08],
  [174.61, 207.65, 261.63],
  [174.61, 207.65, 261.63],
  [155.56, 196.0, 233.08],
  [146.83, 196.0, 246.94],
];
const LEAD = [
  523.25, 0, 622.25, 0, 698.46, 0, 622.25, 523.25, 0, 466.16, 523.25, 0, 622.25, 0, 466.16, 0,
  392.0, 0, 466.16, 523.25, 0, 622.25, 0, 523.25, 466.16, 0, 392.0, 0, 349.23, 0, 392.0, 0,
];

const STEP = 0.32; // seconds per 8th note

function voice(freq: number, t: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, detune = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.setValueAtTime(detune, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function scheduleMusic() {
  if (!ctx || !musicGain) return;
  const horizon = ctx.currentTime + 0.7;
  while (musicNext < horizon) {
    const t = Math.max(musicNext, ctx.currentTime + 0.02);
    const bar = musicStep % 8;
    const lead = LEAD[musicStep % LEAD.length];

    // bass pulse on every step
    voice(BASS[bar], t, STEP * 1.6, 'triangle', 0.15, musicGain);
    // airy pad on the downbeats
    if (bar % 2 === 0) {
      PAD[bar].forEach((f, i) => voice(f, t, STEP * 2.6, 'sine', 0.045, musicGain!, i === 1 ? 7 : -5));
    }
    // sparse bell lead
    if (lead) {
      voice(lead, t, STEP * 1.3, 'triangle', 0.052, musicGain);
      voice(lead * 2, t, STEP * 0.7, 'sine', 0.02, musicGain);
    }
    // soft tick for pulse
    if (musicStep % 4 === 2 && noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 5200;
      f.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(f).connect(g).connect(musicGain);
      src.start(t);
      src.stop(t + 0.1);
    }

    musicNext = t + STEP;
    musicStep++;
  }
}

export function startMusic() {
  initAudio();
  musicWanted = true;
  if (!ctx || !master || musicOn || muted) return;
  musicOn = true;
  if (!musicGain) {
    musicGain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    musicGain.connect(lp).connect(master);
  }
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4);
  musicNext = ctx.currentTime + 0.08;
  scheduleMusic();
  if (musicTimer === null) musicTimer = window.setInterval(scheduleMusic, 220);
}

export function stopMusic(fade = 0.5, forget = true) {
  if (forget) musicWanted = false;
  if (!ctx || !musicGain || !musicOn) return;
  musicOn = false;
  musicGain.gain.cancelScheduledValues(ctx.currentTime);
  musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), ctx.currentTime);
  musicGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function isMusicPlaying() {
  return musicOn;
}

let musicEnabled = true;
export function setMusicEnabled(v: boolean) {
  musicEnabled = v;
  if (!v) stopMusic(0.35);
}
export function isMusicEnabled() {
  return musicEnabled;
}
/** starts the loop only when the player hasn't switched music off */
export function requestMusic() {
  if (musicEnabled) startMusic();
}

export const sfx = {
  swing(step: number) {
    noise(0.07, 0.11, 1500 + step * 120, 1.4, 'bandpass', 0, 700);
  },
  crack(step: number) {
    noise(0.05, 0.09, 2100 + step * 90, 2.2, 'highpass');
    tone(320 + step * 24, 0.045, 'square', 0.035);
  },
  breakBlock(pitch = 1) {
    noise(0.22, 0.3, 620 * pitch, 0.8, 'lowpass', 0, 180);
    tone(180 * pitch, 0.13, 'triangle', 0.12, 90 * pitch);
  },
  pickup(combo = 0) {
    const base = 620 + Math.min(combo, 12) * 55;
    tone(base, 0.09, 'triangle', 0.16, base * 1.5);
    tone(base * 2, 0.11, 'sine', 0.09, base * 2.4, 0.045);
  },
  jump() {
    tone(300, 0.1, 'square', 0.055, 520);
  },
  land(hard: boolean) {
    noise(hard ? 0.18 : 0.09, hard ? 0.24 : 0.1, hard ? 380 : 620, 0.7, 'lowpass');
  },
  hurt() {
    tone(220, 0.28, 'sawtooth', 0.2, 70);
    noise(0.2, 0.14, 300, 0.6, 'lowpass');
  },
  place() {
    noise(0.09, 0.16, 900, 1, 'bandpass');
    tone(150, 0.07, 'square', 0.07);
  },
  upgrade() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.24, 'triangle', 0.16, f * 1.01, i * 0.075));
    noise(0.5, 0.1, 2600, 0.6, 'highpass', 0.05);
  },
  ui(up = true) {
    tone(up ? 520 : 340, 0.07, 'square', 0.08, up ? 700 : 240);
  },
  tickWarn() {
    tone(880, 0.06, 'square', 0.09);
  },
  gameOver() {
    [440, 370, 294, 220].forEach((f, i) => tone(f, 0.5, 'triangle', 0.17, f * 0.98, i * 0.16));
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.15, f, i * 0.1));
  },
  start() {
    [330, 494, 659].forEach((f, i) => tone(f, 0.18, 'square', 0.1, f * 1.5, i * 0.06));
  },
};
