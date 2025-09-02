#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vN;
varying vec3 vPosW;
varying vec3 vPosObject; // Pass object space position to fragment shader
varying vec3 vWorldNormal; // World space normal for proper lighting

void main() {
  vN = normalize(normalMatrix * normal);
  vPosObject = position; // Store object space position
  
  // For a sphere, position IS the normal in local space
  // Transform it to world space (same as atmosphere shader)
  vWorldNormal = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
  
  #include <logdepthbuf_vertex>
}