/**
 * Publishes the measured heights of the two fixed bars as CSS custom
 * properties (--topbar-h, --timebar-h) on <html>.
 *
 * The floating panels offset themselves against those bars. Predicting the
 * heights in the stylesheet is brittle — a wrapped top bar, a coarse-pointer
 * touch target or a longer system name all change them — so the bars size
 * themselves to their content and report back. The stylesheet keeps sane
 * defaults for the first paint.
 */
export function trackChromeMetrics(bars) {
  const root = document.documentElement;

  const write = () => {
    for (const [prop, el] of Object.entries(bars)) {
      if (!el) continue;
      const h = Math.round(el.getBoundingClientRect().height);
      // A hidden bar (compare mode, photo mode) reports 0 — keep the last
      // real value so the panels do not jump into the bar's place.
      if (h > 0) root.style.setProperty(prop, `${h}px`);
    }
  };

  const observer = new ResizeObserver(write);
  for (const el of Object.values(bars)) if (el) observer.observe(el);
  window.addEventListener('resize', write);
  write();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', write);
  };
}
