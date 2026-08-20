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
  ],
};
