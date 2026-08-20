import * as THREE from 'three';
import { Prng } from '../procgen/Prng.js';

/**
 * Asteroid/Kuiper belt as a single InstancedMesh. All orbital motion runs
 * in the vertex shader (circular orbits + Kepler's third law from
 * per-instance semi-major axes in AU), so the CPU cost per frame is two
 * uniform updates. The didactic/true distance mapping is duplicated in
 * GLSL and blended with the same 0..1 factor as the ScaleManager.
 */

const beltVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aAU;       // semi-major axis in AU
attribute float aPhase;    // initial angle
attribute float aTilt;     // inclination amplitude (radians, small)
attribute float aNode;     // node phase
attribute float aScale;    // rock size in didactic scene units
attribute vec3 aTint;
uniform float uJD;
uniform float uBlend;      // 0 didactic .. 1 true scale
varying float vNdl;
varying vec3 vTint;

void main() {
  // Same constants as ScaleManager.
  float rDidactic = 100.0 * pow(aAU, 0.4);
  float rReal = aAU * 149597.8707;
  float blendE = uBlend * uBlend * (3.0 - 2.0 * uBlend);
  float r = mix(rDidactic, rReal, blendE);

  float periodD = 365.256 * pow(aAU, 1.5);
  float theta = aPhase + 6.2831853 * uJD / periodD;
  float c = cos(theta), s = sin(theta);
  float y = r * aTilt * sin(theta + aNode);
  vec3 center = vec3(r * c, y, -r * s);

  // Rocks shrink toward honest invisibility in true scale.
  float size = mix(aScale, aScale * 0.002, blendE);
  vec3 pos = center + position * size;

  vec3 n = normalize(position);
  vec3 toSun = normalize(-center);
  vNdl = max(dot(n, toSun), 0.0);
  vTint = aTint;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const beltFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunColor;
varying float vNdl;
varying vec3 vTint;
void main() {
  #include <logdepthbuf_fragment>
  vec3 color = vTint * (0.06 + vNdl * 0.94) * uSunColor;
  gl_FragColor = vec4(color, 1.0);
}
`;

export class BeltField {
  constructor(def) {
    this.def = def;
    const count = def.count;
    const prng = new Prng(def.seed ?? 7);

    const geo = new THREE.IcosahedronGeometry(1, 0);
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = geo.index;
    inst.attributes.position = geo.attributes.position;
    inst.attributes.normal = geo.attributes.normal;
    inst.instanceCount = count;

    const aAU = new Float32Array(count);
    const aPhase = new Float32Array(count);
    const aTilt = new Float32Array(count);
    const aNode = new Float32Array(count);
    const aScale = new Float32Array(count);
    const aTint = new Float32Array(count * 3);
    const base = new THREE.Color(def.color ?? 0x8a7a66);
    for (let i = 0; i < count; i++) {
      // Slight center-weighting looks more natural than uniform.
      const t = (prng.next() + prng.next()) / 2;
      aAU[i] = def.aMin + (def.aMax - def.aMin) * t;
      aPhase[i] = prng.float(0, Math.PI * 2);
      aTilt[i] = prng.gaussish(0, def.thick ?? 0.05);
      aNode[i] = prng.float(0, Math.PI * 2);
      aScale[i] = prng.float(0.03, 0.2) * (prng.next() < 0.03 ? 2.3 : 1);
      const v = prng.float(0.55, 0.95);
      aTint[i * 3] = base.r * v;
      aTint[i * 3 + 1] = base.g * v;
      aTint[i * 3 + 2] = base.b * v;
    }
    inst.setAttribute('aAU', new THREE.InstancedBufferAttribute(aAU, 1));
    inst.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1));
    inst.setAttribute('aTilt', new THREE.InstancedBufferAttribute(aTilt, 1));
    inst.setAttribute('aNode', new THREE.InstancedBufferAttribute(aNode, 1));
    inst.setAttribute('aScale', new THREE.InstancedBufferAttribute(aScale, 1));
    inst.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 3));

    this.uniforms = {
      uJD: { value: 0 },
      uBlend: { value: 0 },
      uSunColor: { value: new THREE.Color(1, 0.97, 0.92) },
    };
    this.mesh = new THREE.Mesh(inst, new THREE.ShaderMaterial({
      vertexShader: beltVertex,
      fragmentShader: beltFragment,
      uniforms: this.uniforms,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.name = `belt:${def.id}`;
  }

  update(jd, blend) {
    this.uniforms.uJD.value = jd - 2451545.0;
    this.uniforms.uBlend.value = blend;
  }

  setDensity(fraction) {
    this.mesh.geometry.instanceCount = Math.max(64, Math.floor(this.def.count * fraction));
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
