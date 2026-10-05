// Tiny procedural WebAudio SFX kit — no assets, all synthesised.

type Ctx = AudioContext & { _unlocked?: boolean };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

/**
 * Requirements 1.6.1.6 and 1.6.2.5: «В любых браузерах не отображается системный плеер, вызываемый
 * игрой» (https://yandex.ru/dev/games/doc/ru/requirements/1/6). The game synthesises every sound with
 * Web Audio — there is not a single `<audio>`/`<video>` element, no media source and no
 * `navigator.mediaSession` registration of its own. As a belt-and-braces measure any media session
 * that some other code (or an earlier version of the page) left behind is cleared: the system player
 * must never show the game.
 */
function clearSystemPlayer() {
  try {
    const session = (navigator as Navigator & {
      mediaSession?: { metadata: unknown; playbackState: string };
    }).mediaSession;
    if (!session) return;
    session.metadata = null;
    session.playbackState = 'none';
  } catch {
    /* the browser has no Media Session API — nothing to clear */
  }
}

/**
 * Requirement 1.3: the game's sound must stop when the page loses focus — window minimised, another
 * tab chosen, the browser's own tab picker (https://yandex.ru/dev/games/doc/ru/requirements/1/3).
 * Three independent holds decide whether the audio context may run:
 *  - the focus hold — the window is blurred or the tab is hidden. It is lifted only by real focus and
 *    visibility events, so a visible-but-unfocused window (the tab picker, another app in front) stays
 *    silent;
 *  - the game hold — the engine's system pause and the platform's pause events (`suspendAudio()` /
 *    `resumeAudio()`);
 *  - the ad hold — an ad is on screen, and its own sound must not compete with the game's.
 * Releasing one hold never resumes the context while another is still active: that is exactly the
 * "sound keeps playing under an ad" and "sound came back in a background tab" bug class.
 */
let windowBlurred = false;
let documentHidden = typeof document !== 'undefined' && document.hidden === true;
let gameHold = false;
let adHold = false;

function pageHoldsAudio() {
  return windowBlurred || documentHidden;
}

function syncAudio() {
  if (!ctx) return;
  if (pageHoldsAudio() || gameHold || adHold) {
    if (ctx.state === 'running') void ctx.suspend();
  } else if (ctx.state === 'suspended') {
    void ctx.resume();
    // the game is audible again: make sure no system player is attached to this audio
    clearSystemPlayer();
  }
}

/** Is the game's audio held back right now (for diagnostics and tests)? */
export function audioSuspended(): boolean {
  return pageHoldsAudio() || gameHold || adHold || ctx?.state === 'suspended';
}

/** Hold the audio while an ad is on screen; release when it closes (see ads.ts). */
export function holdAudioForAd(on: boolean) {
  adHold = on;
  syncAudio();
}

// Browsers differ in which of the three events they send (and Chrome's tab picker sends none), so the
// game listens to all of them and holds the audio until focus *and* visibility are back.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('blur', () => {
    windowBlurred = true;
    syncAudio();
  });
  window.addEventListener('focus', () => {
    windowBlurred = false;
    documentHidden = document.hidden === true;
    syncAudio();
  });
  document.addEventListener?.('visibilitychange', () => {
    documentHidden = document.hidden === true;
    syncAudio();
  });
}

