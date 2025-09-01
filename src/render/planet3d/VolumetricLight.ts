import * as THREE from 'three';

// Shader for volumetric light rays (god rays)
const volumetricVertexShader = `
  attribute float size;
  attribute float brightness;
  
  varying float vBrightness;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  
  void main() {
    vBrightness = brightness;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPos = -mvPosition.xyz;
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const volumetricFragmentShader = `
  uniform vec3 uSunPosition;
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uPlanetPosition;
  uniform float uPlanetRadius;
  uniform vec3 uMoonPosition;
  uniform float uMoonRadius;
  
  varying float vBrightness;
  varying vec3 vWorldPos;
  varying vec3 vViewPos;
  
  // Check if a point is in shadow from a sphere
  float sphereShadow(vec3 point, vec3 sphereCenter, float sphereRadius, vec3 lightDir) {
    vec3 toSphere = sphereCenter - point;
    float distToSphere = length(toSphere);
    
    // If we're inside the sphere, we're definitely in shadow
    if (distToSphere < sphereRadius) return 0.0;
    
    // Project point onto light ray from sphere center
    float t = dot(toSphere, lightDir);
    if (t < 0.0) return 1.0; // Point is behind sphere relative to light
    
    // Find closest point on ray to sphere center
    vec3 closestPoint = point + lightDir * t;
    float distToRay = length(sphereCenter - closestPoint);
    
    // Check if ray passes through sphere
    if (distToRay < sphereRadius) {
      // Soft shadow based on distance
      float shadow = smoothstep(sphereRadius * 0.8, sphereRadius * 1.2, distToRay);
      return shadow;
    }
    
    return 1.0;
  }
  
  void main() {
    // Circular particle shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Soft edges
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
    
    // Direction from sun to this particle
    vec3 sunToParticle = normalize(vWorldPos - uSunPosition);
    
    // Direction from camera to particle
    vec3 cameraToParticle = normalize(vWorldPos - uCameraPos);
    
    // Volumetric lighting - particles glow when sun is behind them from camera's perspective
    float backlight = max(0.0, dot(cameraToParticle, sunToParticle));
    backlight = pow(backlight, 3.0); // Sharp falloff
    
    // Add general ambient dust visibility
    float ambient = 0.05;
    
    // Check shadows from planet and moon
    vec3 lightDir = -sunToParticle; // Direction toward sun
    float planetShadow = sphereShadow(vWorldPos, uPlanetPosition, uPlanetRadius * 1.1, lightDir);
    float moonShadow = sphereShadow(vWorldPos, uMoonPosition, uMoonRadius * 1.1, lightDir);
    float shadow = planetShadow * moonShadow;
    
    // Particles in shadow are darker but still slightly visible
    float illumination = mix(0.1, 1.0, shadow);
    
    // Distance fade - closer to sun = brighter
    float distToSun = length(vWorldPos - uSunPosition);
    float distanceFade = 1.0 / (1.0 + distToSun * 0.001);
    
    // Combine all lighting factors
    float finalBrightness = vBrightness * (backlight + ambient) * illumination * distanceFade * uIntensity;
    
    // Warm golden color for sun-lit dust
    vec3 color = vec3(1.0, 0.9, 0.7);
    
    gl_FragColor = vec4(color * finalBrightness, alpha * finalBrightness);
  }
