/// <reference lib="webworker" />
import { createRng } from './random';
import { clampGene, mutate, defaultGenes } from './genes';
import { SpatialHash } from './spatialHash';
import { efficientMovement } from './spatialBehaviors';
import { createFractalNoise2D } from './noise';
import type { WorkerMsg, MainMsg, SimStats, GeneSpec, TribeStats, PerfStats } from './types';

// Simulation state
let pos!: Float32Array, vel!: Float32Array, color!: Uint8Array, alive!: Uint8Array, tribeId!: Uint16Array;
let genes!: Float32Array; // packed [speed, vision, metabolism, repro, aggression, cohesion, foodStandards, diet, viewAngle]
let energy!: Float32Array; // energy level per entity
let age!: Float32Array; // age in simulation time units
let orientation!: Float32Array; // entity orientation in radians
let count = 0, cap = 0;
let rand = Math.random;
let t = 0, speedMul = 1, paused = true; // Start paused
let renderFps = 0; // Track render FPS from main thread
let grid!: SpatialHash;
let tribeNames: string[] = [];
let tribeColors: number[] = [];
let birthsByTribe: Uint32Array, deathsByTribe: Uint32Array;
let killsByTribe: Uint32Array, starvedByTribe: Uint32Array;
const world = { width: 1000, height: 1000 };
let energyConfig = { start: 50, max: 100, repro: 60 }; // Default energy settings

// Food grid
let foodGrid!: Float32Array;
let foodGridUint8!: Uint8Array; // Food grid as uint8 for GPU (SharedArrayBuffer)
let foodMaxCapacity!: Float32Array; // Max capacity per cell (from noise distribution)
let foodRegrowTimer!: Float32Array; // Timer for each cell's regrowth
let foodCols = 0, foodRows = 0;
let foodRegen = 0.05, foodCapacity = 1;
let FOOD_REGROW_TIME = 60; // Time in seconds for food to fully regrow (1 minute)
let allowHybrids = true; // Whether to allow inter-tribe mating

const G = 9; // floats per entity in genes array (speed, vision, metabolism, repro, aggression, cohesion, foodStandards, diet, viewAngle)

// Convert HSL to RGB with high saturation and brightness for visibility
function hueToRgb(h: number, s = 1.0, v = 1.0): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] = [0, 0, 0];
  
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function spawnEntity(i: number, x: number, y: number, g: GeneSpec, tribeIx: number, initialEnergy = 50, initialAge = 0) {
  pos[i * 2] = x;
  pos[i * 2 + 1] = y;
  
  const ang = rand() * Math.PI * 2;
  // Effective speed is modulated by metabolism - low metabolism can't support high speeds
  const metabolismEfficiency = Math.min(1, g.metabolism / 0.15); // Normalized to base metabolism
  const effectiveSpeed = g.speed * metabolismEfficiency;
  const sp = effectiveSpeed * (0.6 + rand() * 0.8);
  vel[i * 2] = Math.cos(ang) * sp;
  vel[i * 2 + 1] = Math.sin(ang) * sp;
  
  // Set initial orientation based on velocity direction
  orientation[i] = ang;
  
  alive[i] = 1;
  tribeId[i] = tribeIx;
  
  const base = i * G;
  genes[base] = g.speed;
  genes[base + 1] = g.vision;
  genes[base + 2] = g.metabolism;
  genes[base + 3] = g.reproChance;
  genes[base + 4] = g.aggression;
  genes[base + 5] = g.cohesion;
  genes[base + 6] = g.foodStandards || 0.3;
  genes[base + 7] = g.diet || -0.5;
  genes[base + 8] = g.viewAngle || 120;
  
  // Carnivores start with more energy reserves (can last longer between meals)
  const carnivoreLevel = Math.max(0, g.diet || -0.5);
  const energyBonus = 1 + carnivoreLevel * 0.5; // Up to 50% more starting energy
  energy[i] = initialEnergy * energyBonus;
  age[i] = initialAge;
  
  const [r, gc, b] = hueToRgb(g.colorHue);
  color[i * 3] = r | 0;
  color[i * 3 + 1] = gc | 0;
  color[i * 3 + 2] = b | 0;
}

// Performance tracking
let perfTimers = {
  spatialHash: 0,
  foodRegrow: 0,
  entityUpdate: 0,
  foodConsume: 0,
  movement: 0,
  physics: 0,
  total: 0,
  samples: 0
};

