/** M2: Kepler propagation — ordering of angular speeds, determinism. */

const J2000 = 2451545.0;

function angleOf(pos) {
  return Math.atan2(-pos[2], pos[0]); // heliocentric longitude in scene XZ
}

function angDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export default async function run({ app, shot, expect, sleep }) {
  await app(() => window.__APP__.setPaused(true));

  const at = async (jd) => {
    await app((j) => window.__APP__.setJD(j), jd);
    await sleep(120);
    return app(() => ({
      mercury: window.__APP__.bodyPos('mercury'),
      earth: window.__APP__.bodyPos('earth'),
      neptune: window.__APP__.bodyPos('neptune'),
      jd: window.__APP__.info().jd,
    }));
  };

  const t0 = await at(J2000);
  const t1 = await at(J2000 + 30);

  const dMercury = Math.abs(angDelta(angleOf(t0.mercury), angleOf(t1.mercury)));
  const dEarth = Math.abs(angDelta(angleOf(t0.earth), angleOf(t1.earth)));
  const dNeptune = Math.abs(angDelta(angleOf(t0.neptune), angleOf(t1.neptune)));
  expect(dMercury > dEarth && dEarth > dNeptune,
    `angular speeds ordered: Mercury ${(dMercury * 57.3).toFixed(1)}° > Earth ${(dEarth * 57.3).toFixed(1)}° > Neptune ${(dNeptune * 57.3).toFixed(2)}° per 30d`);
  // Mercury starts near aphelion at J2000 (M~175°), so the true-longitude
  // sweep over these 30 days is ~98°, well below the 122.8° mean motion.
  expect(Math.abs(dMercury * 57.3 - 98) < 12, `Mercury ~98°/30d from aphelion (got ${(dMercury * 57.3).toFixed(1)}°)`);
  expect(Math.abs(dEarth * 57.3 - 29.6) < 5, `Earth ~29.6°/30d (got ${(dEarth * 57.3).toFixed(1)}°)`);

  // Determinism: same JD -> identical positions.
  const t0again = await at(J2000);
  const drift = Math.hypot(
    t0.earth[0] - t0again.earth[0],
    t0.earth[1] - t0again.earth[1],
    t0.earth[2] - t0again.earth[2]);
  expect(drift < 1e-9, `deterministic positions (drift=${drift.toExponential(2)})`);

  // Earth's didactic orbit radius ~100 units.
  const rEarth = Math.hypot(t0.earth[0], t0.earth[2]);
  expect(Math.abs(rEarth - 100) < 3, `didactic Earth orbit radius ~100u (got ${rEarth.toFixed(1)})`);

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);

  await shot('system');

  // Close on inner system.
  await app(() => {
    const cam = window.__APP__.engine.camera;
    cam.position.set(0, 90, 210);
    cam.lookAt(0, 0, 0);
  });
  await sleep(150);
  await shot('inner');
}
