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
  pond: { x0: 56, z0: 72, x1: 72, z1: 84, depth: 3 },
  tree: { x: 82, z: 64, trunk: 5 },
  mineSpot: { x: 80.6, y: 167.02, z: 64.0 }, // 1.4 blocks from trunk (within reach 1.5), faces east
  mobs: [
    { id: 'slime', x: 72.5, z: 63.5 },
    { id: 'enderman', x: 71.5, z: 65.0 },
  ],
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
 * The sandbox cannot reach fonts.googleapis.com, so the same fonts the game loads in production
 * (Pixelify Sans + Space Grotesk, vendored under tools/trailer/fonts/) stand in — the footage then
 * matches what players see. Falls back to the @fontsource wheels in node_modules when present.
 */
function buildFontCss() {
  const fontsDir = path.join(__dirname, 'fonts');
  const manifestPath = path.join(fontsDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return manifest
      .map((face) => {
        const data = readFileSync(path.join(fontsDir, face.file)).toString('base64');
        return (
          `@font-face{font-family:'${face.family}';font-style:normal;font-display:swap;` +
          `font-weight:${face.weight};src:url(data:font/woff2;base64,${data}) format('woff2');` +
          `unicode-range:${face.unicodeRange};}`
        );
      })
      .join('\n');
  }
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
  if (!faces.length) throw new Error('no fonts found — vendored fonts missing and no @fontsource wheels in node_modules');
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
    clearMobs: () => ore.clearMobs(),
    clickExplorer: () => {
      const btn = [...document.querySelectorAll('.menu-modes button')].find(
        (b) => b.textContent.includes('✦') || b.textContent.toLowerCase().includes('исследователь') || b.textContent.toLowerCase().includes('explorer'),
      );
      if (btn && btn.getAttribute('aria-pressed') !== 'true') {
        btn.click();
        return true;
      }
      return false;
    },
    ensureSurvivalSelected: () => {
      const btn = [...document.querySelectorAll('.menu-modes button')].find(
        (b) => b.textContent.includes('☠') || b.textContent.toLowerCase().includes('выживание') || b.textContent.toLowerCase().includes('survival'),
      );
      if (btn && btn.getAttribute('aria-pressed') !== 'true') {
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
  // Generate the surface of the whole area the take can stream (the engine streams chunks within
  // 40 blocks / 3 chunks of the player; the menu camera orbits the same neighbourhood). The scene
  // itself stays undecorated: the fog wall (renderDist 32) hides the horizon anyway, and every
  // tree/flower would cost software-GL frames during the capture.
  for (let cx = -1; cx <= 9; cx++) {
    for (let cz = -1; cz <= 9; cz++) {
      if (!world.hasSurface(cx, cz)) world.genSurface(cx, cz);
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

async function runTimeline(page, bird, trace) {
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
  const tracer = trace
    ? setInterval(() => {
        page
          .evaluate(() => {
            const tc = window.__tc;
            const [x, y, z] = tc.playerPos();
            const [yaw, pitch] = window.__ore.playerLook();
            return { x: +x.toFixed(1), y: +y.toFixed(2), z: +z.toFixed(1), yaw: +yaw.toFixed(2), pitch: +pitch.toFixed(2), phase: tc.phase() };
          })
          .then((s) => log(`  [trace] ${JSON.stringify(s)}`))
          .catch(() => {});
      }, 500)
    : null;
  // The capture box renders at ~5-15 fps and the engine caps the simulation step at 100 ms, so
  // simulation time runs slower than wall time under load. Fixed-time beats would drift (the
  // player once reached the pond 4 s late and the whole water sequence played out on dry land).
  // The route beats below are therefore event-driven: each waits for the player to actually
  // arrive (rim / water / shore / tree), which keeps the choreography correct at any frame rate.
  const waitFor = async (expr, timeoutMs, label) => {
    const t0 = Date.now();
    for (;;) {
      let v = false;
      try {
        v = await page.evaluate(expr);
      } catch {
        v = false;
      }
      if (v) {
        log(`  [go] ${label} at t=${((Date.now() - recStart) / 1000).toFixed(2)}s`);
        return true;
      }
      if (Date.now() - t0 > timeoutMs) {
        log(`  [go] ${label} TIMEOUT after ${timeoutMs}ms`);
        return false;
      }
      await sleep(80);
    }
  };

  log('timeline start');
  await at(1.3, 'menu: select explore mode', () => tcExpr('clickExplorer()'));
  await at(1.8, 'menu: press play', () => tcExpr('clickPlay()'));

  // wait for the run to actually start (world is pre-generated, so this is fast)
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      if ((await tcExpr('phase()')) === 'playing') break;
      await sleep(100);
    }
  }
  log(`  phase=playing after ${((Date.now() - recStart) / 1000).toFixed(2)}s`);

  await at(2.4, 'setup run (mobs, pose, gear)', () => tcExpr('setupRun()'));
  await at(2.9, 'open inventory', () => tcExpr('openInv()'));
  await at(3.2, `equip bird (${bird})`, () => tcExpr(`clickPet(${JSON.stringify(bird)})`));
  await at(4.0, 'close inventory, walk to the pond', () =>
    page.evaluate(() => {
      window.__tc.closeInv();
      window.__tc.setMove(0, -1);
    }),
  );
  await at(5.2, 'switch to third person', () => tcExpr('pressV()'));

  await waitFor('window.__tc.playerPos()[2] >= 70.5', 9000, 'reach the pond rim');
  await page.evaluate(() => window.__tc.setJump(true));
  await sleep(300);
  await page.evaluate(() => window.__tc.setJump(false));
  log('  jump toward the water');
  await waitFor('window.__ore.engine.inWater === true', 5000, 'splash into the water');
  await tcExpr('pressV()');
  log('  first person at the dive');
  await page.evaluate(() => {
    const tc = window.__tc;
    tc.lookTo(tc.face(64.5, 80), -0.95, 0.4);
    tc.setMove(0, -1);
  });
  log('  dive: swim down + forward ~1.1s');
  await sleep(1100);
  await page.evaluate(() => {
    const tc = window.__tc;
    tc.lookTo(tc.face(64.5, 68), 0.8, 0.6);
  });
  log('  turn to see the bird above water');
  await sleep(900);
  await tcExpr('pressV()');
  log('  third person');
  await page.evaluate(() => {
    const tc = window.__tc;
    // Face north and look UP: the swim code only gains height while pitched up, so a level
    // pitch here would sink the player to the pond floor and the rim wall would block the exit.
    tc.lookTo(0, 0.55, 0.4);
    tc.setMove(0, -1);
  });
  log('  surface (swim up)');
  await sleep(1200);
  await page.evaluate(() => {
    const tc = window.__tc;
    tc.lookTo(0, -0.05, 0.3); // level: cruise at the surface
    tc.setJump(true); // hold jump: at the bank the engine mantles the swimmer onto dry land
  });
  log('  swim to the shore (jump held to climb out)');
  await waitFor('window.__tc.playerPos()[2] <= 71.0', 7000, 'reach the shore');
  await page.evaluate(() => {
    window.__tc.setMove(0, 0);
    window.__tc.setJump(false);
  });
  log('  stop at the shore');
  await sleep(400); // let the climb-out hop land before the scripted jump

  // jump on the shore and switch the pet to the wolf mid-air
  await page.evaluate(() => window.__tc.setJump(true));
  await sleep(120);
  await tcExpr('openInv()');
  await sleep(150);
  await tcExpr('clickPet("wolf")');
  await sleep(250);
  await page.evaluate(() => {
    window.__tc.closeInv();
    window.__tc.setJump(false);
  });
  log('  jump + wolf switch mid-air');

  await page.evaluate(() => {
    const tc = window.__tc;
    tc.setMove(0, -1);
    tc.setSprint(true);
  });
  log('  sprint to the tree');
  // Home onto the mine spot while sprinting: the initial aim tween curves the path, and at
  // sprint speed the player would otherwise fly straight past the tree (seen on the 16:9 take).
  {
    const sprintT0 = Date.now();
    let arrived = false;
    while (Date.now() - sprintT0 < 9000) {
      const d = await page.evaluate((s) => {
        const p = window.__tc.playerPos();
        return Math.hypot(p[0] - s.x, p[2] - s.z);
      }, SCENE.mineSpot);
      if (d < 1.2) {
        arrived = true;
        break;
      }
      if (d > 2.5) {
        await page.evaluate((spot) => {
          window.__tc.lookTo(window.__tc.face(spot.x, spot.z), -0.05, 0.25);
        }, SCENE.mineSpot);
      }
      await sleep(120);
    }
    log(`  [go] arrive at the tree${arrived ? '' : ' TIMEOUT'} at t=${((Date.now() - recStart) / 1000).toFixed(2)}s`);
  }
  await page.evaluate(() => {
    const tc = window.__tc;
    tc.setMove(0, 0);
    tc.setSprint(false);
    tc.lookTo(-Math.PI / 2, -0.15, 0.3);
  });
  log('  stop, face the tree');

  await page.evaluate(() => window.__tc.setMining(true));
  log('  chop the trunk ~1.3s');
  await sleep(1300);
  await page.evaluate(() => window.__tc.setMining(false));
  log('  stop chopping (wolf fetches)');

  await tcExpr('pressV()');
  await tcExpr('selectSlot(2)');
  log('  first person + sword');
  await page.evaluate((mobs) => window.__tc.spawnMobs(mobs), SCENE.mobs);
  log('  monsters approach');
  await page.evaluate(() => {
    window.__tc.lookTo(Math.PI / 2, -0.05, 0.4);
  });
  log('  turn around (monsters ahead)');
  await sleep(600);
  await page.evaluate(() => {
    window.__tc.aimNearestHostile();
    window.__tc.setMove(0, -1);
  });
  log('  charge monsters');
  await sleep(600);
  await page.evaluate(() => window.__tc.setMining(true));
  log('  attack');
  await sleep(700);
  await tcExpr('aimNearestHostile()');
  await sleep(700);
  await tcExpr('aimNearestHostile()');
  await page.evaluate(() => {
    window.__tc.setMining(false);
    window.__tc.setMove(0, 0);
  });
  log('  stop attacking');

  await tcExpr('endCard(400, 800, 1000)');
  if (tracer) clearInterval(tracer);
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
  // Kill dev servers leaked by interrupted previous runs. They match our exact spawn
  // signature (`.bin/vite --port <n> --strictPort`); a user's own `npm run dev` is a bare
  // `vite` without --strictPort and is left alone. esbuild service children exit with
  // their parent (stdio pipe closes).
  const ps = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  if (ps.status === 0) {
    // Token-exact match on argv: <pid> ... node_modules/.bin/vite --port <digits> --strictPort.
    // A substring/regex match would also hit this very script (its source contains the
    // signature) or a user's own `npm run dev` (bare vite, no --strictPort) — neither may die.
    const stale = (ps.stdout ?? '')
      .split('\n')
      .map((line) => {
        const t = line.trim().split(/\s+/);
        const pid = Number(t[0]);
        if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return 0;
        for (let i = 1; i + 3 < t.length; i++) {
          if (t[i].endsWith('node_modules/.bin/vite') && t[i + 1] === '--port' && /^\d+$/.test(t[i + 2]) && t[i + 3] === '--strictPort') return pid;
        }
        return 0;
      })
      .filter((pid) => pid > 0);
    if (stale.length) {
      log(`killing ${stale.length} stale dev server(s) from previous runs: ${stale.join(', ')}`);
      for (const pid of stale) spawnSync('kill', [String(pid)]);
      await new Promise((r) => setTimeout(r, 500));
      for (const pid of stale) spawnSync('kill', ['-9', String(pid)]);
    }
  }
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
        // @sparticuz/chromium ships --single-process/--in-process-gpu/--no-zygote (Lambda-style);
        // on this capture box that serializes the swiftshader raster, the game JS and the
        // screencast encode onto one thread (~6 fps). Multi-process spreads them over the cores.
        ...chromium.args.filter((a) => !['--single-process', '--in-process-gpu', '--no-zygote'].includes(a)),
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

      // Perf tuning for the software-GL capture box (2 CPU cores, swiftshader): render the 3D
      // canvas at a low pixel ratio and pull the fog wall in. The game's own adaptive quality
      // never fights these values (it only lowers toward its own floors, which are higher), and
      // the fog hides the shorter horizon. The HUD/DOM stays at full CSS resolution.
      await page.evaluate(() => {
        const e = window.__ore.engine;
        e.renderer.setPixelRatio(0.3);
        e.renderDist = 26;
        const fog = e.scene.fog;
        if (fog) {
          fog.far = 26 * 0.94;
          fog.near = fog.far * 0.38;
        }
      });
      log('perf tuned (pixelRatio 0.3, renderDist 26)');

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
      await page.evaluate(`window.__tc.ensureSurvivalSelected()`);
      await sleep(300);

      // screencast
      const client = await page.createCDPSession();
      let frameNo = 0;
      const timestamps = [];
      client.on('Page.screencastFrame', (ev) => {
        // Ack FIRST: the screencast only produces the next frame after the ack, so a slow ack
        // throttles the whole capture. The file write happens after, off the critical path.
        client.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
        try {
          writeFileSync(path.join(out, String(frameNo).padStart(5, '0') + '.jpg'), Buffer.from(ev.data, 'base64'));
          timestamps.push(ev.metadata?.timestamp ?? 0);
          frameNo += 1;
        } catch {
          /* disk hiccup — skip frame */
        }
      });
      // The capture may run below the viewport resolution (--capture-scale) to cut the per-frame
      // readback+JPEG cost on the software-GL box; encode() upscales back to the full aspect size.
      const cscale = Math.min(1, Math.max(0.25, Number(opts['capture-scale'] ?? 1)));
      const captureW = Math.round(aspect.width * cscale);
      const captureH = Math.round(aspect.height * cscale);
      await client.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 80,
        maxWidth: captureW,
        maxHeight: captureH,
        everyNthFrame: 1,
      });

      await runTimeline(page, bird, !!opts.trace);

      await client.send('Page.stopScreencast').catch(() => {});
      await sleep(300);

      const first = timestamps[0] ?? 0;
      const last = timestamps[timestamps.length - 1] ?? first;
      const rawFps = timestamps.length > 1 ? (timestamps.length - 1) / Math.max(0.001, last - first) : 30;
      const fps = Math.min(60, Math.max(5, rawFps));
      const meta = {
        width: aspect.width,
        height: aspect.height,
        capture: { width: captureW, height: captureH },
        aspect: opts.aspect,
        bird,
        seed,
        frames: frameNo,
        fps,
        durationMs: (last - first) * 1000,
        timestamps,
      };
      writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
      log(`captured ${frameNo} frames @ ${meta.fps.toFixed(2)}fps (${(meta.durationMs / 1000).toFixed(2)}s)`);
      log(`frames dir: ${out}`);

      if (opts.encode) {
        await encode({
          aspect: opts.aspect,
          frames: out,
          out: opts.encode,
          mci: !!opts.mci,
          fps: opts.fps,
        });
        if (!opts['keep-frames']) {
          rmSync(out, { recursive: true, force: true });
          log(`cleaned up temporary frames: ${out}`);
        }
      }

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
  const cap = meta.capture ?? { width: W, height: H };
  const fps = meta.fps;
  const targetFps = Number(opts.fps ?? 30);
  const aDur = meta.frames / fps;
  const xf = 1.0; // crossfade gameplay → cover
  const coverHold = 1.7; // solo cover time after the crossfade
  const offset = Math.max(0, aDur - xf);
  const total = aDur + coverHold;
  if (total > 28) throw new Error(`result would be ${total.toFixed(2)}s — over the 28s promo limit`);
  mkdirSync(path.dirname(out), { recursive: true });
  log(
    `encode ${framesDir} → ${out} (${W}x${H} from ${cap.width}x${cap.height}, ${fps.toFixed(2)}fps → ${targetFps}fps, ` +
      `${meta.frames} frames, ${total.toFixed(2)}s)`,
  );
  // Guarantee input 0 matches the exact aspect dimensions for xfade
  const interpFilter = opts.mci ? `minterpolate=fps=${targetFps}:mi_mode=mci,` : `fps=${targetFps},`;
  const args = [
    '-y',
    '-framerate', String(fps), '-start_number', '0', '-i', path.join(framesDir, '%05d.jpg'),
    '-loop', '1', '-framerate', String(targetFps), '-t', String(xf + coverHold), '-i', COVER,
    '-filter_complex',
    `[0:v]fade=t=in:st=0:d=0.3,${interpFilter}scale=${W}:${H}:flags=lanczos,format=yuv420p[v0];` +
      `[1:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${targetFps},format=yuv420p[v1];` +
      `[v0][v1]xfade=transition=fade:duration=${xf}:offset=${offset.toFixed(3)}[v]`,
    '-map', '[v]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '21',
    '-movflags', '+faststart',
    '-r', String(targetFps),
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
    console.error('usage (see tools/trailer/README.md for the full guide):');
    console.error('  node tools/trailer/record.mjs record --aspect=9x16|16x9 --out=<framesDir>');
    console.error('        [--bird=parrot|owl] [--seed=N] [--capture-scale=0.5] [--trace]');
    console.error('        [--encode=<file.mp4> [--mci] [--fps=30] [--keep-frames]]');
    console.error('  node tools/trailer/record.mjs encode --frames=<framesDir> --aspect=9x16|16x9');
    console.error('        --out=<file.mp4> [--mci] [--fps=30]');
    process.exit(1);
  }
} catch (err) {
  console.error('✖', err?.message ?? err);
  process.exit(1);
}
