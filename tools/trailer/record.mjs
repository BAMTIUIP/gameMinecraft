#!/usr/bin/env node
/**
 * ORE RUSH promo-trailer capture — local tool, not part of the game archive.
 *
 * Records the scripted trailer (menu → explore → bird pet → swim → wolf pet → tree → combat →
 * ORE RUSH title card) in a headless Chromium against the Vite dev server, then encodes the
 * captured frames into the promo formats Yandex Games asks for (9:16 and 16:9 MP4, ≤ 28 s,
 * ≤ 100 MB, height ≥ 400 px).
 *
 *   node tools/trailer/record.mjs record --aspect=9x16 --out=tools/trailer/.frames/v1 [--bird=owl] [--seed=777]
 *   node tools/trailer/record.mjs encode --frames=tools/trailer/.frames/v1 --aspect=9x16 \
 *        --out=docs/ore-rush-gameplay-vertical.mp4
 *
 * The dev build exposes the automation hook `window.__ore` (src/game/devHook.ts) for scene setup
 * only — movement, camera, combat and pet AI are all simulated by the real engine. Production
 * builds never expose the hook (`import.meta.env.DEV`).
 *
 * Needs: project devDependencies (puppeteer-core, @sparticuz/chromium), the @fontsource/
 * pixelify-sans + space-grotesk wheels (this sandbox cannot reach Google Fonts), and an ffmpeg
 * binary (on PATH or the imageio-ffmpeg wheel via python3).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COVER = path.join(ROOT, 'docs', 'ore-rush-cover.png');

/**
 * Capture resolutions. The sandbox has 2 CPU cores and software WebGL (swiftshader), so 1080x1920
 * renders at ~15 fps — too choppy for a promo. 720x1280 / 1280x720 are the minimum sizes Yandex
 * Games asks for ("не ниже 720×1280" / "не ниже 1280×720") and render at ~30 fps here, which reads
 * far better in motion than half the frame rate at full HD.
 */
const ASPECTS = {
  '9x16': { width: 720, height: 1280, touch: true },
  '16x9': { width: 1280, height: 720, touch: false },
};

/** Scene layout (blocks). The plain is flattened to a grass top at y=166; feet stand at 167.02. */
const SCENE = {
  flatY: 166,
  spawn: { x: 64.5, y: 167.02, z: 64.5 }, // start, faces south (pond)
  pond: { x0: 56, z0: 82, x1: 72, z1: 94, depth: 3 },
  tree: { x: 84, z: 64, trunk: 5 },
  mineSpot: { x: 80.5, y: 167.02, z: 64.5 }, // faces east (yaw=-PI/2)
  mobs: [
    { id: 'slime', x: 68.5, z: 62.5 },
    { id: 'slime', x: 70.5, z: 67.5 },
    { id: 'enderman', x: 67.5, z: 69.5 },
  ],
  sheep: [
    { x: 46.5, z: 78.5 },
    { x: 49.5, z: 81.5 },
  ],
  cow: { x: 44.5, z: 74.5 },
};

/** Tools granted for the run: iron pickaxe (fast tree chop) and a diamond sword. */
const TOOL_PICK_IRON = 212;
const TOOL_SWORD_DIAMOND = 222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) => console.log(`[trailer ${new Date().toISOString().slice(11, 19)}]`, ...args);

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { _: [] };
  for (const arg of rest) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=');
      opts[k] = v === undefined ? true : v;
    } else opts._.push(arg);
  }
  return { cmd, opts };
}

/* ------------------------------ dev server ------------------------------ */

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`dev server did not answer at ${url}`);
    await sleep(300);
  }
}

/* ------------------------------ chromium ------------------------------ */

