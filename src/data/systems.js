import * as THREE from 'three';
import { sol } from './sol.js';
import { proxima } from './proxima.js';
import { ross128 } from './ross128.js';
import { eqToVec } from '../scenes/SkyDome.js';
import { BRIGHT_FALLBACK } from './brightFallback.js';

/** Registry of the three systems. */
export const SYSTEM_DEFS = { sol, proxima, ross128 };
export const SYSTEM_ORDER = ['sol', 'proxima', 'ross128'];
export const VIEW_ORDER = ['sol', 'proxima', 'ross128', 'map'];

/** Positions in the solar neighborhood, equatorial cartesian parsecs (HYG). */
export const SYSTEM_POS_PC = {
  sol: new THREE.Vector3(0, 0, 0),
  proxima: eqToVec(217.4398, -62.6795, 1.2959),
  ross128: eqToVec(176.9354, 0.7993, 3.375),
};
sol.observerPc = SYSTEM_POS_PC.sol;
proxima.observerPc = SYSTEM_POS_PC.proxima;
ross128.observerPc = SYSTEM_POS_PC.ross128;

/**
 * Loads the HYG subset; falls back to the embedded ~90 brightest stars so
 * the catalog sky survives even without the committed JSON.
 */
export async function loadStarCatalog() {
  try {
    const res = await fetch('assets/stars/hyg_subset.json');
    if (res.ok) {
      const cat = await res.json();
      if (cat.n > 0) return cat;
    }
  } catch { /* fall through */ }
  const cat = { n: BRIGHT_FALLBACK.length, ra: [], dec: [], d: [], absmag: [], ci: [], names: {} };
  BRIGHT_FALLBACK.forEach((s, i) => {
    cat.ra.push(s.ra); cat.dec.push(s.dec); cat.d.push(s.d);
    cat.absmag.push(s.absmag); cat.ci.push(s.ci);
    if (s.name) cat.names[i] = s.name;
  });
  return cat;
}
