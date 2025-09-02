#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDir;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  #include <logdepthbuf_fragment>

  // Calculate lighting
  float dotNL = dot(vNormal, uLightDir);
  
  // Smooth terminator with light wrap
  float lightWrap = 0.25;
  float terminatorSoftness = 0.35;
  float wrappedDot = (dotNL + lightWrap) / (1.0 + lightWrap);
  float lighting = smoothstep(-terminatorSoftness, terminatorSoftness, wrappedDot);
  
  // Apply lighting (0.2 minimum ambient light, 0.8 directional)
  vec3 finalColor = vColor * (0.2 + 0.8 * lighting);
  
  gl_FragColor = vec4(finalColor, 1.0);
}