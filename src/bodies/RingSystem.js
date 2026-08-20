import * as THREE from 'three';
import { ringsVertex, ringsFragment } from '../shaders/rings.glsl.js';

/**
 * Ring annulus in the planet's equatorial plane. Geometry is built in
 * units of the planet radius and scaled together with the planet mesh, so
 * scale-mode transitions stay consistent.
 */
export class RingSystem {
  constructor(def, { colorMap, alphaMap }) {
    const planetR = def.physical.radiusKm;
    const inner = def.rings.innerKm / planetR;
    const outer = def.rings.outerKm / planetR;

    const SEG = 256;
    const positions = new Float32Array((SEG + 1) * 2 * 3);
    const rads = new Float32Array((SEG + 1) * 2);
    const index = [];
    for (let s = 0; s <= SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      positions[(s * 2) * 3] = ca * inner;
      positions[(s * 2) * 3 + 1] = 0;
      positions[(s * 2) * 3 + 2] = sa * inner;
      positions[(s * 2 + 1) * 3] = ca * outer;
      positions[(s * 2 + 1) * 3 + 1] = 0;
      positions[(s * 2 + 1) * 3 + 2] = sa * outer;
      rads[s * 2] = 0;
      rads[s * 2 + 1] = 1;
      if (s < SEG) {
        const i0 = s * 2, i1 = s * 2 + 1, i2 = s * 2 + 2, i3 = s * 2 + 3;
        index.push(i0, i1, i2, i1, i3, i2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aRad', new THREE.BufferAttribute(rads, 1));
    geo.setIndex(index);

    this.uniforms = {
      uColorMap: { value: colorMap },
      uAlphaMap: { value: alphaMap },
      uHasAlphaMap: { value: alphaMap ? 1 : 0 },
      uSunPos: { value: new THREE.Vector3() },
      uPlanetPos: { value: new THREE.Vector3() },
      uPlanetRadius: { value: 1 },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
    };
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      vertexShader: ringsVertex,
      fragmentShader: ringsFragment,
      uniforms: this.uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }));
    this.mesh.frustumCulled = false;
    this.attach = 'tilt';
  }

  onRadius(r) {
    this.mesh.scale.setScalar(r);
    this.uniforms.uPlanetRadius.value = r;
  }

  setSun(dirWorld, sunPosWorld, sunColor, bodyWorldPos) {
    this.uniforms.uSunPos.value.copy(sunPosWorld);
    this.uniforms.uPlanetPos.value.copy(bodyWorldPos);
    this.uniforms.uSunColor.value.copy(sunColor);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
