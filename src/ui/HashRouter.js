import { lang, setLang } from './i18n.js';

/**
 * Deep links: #/<system>/<body>?lang=en&scale=true
 * Read on boot and on hashchange; written when selection/language/scale
 * change. Also the entry point the verification runner uses to jump into
 * defined states.
 */
export class HashRouter {
  constructor(app) {
    this.app = app;
    this._applying = false;
    window.addEventListener('hashchange', () => this.apply());
  }

  apply() {
    const h = window.location.hash;
    if (!h || h === '#') return;
    this._applying = true;
    try {
      const [pathPart, queryPart] = h.slice(1).split('?');
      const segs = pathPart.split('/').filter(Boolean);
      const params = new URLSearchParams(queryPart ?? '');
      const l = params.get('lang');
      if (l) setLang(l);
      if (params.get('scale')) {
        this.app.setScaleMode(params.get('scale') === 'true' ? 'true' : 'didactic');
      }
      const [systemId, bodyId] = segs;
      if (systemId && this.app.setSystem) this.app.setSystem(systemId);
      if (bodyId) this.app.select(bodyId);
      else if (systemId && !bodyId) this.app.deselect?.();
    } finally {
      this._applying = false;
    }
  }

  write() {
    if (this._applying) return;
    const app = this.app;
    const sys = app.system?.def?.id ?? 'sol';
    const body = app.selected ? `/${app.selected}` : '';
    const params = new URLSearchParams();
    if (lang() !== 'de') params.set('lang', lang());
    if (app.scale.mode !== 'didactic') params.set('scale', 'true');
    const q = params.toString();
    const next = `#/${sys}${body}${q ? `?${q}` : ''}`;
    if (window.location.hash !== next) {
      history.replaceState(null, '', next);
    }
  }
}
