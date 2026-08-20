import { NOISE_GLSL } from './noise.glsl.js';

/**
 * Corona shell: rendered on the BACK side of a sphere ~2.6x the star radius.
 * Brightness falls off exponentially from the limb outward and is modulated
 * by radial streamer noise; additive blending, HDR-ish values feed bloom.
 */
export const coronaVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObjPos;
void main() {
  vObjPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

export const coronaFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uSeed;
uniform vec3  uColor;
uniform float uStarRadius;   // in object units of this shell (0..1 scale)
uniform float uIntensity;
uniform float uFlare;
varying vec3 vObjPos;

${NOISE_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  float r = length(vObjPos);              // shell object radius ~1
  vec3 dir = vObjPos / r;
  // Distance from the stellar limb outward, normalized 0..1.
  float t = clamp((r - uStarRadius) / (1.0 - uStarRadius), 0.0, 1.0);

  // Radial streamers: angular noise, stretched radially, slowly rotating.
  vec3 p = dir * 5.0 + vec3(uSeed * 7.7);
  float streaks = fbm(p + vec3(0.0, uTime * 0.02, uTime * 0.013));
  streaks = 0.62 + 0.38 * streaks;

  float fall = exp(-t * 7.5);
  float glow = fall * streaks;
  float alpha = glow * uIntensity * (1.0 + uFlare * 1.6);
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;
