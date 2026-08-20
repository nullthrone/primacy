import * as THREE from 'three';
import { earthVertex, earthFragment } from '../shaders/earth.glsl.js';
import { atmosphereVertex, atmosphereFragment } from '../shaders/atmosphere.glsl.js';
import { proceduralTexture } from '../procgen/ProceduralTextures.js';
import { RingSystem } from '../bodies/RingSystem.js';

function idSeed(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Loads the committed texture set per assets/textures/manifest.json and
 * hands out materials + extras (clouds, atmosphere shells, rings) for body
 * definitions. Every missing slot silently falls back to a seeded
 * procedural texture, so the site works with zero downloaded assets.
 */
export class Materials {
  constructor() {
    this.textures = new Map();
    this.status = { loaded: [], procedural: [] };
  }

  async init(onProgress) {
    let manifest = { slots: {} };
    try {
      const res = await fetch('assets/textures/manifest.json');
      if (res.ok) manifest = await res.json();
    } catch { /* fully procedural */ }
    const entries = Object.entries(manifest.slots ?? {});
    let done = 0;
    const loader = new THREE.TextureLoader();
    await Promise.all(entries.map(async ([slot, info]) => {
      try {
        const tex = await loader.loadAsync(`assets/textures/${info.file}`);
        tex.colorSpace = info.colorSpace === 'linear' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        this.textures.set(slot, tex);
        this.status.loaded.push(slot);
      } catch {
        this.status.procedural.push(slot);
      }
      onProgress?.(++done / Math.max(1, entries.length));
    }));
    onProgress?.(1);
  }

  tex(slot) {
    return slot ? this.textures.get(slot) ?? null : null;
  }

  _dayTexture(def) {
    const tex = this.tex(def.material?.maps?.day);
    if (tex) return tex;
    return proceduralTexture(def.material?.fallback ?? 'rock', idSeed(def.id));
  }

  /** Surface material for a body definition. */
  createFor(def) {
    const kind = def.material?.kind ?? 'textured';
    if (kind === 'earth') {
      const uniforms = {
        uDay: { value: this._dayTexture(def) },
        uNight: { value: this.tex(def.material.maps.night) ?? proceduralTexture('rock', 1) },
        uSpec: { value: this.tex(def.material.maps.spec) },
        uNormalMap: { value: this.tex(def.material.maps.normal) },
        uHasNormal: { value: this.tex(def.material.maps.normal) ? 1 : 0 },
        uHasSpec: { value: this.tex(def.material.maps.spec) ? 1 : 0 },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uSunColor: { value: new THREE.Color(1, 1, 1) },
      };
      if (!uniforms.uSpec.value) uniforms.uSpec.value = uniforms.uDay.value;
      if (!uniforms.uNormalMap.value) uniforms.uNormalMap.value = uniforms.uDay.value;
      const mat = new THREE.ShaderMaterial({
        vertexShader: earthVertex,
        fragmentShader: earthFragment,
        uniforms,
      });
      mat.userData.sunHook = (dir, pos, color) => {
        uniforms.uSunDir.value.copy(dir);
        uniforms.uSunColor.value.copy(color);
      };
      return mat;
    }
    // Standard lit material — the star's PointLight does the shading.
    const mat = new THREE.MeshStandardMaterial({
      map: this._dayTexture(def),
      roughness: 0.96,
      metalness: 0.0,
    });
    return mat;
  }

  /** Cloud/atmosphere/ring extras for a body. */
  extrasFor(def) {
    const extras = [];

    if (def.material?.kind === 'earth' && this.tex(def.material.maps.clouds)) {
      const cloudTex = this.tex(def.material.maps.clouds);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 24),
        new THREE.MeshLambertMaterial({
          map: cloudTex,          // PNG carries its own soft alpha
          transparent: true,
          depthWrite: false,
          opacity: 0.92,
        })
      );
      extras.push({
        attach: 'tilt',
        mesh,
        onRadius: (r) => mesh.scale.setScalar(r * 1.014),
        onSpin: (angle) => { mesh.rotation.y = angle * 1.12; },
        dispose: () => { mesh.geometry.dispose(); mesh.material.dispose(); },
      });
    }

    const atmo = def.material?.atmosphere;
    if (atmo) {
      const presets = {
        scatter: { day: 0x4a90e8, sunset: 0xff7a33, strength: 1.1, fresnel: 2.7, scale: 1.035 },
        rim: { day: atmo.color ?? 0x88aadd, sunset: atmo.color ?? 0x88aadd, strength: atmo.strength ?? 0.7, fresnel: 3.8, scale: 1.03 },
      };
      const p = presets[atmo.kind] ?? presets.rim;
      const uniforms = {
        uDayColor: { value: new THREE.Color(p.day) },
        uSunsetColor: { value: new THREE.Color(p.sunset) },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uStrength: { value: p.strength },
        uFresnelPow: { value: p.fresnel },
      };
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 24),
        new THREE.ShaderMaterial({
          vertexShader: atmosphereVertex,
          fragmentShader: atmosphereFragment,
          uniforms,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      extras.push({
        attach: 'group',
        mesh,
        onRadius: (r) => mesh.scale.setScalar(r * p.scale),
        setSun: (dir) => uniforms.uSunDir.value.copy(dir),
        dispose: () => { mesh.geometry.dispose(); mesh.material.dispose(); },
      });
    }

    if (def.rings) {
      const rings = new RingSystem(def, {
        colorMap: this.tex(def.rings.maps?.color) ?? proceduralTexture('rock', idSeed(def.id) ^ 5),
        alphaMap: this.tex(def.rings.maps?.alpha),
      });
      extras.push(rings);
    }

    return extras;
  }
}
