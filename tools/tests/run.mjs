#!/usr/bin/env node
/**
 * Runs the Node-side verification suites (`npm run test:profile`, part of `npm run verify`).
 *
 * Each suite is a TypeScript entry that imports the game's own modules — the same files that ship to
 * Yandex Games — stubs the browser globals it needs and exports `passed` / `failures`. Suites are
 * bundled with the esbuild that ships inside Vite and **executed in their own process**, so one
 * suite cannot leak a mocked SDK, a patched clock or a pending promise into the next one.
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const suites = process.argv.slice(2).length ? process.argv.slice(2) : ['profile.test.ts'];

const outdir = mkdtempSync(path.join(tmpdir(), 'ore-rush-tests-'));
let failed = 0;

for (const suite of suites) {
  const entry = path.join(__dirname, suite);
  const outfile = path.join(outdir, suite.replace(/\.ts$/, '.mjs'));
  const runner = path.join(outdir, `${suite}.runner.mjs`);

  // a generated entry: bundle the suite, print its verdict, exit with the right code
  writeFileSync(
    runner,
    [
      `import * as suite from ${JSON.stringify(entry)};`,
      `const passed = suite.passed ?? 0;`,
      `const failures = suite.failures ?? [];`,
      `console.log(${JSON.stringify(`\n=== ${suite} ===`)});`,
      `console.log(\`\${passed} успешно, \${failures.length} провалено\`);`,
      `for (const failure of failures) console.log('✖ ' + failure);`,
      `process.exit(failures.length ? 1 : 0);`,
    ].join('\n'),
  );

  await build({
    entryPoints: [runner],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'warning',
    absWorkingDir: ROOT,
  });

  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

console.log(`\n${failed ? `✖ провалено наборов: ${failed}` : '✓ все наборы пройдены'}`);
process.exit(failed ? 1 : 0);
