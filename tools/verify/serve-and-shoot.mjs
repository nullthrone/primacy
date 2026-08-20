#!/usr/bin/env node
/**
 * Milestone verification runner.
 *
 *   node tools/verify/serve-and-shoot.mjs tools/verify/milestones/m0-boot.mjs
 *
 * Serves the repo root with python3 http.server, opens the page in headless
 * Chromium, waits for window.__APP__.ready, then hands control to the
 * milestone module: `export default async (ctx) => { ... }` with optional
 * `export const url = '/index.html#...'`.
 *
 * ctx: { page, shot(name), app(fn, ...args), expect(cond, msg), sleep(ms) }
 *
 * Fails (exit 1) on any console error / page error not on the allowlist,
 * or on a failed expect().
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import net from 'node:net';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const outDir = process.env.VERIFY_OUT || join(here, 'out');
mkdirSync(outDir, { recursive: true });

const CONSOLE_ERROR_ALLOWLIST = [
  /Failed to load resource.*favicon/i,
  /WebGL.*GPU stall/i,
  /Automatic fallback to software WebGL/i,
  /GroupMarkerNotSet/i,
];

async function loadPlaywright() {
  const candidates = [
    'playwright',
    'playwright-core',
    pathToFileURL('/opt/node22/lib/node_modules/playwright/index.mjs').href,
  ];
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not importable — npm i -D playwright-core');
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

async function waitForServer(port, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise((res) => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); res(true); });
      s.on('error', () => res(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('http.server did not come up');
}

const scriptPath = process.argv[2];
if (!scriptPath) {
  console.error('usage: serve-and-shoot.mjs <milestone.mjs> [urlOverride]');
  process.exit(2);
}
const milestone = await import(pathToFileURL(resolve(scriptPath)).href);
const name = basename(scriptPath, '.mjs');
let urlPath = process.argv[3] || milestone.url || '/index.html';
// Headless SwiftShader is far too slow with 8x MSAA — default the runner
// to the low-quality profile unless a milestone insists otherwise.
if (!/[?&]q=/.test(urlPath)) {
  urlPath += (urlPath.includes('?') ? '&' : '?') + 'q=low';
}

const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: process.env.SERVE_ROOT || root,
  stdio: 'ignore',
});

const consoleErrors = [];
const consoleAll = [];
let browser;
let failed = false;

try {
  await waitForServer(port);
  const { chromium } = await loadPlaywright();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  page.on('console', (msg) => {
    const text = msg.text();
    consoleAll.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' && !CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) {
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(`http://127.0.0.1:${port}${urlPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__APP__ && window.__APP__.ready === true, null, { timeout: 45000 });

  const ctx = {
    page,
    outDir,
    shot: async (label) => {
      const file = join(outDir, `${name}-${label}.png`);
      await page.screenshot({ path: file });
      console.log(`  shot: ${file}`);
      return file;
    },
    app: (fn, ...args) => page.evaluate(fn, ...args),
    expect: (cond, msg) => {
      if (!cond) {
        failed = true;
        console.error(`  EXPECT FAILED: ${msg}`);
      } else {
        console.log(`  ok: ${msg}`);
      }
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };

  if (typeof milestone.default === 'function') {
    await milestone.default(ctx);
  }
} catch (err) {
  failed = true;
  console.error(`  RUNNER ERROR: ${err.message}`);
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
}

if (consoleErrors.length) {
  failed = true;
  console.error(`  CONSOLE ERRORS (${consoleErrors.length}):`);
  for (const e of consoleErrors.slice(0, 12)) console.error(`    ${e}`);
}

console.log(failed ? `FAIL ${name}` : `PASS ${name}`);
process.exit(failed ? 1 : 0);