async function resolveChromium() {
  const explicit = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return { executablePath: explicit, args: [], extraEnv: {} };
  try {
    const mod = await import('@sparticuz/chromium');
    const chromium = mod.default ?? mod;
    const executablePath = await chromium.executablePath();
    if (!executablePath || !existsSync(executablePath)) return null;
    // the package ships the Amazon Linux runtime libraries as bin/al2023.tar.br; unpack them next to
    // the binary and put them on LD_LIBRARY_PATH (works on Debian/Ubuntu too)
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const binDir = path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))), 'bin');
    const libDir = mkdtempSync(path.join(tmpdir(), 'trailer-libs-'));
    writeFileSync(path.join(libDir, 'libs.tar'), brotliDecompressSync(readFileSync(path.join(binDir, 'al2023.tar.br'))));
    spawnSync('tar', ['-xf', path.join(libDir, 'libs.tar'), '-C', libDir]);
    return {
      executablePath,
      args: chromium.args ?? [],
      extraEnv: { LD_LIBRARY_PATH: `${path.join(libDir, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}` },
    };
  } catch (err) {
    console.warn('[trailer] @sparticuz/chromium resolve failed:', err?.message ?? err);
    return null;
  }
}

/* ------------------------------ fonts ------------------------------ */

/**
 * Build @font-face rules for the game's two web fonts with the woff2 files inlined as data URLs.
 * The sandbox cannot reach fonts.googleapis.com, so the local @fontsource wheels stand in — same
 * fonts the game loads in production, so the footage matches what players see.
 */
function buildFontCss() {
  const pkgs = [
    { pkg: 'pixelify-sans', family: 'Pixelify Sans', subsets: ['latin', 'cyrillic'] },
    { pkg: 'space-grotesk', family: 'Space Grotesk', subsets: ['latin'] },
  ];
  const faces = [];
  for (const { pkg, family, subsets } of pkgs) {
    const dir = path.join(ROOT, 'node_modules', '@fontsource', pkg);
    const indexCss = readFileSync(path.join(dir, 'index.css'), 'utf8');
    // blocks look like: /* pixelify-sans-latin-400-normal */\n@font-face { ... }
    const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(indexCss))) {
      const [, file, body] = m;
      const subset = subsets.find((s) => file.startsWith(`${pkg}-${s}-`));
      if (!subset) continue;
      const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
      if (!weight || Number(weight) < 400 || Number(weight) > 700) continue;
      const range = body.match(/unicode-range:\s*([^;]+);/)?.[1];
      if (!range) continue;
      const woff2 = path.join(dir, 'files', `${file}.woff2`);
      if (!existsSync(woff2)) continue;
      const data = readFileSync(woff2).toString('base64');
      faces.push(
        `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};` +
          `src:url(data:font/woff2;base64,${data}) format('woff2');unicode-range:${range};}`,
      );
    }
  }
  if (!faces.length) throw new Error('no @fontsource faces found — run npm i --no-save @fontsource/pixelify-sans @fontsource/space-grotesk');
  return faces.join('\n');
}

/* ------------------------------ page helpers ------------------------------ */

/** CSS injected for the capture: hide developer instruments and the controls hint stack. */
const HIDE_CSS = `
  [data-developer-kit], [data-developer-shop] { display: none !important; }
  .hud-information--hint { display: none !important; }
`;

