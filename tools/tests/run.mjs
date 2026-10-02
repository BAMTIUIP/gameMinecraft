#!/usr/bin/env node
/**
 * Runs the Node-side verification suites (`npm run test:profile`, part of `npm run verify`).
 *
 * The suites are TypeScript entries that import the game's own modules (exactly the files shipped
 * to Yandex), so they are bundled with the esbuild that ships inside Vite and executed in Node with
 * browser globals stubbed. No test framework: each suite prints its own ✓/✖ list.
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const suites = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['profile.test.ts'];

let failed = 0;
for (const suite of suites) {
  const entry = path.join(__dirname, suite);
  const outdir = mkdtempSync(path.join(tmpdir(), 'ore-rush-tests-'));
  const outfile = path.join(outdir, suite.replace(/\.ts$/, '.mjs'));
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'warning',
    absWorkingDir: ROOT,
  });
  try {
    const result = await import(pathToFileURL(outfile).href);
    const passed = result.passed ?? 0;
    const failures = result.failures ?? [];
    console.log(`\n=== ${suite} ===`);
    console.log(`${passed} успешно, ${failures.length} провалено`);
    for (const failure of failures) console.log(`✖ ${failure}`);
    if (failures.length) failed += 1;
  } catch (err) {
    failed += 1;
    console.error(`✖ ${suite} упал:`, err);
  }
}
process.exit(failed ? 1 : 0);
