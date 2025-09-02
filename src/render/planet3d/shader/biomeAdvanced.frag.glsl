varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vElevation;

uniform sampler2D uBiomeTexture;
uniform vec3 uLightDir;
uniform float uTime;
uniform float uBiomeBlend;
uniform float uOceanWaveIntensity;
uniform float uTerrainDetail;
uniform float uShowContours;
uniform float uSatelliteView;

// Ocean colors
const vec3 deepOcean = vec3(0.004, 0.149, 0.322);
const vec3 shallowOcean = vec3(0.067, 0.408, 0.608);
const vec3 coastalWater = vec3(0.18, 0.545, 0.667);

// Terrain colors for different elevations
const vec3 sandColor = vec3(0.937, 0.843, 0.647);
const vec3 grassColor = vec3(0.345, 0.608, 0.302);
const vec3 forestColor = vec3(0.157, 0.392, 0.196);
const vec3 rockColor = vec3(0.502, 0.451, 0.412);
const vec3 snowColor = vec3(0.95, 0.95, 0.98);

// Desert colors
const vec3 desertSand = vec3(0.914, 0.769, 0.592);
const vec3 desertRock = vec3(0.647, 0.463, 0.314);

// Arctic colors
const vec3 tundraColor = vec3(0.729, 0.796, 0.788);
const vec3 iceColor = vec3(0.878, 0.918, 0.937);

