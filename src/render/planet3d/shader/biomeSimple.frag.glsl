varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;

uniform sampler2D uBiomeTexture;
uniform vec3 uLightDir;
uniform float uTime;

// Simple noise for terrain variation
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  // Sample biome texture
  vec4 biomeColor = texture2D(uBiomeTexture, vUv);
  
  // Ensure we have a solid base color - if texture is invalid, use green
  vec3 baseColor = biomeColor.rgb;
  if (length(baseColor) < 0.01) {
    baseColor = vec3(0.2, 0.5, 0.2); // Default green if no biome data
  }
  
  // Add some procedural detail based on biome type
  float detail = noise(vUv * 50.0);
  
  // Ocean detection (blue biomes)
  float isOcean = step(0.5, biomeColor.b) * step(biomeColor.r + biomeColor.g, 0.8);
  
  if (isOcean > 0.5) {
    // Ocean waves
    float wave = sin(vUv.x * 100.0 + uTime) * sin(vUv.y * 100.0 + uTime * 0.7) * 0.05;
    baseColor = mix(baseColor, vec3(0.1, 0.3, 0.5), 0.3);
    baseColor += vec3(0.0, 0.1, 0.2) * wave;
  } else {
    // Land terrain variation
    baseColor = mix(baseColor, baseColor * 1.2, detail * 0.3);
  }
  
  // Simple lighting
  float NdotL = max(dot(vNormal, uLightDir), 0.0);
  float lighting = 0.4 + 0.6 * NdotL; // More ambient, less harsh lighting
  
  vec3 finalColor = baseColor * lighting;
  
  // Clamp to ensure visible colors
  finalColor = max(finalColor, vec3(0.05)); // Never completely black
  
  // Make absolutely sure we output solid, opaque color
  gl_FragColor = vec4(finalColor, 1.0);
}