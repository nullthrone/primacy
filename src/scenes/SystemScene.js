import * as THREE from 'three';
import { StarBody } from '../bodies/StarBody.js';
import { PlanetBody } from '../bodies/PlanetBody.js';
import { OrbitTrail } from '../orbits/OrbitTrail.js';
import { keplerPosition, eccentricAnomalyAt, trueAnomalyAt } from '../orbits/Kepler.js';
import { SkyDome } from './SkyDome.js';

const _vAU = new THREE.Vector3();
const _vScene = new THREE.Vector3();
const _sunDir = new THREE.Vector3();

/**
 * A living star system built from a data definition: star, orbiting
 * bodies (hierarchical), orbit trails, sky. Owns per-frame propagation:
 * Kepler positions in AU mapped through the ScaleManager.
 */
export class SystemScene {
  constructor({ def, engine, time, scale, materials = null }) {
    this.def = def;
    this.engine = engine;
    this.time = time;
    this.scale = scale;
    this.materials = materials;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010208);

    this.sky = new SkyDome({ seed: def.id === 'sol' ? 42 : def.id.length * 101 });
    this.scene.add(this.sky.group);

    this.controllers = new Map(); // id -> controller
    this._buildStar(def.star);
    for (const bodyDef of def.bodies) this._buildBody(bodyDef);

    // Update order: parents before children.
    this.order = [...this.controllers.values()].sort((a, b) => a.depth - b.depth);

    this.scene.add(new THREE.AmbientLight(0x4a5a74, 0.10));

    this._trailsDirty = true;
  }

  _depthOf(def) {
    let d = 0;
    let cur = def;
    while (cur.parent && cur.parent !== this.def.star.id) {
      cur = this.def.bodies.find((b) => b.id === cur.parent);
      d++;
      if (!cur) break;
    }
    return d;
  }

  _buildStar(starDef) {
    const star = new StarBody({
      id: starDef.id,
      teffK: starDef.star.teffK,
      activity: starDef.star.activity,
      seed: starDef.star.seed,
    });
    star.setRadius(this.scale.mapRadius(starDef.physical.radiusKm));
    this.scene.add(star.group);
    this.controllers.set(starDef.id, {
      id: starDef.id, def: starDef, kind: 'star', body: star,
      group: star.group, depth: -1, parent: null,
      worldPos: new THREE.Vector3(),
    });
  }

  _buildBody(def) {
    const body = new PlanetBody(def, this.materials);
    body.setRadius(this.scale.mapRadius(def.physical.radiusKm));

    const parentCtl = this.controllers.get(def.parent ?? this.def.star.id);
    parentCtl.group.add(body.group);

    let trail = null;
    if (def.trail !== false && def.elements) {
      trail = new OrbitTrail(def.elements, def.material?.tint ?? 0x5a7ca8);
      parentCtl.group.add(trail.line);
    }

    this.controllers.set(def.id, {
      id: def.id, def, kind: def.type, body,
      group: body.group, depth: this._depthOf(def), parent: parentCtl,
      trail,
      worldPos: new THREE.Vector3(),
    });
  }

  /** Maps a parent-relative AU vector according to body kind (planet vs moon). */
  _mapRelative(ctl, vAU, target) {
    if (ctl.def.moonScale) {
      return this.scale.mapMoonVector(vAU, ctl.def.moonScale, target);
    }
    return this.scale.mapVector(vAU, target);
  }

  update(dt) {
    const jd = this.time.jd;
    const scaleAnimating = this.scale.tick(dt);
    if (scaleAnimating) this._trailsDirty = true;

    for (const ctl of this.order) {
      if (ctl.kind === 'star') {
        ctl.body.update(dt, this.engine.camera);
        if (scaleAnimating) ctl.body.setRadius(this.scale.mapRadius(ctl.def.physical.radiusKm));
        continue;
      }
      const el = ctl.def.elements;
      if (el) {
        keplerPosition(el, jd, _vAU);
        this._mapRelative(ctl, _vAU, _vScene);
        ctl.group.position.copy(_vScene);
        if (ctl.trail) ctl.trail.setHead(eccentricAnomalyAt(el, jd));
      }
      ctl.worldPos.copy(ctl.parent.worldPos).add(ctl.group.position);
      if (ctl.def.physical.tidallyLocked && el) {
        // Face the parent exactly: spin angle = true longitude + pi.
        const { nu } = trueAnomalyAt(el, jd);
        const elNow = el;
        // True longitude in the orbit plane approximated by nu + w + Om
        // (good for the near-circular, low-inclination exo orbits).
        const DEG = Math.PI / 180;
        const lon = nu + (elNow.w ?? 0) * DEG + (elNow.Om ?? 0) * DEG;
        ctl.body.setSpinAngle(-lon + Math.PI);
      } else {
        ctl.body.updateSpin(jd);
      }
      if (scaleAnimating) ctl.body.setRadius(this.scale.mapRadius(ctl.def.physical.radiusKm));

      // World-space sun geometry for shader materials and extras.
      const starCtl = this.star;
      _sunDir.copy(starCtl.worldPos).sub(ctl.worldPos);
      const d = _sunDir.length();
      if (d > 1e-9) _sunDir.multiplyScalar(1 / d);
      ctl.body.setSun(_sunDir, starCtl.worldPos, starCtl.body.light.color, ctl.worldPos);
      ctl.body.update(dt, this.engine.camera);
    }

    if (this._trailsDirty) {
      this._rebuildTrails(jd);
      this._trailsDirty = false;
    }
  }

  _rebuildTrails(jd) {
    for (const ctl of this.order) {
      if (!ctl.trail) continue;
      ctl.trail.rebuild(jd, (v) => this._mapRelative(ctl, v, v));
    }
  }

  /** World position of a body (scene units). */
  worldPosOf(id, target = new THREE.Vector3()) {
    const ctl = this.controllers.get(id);
    if (!ctl) return null;
    return ctl.group.getWorldPosition(target);
  }

  get star() {
    return this.controllers.get(this.def.star.id);
  }

  dispose() {
    for (const ctl of this.controllers.values()) {
      ctl.body.dispose?.();
      ctl.trail?.dispose();
    }
    this.sky.dispose();
  }
}