export function initAudio() {
  clearSystemPlayer(); // requirement 1.6.*.5: the game never hands its audio to the system player
  if (ctx) {
    syncAudio();
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

/**
 * Pause the game's audio (platform pause, engine system pause). `resumeAudio()` lifts this hold only —
 * a hidden tab or an ad on screen keeps the silence, because they hold it independently.
 */
export function suspendAudio() {
  gameHold = true;
  syncAudio();
}
export function resumeAudio() {
  gameHold = false;
  syncAudio();
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

type FilterOpts = { type: BiquadFilterType; freq: number; q?: number; sweepTo?: number };

type ToneOpts = {
  freq: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  detune?: number;
  attack?: number;
  /** band-shaping: what turns a plain oscillator into a voice */
  filter?: FilterOpts;
  /** frequency wobble (Hz deviation) */
  vibrato?: { rate: number; depth: number };
  /** amplitude wobble (0..1 of the peak gain) */
  tremolo?: { rate: number; depth: number };
};

/** one synthesised note, optionally filtered, wobbling and shaken */
function toneTo(dest: AudioNode | null, t0: number, o: ToneOpts) {
  if (!ctx || !dest) return;
  const dur = Math.max(0.02, o.dur);
  const vol = Math.max(0.0002, o.vol ?? 0.2);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(Math.max(20, o.freq), t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t0);
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.setValueAtTime(o.vibrato.rate, t0);
    lg.gain.setValueAtTime(Math.max(0.5, o.vibrato.depth), t0);
    lfo.connect(lg).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  const g = ctx.createGain();
  const attack = Math.min(o.attack ?? 0.012, dur * 0.45);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (o.tremolo) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.setValueAtTime(o.tremolo.rate, t0);
    lg.gain.setValueAtTime(Math.max(0.0002, vol * o.tremolo.depth), t0);
    lfo.connect(lg).connect(g.gain);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(Math.max(40, o.filter.freq), t0);
    if (o.filter.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.filter.sweepTo), t0 + dur);
    f.Q.value = o.filter.q ?? 1;
    node = node.connect(f);
  }
  node.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

type NoiseOpts = {
  dur: number;
  vol?: number;
  freq: number;
  q?: number;
  type?: BiquadFilterType;
  sweepTo?: number;
  attack?: number;
};

/** one filtered noise burst — breath, hiss, rattle or rustle */
function noiseTo(dest: AudioNode | null, t0: number, o: NoiseOpts) {
  if (!ctx || !dest || !noiseBuf) return;
  const dur = Math.max(0.02, o.dur);
  const vol = Math.max(0.0002, o.vol ?? 0.2);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  if (dur > 0.42) src.loop = true; // the buffer is 0.5s long
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(Math.max(40, o.freq), t0);
  if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo), t0 + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const attack = Math.min(o.attack ?? 0.006, dur * 0.45);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
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
  toneTo(master, now() + delay, { freq, dur, type, vol, slideTo });
}

function noise(dur: number, vol = 0.2, freq = 900, q = 1, type: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
  if (!ctx || !master || muted) return;
  noiseTo(master, now() + delay, { dur, vol, freq, q, type, sweepTo });
}

/**
 * Mix bus for world sounds: distance volume, stereo placement and the dull
 * low-pass the underwater listener hears. Returns the node to play into.
 */
function voiceBus(vol: number, pan: number, muffled: boolean): { dest: AudioNode; t0: number } | null {
  if (!ctx || !master || muted) return null;
  const t0 = ctx.currentTime + 0.012;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, vol), t0);
  let node: AudioNode = g;
  if (muffled) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(760, t0);
    lp.Q.value = 0.8;
    node = node.connect(lp);
  }
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
    node = node.connect(p);
  }
  node.connect(master);
  return { dest: g, t0 };
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

let musicMood: 'calm' | 'tense' = 'calm';
export function setMusicMood(mood: 'calm' | 'tense') {
  musicMood = mood;
}

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
  const tense = musicMood === 'tense';
  const stepDuration = tense ? 0.23 : 0.48;
  const horizon = ctx.currentTime + 0.85;
  while (musicNext < horizon) {
    const t = Math.max(musicNext, ctx.currentTime + 0.02);
    const bar = musicStep % 8;
    const lead = LEAD[musicStep % LEAD.length];

    // Calm exploration leaves generous space between warm bass notes; night survival adds a lower pulse.
    if (!tense || bar % 2 === 0) {
      voice(BASS[bar] * (tense ? 0.84 : 1), t, stepDuration * (tense ? 1.35 : 2.7), 'triangle', tense ? 0.13 : 0.075, musicGain);
    }
    // Airy, slow pads are always present; nighttime chords are darker and shorter.
    if (bar % 2 === 0) {
      PAD[bar].forEach((f, i) => voice(f * (tense ? 0.82 : 1), t, stepDuration * (tense ? 1.8 : 3.1), 'sine', tense ? 0.03 : 0.052, musicGain!, i === 1 ? 7 : -5));
    }
    // Sparse bell lead by day, a more insistent repeating figure after dark.
    if (lead && (!tense || musicStep % 2 === 0)) {
      voice(lead * (tense ? 0.82 : 1), t, stepDuration * (tense ? 0.78 : 1.25), 'triangle', tense ? 0.048 : 0.04, musicGain);
      if (!tense) voice(lead * 2, t, stepDuration * 0.62, 'sine', 0.016, musicGain);
    }
    // Light ticks in calm mode; muffled low thumps mark the survival-night beat.
    if (musicStep % 4 === 2 && noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = tense ? 920 : 5200;
      f.Q.value = tense ? 1.3 : 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(tense ? 0.05 : 0.018, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (tense ? 0.12 : 0.07));
      src.connect(f).connect(g).connect(musicGain);
      src.start(t);
      src.stop(t + (tense ? 0.15 : 0.1));
    }

    musicNext = t + stepDuration;
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
  musicGain.gain.linearRampToValueAtTime(musicVolume, ctx.currentTime + 1.4);
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
let musicVolume = 0.45;
export function setMusicEnabled(v: boolean) {
  musicEnabled = v;
  if (!v) stopMusic(0.35);
  else if (musicWanted) startMusic();
}
export function isMusicEnabled() {
  return musicEnabled;
}
export function setMusicVolume(volume: number) {
  musicVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.45));
  if (ctx && musicGain && musicOn) {
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(musicVolume, ctx.currentTime, 0.06);
  }
}
export function getMusicVolume() {
  return musicVolume;
}
/** starts the loop only when the player hasn't switched music off */
export function requestMusic() {
  if (musicEnabled) startMusic();
}

