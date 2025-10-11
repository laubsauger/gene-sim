varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;
varying vec3 vWorldNormal;

uniform sampler2D uBiomeTexture;
uniform float uTime;

void main() {
  vUv = uv;
  vPosition = position;
  vNormal = normalize(normalMatrix * normal);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vElevation = 0.0; // No displacement for debugging
  
  // Simple position without displacement
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}