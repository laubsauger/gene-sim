import * as THREE from 'three';
import { BiomeGenerator, BIOME_CONFIGS } from '../../sim/biomes';
import biomeVertexShader from './shader/biomeAdvanced.vertex.glsl?raw';
import biomeFragmentShader from './shader/biomeAdvanced.frag.glsl?raw';

export interface AdvancedBiomeConfig {
  biomeGenerator: BiomeGenerator;
  radius: number;
  biomeBlend?: number; // 0 = original colors, 1 = full stylized
  oceanWaveIntensity?: number;
  terrainDetail?: number;
  showContours?: boolean;
  satelliteView?: boolean;
}

export function createAdvancedBiomeMaterial(config: AdvancedBiomeConfig) {
  const {
    biomeGenerator,
    radius,
    biomeBlend = 0.8,
    oceanWaveIntensity = 0.7,
    terrainDetail = 1.0,
    showContours = false,
    satelliteView = true
  } = config;

  // Create biome texture from generator
  const grid = biomeGenerator.getBiomeGrid();
  const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();

  const canvas = document.createElement('canvas');
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext('2d')!;

  // Create texture with biome data
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const biomeType = grid[y][x];
      const biomeConfig = BIOME_CONFIGS[biomeType];
      const color = biomeConfig.color;
      
      ctx.fillStyle = `#${color.getHexString()}`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const biomeTexture = new THREE.CanvasTexture(canvas);
  biomeTexture.magFilter = THREE.NearestFilter;
  biomeTexture.minFilter = THREE.LinearMipMapLinearFilter;
  biomeTexture.wrapS = THREE.RepeatWrapping;
  biomeTexture.wrapT = THREE.ClampToEdgeWrapping;
  biomeTexture.needsUpdate = true;

  // Create shader material with advanced rendering
  const uniforms = {
    uBiomeTexture: { value: biomeTexture },
    uLightDir: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() },
    uTime: { value: 0 },
    uPlanetRadius: { value: radius },
    uBiomeBlend: { value: biomeBlend },
    uOceanWaveIntensity: { value: oceanWaveIntensity },
    uTerrainDetail: { value: terrainDetail },
    uShowContours: { value: showContours ? 1.0 : 0.0 },
    uSatelliteView: { value: satelliteView ? 1.0 : 0.0 }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: biomeVertexShader,
    fragmentShader: biomeFragmentShader,
    side: THREE.FrontSide,
    transparent: false
  });

  return {
    material,
    uniforms,
    biomeTexture,
    dispose: () => {
      biomeTexture.dispose();
      material.dispose();
    },
    update: (time: number, lightDir?: THREE.Vector3) => {
      uniforms.uTime.value = time;
      if (lightDir) {
        uniforms.uLightDir.value.copy(lightDir);
      }
    },
    setBlend: (blend: number) => {
      uniforms.uBiomeBlend.value = Math.max(0, Math.min(1, blend));
    },
    setOceanWaves: (intensity: number) => {
      uniforms.uOceanWaveIntensity.value = Math.max(0, Math.min(1, intensity));
    },
    setContours: (show: boolean) => {
      uniforms.uShowContours.value = show ? 1.0 : 0.0;
    },
    setSatelliteView: (enabled: boolean) => {
      uniforms.uSatelliteView.value = enabled ? 1.0 : 0.0;
    }
  };
}

export function createAdvancedBiomeSphere(config: AdvancedBiomeConfig) {
  const { radius } = config;
  
  // Create higher detail geometry for better shader effects
  const geometry = new THREE.SphereGeometry(radius, 256, 192);
  
  const { material, ...controls } = createAdvancedBiomeMaterial(config);
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return {
    mesh,
    ...controls,
    disposeAll: () => {
      geometry.dispose();
      controls.dispose();
    }
  };
}