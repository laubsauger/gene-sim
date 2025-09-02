import * as THREE from 'three';
import foodOverlayMatVertexShader from './shader/foodOverlayMat.vertex.glsl'
import foodOverlayMatFragmentShader from './shader/foodOverlayMat.frag.glsl'

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
  texture.flipY = false; // Don't flip - biome texture doesn't flip either
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
    vertexShader: foodOverlayMatVertexShader,
    fragmentShader: foodOverlayMatFragmentShader,
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