`;

// Create multi-layer starfield background with varying brightness
export function createStarfield(radius: number = 5000, count: number = 10000) {
  const group = new THREE.Group();
  group.name = 'StarfieldGroup';
  
  // Layer 1: Bright prominent stars (fewer)
  const brightStars = new THREE.BufferGeometry();
  const brightCount = Math.floor(count * 0.1); // 10% bright stars
  const brightPositions = new Float32Array(brightCount * 3);
  const brightColors = new Float32Array(brightCount * 3);
  const brightSizes = new Float32Array(brightCount);
  
  for (let i = 0; i < brightCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    brightPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    brightPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    brightPositions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Bright star colors
    const temp = Math.random();
    if (temp < 0.3) {
      // Blue supergiant
      brightColors[i * 3] = 0.7;
      brightColors[i * 3 + 1] = 0.8;
      brightColors[i * 3 + 2] = 1.0;
    } else if (temp < 0.7) {
      // White main sequence
      brightColors[i * 3] = 1.0;
      brightColors[i * 3 + 1] = 1.0;
      brightColors[i * 3 + 2] = 1.0;
    } else {
      // Red/orange giant
      brightColors[i * 3] = 1.0;
      brightColors[i * 3 + 1] = 0.85;
      brightColors[i * 3 + 2] = 0.7;
    }
    
    brightSizes[i] = Math.random() * 2 + 2; // Larger sizes
  }
  
  brightStars.setAttribute('position', new THREE.BufferAttribute(brightPositions, 3));
  brightStars.setAttribute('color', new THREE.BufferAttribute(brightColors, 3));
  brightStars.setAttribute('size', new THREE.BufferAttribute(brightSizes, 1));
  
  const brightMaterial = new THREE.PointsMaterial({
    size: 3,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
  });
  
  const brightStarsPoints = new THREE.Points(brightStars, brightMaterial);
  brightStarsPoints.name = 'BrightStars';
  group.add(brightStarsPoints);
  
  // Layer 2: Medium brightness stars
  const mediumStars = new THREE.BufferGeometry();
  const mediumCount = Math.floor(count * 0.3); // 30% medium stars
  const mediumPositions = new Float32Array(mediumCount * 3);
  const mediumColors = new Float32Array(mediumCount * 3);
  const mediumSizes = new Float32Array(mediumCount);
  
  for (let i = 0; i < mediumCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    mediumPositions[i * 3] = (radius + 100) * Math.sin(phi) * Math.cos(theta);
    mediumPositions[i * 3 + 1] = (radius + 100) * Math.sin(phi) * Math.sin(theta);
    mediumPositions[i * 3 + 2] = (radius + 100) * Math.cos(phi);
    
    // Medium star colors (mostly white)
    mediumColors[i * 3] = 0.9 + Math.random() * 0.1;
    mediumColors[i * 3 + 1] = 0.9 + Math.random() * 0.1;
    mediumColors[i * 3 + 2] = 0.9 + Math.random() * 0.1;
    
    mediumSizes[i] = Math.random() * 1.5 + 0.5;
  }
  
  mediumStars.setAttribute('position', new THREE.BufferAttribute(mediumPositions, 3));
  mediumStars.setAttribute('color', new THREE.BufferAttribute(mediumColors, 3));
  mediumStars.setAttribute('size', new THREE.BufferAttribute(mediumSizes, 1));
  
  const mediumMaterial = new THREE.PointsMaterial({
    size: 1.5,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.7
  });
  
  const mediumStarsPoints = new THREE.Points(mediumStars, mediumMaterial);
  mediumStarsPoints.name = 'MediumStars';
  group.add(mediumStarsPoints);
  
  // Layer 3: Dim background stars (majority)
  const dimStars = new THREE.BufferGeometry();
  const dimCount = Math.floor(count * 0.6); // 60% dim stars
  const dimPositions = new Float32Array(dimCount * 3);
  const dimColors = new Float32Array(dimCount * 3);
  const dimSizes = new Float32Array(dimCount);
  
  for (let i = 0; i < dimCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    dimPositions[i * 3] = (radius + 200) * Math.sin(phi) * Math.cos(theta);
    dimPositions[i * 3 + 1] = (radius + 200) * Math.sin(phi) * Math.sin(theta);
    dimPositions[i * 3 + 2] = (radius + 200) * Math.cos(phi);
    
    // Dim star colors (grayish)
    dimColors[i * 3] = 0.7 + Math.random() * 0.3;
    dimColors[i * 3 + 1] = 0.7 + Math.random() * 0.3;
    dimColors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
    
    dimSizes[i] = Math.random() * 0.8 + 0.2;
  }
  
  dimStars.setAttribute('position', new THREE.BufferAttribute(dimPositions, 3));
  dimStars.setAttribute('color', new THREE.BufferAttribute(dimColors, 3));
  dimStars.setAttribute('size', new THREE.BufferAttribute(dimSizes, 1));
  
  const dimMaterial = new THREE.PointsMaterial({
    size: 0.8,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.4
  });
  
  const dimStarsPoints = new THREE.Points(dimStars, dimMaterial);
  dimStarsPoints.name = 'DimStars';
  group.add(dimStarsPoints);
  
  return group;
}

// Create volumetric light dust that properly surrounds the sun
export function createVolumetricDust(options: {
  count?: number;
  sunRadius?: number;
  spread?: number;
  intensity?: number;
} = {}) {
  const {
    count = 8000,
    sunRadius = 100,
    spread = 1000,
    intensity = 0.3
  } = options;
  
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  
  // Create dust in a spherical volume around the entire solar system
  // Concentrated more densely near the sun and orbital plane
  for (let i = 0; i < count; i++) {
    // Use exponential distribution for distance from origin (sun)
    const r = -Math.log(1 - Math.random()) * spread * 0.5;
    
    // Slightly flattened distribution (more particles near orbital plane)
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI * 0.6; // Concentrated near equator
    
    positions[i * 3] = r * Math.cos(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * 0.5; // Flatten Y axis
    positions[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);
    
    // Smaller particles further from sun
    sizes[i] = (1.0 + Math.random()) * Math.max(0.5, 1.0 - r / spread);
    
    // Brightness variation
    brightness[i] = 0.3 + Math.random() * 0.7;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetRadius: { value: 100 },
      uMoonPosition: { value: new THREE.Vector3(0, 0, 0) },
      uMoonRadius: { value: 27 },
      uTime: { value: 0 },
      uIntensity: { value: intensity }
    },
    vertexShader: volumetricVertexShader,
    fragmentShader: volumetricFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'VolumetricDust';
  
  return {
    mesh: points,
    material,
    update: (params: {
      time: number;
      sunPos: THREE.Vector3;
      cameraPos: THREE.Vector3;
      planetPos: THREE.Vector3;
      planetRadius: number;
      moonPos: THREE.Vector3;
      moonRadius: number;
    }) => {
      material.uniforms.uTime.value = params.time;
      material.uniforms.uSunPosition.value.copy(params.sunPos);
      material.uniforms.uCameraPos.value.copy(params.cameraPos);
      material.uniforms.uPlanetPosition.value.copy(params.planetPos);
      material.uniforms.uPlanetRadius.value = params.planetRadius;
      material.uniforms.uMoonPosition.value.copy(params.moonPos);
      material.uniforms.uMoonRadius.value = params.moonRadius;
    },
    setIntensity: (value: number) => {
      material.uniforms.uIntensity.value = value;
    }
  };
}