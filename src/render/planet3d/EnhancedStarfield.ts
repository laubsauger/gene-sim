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

// Enhanced nebula clouds with improved visuals
export function createNebulaClouds(radius: number = 6000) {
  const group = new THREE.Group();
  group.name = 'NebulaClouds';
  
  // Create multiple layers for depth
  const nebulaLayers = [
    { count: 3, distance: radius * 0.8, sizeRange: [800, 1500], opacity: 0.15 },
    { count: 5, distance: radius * 0.9, sizeRange: [1000, 2000], opacity: 0.2 },
    { count: 4, distance: radius * 1.0, sizeRange: [1500, 3000], opacity: 0.25 },
  ];
  
  nebulaLayers.forEach((layer, layerIndex) => {
    for (let i = 0; i < layer.count; i++) {
      const size = layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]);
      const geometry = new THREE.PlaneGeometry(size, size);
      
      // Create more complex nebula texture
      const canvas = document.createElement('canvas');
      canvas.width = 512; // Higher resolution
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Clear canvas
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, 512, 512);
      
      // Nebula color palettes with more variety
      const palettes = [
        [ // Purple/Blue nebula
          { r: 138, g: 43, b: 226, name: 'purple' },
          { r: 75, g: 0, b: 130, name: 'indigo' },
          { r: 30, g: 144, b: 255, name: 'blue' }
        ],
        [ // Pink/Orange nebula
          { r: 255, g: 20, b: 147, name: 'pink' },
          { r: 255, g: 105, b: 180, name: 'hotpink' },
          { r: 255, g: 140, b: 0, name: 'orange' }
        ],
        [ // Cyan/Green nebula
          { r: 0, g: 255, b: 255, name: 'cyan' },
          { r: 64, g: 224, b: 208, name: 'turquoise' },
          { r: 0, g: 255, b: 127, name: 'springgreen' }
        ],
        [ // Red/Yellow nebula
          { r: 255, g: 69, b: 0, name: 'orangered' },
          { r: 255, g: 215, b: 0, name: 'gold' },
          { r: 255, g: 255, b: 100, name: 'lightyellow' }
        ]
      ];
      
      const palette = palettes[(i + layerIndex) % palettes.length];
      
      // Create multiple overlapping gradients for complexity
      const numClouds = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < numClouds; j++) {
        const x = 100 + Math.random() * 312;
        const y = 100 + Math.random() * 312;
        const cloudSize = 100 + Math.random() * 150;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, cloudSize);
        const color = palette[j % palette.length];
        
        // Add noise to the gradient for more natural look
        const noiseAmount = 0.3;
        const r = color.r + (Math.random() - 0.5) * 255 * noiseAmount;
        const g = color.g + (Math.random() - 0.5) * 255 * noiseAmount;
        const b = color.b + (Math.random() - 0.5) * 255 * noiseAmount;
        
        gradient.addColorStop(0, `rgba(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))}, ${layer.opacity * 0.8})`);
        gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${layer.opacity * 0.5})`);
        gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${layer.opacity * 0.2})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
      }
    
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 1.0, // Use full opacity since texture has alpha
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false, // Render in background
      });
      
      const nebula = new THREE.Mesh(geometry, material);
      
      // Position randomly on sphere at layer distance
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      nebula.position.set(
        layer.distance * Math.sin(phi) * Math.cos(theta),
        layer.distance * Math.sin(phi) * Math.sin(theta),
        layer.distance * Math.cos(phi)
      );
      
      // Random rotation for variety
      nebula.rotation.z = Math.random() * Math.PI * 2;
      
      // Make it always face the origin (billboard effect)
      nebula.lookAt(0, 0, 0);
      
      // Add subtle animation data
      nebula.userData = {
        rotationSpeed: (Math.random() - 0.5) * 0.0001,
        driftSpeed: (Math.random() - 0.5) * 0.00005,
        baseRotation: nebula.rotation.z,
      };
      
      group.add(nebula);
    }
  });
  
  // Return group with update function for animation
  return {
    group,
    update: (time: number) => {
      group.children.forEach((nebula) => {
        if (nebula.userData.rotationSpeed) {
          nebula.rotation.z = nebula.userData.baseRotation + time * nebula.userData.rotationSpeed;
        }
      });
    }
  };
}