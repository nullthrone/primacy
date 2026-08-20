import * as THREE from 'three';
import { Prng } from '../procgen/Prng.js';
import { makeNoise } from '../procgen/ProceduralTextures.js';

export const SKY_RADIUS = 40000;
const OBLIQUITY = THREE.MathUtils.degToRad(23.4368);

/** Equatorial (RA/Dec, degrees) + distance (pc) -> equatorial cartesian pc. */
export function eqToVec(raDeg, decDeg, dPc, target = new THREE.Vector3()) {
  const ra = THREE.MathUtils.degToRad(raDeg);
  const dec = THREE.MathUtils.degToRad(decDeg);
  return target.set(
    dPc * Math.cos(dec) * Math.cos(ra),
    dPc * Math.cos(dec) * Math.sin(ra),
    dPc * Math.sin(dec)
  );
}

/** Equatorial cartesian -> scene direction (ecliptic XZ plane, +Y north). */
export function eqDirToScene(v, target = new THREE.Vector3()) {
  const ye = Math.cos(OBLIQUITY) * v.y + Math.sin(OBLIQUITY) * v.z;
  const ze = -Math.sin(OBLIQUITY) * v.y + Math.cos(OBLIQUITY) * v.z;
  return target.set(v.x, ze, -ye);
}

/** B-V color index -> RGB. */
export function bvColor(ci, target = new THREE.Color()) {
  const stops = [
    [-0.3, 0.60, 0.70, 1.00],
    [0.0, 0.75, 0.83, 1.00],
    [0.3, 1.00, 1.00, 1.00],
    [0.6, 1.00, 0.95, 0.84],
    [1.0, 1.00, 0.86, 0.68],
    [1.5, 1.00, 0.72, 0.52],
    [2.2, 1.00, 0.58, 0.40],
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (ci >= stops[i][0] && ci <= stops[i + 1][0]) {
      lo = stops[i]; hi = stops[i + 1];
      break;
    }
  }
  const t = THREE.MathUtils.clamp((ci - lo[0]) / Math.max(1e-6, hi[0] - lo[0]), 0, 1);
  return target.setRGB(
    lo[1] + (hi[1] - lo[1]) * t,
    lo[2] + (hi[2] - lo[2]) * t,
    lo[3] + (hi[3] - lo[3]) * t
  );
}

/**
 * Deep-sky background. With a star catalog it renders the REAL night sky
 * as seen from the observer's position in the solar neighborhood —
 * per-system parallax shifts included, the Sun injected as a star when
 * viewed from elsewhere (from Proxima it lands in Cassiopeia at ~0.4 mag).
 * Without a catalog it falls back to a seeded procedural sprinkle.
 * A procedurally painted Milky Way panorama underlays either mode.
 */
