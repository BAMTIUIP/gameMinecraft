#!/usr/bin/env node
/**
 * Automated Yandex Games SDK check.
 *
 * `npm run yandex:sdk-check` serves dist/ over HTTP, swaps the real /sdk.js for
 * tools/yandex-sdk-check/mock-sdk.js, drives the game in headless Chromium and asserts on the SDK
 * call log (window.__yaCalls). That is the only way to see the init → LoadingAPI.ready →
 * GameplayAPI.start/stop sequence, remote config, cloud saves, advertising and purchases without the
 * developer console on games.yandex.ru.
 *
 * Two scenarios run in separate browser contexts:
 *   A. a player with cloud progress from another device and one undelivered purchase — the game must
 *      merge the cloud profile, deliver the purchase (before consuming it!) and play a full shift
 *      with а rewarded video, a paid revive and a fullscreen ad;
 *   B. the shop: catalogue prices from the Console, a real purchase click, the balance and the
 *      consumption order.
 *
 * Browser: uses the first of
 *   1. $CHROME_PATH / $PUPPETEER_EXECUTABLE_PATH,
 *   2. @sparticuz/chromium (self-contained Chromium for CI, dev dependency),
 *   3. `chromium` / `google-chrome` on PATH.
 * A missing browser or dependency is reported as a skip, never as a failed check.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
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
    // ?slow=1 serves the SDK late: the asynchronous connection (sdk-example) has to survive it
    const delay = url.searchParams.get('slow') ? 800 : 0;
    setTimeout(() => res.end(readFileSync(MOCK)), delay);
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
  if (file.endsWith('.html') && url.searchParams.get('asyncsdk')) {
    // the asynchronous connection from sdk-example: no blocking tag, the SDK is injected with
    // `s.async = true` and answers late, so the game code definitely runs first
    const html = readFileSync(full, 'utf8')
      // the built page keeps the tag as `<script src="/sdk.js" >` (the marker attribute is stripped)
      .replace(/\s*<script src="\/sdk\.js"[^>]*><\/script>/, '')
      .replace(
        '</body>',
        `<script>
          (function (d) {
            var t = d.getElementsByTagName('script')[0];
            var s = d.createElement('script');
            s.src = '/sdk.js?slow=1';
            s.async = true;
            t.parentNode.insertBefore(s, t);
          })(document);
        </script></body>`,
      );
    res.end(html);
    return;
  }
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

/* ------------------------------ check helpers ------------------------------ */

const failures = [];
const passes = [];
const check = (ok, label, detail = '') => (ok ? passes : failures).push(detail ? `${label} → ${detail}` : label);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Everything a scenario needs to drive one page and read the SDK call log. */
async function openGame(seed) {
  // NOTE: createBrowserContext() crashes this headless build (Target closed), so scenarios reuse the
  // same browser and just clear localStorage before the app boots.
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.evaluateOnNewDocument((s) => {
    try {
      // Each scenario starts from a clean device — except when the check itself reloads the page to
      // verify requirement 1.9: the flag travels through sessionStorage, which survives a reload.
      if (sessionStorage.getItem('__yaKeepStorage')) sessionStorage.removeItem('__yaKeepStorage');
      else window.localStorage.clear();
    } catch {
      /* about:blank */
    }
    window.__yaCalls = [];
    window.__yaMockSeed = s;
    // Requirement 1.3 is about the game's audio really stopping: the check replaces the AudioContext
    // with a spy that records suspend()/resume() and flips its own state, so focus events can be
    // verified without speakers.
    window.__audioSpy = { created: 0, suspends: 0, resumes: 0 };
    // Requirement 1.6.*.5: the game must not hand audio to the browser's system player. The spy
    // remembers every attempt to register metadata on the media session.
    window.__mediaSessionSpy = { metadataWrites: 0, playbackStates: [] };
    try {
      Object.defineProperty(navigator, 'mediaSession', {
        configurable: true,
        value: {
          get metadata() {
            return null;
          },
          set metadata(value) {
            if (value) window.__mediaSessionSpy.metadataWrites += 1;
          },
          get playbackState() {
            return 'none';
          },
          set playbackState(value) {
            window.__mediaSessionSpy.playbackStates.push(value);
          },
        },
      });
    } catch {
      /* the browser refuses to redefine it: the check below then only looks at media elements */
    }
    const RealAC = window.AudioContext || window.webkitAudioContext;
    if (RealAC) {
      const SpyAC = function (...args) {
        const instance = new RealAC(...args);
        let state = 'running';
        Object.defineProperty(instance, 'state', {
          get: () => state,
          configurable: true,
        });
        instance.suspend = () => {
          window.__audioSpy.suspends += 1;
          state = 'suspended';
          return Promise.resolve();
        };
        instance.resume = () => {
          window.__audioSpy.resumes += 1;
          state = 'running';
          return Promise.resolve();
        };
        window.__audioSpy.created += 1;
        window.__audioSpy.last = instance;
        return instance;
      };
      SpyAC.prototype = RealAC.prototype;
      window.AudioContext = SpyAC;
      if (window.webkitAudioContext) window.webkitAudioContext = SpyAC;
    }
  }, seed);
  const calls = () => page.evaluate(() => window.__yaCalls ?? []);
  const names = (log) => log.map((c) => c.name);
  const count = (log, name) => log.filter((c) => c.name === name).length;
  const storageValue = (key) => page.evaluate((k) => window.localStorage.getItem(k), key);
  const clickByText = (re) =>
    page.evaluate((source) => {
      const rx = new RegExp(source, 'i');
      const button = [...document.querySelectorAll('button')].find((b) => rx.test(b.textContent ?? ''));
      if (!button) return false;
      button.click();
      return true;
    }, re.source);
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

  await page.goto(`${base}?payload=check${seed.asyncSdk ? '&asyncsdk=1' : ''}`, { waitUntil: 'domcontentloaded' });
  return { page, consoleErrors, calls, names, count, storageValue, clickByText, waitFor };
}

/* --------------------------------- scenario A --------------------------------- */

