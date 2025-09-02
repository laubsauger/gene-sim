#include <common>
#include <logdepthbuf_pars_vertex>

attribute vec3 customColor;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vColor = customColor;
  
  // Get the entity's position on the sphere surface (from instanceMatrix translation)
  // Extract translation from instanceMatrix (column 3)
  vec3 instancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  
  // The normal for an entity on a sphere is its normalized position from the center
  // This is in the planet's local space, so transform to world space
  vec3 localNormal = normalize(instancePos);
  vNormal = normalize((modelMatrix * vec4(localNormal, 0.0)).xyz);
  
  // Calculate world position for the entity
  vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  #include <logdepthbuf_vertex>
}