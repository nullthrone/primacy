import { t, lang, setLang } from './i18n.js';

/**
 * Top bar (brand, breadcrumbs, language, settings), settings modal and the
 * glue that re-renders all UI pieces on language change.
 */
export class UI {
  constructor(app, { onOverview, systems = [], onSystem }) {
    this.app = app;
    this.onOverview = onOverview;
    this.systems = systems;
    this.onSystem = onSystem;

    this.topbar = document.getElementById('topbar');
    this.breadcrumbs = document.getElementById('breadcrumbs');
    this.systemSwitch = document.getElementById('system-switch');
    this.langBtn = document.getElementById('btn-lang');
    this.settingsBtn = document.getElementById('btn-settings');
    this.settingsRoot = document.getElementById('settings');

    this.langBtn.addEventListener('click', () => setLang(lang() === 'de' ? 'en' : 'de'));
    this.settingsBtn.addEventListener('click', () => this.openSettings());

    this.renderStatics();
  }

  setActiveSystem(id) {
    this.systemSwitch.innerHTML = this.systems.map((s) =>
      `<button type="button" data-id="${s}" class="${s === id ? 'active' : ''}">${t(`system.${s}`)}</button>`).join('');
    for (const b of this.systemSwitch.querySelectorAll('button')) {
      b.addEventListener('click', () => this.onSystem?.(b.dataset.id));
    }
  }

  renderStatics() {
    this.langBtn.textContent = lang() === 'de' ? 'EN' : 'DE';
    this.settingsBtn.title = t('ui.settings');
  }

  setBreadcrumbs(systemLabelKey, ctl) {
    const parts = [`<button type="button" class="crumb" data-act="overview">${t(systemLabelKey)}</button>`];
    if (ctl) {
      if (ctl.parent && ctl.parent.kind !== 'star' && ctl.parent.def) {
        const pKey = ctl.parent.def.i18n ?? `body.${ctl.parent.id}`;
        parts.push(`<button type="button" class="crumb" data-id="${ctl.parent.id}">${t(`${pKey}.name`)}</button>`);
      }
      const key = ctl.def.i18n ?? `body.${ctl.id}`;
      parts.push(`<span class="crumb current">${t(`${key}.name`)}</span>`);
    }
    this.breadcrumbs.innerHTML = parts.join('<span class="crumb-sep">›</span>');
    this.breadcrumbs.querySelector('[data-act="overview"]')?.addEventListener('click', this.onOverview);
    for (const b of this.breadcrumbs.querySelectorAll('.crumb[data-id]')) {
      b.addEventListener('click', () => this.app.select(b.dataset.id));
    }
  }

  openSettings() {
    const app = this.app;
    const seg = (id, options, current) => `
      <div class="seg" id="${id}">
        ${options.map(([val, label]) =>
          `<button type="button" data-v="${val}" class="${val === current ? 'active' : ''}">${label}</button>`).join('')}
      </div>`;

    this.settingsRoot.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <h3>${t('ui.settings')}</h3>
          <button class="icon-btn" id="settings-close" type="button" aria-label="${t('ui.close')}">×</button>
        </div>
        <div class="setting-row"><span>${t('ui.lang')}</span>
          ${seg('set-lang', [['de', 'Deutsch'], ['en', 'English']], lang())}</div>
        <div class="setting-row"><span>${t('ui.quality')}</span>
          ${seg('set-quality', [['high', t('ui.quality.high')], ['medium', t('ui.quality.medium')], ['low', t('ui.quality.low')]], app.qualityTier)}</div>
        <div class="setting-row"><span>${t('ui.labels')}</span>
          ${seg('set-labels', [['on', t('ui.on')], ['off', t('ui.off')]], app.labels.enabled ? 'on' : 'off')}</div>
        <div class="setting-row"><span>${t('ui.trails')}</span>
          ${seg('set-trails', [['on', t('ui.on')], ['off', t('ui.off')]], app.system.trailsEnabled ? 'on' : 'off')}</div>
        <div class="setting-row"><span>${t('ui.hz')}</span>
          ${seg('set-hz', [['on', t('ui.on')], ['off', t('ui.off')]], app.hzVisible ? 'on' : 'off')}</div>
      </div>`;
    this.settingsRoot.hidden = false;

    const wire = (id, fn) => {
      const el = this.settingsRoot.querySelector(`#${id}`);
      for (const b of el.querySelectorAll('button')) {
        b.addEventListener('click', () => {
          fn(b.dataset.v);
          for (const x of el.querySelectorAll('button')) x.classList.toggle('active', x === b);
        });
      }
    };
    wire('set-lang', (v) => setLang(v));
    wire('set-quality', (v) => app.applyQuality(v));
    wire('set-labels', (v) => { app.labels.enabled = v === 'on'; });
    wire('set-trails', (v) => app.system.setTrailsVisible(v === 'on'));
    wire('set-hz', (v) => app.setHZ(v === 'on'));
    this.settingsRoot.querySelector('#settings-close').addEventListener('click', () => {
      this.settingsRoot.hidden = true;
    });
    this.settingsRoot.addEventListener('click', (e) => {
      if (e.target === this.settingsRoot) this.settingsRoot.hidden = true;
    }, { once: true });
  }
}
