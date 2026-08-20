#!/usr/bin/env node
/** Runs every milestone check in tools/verify/milestones/ in order. */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'milestones');
const scripts = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();

let failures = 0;
for (const f of scripts) {
  console.log(`\n=== ${f} ===`);
  const res = spawnSync('node', [join(here, 'serve-and-shoot.mjs'), join(dir, f)], {
    stdio: 'inherit',
  });
  if (res.status !== 0) failures++;
}
console.log(`\n${scripts.length - failures}/${scripts.length} milestone checks passed`);
process.exit(failures ? 1 : 0);
