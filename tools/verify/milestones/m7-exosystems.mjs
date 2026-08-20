/** M7: Proxima + Ross 128 systems, eyeball shader, tidal lock, HZ rings. */
export const url = '/index.html?q=low#/proxima';

export default async function run({ app, page, shot, expect, sleep }) {
  await sleep(1200);

  const state = await app(() => window.__APP__.info());
  expect(state.system === 'proxima', `deep link switched to proxima (${state.system})`);

  const bodies = await app(() => window.__APP__.listBodies());
  expect(bodies.includes('proxima-b') && bodies.includes('proxima-c') && bodies.includes('proxima-d'),
    `proxima bodies present (${bodies.join(',')})`);

  // Tidal lock: substellar longitude of b stays fixed relative to the star
  // across time -> the object-space star direction must stay constant.
  await app(() => { window.__APP__.setPaused(true); window.__APP__.setJD(2451545.0); });
  await sleep(400);
  const lockA = await app(() => {
    const A = window.__APP__;
    const ctl = A.system.controllers.get('proxima-b');
    const u = ctl.body.material.uniforms.uStarDirObj.value;
    return [u.x, u.y, u.z];
  });
  await app(() => window.__APP__.setJD(2451545.0 + 3.7));
  await sleep(400);
  const lockB = await app(() => {
    const A = window.__APP__;
    const ctl = A.system.controllers.get('proxima-b');
    const u = ctl.body.material.uniforms.uStarDirObj.value;
    return [u.x, u.y, u.z];
  });
  const drift = Math.hypot(lockA[0] - lockB[0], lockA[1] - lockB[1], lockA[2] - lockB[2]);
  expect(drift < 0.25, `tidal lock holds: substellar direction drift ${drift.toFixed(3)} (libration only)`);

  // Fly to Proxima b: eyeball day/night dichotomy.
  await app(() => window.__APP__.select('proxima-b'));
  await sleep(6000);
  await shot('proxima-b');
  const sel = await app(() => window.__APP__.selected);
  expect(sel === 'proxima-b', `selected proxima-b`);

  // Star color: the red dwarf disc should read warm (r >> b).
  await app(() => window.__APP__.deselect());
  await app(() => {
    const A = window.__APP__;
    A.engine.camera.position.set(0, 4, 26);
    A.controls.target.set(0, 0, 0);
    A.controls.update();
  });
  await sleep(400);
  const disc = await app(() => window.__APP__.probe(760, 420, 80, 80));
  expect(disc.r > disc.b * 1.15, `red dwarf renders warm (r=${disc.r.toFixed(0)} b=${disc.b.toFixed(0)})`);
  await shot('proxima-star');

  // Ross 128 via the system switcher UI.
  await page.click('#system-switch button[data-id="ross128"]');
  await sleep(800);
  const ross = await app(() => ({
    system: window.__APP__.info().system,
    bodies: window.__APP__.listBodies(),
  }));
  expect(ross.system === 'ross128', `switched to ross128`);
  expect(ross.bodies.includes('ross128-b'), `ross128-b present`);
  await app(() => window.__APP__.select('ross128-b'));
  await sleep(6000);
  await shot('ross128-b');

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
