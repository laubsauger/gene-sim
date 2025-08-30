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
  // Map to spherical coordinates (longitude and latitude)
  // X wraps around horizontally (longitude)
  const lon = (x / worldWidth) * Math.PI * 2 - Math.PI; // -π to π
  
  // Y maps to latitude, but we'll adjust the range to avoid singularities at poles
  // Using 85% of the latitude range to keep entities away from poles
  const latRange = Math.PI * 0.85;
  const lat = (y / worldHeight) * latRange - latRange / 2;
  
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
    
    const lon = (x / worldWidth) * Math.PI * 2 - Math.PI;
    const latRange = Math.PI * 0.85;
    const lat = (y / worldHeight) * latRange - latRange / 2;
    
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