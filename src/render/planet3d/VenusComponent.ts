import * as THREE from 'three';
import { VENUS_RADIUS, VENUS_COLOR, VENUS_ATMOSPHERE_COLOR, ATMOSPHERE_THICKNESS } from './planetUtils';

export function makeVenus() {
  const group = new THREE.Group();
  group.name = 'Venus';

  // Venus surface - yellowish/cream colored
  const venusGeometry = new THREE.SphereGeometry(VENUS_RADIUS, 64, 32);
  
  // Create a simple texture for Venus with cloud bands
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Create cloudy bands pattern
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#FFE4B5');
  gradient.addColorStop(0.2, '#FFDEAD');
  gradient.addColorStop(0.4, '#FFE4B5');
  gradient.addColorStop(0.6, '#F5DEB3');
  gradient.addColorStop(0.8, '#FFDEAD');
  gradient.addColorStop(1, '#FFE4B5');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 256);
  
  // Add some noise/clouds
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const radius = Math.random() * 20 + 5;
    const opacity = Math.random() * 0.1 + 0.05;
    
    ctx.fillStyle = `rgba(255, 255, 240, ${opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const venusTexture = new THREE.CanvasTexture(canvas);
  
  const venusMaterial = new THREE.MeshPhongMaterial({
    map: venusTexture,
    color: VENUS_COLOR,
    emissive: 0x332200,
    emissiveIntensity: 0.05,
    shininess: 20,
  });
  
  const venusMesh = new THREE.Mesh(venusGeometry, venusMaterial);
  venusMesh.castShadow = true;
  venusMesh.receiveShadow = true;
  group.add(venusMesh);
  
  // Venus atmosphere - thick, yellowish
  const atmosphereGeometry = new THREE.SphereGeometry(
    VENUS_RADIUS + ATMOSPHERE_THICKNESS * 1.5, // Thicker atmosphere than Earth
    64,
    32
  );
  
  const atmosphereMaterial = new THREE.MeshPhongMaterial({
    color: VENUS_ATMOSPHERE_COLOR,
    transparent: true,
    opacity: 0.3, // Thicker atmosphere
    side: THREE.BackSide,
    depthWrite: false,
  });
  
  const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  group.add(atmosphereMesh);
  
  return {
    group,
    mesh: venusMesh,
    atmosphere: atmosphereMesh,
  };
}