export class SkyDome {
  constructor({ seed = 42, catalog = null, observerPc = null } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'skydome';
    this.sunApparent = null;

    // --- Milky Way panorama ---
    const pano = this._paintMilkyWay(seed ^ 0xa11c);
    const panoTex = new THREE.CanvasTexture(pano);
    panoTex.colorSpace = THREE.SRGBColorSpace;
    panoTex.wrapS = THREE.RepeatWrapping;
    const panoMat = new THREE.MeshBasicMaterial({
      map: panoTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    panoMat.toneMapped = false;
    this.pano = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 1.02, 48, 24), panoMat);
    this.pano.rotation.set(THREE.MathUtils.degToRad(62), 0.25, THREE.MathUtils.degToRad(24));
    this.pano.renderOrder = -3;
    this.group.add(this.pano);

    // --- Stars ---
    const entries = catalog
      ? this._catalogEntries(catalog, observerPc ?? new THREE.Vector3())
      : this._proceduralEntries(seed);

    const n = entries.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const e = entries[i];
      positions[i * 3] = e.dir.x * SKY_RADIUS;
      positions[i * 3 + 1] = e.dir.y * SKY_RADIUS;
      positions[i * 3 + 2] = e.dir.z * SKY_RADIUS;
      colors[i * 3] = e.color.r * e.bright;
      colors[i * 3 + 1] = e.color.g * e.bright;
      colors[i * 3 + 2] = e.color.b * e.bright;
      sizes[i] = e.size;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uDPR: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float aSize;
        varying vec3 vColor;
        uniform float uDPR;
        void main() {
          vColor = color;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uDPR;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vColor;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float core = smoothstep(1.0, 0.05, d);
          float halo = exp(-d * 3.2) * 0.5;
          float a = core + halo;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * (core + halo), a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -2;
    this.group.add(this.points);
  }

  _catalogEntries(cat, observerPc) {
    const entries = [];
    const p = new THREE.Vector3();
    const rel = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const atOrigin = observerPc.lengthSq() < 1e-8;

    const push = (relVec, dist, absmag, ci) => {
      const m = absmag + 5 * (Math.log10(dist) - 1);
      if (m > 6.8) return null;
      eqDirToScene(relVec.normalize(), dir);
      const bright = THREE.MathUtils.clamp(Math.pow(10, -0.4 * (m - 0.6)), 0.035, 3.4);
      const size = THREE.MathUtils.clamp(1.15 + (2.2 - m) * 0.5, 1.15, 5.4);
      const color = bvColor(ci, new THREE.Color());
      const e = { dir: dir.clone(), bright, size, color, m };
      entries.push(e);
      return e;
    };

    for (let i = 0; i < cat.n; i++) {
      eqToVec(cat.ra[i], cat.dec[i], cat.d[i], p);
      rel.copy(p).sub(observerPc);
      const dist = rel.length();
      if (dist < 5e-4) continue; // the observer's own star
      push(rel, dist, cat.absmag[i], cat.ci[i]);
    }

    // The Sun, seen from elsewhere.
    if (!atOrigin) {
      rel.copy(observerPc).negate();
      const dist = rel.length();
      const e = push(rel.clone(), dist, 4.83, 0.65);
      const ra = (THREE.MathUtils.radToDeg(Math.atan2(rel.y, rel.x)) + 360) % 360;
      const dec = THREE.MathUtils.radToDeg(Math.asin(rel.z / dist));
      this.sunApparent = { raDeg: ra, raH: ra / 15, decDeg: dec, mag: e ? e.m : null };
    }
    return entries;
  }

  _proceduralEntries(seed) {
    const prng = new Prng(seed ^ 0x5f17);
    const entries = [];
    const color = new THREE.Color();
    for (let i = 0; i < 9000; i++) {
      const z = prng.float(-1, 1);
      const phi = prng.float(0, 2 * Math.PI);
      const rxy = Math.sqrt(Math.max(0, 1 - z * z));
      const u = prng.next();
      const bright = 0.05 + 0.5 * Math.pow(u, 3.0) + 2.3 * Math.pow(u, 24.0);
      const t = prng.next();
      if (t < 0.10) color.setRGB(0.62, 0.72, 1.0);
      else if (t < 0.32) color.setRGB(0.85, 0.90, 1.0);
      else if (t < 0.62) color.setRGB(1.0, 0.99, 0.95);
      else if (t < 0.86) color.setRGB(1.0, 0.90, 0.76);
      else color.setRGB(1.0, 0.72, 0.52);
      entries.push({
        dir: new THREE.Vector3(rxy * Math.cos(phi), z, rxy * Math.sin(phi)),
        bright,
        size: 1.1 + 1.6 * Math.pow(u, 3.0) + 4.6 * Math.pow(u, 30.0),
        color: color.clone(),
      });
    }
    return entries;
  }

  _paintMilkyWay(seed) {
    const W = 1024, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const { fbm } = makeNoise(seed);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const band = (v - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const width = 0.19 + 0.09 * fbm(u * 3, 7.7, 3);
        const fall = Math.exp(-(band * band) / (2 * width * width));
        const clouds = 0.68 + 0.34 * fbm(u * 2.4, v * 7, 4);
        let inten = fall * clouds * 1.15;
        const ridge = Math.abs(fbm(u * 2.2, v * 34 + 31, 4));
        const dust = 1.0 - Math.max(0, 0.72 - ridge * 2.4) * fall;
        inten *= Math.max(0.15, dust);
        const du = Math.min(Math.abs(u - 0.5), 1 - Math.abs(u - 0.5));
        const core = Math.exp(-(du * du) / 0.012) * Math.exp(-(band * band) / 0.06) * 0.85;
        const i = (y * W + x) * 4;
        d[i] = Math.min(255, (0.46 * inten + 0.72 * core) * 255);
        d[i + 1] = Math.min(255, (0.50 * inten + 0.60 * core) * 255);
        d[i + 2] = Math.min(255, (0.58 * inten + 0.42 * core) * 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.pano.geometry.dispose();
    this.pano.material.map.dispose();
    this.pano.material.dispose();
  }
}
