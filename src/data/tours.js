/**
 * Guided tours: each step positions the camera (select a body or an
 * overview), sets time speed, optionally fires an action, and shows a
 * narration card for durationS seconds before auto-advancing.
 */
export const TOURS = [
  {
    id: 'grand',
    i18n: 'tour.grand',
    steps: [
      { system: 'sol', target: 'sun', dist: 5.5, speed: 250000, textKey: 'tour.grand.s0', durationS: 11 },
      { system: 'sol', target: 'earth', dist: 4.2, speed: 250000, textKey: 'tour.grand.s1', durationS: 11 },
      { system: 'sol', target: 'jupiter', dist: 11, speed: 900000, textKey: 'tour.grand.s2', durationS: 12 },
      { system: 'sol', target: 'saturn', dist: 6.5, speed: 900000, textKey: 'tour.grand.s3', durationS: 12 },
      { system: 'sol', target: 'neptune', dist: 5.5, speed: 4000000, textKey: 'tour.grand.s4', durationS: 11 },
      { system: 'sol', target: 'halley', dist: 22, speed: 2000000, jd: 2446470.9, textKey: 'tour.grand.s5', durationS: 12 },
    ],
  },
  {
    id: 'proxday',
    i18n: 'tour.proxday',
    steps: [
      { system: 'proxima', target: 'proxima-star', dist: 5.5, speed: 60000, textKey: 'tour.proxday.s0', durationS: 11 },
      { system: 'proxima', target: 'proxima-b', dist: 4.5, speed: 60000, textKey: 'tour.proxday.s1', durationS: 11 },
      { system: 'proxima', target: 'proxima-b', dist: 3.2, speed: 60000, textKey: 'tour.proxday.s2', durationS: 12 },
      { system: 'proxima', target: 'proxima-b', dist: 5.5, speed: 60000, action: 'flare', textKey: 'tour.proxday.s3', durationS: 13 },
      { system: 'proxima', target: 'proxima-c', dist: 6, speed: 900000, textKey: 'tour.proxday.s4', durationS: 11 },
    ],
  },
  {
    id: 'ross',
    i18n: 'tour.ross',
    steps: [
      { system: 'ross128', target: 'ross128-star', dist: 5.5, speed: 60000, textKey: 'tour.ross.s0', durationS: 11 },
      { system: 'ross128', target: 'ross128-star', dist: 3.6, speed: 60000, textKey: 'tour.ross.s1', durationS: 11 },
      { system: 'ross128', overview: true, speed: 60000, textKey: 'tour.ross.s2', durationS: 11 },
      { system: 'ross128', target: 'ross128-b', dist: 4.2, speed: 60000, textKey: 'tour.ross.s3', durationS: 12 },
    ],
  },
];