/** Install the in-page trailer controller (window.__tc) on top of the dev hook (window.__ore). */
function installController() {
  const ore = window.__ore;
  const eng = ore.engine;
  const S = 167.02; // feet y on the flat plain

  /** Smoothly tween the camera to absolute yaw/pitch (radians) through the real look() input. */
  const lookTo = (yawT, pitchT, dur) =>
    new Promise((resolve) => {
      const [y0, p0] = ore.playerLook();
      const t0 = performance.now();
      const step = () => {
        const k = dur <= 0 ? 1 : Math.min(1, (performance.now() - t0) / (dur * 1000));
        const e = 1 - Math.pow(1 - k, 3);
        const [cy, cp] = ore.playerLook();
        eng.look(cy - (y0 + (yawT - y0) * e), cp - (p0 + (pitchT - p0) * e));
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  /** Yaw that faces a world position from the player's current position. */
  const face = (x, z) => {
    const [px, , pz] = ore.playerPos();
    return Math.atan2(-(x - px), -(z - pz));
  };

  /** One-time run setup: clean mobs, ambient animals, exact start pose, starting gear. */
  const setupRun = () => {
    ore.clearMobs();
    for (const s of window.__scene.sheep) ore.spawnMob('sheep', s.x, S, s.z);
    ore.spawnMob('cow', window.__scene.cow.x, S, window.__scene.cow.z);
    ore.teleport(window.__scene.spawn.x, window.__scene.spawn.y, window.__scene.spawn.z, Math.PI, -0.05);
    ore.grantTool(window.__toolPick, 1);
    ore.grantTool(window.__toolSword, 2);
    eng.selectSlot(1);
  };

  /** Face the nearest living hostile (for the combat beat). Returns false when none remain. */
  const aimNearestHostile = () => {
    const [px, py, pz] = ore.playerPos();
    let best = null;
    let bd = 1e9;
    for (const m of eng.mobSys.mobs) {
      if (!m.alive || m.hidden || !m.def.hostile) continue;
      const d = Math.hypot(m.x - px, m.z - pz);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (!best) return false;
    const yaw = Math.atan2(-(best.x - px), -(best.z - pz));
    const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(best.y + 0.8 - (py + 1.62), bd)));
    window.__tc.lookTo(yaw, pitch, 0.25);
    return true;
  };

  /** End card: dark screen, then the ORE RUSH logo in the menu font and torch color. */
  const endCard = (fadeMs, textMs, holdMs) =>
    new Promise((resolve) => {
      const W = innerWidth;
      const H = innerHeight;
      const cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext('2d');
      const div = document.createElement('div');
      div.setAttribute('data-trailer-end-card', '1');
      div.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
      div.appendChild(cv);
      document.body.appendChild(div);
      const TORCH = '#f4b942';
      const draw = (aBg, aTx) => {
        ctx.fillStyle = `rgba(4,7,6,${aBg})`;
        ctx.fillRect(0, 0, W, H);
        if (aTx <= 0) return;
        const size = Math.round(H * 0.13);
        ctx.globalAlpha = aTx;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${size}px "Pixelify Sans", ui-monospace, monospace`;
        const y0 = H / 2 - size * 0.55;
        ctx.lineWidth = Math.max(2, size * 0.05);
        ctx.strokeStyle = TORCH;
        ctx.strokeText('ORE', W / 2, y0);
        ctx.fillStyle = TORCH;
        ctx.shadowColor = 'rgba(244,185,66,.45)';
        ctx.shadowBlur = size * 0.35;
        ctx.fillText('RUSH', W / 2, y0 + size * 0.95);
        ctx.globalAlpha = 1;
      };
      document.fonts.load(`700 ${Math.round(H * 0.13)}px "Pixelify Sans"`).finally(() => {
        const t0 = performance.now();
        const step = () => {
          const el = performance.now() - t0;
          draw(Math.min(1, el / fadeMs), Math.max(0, Math.min(1, (el - fadeMs * 0.4) / textMs)));
          if (el < fadeMs + textMs + holdMs) requestAnimationFrame(step);
          else {
            draw(1, 1);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    });

  window.__tc = {
    eng,
    S,
    lookTo,
    face,
    setupRun,
    aimNearestHostile,
    endCard,
    phase: () => eng.phase,
    openInv: () => eng.openInventory(),
    closeInv: () => eng.closeInventory(),
    setMove: (x, y) => eng.setMove(x, y),
    setJump: (v) => eng.setJump(v),
    setSprint: (v) => eng.setSprint(v),
    setMining: (v) => eng.setMining(v),
    selectSlot: (i) => eng.selectSlot(i),
    pressV: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true })),
    spawnMobs: (list) => list.map((m) => ore.spawnMob(m.id, m.x, S, m.z)),
    clickExplorer: () => {
      const btn = document.querySelector('.menu-modes button[aria-pressed="false"]');
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    },
    clickPlay: () => {
      const btn = [...document.querySelectorAll('.menu-actions button')].find((b) => b.className.includes('from-moss'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    },
    clickPet: (kind) => {
      const el = document.querySelector(`[data-pet-resource="${kind}"]`);
      if (el) {
        el.click();
        return true;
      }
      return false;
    },
    playerPos: () => ore.playerPos(),
  };
}

/** Prepare the deterministic scene on the freshly regenerated menu world. */
async function prepScene(seed, scene) {
  const ore = window.__ore;
  const eng = ore.engine;
  const world = eng.world;
  window.__scene = scene;
  window.__toolPick = scene.toolPick;
  window.__toolSword = scene.toolSword;
  eng.regenerate(seed);
  // Generate + decorate the whole area the take can stream (the engine streams chunks within
  // 40 blocks / 3 chunks of the player; the menu camera orbits the same neighbourhood).
  for (let cx = -1; cx <= 9; cx++) {
    for (let cz = -1; cz <= 9; cz++) {
      if (!world.hasSurface(cx, cz)) world.genSurface(cx, cz);
      if (!world.isDecorated(cx, cz)) world.decorate(cx, cz, true);
    }
  }
  const f = scene.flatY;
  ore.flatten(28, 28, 104, 104, f);
  ore.pond(scene.pond.x0, scene.pond.z0, scene.pond.x1, scene.pond.z1, f, scene.pond.depth);
  ore.plantTree(scene.tree.x, f + 1, scene.tree.z, scene.tree.trunk);
  // freeze the region: no later terrain/decoration pass may overwrite the prepared scene
  for (let cx = -1; cx <= 9; cx++) {
    for (let cz = -1; cz <= 9; cz++) {
      const c = world.chunks.get((cx + 2048) * 4096 + (cz + 2048));
      if (c && c.state < 2) c.state = 2;
    }
  }
  // Pre-mesh everything synchronously: the frame loop's mesher budget would otherwise cause
  // visible stutters while chunks stream in during the take.
  const meshed = ore.premesh(-1, -1, 9, 9);
  await new Promise((r) => setTimeout(r, 500));
  return { meshed, pos: ore.playerPos() };
}

/* ------------------------------ timeline ------------------------------ */

async function runTimeline(page, bird) {
  const recStart = Date.now();
  const at = async (t, label, fn) => {
    const wait = recStart + t * 1000 - Date.now();
    if (wait > 0) await sleep(wait);
    const t0 = Date.now();
    try {
      await fn();
      log(`  t=${t.toFixed(2)}s ${label} (${Date.now() - t0}ms)`);
    } catch (err) {
      log(`  t=${t.toFixed(2)}s ${label} FAILED: ${err?.message ?? err}`);
    }
  };
  const ev = (fn, ...args) => page.evaluate(fn, ...args);
  const tcExpr = (expr) => page.evaluate(`window.__tc.${expr}`);

  log('timeline start');
  await at(1.3, 'menu: select explore mode', () => tcExpr('clickExplorer()'));
  await at(1.8, 'menu: press play', () => tcExpr('clickPlay()'));

  // wait for the run to actually start (world is pre-generated, so this is fast)
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if ((await tcExpr('phase()')) === 'playing') break;
    await sleep(100);
  }
  log(`  phase=playing after ${((Date.now() - recStart) / 1000).toFixed(2)}s`);

  await at(2.4, 'setup run (mobs, pose, gear)', () => tcExpr('setupRun()'));
  await at(2.9, 'open inventory', () => tcExpr('openInv()'));
  await at(3.2, `equip bird (${bird})`, () => tcExpr(`clickPet(${JSON.stringify(bird)})`));
  await at(4.0, 'close inventory', () => tcExpr('closeInv()'));
  await at(4.2, 'walk to the pond', () => tcExpr('setMove(0,-1)'));
  await at(5.4, 'switch to third person', () => tcExpr('pressV()'));
  await at(7.7, 'jump into the water', () => tcExpr('setJump(true)'));
  await at(7.95, 'release jump', () => tcExpr('setJump(false)'));
  await at(8.15, 'switch to first person (dive)', () => tcExpr('pressV()'));
  await at(8.3, 'dive: look down, swim forward', () =>
    page.evaluate((scene) => {
      const tc = window.__tc;
      tc.lookTo(tc.face(64.5, 88), -0.95, 0.45);
      tc.setMove(0, -1);
      return scene.pond.z1;
    }, SCENE),
  );
  await at(9.5, 'turn to see the bird above water', () =>
    page.evaluate(() => {
      const tc = window.__tc;
      tc.lookTo(tc.face(64.5, 80), 0.8, 0.6);
    }),
  );
  await at(10.1, 'switch to third person', () => tcExpr('pressV()'));
  await at(10.3, 'surface and swim to shore', () =>
    page.evaluate(() => {
      const tc = window.__tc;
      tc.lookTo(0, -0.05, 0.4);
      tc.setMove(0, -1);
    }),
  );
  await at(12.2, 'stop at the shore', () => tcExpr('setMove(0,0)'));
  await at(12.5, 'jump on the shore', () => tcExpr('setJump(true)'));
  await at(12.65, 'open inventory mid-jump', () => tcExpr('openInv()'));
  await at(12.85, 'switch pet to wolf mid-jump', () => tcExpr(`clickPet("wolf")`));
  await at(13.15, 'close inventory, land', () =>
    page.evaluate(() => {
      window.__tc.closeInv();
      window.__tc.setJump(false);
    }),
  );
  await at(13.35, 'sprint to the tree', () =>
    page.evaluate((spot) => {
      const tc = window.__tc;
      tc.setMove(0, -1);
      tc.setSprint(true);
      tc.lookTo(tc.face(spot.x, spot.z), -0.05, 0.5);
    }, SCENE.mineSpot),
  );
  await at(17.0, 'stop, face the tree', () =>
    page.evaluate(() => {
      const tc = window.__tc;
      tc.setMove(0, 0);
      tc.setSprint(false);
      tc.lookTo(-Math.PI / 2, -0.05, 0.4);
    }),
  );
  await at(17.3, 'chop the trunk', () => tcExpr('setMining(true)'));
  await at(18.7, 'stop chopping (wolf fetches)', () => tcExpr('setMining(false)'));
  await at(18.95, 'switch to first person', () => tcExpr('pressV()'));
  await at(19.15, 'take the sword', () => tcExpr('selectSlot(2)'));
  await at(19.25, 'monsters approach', () => page.evaluate((mobs) => window.__tc.spawnMobs(mobs), SCENE.mobs));
  await at(19.35, 'turn around (monsters ahead)', () => page.evaluate(() => window.__tc.lookTo(Math.PI / 2, -0.05, 0.5)));
  await at(21.4, 'attack: aim + swing', () =>
    page.evaluate(() => {
      window.__tc.aimNearestHostile();
      window.__tc.setMining(true);
    }),
  );
  await at(22.1, 're-aim', () => tcExpr('aimNearestHostile()'));
  await at(22.8, 're-aim', () => tcExpr('aimNearestHostile()'));
  await at(23.3, 'stop attacking', () => tcExpr('setMining(false)'));
  await at(23.55, 'end card (dark + ORE RUSH)', () => tcExpr('endCard(400, 800, 1200)'));
  log(`timeline done at ${((Date.now() - recStart) / 1000).toFixed(2)}s`);
  return recStart;
}

/* ------------------------------ record ------------------------------ */

async function record(opts) {
  const aspect = ASPECTS[opts.aspect];
  if (!aspect) throw new Error(`unknown aspect ${opts.aspect} (use 9x16 or 16x9)`);
  const out = path.resolve(opts.out ?? path.join(__dirname, '.frames', `${opts.aspect}-${Date.now()}`));
  // Seed 192379 was picked by scanning: the whole trailer region (x,z in [28,104]) is plains/autumn
  // there — no winter snow tint, no desert patches (see tools/trailer/README note in the commit).
  const seed = Number(opts.seed ?? 192379);
  const bird = opts.bird === 'owl' ? 'owl' : 'parrot';
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  log(`record ${opts.aspect} ${aspect.width}x${aspect.height} → ${out} (seed=${seed}, bird=${bird})`);

  // dev server (dev build exposes window.__ore)
  const port = await freePort();
  log(`starting vite dev server on :${port}`);
  const dev = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  const cleanup = () => {
    try {
      dev.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  };
  process.on('exit', cleanup);
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`);

    const puppeteer = (await import('puppeteer-core')).default ?? (await import('puppeteer-core'));
    const chromium = await resolveChromium();
    if (!chromium) throw new Error('headless chromium unavailable (need @sparticuz/chromium or $CHROME_PATH)');
    const browser = await puppeteer.launch({
      executablePath: chromium.executablePath,
      headless: true,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--lang=ru-RU',
      ],
      env: { ...process.env, ...chromium.extraEnv },
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({
        width: aspect.width,
        height: aspect.height,
        deviceScaleFactor: 1,
        isMobile: aspect.touch,
        hasTouch: aspect.touch,
      });
      page.on('pageerror', (err) => log('[pageerror]', String(err).slice(0, 300)));

      // fresh profile with Russian UI and the two pets owned (bird + wolf)
      await page.evaluateOnNewDocument((birdKind) => {
        try {
          localStorage.setItem('orerush.lang', 'ru');
          localStorage.setItem('orerush.pets.v1', JSON.stringify({ owned: [birdKind, 'wolf'] }));
        } catch {
          /* about:blank */
        }
      }, bird);

      log('opening game…');
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction('!!window.__ore && !!window.__ore.engine', { timeout: 90000 });
      await page.waitForFunction('window.__ore.engine.phase === "menu"', { timeout: 90000 });
      log('game booted (menu)');

      // fonts + capture CSS
      await page.addStyleTag({ content: buildFontCss() });
      await page.addStyleTag({ content: HIDE_CSS });

      // deterministic scene on a freshly regenerated world
      const scene = { ...SCENE, toolPick: TOOL_PICK_IRON, toolSword: TOOL_SWORD_DIAMOND };
      await page.evaluate(prepScene, seed, scene);
      log('scene prepared (flat plain, pond, tree)');

      // in-page controller
      await page.evaluate(installController);
      log('controller installed');

      // Warm-up run: click through the menu into a run, equip/unequip both pets and flash the
      // inventory once (compiles their shaders and warms the UI), then return to the menu. The
      // recorded take then starts from a clean main menu without first-use stalls in the footage.
      log('warm-up run (shader/UI warm-up)…');
      await page.evaluate(`window.__tc.clickExplorer()`);
      await sleep(250);
      await page.evaluate(`window.__tc.clickPlay()`);
      {
        const t0 = Date.now();
        while (Date.now() - t0 < 15000) {
          if ((await page.evaluate(`window.__tc.phase()`)) === 'playing') break;
          await sleep(100);
        }
      }
      await page.evaluate(`window.__tc.setupRun()`);
      await page.evaluate(async (bird) => {
        const e = window.__ore.engine;
        e.setPetEquipped(bird, true);
        await new Promise((r) => setTimeout(r, 450));
        e.setPetEquipped(bird, false);
        await new Promise((r) => setTimeout(r, 150));
        e.setPetEquipped('wolf', true);
        await new Promise((r) => setTimeout(r, 450));
        e.setPetEquipped('wolf', false);
        e.openInventory();
        await new Promise((r) => setTimeout(r, 350));
        e.closeInventory();
      }, bird);
      await page.evaluate(`window.__ore.engine.toMenu()`);
      await page.waitForFunction('window.__ore.engine.phase === "menu"', { timeout: 15000 });
      log('warm-up done, back at menu');

      // screencast
      const client = await page.createCDPSession();
      let frameNo = 0;
      const timestamps = [];
      client.on('Page.screencastFrame', (ev) => {
        try {
          writeFileSync(path.join(out, String(frameNo).padStart(5, '0') + '.jpg'), Buffer.from(ev.data, 'base64'));
          timestamps.push(ev.metadata?.timestamp ?? 0);
          frameNo += 1;
        } catch {
          /* disk hiccup — skip frame */
        }
        client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
      });
      await client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 88,
        maxWidth: aspect.width,
        maxHeight: aspect.height,
        everyNthFrame: 1,
      });

      // sample the engine's own fps counter while recording (diagnostics for the capture rate)
      const fpsSampler = setInterval(() => {
        page.evaluate(`window.__ore.engine.fps`).then((f) => log(`  [fps] ${f}`)).catch(() => {});
      }, 2000);

      await runTimeline(page, bird);

      clearInterval(fpsSampler);
      await client.send('Page.stopScreencast').catch(() => {});
      await sleep(300);

      const first = timestamps[0] ?? 0;
      const last = timestamps[timestamps.length - 1] ?? first;
      const rawFps = timestamps.length > 1 ? (timestamps.length - 1) / Math.max(0.001, last - first) : 30;
      const fps = Math.min(60, Math.max(5, rawFps));
      const meta = {
        width: aspect.width,
        height: aspect.height,
        aspect: opts.aspect,
        bird,
        seed,
        frames: frameNo,
        fps,
        durationMs: (last - first) * 1000,
      };
      writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
      log(`captured ${frameNo} frames @ ${meta.fps.toFixed(2)}fps (${(meta.durationMs / 1000).toFixed(2)}s)`);
      log(`frames dir: ${out}`);
      return meta;
    } finally {
      await browser.close().catch(() => {});
    }
  } finally {
    cleanup();
    process.removeListener('exit', cleanup);
  }
}

/* ------------------------------ encode ------------------------------ */

function findFfmpeg() {
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return 'ffmpeg';
  const py = spawnSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], {
    encoding: 'utf8',
  });
  if (py.status === 0 && py.stdout.trim()) return py.stdout.trim();
  throw new Error('ffmpeg not found (install it or pip install imageio-ffmpeg)');
}

