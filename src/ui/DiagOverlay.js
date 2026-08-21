/**
 * On-device diagnostics, enabled with ?diag=1. Renders a small live panel
 * with the GPU string, pipeline state, the sky-anchor delta and per-
 * quadrant counts of lit framebuffer pixels — enough to tell "the scene
 * is not rendered" apart from "the display crushes it to black" from a
 * single screenshot.
 */
export class DiagOverlay {
  constructor(engine, app) {
    this.engine = engine;
    this.app = app;
    this.el = document.createElement('pre');
    this.el.id = 'diag';
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '64px',
      right: '10px',
      zIndex: 200,
      margin: 0,
      padding: '10px 12px',
      font: '11px/1.5 ui-monospace, monospace',
      color: '#cfe0ff',
      background: 'rgba(4, 6, 12, 0.78)',
      border: '1px solid rgba(120, 150, 200, 0.35)',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });
    document.body.appendChild(this.el);

    this.errors = [];
    window.addEventListener('error', (e) => this._err(e.message));
    const origErr = console.error.bind(console);
    console.error = (...a) => { this._err(a.join(' ')); origErr(...a); };

    const gl = engine.gl;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const at = gl.getContextAttributes();
    this._attrs = `alpha:${at.alpha ? 1 : 0} pm:${at.premultipliedAlpha ? 1 : 0} aa:${at.antialias ? 1 : 0}`;

    this._quad = [0, 0, 0, 0];
    this._lastCount = 0;
    this._stats = { calls: 0, points: 0, triangles: 0 };
    engine.afterRender = () => this.update();
  }

  _err(msg) {
    this.errors.push(String(msg).slice(0, 90));
    if (this.errors.length > 3) this.errors.shift();
  }

  /** Lit pixels per screen quadrant + alpha stats from the current frame. */
  _countQuadrants() {
    const gl = this.engine.gl;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const q = [0, 0, 0, 0]; // TL TR BL BR in screen orientation
    let minA = 255, translucent = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const lum = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
        if (lum > 10) q[(y < h / 2 ? 2 : 0) + (x < w / 2 ? 0 : 1)]++;
        const alpha = buf[i + 3];
        if (alpha < minA) minA = alpha;
        if (alpha < 250) translucent++;
      }
    }
    this._alpha = { minA, translucent };
    return q;
  }

  update() {
    const now = performance.now();
    if (now - this._lastCount > 2000) {
      this._quad = this._countQuadrants();
      this._lastCount = now;
    }
    const e = this.engine;
    const a = this.app;
    const cam = e.camera.position;
    const sky = a.system?.sky?.group.position;
    const anchor = sky
      ? Math.hypot(sky.x - cam.x, sky.y - cam.y, sky.z - cam.z).toFixed(1)
      : 'n/a';
    const info = this._stats;
    Object.assign(info, e.renderer.info.render);
    const rt = e.composer.renderTarget1;
    this.el.textContent = [
      `gpu      ${this.gpu}`,
      `build    maxDist=${Math.round(a.controls.maxDistance)} q=${e.quality} tier=${a.qualityTier}`,
      `buffer   ${e.gl.drawingBufferWidth}x${e.gl.drawingBufferHeight} dpr=${e.renderer.getPixelRatio()} msaa=${rt?.samples}/${e.renderer.capabilities.maxSamples}`,
      `camera   ${[cam.x, cam.y, cam.z].map((v) => v.toFixed(0))} dist=${cam.distanceTo(a.controls.target).toFixed(0)}`,
      `skyanchor delta=${anchor}u  bloom=${e.bloomPass.enabled ? 'on' : 'off'}`,
      `draws    ${info.calls} calls ${info.points} pts ${(info.triangles / 1000).toFixed(1)}k tri fps=${e.fps.toFixed(0)}`,
      `lit/quad TL=${this._quad[0]} TR=${this._quad[1]} BL=${this._quad[2]} BR=${this._quad[3]}`,
      `alpha    ctx=${this._attrs} minA=${this._alpha?.minA ?? '-'} translucentPx=${this._alpha?.translucent ?? '-'}`,
      this.errors.length ? `errors   ${this.errors.join(' | ')}` : 'errors   none',
    ].join('\n');
  }
}