/* =======================================================================
   CREATURE VOICES & WOODEN CREAKS — procedural, no samples.
   ======================================================================= */

export type CreatureVoice =
  | 'cow' | 'pig' | 'sheep' | 'chicken' | 'bird' | 'owl' | 'bee' | 'cat' | 'wolf' | 'deer' | 'moose'
  | 'camel' | 'monkey' | 'frog' | 'lizard' | 'rabbit' | 'hedgehog' | 'crab' | 'turtle'
  | 'fish' | 'jellyfish' | 'rustle'
  | 'zombie' | 'skeleton' | 'spider' | 'creeper' | 'trader';

export type VoiceState = 'idle' | 'hurt' | 'attack' | 'death';

export type VoiceOptions = {
  state?: VoiceState;
  volume?: number;
  pan?: number;
  pitch?: number;
  /** the listener's head is in water: dull the whole call */
  underwater?: boolean;
};

/** per-state colouring: a hurt animal yelps, a dying one trails off */
const VOICE_STATE: Record<VoiceState, { pitch: number; dur: number; vol: number; yelp: number }> = {
  idle: { pitch: 1, dur: 1, vol: 1, yelp: 0 },
  hurt: { pitch: 1.18, dur: 0.62, vol: 1.25, yelp: 0.5 },
  attack: { pitch: 1.06, dur: 0.8, vol: 1.15, yelp: 0.12 },
  death: { pitch: 0.82, dur: 1.35, vol: 1.2, yelp: 0.32 },
};

type VoiceCtx = { dest: AudioNode; t0: number; pitch: number; vol: number; dur: number };

