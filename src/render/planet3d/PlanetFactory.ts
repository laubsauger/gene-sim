/**
 * Unified planet factory that avoids duplication between PlanetWithAtmosphere and PlanetWithBiomes
 * This composable approach allows adding/removing features without code duplication
 */
import * as THREE from 'three';
import { BiomeGenerator } from '../../sim/biomes';
import atmosphereMatVertexShader from './shader/atmosphereMat.vertex.glsl?raw'
import atmosphereMatFragmentShader from './shader/atmosphereMat.frag.glsl?raw'
import { createBiomeTexture } from './BiomeTextureGenerator';
import { createPoleCaps } from './PoleCapsMesh';

export interface PlanetConfig {
  radius?: number;
  atmosphereColor?: THREE.Color;
  mieColor?: THREE.Color;
  atmosphereThickness?: number;
  anisotropy?: number;
  exposure?: number;
  biomeGenerator?: BiomeGenerator;
  biomeMode?: 'natural' | 'highlight' | 'hidden';
  baseColor?: THREE.Color;
}

export function makePlanet(config: PlanetConfig = {}) {
  const {
    radius = 1,
    atmosphereColor = new THREE.Color(0x78a6ff),
    mieColor = new THREE.Color(0xfff2d1),
    atmosphereThickness = 0.05,
    anisotropy = 0.65,
    exposure = 1.2,
    biomeGenerator,
    biomeMode = 'natural',
    baseColor = new THREE.Color(0x3a6f4f),
    useAdvancedBiomeShaders = false,
    biomeShaderConfig = {}
  } = config;

  const group = new THREE.Group();
  const shared = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0).normalize() },
    uExposure: { value: exposure },
    uTime: { value: 0 },
  };

  // Declare variables for planet surface
  let planetMesh: THREE.Mesh;
  let planetMat: THREE.MeshStandardMaterial | THREE.ShaderMaterial;
  let biomeTexture: THREE.CanvasTexture | undefined;
  let advancedBiomeControls: any = null;
  
  // Create planet surface - use advanced shaders if requested and biomes are available
  if (useAdvancedBiomeShaders && biomeGenerator && biomeMode !== 'hidden') {
    // Use advanced biome shaders for stylized rendering
    const advancedBiome = createAdvancedBiomeSphere({
      biomeGenerator,
      radius,
      biomeBlend: biomeShaderConfig.biomeBlend ?? 0.8,
      oceanWaveIntensity: biomeShaderConfig.oceanWaveIntensity ?? 0.7,
      showContours: biomeShaderConfig.showContours ?? false,
      satelliteView: biomeShaderConfig.satelliteView ?? true
    });
    planetMesh = advancedBiome.mesh;
    planetMat = advancedBiome.mesh.material as THREE.ShaderMaterial;
    advancedBiomeControls = advancedBiome;
    group.add(planetMesh);
  } else {
    // Use standard material with texture or base color
    if (biomeGenerator && biomeMode !== 'hidden') {
      biomeTexture = createBiomeTexture(biomeGenerator, biomeMode);
      planetMat = new THREE.MeshStandardMaterial({
        map: biomeTexture,
        color: new THREE.Color(0xffffff), // White to show texture colors
        roughness: 0.9,
        metalness: 0.1,
        emissive: new THREE.Color(0x0a0f1a),
        emissiveIntensity: 0.1,
      });
    } else {
      planetMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.9,
        metalness: 0.1,
        emissive: new THREE.Color(0x0a0f1a),
        emissiveIntensity: 0.1,
      });
    }

    const planetGeo = new THREE.SphereGeometry(radius, 128, 96);
    planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.frustumCulled = false;
    planetMesh.castShadow = true;
    planetMesh.receiveShadow = true;
    group.add(planetMesh);
  }

  // Atmosphere shader - shared code
  const atmUniforms = {
    ...shared,
    uPlanetRadius: { value: radius },
    uColorRayleigh: { value: new THREE.Color(atmosphereColor) },
    uColorMie: { value: new THREE.Color(mieColor) },
    uAnisotropy: { value: anisotropy },
    uRimPower: { value: 3.0 },
    uDensity: { value: 1.0 },
    uExposure: { value: exposure },
  };

  const atmosphereMat = new THREE.ShaderMaterial({
    uniforms: atmUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: atmosphereMatVertexShader,
    fragmentShader: atmosphereMatFragmentShader,
  });

  const atmosphereGeo = new THREE.SphereGeometry(radius * (1.0 + atmosphereThickness * 2.0), 96, 64);
  const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  atmosphereMesh.frustumCulled = false;
  atmosphereMesh.renderOrder = 10; // Render atmosphere after planet
  group.add(atmosphereMesh);
  
  // Add pole caps to cover the unused polar regions
  const poleCaps = createPoleCaps(radius);
  group.add(poleCaps);

  function update({
    delta = 0.016,
    time = 0,
    directionalLight = null,
    cloudRotationSpeed = 0.02
  }: {
    delta?: number;
    time?: number;
    directionalLight?: THREE.DirectionalLight | null;
    cloudRotationSpeed?: number;
  }) {
    let lightDir: THREE.Vector3 | undefined;
    if (directionalLight) {
      const planetWorld = new THREE.Vector3();
      group.getWorldPosition(planetWorld);
      const lightPos = new THREE.Vector3();
      directionalLight.getWorldPosition(lightPos);
      lightDir = lightPos.sub(planetWorld).normalize();
      shared.uLightDir.value.copy(lightDir);
    }
    shared.uTime.value = time;

    // Update advanced biome shader if present
    if (advancedBiomeControls) {
      advancedBiomeControls.update(time, lightDir);
    }

    const cloudMesh = group.children.find(child => child.userData.isCloud);
    if (cloudMesh) {
      cloudMesh.rotation.y += cloudRotationSpeed * delta;
    }
  }

  // Method to update biome mode dynamically
  function updateBiomeMode(newMode: 'natural' | 'highlight' | 'hidden', newBiomeGenerator?: BiomeGenerator) {
    if (biomeTexture) {
      biomeTexture.dispose();
      biomeTexture = undefined;
    }

    if ((newBiomeGenerator || biomeGenerator) && newMode !== 'hidden') {
      biomeTexture = createBiomeTexture(newBiomeGenerator || biomeGenerator!, newMode);
      planetMat.map = biomeTexture;
      planetMat.color.set(0xffffff);
    } else {
      planetMat.map = null;
      planetMat.color.copy(baseColor);
    }
    planetMat.needsUpdate = true;
  }

  function dispose() {
    if (advancedBiomeControls) {
      advancedBiomeControls.disposeAll();
    } else {
      if (biomeTexture) {
        biomeTexture.dispose();
      }
      planetMesh.geometry.dispose();
      if (planetMat instanceof THREE.MeshStandardMaterial) {
        planetMat.dispose();
      }
    }
    atmosphereGeo.dispose();
    atmosphereMat.dispose();
  }

  return {
    group,
    uniforms: {
      shared,
      atmUniforms
    },
    meshes: {
      planetMesh,
      atmosphereMesh
    },
    update,
    updateBiomeMode,
    dispose,
    advancedBiomeControls
  };
}