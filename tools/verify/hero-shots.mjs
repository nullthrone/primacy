/**
 * Hero screenshots for README/docs at full quality (q=high, MSAA on).
 * Run: node tools/verify/serve-and-shoot.mjs tools/verify/hero-shots.mjs
 * Writes JPEGs into docs/screenshots/.
 */
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const url = '/index.html?q=high';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'screenshots');

export default async function run({ app, page, expect, sleep }) {
  mkdirSync(outDir, { recursive: true });
  const snap = async (name) => {
    await page.evaluate(() => { document.getElementById('photo-hint').style.display = 'none'; });
    await page.screenshot({ path: join(outDir, `${name}.jpg`), type: 'jpeg', quality: 88 });
    await page.evaluate(() => { document.getElementById('photo-hint').style.display = ''; });
    console.log(`  hero: ${name}`);
  };
  const hideUI = () => page.keyboard.press('p');

  await app(() => {
    window.__APP__.setPaused(true);
    window.__APP__.setJD(2451545.0);
    window.__APP__.setSpeed(0);
  });
  await sleep(1500);

  // --- Sol overview, slightly tilted ---
  await app(() => {
    const A = window.__APP__;
    A.engine.camera.position.set(140, 200, 480);
    A.controls.target.set(0, 0, 0);
    A.controls.update();
  });
  await sleep(1500);
  await hideUI();
  await sleep(400);
  await snap('hero-sol');

  // --- Saturn ---
  await hideUI(); // back to UI for select
  await app(() => window.__APP__.select('saturn'));
  await sleep(9000);
  await hideUI();
  await sleep(400);
  await snap('hero-saturn');
  await hideUI();

  // --- Earth terminator ---
  await app(() => {
    const A = window.__APP__;
    A.deselect();
    const p = A.bodyPos('earth');
    const toSun = [-p[0], -p[1], -p[2]];
    const len = Math.hypot(...toSun);
    const s = toSun.map((v) => v / len);
    const off = [-s[2], 0.22, s[0]];
    const ol = Math.hypot(...off);
    A.engine.camera.position.set(p[0] + off[0] / ol * 8.5, p[1] + off[1] / ol * 8.5, p[2] + off[2] / ol * 8.5);
    A.controls.target.set(p[0], p[1], p[2]);
    A.controls.update();
  });
  await sleep(2000);
  await hideUI();
  await sleep(400);
  await snap('hero-earth');
  await hideUI();

  // --- Proxima b with flare + aurora ---
  await app(() => window.__APP__.setSystem('proxima'));
  await sleep(2500);
  await app(() => window.__APP__.select('proxima-b'));
  await sleep(9000);
  await app(() => window.__APP__.triggerFlare());
  // Wait for aurora response.
  for (let i = 0; i < 40; i++) {
    await sleep(900);
    const r = await app(() => {
      const ctl = window.__APP__.system.controllers.get('proxima-b');
      const aur = ctl.body.extras.find((e) => e.isAurora);
      return aur ? aur.mesh.material.uniforms.uResponse.value : 0;
    });
    if (r > 0.5) break;
    const still = await app(() => window.__APP__.isFlaring());
    if (!still) break;
  }
  await hideUI();
  await sleep(400);
  await snap('hero-proxima-b');
  await hideUI();

  // --- Interstellar map ---
  await app(() => window.__APP__.setSystem('map'));
  await sleep(2500);
  await app(() => {
    const A = window.__APP__;
    A.engine.camera.position.set(120, 220, 420);
    A.controls.target.set(60, 0, 0);
    A.controls.update();
  });
  await sleep(1500);
  await hideUI();
  await sleep(400);
  await snap('hero-map');

  expect(true, 'hero shots captured');
}
