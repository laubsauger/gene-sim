/**
 * Shared simulation logic that works for both single-worker and multi-worker modes
 * This is the core game logic extracted from sim.worker.ts
 */

import { SpatialHash } from './spatialHash';
import { efficientMovementOptimized } from './spatialBehaviorsOptimized';
import { clampGene, mutate } from './genes';

// Constants
const G = 9; // Number of genes
const FOOD_EAT_RATE = 0.1;
const COMBAT_DAMAGE_RATE = 10;
const VISCOSITY = 0.5;

export interface SimBuffers {
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

export interface FoodState {
  foodGrid: Float32Array;
  foodGridUint8: Uint8Array;
  foodMaxCapacity: Float32Array;
  foodRegrowTimer: Float32Array;
  foodCols: number;
  foodRows: number;
  foodRegen: number;
  foodCapacity: number;
}

export interface SimState {
  count: number;
  cap: number;
  t: number;
  world: { width: number; height: number };
  energyConfig: { start: number; max: number; repro: number };
  speedMul: number;
  paused: boolean;
  birthsByTribe: Uint32Array;
  deathsByTribe: Uint32Array;
  killsByTribe: Uint32Array;
  starvedByTribe: Uint32Array;
  tribeColors: number[];
  allowHybrids: boolean;
  rand: () => number;
}

export interface SimWorkerContext {
  isSubWorker: boolean;
  workerId?: number;
  entityStart?: number;
  entityEnd?: number;
  actualEntityStart?: number;
  actualEntityEnd?: number;
}

export interface PerfTimers {
  spatialHash: number;
  foodRegrow: number;
  entityUpdate: number;
  foodConsume: number;
  movement: number;
  physics: number;
  total: number;
  samples: number;
}

/**
 * Main simulation step - can be called by any worker type
 */
export function simulationStep(
  dt: number,
  buffers: SimBuffers,
  food: FoodState,
  state: SimState,
  grid: SpatialHash,
  context: SimWorkerContext,
  perfTimers: PerfTimers
): void {
  if (state.paused) return;
  
  const stepStart = performance.now();
  const { pos, vel, color, alive, tribeId, genes, energy, age, orientation } = buffers;
  const { foodGrid, foodMaxCapacity, foodRegrowTimer, foodCols, foodRows, foodRegen } = food;
  const { world, energyConfig, speedMul, rand, allowHybrids } = state;
  
  // Determine entity range based on context
  const startIdx = context.isSubWorker ? 0 : 0;
  const endIdx = context.isSubWorker ? 
    (context.actualEntityEnd! - context.actualEntityStart!) : 
    state.cap;
  
  state.t += dt;
  
  // Rebuild spatial grid for efficient neighbor queries
  const hashStart = performance.now();
  grid.rebuild(pos, alive, state.count);
  perfTimers.spatialHash += performance.now() - hashStart;
  
  // Update food regrowth
  const foodStart = performance.now();
  const FOOD_REGROW_TIME = 10 / foodRegen;
  for (let i = 0; i < foodGrid.length; i++) {
    if (foodGrid[i] < foodMaxCapacity[i]) {
      foodRegrowTimer[i] += dt;
      if (foodRegrowTimer[i] >= FOOD_REGROW_TIME) {
        foodGrid[i] = Math.min(foodGrid[i] + foodRegen, foodMaxCapacity[i]);
        foodRegrowTimer[i] = 0;
      }
    }
  }
  perfTimers.foodRegrow += performance.now() - foodStart;
  
  // Update entities
  const entityStart = performance.now();
  
  // Use optimized movement for standalone mode, simpler for sub-workers
  if (!context.isSubWorker) {
    efficientMovementOptimized(
      pos, vel, alive, genes, orientation, age, tribeId,
      state.count, world, dt, speedMul, grid, rand,
      0, state.count
    );
  } else {
    // Simplified movement for sub-workers (they handle a subset)
    for (let i = startIdx; i < endIdx; i++) {
      if (!alive[i]) continue;
      
      // Update orientation
      const vx = vel[i * 2];
      const vy = vel[i * 2 + 1];
      if (vx !== 0 || vy !== 0) {
        orientation[i] = Math.atan2(vy, vx);
      }
      
      // Simple movement update
      pos[i * 2] += vel[i * 2] * dt * speedMul;
      pos[i * 2 + 1] += vel[i * 2 + 1] * dt * speedMul;
      
      // World wrapping
      if (pos[i * 2] < 0) pos[i * 2] += world.width;
      if (pos[i * 2] >= world.width) pos[i * 2] -= world.width;
      if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] += world.height;
      if (pos[i * 2 + 1] >= world.height) pos[i * 2 + 1] -= world.height;
      
      // Update age
      age[i] += dt;
    }
  }
  
