/// <reference lib="webworker" />
import { SimulationCore } from './core/simulationCore';
import { EntitySystem } from './core/entitySystem';
import { FoodSystem } from './core/foodSystem';
import { createRng } from './random';
import { defaultGenes } from './genes';
import type { WorkerMsg, MainMsg, PerfStats } from './types';
import { WORLD_WIDTH, WORLD_HEIGHT } from './core/constants';

// Helper function for color conversion
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
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

// Sub-worker mode detection
let isSubWorker = false;
let workerId = -1;
let bufferEntityStart = 0;
let bufferEntityEnd = 0;
let actualEntityStart = 0;
let actualEntityEnd = 0;

// Core simulation instance
let sim: SimulationCore | null = null;

// Direct buffer references for rendering
let sharedBuffers: {
  positions: SharedArrayBuffer;
  velocities: SharedArrayBuffer;
  colors: SharedArrayBuffer;
  alive: SharedArrayBuffer;
  energy: SharedArrayBuffer;
  tribeIds: SharedArrayBuffer;
  genes: SharedArrayBuffer;
  orientations: SharedArrayBuffer;
  ages: SharedArrayBuffer;
  foodGrid?: SharedArrayBuffer;
} | null = null;

// Timing and stats
let lastTime = 0;
let simHz = 0;
let renderFps = 0;
let accumulator = 0;
const FIXED_TIMESTEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 16; // Allow up to 16x speed (960Hz)

// Performance tracking
let stepCount = 0;
let lastPerfUpdate = 0;
let frameCount = 0;
let stepTimeAccum = 0;
let maxStepTime = 0;

function initializeAsMainWorker(msg: any) {
  const init = msg.payload;
  const seed = init.seed || Date.now();
  const rand = createRng(seed);
  
  // Create simulation core
  const worldWidth = init.world?.width || WORLD_WIDTH;
  const worldHeight = init.world?.height || WORLD_HEIGHT;
  const cap = init.cap || 10000;
  const tribeCount = init.tribes?.length || 3;
  
  sim = new SimulationCore(worldWidth, worldHeight, cap, seed, tribeCount);
  // Fix: Use hybridization from config (UI sends hybridization, not allowHybrids)
  sim.allowHybrids = init.hybridization === true;  // Default to false if not specified
  console.log(`[SingleWorker] Hybrid evolution: ${sim.allowHybrids} (from config.hybridization: ${init.hybridization})`);
  
  // Store tribe metadata
  sim.tribeNames = init.tribes?.map((t: any) => t.name) || [];
  sim.tribeColors = init.tribes?.map((t: any) => t.genes?.colorHue || 0) || [];
  
  // Spawn initial entities
  let totalSpawned = 0;
  if (init.tribes) {
    init.tribes.forEach((tribe: any, tribeIdx: number) => {
      const count = tribe.count || 100;
      // Use provided spawn or generate random position for tribe
      const spawn = tribe.spawn || { 
        x: worldWidth * (0.2 + 0.6 * rand()), 
        y: worldHeight * (0.2 + 0.6 * rand())
      };
      const radius = tribe.spawn?.radius || 200;  // Increased default radius from 100 to 200
      const geneSpec = { ...defaultGenes, ...tribe.genes };
      
      for (let i = 0; i < count && totalSpawned < cap; i++) {
        const angle = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * radius;
        const x = spawn.x + Math.cos(angle) * r;
        const y = spawn.y + Math.sin(angle) * r;
        
        sim!.entities.spawn(totalSpawned, x, y, geneSpec, tribeIdx);
        totalSpawned++;
      }
    });
  }
  
  sim.count = totalSpawned;
  sim.entities.count = totalSpawned;
  
  // Create SharedArrayBuffers for rendering
  sharedBuffers = {
    positions: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2),
    velocities: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2),
    colors: new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap * 3),
    alive: new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap),
    energy: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap),
    tribeIds: new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * cap),
    genes: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 9),
    orientations: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap),
    ages: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap),
  };
  
  // Add food grid buffer and replace FoodSystem if needed
  if (init.world?.foodGrid) {
    const { cols, rows, capacity = 1, distribution, regen = 0.05 } = init.world.foodGrid;
    sharedBuffers.foodGrid = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cols * rows);
    
    // Replace the default FoodSystem with one using the shared buffer
    const foodGridUint8 = new Uint8Array(sharedBuffers.foodGrid);
    sim.food = new FoodSystem(cols, rows, worldWidth, worldHeight, regen, foodGridUint8);
    
    // Initialize with distribution config
    sim.food.initialize(seed, capacity, distribution);
  }
  
  // Create views over shared buffers
  const pos = new Float32Array(sharedBuffers.positions);
  const vel = new Float32Array(sharedBuffers.velocities);
  const color = new Uint8Array(sharedBuffers.colors);
  const alive = new Uint8Array(sharedBuffers.alive);
  const energy = new Float32Array(sharedBuffers.energy);
  const age = new Float32Array(sharedBuffers.ages);
  const tribeId = new Uint16Array(sharedBuffers.tribeIds);
  const genes = new Float32Array(sharedBuffers.genes);
  const orientation = new Float32Array(sharedBuffers.orientations);
  
  // Copy initial entity data to shared buffers BEFORE replacing the entity system
  pos.set(sim.entities.pos);
  vel.set(sim.entities.vel);
  color.set(sim.entities.color);
  alive.set(sim.entities.alive);
  energy.set(sim.entities.energy);
  age.set(sim.entities.age);
  tribeId.set(sim.entities.tribeId);
  genes.set(sim.entities.genes);
  orientation.set(sim.entities.orientation);
  
  // Now replace EntitySystem's internal buffers with shared views
  sim.entities = new EntitySystem(cap, {
    pos, vel, color, alive, energy, age, tribeId, genes, orientation
  });
  sim.entities.count = totalSpawned;
  
  // Send ready message with expected buffer names
  const foodMeta = sharedBuffers.foodGrid && sim.food ? 
    { cols: sim.food.getCols(), rows: sim.food.getRows() } : 
    undefined;
    
  self.postMessage({
    type: 'ready',
    payload: {
      sab: {
        pos: sharedBuffers.positions,
        color: sharedBuffers.colors,
        alive: sharedBuffers.alive,
        ages: sharedBuffers.ages,
        food: sharedBuffers.foodGrid
      },
      meta: { count: cap },
      foodMeta
    }
  } as MainMsg);
  
  startMainLoop();
  
  // Start sending stats periodically (only in main worker mode)
  setInterval(() => {
    if (sim) {
      const stats = sim.getStats();
      self.postMessage({ type: 'stats', payload: stats } as MainMsg);
    }
  }, 500);
}

