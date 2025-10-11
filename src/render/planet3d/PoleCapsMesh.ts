import * as THREE from 'three';
import { PLANET_RADIUS } from './planetUtils';
import poleCapVertexShader from './shader/poleCap.vert.glsl?raw';
import poleCapFragmentShader from './shader/poleCap.frag.glsl?raw';

/**
 * Creates pole cap meshes to cover the unused polar regions
 * Since entities avoid the poles (using only 85% of latitude range),
 * we add visual pole caps to match
 */
export function createPoleCaps(radius: number = PLANET_RADIUS): THREE.Group {
  const group = new THREE.Group();

  // Create geometry for pole caps
  // Using sphere geometry with carefully chosen phi angles
  const capAngle = Math.PI * 0.075; // 7.5% of sphere for each cap
  
  // North pole cap
  const northCapGeo = new THREE.SphereGeometry(
    radius * 1.005, // Slightly larger to avoid z-fighting
    64, 
    32,
    0, // phiStart
    Math.PI * 2, // phiLength (full circle)
    0, // thetaStart (from north pole)
    capAngle // thetaLength
  );
  
  // South pole cap
  const southCapGeo = new THREE.SphereGeometry(
    radius * 1.005,
    64,
    32,
    0,
    Math.PI * 2,
    Math.PI - capAngle, // Start from near south pole
    capAngle
  );
  
  // Create ice texture for more realistic appearance
  const iceTexture = createIceTexture();

  // Use custom shader material to match terrain lighting
  const poleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uIceTexture: { value: iceTexture },
      uLightDir: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() }
    },
    vertexShader: poleCapVertexShader,
    fragmentShader: poleCapFragmentShader,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true
  });
  
  // Create meshes
  const northCap = new THREE.Mesh(northCapGeo, poleMaterial);
  const southCap = new THREE.Mesh(southCapGeo, poleMaterial);
  
  // Don't cast shadows (they're part of the planet surface)
  // but do receive shadows for proper day/night cycle
  northCap.castShadow = false;
  northCap.receiveShadow = true;
  southCap.castShadow = false;
  southCap.receiveShadow = true;
  
  group.add(northCap);
  group.add(southCap);

  // Store material reference for light updates
  (group as any).poleMaterial = poleMaterial;

  return group;
}

/**
 * Creates a realistic ice cap texture with variation
 */
function createIceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base ice color - bright white with blue tint
  ctx.fillStyle = '#f5f8ff';
  ctx.fillRect(0, 0, 1024, 1024);

  // Add multiple layers of noise for ice texture detail
  const imageData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imageData.data;

  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const idx = (y * 1024 + x) * 4;

      // Multi-scale noise for ice detail
      const noise1 = (Math.sin(x * 0.02) * Math.cos(y * 0.02)) * 0.5 + 0.5;
      const noise2 = (Math.sin(x * 0.1 + noise1 * 10) * Math.cos(y * 0.1)) * 0.3 + 0.5;
      const noise3 = (Math.random() - 0.5) * 0.15; // Fine grain

      const combined = noise1 * 0.4 + noise2 * 0.4 + noise3 * 0.2;

      // Apply to RGB channels with blue-white tint
      data[idx] = Math.min(255, Math.max(240, 245 + combined * 20));     // R - high
      data[idx + 1] = Math.min(255, Math.max(245, 248 + combined * 15)); // G - higher
      data[idx + 2] = Math.min(255, 255);                                 // B - max (blue tint)
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Updates pole cap lighting based on sun direction
 */
export function updatePoleCaps(
  poleCaps: THREE.Group,
  sunDirection: THREE.Vector3,
  _isDaytime: boolean
) {
  // Update the shader material light direction
  const material = (poleCaps as any).poleMaterial as THREE.ShaderMaterial;
  if (material && material.uniforms && material.uniforms.uLightDir) {
    material.uniforms.uLightDir.value.copy(sunDirection);
  }
}