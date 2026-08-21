import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Final grade: gentle vignette, slight saturation lift, blue-noise-ish
 * dithering against gradient banding. Runs after tone mapping in sRGB.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uSaturation: { value: 1.07 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5, 0.5));
      c.rgb *= 1.0 - uVignette * smoothstep(0.42, 0.95, d);
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(lum), c.rgb, uSaturation);
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (n - 0.5) * (1.8 / 255.0);
      gl_FragColor = c;
    }
  `,
};

/**
 * Owns the WebGL renderer, the post-processing chain and the frame loop.
 * Everything else registers per-frame callbacks. Bloom selection works via
 * HDR emissive values (stars >> 1) rather than layers, so the chain stays a
 * single RenderPass -> UnrealBloomPass -> OutputPass.
 */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // No canvas MSAA: the composer target carries the multisampling, and
      // the final pass is a fullscreen quad that MSAA cannot improve. A
      // second multisampled surface would double GPU memory and resolve
      // work per frame — enough to push mobile Safari into presenting
      // incomplete frames (parts of the canvas stay black/transparent).
      antialias: false,
      logarithmicDepthBuffer: true,
      powerPreference: 'high-performance',
    });
    // Clear opaque to the void colour the scenes use: without this the canvas
    // can composite the page background through wherever nothing was drawn.
    this.renderer.setClearColor(0x010208, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = true;
    // Accumulate draw stats across the whole frame (all composer passes).
    this.renderer.info.autoReset = false;

    this.maxDPR = Math.min(window.devicePixelRatio || 1, 2);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 5e7);
    this.camera.position.set(0, 8, 26);

    this.scene = new THREE.Scene();

    // HDR + MSAA composer target: half-float kills banding in the bloom
    // chain, 8x samples keep lines and limbs clean — without this the
    // whole post pipeline renders aliased 8-bit. `?q=low` (used by the
    // headless verification runner) drops MSAA and DPR for speed.
    const q = new URLSearchParams(window.location.search).get('q');
    this.quality = q === 'low' ? 'low' : 'high';
    if (this.quality === 'low') this.maxDPR = 1;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: this.quality === 'low' ? 0 : 8,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.5, 0.55, 1.0);
    this.outputPass = new OutputPass();
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.gradePass);

    // Overlays render after the composer (warp tunnel, compare scene):
    // entries are { scene, camera, enabled }.
    this.overlays = [];

    this._frameCbs = new Set();
    this._clock = new THREE.Clock();
    this._fpsEMA = 60;
    this._running = false;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  get gl() {
    return this.renderer.getContext();
  }

  setScene(scene) {
    this.scene = scene;
    this.renderPass.scene = scene;
  }

  setBloom({ strength, radius, threshold, enabled }) {
    if (strength !== undefined) this.bloomPass.strength = strength;
    if (radius !== undefined) this.bloomPass.radius = radius;
    if (threshold !== undefined) this.bloomPass.threshold = threshold;
    if (enabled !== undefined) this.bloomPass.enabled = enabled;
  }

  setMaxDPR(dpr) {
    this.maxDPR = dpr;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDPR);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setSize(w * dpr, h * dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    for (const ov of this.overlays) {
      if (ov.camera.isPerspectiveCamera) {
        ov.camera.aspect = w / h;
        ov.camera.updateProjectionMatrix();
      }
    }
  }

  /** Register a per-frame callback fn(dtSeconds). Returns an unsubscribe. */
  onFrame(fn) {
    this._frameCbs.add(fn);
    return () => this._frameCbs.delete(fn);
  }

  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      requestAnimationFrame(loop);
      this.renderFrame();
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
  }

  renderFrame() {
    this.renderer.info.reset();
    const dt = Math.min(this._clock.getDelta(), 0.25);
    if (dt > 0) {
      const inst = 1 / Math.max(dt, 1e-4);
      this._fpsEMA += (inst - this._fpsEMA) * 0.02;
    }
    for (const fn of this._frameCbs) fn(dt);
    this.composer.render();
    if (this.overlays.length) {
      const prevAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      for (const ov of this.overlays) {
        if (!ov.enabled) continue;
        if (ov.clearDepth !== false) this.renderer.clearDepth();
        this.renderer.render(ov.scene, ov.camera);
      }
      this.renderer.autoClear = prevAutoClear;
    }
  }

  get fps() {
    return this._fpsEMA;
  }

  /**
   * Average color of a CSS-pixel rectangle of the current frame.
   * Renders synchronously first so the read is defined even without
   * preserveDrawingBuffer. Origin: top-left in CSS pixels.
   */
  probe(x, y, w = 1, h = 1) {
    this.renderFrame();
    const gl = this.gl;
    const dpr = this.renderer.getPixelRatio();
    const px = Math.round(x * dpr);
    const pw = Math.max(1, Math.round(w * dpr));
    const ph = Math.max(1, Math.round(h * dpr));
    const py = gl.drawingBufferHeight - Math.round(y * dpr) - ph;
    const buf = new Uint8Array(pw * ph * 4);
    gl.readPixels(px, py, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let r = 0, g = 0, b = 0;
    const n = pw * ph;
    for (let i = 0; i < n; i++) {
      r += buf[i * 4];
      g += buf[i * 4 + 1];
      b += buf[i * 4 + 2];
    }
    r /= n; g /= n; b /= n;
    return { r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
  }

  rendererInfo() {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }
}

export function webgl2Available() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}
