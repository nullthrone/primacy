/** M3: textured planets — Earth terminator contrast, Saturn rings. */

function camNear(id, dist, perpendicular = true) {
  return `
    (() => {
      const A = window.__APP__;
      const p = A.bodyPos('${id}');
      const cam = A.engine.camera;
      const toSun = [-p[0], -p[1], -p[2]];
      const len = Math.hypot(...toSun);
      const s = toSun.map(v => v / len);
      // perpendicular-to-sun offset in the orbital plane
      const off = ${perpendicular}
        ? [-s[2], 0.25, s[0]]
        : [s[0], 0.25, s[2]];
      const olen = Math.hypot(...off);
      cam.position.set(
        p[0] + off[0] / olen * ${dist},
        p[1] + off[1] / olen * ${dist},
        p[2] + off[2] / olen * ${dist});
      A.controls.target.set(p[0], p[1], p[2]);
      A.controls.update();
    })()
  `;
}

export default async function run({ app, page, shot, expect, sleep }) {
  await app(() => {
    window.__APP__.setPaused(true);
    window.__APP__.setJD(2451545.0);
  });
  await sleep(350); // let a frame propagate the new JD into world positions

  // --- Earth: terminator splits day and night side ---
  await page.evaluate(camNear('earth', 9));
  await sleep(250);
  const left = await app(() => window.__APP__.probe(600, 450, 120, 90));
  const right = await app(() => window.__APP__.probe(880, 450, 120, 90));
  const bright = Math.max(left.lum, right.lum);
  const dark = Math.min(left.lum, right.lum);
  expect(bright > 40, `earth day side lit (lum=${bright.toFixed(1)})`);
  expect(bright / Math.max(dark, 1) > 2.2, `terminator contrast ${(bright / Math.max(dark, 1)).toFixed(1)}x`);
  await shot('earth');

  // --- Saturn: rings render around the disc ---
  await page.evaluate(camNear('saturn', 16));
  await sleep(250);
  const disc = await app(() => window.__APP__.probe(930, 450, 60, 60));
  expect(disc.lum > 25, `saturn disc lit (lum=${disc.lum.toFixed(1)})`);
  await shot('saturn');

  // --- Mars procedural/textured sanity ---
  await page.evaluate(camNear('mars', 6));
  await sleep(250);
  const mars = await app(() => window.__APP__.probe(700, 380, 200, 160));
  expect(mars.r > mars.b, `mars reads reddish (r=${mars.r.toFixed(0)} b=${mars.b.toFixed(0)})`);
  await shot('mars');

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