/** every species' call, written against a shared little synthesizer */
const VOICES: Record<CreatureVoice, (c: VoiceCtx) => void> = {
  // deep, slow "mmm-booo" with a warm body under it
  cow: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 132 * P, slideTo: 96 * P, dur: 0.8 * c.dur, type: 'sawtooth', vol: 0.2 * V,
      filter: { type: 'bandpass', freq: 430 * P, q: 3, sweepTo: 320 * P }, vibrato: { rate: 6.5, depth: 7 * P } });
    toneTo(c.dest, c.t0, { freq: 66 * P, slideTo: 50 * P, dur: 0.82 * c.dur, type: 'triangle', vol: 0.12 * V, attack: 0.05 });
  },
  // two snorty grunts
  pig: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.15, 1.18]] as const) {
      noiseTo(c.dest, c.t0 + d, { dur: 0.11 * c.dur, vol: 0.17 * V, freq: 720 * P * f, q: 3.4, sweepTo: 420 * P * f });
      toneTo(c.dest, c.t0 + d, { freq: 200 * P * f, slideTo: 142 * P * f, dur: 0.1 * c.dur, type: 'square', vol: 0.08 * V });
    }
  },
  // bleating "baa" — fast tremolo is what sells it
  sheep: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 330 * P, slideTo: 268 * P, dur: 0.55 * c.dur, type: 'sawtooth', vol: 0.15 * V,
      filter: { type: 'bandpass', freq: 900 * P, q: 2.2 }, tremolo: { rate: 21, depth: 0.55 } });
  },
  chicken: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.14, 0.86]] as const) {
      noiseTo(c.dest, c.t0 + d, { dur: 0.045 * c.dur, vol: 0.13 * V, freq: 2400 * P * f, q: 6 });
      toneTo(c.dest, c.t0 + d, { freq: 880 * P * f, slideTo: 600 * P * f, dur: 0.05 * c.dur, type: 'square', vol: 0.05 * V });
    }
  },
  // two to four rising/falling whistles
  bird: (c) => {
    const P = c.pitch, V = c.vol;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let n = 0; n < notes; n++) {
      const up = n % 2 === 1;
      const base = (2500 + Math.random() * 900) * P;
      toneTo(c.dest, c.t0 + n * 0.085, { freq: base, slideTo: up ? base * 1.35 : base * 0.72, dur: 0.07 * c.dur,
        type: 'sine', vol: 0.09 * V, attack: 0.008 });
    }
    noiseTo(c.dest, c.t0, { dur: 0.05, vol: 0.02 * V, freq: 5200, q: 3 });
  },
  // Resonant, deep double hoot "Hoo-hoo... Hoo" with warm sine/triangle harmonics
  owl: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f, dur] of [[0, 1, 0.16], [0.18, 0.94, 0.28]] as const) {
      toneTo(c.dest, c.t0 + d, {
        freq: 380 * P * f,
        slideTo: 340 * P * f,
        dur: dur * c.dur,
        type: 'sine',
        vol: 0.14 * V,
        attack: 0.02,
        vibrato: { rate: 6, depth: 4 * P },
      });
      toneTo(c.dest, c.t0 + d, {
        freq: 760 * P * f,
        slideTo: 680 * P * f,
        dur: dur * c.dur * 0.7,
        type: 'triangle',
        vol: 0.04 * V,
        attack: 0.03,
      });
      noiseTo(c.dest, c.t0 + d, {
        dur: 0.08 * c.dur,
        vol: 0.025 * V,
        freq: 1200 * P,
        q: 2.5,
        type: 'bandpass',
        sweepTo: 600 * P,
      });
    }
  },
  bee: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 186 * P, slideTo: 208 * P, dur: 0.55 * c.dur, type: 'sawtooth', vol: 0.06 * V,
      filter: { type: 'bandpass', freq: 620 * P, q: 6 }, tremolo: { rate: 33, depth: 0.45 } });
  },
  cat: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 640 * P, slideTo: 430 * P, dur: 0.5 * c.dur, type: 'sawtooth', vol: 0.12 * V,
      filter: { type: 'bandpass', freq: 1100 * P, q: 3.5, sweepTo: 720 * P }, vibrato: { rate: 15, depth: 14 * P } });
    noiseTo(c.dest, c.t0 + 0.28, { dur: 0.14, vol: 0.02 * V, freq: 2600, q: 2 });
  },
  // Two short, playful barks with a little breathy rasp.
  wolf: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [delay, pitch] of [[0, 1], [0.16, 0.88]] as const) {
      toneTo(c.dest, c.t0 + delay, { freq: 570 * P * pitch, slideTo: 350 * P * pitch, dur: 0.12 * c.dur,
        type: 'square', vol: 0.13 * V, attack: 0.006, filter: { type: 'bandpass', freq: 1050 * P, q: 2.6, sweepTo: 700 * P } });
      noiseTo(c.dest, c.t0 + delay, { dur: 0.075 * c.dur, vol: 0.055 * V, freq: 1700 * P, q: 1.8, sweepTo: 900 * P });
    }
  },
  deer: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 420 * P, slideTo: 330 * P, dur: 0.34 * c.dur, type: 'sawtooth', vol: 0.12 * V,
      filter: { type: 'bandpass', freq: 1200 * P, q: 3 }, tremolo: { rate: 17, depth: 0.4 } });
  },
  moose: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 148 * P, slideTo: 96 * P, dur: 0.9 * c.dur, type: 'sawtooth', vol: 0.19 * V,
      filter: { type: 'bandpass', freq: 380 * P, q: 3 }, vibrato: { rate: 5, depth: 8 * P } });
  },
  camel: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 172 * P, slideTo: 118 * P, dur: 0.34 * c.dur, type: 'sawtooth', vol: 0.15 * V,
      filter: { type: 'bandpass', freq: 520 * P, q: 3 }, tremolo: { rate: 12, depth: 0.3 } });
    noiseTo(c.dest, c.t0 + 0.2, { dur: 0.16, vol: 0.07 * V, freq: 640 * P, q: 2, sweepTo: 380 * P });
  },
  monkey: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.13, 1.22]] as const) {
      toneTo(c.dest, c.t0 + d, { freq: 520 * P * f, slideTo: 900 * P * f, dur: 0.12 * c.dur, type: 'sine', vol: 0.11 * V });
    }
  },
  frog: (c) => {
    const P = c.pitch, V = c.vol;
    for (const d of [0, 0.16]) {
      toneTo(c.dest, c.t0 + d, { freq: 205 * P, dur: 0.13 * c.dur, type: 'square', vol: 0.12 * V,
        filter: { type: 'bandpass', freq: 480 * P, q: 5 }, tremolo: { rate: 38, depth: 0.8 } });
    }
  },
  lizard: (c) => {
    const P = c.pitch, V = c.vol;
    noiseTo(c.dest, c.t0, { dur: 0.05 * c.dur, vol: 0.1 * V, freq: 3000 * P, q: 7, sweepTo: 2200 * P });
    toneTo(c.dest, c.t0, { freq: 1800 * P, slideTo: 1350 * P, dur: 0.05 * c.dur, type: 'sine', vol: 0.05 * V });
  },
  rabbit: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.1, 1.15]] as const)
      toneTo(c.dest, c.t0 + d, { freq: 1650 * P * f, slideTo: 2300 * P * f, dur: 0.07 * c.dur, type: 'sine', vol: 0.09 * V });
  },
  hedgehog: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.12, 0.9], [0.22, 1.05]] as const)
      noiseTo(c.dest, c.t0 + d, { dur: 0.09 * c.dur, vol: 0.07 * V, freq: 900 * P * f, q: 2, type: 'lowpass', sweepTo: 560 * P });
  },
  crab: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.1, 1.12]] as const) {
      noiseTo(c.dest, c.t0 + d, { dur: 0.035 * c.dur, vol: 0.12 * V, freq: 1800 * P * f, q: 8 });
      toneTo(c.dest, c.t0 + d, { freq: 430 * P * f, dur: 0.03 * c.dur, type: 'square', vol: 0.05 * V });
    }
  },
  turtle: (c) => {
    noiseTo(c.dest, c.t0, { dur: 0.2 * c.dur, vol: 0.09 * c.vol, freq: 480, q: 2, type: 'lowpass', sweepTo: 300 });
  },
  fish: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.11, 1.25]] as const) {
      toneTo(c.dest, c.t0 + d, { freq: 380 * P * f, slideTo: 760 * P * f, dur: 0.06 * c.dur, type: 'sine', vol: 0.06 * V });
      noiseTo(c.dest, c.t0 + d, { dur: 0.03, vol: 0.03 * V, freq: 1400, q: 4 });
    }
  },
  jellyfish: (c) => {
    toneTo(c.dest, c.t0, { freq: 240 * c.pitch, slideTo: 150 * c.pitch, dur: 0.28 * c.dur, type: 'sine', vol: 0.05 * c.vol });
  },
  rustle: (c) => {
    noiseTo(c.dest, c.t0, { dur: 0.55 * c.dur, vol: 0.07 * c.vol, freq: 2600, q: 1.2, sweepTo: 1100, attack: 0.12 });
  },
  zombie: (c) => {
    const P = c.pitch, V = c.vol;
    toneTo(c.dest, c.t0, { freq: 128 * P, slideTo: 92 * P, dur: 0.85 * c.dur, type: 'sawtooth', vol: 0.17 * V,
      filter: { type: 'lowpass', freq: 700, q: 1 }, vibrato: { rate: 4.5, depth: 6 * P } });
    noiseTo(c.dest, c.t0, { dur: 0.6 * c.dur, vol: 0.05 * V, freq: 420, q: 1, type: 'lowpass' });
  },
  skeleton: (c) => {
    const V = c.vol;
    for (let n = 0; n < 6; n++)
      noiseTo(c.dest, c.t0 + n * 0.045, { dur: 0.025, vol: (0.08 - n * 0.006) * V, freq: 3200 + n * 180, q: 8 });
    toneTo(c.dest, c.t0, { freq: 900, slideTo: 620, dur: 0.16 * c.dur, type: 'triangle', vol: 0.05 * V });
  },
  spider: (c) => {
    noiseTo(c.dest, c.t0, { dur: 0.45 * c.dur, vol: 0.1 * c.vol, freq: 3800, q: 1.5, sweepTo: 2400 });
  },
  // the wandering trader's soft nasal hum
  trader: (c) => {
    const P = c.pitch, V = c.vol;
    for (const [d, f] of [[0, 1], [0.22, 1.06]] as const) {
      toneTo(c.dest, c.t0 + d, { freq: 232 * P * f, slideTo: 196 * P * f, dur: 0.2 * c.dur, type: 'triangle', vol: 0.11 * V,
        filter: { type: 'bandpass', freq: 620 * P, q: 2.5 }, vibrato: { rate: 7, depth: 5 * P } });
      toneTo(c.dest, c.t0 + d, { freq: 464 * P * f, dur: 0.18 * c.dur, type: 'sine', vol: 0.04 * V });
    }
  },
  creeper: (c) => {
    noiseTo(c.dest, c.t0, { dur: 0.9 * c.dur, vol: 0.14 * c.vol, freq: 5000, q: 1.2, sweepTo: 2400, attack: 0.05 });
    toneTo(c.dest, c.t0, { freq: 300, slideTo: 720, dur: 0.85 * c.dur, type: 'triangle', vol: 0.05 * c.vol, attack: 0.3 });
  },
};

