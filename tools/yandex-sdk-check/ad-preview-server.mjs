#!/usr/bin/env node
/**
 * Arena-friendly preview of the game with visible Yandex-ad SDK mocks.
 *
 * The official SDK dev proxy requires fetching Yandex's adapter. When outbound access is unavailable,
 * this serves the production bundle locally and answers /sdk.js with the existing test SDK mock, with
 * an opt-in visual placeholder for banners, fullscreen and rewarded ads.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../../dist');
const indexPath = path.join(distDir, 'index.html');
const mockSdkPath = path.join(here, 'mock-sdk.js');
const port = Number(process.env.PORT ?? 8080);

const [indexHtml, mockSdk] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(mockSdkPath, 'utf8'),
]);
const sdkResponse = `window.__yaVisualAdMock = true;\n${mockSdk}`;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/sdk.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Preview-SDK': 'local-yandex-ad-mock',
    });
    res.end(req.method === 'HEAD' ? undefined : sdkResponse);
    return;
  }

  const relativePath = pathname.replace(/^\/+/, '') || 'index.html';
  const filePath = path.resolve(distDir, relativePath);
  if (filePath !== distDir && !filePath.startsWith(`${distDir}${path.sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let body;
  let servedPath = filePath;
  try {
    body = await readFile(filePath);
  } catch {
    // The production build is a single-file SPA; unknown routes should still load the game shell.
    body = Buffer.from(indexHtml);
    servedPath = indexPath;
  }

  res.writeHead(200, {
    'Content-Type': contentTypes[path.extname(servedPath)] ?? 'application/octet-stream',
    'Cache-Control': servedPath === indexPath ? 'no-store' : 'public, max-age=3600',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Ad-placeholder preview listening on 0.0.0.0:${port}`);
  console.log('SDK calls are mocked locally; no real ads, impressions or rewards are sent to Yandex.');
});