async function scenarioProgress() {
  const game = await openGame({
    lang: 'ru',
    name: 'CLOUD MINER',
    // remote config: the shop is off for this group; deliberately ask to show the FPS overlay to
    // verify that a production build never exposes debug UI. The explorer shift lasts 15 s so the
    // check can reach the results screen end to end.
    flags: { 'shop.enabled': 'false', 'ui.showFps': 'true', 'game.exploreMinutes': '0.25' },
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
    // a purchase that went through on another device and was never delivered
    purchases: [{ productID: 'diamonds-100', purchaseToken: 'pending-token-1', developerPayload: '' }],
    adsFill: true,
    rewarded: true,
  });

  // ===================== 1. boot: SDK, loader, remote config =====================
  const menuUp = await game.waitFor('Меню игры появилось', () => {
    const root = document.getElementById('root');
    return !!root && /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|MINE NOW|НАЧАТЬ|CREUSER|ABBAUEN/i.test(root.textContent ?? '');
  });
  let log = await game.calls();
  check(game.names(log).includes('YaGames.init'), 'YaGames.init() вызван');
  check(game.count(log, 'LoadingAPI.ready') === 1, 'LoadingAPI.ready() вызван ровно один раз');
  check(!menuUp || game.names(log).includes('LoadingAPI.ready'), 'Game Ready отправлен вместе с появлением меню');

  check(game.count(log, 'ysdk.getFlags') === 1, 'ysdk.getFlags() вызван один раз на старте');
  const flagCall = log.find((c) => c.name === 'ysdk.getFlags')?.arg;
  check((flagCall?.local ?? 0) >= 9, 'Локальная конфигурация передана в defaultFlags', `ключей: ${flagCall?.local}`);
  check(
    (flagCall?.features ?? []).includes('lang') && (flagCall?.features ?? []).includes('payingStatus'),
    'Клиентские параметры (lang, payingStatus) переданы',
    JSON.stringify(flagCall?.features),
  );
  const shopVisible = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /МАГАЗИН|SHOP|BOUTIQUE/i.test(b.textContent ?? '')),
  );
  check(shopVisible === false, 'Флаг shop.enabled=false действительно скрыл магазин');

  // ===================== 2. player + cloud merge + pending purchase =====================
  check(game.count(log, 'ysdk.getPlayer') <= 2, 'getPlayer() в пределах лимита 20/5мин');
  check(game.names(log).includes('player.getData'), 'player.getData() вызван для облачного профиля');
  const restored = (await game.storageValue('orerush.highscores.v1'))?.includes('CLOUD MINER') ?? false;
  check(restored, 'Облачные рекорды подтянуты в локальную таблицу');

  check(game.names(log).includes('payments.getPurchases'), 'Необработанные покупки проверяются на старте (1.13.1)');
  const balance = await game.storageValue('orerush.diamonds.v1');
  check(balance === '100', 'Незакрытая покупка зачислена на баланс алмазов', `баланс: ${balance}`);
  const consumeAt = game.names(log).indexOf('payments.consumePurchase');
  const saveAt = log.map((c) => c.name).lastIndexOf('player.setData');
  check(consumeAt >= 0, 'Токен покупки погашен (payments.consumePurchase)');
  check(saveAt >= 0 && saveAt < consumeAt, 'Награда сохранена в облако ДО погашения покупки (порядок из документации)');

  // ===================== 2b. world ranking in the menu =====================
  const worldTab = await game.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      /МИРОВОЙ РЕЙТИНГ|WORLD RANKING|CLASSEMENT MONDIAL|WELTRANGLISTE/i.test(b.textContent ?? ''),
    );
    if (!button) return false;
    button.click();
    return true;
  });
  check(worldTab, 'Вкладка мирового рейтинга есть в меню');
  const topLoaded = await game.waitFor(
    'Топ рейтинга',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'leaderboards.getEntries'),
    15_000,
  );
  check(topLoaded, 'Открытие вкладки запрашивает топ (leaderboards.getEntries)');
  const lbCall = (await game.calls()).find((c) => c.name === 'leaderboards.getEntries')?.arg;
  check(lbCall?.name === 'orerush-best-score', 'Запрос уходит к лидерборду из Консоли', String(lbCall?.name));
  check(
    (lbCall?.options?.quantityTop ?? 99) <= 20 && (lbCall?.options?.quantityAround ?? 99) <= 10,
    'quantityTop и quantityAround в пределах, разрешённых документацией',
    JSON.stringify(lbCall?.options),
  );
  const lbRowsShown = await game.page.evaluate(() => {
    const text = document.body.innerText ?? '';
    return /DEEP DIGGER/.test(text) && /Игрок скрыт|Hidden player|Joueur masqué|Verborgener Spieler/.test(text);
  });
  check(lbRowsShown, 'Топ и скрытый игрок отрисованы в таблице');
  const lbRankShown = await game.page.evaluate(() =>
    /Ваше место: #3|Your place: #3|Votre place : #3|Dein Platz: #3/.test(document.body.innerText ?? ''),
  );
  check(lbRankShown, 'Своё место в рейтинге показано под таблицей');
  check(
    !(await game.calls()).some((c) => c.name === 'ysdk.getLeaderboards'),
    'Устаревший ysdk.getLeaderboards() не вызывается',
  );

  // ===================== 3. explorer mode from the remote config =====================
  const modeClicked = await game.page.evaluate(() => {
    const section = [...document.querySelectorAll('section[aria-label]')][0];
    const button = section && [...section.querySelectorAll('button')].find((b) => b.getAttribute('aria-pressed') === 'false');
    if (!button) return false;
    button.click();
    return true;
  });
  check(modeClicked, 'Переключатель режима найден');
  await wait(500);
  const mode = await game.storageValue('orerush.mode');
  check(mode === 'explorer', 'Режим переключился на исследователя', String(mode));
  const cloudFlushed = await game.waitFor(
    'player.setData после смены режима',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData'),
    15_000,
  );
  check(cloudFlushed, 'Смена режима уходит в облако батчем (player.setData)');
  const flushCount = game.count(await game.calls(), 'player.setData');
  check(flushCount <= 4, 'Запись профиля не спамит лимит setData (100/5мин)', `запросов: ${flushCount}`);

  // ===================== 4. gameplay markup =====================
  const playClicked = await game.clickByText(/НАЧАТЬ ДОБЫЧУ|MINE NOW|CREUSER|ABBAUEN/);
  check(playClicked, 'Кнопка старта забега найдена и нажата');
  await wait(3000);
  check(game.names(await game.calls()).includes('GameplayAPI.start'), 'GameplayAPI.start() на старте забега');
  const fpsOverlayVisible = await game.page.evaluate(() => !!document.querySelector('.hud-information--fps'));
  check(fpsOverlayVisible === false, 'Production build скрывает FPS-отладку даже при ui.showFps=true');

  await game.page.keyboard.press('Escape');
  await wait(1200);
  log = await game.calls();
  const startedIdx = game.names(log).lastIndexOf('GameplayAPI.start');
  const stoppedIdx = game.names(log).lastIndexOf('GameplayAPI.stop');
  check(stoppedIdx > startedIdx, 'GameplayAPI.stop() на паузе (после start)');
  await game.page.keyboard.press('Escape');
  await wait(1200);
  log = await game.calls();
  check(game.names(log).lastIndexOf('GameplayAPI.start') > stoppedIdx, 'GameplayAPI.start() после снятия паузы');

  // platform-driven pause / resume, while a run is really in progress
  const stopsBefore = game.count(log, 'GameplayAPI.stop');
  await game.page.evaluate(() => (window.__yaEmit?.game_api_pause ?? []).forEach((fn) => fn()));
  await wait(1000);
  log = await game.calls();
  check(game.count(log, 'GameplayAPI.stop') > stopsBefore, 'Платформенная пауза (game_api_pause) останавливает геймплей');
  const startsBefore = game.count(log, 'GameplayAPI.start');
  await game.page.evaluate(() => (window.__yaEmit?.game_api_resume ?? []).forEach((fn) => fn()));
  await wait(1200);
  log = await game.calls();
  check(game.count(log, 'GameplayAPI.start') > startsBefore, 'Возврат (game_api_resume) снова запускает геймплей');

  // ===================== 5. the sticky banner is menu-only =====================
  check(
    game.names(log).includes('adv.hideBannerAdv') || game.names(log).includes('adv.showBannerAdv'),
    'Стики-баннер управляется через API (меню/игра)',
  );

  // ===================== 6. the short shift ends → results screen, cloud stats =====================
  const finished = await game.waitFor(
    'Экран итогов забега',
    () =>
      /СМОТРЕТЬ РЕКЛАМУ · ПРОДОЛЖИТЬ|WATCH AD · CONTINUE|ЕЩЁ РАЗ|MINE AGAIN|NOCHMAL|REJOUER/i.test(
        document.body.innerText ?? '',
      ),
    150_000,
  );
  check(finished, 'Короткая смена из удалённой конфигурации дошла до экрана итогов');
  log = await game.calls();
  check(
    game.names(log).lastIndexOf('GameplayAPI.stop') > game.names(log).lastIndexOf('GameplayAPI.start'),
    'GameplayAPI.stop() при переходе забега на экран итогов',
  );
  const statsFlushed = await game.waitFor(
    'Статистика забега в облаке',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.incrementStats' || c.name === 'player.setStats'),
    15_000,
  );
  check(statsFlushed, 'По итогам забега статистика ушла в player.incrementStats/setStats');
  // ===================== 6b. the finished run goes to the leaderboard =====================
  const scoreSent = await game.waitFor(
    'Результат в лидерборде',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'leaderboards.setScore'),
    15_000,
  );
  check(scoreSent, 'Итог забега уходит в лидерборд (leaderboards.setScore)');
  const scoreCall = (await game.calls()).filter((c) => c.name === 'leaderboards.setScore').at(-1)?.arg;
  check(scoreCall?.name === 'orerush-best-score' && Number.isFinite(scoreCall?.score), 'setScore получает имя лидерборда и счёт', JSON.stringify(scoreCall));
  const rankOnResults = await game.waitFor(
    'Место на экране итогов',
    () => /Ваше место: #3|Your place: #3|Votre place : #3|Dein Platz: #3/.test(document.body.innerText ?? ''),
    10_000,
  );
  check(rankOnResults, 'Экран итогов показывает место в мировом рейтинге');

  const profileFlushed = await game.waitFor(
    'Рекорды в облачном профиле',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData' && (c.arg?.keys ?? []).includes('orerush.profile')),
    15_000,
  );
  check(profileFlushed, 'Рекорды забега ушли в облачный профиль (player.setData)');

  // ===================== 6c. rating the game =====================
  // ===================== 6b2. the shift summary goes to the clipboard =====================
  const copyClicked = await game.clickByText(/СКОПИРОВАТЬ ИТОГ|COPY RESULT|COPIER LE RÉSULTAT|ERGEBNIS KOPIEREN/);
  check(copyClicked, 'На экране итогов есть кнопка «Скопировать итог»');
  const copiedToClipboard = await game.waitFor(
    'ysdk.clipboard.writeText',
    () => typeof window.__yaClipboard === 'string' && window.__yaClipboard.includes('ORE RUSH'),
    10_000,
  );
  check(copiedToClipboard, 'Клик кладёт строку итога в ysdk.clipboard.writeText', await game.page.evaluate(() => window.__yaClipboard ?? ''));
  const copyNoteShown = await game.waitFor(
    'Подтверждение копирования',
    () => /Итог скопирован|Result copied|Résultat copié|Ergebnis in die Zwischenablage/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(copyNoteShown, 'Игрок видит подтверждение копирования');

  const reviewChecked = await game.waitFor(
    'Проверка возможности оценить игру',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'feedback.canReview'),
    15_000,
  );
  check(reviewChecked, 'На экране итогов игра спрашивает платформу о возможности оценки (feedback.canReview)');
  const reviewButton = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /ОЦЕНИТЬ ИГРУ|RATE THE GAME|ÉVALUER LE JEU|SPIEL BEWERTEN/i.test(b.textContent ?? '')),
  );
  check(reviewButton, 'Кнопка «оценить игру» появилась на экране итогов');
  const reviewClicked = await game.clickByText(/ОЦЕНИТЬ ИГРУ|RATE THE GAME|ÉVALUER LE JEU|SPIEL BEWERTEN/);
  check(reviewClicked, 'Кнопка оценки нажата');
  const reviewRequested = await game.waitFor(
    'Диалог оценки',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'feedback.requestReview'),
    10_000,
  );
  check(reviewRequested, 'Клик открыл диалог оценки (feedback.requestReview)');
  const thanksShown = await game.waitFor(
    'Благодарность за оценку',
    () => /Спасибо! Ваш отзыв|Thanks! Your feedback|Merci ! Votre avis|Danke! Deine Meinung/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(thanksShown, 'После оценки игрок видит благодарность');
  const reviewGone = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /ОЦЕНИТЬ ИГРУ|RATE THE GAME|ÉVALUER LE JEU|SPIEL BEWERTEN/i.test(b.textContent ?? '')),
  );
  check(reviewGone === false, 'Кнопка исчезла — за сессию игру оценивают один раз');

  // ===================== 7. the results screen offers both revives =====================
  const bothRevives = await game.page.evaluate(() => {
    const text = document.body.innerText ?? '';
    return {
      rewarded: /СМОТРЕТЬ РЕКЛАМУ · ПРОДОЛЖИТЬ|WATCH AD · CONTINUE|NOCHMAL|REJOUER/i.test(text),
      diamonds: /ПРОДОЛЖИТЬ · 100|CONTINUE · 100|WEITER · 100|CONTINUER · 100/.test(text),
    };
  });
  check(bothRevives.rewarded, 'Rewarded-возрождение осталось на месте (регрессия UI покупок)');
  check(bothRevives.diamonds, 'Платное возрождение предложено рядом с рекламным, с ценой из REVIVE_DIAMOND_PRICE');

  // ===================== 8. paid revive spends the diamonds =====================
  const startsBeforeRevive = game.count(await game.calls(), 'GameplayAPI.start');
  const paidReviveClicked = await game.clickByText(/ПРОДОЛЖИТЬ · 100|CONTINUE · 100|WEITER · 100|CONTINUER · 100/);
  check(paidReviveClicked, 'Кнопка платного возрождения нажата');
  const spent = await game.waitFor('Списание алмазов', () => window.localStorage.getItem('orerush.diamonds.v1') === '0', 20_000);
  check(spent, 'Стоимость возрождения списана с баланса');
  const revived = await game.waitFor(
    'Возврат в забег после платного возрождения',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'GameplayAPI.start').length > before,
    15_000,
    startsBeforeRevive,
  );
  check(revived, 'Платное возрождение вернуло игрока в забег (GameplayAPI.start)');
  check(
    game.count(await game.calls(), 'payments.purchase') === 0,
    'Возрождение за алмазы не открывает платёжное окно (оплата из баланса)',
  );

  // ===================== 9. restart from the pause menu → fullscreen ad =====================
  await game.page.keyboard.press('Escape');
  await wait(1500);
  const restartClicked = await game.clickByText(/ЗАНОВО|RESTART|NEU STARTEN|RECOMMENCER/);
  const fullscreenCall = (await game.calls()).filter((c) => c.name === 'adv.showFullscreenAdv').at(-1)?.arg;
  check(
    (fullscreenCall?.callbacks ?? []).includes('onClose') &&
      (fullscreenCall?.callbacks ?? []).includes('onOpen') &&
      (fullscreenCall?.callbacks ?? []).includes('onError'),
    'Полноэкранная реклама передаёт все колбэки примера (onClose, onOpen, onError)',
    JSON.stringify(fullscreenCall),
  );
  const fullscreenShown = await game.waitFor(
    'adv.showFullscreenAdv',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'adv.showFullscreenAdv'),
    10_000,
  );
  check(restartClicked && fullscreenShown, 'Полноэкранная реклама вызвана действием игрока (кнопка «Заново»)');

  // ===================== 10. the next shift ends → rewarded revive =====================
  const newShift = await game.waitFor(
    'Второй экран итогов',
    () => /СМОТРЕТЬ РЕКЛАМУ · ПРОДОЛЖИТЬ|WATCH AD · CONTINUE|NOCHMAL|REJOUER/i.test(document.body.innerText ?? ''),
    150_000,
  );
  check(newShift, 'Следующая смена тоже доходит до экрана итогов');
  const reviewAgain = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /ОЦЕНИТЬ ИГРУ|RATE THE GAME|ÉVALUER LE JEU|SPIEL BEWERTEN/i.test(b.textContent ?? '')),
  );
  check(reviewAgain === false, 'На следующем экране итогов оценку больше не предлагают (раз за сессию)');
  const startsBeforeAd = game.count(await game.calls(), 'GameplayAPI.start');
  const reviveClicked = await game.clickByText(/СМОТРЕТЬ РЕКЛАМУ|WATCH AD|WERBUNG|VOIR UNE PUB/);
  check(reviveClicked, 'Кнопка rewarded-видео предложена на экране итогов');
  const rewardedShown = await game.waitFor(
    'adv.showRewardedVideo',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'adv.showRewardedVideo'),
    15_000,
  );
  check(rewardedShown, 'Клик вызвал ysdk.adv.showRewardedVideo()');
  const rewardedRevive = await game.waitFor(
    'Возврат в забег после награды',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'GameplayAPI.start').length > before,
    15_000,
    startsBeforeAd,
  );
  check(rewardedRevive, 'После награды забег продолжился (GameplayAPI.start)');

  // ===================== 9b. without recorded sessions the shift stays solo =====================
  check(
    !(await game.calls()).some((c) => c.name === 'multiplayer.push'),
    'Без записанных транзакций смена не публикуется (push)',
  );

  // ===================== 9c. platform events: back button and account picker =====================
  const emit = (name) =>
    game.page.evaluate((event) => {
      const listeners = window.__yaEmit?.[event] ?? [];
      listeners.forEach((fn) => fn());
      return listeners.length;
    }, name);
  const backDelivered = await emit('HISTORY_BACK');
  check(backDelivered > 0, 'Событие HISTORY_BACK (кнопка «Назад» на ТВ) доходит до игры', `подписчиков: ${backDelivered}`);
  // Requirement 1.6.3: inside a run the first Back press pauses and opens the in-game menu, and only
  // the second press (inside the double-press window) asks about leaving.
  const pausedByBack = await game.waitFor(
    'Пауза по Back',
    () => /ПАУЗА|PAUSED|EN PAUSE|PAUSIERT/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(pausedByBack, 'Первое нажатие Back во время смены ставит паузу и открывает игровое меню');
  await emit('HISTORY_BACK');
  const exitDialog = await game.waitFor(
    'Диалог выхода',
    () => /ВЫЙТИ ИЗ ИГРЫ|LEAVE THE GAME|QUITTER LE JEU|SPIEL VERLASSEN/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(exitDialog, 'Вместо молчаливого выхода игра показывает свой диалог');
  const stayClicked = await game.clickByText(/^\s*ОСТАТЬСЯ\s*$|^\s*STAY\s*$/i);
  check(stayClicked, 'В диалоге есть кнопка «Остаться»');
  const dialogGone = await game.waitFor(
    'Диалог закрылся',
    () => !/ВЫЙТИ ИЗ ИГРЫ|LEAVE THE GAME|QUITTER LE JEU|SPIEL VERLASSEN/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(dialogGone, 'Отказ закрывает диалог, игра продолжается');
  check(game.count(await game.calls(), 'ysdk.dispatchEvent') === 0, 'Без подтверждения платформе ничего не отправляется');
  await emit('HISTORY_BACK');
  await game.waitFor('Диалог снова открыт', () => /ВЫЙТИ ИЗ ИГРЫ/i.test(document.body.innerText ?? ''), 10_000);
  // click inside the dialog itself: the pause menu behind it also has a "ВЫЙТИ" button, and the check
  // must press the one the player actually sees
  const leaveClicked = await game.page.evaluate(() => {
    const dialog = document.querySelector('[aria-modal="true"]');
    const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
    const button = buttons.find((b) => /^\s*ВЫЙТИ\s*$/.test(b.textContent ?? ''));
    if (!button) return false;
    button.click();
    return true;
  });
  check(leaveClicked, 'Кнопка «Выйти» в диалоге нажата');
  const exitSent = await game.waitFor(
    'ysdk.dispatchEvent(EXIT)',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'ysdk.dispatchEvent' && c.arg === 'EXIT'),
    10_000,
  );
  check(exitSent, 'После подтверждения игра отправляет ysdk.dispatchEvent(EXIT)');

  const readsBefore = game.count(await game.calls(), 'player.getData');
  await emit('ACCOUNT_SELECTION_DIALOG_OPENED');
  await emit('ACCOUNT_SELECTION_DIALOG_CLOSED');
  const resynced = await game.waitFor(
    'Прогресс перечитан после выбора аккаунта',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'player.getData').length > before,
    15_000,
    readsBefore,
  );
  check(resynced, 'После диалога выбора аккаунта игра заново читает прогресс (player.getData)');
  const backToMenu = await game.waitFor(
    'Возврат в меню',
    () => /НАЧАТЬ ДОБЫЧУ|MINE NOW|CREUSER|ABBAUEN/.test(document.body.innerText ?? ''),
    15_000,
  );
  check(backToMenu, 'После выбора аккаунта игра возвращается в главное меню');

  // ===================== 9d. sound stops outside the game (requirement 1.3) =====================
  await game.page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown')));
  const audioReady = await game.waitFor(
    'Звуковая система инициализирована',
    () => (window.__audioSpy?.created ?? 0) > 0,
    10_000,
  );
  check(audioReady, 'Звук инициализируется после действия игрока');
  const suspendsBefore = await game.page.evaluate(() => window.__audioSpy.suspends);
  await game.page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurSilenced = await game.waitFor(
    'Звук остановлен при потере фокуса',
    (before) => window.__audioSpy.suspends > before,
    10_000,
    suspendsBefore,
  );
  check(blurSilenced, 'Потеря фокуса окна останавливает звук (AudioContext.suspend)');
  await game.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const focusRestored = await game.waitFor(
    'Звук вернулся с фокусом',
    () => window.__audioSpy.resumes > 0,
    10_000,
  );
  check(focusRestored, 'Возврат фокуса возобновляет звук');
  const suspendsBeforeHidden = await game.page.evaluate(() => window.__audioSpy.suspends);
  await game.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenSilenced = await game.waitFor(
    'Звук остановлен в скрытой вкладке',
    (before) => window.__audioSpy.suspends > before,
    10_000,
    suspendsBeforeHidden,
  );
  check(hiddenSilenced, 'Скрытая вкладка (свёрнутое окно, меню вкладок) глушит звук');
  await game.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const visibleRestored = await game.waitFor(
    'Звук вернулся на вкладке',
    () => window.__audioSpy.resumes >= 2,
    10_000,
  );
  check(visibleRestored, 'Возвращение на вкладку включает звук обратно');

  // ===================== 9e. no system player (requirement 1.6.1.6/1.6.2.5) =====================
  const mediaElements = await game.page.evaluate(() => document.querySelectorAll('audio, video').length);
  check(mediaElements === 0, 'В разметке нет ни <audio>, ни <video> (звук — только Web Audio)', String(mediaElements));
  const sessionRegister = await game.page.evaluate(() => window.__mediaSessionSpy.metadataWrites);
  check(sessionRegister === 0, 'Игра не регистрирует метаданные в системном плеере', String(sessionRegister));
  const sessionState = await game.page.evaluate(() => window.__mediaSessionSpy.playbackStates.join(','));
  check(
    sessionState === '' || /^(none,)*none$/.test(sessionState),
    'Медиасессия не переводится в состояние «играет» (только none)',
    sessionState,
  );

  // ===================== 9f. progress survives a refresh (requirement 1.9) =====================
  // The player is back in the menu here; the daily bonus button is an ordinary progress action, so it
  // is a good probe: the save must leave the game right after the click, without any reload.
  const writesBeforeClaim = game.count(await game.calls(), 'player.setData');
  const dailyReady = await game.waitFor(
    'Кнопка ежедневного бонуса доступна',
    () => {
      const button = [...document.querySelectorAll('button')].find((b) => /ЕЖЕДНЕВНЫЙ БОНУС/.test(b.textContent ?? ''));
      return !!button && !button.disabled;
    },
    10_000,
  );
  check(dailyReady, 'Действие для проверки сохранения доступно (ежедневный бонус)');
  await game.clickByText(/ЕЖЕДНЕВНЫЙ БОНУС/);
  const savedRightAway = await game.waitFor(
    'Сохранение сразу после действия',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'player.setData').length > before,
    15_000,
    writesBeforeClaim,
  );
  check(savedRightAway, 'Прогресс уходит в облако сразу после действия игрока, без перезагрузки и таймера');

  const beforeReload = await game.page.evaluate(() => ({
    scores: window.localStorage.getItem('orerush.highscores.v1'),
    diamonds: window.localStorage.getItem('orerush.diamonds.v1'),
    totals: window.localStorage.getItem('orerush.totals.v1'),
    name: window.localStorage.getItem('orerush.playername.v1'),
    daily: window.localStorage.getItem('orerush.daily.v1'),
  }));
  await game.page.evaluate(() => sessionStorage.setItem('__yaKeepStorage', '1'));
  await game.page.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await game.waitFor(
    'Меню после перезагрузки страницы',
    () => /НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(document.body.innerText ?? ''),
    40_000,
  );
  check(afterReload, 'После обновления страницы игра снова открывается (пункт 1.9)');
  const reloaded = await game.page.evaluate(() => ({
    scores: window.localStorage.getItem('orerush.highscores.v1'),
    diamonds: window.localStorage.getItem('orerush.diamonds.v1'),
    totals: window.localStorage.getItem('orerush.totals.v1'),
    name: window.localStorage.getItem('orerush.playername.v1'),
    daily: window.localStorage.getItem('orerush.daily.v1'),
  }));
  const survived = Object.keys(beforeReload).every((key) => beforeReload[key] === reloaded[key]);
  check(survived, 'Рекорды, алмазы, счётчики, имя и бонус пережили обновление страницы', JSON.stringify({ beforeReload, reloaded }).slice(0, 200));
  const recordInMenu = await game.page.evaluate(() => {
    const score = String(Number(JSON.parse(window.localStorage.getItem('orerush.highscores.v1') ?? '[]')?.[0]?.score ?? 0));
    const digits = (document.body.innerText ?? '').replace(/\D+/g, '');
    return score !== '0' && digits.includes(score);
  });
  check(recordInMenu, 'Лучший результат из хранилища снова показан в меню');
  const cloudReadAfterReload = (await game.calls()).some((c) => c.name === 'player.getData');
  check(cloudReadAfterReload, 'После перезагрузки игра снова читает облачный прогресс (player.getData)');

  // ===================== 10. local mirrors and console health =====================
  check((await game.storageValue('orerush.totals.v1')) !== null, 'Локальное зеркало статистики создано');
  const fatal = game.consoleErrors.filter((e) => !/fonts\.googleapis|fonts\.gstatic|ERR_|Failed to load resource/i.test(e));
  check(fatal.length === 0, 'В консоли нет ошибок SDK', fatal.slice(0, 3).join(' | '));

  await game.page.close();
}

