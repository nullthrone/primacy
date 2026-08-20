import * as THREE from 'three';
import { J2000 } from '../core/TimeEngine.js';

/**
 * Keplerian orbit propagation.
 *
 * Two element flavors:
 *  - 'standish': JPL approximate mean elements of the major planets
 *    (J2000 values + centennial rates, valid 1800-2050): a, e, I, L,
 *    wbar (longitude of perihelion), Om. Angles in degrees.
 *  - 'direct': {a, e, i, Om, w, M0, epoch, periodD} for moons, comets,
 *    exoplanets. Angles in degrees, epoch as JD, M0 mean anomaly at epoch.
 *
 * Scene frame: ecliptic x -> scene X, ecliptic z (north) -> scene Y,
 * ecliptic y -> scene -Z (proper rotation, prograde stays prograde).
 */

const DEG = Math.PI / 180;

/** Solve Kepler's equation M = E - e sinE. Danby start, Newton iteration. */
export function solveKepler(M, e) {
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let E = M + 0.85 * e * Math.sign(Math.sin(M));
  for (let it = 0; it < 12; it++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < 1e-9) break;
  }
  return E;
}

/** Resolve time-dependent {a,e,i,Om,w,M} (radians/AU) from an element def. */
export function elementsAt(el, jd) {
  if (el.kind === 'standish') {
    const T = (jd - J2000) / 36525;
    const a = el.a + el.aDot * T;
    const e = el.e + el.eDot * T;
    const i = (el.I + el.IDot * T) * DEG;
    const L = (el.L + el.LDot * T) * DEG;
    const wbar = (el.wbar + el.wbarDot * T) * DEG;
    const Om = (el.Om + el.OmDot * T) * DEG;
    return { a, e, i, Om, w: wbar - Om, M: L - wbar };
  }
  // direct
  const n = (2 * Math.PI) / el.periodD; // rad per day
  const M = el.M0 * DEG + n * (jd - el.epoch);
  return { a: el.a, e: el.e, i: el.i * DEG, Om: el.Om * DEG, w: el.w * DEG, M };
}

/**
 * Position in the parent-centric scene-oriented frame, in AU.
 * Also returns E (eccentric anomaly) and r (AU) for trail/tidal-lock use.
 */
export function keplerPosition(el, jd, target = new THREE.Vector3()) {
  const { a, e, i, Om, w, M } = elementsAt(el, jd);
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);              // orbital-plane coords
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const ci = Math.cos(i), si = Math.sin(i);

  const xe = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const ye = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const ze = (sw * si) * xp + (cw * si) * yp;

  target.set(xe, ze, -ye);
  return target;
}

/** Eccentric anomaly (0..2pi) at jd — drives the orbit-trail fade head. */
export function eccentricAnomalyAt(el, jd) {
  const { e, M } = elementsAt(el, jd);
  return solveKepler(M, e);
}

/** True anomaly + radius, used for exact tidal locking. */
export function trueAnomalyAt(el, jd) {
  const { a, e, M } = elementsAt(el, jd);
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  return { nu, r };
}

/**
 * Sample the full orbit ellipse (by eccentric anomaly) in the same frame
 * as keplerPosition, for trail geometry. Returns Float32Array xyz triples
 * in AU and the matching phase array (E/2pi).
 */
export function sampleOrbit(el, jd, segments = 512) {
  const { a, e, i, Om, w } = elementsAt(el, jd);
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const ci = Math.cos(i), si = Math.sin(i);
  const positions = new Float32Array(segments * 3);
  const phases = new Float32Array(segments);
  for (let s = 0; s < segments; s++) {
    const E = (s / segments) * 2 * Math.PI;
    const xp = a * (Math.cos(E) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const xe = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
    const ye = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
    const ze = (sw * si) * xp + (cw * si) * yp;
    positions[s * 3] = xe;
    positions[s * 3 + 1] = ze;
    positions[s * 3 + 2] = -ye;
    phases[s] = s / segments;
  }
  return { positions, phases };
}
