import { t } from './i18n.js';
import { TOURS } from '../data/tours.js';

/**
 * Plays guided tours: positions the camera per step, shows the narration
 * card, auto-advances with a progress bar. Prev/next/exit always visible.
 */
export class TourPlayer {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tour = null;
    this.stepIdx = 0;
    this._elapsed = 0;
    root.innerHTML = `
      <div class="tour-head">
        <span class="tour-title"></span>
        <span class="tour-step mono"></span>
        <button class="icon-btn tour-exit" type="button" aria-label="exit">×</button>
      </div>
      <p class="tour-text"></p>
      <div class="tour-progress"><div class="tour-bar"></div></div>
      <div class="tour-nav">
        <button class="tour-prev pill-btn" type="button">‹</button>
        <button class="tour-next pill-btn" type="button">›</button>
      </div>
    `;
    this.titleEl = root.querySelector('.tour-title');
    this.stepEl = root.querySelector('.tour-step');
    this.textEl = root.querySelector('.tour-text');
    this.barEl = root.querySelector('.tour-bar');
    root.querySelector('.tour-exit').addEventListener('click', () => this.stop());
    root.querySelector('.tour-prev').addEventListener('click', () => this.go(this.stepIdx - 1));
    root.querySelector('.tour-next').addEventListener('click', () => this.go(this.stepIdx + 1));
  }

  get running() {
    return !!this.tour;
  }

  start(tourId) {
    const tour = TOURS.find((x) => x.id === tourId);
    if (!tour) return false;
    this.tour = tour;
    this.root.hidden = false;
    this.go(0);
    return true;
  }

  go(idx) {
    if (!this.tour) return;
    if (idx < 0) idx = 0;
    if (idx >= this.tour.steps.length) {
      this.stop();
      return;
    }
    this.stepIdx = idx;
    this._elapsed = 0;
    const step = this.tour.steps[idx];
    const app = this.app;

    if (app.info().system !== step.system) {
      app.setSystem(step.system, { warp: true });
    }
    if (step.jd) app.setJD(step.jd);
    if (step.speed) app.setSpeed(step.speed);
    app.setPaused(false);
    // Give the (possible) warp a moment before the camera move.
    setTimeout(() => {
      if (!this.tour || this.tour.steps[this.stepIdx] !== step) return;
      if (step.overview) {
        app.overview();
      } else if (step.target) {
        const ctl = app.system?.controllers.get(step.target);
        if (ctl) {
          app.selected = step.target;
          app.rig.flyTo(ctl, { distanceFactor: step.dist ?? 4.2 });
        }
      }
      if (step.action === 'flare') {
        setTimeout(() => this.tour && app.triggerFlare(), 2600);
      }
    }, app.info().system !== step.system ? 900 : 0);

    this.render();
  }

  render() {
    if (!this.tour) return;
    this.titleEl.textContent = t(`${this.tour.i18n}.title`);
    this.stepEl.textContent = `${this.stepIdx + 1}/${this.tour.steps.length}`;
    this.textEl.textContent = t(this.tour.steps[this.stepIdx].textKey);
  }

  stop() {
    this.tour = null;
    this.root.hidden = true;
  }

  update(dt) {
    if (!this.tour) return;
    const step = this.tour.steps[this.stepIdx];
    this._elapsed += dt;
    const f = Math.min(1, this._elapsed / step.durationS);
    this.barEl.style.width = `${(f * 100).toFixed(1)}%`;
    if (f >= 1) this.go(this.stepIdx + 1);
  }
}
