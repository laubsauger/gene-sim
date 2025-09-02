import * as THREE from 'three';

const foodVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const foodFragmentShader = `
  uniform sampler2D uFoodTexture;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  
  void main() {
    // Sample food texture with proper coordinate transformation
    // Apply the same transformation as entities and biomes:
    // 1. Rotate -90 degrees in longitude (X axis)
    // 2. Map Y to middle 85% of texture for pole padding
    vec2 adjustedUv = vUv;
    
    // Rotate -90 degrees in longitude to match entity/biome alignment
    adjustedUv.x = mod(adjustedUv.x - 0.25, 1.0); // Subtract 0.25 (90 degrees) and wrap
    
    // Map Y to account for pole padding (7.5% top, 85% middle, 7.5% bottom)
    // This matches the biome texture mapping
    adjustedUv.y = 0.075 + adjustedUv.y * 0.85;
    
    float food = texture2D(uFoodTexture, adjustedUv).r;
    
    // Skip completely empty cells for transparency
    if (food < 0.01) {
      discard;
    }
    
    // Normalize food value (0-255 to 0-1)
    float foodLevel = food / 255.0;
    
    // Purple gradient for food visualization (matching Scene2D)
    vec3 depleted = vec3(0.2, 0.1, 0.3);    // Dark purple (consumed)
    vec3 sparse = vec3(0.4, 0.2, 0.6);      // Medium purple
    vec3 medium = vec3(0.55, 0.35, 0.85);   // Bright purple
    vec3 full = vec3(0.7, 0.5, 1.0);        // Light purple
    
    vec3 color;
    float alpha = uOpacity;
    
    if (foodLevel < 0.33) {
      color = mix(depleted, sparse, foodLevel * 3.0);
      alpha *= (0.7 + foodLevel * 0.3); // Higher base alpha for visibility
    } else if (foodLevel < 0.66) {
      color = mix(sparse, medium, (foodLevel - 0.33) * 3.0);
      alpha *= 0.85;
    } else {
      color = mix(medium, full, (foodLevel - 0.66) * 3.0);
      alpha *= 0.95;
    }
    
    // Fade near edges of the sphere for better blending
    float edgeFade = 1.0 - pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPosition))), 2.0);
    alpha *= edgeFade;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export interface FoodOverlay3DConfig {
  foodData: Uint8Array | null;
  cols: number;
  rows: number;
  radius: number;
  opacity?: number;
}

export function createFoodOverlay3D(config: FoodOverlay3DConfig): {
  mesh: THREE.Mesh;
  update: (foodData: Uint8Array, time: number) => void;
  setOpacity: (opacity: number) => void;
  dispose: () => void;
} {
  const { cols, rows, radius, opacity = 0.6 } = config;
  
  // Create data texture for food values
  const data = new Uint8Array(cols * rows);
  const texture = new THREE.DataTexture(
    data,
    cols,
    rows,
    THREE.RedFormat,
    THREE.UnsignedByteType
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping; // Clamp vertically to avoid pole artifacts
  texture.flipY = true; // Flip to match biome coordinate system (same as 2D)
  texture.needsUpdate = true;
  
  // Create sphere geometry matching planet
  // Position between planet surface (1.0) and entities (1.005)
  const geometry = new THREE.SphereGeometry(
    radius * 1.003, // Between planet and entities
    128,
    64
  );
  
  // Create shader material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFoodTexture: { value: texture },
      uOpacity: { value: opacity },
      uTime: { value: 0 }
    },
    vertexShader: foodVertexShader,
    fragmentShader: foodFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false, // Disable depth test like clouds to prevent planet occlusion
    side: THREE.FrontSide,
    blending: THREE.NormalBlending // Use normal blending for proper transparency
  });
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2; // Render after planet (0) and entities (0), but before clouds (50+)
  mesh.name = 'FoodOverlay3D';
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  
  // Update function
  let frameCount = 0;
  const update = (foodData: Uint8Array, time: number) => {
    frameCount++;
    
    // Only update texture every 4 frames for performance
    if (frameCount % 4 === 0 && foodData && texture.image.data) {
      const textureData = texture.image.data as Uint8Array;
      if (foodData.length === textureData.length) {
        textureData.set(foodData);
        texture.needsUpdate = true;
      }
    }
    
    // Update time for animation
    material.uniforms.uTime.value = time;
  };
  
  // Set opacity function
  const setOpacity = (newOpacity: number) => {
    material.uniforms.uOpacity.value = newOpacity;
  };
  
  // Cleanup function
  const dispose = () => {
    geometry.dispose();
    material.dispose();
    texture.dispose();
  };
  
  // Initialize with food data if provided
  if (config.foodData) {
    update(config.foodData, 0);
  }
  
  return {
    mesh,
    update,
    setOpacity,
    dispose
  };
}