/**
 * Maps physical sizes (km, AU) to scene units. Physics always runs in AU;
 * only this mapping changes between modes.
 *
 *  - didactic: power-law compression. Distances 100 * AU^0.4, radii
 *    S * km^0.28 with S tuned so Earth ~ 2.5 u. Bodies stay visible and the
 *    outer system stays reachable, ratios keep their ordering.
 *  - true: linear, 1 unit = 1000 km. Nothing is inflated; tiny apparent
 *    sizes are compensated by screen-space markers, not by lying geometry.
 *
 * Mode switches interpolate (0..1) between both mapped outputs.
 */
export const KM_PER_AU = 149597870.7;

const D_COEF = 100, D_POW = 0.4;
const R_POW = 0.28;
const R_COEF = 2.5 / Math.pow(6371, R_POW); // Earth -> 2.5 u
const R_MIN = 0.35;
const TRUE_KM_PER_UNIT = 1000;

export class ScaleManager {
  constructor() {
    this.mode = 'didactic';
    this.blend = 0; // 0 = fully didactic, 1 = fully true scale
    this._target = 0;
    this._speed = 1 / 1.5; // full transition in 1.5 s
    this._listeners = new Set();
  }

  setMode(mode) {
    this.mode = mode === 'true' ? 'true' : 'didactic';
    this._target = this.mode === 'true' ? 1 : 0;
    for (const fn of this._listeners) fn(this.mode);
  }

  onModeChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Advance the transition; returns true while animating. */
  tick(dt) {
    if (this.blend === this._target) return false;
    const dir = Math.sign(this._target - this.blend);
    this.blend = Math.max(0, Math.min(1, this.blend + dir * dt * this._speed));
    return true;
  }

  get transitioning() {
    return this.blend !== this._target;
  }

  /** Ease used for blending the two mappings. */
  _mix(didactic, real) {
    if (this.blend <= 0) return didactic;
    if (this.blend >= 1) return real;
    const t = this.blend * this.blend * (3 - 2 * this.blend);
    return didactic + (real - didactic) * t;
  }

  /** Orbital distance AU -> scene units (magnitude mapping). */
  mapDistance(dAU) {
    const didactic = D_COEF * Math.pow(dAU, D_POW);
    const real = (dAU * KM_PER_AU) / TRUE_KM_PER_UNIT;
    return this._mix(didactic, real);
  }

  /** Maps a parent-centric AU offset vector preserving direction. */
  mapVector(vAU, target) {
    const len = vAU.length();
    if (len === 0) return target.set(0, 0, 0);
    const s = this.mapDistance(len) / len;
    return target.copy(vAU).multiplyScalar(s);
  }

  /** Didactic-only radius (used for build-time layout math). */
  didacticRadius(rKm) {
    return Math.max(R_MIN, R_COEF * Math.pow(rKm, R_POW));
  }

  /** Body radius km -> scene units. */
  mapRadius(rKm) {
    const didactic = Math.max(R_MIN, R_COEF * Math.pow(rKm, R_POW));
    const real = rKm / TRUE_KM_PER_UNIT;
    return this._mix(didactic, real);
  }

  /**
   * Moon-system distance mapping: parent-local compression so the whole
   * family sits between ~2.2 and ~12 parent display radii. coef/pow are
   * precomputed per parent in the system data loader.
   */
  mapMoonDistance(dAU, moonScale) {
    const dKm = dAU * KM_PER_AU;
    const didactic = moonScale.coef * Math.pow(dKm, moonScale.pow);
    const real = dKm / TRUE_KM_PER_UNIT;
    return this._mix(didactic, real);
  }

  mapMoonVector(vAU, moonScale, target) {
    const len = vAU.length();
    if (len === 0) return target.set(0, 0, 0);
    const s = this.mapMoonDistance(len, moonScale) / len;
    return target.copy(vAU).multiplyScalar(s);
  }
}
