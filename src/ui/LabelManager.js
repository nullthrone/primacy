import * as THREE from 'three';
import { makeDotTexture } from '../procgen/FlareSprites.js';

const _ndc = new THREE.Vector3();

/**
 * DOM labels + in-scene marker halos. Labels project each frame, greedily
 * declutter by rank (max ~22, no two labels within 52 px), and hide for
 * moons until the camera closes in on their parent. Markers are constant
 * screen-size dots that fade in when a body's projected radius drops
 * under ~3 px (true-scale honesty: geometry never inflates, but you can
 * still find and click everything).
 */
export class LabelManager {
  constructor(engine, container, getName, onClick) {
    this.engine = engine;
    this.container = container;
    this.getName = getName;
    this.onClick = onClick;
    this.entries = new Map();
    this.markerTex = makeDotTexture('180,205,235', 48);
    this.enabled = true;
  }

  attach(controllers) {
    for (const ctl of controllers) {
      if (this.entries.has(ctl.id)) continue;
      const el = document.createElement('button');
      el.className = 'body-label';
      el.type = 'button';
      el.textContent = this.getName(ctl);
      el.addEventListener('click', () => this.onClick(ctl.id));
      this.container.appendChild(el);

      const marker = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.markerTex,
        transparent: true,
        opacity: 0.0,
        depthTest: false,
        depthWrite: false,
        sizeAttenuation: false,
      }));
      marker.scale.setScalar(0.016);
      marker.renderOrder = 4;
      marker.visible = false;
      ctl.group.add(marker);

      this.entries.set(ctl.id, { ctl, el, marker, sx: 0, sy: 0, visible: false });
    }
  }

  refreshNames() {
    for (const e of this.entries.values()) e.el.textContent = this.getName(e.ctl);
  }

  update() {
    const cam = this.engine.camera;
    const w = window.innerWidth, h = window.innerHeight;
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
    const candidates = [];

    for (const e of this.entries.values()) {
      const { ctl } = e;
      e.visible = false;
      if (!this.enabled) continue;
      // Moon labels only near the parent.
      if (ctl.def?.moonScale && ctl.parent?.body?.displayRadius) {
        const camDist = cam.position.distanceTo(ctl.parent.worldPos);
        if (camDist > ctl.parent.body.displayRadius * 60) {
          e.marker.visible = false;
          continue;
        }
      }
      _ndc.copy(ctl.worldPos).project(cam);
      if (_ndc.z > 1 || _ndc.z < -1 || Math.abs(_ndc.x) > 1.1 || Math.abs(_ndc.y) > 1.1) {
        e.marker.visible = false;
        continue;
      }
      e.sx = (_ndc.x * 0.5 + 0.5) * w;
      e.sy = (-_ndc.y * 0.5 + 0.5) * h;

      const dist = cam.position.distanceTo(ctl.worldPos);
      const radius = ctl.body?.displayRadius ?? 1;
      const projR = (radius / (dist * tanHalf)) * (h / 2);
      e.projR = projR;

      // Marker halo for sub-3px bodies.
      const wantMarker = projR < 3 && ctl.kind !== 'star';
      e.marker.visible = wantMarker;
      e.marker.material.opacity = wantMarker ? 0.55 : 0;

      candidates.push(e);
    }

    // Declutter: rank order, then greedy spacing.
    candidates.sort((a, b) => (a.ctl.def?.labelRank ?? 9) - (b.ctl.def?.labelRank ?? 9));
    const kept = [];
    for (const e of candidates) {
      if (kept.length >= 22) break;
      if (kept.some((k) => Math.hypot(k.sx - e.sx, k.sy - e.sy) < 52)) continue;
      kept.push(e);
      e.visible = true;
    }

    for (const e of this.entries.values()) {
      if (e.visible) {
        e.el.style.transform = `translate(${e.sx.toFixed(1)}px, ${(e.sy + Math.max(10, e.projR + 6)).toFixed(1)}px) translate(-50%, 0)`;
        e.el.classList.add('on');
      } else {
        e.el.classList.remove('on');
      }
    }
  }

  markersVisible() {
    return [...this.entries.values()].filter((e) => e.marker.visible).map((e) => e.ctl.id);
  }

  dispose() {
    for (const e of this.entries.values()) e.el.remove();
    this.entries.clear();
  }
}