/* --------------------------------- scenario B --------------------------------- */

async function scenarioShop() {
  const game = await openGame({
    lang: 'ru',
    name: 'SHOPPER',
    flags: { 'shop.enabled': 'true', 'game.exploreMinutes': '0.25' },
    purchases: [],
    // pre-recorded opponent sessions: the SDK replays them as teammates during the survival shift
    multiplayerSessions: [
      {
        id: 'opp-1',
        meta: { meta1: 1200, meta2: 30 },
        player: { name: 'DEEP DIGGER', avatar: '' },
        timeline: [{ payload: { x: 30, y: 20, z: 30, yaw: 0, health: 90, blocks: 12 }, time: 0 }],
      },
      { id: 'opp-2', meta: { meta1: 700 }, player: { name: 'CLOUD MINER' }, timeline: [] },
    ],
    adsFill: true,
    rewarded: true,
  });

  await game.waitFor('Меню игры', () => /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|ЕЩЁ РАЗ|MINE NOW|НАЧАТЬ/i.test(document.body.innerText ?? ''));
  const catalogLoaded = await game.waitFor(
    'Каталог товаров',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'payments.getCatalog'),
    15_000,
  );
  check(catalogLoaded, 'Каталог покупок запрошен (payments.getCatalog)');
  const adFreeOfferReady = await game.waitFor(
    'Предложение отключения рекламы',
    () => {
      const button = document.querySelector('[data-ad-free-purchase]');
      const bounds = button?.getBoundingClientRect();
      return !!button
        && !!bounds
        && bounds.height <= 32
        && bounds.width <= 320
        && !!button.querySelector('[data-ad-free-currency]')
        && /299 TST/.test(button.textContent ?? '');
    },
    10_000,
  );
  check(adFreeOfferReady, 'Кнопка disable_ads показывается только с ценой и иконкой валюты из активного каталога');
  const adFreeConsumesBefore = game.count(await game.calls(), 'payments.consumePurchase');
  const adFreePurchaseBefore = game.count(await game.calls(), 'payments.purchase');
  const adFreeClicked = await game.page.evaluate(() => {
    const button = document.querySelector('[data-ad-free-purchase]');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  });
  check(adFreeClicked, 'Небольшая кнопка отключения рекламы доступна в главном меню');
  const adFreePurchased = await game.waitFor(
    'Покупка permanent disable_ads',
    (before) => (window.__yaCalls ?? []).slice(before).some((call) => call.name === 'payments.purchase' && call.arg?.id === 'disable_ads'),
    10_000,
    adFreePurchaseBefore,
  );
  check(adFreePurchased, 'Кнопка открывает оплату именно для SKU disable_ads');
  const adFreeOwned = await game.waitFor(
    'Восстановленное локальное право отключения рекламы',
    () => !!document.querySelector('[data-ad-free-owned]'),
    10_000,
  );
  check(adFreeOwned, 'После подтверждения покупки кнопка заменяется статусом «реклама отключена»');
  const adFreeNotConsumed = game.count(await game.calls(), 'payments.consumePurchase') === adFreeConsumesBefore;
  check(adFreeNotConsumed, 'Постоянный disable_ads не погашается через consumePurchase');
  const adFreeBannerHidden = await game.page.evaluate(() => window.__yaBanner === false);
  check(adFreeBannerHidden, 'Покупка скрывает sticky-баннер, который платформа показывает в меню');

  const shopOpened = await game.clickByText(/МАГАЗИН|SHOP|BOUTIQUE/);
  check(shopOpened, 'Магазин открывается при включённом флаге');
  const shopCategories = await game.page.evaluate(async () => {
    const select = async (id) => {
      document.querySelector(`[data-shop-category="${id}"]`)?.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return [...document.querySelectorAll('[data-shop-product]')].map((card) => card.getAttribute('data-shop-product'));
    };
    const weaponCards = await select('weapons');
    const armorCards = await select('armor');
    const gemCards = await select('gems');
    const gemCurrencyIcons = [...document.querySelectorAll('[data-shop-product^="diamonds-"]')].map((card) =>
      Boolean(card.querySelector('.shop-product-footer img[src]')),
    );
    const rewardCards = await select('rewards');
    const allCards = await select('all');
    const hasUnfinishedProducts = allCards.some((id) => id.startsWith('pet-') || id.startsWith('skin-'));
    const hasUnfinishedLabels = [...document.querySelectorAll('[data-shop-product]')].some((card) =>
      /В РАЗРАБОТКЕ|IN DEVELOPMENT|EN DÉVELOPPEMENT|IN ENTWICKLUNG|COMING SOON|СКОРО|BIENTÔT|BALD/i.test(card.textContent ?? ''),
    );
    return {
      categoryCount: document.querySelectorAll('[data-shop-category]').length,
      weaponCards,
      armorCards,
      gemCards,
      gemCurrencyIcons,
      rewardCards,
      hasUnfinishedProducts,
      hasUnfinishedLabels,
    };
  });
  check(shopCategories?.categoryCount === 5, 'Внизу каталога ровно пять категорий');
  check(shopCategories?.weaponCards?.length === 1 && shopCategories.weaponCards[0] === 'netherite-pickaxe', 'Категория оружия содержит новую незеритовую кирку');
  check(shopCategories?.armorCards?.includes('netherite-armor') && !shopCategories.armorCards.includes('diamond-armor'), 'Категория брони показывает комплект незерита вместо старого алмазного');
  check(shopCategories?.gemCards?.includes('diamonds-100') && shopCategories.gemCards.includes('diamonds-599'), 'Категория самоцветов показывает наборы внутриигровой валюты');
  check(
    shopCategories?.gemCurrencyIcons?.length === 2 && shopCategories.gemCurrencyIcons.every(Boolean),
    'У каждого активного real-money набора показана иконка валюты из SDK',
    JSON.stringify(shopCategories?.gemCurrencyIcons),
  );
  check(
    !shopCategories?.gemCards?.includes('diamonds-1599') && !shopCategories?.gemCards?.includes('diamonds-5999'),
    'Наборы, отсутствующие в getCatalog() (неактивные SKU), не показываются в магазине',
    shopCategories?.gemCards?.filter((id) => id.startsWith('diamonds-')).join(', '),
  );
  check(
    shopCategories?.rewardCards?.includes('drop-daily')
      && shopCategories.rewardCards.includes('chest-epic')
      && shopCategories.rewardCards.includes('booster-start')
      && !shopCategories.hasUnfinishedProducts
      && !shopCategories.hasUnfinishedLabels,
    'Категория наград показывает готовые товары, а незавершённые предложения и метки скрыты',
    JSON.stringify(shopCategories),
  );

  // Ordinary-store drops are an ad gate: a shown-but-unrewarded video must leave the claim untouched.
  const dailyAdBefore = game.count(await game.calls(), 'adv.showRewardedVideo');
  await game.page.evaluate(() => { window.__yaMockSeed.rewarded = false; });
  const dailyClickedWithoutReward = await game.page.evaluate(() => {
    const button = document.querySelector('[data-shop-product="drop-daily"] button');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  });
  check(dailyClickedWithoutReward, 'Ежедневный дроп предлагает rewarded-видео');
  const failedDropAd = await game.waitFor(
    'Rewarded-видео ежедневного дропа',
    (before) => (window.__yaCalls ?? []).filter((c) => c.name === 'adv.showRewardedVideo').length > before,
    10_000,
    dailyAdBefore,
  );
  check(failedDropAd, 'Нажатие ежедневного дропа запрашивает rewarded-видео');
  const failedDropSettled = await game.waitFor(
    'Отказ от награды',
    () => /Награда не выдана|No reward was granted|Aucune récompense accordée|Keine Belohnung erhalten/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(failedDropSettled, 'После просмотра без reward-callback игроку сообщают, что награда не выдана');
  const failedDropState = JSON.parse((await game.storageValue('orerush.rewarded-drops.v1')) ?? '{}');
  check(!failedDropState.claims?.['drop-daily'] && Object.keys(failedDropState.pending ?? {}).length === 0, 'Просмотр без награды не отмечает claim и не создаёт припасы');

  await game.page.evaluate(() => { window.__yaMockSeed.rewarded = true; });
  const dailyAdCountBeforeReward = game.count(await game.calls(), 'adv.showRewardedVideo');
  const dailyClickedForReward = await game.page.evaluate(() => {
    const button = document.querySelector('[data-shop-product="drop-daily"] button');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  });
  check(dailyClickedForReward, 'Ежедневный дроп можно повторно запросить после незасчитанного видео');
  const dailyGranted = await game.waitFor(
    'Сохранённые припасы daily-дропа',
    () => {
      const raw = window.localStorage.getItem('orerush.rewarded-drops.v1');
      if (!raw) return false;
      try {
        const state = JSON.parse(raw);
        return typeof state.claims?.['drop-daily'] === 'string'
          && Object.values(state.pending ?? {}).some((grant) => Array.isArray(grant?.items) && grant.items.length === 4);
      } catch {
        return false;
      }
    },
    10_000,
  );
  check(dailyGranted, 'Только подтверждённый rewarded-callback сохраняет daily claim и набор припасов');
  const dailyButtonDisabled = await game.page.evaluate(() =>
    document.querySelector('[data-shop-product="drop-daily"] button')?.disabled === true,
  );
  check(dailyButtonDisabled, 'После успешной выдачи ежедневная кнопка блокируется до нового периода');
  check(game.count(await game.calls(), 'adv.showRewardedVideo') === dailyAdCountBeforeReward + 1, 'Повторный запрос после отказа действительно открыл ещё одно видео');

  await game.page.setViewport({ width: 360, height: 640 });
  await wait(400);
  const shopScroll = await game.page.evaluate(() => {
    const dialog = document.querySelector('.shop-dialog');
    const header = dialog?.querySelector('header');
    const tabs = dialog?.querySelector('.shop-tabs');
    const catalog = dialog?.querySelector('.shop-catalog');
    const carousel = dialog?.querySelector('[data-shop-carousel]');
    if (!dialog || !header || !tabs || !catalog || !carousel) return null;
    const before = { headerTop: header.getBoundingClientRect().top, tabsTop: tabs.getBoundingClientRect().top };
    const carouselRect = carousel.getBoundingClientRect();
    const card = carousel.querySelector('[data-shop-product]');
    const cardRect = card?.getBoundingClientRect();
    const titleRect = card?.querySelector('.shop-product-title')?.getBoundingClientRect();
    const artRect = card?.querySelector('.shop-product-art')?.getBoundingClientRect();
    const canScroll = carousel.scrollWidth > carousel.clientWidth + 2;
    carousel.scrollLeft = Math.min(240, carousel.scrollWidth - carousel.clientWidth);
    const after = { headerTop: header.getBoundingClientRect().top, tabsTop: tabs.getBoundingClientRect().top };
    const result = {
      canScroll,
      moved: carousel.scrollLeft > 0,
      headerFixed: Math.abs(before.headerTop - after.headerTop) < 1,
      tabsFixed: Math.abs(before.tabsTop - after.tabsTop) < 1,
      catalogHeight: catalog.getBoundingClientRect().height,
      carouselHeight: carouselRect.height,
      cardWidth: cardRect?.width ?? 0,
      artBelowTitle: !!titleRect && !!artRect && artRect.top >= titleRect.bottom - 1,
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
    carousel.scrollLeft = 0;
    return result;
  });
  check(!!shopScroll && shopScroll.catalogHeight > 160, 'Каталог магазина получает основную высоту телефона', JSON.stringify(shopScroll));
  check(!!shopScroll && shopScroll.canScroll && shopScroll.moved, 'Карточки магазина пролистываются по горизонтали на телефоне', JSON.stringify(shopScroll));
  check(!!shopScroll && shopScroll.headerFixed && shopScroll.tabsFixed, 'Заголовок и нижние категории остаются закреплены при свайпе карточек', JSON.stringify(shopScroll));
  check(!!shopScroll && shopScroll.pageWidth <= shopScroll.viewportWidth && shopScroll.cardWidth > 240, 'Карточки остаются читаемыми без горизонтального переполнения страницы', JSON.stringify(shopScroll));
  check(!!shopScroll && shopScroll.artBelowTitle, 'Иллюстрация карточки идёт сразу под названием', JSON.stringify(shopScroll));
  const arrowBefore = await game.page.evaluate(() => {
    const carousel = document.querySelector('[data-shop-carousel]');
    const next = document.querySelector('[data-shop-next]');
    return carousel && next
      ? { available: !next.disabled, scrollWidth: carousel.scrollWidth, clientWidth: carousel.clientWidth }
      : null;
  });
  if (arrowBefore?.available) await game.page.click('[data-shop-next]');
  await wait(350);
  const arrowAfter = await game.page.evaluate(() => {
    const carousel = document.querySelector('[data-shop-carousel]');
    if (!carousel) return { moved: false, distance: 0 };
    const distance = carousel.scrollLeft;
    carousel.scrollLeft = 0;
    return { moved: distance > 0, distance };
  });
  check(!!arrowBefore?.available && arrowAfter.moved, 'Боковая стрелка действительно листает карточки каталога', JSON.stringify({ ...arrowBefore, ...arrowAfter }));

  await game.page.setViewport({ width: 844, height: 390 });
  await wait(350);
  const landscapeShop = await game.page.evaluate(() => {
    const dialog = document.querySelector('.shop-dialog');
    const carousel = dialog?.querySelector('[data-shop-carousel]');
    const tabs = dialog?.querySelector('.shop-tabs');
    if (!dialog || !carousel || !tabs) return null;
    const dialogRect = dialog.getBoundingClientRect();
    const carouselRect = carousel.getBoundingClientRect();
    const tabsRect = tabs.getBoundingClientRect();
    const firstCardElement = carousel.querySelector('[data-shop-product]');
    const firstCard = firstCardElement?.getBoundingClientRect();
    const title = firstCardElement?.querySelector('h3')?.getBoundingClientRect();
    const artwork = firstCardElement?.querySelector('.shop-product-art')?.getBoundingClientRect();
    const description = firstCardElement?.querySelector('.shop-product-description')?.getBoundingClientRect();
    const footer = firstCardElement?.querySelector('.shop-product-footer')?.getBoundingClientRect();
    const action = firstCardElement?.querySelector('button')?.getBoundingClientRect();
    const withinCard = (rect) => !!rect && !!firstCard && rect.top >= firstCard.top - 1 && rect.bottom <= firstCard.bottom + 1;
    return {
      dialogFits: dialogRect.top >= -1 && dialogRect.bottom <= innerHeight + 1,
      dialogTop: dialogRect.top,
      dialogBottom: dialogRect.bottom,
      viewportHeight: innerHeight,
      dialogHeight: dialogRect.height,
      carouselHeight: carouselRect.height,
      cardVisible: !!firstCard && firstCard.height <= carouselRect.height + 1 && firstCard.right > carouselRect.left && firstCard.left < carouselRect.right,
      titleVisible: withinCard(title),
      artworkBelowTitle: !!title && !!artwork && artwork.top >= title.bottom - 1,
      descriptionVisible: withinCard(description),
      priceAfterDescription: !!description && !!footer && footer.top >= description.bottom - 1,
      actionVisible: withinCard(action),
      cardBounds: firstCard && [firstCard.top, firstCard.bottom],
      titleBounds: title && [title.top, title.bottom],
      descriptionBounds: description && [description.top, description.bottom],
      actionBounds: action && [action.top, action.bottom],
      tabsVisible: tabsRect.bottom <= dialogRect.bottom + 1 && tabsRect.top >= dialogRect.bottom - 90,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  check(!!landscapeShop && landscapeShop.dialogFits && landscapeShop.tabsVisible, 'Магазин и нижние категории помещаются в горизонтальный экран телефона', JSON.stringify(landscapeShop));
  check(!!landscapeShop && landscapeShop.carouselHeight > 90 && landscapeShop.cardVisible && landscapeShop.titleVisible && landscapeShop.artworkBelowTitle && landscapeShop.descriptionVisible && landscapeShop.priceAfterDescription && landscapeShop.pageWidth <= 844, 'Карточка магазина читаема в альбомной ориентации: название, иллюстрация, описание и цена', JSON.stringify(landscapeShop));
  check(!!landscapeShop && landscapeShop.actionVisible, 'Кнопка карточки не обрезается в альбомной ориентации', JSON.stringify(landscapeShop));

  await game.page.setViewport({ width: 360, height: 640 });
  await wait(250);
  const catalogueText = await game.page.evaluate(() => document.body.innerText ?? '');
  check(catalogueText.includes('99 ₽'), 'В магазине показана цена из каталога Консоли (99 ₽)');
  // the debug panel returns the test currency TST: a hardcoded «₽» would break it (п. 1.13.2)
  check(
    catalogueText.includes('499 TST'),
    'Название и код валюты берутся из каталога, а не зашиты в игру (TST из debug-панели)',
    (catalogueText.match(/499[^\n]{0,12}/) ?? ['цена не найдена'])[0],
  );
  const currencyIcon = await game.page.evaluate(() =>
    [...document.querySelectorAll('img')].some((img) => (img.getAttribute('src') ?? '').startsWith('data:image/gif')),
  );
  check(currencyIcon, 'Иконка портальной валюты взята из каталога (getPriceCurrencyImage)');
  await game.page.setViewport({ width: 1280, height: 720 });
  await wait(250);

  const before = game.count(await game.calls(), 'payments.purchase');
  const buyClicked = await game.page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')].filter((b) => /КУПИТЬ|BUY|ACHETER|KAUFEN/.test(b.textContent ?? ''));
    if (!buttons.length) return false;
    buttons[0].click();
    return true;
  });
  check(buyClicked, 'Кнопка покупки активна');
  const purchased = await game.waitFor(
    'payments.purchase',
    (n) => (window.__yaCalls ?? []).filter((c) => c.name === 'payments.purchase').length > n,
    10_000,
    before,
  );
  check(purchased, 'Клик открыл платёжное окно (payments.purchase)');
  const consumed = await game.waitFor(
    'payments.consumePurchase',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'payments.consumePurchase'),
    10_000,
  );
  check(consumed, 'После начисления алмазов покупка погашена');
  const newBalance = await game.storageValue('orerush.diamonds.v1');
  check(newBalance === '100', 'Алмазы начислены на баланс', `баланс: ${newBalance}`);
  const purchasedProductId = (await game.calls()).find((call) => call.name === 'payments.purchase' && call.arg?.id === 'diamonds-100')?.arg?.id;
  check(purchasedProductId === 'diamonds-100' && newBalance === '100', 'Набор diamonds-100 из карточки начислил именно 100 монет', `${purchasedProductId}: ${newBalance}`);
  const noticeShown = await game.page.evaluate(() => /Покупка совершена|Purchase complete|Achat effectué|Kauf abgeschlossen/.test(document.body.innerText ?? ''));
  check(noticeShown, 'Игрок видит подтверждение покупки');

  const fatal = game.consoleErrors.filter((e) => !/fonts\.googleapis|fonts\.gstatic|ERR_|Failed to load resource/i.test(e));
  check(fatal.length === 0, 'Магазин работает без ошибок в консоли', fatal.slice(0, 3).join(' | '));

  // ===================== desktop shortcut (settings dialog) =====================
  const settingsOpened = await game.clickByText(/^\s*⚙|НАСТРОЙКИ|SETTINGS|PARAMÈTRES|EINSTELLUNGEN/);
  check(settingsOpened, 'Окно настроек открывается');
  const shortcutChecked = await game.waitFor(
    'Проверка ярлыка',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'shortcut.canShowPrompt'),
    15_000,
  );
  check(shortcutChecked, 'Старт игры проверяет возможность добавить ярлык (shortcut.canShowPrompt)');
  const shortcutButton = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /НА РАБОЧИЙ СТОЛ|ADD TO DESKTOP|SUR LE BUREAU|AUF DEN DESKTOP/i.test(b.textContent ?? '')),
  );
  check(shortcutButton, 'В настройках появилась кнопка «добавить ярлык»');
  const balanceBeforeShortcut = Number((await game.storageValue('orerush.diamonds.v1')) ?? 0);
  const shortcutClicked = await game.clickByText(/НА РАБОЧИЙ СТОЛ|ADD TO DESKTOP|SUR LE BUREAU|AUF DEN DESKTOP/);
  check(shortcutClicked, 'Кнопка ярлыка нажата');
  const promptShown = await game.waitFor(
    'Окно ярлыка',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'shortcut.showPrompt'),
    10_000,
  );
  check(promptShown, 'Клик открыл системное окно ярлыка (shortcut.showPrompt)');
  const rewardShown = await game.waitFor(
    'Награда за ярлык',
    () => /ярлык добавлен|Shortcut added|Raccourci ajouté|Verknüpfung erstellt/i.test(document.body.innerText ?? ''),
    10_000,
  );
  check(rewardShown, 'После добавления ярлыка игра сообщает о награде');
  const balanceAfterShortcut = Number((await game.storageValue('orerush.diamonds.v1')) ?? 0);
  check(balanceAfterShortcut === balanceBeforeShortcut + 250, 'Алмазы за ярлык начислены на баланс', `${balanceBeforeShortcut} → ${balanceAfterShortcut}`);
  const shortcutGone = await game.page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /НА РАБОЧИЙ СТОЛ|ADD TO DESKTOP|SUR LE BUREAU|AUF DEN DESKTOP/i.test(b.textContent ?? '')),
  );
  check(shortcutGone === false, 'После добавления ярлыка кнопка исчезает');

  // ===================== browser fullscreen (sdk-params) =====================
  const fullscreenButton = await game.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => /НА ВЕСЬ ЭКРАН|FULLSCREEN|PLEIN ÉCRAN|VOLLBILD$/i.test(b.textContent ?? ''));
    if (!button) return false;
    button.click();
    return true;
  });
  check(fullscreenButton, 'В настройках есть кнопка «На весь экран»');
  const fullscreenOn = await game.waitFor(
    'screen.fullscreen.request',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'screen.fullscreen.request'),
    10_000,
  );
  check(fullscreenOn, 'Клик вызывает ysdk.screen.fullscreen.request()');
  const labelAfter = await game.waitFor(
    'Метка выхода из полного экрана',
    () => [...document.querySelectorAll('button')].some((b) => /ВЫЙТИ ИЗ ПОЛНОГО ЭКРАНА|EXIT FULLSCREEN|QUITTER LE PLEIN ÉCRAN|VOLLBILD VERLASSEN/i.test(b.textContent ?? '')),
    10_000,
  );
  check(labelAfter, 'После включения кнопка предлагает выйти из полного экрана');
  await game.page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => /ВЫЙТИ ИЗ ПОЛНОГО ЭКРАНА|EXIT FULLSCREEN/i.test(b.textContent ?? ''));
    button?.click();
  });
  const fullscreenOff = await game.waitFor(
    'screen.fullscreen.exit',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'screen.fullscreen.exit'),
    10_000,
  );
  check(fullscreenOff, 'Повторный клик вызывает ysdk.screen.fullscreen.exit()');
  await game.clickByText(/^\s*×|ЗАКРЫТЬ|CLOSE|FERMER|SCHLIESSEN/);

  // ===================== co-op survival (asynchronous multiplayer) =====================
  await game.clickByText(/ЗАКРЫТЬ|CLOSE|FERMER|SCHLIESSEN/); // the shop overlay, if it is still open
  const runStarted = await game.clickByText(/НАЧАТЬ ДОБЫЧУ|MINE NOW|CREUSER|ABBAUEN/);
  check(runStarted, 'Смена выживания запускается для проверки кооператива');
  const dailySuppliesDelivered = await game.waitFor(
    'Ежедневные припасы перенесены в активный инвентарь',
    () => {
      const raw = window.localStorage.getItem('orerush.rewarded-drops.v1');
      if (!raw) return false;
      try {
        const state = JSON.parse(raw);
        return Object.keys(state.pending ?? {}).length === 0
          && state.delivered?.some((key) => key.startsWith('drop-daily:'));
      } catch {
        return false;
      }
    },
    10_000,
  );
  check(dailySuppliesDelivered, 'После старта смены дневные припасы подтверждены как добавленные в инвентарь');

  const sessionsLoaded = await game.waitFor(
    'Загрузка сессий оппонентов',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'multiplayer.init'),
    20_000,
  );
  check(sessionsLoaded, 'Старт смены запрашивает сессии оппонентов (multiplayer.init)');
  const initArg = (await game.calls()).find((c) => c.name === 'multiplayer.init')?.arg;
  check(initArg?.count > 0 && !!initArg?.meta?.meta1, 'init() вызван с count > 0 и диапазоном meta1', JSON.stringify(initArg?.meta));
  check(initArg?.isEventBased === true, 'Сессии загружены в событийном режиме (isEventBased: true)', String(initArg?.isEventBased));
  check(
    (await game.calls()).some((c) => c.name === 'ysdk.on' && c.arg === 'multiplayer-sessions-transaction'),
    'Игра подписана на multiplayer-sessions-transaction',
  );

  const squadPanel = await game.waitFor(
    'Панель отряда в HUD',
    () => /ОТРЯД|SQUAD|ÉQUIPE|TRUPP/.test(document.body.innerText ?? ''),
    15_000,
  );
  check(squadPanel, 'Панель отряда появилась в забеге');
  const squadNames = await game.page.evaluate(() => {
    const text = document.body.innerText ?? '';
    return { deep: /DEEP DIGGER/.test(text), cloud: /CLOUD MINER/.test(text) };
  });
  check(squadNames.deep && squadNames.cloud, 'Имена напарников из сессий показаны в панели', JSON.stringify(squadNames));
  const poseCommitted = await game.waitFor(
    // the first pose is committed a couple of seconds into the shift; the wait is generous because a
    // loaded machine can stretch the world generation that precedes it
    'Запись позы в сессию',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'multiplayer.commit'),
    60_000,
  );
  check(poseCommitted, 'Поза игрока записывается транзакциями (multiplayer.commit)');

  // the SDK replays an opponent: the panel must pick up the recorded counters
  await game.page.evaluate(() =>
    (window.__yaEmit?.['multiplayer-sessions-transaction'] ?? []).forEach((fn) =>
      fn({
        opponentId: 'opp-2',
        transactions: [{ payload: { x: 34, y: 21, z: 29, yaw: 1.2, health: 44, blocks: 42 }, time: 1000 }],
      }),
    ),
  );
  const blocksShown = await game.waitFor(
    'Счётчики напарника обновились',
    () => /42 (БЛК|BLK)/.test(document.body.innerText ?? ''),
    15_000,
  );
  check(blocksShown, 'Транзакция соперника дошла до панели отряда (блоки 42)');
  await game.page.evaluate(() =>
    (window.__yaEmit?.['multiplayer-sessions-finish'] ?? []).forEach((fn) => fn('opp-1')),
  );
  const finishShown = await game.waitFor(
    'Отметка о финише соперника',
    () => /ФИНИШ|FINISHED|TERMINÉ|FERTIG/.test(document.body.innerText ?? ''),
    15_000,
  );
  check(finishShown, 'Событие multiplayer-sessions-finish отмечает напарника в панели');

  const coopErrors = game.consoleErrors.filter((e) => !/fonts\.googleapis|fonts\.gstatic|ERR_|Failed to load resource/i.test(e));
  check(coopErrors.length === 0, 'Кооператив работает без ошибок в консоли', coopErrors.slice(0, 2).join(' | '));

  await game.page.close();

  // Requirement 1.13.6: an empty Console catalogue means there are no active in-app purchase offers.
  const emptyCatalog = await openGame({ lang: 'ru', name: 'EMPTY CATALOG', catalog: [] });
  const emptyCatalogMenu = await emptyCatalog.waitFor(
    'Меню с пустым каталогом',
    () => /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|ЕЩЁ РАЗ|MINE NOW|НАЧАТЬ/i.test(document.body.innerText ?? ''),
    30_000,
  );
  check(emptyCatalogMenu, 'Игра запускается с пустым каталогом покупок');
  const emptyCatalogLoaded = await emptyCatalog.waitFor(
    'Пустой каталог getCatalog()',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'payments.getCatalog'),
    15_000,
  );
  check(emptyCatalogLoaded, 'Каталог покупок запрошен даже когда в Консоли нет активных товаров');
  const noAdFreeOffer = await emptyCatalog.page.evaluate(() => !document.querySelector('[data-ad-free-purchase]'));
  check(noAdFreeOffer, 'Без активного disable_ads кнопка отключения рекламы не показывается');
  const emptyShopOpened = await emptyCatalog.clickByText(/МАГАЗИН|SHOP|BOUTIQUE/);
  check(emptyShopOpened, 'Магазин открывается при пустом каталоге');
  const noInactiveOffers = await emptyCatalog.waitFor(
    'Отсутствие неактивных предложений',
    () => {
      const dialog = document.querySelector('.shop-dialog');
      return !!dialog && ![...dialog.querySelectorAll('[data-shop-product]')].some((card) =>
        (card.getAttribute('data-shop-product') ?? '').startsWith('diamonds-'),
      );
    },
    10_000,
  );
  check(noInactiveOffers, 'При пустом каталоге в игре отсутствуют предложения real-money coin packs');
  await emptyCatalog.page.close();
}

