/** M0: the app boots, renders something, exposes the debug API. */
export default async function run({ app, shot, expect }) {
  const info = await app(() => window.__APP__.info());
  expect(info.calls > 0, `renderer did work (calls=${info.calls})`);
  expect(Number.isFinite(info.jd) && info.jd > 2460000, `JD plausible (${info.jd.toFixed(2)})`);

  const center = await app(() => window.__APP__.probe(760, 410, 80, 80));
  expect(center.lum > 8, `center of frame is lit (lum=${center.lum.toFixed(1)})`);

  const corner = await app(() => window.__APP__.probe(10, 10, 40, 40));
  expect(corner.lum < 30, `corner is dark space (lum=${corner.lum.toFixed(1)})`);

  await shot('boot');
}
