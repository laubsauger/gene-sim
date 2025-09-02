import * as THREE from 'three';
import { PLANET_RADIUS, ENTITY_ALTITUDE } from './planetUtils';
import entityMatVertexShader from './shader/entityMat.vertex.glsl'
import entityMatFragmentShader from './shader/entityMat.frag.glsl'

// Track frame count for update throttling
let frameCount = 0;
let aliveCount = 0;
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// Cache for tracking which entities need updates
const prevAlive = new Uint8Array(196000);
const aliveIndices = new Uint32Array(196000);

// Reusable objects to avoid allocation
const mat4 = new THREE.Matrix4();
const scaleVec = new THREE.Vector3();

export function updateEntitiesFromBuffers(
  mesh: THREE.InstancedMesh,
  pos: Float32Array,
  color: Uint8Array,
  alive: Uint8Array,
  count: number,
  worldWidth: number,
  worldHeight: number
) {
  frameCount++;
  
  // Update every 5 frames for better performance
  const doFullUpdate = frameCount % 5 === 0;
  
  if (!doFullUpdate) {
    return;
  }
  
  const planetRadius = PLANET_RADIUS;
  const altitude = planetRadius + ENTITY_ALTITUDE;
  const scale = 0.01;
  scaleVec.set(scale, scale, scale);
  
  // Pre-calculate constants
  const lonScale = Math.PI * 2 / worldWidth;
  const lonOffset = -Math.PI;
  const latRange = Math.PI * 0.85;
  const latScale = latRange / worldHeight;
  
  // First pass: collect alive entities and update birth/death transitions
  let newAliveCount = 0;
  let updateCount = 0;
  
  for (let i = 0; i < count; i++) {
    const isAlive = alive[i] > 0;
    const wasAlive = prevAlive[i] > 0;
    
    if (isAlive) {
      aliveIndices[newAliveCount++] = i;
    }
    
    // Only update if state changed
    if (isAlive !== wasAlive) {
      if (!isAlive) {
        // Entity died - hide it
        mesh.setMatrixAt(i, hiddenMatrix);
        updateCount++;
      }
      prevAlive[i] = alive[i];
    }
  }
  
  // Second pass: only update alive entities' positions
  // Limit updates per frame to prevent performance issues
  const maxUpdatesPerFrame = Math.min(newAliveCount, 5000);
  
  for (let j = 0; j < maxUpdatesPerFrame; j++) {
    const i = aliveIndices[j];
    
    const x = pos[i * 2];
    const y = pos[i * 2 + 1];
    
    // Simplified calculations
    const lon = x * lonScale + lonOffset;
    const lat = (0.5 - y / worldHeight) * latRange;
    
    // Direct calculation without intermediate vector
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const sinLon = Math.sin(lon);
    const cosLon = Math.cos(lon);
    
    mat4.makeTranslation(
      altitude * cosLat * sinLon,
      altitude * sinLat,
      altitude * cosLat * cosLon
    );
    mat4.scale(scaleVec);
    mesh.setMatrixAt(i, mat4);
    
    updateCount++;
  }
  
  // Update the color attribute directly from SharedArrayBuffer
  // This happens less frequently as colors don't change often
  if (frameCount % 30 === 0) {
    const colorAttribute = (mesh as any).colorAttribute;
    if (colorAttribute) {
      colorAttribute.needsUpdate = true;
    }
  }
  
  // Update alive count without logging
  aliveCount = newAliveCount;
  
  // Only flag update if we actually changed something
  if (updateCount > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    // Also update the custom color attribute
    const colorAttribute = (mesh as any).colorAttribute;
    if (colorAttribute) {
      colorAttribute.needsUpdate = true;
    }
  }
}

export function makeGroundEntities(count: number, colorBuffer?: Uint8Array): THREE.InstancedMesh {
  // Use even simpler geometry - tetrahedron is the simplest 3D shape
  const geo = new THREE.TetrahedronGeometry(1, 0); // 0 detail level = 4 faces only

  // Shader with lighting similar to clouds
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: entityMatVertexShader,
    fragmentShader: entityMatFragmentShader,
    transparent: false,
    depthWrite: false,
    depthTest: true
  });
  
  // Use the SharedArrayBuffer color data directly if provided
  let colorAttribute;
  if (colorBuffer) {
    // Use the Uint8Array directly with normalization (like 2D renderer)
    colorAttribute = new THREE.InstancedBufferAttribute(colorBuffer, 3, true); // true = normalized
  } else {
    // Fallback for initialization
    const colors = new Uint8Array(count * 3);
    colorAttribute = new THREE.InstancedBufferAttribute(colors, 3, true);
  }
  geo.setAttribute('customColor', colorAttribute);
  
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false; // Don't cull
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = 0; // Same as planet
  
  // Store reference for updates
  (mesh as any).colorAttribute = colorAttribute;
  
  // Entity mesh initialized with custom shader
  
  // Initialize all as hidden
  const hiddenMat = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, hiddenMat);
  }
  mesh.instanceMatrix.needsUpdate = true;
  
  // Also initialize prevAlive to match
  prevAlive.fill(0);
  
  return mesh;
}