function initializeAsSubWorker(msg: any) {
  console.log(`[Worker] Starting sub-worker initialization`, msg.payload);
  const { sharedBuffers: buffers, config, workerId: id, entityRange, region } = msg.payload;
  
  isSubWorker = true;
  workerId = id;
  bufferEntityStart = entityRange.start;
  bufferEntityEnd = entityRange.end;
  actualEntityStart = entityRange.actualStart;
  actualEntityEnd = entityRange.actualEnd;
  
  const worldWidth = config.world?.width || WORLD_WIDTH;
  const worldHeight = config.world?.height || WORLD_HEIGHT;
  const cap = bufferEntityEnd - bufferEntityStart;
  const seed = config.seed || Date.now();
  
  // Store worker's spatial region
  const workerRegion = region ? {
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    x2: region.x + region.width,
    y2: region.y + region.height
  } : null;
  
  console.log(`[Worker ${id}] Region: (${region?.x},${region?.y}) to (${region?.x + region?.width},${region?.y + region?.height})`);
  
  // Create simulation core
  // Pass totalCap for spatial hash sizing to handle neighbor queries across all workers
  const totalCap = buffers.positions.byteLength / 8; // Float32Array with x,y = 8 bytes per entity
  sim = new SimulationCore(worldWidth, worldHeight, cap, seed + workerId, config.tribes?.length || 3, totalCap);
  // Fix: Use hybridization from config (UI sends hybridization, not allowHybrids)
  sim.allowHybrids = config.hybridization === true;  // Default to false if not specified
  sim.updateFood = workerId === 0;  // Only worker 0 handles food regrowth (but syncs from shared buffer first)
  sim.tribeNames = config.tribes?.map((t: any) => t.name) || [];
  sim.tribeColors = config.tribes?.map((t: any) => t.genes?.colorHue || 0) || [];
  sim.workerRegion = workerRegion;
  sim.isMultiWorker = true;
  
  if (workerId === 0) {
    console.log(`[Worker 0] Settings received:`, {
      hybridization: config.hybridization,
      allowHybrids: sim.allowHybrids,
      energy: config.energy,
      foodRegen: config.world?.foodGrid?.regen,
      foodCapacity: config.world?.foodGrid?.capacity
    });
  }

  // Create FULL views for spatial queries (so we can see all entities)
  const fullPos = new Float32Array(buffers.positions);
  const fullAlive = new Uint8Array(buffers.alive);
  const fullTribeId = new Uint16Array(buffers.tribeIds);
  const fullGenes = new Float32Array(buffers.genes);
  const fullEnergy = new Float32Array(buffers.energy);
  const fullVel = new Float32Array(buffers.velocities);
  const fullAge = new Float32Array(buffers.ages);
  const fullColor = new Uint8Array(buffers.colors);
  const fullOrientation = new Float32Array(buffers.orientations);
  
  // Create sliced views for this worker's entities (for updates)
  const pos = new Float32Array(buffers.positions, bufferEntityStart * 2 * Float32Array.BYTES_PER_ELEMENT, cap * 2);
  const vel = new Float32Array(buffers.velocities, bufferEntityStart * 2 * Float32Array.BYTES_PER_ELEMENT, cap * 2);
  const color = new Uint8Array(buffers.colors, bufferEntityStart * 3, cap * 3);
  const alive = new Uint8Array(buffers.alive, bufferEntityStart, cap);
  const energy = new Float32Array(buffers.energy, bufferEntityStart * Float32Array.BYTES_PER_ELEMENT, cap);
  const age = new Float32Array(buffers.ages, bufferEntityStart * Float32Array.BYTES_PER_ELEMENT, cap);
  const tribeId = new Uint16Array(buffers.tribeIds, bufferEntityStart * Uint16Array.BYTES_PER_ELEMENT, cap);
  const genes = new Float32Array(buffers.genes, bufferEntityStart * 9 * Float32Array.BYTES_PER_ELEMENT, cap * 9);
  const orientation = new Float32Array(buffers.orientations, bufferEntityStart * Float32Array.BYTES_PER_ELEMENT, cap);
  
  // Use shared buffers for entity system (sliced for updates)
  sim.entities = new EntitySystem(cap, {
    pos, vel, color, alive, energy, age, tribeId, genes, orientation
  });
  
  // Store full views for spatial queries
  sim.fullPos = fullPos;
  sim.fullAlive = fullAlive;
  sim.fullTribeId = fullTribeId;
  sim.fullGenes = fullGenes;
  sim.fullEnergy = fullEnergy;
  sim.fullVel = fullVel;
  sim.fullAge = fullAge;
  sim.fullColor = fullColor;
  sim.fullOrientation = fullOrientation;
  
  // Initialize food system with shared buffer
  if (buffers.foodGrid && config.world?.foodGrid) {
    const { cols, rows, regen, capacity } = config.world.foodGrid;
    const actualRegen = regen || 0.08;
    const actualCapacity = capacity || 3;
    const foodGridUint8 = new Uint8Array(buffers.foodGrid);
    sim.food = new FoodSystem(cols, rows, worldWidth, worldHeight, actualRegen, foodGridUint8);
    
    // Only worker 0 initializes the food grid with distribution config
    if (workerId === 0) {
      sim.food.initialize(seed, actualCapacity, config.world.foodGrid.distribution);
      console.log(`[Worker 0] Initialized food with capacity=${actualCapacity}, regen=${actualRegen}, distribution=`, config.world.foodGrid.distribution);
      console.log(`[Worker 0] Energy config:`, config.energy);
    } else {
      // Other workers sync from the shared buffer
      sim.food.syncFromUint8();
    }
  }
  
  // CRITICAL FIX: Worker 0 spawns ALL entities to shared buffers
  // Other workers just read the already-spawned entities
  if (config.tribes && workerId === 0) {
    const rand = createRng(seed);
    let totalIdx = 0;
    
    config.tribes.forEach((tribe: any, tribeIdx: number) => {
      const count = tribe.count || 100;
      const spawn = tribe.spawn || { 
        x: worldWidth * (0.2 + 0.6 * (tribeIdx * 0.333 % 1)), 
        y: worldHeight * (0.2 + 0.6 * ((tribeIdx * 0.577) % 1))
      };
      // Scale radius with population - moderate spacing
      const baseRadius = tribe.spawn?.radius || 250; // Moderate base radius
      const populationScale = Math.sqrt(count / 350); // Balanced scaling
      const radius = Math.max(baseRadius, baseRadius * populationScale); // Standard scaling
      // Default to adaptive pattern for better emergent behavior
      const pattern = tribe.spawn?.pattern || 'adaptive';
      const geneSpec = { ...defaultGenes, ...tribe.genes };
      
      // Log spawn details for first tribe to debug
      if (tribeIdx === 0) {
        console.log(`[Worker 0] Spawning ${tribe.name}: pattern="${pattern}", radius=${radius}, count=${count}, diet=${geneSpec.diet}`);
      }

      // Natural spawn distribution: start with even distribution, then adjust for traits
      const getSpawnPosition = (index: number) => {
        // Step 1: Create natural initial distribution (even spread within radius)
        const baseAngle = rand() * Math.PI * 2;
        const baseR = Math.sqrt(rand()) * radius; // Even distribution
        const baseX = spawn.x + Math.cos(baseAngle) * baseR;
        const baseY = spawn.y + Math.sin(baseAngle) * baseR;
        
        // Step 2: Apply trait-based adjustments
        const diet = geneSpec.diet || 0;
        const herbivoreLevel = Math.max(0, -diet); // 0 to 1 for herbivore strength
        const carnivoreLevel = Math.max(0, diet);  // 0 to 1 for carnivore strength
        const cohesion = geneSpec.cohesion || 0.5;
        const aggression = geneSpec.aggression || 0.3;
        
        // Step 3: Calculate clustering tendency based on traits
        let clusteringStrength = 0.5; // Base clustering
        
        // Herbivores cluster more (safety in numbers)
        clusteringStrength += herbivoreLevel * 0.4;
        // High cohesion increases clustering
        clusteringStrength += cohesion * 0.3;
        // Carnivores spread out MUCH more (territorial)
        clusteringStrength -= carnivoreLevel * 0.7;  // Increased from 0.5
        // High aggression reduces clustering (territorial behavior)
        clusteringStrength -= aggression * 0.4;  // Increased from 0.3
        
        // Clamp to reasonable range
        clusteringStrength = Math.max(0.1, Math.min(0.9, clusteringStrength));

        // Step 4: Apply clustering/spreading based on calculated tendency
        if (clusteringStrength > 0.7) {
          // Strong clustering: form herds
          const herdCount = 3 + Math.floor(rand() * 3); // 3-5 herds
          const herdIndex = Math.floor(index * herdCount / count);
          const herdAngle = (herdIndex / herdCount) * Math.PI * 2 + rand() * 0.4;
          const herdDist = radius * (0.6 + rand() * 0.2);
          const herdCenterX = spawn.x + Math.cos(herdAngle) * herdDist;
          const herdCenterY = spawn.y + Math.sin(herdAngle) * herdDist;
          
          // Position within herd
          const localAngle = rand() * Math.PI * 2;
          const localR = Math.sqrt(rand()) * radius * 0.3; // Tight herd
          return {
            x: herdCenterX + Math.cos(localAngle) * localR,
            y: herdCenterY + Math.sin(localAngle) * localR
          };
        } else if (clusteringStrength < 0.3) {
          // Strong dispersal: territorial spacing for carnivores
          // Create territories but keep them within reproduction range (~100 units vision)
          // Form loose groups of 2-4 individuals that can still interact
          const territoryGroups = Math.ceil(count / 3); // Small territorial groups
          const groupIndex = Math.floor(index / 3);
          const withinGroupIndex = index % 3;
          
          // Spread territory groups across a wider area
          const territoryAngle = (groupIndex / territoryGroups) * Math.PI * 2 + rand() * 0.5;
          const territoryDist = radius * (1.5 + rand() * 1.5); // 1.5x to 3x radius
          const territoryCenterX = spawn.x + Math.cos(territoryAngle) * territoryDist;
          const territoryCenterY = spawn.y + Math.sin(territoryAngle) * territoryDist;
          
          // Within each territory, space individuals but keep them in reproduction range
          const localAngle = (withinGroupIndex / 3) * Math.PI * 2 + rand() * 0.3;
          const localDist = 40 + rand() * 40; // 40-80 units apart (within vision range)
          
          return {
            x: territoryCenterX + Math.cos(localAngle) * localDist,
            y: territoryCenterY + Math.sin(localAngle) * localDist
          };
        } else {
          // Moderate clustering: natural distribution with slight grouping
          const groupingFactor = Math.pow(rand(), 1.0 - clusteringStrength);
          const adjustedR = baseR * groupingFactor;
          const jitterX = (rand() - 0.5) * 10;
          const jitterY = (rand() - 0.5) * 10;
          return {
            x: spawn.x + Math.cos(baseAngle) * adjustedR + jitterX,
            y: spawn.y + Math.sin(baseAngle) * adjustedR + jitterY
          };
        }
      };

      for (let i = 0; i < count && totalIdx < totalCap; i++) {
        const pos = getSpawnPosition(i);
        // Apply world wrapping to ensure entities spawn within bounds
        const x = ((pos.x % worldWidth) + worldWidth) % worldWidth;
        const y = ((pos.y % worldHeight) + worldHeight) % worldHeight;
        
        // Spawn directly to full buffers with wrapped coordinates
        fullPos[totalIdx * 2] = x;
        fullPos[totalIdx * 2 + 1] = y;
        fullAlive[totalIdx] = 1;
        fullTribeId[totalIdx] = tribeIdx;
        // Add variance to prevent synchronized deaths
        const baseEnergy = config.energy?.start || 50;
        const energyVariance = baseEnergy * 0.3; // ±30% variance
        fullEnergy[totalIdx] = Math.max(10, baseEnergy + (rand() - 0.5) * 2 * energyVariance);
        
        // Random initial age (0-60% of typical lifespan to spread out deaths)
        // Lifespan varies by metabolism - higher metabolism = shorter life
        const metabolismFactor = 1 + (geneSpec.metabolism - 0.15) * 2; // 0.7x to 1.3x based on metabolism
        const baseLifespan = 80; // seconds at average metabolism
        const adjustedLifespan = baseLifespan / metabolismFactor; // 60-115 seconds typically
        
        // Start entities at different life stages for natural population dynamics
        // Using a beta distribution-like approach for more realistic age distribution
        const ageRoll1 = rand();
        const ageRoll2 = rand();
        const ageFactor = (ageRoll1 + ageRoll2) / 2; // Tends toward middle values
        fullAge[totalIdx] = ageFactor * adjustedLifespan * 0.6; // 0-60% of their expected lifespan
        fullOrientation[totalIdx] = rand() * Math.PI * 2;
        
        // Set color based on tribe
        const hue = geneSpec.colorHue || (tribeIdx * 120);
        const rgb = hslToRgb(hue / 360, 0.8, 0.5);
        fullColor[totalIdx * 3] = rgb[0];
        fullColor[totalIdx * 3 + 1] = rgb[1];
        fullColor[totalIdx * 3 + 2] = rgb[2];
        
        // Set genes in full buffer
        const base = totalIdx * 9;
        fullGenes[base] = geneSpec.speed;
        fullGenes[base + 1] = geneSpec.vision;
        fullGenes[base + 2] = geneSpec.metabolism;
        fullGenes[base + 3] = geneSpec.reproChance;
        fullGenes[base + 4] = geneSpec.aggression;
        fullGenes[base + 5] = geneSpec.cohesion;
        fullGenes[base + 6] = geneSpec.foodStandards;
        fullGenes[base + 7] = geneSpec.diet;
        fullGenes[base + 8] = geneSpec.viewAngle;
        
        totalIdx++;
      }
    });
    
    console.log(`[Worker 0] Spawned ${totalIdx} entities total across all tribes`);
    sim.count = totalIdx;  // Track total for spatial processing
  } else {
    // Other workers: count entities already spawned by worker 0
    let count = 0;
    for (let i = 0; i < totalCap; i++) {
      if (fullAlive[i]) count++;
    }
    sim.count = count;
    console.log(`[Worker ${workerId}] Found ${count} entities already spawned`);
  }
  
  // Send ready signal
  console.log(`[Worker ${workerId}] Sending ready signal`);
  self.postMessage({ type: 'worker-ready', payload: { workerId } });
  
  startMainLoop();
  
  // Start sending stats periodically to coordinator
  setInterval(() => {
    if (sim) {
      const stats = sim.getStats();
      self.postMessage({ type: 'worker-stats', payload: { workerId, stats } });
    }
  }, 250); // Send stats every 250ms in multi-worker mode
}

