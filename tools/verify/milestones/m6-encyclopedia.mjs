/** M6: encyclopedia UI — panel content DE/EN, nav, search, deep links. */
export const url = '/index.html?q=low#/sol/mars';

export default async function run({ app, page, shot, expect, sleep }) {
  await sleep(1200);

  // Deep link selected Mars and opened the panel (German default).
  const de = await page.evaluate(() => ({
    selected: window.__APP__.selected,
    title: document.querySelector('.panel-title')?.textContent,
    desc: document.querySelector('.panel-desc')?.textContent ?? '',
    facts: document.querySelectorAll('.fact').length,
    lang: document.documentElement.lang,
  }));
  expect(de.selected === 'mars', `deep link selected mars (${de.selected})`);
  expect(de.title === 'Mars', `panel title Mars`);
  expect(/Vulkan|Planet/.test(de.desc), `German prose present`);
  expect(de.facts >= 6, `fact sheet has ${de.facts} rows`);

  // Switch to English via the top bar button.
  await page.click('#btn-lang');
  await sleep(400);
  const enState = await page.evaluate(() => ({
    desc: document.querySelector('.panel-desc')?.textContent ?? '',
    lang: document.documentElement.lang,
    hash: window.location.hash,
  }));
  expect(enState.lang === 'en', `language switched to en`);
  expect(/volcano|planet/i.test(enState.desc), `English prose present`);
  expect(/lang=en/.test(enState.hash), `hash carries lang (${enState.hash})`);

  // Nav search: "eur" finds Europa; click selects it.
  await page.fill('.nav-search', 'eur');
  await sleep(250);
  const navTexts = await page.evaluate(() =>
    [...document.querySelectorAll('.nav-item')].map((e) => e.textContent.trim()));
  expect(navTexts.some((t) => /Europa/.test(t)), `search finds Europa (${navTexts.join(',')})`);
  await page.click('.nav-item[data-id="europa"]');
  await sleep(4500);
  const sel2 = await app(() => window.__APP__.selected);
  expect(sel2 === 'europa', `nav click selected europa (${sel2})`);

  // Breadcrumbs show Jupiter as parent.
  const crumbs = await page.evaluate(() =>
    [...document.querySelectorAll('.crumb')].map((e) => e.textContent.trim()));
  expect(crumbs.some((c) => /Jupiter/.test(c)), `breadcrumb shows parent Jupiter (${crumbs.join(' / ')})`);

  await shot('europa-panel');

  // Time controls: pause toggles.
  await page.click('.tc-play');
  await sleep(150);
  const paused = await app(() => window.__APP__.info().paused);
  expect(paused === true, `pause button pauses time`);

  const info = await app(() => window.__APP__.info());
  expect(info.calls < 150, `draw calls in budget (${info.calls})`);
}
