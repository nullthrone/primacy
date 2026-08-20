/**
 * Atmosphere shell, additive, drawn on a slightly inflated FrontSide
 * sphere: fresnel rim, day-side weighting, sunset tint peaking at the
 * terminator. One shader covers Earth's blue scatter look, Venus' haze,
 * Mars' dusty rim and Titan's orange soup via uniforms.
 */
export const atmosphereVertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWNormal;
varying vec3 vWPos;
void main() {
  vWNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

export const atmosphereFragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uDayColor;
uniform vec3 uSunsetColor;
uniform vec3 uSunDir;
uniform float uStrength;
uniform float uFresnelPow;
varying vec3 vWNormal;
varying vec3 vWPos;
void main() {
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWNormal);
  vec3 V = normalize(cameraPosition - vWPos);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uFresnelPow);

  float t = dot(N, uSunDir);
  float dayF = smoothstep(-0.35, 0.35, t);
  float sunset = exp(-abs(t) * 5.0);

  vec3 color = uDayColor * dayF + uSunsetColor * sunset * (0.85 - 0.5 * dayF);
  float alpha = fres * (0.06 + 0.94 * dayF + sunset * 0.22) * uStrength;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;
