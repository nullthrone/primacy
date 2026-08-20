import * as THREE from 'three';
import { starVertex, starFragment } from '../shaders/star.glsl.js';
import { coronaVertex, coronaFragment } from '../shaders/corona.glsl.js';
import { blackbodyRGB } from '../procgen/Blackbody.js';
import { makeGlowTexture } from '../procgen/FlareSprites.js';

const CORONA_SCALE = 2.7;
const _camPos = new THREE.Vector3();
const _starPos = new THREE.Vector3();

/**
 * A star: shader photosphere (granulation, spots, limb darkening, flare
 * patch), corona shell, wide glow sprite, lens flare and the system's
 * point light. Built at unit radius — display size comes from group.scale,
 * so scale-mode transitions are free.
 */
export class StarBody {
  constructor({
    id = 'star',
    teffK = 5772,
    activity = 0.3,
    seed = 1,
    emissive = 1.6,
    granScale = 22,
    lensflare = true,
    lightIntensity = 3.4,
  } = {}) {
    this.id = id;
    this.teffK = teffK;
    this.group = new THREE.Group();
    this.group.name = `star:${id}`;

    const hot = blackbodyRGB(teffK * 1.12);
    const cold = blackbodyRGB(teffK * 0.72).multiplyScalar(0.55)
      .lerp(new THREE.Color(1.0, 0.42, 0.10), 0.35);
    const spot = blackbodyRGB(Math.max(1200, teffK * 0.60)).multiplyScalar(0.28);
    this.baseColor = blackbodyRGB(teffK);

    this.uniforms = {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uActivity: { value: activity },
      uFlare: { value: 0 },
      uFlareDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      uColorHot: { value: hot },
      uColorCold: { value: cold },
      uColorSpot: { value: spot },
      uEmissive: { value: emissive },
      uGranScale: { value: granScale },
      uLimbU: { value: 0.72 },
    };
    this.emissiveFar = emissive;

    const geo = new THREE.SphereGeometry(1, 96, 48);
    this.material = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: this.uniforms,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = id;
    this.group.add(this.mesh);

    this.coronaUniforms = {
      uTime: { value: 0 },
      uSeed: { value: seed * 3.1 },
      uColor: { value: this.baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.5) },
      uStarRadius: { value: 1 / CORONA_SCALE },
      uIntensity: { value: 0.7 },
      uFlare: { value: 0 },
    };
    const coronaGeo = new THREE.SphereGeometry(1, 64, 32);
    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: coronaVertex,
      fragmentShader: coronaFragment,
      uniforms: this.coronaUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    this.corona = new THREE.Mesh(coronaGeo, coronaMat);
    this.corona.scale.setScalar(CORONA_SCALE);
    this.group.add(this.corona);

    // Wide soft halo, always drawn over the disc (additive glare).
    const srgb = this.baseColor.clone().convertLinearToSRGB();
    const tint = `${Math.round(srgb.r * 255)},${Math.round(srgb.g * 255)},${Math.round(srgb.b * 255)}`;
    const glowTex = makeGlowTexture({
      inner: 'rgba(255,252,246,1)',
      mid: `rgba(${tint},0.26)`,
      rays: true,
    });
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
      opacity: 0.18,
    }));
    this.glow.scale.setScalar(3.0);
    this.glow.renderOrder = 5;
    this.group.add(this.glow);

    this.light = new THREE.PointLight(0xffffff, lightIntensity, 0, 0);
    this.light.color.copy(this.baseColor.clone().lerp(new THREE.Color(1, 1, 1), 0.5));
    this.group.add(this.light);

    // Screen-space lens ghosts live in the FlareOverlay (the stock
    // Lensflare addon breaks against multisampled composer targets).
    this.wantsLensflare = lensflare;
  }

  /** Display radius in scene units. */
  setRadius(r) {
    this.mesh.scale.setScalar(r);
    this.corona.scale.setScalar(r * CORONA_SCALE);
    this.glow.scale.setScalar(r * 3.0);
  }

  setFlare(level, dir) {
    this.uniforms.uFlare.value = level;
    this.coronaUniforms.uFlare.value = level;
    if (dir) this.uniforms.uFlareDir.value.copy(dir).normalize();
  }

  /**
   * Advances surface animation and fakes photographic auto-exposure: from
   * afar the star is a blinding beacon, up close the emissive drops so
   * granulation and limb darkening resolve (like H-alpha photography).
   */
  update(dt, camera) {
    this.uniforms.uTime.value += dt;
    this.coronaUniforms.uTime.value += dt;
    if (camera) {
      const radius = this.mesh.scale.x;
      const dist = camera.getWorldPosition(_camPos).distanceTo(this.group.getWorldPosition(_starPos));
      const apparent = radius / Math.max(dist, radius * 1.01);
      const t = THREE.MathUtils.smoothstep(apparent, 0.16, 0.55);
      this.uniforms.uEmissive.value = THREE.MathUtils.lerp(this.emissiveFar, 0.82, t);
      this.glow.material.opacity = THREE.MathUtils.lerp(0.18, 0.04, t);
      this.coronaUniforms.uIntensity.value = THREE.MathUtils.lerp(0.7, 0.25, t);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.corona.geometry.dispose();
    this.corona.material.dispose();
  }
}
