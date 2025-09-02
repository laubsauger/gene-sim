import * as THREE from 'three';
import { PLANET_RADIUS } from './planetUtils';

/**
 * Creates pole cap meshes to cover the unused polar regions
 * Since entities avoid the poles (using only 85% of latitude range),
 * we add visual pole caps to match
 */
export function createPoleCaps(radius: number = PLANET_RADIUS): THREE.Group {
  const group = new THREE.Group();
  
  // Calculate the latitude cutoff (85% of π/2 = 0.425π)
  const latCutoff = Math.PI * 0.425; // 85% of hemisphere
  
  // Create geometry for pole caps
  // Using sphere geometry with carefully chosen phi angles
  const capAngle = Math.PI * 0.075; // 7.5% of sphere for each cap
  
  // North pole cap
  const northCapGeo = new THREE.SphereGeometry(
    radius * 1.0001, // Slightly larger to avoid z-fighting
    64, 
    32,
    0, // phiStart
    Math.PI * 2, // phiLength (full circle)
    0, // thetaStart (from north pole)
    capAngle // thetaLength
  );
  
  // South pole cap
  const southCapGeo = new THREE.SphereGeometry(
    radius * 1.0001,
    64,
    32,
    0,
    Math.PI * 2,
    Math.PI - capAngle, // Start from near south pole
    capAngle
  );
  
  // Ice cap material with white/light blue appearance
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xf0f8ff), // Ice white with slight blue tint
    roughness: 0.4,
    metalness: 0.05,
    emissive: new THREE.Color(0xe8f4ff), // Slight blue-white glow
    emissiveIntensity: 0.15,
  });
  
  // Create meshes
  const northCap = new THREE.Mesh(northCapGeo, poleMaterial);
  const southCap = new THREE.Mesh(southCapGeo, poleMaterial);
  
  northCap.castShadow = true;
  northCap.receiveShadow = true;
  southCap.castShadow = true;
  southCap.receiveShadow = true;
  
  group.add(northCap);
  group.add(southCap);
  
  return group;
}

/**
 * Creates a more realistic ice cap texture
 */
function createIceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Create gradient for ice variation
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, '#ffffff');     // Pure white at center
  gradient.addColorStop(0.3, '#f8fcff');   // Very light blue-white
  gradient.addColorStop(0.6, '#e8f4ff');   // Light ice blue
  gradient.addColorStop(0.85, '#d0e8ff');  // Slightly darker ice blue
  gradient.addColorStop(1, '#c0dfff');     // Ice blue at edges
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  
  // Add some noise/texture for realism
  const imageData = ctx.getImageData(0, 0, 512, 512);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
  }
  ctx.putImageData(imageData, 0, 0);
  
  return new THREE.CanvasTexture(canvas);
}

/**
 * Updates pole cap colors based on lighting/time of day
 */
export function updatePoleCaps(
  poleCaps: THREE.Group,
  sunDirection: THREE.Vector3,
  isDaytime: boolean
) {
  poleCaps.children.forEach((cap) => {
    if (cap instanceof THREE.Mesh && cap.material instanceof THREE.MeshStandardMaterial) {
      // Adjust emissive based on day/night - ice glows slightly in darkness
      const emissiveIntensity = isDaytime ? 0.05 : 0.15;
      cap.material.emissiveIntensity = emissiveIntensity;
      
      // Could add more dynamic effects here (aurora, ice glow, etc.)
    }
  });
}