import * as THREE from 'three';
import { StarBody } from '../bodies/StarBody.js';
import { PlanetBody } from '../bodies/PlanetBody.js';
import { CometBody } from '../bodies/CometBody.js';
import { BeltField } from '../bodies/BeltField.js';
import { OrbitTrail } from '../orbits/OrbitTrail.js';
import { keplerPosition, eccentricAnomalyAt, trueAnomalyAt } from '../orbits/Kepler.js';
import { SkyDome } from './SkyDome.js';
import { KM_PER_AU } from '../core/ScaleManager.js';

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
    this._computeMoonScales();

    // Update order: parents before children.
    this.order = [...this.controllers.values()].sort((a, b) => a.depth - b.depth);

    this.belts = (def.belts ?? []).map((b) => {
      const belt = new BeltField(b);
      this.scene.add(belt.mesh);
      return belt;
    });

    this.scene.add(new THREE.AmbientLight(0x4a5a74, 0.10));

    this._trailsDirty = true;
    this.trailsEnabled = true;
  }

  setTrailsVisible(v) {
    this.trailsEnabled = v;
    for (const ctl of this.controllers.values()) {
      if (ctl.trail && !ctl.def.moonScale) ctl.trail.line.visible = v;
    }
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
    const body = def.type === 'comet'
      ? new CometBody(def)
      : new PlanetBody(def, this.materials);
    body.setRadius(this.scale.mapRadius(def.physical.radiusKm));

    const parentCtl = this.controllers.get(def.parent ?? this.def.star.id);
    // Moons flagged as equatorial ride on the parent's tilt group so their
    // orbits (and Saturn's rings) share the parent's obliquity.
    const mount = def.orbitInParentEquator && parentCtl.body?.tilt
      ? parentCtl.body.tilt
      : parentCtl.group;
    mount.add(body.group);

    let trail = null;
    if (def.trail !== false && def.elements) {
      const TRAIL_COLORS = { planet: 0x6b8fc4, dwarf: 0x8a78b8, moon: 0x60718e, comet: 0x7cb8dc };
      trail = new OrbitTrail(def.elements, TRAIL_COLORS[def.type] ?? 0x5878a8);
      mount.add(trail.line);
    }

    this.controllers.set(def.id, {
      id: def.id, def, kind: def.type, body,
      group: body.group, depth: this._depthOf(def), parent: parentCtl,
      trail,
      worldPos: new THREE.Vector3(),
    });
  }

  /**
   * Per-parent didactic compression for moon systems: innermost moon lands
   * at >= 2.2 parent display radii, outermost at <= 12, ratios stay honest.
   */
  _computeMoonScales() {
    const byParent = new Map();
    for (const ctl of this.controllers.values()) {
      if (ctl.def.parent && ctl.def.parent !== this.def.star.id && ctl.def.elements) {
        const arr = byParent.get(ctl.def.parent) ?? [];
        arr.push(ctl);
        byParent.set(ctl.def.parent, arr);
      }
    }
    for (const [pid, moons] of byParent) {
      const parent = this.controllers.get(pid);
      const R = this.scale.didacticRadius(parent.def.physical.radiusKm);
      const ds = moons.map((m) => m.def.elements.a * KM_PER_AU);
      const dMin = Math.min(...ds);
      const dMax = Math.max(...ds);
      let pow, coef;
      if (moons.length === 1 || dMax / dMin < 1.05) {
        pow = 0.45;
        coef = (5.5 * R) / Math.pow(dMin, pow);
      } else {
        pow = Math.min(0.9, Math.max(0.12, Math.log(12 / 2.2) / Math.log(dMax / dMin)));
        coef = (2.2 * R) / Math.pow(dMin, pow);
      }
      const moonScale = { coef, pow };
      for (const m of moons) m.def.moonScale = moonScale;
    }
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
      let rAU = 0;
      if (el) {
        keplerPosition(el, jd, _vAU);
        rAU = _vAU.length();
        this._mapRelative(ctl, _vAU, _vScene);
        ctl.group.position.copy(_vScene);
        if (ctl.trail) ctl.trail.setHead(eccentricAnomalyAt(el, jd));
      }
      ctl.group.getWorldPosition(ctl.worldPos);

      // Moon orbit lines only resolve once the camera closes in on the
      // parent — from system range they are visual noise.
      if (ctl.trail && ctl.def.moonScale && ctl.parent?.body?.displayRadius) {
        const camDist = this.engine.camera.position.distanceTo(ctl.parent.worldPos);
        ctl.trail.line.visible = this.trailsEnabled && camDist < ctl.parent.body.displayRadius * 60;
      }
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
      if (ctl.kind === 'comet') {
        ctl.body.updateTails(ctl.worldPos, starCtl.worldPos, this.engine.camera, Math.max(rAU, 0.05), dt);
      }
      ctl.body.update(dt, this.engine.camera);
    }

    for (const belt of this.belts) belt.update(jd, this.scale.blend);

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
    for (const belt of this.belts) belt.dispose();
    this.sky.dispose();
  }
}