function step(dt: number) {
  if (paused) return;
  
  const stepStart = performance.now();
  const n = count;
  t += dt;
  
  // Rebuild spatial grid for efficient neighbor queries
  const hashStart = performance.now();
  grid.rebuild(pos, alive, count);
  perfTimers.spatialHash += performance.now() - hashStart;
  
  // Regenerate food based on timers (respecting initial distribution)
  // OPTIMIZATION: Only update food every 10 frames (6 Hz) instead of 60 Hz
  const foodStart = performance.now();
  const shouldUpdateFood = Math.floor(t * 10) !== Math.floor((t - dt) * 10);
  
  if (shouldUpdateFood) {
    for (let i = 0; i < foodGrid.length; i++) {
      const maxCap = foodMaxCapacity[i]; // Respect noise-based max capacity
      if (foodGrid[i] < maxCap && maxCap > 0) {
        foodRegrowTimer[i] += dt * 10; // Compensate for reduced update rate
        if (foodRegrowTimer[i] >= FOOD_REGROW_TIME) {
          foodGrid[i] = maxCap;
          foodRegrowTimer[i] = 0;
        } else {
          foodGrid[i] = (foodRegrowTimer[i] / FOOD_REGROW_TIME) * maxCap;
        }
      }
    }
  }
  perfTimers.foodRegrow += performance.now() - foodStart;
  
  // Update entities with better cache locality
  const entityStart = performance.now();
  
  // Process entities in chunks for better CPU cache usage
  const CHUNK_SIZE = 64; // Typical CPU cache line aligned
  
  // Process all entities properly - no skipping
  for (let chunk = 0; chunk < n; chunk += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunk + CHUNK_SIZE, n);
    for (let i = chunk; i < chunkEnd; i++) {
      if (!alive[i]) continue;
      
    // Update orientation based on velocity
    const vx = vel[i * 2];
    const vy = vel[i * 2 + 1];
    const currentSpeed = Math.hypot(vx, vy);
    if (currentSpeed > 1) { // Only update if moving
      orientation[i] = Math.atan2(vy, vx);
    }
    
    const base = i * G;
    const sp = genes[base];
    // const vision = genes[base + 1]; // unused but kept for future use
    const metab = genes[base + 2];
    const repro = genes[base + 3];
    const diet = genes[base + 7] || -0.5; // -1=herbivore, 0=omnivore, 1=carnivore
    
    // Age entity
    age[i] += dt;
    
    // Update color brightness based on age (keep more visible, especially for dark colors)
    const ageInDays = age[i] / 10; // 10 sim seconds = 1 "day"
    let brightness = 1.0;
    if (ageInDays < 2) {
      brightness = 1.3; // Young - brighter
    } else if (ageInDays < 4) {
      brightness = 1.1; // Adult - slightly bright
    } else if (ageInDays < 6) {
      brightness = 0.9; // Old - slightly darker
    } else {
      brightness = 0.75; // Very old - darker but still visible
    }
    
    // Get base color from tribe
    const tribeHue = tribeColors[tribeId[i]] || 0;
    const [r, g, b] = hueToRgb(tribeHue);
    color[i * 3] = Math.min(255, (r * brightness) | 0);
    color[i * 3 + 1] = Math.min(255, (g * brightness) | 0);
    color[i * 3 + 2] = Math.min(255, (b * brightness) | 0);
    
    // Energy consumption based on metabolism, speed, and age
    // Higher metabolism means higher base cost but enables higher effective speeds
    const ageFactor = 1 + (age[i] / 200); // Older entities consume slightly more energy (reduced)
    // currentSpeed already calculated above for orientation
    
    // Diet-based energy efficiency
    // Carnivores are more efficient at rest and movement (like big cats)
    // Herbivores have higher constant energy drain (constant grazing)
    const carnivoreLevel = Math.max(0, diet); // 0-1 for carnivorous
    const herbivoreLevel = Math.max(0, -diet); // 0-1 for herbivorous
    
    // Movement cost scales with speed² and metabolism
    // Carnivores use 50% less energy when moving (efficient hunters)
    const dietMovementEfficiency = 1 - (carnivoreLevel * 0.5);
    const moveCost = (currentSpeed * currentSpeed) * 0.000005 * metab * dietMovementEfficiency;
    
    // Base metabolic cost
    // Herbivores have 50% higher base metabolism (constant digestion)
    // Carnivores have 30% lower base metabolism (can rest between hunts)
    const dietMetabolismFactor = 1 + (herbivoreLevel * 0.5) - (carnivoreLevel * 0.3);
    const baseCost = metab * 1.5 * dietMetabolismFactor;
    
    energy[i] -= (baseCost + moveCost) * dt * ageFactor;
    
    // Check food at current position
    // OPTIMIZATION: Only check food every 3rd frame for each entity (staggered)
    const shouldCheckFood = (i + Math.floor(t * 20)) % 3 === 0;
    const foodCheckStart = shouldCheckFood ? performance.now() : 0;
    
    if (shouldCheckFood) {
      const px = pos[i * 2];
      const py = pos[i * 2 + 1];
      
      // Only check food if entity is within world bounds and hungry
      if (energy[i] < 80 && px >= 0 && px < world.width && py >= 0 && py < world.height) {
        // OPTIMIZATION: Direct cell lookup instead of 3x3 grid
        const fx = Math.floor((px / world.width) * foodCols);
        const fy = Math.floor((py / world.height) * foodRows);
        
        let totalFoodConsumed = 0;
        
        // Only check the exact cell we're in and immediate neighbors if very close to edge
        const cellWidth = world.width / foodCols;
        // const cellHeight = world.height / foodRows; // Not currently used
        const cellX = px - fx * cellWidth;
        // const cellY = py - fy * cellHeight; // Not currently used
        
        // Check current cell
        const foodIdx = fy * foodCols + fx;
        if (foodGrid[foodIdx] > 0.3) {
          foodGrid[foodIdx] = 0;
          foodRegrowTimer[foodIdx] = 0;
          totalFoodConsumed++;
        }
        
        // Only check neighbors if very close to cell edge (within 25% of edge)
        if (cellX < cellWidth * 0.25 && fx > 0) {
          const leftIdx = fy * foodCols + (fx - 1);
          if (foodGrid[leftIdx] > 0.3) {
            foodGrid[leftIdx] = 0;
            foodRegrowTimer[leftIdx] = 0;
            totalFoodConsumed++;
          }
        } else if (cellX > cellWidth * 0.75 && fx < foodCols - 1) {
          const rightIdx = fy * foodCols + (fx + 1);
          if (foodGrid[rightIdx] > 0.3) {
            foodGrid[rightIdx] = 0;
            foodRegrowTimer[rightIdx] = 0;
            totalFoodConsumed++;
          }
        }
        
        // Gain energy based on amount consumed and diet
        if (totalFoodConsumed > 0) {
          // Diet affects plant food efficiency
          const dietGene = genes[base + 7] || -0.5;
          const herbivoreLevel = Math.max(0, -dietGene); // 0-1 for herbivorous tendency
          
          // Pure carnivores (diet=1) get 0% from plants, pure herbivores (diet=-1) get 100%
          // Omnivores (diet=0) get 50% efficiency
          const plantFoodEfficiency = herbivoreLevel; // 0-1 based on how herbivorous
          
          // Only herbivores and omnivores can get energy from plants
          if (herbivoreLevel > 0) {
            // Compensate for reduced check frequency by increasing energy gain
            energy[i] += Math.min(30, totalFoodConsumed * 8 * plantFoodEfficiency);
            energy[i] = Math.min(energy[i], energyConfig.max); // Max energy cap
          }
        }
      }
    }
    
    if (shouldCheckFood) {
      perfTimers.foodConsume += performance.now() - foodCheckStart;
    }
    
    // Use spatial hashing for efficient movement and combat
    const moveStart = performance.now();
    efficientMovement(
      i, pos, vel, alive, energy, tribeId, genes, grid,
      foodGrid, foodCols, foodRows, world, rand, dt,
      killsByTribe, deathsByTribe, color, birthsByTribe, allowHybrids,
      orientation, age
    );
    perfTimers.movement += performance.now() - moveStart;
    
    // Clamp speed
    const physicsStart = performance.now();
    let velx = vel[i * 2], vely = vel[i * 2 + 1];
    const vlen = Math.hypot(velx, vely) || 1e-6;
    const vmax = sp;
    if (vlen > vmax) {
      velx = velx / vlen * vmax;
      vely = vely / vlen * vmax;
      vel[i * 2] = velx;
      vel[i * 2 + 1] = vely;
    }
    
    // Integrate position
    pos[i * 2] += velx * dt;
    pos[i * 2 + 1] += vely * dt;
    
    // Boundary handling - allow entities to reach edge but strongly repel them
    const repulsionStrength = 30; // Strong push away from boundaries
    
    if (pos[i * 2] <= 0) {
      pos[i * 2] = 0; // Allow exact edge position
      vel[i * 2] = Math.abs(vel[i * 2]) + repulsionStrength; // Strong bounce + repulsion
      // Add random perpendicular velocity to prevent getting stuck
      vel[i * 2 + 1] += (rand() - 0.5) * repulsionStrength;
    } else if (pos[i * 2] >= world.width) {
      pos[i * 2] = world.width; // Allow exact edge position
      vel[i * 2] = -Math.abs(vel[i * 2]) - repulsionStrength; // Strong bounce + repulsion
      // Add random perpendicular velocity
      vel[i * 2 + 1] += (rand() - 0.5) * repulsionStrength;
    }
    
    if (pos[i * 2 + 1] <= 0) {
      pos[i * 2 + 1] = 0; // Allow exact edge position
      vel[i * 2 + 1] = Math.abs(vel[i * 2 + 1]) + repulsionStrength; // Strong bounce + repulsion
      // Add random perpendicular velocity
      vel[i * 2] += (rand() - 0.5) * repulsionStrength;
    } else if (pos[i * 2 + 1] >= world.height) {
      pos[i * 2 + 1] = world.height; // Allow exact edge position
      vel[i * 2 + 1] = -Math.abs(vel[i * 2 + 1]) - repulsionStrength; // Strong bounce + repulsion
      // Add random perpendicular velocity
      vel[i * 2] += (rand() - 0.5) * repulsionStrength;
    }
    perfTimers.physics += performance.now() - physicsStart;
    
    // Death from starvation or old age
    if (energy[i] <= 0 || age[i] > 80) { // Die at 80 seconds (~8 days)
      alive[i] = 0;
      deathsByTribe[tribeId[i]]++;
      if (energy[i] <= 0) {
        starvedByTribe[tribeId[i]]++;
      }
      // Reset age for reuse
      age[i] = 0;
      continue;
    }
    
    // Reproduction - balanced energy requirements and crowd limits
    // High metabolism increases reproduction rate (more energy processing = faster reproduction)
    const metabolismReproModifier = 0.5 + (metab / 0.3); // 0.5x to 2x modifier based on metabolism
    const effectiveReproChance = repro * metabolismReproModifier;
    
    if (alive[i] && energy[i] > energyConfig.repro && rand() < effectiveReproChance * dt) {
      // Check local crowd density to prevent reproduction in crowded areas
      const px = pos[i * 2], py = pos[i * 2 + 1];
      const vision = genes[base + 1];
      let nearbyCount = 0;
      const checkRadius = vision * 1.5; // Check slightly beyond vision
      const checkRadiusSq = checkRadius * checkRadius;
      
      // Quick crowd check - only check immediate neighbors
      grid.forNeighborsWithLimit(px, py, checkRadius, 20, (j) => {
        if (j !== i && alive[j]) {
          const dx = pos[j * 2] - px;
          const dy = pos[j * 2 + 1] - py;
          if (dx * dx + dy * dy < checkRadiusSq) {
            nearbyCount++;
          }
        }
        return nearbyCount < 15; // Early exit if too crowded
      });
      
      const crowdStress = Math.min(1, nearbyCount / 15);
      const reproductiveCrowdLimit = 0.7;
      
      // Don't reproduce if too crowded
      if (crowdStress < reproductiveCrowdLimit) {
        // Find a free slot
        for (let j = 0; j < cap; j++) {
          if (!alive[j]) {
            const childGenes: GeneSpec = {
              speed: genes[base],
              vision: genes[base + 1],
              metabolism: genes[base + 2],
              reproChance: genes[base + 3],
              aggression: genes[base + 4],
              cohesion: genes[base + 5],
              foodStandards: genes[base + 6],
              diet: genes[base + 7],
              viewAngle: genes[base + 8],
              colorHue: tribeColors[tribeId[i]],
            };
            
            const mutatedGenes = mutate(childGenes, rand); // Uses default 0.12 intensity now
            
            // Spawn child NEAR parent, not at same location
            const spawnOffset = 10 + rand() * 15; // 10-25 units away
            const spawnAngle = rand() * Math.PI * 2;
            const childX = px + Math.cos(spawnAngle) * spawnOffset;
            const childY = py + Math.sin(spawnAngle) * spawnOffset;
            
            // Parent gives energy to child
            energy[i] -= 25; // Reduced cost
            spawnEntity(j, childX, childY, mutatedGenes, tribeId[i], energyConfig.start * 0.7, rand() * 10);
            birthsByTribe[tribeId[i]]++;
            if (j >= count) count = j + 1;
            break;
          }
        }
      }
    }
    } // End of chunk loop
  }
  perfTimers.entityUpdate += performance.now() - entityStart;
  
  perfTimers.total += performance.now() - stepStart;
  perfTimers.samples++;
  
  // Log performance stats every 2 seconds
  if (perfTimers.samples >= 120) {
    const avgTimers = {
      spatialHash: perfTimers.spatialHash / perfTimers.samples,
      foodRegrow: perfTimers.foodRegrow / perfTimers.samples,
      entityUpdate: perfTimers.entityUpdate / perfTimers.samples,
      foodConsume: perfTimers.foodConsume / perfTimers.samples,
      movement: perfTimers.movement / perfTimers.samples,
      physics: perfTimers.physics / perfTimers.samples,
      total: perfTimers.total / perfTimers.samples
    };
    
    const perfBreakdown = {
      spatialHash: avgTimers.spatialHash.toFixed(2),
      foodRegrow: avgTimers.foodRegrow.toFixed(2),
      entityUpdate: avgTimers.entityUpdate.toFixed(2),
      foodConsume: avgTimers.foodConsume.toFixed(2),
      movement: avgTimers.movement.toFixed(2),
      physics: avgTimers.physics.toFixed(2),
      total: avgTimers.total.toFixed(2),
      entities: count
    };
    
    // Send to UI
    self.postMessage({ type: 'perfBreakdown', payload: perfBreakdown });
    
    // Also log to console for debugging
    console.log('Performance breakdown (ms):', perfBreakdown);
    
    // Reset counters
    perfTimers = {
      spatialHash: 0,
      foodRegrow: 0,
      entityUpdate: 0,
      foodConsume: 0,
      movement: 0,
      physics: 0,
      total: 0,
      samples: 0
    };
  }
}

