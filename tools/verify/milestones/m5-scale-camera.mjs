/** M5: fly-to/follow, picking, labels, true-scale mode with markers. */

export default async function run({ app, page, shot, expect, sleep }) {
  await app(() => {
    window.__APP__.setPaused(true);
    window.__APP__.setJD(2451545.0);
  });
  await sleep(350);

  // --- Fly to Saturn, follow ---
  await app(() => window.__APP__.select('saturn'));
  await sleep(7000);
  const afterFly = await app(() => {
    const A = window.__APP__;
    const p = A.bodyPos('saturn');
    const c = A.engine.camera.position;
    const r = A.system.controllers.get('saturn').body.displayRadius;
    return { d: Math.hypot(c.x - p[0], c.y - p[1], c.z - p[2]), r, sel: A.selected };
  });
  expect(afterFly.sel === 'saturn', `selection is saturn`);
  expect(afterFly.d < afterFly.r * 9, `camera arrived at Saturn (${(afterFly.d / afterFly.r).toFixed(1)} radii)`);
  await shot('saturn-followed');

  // --- Labels: Saturn label somewhere, count sane ---
  const labelInfo = await page.evaluate(() => {
    const on = [...document.querySelectorAll('.body-label.on')];
    return { count: on.length, texts: on.map((e) => e.textContent) };
  });
  expect(labelInfo.count >= 2 && labelInfo.count <= 22, `label count ${labelInfo.count} in range`);
  expect(labelInfo.texts.some((t) => /titan/i.test(t)), `Titan labeled near Saturn (${labelInfo.texts.join(',')})`);

  // --- True scale: Earth lands at ~149600 units, markers appear ---
  await app(() => window.__APP__.setScaleMode('true'));
  await sleep(5000);
  const trueState = await app(() => {
    const A = window.__APP__;
    const e = A.bodyPos('earth');
    return {
      blend: A.info().scaleBlend,
      rEarth: Math.hypot(e[0], e[2]),
      dSaturn: (() => {
        const p = A.bodyPos('saturn');
        const c = A.engine.camera.position;
        return Math.hypot(c.x - p[0], c.y - p[1], c.z - p[2]);
      })(),
      rSaturn: A.system.controllers.get('saturn').body.displayRadius,
    };
  });
  expect(trueState.blend === 1, `true-scale blend complete (${trueState.blend})`);
  expect(Math.abs(trueState.rEarth - 149600) < 4000, `Earth at ~1 AU = 149600u (got ${trueState.rEarth.toFixed(0)})`);
  expect(trueState.dSaturn < trueState.rSaturn * 30, `follow framing survived the rescale (${(trueState.dSaturn / trueState.rSaturn).toFixed(1)} radii)`);
  await shot('true-scale-saturn');

  // Point the camera at Earth from 3000u out: sub-pixel disc -> marker halo.
  const markers = await app(() => {
    const A = window.__APP__;
    A.deselect();
    const e = A.bodyPos('earth');
    A.engine.camera.position.set(e[0] + 500, e[1] + 400, e[2] + 2900);
    A.controls.target.set(e[0], e[1], e[2]);
    A.controls.update();
    A.labels.update();
    return A.debugMarkers();
  });
  expect(markers.includes('earth'), `Earth gets a marker halo at true scale (${markers.join(',')})`);

  // --- Click picking: click Titan's projected position ---
  await app(() => window.__APP__.setScaleMode('didactic'));
  await sleep(5000);
  const titanPx = await app(() => window.__APP__.bodyScreen('titan'));
  if (titanPx.z < 1 && titanPx.x > 0 && titanPx.x < 1600) {
    await page.mouse.click(titanPx.x, titanPx.y);
    await sleep(500);
    const sel = await app(() => window.__APP__.selected);
    expect(sel === 'titan', `click-picked titan (got ${sel})`);
  } else {
    expect(true, 'titan offscreen, click test skipped');
  }

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
