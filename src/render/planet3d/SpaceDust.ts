import * as THREE from 'three';

// Shader for space dust particles that react to light
const spaceDustVertexShader = `
  attribute float size;
  attribute float brightness;
  
  varying float vBrightness;
  varying vec3 vWorldPos;
  
  void main() {
    vBrightness = brightness;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    
    vec4 mvPosition = viewMatrix * worldPos;
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const spaceDustFragmentShader = `
  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform float uIntensity;
  
  varying float vBrightness;
  varying vec3 vWorldPos;
  
  void main() {
    // Circular particle shape
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Soft edges
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    
    // Light interaction - dust is visible from all angles
    vec3 toCamera = normalize(uCameraPos - vWorldPos);
    vec3 lightDir = normalize(uLightDir);
    
    // Forward scattering - dust glows when between camera and light
    float forwardScatter = max(0.0, dot(toCamera, -lightDir));
    forwardScatter = pow(forwardScatter, 3.0); // Sharper falloff
    
    // Back scattering - dust also visible when lit from behind
    float backScatter = max(0.0, dot(toCamera, lightDir)) * 0.3;
    
    // Side scattering for ambient visibility - increased for better overall visibility
    float sideScatter = 0.4;
    
    // Combine all scattering types
    float scatter = sideScatter + forwardScatter * 0.6 + backScatter;
    
    // Distance from sun affects brightness
    float distFromOrigin = length(vWorldPos);
    float distanceFade = 1.0 / (1.0 + distFromOrigin * 0.001);
    
    // Twinkling effect
    float twinkle = 0.8 + 0.2 * sin(uTime * 0.001 + vBrightness * 10.0);
    
    // Final brightness
    float finalBrightness = vBrightness * scatter * twinkle * distanceFade * uIntensity;
    
    // Warm color for dust (slightly golden)
    vec3 color = vec3(1.0, 0.95, 0.85);
    
    gl_FragColor = vec4(color * finalBrightness, alpha * finalBrightness * 0.5);
  }
`;

export interface SpaceDustOptions {
  count?: number;
  radius?: number;
  innerRadius?: number;
  sizeRange?: [number, number];
  intensity?: number;
}

export function createSpaceDust(options: SpaceDustOptions = {}) {
  const {
    count = 5000,
    radius = 500,
    innerRadius = 50,
    sizeRange = [0.5, 2.0],
    intensity = 0.5
  } = options;
  
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  
  // Generate dust particles in a full spherical volume with higher density near orbital plane
  for (let i = 0; i < count; i++) {
    // Use a combination of uniform and concentrated distribution
    const useOrbitalPlane = Math.random() < 0.6; // 60% near orbital plane
    
    if (useOrbitalPlane) {
      // Concentrated near the orbital plane (ecliptic)
      const angle = Math.random() * Math.PI * 2;
      const r = innerRadius + Math.pow(Math.random(), 0.7) * (radius - innerRadius); // More dense closer to sun
      const yOffset = (Math.random() - 0.5) * radius * 0.3; // Flattened distribution
      
      positions[i * 3] = r * Math.cos(angle);
      positions[i * 3 + 1] = yOffset;
      positions[i * 3 + 2] = r * Math.sin(angle);
    } else {
      // Uniform spherical distribution for ambient dust
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = innerRadius + Math.random() * (radius - innerRadius);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    
    // Size variation - smaller particles further out
    const dist = Math.sqrt(positions[i * 3] * positions[i * 3] + 
                          positions[i * 3 + 1] * positions[i * 3 + 1] + 
                          positions[i * 3 + 2] * positions[i * 3 + 2]);
    const sizeFactor = Math.max(0.3, 1.0 - dist / radius);
    sizes[i] = (sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])) * sizeFactor;
    
    // Brightness variation
    brightness[i] = 0.3 + Math.random() * 0.7;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));
  
  // Create material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uIntensity: { value: intensity }
    },
    vertexShader: spaceDustVertexShader,
    fragmentShader: spaceDustFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  
  // Create points
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  
  return {
    mesh: points,
    material,
    update: (time: number, lightDir: THREE.Vector3, cameraPos: THREE.Vector3) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uLightDir.value.copy(lightDir);
      material.uniforms.uCameraPos.value.copy(cameraPos);
    },
    setIntensity: (value: number) => {
      material.uniforms.uIntensity.value = value;
    }
  };
}

// Create a more focused dust cloud for shadow shafts near the planet
export function createPlanetaryDustRing(planetRadius: number, options: SpaceDustOptions = {}) {
  const {
    count = 2000,
    intensity = 0.3
  } = options;
  
  // Create dust in a ring/torus around the planet for more dramatic effect
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const brightness = new Float32Array(count);
  
  const ringRadius = planetRadius * 2.5; // Distance from planet center
  const ringThickness = planetRadius * 0.8; // Thickness of the ring
  
  for (let i = 0; i < count; i++) {
    // Create dust in a torus shape
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const r = ringRadius + Math.cos(v) * ringThickness;
    
    positions[i * 3] = Math.cos(u) * r;
    positions[i * 3 + 1] = Math.sin(v) * ringThickness * 0.3; // Flattened ring
    positions[i * 3 + 2] = Math.sin(u) * r;
    
    sizes[i] = 0.3 + Math.random() * 1.2;
    brightness[i] = 0.2 + Math.random() * 0.8;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('brightness', new THREE.BufferAttribute(brightness, 1));
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
      uTime: { value: 0 },
      uIntensity: { value: intensity }
    },
    vertexShader: spaceDustVertexShader,
    fragmentShader: spaceDustFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true
  });
  
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  
  return {
    mesh: points,
    material,
    update: (time: number, lightDir: THREE.Vector3, cameraPos: THREE.Vector3) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uLightDir.value.copy(lightDir);
      material.uniforms.uCameraPos.value.copy(cameraPos);
      
      // Slowly rotate the dust ring
      points.rotation.y = time * 0.00002;
    },
    setIntensity: (value: number) => {
      material.uniforms.uIntensity.value = value;
    }
  };
}