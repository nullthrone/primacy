import * as THREE from 'three';
import { makeGhostTexture, makeStreakTexture, makeGlowTexture } from '../procgen/FlareSprites.js';

/**
 * Screen-space lens flare rendered after the composer (the stock Lensflare
 * addon copies framebuffer tiles, which breaks on multisampled HDR
 * targets). An anamorphic streak sits on the star; ghost discs march along
 * the axis from the star through screen center. Everything fades when the
 * star leaves the frame or sits behind the camera.
 */
export class FlareOverlay {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.enabled = true;
    this.clearDepth = false;

    const make = (tex, sizePx, tint = 0xffffff, opacity = 1) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        color: tint,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        opacity,
      }));
      s.userData.sizePx = sizePx;
      this.scene.add(s);
      return s;
    };

    this.streak = make(makeStreakTexture('170,205,255'), 420, 0xffffff, 0.3);
    this.streak.userData.sizePxY = 64;
    this.core = make(makeGlowTexture({ rays: false }), 110, 0xfff4dd, 0.5);
    this.ghosts = [
      { sprite: make(makeGhostTexture('170,215,255'), 52, 0xffffff, 0.30), d: 0.35 },
      { sprite: make(makeGhostTexture('255,210,160'), 30, 0xffffff, 0.26), d: 0.55 },
      { sprite: make(makeGhostTexture('170,255,220'), 78, 0xffffff, 0.20), d: 0.85 },
      { sprite: make(makeGhostTexture('200,200,255'), 44, 0xffffff, 0.24), d: 1.15 },
      { sprite: make(makeGhostTexture('255,235,190'), 22, 0xffffff, 0.28), d: 1.45 },
    ];
    this._ndc = new THREE.Vector3();

    engine.overlays.push(this);
  }

  /** Call per frame with the flare source (star) world position. */
  track(worldPos, intensity = 1) {
    if (!worldPos) {
      for (const child of this.scene.children) child.visible = false;
      return;
    }
    const cam = this.engine.camera;
    this._ndc.copy(worldPos).project(cam);
    const behind = this._ndc.z > 1 || this._ndc.z < -1;
    const off = Math.max(Math.abs(this._ndc.x), Math.abs(this._ndc.y));
    const vis = behind ? 0 : THREE.MathUtils.clamp(1.35 - off, 0, 1) * intensity;

    const w = window.innerWidth, h = window.innerHeight;
    const sx = this._ndc.x, sy = this._ndc.y;

    const place = (sprite, x, y, o) => {
      sprite.position.set(x, y, -1);
      const px = sprite.userData.sizePx;
      const py = sprite.userData.sizePxY ?? px;
      sprite.scale.set((px / w) * 2, (py / h) * 2, 1);
      sprite.material.opacity = o;
      sprite.visible = o > 0.004;
    };

    place(this.streak, sx, sy, 0.3 * vis);
    this.streak.scale.x *= 3.2;
    place(this.core, sx, sy, 0.45 * vis);
    for (const g of this.ghosts) {
      if (g.base === undefined) g.base = g.sprite.material.opacity;
      // Ghosts march along the star -> screen-center axis and beyond.
      const gx = sx * (1 - g.d * 1.6);
      const gy = sy * (1 - g.d * 1.6);
      place(g.sprite, gx, gy, g.base * vis);
    }
  }
}
