#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vN;
varying vec3 vPosW;
varying vec3 vPosObject; // Pass object space position to fragment shader

void main() {
  vN = normalize(normalMatrix * normal);
  vPosObject = position; // Store object space position
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  
  #include <logdepthbuf_vertex>
}