function startMainLoop() {
  lastTime = performance.now();
  
  // Use setTimeout(0) for maximum performance
  const tick = () => {
    try {
      mainLoop(performance.now());
      // Schedule next tick immediately
      setTimeout(tick, 0);
    } catch (error) {
      console.error(`[Worker ${workerId}] Main loop crashed:`, error);
      console.error(`[Worker ${workerId}] Stack:`, error.stack);
      // Try to recover
      setTimeout(tick, 16);
    }
  };
  
  tick();
}

function mainLoop(now: number) {
  try {
    if (!sim) {
      return;
    }
    
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    
    // Remove debug spam
    
    // Fixed timestep with accumulator
    accumulator += dt * sim.speedMul;
    let steps = 0;
  
  while (accumulator >= FIXED_TIMESTEP && steps < MAX_STEPS_PER_FRAME) {
    const stepStart = performance.now();
    
    if (!sim.paused) {
      sim.step(FIXED_TIMESTEP);
      stepCount++;
      
      // Check for extinction (all entities dead)
      const stats = sim.getStats();
      if (stats.population === 0 && !isSubWorker) {
        // Send extinction event to main thread
        self.postMessage({
          type: 'extinction',
          payload: {
            finalTime: sim.time,
            finalStats: stats
          }
        } as MainMsg);
        
        // Pause the simulation
        sim.paused = true;
      }
    }
    
    const stepTime = performance.now() - stepStart;
    stepTimeAccum += stepTime;
    maxStepTime = Math.max(maxStepTime, stepTime);
    
    accumulator -= FIXED_TIMESTEP;
    steps++;
  }
  
  frameCount++;
  
  // Update performance stats
  if (now - lastPerfUpdate > 250) {
    simHz = stepCount * 4;
    stepCount = 0;
    
    // Send performance stats
    if (!isSubWorker) {
      const avgStepTime = frameCount > 0 ? stepTimeAccum / frameCount : 0;
      const perfStats: PerfStats = {
        simHz,
        renderFps,
        entityCount: sim.count,
        avgStepTime,
        maxStepTime,
        workerCount: 1
      };
      
      self.postMessage({
        type: 'perf',
        payload: perfStats
      } as MainMsg);
    }
    
    lastPerfUpdate = now;
    frameCount = 0;
    stepTimeAccum = 0;
    maxStepTime = 0;
  }
  } catch (error) {
    console.error(`[Worker ${workerId}] MainLoop crashed:`, error);
    console.error(`[Worker ${workerId}] Stack:`, error.stack);
    // Don't crash the worker, just log and continue
  }
}

