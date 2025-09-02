#include <common>
#include <logdepthbuf_pars_vertex>

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLocalPosition; // Position in planet's local space
varying vec3 vViewPosition; // For depth buffer
varying vec2 vUv;

void main() {
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vLocalPosition = position; // Keep local position for pole detection
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  
  #include <logdepthbuf_vertex>
}