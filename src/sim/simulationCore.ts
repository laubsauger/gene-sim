/**
 * Core simulation logic that can be reused by both single worker and sub-workers
 * This module contains the actual game logic separated from worker-specific code
 */

import { createSpatialHash } from './spatialHash';
import { clampGene } from './genes';
import type { Rng } from './random';

// Performance tracking
export interface PerfTimers {
  total: number;
  spatialHash: number;
  movement: number;
  foodAndEnergy: number;
  foodRegrow: number;
  reproduction: number;
  death: number;
}

export interface SimulationBuffers {
  pos: Float32Array;
  vel: Float32Array;
  color: Uint8Array;
  alive: Uint8Array;
  tribeId: Uint16Array;
  genes: Float32Array;
  energy: Float32Array;
  age: Float32Array;
  orientation: Float32Array;
}

export interface FoodBuffers {
  foodGrid: Float32Array;
  foodGridUint8: Uint8Array;
  foodMaxCapacity: Float32Array;
  foodRegrowTimer: Float32Array;
}

export interface SimulationConfig {
  world: { width: number; height: number };
  energyConfig: { start: number; max: number; repro: number };
  foodCols: number;
  foodRows: number;
  foodRegen: number;
  foodCapacity: number;
  allowHybrids: boolean;
  speedMul: number;
  dt: number;
}

export interface SimulationState {
  count: number;
  cap: number;
  time: number;
  birthsByTribe: Uint32Array;
  deathsByTribe: Uint32Array;
  killsByTribe: Uint32Array;
  starvedByTribe: Uint32Array;
  tribeNames: string[];
  tribeColors: number[];
}

const G = 9; // Number of genes
const VISCOSITY = 0.5; // Velocity damping to create more realistic movement
const FOOD_REGROW_TIME = 100; // Base regrow time

/**
 * Initialize food grid based on perlin noise distribution
 */
export function initializeFoodGrid(
  foodBuffers: FoodBuffers,
  config: SimulationConfig,
  seed: number,
  distribution?: any
): void {
  const { foodGrid, foodMaxCapacity, foodRegrowTimer, foodGridUint8 } = foodBuffers;
  const { foodCols, foodRows, foodCapacity } = config;
  
  // This would need the noise function imported
  // For now, simple random initialization
  for (let i = 0; i < foodCols * foodRows; i++) {
    const capacity = Math.random() * foodCapacity;
    foodMaxCapacity[i] = capacity;
    foodGrid[i] = capacity;
    foodRegrowTimer[i] = 0;
    foodGridUint8[i] = Math.floor(Math.max(0, Math.min(1, capacity)) * 255);
  }
}

/**
 * Update food growth and convert to uint8 for rendering
 */
export function updateFoodGrid(
  foodBuffers: FoodBuffers,
  config: SimulationConfig,
  dt: number
): void {
  const { foodGrid, foodMaxCapacity, foodRegrowTimer, foodGridUint8 } = foodBuffers;
  const { foodRegen } = config;
  const FOOD_REGROW_TIME = 10 / foodRegen;
  
  for (let i = 0; i < foodGrid.length; i++) {
    if (foodGrid[i] < foodMaxCapacity[i]) {
      foodRegrowTimer[i] += dt;
      if (foodRegrowTimer[i] >= FOOD_REGROW_TIME) {
        foodGrid[i] = Math.min(foodGrid[i] + foodRegen, foodMaxCapacity[i]);
        foodRegrowTimer[i] = 0;
      }
    }
    // Update uint8 view for rendering
    foodGridUint8[i] = Math.floor(Math.max(0, Math.min(1, foodGrid[i])) * 255);
  }
}

/**
 * Main simulation update for a range of entities
 */
