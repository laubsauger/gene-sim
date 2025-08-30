#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  
  vec4 mvPosition = viewMatrix * worldPos;
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  
  #include <logdepthbuf_vertex>
}
