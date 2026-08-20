import { t, fmt } from './i18n.js';

/**
 * Right-hand encyclopedia panel: name, type chip, knowledge badge, prose,
 * fact sheet from the body definition. Purely data-driven; re-renders on
 * language change.
 */
export class InfoPanel {
  constructor(root, { onClose, onAction = null, knowledgeActive = () => false }) {
    this.root = root;
    this.ctl = null;
    this.onAction = onAction;
    this.knowledgeActive = knowledgeActive;
    root.innerHTML = `
      <div class="panel-head">
        <div>
          <h2 class="panel-title"></h2>
          <div class="panel-chips"></div>
        </div>
        <button class="icon-btn panel-close" type="button" aria-label="close">×</button>
      </div>
      <div class="panel-scroll">
        <p class="panel-desc"></p>
        <div class="panel-actions"></div>
        <dl class="facts"></dl>
      </div>
    `;
    root.querySelector('.panel-close').addEventListener('click', onClose);
    this.titleEl = root.querySelector('.panel-title');
    this.chipsEl = root.querySelector('.panel-chips');
    this.descEl = root.querySelector('.panel-desc');
    this.actionsEl = root.querySelector('.panel-actions');
    this.factsEl = root.querySelector('.facts');
  }

  show(ctl) {
    this.ctl = ctl;
    this.root.hidden = false;
    this.render();
  }

  hide() {
    this.ctl = null;
    this.root.hidden = true;
  }

  render() {
    const ctl = this.ctl;
    if (!ctl) return;
    const def = ctl.def;
    const key = def.i18n ?? `body.${ctl.id}`;
    this.titleEl.textContent = t(`${key}.name`);

    const chips = [];
    const typeKey = def.star ? 'type.star' : `type.${def.type}`;
    chips.push(`<span class="chip">${t(typeKey)}</span>`);
    if (def.star) {
      chips.push(def.star.flareStar
        ? `<span class="chip warn">${t('ui.flareStar')}</span>`
        : `<span class="chip ok">${t('ui.quietStar')}</span>`);
    }
    if (def.knowledge?.certainty === 'msini') {
      chips.push(`<span class="chip warn">${t('ui.artistImpression')}</span>`);
    }
    if (def.knowledge?.certainty === 'candidate') {
      chips.push(`<span class="chip warn">${t('ui.candidate')}</span>`);
    }
    this.chipsEl.innerHTML = chips.join('');

    this.descEl.textContent = t(`${key}.desc`);

    // Contextual actions.
    const actions = [];
    if (def.star?.flareStar) {
      actions.push(`<button type="button" class="action-btn" data-act="flare">☀ ${t('ui.triggerFlare')}</button>`);
    }
    const isRV = def.knowledge?.certainty === 'msini' || def.knowledge?.certainty === 'candidate';
    if (isRV) {
      actions.push(`<button type="button" class="action-btn" data-act="rv">〜 ${t('ui.rvBtn')}</button>`);
      actions.push(`<button type="button" class="action-btn ${this.knowledgeActive() ? 'active' : ''}" data-act="knowledge">☰ ${t('ui.knowledge')}</button>`);
    }
    this.actionsEl.innerHTML = actions.join('');
    for (const b of this.actionsEl.querySelectorAll('.action-btn')) {
      b.addEventListener('click', () => this.onAction?.(b.dataset.act, ctl));
    }

    const honest = this.knowledgeActive() && isRV;

    const p = def.physical ?? {};
    const rows = [];
    const add = (label, value) => value != null && rows.push(
      `<div class="fact"><dt>${t(label)}</dt><dd>${value}</dd></div>`);

    if (def.star) {
      add('fact.spectral', def.star.spectral);
      if (def.star.distanceLy) add('fact.distance', `${fmt(def.star.distanceLy, 2)} ${t('fact.lyUnit')}`);
      add('fact.teff', `${fmt(def.star.teffK)} K`);
      if (def.star.luminositySun != null) add('fact.luminosity', `${fmt(def.star.luminositySun, 4)} L☉`);
      if (p.massE) add('fact.mass', `${fmt(p.massE / 333000, 3)} ${t('fact.solarMasses')}`);
    }
    if (p.radiusKm && !honest) add('fact.radius', `${fmt(p.radiusKm)} km`);
    if (!def.star && p.massE != null && def.knowledge?.certainty !== 'msini') {
      add('fact.mass', `${fmt(p.massE, p.massE < 0.01 ? 4 : 2)} ${t('fact.earthMasses')}`);
    }
    if (def.knowledge?.certainty === 'msini' && def.knowledge.mSinI != null) {
      add('fact.msini', `${fmt(def.knowledge.mSinI, 2)} ${t('fact.earthMasses')}`);
    }
    if (p.rotationH != null && !honest) {
      const h = Math.abs(p.rotationH);
      const label = h > 96 ? `${fmt(h / 24, 1)} ${t('fact.days')}` : `${fmt(h, 1)} ${t('fact.hours')}`;
      add('fact.rotation', p.rotationH < 0 ? `${label} (${t('fact.retrograde')})` : label);
    }
    if (p.tidallyLocked && !honest) add('fact.tidallyLocked', t('fact.yes'));
    if (p.obliquityDeg != null && !def.star && !honest) add('fact.obliquity', `${fmt(p.obliquityDeg, 1)}°`);
    if (p.tempK && !honest) {
      const tK = p.tempK;
      const c = (k) => `${fmt(k - 273.15)} °C`;
      add('fact.temp', tK.min != null && tK.max != null
        ? `${c(tK.min)} … ${c(tK.max)}`
        : c(tK.mean));
    }
    if (p.gravity && !honest) add('fact.gravity', `${fmt(p.gravity, 2)} m/s²`);
    if (def.elements) {
      const el = def.elements;
      const periodD = el.periodD;
      if (periodD) {
        add('fact.period', periodD > 800
          ? `${fmt(periodD / 365.25, 1)} ${t('fact.years')}`
          : `${fmt(periodD, 1)} ${t('fact.days')}`);
      }
      const a = el.a;
      if (a != null) {
        add('fact.sma', a < 0.05
          ? `${fmt(a * 149597870.7 / 1000, 0)} · 10³ km`
          : `${fmt(a, a < 1 ? 3 : 2)} AE`.replace('AE', document.documentElement.lang === 'de' ? 'AE' : 'AU'));
      }
      if (el.e != null) add('fact.ecc', fmt(el.e, 3));
    }
    if (p.discovery?.year) {
      add('fact.discoveryYear', String(p.discovery.year));
      if (p.discovery.method) add('fact.discoveryMethod', p.discovery.method);
    }
    this.factsEl.innerHTML = rows.join('');
  }
}
