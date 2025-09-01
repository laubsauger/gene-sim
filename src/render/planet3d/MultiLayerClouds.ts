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
  
  // Generate cloud texture procedurally with organic patterns
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  // Start with gray background
  ctx.fillStyle = 'rgb(50, 50, 50)';
  ctx.fillRect(0, 0, size, size);
  
  // Create cloud patterns using overlapping ellipses and varied shapes
  // Layer 1: Large cloud formations
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const width = Math.random() * 120 + 60;
    const height = Math.random() * 80 + 40;
    const rotation = Math.random() * Math.PI;
    const opacity = Math.random() * 0.3 + 0.1;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(0.4, `rgba(255, 255, 255, ${opacity * 0.6})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-width, -height, width * 2, height * 2);
    ctx.restore();
  }
  
  // Layer 2: Medium cloud wisps
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const width = Math.random() * 60 + 20;
    const height = Math.random() * 40 + 15;
    const rotation = Math.random() * Math.PI;
    const opacity = Math.random() * 0.25 + 0.15;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    // Use elliptical shapes for more natural clouds
    ctx.beginPath();
    ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${opacity * 0.4})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }
  
  // Apply subtle blur to blend
  ctx.filter = 'blur(4px)';
  ctx.drawImage(canvas, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(scale * 0.5, scale * 0.35); // Moderate repetition
  
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
      // Rotate cloud layer and animate texture
      mesh.rotation.y = time * config.speed;
      // Animate texture offset for cloud movement
      texture.offset.x = time * config.speed * 2;
      texture.offset.y = time * config.speed * 0.5;
    }
  };
}

// Create procedural cloud layer (existing shader-based approach)
function createProceduralCloudLayer(config: CloudLayerConfig & { baseRadius: number }) {
  // Start with random time offset for immediate cloud variety
  const initialTimeOffset = Math.random() * 1000;
  
  const cloudUniforms = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uTime: { value: initialTimeOffset },  // Start with offset for immediate clouds
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
      cloudUniforms.uTime.value = initialTimeOffset + time;  // Keep offset
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
  
  // Layer 1: Low altitude cumulus - now using procedural instead of texture
  // Removed shadow-casting texture layer due to tiling issues
  const cumulusLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.01,  // Very low altitude
    coverage: 0.3,  // Denser for low clouds
    density: 0.9,   // Slightly lower density for visibility
    scale: 3.5,
    speed: 0.0003,  // Faster movement
    color: new THREE.Color(0.95, 0.95, 0.95)  // Slightly darker for contrast
  });
  // Start with some initial rotation for immediate coverage
  cumulusLayer.mesh.rotation.y = Math.random() * Math.PI * 2;
  group.add(cumulusLayer.mesh);
  layers.push({
    mesh: cumulusLayer.mesh,
    update: cumulusLayer.update,
    uniforms: cumulusLayer.uniforms
  });
  
  // Layer 2: Mid altitude stratus (main procedural layer) 
  const stratusLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.02,  // Mid altitude - more separation from layer 1
    coverage: 0.2,  // Lower threshold for more coverage
    density: 0.8,   // Slightly transparent
    scale: 5,       // Different scale for variety
    speed: 0.00035,  // Faster movement
    color: new THREE.Color(1, 1, 1)
  });
  // Different initial rotation for variety
  stratusLayer.mesh.rotation.y = Math.random() * Math.PI * 2;
  stratusLayer.mesh.rotation.x = Math.PI * 0.05; // Slight tilt
  group.add(stratusLayer.mesh);
  layers.push({
    mesh: stratusLayer.mesh,
    update: stratusLayer.update,
    uniforms: stratusLayer.uniforms
  });
  
  // Layer 3: Jet stream layer (fast moving, streaky)
  const jetStreamLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.03,  // Higher altitude - more separation
    coverage: 0.5,  // High threshold for streaky appearance
    density: 0.4,   // Low density for wispy streaks
    scale: 2.2,     // Different scale
    speed: 0.0008,  // Very fast movement for jet stream
    color: new THREE.Color(0.98, 0.98, 1.0)
  });
  // Rotate jet stream layer to different angle with initial position
  jetStreamLayer.mesh.rotation.x = Math.PI * 0.1; // Slight tilt
  jetStreamLayer.mesh.rotation.y = Math.random() * Math.PI * 2; // Random start
  jetStreamLayer.mesh.rotation.z = Math.PI * 0.03; // Additional tilt for variety
  group.add(jetStreamLayer.mesh);
  layers.push({
    mesh: jetStreamLayer.mesh,
    update: (time: number, lightDir?: THREE.Vector3, paused?: boolean) => {
      jetStreamLayer.update(time, lightDir, paused);
      // Add counter-rotation for jet stream effect
      jetStreamLayer.mesh.rotation.y = -time * 0.00008;
    },
    uniforms: jetStreamLayer.uniforms
  });
  
  // Layer 4: High altitude cirrus (wispy, ice crystals)
  const cirrusLayer = createProceduralCloudLayer({
    baseRadius: planetRadius,
    radius: 1.045,  // Highest altitude - more separation
    coverage: 0.55,  // Higher coverage threshold for wispier clouds
    density: 0.2,    // Very low density
    scale: 3.0,      // Different scale again
    speed: 0.0005,  // Faster movement
    color: new THREE.Color(0.92, 0.92, 1.0)  // More bluish tint for altitude
  });
  // Initial rotation for immediate coverage
  cirrusLayer.mesh.rotation.y = Math.random() * Math.PI * 2;
  cirrusLayer.mesh.rotation.x = -Math.PI * 0.08; // Opposite tilt from jet stream
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