/* ------------------------ scenario C: promo deep links ------------------------ */

/**
 * `?referrer=promo&promo_id=…&promo_intent=…&inapp_id=…` from a catalogue banner.
 * The game must land the player on the promised screen: an `inapp_id` promo opens the shop on that
 * purchase, an `intent` promo opens the screen named by the campaign, and anything unknown (a plain
 * seasonal banner) keeps the normal flow.
 */
async function scenarioPromo() {
  // --- 1. discount promo: a specific purchase is promised -------------------------------
  const discount = await openGame({
    lang: 'ru',
    referrer: { type: 'promo', promoId: 'SPRING_DISCOUNT', intent: 'open_starter_pack', inappId: 'diamonds-599' },
  });
  const shopByPromo = await discount.waitFor(
    'Магазин по акции',
    () => /ПО АКЦИИ/.test(document.body.innerText ?? ''),
    30_000,
  );
  check(shopByPromo, 'Ссылка ?referrer=promo сразу открывает обещанный экран (магазин)');
  const promoBanner = await discount.page.evaluate(() =>
    /Акция · SPRING_DISCOUNT/.test(document.body.innerText ?? ''),
  );
  check(promoBanner, 'Игрок видит, по какой акции он пришёл');
  const flagFeatures = (await discount.calls()).find((c) => c.name === 'ysdk.getFlags')?.arg?.features ?? [];
  check(flagFeatures.includes('promoId'), 'ID акции уходит в remote-конфиг как clientFeature', flagFeatures.join(','));
  const highlighted = await discount.page.evaluate(() => {
    const badge = [...document.querySelectorAll('span')].find((s) => /ПО АКЦИИ/.test(s.textContent ?? ''));
    const card = badge?.closest('article');
    return !!card && /Кошель шахтёра/.test(card.textContent ?? '');
  });
  check(highlighted, 'Подсвечен именно товар из ссылки акции (inapp_id: diamonds-599)');
  await discount.page.close();

  // --- 2. screen promo: only an intent is named -----------------------------------------
  const byIntent = await openGame({
    lang: 'ru',
    referrer: { type: 'promo', promoId: 'VIP_PROMO', intent: 'open_shop' },
  });
  const shopByIntent = await byIntent.waitFor(
    'Магазин по intent',
    () => /Акция · VIP_PROMO/.test(document.body.innerText ?? ''),
    30_000,
  );
  check(shopByIntent, 'Акция с promo_intent=open_shop открывает магазин без подсветки товара');
  const nothingHighlighted = await byIntent.page.evaluate(() => !/ПО АКЦИИ/.test(document.body.innerText ?? ''));
  check(nothingHighlighted, 'Без inapp_id ни один товар не помечен как акционный');
  await byIntent.page.close();

  // --- 3. plain campaign: the game must not hijack the start ---------------------------
  const plain = await openGame({ lang: 'ru', referrer: { type: 'promo', promoId: 'SALE_SPRING_2026' } });
  const menu = await plain.waitFor(
    'Меню по обычной акции',
    () => /НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(document.body.innerText ?? ''),
    30_000,
  );
  check(menu, 'Акция без понятного сценария оставляет игрока в обычном меню');
  const shopClosed = await plain.page.evaluate(() => !/Акция ·/.test(document.body.innerText ?? ''));
  check(shopClosed, 'Магазин по такой акции сам не открывается');
  await plain.page.close();
}

