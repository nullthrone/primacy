import { NOISE_GLSL } from './noise.glsl.js';

/**
 * Tidally-locked exoplanet "eyeball" shader. The star direction is passed
 * in OBJECT space, so the substellar point stays glued to the same
 * longitude — zones derive from mu = cos(angle from substellar point):
 * day-side eye, twilight ring, frozen night side. Four parameter sets
 * (temperate / dry / hot / ice) share the shader; everything is
 * scientifically-informed artistic license and labeled as such in the UI.
 */
export const eyeballVertex = /* glsl */ `
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

export const eyeballFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uStarDirObj;    // toward the star, object space
uniform vec3 uStarDirWorld;  // toward the star, world space
uniform vec3 uSunColor;
uniform float uTime;
uniform float uSeed;
uniform int uType;           // 0 temperate, 1 dry, 2 hot, 3 ice
varying vec3 vObj;
varying vec3 vWNormal;
varying vec3 vWPos;

${NOISE_GLSL}

void main() {
  #include <logdepthbuf_fragment>
  vec3 dir = normalize(vObj);
  vec3 sd = dir + vec3(uSeed * 13.7, uSeed * 5.1, uSeed * 8.3);
  float mu = dot(dir, normalize(uStarDirObj));   // 1 substellar .. -1 antistellar

  float continents = fbm5(sd * 3.2);
  float detail = fbm(sd * 9.0);
  float clouds = fbm(sd * 4.0 + vec3(uTime * 0.008, 0.0, uTime * 0.005) + fbm(sd * 2.0) * 0.6);

  vec3 surface;
  float oceanMask = 0.0;

  if (uType == 0) {
    // Temperate ocean-eye: liquid water iris around the substellar point,
    // pack ice from the twilight ring outward.
    float iris = smoothstep(0.15, 0.45, mu + continents * 0.18);
    float night = smoothstep(0.05, -0.35, mu + continents * 0.10);
    vec3 ocean = mix(vec3(0.02, 0.10, 0.22), vec3(0.04, 0.22, 0.34), smoothstep(0.3, 0.9, mu));
    vec3 land = mix(vec3(0.20, 0.26, 0.14), vec3(0.42, 0.38, 0.22), detail);
    float landMask = smoothstep(0.34, 0.42, continents) * iris;
    vec3 dayside = mix(ocean, land, landMask * 0.85);
    oceanMask = iris * (1.0 - landMask);
    vec3 ice = mix(vec3(0.62, 0.70, 0.80), vec3(0.86, 0.92, 0.97), detail * 0.5 + 0.5);
    float cracks = smoothstep(0.10, 0.0, abs(fbm(sd * 7.0)) ) * 0.25;
    ice -= cracks;
    surface = mix(dayside, ice, night);
    // twilight slush ring
    float ring = exp(-pow((mu - 0.05) * 4.2, 2.0));
    surface = mix(surface, vec3(0.35, 0.42, 0.44), ring * 0.5);
  } else if (uType == 1) {
    // Dry world: ochre day desert, terminator vegetation-tinted ring,
    // frosted night side.
    vec3 desert = mix(vec3(0.48, 0.33, 0.16), vec3(0.72, 0.55, 0.30), detail);
    float salt = smoothstep(0.55, 0.75, continents) * smoothstep(0.35, 0.7, mu);
    desert = mix(desert, vec3(0.85, 0.82, 0.74), salt * 0.6);
    float ring = exp(-pow((mu - 0.02) * 3.6, 2.0));
    vec3 ringCol = mix(desert, vec3(0.22, 0.30, 0.16), 0.7);
    float frost = smoothstep(-0.05, -0.45, mu);
    vec3 night = mix(vec3(0.42, 0.42, 0.48), vec3(0.66, 0.70, 0.78), detail * 0.5);
    surface = mix(desert, ringCol, ring * (0.4 + 0.4 * smoothstep(0.3, 0.6, continents)));
    surface = mix(surface, night, frost);
    oceanMask = ring * 0.25 * smoothstep(0.45, 0.65, continents);
  } else if (uType == 2) {
    // Hot rock: basalt with glowing lava veins near the substellar point.
    vec3 rock = mix(vec3(0.09, 0.07, 0.06), vec3(0.24, 0.18, 0.15), detail);
    float veins = smoothstep(0.06, 0.0, abs(fbm(sd * 6.5))) * smoothstep(0.15, 0.75, mu);
    float pool = smoothstep(0.88, 0.99, mu + continents * 0.05);
    vec3 lava = vec3(1.0, 0.32, 0.05) * (veins * 1.6 + pool * 2.4);
    float night = smoothstep(-0.05, -0.5, mu);
    surface = mix(rock, vec3(0.05, 0.04, 0.05), night) + lava;
  } else {
    // Cold super-Earth / mini-Neptune: faint banded ice-haze globe.
    float bands = sin(dir.y * 9.0 + fbm(sd * 2.5) * 2.0) * 0.5 + 0.5;
    surface = mix(vec3(0.55, 0.64, 0.72), vec3(0.72, 0.80, 0.86), bands * 0.5 + detail * 0.25);
  }

  // Day-side clouds for the two habitable-ish types.
  if (uType == 0 || uType == 1) {
    float cl = smoothstep(0.45, 0.75, clouds) * smoothstep(-0.05, 0.35, mu);
    surface = mix(surface, vec3(0.92, 0.94, 0.96), cl * 0.7);
  }

  // Lighting from the star (world space), plus faint ambient so the night
  // side reads in the viewer.
  vec3 N = normalize(vWNormal);
  float ndl = max(dot(N, normalize(uStarDirWorld)), 0.0);
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 Hv = normalize(normalize(uStarDirWorld) + V);
  float spec = pow(max(dot(N, Hv), 0.0), 60.0) * oceanMask * 0.8;

  vec3 color = surface * (0.035 + pow(ndl, 0.9) * 1.55) * uSunColor + uSunColor * spec * ndl;
  if (uType == 2) {
    // Lava stays emissive in the dark.
    color += surface * vec3(0.55, 0.18, 0.05) * 0.15;
  }
  gl_FragColor = vec4(color, 1.0);
}
`;
