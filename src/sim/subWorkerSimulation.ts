/**
 * Simplified simulation logic for sub-workers in multi-worker mode
 * Implements the core game mechanics without the full complexity
 */

import { createSpatialHash } from './spatialHash';

const G = 9; // Number of genes
const VISCOSITY = 0.5;

export interface SubWorkerUpdate {
  posBuffer: Float32Array;
  colorBuffer: Uint8Array;
  aliveBuffer: Uint8Array;
  energyBuffer: Float32Array | null;
  genesBuffer: Float32Array | null;
  foodBuffer: Uint8Array | null;
  entityCount: number;
  entityStart: number;
  entityEnd: number;
  world: { width: number; height: number };
  speedMul: number;
  dt: number;
  foodCols: number;
  foodRows: number;
}

/**
 * Update entities for a sub-worker
 */
export function updateSubWorkerEntities(params: SubWorkerUpdate): void {
  const {
    posBuffer,
    colorBuffer,
    aliveBuffer,
    energyBuffer,
    genesBuffer,
    foodBuffer,
    entityCount,
    world,
    speedMul,
    dt,
    foodCols,
    foodRows
  } = params;
  
  // Build spatial hash for this worker's entities
  const { getCellMembers, addToCell } = createSpatialHash(80, world.width, world.height);
  
  // Add alive entities to spatial hash
  for (let i = 0; i < entityCount; i++) {
    if (aliveBuffer[i]) {
      addToCell(posBuffer[i * 2], posBuffer[i * 2 + 1], i);
    }
  }
  
  // Update each entity
  for (let i = 0; i < entityCount; i++) {
    if (!aliveBuffer[i]) continue;
    
    const px = posBuffer[i * 2];
    const py = posBuffer[i * 2 + 1];
    
    // Get genes if available
    let speed = 50;
    let vision = 50;
    let metabolism = 0.1;
    let aggression = 0.5;
    let cohesion = 0.5;
    let diet = 0;
    
    if (genesBuffer) {
      const base = i * G;
      speed = genesBuffer[base] || 50;
      vision = genesBuffer[base + 1] || 50;
      metabolism = genesBuffer[base + 2] || 0.1;
      aggression = genesBuffer[base + 4] || 0.5;
      cohesion = genesBuffer[base + 5] || 0.5;
      diet = genesBuffer[base + 6] || 0;
    }
    
    // Simple movement forces
    let fx = 0, fy = 0;
    
    // Get nearby entities for flocking
    const neighbors = getCellMembers(px, py, vision);
    let flockX = 0, flockY = 0, flockCount = 0;
    let avoidX = 0, avoidY = 0;
    
    for (const j of neighbors) {
      if (i === j || !aliveBuffer[j]) continue;
      
      const dx = posBuffer[j * 2] - px;
      const dy = posBuffer[j * 2 + 1] - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > vision || dist < 0.1) continue;
      
      // Simple flocking
      flockX += posBuffer[j * 2];
      flockY += posBuffer[j * 2 + 1];
      flockCount++;
      
      // Separation
      if (dist < 20) {
        avoidX -= dx / dist;
        avoidY -= dy / dist;
      }
    }
    
    // Apply flocking forces
    if (flockCount > 0) {
      flockX /= flockCount;
      flockY /= flockCount;
      const dx = flockX - px;
      const dy = flockY - py;
      fx += dx * cohesion * 0.1;
      fy += dy * cohesion * 0.1;
    }
    
    // Apply separation
    fx += avoidX * 2;
    fy += avoidY * 2;
    
    // Random wandering
    fx += (Math.random() - 0.5) * 0.5;
    fy += (Math.random() - 0.5) * 0.5;
    
    // Update velocity
    let vx = (Math.random() - 0.5) * speed * 0.1;
    let vy = (Math.random() - 0.5) * speed * 0.1;
    
    vx += fx * dt * speedMul;
    vy += fy * dt * speedMul;
    
    // Apply viscosity
    vx *= (1 - VISCOSITY * dt);
    vy *= (1 - VISCOSITY * dt);
    
    // Limit speed
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    if (currentSpeed > speed) {
      vx = (vx / currentSpeed) * speed;
      vy = (vy / currentSpeed) * speed;
    }
    
    // Update position
    posBuffer[i * 2] += vx * dt * speedMul;
    posBuffer[i * 2 + 1] += vy * dt * speedMul;
    
    // World wrapping
    if (posBuffer[i * 2] < 0) posBuffer[i * 2] += world.width;
    if (posBuffer[i * 2] >= world.width) posBuffer[i * 2] -= world.width;
    if (posBuffer[i * 2 + 1] < 0) posBuffer[i * 2 + 1] += world.height;
    if (posBuffer[i * 2 + 1] >= world.height) posBuffer[i * 2 + 1] -= world.height;
    
    // Food consumption if available
    if (foodBuffer && energyBuffer) {
      const gridX = Math.floor((px / world.width) * foodCols);
      const gridY = Math.floor((py / world.height) * foodRows);
      const foodIdx = gridY * foodCols + gridX;
      
      if (foodIdx >= 0 && foodIdx < foodBuffer.length) {
        const herbivoreLevel = Math.max(0, -diet);
        const foodValue = foodBuffer[foodIdx] / 255; // Convert from uint8
        
        if (herbivoreLevel > 0.2 && foodValue > 0.1) {
          const eatAmount = Math.min(0.1 * herbivoreLevel * dt, foodValue);
          foodBuffer[foodIdx] = Math.floor(Math.max(0, (foodValue - eatAmount)) * 255);
          energyBuffer[i] = Math.min(energyBuffer[i] + eatAmount * 50, 100);
        }
      }
      
      // Energy decay
      energyBuffer[i] -= metabolism * dt * speedMul;
      
      // Death from starvation
      if (energyBuffer[i] <= 0) {
        aliveBuffer[i] = 0;
      }
    }
  }
  
  // Simple food regeneration (only worker 0 for now)
  if (foodBuffer && Math.random() < 0.1) {
    for (let i = 0; i < Math.min(100, foodBuffer.length); i++) {
      const idx = Math.floor(Math.random() * foodBuffer.length);
      if (foodBuffer[idx] < 200) {
        foodBuffer[idx] = Math.min(255, foodBuffer[idx] + 1);
      }
    }
  }
}