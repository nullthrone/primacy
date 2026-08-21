import * as THREE from 'three';
import { t, fmt } from './i18n.js';
import { proceduralTexture } from '../procgen/ProceduralTextures.js';

/**
 * Size-comparison mode: bodies lined up at TRUE relative radii in an
 * overlay scene (rendered after the composer with its own backdrop). The
 * Sun enters as a limb wall on the left — it would not fit any other way.
 */
const LINEUP = [
  { id: 'sun', radiusKm: 695700, star: true },
  { id: 'jupiter', radiusKm: 69911, slot: 'jupiter', fallback: 'gasgiant-jupiter' },
  { id: 'saturn', radiusKm: 58232, slot: 'saturn', fallback: 'gasgiant-saturn' },
  { id: 'neptune', radiusKm: 24622, slot: 'neptune', fallback: 'icegiant-neptune' },
  { id: 'earth', radiusKm: 6371, slot: 'earth_day', fallback: 'terra' },
  { id: 'ross128-b', radiusKm: 7400, i18n: 'body.ross128B', tint: 0xb89a6a, assumed: true },
  { id: 'proxima-b', radiusKm: 7160, i18n: 'body.proximaB', tint: 0x5888b8, assumed: true },
  { id: 'mars', radiusKm: 3389.5, slot: 'mars', fallback: 'mars' },
  { id: 'moon', radiusKm: 1737.4, slot: 'moon', fallback: 'moon-rock' },
];

export class ComparePanel {
  constructor(engine, materials, labelRoot) {
    this.engine = engine;
    this.labelRoot = labelRoot;
    this.enabled = false;
    this.clearDepth = true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 400);

    // Opaque backdrop so the overlay reads as its own stage.
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ color: 0x17161a })
    );
    back.material.depthTest = false;
    back.frustumCulled = false;
    back.renderOrder = -1;
    back.onBeforeRender = (r, s, cam) => {
      back.position.copy(cam.position);
      back.translateZ(-350);
      back.lookAt(cam.position);
      back.scale.setScalar(700);
    };
    this.scene.add(back);

    this.scene.add(new THREE.AmbientLight(0x8899bb, 0.75));
    this.keyLight = new THREE.DirectionalLight(0xfff2e0, 3.2);
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    const S = 1.9 / 69911; // Jupiter -> 1.9 units
    let x = 0;
    this.slots = [];
    for (const item of LINEUP) {
      const r = item.radiusKm * S;
      let mesh;
      if (item.star) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(1, 96, 48),
          new THREE.MeshBasicMaterial({ color: 0xffe2b0 })
        );
        // Limb wall: center far left, only the edge in frame.
        mesh.position.set(-r - 3.6, 0, 0);
      } else {
        const tex = materials?.tex(item.slot) ?? (item.fallback ? proceduralTexture(item.fallback, 5) : null);
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(1, 48, 24),
          tex
            ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
            : new THREE.MeshStandardMaterial({ color: item.tint ?? 0x8899aa, roughness: 0.9 })
        );
        x += r + 0.35;
        mesh.position.set(x, 0, 0);
        x += r;
      }
      mesh.scale.setScalar(r);
      this.scene.add(mesh);
      this.slots.push({ item, mesh, r });
    }

    this.camera.position.set(x * 0.42, 1.2, 7.8);
    this.camera.lookAt(x * 0.42, 0, 0);
    this.keyLight.position.set(x * 0.42 - 3, 3.5, 9);
    this.keyLight.target.position.set(x * 0.42, 0, 0);

    engine.overlays.push(this);
    this.labels = [];
  }

  toggle(nameOf) {
    this.enabled ? this.hide() : this.show(nameOf);
  }

  show() {
    this.enabled = true;
    document.body.classList.add('compare');
    const cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight;

    // Frame the whole line-up for whatever aspect ratio we were handed. A
    // phone held upright gets the same set, just further away — cropping it
    // would hide exactly the comparison the mode exists to make.
    let minX = Infinity, maxX = -Infinity, maxR = 0;
    for (const { item, mesh, r } of this.slots) {
      if (item.star) continue;
      minX = Math.min(minX, mesh.position.x - r);
      maxX = Math.max(maxX, mesh.position.x + r);
      maxR = Math.max(maxR, r);
    }
    const centre = (minX + maxX) / 2;
    const halfV = Math.tan((cam.fov * Math.PI) / 360);
    const z = Math.max(
      7.8,
      ((maxX - minX) / 2 + 0.8) / (halfV * cam.aspect),
      (maxR + 1.15) / halfV,
    );
    cam.position.set(centre, maxR * 0.35, z);
    cam.lookAt(centre, 0, 0);
    cam.updateProjectionMatrix();
    // project() reads matrixWorldInverse — refresh it before placing captions.
    cam.updateMatrixWorld(true);
    this.keyLight.position.set(centre - z * 0.4, z * 0.45, z + 1.2);
    this.keyLight.target.position.set(centre, 0, 0);

    // DOM captions under each body (static camera -> compute once).
    this._clearLabels();
    this.labelRoot.hidden = false;
    const v = new THREE.Vector3();
    const placed = [];
    for (const { item, mesh, r } of this.slots) {
      if (item.star) continue;
      v.copy(mesh.position);
      v.y -= r + 0.28;
      v.project(cam);
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const el = document.createElement('div');
      el.className = 'compare-label';
      const name = t(`${item.i18n ?? `body.${item.id}`}.name`);
      el.innerHTML = `<b>${name}</b><span>${fmt(item.radiusKm)} km${item.assumed ? ' ≈' : ''}</span>`;
      this.labelRoot.appendChild(el);
      this.labels.push(el);
      placed.push({
        el,
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      });
    }
    this._placeLabels(placed);
  }

  /**
   * Positions the captions: clamped into the frame (a caption under a large
   * body projects below it) and staggered onto a second line where the small
   * bodies sit closer together than their labels are wide.
   */
  _placeLabels(placed) {
    const pad = 8;
    placed.sort((a, b) => a.x - b.x);
    const ROWS = 3;
    const rowRight = new Array(ROWS).fill(-Infinity);
    let rowHeight = 0;
    for (const p of placed) {
      const w = p.el.offsetWidth;
      const h = p.el.offsetHeight;
      rowHeight = Math.max(rowHeight, h);
      const left = Math.min(Math.max(p.x, w / 2 + pad), window.innerWidth - w / 2 - pad);
      // First row this caption clears; if none does, it goes back on top.
      let row = rowRight.findIndex((right) => left - w / 2 >= right + 6);
      if (row < 0) row = 0;
      const top = Math.min(
        Math.max(p.y + row * (rowHeight + 6), pad),
        window.innerHeight - h - pad
      );
      p.el.style.left = `${left.toFixed(1)}px`;
      p.el.style.top = `${top.toFixed(1)}px`;
      rowRight[row] = left + w / 2;
    }
  }

  hide() {
    this.enabled = false;
    document.body.classList.remove('compare');
    this._clearLabels();
    this.labelRoot.hidden = true;
  }

  _clearLabels() {
    for (const el of this.labels) el.remove();
    this.labels = [];
  }
}
