// Support for logarithmic depth buffer
#ifdef USE_LOGDEPTHBUF
  #ifdef USE_LOGDEPTHBUF_EXT
    #extension GL_EXT_frag_depth : enable
    varying float vFragDepth;
  #endif
  uniform float logDepthBufFC;
#endif

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;
varying vec3 vWorldNormal;

uniform sampler2D uBiomeTexture;
uniform vec3 uLightDir;
uniform float uTime;

// Biome color palettes - more vibrant
const vec3 oceanDeep = vec3(0.02, 0.15, 0.40);
const vec3 oceanShallow = vec3(0.1, 0.45, 0.65);
const vec3 oceanFoam = vec3(0.9, 0.95, 0.98);

const vec3 desertSand = vec3(0.96, 0.85, 0.62);
const vec3 desertRock = vec3(0.82, 0.60, 0.38);
const vec3 desertDark = vec3(0.68, 0.48, 0.30);

const vec3 mountainRock = vec3(0.58, 0.53, 0.48);
const vec3 mountainSnow = vec3(0.98, 0.98, 0.99);
const vec3 mountainDark = vec3(0.38, 0.35, 0.32);

const vec3 forestDark = vec3(0.08, 0.38, 0.12);
const vec3 forestMid = vec3(0.22, 0.58, 0.28);
const vec3 forestLight = vec3(0.42, 0.72, 0.42);

const vec3 grasslandLight = vec3(0.65, 0.82, 0.40);
const vec3 grasslandMid = vec3(0.55, 0.72, 0.35);
const vec3 grasslandDark = vec3(0.45, 0.62, 0.28);

// Simple noise for texture variation
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
  // Sample biome texture to determine terrain type
  vec4 biomeData = texture2D(uBiomeTexture, vUv);
  
  // Start with a default color to ensure we always have something
  vec3 baseColor = vec3(0.4, 0.6, 0.3); // Default green-ish color
  
  // Determine biome type from texture color
  // Ocean: dark blue (0x0d2438) - low RGB, blue is highest
  float isOcean = step(biomeData.b, 0.3) * step(biomeData.r + biomeData.g, 0.25) * step(0.1, biomeData.b);
  // Desert: sandy yellow (0xe8c170) - high R, moderate G, low B
  float isDesert = step(0.7, biomeData.r) * step(0.5, biomeData.g) * step(biomeData.b, 0.5);
  // Mountain: dark grey (0x2a2a2a) - very low RGB, all similar
  float isMountain = step(biomeData.r, 0.2) * step(biomeData.g, 0.2) * step(biomeData.b, 0.2);
  // Forest: dark green (0x2d5a2d) - low R, moderate G, low B
  float isForest = step(0.25, biomeData.g) * step(biomeData.g, 0.45) * step(biomeData.r, 0.25);
  
  if (isOcean > 0.5) {
    // Ocean coloring based on depth
    float depth = 1.0 - vElevation * 100.0;
    baseColor = mix(oceanShallow, oceanDeep, depth);
    
    // Add foam on wave crests
    float foam = smoothstep(0.002, 0.003, vElevation);
    baseColor = mix(baseColor, oceanFoam, foam * 0.5);
    
  } else if (isDesert > 0.5) {
    // Desert coloring with sand variation
    float sandVar = noise(vUv * 50.0);
    baseColor = mix(desertSand, desertRock, sandVar * 0.3);
    
    // Darken valleys
    baseColor = mix(baseColor, desertDark, smoothstep(0.0, -0.005, vElevation));
    
  } else if (isMountain > 0.5) {
    // Mountain coloring with elevation-based snow
    float snowLine = 0.025; // Snow appears at higher elevations
    float rockDetail = noise(vUv * 100.0);
    
    baseColor = mix(mountainDark, mountainRock, rockDetail);
    
    // Add snow at peaks
    float snowAmount = smoothstep(snowLine * 0.8, snowLine, vElevation);
    baseColor = mix(baseColor, mountainSnow, snowAmount);
    
    // Rock striations
    float striations = abs(sin(vUv.y * 200.0 + noise(vUv * 50.0) * 10.0));
    baseColor = mix(baseColor, mountainDark, striations * 0.1 * (1.0 - snowAmount));
    
  } else if (isForest > 0.5) {
    // Forest coloring with canopy variation
    float canopyVar = noise(vUv * 80.0);
    baseColor = mix(forestMid, forestDark, canopyVar);
    
    // Lighter areas for clearings
    float clearing = noise(vUv * 20.0);
    if (clearing > 0.7) {
      baseColor = mix(baseColor, forestLight, (clearing - 0.7) * 2.0);
    }
    
  } else {
    // Grassland/default coloring
    float grassVar = noise(vUv * 60.0);
    baseColor = mix(grasslandMid, grasslandDark, grassVar * 0.4);
    baseColor = mix(baseColor, grasslandLight, noise(vUv * 30.0) * 0.3);
  }
  
  // Calculate lighting using WORLD space normal (not view space)
  vec3 worldNormal = normalize(vWorldNormal);

  // Main directional light
  float NdotL = max(dot(worldNormal, uLightDir), 0.0);

  // Extremely low ambient for nearly black dark side
  vec3 ambient = vec3(0.005, 0.008, 0.012);

  // Combine lighting
  vec3 finalColor = baseColor * (ambient + NdotL);

  // Boost color saturation on lit side only
  if (NdotL > 0.1) {
    float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(gray), finalColor, 1.3);
  }

  // Handle logarithmic depth buffer in fragment shader
  #ifdef USE_LOGDEPTHBUF_EXT
    gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;
  #endif

  // Output fully opaque color with explicit alpha
  gl_FragColor = vec4(finalColor, 1.0);
}