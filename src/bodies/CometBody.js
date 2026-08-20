import * as THREE from 'three';
import { proceduralTexture } from '../procgen/ProceduralTextures.js';
import { makeDotTexture } from '../procgen/FlareSprites.js';
import { NOISE_GLSL } from '../shaders/noise.glsl.js';

const tailVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const tailFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uTime;
uniform float uStrength;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  float along = 1.0 - vUv.y;        // 0 head .. 1 tip (plane rows run +y -> -y)
  float across = abs(vUv.x - 0.5) * 2.0;
  float streaks = 0.7 + 0.5 * snoise(vec3(vUv.x * 9.0, along * 5.0 - uTime * 0.55, uTime * 0.1));
  float alpha = pow(1.0 - along, 1.6) * (1.0 - across * across) * streaks * uStrength;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/**
 * Comet: cratered nucleus, coma glow sprite, and two per-frame oriented
 * ribbon tails — a straight blue ion tail pointing exactly anti-sunward
 * and a curved warm dust tail lagging toward the orbit's trailing side.
 * Tail length/brightness scale with solar distance (activity ~ 1/r^2).
 */
export class CometBody {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.group = new THREE.Group();
    this.group.name = `body:${def.id}`;
    this.tilt = new THREE.Group();
    this.group.add(this.tilt);

    this.material = new THREE.MeshStandardMaterial({
      map: proceduralTexture('comet', 999),
      roughness: 1.0,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material);
    this.mesh.name = def.id;
    this.tilt.add(this.mesh);
    this.extras = [];

    this.coma = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeDotTexture('190,220,255'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.0,
    }));
    this.group.add(this.coma);

    this.tails = [];
    for (const cfg of [
      { color: 0x77aaff, kind: 'ion' },
      { color: 0xe8cf9a, kind: 'dust' },
    ]) {
      const SEG = 24;
      const geo = new THREE.PlaneGeometry(1, 1, 1, SEG);
      const uniforms = {
        uColor: { value: new THREE.Color(cfg.color) },
        uTime: { value: 0 },
        uStrength: { value: 0 },
      };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: tailVertex,
        fragmentShader: tailFragment,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.tails.push({ mesh, uniforms, kind: cfg.kind, seg: SEG });
    }

    this._prevPos = new THREE.Vector3();
    this._vel = new THREE.Vector3();
  }

  setRadius(r) {
    this.mesh.scale.setScalar(r);
  }

  get displayRadius() {
    return this.mesh.scale.x;
  }

  updateSpin(jd) {
    this.mesh.rotation.y = ((jd * 24) / (this.def.physical.rotationH || 52)) * 2 * Math.PI;
  }

  setSpinAngle() {}

  setSun() {}

  /**
   * Called by the scene with world positions; orients and sizes the tails.
   * rAU is the current solar distance in AU.
   */
  updateTails(bodyWorldPos, sunWorldPos, camera, rAU, dt) {
    const activity = Math.min(1, 2.2 / (rAU * rAU));
    const dispR = this.displayRadius;

    this.coma.material.opacity = 0.55 * activity;
    this.coma.scale.setScalar(dispR * (3 + activity * 7));

    const antiSun = _anti.copy(bodyWorldPos).sub(sunWorldPos).normalize();
    this._vel.copy(bodyWorldPos).sub(this._prevPos);
    const hasVel = this._vel.lengthSq() > 1e-12;
    if (hasVel) this._vel.normalize();
    this._prevPos.copy(bodyWorldPos);

    const camDir = _camDir.copy(camera.position).sub(bodyWorldPos).normalize();

    for (const tail of this.tails) {
      const isIon = tail.kind === 'ion';
      const len = dispR * (isIon ? 62 : 44) * (0.15 + activity * 0.85);
      const baseW = dispR * (isIon ? 1.4 : 2.2);
      const tipW = dispR * (isIon ? 5 : 12);
      const dir = _dir.copy(antiSun);
      if (!isIon && hasVel) {
        dir.addScaledVector(this._vel, -0.45).normalize();
      }
      const side = _side.crossVectors(dir, camDir).normalize();
      const curve = isIon ? 0 : 0.22;

      const pos = tail.mesh.geometry.getAttribute('position');
      const seg = tail.seg;
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const w = baseW + (tipW - baseW) * t * t;
        _p.copy(dir).multiplyScalar(len * t);
        if (curve > 0 && hasVel) {
          _p.addScaledVector(this._vel, -len * curve * t * t);
        }
        // PlaneGeometry rows run +y -> -y; row i vertices 2i, 2i+1.
        pos.setXYZ(i * 2, _p.x - side.x * w, _p.y - side.y * w, _p.z - side.z * w);
        pos.setXYZ(i * 2 + 1, _p.x + side.x * w, _p.y + side.y * w, _p.z + side.z * w);
      }
      pos.needsUpdate = true;
      tail.mesh.geometry.computeBoundingSphere();
      tail.uniforms.uStrength.value = (isIon ? 0.9 : 0.75) * activity;
      tail.uniforms.uTime.value += dt;
    }
  }

  update() {}

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const t of this.tails) {
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
  }
}

const _anti = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _p = new THREE.Vector3();
