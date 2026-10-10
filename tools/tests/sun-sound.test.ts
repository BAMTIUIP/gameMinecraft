/** The special-sun loop must never leave an untracked source playing (regression: duplicate loop). */
type Src = { active: boolean; stopped: number };
const sources: Src[] = [];

class FakeNode {
  gain = {
    value: 1,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  };
  connect() {
    return this;
  }
}

class FakeContext {
  sampleRate = 44100;
  currentTime = 0;
  state = 'running';
  destination = new FakeNode();
  createGain() {
    return new FakeNode();
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(16) };
  }
  createBufferSource() {
    const rec: Src = { active: false, stopped: 0 };
    sources.push(rec);
    const node = Object.assign(new FakeNode(), {
      buffer: null as unknown,
      loop: false,
      start() {
        rec.active = true;
      },
      stop() {
        rec.active = false;
        rec.stopped += 1;
      },
    });
    return node;
  }
  decodeAudioData(_data: ArrayBuffer) {
    return Promise.resolve({ duration: 3.2, length: 141000, numberOfChannels: 1, sampleRate: 44100 });
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
}

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.AudioContext = FakeContext;
g.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
(g as { fetch?: unknown }).fetch = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string) => {
  if (condition) passed += 1;
  else failures.push(label);
};
const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));
const activeCount = () => sources.filter((s) => s.active).length;

const { setSpecialSunSound, setMuted, setSpecialSunVolume } = await import('../../src/game/audio');
const URL = 'sunrise-loop.mp3';

// several start requests in the same tick, as happens when the setting, the phase and mute change together
setSpecialSunSound(true, URL);
setSpecialSunSound(true, URL);
setMuted(true);
setMuted(false);
setSpecialSunSound(true, URL);
await tick();
ok(activeCount() === 1, 'Overlapping start requests create exactly one sun loop');

// volume changes must reach the one playing loop without creating another
setSpecialSunVolume(0.3);
ok(activeCount() === 1, 'Volume change does not start another loop');

// switching off must stop every loop that was ever started
setSpecialSunSound(false, URL);
await tick(400);
ok(activeCount() === 0, 'Switching the sun sound off stops all loops');

// a request made while the buffer is still loading must not start after it was switched off
setSpecialSunSound(true, URL);
setSpecialSunSound(false, URL);
await tick();
ok(activeCount() === 0, 'A start cancelled during loading does not play');

// and it starts again cleanly afterwards
setSpecialSunSound(true, URL);
await tick();
ok(activeCount() === 1, 'The sun loop starts again after being switched off');

export { passed, failures };
