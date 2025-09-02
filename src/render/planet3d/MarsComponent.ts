import * as THREE from 'three';
import { MARS_RADIUS, MARS_COLOR, MARS_ATMOSPHERE_COLOR, ATMOSPHERE_THICKNESS } from './planetUtils';

export function makeMars() {
  const group = new THREE.Group();
  group.name = 'Mars';

  // Mars surface - rusty red with some variation
  const marsGeometry = new THREE.SphereGeometry(MARS_RADIUS, 64, 32);
  
  // Create a simple texture for Mars with rust patterns
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Base rusty red color
  ctx.fillStyle = '#CD5C5C';
  ctx.fillRect(0, 0, 512, 256);
  
  // Add darker regions (like Syrtis Major)
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const width = Math.random() * 100 + 50;
    const height = Math.random() * 50 + 25;
    const opacity = Math.random() * 0.3 + 0.1;
    
    ctx.fillStyle = `rgba(139, 69, 19, ${opacity})`;
    ctx.fillRect(x, y, width, height);
  }
  
  // Add lighter regions (dust/sand)
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const radius = Math.random() * 30 + 10;
    const opacity = Math.random() * 0.2 + 0.1;
    
    ctx.fillStyle = `rgba(255, 160, 122, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add polar ice caps (simplified)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillRect(0, 0, 512, 20);
  ctx.fillRect(0, 236, 512, 20);
  
  const marsTexture = new THREE.CanvasTexture(canvas);
  
  const marsMaterial = new THREE.MeshPhongMaterial({
    map: marsTexture,
    color: MARS_COLOR,
    emissive: 0x331111,
    emissiveIntensity: 0.03,
    shininess: 10,
  });
  
  const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
  marsMesh.castShadow = true;
  marsMesh.receiveShadow = true;
  group.add(marsMesh);
  
  // Mars atmosphere - very thin, reddish
  const atmosphereGeometry = new THREE.SphereGeometry(
    MARS_RADIUS + ATMOSPHERE_THICKNESS * 0.3, // Much thinner atmosphere than Earth
    64,
    32
  );
  
  const atmosphereMaterial = new THREE.MeshPhongMaterial({
    color: MARS_ATMOSPHERE_COLOR,
    transparent: true,
    opacity: 0.08, // Very thin atmosphere
    side: THREE.BackSide,
    depthWrite: false,
  });
  
  const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  group.add(atmosphereMesh);
  
  // Optional: Add Phobos and Deimos (Mars' moons) - simplified as small spheres
  const phobosGeometry = new THREE.SphereGeometry(0.02, 16, 8);
  const phobosMaterial = new THREE.MeshPhongMaterial({
    color: 0x808080,
    emissive: 0x101010,
  });
  const phobosMesh = new THREE.Mesh(phobosGeometry, phobosMaterial);
  phobosMesh.name = 'Phobos';
  // Phobos will be positioned in the main scene file
  
  const deimosGeometry = new THREE.SphereGeometry(0.015, 16, 8);
  const deimosMaterial = new THREE.MeshPhongMaterial({
    color: 0x696969,
    emissive: 0x101010,
  });
  const deimosMesh = new THREE.Mesh(deimosGeometry, deimosMaterial);
  deimosMesh.name = 'Deimos';
  // Deimos will be positioned in the main scene file
  
  return {
    group,
    mesh: marsMesh,
    atmosphere: atmosphereMesh,
    phobos: phobosMesh,
    deimos: deimosMesh,
  };
}