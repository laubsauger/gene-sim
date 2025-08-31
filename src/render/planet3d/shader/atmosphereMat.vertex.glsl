#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPosition;
varying vec3 vPosition;  // Add local position
varying vec3 vWorldNormal;  // Add world space normal

void main() {
  vPosition = position;  // Pass local position to fragment shader
  vNormal = normalize(normalMatrix * normal);
  
  // For a sphere, position IS the normal in local space
  // Transform it to world space
  vWorldNormal = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  
  vec4 mvPosition = viewMatrix * worldPos;
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  
  #include <logdepthbuf_vertex>
}
