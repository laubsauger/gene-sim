import * as THREE from 'three';

// Shader for enhanced stars with twinkle effect
const starVertexShader = `
  attribute float size;
  attribute vec3 starColor;
  attribute float twinklePhase;
  attribute float twinkleSpeed;
  
  uniform float uTime;
  uniform float uTwinkleIntensity;
  
  varying vec3 vColor;
  varying float vBrightness;
  varying float vSize;
  
  void main() {
    vColor = starColor;
    
    // Twinkle effect with smoother transition
    float twinkle = sin(uTime * twinkleSpeed + twinklePhase) * 0.5 + 0.5;
    vBrightness = mix(0.7, 1.0, twinkle * uTwinkleIntensity);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Fixed size with subtle depth-based scaling to reduce flickering
    float depth = -mvPosition.z;
    float baseSize = size * 2.0;
    
    // Clamp size to prevent sub-pixel flickering
    gl_PointSize = max(baseSize, 1.0);
    vSize = gl_PointSize;
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  varying float vBrightness;
  varying float vSize;
  
  void main() {
    // Circular star shape with anti-aliasing
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Anti-aliased circle with smooth edge
    float radius = 0.4;
    float edgeWidth = 1.0 / vSize; // Anti-aliasing width based on star size
    float star = 1.0 - smoothstep(radius - edgeWidth, radius + edgeWidth, dist);
    
    // Softer glow falloff
    float glow = exp(-dist * 4.0);
    
    // Combine star and glow
    float alpha = max(star, glow * 0.3) * vBrightness;
    
    // Discard very faint pixels to improve performance
    if (alpha < 0.02) discard;
    
    // Apply color with pre-multiplied alpha for better blending
    vec3 finalColor = vColor * vBrightness;
    gl_FragColor = vec4(finalColor * alpha, alpha);
  }
`;

export interface StarfieldConfig {
  // Basic configuration
  starCount: number;        // Total number of stars (1k to 100k)
  radius: number;           // Radius of star sphere
  
  // Star distribution
  densityVariation: boolean; // Cluster stars for Milky Way effect
  milkyWayBand: boolean;     // Add denser band of stars
  
  // Visual properties
  sizeRange: [number, number];  // Min and max star sizes
  colorVariation: boolean;      // Enable star color variation
  twinkleEffect: boolean;        // Enable twinkle animation
  twinkleIntensity: number;      // 0-1 twinkle strength
  
  // Performance
  useLOD: boolean;              // Use level of detail
  frustumCulling: boolean;      // Cull off-screen stars
}

