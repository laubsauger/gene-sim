import * as THREE from 'three';
import { PLANET_RADIUS, ENTITY_ALTITUDE } from './planetUtils';

// Track frame count for update throttling
let frameCount = 0;
let aliveCount = 0;
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

// Cache for tracking which entities need updates
const prevAlive = new Uint8Array(196000);
const aliveIndices = new Uint32Array(196000);

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
  
  // Update every 2 frames instead of 3 for better responsiveness
  const doFullUpdate = frameCount % 2 === 0;
  
  if (!doFullUpdate) {
    return;
  }
  
  const mat4 = new THREE.Matrix4();
  const planetRadius = PLANET_RADIUS;
  const altitude = planetRadius + ENTITY_ALTITUDE;
  const scale = 0.01;
  const scaleVec = new THREE.Vector3(scale, scale, scale);
  
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
  
  // Second pass: only update alive entities' positions and colors
  const colorAttribute = (mesh as any).colorAttribute;
  const colorArray = colorAttribute?.array as Float32Array;
  
  for (let j = 0; j < newAliveCount; j++) {
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
    
    // Update colors directly in the custom attribute buffer
    if (colorArray) {
      const r = color[i * 3] / 255;
      const g = color[i * 3 + 1] / 255;
      const b = color[i * 3 + 2] / 255;
      
      colorArray[i * 3] = r;
      colorArray[i * 3 + 1] = g;
      colorArray[i * 3 + 2] = b;
      
      if (j < 3 && frameCount % 60 === 0) {
        console.log(`Entity ${i}: RGB(${r.toFixed(2)}, ${g.toFixed(2)}, ${b.toFixed(2)})`);
      }
    }
    
    updateCount++;
  }
  
  // Only log significant changes
  if (Math.abs(newAliveCount - aliveCount) > count * 0.01) {
    console.log(`Entities alive: ${newAliveCount} / ${count} (updated ${updateCount} matrices)`);
    aliveCount = newAliveCount;
  }
  
  // Only flag update if we actually changed something
  if (updateCount > 0) {
    mesh.instanceMatrix.needsUpdate = true;
    // Also update the custom color attribute
    if (colorAttribute) {
      colorAttribute.needsUpdate = true;
    }
  }
}

export function makeGroundEntities(count: number): THREE.InstancedMesh {
  // Use even simpler geometry - tetrahedron is the simplest 3D shape
  const geo = new THREE.TetrahedronGeometry(1, 0); // 0 detail level = 4 faces only
  
  // Create a custom shader that manually reads an attribute like EntityPoints3D does
  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec3 customColor;
      varying vec3 vColor;
      
      void main() {
        vColor = customColor;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      
      void main() {
        gl_FragColor = vec4(vColor, 1.0);
      }
    `
  });
  
  // Create custom color attribute
  const colors = new Float32Array(count * 3);
  const colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
  geo.setAttribute('customColor', colorAttribute);
  
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  
  // Store reference for updates
  (mesh as any).colorAttribute = colorAttribute;
  
  console.log('Initialized entity mesh with custom shader and color attribute');
  
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