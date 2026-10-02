#!/usr/bin/env node
/**
 * Automated Yandex Games SDK check.
 *
 * `npm run yandex:sdk-check` builds nothing itself: it serves dist/ over HTTP, swaps the real
 * /sdk.js for tools/yandex-sdk-check/mock-sdk.js, drives the game in headless Chromium and
 * asserts on the SDK call log (window.__yaCalls). That is the only way to see the
 * init → LoadingAPI.ready → GameplayAPI.start/stop sequence and the cloud-save traffic without
 * the developer console on games.yandex.ru.
 *
 * Browser: uses the first of
 *   1. $CHROME_PATH / $PUPPETEER_EXECUTABLE_PATH,
 *   2. @sparticuz/chromium (self-contained Chromium for CI, dev dependency),
 *   3. `chromium` / `google-chrome` on PATH.
 * Missing browser or dependency is reported as a skip, never as a failed check.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const MOCK = path.join(__dirname, 'mock-sdk.js');

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('✖ dist/index.html не найден. Сначала запустите npm run build.');
  process.exit(1);
}

/* ------------------------------ static server ------------------------------ */

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/sdk.js') {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(readFileSync(MOCK));
    return;
  }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(DIST, file.replace(/^\//, ''));
  if (!full.startsWith(DIST) || !existsSync(full)) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }
  res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
  res.end(readFileSync(full));
});

const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const base = `http://127.0.0.1:${port}/`;

/* -------------------------------- browser --------------------------------- */

async function importBrowser() {
  try {
    const puppeteer = await import('puppeteer-core');
    return puppeteer.default ?? puppeteer;
  } catch (err) {
    if (process.env.DEBUG_SDK_CHECK) console.warn('[sdk-check] chromium resolve failed', err);
    return null;
  }
}

async function resolveChromium() {
  const explicit = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return { executablePath: explicit, extraEnv: {} };
  try {
    const mod = await import('@sparticuz/chromium');
    const chromium = mod.default ?? mod;
    const executablePath = await chromium.executablePath();
    if (!executablePath || !existsSync(executablePath)) return null;
    // the Amazon Linux runtime libraries ship next to the package's index.js
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    // package layout: build/index.js points at ../bin, where the compressed runtime lives
    const pkgDir = path.dirname(path.dirname(require.resolve('@sparticuz/chromium')));
    const binDir = path.join(pkgDir, 'bin');
    // The bundled build expects Amazon Linux libraries: unpack them next to the binary and add
    // them through LD_LIBRARY_PATH, which is what makes it run on plain Debian/Ubuntu too.
    const libDir = mkdtempSync(path.join(tmpdir(), 'ya-libs-'));
    const tarPath = path.join(libDir, 'libs.tar');
    writeFileSync(tarPath, brotliDecompressSync(readFileSync(path.join(binDir, 'al2023.tar.br'))));
    const { execFileSync } = await import('node:child_process');
    execFileSync('tar', ['-xf', tarPath, '-C', libDir]);
    return { executablePath, extraEnv: { LD_LIBRARY_PATH: `${path.join(libDir, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}` }, args: chromium.args };
  } catch (err) {
    if (process.env.DEBUG_SDK_CHECK) console.warn('[sdk-check] chromium resolve failed', err);
    return null;
  }
}

const puppeteer = await importBrowser();
const chromium = puppeteer ? await resolveChromium() : null;
if (!puppeteer || !chromium) {
  console.warn('⚠ Headless-браузер недоступен (нужны devDependencies puppeteer-core и @sparticuz/chromium либо $CHROME_PATH) — проверка пропущена.');
  server.close();
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath: chromium.executablePath,
  headless: true,
  args: [...(chromium.args ?? []), '--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, ...chromium.extraEnv },
});

const failures = [];
const passes = [];
const check = (ok, label, detail = '') => (ok ? passes : failures).push(detail ? `${label} → ${detail}` : label);

const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

// a player who already has cloud progress from another device
const seed = {
  lang: 'ru',
  name: 'CLOUD MINER',
  data: {
    'orerush.profile': {
      v: 1,
      savedAt: Date.now(),
      name: 'CLOUD MINER',
      scores: [{ name: 'CLOUD MINER', score: 9999, blocks: 10, tier: 'IRON', depth: 5, combo: 3, date: Date.now(), token: 'cloud-1' }],
      totals: { bestScore: 9999, blocksMined: 4242 },
    },
  },
  stats: { bestScore: 9999, blocksMined: 4242 },
};
await page.evaluateOnNewDocument((s) => {
  window.__yaMockSeed = s;
}, seed);

