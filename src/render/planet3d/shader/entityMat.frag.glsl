#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDir;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  #include <logdepthbuf_fragment>

  // Calculate lighting - simple dot product
  float dotNL = dot(normalize(vNormal), normalize(uLightDir));
  
  // Harsh lighting for testing - entities facing sun are bright, others are dark
  float lighting = dotNL > 0.0 ? 1.0 : 0.0;
  
  // Apply very stark lighting for debugging (dark = 1% light, bright = 100%)
  vec3 finalColor = vColor * mix(0.01, 1.0, lighting);
  
  gl_FragColor = vec4(finalColor, 1.0);
}