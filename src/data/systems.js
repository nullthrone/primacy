import { sol } from './sol.js';
import { proxima } from './proxima.js';
import { ross128 } from './ross128.js';

/** Registry of the three systems + their positions in the neighborhood (pc, galactic-ish frame used by the interstellar map). */
export const SYSTEM_DEFS = { sol, proxima, ross128 };
export const SYSTEM_ORDER = ['sol', 'proxima', 'ross128'];
