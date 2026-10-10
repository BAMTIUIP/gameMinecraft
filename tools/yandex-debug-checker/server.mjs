#!/usr/bin/env node
/**
 * Development-only, production-shaped preview for the upstream Yandex Games Debug Checker.
 * The checker is injected into the response, never into dist/ or the release ZIP.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const distDir = path.join(root, 'dist');
const indexPath = path.join(distDir, 'index.html');
const checkerPath = path.join(here, 'debugcheck.js');
const mockSdkPath = path.join(root, 'tools/yandex-sdk-check/mock-sdk.js');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '0.0.0.0';

const [indexHtml, checker, mockSdk] = await Promise.all([
  readFile(indexPath, 'utf8').catch(() => {
    throw new Error('dist/index.html not found. Run `npm run build` first.');
  }),
  readFile(checkerPath, 'utf8'),
  readFile(mockSdkPath, 'utf8'),
]);

const sdkTag = /<script\b[^>]*\bsrc=["']\/sdk\.js["'][^>]*>\s*<\/script>/i;
if (!sdkTag.test(indexHtml)) {
  throw new Error('dist/index.html must contain a synchronous <script src="/sdk.js"></script> tag.');
}
if (/src=["'][^"']*debugcheck\.js/i.test(indexHtml)) {
  throw new Error('dist/index.html already references debugcheck.js; remove it from the production build.');
}
const instrumentedIndex = indexHtml.replace(sdkTag, (tag) => `${tag}\n<script src="/debugcheck.js"></script>`);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function respond(res, status, contentType, body, headOnly = false, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(headOnly ? undefined : body);
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  if (pathname === '/sdk.js') {
    respond(res, 200, 'text/javascript; charset=utf-8', mockSdk, req.method === 'HEAD', {
      'Cache-Control': 'no-store',
      'X-Preview-SDK': 'local-mock-no-live-payments-or-ads',
    });
    return;
  }
  if (pathname === '/debugcheck.js') {
    respond(res, 200, 'text/javascript; charset=utf-8', checker, req.method === 'HEAD', {
      'Cache-Control': 'no-store',
      'X-Debug-Checker': 'Nioris/yandex-games-debug-checker@1.1.0',
    });
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  let filePath = path.resolve(distDir, relativePath);
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let body;
  if (relativePath === 'index.html') {
    body = Buffer.from(instrumentedIndex);
  } else {
    try {
      body = await readFile(filePath);
    } catch {
      // This game is a single-file SPA: route requests fall back to the injected game shell.
      body = Buffer.from(instrumentedIndex);
      filePath = indexPath;
    }
  }

  const isIndex = filePath === indexPath;
  respond(res, 200, mimeTypes[path.extname(filePath)] ?? 'application/octet-stream', body, req.method === 'HEAD', {
    'Cache-Control': isIndex ? 'no-store' : 'public, max-age=3600',
    ...(isIndex ? { 'X-Debug-Checker-Preview': 'enabled; development only' } : {}),
  });
});

server.on('error', (error) => {
  console.error(`[yandex-debug-checker] Server error: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Yandex Games Debug Checker v1.1.0 preview: http://${host}:${actualPort}`);
  console.log('Game assets: production-shaped dist/; SDK: local mock; checker: injected after /sdk.js.');
  console.log('No real Yandex account, ads, or purchases are contacted. The checker is not in the release archive.');
});