export function createEnhancedStarfield(config: Partial<StarfieldConfig> = {}) {
  const defaults: StarfieldConfig = {
    starCount: 20000,
    radius: 5000,
    densityVariation: true,
    milkyWayBand: true,
    sizeRange: [0.5, 3.0],
    colorVariation: true,
    twinkleEffect: true,
    twinkleIntensity: 0.3,
    useLOD: true,
    frustumCulling: true,
  };
  
  const settings = { ...defaults, ...config };
  const group = new THREE.Group();
  group.name = 'EnhancedStarfield';
  
  // Create different star layers for LOD
  const layers = settings.useLOD ? [
    { distance: 0, count: settings.starCount, sizeMultiplier: 1.0 },
    { distance: 1000, count: Math.floor(settings.starCount * 0.5), sizeMultiplier: 0.8 },
    { distance: 2000, count: Math.floor(settings.starCount * 0.25), sizeMultiplier: 0.6 },
  ] : [
    { distance: 0, count: settings.starCount, sizeMultiplier: 1.0 }
  ];
  
  layers.forEach((layer, layerIndex) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(layer.count * 3);
    const colors = new Float32Array(layer.count * 3);
    const sizes = new Float32Array(layer.count);
    const twinklePhases = new Float32Array(layer.count);
    const twinkleSpeeds = new Float32Array(layer.count);
    
    for (let i = 0; i < layer.count; i++) {
      // Position calculation with optional Milky Way band
      let theta = Math.random() * Math.PI * 2;
      let phi = Math.acos(Math.random() * 2 - 1);
      
      if (settings.milkyWayBand && Math.random() < 0.4) {
        // Concentrate 40% of stars near galactic plane with smooth falloff
        const galacticOffset = (Math.random() - 0.5) * 2; // -1 to 1
        // Use gaussian-like distribution for smoother band
        const gaussianFalloff = Math.exp(-galacticOffset * galacticOffset * 2);
        const bandWidth = 0.6 + (1 - gaussianFalloff) * 0.4; // Variable width based on distance from center
        
        // Add wave-like distortion to the galactic plane for more natural appearance
        const waveAmplitude = 0.15; // How much the band waves up and down
        const waveFrequency = 3.5; // Number of waves around the band
        const wavePhase = Math.random() * Math.PI * 2; // Random phase offset
        const waveDistortion = Math.sin(theta * waveFrequency + wavePhase) * waveAmplitude;
        
        // Add secondary wave for more complexity
        const secondaryWave = Math.sin(theta * 7 + wavePhase * 2) * waveAmplitude * 0.3;
        
        // Apply both galactic plane offset and wave distortions
        phi = Math.PI / 2 + galacticOffset * bandWidth + waveDistortion + secondaryWave;
        
        // Add clustering for spiral arms with more variation
        if (settings.densityVariation) {
          // Create spiral arm structure
          const armCount = 4; // Number of spiral arms
          const armSpread = 0.4; // How spread out the arms are
          const spiralFactor = theta * 0.2; // How much the arms spiral
          
          // Find nearest spiral arm
          const nearestArm = Math.round((theta + spiralFactor) / (Math.PI * 2 / armCount)) * (Math.PI * 2 / armCount);
          const armDistance = Math.abs(theta + spiralFactor - nearestArm);
          
          // Concentrate stars near spiral arms
          if (armDistance < armSpread) {
            const armDensity = Math.exp(-armDistance * armDistance / (armSpread * armSpread) * 10);
            theta += (nearestArm - theta) * armDensity * 0.5;
            
            // Add some turbulence to the arms
            theta += (Math.random() - 0.5) * 0.2 * armDensity;
          }
        }
      }
      
      // Apply density variation for clustering
      let r = settings.radius;
      if (settings.densityVariation) {
        // Use Perlin-like noise for natural clustering
        const clusterNoise = Math.sin(theta * 5) * Math.cos(phi * 3) * 0.2 + 1;
        r *= clusterNoise;
      }
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      
      // Star colors based on stellar classification
      if (settings.colorVariation) {
        const starType = Math.random();
        if (starType < 0.05) {
          // O-type: Blue supergiants (rare)
          colors[i * 3] = 0.6;
          colors[i * 3 + 1] = 0.7;
          colors[i * 3 + 2] = 1.0;
        } else if (starType < 0.15) {
          // B-type: Blue-white
          colors[i * 3] = 0.7;
          colors[i * 3 + 1] = 0.8;
          colors[i * 3 + 2] = 1.0;
        } else if (starType < 0.30) {
          // A-type: White
          colors[i * 3] = 0.95;
          colors[i * 3 + 1] = 0.95;
          colors[i * 3 + 2] = 1.0;
        } else if (starType < 0.60) {
          // F/G-type: Yellow-white (like our Sun)
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.95;
          colors[i * 3 + 2] = 0.85;
        } else if (starType < 0.85) {
          // K-type: Orange
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.8;
          colors[i * 3 + 2] = 0.6;
        } else {
          // M-type: Red dwarfs (most common)
          colors[i * 3] = 1.0;
          colors[i * 3 + 1] = 0.6;
          colors[i * 3 + 2] = 0.4;
        }
      } else {
        // Default white stars
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }
      
      // Star sizes with realistic distribution
      const sizeRange = settings.sizeRange;
      const magnitude = Math.random();
      if (magnitude < 0.01) {
        // Very bright stars (1%)
        sizes[i] = sizeRange[1] * layer.sizeMultiplier;
      } else if (magnitude < 0.1) {
        // Bright stars (9%)
        sizes[i] = (sizeRange[0] + (sizeRange[1] - sizeRange[0]) * 0.7) * layer.sizeMultiplier;
      } else if (magnitude < 0.4) {
        // Medium stars (30%)
        sizes[i] = (sizeRange[0] + (sizeRange[1] - sizeRange[0]) * 0.4) * layer.sizeMultiplier;
      } else {
        // Dim stars (60%)
        sizes[i] = sizeRange[0] * layer.sizeMultiplier;
      }
      
      // Twinkle parameters
      twinklePhases[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.5 + Math.random() * 2.0; // Vary twinkle speed
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhases, 1));
    geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    
    // Create material with custom shader or standard material
    let material: THREE.PointsMaterial | THREE.ShaderMaterial;
    
    if (settings.twinkleEffect) {
      // Use custom shader for twinkle effect
      material = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTwinkleIntensity: { value: settings.twinkleIntensity },
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
    } else {
      // Use standard material for better performance
      material = new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: false, // Disable size attenuation to reduce flickering
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
    }
    
    const stars = new THREE.Points(geometry, material);
    stars.frustumCulled = settings.frustumCulling;
    
    // Add to LOD or directly to group
    if (settings.useLOD && layers.length > 1) {
      const lod = new THREE.LOD();
      lod.addLevel(stars, layer.distance);
      group.add(lod);
    } else {
      group.add(stars);
    }
  });
  
  // Return group with update function for animation
  return {
    group,
    update: (time: number) => {
      if (settings.twinkleEffect) {
        group.traverse((child) => {
          if (child instanceof THREE.Points) {
            const material = child.material as THREE.ShaderMaterial;
            if (material.uniforms?.uTime) {
              material.uniforms.uTime.value = time;
            }
          }
        });
      }
    },
    // Configuration update methods
    setStarCount: (count: number) => {
      console.log(`Starfield count change to ${count} requires rebuild`);
      // Would need to rebuild geometry
    },
    setTwinkleIntensity: (intensity: number) => {
      group.traverse((child) => {
        if (child instanceof THREE.Points) {
          const material = child.material as THREE.ShaderMaterial;
          if (material.uniforms?.uTwinkleIntensity) {
            material.uniforms.uTwinkleIntensity.value = intensity;
          }
        }
      });
    },
  };
}

// Optional: Add nebula clouds for background
export function createNebulaClouds(radius: number = 6000) {
  const group = new THREE.Group();
  group.name = 'NebulaClouds';
  
  // Create several large billboard quads with nebula textures
  const nebulaCount = 5;
  
  for (let i = 0; i < nebulaCount; i++) {
    const size = 500 + Math.random() * 1000;
    const geometry = new THREE.PlaneGeometry(size, size);
    
    // Create gradient texture procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    // Create radial gradient
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    
    // Nebula colors
    const colors = [
      { r: 138, g: 43, b: 226 },  // Purple
      { r: 30, g: 144, b: 255 },   // Blue
      { r: 255, g: 20, b: 147 },   // Pink
      { r: 255, g: 140, b: 0 },    // Orange
    ];
    
    const color = colors[i % colors.length];
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);
    gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    
    const nebula = new THREE.Mesh(geometry, material);
    
    // Position randomly on sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    nebula.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi)
    );
    
    // Random rotation
    nebula.rotation.z = Math.random() * Math.PI * 2;
    
    // Make it always face the camera (billboard)
    nebula.lookAt(0, 0, 0);
    
    group.add(nebula);
  }
  
  return group;
}