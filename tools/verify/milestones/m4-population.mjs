/** M4: moons, dwarfs, belts, comet. */

function look(id, dist, dy = 0.3) {
  return `
    (() => {
      const A = window.__APP__;
      const p = A.bodyPos('${id}');
      const cam = A.engine.camera;
      const toSun = [-p[0], -p[1], -p[2]];
      const len = Math.hypot(...toSun) || 1;
      const s = toSun.map(v => v / len);
      const off = [-s[2], ${dy}, s[0]];
      const ol = Math.hypot(...off);
      cam.position.set(p[0] + off[0]/ol*${dist}, p[1] + off[1]/ol*${dist}, p[2] + off[2]/ol*${dist});
      A.controls.target.set(p[0], p[1], p[2]);
      A.controls.update();
    })()
  `;
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export default async function run({ app, page, shot, expect, sleep }) {
  await app(() => {
    window.__APP__.setPaused(true);
    window.__APP__.setJD(2451545.0);
  });
  await sleep(150);

  // --- Jupiter family ---
  const fam = await app(() => ({
    j: window.__APP__.bodyPos('jupiter'),
    io: window.__APP__.bodyPos('io'),
    europa: window.__APP__.bodyPos('europa'),
    ganymede: window.__APP__.bodyPos('ganymede'),
    callisto: window.__APP__.bodyPos('callisto'),
    moon: window.__APP__.bodyPos('moon'),
    earth: window.__APP__.bodyPos('earth'),
    titan: window.__APP__.bodyPos('titan'),
    saturn: window.__APP__.bodyPos('saturn'),
    halley: window.__APP__.bodyPos('halley'),
  }));
  const dIo = dist3(fam.io, fam.j);
  const dCal = dist3(fam.callisto, fam.j);
  expect(dIo > 8 && dIo < 14, `Io orbit distance ~10.7u (got ${dIo.toFixed(1)})`);
  expect(dCal > 30 && dCal < 55, `Callisto orbit distance ~41u (got ${dCal.toFixed(1)})`);
  expect(dist3(fam.moon, fam.earth) > 9 && dist3(fam.moon, fam.earth) < 20,
    `Moon at ~13.7u from Earth (got ${dist3(fam.moon, fam.earth).toFixed(1)})`);
  expect(dist3(fam.titan, fam.saturn) > 18 && dist3(fam.titan, fam.saturn) < 34,
    `Titan at ~25.5u from Saturn (got ${dist3(fam.titan, fam.saturn).toFixed(1)})`);

  await page.evaluate(look('jupiter', 60, 0.5));
  await sleep(250);
  await shot('jupiter-family');

  // --- Comet at 1986 perihelion ---
  await app(() => window.__APP__.setJD(2446470.9));
  await sleep(200);
  const rHalley = await app(() => {
    const p = window.__APP__.bodyPos('halley');
    return Math.hypot(...p);
  });
  // Perihelion q = a(1-e) = 0.586 AU -> didactic ~100*0.586^0.4 = 80.7u
  expect(rHalley > 60 && rHalley < 95, `Halley near perihelion distance (got ${rHalley.toFixed(1)}u)`);

  await page.evaluate(look('halley', 26, 0.35));
  await sleep(300);
  const head = await app(() => window.__APP__.probe(700, 350, 250, 250));
  expect(head.lum > 4, `comet head/tail glow visible (lum=${head.lum.toFixed(1)})`);
  await shot('halley');

  // --- Belts: wide view, budget ---
  await app(() => {
    const A = window.__APP__;
    A.engine.camera.position.set(0, 420, 700);
    A.controls.target.set(0, 0, 0);
    A.controls.update();
  });
  await sleep(200);
  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
  expect(info.triangles < 2500000, `triangles in budget (${info.triangles})`);
  await shot('wide');
}
