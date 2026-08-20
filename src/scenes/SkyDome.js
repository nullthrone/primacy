import * as THREE from 'three';
import { Prng } from '../procgen/Prng.js';
import { makeNoise } from '../procgen/ProceduralTextures.js';

export const SKY_RADIUS = 40000;

/**
 * Deep-sky background: a procedurally painted Milky Way panorama (band
 * clouds, dark dust lanes, warm galactic core) on an inner sphere, plus a
 * 12k-star field with a power-law magnitude distribution — the brightest
 * stars carry HDR colors so the bloom pass picks them up. Deterministic.
 * The HYG catalog upgrade (M8) swaps the point directions for real stars;
 * the panorama stays.
 */
export class SkyDome {
  constructor({ seed = 42, count = 12000 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'skydome';

    // --- Milky Way panorama ---
    const pano = this._paintMilkyWay(seed);
    const panoTex = new THREE.CanvasTexture(pano);
    panoTex.colorSpace = THREE.SRGBColorSpace;
    panoTex.wrapS = THREE.RepeatWrapping;
    const panoMat = new THREE.MeshBasicMaterial({
      map: panoTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    panoMat.toneMapped = false; // keep the faint band out of ACES' shadows
    this.pano = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 1.02, 48, 24), panoMat);
    // Real galactic plane is tilted ~60 degrees against the ecliptic;
    // the yaw is chosen so the band sweeps through the boot view.
    this.pano.rotation.set(THREE.MathUtils.degToRad(62), 0.25, THREE.MathUtils.degToRad(24));
    this.pano.renderOrder = -3;
    this.group.add(this.pano);

    // --- Stars ---
    const prng = new Prng(seed ^ 0x5f17);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const z = prng.float(-1, 1);
      const phi = prng.float(0, 2 * Math.PI);
      const rxy = Math.sqrt(Math.max(0, 1 - z * z));
      positions[i * 3] = rxy * Math.cos(phi) * SKY_RADIUS;
      positions[i * 3 + 1] = z * SKY_RADIUS;
      positions[i * 3 + 2] = rxy * Math.sin(phi) * SKY_RADIUS;

      // Magnitude power law: sea of faint stars, a handful of beacons.
      const u = prng.next();
      const bright = 0.05 + 0.5 * Math.pow(u, 3.0) + 2.3 * Math.pow(u, 24.0);

      const t = prng.next();
      if (t < 0.10) color.setRGB(0.62, 0.72, 1.0);        // hot blue
      else if (t < 0.32) color.setRGB(0.85, 0.90, 1.0);   // blue-white
      else if (t < 0.62) color.setRGB(1.0, 0.99, 0.95);   // white
      else if (t < 0.86) color.setRGB(1.0, 0.90, 0.76);   // yellow-orange
      else color.setRGB(1.0, 0.72, 0.52);                 // red-orange

      colors[i * 3] = color.r * bright;
      colors[i * 3 + 1] = color.g * bright;
      colors[i * 3 + 2] = color.b * bright;
      sizes[i] = 1.1 + 1.6 * Math.pow(u, 3.0) + 4.6 * Math.pow(u, 30.0);
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

  _paintMilkyWay(seed) {
    const W = 1024, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const { fbm } = makeNoise(seed ^ 0xa11c);
    const d = img.data;
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const band = (v - 0.5) * 2;                       // -1..1 across the band
      for (let x = 0; x < W; x++) {
        const u = x / W;
        // Cloud structure stretched along the band, wrapping in u.
        const width = 0.19 + 0.09 * fbm(u * 3, 7.7, 3);
        const fall = Math.exp(-(band * band) / (2 * width * width));
        const clouds = 0.68 + 0.34 * fbm(u * 2.4, v * 7, 4);
        let inten = fall * clouds * 1.15;
        // Dark dust lanes: ridged noise elongated along the band.
        const ridge = Math.abs(fbm(u * 2.2, v * 34 + 31, 4));
        const dust = 1.0 - Math.max(0, 0.72 - ridge * 2.4) * fall;
        inten *= Math.max(0.15, dust);
        // Warm galactic core.
        const du = Math.min(Math.abs(u - 0.5), 1 - Math.abs(u - 0.5));
        const core = Math.exp(-(du * du) / 0.012) * Math.exp(-(band * band) / 0.06) * 0.85;

        const rCool = 0.46 * inten + 0.72 * core;
        const gCool = 0.50 * inten + 0.60 * core;
        const bCool = 0.58 * inten + 0.42 * core;
        const i = (y * W + x) * 4;
        d[i] = Math.min(255, rCool * 255);
        d[i + 1] = Math.min(255, gCool * 255);
        d[i + 2] = Math.min(255, bCool * 255);
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