/* ---------------------- scenario D: daily reward (server time) ---------------------- */

/**
 * The daily bonus is counted by `ysdk.serverTime()`, not by the device clock, and its date lives in
 * the cloud profile. A failed rewarded-video callback pays nothing; a successful view pays one or two
 * diamonds, records the date to cloud, and locks the button until UTC midnight. Day two on another
 * device sees yesterday's claim and offers the streak-adjusted two-diamond bonus.
 */
async function scenarioDaily() {
  const DAY_MS = 86_400_000;
  const first = await openGame({ lang: 'ru', serverTimeOffsetMs: DAY_MS });
  const bonusButton = await first.waitFor(
    'Кнопка ежедневного бонуса',
    () => {
      const button = document.querySelector('[data-daily-bonus]');
      return !!button && /ЕЖЕДНЕВНЫЙ БОНУС/.test(button.textContent ?? '') && !button.disabled;
    },
    30_000,
  );
  check(bonusButton, 'В меню есть активная кнопка ежедневного бонуса');
  const before = await first.storageValue('orerush.diamonds.v1');
  check(before === null || before === '0', 'До первого бонуса алмазов нет', String(before));

  const today = await first.page.evaluate(() =>
    new Date(Date.now() + (window.__yaMockSeed.serverTimeOffsetMs ?? 0)).toISOString().slice(0, 10),
  );
  const adCallsBefore = first.count(await first.calls(), 'adv.showRewardedVideo');
  await first.page.evaluate(() => { window.__yaMockSeed.rewarded = false; });
  const failedClick = await first.clickByText(/ЕЖЕДНЕВНЫЙ БОНУС/);
  check(failedClick, 'Ежедневный бонус требует просмотра rewarded-видео');
  const failedVideoShown = await first.waitFor(
    'Запрос неуспешного rewarded-видео',
    () => (window.__yaCalls ?? []).filter((call) => call.name === 'adv.showRewardedVideo').length > 0,
    10_000,
  );
  check(failedVideoShown, 'Кнопка бонуса вызывает рекламный SDK');
  const noReward = await first.waitFor(
    'Неуспешный просмотр не меняет прогресс',
    () => !window.localStorage.getItem('orerush.daily.v1')
      && (!window.localStorage.getItem('orerush.diamonds.v1') || window.localStorage.getItem('orerush.diamonds.v1') === '0')
      && !document.querySelector('[data-daily-bonus]')?.disabled,
    10_000,
  );
  check(noReward, 'Без rewarded-callback дата и алмазы не начисляются');
  check(first.count(await first.calls(), 'adv.showRewardedVideo') === adCallsBefore + 1, 'Неуспешная попытка действительно открыла рекламное видео');

  await first.page.evaluate(() => { window.__yaMockSeed.rewarded = true; });
  const rewardedCallsBefore = first.count(await first.calls(), 'adv.showRewardedVideo');
  const claimed = await first.page.evaluate(() => {
    const button = document.querySelector('[data-daily-bonus]');
    button?.click();
    return Boolean(button && !button.disabled);
  });
  check(claimed, 'После отказа бонус можно запросить повторно');
  const stored = await first.waitFor(
    'Запись о бонусе',
    (d) => {
      const raw = window.localStorage.getItem('orerush.daily.v1');
      if (!raw) return false;
      try {
        return JSON.parse(raw).last === d;
      } catch {
        return false;
      }
    },
    10_000,
    today,
  );
  check(stored, 'Дата бонуса (UTC) записана только после rewarded-callback', today);
  const balance = await first.storageValue('orerush.diamonds.v1');
  check(balance === '1', 'Первый ежедневный бонус начислил 1 алмаз', String(balance));
  const claimedLabel = await first.page.evaluate(() => {
    const button = document.querySelector('[data-daily-bonus]');
    return !!button && button.disabled && /СЛЕДУЮЩИЙ БОНУС/.test(button.textContent ?? '');
  });
  check(claimedLabel, 'После выдачи кнопка серая, отключена и показывает таймер до следующего дня');
  await first.clickByText(/ЕЖЕДНЕВНЫЙ БОНУС/);
  await wait(400);
  const again = await first.storageValue('orerush.diamonds.v1');
  check(again === '1', 'Повторный клик в тот же день не начисляет алмазы второй раз', String(again));
  check(first.count(await first.calls(), 'adv.showRewardedVideo') === rewardedCallsBefore + 1, 'Успешная повторная попытка вызвала ровно одно видео');
  const cloudRecord = await first.waitFor(
    'Бонус в облаке',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData' && c.arg?.daily?.last),
    15_000,
  );
  check(cloudRecord, 'Дата бонуса уходит в облачный профиль (player.setData)');
  await first.page.close();

  // the next server day on another device: the browser clock is untouched, the platform clock moved
  const nextDay = await openGame({
    lang: 'ru',
    serverTimeOffsetMs: 2 * DAY_MS,
    data: {
      'orerush.profile': { v: 1, savedAt: Date.now() + 60_000, daily: { last: today, streak: 1 } },
    },
  });
  const grown = await nextDay.waitFor(
    'Бонус второго дня',
    () => {
      const button = document.querySelector('[data-daily-bonus]');
      return !!button && /\+2\s+монет незерита/.test(button.textContent ?? '') && /серия 2/.test(button.textContent ?? '');
    },
    30_000,
  );
  check(grown, 'На следующий день бонус вырос до 2 незеритовых монет за серию 2 (по серверному времени)');
  const notClaimedYet = await nextDay.page.evaluate(() => {
    const button = document.querySelector('[data-daily-bonus]');
    return !!button && !button.disabled;
  });
  check(notClaimedYet, 'Бонус нового дня ещё не отмечен как полученный');
  await nextDay.page.close();
}

/* ---------------------- scenario E: deviceInfo (touch controls) ---------------------- */

/**
 * sdk-params: the touch controls appear because `deviceInfo` says `mobile`, not because of a guess,
 * and stay away on a device the platform calls a desktop.
 */
async function scenarioDevice() {
  const mobile = await openGame({ lang: 'ru', deviceType: 'mobile', flags: { 'game.exploreMinutes': '0.25' } });
  const menu = await mobile.waitFor('Меню на мобильном', () => /НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(document.body.innerText ?? ''), 30_000);
  check(menu, 'Игра запускается на устройстве, которое платформа называет мобильным');
  const starts = await mobile.clickByText(/НАЧАТЬ ДОБЫЧУ|MINE NOW/);
  check(starts, 'Смена запускается и на мобильном устройстве');
  const touchControls = await mobile.waitFor(
    'Сенсорные элементы управления',
    () => !!document.querySelector('.touch-left') && !!document.querySelector('.touch-right'),
    30_000,
  );
  check(touchControls, 'deviceInfo=mobile включает сенсорное управление');
  const deviceQueried = (await mobile.calls()).some((c) => c.name === 'deviceInfo.type' || c.name === 'deviceInfo.isMobile');
  check(deviceQueried, 'Игра спросила тип устройства у платформы (deviceInfo)');

  // Requirement 1.9 also covers the device rotation: the shift on screen must survive it
  const canvasOf = () =>
    mobile.page.evaluate(() => {
      const el = document.querySelector('canvas');
      return el
        ? { w: el.clientWidth, h: el.clientHeight, attrW: el.width, attrH: el.height, dpr: window.devicePixelRatio || 1, win: [window.innerWidth, window.innerHeight], text: document.body.innerText ?? '' }
        : null;
    });
  const beforeRotate = await canvasOf();
  await mobile.page.setViewport({ width: 740, height: 360 }); // a rotation is a resize, not a reload
  // the engine redraws on `resize`: wait for the canvas to actually take the new width
  const resized = await mobile.waitFor(
    'canvas под новый размер',
    (target) => {
      const el = document.querySelector('canvas');
      return !!el && Math.abs(el.width - target * (window.devicePixelRatio || 1)) <= 1;
    },
    10_000,
    740,
  );
  const afterRotate = await canvasOf();
  check(
    resized && !!afterRotate && Math.abs(afterRotate.attrW - Math.round(afterRotate.w * afterRotate.dpr)) <= 1,
    'Поворот экрана перестраивает canvas под новую ширину',
    JSON.stringify({ beforeRotate, afterRotate }),
  );
  check(!!afterRotate && !!beforeRotate && afterRotate.attrW < beforeRotate.attrW, 'После поворота картинка стала под новое, более узкое окно', `${beforeRotate?.attrW} → ${afterRotate?.attrW}`);
  const stillInRun = /ПАУЗА|PAUSED|ПРОДОЛЖИТЬ|RESUME/.test(afterRotate.text) || !/НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(afterRotate.text);
  check(stillInRun, 'После поворота экрана смена не сбрасывается в меню');
  const touchAfterRotate = await mobile.page.evaluate(() => ({
    left: !!document.querySelector('.touch-left'),
    right: !!document.querySelector('.touch-right'),
    text: (document.body.innerText ?? '').slice(0, 120),
  }));
  check(
    touchAfterRotate.left && touchAfterRotate.right,
    'После поворота экрана сенсорное управление осталось на месте',
    JSON.stringify(touchAfterRotate),
  );
  await mobile.page.setViewport({ width: 360, height: 740 });
  await wait(400);

  await mobile.page.close();

  const desktop = await openGame({ lang: 'ru', deviceType: 'desktop', flags: { 'game.exploreMinutes': '0.25' } });
  await desktop.waitFor('Меню на компьютере', () => /НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(document.body.innerText ?? ''), 30_000);
  await desktop.clickByText(/НАЧАТЬ ДОБЫЧУ|MINE NOW/);
  const noTouch = await desktop.waitFor(
    'Сенсорных элементов нет',
    () => !document.querySelector('.touch-left'),
    30_000,
  );
  check(noTouch, 'На устройстве desktop сенсорные элементы не показываются');
  await desktop.page.close();
}

/* ------------------------- scenario G: TV adaptation (1.6.3) ------------------------- */

/**
 * Requirement 1.6.3: on a TV the remote alone must be enough. The platform reports the device as
 * `deviceInfo.type === 'tv'`, which switches the game into the TV layout: the shop disappears and the
 * payment object is never requested (TV games must not sell anything), the arrows move a visible focus
 * through the menu and OK activates the focused item, while Back pauses the run on the first press and
 * offers to leave on the second.
 */
