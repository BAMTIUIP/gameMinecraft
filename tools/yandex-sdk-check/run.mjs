#!/usr/bin/env node
/**
 * Automated Yandex Games SDK check.
 *
 * `npm run yandex:sdk-check` serves dist/ over HTTP, swaps the real /sdk.js for
 * tools/yandex-sdk-check/mock-sdk.js, drives the game in headless Chromium and asserts on the SDK
 * call log (window.__yaCalls). That is the only way to see the init → LoadingAPI.ready →
 * GameplayAPI.start/stop sequence, remote config, cloud saves and advertising without the developer
 * console on games.yandex.ru.
 *
 * Browser: uses the first of
 *   1. $CHROME_PATH / $PUPPETEER_EXECUTABLE_PATH,
 *   2. @sparticuz/chromium (self-contained Chromium for CI, dev dependency),
 *   3. `chromium` / `google-chrome` on PATH.
 * A missing browser or dependency is reported as a skip, never as a failed check.
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
  } catch {
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
    // the package layout is build/index.js + bin/*.tar.br; the Amazon Linux runtime libraries
    // unpack next to the binary and go in through LD_LIBRARY_PATH (works on Debian/Ubuntu too)
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const binDir = path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))), 'bin');
    const libDir = mkdtempSync(path.join(tmpdir(), 'ya-libs-'));
    const tarPath = path.join(libDir, 'libs.tar');
    writeFileSync(tarPath, brotliDecompressSync(readFileSync(path.join(binDir, 'al2023.tar.br'))));
    const { execFileSync } = await import('node:child_process');
    execFileSync('tar', ['-xf', tarPath, '-C', libDir]);
    return {
      executablePath,
      args: chromium.args,
      extraEnv: { LD_LIBRARY_PATH: `${path.join(libDir, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}` },
    };
  } catch (err) {
    if (process.env.DEBUG_SDK_CHECK) console.warn('[sdk-check] chromium resolve failed', err);
    return null;
  }
}

const puppeteer = await importBrowser();
const chromium = puppeteer ? await resolveChromium() : null;
if (!puppeteer || !chromium) {
  console.warn(
    '⚠ Headless-браузер недоступен (нужны devDependencies puppeteer-core и @sparticuz/chromium либо $CHROME_PATH) — проверка пропущена.',
  );
  server.close();
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath: chromium.executablePath,
  headless: true,
  args: [...(chromium.args ?? []), '--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, ...(chromium.extraEnv ?? {}) },
});

/* --------------------------------- checks --------------------------------- */

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
  // remote config: the shop is off for this group, the FPS counter is hidden
  flags: { 'shop.enabled': 'false', 'ui.showFps': 'false' },
  // and the explorer shift is 15 s, which lets the check reach the results screen end to end
  data: {
    'orerush.profile': {
      v: 1,
      savedAt: Date.now(),
      name: 'CLOUD MINER',
      scores: [
        { name: 'CLOUD MINER', score: 9999, blocks: 10, tier: 'IRON', depth: 5, combo: 3, date: Date.now(), token: 'cloud-1' },
      ],
      totals: { bestScore: 9999, blocksMined: 4242 },
    },
  },
  stats: { bestScore: 9999, blocksMined: 4242 },
  adsFill: true,
  rewarded: true,
};
await page.evaluateOnNewDocument(
  (s) => {
    window.__yaMockSeed = s;
    // the shortened shift: the game reads game.exploreMinutes from the remote config
    window.__yaMockSeed.flags = { ...s.flags, 'game.exploreMinutes': '0.25' };
  },
  seed,
);

const calls = () => page.evaluate(() => window.__yaCalls ?? []);
const names = (log) => log.map((c) => c.name);
const count = (log, name) => log.filter((c) => c.name === name).length;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (label, fn, timeout = 60_000, arg) => {
  const start = Date.now();
  for (;;) {
    try {
      // `arg` is passed into the page: a closure variable would be a ReferenceError there
      if (await page.evaluate(fn, arg)) return true;
    } catch {
      /* page mid-navigation */
    }
    if (Date.now() - start > timeout) {
      check(false, label, `таймаут ${timeout} ms`);
      return false;
    }
    await wait(250);
  }
};

