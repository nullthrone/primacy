import { t, fmt } from './i18n.js';
import { jdFromDate, dateFromJD } from '../core/TimeEngine.js';

/**
 * Bottom bar: play/pause, log time-lapse slider, live date, date picker,
 * "today", scale toggle.
 */
export class TimeControls {
  constructor(root, { time, scale }) {
    this.time = time;
    this.scale = scale;
    root.innerHTML = `
      <button class="icon-btn tc-play" type="button"></button>
      <div class="tc-speed">
        <input class="tc-slider" type="range" min="0" max="1000" step="1">
        <span class="tc-speed-label mono"></span>
      </div>
      <div class="tc-date">
        <span class="tc-date-label mono"></span>
        <input class="tc-date-input" type="date" min="1800-01-02" max="2199-12-30">
        <button class="tc-now" type="button"></button>
      </div>
      <div class="tc-scale">
        <button class="tc-scale-btn" type="button" data-mode="didactic"></button>
        <button class="tc-scale-btn" type="button" data-mode="true"></button>
      </div>
    `;
    this.playBtn = root.querySelector('.tc-play');
    this.slider = root.querySelector('.tc-slider');
    this.speedLabel = root.querySelector('.tc-speed-label');
    this.dateLabel = root.querySelector('.tc-date-label');
    this.dateInput = root.querySelector('.tc-date-input');
    this.nowBtn = root.querySelector('.tc-now');
    this.scaleBtns = [...root.querySelectorAll('.tc-scale-btn')];

    this.playBtn.addEventListener('click', () => {
      time.setPaused(!time.paused);
      this.refreshStatics();
    });
    // Slider maps 0..1000 -> 1 s/s .. 10 My/s logarithmically.
    this.slider.addEventListener('input', () => {
      const v = Number(this.slider.value) / 1000;
      time.setSpeed(Math.round(Math.pow(10, v * 7)));
    });
    this.dateInput.addEventListener('change', () => {
      const d = this.dateInput.valueAsDate;
      if (d) time.setJD(jdFromDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12))));
    });
    this.nowBtn.addEventListener('click', () => time.setJD(jdFromDate(new Date())));
    for (const b of this.scaleBtns) {
      b.addEventListener('click', () => {
        scale.setMode(b.dataset.mode);
        this.refreshStatics();
      });
    }

    this.refreshStatics();
  }

  refreshStatics() {
    this.playBtn.textContent = this.time.paused ? '▶' : '⏸';
    this.playBtn.title = this.time.paused ? t('ui.pause') : t('ui.play');
    this.nowBtn.textContent = t('ui.now');
    for (const b of this.scaleBtns) {
      b.textContent = t(`ui.scale.${b.dataset.mode}`);
      b.title = t(`ui.scale.hint.${b.dataset.mode}`);
      b.classList.toggle('active', this.scale.mode === b.dataset.mode);
    }
    this.slider.value = String(Math.round((Math.log10(Math.max(1, this.time.speed)) / 7) * 1000));
  }

  /** Called every frame (cheap text updates only when changed). */
  update() {
    const s = this.time.speed;
    let label;
    if (s < 60) label = `${fmt(s)} s/s`;
    else if (s < 43200) label = `${fmt(s / 3600, 1)} ${t('ui.hoursPerSecond')}`;
    else if (s < 20e6) label = `${fmt(s / 86400, 1)} ${t('ui.daysPerSecond')}`;
    else label = `${fmt(s / (86400 * 365.25), 1)} ${t('ui.yearsPerSecond')}`;
    if (label !== this._lastSpeedLabel) {
      this.speedLabel.textContent = label;
      this._lastSpeedLabel = label;
    }
    const d = dateFromJD(this.time.jd);
    const iso = d.toISOString().slice(0, 10);
    if (iso !== this._lastDate) {
      this.dateLabel.textContent = iso;
      if (document.activeElement !== this.dateInput) this.dateInput.value = iso;
      this._lastDate = iso;
    }
  }
}
