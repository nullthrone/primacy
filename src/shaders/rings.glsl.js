/**
 * Planetary rings: radial-UV color/alpha, lit on both faces, analytic
 * planet shadow (fragment behind the planet relative to the sun goes
 * dark), slight backscatter boost when looking toward the sun.
 */
export const ringsVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aRad;      // 0 inner .. 1 outer
varying float vRad;
varying vec3 vWPos;
varying vec3 vWNormal;
void main() {
  vRad = aRad;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  vWNormal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const ringsFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uColorMap;
uniform sampler2D uAlphaMap;
uniform float uHasAlphaMap;
uniform vec3 uSunPos;      // world
uniform vec3 uPlanetPos;   // world
uniform float uPlanetRadius;
uniform vec3 uSunColor;
varying float vRad;
varying vec3 vWPos;
varying vec3 vWNormal;
void main() {
  #include <logdepthbuf_fragment>
  vec3 color = texture2D(uColorMap, vec2(vRad, 0.5)).rgb;
  float alpha = uHasAlphaMap > 0.5
    ? dot(texture2D(uAlphaMap, vec2(vRad, 0.5)).rgb, vec3(0.3333))
    : 1.0;
  if (alpha < 0.02) discard;

  vec3 L = normalize(uSunPos - vWPos);
  float ndl = abs(dot(vWNormal, L));          // thin slab: lit from both sides
  float diffuse = 0.22 + 0.78 * ndl;

  // Analytic planet shadow: does the sun ray from this fragment pass
  // through the planet sphere?
  vec3 toSun = uSunPos - vWPos;
  vec3 dirSun = normalize(toSun);
  vec3 toPlanet = uPlanetPos - vWPos;
  float along = dot(toPlanet, dirSun);
  float shadow = 1.0;
  if (along > 0.0) {
    float dmin = length(toPlanet - dirSun * along);
    shadow = smoothstep(uPlanetRadius * 0.85, uPlanetRadius * 1.05, dmin);
  }

  // Backscatter: rings brighten a touch when the view opposes the sun.
  vec3 V = normalize(cameraPosition - vWPos);
  float back = pow(clamp(dot(V, dirSun), 0.0, 1.0), 3.0) * 0.35;

  vec3 lit = color * uSunColor * (diffuse * shadow + back * shadow + 0.045);
  gl_FragColor = vec4(lit, alpha);
}
`;
