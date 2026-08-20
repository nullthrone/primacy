import * as THREE from 'three';

const hzVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aRad;      // 0 inner .. 1 outer
attribute float aAng;
uniform float uInnerAU;
uniform float uOuterAU;
uniform float uBlend;
varying float vRad;
void main() {
  vRad = aRad;
  float rAU = mix(uInnerAU, uOuterAU, aRad);
  float rDid = 100.0 * pow(rAU, 0.4);
  float rReal = rAU * 149597.8707;
  float e = uBlend * uBlend * (3.0 - 2.0 * uBlend);
  float r = mix(rDid, rReal, e);
  vec3 pos = vec3(cos(aAng) * r, 0.0, -sin(aAng) * r);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const hzFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColor;
uniform float uOpacity;
varying float vRad;
void main() {
  #include <logdepthbuf_fragment>
  float band = sin(vRad * 3.14159265);
  float alpha = pow(band, 1.6) * uOpacity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/**
 * Habitable-zone annuli (conservative + optimistic, Kopparapu limits from
 * the system data). Radii are computed in the vertex shader with the same
 * didactic/true mapping blend as the belts, so the rings track scale-mode
 * transitions for free.
 */
export class HZRings {
  constructor(hz) {
    this.group = new THREE.Group();
    this.group.name = 'hz';
    this.meshes = [];
    const make = (innerAU, outerAU, color, opacity) => {
      const SEG = 220;
      const positions = new Float32Array((SEG + 1) * 2 * 3);
      const rads = new Float32Array((SEG + 1) * 2);
      const angs = new Float32Array((SEG + 1) * 2);
      const index = [];
      for (let s = 0; s <= SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        rads[s * 2] = 0; rads[s * 2 + 1] = 1;
        angs[s * 2] = a; angs[s * 2 + 1] = a;
        if (s < SEG) {
          const i0 = s * 2;
          index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aRad', new THREE.BufferAttribute(rads, 1));
      geo.setAttribute('aAng', new THREE.BufferAttribute(angs, 1));
      geo.setIndex(index);
      const uniforms = {
        uInnerAU: { value: innerAU },
        uOuterAU: { value: outerAU },
        uBlend: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      };
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
        vertexShader: hzVertex,
        fragmentShader: hzFragment,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }));
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.meshes.push({ mesh, uniforms });
    };
    make(hz.optInner, hz.optOuter, 0x2e8a5a, 0.075);
    make(hz.consInner, hz.consOuter, 0x48c880, 0.14);
  }

  update(blend) {
    for (const m of this.meshes) m.uniforms.uBlend.value = blend;
  }

  setVisible(v) {
    this.group.visible = v;
  }

  dispose() {
    for (const m of this.meshes) {
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
    }
  }
}
