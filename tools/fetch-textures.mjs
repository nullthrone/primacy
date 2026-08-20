#!/usr/bin/env node
/**
 * Downloads planet textures per tools/texture-manifest.json. Tries each
 * slot's candidates in order; a hit must pass size + magic-byte checks so
 * an HTML interstitial can never be committed as an image. Writes
 * assets/textures/manifest.json recording what resolved from where (the
 * site reads that file; missing slots fall back to procedural textures).
 *
 *   node tools/fetch-textures.mjs [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'assets', 'textures');
mkdirSync(outDir, { recursive: true });

const force = process.argv.includes('--force');
const spec = JSON.parse(readFileSync(join(here, 'texture-manifest.json'), 'utf8'));
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) && !force
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { generated: null, slots: {} };

function looksLikeImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif';
  if (buf.slice(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

async function tryFetch(url, minBytes) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) throw new Error(`too small (${buf.length} < ${minBytes})`);
  const ext = looksLikeImage(buf);
  if (!ext) throw new Error('not an image (magic bytes)');
  return { buf, ext };
}

let okCount = 0, skipCount = 0, failCount = 0;
for (const [slot, cfg] of Object.entries(spec.slots)) {
  const existing = manifest.slots[slot];
  if (existing && existsSync(join(outDir, existing.file)) && !force) {
    skipCount++;
    continue;
  }
  let resolved = null;
  for (const cand of cfg.candidates) {
    try {
      const { buf, ext } = await tryFetch(cand.url, cfg.minBytes ?? 4000);
      const file = `${slot}${ext}`;
      writeFileSync(join(outDir, file), buf);
      resolved = { file, url: cand.url, license: cand.license, bytes: buf.length, colorSpace: cfg.colorSpace ?? 'srgb' };
      console.log(`OK   ${slot} <- ${cand.url} (${(buf.length / 1024).toFixed(0)} KB)`);
      break;
    } catch (err) {
      console.log(`skip ${slot} candidate ${cand.url}: ${err.message}`);
    }
  }
  if (resolved) {
    manifest.slots[slot] = resolved;
    okCount++;
  } else {
    console.warn(`FAIL ${slot}: no candidate reachable — site will use procedural fallback`);
    failCount++;
  }
}

manifest.generated = 'fetch-textures';
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${okCount} fetched, ${skipCount} kept, ${failCount} missing -> ${manifestPath}`);