export function updateSimulation(
  buffers: SimulationBuffers,
  foodBuffers: FoodBuffers,
  config: SimulationConfig,
  state: SimulationState,
  rand: Rng,
  startIdx: number,
  endIdx: number,
  dt: number,
  perfTimers: PerfTimers
): void {
  const { pos, vel, color, alive, tribeId, genes, energy, age, orientation } = buffers;
  const { foodGrid, foodMaxCapacity, foodRegrowTimer } = foodBuffers;
  const { world, energyConfig, foodCols, foodRows, allowHybrids, speedMul } = config;
  const { count, cap, time } = state;
  
  // Build spatial hash for efficient neighbor queries
  const spatialStart = performance.now();
  const { getCellMembers, addToCell } = createSpatialHash(80, world.width, world.height);
  
  // Only add alive entities to spatial hash
  for (let i = startIdx; i < endIdx; i++) {
    if (alive[i]) {
      addToCell(pos[i * 2], pos[i * 2 + 1], i);
    }
  }
  perfTimers.spatialHash += performance.now() - spatialStart;
  
  // Process each entity
  for (let i = startIdx; i < endIdx; i++) {
    if (!alive[i]) continue;
    
    const base = i * G;
    const px = pos[i * 2];
    const py = pos[i * 2 + 1];
    const vx = vel[i * 2];
    const vy = vel[i * 2 + 1];
    
    // Get genes
    const speed = genes[base];
    const vision = genes[base + 1];
    const metabolism = genes[base + 2];
    const reproChance = genes[base + 3];
    const aggression = genes[base + 4];
    const cohesion = genes[base + 5];
    const diet = genes[base + 6];
    const foodStandards = genes[base + 7];
    const viewAngle = genes[base + 8];
    
    // Update age
    age[i] += dt;
    
    // Update orientation based on velocity
    if (vx !== 0 || vy !== 0) {
      orientation[i] = Math.atan2(vy, vx);
    }
    
    // Movement behavior
    const moveStart = performance.now();
    let fx = 0, fy = 0;
    
    // Get nearby entities
    const neighbors = getCellMembers(px, py, vision);
    
    // Flocking/combat behavior
    let nearestPrey: number | null = null;
    let nearestPreyDist = vision;
    let flockX = 0, flockY = 0, flockCount = 0;
    let avoidX = 0, avoidY = 0;
    
    for (const j of neighbors) {
      if (i === j || !alive[j]) continue;
      
      const dx = pos[j * 2] - px;
      const dy = pos[j * 2 + 1] - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > vision || dist < 0.1) continue;
      
      // Check if in view angle
      const angleToNeighbor = Math.atan2(dy, dx);
      const angleDiff = Math.abs(angleToNeighbor - orientation[i]);
      if (angleDiff > (viewAngle * Math.PI / 180) / 2) continue;
      
      const otherTribe = tribeId[j];
      const isSameTribe = tribeId[i] === otherTribe;
      
      if (isSameTribe) {
        // Flocking with same tribe
        flockX += pos[j * 2];
        flockY += pos[j * 2 + 1];
        flockCount++;
        
        // Separation
        if (dist < 20) {
          avoidX -= dx / dist;
          avoidY -= dy / dist;
        }
      } else if (diet > 0.3 && dist < nearestPreyDist) {
        // Hunting behavior for carnivores
        nearestPrey = j;
        nearestPreyDist = dist;
      }
    }
    
    // Apply flocking forces
    if (flockCount > 0 && cohesion > 0.2) {
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
    
    // Chase prey
    if (nearestPrey !== null && aggression > 0.3) {
      const dx = pos[nearestPrey * 2] - px;
      const dy = pos[nearestPrey * 2 + 1] - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      fx += (dx / dist) * aggression * 2;
      fy += (dy / dist) * aggression * 2;
    }
    
    // Random wandering
    fx += (rand() - 0.5) * 0.5;
    fy += (rand() - 0.5) * 0.5;
    
    // Apply forces with speed multiplier
    vel[i * 2] += fx * dt * speedMul;
    vel[i * 2 + 1] += fy * dt * speedMul;
    
    // Apply viscosity
    vel[i * 2] *= (1 - VISCOSITY * dt);
    vel[i * 2 + 1] *= (1 - VISCOSITY * dt);
    
    // Limit speed
    const currentSpeed = Math.sqrt(vel[i * 2] ** 2 + vel[i * 2 + 1] ** 2);
    if (currentSpeed > speed) {
      vel[i * 2] = (vel[i * 2] / currentSpeed) * speed;
      vel[i * 2 + 1] = (vel[i * 2 + 1] / currentSpeed) * speed;
    }
    
    // Update position
    pos[i * 2] += vel[i * 2] * dt * speedMul;
    pos[i * 2 + 1] += vel[i * 2 + 1] * dt * speedMul;
    
    // World wrapping
    if (pos[i * 2] < 0) pos[i * 2] += world.width;
    if (pos[i * 2] >= world.width) pos[i * 2] -= world.width;
    if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] += world.height;
    if (pos[i * 2 + 1] >= world.height) pos[i * 2 + 1] -= world.height;
    
    perfTimers.movement += performance.now() - moveStart;
    
    // Food consumption
    const foodStart = performance.now();
    const gridX = Math.floor((px / world.width) * foodCols);
    const gridY = Math.floor((py / world.height) * foodRows);
    const foodIdx = gridY * foodCols + gridX;
    
    if (foodIdx >= 0 && foodIdx < foodGrid.length) {
      const herbivoreLevel = Math.max(0, -diet);
      if (herbivoreLevel > 0.2 && foodGrid[foodIdx] > foodStandards) {
        const eatAmount = Math.min(0.1 * herbivoreLevel * dt, foodGrid[foodIdx]);
        foodGrid[foodIdx] -= eatAmount;
        energy[i] = Math.min(energy[i] + eatAmount * 50, energyConfig.max);
      }
    }
    
    // Combat
    if (nearestPrey !== null && nearestPreyDist < 10 && diet > 0.3) {
      const damage = aggression * diet * 10 * dt;
      energy[nearestPrey] -= damage;
      energy[i] = Math.min(energy[i] + damage * 0.5, energyConfig.max);
      
      if (energy[nearestPrey] <= 0) {
        alive[nearestPrey] = 0;
        state.killsByTribe[tribeId[i]]++;
        state.deathsByTribe[tribeId[nearestPrey]]++;
      }
    }
    
    // Energy decay
    energy[i] -= metabolism * dt * speedMul;
    
    // Death from starvation
    if (energy[i] <= 0) {
      alive[i] = 0;
      state.starvedByTribe[tribeId[i]]++;
      state.deathsByTribe[tribeId[i]]++;
    }
    
    perfTimers.foodAndEnergy += performance.now() - foodStart;
    
    // Reproduction
    if (energy[i] > energyConfig.repro && rand() < reproChance * dt && state.count < cap) {
      // Find space for offspring
      for (let j = 0; j < cap; j++) {
        if (!alive[j]) {
          // Create offspring
          alive[j] = 1;
          pos[j * 2] = px + (rand() - 0.5) * 20;
          pos[j * 2 + 1] = py + (rand() - 0.5) * 20;
          vel[j * 2] = 0;
          vel[j * 2 + 1] = 0;
          energy[j] = energyConfig.start;
          age[j] = 0;
          tribeId[j] = tribeId[i];
          
          // Inherit genes with mutation
          for (let g = 0; g < G; g++) {
            genes[j * G + g] = genes[base + g] * (0.95 + rand() * 0.1);
          }
          
          // Copy color
          color[j * 3] = color[i * 3];
          color[j * 3 + 1] = color[i * 3 + 1];
          color[j * 3 + 2] = color[i * 3 + 2];
          
          energy[i] -= energyConfig.repro * 0.5;
          state.birthsByTribe[tribeId[i]]++;
          state.count++;
          break;
        }
      }
    }
  }
}