import { de } from '../i18n/de.js';
import { en } from '../i18n/en.js';

const dicts = { de, en };
const listeners = new Set();
let current = (() => {
  try {
    const saved = localStorage.getItem('primacy.lang');
    if (saved === 'de' || saved === 'en') return saved;
  } catch { /* private mode */ }
  return 'de';
})();
document.documentElement.lang = current;

export function t(key) {
  return dicts[current][key] ?? dicts.en[key] ?? dicts.de[key] ?? key;
}

export function lang() {
  return current;
}

export function setLang(l) {
  if (l !== 'de' && l !== 'en') return;
  current = l;
  try { localStorage.setItem('primacy.lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  for (const fn of listeners) fn(l);
}

export function onLang(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const locale = () => (current === 'de' ? 'de-DE' : 'en-US');

export function fmt(n, digits = 0) {
  return new Intl.NumberFormat(locale(), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(date) {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(date);
}