function stats(): SimStats {
  const byTribe: Record<string, TribeStats> = {};
  const tribeData: Record<string, number[][]> = {}; // Store gene values per tribe
  
  let aliveCount = 0;
  const globalGenes: number[][] = [[], [], [], [], [], [], [], [], []]; // speed, vision, metab, repro, aggro, cohesion, foodStandards, diet, viewAngle
  
  // Collect data
  for (let i = 0; i < count; i++) {
    if (alive[i]) {
      aliveCount++;
      const base = i * G;
      const tribeName = tribeNames[tribeId[i]] || 'Unknown';
      
      // Initialize tribe data if needed
      if (!tribeData[tribeName]) {
        tribeData[tribeName] = [[], [], [], [], [], [], [], [], []]; // 9 arrays for 9 genes
      }
      
      // Collect gene values (speed, vision, metabolism, reproChance, aggression, cohesion, foodStandards, diet, viewAngle)
      tribeData[tribeName][0].push(genes[base]);        // speed
      tribeData[tribeName][1].push(genes[base + 1]);    // vision
      tribeData[tribeName][2].push(genes[base + 2]);    // metabolism
      tribeData[tribeName][3].push(genes[base + 3]);    // reproChance
      tribeData[tribeName][4].push(genes[base + 4]);    // aggression
      tribeData[tribeName][5].push(genes[base + 5]);    // cohesion
      tribeData[tribeName][6].push(genes[base + 6] || 0.3);  // foodStandards
      tribeData[tribeName][7].push(genes[base + 7] || -0.5); // diet
      tribeData[tribeName][8].push(genes[base + 8] || 120); // viewAngle
      
      globalGenes[0].push(genes[base]);
      globalGenes[1].push(genes[base + 1]);
      globalGenes[2].push(genes[base + 2]);
      globalGenes[3].push(genes[base + 3]);
      globalGenes[4].push(genes[base + 4]);
      globalGenes[5].push(genes[base + 5]);
      globalGenes[6].push(genes[base + 6] || 0.3);
      globalGenes[7].push(genes[base + 7] || -0.5);
      globalGenes[8].push(genes[base + 8] || 120);  // viewAngle
    }
  }
  
  // Helper to calculate statistics
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { min: 0, max: 0, mean: 0, std: 0 };
    
    // Avoid stack overflow with large arrays by using reduce instead of spread
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    
    for (const v of values) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    
    const mean = sum / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    
    return { mean, min, max, std };
  };
  
  // Process each tribe
  for (const [tribeName, geneArrays] of Object.entries(tribeData)) {
    const isHybrid = tribeName === 'Hybrids';
    const tribeIndex = isHybrid ? 999 : tribeNames.indexOf(tribeName);
    const [r, g, b] = isHybrid ? [220, 220, 255] : hueToRgb(tribeColors[tribeIndex] || 0);
    
    const speedStats = calcStats(geneArrays[0]);
    const visionStats = calcStats(geneArrays[1]);
    const metabStats = calcStats(geneArrays[2]);
    const reproStats = calcStats(geneArrays[3]);
    const aggroStats = calcStats(geneArrays[4]);
    const cohesionStats = calcStats(geneArrays[5]);
    const foodStandardsStats = calcStats(geneArrays[6]);
    const dietStats = calcStats(geneArrays[7]);
    const viewAngleStats = calcStats(geneArrays[8]);
    
    byTribe[tribeName] = {
      count: geneArrays[0].length,
      births: 0, // TODO: track hybrid births properly
      deaths: 0, // TODO: track hybrid deaths properly
      kills: 0,
      starved: 0,
      color: `rgb(${r},${g},${b})`,
      mean: {
        speed: speedStats.mean,
        vision: visionStats.mean,
        metabolism: metabStats.mean,
        aggression: aggroStats.mean,
        cohesion: cohesionStats.mean,
        reproChance: reproStats.mean,
        foodStandards: foodStandardsStats.mean,
        diet: dietStats.mean,
        viewAngle: viewAngleStats.mean,
      },
      distribution: {
        speed: { min: speedStats.min, max: speedStats.max, std: speedStats.std },
        vision: { min: visionStats.min, max: visionStats.max, std: visionStats.std },
        metabolism: { min: metabStats.min, max: metabStats.max, std: metabStats.std },
        aggression: { min: aggroStats.min, max: aggroStats.max, std: aggroStats.std },
        cohesion: { min: cohesionStats.min, max: cohesionStats.max, std: cohesionStats.std },
        reproChance: { min: reproStats.min, max: reproStats.max, std: reproStats.std },
        foodStandards: { min: foodStandardsStats.min, max: foodStandardsStats.max, std: foodStandardsStats.std },
        diet: { min: dietStats.min, max: dietStats.max, std: dietStats.std },
        viewAngle: { min: viewAngleStats.min, max: viewAngleStats.max, std: viewAngleStats.std },
      },
    };
  }
  
  // Calculate global statistics
  const globalSpeed = calcStats(globalGenes[0]);
  const globalVision = calcStats(globalGenes[1]);
  const globalMetab = calcStats(globalGenes[2]);
  const globalRepro = calcStats(globalGenes[3]);
  const globalAggro = calcStats(globalGenes[4]);
  const globalCohesion = calcStats(globalGenes[5]);
  const globalFoodStandards = calcStats(globalGenes[6]);
  const globalDiet = calcStats(globalGenes[7]);
  const globalViewAngle = calcStats(globalGenes[8]);
  
  return {
    t,
    population: aliveCount,
    byTribe,
    global: {
      mean: {
        speed: globalSpeed.mean,
        vision: globalVision.mean,
        metabolism: globalMetab.mean,
        aggression: globalAggro.mean,
        cohesion: globalCohesion.mean,
        reproChance: globalRepro.mean,
        foodStandards: globalFoodStandards.mean,
        diet: globalDiet.mean,
        viewAngle: globalViewAngle.mean,
      },
      distribution: {
        speed: { min: globalSpeed.min, max: globalSpeed.max, std: globalSpeed.std },
        vision: { min: globalVision.min, max: globalVision.max, std: globalVision.std },
        metabolism: { min: globalMetab.min, max: globalMetab.max, std: globalMetab.std },
        aggression: { min: globalAggro.min, max: globalAggro.max, std: globalAggro.std },
        cohesion: { min: globalCohesion.min, max: globalCohesion.max, std: globalCohesion.std },
        reproChance: { min: globalRepro.min, max: globalRepro.max, std: globalRepro.std },
        foodStandards: { min: globalFoodStandards.min, max: globalFoodStandards.max, std: globalFoodStandards.std },
        diet: { min: globalDiet.min, max: globalDiet.max, std: globalDiet.std },
        viewAngle: { min: globalViewAngle.min, max: globalViewAngle.max, std: globalViewAngle.std },
      },
    },
  };
}

