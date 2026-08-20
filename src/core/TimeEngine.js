/**
 * Simulation clock. All orbital mechanics run on Julian Dates (TT ~ UTC is
 * fine at our precision). Speed is expressed in simulated seconds per real
 * second, controlled on a log slider elsewhere.
 */
export const J2000 = 2451545.0;
export const DAY_S = 86400;
export const JD_MIN = 2378497.0; // 1800-01-01, matches element validity
export const JD_MAX = 2524594.0; // 2200-01-01

export function jdFromDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function dateFromJD(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}

/** Centuries since J2000 — the time argument of the Standish mean elements. */
export function centuriesSinceJ2000(jd) {
  return (jd - J2000) / 36525;
}

export class TimeEngine {
  constructor() {
    // Deterministic boot state: today at 00:00 UTC.
    const now = new Date();
    this.jd = jdFromDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
    this.speed = 1;          // sim seconds per real second
    this.paused = false;
    this._listeners = new Set();
  }

  tick(dtRealS) {
    if (this.paused || dtRealS <= 0) return;
    this.setJD(this.jd + (this.speed * dtRealS) / DAY_S);
  }

  setJD(jd) {
    this.jd = Math.min(JD_MAX, Math.max(JD_MIN, jd));
    for (const fn of this._listeners) fn(this.jd);
  }

  setSpeed(simSecondsPerSecond) {
    this.speed = simSecondsPerSecond;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  get date() {
    return dateFromJD(this.jd);
  }
}
