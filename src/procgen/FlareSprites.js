import * as THREE from 'three';

/** Canvas-painted sprite textures: star glow, lens flare ghosts, streaks. */

function canvasTexture(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft radial glow with optional faint cross rays. */
export function makeGlowTexture({ inner = 'rgba(255,244,224,1)', mid = 'rgba(255,200,120,0.35)', size = 256, rays = true } = {}) {
  return canvasTexture((ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.12, mid);
    grad.addColorStop(0.45, mid.replace(/[\d.]+\)$/, '0.08)'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    if (rays) {
      ctx.globalCompositeOperation = 'lighter';
      for (const [w, l, a] of [[1.4, 0.85, 0.13], [0.9, 0.62, 0.10]]) {
        const ray = ctx.createLinearGradient(half - half * l, half, half + half * l, half);
        ray.addColorStop(0, 'rgba(255,230,200,0)');
        ray.addColorStop(0.5, `rgba(255,238,214,${a})`);
        ray.addColorStop(1, 'rgba(255,230,200,0)');
        ctx.fillStyle = ray;
        ctx.fillRect(half - half * l, half - w, s * l, w * 2);
        ctx.save();
        ctx.translate(half, half);
        ctx.rotate(Math.PI / 2);
        ctx.translate(-half, -half);
        ctx.fillRect(half - half * l, half - w, s * l, w * 2);
        ctx.restore();
      }
    }
  }, size);
}

/** Soft disc used for lens-flare ghosts. */
export function makeGhostTexture(tint = '200,220,255', size = 128) {
  return canvasTexture((ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${tint},0.55)`);
    grad.addColorStop(0.72, `rgba(${tint},0.18)`);
    grad.addColorStop(0.86, `rgba(${tint},0.30)`);
    grad.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }, size);
}

/** Wide anamorphic-style horizontal streak. */
export function makeStreakTexture(tint = '160,205,255', size = 256) {
  return canvasTexture((ctx, s) => {
    const half = s / 2;
    const grad = ctx.createLinearGradient(0, half, s, half);
    grad.addColorStop(0, `rgba(${tint},0)`);
    grad.addColorStop(0.5, `rgba(${tint},0.85)`);
    grad.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = grad;
    const h = s * 0.045;
    ctx.fillRect(0, half - h / 2, s, h);
    const soft = ctx.createLinearGradient(0, half, s, half);
    soft.addColorStop(0, `rgba(${tint},0)`);
    soft.addColorStop(0.5, `rgba(${tint},0.25)`);
    soft.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = soft;
    ctx.fillRect(0, half - h * 2.4, s, h * 4.8);
  }, size);
}

/** Tiny cross-shaped sparkle for bright catalog stars. */
export function makeStarSpikeTexture(size = 64) {
  return canvasTexture((ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 2); ctx.lineTo(half, s - 2);
    ctx.moveTo(2, half); ctx.lineTo(s - 2, half);
    ctx.stroke();
  }, size);
}

/** Plain soft dot (markers, particles). */
export function makeDotTexture(tint = '255,255,255', size = 64) {
  return canvasTexture((ctx, s) => {
    const half = s / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${tint},1)`);
    grad.addColorStop(0.5, `rgba(${tint},0.6)`);
    grad.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
  }, size);
}
