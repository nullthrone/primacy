import { NOISE_GLSL } from './noise.glsl.js';

/**
 * Star photosphere: fBm granulation with domain warp, starspot mask scaled
 * by an activity uniform, limb darkening, and a flare hot-patch term. Colors
 * are fed in as pre-computed blackbody tints (hot/cold cell endpoints), the
 * whole surface is emissive HDR so the bloom pass picks it up.
 */
export const starVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
  vObjPos = position;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const starFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uSeed;
uniform float uActivity;      // 0 quiet .. 1 very active (spot coverage)
uniform float uFlare;         // 0 .. 1 flare intensity envelope
uniform vec3  uFlareDir;      // object-space direction of the flare patch
uniform vec3  uColorHot;      // blackbody tint of hot granulation cells
uniform vec3  uColorCold;     // blackbody tint of intergranular lanes
uniform vec3  uColorSpot;     // starspot tint
uniform float uEmissive;      // HDR multiplier
uniform float uGranScale;     // granulation frequency
uniform float uLimbU;         // limb darkening coefficient
varying vec3 vObjPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

${NOISE_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 dir = normalize(vObjPos);
  vec3 seeded = dir + vec3(uSeed * 17.31, uSeed * 5.7, uSeed * 11.13);

  // Domain-warped granulation. Two time scales: slow churn + fast shimmer.
  vec3 warp = vec3(
    fbm(seeded * 3.0 + vec3(0.0, uTime * 0.015, 0.0)),
    fbm(seeded * 3.0 + vec3(5.2, 1.3, uTime * 0.012)),
    fbm(seeded * 3.0 + vec3(uTime * 0.010, 9.1, 2.4)));
  float g = fbm5(seeded * uGranScale + warp * 0.55 + vec3(0.0, 0.0, uTime * 0.03));
  float cells = smoothstep(-0.45, 0.6, g);            // 0 = lane, 1 = cell core

  vec3 surface = mix(uColorCold, uColorHot, cells);

  // Starspot groups: low-frequency mask, coverage grows with activity.
  float spotField = fbm(seeded * 2.6 + vec3(31.7));
  float spotThresh = mix(0.95, 0.30, uActivity);       // activity 0 -> almost none
  float spot = smoothstep(spotThresh, spotThresh + 0.22, spotField);
  // Faculae: bright margin just outside spot regions.
  float facula = smoothstep(spotThresh - 0.16, spotThresh, spotField) * (1.0 - spot);
  surface = mix(surface, uColorSpot, spot * 0.85);
  surface += uColorHot * facula * 0.35;

  // Flare hot patch (object space).
  float flarePatch = smoothstep(0.86, 0.995, dot(dir, normalize(uFlareDir)));
  surface += uColorHot * flarePatch * uFlare * 5.0;

  // Limb darkening.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0);
  float limb = 1.0 - uLimbU * (1.0 - mu);

  vec3 color = surface * limb * uEmissive * (1.0 + uFlare * flarePatch * 2.0);
  gl_FragColor = vec4(color, 1.0);
}
`;
