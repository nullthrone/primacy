/**
 * Sol system definition. Orbital elements for the eight planets are the
 * JPL/Standish approximate mean elements (J2000 + centennial rates, valid
 * 1800-2050). Moons/dwarfs/comet use direct mean elements. Distances AU,
 * radii km, rotation hours (negative = retrograde), angles degrees.
 * material.kind is resolved by the material factory (M3); fallback names a
 * procedural archetype so the site works without downloaded textures.
 */
export const sol = {
  id: 'sol',
  star: {
    id: 'sun',
    type: 'star',
    physical: {
      radiusKm: 695700,
      massE: 333000,
      rotationH: 609.12,
      obliquityDeg: 7.25,
      tempK: { mean: 5772 },
      gravity: 274,
      discovery: null,
    },
    star: { teffK: 5772, activity: 0.35, seed: 7, spectral: 'G2V' },
    i18n: 'body.sun',
    knowledge: { certainty: 'photographed' },
  },
  bodies: [
    {
      id: 'mercury', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 0.38709927, aDot: 0.00000037, e: 0.20563593, eDot: 0.00001906,
        I: 7.00497902, IDot: -0.00594749, L: 252.25032350, LDot: 149472.67411175,
        wbar: 77.45779628, wbarDot: 0.16047689, Om: 48.33076593, OmDot: -0.12534081,
        periodD: 87.969,
      },
      physical: {
        radiusKm: 2439.7, massE: 0.0553, rotationH: 1407.6, obliquityDeg: 0.034,
        tempK: { min: 100, mean: 440, max: 700 }, gravity: 3.7,
      },
      material: { kind: 'textured', maps: { day: 'mercury' }, fallback: 'rock', tint: 0x9c8e82 },
      trail: true, labelRank: 3, i18n: 'body.mercury',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'venus', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 0.72333566, aDot: 0.00000390, e: 0.00677672, eDot: -0.00004107,
        I: 3.39467605, IDot: -0.00078890, L: 181.97909950, LDot: 58517.81538729,
        wbar: 131.60246718, wbarDot: 0.00268329, Om: 76.67984255, OmDot: -0.27769418,
        periodD: 224.701,
      },
      physical: {
        radiusKm: 6051.8, massE: 0.815, rotationH: -5832.5, obliquityDeg: 2.64,
        tempK: { mean: 737 }, gravity: 8.87,
      },
      material: { kind: 'textured', maps: { day: 'venus' }, atmosphere: { kind: 'rim', color: 0xe8d9a8, strength: 1.0 }, fallback: 'venus', tint: 0xe6c98f },
      trail: true, labelRank: 2, i18n: 'body.venus',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'earth', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 1.00000261, aDot: 0.00000562, e: 0.01671123, eDot: -0.00004392,
        I: -0.00001531, IDot: -0.01294668, L: 100.46457166, LDot: 35999.37244981,
        wbar: 102.93768193, wbarDot: 0.32327364, Om: 0.0, OmDot: 0.0,
        periodD: 365.256,
      },
      physical: {
        radiusKm: 6371, massE: 1, rotationH: 23.9345, obliquityDeg: 23.44,
        tempK: { min: 184, mean: 288, max: 330 }, gravity: 9.81,
      },
      material: { kind: 'earth', maps: { day: 'earth_day', night: 'earth_night', clouds: 'earth_clouds', spec: 'earth_spec', normal: 'earth_normal' }, atmosphere: { kind: 'scatter' }, fallback: 'terra', tint: 0x4f7fd1 },
      trail: true, labelRank: 1, i18n: 'body.earth',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'moon', type: 'moon', parent: 'earth',
      elements: {
        kind: 'direct', a: 0.00257184, e: 0.0549, i: 5.145, Om: 125.08, w: 318.15,
        M0: 135.27, epoch: 2451545.0, periodD: 27.3217,
      },
      physical: {
        radiusKm: 1737.4, massE: 0.0123, rotationH: null, obliquityDeg: 6.68,
        tidallyLocked: true, tempK: { min: 100, mean: 220, max: 390 }, gravity: 1.62,
      },
      material: { kind: 'textured', maps: { day: 'moon' }, fallback: 'moon-rock', tint: 0xb8b4ac },
      trail: true, labelRank: 3, i18n: 'body.moon',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'mars', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 1.52371034, aDot: 0.00001847, e: 0.09339410, eDot: 0.00007882,
        I: 1.84969142, IDot: -0.00813131, L: -4.55343205, LDot: 19140.30268499,
        wbar: -23.94362959, wbarDot: 0.44441088, Om: 49.55953891, OmDot: -0.29257343,
        periodD: 686.980,
      },
      physical: {
        radiusKm: 3389.5, massE: 0.107, rotationH: 24.6229, obliquityDeg: 25.19,
        tempK: { min: 130, mean: 210, max: 308 }, gravity: 3.71,
      },
      material: { kind: 'textured', maps: { day: 'mars' }, atmosphere: { kind: 'rim', color: 0xd8a077, strength: 0.55 }, fallback: 'mars', tint: 0xc1603d },
      trail: true, labelRank: 2, i18n: 'body.mars',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'jupiter', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 5.20288700, aDot: -0.00011607, e: 0.04838624, eDot: -0.00013253,
        I: 1.30439695, IDot: -0.00183714, L: 34.39644051, LDot: 3034.74612775,
        wbar: 14.72847983, wbarDot: 0.21252668, Om: 100.47390909, OmDot: 0.20469106,
        periodD: 4332.589,
      },
      physical: {
        radiusKm: 69911, massE: 317.8, rotationH: 9.925, obliquityDeg: 3.13,
        tempK: { mean: 165 }, gravity: 24.79,
      },
      material: { kind: 'textured', maps: { day: 'jupiter' }, fallback: 'gasgiant-jupiter', tint: 0xc8a678 },
      trail: true, labelRank: 1, i18n: 'body.jupiter',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'io', type: 'moon', parent: 'jupiter', orbitInParentEquator: true,
      elements: { kind: 'direct', a: 0.00281889, e: 0.0041, i: 0.05, Om: 0, w: 0, M0: 100, epoch: 2451545.0, periodD: 1.7691 },
      physical: { radiusKm: 1821.6, massE: 0.015, rotationH: null, obliquityDeg: 0, tidallyLocked: true, tempK: { mean: 110 }, gravity: 1.8 },
      material: { kind: 'textured', maps: {}, fallback: 'io', tint: 0xd8c26a },
      trail: true, labelRank: 4, i18n: 'body.io',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'europa', type: 'moon', parent: 'jupiter', orbitInParentEquator: true,
      elements: { kind: 'direct', a: 0.00448553, e: 0.009, i: 0.47, Om: 0, w: 0, M0: 220, epoch: 2451545.0, periodD: 3.5512 },
      physical: { radiusKm: 1560.8, massE: 0.008, rotationH: null, obliquityDeg: 0, tidallyLocked: true, tempK: { mean: 102 }, gravity: 1.31 },
      material: { kind: 'textured', maps: {}, fallback: 'europa', tint: 0xd8cfc0 },
      trail: true, labelRank: 4, i18n: 'body.europa',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'ganymede', type: 'moon', parent: 'jupiter', orbitInParentEquator: true,
      elements: { kind: 'direct', a: 0.00715527, e: 0.0013, i: 0.2, Om: 0, w: 0, M0: 30, epoch: 2451545.0, periodD: 7.1546 },
      physical: { radiusKm: 2634.1, massE: 0.0248, rotationH: null, obliquityDeg: 0, tidallyLocked: true, tempK: { mean: 110 }, gravity: 1.43 },
      material: { kind: 'textured', maps: {}, fallback: 'ganymede', tint: 0xa89c8c },
      trail: true, labelRank: 4, i18n: 'body.ganymede',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'callisto', type: 'moon', parent: 'jupiter', orbitInParentEquator: true,
      elements: { kind: 'direct', a: 0.01258513, e: 0.0074, i: 0.19, Om: 0, w: 0, M0: 310, epoch: 2451545.0, periodD: 16.689 },
      physical: { radiusKm: 2410.3, massE: 0.018, rotationH: null, obliquityDeg: 0, tidallyLocked: true, tempK: { mean: 134 }, gravity: 1.24 },
      material: { kind: 'textured', maps: {}, fallback: 'callisto', tint: 0x7a7268 },
      trail: true, labelRank: 4, i18n: 'body.callisto',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'saturn', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 9.53667594, aDot: -0.00125060, e: 0.05386179, eDot: -0.00050991,
        I: 2.48599187, IDot: 0.00193609, L: 49.95424423, LDot: 1222.49362201,
        wbar: 92.59887831, wbarDot: -0.41897216, Om: 113.66242448, OmDot: -0.28867794,
        periodD: 10759.22,
      },
      physical: {
        radiusKm: 58232, massE: 95.2, rotationH: 10.656, obliquityDeg: 26.73,
        tempK: { mean: 134 }, gravity: 10.44,
      },
      material: { kind: 'textured', maps: { day: 'saturn' }, fallback: 'gasgiant-saturn', tint: 0xe0c89a },
      rings: { innerKm: 74500, outerKm: 140220, maps: { color: 'saturn_ring_color', alpha: 'saturn_ring_alpha' } },
      trail: true, labelRank: 1, i18n: 'body.saturn',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'titan', type: 'moon', parent: 'saturn', orbitInParentEquator: true,
      elements: { kind: 'direct', a: 0.00816770, e: 0.0288, i: 0.35, Om: 0, w: 0, M0: 15, epoch: 2451545.0, periodD: 15.945 },
      physical: { radiusKm: 2574.7, massE: 0.0225, rotationH: null, obliquityDeg: 0, tidallyLocked: true, tempK: { mean: 94 }, gravity: 1.35 },
      material: { kind: 'textured', maps: {}, atmosphere: { kind: 'rim', color: 0xe8a34d, strength: 1.1 }, fallback: 'titan', tint: 0xd89a4a },
      trail: true, labelRank: 4, i18n: 'body.titan',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'uranus', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 19.18916464, aDot: -0.00196176, e: 0.04725744, eDot: -0.00004397,
        I: 0.77263783, IDot: -0.00242939, L: 313.23810451, LDot: 428.48202785,
        wbar: 170.95427630, wbarDot: 0.40805281, Om: 74.01692503, OmDot: 0.04240589,
        periodD: 30685.4,
      },
      physical: {
        radiusKm: 25362, massE: 14.5, rotationH: -17.24, obliquityDeg: 97.77,
        tempK: { mean: 76 }, gravity: 8.87,
      },
      material: { kind: 'textured', maps: { day: 'uranus' }, atmosphere: { kind: 'rim', color: 0xaee5e8, strength: 0.5 }, fallback: 'icegiant-uranus', tint: 0x9fd4dc },
      trail: true, labelRank: 2, i18n: 'body.uranus',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'neptune', type: 'planet', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 30.06992276, aDot: 0.00026291, e: 0.00859048, eDot: 0.00005105,
        I: 1.77004347, IDot: 0.00035372, L: -55.12002969, LDot: 218.45945325,
        wbar: 44.96476227, wbarDot: -0.32241464, Om: 131.78422574, OmDot: -0.00508664,
        periodD: 60189.0,
      },
      physical: {
        radiusKm: 24622, massE: 17.1, rotationH: 16.11, obliquityDeg: 28.32,
        tempK: { mean: 72 }, gravity: 11.15,
      },
      material: { kind: 'textured', maps: { day: 'neptune' }, atmosphere: { kind: 'rim', color: 0x7fa8ff, strength: 0.6 }, fallback: 'icegiant-neptune', tint: 0x4f74d9 },
      trail: true, labelRank: 2, i18n: 'body.neptune',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'pluto', type: 'dwarf', parent: 'sun',
      elements: {
        kind: 'standish',
        a: 39.48211675, aDot: -0.00031596, e: 0.24882730, eDot: 0.00005170,
        I: 17.14001206, IDot: 0.00004818, L: 238.92903833, LDot: 145.20780515,
        wbar: 224.06891629, wbarDot: -0.04062942, Om: 110.30393684, OmDot: -0.01183482,
        periodD: 90560,
      },
      physical: {
        radiusKm: 1188.3, massE: 0.0022, rotationH: -153.29, obliquityDeg: 122.53,
        tempK: { mean: 44 }, gravity: 0.62,
      },
      material: { kind: 'textured', maps: { day: 'pluto' }, fallback: 'pluto', tint: 0xc4a988 },
      trail: true, labelRank: 3, i18n: 'body.pluto',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'ceres', type: 'dwarf', parent: 'sun',
      elements: {
        kind: 'direct', a: 2.7675, e: 0.076, i: 10.59, Om: 80.31, w: 73.6,
        M0: 77.37, epoch: 2451545.0, periodD: 1681.6,
      },
      physical: {
        radiusKm: 469.7, massE: 0.00016, rotationH: 9.074, obliquityDeg: 4,
        tempK: { mean: 168 }, gravity: 0.28,
      },
      material: { kind: 'textured', maps: { day: 'ceres' }, fallback: 'ceres', tint: 0x9a938a },
      trail: true, labelRank: 3, i18n: 'body.ceres',
      knowledge: { certainty: 'photographed' },
    },
    {
      id: 'halley', type: 'comet', parent: 'sun',
      elements: {
        kind: 'direct', a: 17.834, e: 0.96714, i: 162.26, Om: 58.42, w: 111.33,
        M0: 0, epoch: 2446470.9, periodD: 27509,
      },
      physical: {
        radiusKm: 5.5, massE: 0.0, rotationH: 52.8, obliquityDeg: 0,
        tempK: { min: 30, max: 400 }, gravity: 0.0002,
      },
      material: { kind: 'comet', fallback: 'comet', tint: 0x9ab2c8 },
      trail: true, labelRank: 3, i18n: 'body.halley',
      knowledge: { certainty: 'photographed' },
    },
  ],
  belts: [
    { id: 'asteroid-belt', aMin: 2.1, aMax: 3.35, count: 6000, thick: 0.05, color: 0x8a7a66, seed: 11, i18n: 'body.asteroidBelt' },
    { id: 'kuiper-belt', aMin: 30.5, aMax: 48, count: 4000, thick: 0.09, color: 0x7a8496, seed: 23, i18n: 'body.kuiperBelt' },
  ],
};
