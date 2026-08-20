/** M8: catalog skies with parallax, Sun-from-Proxima, map + warp. */
export const url = '/index.html?q=low#/proxima';

export default async function run({ app, page, shot, expect, sleep }) {
  await sleep(1200);

  // Sun appears as a bright star in Cassiopeia from Proxima:
  // antipode of Proxima's position => RA ~2h29.8m, Dec ~+62.7, mag ~0.4.
  const sun = await app(() => window.__APP__.system.sky.sunApparent);
  expect(sun != null, `sunApparent computed`);
  if (sun) {
    expect(Math.abs(sun.raH - 2.5) < 0.15, `Sun RA from Proxima ~2.5h (got ${sun.raH.toFixed(2)}h)`);
    expect(Math.abs(sun.decDeg - 62.7) < 0.5, `Sun Dec from Proxima ~+62.7 (got ${sun.decDeg.toFixed(1)})`);
    expect(Math.abs(sun.mag - 0.4) < 0.35, `Sun mag from Proxima ~0.4 (got ${sun.mag.toFixed(2)})`);
  }

  // Alpha Cen A/B become dazzling (< -5 mag) in Proxima's sky: the
  // brightest catalog entries must beat anything in Sol's sky.
  const brightest = await app(() => {
    const colors = window.__APP__.system.sky.points.geometry.getAttribute('color');
    let max = 0;
    for (let i = 0; i < colors.count; i++) {
      const b = Math.max(colors.getX(i), colors.getY(i), colors.getZ(i));
      if (b > max) max = b;
    }
    return max;
  });
  expect(brightest >= 3.0, `dazzling double star present in Proxima sky (peak HDR ${brightest.toFixed(2)})`);

  await shot('proxima-sky');

  // Interstellar map: beacons exist, star field present.
  await app(() => window.__APP__.setSystem('map'));
  await sleep(800);
  const mapState = await app(() => ({
    system: window.__APP__.info().system,
    beacons: [...window.__APP__.system.controllers.keys()],
  }));
  expect(mapState.system === 'map', `switched to map`);
  expect(mapState.beacons.join(',') === 'sol,proxima,ross128', `three beacons (${mapState.beacons.join(',')})`);
  await shot('map');

  // Warp from the map into Sol via beacon selection.
  await app(() => window.__APP__.select('sol'));
  await sleep(3500);
  const after = await app(() => window.__APP__.info().system);
  expect(after === 'sol', `warp landed in sol (${after})`);
  await shot('after-warp');

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
