#!/usr/bin/env node
/** Run the vendored upstream checker in headless Chromium against the local debug preview. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import { createRequire } from 'node:module';

const baseUrl = process.argv[2] ?? process.env.YG_DEBUG_CHECKER_URL ?? 'http://127.0.0.1:4173/';
const readyTimeoutMs = Number(process.env.YG_CHECKER_READY_TIMEOUT_MS ?? 90_000);
const checkTimeoutMs = Number(process.env.YG_CHECKER_PANEL_TIMEOUT_MS ?? 45_000);

async function connectToPreview() {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) throw new Error(`preview returned HTTP ${response.status}`);
      const marker = response.headers.get('x-debug-checker-preview');
      if (!marker) throw new Error('server response is not the debug-checker preview');
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Cannot reach ${baseUrl}: ${lastError?.message ?? 'timeout'}. Start `
    + '`npm run yandex:debug-checker` in another terminal first.');
}

async function importPuppeteer() {
  try {
    const mod = await import('puppeteer-core');
    return mod.default ?? mod;
  } catch {
    throw new Error('puppeteer-core is missing. Run `npm ci` first.');
  }
}

async function resolveChromium() {
  const explicit = process.env.CHROME_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return { executablePath: explicit, args: [], extraEnv: {}, tempDir: null };

  try {
    const mod = await import('@sparticuz/chromium');
    const chromium = mod.default ?? mod;
    const executablePath = await chromium.executablePath();
    if (!executablePath || !existsSync(executablePath)) throw new Error('Chromium executable not found');

    // @sparticuz/chromium bundles Amazon Linux runtime libraries. Unpack them beside the binary,
    // as the project's existing SDK browser test does, so the binary also runs in this container.
    const require = createRequire(import.meta.url);
    const binDir = path.join(path.dirname(path.dirname(require.resolve('@sparticuz/chromium'))), 'bin');
    const tempDir = mkdtempSync(path.join(tmpdir(), 'yandex-debug-checker-'));
    const tarPath = path.join(tempDir, 'libs.tar');
    writeFileSync(tarPath, brotliDecompressSync(readFileSync(path.join(binDir, 'al2023.tar.br'))));
    const { execFileSync } = await import('node:child_process');
    execFileSync('tar', ['-xf', tarPath, '-C', tempDir]);
    return {
      executablePath,
      args: chromium.args ?? [],
      extraEnv: { LD_LIBRARY_PATH: `${path.join(tempDir, 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}` },
      tempDir,
    };
  } catch (error) {
    const candidates = ['chromium', 'google-chrome', 'google-chrome-stable', 'chrome'];
    for (const candidate of candidates) {
      const { execFileSync } = await import('node:child_process');
      try {
        const executablePath = execFileSync('which', [candidate], { encoding: 'utf8' }).trim();
        if (executablePath && existsSync(executablePath)) return { executablePath, args: [], extraEnv: {}, tempDir: null };
      } catch {
        // Try the next executable name.
      }
    }
    throw new Error(`Headless Chromium is unavailable: ${error.message}. Install the project dev dependencies `
      + 'or set CHROME_PATH to a local Chromium/Chrome executable.');
  }
}

await connectToPreview();
const puppeteer = await importPuppeteer();
const chromium = await resolveChromium();
let browser;

try {
  browser = await puppeteer.launch({
    executablePath: chromium.executablePath,
    headless: true,
    args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
    env: { ...process.env, ...chromium.extraEnv },
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const browserErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} — ${request.failure()?.errorText ?? 'request failed'}`);
  });

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response?.ok()) throw new Error(`Game preview navigation failed: HTTP ${response?.status() ?? 'no response'}`);

  await page.waitForFunction(() => window.YGDebugChecker?.version === '1.1.0', { timeout: 30_000 });
  await page.waitForFunction(
    () => Array.isArray(window.__yaCalls) && window.__yaCalls.some((call) => call.name === 'YaGames.init'),
    { timeout: 30_000 },
  );

  let gameReadyObserved = false;
  try {
    await page.waitForFunction(
      () => Number(window.__dbg?.TIMING?.gameReady) > 0,
      { timeout: readyTimeoutMs },
    );
    gameReadyObserved = true;
  } catch {
    // Continue to print the checker report; missing Game Ready is itself actionable evidence.
  }

  await page.evaluate(() => window.YGDebugChecker.open());
  await page.waitForFunction(
    () => Boolean(document.querySelector('.dc-sum') && typeof window._dcSource === 'string'),
    { timeout: checkTimeoutMs },
  );

  const report = await page.evaluate(() => {
    const summary = Object.fromEntries(
      [...document.querySelectorAll('.dc-sum .dc-sc')].map((cell) => [
        cell.querySelector('.dc-sl')?.textContent.trim() ?? '',
        cell.querySelector('.dc-sn')?.textContent.trim() ?? '',
      ]),
    );
    const categories = [...document.querySelectorAll('.dc-sec')]
      .map((section) => {
        const title = section.querySelector('.dc-st')?.textContent.trim();
        if (!title || title === 'Event Timeline') return null;
        const badge = section.querySelector('.dc-sh .dc-badge')?.textContent.trim() ?? '';
        const rows = [...section.querySelectorAll('.dc-row')].map((row) => {
          const icon = row.querySelector('.dc-icon');
          const status = ['dc-pass', 'dc-fail', 'dc-warn', 'dc-nv']
            .find((name) => icon?.classList.contains(name))?.slice(3).toUpperCase() ?? 'UNKNOWN';
          return {
            status,
            name: row.querySelector('.dc-name')?.textContent.trim() ?? '(unnamed check)',
            detail: row.querySelector('.dc-det')?.textContent.trim() ?? '',
          };
        });
        return { title, badge, rows };
      })
      .filter(Boolean);
    const timing = window.__dbg?.TIMING;
    const runtime = window.__dbg?.RT;
    return {
      version: window.YGDebugChecker?.version ?? 'unknown',
      sourceKb: Math.round((window._dcSource?.length ?? 0) / 1024),
      summary,
      message: document.querySelector('.dc-msg')?.textContent.trim() ?? '',
      categories,
      runtime: {
        sdkInitMs: timing?.sdkInit ? Math.round(timing.sdkInit - (timing.domReady || 0)) : null,
        gameReadyMs: timing?.gameReady ? Math.round(timing.gameReady - (timing.domReady || 0)) : null,
        language: runtime?._detectedLang ?? null,
        languageRead: runtime?._i18nRead ?? null,
        smallButtons: runtime?._smallButtons ?? [],
        smallButtonDetails: [...document.querySelectorAll('button,[onclick],[role=button],a,input,.btn')]
          .filter((element) => {
            if (element.closest('.dc-overlay')) return false;
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            if (element.closest('.modal.h,.h,[style*="display: none"],[style*="display:none"],[collapsed],[aria-hidden=true]')) return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= innerHeight
              && (rect.width < 44 || rect.height < 44);
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName,
              text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 90),
              className: typeof element.className === 'string' ? element.className.split(' ').slice(0, 3).join('.') : '',
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          }),
        events: (timing?.log ?? []).map((event) => ({
          name: event.event,
          ms: Math.round(event.delta),
          warning: event.warning ?? '',
        })),
      },
    };
  });

  const issues = report.categories.flatMap((category) => category.rows
    .filter((row) => row.status === 'FAIL' || row.status === 'WARN')
    .map((row) => ({ ...row, category: category.title })));
  const unverified = report.categories.flatMap((category) => category.rows
    .filter((row) => row.status === 'N V' || row.status === 'NV' || row.status === 'NOT VERIFIED')
    .map((row) => ({ ...row, category: category.title })));

  const score = String(report.summary.SCORE ?? '?').replace('%', '');
  const showDelta = (value) => value === null ? 'not observed' : `${value >= 0 ? '+' : ''}${value} ms`;
  console.log(`Yandex Games Debug Checker v${report.version} — ${baseUrl}`);
  console.log(`Scanned source: ${report.sourceKb} KB`);
  console.log(`TOTAL: ${report.summary.PASS ?? '?'} PASS, ${report.summary.FAIL ?? '?'} FAIL, `
    + `${report.summary.WARN ?? '?'} WARN, ${report.summary['N/V'] ?? '?'} NOT VERIFIED, `
    + `${score}% score; ${report.message}`);
  console.log(`Runtime: SDK init ${showDelta(report.runtime.sdkInitMs)}; `
    + `LoadingAPI.ready ${showDelta(report.runtime.gameReadyMs)}; `
    + `language=${report.runtime.language ?? 'not observed'}; `
    + `SDK language read=${String(report.runtime.languageRead)}; `
    + `ready observed within ${Math.round(readyTimeoutMs / 1000)}s=${gameReadyObserved}`);
  if (report.runtime.smallButtons.length) {
    console.log(`Small visible buttons (<44px): ${report.runtime.smallButtons.join('; ')}`);
    for (const button of report.runtime.smallButtonDetails) {
      console.log(`  ${button.width}x${button.height} ${button.tag}.${button.className}: ${button.text || '(no visible label)'}`);
    }
  }

  console.log('\n=== FAIL / WARN — исправить или проверить вручную ===');
  if (!issues.length) console.log('Нет.');
  for (const issue of issues) {
    console.log(`[${issue.status}] ${issue.category} / ${issue.name}`);
    if (issue.detail) console.log(`  ${issue.detail}`);
  }

  console.log('\n=== NOT VERIFIED — не дефект; нужна ручная проверка/свидетельство ===');
  if (!unverified.length) console.log('Нет.');
  for (const item of unverified) {
    console.log(`[N/V] ${item.category} / ${item.name}`);
    if (item.detail) console.log(`  ${item.detail}`);
  }

  console.log('\n=== Категории / прошедшие проверки ===');
  for (const category of report.categories) {
    console.log(`${category.title}: ${category.badge || 'N/A'}`);
  }
  console.log('\n=== Runtime events ===');
  if (!report.runtime.events.length) console.log('Не зафиксированы.');
  for (const event of report.runtime.events) {
    console.log(`+${event.ms} ms ${event.name}${event.warning ? ` — ${event.warning}` : ''}`);
  }

  if (browserErrors.length) {
    console.log('\n=== Browser console/page errors ===');
    for (const error of [...new Set(browserErrors)]) console.log(error);
  } else {
    console.log('\nBrowser console/page errors: none captured.');
  }

  if (failedRequests.length) {
    console.log('\n=== Failed network requests ===');
    for (const request of [...new Set(failedRequests)]) console.log(request);
  }

  console.log('\nImportant: SDK is mocked locally. This report cannot verify Yandex Console settings, live IAP/ads, moderation, or account-side purchase activation.');
} finally {
  await browser?.close().catch(() => {});
  if (chromium.tempDir) rmSync(chromium.tempDir, { recursive: true, force: true });
}
