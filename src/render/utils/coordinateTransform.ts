import * as THREE from 'three';

export const PLANET_RADIUS = 500;

/**
 * Convert 2D world coordinates to 3D sphere surface coordinates
 */
export function worldToSphere(
  x: number, 
  y: number, 
  worldWidth: number, 
  worldHeight: number,
  radius: number = PLANET_RADIUS
): THREE.Vector3 {
  // Map to spherical coordinates matching Three.js sphere UV mapping and biome texture
  // X wraps around horizontally (longitude) 0 to 2π
  // Subtract 90 degree rotation to align with texture
  const lon = (x / worldWidth) * Math.PI * 2 - Math.PI / 2; // Rotate -90 degrees
  
  // Y maps to the middle 85% of the texture to match biome texture padding
  // The biome texture has 7.5% padding at top and bottom for poles
  const textureV = 0.075 + (y / worldHeight) * 0.85; // Map to middle 85% of texture
  const lat = (textureV - 0.5) * Math.PI; // Convert to latitude (-π/2 to π/2)
  
  // Convert spherical to Cartesian coordinates
  const cartX = radius * Math.cos(lat) * Math.sin(lon);
  const cartY = radius * Math.sin(lat);
  const cartZ = radius * Math.cos(lat) * Math.cos(lon);
  
  return new THREE.Vector3(cartX, cartY, cartZ);
}

/**
 * Convert multiple 2D positions to sphere surface (batch operation)
 */
export function batchWorldToSphere(
  positions: Float32Array, // x,y pairs
  worldWidth: number,
  worldHeight: number,
  radius: number = PLANET_RADIUS
): Float32Array {
  const count = positions.length / 2;
  const output = new Float32Array(count * 3); // x,y,z triplets
  
  for (let i = 0; i < count; i++) {
    const x = positions[i * 2];
    const y = positions[i * 2 + 1];
    
    // Match Three.js sphere UV mapping and biome texture padding
    // Subtract 90 degree rotation to align with texture
    const lon = (x / worldWidth) * Math.PI * 2 - Math.PI / 2; // Rotate -90 degrees
    // Map Y to account for pole padding in texture (7.5% top, 85% middle, 7.5% bottom)
    const textureV = 0.075 + (y / worldHeight) * 0.85; // Map to middle 85% of texture
    const lat = (textureV - 0.5) * Math.PI; // Convert to latitude (-π/2 to π/2)
    
    output[i * 3] = radius * Math.cos(lat) * Math.sin(lon);
    output[i * 3 + 1] = radius * Math.sin(lat);
    output[i * 3 + 2] = radius * Math.cos(lat) * Math.cos(lon);
  }
  
  return output;
}

/**
 * Get normal vector at a point on the sphere
 */
export function getSphereNormal(position: THREE.Vector3): THREE.Vector3 {
  return position.clone().normalize();
}

/**
 * Wrap coordinates for edge handling in 2D space
 */
export function wrapCoordinates(
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number
): { x: number; y: number } {
  // Horizontal wrapping
  let wrappedX = x % worldWidth;
  if (wrappedX < 0) wrappedX += worldWidth;
  
  // Vertical clamping (no wrapping at poles)
  const clampedY = Math.max(0, Math.min(worldHeight - 1, y));
  
  return { x: wrappedX, y: clampedY };
}