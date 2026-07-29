#!/usr/bin/env node
/**
 * make-release-zip.js
 * ---------------------------------------------------------------
 * Build a clean HACS release zip for hass-vanilla-boilerplate-card.
 *
 * HACS downloads the entire zip and copies it into
 *   config/www/community/hass-vanilla-boilerplate-card/
 * so the zip should contain ONLY the files that need to ship to
 * end users:
 *   - hass-vanilla-boilerplate-card.js   (the bundle)
 *   - hacs.json                          (HACS metadata)
 *
 * Anything else (rollup.config.js, src/, package.json, node_modules/,
 * .gitignore, *.map, .github/, etc.) is dev-only and should be
 * excluded. This keeps the user's `config/www/community/...`
 * directory clean and small.
 *
 * Usage:
 *   node scripts/make-release-zip.js
 *   # or
 *   npm run release          # builds + zips
 *
 * Output:
 *   dist/hass-vanilla-boilerplate-card.zip
 *   (zip is built from the project root with no internal dir)
 *
 * This script has zero runtime dependencies \u2014 it uses the built-in
 * `zlib` and a minimal zip writer implemented from scratch so we
 * don't have to add a `archiver`/`jszip` dev dependency.
 *
 * Note: PowerShell on Windows supports running this via
 *   node scripts\\make-release-zip.js
 * or via the npm script defined in package.json.
 */

import {
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
} from 'node:fs';
import { join, basename, relative } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Project root = parent of scripts/
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, '..');

// Files to include in the HACS release zip. Add to this list
// only if the file needs to be on the end user's machine.
const INCLUDE = [
  'hass-vanilla-boilerplate-card.js',
  'hacs.json',
];

// -------------------------------------------------------------------------
// Minimal ZIP writer (store + deflate, no zip64, no encryption).
// Implements the bare minimum needed for a valid PKZIP archive that
// every common decompressor (Windows Explorer, macOS Archive Utility,
// unzip, tar, PowerShell Expand-Archive) can read.
// -------------------------------------------------------------------------

/** Compute CRC-32 (polynomial 0xEDB88320) over a Buffer. */
function crc32(buf) {
  let table = crc32._table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    crc32._table = table;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Build a Buffer containing a complete .zip file from a list of
 * { name, data } entries. `name` should be a POSIX-style path
 * (forward slashes); we'll sanitize backslashes just in case.
 */
function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const cleanName = name.replace(/\\/g, '/');
    const nameBuf = Buffer.from(cleanName, 'utf8');
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    // Compress with raw deflate. We always emit deflate (method 8)
    // \u2014 every reader supports it, and a small JS file is tiny
    // enough that the per-entry overhead is negligible.
    const compressed = deflateRawSync(dataBuf, { level: 9 });
    const csize = compressed.length;
    const useDeflate = csize < size;
    const payload = useDeflate ? compressed : dataBuf;
    const method = useDeflate ? 8 : 0;

    // ---- Local file header (per entry) ----
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);             // version needed (2.0)
    local.writeUInt16LE(0, 6);              // general purpose bit flag
    local.writeUInt16LE(method, 8);        // compression method
    local.writeUInt16LE(0, 10);             // last mod file time
    local.writeUInt16LE(0x21, 12);          // last mod file date (1980-01-01)
    local.writeUInt32LE(crc, 14);           // crc-32
    local.writeUInt32LE(csize, 18);         // compressed size
    local.writeUInt32LE(size, 22);          // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28);             // extra field length
    localParts.push(local, nameBuf, payload);

    // ---- Central directory header (per entry) ----
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);  // central dir header signature
    central.writeUInt16LE(20, 4);           // version made by
    central.writeUInt16LE(20, 6);           // version needed
    central.writeUInt16LE(0, 8);            // gp bit flag
    central.writeUInt16LE(method, 10);      // compression method
    central.writeUInt16LE(0, 12);           // last mod time
    central.writeUInt16LE(0x21, 14);        // last mod date
    central.writeUInt32LE(crc, 16);         // crc-32
    central.writeUInt32LE(csize, 20);       // compressed size
    central.writeUInt32LE(size, 24);        // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // file name length
    central.writeUInt16LE(0, 30);           // extra field length
    central.writeUInt16LE(0, 32);           // comment length
    central.writeUInt16LE(0, 34);           // disk number start
    central.writeUInt16LE(0, 36);           // internal file attrs
    central.writeUInt32LE(0, 38);           // external file attrs
    central.writeUInt32LE(offset, 42);      // relative offset of local header
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  }

  const centralStart = offset;
  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);

  // ---- End of central directory record ----
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // EOCD signature
  eocd.writeUInt16LE(0, 4);                // disk number
  eocd.writeUInt16LE(0, 6);                // disk with central dir
  eocd.writeUInt16LE(entries.length, 8);   // entries on this disk
  eocd.writeUInt16LE(entries.length, 10);  // total entries
  eocd.writeUInt32LE(centralSize, 12);     // size of central dir
  eocd.writeUInt32LE(centralStart, 16);    // offset of central dir
  eocd.writeUInt16LE(0, 20);               // comment length

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

function main() {
  // Sanity check: every INCLUDE file must exist.
  const missing = INCLUDE.filter(
    (rel) => !exists(join(ROOT, rel)),
  );
  if (missing.length) {
    console.error('Cannot build release zip. Missing files:');
    for (const m of missing) {
      console.error('  -', m);
    }
    process.exit(1);
  }

  // Build the entry list.
  const entries = INCLUDE.map((rel) => ({
    name: rel,
    data: readFileSync(join(ROOT, rel)),
  }));

  // Generate the zip.
  const zipBuf = buildZip(entries);

  // Write to dist/<repo-name>.zip
  const outDir = join(ROOT, 'dist');
  const repoName = basename(ROOT);
  const outFile = join(outDir, repoName + '.zip');

  // Make dist/ if it doesn't exist.
  try { statSync(outDir); }
  catch { mkdirSync(outDir, { recursive: true }); }

  writeFileSync(outFile, zipBuf);

  console.log('Built HACS release zip:');
  console.log('  ' + relative(ROOT, outFile));
  console.log('  size: ' + zipBuf.length + ' bytes');
  console.log('  contains:');
  for (const e of entries) {
    console.log('    - ' + e.name + ' (' + e.data.length + ' bytes)');
  }
}

function exists(p) {
  try { statSync(p); return true; }
  catch { return false; }
}

main();
