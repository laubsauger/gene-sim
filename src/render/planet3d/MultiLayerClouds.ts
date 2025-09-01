import * as THREE from 'three';
import cloudMatVertexShader from './shader/cloudMat.vertex.glsl';
import cloudMatFragmentShader from './shader/cloudMat.frag.glsl';

// Cloud layer configuration
interface CloudLayerConfig {
  radius: number;
  coverage: number;
  density: number;
  scale: number;
  speed: number;
  color: THREE.Color;
  castShadows?: boolean;
}

// Create a shadow-casting cloud layer using standard material
function createShadowCloudLayer(config: CloudLayerConfig & { baseRadius: number }) {
  const { baseRadius, radius, coverage, scale } = config;
  
  // Create geometry
  const geometry = new THREE.SphereGeometry(baseRadius * radius, 64, 48);
  
  // Generate cloud texture procedurally
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Create cloud pattern using gradient circles
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  
  // Add cloud spots
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 30 + 10;
    const opacity = Math.random() * 0.5 + 0.3;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(scale, scale * 0.5);
  
  // Use MeshLambertMaterial for shadow support
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    opacity: coverage,
    depthWrite: false,
    color: config.color
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  
  return {
    mesh,
    update: (time: number) => {
      // Rotate cloud layer
      mesh.rotation.y = time * config.speed;
    }
  };
}

// Create procedural cloud layer (existing shader-based approach)
function createProceduralCloudLayer(config: CloudLayerConfig & { baseRadius: number }) {
  const cloudUniforms = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uTime: { value: 0 },
    uPaused: { value: 0 },
    uCoverage: { value: config.coverage },
    uDensity: { value: config.density },
    uLightWrap: { value: 0.25 },
    uTerminator: { value: 0.35 },
    uDayTint: { value: config.color },
    uNightTint: { value: new THREE.Color(0.5, 0.65, 1.0) },
  };

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: cloudMatVertexShader,
    fragmentShader: cloudMatFragmentShader,
  });

  const cloudRadius = config.baseRadius * config.radius;
  const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 48);
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.userData.isCloud = true;
  
  // Shader materials don't cast shadows by default
  cloudMesh.castShadow = false;
  cloudMesh.receiveShadow = false;

  return { 
    mesh: cloudMesh, 
    uniforms: cloudUniforms, 
    material: cloudMat,
    update: (time: number, lightDir: THREE.Vector3, paused: boolean) => {
      cloudUniforms.uTime.value = time;
      cloudUniforms.uLightDir.value.copy(lightDir);
      cloudUniforms.uPaused.value = paused ? 1 : 0;
    }
  };
}

export interface CloudSystem {
  group: THREE.Group;
  layers: Array<{
    mesh: THREE.Mesh;
    update: (time: number, lightDir?: THREE.Vector3, paused?: boolean) => void;
    uniforms?: any;
  }>;
}

export function createMultiLayerClouds(planetRadius: number): CloudSystem {
  const group = new THREE.Group();
  const layers: CloudSystem['layers'] = [];
  
  // Layer 1: Low altitude cumulus (dense, puffy) - with shadows
  const cumulusLayer = createShadowCloudLayer({
    baseRadius: planetRadius,
    radius: 1.015,  // Low altitude
    coverage: 0.4,
    density: 0.8,
    scale: 8,
    speed: 0.00005,
    color: new THREE.Color(1, 1, 1),
    castShadows: true
  });
  group.add(cumulusLayer.mesh);
  layers.push({
    mesh: cumulusLayer.mesh,
    update: (time) => cumulusLayer.update(time)
  });
  
  // Layer 2: Mid altitude stratus (existing procedural shader) 
  const stratusLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.02,  // Mid altitude (existing height)
    coverage: 0.25,
    density: 1.2,
    scale: 4,
    speed: 0.00015,
    color: new THREE.Color(1, 1, 1)
  });
  group.add(stratusLayer.mesh);
  layers.push({
    mesh: stratusLayer.mesh,
    update: stratusLayer.update,
    uniforms: stratusLayer.uniforms
  });
  
  // Layer 3: High altitude cirrus (wispy, thin)
  const cirrusLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.035,  // High altitude
    coverage: 0.4,  // Higher coverage threshold for wispier clouds
    density: 0.5,   // Lower density for thin clouds
    scale: 2,
    speed: 0.0002,
    color: new THREE.Color(0.95, 0.95, 1.0)  // Slightly bluish
  });
  group.add(cirrusLayer.mesh);
  layers.push({
    mesh: cirrusLayer.mesh,
    update: cirrusLayer.update,
    uniforms: cirrusLayer.uniforms
  });
  
  return {
    group,
    layers
  };
}

// Modified single layer creator for backward compatibility
export function makeProceduralCloudShell({ radius }: { radius: number }) {
  const result = createProceduralCloudLayer({
    baseRadius: radius,
    radius: 1.02,
    coverage: 0.25,
    density: 1.2,
    scale: 4,
    speed: 0.00015,
    color: new THREE.Color(1, 1, 1)
  });
  
  return { 
    mesh: result.mesh, 
    uniforms: result.uniforms, 
    material: result.material 
  };
}