try {
  await page.goto(`${base}?payload=check`, { waitUntil: 'domcontentloaded' });

  // ===================== 1. boot: SDK, loader, remote config =====================
  const menuUp = await waitFor('Меню игры появилось', () => {
    const root = document.getElementById('root');
    return !!root && /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|MINE NOW|НАЧАТЬ|CREUSER|ABBAUEN/i.test(root.textContent ?? '');
  });
  const logBeforeMenu = await calls();
  check(names(logBeforeMenu).includes('YaGames.init'), 'YaGames.init() вызван');
  check(count(logBeforeMenu, 'LoadingAPI.ready') === 1, 'LoadingAPI.ready() вызван ровно один раз');
  check(!menuUp || names(logBeforeMenu).includes('LoadingAPI.ready'), 'Game Ready отправлен вместе с появлением меню');

  check(count(logBeforeMenu, 'ysdk.getFlags') === 1, 'ysdk.getFlags() вызван один раз на старте');
  const flagCall = logBeforeMenu.find((c) => c.name === 'ysdk.getFlags')?.arg;
  check((flagCall?.local ?? 0) >= 9, 'Локальная конфигурация передана в defaultFlags', `ключей: ${flagCall?.local}`);
  check(
    (flagCall?.features ?? []).includes('lang') && (flagCall?.features ?? []).includes('payingStatus'),
    'Клиентские параметры (lang, payingStatus) переданы',
    JSON.stringify(flagCall?.features),
  );
  const shopVisible = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /МАГАЗИН|SHOP|BOUTIQUE/i.test(b.textContent ?? '')),
  );
  check(shopVisible === false, 'Флаг shop.enabled=false действительно скрыл магазин');

  // ===================== 2. player: profile, cloud merge, rate limits =====================
  check(count(logBeforeMenu, 'ysdk.getPlayer') <= 2, 'getPlayer() в пределах лимита 20/5мин');
  check(names(logBeforeMenu).includes('player.getData'), 'player.getData() вызван для облачного профиля');
  const restored = await page.evaluate(() =>
    (window.localStorage.getItem('orerush.highscores.v1') ?? '').includes('CLOUD MINER'),
  );
  check(restored, 'Облачные рекорды подтянуты в локальную таблицу');

  // ===================== 3. explorer mode from the remote config =====================
  const modeClicked = await page.evaluate(() => {
    const section = [...document.querySelectorAll('section[aria-label]')][0];
    const button =
      section && [...section.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'false');
    if (!button) return false;
    button.click();
    return true;
  });
  check(modeClicked, 'Переключатель режима найден');
  await wait(500);
  const mode = await page.evaluate(() => window.localStorage.getItem('orerush.mode'));
  check(mode === 'explorer', 'Режим переключился на исследователя', String(mode));
  const cloudFlushed = await waitFor(
    'player.setData после смены режима',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData'),
    15_000,
  );
  check(cloudFlushed, 'Смена режима уходит в облако батчем (player.setData)');
  const flushCount = count(await calls(), 'player.setData');
  check(flushCount <= 3, 'Запись профиля не спамит лимит setData (100/5мин)', `запросов: ${flushCount}`);

  // ===================== 4. gameplay markup =====================
  const playClicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      /НАЧАТЬ ДОБЫЧУ|MINE NOW|CREUSER|ABBAUEN/i.test(b.textContent ?? ''),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  check(playClicked, 'Кнопка старта забега найдена и нажата');
  await wait(3000);
  check(names(await calls()).includes('GameplayAPI.start'), 'GameplayAPI.start() на старте забега');

  await page.keyboard.press('Escape');
  await wait(1200);
  let log = await calls();
  const startedIdx = names(log).lastIndexOf('GameplayAPI.start');
  const stoppedIdx = names(log).lastIndexOf('GameplayAPI.stop');
  check(stoppedIdx > startedIdx, 'GameplayAPI.stop() на паузе (после start)');
  await page.keyboard.press('Escape');
  await wait(1200);
  log = await calls();
  check(names(log).lastIndexOf('GameplayAPI.start') > stoppedIdx, 'GameplayAPI.start() после снятия паузы');

  // platform-driven pause / resume, while a run is really in progress
  const stopsBefore = count(log, 'GameplayAPI.stop');
  await page.evaluate(() => (window.__yaEmit?.game_api_pause ?? []).forEach((fn) => fn()));
  await wait(1000);
  log = await calls();
  check(count(log, 'GameplayAPI.stop') > stopsBefore, 'Платформенная пауза (game_api_pause) останавливает геймплей');
  const startsBefore = count(log, 'GameplayAPI.start');
  await page.evaluate(() => (window.__yaEmit?.game_api_resume ?? []).forEach((fn) => fn()));
  await wait(1200);
  log = await calls();
  check(count(log, 'GameplayAPI.start') > startsBefore, 'Возврат (game_api_resume) снова запускает геймплей');

  // ===================== 5. the sticky banner is menu-only =====================
  check(
    names(log).includes('adv.hideBannerAdv') || names(log).includes('adv.showBannerAdv'),
    'Стики-баннер управляется через API (меню/игра)',
  );

  // ===================== 6. the short shift ends → results screen, cloud stats =====================
  const finished = await waitFor(
    'Экран итогов забега',
    () =>
      /СМОТРЕТЬ РЕКЛАМУ · ПРОДОЛЖИТЬ|WATCH AD · CONTINUE|ЕЩЁ РАЗ|MINE AGAIN|NOCHMAL|REJOUER/i.test(
        document.body.innerText ?? '',
      ),
    60_000,
  );
  check(finished, 'Короткая смена из удалённой конфигурации дошла до экрана итогов');
  const statsFlushed = await waitFor(
    'Статистика забега в облаке',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.incrementStats' || c.name === 'player.setStats'),
    15_000,
  );
  check(statsFlushed, 'По итогам забега статистика ушла в player.incrementStats/setStats');
  const profileFlushed = await waitFor(
    'Рекорды в облачном профиле',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData' && (c.arg?.keys ?? []).includes('orerush.profile')),
    15_000,
  );
  check(profileFlushed, 'Рекорды забега ушли в облачный профиль (player.setData)');

  // ===================== 7. rewarded video: click → reward → the run continues =====================
  const startsBeforeRevive = count(await calls(), 'GameplayAPI.start');
  const reviveClicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      /СМОТРЕТЬ РЕКЛАМУ|WATCH AD|WERBUNG|VOIR UNE PUB/i.test(b.textContent ?? ''),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  check(reviveClicked, 'Кнопка rewarded-видео предложена на экране итогов');
  const rewardedShown = await waitFor(
    'adv.showRewardedVideo',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'adv.showRewardedVideo'),
    10_000,
  );
  check(rewardedShown, 'Клик вызвал ysdk.adv.showRewardedVideo()');
  const revived = await waitFor(
    'Возврат в забег после награды',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'GameplayAPI.start').length > before,
    10_000,
    startsBeforeRevive,
  );
  check(revived, 'После награды забег продолжился (GameplayAPI.start)');

  // ===================== 8. fullscreen ad on "play again" (user action) =====================
  await page.keyboard.press('Escape');
  await wait(1500);
  const restartClicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      /ЗАНОВО|RESTART|NEU STARTEN|RECOMMENCER/i.test(b.textContent ?? ''),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  const fullscreenShown = await waitFor(
    'adv.showFullscreenAdv',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'adv.showFullscreenAdv'),
    10_000,
  );
  check(restartClicked && fullscreenShown, 'Полноэкранная реклама вызвана действием игрока (кнопка «Заново»)');

  // ===================== 9. local mirrors and console health =====================
  const totalsMirror = await page.evaluate(() => !!window.localStorage.getItem('orerush.totals.v1'));
  check(totalsMirror, 'Локальное зеркало статистики создано');
  const fatal = consoleErrors.filter((e) => !/fonts\.googleapis|fonts\.gstatic|ERR_|Failed to load resource/i.test(e));
  check(fatal.length === 0, 'В консоли нет ошибок SDK', fatal.slice(0, 3).join(' | '));

  if (process.env.DEBUG_SDK_CHECK) {
    const tail = (await calls()).slice(-25).map((c) => `${c.name}${c.arg ? ` ${JSON.stringify(c.arg)}` : ''}`);
    console.log('\n[debug] последние вызовы SDK:\n' + tail.join('\n'));
    console.log('[debug] фаза игры:', await page.evaluate(() => document.body.innerText.slice(0, 200).replace(/\n+/g, ' | ')));
  }
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
