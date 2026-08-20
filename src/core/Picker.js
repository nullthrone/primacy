import * as THREE from 'three';

const _ndc = new THREE.Vector3();

/**
 * Click selection via screen-space matching: a body is hit when the click
 * lands within max(14 px, projected radius + 6 px) of its projected
 * center. This keeps one-pixel true-scale planets clickable without any
 * raycast against tiny geometry. Drags never select.
 */
export class Picker {
  constructor(engine, domElement, getControllers, onPick) {
    this.engine = engine;
    this.getControllers = getControllers;
    this.onPick = onPick;
    this._down = null;

    domElement.addEventListener('pointerdown', (e) => {
      this._down = { x: e.clientX, y: e.clientY };
    });
    domElement.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
      this._down = null;
      if (moved > 5) return;
      const id = this.pickAt(e.clientX, e.clientY);
      if (id) this.onPick(id);
    });
  }

  pickAt(px, py) {
    const cam = this.engine.camera;
    const w = window.innerWidth, h = window.innerHeight;
    let best = null;
    for (const ctl of this.getControllers()) {
      if (!ctl.body?.displayRadius && ctl.kind !== 'star') continue;
      _ndc.copy(ctl.worldPos).project(cam);
      if (_ndc.z > 1 || _ndc.z < -1) continue;
      const sx = (_ndc.x * 0.5 + 0.5) * w;
      const sy = (-_ndc.y * 0.5 + 0.5) * h;
      const dist = cam.position.distanceTo(ctl.worldPos);
      const radius = ctl.body?.displayRadius ?? 1;
      const projR = (radius / (dist * Math.tan((cam.fov * Math.PI / 360)))) * (h / 2);
      const hitR = Math.max(14, projR + 6);
      const d = Math.hypot(px - sx, py - sy);
      if (d < hitR) {
        // Prefer the angularly closest; break ties toward smaller bodies
        // (moons in front of their planet).
        const score = d - Math.min(projR, 40) * 0.2;
        if (!best || score < best.score) best = { id: ctl.id, score };
      }
    }
    return best?.id ?? null;
  }
}
