/**
 * Deterministic PRNG (mulberry32). Everything stochastic in the app —
 * belt distributions, procedural textures, star sprinkles — draws from
 * seeded instances so reloads and verification screenshots are stable.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Prng {
  constructor(seed = 1337) {
    this.next = mulberry32(seed);
  }
  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }
  int(min, maxInclusive) {
    return Math.floor(this.float(min, maxInclusive + 1));
  }
  pick(arr) {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }
  /** Approximately normal via sum of three uniforms (Irwin–Hall). */
  gaussish(mean = 0, spread = 1) {
    return mean + (this.next() + this.next() + this.next() - 1.5) * spread;
  }
}
