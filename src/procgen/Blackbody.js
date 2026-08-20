import * as THREE from 'three';

/**
 * Approximate blackbody chromaticity (Tanner Helland fit, 1000..40000 K).
 * Returns a linear-space THREE.Color suitable for shader uniforms.
 */
export function blackbodyRGB(kelvin) {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const clamp = (v) => Math.min(255, Math.max(0, v)) / 255;
  const c = new THREE.Color(clamp(r), clamp(g), clamp(b));
  c.convertSRGBToLinear();
  return c;
}