// Message handler
self.onmessage = (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data;
  
  if (msg.type === 'init') {
    const init = msg.payload;
    world.width = init.world.width;
    world.height = init.world.height;
    cap = init.cap;
    
    // Update energy config if provided
    if (init.energy) {
      energyConfig = init.energy;
    }
    
    // Allocate SharedArrayBuffers
    const sabPos = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2);
    const sabVel = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2);
    const sabCol = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap * 3);
    const sabAlive = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap);
    const sabTribe = new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * cap);
    const sabGenes = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * G);
    const sabEnergy = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
    const sabAge = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
    
    pos = new Float32Array(sabPos);
    vel = new Float32Array(sabVel);
    color = new Uint8Array(sabCol);
    alive = new Uint8Array(sabAlive);
    tribeId = new Uint16Array(sabTribe);
    genes = new Float32Array(sabGenes);
    energy = new Float32Array(sabEnergy);
    age = new Float32Array(sabAge);
    orientation = new Float32Array(cap); // Initialize orientation array
    
    // Initialize food grid with configurable resolution
    foodCols = init.world.foodGrid?.cols || 256;
    foodRows = init.world.foodGrid?.rows || 256;
    
    // SharedArrayBuffer for food (uint8 for GPU efficiency) - AFTER we know dimensions
    const sabFood = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * foodCols * foodRows);
    foodGridUint8 = new Uint8Array(sabFood); // Initialize the shared uint8 view
    
    foodRegen = init.world.foodGrid?.regen || 0.05;
    foodCapacity = init.world.foodGrid?.capacity || 1;
    foodGrid = new Float32Array(foodCols * foodRows);
    foodMaxCapacity = new Float32Array(foodCols * foodRows);
    foodRegrowTimer = new Float32Array(foodCols * foodRows);
    
    // Set regrow time based on regen rate (lower regen = longer time)
    FOOD_REGROW_TIME = 10 / foodRegen; // e.g., 0.1 regen = 100 seconds
    
    // Initialize food distribution based on noise
    const distribution = init.world.foodGrid?.distribution;
    if (distribution && distribution.threshold > 0) {
      const noise = createFractalNoise2D(init.seed + 12345); // Different seed for food
      const scale = distribution.scale || 35;
      const threshold = distribution.threshold || 0.35;
      const frequency = distribution.frequency || 3;
      
      for (let y = 0; y < foodRows; y++) {
        for (let x = 0; x < foodCols; x++) {
          const worldX = (x / foodCols) * world.width;
          const worldY = (y / foodRows) * world.height;
          // Use frequency as octaves count (can be fractional for smooth blending)
          const octaves = Math.max(1, frequency);
          const noiseValue = noise(worldX, worldY, scale, octaves);
          
          const idx = y * foodCols + x;
          // Apply threshold - values below threshold get no food
          if (noiseValue > threshold) {
            // Use exponential scaling for more dramatic islands
            // Values just above threshold are sparse, high values are very rich
            const normalizedValue = (noiseValue - threshold) / (1 - threshold);
            // Apply power curve for richer variation (squared makes rich areas richer)
            const richness = Math.pow(normalizedValue, 1.5);
            foodMaxCapacity[idx] = richness * foodCapacity;
            foodGrid[idx] = foodMaxCapacity[idx]; // Start at max
          } else {
            foodMaxCapacity[idx] = 0;
            foodGrid[idx] = 0;
          }
          foodRegrowTimer[idx] = 0;
        }
      }
    } else {
      // Default: Use interesting island pattern even without explicit distribution settings
      const noise = createFractalNoise2D(init.seed + 12345);
      for (let y = 0; y < foodRows; y++) {
        for (let x = 0; x < foodCols; x++) {
          const worldX = (x / foodCols) * world.width;
          const worldY = (y / foodRows) * world.height;
          // Create default island pattern
          const noiseValue = noise(worldX, worldY, 35, 3);
          
          const idx = y * foodCols + x;
          // Simple capacity modulation - use full noise range
          const capacity = noiseValue * noiseValue * foodCapacity; // Squared for more variation
          foodMaxCapacity[idx] = capacity;
          foodGrid[idx] = capacity;
          foodRegrowTimer[idx] = 0;
        }
      }
    }
    
    // Initialize foodGridUint8 with initial food values
    for (let i = 0; i < foodGrid.length; i++) {
      foodGridUint8[i] = Math.floor(Math.max(0, Math.min(1, foodGrid[i])) * 255);
    }
    
    // Set hybridization flag
    allowHybrids = init.hybridization !== false; // Default true for backwards compat
    
    birthsByTribe = new Uint32Array(init.tribes.length);
    deathsByTribe = new Uint32Array(init.tribes.length);
    killsByTribe = new Uint32Array(init.tribes.length);
    starvedByTribe = new Uint32Array(init.tribes.length);
    tribeNames = init.tribes.map(t => t.name);
    tribeColors = [];
    
    // Initialize RNG
    rand = createRng(init.seed);
    
    // Spawn tribes with different distribution patterns
    count = 0;
    init.tribes.forEach((tribe, ix) => {
      const baseGenes = clampGene({
        ...defaultGenes,
        ...tribe.genes,
      });
      tribeColors[ix] = baseGenes.colorHue;
      
      // Determine spawn pattern
      const pattern = tribe.spawn.pattern || 'blob';
      const diet = baseGenes.diet || -0.5;
      const carnivoreLevel = Math.max(0, diet);
      const herbivoreLevel = Math.max(0, -diet);
      
      for (let i = 0; i < tribe.count; i++) {
        if (count >= cap) break;
        
        let x: number, y: number;
        
        if (pattern === 'blob') {
          // Original tight blob spawn
          const ang = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * tribe.spawn.radius;
          x = tribe.spawn.x + Math.cos(ang) * r;
          y = tribe.spawn.y + Math.sin(ang) * r;
          
        } else if (pattern === 'scattered') {
          // Random scatter across entire map
          x = rand() * world.width;
          y = rand() * world.height;
          
        } else if (pattern === 'herd') {
          // Multiple small groups (herbivore-like)
          const numHerds = 3 + Math.floor(rand() * 3); // 3-5 herds
          const herdIndex = i % numHerds;
          const herdAngle = (herdIndex / numHerds) * Math.PI * 2;
          const herdDistance = tribe.spawn.radius * 2;
          const herdCenterX = tribe.spawn.x + Math.cos(herdAngle) * herdDistance;
          const herdCenterY = tribe.spawn.y + Math.sin(herdAngle) * herdDistance;
          
          // Small blob around herd center
          const ang = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * (tribe.spawn.radius * 0.5);
          x = herdCenterX + Math.cos(ang) * r;
          y = herdCenterY + Math.sin(ang) * r;
          
        } else if (pattern === 'adaptive') {
          // Pattern based on diet
          if (carnivoreLevel > 0.7) {
            // Carnivores: very sparse, wide distribution
            // Scattered across map with preference for edges
            if (rand() < 0.3) {
              // 30% spawn near edges (hunting grounds)
              const edge = Math.floor(rand() * 4);
              const margin = 100;
              if (edge === 0) {
                x = margin + rand() * 200;
                y = rand() * world.height;
              } else if (edge === 1) {
                x = world.width - margin - rand() * 200;
                y = rand() * world.height;
              } else if (edge === 2) {
                x = rand() * world.width;
                y = margin + rand() * 200;
              } else {
                x = rand() * world.width;
                y = world.height - margin - rand() * 200;
              }
            } else {
              // 70% scattered across map
              x = 200 + rand() * (world.width - 400);
              y = 200 + rand() * (world.height - 400);
            }
            
          } else if (herbivoreLevel > 0.7) {
            // Herbivores: tight herds
            const numHerds = 2 + Math.floor(herbivoreLevel * 3); // 2-4 herds based on how herbivorous
            const herdIndex = i % numHerds;
            const herdAngle = (herdIndex / numHerds) * Math.PI * 2;
            const herdDistance = tribe.spawn.radius * (1.5 + rand());
            const herdCenterX = tribe.spawn.x + Math.cos(herdAngle) * herdDistance;
            const herdCenterY = tribe.spawn.y + Math.sin(herdAngle) * herdDistance;
            
            // Tight blob around herd center
            const ang = rand() * Math.PI * 2;
            const r = Math.sqrt(rand()) * (tribe.spawn.radius * 0.3 * (2 - herbivoreLevel)); // Tighter for pure herbivores
            x = herdCenterX + Math.cos(ang) * r;
            y = herdCenterY + Math.sin(ang) * r;
            
          } else {
            // Omnivores: medium scatter
            const ang = rand() * Math.PI * 2;
            const r = Math.sqrt(rand()) * tribe.spawn.radius * 2; // Wider than blob but not fully scattered
            x = tribe.spawn.x + Math.cos(ang) * r;
            y = tribe.spawn.y + Math.sin(ang) * r;
          }
        } else {
          // Fallback to blob
          const ang = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * tribe.spawn.radius;
          x = tribe.spawn.x + Math.cos(ang) * r;
          y = tribe.spawn.y + Math.sin(ang) * r;
        }
        
        // Clamp to world bounds with better margin
        x = Math.max(50, Math.min(world.width - 50, x));
        y = Math.max(50, Math.min(world.height - 50, y));
        
        const initialAge = rand() * 30; // Random age between 0-30 seconds
        const initialEnergy = energyConfig.start + rand() * 20; // Start energy plus some variation
        spawnEntity(count++, x, y, baseGenes, ix, initialEnergy, initialAge);
      }
    });
    
    // Optimal cell size: slightly larger than average vision range for best performance
    // Most entities have vision 30-70, so 80 reduces cells to check while maintaining accuracy
    grid = new SpatialHash(world.width, world.height, 80, cap);
    
    // Send ready message with SABs and food metadata
    const payload: MainMsg = {
      type: 'ready',
      payload: {
        sab: { 
          pos: sabPos, 
          color: sabCol, 
          alive: sabAlive,
          food: sabFood  // Add food SharedArrayBuffer
        },
        meta: { count },
        foodMeta: { cols: foodCols, rows: foodRows },
      },
    };
    self.postMessage(payload);
    
    // Main simulation loop with performance tracking
    let last = performance.now();
    let lastStatsTime = 0;
    let lastPerfTime = 0;
    let lastFoodTime = 0;
    let simSteps = 0;
    
    // Fixed timestep for deterministic physics
    const FIXED_TIMESTEP = 1/60; // 60Hz physics
    let accumulator = 0;
    
    const tick = () => {
      const now = performance.now();
      const frameTime = Math.min(0.1, (now - last) / 1000); // cap large pause
      last = now;
      
      if (!paused && speedMul > 0) {
        // Accumulate time based on speed multiplier
        accumulator += frameTime * speedMul;
        
        // Run fixed timestep simulation
        while (accumulator >= FIXED_TIMESTEP) {
          step(FIXED_TIMESTEP);
          accumulator -= FIXED_TIMESTEP;
          simSteps++;
        }
      }
      
      // Send performance metrics (4Hz)
      if (now - lastPerfTime > 250) {
        const elapsed = (now - lastPerfTime) / 1000;
        const perf: PerfStats = {
          fps: renderFps, // Use the render FPS from main thread
          simSpeed: Math.round(simSteps / elapsed),
          speedMul
        };
        self.postMessage({ type: 'perf', payload: perf } as MainMsg);
        lastPerfTime = now;
        simSteps = 0;
      }
      
      // Convert food to uint8 for GPU (no need to send, it's shared!)
      // Only update every few frames for performance
      if (now - lastFoodTime > 100) {
        lastFoodTime = now;
        // Convert float food values to uint8 for GPU
        for (let i = 0; i < foodGrid.length; i++) {
          foodGridUint8[i] = Math.floor(Math.max(0, Math.min(1, foodGrid[i])) * 255);
        }
      }
      
      // Send stats periodically (2Hz for performance)
      if (now - lastStatsTime > 500) {
        lastStatsTime = now;
        self.postMessage({ type: 'stats', payload: stats() } as MainMsg);
      }
      
      requestAnimationFrame(tick);
    };
    tick();
  } else if (msg.type === 'setSpeed') {
    speedMul = msg.payload.speedMul;
  } else if (msg.type === 'pause') {
    paused = msg.payload.paused;
  } else if (msg.type === 'renderFps') {
    renderFps = msg.payload.fps;
  }
};