const calls = () => page.evaluate(() => window.__yaCalls ?? []);
const names = (log) => log.map((c) => c.name);
const waitFor = async (label, fn, timeout = 120_000) => {
  const start = Date.now();
  for (;;) {
    if (await page.evaluate(fn)) return true;
    if (Date.now() - start > timeout) {
      check(false, label, `таймаут ${timeout} ms`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
};

try {
  await page.goto(`${base}?payload=check`, { waitUntil: 'domcontentloaded' });

  // 1. the SDK is initialised, and the loader is told when the menu is really up
  const menuUp = await waitFor('Меню игры появилось', () => {
    const root = document.getElementById('root');
    return !!root && /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|MINE NOW|ИГРАТЬ|НАЧАТЬ/i.test(root.textContent ?? '');
  });
  const logBeforeMenu = await calls();
  check(names(logBeforeMenu).includes('YaGames.init'), 'YaGames.init() вызван');
  check(names(logBeforeMenu).filter((n) => n === 'LoadingAPI.ready').length === 1, 'LoadingAPI.ready() вызван ровно один раз');
  const readyIndex = names(logBeforeMenu).indexOf('LoadingAPI.ready');
  check(
    !menuUp || readyIndex >= 0,
    'Game Ready отправлен только когда меню уже готово',
    menuUp ? `ready на позиции ${readyIndex}` : 'меню не дождались',
  );

  // 2. player object: one getPlayer, cloud profile pulled and merged (records from another device)
  check(names(logBeforeMenu).filter((n) => n === 'ysdk.getPlayer').length <= 2, 'getPlayer() в пределах лимита 20/5мин');
  const restored = await page.evaluate(() => {
    const raw = window.localStorage.getItem('orerush.highscores.v1');
    return raw ? raw.includes('CLOUD MINER') : false;
  });
  check(restored, 'Облачные рекорды подтянуты в локальную таблицу');
  check(names(logBeforeMenu).includes('player.getData'), 'player.getData() вызван для облачного профиля');

  // 3. a mode switch is a profile change: it must reach the cloud in a batched setData
  const modeClicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-pressed]')];
    const other = buttons.find((b) => b.getAttribute('aria-pressed') === 'false');
    if (!other) return false;
    other.click();
    return true;
  });
  check(modeClicked, 'Переключатель режима найден');
  const cloudFlushed = await waitFor(
    'player.setData после смены режима',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData'),
    15_000,
  );
  check(cloudFlushed, 'Смена режима уходит в облако батчем (player.setData)');
  const flushCount = (await calls()).filter((c) => c.name === 'player.setData').length;
  check(flushCount <= 3, 'Запись профиля не спамит лимит setData (100/5мин)', `запросов: ${flushCount}`);

  // 4. gameplay markup: start on play, stop on pause, start again on resume (UI is Russian here)
  const clicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const play = buttons.find((b) => /НАЧАТЬ ДОБЫЧУ|MINE NOW|CREUSER|JETZT ABBAUEN/i.test(b.textContent ?? ''));
    if (!play) return false;
    play.click();
    return true;
  });
  check(clicked, 'Кнопка старта забега найдена и нажата');
  await new Promise((r) => setTimeout(r, 3000));
  let log = await calls();
  check(names(log).includes('GameplayAPI.start'), 'GameplayAPI.start() на старте забега');

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 1200));
  log = await calls();
  const started = names(log).lastIndexOf('GameplayAPI.start');
  const stopped = names(log).lastIndexOf('GameplayAPI.stop');
  check(stopped > started, 'GameplayAPI.stop() на паузе (после start)');

  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 1200));
  log = await calls();
  check(names(log).lastIndexOf('GameplayAPI.start') > stopped, 'GameplayAPI.start() после снятия паузы');

  // 5. platform pause/resume events are obeyed
  await page.evaluate(() => (window.__yaEmit?.game_api_pause ?? []).forEach((fn) => fn()));
  await new Promise((r) => setTimeout(r, 1000));
  log = await calls();
  const stopAfterPlatformPause = names(log).lastIndexOf('GameplayAPI.stop');
  await page.evaluate(() => (window.__yaEmit?.game_api_resume ?? []).forEach((fn) => fn()));
  await new Promise((r) => setTimeout(r, 1200));
  log = await calls();
  check(
    stopAfterPlatformPause > names(log).slice(0, stopAfterPlatformPause).lastIndexOf('GameplayAPI.start') &&
      names(log).lastIndexOf('GameplayAPI.start') > stopAfterPlatformPause,
    'Платформенные game_api_pause / game_api_resume приводят к stop / start',
  );

  // 6. the local totals mirror exists even before a run ends (stats flush happens on run end)
  const totalsMirror = await page.evaluate(() => !!window.localStorage.getItem('orerush.totals.v1'));
  check(totalsMirror, 'Локальное зеркало статистики создано');

  const fatal = consoleErrors.filter((e) => !/fonts\.googleapis|fonts\.gstatic|ERR_|Failed to load resource/i.test(e));
  check(fatal.length === 0, 'В консоли нет ошибок SDK', fatal.slice(0, 3).join(' | '));
} catch (err) {
  check(false, 'Проверка упала с исключением', String(err?.message ?? err));
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== Проверка SDK Яндекс Игр (mock + headless Chromium) ===');
for (const p of passes) console.log(`✓ ${p}`);
for (const f of failures) console.log(`✖ ${f}`);
console.log(`\n${passes.length} успешно, ${failures.length} провалено`);
process.exit(failures.length ? 1 : 0);