  // Process entities for food, combat, reproduction
  for (let i = startIdx; i < endIdx; i++) {
    if (!alive[i]) continue;
    
    const base = i * G;
    const px = pos[i * 2];
    const py = pos[i * 2 + 1];
    
    // Get genes
    const metabolism = genes[base + 2];
    const reproChance = genes[base + 3];
    const aggression = genes[base + 4];
    const diet = genes[base + 6];
    const foodStandards = genes[base + 7];
    const vision = genes[base + 1];
    
    // Update color based on age (every 30 frames staggered)
    if ((i + Math.floor(state.t * 20)) % 30 === 0) {
      const ageInDays = age[i] / 10;
      const ageFactor = Math.min(1, ageInDays / 100);
      const baseTribeColor = state.tribeColors[tribeId[i]] || 0;
      const h = baseTribeColor / 360;
      const s = Math.max(0.3, 0.7 - ageFactor * 0.3);
      const l = 0.4 + ageFactor * 0.2;
      
      // Convert HSL to RGB
      const [r, g, b] = hslToRgb(h, s, l);
      color[i * 3] = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;
    }
    
    // Food consumption
    const gridX = Math.floor((px / world.width) * foodCols);
    const gridY = Math.floor((py / world.height) * foodRows);
    const foodIdx = gridY * foodCols + gridX;
    
    if (foodIdx >= 0 && foodIdx < foodGrid.length) {
      const herbivoreLevel = Math.max(0, -diet);
      if (herbivoreLevel > 0.2 && foodGrid[foodIdx] > foodStandards) {
        const eatAmount = Math.min(FOOD_EAT_RATE * herbivoreLevel * dt, foodGrid[foodIdx]);
        foodGrid[foodIdx] -= eatAmount;
        energy[i] = Math.min(energy[i] + eatAmount * 50, energyConfig.max);
      }
    }
    
    // Combat (carnivores)
    if (diet > 0.3 && aggression > 0.3) {
      const neighbors = grid.getNeighbors(px, py, vision);
      for (const j of neighbors) {
        if (!alive[j] || tribeId[i] === tribeId[j]) continue;
        
        const dx = pos[j * 2] - px;
        const dy = pos[j * 2 + 1] - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 10) {
          const damage = aggression * diet * COMBAT_DAMAGE_RATE * dt;
          energy[j] -= damage;
          energy[i] = Math.min(energy[i] + damage * 0.5, energyConfig.max);
          
          if (energy[j] <= 0) {
            alive[j] = 0;
            state.killsByTribe[tribeId[i]]++;
            state.deathsByTribe[tribeId[j]]++;
            state.count--;
          }
          break; // Only attack one at a time
        }
      }
    }
    
    // Energy decay
    energy[i] -= metabolism * dt * speedMul;
    
    // Death from starvation
    if (energy[i] <= 0) {
      alive[i] = 0;
      state.starvedByTribe[tribeId[i]]++;
      state.deathsByTribe[tribeId[i]]++;
      state.count--;
      continue;
    }
    
    // Reproduction
    if (energy[i] > energyConfig.repro && rand() < reproChance * dt && state.count < state.cap) {
      // Find empty slot
      for (let j = 0; j < state.cap; j++) {
        if (!alive[j]) {
          // Create offspring
          alive[j] = 1;
          pos[j * 2] = px + (rand() - 0.5) * 20;
          pos[j * 2 + 1] = py + (rand() - 0.5) * 20;
          vel[j * 2] = 0;
          vel[j * 2 + 1] = 0;
          energy[j] = energyConfig.start;
          age[j] = 0;
          orientation[j] = rand() * Math.PI * 2;
          
          // Inherit tribe or hybridize
          if (allowHybrids && rand() < 0.1) {
            // Find a mate from nearby
            const neighbors = grid.getNeighbors(px, py, 50);
            let mate = -1;
            for (const k of neighbors) {
              if (alive[k] && tribeId[k] !== tribeId[i]) {
                mate = k;
                break;
              }
            }
            if (mate >= 0) {
              tribeId[j] = rand() < 0.5 ? tribeId[i] : tribeId[mate];
              // Mix genes
              for (let g = 0; g < G; g++) {
                const parentGene = rand() < 0.5 ? genes[base + g] : genes[mate * G + g];
                genes[j * G + g] = mutate(parentGene, 0.05, rand);
              }
            } else {
              tribeId[j] = tribeId[i];
              for (let g = 0; g < G; g++) {
                genes[j * G + g] = mutate(genes[base + g], 0.05, rand);
              }
            }
          } else {
            tribeId[j] = tribeId[i];
            for (let g = 0; g < G; g++) {
              genes[j * G + g] = mutate(genes[base + g], 0.05, rand);
            }
          }
          
          // Copy color with slight variation
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
  
  perfTimers.entityUpdate += performance.now() - entityStart;
  perfTimers.total += performance.now() - stepStart;
  perfTimers.samples++;
}

// Helper function for HSL to RGB conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}