#!/usr/bin/env node
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const DIST_DIR = path.resolve('dist');
const RELEASE_DIR = path.resolve('release');
const ARCHIVE_PATH = path.join(RELEASE_DIR, 'ore-rush-yandex.zip');

const OFFICIAL_LIMIT = 100 * 1024 * 1024;
const SAFE_BUDGET = 20 * 1024 * 1024;
const BAD_NAME_RE = /[\s\u0400-\u04FF]/u;

const args = new Set(process.argv.slice(2));
const shouldZip = args.has('--zip') || args.has('--package');

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

async function collectFiles(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = toPosix(path.relative(root, fullPath));

    if (entry.isSymbolicLink()) {
      throw new Error(`Символические ссылки нельзя класть в архив: ${relPath}`);
    }

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, root)));
    } else if (entry.isFile()) {
      const info = await stat(fullPath);
      files.push({ fullPath, relPath, size: info.size });
    }
  }

  return files.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

/**
 * The Yandex Games SDK must be connected before YaGames.init() runs
 * (https://yandex.ru/dev/games/doc/ru/sdk/sdk-about#check):
 *   - <script src="/sdk.js"> — relative path, the archive is served by Yandex itself;
 *   - it must sit above the game bundle, otherwise window.YaGames is still undefined
 *     when the game calls init() and the loader shows "IF" instead of "IT".
 */
async function validateSdkTag(files, errors) {
  const indexFile = files.find((file) => file.relPath === 'index.html');
  if (!indexFile) return;

  let html;
  try {
    html = await readFile(indexFile.fullPath, 'utf8');
  } catch (error) {
    errors.push(`Не удалось прочитать dist/index.html: ${error.message}`);
    return;
  }

  const sdkMatch = /<script\b[^>]*\bsrc=["']\/sdk\.js["'][^>]*>/i.exec(html);
  if (!sdkMatch) {
    errors.push('В dist/index.html нет тега <script src="/sdk.js"> — SDK Яндекс Игр не подключён.');
    return;
  }

  const gameMatch = /<script\b[^>]*\btype=["']module["'][^>]*>/i.exec(html);
  if (gameMatch && gameMatch.index < sdkMatch.index) {
    errors.push('Тег /sdk.js должен стоять в <head> до кода игры: YaGames.init() вызывается раньше загрузки SDK.');
  }
}

function validate(files) {
  const errors = [];
  const warnings = [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const rootIndexCount = files.filter((file) => file.relPath === 'index.html').length;
  if (rootIndexCount !== 1) {
    errors.push('В корне dist должен быть ровно один файл index.html.');
  }

  for (const file of files) {
    const parts = file.relPath.split('/');
    if (parts.some((part) => BAD_NAME_RE.test(part))) {
      errors.push(`В пути есть пробелы или кириллица: ${file.relPath}`);
    }
    if (parts.includes('node_modules')) {
      errors.push(`node_modules не должен попадать в сборку/архив: ${file.relPath}`);
    }
  }

  if (totalSize > OFFICIAL_LIMIT) {
    errors.push(
      `Размер dist в разархивированном виде ${formatBytes(totalSize)} превышает лимит Яндекс Игр ${formatBytes(OFFICIAL_LIMIT)}.`,
    );
  } else if (totalSize > SAFE_BUDGET) {
    warnings.push(
      `dist укладывается в официальный лимит, но больше внутреннего безопасного бюджета ${formatBytes(SAFE_BUDGET)}: ${formatBytes(totalSize)}.`,
    );
  }

  return { totalSize, errors, warnings };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimeDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function u16(value) {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

async function createZip(files, archivePath) {
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;
  const { dosTime, dosDate } = dosTimeDate();

  for (const file of files) {
    const raw = await readFile(file.fullPath);
    const compressed = deflateRawSync(raw, { level: 9 });
    const useDeflate = compressed.length < raw.length;
    const payload = useDeflate ? compressed : raw;
    const method = useDeflate ? 8 : 0;
    const name = Buffer.from(file.relPath, 'utf8');
    const crc = crc32(raw);

    const localHeader = Buffer.concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed to extract
      u16(0x0800), // UTF-8 names
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(raw.length),
      u16(name.length),
      u16(0), // extra length
      name,
    ]);

    chunks.push(localHeader, payload);

    const centralHeader = Buffer.concat([
      u32(0x02014b50), // central file header signature
      u16(20), // version made by
      u16(20), // version needed to extract
      u16(0x0800),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(raw.length),
      u16(name.length),
      u16(0), // extra length
      u16(0), // file comment length
      u16(0), // disk number start
      u16(0), // internal attributes
      u32(0), // external attributes
      u32(offset),
      name,
    ]);
    centralDirectory.push(centralHeader);
    offset += localHeader.length + payload.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralDirectory);
  const end = Buffer.concat([
    u32(0x06054b50), // end of central directory signature
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBuffer.length),
    u32(centralOffset),
    u16(0), // archive comment length
  ]);

  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(archivePath, Buffer.concat([...chunks, centralBuffer, end]));
}

async function main() {
  let distInfo;
  try {
    distInfo = await stat(DIST_DIR);
  } catch {
    throw new Error('Папка dist не найдена. Сначала запустите npm run build.');
  }
  if (!distInfo.isDirectory()) throw new Error('dist существует, но это не папка.');

  const files = await collectFiles(DIST_DIR);
  const { totalSize, errors, warnings } = validate(files);
  await validateSdkTag(files, errors);

  console.log(`Проверка dist для Яндекс Игр:`);
  console.log(`- файлов: ${files.length}`);
  console.log(`- размер до сжатия: ${formatBytes(totalSize)} / ${formatBytes(OFFICIAL_LIMIT)} официального лимита`);
  console.log(`- внутренний безопасный бюджет: ${formatBytes(SAFE_BUDGET)}`);

  for (const warning of warnings) console.warn(`⚠ ${warning}`);

  if (errors.length) {
    for (const error of errors) console.error(`✖ ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log('✓ dist подходит под требования архива Яндекс Игр.');

  if (shouldZip) {
    await createZip(files, ARCHIVE_PATH);
    const archiveInfo = await stat(ARCHIVE_PATH);
    console.log(`✓ Архив создан: ${path.relative(process.cwd(), ARCHIVE_PATH)} (${formatBytes(archiveInfo.size)})`);
    console.log('  Загружайте именно этот ZIP в Консоль Яндекс Игр, а не папку проекта и не node_modules.');
  }
}

main().catch((error) => {
  console.error(`✖ ${error.message}`);
  process.exit(1);
});