async function scenarioTv() {
  const menu = await openGame({ lang: 'ru', deviceType: 'tv', flags: { 'game.exploreMinutes': '0.25' } });
  const ready = await menu.waitFor('Меню на ТВ', () => /НАЧАТЬ ДОБЫЧУ/.test(document.body.innerText ?? ''), 30_000);
  check(ready, 'Игра запускается, когда платформа называет устройство телевизором (deviceInfo.type = tv)');

  const shopHidden = await menu.page.evaluate(() => !/МАГАЗИН/.test(document.body.innerText ?? ''));
  check(shopHidden, 'На ТВ кнопки магазина нет — инап-покупки запрещены');
  const paymentsAsked = (await menu.calls()).some((c) => c.name === 'ysdk.getPayments');
  check(!paymentsAsked, 'На ТВ игра не запрашивает платёжный объект у платформы');

  // arrows paint a visible focus, OK presses the focused item
  await menu.page.evaluate(() => {
    window.__clicks = [];
    document.addEventListener('click', (event) => window.__clicks.push(event.target?.textContent ?? ''), true);
  });
  await menu.page.keyboard.press('ArrowDown');
  const ringShown = await menu.waitFor('Подсветка фокуса', () => !!document.querySelector('.remote-focus'), 5_000);
  check(ringShown, 'Стрелка пульта ставит подсветку на элемент меню');
  const focusedBefore = await menu.page.evaluate(() => document.activeElement?.textContent ?? '');
  await menu.page.keyboard.press('ArrowRight');
  const focusedAfter = await menu.page.evaluate(() => document.activeElement?.textContent ?? '');
  const stillPainted = await menu.page.evaluate(() => document.activeElement?.classList.contains('remote-focus') ?? false);
  check(stillPainted && focusedBefore !== focusedAfter, 'Стрелка переводит фокус на соседний элемент', `${focusedBefore} → ${focusedAfter}`);
  await menu.page.keyboard.press('Enter');
  const clicked = await menu.waitFor('OK нажал элемент', () => (window.__clicks ?? []).length > 0, 5_000);
  check(clicked, 'OK на пульте нажимает выбранный элемент меню');
  await menu.page.close();

  // Back: the first press pauses the run, the second offers to leave
  const run = await openGame({ lang: 'ru', deviceType: 'tv', flags: { 'game.exploreMinutes': '0.25' } });
  await run.waitFor('Меню на ТВ перед сменой', () => /НАЧАТЬ ДОБЫЧУ/.test(document.body.innerText ?? ''), 30_000);
  await run.clickByText(/НАЧАТЬ ДОБЫЧУ/);
  const playing = await run.waitFor('Смена началась', () => !/НАЧАТЬ ДОБЫЧУ/.test(document.body.innerText ?? ''), 30_000);
  check(playing, 'Смена запускается на ТВ');
  await run.page.evaluate(() => (window.__yaEmit?.HISTORY_BACK ?? []).forEach((fn) => fn()));
  const paused = await run.waitFor('Пауза по Back', () => /ПАУЗА/.test(document.body.innerText ?? ''), 10_000);
  check(paused, 'Одиночное нажатие Back ставит паузу и открывает игровое меню');
  await run.page.evaluate(() => (window.__yaEmit?.HISTORY_BACK ?? []).forEach((fn) => fn()));
  const exitPrompt = await run.waitFor('Окно выхода', () => /ВЫЙТИ ИЗ ИГРЫ/.test(document.body.innerText ?? ''), 10_000);
  check(exitPrompt, 'Второе нажатие Back предлагает выйти из игры');
  const dialogState = await run.page.evaluate(() => {
    const dialog = document.querySelector('[aria-modal="true"]');
    const focused = document.activeElement;
    return {
      modal: Boolean(dialog),
      inside: Boolean(dialog && focused && dialog.contains(focused)),
      label: focused?.textContent ?? '',
    };
  });
  check(dialogState.modal, 'Окно выхода на ТВ — модальный диалог: пульт ходит только по нему');
  check(dialogState.inside && /ОСТАТЬСЯ/.test(dialogState.label), 'Фокус пульта сразу на безопасной кнопке «Остаться»', dialogState.label);
  await run.page.keyboard.press('Enter');
  const dismissed = await run.waitFor('Окно закрылось', () => !/ВЫЙТИ ИЗ ИГРЫ/.test(document.body.innerText ?? ''), 5_000);
  check(dismissed, 'OK на пульте выбирает «Остаться» и не выходит из игры');
  const exited = (await run.calls()).some((c) => c.name === 'ysdk.dispatchEvent' && c.arg === 'EXIT');
  check(!exited, 'Без явного подтверждения платформе не отправляется выход');
  await run.page.close();
}

/* ---------------- scenario H: the built world is autosaved (requirement 1.9) ---------------- */

/**
 * A sandbox world has a save button, and requirement 1.9 additionally wants the progress to survive a
 * refresh. The world is local-only (it is far larger than the cloud budget), so the game writes it one
 * last time when the page is being hidden — this scenario builds something, hides the tab without
 * pressing the button and checks that the snapshot appeared.
 */
async function scenarioWorldAutosave() {
  const game = await openGame({ lang: 'ru', name: 'BUILDER', flags: { 'game.exploreMinutes': '0.25' } });
  await game.waitFor('Меню песочницы', () => /НАЧАТЬ ДОБЫЧУ|MINE NOW/.test(document.body.innerText ?? ''), 30_000);
  const clicked = await game.clickByText(/СОЗДАТЬ МИР|CREATE WORLD|CRÉER UN MONDE|ERSTELLEN/i);
  check(clicked, 'Кнопка создания своего мира найдена');
  const inRun = await game.waitFor('Мир открылся', () => !!document.querySelector('canvas'), 30_000);
  check(inRun, 'Свой мир запускается');
  await wait(1500);
  check((await game.storageValue('orerush.myworld.v1')) === null, 'До действия игрока автосохранения ещё нет');

  await game.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const autosaved = await game.waitFor(
    'Мир сохранён при уходе со страницы',
    () => (window.localStorage.getItem('orerush.myworld.v1') ?? '').length > 100,
    15_000,
  );
  check(autosaved, 'Мир сохраняется сам, когда страницу сворачивают или обновляют (пункт 1.9)');
  const silent = await game.page.evaluate(() => !/МИР СОХРАНЁН|WORLD SAVED/i.test(document.body.innerText ?? ''));
  check(silent, 'Автосохранение не мешает игроку баннером');
  await game.page.close();
}

/* ---------------- scenario I: correct display at any window size (requirement 1.10) ---------------- */

/** The sizes moderation uses: phones in both orientations, laptops, a big desktop and a TV. */
const LAYOUT_VIEWPORTS = [
  { name: 'телефон 360×740', width: 360, height: 740 },
  { name: 'телефон 740×360 (альбомная)', width: 740, height: 360 },
  { name: 'узкое окно 1093×614 (−20%)', width: 1093, height: 614 },
  { name: 'ноутбук 1366×768', width: 1366, height: 768 },
  { name: 'монитор 1280×1024', width: 1280, height: 1024 },
  { name: 'телевизор 1920×1080', width: 1920, height: 1080 },
];

/**
 * Measure the page: which interactive elements are cut by the viewport, which ones overlap each other
 * beyond the allowed share, whether the document itself scrolls, and whether a plain swipe is blocked
 * (that is the guard against pull-to-refresh, which `overscroll-behavior` alone does not stop on iOS).
 */
async function layoutReport(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const doc = document.documentElement;
    const boxes = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 2 && rect.height > 2 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().replace(/\s+/g, ' ').slice(0, 20);
        return { label: label || el.tagName.toLowerCase(), x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      });

    const cut = boxes
      .filter((b) => b.x < -1 || b.y < -1 || b.x + b.w > vw + 1 || b.y + b.h > vh + 1)
      .map((b) => `${b.label}@${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}`);

    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (w <= 0 || h <= 0) continue;
        const ratio = (w * h) / Math.min(a.w * a.h, b.w * b.h);
        if (ratio > 0.35) overlaps.push(`${a.label} × ${b.label} = ${Math.round(ratio * 100)}%`);
      }
    }

    const hudControlOverlaps = [];
    const hudInfo = [...document.querySelectorAll(
      '.hud-information--top-left, .hud-information--top-center, .hud-information--top-right, .hud-information--center, .hud-information--hint',
    )];
    const touchControls = [...document.querySelectorAll('.touch-left, .touch-right')];
    for (const info of hudInfo) {
      const a = info.getBoundingClientRect();
      for (const control of touchControls) {
        const b = control.getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) hudControlOverlaps.push(`${info.className} × ${control.className}`);
      }
    }

    const hudHotbarOverlaps = [];
    const hotbarControlOverlaps = [];
    const hotbar = document.querySelector('.hud-hotbar');
    const hotbarStyle = hotbar ? (() => {
      const style = getComputedStyle(hotbar);
      const rowStyle = getComputedStyle(hotbar.querySelector('.hotbar-row'));
      return { touchClass: !!hotbar.closest('.hud-touch'), orientation: matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape', left: style.left, right: style.right, top: style.top, bottom: style.bottom, width: style.width, transform: style.transform, translate: style.translate, rowWidth: rowStyle.width, rowTransform: rowStyle.transform };
    })() : null;
    const hotbarSlots = hotbar ? [...hotbar.querySelectorAll('[data-hotbar-index]')].map((el) => {
      const rect = el.getBoundingClientRect();
      return { index: Number(el.getAttribute('data-hotbar-index')), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    }) : [];
    if (hotbar) {
      const a = hotbar.getBoundingClientRect();
      for (const control of document.querySelectorAll('.touch-left, .touch-right')) {
        const b = control.getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) hotbarControlOverlaps.push(`${hotbar.className} × ${control.className}`);
      }
    }
    const breathPanel = document.querySelector('.hud-breath');
    const breathBubbles = breathPanel?.lastElementChild;
    const breathRect = breathBubbles?.getBoundingClientRect();
    const breathPanelRect = breathPanel?.getBoundingClientRect();
    const breathCenterOffset = breathRect ? (breathRect.left + breathRect.right) * 0.5 - vw * 0.5 : null;
    let breathHotbarOverlap = null;
    if (breathPanelRect && hotbar) {
      const hotbarRect = hotbar.getBoundingClientRect();
      const overlapWidth = Math.min(breathPanelRect.right, hotbarRect.right) - Math.max(breathPanelRect.left, hotbarRect.left);
      const overlapHeight = Math.min(breathPanelRect.bottom, hotbarRect.bottom) - Math.max(breathPanelRect.top, hotbarRect.top);
      if (overlapWidth > 1 && overlapHeight > 1) breathHotbarOverlap = `${Math.round(overlapWidth)}×${Math.round(overlapHeight)} px`;
    }

    const topLeftInfo = document.querySelector('.hud-information--top-left');
    if (hotbar && topLeftInfo) {
      const a = topLeftInfo.getBoundingClientRect();
      const b = hotbar.getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 1 && h > 1) hudHotbarOverlaps.push(`${topLeftInfo.className} × ${hotbar.className}`);
    }

    let swipeBlocked = null;
    try {
      const target = document.querySelector('button') ?? document.body;
      const touch = new Touch({ identifier: 1, target, clientX: 20, clientY: 20 });
      const event = new TouchEvent('touchmove', { touches: [touch], changedTouches: [touch], cancelable: true, bubbles: true });
      target.dispatchEvent(event);
      swipeBlocked = event.defaultPrevented;
    } catch {
      swipeBlocked = null; // the browser does not expose the Touch constructor here
    }

    const fit = document.querySelector('[data-fit-inner]');
    const fitOuter = document.querySelector('[data-fit-outer]');

    return {
      viewport: [vw, vh],
      fit: fit ? { natural: fit.scrollHeight, scale: Number(fitOuter?.getAttribute('data-fit-scale') ?? 1), box: fitOuter?.clientHeight ?? 0 } : null,
      scroll: [Math.max(0, doc.scrollWidth - vw), Math.max(0, doc.scrollHeight - vh)],
      overscroll: getComputedStyle(doc).overscrollBehavior,
      boxes: boxes.length,
      cut,
      overlaps,
      hudControlOverlaps,
      hudHotbarOverlaps,
      hotbarControlOverlaps,
      hotbarSlots,
      hotbarStyle,
      breathCenterOffset,
      breathHotbarOverlap,
      swipeBlocked,
    };
  });
}

/**
 * Requirement 1.10: the game is resized along both axes, and at every size nothing important may be
 * cut off or overlapped, the page must not gain a scrollbar, and a swipe must not refresh it. The menu
 * is measured at every size; the in-run HUD — at the two smallest ones, where space is tightest.
 */
