#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDir;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  #include <logdepthbuf_fragment>

  // Calculate lighting using world space normal and light direction
  // Normal dot product - positive means facing the sun
  float NdotL = dot(normalize(vNormal), normalize(uLightDir));
  
  // Sharper terminator with less light wrap for more dramatic shadows
  float lightWrap = 0.1;  // Less wrap for sharper shadows
  float wrap = clamp((NdotL + lightWrap) / (1.0 + lightWrap), 0.0, 1.0);
  float dayFactor = smoothstep(-0.05, 0.2, wrap);  // Sharper transition
  
  // Nearly black on night side (0.5% ambient) and full brightness in sunlight
  vec3 finalColor = vColor * mix(0.005, 1.0, dayFactor);
  
  gl_FragColor = vec4(finalColor, 1.0);
}