async function encode(opts) {
  const aspect = ASPECTS[opts.aspect];
  if (!aspect) throw new Error(`unknown aspect ${opts.aspect} (use 9x16 or 16x9)`);
  const framesDir = path.resolve(opts.frames);
  const out = path.resolve(opts.out);
  const meta = JSON.parse(readFileSync(path.join(framesDir, 'meta.json'), 'utf8'));
  const ffmpeg = findFfmpeg();
  const { width: W, height: H } = aspect;
  const fps = meta.fps;
  const aDur = meta.frames / fps;
  const xf = 1.0; // crossfade gameplay → cover
  const coverHold = 1.7; // solo cover time after the crossfade
  const offset = Math.max(0, aDur - xf);
  const total = aDur + coverHold;
  if (total > 28) throw new Error(`result would be ${total.toFixed(2)}s — over the 28s promo limit`);
  mkdirSync(path.dirname(out), { recursive: true });
  log(`encode ${framesDir} → ${out} (${W}x${H}, ${fps.toFixed(2)}fps, ${meta.frames} frames, ${total.toFixed(2)}s)`);
  const args = [
    '-y',
    '-framerate', String(fps), '-start_number', '0', '-i', path.join(framesDir, '%05d.jpg'),
    '-loop', '1', '-framerate', String(fps), '-t', String(xf + coverHold), '-i', COVER,
    '-filter_complex',
    `[0:v]fade=t=in:st=0:d=0.3,fps=${fps},format=yuv420p[v0];` +
      `[1:v]scale=${W}:${H}:force_original_aspect_ratio=cover,crop=${W}:${H},fps=${fps},format=yuv420p[v1];` +
      `[v0][v1]xfade=transition=fade:duration=${xf}:offset=${offset.toFixed(3)}[v]`,
    '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
    '-movflags', '+faststart',
    '-r', String(fps),
    out,
  ];
  const res = spawnSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${res.stderr?.toString().slice(-2000)}`);
  const { statSync } = await import('node:fs');
  const sizeMb = statSync(out).size / 1048576;
  log(`done: ${out} (${sizeMb.toFixed(1)} MB)`);
  if (sizeMb > 100) throw new Error(`result is ${sizeMb.toFixed(1)} MB — over the 100 MB promo limit`);
}

/* ------------------------------ main ------------------------------ */

const { cmd, opts } = parseArgs(process.argv.slice(2));
try {
  if (cmd === 'record') await record(opts);
  else if (cmd === 'encode') await encode(opts);
  else {
    console.error('usage:');
    console.error('  node tools/trailer/record.mjs record --aspect=9x16|16x9 --out=<framesDir> [--bird=parrot|owl] [--seed=N]');
    console.error('  node tools/trailer/record.mjs encode --frames=<framesDir> --aspect=9x16|16x9 --out=<file.mp4>');
    process.exit(1);
  }
} catch (err) {
  console.error('✖', err?.message ?? err);
  process.exit(1);
}
