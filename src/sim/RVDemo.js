import { t, fmt } from '../ui/i18n.js';

/**
 * Radial-velocity discovery mini-visualization: star wobble around the
 * barycenter (hugely exaggerated) + the RV sine curve with a live phase
 * cursor locked to the simulation clock. 2D canvas card.
 */
export class RVDemo {
  constructor(root, { time }) {
    this.root = root;
    this.time = time;
    this.params = null;
    root.innerHTML = `
      <div class="rv-head">
        <span class="rv-title"></span>
        <button class="icon-btn rv-close" type="button" aria-label="close">×</button>
      </div>
      <canvas class="rv-canvas" width="360" height="170"></canvas>
      <div class="rv-note"></div>
    `;
    this.canvas = root.querySelector('.rv-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.titleEl = root.querySelector('.rv-title');
    this.noteEl = root.querySelector('.rv-note');
    root.querySelector('.rv-close').addEventListener('click', () => this.hide());
    this.readTokens();
  }

  /**
   * The chart paints with the design-system tokens rather than its own
   * hexes: ink for the data, brass for the live marker, hairlines for the
   * grid. Re-read on show so a theme change is picked up.
   */
  readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    this.c = {
      data: v('--ink-950', '#EFEDE7'),
      marker: v('--brass-500', '#C89E4A'),
      grid: v('--ink-300', '#4C4952'),
      gridFaint: v('--ink-200', '#33313A'),
      label: v('--ink-500', '#8A8781'),
      mono: v('--font-mono', 'ui-monospace, monospace'),
    };
  }

  show({ name, periodD, kMS, epoch = 2451545.0 }) {
    this.params = { name, periodD, kMS, epoch };
    this.readTokens();
    this.root.hidden = false;
    this.titleEl.textContent = `${t('ui.rvShow')} — ${name}`;
    this.noteEl.textContent = `${t('ui.rvNote')} K = ${fmt(kMS, 2)} m/s · P = ${fmt(periodD, 2)} d · ${t('ui.rvWobble')}`;
  }

  hide() {
    this.params = null;
    this.root.hidden = true;
  }

  get visible() {
    return !this.root.hidden;
  }

  update() {
    if (!this.params) return;
    const { periodD, kMS, epoch } = this.params;
    const phase = (((this.time.jd - epoch) / periodD) % 1 + 1) % 1;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // --- Left: star wobble around barycenter ---
    const cx = 62, cy = H / 2 - 6, orbR = 34, starWobble = 9;
    const c = this.c;
    ctx.strokeStyle = c.grid;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = phase * Math.PI * 2;
    // Planet and star on opposite sides of the barycenter.
    const px = cx + Math.cos(a) * orbR, py = cy + Math.sin(a) * orbR;
    const sx = cx - Math.cos(a) * starWobble, sy = cy - Math.sin(a) * starWobble;
    // Flat marks, no glows: the planet in brass, the star as an ink disc.
    ctx.fillStyle = c.marker;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.data;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.label;
    ctx.font = `10px ${c.mono}`;
    ctx.fillText('+', cx - 3, cy + 4);

    // --- Right: RV curve ---
    const gx = 130, gw = W - gx - 14, gy = 24, gh = H - 58;
    ctx.strokeStyle = c.grid;
    ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
    ctx.strokeStyle = c.gridFaint;
    ctx.beginPath();
    ctx.moveTo(gx, gy + gh / 2);
    ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.stroke();

    ctx.strokeStyle = c.data;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= gw; i++) {
      const ph = i / gw;
      const v = Math.sin(ph * Math.PI * 2);
      const y = gy + gh / 2 - v * (gh / 2 - 8);
      if (i === 0) ctx.moveTo(gx + i, y);
      else ctx.lineTo(gx + i, y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    const cxr = gx + phase * gw;
    const cyr = gy + gh / 2 - Math.sin(phase * Math.PI * 2) * (gh / 2 - 8);
    ctx.strokeStyle = c.marker;
    ctx.beginPath();
    ctx.moveTo(cxr, gy);
    ctx.lineTo(cxr, gy + gh);
    ctx.stroke();
    ctx.fillStyle = c.marker;
    ctx.beginPath(); ctx.arc(cxr, cyr, 4, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = c.label;
    ctx.font = `10px ${c.mono}`;
    ctx.fillText(`+${fmt(this.params.kMS, 2)} m/s`, gx + 4, gy + 11);
    ctx.fillText(`-${fmt(this.params.kMS, 2)} m/s`, gx + 4, gy + gh - 4);
  }
}
