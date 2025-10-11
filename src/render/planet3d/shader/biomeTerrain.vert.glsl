// Support for logarithmic depth buffer
#ifdef USE_LOGDEPTHBUF
  #ifdef USE_LOGDEPTHBUF_EXT
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
uniform float uTime;

// Simplex noise for terrain generation
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Fractal brownian motion for layered detail
float fbm(vec2 uv, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 2.0;
  
  for(int i = 0; i < octaves; i++) {
    value += amplitude * snoise(uv * frequency);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  
  return value;
}

// Convert sphere UV to cylindrical coordinates for seamless wrapping
vec2 uvToCylindrical(vec2 uv, vec3 pos) {
  vec3 normPos = normalize(pos);
  // Use atan for horizontal wrapping (naturally periodic)
  float theta = atan(normPos.z, normPos.x) / (2.0 * 3.14159265359); // -0.5 to 0.5
  float y = uv.y;
  return vec2(theta + 0.5, y); // Shift to 0-1 range
}

void main() {
  vUv = uv;
  vPosition = position;

  // Get seamless cylindrical coordinates for noise sampling
  vec2 cylUV = uvToCylindrical(uv, position);

  // Sample biome texture to determine terrain type
  vec4 biomeData = texture2D(uBiomeTexture, uv);

  // Determine biome type from texture color (must match fragment shader)
  // Ocean: dark blue (0x0d2438) - low RGB, blue is highest
  float isOcean = step(biomeData.b, 0.3) * step(biomeData.r + biomeData.g, 0.25) * step(0.1, biomeData.b);
  // Desert: sandy yellow (0xe8c170) - high R, moderate G, low B
  float isDesert = step(0.7, biomeData.r) * step(0.5, biomeData.g) * step(biomeData.b, 0.5);
  // Mountain: dark grey (0x2a2a2a) - very low RGB, all similar
  float isMountain = step(biomeData.r, 0.2) * step(biomeData.g, 0.2) * step(biomeData.b, 0.2);
  // Forest: dark green (0x2d5a2d) - low R, moderate G, low B
  float isForest = step(0.25, biomeData.g) * step(biomeData.g, 0.45) * step(biomeData.r, 0.25);

  // Base position
  vec3 displaced = position;

  // Calculate elevation based on biome type
  float elevation = 0.0;

  if (isMountain > 0.5) {
    // Mountain terrain - significant displacement (use cylindrical coords for seamless wrapping)
    float mountainBase = fbm(cylUV * 8.0, 4);
    float mountainPeaks = fbm(cylUV * 16.0, 3);
    float ridges = abs(snoise(cylUV * 12.0)) * 0.5;

    elevation = mountainBase * 0.03 + mountainPeaks * 0.02 + ridges * 0.015;
    elevation *= 1.0 + snoise(cylUV * 4.0) * 0.3; // Vary mountain heights
  } else if (isDesert > 0.5) {
    // Desert dunes - gentle rolling hills
    float dunes = sin(cylUV.x * 30.0 + snoise(cylUV * 10.0)) * sin(cylUV.y * 30.0 + snoise(cylUV * 12.0));
    elevation = dunes * 0.005 + fbm(cylUV * 20.0, 2) * 0.003;
  } else if (isForest > 0.5) {
    // Forest - small bumps for tree canopy
    elevation = fbm(cylUV * 40.0, 3) * 0.008;
  } else if (isOcean > 0.5) {
    // Ocean - animated waves
    float wave1 = sin(cylUV.x * 50.0 + uTime * 2.0) * sin(cylUV.y * 50.0 + uTime * 1.5);
    float wave2 = sin(cylUV.x * 80.0 - uTime * 1.8) * sin(cylUV.y * 80.0 - uTime * 2.2);
    elevation = (wave1 * 0.003 + wave2 * 0.002) * 0.5;
  } else {
    // Default terrain - gentle variation
    elevation = fbm(cylUV * 15.0, 2) * 0.005;
  }

  // Apply displacement along normal
  displaced += normal * elevation;

  // Store elevation for fragment shader
  vElevation = elevation;

  // Calculate world normal for lighting
  // Transform the normal (not position) to world space to account for rotation
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vNormal = normalize(normalMatrix * normal);

  // Transform position
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Handle logarithmic depth buffer
  #ifdef USE_LOGDEPTHBUF
    gl_Position.z = log2(max(1e-6, gl_Position.w + 1.0)) * logDepthBufFC;
    #ifdef USE_LOGDEPTHBUF_EXT
      vFragDepth = 1.0 + gl_Position.w;
    #else
      gl_Position.z = (gl_Position.z - 1.0) * gl_Position.w;
    #endif
  #endif

  // Update vPosition to be in view space for proper calculations
  vPosition = mvPosition.xyz;
}