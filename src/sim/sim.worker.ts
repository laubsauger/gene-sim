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
const MAX_STEPS_PER_FRAME = 4;

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
  sim.allowHybrids = init.allowHybrids !== false;
  
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
    const { cols, rows, capacity = 1, distribution } = init.world.foodGrid;
    sharedBuffers.foodGrid = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cols * rows);
    
    // Replace the default FoodSystem with one using the shared buffer
    const foodGridUint8 = new Uint8Array(sharedBuffers.foodGrid);
    sim.food = new FoodSystem(cols, rows, worldWidth, worldHeight, 0.05, foodGridUint8);
    
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
  sim.allowHybrids = config.allowHybrids !== false;
  sim.updateFood = workerId === 0;  // Only worker 0 handles food regrowth (but syncs from shared buffer first)
  sim.tribeNames = config.tribes?.map((t: any) => t.name) || [];
  sim.tribeColors = config.tribes?.map((t: any) => t.genes?.colorHue || 0) || [];
  sim.workerRegion = workerRegion;
  sim.isMultiWorker = true;
  
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
      const radius = tribe.spawn?.radius || 200;
      const geneSpec = { ...defaultGenes, ...tribe.genes };
      
      for (let i = 0; i < count && totalIdx < totalCap; i++) {
        const angle = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * radius;
        const x = spawn.x + Math.cos(angle) * r;
        const y = spawn.y + Math.sin(angle) * r;
        
        // Spawn directly to full buffers
        fullPos[totalIdx * 2] = x;
        fullPos[totalIdx * 2 + 1] = y;
        fullAlive[totalIdx] = 1;
        fullTribeId[totalIdx] = tribeIdx;
        fullEnergy[totalIdx] = config.energy?.start || 50;
        fullAge[totalIdx] = 0;
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
  
  // Workers don't support requestAnimationFrame, use setInterval
  const targetFPS = 60;
  const interval = 1000 / targetFPS;
  
  setInterval(() => {
    try {
      mainLoop(performance.now());
    } catch (error) {
      console.error(`[Worker ${workerId}] SetInterval callback crashed:`, error);
      console.error(`[Worker ${workerId}] Stack:`, error.stack);
    }
  }, interval);
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