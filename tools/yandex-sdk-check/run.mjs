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
      window.localStorage.clear();
    } catch {
      /* about:blank */
    }
    window.__yaCalls = [];
    window.__yaMockSeed = s;
    // Requirement 1.3 is about the game's audio really stopping: the check replaces the AudioContext
    // with a spy that records suspend()/resume() and flips its own state, so focus events can be
    // verified without speakers.
    window.__audioSpy = { created: 0, suspends: 0, resumes: 0 };
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
    // remote config: the shop is off for this group, the FPS counter is hidden, and the
    // explorer shift lasts 15 s so the check can reach the results screen end to end
    flags: { 'shop.enabled': 'false', 'ui.showFps': 'false', 'game.exploreMinutes': '0.25' },
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
  const leaveClicked = await game.clickByText(/^\s*ВЫЙТИ\s*$/);
  check(leaveClicked, 'Кнопка «Выйти» нажата');
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

  const shopOpened = await game.clickByText(/МАГАЗИН|SHOP|BOUTIQUE/);
  check(shopOpened, 'Магазин открывается при включённом флаге');
  await wait(400);
  const priceShown = await game.page.evaluate(() => (document.body.innerText ?? '').includes('99 ₽'));
  check(priceShown, 'В магазине показана цена из каталога Консоли (99 ₽)');
  const currencyIcon = await game.page.evaluate(() =>
    [...document.querySelectorAll('img')].some((img) => (img.getAttribute('src') ?? '').startsWith('data:image/gif')),
  );
  check(currencyIcon, 'Иконка портальной валюты взята из каталога (getPriceCurrencyImage)');

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
    return !!card && /Сумка шахтёра/.test(card.textContent ?? '');
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
 * the cloud profile. Day one: a click pays 25 diamonds, the record goes to the cloud, a second click
 * pays nothing. Day two: another device (and another server day, faked with a clock offset while the
 * browser clock stays put) sees yesterday's claim in the cloud and offers the grown bonus.
 */
async function scenarioDaily() {
  const DAY_MS = 86_400_000;
  const first = await openGame({ lang: 'ru' });
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

  const today = new Date().toISOString().slice(0, 10);
  const claimed = await first.clickByText(/ЕЖЕДНЕВНЫЙ БОНУС/);
  check(claimed, 'Клик по ежедневному бонусу сделан');
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
  check(stored, 'Дата бонуса (UTC) записана в хранилище', today);
  const balance = await first.storageValue('orerush.diamonds.v1');
  check(balance === '25', 'Ежедневный бонус начислил 25 алмазов', String(balance));
  const claimedLabel = await first.page.evaluate(() => {
    const button = document.querySelector('[data-daily-bonus]');
    return !!button && button.disabled && /\+25/.test(button.textContent ?? '');
  });
  check(claimedLabel, 'Кнопка бонуса заблокирована и показывает начисленные алмазы');
  await first.clickByText(/ЕЖЕДНЕВНЫЙ БОНУС/);
  await wait(400);
  const again = await first.storageValue('orerush.diamonds.v1');
  check(again === '25', 'Повторный клик в тот же день ничего не начисляет', String(again));
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
    serverTimeOffsetMs: DAY_MS,
    data: {
      'orerush.profile': { v: 1, savedAt: Date.now() + 60_000, daily: { last: today, streak: 1 } },
    },
  });
  const grown = await nextDay.waitFor(
    'Бонус второго дня',
    () => {
      const button = document.querySelector('[data-daily-bonus]');
      return !!button && /\+30/.test(button.textContent ?? '') && /серия 2/.test(button.textContent ?? '');
    },
    30_000,
  );
  check(grown, 'На следующий день бонус вырос до 30 алмазов за серию 2 (по серверному времени)');
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

try {
  await scenarioProgress();
  await scenarioShop();
  await scenarioPromo();
  await scenarioDaily();
  await scenarioDevice();
  await scenarioAsyncSdk();
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
