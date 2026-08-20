/**
 * Earth surface: day/night blend across a soft terminator, city lights,
 * ocean specular glint, derivative-based normal mapping. Sun direction is
 * a world-space uniform updated per frame.
 */
export const earthVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vWNormal;
varying vec3 vWPos;
void main() {
  vUv = uv;
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const earthFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpec;
uniform sampler2D uNormalMap;
uniform float uHasNormal;
uniform float uHasSpec;
uniform vec3 uSunDir;      // world-space, from body toward star
uniform vec3 uSunColor;
varying vec2 vUv;
varying vec3 vWNormal;
varying vec3 vWPos;

vec3 perturbNormal(vec3 N, vec3 V, vec2 uv) {
  vec3 q0 = dFdx(V);
  vec3 q1 = dFdy(V);
  vec2 st0 = dFdx(uv);
  vec2 st1 = dFdy(uv);
  vec3 S = normalize(q0 * st1.t - q1 * st0.t);
  vec3 T = normalize(-q0 * st1.s + q1 * st0.s);
  vec3 mapN = texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;
  mapN.xy *= 0.85;
  return normalize(mat3(S, T, N) * mapN);
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWNormal);
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 Nd = uHasNormal > 0.5 ? perturbNormal(N, -V, vUv) : N;

  float ndl = dot(Nd, uSunDir);
  float dayF = smoothstep(-0.12, 0.35, dot(N, uSunDir));

  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;

  // Soft-saturating diffuse keeps the terminator gradient visible.
  float diff = pow(max(ndl, 0.0), 0.85);
  vec3 lit = day * diff * uSunColor * 1.8;

  // City lights: mask by brightness so oceans stay black at night.
  float cityMask = smoothstep(0.10, 0.30, dot(night, vec3(0.3333)));
  vec3 cities = night * cityMask * 1.9 * (1.0 - dayF);

  vec3 specCol = vec3(0.0);
  if (uHasSpec > 0.5) {
    float s = texture2D(uSpec, vUv).r;
    vec3 Hv = normalize(uSunDir + V);
    specCol = uSunColor * s * pow(max(dot(Nd, Hv), 0.0), 72.0) * 0.85 * max(ndl, 0.0);
  }

  vec3 color = lit + cities + specCol;
  gl_FragColor = vec4(color, 1.0);
}
`;
