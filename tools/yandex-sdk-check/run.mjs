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

  await page.goto(`${base}?payload=check`, { waitUntil: 'domcontentloaded' });
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
  const profileFlushed = await game.waitFor(
    'Рекорды в облачном профиле',
    () => (window.__yaCalls ?? []).some((c) => c.name === 'player.setData' && (c.arg?.keys ?? []).includes('orerush.profile')),
    15_000,
  );
  check(profileFlushed, 'Рекорды забега ушли в облачный профиль (player.setData)');

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

  await game.page.close();
}

try {
  await scenarioProgress();
  await scenarioShop();
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
