/** M1: sun shader — bright beacon from afar, resolved photosphere up close. */
export default async function run({ app, shot, expect, sleep }) {
  await app(() => {
    const A = window.__APP__;
    A.setPaused(true);
    A.engine.camera.position.set(0, 8, 46);
    A.controls.target.set(0, 0, 0);
    A.controls.update();
  });
  await sleep(250);
  const disc = await app(() => window.__APP__.probe(770, 420, 60, 60));
  expect(disc.lum > 180, `sun disc is very bright (lum=${disc.lum.toFixed(1)})`);

  // Off-band deep space (the Milky Way band crosses the upper left).
  const corner = await app(() => window.__APP__.probe(1250, 840, 50, 50));
  expect(corner.lum < 30, `deep space stays dark (lum=${corner.lum.toFixed(1)})`);

  const halo = await app(() => window.__APP__.probe(1010, 450, 40, 40));
  expect(halo.lum > 3 && halo.lum < 200, `corona halo present (lum=${halo.lum.toFixed(1)})`);

  await shot('sun-far');

  // Fly close: photosphere should resolve (auto-exposure drops emissive),
  // so the disc is no longer uniformly saturated.
  await app(() => {
    const cam = window.__APP__.engine.camera;
    cam.position.set(0, 2.5, 14.5);
    cam.lookAt(0, 0, 0);
  });
  await sleep(400);
  const close = await app(() => window.__APP__.probe(700, 380, 220, 220));
  expect(close.lum > 120 && close.lum < 253, `close-up disc not clipped (lum=${close.lum.toFixed(1)})`);
  await shot('sun-close');
}
