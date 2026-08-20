#!/usr/bin/env node
/**
 * Vendors three.js into vendor/three/ so the site runs with zero CDN
 * dependencies. Downloads the npm tarball, extracts the module build and
 * the subset of examples/jsm addons the app imports, preserving relative
 * paths so the "three/addons/" import-map prefix keeps working.
 *
 * Usage: node tools/vendor-three.mjs [version]
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = process.argv[2] ?? '0.185.1';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(root, '.vendor-work');
const dest = join(root, 'vendor', 'three');

const ADDONS = [
  'controls/OrbitControls.js',
  'objects/Lensflare.js',
  'postprocessing/EffectComposer.js',
  'postprocessing/Pass.js',
  'postprocessing/MaskPass.js',
  'postprocessing/RenderPass.js',
  'postprocessing/ShaderPass.js',
  'postprocessing/UnrealBloomPass.js',
  'postprocessing/OutputPass.js',
  'shaders/CopyShader.js',
  'shaders/LuminosityHighPassShader.js',
  'shaders/OutputShader.js',
];

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

console.log(`Downloading three@${VERSION} tarball ...`);
execSync(`npm pack three@${VERSION} --pack-destination "${work}"`, { stdio: 'inherit' });
execSync(`tar -xzf "${join(work, `three-${VERSION}.tgz`)}" -C "${work}"`, { stdio: 'inherit' });
const pkg = join(work, 'package');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// Core module build. Since r167 three.module.js re-exports ./three.core.js.
for (const f of ['three.module.js', 'three.core.js']) {
  const src = join(pkg, 'build', f);
  if (existsSync(src)) {
    cpSync(src, join(dest, f));
    console.log(`vendored build/${f}`);
  }
}

let count = 0;
for (const rel of ADDONS) {
  const src = join(pkg, 'examples', 'jsm', rel);
  if (!existsSync(src)) {
    console.warn(`MISSING addon: ${rel}`);
    continue;
  }
  const out = join(dest, 'addons', rel);
  mkdirSync(dirname(out), { recursive: true });
  cpSync(src, out);
  count++;
}
console.log(`vendored ${count}/${ADDONS.length} addons`);

// Record provenance for ASSETS.md bookkeeping.
const meta = { package: 'three', version: VERSION, license: 'MIT', source: 'https://www.npmjs.com/package/three' };
writeFileSync(join(dest, 'VENDORED.json'), JSON.stringify(meta, null, 2) + '\n');

rmSync(work, { recursive: true, force: true });
console.log('done.');
