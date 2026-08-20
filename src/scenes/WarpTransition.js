import * as THREE from 'three';
import { NOISE_GLSL } from '../shaders/noise.glsl.js';

/**
 * Full-screen warp tunnel rendered as an overlay after the composer. The
 * actual scene switch happens at peak opacity, hidden under the streaks.
 * Honors prefers-reduced-motion (instant switch, no FOV kick).
 */
export class WarpTransition {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.enabled = false;
    this.clearDepth = false;

    this.uniforms = {
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uAspect: { value: 16 / 9 },
    };
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uAlpha;
          uniform float uAspect;
          varying vec2 vUv;
          ${NOISE_GLSL}
          void main() {
            vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
            float r = length(p);
            float a = atan(p.y, p.x);
            // Angular streak pattern, seamless around the circle.
            vec3 ring = vec3(cos(a), sin(a), 0.0);
            float streak = snoise(ring * 5.0) * 0.5 + 0.5;
            streak = pow(streak, 2.2);
            float fine = snoise(ring * 23.0 + vec3(0.0, 0.0, 7.7)) * 0.5 + 0.5;
            streak = streak * 0.7 + pow(fine, 3.0) * 0.6;
            // Radial motion outward.
            float flow = snoise(vec3(a * 3.0, r * 5.0 - uTime * 6.5, 3.1)) * 0.5 + 0.5;
            float radial = smoothstep(0.05, 0.65, r);
            float inten = streak * (0.45 + flow * 0.8) * radial;
            vec3 col = mix(vec3(0.55, 0.75, 1.0), vec3(1.0), inten * 0.6);
            float alpha = uAlpha * clamp(inten * 1.6, 0.0, 1.0);
            // darken the outer vignette to hide the swap fully at peak
            alpha = max(alpha, uAlpha * smoothstep(0.4, 1.15, r) * 0.9);
            gl_FragColor = vec4(col * alpha, alpha);
          }
        `,
      })
    );
    quad.frustumCulled = false;
    this.scene.add(quad);
    engine.overlays.push(this);

    this._state = null;
    this._baseFov = engine.camera.fov;
    this._reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  get running() {
    return !!this._state;
  }

  /** Run the transition; onSwitch fires hidden at peak. */
  run(onSwitch) {
    if (this._reduced) {
      onSwitch();
      return;
    }
    if (this._state) return;
    this._state = { phase: 'in', t: 0, onSwitch };
    this.enabled = true;
  }

  update(dt) {
    if (!this._state) return;
    const s = this._state;
    s.t += dt;
    this.uniforms.uTime.value += dt;
    this.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
    const cam = this.engine.camera;

    if (s.phase === 'in') {
      const k = Math.min(1, s.t / 0.7);
      this.uniforms.uAlpha.value = k;
      cam.fov = this._baseFov + 20 * k * k;
      cam.updateProjectionMatrix();
      if (k >= 1) {
        s.onSwitch();
        s.phase = 'out';
        s.t = 0;
      }
    } else {
      const k = Math.min(1, s.t / 0.85);
      this.uniforms.uAlpha.value = 1 - k;
      cam.fov = this._baseFov + 20 * (1 - k) * (1 - k);
      cam.updateProjectionMatrix();
      if (k >= 1) {
        cam.fov = this._baseFov;
        cam.updateProjectionMatrix();
        this.enabled = false;
        this._state = null;
      }
    }
  }
}