/** a short pained yelp laid over hurt/death calls */
function yelp(dest: AudioNode, t0: number, pitch: number, amount: number) {
  noiseTo(dest, t0, { dur: 0.09, vol: 0.07 * amount, freq: 1400 * pitch, q: 1.4, sweepTo: 700 * pitch });
  toneTo(dest, t0, { freq: 420 * pitch, slideTo: 240 * pitch, dur: 0.12, type: 'triangle', vol: 0.06 * amount });
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
  /** Gentle, distant bird phrases and breeze for the open-world daytime sound bed. */
  ambientBird() {
    const bus = voiceBus(0.2, (Math.random() - 0.5) * 0.5, false);
    if (!bus) return;
    const base = 2200 + Math.random() * 1100;
    toneTo(bus.dest, bus.t0, { freq: base, slideTo: base * (1.18 + Math.random() * 0.28), dur: 0.12, type: 'sine', vol: 0.11 });
    toneTo(bus.dest, bus.t0 + 0.16, { freq: base * 1.22, slideTo: base * (0.86 + Math.random() * 0.2), dur: 0.16, type: 'sine', vol: 0.09 });
    if (Math.random() < 0.42) toneTo(bus.dest, bus.t0 + 0.38, { freq: base * 0.92, slideTo: base * 1.1, dur: 0.11, type: 'sine', vol: 0.07 });
  },
  /** A light cricket chorus, heard as sparse repeating chirps rather than a loud loop. */
  crickets() {
    const bus = voiceBus(0.24, (Math.random() - 0.5) * 0.35, false);
    if (!bus) return;
    const base = 4100 + Math.random() * 500;
    for (let i = 0; i < 9; i++) {
      const at = bus.t0 + i * (0.115 + Math.random() * 0.025);
      toneTo(bus.dest, at, { freq: base + (i % 3) * 95, slideTo: base + 180 + (i % 2) * 75, dur: 0.055, type: 'sine', vol: 0.07 });
    }
  },
  /** Two soft hollow owl calls. */
  owl() {
    const bus = voiceBus(0.26, (Math.random() - 0.5) * 0.55, false);
    if (!bus) return;
    for (const [delay, start, end] of [[0, 465, 338], [0.64, 390, 280]] as const) {
      toneTo(bus.dest, bus.t0 + delay, { freq: start, slideTo: end, dur: 0.52, type: 'sine', vol: 0.13, attack: 0.08,
        vibrato: { rate: 4.2, depth: 4 } });
      toneTo(bus.dest, bus.t0 + delay, { freq: start * 2.01, slideTo: end * 1.98, dur: 0.35, type: 'triangle', vol: 0.025, attack: 0.08 });
    }
  },
  /** Distant layered wolf howl; the slow pitch bend reads as a call across the valley. */
  wolfHowl() {
    const bus = voiceBus(0.23, (Math.random() - 0.5) * 0.7, false);
    if (!bus) return;
    const base = 285 + Math.random() * 45;
    toneTo(bus.dest, bus.t0, { freq: base, slideTo: base * 1.58, dur: 1.5, type: 'sawtooth', vol: 0.045, attack: 0.25,
      filter: { type: 'lowpass', freq: 900, q: 1.3, sweepTo: 1250 }, vibrato: { rate: 4.5, depth: 7 } });
    toneTo(bus.dest, bus.t0 + 0.24, { freq: base * 0.5, slideTo: base * 0.9, dur: 1.7, type: 'sine', vol: 0.11, attack: 0.35,
      vibrato: { rate: 4.1, depth: 5 } });
    noiseTo(bus.dest, bus.t0 + 0.12, { dur: 0.7, vol: 0.025, freq: 780, q: 0.7, type: 'lowpass', sweepTo: 1200, attack: 0.18 });
  },
  /** Tiny ember crackle when raw food is cooked at a live campfire. */
  fireCrackle() {
    if (!ctx || !master || muted) return;
    const t0 = now();
    noiseTo(master, t0, { dur: 0.16, vol: 0.075, freq: 2200 + Math.random() * 900, q: 1.2, type: 'highpass', sweepTo: 900 });
    toneTo(master, t0 + 0.015, { freq: 470 + Math.random() * 180, slideTo: 230, dur: 0.12, type: 'triangle', vol: 0.045 });
  },
  /**
   * Old timber lid: a slow stick-slip groan with a low wooden knock.
   * `opening` stretches the groan upward; a re-opened chest only creaks briefly.
   */
  creak(opening = true) {
    if (!ctx || !master || muted) return;
    const t0 = now();
    const dur = opening ? 0.62 : 0.34;
    const from = opening ? 320 : 480;
    const to = opening ? 620 : 300;
    noiseTo(master, t0, { dur, vol: 0.075, freq: from, q: 13, type: 'bandpass', sweepTo: to, attack: 0.05 });
    noiseTo(master, t0 + dur * 0.18, { dur: dur * 0.7, vol: 0.045, freq: from * 1.6, q: 18, type: 'bandpass', sweepTo: to * 1.35, attack: 0.08 });
    // stick-slip impulses: the little catches as the hinge grinds round
    for (let i = 0; i < (opening ? 5 : 2); i++) {
      const at = t0 + dur * (0.12 + i * (opening ? 0.17 : 0.3));
      noiseTo(master, at, { dur: 0.035, vol: 0.05, freq: 900 + i * 260, q: 9 });
    }
    toneTo(master, t0 + dur * 0.86, { freq: 118, slideTo: 84, dur: 0.14, type: 'triangle', vol: 0.1, attack: 0.006 });
    if (opening) toneTo(master, t0 + dur * 0.2, { freq: 92, slideTo: 70, dur: 0.3, type: 'sine', vol: 0.05, attack: 0.1 });
  },
  /** any mob's voice, placed in the world by distance and stereo direction */
  creature(voice: CreatureVoice, opts: VoiceOptions = {}) {
    const build = VOICES[voice];
    if (!build) return;
    const state = VOICE_STATE[opts.state ?? 'idle'];
    const bus = voiceBus((opts.volume ?? 1) * 0.85, opts.pan ?? 0, opts.underwater ?? false);
    if (!bus) return;
    const ctxVoice: VoiceCtx = {
      dest: bus.dest,
      t0: bus.t0,
      pitch: (opts.pitch ?? 1) * state.pitch,
      vol: state.vol,
      dur: state.dur,
    };
    build(ctxVoice);
    if (state.yelp > 0) yelp(bus.dest, bus.t0, ctxVoice.pitch, state.yelp);
  },
};
