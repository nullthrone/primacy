/**
 * M11: the chrome holds at phone, tablet and desktop sizes.
 *
 * Walks a set of real device viewports and, for each, opens every piece of
 * UI in turn (encyclopedia, contextual actions, RV card, tours popover and
 * card, settings modal). After each step it audits the DOM for
 *   - text or content spilling visibly out of its own box,
 *   - any chrome escaping the viewport,
 *   - the floating panels colliding with the top bar or the time bar.
 *
 * The overflow audit is the machine-checkable form of "labels stay inside
 * their boxes" — the German strings are the long ones, so it runs in the
 * default language.
 */

const VIEWPORTS = [
  { name: 'iphone-portrait', width: 393, height: 852 },
  { name: 'iphone-landscape', width: 852, height: 393 },
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1600, height: 900 },
];

/** Runs in the page: reports every element whose content leaves its box. */
function auditPage() {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const problems = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  // #labels is deliberately excluded: body labels track their body, so one
  // leaving the frame is correct — #labels clips them.
  const roots = ['#ui', '#photo-hint', '#compare-labels'];
  const seen = new Set();
  for (const sel of roots) {
    const root = document.querySelector(sel);
    if (!root || root.hidden) continue;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (seen.has(el) || el.hidden) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) continue;
      const label = describe(el);

      // 1. Content wider/taller than its own box, with nothing clipping it.
      const spillX = el.scrollWidth - el.clientWidth;
      const spillY = el.scrollHeight - el.clientHeight;
      if (cs.overflowX === 'visible' && spillX > 1 && el.clientWidth > 0) {
        problems.push(`${label}: content overflows horizontally by ${spillX}px`);
      }
      if (cs.overflowY === 'visible' && spillY > 1 && el.clientHeight > 0) {
        problems.push(`${label}: content overflows vertically by ${spillY}px`);
      }

      // 2. Anything reaching outside the viewport. Content parked outside a
      //    scroll container is reachable, so only unscrollable chrome counts.
      const scrollable = (axis) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const o = getComputedStyle(n)[axis === 'x' ? 'overflowX' : 'overflowY'];
          if (o === 'auto' || o === 'scroll') return true;
        }
        return false;
      };
      if (!scrollable('x')) {
        if (rect.right > vw + 1) problems.push(`${label}: ${Math.round(rect.right - vw)}px past the right edge`);
        if (rect.left < -1) problems.push(`${label}: ${Math.round(-rect.left)}px past the left edge`);
      }
      if (!scrollable('y')) {
        if (rect.bottom > vh + 1) problems.push(`${label}: ${Math.round(rect.bottom - vh)}px below the viewport`);
        if (rect.top < -1) problems.push(`${label}: ${Math.round(-rect.top)}px above the viewport`);
      }
    }
  }

  // 3. Floating panels must not collide with the fixed bars.
  const box = (s) => {
    const el = document.querySelector(s);
    if (!el || el.hidden || getComputedStyle(el).display === 'none') return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  const overlaps = (a, b) =>
    a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  const bars = { '#topbar': box('#topbar'), '#time-bar': box('#time-bar') };
  for (const panel of ['#nav-tree', '#info-panel', '#tour-card', '#rv-panel']) {
    const p = box(panel);
    if (!p) continue;
    for (const [barName, bar] of Object.entries(bars)) {
      if (bar && overlaps(p, bar)) problems.push(`${panel} overlaps ${barName}`);
    }
  }

  return problems;
}

/**
 * Waits for every finite CSS animation/transition to finish. Under software
 * WebGL the render loop starves the main thread, so a 200 ms entrance can
 * still be mid-flight seconds later — measuring then reports a panel 6 px
 * lower than where it comes to rest.
 */
async function settle(page, sleep) {
  await sleep(150);
  await page.evaluate(() => Promise.race([
    Promise.all(
      document.getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {}))
    ),
    new Promise((r) => setTimeout(r, 4000)),
  ]));
}

/** Opens each surface in turn; returns after the DOM has settled. */
async function scenarios(page, sleep) {
  const steps = [];
  const step = (label, fn) => steps.push({ label, fn });

  step('idle', async () => {});
  step('encyclopedia', async () => {
    // Tours in an earlier step may have moved us; Proxima b is the body with
    // the longest chips and the most contextual actions.
    await page.evaluate(() => {
      if (window.__APP__.info().system !== 'proxima') {
        window.__APP__.setSystem('proxima', { warp: false });
      }
    });
    await sleep(900);
    await page.evaluate(() => window.__APP__.select('proxima-b'));
    await sleep(500);
  });
  step('rv-card', async () => {
    await page.evaluate(() => {
      document.querySelector('.action-btn[data-act="rv"]')?.click();
    });
    await sleep(400);
  });
  step('tours-menu', async () => {
    await page.evaluate(() => {
      document.querySelector('.rv-close')?.click();
      document.getElementById('btn-tours').click();
    });
    await sleep(250);
  });
  step('tour-card', async () => {
    await page.evaluate(() => {
      const b = document.querySelector('#tours-menu button');
      if (b) b.click();
    });
    await sleep(900);
  });
  step('settings', async () => {
    await page.evaluate(() => {
      document.querySelector('.tour-exit')?.click();
      document.getElementById('btn-settings').click();
    });
    await sleep(300);
  });
  step('compare', async () => {
    await page.evaluate(() => document.getElementById('btn-compare').click());
    await sleep(700);
  });
  step('photo', async () => {
    await page.evaluate(() => {
      document.getElementById('btn-compare').click();
      document.getElementById('btn-photo').click();
    });
    await sleep(400);
  });
  step('close', async () => {
    await page.evaluate(() => document.getElementById('btn-photo').click());
    await page.evaluate(() => {
      document.querySelector('#settings-close')?.click();
      window.__APP__.deselect?.();
    });
    await sleep(250);
  });
  return steps;
}

export default async function run({ page, shot, expect, sleep }) {
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('500 12px Jost') && document.fonts.check('400 13px "Public Sans"');
  });
  expect(fontsOk, 'design-system webfonts loaded (Jost, Public Sans)');

  const theme = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    page: getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim(),
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
  }));
  expect(theme.attr === 'dark', `dark theme pinned on <html> (${theme.attr})`);
  expect(theme.accent.toUpperCase() === '#C89E4A', `brass accent resolves to the dark value (${theme.accent})`);

  await page.evaluate(() => window.__APP__.setSystem('proxima', { warp: false }));
  await sleep(1200);

  let total = 0;
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await settle(page, sleep);
    await sleep(300);
    for (const { label, fn } of await scenarios(page, sleep)) {
      await fn();
      await settle(page, sleep);
      if (label === 'encyclopedia') {
        const open = await page.evaluate(() => {
          const p = document.getElementById('info-panel');
          return !p.hidden && p.querySelectorAll('.action-btn').length > 0;
        });
        expect(open, `${vp.name}: encyclopedia panel actually opened`);
      }
      const problems = await page.evaluate(auditPage);
      total += problems.length;
      expect(problems.length === 0, `${vp.name} / ${label}: layout clean${
        problems.length ? ` — ${problems.join('; ')}` : ''}`);
      if (label === 'encyclopedia' || label === 'settings') {
        await shot(`${vp.name}-${label}`);
      }
    }
  }
  expect(total === 0, `no layout problems across ${VIEWPORTS.length} viewports`);
}
