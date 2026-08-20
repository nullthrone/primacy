import * as THREE from 'three';
import { Prng } from '../procgen/Prng.js';

const CME_COUNT = 1600;

const cmeVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 aDir;
attribute float aSpeed;
attribute float aSize;
uniform float uT;         // 0..1 lifetime
uniform float uReach;     // travel distance in scene units
uniform vec3 uOrigin;
uniform float uDPR;
varying float vFade;
void main() {
  float t = uT;
  vec3 pos = uOrigin + aDir * (aSpeed * t * uReach);
  vFade = (1.0 - t) * smoothstep(0.0, 0.08, t);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * uDPR * (1.0 + t * 2.0);
  #include <logdepthbuf_vertex>
}
`;

const cmeFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
varying float vFade;
void main() {
  #include <logdepthbuf_fragment>
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  float a = smoothstep(1.0, 0.1, d) * vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

/**
 * Stellar flare simulation for flare stars (Proxima): a Poisson-ish
 * scheduler plus manual trigger. Sequence (real-time seconds):
 *   0.0-1.6  photosphere hot patch + brightness spike
 *   0.6-9.0  CME particle cone racing toward the planet
 *   arrival  aurora response on the target planet (uResponse ramp)
 * Physically the CME would take hours — the compression is called out in
 * the UI caption (shown via the onCaption hook).
 */
export class FlareController {
  constructor({ scene, starCtl, targetCtl, onCaption }) {
    this.scene = scene;
    this.starCtl = starCtl;
    this.targetCtl = targetCtl;
    this.onCaption = onCaption;
    this.prng = new Prng(9001);
    this._cooldown = 25 + this.prng.float(0, 40);
    this._flare = null;

    // Preallocated CME points, reused per event.
    const geo = new THREE.BufferGeometry();
    const dirs = new Float32Array(CME_COUNT * 3);
    const speeds = new Float32Array(CME_COUNT);
    const sizes = new Float32Array(CME_COUNT);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CME_COUNT * 3), 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.cmeGeo = geo;
    this.cmeUniforms = {
      uT: { value: 0 },
      uReach: { value: 40 },
      uOrigin: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(1.0, 0.55, 0.35) },
      uDPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
    };
    this.cme = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: cmeVertex,
      fragmentShader: cmeFragment,
      uniforms: this.cmeUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.cme.frustumCulled = false;
    this.cme.visible = false;
    scene.scene.add(this.cme);

    this._aurora = null; // lazily resolved from the target's extras
  }

  get auroraExtra() {
    if (!this._aurora && this.targetCtl) {
      this._aurora = this.targetCtl.body.extras?.find((e) => e.isAurora) ?? null;
    }
    return this._aurora;
  }

  trigger() {
    if (this._flare) return false;
    // Fire the CME roughly toward the target planet.
    const dir = new THREE.Vector3();
    if (this.targetCtl) {
      dir.copy(this.targetCtl.worldPos).sub(this.starCtl.worldPos).normalize();
    } else {
      dir.set(1, 0.2, 0.4).normalize();
    }
    // Populate the cone around dir.
    const dirs = this.cmeGeo.getAttribute('aDir');
    const speeds = this.cmeGeo.getAttribute('aSpeed');
    const sizes = this.cmeGeo.getAttribute('aSize');
    const tmp = new THREE.Vector3();
    const basis1 = new THREE.Vector3(0, 1, 0).cross(dir);
    if (basis1.lengthSq() < 1e-6) basis1.set(1, 0, 0);
    basis1.normalize();
    const basis2 = new THREE.Vector3().crossVectors(dir, basis1);
    for (let i = 0; i < CME_COUNT; i++) {
      const spread = Math.pow(this.prng.next(), 0.7) * 0.42;
      const ang = this.prng.float(0, Math.PI * 2);
      tmp.copy(dir)
        .addScaledVector(basis1, Math.cos(ang) * spread)
        .addScaledVector(basis2, Math.sin(ang) * spread)
        .normalize();
      dirs.setXYZ(i, tmp.x, tmp.y, tmp.z);
      speeds.setX(i, 0.55 + this.prng.next() * 0.75);
      sizes.setX(i, 1.5 + this.prng.next() * 3.5);
    }
    dirs.needsUpdate = true;
    speeds.needsUpdate = true;
    sizes.needsUpdate = true;

    const starR = this.starCtl.body.displayRadius;
    const targetDist = this.targetCtl
      ? this.targetCtl.worldPos.distanceTo(this.starCtl.worldPos)
      : starR * 8;
    this.cmeUniforms.uOrigin.value.copy(dir).multiplyScalar(starR * 0.95);
    this.cmeUniforms.uReach.value = targetDist * 1.25;
    this.cmeUniforms.uColor.value.copy(this.starCtl.body.baseColor).lerp(new THREE.Color(1, 0.6, 0.4), 0.5);

    this._flare = { t: 0, dir, duration: 9.5, auroraAt: 4.2 };
    this.starCtl.body.setFlare(0, dir);
    this.cme.visible = true;
    this.onCaption?.();
    return true;
  }

  update(dt) {
    if (!this._flare) {
      this._cooldown -= dt;
      if (this._cooldown <= 0) {
        this.trigger();
        this._cooldown = 45 + this.prng.float(20, 120);
      }
      return;
    }
    const f = this._flare;
    f.t += dt;

    // Photosphere spike: fast rise, slow decay.
    const level = f.t < 1.6
      ? Math.min(1, f.t / 0.45)
      : Math.max(0, 1 - (f.t - 1.6) / 4.5);
    this.starCtl.body.setFlare(level, f.dir);

    // CME lifetime.
    const ct = THREE.MathUtils.clamp((f.t - 0.5) / 8.0, 0, 1);
    this.cmeUniforms.uT.value = ct;

    // Aurora on arrival.
    const aur = this.auroraExtra;
    if (aur) {
      const at = (f.t - f.auroraAt) / 5.0;
      const resp = at < 0 ? 0 : at < 0.3 ? at / 0.3 : Math.max(0, 1 - (at - 0.3) / 0.7);
      aur.setResponse(resp);
    }

    if (f.t >= f.duration) {
      this._flare = null;
      this.starCtl.body.setFlare(0);
      this.cme.visible = false;
      this.auroraExtra?.setResponse(0);
    }
  }

  get flaring() {
    return !!this._flare;
  }

  dispose() {
    this.cmeGeo.dispose();
    this.cme.material.dispose();
  }
}
