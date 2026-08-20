import { NOISE_GLSL } from './noise.glsl.js';

/**
 * Aurora shell: polar curtain bands that light up when a CME arrives
 * (uResponse 0..1). Rendered on a slightly inflated sphere, additive.
 */
export const auroraVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;
varying vec3 vWNormal;
varying vec3 vWPos;
void main() {
  vObj = position;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const auroraFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform float uResponse;
varying vec3 vObj;
varying vec3 vWNormal;
varying vec3 vWPos;
${NOISE_GLSL}
void main() {
  #include <logdepthbuf_fragment>
  if (uResponse < 0.01) discard;
  vec3 dir = normalize(vObj);
  float lat = abs(dir.y);
  // Auroral ovals around both poles.
  float oval = smoothstep(0.55, 0.72, lat) * (1.0 - smoothstep(0.88, 0.985, lat));
  float lon = atan(dir.z, dir.x);
  float curtain = fbm(vec3(cos(lon), sin(lon), dir.y * 2.0) * 3.0 + vec3(0.0, uTime * 0.35, 0.0));
  curtain = smoothstep(-0.15, 0.55, curtain);
  float flicker = 0.75 + 0.25 * snoise(vec3(lon * 2.0, uTime * 1.3, 7.7));

  vec3 green = vec3(0.15, 0.95, 0.55);
  vec3 purple = vec3(0.55, 0.30, 0.95);
  vec3 col = mix(green, purple, smoothstep(0.6, 0.95, lat));

  // Slight edge boost so the curtains read along the limb.
  vec3 V = normalize(cameraPosition - vWPos);
  float rim = pow(1.0 - abs(dot(normalize(vWNormal), V)), 1.2) * 0.6 + 0.4;

  float alpha = oval * curtain * flicker * rim * uResponse * 0.85;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;
