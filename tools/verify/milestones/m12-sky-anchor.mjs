/**
 * M12: the background sky exists at every reachable camera position, and
 * the camera cannot be lost in the void (regression check for the
 * "nothing visible except UI" blank-frame bug).
 */

export default async function run({ app, shot, expect, sleep }) {
  await app(() => {
    window.__APP__.setPaused(true);
    window.__APP__.setJD(2451545.0);
  });
  await sleep(400);

  // Render once, then count GL pixels bright enough to be scene content
  // (stars, bodies, trails). The void clears to ~(1,2,8): dither noise
  // never reaches the threshold, so a blank frame counts ~0.
  const probeFrame = () => app(() => {
    const A = window.__APP__;
    A.probe(0, 0, 1, 1); // forces a synchronous renderFrame
    const gl = A.engine.gl;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let lit = 0;
    for (let i = 0; i < w * h; i++) {
      const lum = 0.2126 * buf[i * 4] + 0.7152 * buf[i * 4 + 1] + 0.0722 * buf[i * 4 + 2];
      if (lum > 30) lit++;
    }
    const c = A.engine.camera.position;
    return { lit, camDist: c.distanceTo(A.controls.target), targetR: A.controls.target.length() };
  });

  // 1) Baseline: didactic overview.
  const base = await probeFrame();
  expect(base.lit > 2000, `overview frame has content (${base.lit} lit px)`);

  // 2) Didactic escape attempt far past the sky dome radius: the bounds
  //    reel the camera back in and the frame still shows the system.
  await app(() => {
    const A = window.__APP__;
    A.deselect();
    A.engine.camera.position.set(60000, 5000, 0);
    A.controls.target.set(75000, 5000, 0);
  });
  await sleep(400);
  const reeled = await probeFrame();
  console.log(`  didactic escape: lit ${reeled.lit} camDist ${reeled.camDist.toFixed(0)} targetR ${reeled.targetR.toFixed(0)}`);
  expect(reeled.camDist < 4100, `camera reeled inside didactic max distance (${reeled.camDist.toFixed(0)}u)`);
  expect(reeled.targetR < 2100, `pan target clamped to the world (${reeled.targetR.toFixed(0)}u)`);
  expect(reeled.lit > 500, `frame after reel-in shows content (${reeled.lit} lit px)`);
  await shot('didactic-reeled-in');

  // 3) True scale near Earth (~150k u from origin, outside the sky dome
  //    radius), looking away from the sun: the sky must still be there.
  await app(() => window.__APP__.setScaleMode('true'));
  await sleep(2500);
  await app(() => {
    const A = window.__APP__;
    const e = A.bodyPos('earth');
    A.engine.camera.position.set(e[0] * 1.001, e[1] + 200, e[2] * 1.001);
    A.controls.target.set(e[0] * 1.01, e[1] + 200, e[2] * 1.01);
  });
  await sleep(400);
  const nearEarth = await probeFrame();
  console.log(`  true-scale earth sky: lit ${nearEarth.lit}`);
  expect(nearEarth.lit > 300, `sky visible near true-scale Earth (${nearEarth.lit} lit px)`);
  await shot('true-earth-sky');

  // 4) True scale, camera deep in the outer system looking sideways:
  //    the background persists at extreme (but legal) camera positions.
  await app(() => {
    const A = window.__APP__;
    A.engine.camera.position.set(3.0e6, 2e5, 0);
    A.controls.target.set(3.0e6, 2e5, 5e4);
  });
  await sleep(400);
  const farOut = await probeFrame();
  console.log(`  true-scale far-out sky: lit ${farOut.lit}`);
  expect(farOut.lit > 300, `sky visible from the deep outer system (${farOut.lit} lit px)`);
  await shot('true-farout-sky');
}
