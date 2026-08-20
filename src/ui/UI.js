import { t, lang, setLang } from './i18n.js';

/**
 * Top bar (brand, breadcrumbs, language, settings), settings modal and the
 * glue that re-renders all UI pieces on language change.
 */
export class UI {
  constructor(app, { onOverview, systems = [], onSystem, tours = [], onTour, onCompare, onPhoto }) {
    this.app = app;
    this.onOverview = onOverview;
    this.systems = systems;
    this.onSystem = onSystem;
    this.tours = tours;
    this.onTour = onTour;
    this.onCompare = onCompare;
    this.onPhoto = onPhoto;

    this.topbar = document.getElementById('topbar');
    this.breadcrumbs = document.getElementById('breadcrumbs');
    this.systemSwitch = document.getElementById('system-switch');
    this.langBtn = document.getElementById('btn-lang');
    this.settingsBtn = document.getElementById('btn-settings');
    this.settingsRoot = document.getElementById('settings');
    this.toursBtn = document.getElementById('btn-tours');
    this.toursMenu = document.getElementById('tours-menu');
    this.compareBtn = document.getElementById('btn-compare');
    this.photoBtn = document.getElementById('btn-photo');

    this.langBtn.addEventListener('click', () => setLang(lang() === 'de' ? 'en' : 'de'));
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    this.toursBtn.addEventListener('click', () => this.toggleToursMenu());
    this.compareBtn.addEventListener('click', () => this.onCompare?.());
    this.photoBtn.addEventListener('click', () => this.onPhoto?.());
    document.addEventListener('pointerdown', (e) => {
      if (!this.toursMenu.hidden && !this.toursMenu.contains(e.target) && e.target !== this.toursBtn) {
        this.toursMenu.hidden = true;
      }
    });

    this.renderStatics();
  }

  toggleToursMenu() {
    if (!this.toursMenu.hidden) {
      this.toursMenu.hidden = true;
      return;
    }
    this.toursMenu.innerHTML = this.tours
      .map((id) => `<button type="button" data-id="${id}">${t(`tour.${id}.title`)}</button>`)
      .join('');
    for (const b of this.toursMenu.querySelectorAll('button')) {
      b.addEventListener('click', () => {
        this.toursMenu.hidden = true;
        this.onTour?.(b.dataset.id);
      });
    }
    this.toursMenu.hidden = false;
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
    this.toursBtn.title = t('ui.tours');
    this.compareBtn.title = t('ui.compare');
    this.photoBtn.title = t('ui.photo');
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
        <div class="setting-row"><span>${t('ui.knowledge')}</span>
          ${seg('set-knowledge', [['on', t('ui.on')], ['off', t('ui.off')]], app.knowledgeMode ? 'on' : 'off')}</div>
        <div class="setting-row"><span>${t('ui.probes')}</span>
          ${seg('set-probes', [['on', t('ui.on')], ['off', t('ui.off')]], app.probesVisible ? 'on' : 'off')}</div>
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
    wire('set-knowledge', (v) => app.setKnowledge(v === 'on'));
    wire('set-probes', (v) => app.setProbes(v === 'on'));
    this.settingsRoot.querySelector('#settings-close').addEventListener('click', () => {
      this.settingsRoot.hidden = true;
    });
    this.settingsRoot.addEventListener('click', (e) => {
      if (e.target === this.settingsRoot) this.settingsRoot.hidden = true;
    }, { once: true });
  }
}
