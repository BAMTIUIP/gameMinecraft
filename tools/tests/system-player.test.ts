/**
 * Requirement 1.6.1.6 / 1.6.2.5 — «В любых браузерах не отображается системный плеер, вызываемый игрой»
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/6).
 *
 * The system player appears when a page plays an `<audio>`/`<video>` element, hands media to the Media
 * Session API or starts picture-in-picture. This suite therefore does two things:
 *  - scans every shipped source file and the page itself for those APIs — the game must not contain
 *    them at all (a guard against a future edit quietly adding one);
 *  - checks the one deliberate mention: the media session that something else may have left behind is
 *    cleared, and the clearing runs when the audio starts.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

// the suite is bundled into a temporary directory, so the repository root is found by walking up from
// the working directory (npm scripts run from the repository root) until a package.json shows up
function findRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repository root not found from ${start}`);
}

const root = findRoot(process.cwd());

/* ------------------------------- DOM stubs ------------------------------- */

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};

/** the Media Session object a stray script might have registered */
const mediaSessionStub = {
  metadata: { title: 'SOMETHING ELSE' } as unknown,
  playbackState: 'playing',
  setActionHandler() {},
};

const listeners = new Map<string, Array<() => void>>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = {
  title: '',
  documentElement: { lang: '' },
  addEventListener: () => undefined,
  removeEventListener() {},
};
g.addEventListener = (event: string, fn: () => void) => {
  listeners.set(event, [...(listeners.get(event) ?? []), fn]);
};
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'ru', mediaSession: mediaSessionStub },
  configurable: true,
});

class FakeAudioContext {
  state = 'suspended';
  sampleRate = 48_000;
  currentTime = 0;
  destination = {};
  createGain() {
    return { gain: { value: 0, setTargetAtTime() {} }, connect() {} };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(8) };
  }
  async suspend() {
    this.state = 'suspended';
  }
  async resume() {
    this.state = 'running';
  }
}
(g as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

/* ---- 1. the shipped sources contain no system-player APIs ---- */

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * The checks are about code, not about comments: the audio module's own doc comment explains which
 * APIs the game deliberately does *not* use, and that mention must not fail the scan. This tiny
 * scanner drops line and block comments while keeping string literals intact.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += source[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const sources = collect(path.join(root, 'src'));
const page = readFileSync(path.join(root, 'index.html'), 'utf8');

/** the patterns moderation would fail the game for */
const forbidden: Array<{ label: string; test: (source: string) => boolean; allowFiles?: string[] }> = [
  { label: 'элемент <audio>', test: (src) => /<\s*audio[\s>]/i.test(src) },
  { label: 'элемент <video>', test: (src) => /<\s*video[\s>]/i.test(src) },
  { label: 'new Audio(...)', test: (src) => /\bnew\s+Audio\s*\(/.test(src) },
  {
    label: 'создание медиаэлемента через createElement',
    test: (src) => /createElement\s*\(\s*['"`](audio|video)['"`]/i.test(src),
  },
  { label: 'HTMLMediaElement / srcObject', test: (src) => /HTMLMediaElement|\.srcObject\s*=/.test(src) },
  { label: 'setMetadata у медиасессии', test: (src) => /mediaSession[\s\S]{0,80}setMetadata|setMetadata\s*\(/.test(src) },
  {
    label: "playbackState = 'playing'",
    test: (src) => /playbackState\s*=\s*['"`]playing['"`]/.test(src),
  },
  { label: 'picture-in-picture', test: (src) => /requestPictureInPicture|disablePictureInPicture/.test(src) },
  // a media pipeline built by hand still registers a media session in the browser, so it fails 1.6
  // exactly like an <audio> element would
  { label: 'MediaSource / captureStream', test: (src) => /new\s+MediaSource|MediaSource\s*\(|\.captureStream\s*\(|new\s+MediaStream/.test(src) },
  { label: 'ObjectURL для медиа', test: (src) => /createObjectURL\s*\(/.test(src) },];

for (const rule of forbidden) {
  const hits = [...sources, path.join(root, 'index.html')].filter((file) => {
    const src = stripComments(readFileSync(file, 'utf8'));
    return rule.test(src);
  });
  ok(
    hits.length === 0,
    `В исходниках нет: ${rule.label}`,
    hits.map((f) => path.relative(root, f)).join(', '),
  );
}
ok(!/<\s*(audio|video)[\s>]/i.test(page), 'В index.html нет медиаэлементов');

/* ---- 2. the media session left behind is cleared ---- */

const { holdAudioForAd, initAudio, resumeAudio, suspendAudio } = await import('../../src/game/audio');

ok(mediaSessionStub.playbackState === 'playing', 'До старта звука медиасессия «играет» (чужое состояние)', String(mediaSessionStub.playbackState));
initAudio();
ok(mediaSessionStub.playbackState === 'none', 'initAudio() сбрасывает медиасессию (playbackState: none)', String(mediaSessionStub.playbackState));
ok(mediaSessionStub.metadata === null, 'Метаданные системного плеера очищены', JSON.stringify(mediaSessionStub.metadata));

// a stray script tries again: the game clears it the next time its audio resumes
mediaSessionStub.playbackState = 'playing';
mediaSessionStub.metadata = { title: 'AGAIN' };
suspendAudio();
resumeAudio();
ok(mediaSessionStub.playbackState === 'none', 'Возврат звука снова очищает медиасессию', String(mediaSessionStub.playbackState));
holdAudioForAd(true);
holdAudioForAd(false);

// the game never *sets* a session of its own
ok(mediaSessionStub.metadata === null, 'Игра не регистрирует свои метаданные в системном плеере', JSON.stringify(mediaSessionStub.metadata));

/* ---- 3. the only mention of mediaSession in the sources is the clearing code ---- */

const audioSource = stripComments(readFileSync(path.join(root, 'src/game/audio.ts'), 'utf8'));
const mentions = audioSource.match(/mediaSession/g) ?? [];
ok(mentions.length >= 1, 'Единственное упоминание медиасессии — в очищающем коде', `упоминаний: ${mentions.length}`);
ok(/playbackState\s*=\s*'none'/.test(audioSource), 'В коде выставляется именно none, а не playing');

export { passed, failures };