// Message handler
self.addEventListener('message', (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'init':
      initializeAsMainWorker(msg);
      break;
      
    case 'init-sub-worker':
      initializeAsSubWorker(msg);
      break;
      
    case 'setSpeed':
      if (sim) {
        sim.speedMul = msg.payload.speedMul;
      }
      break;
      
    case 'pause':
      if (sim) {
        sim.paused = msg.payload.paused;
      }
      break;
      
    case 'stats':
      if (sim) {
        const stats = sim.getStats();
        if (isSubWorker) {
          // Sub-workers send stats to coordinator
          self.postMessage({ type: 'worker-stats', payload: { workerId, stats } });
        } else {
          // Main worker sends directly to main thread
          self.postMessage({ type: 'stats', payload: stats } as MainMsg);
        }
      }
      break;
      
    case 'renderFps':
      renderFps = msg.payload.fps;
      break;
      
    case 'updateFoodParams':
      if (sim && sim.food) {
        const { capacity, regen } = msg.payload;
        if (capacity !== undefined) {
          // Update the capacity parameter for proper rendering
          sim.food.setCapacityParameter(capacity);
        }
        if (regen !== undefined) {
          // Update the regen rate
          sim.food.regen = regen;
        }
      }
      break;
      
    case 'perf':
      if (sim && isSubWorker) {
        // Sub-workers send perf stats to coordinator
        const avgStepTime = frameCount > 0 ? stepTimeAccum / frameCount : 0;
        self.postMessage({
          type: 'worker-perf',
          payload: {
            workerId,
            simHz,
            entityCount: sim.count,
            avgStepTime,
            maxStepTime
          }
        });
      }
      break;
  }
});