async function scenarioLayout() {
  const game = await openGame({ lang: 'ru', deviceType: 'mobile', flags: { 'game.exploreMinutes': '2' } });
  const menu = await game.waitFor('Меню для проверки вёрстки', () => /НАЧАТЬ ДОБЫЧУ/.test(document.body.innerText ?? ''), 30_000);
  check(menu, 'Игра открылась для проверки вёрстки');
  check(!await game.page.$('[data-developer-shop="1"]'), 'В production-сборке временная кнопка dev-магазина скрыта');

  const characterButton = await game.page.$('[data-character-creator="1"]');
  check(Boolean(characterButton), 'В главном меню есть отдельный конструктор персонажа');
  const creatorOpened = await game.page.evaluate(() => {
    const button = document.querySelector('[data-character-creator="1"]');
    button?.click();
    return Boolean(button);
  });
  const creatorVisible = await game.waitFor('Окно конструктора персонажа', () => !!document.querySelector('[role="dialog"] #character-title'), 5_000);
  check(creatorOpened && creatorVisible, 'Конструктор открывается из главного меню');
  const creatorVariants = await game.page.evaluate(async () => {
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="character-title"]');
    if (!dialog) return null;
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
    [...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('ДЕВОЧКА'))?.click();
    await nextFrame();
    [...dialog.querySelectorAll('button')].find((button) => button.textContent?.includes('СЗАДИ'))?.click();
    await nextFrame();
    const preview = dialog.querySelector('[data-character-preview-view]');
    return {
      hairstyles: dialog.querySelectorAll('[data-character-hairstyle]').length,
      expressions: dialog.querySelectorAll('[data-character-expression]').length,
      glasses: dialog.querySelectorAll('[data-character-glasses]').length,
      view: preview?.getAttribute('data-character-preview-view'),
      skirt: preview?.getAttribute('data-character-preview-skirt'),
    };
  });
  check(!!creatorVariants && creatorVariants.hairstyles >= 9 && creatorVariants.expressions >= 9 && creatorVariants.glasses === 4, 'Конструктор предлагает много стрижек, текстурных лиц и очков', JSON.stringify(creatorVariants));
  check(creatorVariants?.view === 'back' && creatorVariants.skirt === 'true', 'Задний ракурс девочки показывает отдельный силуэт юбки', JSON.stringify(creatorVariants));
  const selectionsApplied = await game.page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="character-title"]');
    if (!dialog) return false;
    const clickText = (text) => {
      const button = [...dialog.querySelectorAll('button')].find((item) => (item.textContent ?? '').includes(text));
      button?.click();
      return Boolean(button);
    };
    const clickColor = (label) => {
      const button = [...dialog.querySelectorAll('button')].find((item) => item.getAttribute('aria-label') === label);
      button?.click();
      return Boolean(button);
    };
    return clickText('ДЕВОЧКА') && clickText('ДЛИННАЯ') && clickText('САНДАЛИИ') && clickText('КРУГЛЫЕ') &&
      clickColor('ЦВЕТ ФУТБОЛКИ: #e2564a') && clickColor('ЦВЕТ ВОЛОС: #b83f35') && clickColor('ЦВЕТ КОЖИ: #8d563d') &&
      clickColor('Подмигивание');
  });
  check(selectionsApplied, 'Конструктор позволяет выбрать пол, причёску, обувь, цвета и эмоцию');
  const characterSaved = await game.page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="character-title"]');
    const save = [...(dialog?.querySelectorAll('button') ?? [])].find((item) => /СОХРАНИТЬ ОБЛИК/.test(item.textContent ?? ''));
    save?.click();
    const raw = localStorage.getItem('orerush.character.v1');
    if (!raw) return false;
    const character = JSON.parse(raw);
    return character.gender === 'girl' && character.hairstyle === 'long' && character.shoeType === 'sandals' &&
      character.shirtColor === '#e2564a' && character.hairColor === '#b83f35' && character.skinColor === '#8d563d' &&
      character.expression === 'wink' && character.glasses === 'round';
  });
  check(characterSaved, 'Выбранный облик сохраняется в локальном профиле');
  const profileWrite = await game.waitFor(
    'Облачное сохранение персонажа',
    () => (window.__yaCalls ?? []).some((call) =>
      call.name === 'player.setData' && call.arg?.character?.gender === 'girl' &&
      call.arg?.character?.hairstyle === 'long' && call.arg?.character?.shoeType === 'sandals' &&
      call.arg?.character?.hairColor === '#b83f35' && call.arg?.character?.glasses === 'round',
    ),
    15_000,
  );
  check(profileWrite, 'Выбранные настройки персонажа доходят до облачного профиля игрока');
  const savedGenderShown = await game.page.evaluate(() => /ДЕВОЧКА/.test(document.querySelector('[data-character-creator="1"]')?.textContent ?? ''));
  check(savedGenderShown, 'Главное меню отражает выбранного персонажа после сохранения');

  let swipeChecked = false;
  for (const vp of LAYOUT_VIEWPORTS) {
    await game.page.setViewport({ width: vp.width, height: vp.height });
    await wait(400);
    if (process.env.SDK_CHECK_DEBUG) {
      await game.page.evaluate(() => {
        window.__layoutDebug = true;
      });
      const sections = await game.page.evaluate(() => {
        const report = {};
        const main = document.querySelector('main');
        const aside = document.querySelector('aside');
        report.main = main ? Math.round(main.getBoundingClientRect().height) : 0;
        report.aside = aside ? Math.round(aside.getBoundingClientRect().height) : 0;
        report.mainParts = main ? [...main.children].map((el) => `${(el.className || el.tagName).toString().split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`) : [];
        report.asideParts = aside ? [...aside.children].map((el) => `${(el.className || el.tagName).toString().split(' ')[0]}:${Math.round(el.getBoundingClientRect().height)}`) : [];
        return report;
      });
      console.log(`[layout] ${vp.name}`, JSON.stringify(sections));
    }
    const report = await layoutReport(game.page);
    check(report.boxes > 0, `Меню: элементы управления найдены (${vp.name})`, String(report.boxes));
    check(
      report.cut.length === 0,
      `Меню: важные элементы не обрезаны (${vp.name})`,
      `${report.cut.slice(0, 3).join(' | ')} || fit ${JSON.stringify(report.fit)}`,
    );
    check(report.overlaps.length === 0, `Меню: элементы не накладываются друг на друга (${vp.name})`, report.overlaps.slice(0, 4).join(' | '));
    check(report.scroll[0] <= 1 && report.scroll[1] <= 1, `Меню: у страницы нет системной прокрутки (${vp.name})`, `scroll ${report.scroll.join('×')}`);
    check(report.overscroll === 'none', `Меню: свайп-обновление выключено в CSS (${vp.name})`, report.overscroll);
    if (report.swipeBlocked !== null && !swipeChecked) {
      check(report.swipeBlocked === true, 'Свайп вниз по экрану не перезагружает игру (preventDefault)');
      swipeChecked = true;
    }
  }

  // a run in progress: explorer mode shows the mission panel, the densest information HUD
  const explorerMode = await game.page.evaluate(() => {
    const option = document.querySelector('.menu-modes button[aria-pressed="false"]');
    if (!option) return false;
    option.click();
    return true;
  });
  check(explorerMode, 'Перед проверкой HUD выбран режим с панелью миссий');
  await game.page.setViewport({ width: 360, height: 740 });
  await wait(300);
  await game.clickByText(/НАЧАТЬ ДОБЫЧУ/);
  await game.waitFor('Смена на телефоне', () => !!document.querySelector('canvas'), 30_000);
  const missionVisible = await game.waitFor('Панель миссий в забеге', () => !!document.querySelector('.hud-objective-panel'), 30_000);
  check(missionVisible, 'В исследователе отображается панель миссий');
  for (const vp of [
    LAYOUT_VIEWPORTS[0],
    LAYOUT_VIEWPORTS[1],
    { name: 'короткое окно браузера 1000×500 (альбомная)', width: 1000, height: 500 },
    LAYOUT_VIEWPORTS[3],
  ]) {
    await game.page.setViewport({ width: vp.width, height: vp.height });
    await wait(500);
    const report = await layoutReport(game.page);
    check(report.boxes > 0, `Забег: элементы управления найдены (${vp.name})`, String(report.boxes));
    check(report.cut.length === 0, `Забег: HUD и кнопки не обрезаны (${vp.name})`, report.cut.slice(0, 4).join(' | '));
    check(report.overlaps.length === 0, `Забег: элементы не накладываются (${vp.name})`, report.overlaps.slice(0, 4).join(' | '));
    check(report.hudControlOverlaps.length === 0, `Забег: HUD не перекрывает сенсорные органы (${vp.name})`, report.hudControlOverlaps.slice(0, 4).join(' | '));
    check(report.hudHotbarOverlaps.length === 0, `Забег: левая информационная панель не перекрывает хотбар (${vp.name})`, report.hudHotbarOverlaps.join(' | '));
    check(
      typeof report.breathCenterOffset === 'number' && Math.abs(report.breathCenterOffset) <= 1,
      `Забег: пузырьки воздуха центрированы между третьим и четвёртым (${vp.name})`,
      report.breathCenterOffset === null ? 'индикатор не найден' : `${report.breathCenterOffset.toFixed(1)} px от центра`,
    );
    check(report.breathHotbarOverlap === null, `Забег: шкала воздуха не перекрывает хотбар (${vp.name})`, report.breathHotbarOverlap ?? 'пересечений нет');
    check(report.hotbarControlOverlaps.length === 0, `Забег: хотбар не перекрывает сенсорные зоны (${vp.name})`, report.hotbarControlOverlaps.join(' | '));
    const slots = report.hotbarSlots.sort((a, b) => a.index - b.index);
    if (vp.height > vp.width && slots.length === 10) {
      const sameColumn = slots.every((slot) => Math.abs(slot.left - slots[0].left) < 1.5);
      const slotOneAtBottom = slots[0].top > slots[9].top && slots[0].bottom > slots[9].bottom;
      check(sameColumn && slotOneAtBottom, `Забег: портретный хотбар вертикален, слот 1 внизу (${vp.name})`, JSON.stringify({ style: report.hotbarStyle, slots: slots.map((slot) => [slot.index + 1, Math.round(slot.left), Math.round(slot.top)]) }));
    } else if (slots.length === 10 && vp.width < 1100) {
      const sameRow = slots.every((slot) => Math.abs(slot.top - slots[0].top) < 1.5);
      const ordered = slots[0].left < slots[9].left;
      check(sameRow && ordered, `Забег: альбомный хотбар горизонтален и упорядочен (${vp.name})`, JSON.stringify({ style: report.hotbarStyle, slots: slots.map((slot) => [slot.index + 1, Math.round(slot.left), Math.round(slot.top)]) }));
    }
    check(report.scroll[0] <= 1 && report.scroll[1] <= 1, `Забег: у страницы нет прокрутки (${vp.name})`, `scroll ${report.scroll.join('×')}`);
  }
  const touches = await game.page.evaluate(() => {
    const stick = document.querySelector('.touch-left')?.getBoundingClientRect();
    const actions = [...document.querySelectorAll('.touch-right button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width >= 48 && rect.height >= 48;
    });
    return !!stick && stick.width >= 96 && actions.length > 0 && actions.every(Boolean);
  });
  check(touches, 'Сенсорные стики и кнопки сохраняют размеры для нажатия');
  await game.page.setViewport({ width: 360, height: 740 });
  const inventoryOpened = await game.page.evaluate(() => {
    const button = document.querySelector('.hud-information--top-right')?.parentElement?.querySelector('button');
    if (!button) return false;
    button.click();
    return true;
  });
  check(inventoryOpened, 'Инвентарь открывается в портретной ориентации');
  const recipesVisible = await game.waitFor('Карточки крафта на телефоне', () => !!document.querySelector('.recipe-card .recipe-craft'), 10_000);
  check(recipesVisible, 'Карточки рецептов и кнопки создания отображаются на телефоне');
  const recipeFit = await game.page.evaluate(() => {
    const list = document.querySelector('.recipe-list');
    const root = list?.closest('.absolute.inset-0');
    if (!list || !root) return null;
    root.scrollTop = root.scrollHeight;
    const cards = [...document.querySelectorAll('.recipe-card')];
    const overflow = cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      const craft = card.querySelector('.recipe-craft')?.getBoundingClientRect();
      const costs = card.querySelector('.recipe-costs')?.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1 ||
        (!!craft && (craft.left < rect.left - 1 || craft.right > rect.right + 1 || craft.right > window.innerWidth + 1)) ||
        (!!costs && (costs.left < rect.left - 1 || costs.right > rect.right + 1 || costs.right > window.innerWidth + 1)) ||
        card.scrollWidth > card.clientWidth + 1;
    });
    return { cards: cards.length, overflow: overflow.length, viewport: window.innerWidth, rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth };
  });
  check(!!recipeFit && recipeFit.cards > 0 && recipeFit.overflow === 0 && recipeFit.rootScrollWidth <= recipeFit.rootWidth + 1, 'Рецепты, стоимость и кнопки не обрезаются и не расширяют экран по горизонтали', JSON.stringify(recipeFit));
  await game.page.close();
}

/* ------------------ scenario F: asynchronous SDK connection (sdk-example) ------------------ */

/**
 * The docs show two connections. The synchronous one (`<script src="/sdk.js">` in the head) is how the
 * game ships; this scenario checks the asynchronous one: the tag is removed, the SDK is injected with
 * `s.async = true` and answers late, so the game boots before the SDK exists and must wait for it
 * instead of falling back to "not Yandex Games".
 */
async function scenarioAsyncSdk() {
  const game = await openGame({
    lang: 'ru',
    asyncSdk: true,
    name: 'ASYNC MINER',
    data: { 'orerush.profile': { v: 1, savedAt: Date.now(), name: 'ASYNC MINER', scores: [], totals: {} } },
  });
  const menu = await game.waitFor(
    'Меню после позднего SDK',
    () => /ВОЙТИ ЧЕРЕЗ ЯНДЕКС|MINE NOW|НАЧАТЬ|CREUSER|ABBAUEN|ASYNC MINER/i.test(document.body.innerText ?? ''),
    40_000,
  );
  check(menu, 'Игра запускается, когда /sdk.js приходит асинхронно');
  const initialised = await game.waitFor(
    'YaGames.init',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'YaGames.init'),
    20_000,
  );
  check(initialised, 'Игра дождалась SDK и вызвала YaGames.init()');
  const readyOnce = game.count(await game.calls(), 'LoadingAPI.ready') === 1;
  check(readyOnce, 'Game Ready отправлен ровно один раз и после позднего SDK');
  const cloudRead = (await game.calls()).some((c) => c.name === 'player.getData');
  check(cloudRead, 'Облачный профиль читается и при асинхронном подключении');
  await game.page.close();
}

/* -------------- scenario K: real-gameplay screenshots for the store card (5/1/1/2, 8/3/4) ------------- */

/**
 * Requirement 5.1.1.2 wants the store screenshots to show actual gameplay: at least 70 % of the frame,
 * the rest may be a frame or a caption. Requirement 8.3.4 forbids system UI (status bar, browser chrome)
 * and Yandex Games UI (badges, ratings) on them. This scenario renders the game in headless Chromium and
 * writes clean 16:9 PNGs of live play into `docs/shots/`. They are raw material for the store card: the
 * gameplay part is already real, a frame and a caption can be added on top.
 *
 * `SHOTS_LANG=ru|en|fr|de` and `SHOTS_DIR` override the interface language and the output folder.
 */
async function scenarioScreenshots() {
  const outDir = process.env.SHOTS_DIR ?? path.join(process.cwd(), 'docs', 'shots');
  mkdirSync(outDir, { recursive: true });
  const shot = async (name, label) => {
    const file = path.join(outDir, `${name}.png`);
    await game.page.screenshot({ path: file });
    const size = existsSync(file) ? statSync(file).size : 0;
    check(size > 20_000, label, `${name}.png ${Math.round(size / 1024)} КБ`);
  };

  const game = await openGame({
    lang: process.env.SHOTS_LANG ?? 'ru',
    name: 'SHOT MINER',
    flags: { 'shop.enabled': 'true', 'game.exploreMinutes': '3' },
    adsFill: false,
    rewarded: true,
  });
  await game.page.setViewport({ width: 1280, height: 720 });
  const language = await game.page.evaluate(() => document.documentElement.lang);
  const play = { en: 'MINE NOW', ru: 'НАЧАТЬ ДОБЫЧУ', fr: 'CREUSER', de: 'JETZT ABBAUEN' }[language] ?? 'MINE NOW';

  const menu = await game.waitFor('Меню для скриншотов', (label) => (document.body.innerText ?? '').includes(label), 60_000, play);
  check(menu, 'Игра открылась для съёмки скриншотов');
  await wait(800);
  await shot('01-menu', 'Скриншот главного меню сохранён');

  await game.clickByText(new RegExp(play));
  const running = await game.waitFor(
    'Забег начался',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'GameplayAPI.start'),
    30_000,
  );
  check(running, 'Забег запущен для съёмки игрового кадра');
  // let the world generate, the sky settle and the player walk a few steps
  await wait(4_000);
  await game.page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
  });
  await wait(2_500);
  await shot('02-run', 'Кадр живого геймплея сохранён (HUD, мир, рука)');
  await wait(3_000);
  await shot('03-run-deep', 'Второй игровой кадр сохранён');
  await game.page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
  });

  const bag = /БАГ|СУМКА|INVENT|BAG|SAC|RUCKSACK/i;
  const bagOpened = await game.page.evaluate((source) => {
    const rx = new RegExp(source, 'i');
    const button = [...document.querySelectorAll('button')].find((b) => rx.test(b.getAttribute('aria-label') ?? ''));
    button?.click();
    return Boolean(button);
  }, bag.source);
  await wait(1_200);
  await shot('04-inventory', 'Скриншот инвентаря сохранён');
  if (bagOpened) {
    await game.page.evaluate((source) => {
      const rx = new RegExp(source, 'i');
      const button = [...document.querySelectorAll('button')].find((b) => rx.test(b.getAttribute('aria-label') ?? ''));
      button?.click();
    }, bag.source);
    await wait(600);
  }

  await game.page.keyboard.press('Escape');
  await wait(1_200);
  await shot('05-pause', 'Скриншот паузы сохранён');
  await game.page.keyboard.press('Escape');
  await wait(600);
  await game.page.keyboard.press('Escape');
  await wait(800);
  await shot('06-after-pause', 'Кадр после возврата из паузы сохранён');

  await game.page.close();
}

/* --------------- scenario J: every language declared in the draft (2.14, 8.2.3) --------------- */

