import * as THREE from 'three';
import { mulberry32 } from './Prng.js';

/**
 * Canvas-generated equirect planet textures. Used wherever a manifest slot
 * failed to download and for bodies that have no public real map (small
 * moons); the site stays fully functional with zero downloaded assets.
 * All generators are seeded -> deterministic across reloads.
 */

const W = 1024, H = 512;

export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = new Float32Array(256);
  for (let i = 0; i < 256; i++) grad[i] = rand() * 2 - 1;

  // Value noise with X wrap at `period` (longitude-seamless).
  function vnoise(x, y, period) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const px0 = ((xi % period) + period) % period;
    const px1 = (px0 + 1) % period;
    const h = (ix, iy) => grad[perm[(perm[ix & 255] + iy) & 255]];
    const a = h(px0, yi), b = h(px1, yi), c = h(px0, yi + 1), d = h(px1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, oct = 4, lac = 2, gain = 0.5, basePeriod = 8) {
    let f = 0, amp = 0.5, fx = x, fy = y, period = basePeriod;
    for (let o = 0; o < oct; o++) {
      f += amp * vnoise(fx, fy, period);
      fx *= lac; fy *= lac; period *= lac; amp *= gain;
    }
    return f;
  }
  return { rand, vnoise, fbm };
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

function mixColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/** Generic per-pixel painter over equirect UV. */
function paint(seed, fn) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const noise = makeNoise(seed);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const [r, g, b] = fn(u, v, noise);
      const i = (y * W + x) * 4;
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Stamp craters onto an existing canvas (rim light + floor shadow). */
function addCraters(canvas, seed, count, minR = 3, maxR = 26) {
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed ^ 0x9e3779b9);
  for (let i = 0; i < count; i++) {
    const cx = rand() * W;
    const cy = H * 0.06 + rand() * H * 0.88;
    const r = minR + rand() * rand() * (maxR - minR);
    const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    const depth = 0.16 + rand() * 0.2;
    g.addColorStop(0, `rgba(0,0,0,${depth})`);
    g.addColorStop(0.72, `rgba(0,0,0,${depth * 0.5})`);
    g.addColorStop(0.82, `rgba(255,255,255,${depth * 0.55})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (cx + r > W) { ctx.beginPath(); ctx.arc(cx - W, cy, r, 0, Math.PI * 2); ctx.fill(); }
    if (cx - r < 0) { ctx.beginPath(); ctx.arc(cx + W, cy, r, 0, Math.PI * 2); ctx.fill(); }
  }
}

function gasGiant(seed, palette, { bandFreq = 9, turb = 0.35, storms = [] } = {}) {
  const canvas = paint(seed, (u, v, { fbm }) => {
    const warp = fbm(u * 10, v * 6, 4) * turb + fbm(u * 26, v * 18, 3) * turb * 0.35;
    let t = v + warp * 0.16;
    const band = Math.sin(t * Math.PI * bandFreq) * 0.5 + 0.5;
    const fine = fbm(u * 42, v * 30, 3) * 0.08;
    let idx = band * (palette.length - 1);
    const i0 = Math.floor(idx), i1 = Math.min(palette.length - 1, i0 + 1);
    let c = mixColor(palette[i0], palette[i1], idx - i0);
    c = [c[0] + fine, c[1] + fine, c[2] + fine];
    return c;
  });
  const ctx = canvas.getContext('2d');
  for (const s of storms) {
    const g = ctx.createRadialGradient(s.x * W, s.y * H, 1, s.x * W, s.y * H, s.r * W);
    g.addColorStop(0, s.core);
    g.addColorStop(0.7, s.edge);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(s.x * W, s.y * H);
    ctx.scale(1, 0.55);
    ctx.translate(-s.x * W, -s.y * H);
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r * W, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}

const GENERATORS = {
  rock: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 9, v * 6, 5) * 0.5 + 0.5;
      const g = lerp(0.28, 0.55, n);
      return [g, g * 0.97, g * 0.93];
    });
    addCraters(c, seed, 260, 2, 20);
    return c;
  },
  'moon-rock': (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 7, v * 5, 5) * 0.5 + 0.5;
      const mare = fbm(u * 3.2, v * 2.4, 3) > 0.18 ? 0.72 : 1.0;
      const g = lerp(0.30, 0.62, n) * mare;
      return [g, g, g * 0.98];
    });
    addCraters(c, seed, 320, 2, 18);
    return c;
  },
  ceres: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 8, v * 6, 5) * 0.5 + 0.5;
      const g = lerp(0.22, 0.42, n);
      return [g, g * 0.98, g * 0.94];
    });
    addCraters(c, seed, 300, 2, 16);
    // Occator-like bright spots.
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed ^ 77);
    for (let i = 0; i < 3; i++) {
      const x = rand() * W, y = H * (0.3 + rand() * 0.3), r = 3 + rand() * 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,245,0.95)');
      g.addColorStop(1, 'rgba(255,255,245,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  },
  terra: (seed) => paint(seed, (u, v, { fbm }) => {
    const lat = Math.abs(v - 0.5) * 2;
    const n = fbm(u * 6, v * 4, 5);
    const land = n > 0.06;
    if (lat > 0.86 + fbm(u * 12, v * 8, 2) * 0.05) return [0.92, 0.95, 0.98];
    if (!land) {
      const depth = fbm(u * 12, v * 9, 3) * 0.5 + 0.5;
      return mixColor([0.05, 0.16, 0.35], [0.02, 0.09, 0.24], depth);
    }
    const veg = fbm(u * 14, v * 10, 4) * 0.5 + 0.5;
    const dry = lat * 0.7 + fbm(u * 5, v * 3, 3) * 0.3;
    return mixColor([0.12, 0.32, 0.10], [0.55, 0.45, 0.26], Math.max(0, dry - veg * 0.4));
  }),
  mars: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 8, v * 6, 5) * 0.5 + 0.5;
      const lat = Math.abs(v - 0.5) * 2;
      let col = mixColor([0.55, 0.26, 0.13], [0.72, 0.42, 0.24], n);
      if (lat > 0.9 + fbm(u * 10, v * 6, 2) * 0.03) col = [0.93, 0.90, 0.88];
      return col;
    });
    addCraters(c, seed, 160, 2, 12);
    return c;
  },
  venus: (seed) => paint(seed, (u, v, { fbm }) => {
    const swirl = fbm(u * 7 + fbm(u * 3, v * 2, 3) * 0.9, v * 5, 4) * 0.5 + 0.5;
    return mixColor([0.82, 0.66, 0.40], [0.96, 0.87, 0.64], swirl);
  }),
  'gasgiant-jupiter': (seed) => gasGiant(seed, [
    [0.78, 0.70, 0.58], [0.62, 0.48, 0.36], [0.88, 0.83, 0.72],
    [0.70, 0.55, 0.42], [0.83, 0.77, 0.66], [0.55, 0.42, 0.33],
  ], {
    bandFreq: 11, turb: 0.5,
    storms: [{ x: 0.68, y: 0.62, r: 0.045, core: 'rgba(196,88,60,0.95)', edge: 'rgba(160,70,50,0.4)' }],
  }),
  'gasgiant-saturn': (seed) => gasGiant(seed, [
    [0.86, 0.78, 0.60], [0.80, 0.70, 0.52], [0.90, 0.84, 0.68], [0.76, 0.66, 0.48],
  ], { bandFreq: 8, turb: 0.25 }),
  'icegiant-uranus': (seed) => gasGiant(seed, [
    [0.62, 0.83, 0.86], [0.56, 0.78, 0.83], [0.66, 0.87, 0.89],
  ], { bandFreq: 4, turb: 0.12 }),
  'icegiant-neptune': (seed) => gasGiant(seed, [
    [0.22, 0.38, 0.80], [0.28, 0.46, 0.88], [0.18, 0.32, 0.72],
  ], {
    bandFreq: 5, turb: 0.2,
    storms: [{ x: 0.4, y: 0.58, r: 0.03, core: 'rgba(16,24,64,0.9)', edge: 'rgba(20,30,80,0.3)' }],
  }),
  io: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 8, v * 6, 4) * 0.5 + 0.5;
      return mixColor([0.86, 0.78, 0.42], [0.94, 0.88, 0.62], n);
    });
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed ^ 913);
    for (let i = 0; i < 26; i++) {
      const x = rand() * W, y = H * (0.12 + rand() * 0.76), r = 4 + rand() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(30,20,12,0.85)');
      g.addColorStop(0.35, 'rgba(150,60,25,0.55)');
      g.addColorStop(0.8, 'rgba(200,120,40,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return c;
  },
  europa: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 5, v * 4, 4) * 0.5 + 0.5;
      return mixColor([0.80, 0.76, 0.68], [0.93, 0.91, 0.86], n);
    });
    const ctx = c.getContext('2d');
    const rand = mulberry32(seed ^ 517);
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(150,80,50,${0.12 + rand() * 0.25})`;
      ctx.lineWidth = 0.6 + rand() * 1.6;
      ctx.beginPath();
      let x = rand() * W, y = rand() * H;
      ctx.moveTo(x, y);
      const segs = 4 + Math.floor(rand() * 5);
      for (let s = 0; s < segs; s++) {
        x += (rand() - 0.5) * 260;
        y += (rand() - 0.5) * 90;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return c;
  },
  ganymede: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 6, v * 4, 5) * 0.5 + 0.5;
      const terrain = fbm(u * 3, v * 2.2, 3) > 0.05 ? 1.0 : 0.72;
      const g = lerp(0.32, 0.58, n) * terrain;
      return [g, g * 0.96, g * 0.90];
    });
    addCraters(c, seed, 150, 2, 10);
    return c;
  },
  callisto: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 7, v * 5, 5) * 0.5 + 0.5;
      const g = lerp(0.18, 0.38, n);
      return [g, g * 0.93, g * 0.85];
    });
    addCraters(c, seed, 380, 2, 14);
    return c;
  },
  titan: (seed) => paint(seed, (u, v, { fbm }) => {
    const n = fbm(u * 4, v * 3, 3) * 0.5 + 0.5;
    return mixColor([0.80, 0.55, 0.22], [0.90, 0.68, 0.32], n * 0.6 + v * 0.15);
  }),
  pluto: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 6, v * 4, 5) * 0.5 + 0.5;
      const heart = Math.hypot((u - 0.55) * 1.4, v - 0.55) < 0.16 + fbm(u * 9, v * 7, 2) * 0.04;
      if (heart) return mixColor([0.88, 0.83, 0.76], [0.95, 0.92, 0.86], n);
      return mixColor([0.48, 0.35, 0.25], [0.72, 0.60, 0.48], n);
    });
    addCraters(c, seed, 90, 2, 8);
    return c;
  },
  triton: (seed) => paint(seed, (u, v, { fbm }) => {
    const n = fbm(u * 6, v * 5, 4) * 0.5 + 0.5;
    const cant = fbm(u * 10, v * 12, 3) > 0.25 ? 0.92 : 1.0;
    return mixColor([0.72, 0.72, 0.70], [0.88, 0.86, 0.80], n).map((x) => x * cant);
  }),
  comet: (seed) => {
    const c = paint(seed, (u, v, { fbm }) => {
      const n = fbm(u * 10, v * 8, 5) * 0.5 + 0.5;
      const g = lerp(0.06, 0.22, n);
      return [g, g * 0.98, g * 0.95];
    });
    addCraters(c, seed, 120, 1, 6);
    return c;
  },
};

const cache = new Map();

/** Get (and cache) a procedural texture for an archetype. */
export function proceduralTexture(archetype, seed = 1) {
  const key = `${archetype}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const gen = GENERATORS[archetype] ?? GENERATORS.rock;
  const tex = toTexture(gen(seed));
  cache.set(key, tex);
  return tex;
}

export const PROCEDURAL_ARCHETYPES = Object.keys(GENERATORS);
