/** M9: flare/CME/aurora chain, RV demo, knowledge mode. */
export const url = '/index.html?q=low#/proxima/proxima-b';

export default async function run({ app, page, shot, expect, sleep }) {
  await sleep(1500);

  // Trigger a flare and watch the chain.
  const triggered = await app(() => window.__APP__.triggerFlare());
  expect(triggered === true, `flare triggered`);
  await sleep(1200);
  const during = await app(() => {
    const A = window.__APP__;
    const star = A.system.star.body;
    return {
      flaring: A.isFlaring(),
      flareLevel: star.uniforms.uFlare.value,
      cmeVisible: A.system.scene ? true : true,
    };
  });
  expect(during.flaring, `flare in progress`);
  expect(during.flareLevel > 0.5, `photosphere spike (uFlare=${during.flareLevel.toFixed(2)})`);

  // Aurora response arrives after ~4.2 s of flare-sim time; headless
  // frames are slow, so poll instead of sleeping a fixed span.
  let aurora = 0;
  for (let i = 0; i < 40; i++) {
    await sleep(900);
    aurora = await app(() => {
      const ctl = window.__APP__.system.controllers.get('proxima-b');
      const aur = ctl.body.extras.find((e) => e.isAurora);
      return aur ? aur.mesh.material.uniforms.uResponse.value : -1;
    });
    if (aurora > 0.15) break;
    const still = await app(() => window.__APP__.isFlaring());
    if (!still) break;
  }
  expect(aurora > 0.15, `aurora responding (uResponse=${aurora.toFixed(2)})`);
  await shot('flare-aurora');

  // RV demo via the panel action button.
  await page.click('.panel-actions [data-act="rv"]');
  await sleep(300);
  const rvVisible = await page.evaluate(() => !document.getElementById('rv-panel').hidden);
  expect(rvVisible, `RV demo card visible`);
  await shot('rv-demo');

  // Knowledge mode: honest rendering + reduced fact sheet.
  const factsBefore = await page.evaluate(() => document.querySelectorAll('.fact').length);
  await page.click('.panel-actions [data-act="knowledge"]');
  await sleep(400);
  const state = await app(() => {
    const A = window.__APP__;
    const ctl = A.system.controllers.get('proxima-b');
    return {
      mode: A.knowledgeMode,
      matType: ctl.body.mesh.material.type,
      ringVisible: ctl.body.uncRing?.visible ?? false,
    };
  });
  const factsAfter = await page.evaluate(() => document.querySelectorAll('.fact').length);
  expect(state.mode === true, `knowledge mode on`);
  expect(state.matType === 'MeshStandardMaterial', `neutral material active (${state.matType})`);
  expect(state.ringVisible, `uncertainty ring shown`);
  expect(factsAfter < factsBefore, `fact sheet reduced (${factsBefore} -> ${factsAfter})`);
  await shot('knowledge-mode');

  // Ross 128 star shows the quiet chip.
  await app(() => window.__APP__.setSystem('ross128'));
  await sleep(600);
  await app(() => window.__APP__.select('ross128-star'));
  await sleep(1500);
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.panel-chips .chip')].map((e) => e.textContent));
  expect(chips.some((c) => /Ruhig|Quiet/.test(c)), `Ross 128 badged quiet (${chips.join(',')})`);

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
