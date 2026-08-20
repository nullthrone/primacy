/** M10: tours, compare mode, probe trajectories, photo mode. */
export const url = '/index.html?q=low';

export default async function run({ app, page, shot, expect, sleep }) {
  await sleep(800);

  // Probe trajectories exist in Sol.
  const traj = await page.evaluate(() => {
    const A = window.__APP__;
    const grp = A.system.scene.getObjectByName('probes');
    return { present: !!grp, children: grp?.children.length ?? 0, visible: grp?.visible ?? false };
  });
  expect(traj.present && traj.children >= 6, `probe trajectories present (${traj.children} objects)`);
  expect(traj.visible, `probes visible by default`);

  // Start the Ross tour via the tours menu.
  await page.click('#btn-tours');
  await sleep(200);
  const menuItems = await page.evaluate(() =>
    [...document.querySelectorAll('#tours-menu button')].map((b) => b.textContent));
  expect(menuItems.length === 3, `three tours listed (${menuItems.join(' | ')})`);
  await page.click('#tours-menu button[data-id="ross"]');
  await sleep(2500);
  const tourState = await page.evaluate(() => ({
    cardVisible: !document.getElementById('tour-card').hidden,
    text: document.querySelector('.tour-text')?.textContent ?? '',
    system: window.__APP__.info().system,
  }));
  expect(tourState.cardVisible, `tour card visible`);
  expect(/Arecibo|Ross 128/.test(tourState.text), `narration present`);
  expect(tourState.system === 'ross128', `tour warped to ross128 (${tourState.system})`);
  await shot('tour');
  await page.click('.tour-exit');
  await sleep(200);

  // Compare mode.
  await page.click('#btn-compare');
  await sleep(500);
  const compare = await page.evaluate(() => ({
    labels: document.querySelectorAll('.compare-label').length,
  }));
  expect(compare.labels >= 7, `compare captions rendered (${compare.labels})`);
  const discs = await app(() => window.__APP__.probe(700, 400, 300, 200));
  expect(discs.lum > 8, `compare stage renders (lum=${discs.lum.toFixed(1)})`);
  await shot('compare');
  await page.click('#btn-compare');
  await sleep(300);

  // Photo mode hides the chrome.
  await page.keyboard.press('p');
  await sleep(300);
  const photo = await page.evaluate(() => ({
    uiHidden: getComputedStyle(document.getElementById('ui')).display === 'none',
    hintVisible: !document.getElementById('photo-hint').hidden,
  }));
  expect(photo.uiHidden, `UI hidden in photo mode`);
  expect(photo.hintVisible, `photo hint shown`);
  await page.keyboard.press('Escape');
  await sleep(200);
  const uiBack = await page.evaluate(() =>
    getComputedStyle(document.getElementById('ui')).display !== 'none');
  expect(uiBack, `UI restored after photo mode`);

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 160, `draw calls in budget (${info.calls})`);
}
