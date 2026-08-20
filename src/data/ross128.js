/**
 * Ross 128 system (Bonfils+ 2017). A notably QUIET M dwarf — the
 * demonstrative contrast to flaring Proxima. Ross 128 b's radius is
 * unknown (no transit); the rendered globe is an assumption flagged via
 * knowledge.certainty = 'msini'.
 */
export const ross128 = {
  id: 'ross128',
  star: {
    id: 'ross128-star',
    type: 'star',
    physical: {
      radiusKm: 137662,        // 0.197 R_sun
      massE: 55944,            // 0.168 M_sun
      rotationH: 2900,         // ~121 d, slow = old and calm
      obliquityDeg: 0,
      tempK: { mean: 3192 },
      gravity: 4.9,
    },
    star: {
      teffK: 3192, activity: 0.12, seed: 57, spectral: 'M4V',
      luminositySun: 0.00362, flareStar: false, granScale: 14, distanceLy: 11.007,
    },
    i18n: 'body.ross128Star',
    knowledge: { certainty: 'resolved' },
  },
  hz: { consInner: 0.057, consOuter: 0.101, optInner: 0.045, optOuter: 0.106 },
  bodies: [
    {
      id: 'ross128-b', type: 'planet', parent: 'ross128-star',
      elements: { kind: 'direct', a: 0.0496, e: 0.036, i: 0, Om: 0, w: 220, M0: 130, epoch: 2451545.0, periodD: 9.8596 },
      physical: {
        radiusKm: 7400, massE: 1.4, rotationH: null, obliquityDeg: 0,
        tidallyLocked: true, tempK: { min: 213, mean: 256, max: 301 }, gravity: 11.5,
        discovery: { year: 2017, method: 'RV (HARPS)' },
      },
      material: {
        kind: 'eyeball', eyeball: { type: 'dry', seed: 73 },
        atmosphere: { kind: 'rim', color: 0xc8a878, strength: 0.7 },
        fallback: 'mars', tint: 0xb89a6a,
      },
      trail: true, labelRank: 1, i18n: 'body.ross128B',
      knowledge: { certainty: 'msini', mSinI: 1.40, radiusKm: null },
    },
  ],
  belts: [],
};