// Noise functions for detail
float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.123));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  
  for(int i = 0; i < octaves; i++) {
    value += amplitude * noise(p * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

vec3 getOceanColor(vec2 uv, float depth) {
  // Animated wave pattern
  float wavePattern = fbm(uv * 32.0 + vec2(uTime * 0.02, uTime * 0.01), 4);
  wavePattern += fbm(uv * 64.0 - vec2(uTime * 0.01, uTime * 0.03), 3) * 0.5;
  
  // Ocean depth gradient
  vec3 oceanBase = mix(coastalWater, deepOcean, smoothstep(0.0, 0.3, depth));
  
  // Wave foam
  float foam = smoothstep(0.7, 0.9, wavePattern) * uOceanWaveIntensity;
  vec3 foamColor = vec3(0.9, 0.95, 0.98);
  
  // Fresnel effect for water
  float fresnel = pow(1.0 - dot(normalize(vNormal), normalize(-vPosition)), 2.0);
  oceanBase = mix(oceanBase, shallowOcean, fresnel * 0.3);
  
  return mix(oceanBase, foamColor, foam);
}

vec3 getDesertColor(vec2 uv) {
  // Sand dune patterns
  float dunePattern = fbm(uv * 16.0, 5);
  float windStreaks = fbm(uv * vec2(64.0, 8.0), 3);
  
  vec3 desert = mix(desertSand, desertRock, dunePattern * 0.3);
  
  // Wind patterns
  desert = mix(desert, desertSand * 0.9, windStreaks * 0.2);
  
  // Heat shimmer effect (subtle color variation)
  float shimmer = sin(uTime * 2.0 + dunePattern * 10.0) * 0.02;
  desert += vec3(shimmer, shimmer * 0.5, 0.0);
  
  return desert;
}

vec3 getArcticColor(vec2 uv, float elevation) {
  // Ice crystal patterns
  float icePattern = fbm(uv * 24.0, 4);
  float cracks = fbm(uv * 48.0, 3);
  
  vec3 arctic = mix(tundraColor, iceColor, smoothstep(0.3, 0.7, elevation + icePattern * 0.2));
  
  // Ice cracks
  float crackIntensity = smoothstep(0.4, 0.5, cracks) * 0.15;
  arctic *= 1.0 - crackIntensity;
  
  // Subtle blue tint for ice
  arctic = mix(arctic, vec3(0.7, 0.85, 1.0), elevation * 0.1);
  
  return arctic;
}

vec3 getMountainColor(vec2 uv, float elevation) {
  // Rock strata
  float rockPattern = fbm(uv * 32.0, 5);
  float snowLine = 0.6 + sin(uv.x * 20.0) * 0.05;
  
  vec3 mountain = rockColor;
  
  // Elevation-based coloring
  if(elevation > snowLine) {
    mountain = mix(rockColor, snowColor, smoothstep(snowLine, snowLine + 0.1, elevation));
  } else {
    mountain = mix(grassColor, rockColor, smoothstep(0.3, 0.6, elevation));
  }
  
  // Rock detail
  mountain *= 0.9 + rockPattern * 0.2;
  
  // Snow accumulation in crevices
  float snowAccumulation = smoothstep(0.7, 0.9, rockPattern) * smoothstep(0.5, 0.8, elevation);
  mountain = mix(mountain, snowColor, snowAccumulation * 0.3);
  
  return mountain;
}

vec3 getForestColor(vec2 uv) {
  // Tree canopy variation
  float canopyPattern = fbm(uv * 20.0, 5);
  float density = fbm(uv * 40.0, 3);
  
  vec3 forest = mix(grassColor, forestColor, canopyPattern);
  
  // Seasonal variation (can be controlled by uniform)
  float seasonal = sin(uTime * 0.1) * 0.5 + 0.5;
  vec3 autumnColor = vec3(0.8, 0.4, 0.1);
  forest = mix(forest, autumnColor, seasonal * 0.2 * canopyPattern);
  
  // Clearings
  float clearing = smoothstep(0.7, 0.8, density);
  forest = mix(forest, grassColor * 1.1, clearing);
  
  return forest;
}

void main() {
  // Sample biome texture
  vec4 biomeData = texture2D(uBiomeTexture, vUv);
  
  // Determine biome type from texture color
  // This is a simplified mapping - in practice you'd encode biome IDs differently
  float isOcean = step(biomeData.b, 0.3) * step(0.3, biomeData.r + biomeData.g);
  float isDesert = step(0.7, biomeData.r) * step(biomeData.g, 0.5);
  float isArctic = step(0.7, biomeData.b) * step(0.7, biomeData.g);
  float isMountain = step(0.5, biomeData.r) * step(biomeData.r, 0.7) * step(biomeData.g, 0.4);
  float isForest = 1.0 - max(max(max(isOcean, isDesert), isArctic), isMountain);
  
  vec3 finalColor = vec3(0.0);
  
  // Apply biome-specific shading
  if(isOcean > 0.5) {
    finalColor = getOceanColor(vUv, vElevation + 0.5);
  } else if(isDesert > 0.5) {
    finalColor = getDesertColor(vUv);
  } else if(isArctic > 0.5) {
    finalColor = getArcticColor(vUv, vElevation + 0.5);
  } else if(isMountain > 0.5) {
    finalColor = getMountainColor(vUv, vElevation + 0.5);
  } else {
    finalColor = getForestColor(vUv);
  }
  
  // Blend with original biome color for artistic control
  vec3 originalColor = biomeData.rgb;
  finalColor = mix(originalColor, finalColor, uBiomeBlend);
  
  // Lighting
  float NdotL = max(dot(vNormal, uLightDir), 0.0);
  float ambient = 0.4;
  float diffuse = NdotL * 0.6;
  
  // Atmospheric scattering for realism
  float atmosphericFog = pow(1.0 - dot(normalize(vNormal), normalize(-vPosition)), 1.5);
  vec3 atmosphereColor = vec3(0.6, 0.7, 0.9);
  
  finalColor *= (ambient + diffuse);
  finalColor = mix(finalColor, atmosphereColor, atmosphericFog * 0.15);
  
  // Topographic contour lines (optional)
  if(uShowContours > 0.5) {
    float contourInterval = 0.1;
    float contourWidth = 0.003;
    float contour = mod(vElevation + 0.5, contourInterval);
    float contourLine = smoothstep(contourWidth, 0.0, abs(contour - contourInterval * 0.5));
    finalColor = mix(finalColor, vec3(0.2, 0.1, 0.0), contourLine * 0.3);
  }
  
  // Satellite view adjustments
  if(uSatelliteView > 0.5) {
    // Increase contrast
    finalColor = pow(finalColor, vec3(0.9));
    // Slight desaturation for photographic look
    float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
    finalColor = mix(vec3(gray), finalColor, 0.85);
  }
  
  gl_FragColor = vec4(finalColor, 1.0);
}