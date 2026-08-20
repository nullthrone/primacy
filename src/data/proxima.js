/**
 * Proxima Centauri system. Orbits from RV fits (Faria+ 2022 for b/d,
 * Damasso+ 2020 for the candidate c). Radii of the planets are UNKNOWN
 * (no transits) — radiusKm values are mass-radius-relation assumptions,
 * flagged via knowledge.certainty = 'msini' / 'candidate' and rendered
 * honestly when the knowledge mode is active.
 */
export const proxima = {
  id: 'proxima',
  star: {
    id: 'proxima-star',
    type: 'star',
    physical: {
      radiusKm: 107280,        // 0.154 R_sun — only ~1.5 Jupiter diameters
      massE: 40660,            // 0.1221 M_sun
      rotationH: 1982,         // ~82.6 d
      obliquityDeg: 0,
      tempK: { mean: 3042 },
      gravity: 5.2,
    },
    star: {
      teffK: 3042, activity: 0.85, seed: 31, spectral: 'M5.5Ve',
      luminositySun: 0.0017, flareStar: true, granScale: 14, distanceLy: 4.2465,
    },
    i18n: 'body.proximaStar',
    knowledge: { certainty: 'resolved' },
  },
  hz: { consInner: 0.039, consOuter: 0.069, optInner: 0.031, optOuter: 0.073 },
  bodies: [
    {
      id: 'proxima-d', type: 'planet', parent: 'proxima-star',
      elements: { kind: 'direct', a: 0.02885, e: 0.04, i: 0, Om: 0, w: 10, M0: 200, epoch: 2451545.0, periodD: 5.122 },
      physical: {
        radiusKm: 5200, massE: 0.26, rotationH: null, obliquityDeg: 0,
        tidallyLocked: true, tempK: { mean: 360 }, gravity: 4.3,
        discovery: { year: 2022, method: 'RV (ESPRESSO)' },
      },
      material: { kind: 'eyeball', eyeball: { type: 'hot', seed: 41 }, atmosphere: null, fallback: 'rock', tint: 0xb87a5a },
      trail: true, labelRank: 3, i18n: 'body.proximaD',
      knowledge: { certainty: 'msini', mSinI: 0.26, radiusKm: null, kMS: 0.39 },
    },
    {
      id: 'proxima-b', type: 'planet', parent: 'proxima-star',
      elements: { kind: 'direct', a: 0.04857, e: 0.109, i: 0, Om: 0, w: 310, M0: 50, epoch: 2451545.0, periodD: 11.1868 },
      physical: {
        radiusKm: 7160, massE: 1.07, rotationH: null, obliquityDeg: 0,
        tidallyLocked: true, tempK: { mean: 234 }, gravity: 10.2,
        discovery: { year: 2016, method: 'RV (HARPS)' },
      },
      material: {
        kind: 'eyeball', eyeball: { type: 'temperate', seed: 17 }, aurora: true,
        atmosphere: { kind: 'rim', color: 0x7ab8d8, strength: 0.85 },
        fallback: 'terra', tint: 0x5888b8,
      },
      trail: true, labelRank: 1, i18n: 'body.proximaB',
      knowledge: { certainty: 'msini', mSinI: 1.07, radiusKm: null, kMS: 1.38 },
    },
    {
      id: 'proxima-c', type: 'planet', parent: 'proxima-star',
      elements: { kind: 'direct', a: 1.489, e: 0.04, i: 0, Om: 0, w: 90, M0: 300, epoch: 2451545.0, periodD: 1928 },
      physical: {
        radiusKm: 14000, massE: 5.8, rotationH: 90, obliquityDeg: 4,
        tidallyLocked: false, tempK: { mean: 39 }, gravity: 12,
        discovery: { year: 2020, method: 'RV + Astrometrie' },
      },
      material: {
        kind: 'eyeball', eyeball: { type: 'ice', seed: 23 },
        atmosphere: { kind: 'rim', color: 0x9ab8d0, strength: 0.4 },
        fallback: 'icegiant-uranus', tint: 0x9ab4c8,
      },
      trail: true, labelRank: 2, i18n: 'body.proximaC',
      knowledge: { certainty: 'candidate', mSinI: 5.8, radiusKm: null, kMS: 1.2 },
    },
  ],
  belts: [],
};
