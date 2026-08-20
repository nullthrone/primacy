import * as THREE from 'three';
import { sampleOrbit } from './Kepler.js';

const trailVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aPhase;
varying float vPhase;
void main() {
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const trailFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uHead;     // current phase (E / 2pi) of the body
uniform float uOpacity;
varying float vPhase;
void main() {
  #include <logdepthbuf_fragment>
  float behind = fract(uHead - vPhase);        // 0 at the body, 1 full lap back
  float tail = pow(1.0 - behind, 3.0);
  float alpha = uOpacity * (0.10 + 0.90 * tail);
  gl_FragColor = vec4(uColor, alpha);
}
`;

/**
 * Fading orbit line: static ellipse geometry (LineLoop), the moving
 * comet-tail fade runs entirely in the fragment shader via the phase
 * attribute — no per-frame geometry updates. Geometry is resampled only
 * when the scale mapping changes.
 */
export class OrbitTrail {
  constructor(el, color = 0x5a7ca8, segments = 512) {
    this.el = el;
    this.segments = segments;
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segments * 3), 3));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(segments), 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uHead: { value: 0 },
        uOpacity: { value: 0.55 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.line = new THREE.LineLoop(this.geometry, this.material);
    this.line.frustumCulled = false;
    this._scratch = new THREE.Vector3();
  }

  /** Recompute vertices for the current scale mapping (AU -> scene units). */
  rebuild(jd, mapVec) {
    const { positions, phases } = sampleOrbit(this.el, jd, this.segments);
    const posAttr = this.geometry.getAttribute('position');
    const phaseAttr = this.geometry.getAttribute('aPhase');
    for (let s = 0; s < this.segments; s++) {
      this._scratch.set(positions[s * 3], positions[s * 3 + 1], positions[s * 3 + 2]);
      mapVec(this._scratch);
      posAttr.setXYZ(s, this._scratch.x, this._scratch.y, this._scratch.z);
      phaseAttr.setX(s, phases[s]);
    }
    posAttr.needsUpdate = true;
    phaseAttr.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  setHead(E) {
    this.material.uniforms.uHead.value = E / (2 * Math.PI);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
