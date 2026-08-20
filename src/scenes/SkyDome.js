import * as THREE from 'three';
import { Prng } from '../procgen/Prng.js';

export const SKY_RADIUS = 40000;

/**
 * Background sky. Until the HYG catalog sky lands (M8) this provides a
 * deterministic procedural star sprinkle so space has depth. The catalog
 * version replaces the points with real star directions per system.
 */
export class SkyDome {
  constructor({ seed = 42, count = 2600 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'skydome';
    const prng = new Prng(seed);

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Uniform on sphere.
      const z = prng.float(-1, 1);
      const phi = prng.float(0, 2 * Math.PI);
      const rxy = Math.sqrt(Math.max(0, 1 - z * z));
      positions[i * 3] = rxy * Math.cos(phi) * SKY_RADIUS;
      positions[i * 3 + 1] = z * SKY_RADIUS;
      positions[i * 3 + 2] = rxy * Math.sin(phi) * SKY_RADIUS;
      // Temperature-ish tint.
      const t = prng.next();
      if (t < 0.12) color.setRGB(0.72, 0.80, 1.0);
      else if (t < 0.5) color.setRGB(1.0, 1.0, 1.0);
      else if (t < 0.8) color.setRGB(1.0, 0.95, 0.85);
      else color.setRGB(1.0, 0.82, 0.66);
      const mag = prng.next();
      const dim = 0.25 + 0.75 * mag * mag;
      colors[i * 3] = color.r * dim;
      colors[i * 3 + 1] = color.g * dim;
      colors[i * 3 + 2] = color.b * dim;
      sizes[i] = prng.float(1.0, 2.6);
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
          float d = length(uv);
          float a = smoothstep(0.5, 0.12, d);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}