/**
 * Moderation opens the game once per language declared in the draft (поле «Игра переведена на») and
 * rejects it if at least one of them did not switch over: «🚫 Если хотя бы один язык не переключился
 * (полностью или частично) на выбранный на debug-панели — игра будет отклонена за неперевод»
 * (https://yandex.ru/dev/games/doc/ru/requirements/2/14). The debug panel language switch is exactly
 * `ysdk.environment.i18n.lang`, which this suite mocks.
 *
 * For each shipped language the scenario boots the built game and walks the screens a moderator walks:
 * menu → character studio → settings → shop → run (HUD) → pause. On every screen it checks that
 *   - the interface really came from that language's dictionary (labels are present), and
 *   - no English-only label of the same screen leaked through (a partial translation).
 * It then checks the manual switcher (rule 8.2.3 allows it, but it must apply immediately) and the
 * reserve sets of https://yandex.ru/dev/games/doc/ru/concepts/languages-and-domains: `ru` for
 * be/kk/uk/uz, `en` for everything else.
 *
 * `LANGS_ONLY=ru,de` narrows the run (handy while editing a single translation).
 */
async function scenarioLanguages() {
  const cases = [
    {
      code: 'en',
      docLang: 'en',
      play: 'MINE NOW',
      creator: 'CREATE CHARACTER',
      creatorTitle: 'CHARACTER STUDIO',
      creatorSave: 'SAVE LOOK',
      cancel: 'CANCEL',
      settings: 'SETTINGS',
      languageTitle: 'LANGUAGE',
      music: 'MUSIC ON',
      shop: 'SHOP',
      balance: 'NETHERITE COINS',
      close: 'CLOSE',
      hud: 'DEPTH',
      resume: 'RESUME',
      restart: 'RESTART',
      quit: 'QUIT',
      resumeHint: 'PRESS ESC TO RESUME',
      foreign: [],
    },
    {
      code: 'ru',
      docLang: 'ru',
      play: 'НАЧАТЬ ДОБЫЧУ',
      creator: 'СОЗДАТЬ ПЕРСОНАЖА',
      creatorTitle: 'МАСТЕРСКАЯ ПЕРСОНАЖА',
      creatorSave: 'СОХРАНИТЬ ОБЛИК',
      cancel: 'ОТМЕНА',
      settings: 'НАСТРОЙКИ',
      languageTitle: 'ЯЗЫК',
      music: 'МУЗЫКА ВКЛ',
      shop: 'МАГАЗИН',
      balance: 'МОНЕТЫ НЕЗЕРИТА',
      close: 'ЗАКРЫТЬ',
      hud: 'ГЛУБИНА',
      resume: 'ПРОДОЛЖИТЬ',
      restart: 'ЗАНОВО',
      quit: 'ВЫЙТИ',
      resumeHint: 'НАЖМИТЕ ESC ДЛЯ ПРОДОЛЖЕНИЯ',
      foreign: [
        'MINE NOW', 'SETTINGS', 'CONTROLS', 'RESUME', 'RESTART', 'MAIN MENU', 'QUIT',
        'CREATE CHARACTER', 'CHARACTER STUDIO', 'SAVE LOOK', 'NETHERITE COINS', 'MUSIC ON',
      ],
    },
    {
      code: 'fr',
      docLang: 'fr',
      play: 'CREUSER',
      creator: 'CRÉER UN PERSONNAGE',
      creatorTitle: 'ATELIER DU PERSONNAGE',
      creatorSave: 'ENREGISTRER',
      cancel: 'ANNULER',
      settings: 'RÉGLAGES',
      languageTitle: 'LANGUE',
      music: 'MUSIQUE ACTIVÉE',
      shop: 'BOUTIQUE',
      balance: 'PIÈCES EN NETHERITE',
      close: 'FERMER',
      hud: 'PROFONDEUR',
      resume: 'REPRENDRE',
      restart: 'RECOMMENCER',
      quit: 'QUITTER',
      resumeHint: 'APPUYEZ SUR ESC POUR REPRENDRE',
      foreign: [
        'MINE NOW', 'SETTINGS', 'CONTROLS', 'RESUME', 'RESTART', 'MAIN MENU', 'QUIT',
        'CREATE CHARACTER', 'CHARACTER STUDIO', 'SAVE LOOK', 'NETHERITE COINS', 'MUSIC ON',
      ],
    },
    {
      code: 'de',
      docLang: 'de',
      play: 'JETZT ABBAUEN',
      creator: 'FIGUR ERSTELLEN',
      creatorTitle: 'FIGUREN-WERKSTATT',
      creatorSave: 'LOOK SPEICHERN',
      cancel: 'ABBRECHEN',
      settings: 'EINSTELLUNGEN',
      languageTitle: 'SPRACHE',
      music: 'MUSIK AN',
      shop: 'SHOP',
      balance: 'NETHERITMÜNZEN',
      close: 'SCHLIESSEN',
      hud: 'TIEFE',
      resume: 'FORTSETZEN',
      restart: 'NEU STARTEN',
      quit: 'BEENDEN',
      resumeHint: 'DRÜCKE ESC ZUM FORTSETZEN',
      foreign: [
        'MINE NOW', 'SETTINGS', 'CONTROLS', 'RESUME', 'RESTART', 'MAIN MENU', 'QUIT',
        'CREATE CHARACTER', 'CHARACTER STUDIO', 'SAVE LOOK', 'NETHERITE COINS', 'MUSIC ON',
      ],
    },
  ];

  /**
   * English-only labels that must not show up on a translated screen. Matched on word boundaries:
   * Russian «ВЫЙТИ» must not be reported because French «QUITTER» starts with QUIT.
   */
  const englishLeaks = async (game, words) => {
    if (!words.length) return [];
    return game.page.evaluate((list) => {
      const text = document.body.innerText ?? '';
      return list.filter((word) => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^A-Za-zÀ-ÿ])${escaped}([^A-Za-zÀ-ÿ]|$)`).test(text);
      });
    }, words);
  };

  const only = process.env.LANGS_ONLY?.split(',').map((code) => code.trim()).filter(Boolean);
  const wanted = (code) => !only || only.includes(code);

  for (const item of cases) {
    if (!wanted(item.code)) continue;
    const game = await openGame({
      lang: item.code,
      flags: { 'shop.enabled': 'true', 'game.exploreMinutes': '0.25' },
      adsFill: false,
      rewarded: true,
    });

    // ---------- menu ----------
    const booted = await game.waitFor(
      `Меню на языке ${item.code}`,
      (arg) => document.documentElement.lang === arg.docLang && (document.body.innerText ?? '').includes(arg.play),
      60_000,
      item,
    );
    check(booted, `Платформенный язык ${item.code} применён на старте (п. 2.14)`);
    const docLang = await game.page.evaluate(() => document.documentElement.lang);
    check(docLang === item.docLang, `Атрибут lang документа выставлен в ${item.docLang}`, String(docLang));
    const menuLeaks = await englishLeaks(game, item.foreign);
    check(menuLeaks.length === 0, `Главное меню полностью на языке ${item.code}`, menuLeaks.join(', '));

    // ---------- character studio (a modal on top of the menu) ----------
    const creatorOpened = await game.page.evaluate(() => {
      const button = document.querySelector('[data-character-creator="1"]');
      button?.click();
      return Boolean(button);
    });
    const creatorReady = await game.waitFor(
      `Конструктор персонажа (${item.code})`,
      (arg) => {
        const text = document.querySelector('[role="dialog"]')?.textContent ?? '';
        return text.includes(arg.creatorTitle) && text.includes(arg.creatorSave) && text.includes(arg.cancel);
      },
      15_000,
      item,
    );
    check(creatorOpened && creatorReady, `Конструктор персонажа открылся и переведён (${item.code})`);
    const creatorLeaks = await englishLeaks(game, item.foreign);
    check(creatorLeaks.length === 0, `В конструкторе персонажа нет английских надписей (${item.code})`, creatorLeaks.join(', '));
    // leave the studio the way the player does — its own cancel button
    const creatorClosed = await game.page.evaluate((label) => {
      const dialog = document.querySelector('[role="dialog"]');
      const button = [...(dialog?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').trim().endsWith(label));
      button?.click();
      return Boolean(button);
    }, item.cancel);
    check(creatorClosed, `Конструктор закрывается кнопкой «${item.cancel}» (${item.code})`);
    await game.waitFor(
      `Меню после конструктора (${item.code})`,
      (arg) => !document.querySelector('[role="dialog"]') && (document.body.innerText ?? '').includes(arg.play),
      10_000,
      item,
    );

    // ---------- settings ----------
    const settingsOpened = await game.clickByText(new RegExp(item.settings));
    check(settingsOpened, `Настройки открываются на языке ${item.code}`);
    const settingsReady = await game.waitFor(
      `Раздел настроек ${item.code}`,
      (arg) => {
        const text = document.body.innerText ?? '';
        return text.includes(arg.languageTitle) && text.includes(arg.music);
      },
      20_000,
      item,
    );
    check(settingsReady, `Раздел настроек переведён (${item.code})`);
    const switcherShown = await game.page.evaluate(
      () => ['ENGLISH', 'РУССКИЙ', 'FRANÇAIS', 'DEUTSCH'].every((name) => (document.body.innerText ?? '').includes(name)),
    );
    check(switcherShown, `Переключатель языков подписан эндонимами (п. 8.2.3, ${item.code})`);
    const settingsLeaks = await englishLeaks(game, item.foreign);
    check(settingsLeaks.length === 0, `Настройки полностью на языке ${item.code}`, settingsLeaks.join(', '));
    await game.clickByText(new RegExp(item.close));
    await wait(400);

    // ---------- shop ----------
    const shopOpened = await game.clickByText(new RegExp(`^${item.shop}$`));
    check(shopOpened, `Магазин открывается на языке ${item.code}`);
    const shopReady = await game.waitFor(
      `Витрина магазина ${item.code}`,
      (arg) => (document.body.innerText ?? '').includes(arg.balance),
      20_000,
      item,
    );
    check(shopReady, `Магазин переведён (${item.code})`);
    const shopLeaks = await englishLeaks(game, item.foreign);
    check(shopLeaks.length === 0, `В магазине нет английских надписей (${item.code})`, shopLeaks.join(', '));
    await game.clickByText(new RegExp(item.close));
    await wait(400);

    // ---------- run: HUD and pause ----------
    const playClicked = await game.clickByText(new RegExp(item.play));
    check(playClicked, `Кнопка старта забега на языке ${item.code} нажата`);
    const hudReady = await game.waitFor(
      `HUD на языке ${item.code}`,
      (arg) => (document.body.innerText ?? '').includes(arg.hud),
      30_000,
      item,
    );
    check(hudReady, `HUD забега переведён (${item.code})`);
    const hudLeaks = await englishLeaks(game, item.foreign);
    check(hudLeaks.length === 0, `В HUD нет английских надписей (${item.code})`, hudLeaks.join(', '));

    // the run has really begun when the platform sees GameplayAPI.start (the snapshot lags a few
    // hundred milliseconds behind the click); only then does Escape mean `pause`
    await game.waitFor(
      `Забег запущен (${item.code})`,
      () => (window.__yaCalls ?? []).some((c) => c.name === 'GameplayAPI.start'),
      20_000,
    );
    await wait(700);
    let pauseReady = false;
    for (let attempt = 0; attempt < 3 && !pauseReady; attempt += 1) {
      await game.page.keyboard.press('Escape');
      pauseReady = await game.waitFor(
        `Пауза на языке ${item.code}`,
        (arg) => {
          const text = document.body.innerText ?? '';
          return text.includes(arg.resume) && text.includes(arg.restart) && text.includes(arg.quit);
        },
        6_000,
        item,
      );
    }
    check(pauseReady, `Экран паузы переведён (${item.code})`);
    if (pauseReady) {
      const hintShown = await game.page.evaluate((hint) => (document.body.innerText ?? '').includes(hint), item.resumeHint);
      check(hintShown, `Подсказка управления переведена (${item.code})`, item.resumeHint);
      const pauseLeaks = await englishLeaks(game, item.foreign);
      check(pauseLeaks.length === 0, `На паузе нет английских надписей (${item.code})`, pauseLeaks.join(', '));
    }
    await game.page.close();
  }

  // ---------- the in-game language switcher (rule 8.2.3) ----------
  if (wanted('switch')) {
    const game = await openGame({ lang: 'ru', adsFill: false, rewarded: true });
    await game.waitFor('Меню для проверки переключателя', (play) => (document.body.innerText ?? '').includes(play), 60_000, 'НАЧАТЬ ДОБЫЧУ');
    await game.clickByText(/НАСТРОЙКИ/);
    await wait(400);
    const switchedToGerman = await game.page.evaluate(async () => {
      const button = [...document.querySelectorAll('button')].find((b) => /DEUTSCH$/.test((b.textContent ?? '').trim()));
      if (!button) return false;
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return (document.body.innerText ?? '').includes('EINSTELLUNGEN');
    });
    check(switchedToGerman, 'Ручное переключение языка сразу меняет интерфейс (DE)');
    const backToRussian = await game.page.evaluate(async () => {
      const button = [...document.querySelectorAll('button')].find((b) => /РУССКИЙ$/.test((b.textContent ?? '').trim()));
      if (!button) return false;
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return (document.body.innerText ?? '').includes('НАСТРОЙКИ') && document.documentElement.lang === 'ru';
    });
    check(backToRussian, 'Возврат на русский язык тоже применяется сразу');
    await game.page.close();
  }

  // ---------- reserve sets for unsupported platform languages ----------
  if (wanted('fallback')) {
    for (const fallback of [
      { code: 'uk', docLang: 'ru', play: 'НАЧАТЬ ДОБЫЧУ', label: 'украинский → русский' },
      { code: 'tr', docLang: 'en', play: 'MINE NOW', label: 'турецкий → английский' },
    ]) {
      const game = await openGame({ lang: fallback.code, adsFill: false });
      const booted = await game.waitFor(
        `Резервный язык для ${fallback.code}`,
        (arg) => document.documentElement.lang === arg.docLang && (document.body.innerText ?? '').includes(arg.play),
        60_000,
        fallback,
      );
      check(booted, `Незаявленный платформенный язык (${fallback.label}) получает резервный набор из документации`);
      await game.page.close();
    }
  }
}

// SDK_CHECK_SCENARIO=<progress|shop|promo|daily|device|async|tv|world|layout|lang|shots> runs one: handy
// while debugging a single check without waiting for the whole suite
const only = process.env.SDK_CHECK_SCENARIO;
const wanted = (name) => !only || only === name;

try {
  if (wanted('progress')) await scenarioProgress();
  if (wanted('shop')) await scenarioShop();
  if (wanted('promo')) await scenarioPromo();
  if (wanted('daily')) await scenarioDaily();
  if (wanted('device')) await scenarioDevice();
  if (wanted('async')) await scenarioAsyncSdk();
  if (wanted('tv')) await scenarioTv();
  if (wanted('world')) await scenarioWorldAutosave();
  if (wanted('layout')) await scenarioLayout();
  if (wanted('lang')) await scenarioLanguages();
  // screenshots are a production tool, not a check: they run on demand (SHOTS=1) so the suite
  // stays lean and a long full-language pass is not followed by six more page loads
  if (only === 'shots' || process.env.SHOTS === '1') await scenarioScreenshots();
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
