varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vElevation;

uniform float uTime;
uniform float uPlanetRadius;

// Simplex noise for procedural elevation
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  
  // Generate procedural elevation based on UV coordinates
  float noiseScale = 8.0;
  float elevation = 0.0;
  
  // Multi-octave noise for realistic terrain
  elevation += snoise(vUv * noiseScale) * 0.5;
  elevation += snoise(vUv * noiseScale * 2.0) * 0.25;
  elevation += snoise(vUv * noiseScale * 4.0) * 0.125;
  elevation += snoise(vUv * noiseScale * 8.0) * 0.0625;
  
  // Normalize to -1 to 1 range
  elevation = elevation * 0.5;
  vElevation = elevation;
  
  // Apply subtle displacement for mountains (optional, can be toggled)
  vec3 displacedPosition = position + normal * elevation * 0.01 * uPlanetRadius;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}