import * as THREE from 'three';
import { MOON_RADIUS, MOON_COLOR, MOON_EMISSIVE, MOON_ORBIT_RADIUS, MOON_ORBIT_SPEED } from './planetUtils';

// Create procedural crater texture with proper spherical mapping
function createMoonTextures() {
  const width = 1024;  // Width for equirectangular projection
  const height = 512;  // Height is half for proper sphere mapping
  
  // Create color texture with crater patterns
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const colorCtx = colorCanvas.getContext('2d')!;
  
  // Base moon color - slightly varied gray
  const gradient = colorCtx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#d0d0d0');
  gradient.addColorStop(0.5, '#c8c8c8');
  gradient.addColorStop(1, '#c0c0c0');
  colorCtx.fillStyle = gradient;
  colorCtx.fillRect(0, 0, width, height);
  
  // Add larger scale noise patterns for regions
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 100 + 50;
    const brightness = 160 + Math.random() * 60;
    
    const noiseGradient = colorCtx.createRadialGradient(x, y, 0, x, y, radius);
    noiseGradient.addColorStop(0, `rgba(${brightness}, ${brightness}, ${brightness}, 0.3)`);
    noiseGradient.addColorStop(1, `rgba(${brightness}, ${brightness}, ${brightness}, 0)`);
    
    colorCtx.fillStyle = noiseGradient;
    colorCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  
  // Add fine noise for surface texture
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const brightness = 140 + Math.random() * 80;
    const size = Math.random() * 2 + 1;
    const alpha = Math.random() * 0.4 + 0.1;
    colorCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${alpha})`;
    colorCtx.fillRect(x, y, size, size);
  }
  
  // Add some streak patterns for geological features
  for (let i = 0; i < 30; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = x1 + (Math.random() - 0.5) * 200;
    const y2 = y1 + (Math.random() - 0.5) * 100;
    
    const streakGradient = colorCtx.createLinearGradient(x1, y1, x2, y2);
    const brightness = 150 + Math.random() * 50;
    streakGradient.addColorStop(0, `rgba(${brightness}, ${brightness}, ${brightness}, 0)`);
    streakGradient.addColorStop(0.5, `rgba(${brightness}, ${brightness}, ${brightness}, 0.2)`);
    streakGradient.addColorStop(1, `rgba(${brightness}, ${brightness}, ${brightness}, 0)`);
    
    colorCtx.strokeStyle = streakGradient;
    colorCtx.lineWidth = Math.random() * 3 + 1;
    colorCtx.beginPath();
    colorCtx.moveTo(x1, y1);
    colorCtx.quadraticCurveTo((x1 + x2) / 2 + Math.random() * 50 - 25, (y1 + y2) / 2 + Math.random() * 50 - 25, x2, y2);
    colorCtx.stroke();
  }
  
  // Add lunar maria (dark patches) - distributed across the sphere
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    
    // Adjust radius based on latitude to account for spherical distortion
    const latitude = (y / height - 0.5) * Math.PI;
    const distortionFactor = Math.cos(latitude);
    const baseRadius = Math.random() * 80 + 30;
    const radiusX = baseRadius;
    const radiusY = baseRadius * distortionFactor;
    
    const mariaGradient = colorCtx.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY));
    mariaGradient.addColorStop(0, 'rgba(60, 60, 70, 0.4)');
    mariaGradient.addColorStop(0.5, 'rgba(70, 70, 80, 0.3)');
    mariaGradient.addColorStop(1, 'rgba(80, 80, 90, 0)');
    
    colorCtx.fillStyle = mariaGradient;
    colorCtx.save();
    colorCtx.translate(x, y);
    colorCtx.scale(1, radiusY / radiusX);
    colorCtx.beginPath();
    colorCtx.arc(0, 0, radiusX, 0, Math.PI * 2);
    colorCtx.fill();
    colorCtx.restore();
  }
  
  // Create bump map for craters
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  
  // Base height
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, width, height);
  
  // Add craters of various sizes
  const craterCount = 80;
  for (let i = 0; i < craterCount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    
    // Adjust crater shape for spherical mapping
    const latitude = (y / height - 0.5) * Math.PI;
    const distortionFactor = Math.cos(latitude);
    const baseRadius = Math.random() * 40 + 8;
    const radiusX = baseRadius;
    const radiusY = baseRadius * Math.max(0.3, distortionFactor); // Prevent too much distortion
    
    // Crater rim (raised) - account for distortion
    const maxRadius = Math.max(radiusX, radiusY);
    const rimGradient = bumpCtx.createRadialGradient(x, y, maxRadius * 0.7, x, y, maxRadius);
    rimGradient.addColorStop(0, '#404040'); // Deep crater center
    rimGradient.addColorStop(0.7, '#606060'); // Crater floor
    rimGradient.addColorStop(0.85, '#a0a0a0'); // Rim peak
    rimGradient.addColorStop(1, '#808080'); // Back to surface level
    
    bumpCtx.fillStyle = rimGradient;
    bumpCtx.save();
    bumpCtx.translate(x, y);
    bumpCtx.scale(1, radiusY / radiusX);
    bumpCtx.beginPath();
    bumpCtx.arc(0, 0, radiusX, 0, Math.PI * 2);
    bumpCtx.fill();
    bumpCtx.restore();
    
    // Darken the crater in color map
    colorCtx.fillStyle = `rgba(0, 0, 0, ${0.1 + Math.random() * 0.2})`;
    colorCtx.save();
    colorCtx.translate(x, y);
    colorCtx.scale(1, radiusY / radiusX);
    colorCtx.beginPath();
    colorCtx.arc(0, 0, radiusX * 0.8, 0, Math.PI * 2);
    colorCtx.fill();
    colorCtx.restore();
  }
  
  // Add smaller craters for detail
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 8 + 2;
    
    // Simple dark spots for small craters
    bumpCtx.fillStyle = '#505050';
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, radius, 0, Math.PI * 2);
    bumpCtx.fill();
    
    colorCtx.fillStyle = `rgba(0, 0, 0, 0.2)`;
    colorCtx.beginPath();
    colorCtx.arc(x, y, radius, 0, Math.PI * 2);
    colorCtx.fill();
  }
  
  // Convert to textures - use ClampToEdgeWrapping to avoid tiling
  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.wrapS = THREE.ClampToEdgeWrapping;
  colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.ClampToEdgeWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  
  return { colorTexture, bumpTexture };
}

export function makeMoon(planetRadius: number) {
  const group = new THREE.Group();
  const moonRadius = planetRadius * MOON_RADIUS;
  
  // Create textures for the moon
  const { colorTexture, bumpTexture } = createMoonTextures();
  
  // Moon material with textures and bump mapping
  const moonMat = new THREE.MeshStandardMaterial({
    map: colorTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.08, // Increased bump effect for more visible craters
    color: 0xffffff, // White to let texture show through
    emissive: MOON_EMISSIVE,
    emissiveIntensity: 0.03,
    roughness: 0.98, // Very rough surface
    metalness: 0.05, // Tiny bit of metalness for subtle highlights
    // CRITICAL: These ensure moon stays in opaque queue
    transparent: false,
    opacity: 1.0,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });

  // Moon geometry - higher resolution for better detail
  const moonGeo = new THREE.SphereGeometry(moonRadius, 64, 48);
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.castShadow = true;
  moonMesh.receiveShadow = true;
  
  // Position moon at orbit radius
  moonMesh.position.set(planetRadius * MOON_ORBIT_RADIUS, 0, 0);
  
  group.add(moonMesh);
  
  return {
    group,
    mesh: moonMesh,
    material: moonMat,
    update: (time: number) => {
      // Orbit around planet
      group.rotation.y = time * MOON_ORBIT_SPEED;
      // Moon's own rotation (tidally locked would be same speed as orbit)
      moonMesh.rotation.y = time * MOON_ORBIT_SPEED;
    }
  };
}