/// <reference lib="webworker" />
import { createRng } from './random';
import { clampGene, mutate, defaultGenes } from './genes';
import { SpatialHash } from './spatialHash';
import { efficientMovement } from './spatialBehaviors';
import type { WorkerMsg, MainMsg, SimStats, GeneSpec, TribeStats, SimInit } from './types';

// Simulation state
let pos!: Float32Array, vel!: Float32Array, color!: Uint8Array, alive!: Uint8Array, tribeId!: Uint16Array;
let genes!: Float32Array; // packed [speed, vision, metabolism, repro, aggression, cohesion]
let energy!: Float32Array; // energy level per entity
let age!: Float32Array; // age in simulation time units
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

// Food grid
let foodGrid!: Float32Array;
let foodCols = 0, foodRows = 0;
let foodRegen = 0.1, foodCapacity = 1;

const G = 6; // floats per entity in genes array (speed, vision, metabolism, repro, aggression, cohesion)

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
  const sp = g.speed * (0.6 + rand() * 0.8);
  vel[i * 2] = Math.cos(ang) * sp;
  vel[i * 2 + 1] = Math.sin(ang) * sp;
  
  alive[i] = 1;
  tribeId[i] = tribeIx;
  energy[i] = initialEnergy;
  age[i] = initialAge;
  
  const base = i * G;
  genes[base] = g.speed;
  genes[base + 1] = g.vision;
  genes[base + 2] = g.metabolism;
  genes[base + 3] = g.reproChance;
  genes[base + 4] = g.aggression;
  genes[base + 5] = g.cohesion;
  
  const [r, gc, b] = hueToRgb(g.colorHue);
  color[i * 3] = r | 0;
  color[i * 3 + 1] = gc | 0;
  color[i * 3 + 2] = b | 0;
}

function step(dt: number) {
  if (paused) return;
  
  const n = count;
  t += dt * speedMul;
  
  // Rebuild spatial grid for efficient neighbor queries
  grid.rebuild(pos, alive, count);
  
  // Regenerate food with central lush area
  const centerX = foodCols / 2;
  const centerY = foodRows / 2;
  const lushRadius = foodCols / 4; // Central quarter is lush
  
  for (let y = 0; y < foodRows; y++) {
    for (let x = 0; x < foodCols; x++) {
      const i = y * foodCols + x;
      const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      // Central area regenerates faster and has higher capacity
      const isLush = distFromCenter < lushRadius;
      const localCap = isLush ? foodCapacity * 2 : foodCapacity * 0.5;
      const localRegen = isLush ? foodRegen * 3 : foodRegen * 0.5;
      
      if (foodGrid[i] < localCap) {
        foodGrid[i] = Math.min(localCap, foodGrid[i] + localRegen * dt);
      }
    }
  }
  
  // Update entities
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    
    const base = i * G;
    const sp = genes[base];
    // const vision = genes[base + 1]; // unused but kept for future use
    const metab = genes[base + 2];
    const repro = genes[base + 3];
    
    // Age entity
    age[i] += dt;
    
    // Update color brightness based on age (0-20s bright, 20-40s normal, 40-60s darker, 60+ very dark)
    const ageInDays = age[i] / 10; // 10 sim seconds = 1 "day"
    let brightness = 1.0;
    if (ageInDays < 2) {
      brightness = 1.2; // Young - brighter
    } else if (ageInDays < 4) {
      brightness = 1.0; // Adult - normal
    } else if (ageInDays < 6) {
      brightness = 0.7; // Old - darker
    } else {
      brightness = 0.5; // Very old - very dark
    }
    
    // Get base color from tribe
    const tribeHue = tribeColors[tribeId[i]] || 0;
    const [r, g, b] = hueToRgb(tribeHue);
    color[i * 3] = Math.min(255, (r * brightness) | 0);
    color[i * 3 + 1] = Math.min(255, (g * brightness) | 0);
    color[i * 3 + 2] = Math.min(255, (b * brightness) | 0);
    
    // Energy consumption increases with age
    const ageFactor = 1 + (age[i] / 100); // Older entities consume more energy
    const moveCost = sp * 0.02;
    energy[i] -= (metab * 2 + moveCost) * dt * ageFactor;
    
    // Check food at current position
    const fx = Math.floor((pos[i * 2] / world.width) * foodCols);
    const fy = Math.floor((pos[i * 2 + 1] / world.height) * foodRows);
    if (fx >= 0 && fx < foodCols && fy >= 0 && fy < foodRows) {
      const foodIdx = fy * foodCols + fx;
      if (foodGrid[foodIdx] > 0) {
        // Eat food
        const eaten = Math.min(foodGrid[foodIdx], 1.0 * dt);
        foodGrid[foodIdx] -= eaten;
        energy[i] += eaten * 20; // Convert food to energy
        energy[i] = Math.min(energy[i], 100); // Max energy cap
      }
    }
    
    // Use spatial hashing for efficient movement and combat
    efficientMovement(
      i, pos, vel, alive, energy, tribeId, genes, grid,
      foodGrid, foodCols, foodRows, world, rand, dt,
      killsByTribe, deathsByTribe, color, birthsByTribe
    );
    
    // Clamp speed
    let vx = vel[i * 2], vy = vel[i * 2 + 1];
    const vlen = Math.hypot(vx, vy) || 1e-6;
    const vmax = sp;
    if (vlen > vmax) {
      vx = vx / vlen * vmax;
      vy = vy / vlen * vmax;
      vel[i * 2] = vx;
      vel[i * 2 + 1] = vy;
    }
    
    // Integrate position
    pos[i * 2] += vx * dt;
    pos[i * 2 + 1] += vy * dt;
    
    // Hard boundaries - bounce off walls
    if (pos[i * 2] < 0) {
      pos[i * 2] = 0;
      vel[i * 2] = Math.abs(vel[i * 2]); // Reverse X velocity
    } else if (pos[i * 2] > world.width) {
      pos[i * 2] = world.width;
      vel[i * 2] = -Math.abs(vel[i * 2]); // Reverse X velocity
    }
    
    if (pos[i * 2 + 1] < 0) {
      pos[i * 2 + 1] = 0;
      vel[i * 2 + 1] = Math.abs(vel[i * 2 + 1]); // Reverse Y velocity
    } else if (pos[i * 2 + 1] > world.height) {
      pos[i * 2 + 1] = world.height;
      vel[i * 2 + 1] = -Math.abs(vel[i * 2 + 1]); // Reverse Y velocity
    }
    
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
    
    // Reproduction - requires more energy due to faster starvation
    if (alive[i] && energy[i] > 70 && rand() < repro * dt) {
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
            colorHue: tribeColors[tribeId[i]],
          };
          
          const mutatedGenes = mutate(childGenes, rand, 0.02);
          // Parent gives energy to child
          energy[i] -= 30;
          spawnEntity(j, pos[i * 2], pos[i * 2 + 1], mutatedGenes, tribeId[i], 30);
          birthsByTribe[tribeId[i]]++;
          if (j >= count) count = j + 1;
          break;
        }
      }
    }
  }
}

function stats(): SimStats {
  const byTribe: Record<string, TribeStats> = {};
  const tribeData: Record<string, number[][]> = {}; // Store gene values per tribe
  
  let aliveCount = 0;
  const globalGenes: number[][] = [[], [], [], [], [], []]; // speed, vision, metab, repro, aggro, cohesion
  
  // Collect data
  for (let i = 0; i < count; i++) {
    if (alive[i]) {
      aliveCount++;
      const base = i * G;
      const tribeName = tribeNames[tribeId[i]] || 'Unknown';
      
      // Initialize tribe data if needed
      if (!tribeData[tribeName]) {
        tribeData[tribeName] = [[], [], [], [], [], []];
      }
      
      // Collect gene values (speed, vision, metabolism, reproChance, aggression, cohesion)
      tribeData[tribeName][0].push(genes[base]);        // speed
      tribeData[tribeName][1].push(genes[base + 1]);    // vision
      tribeData[tribeName][2].push(genes[base + 2]);    // metabolism
      tribeData[tribeName][3].push(genes[base + 3]);    // reproChance
      tribeData[tribeName][4].push(genes[base + 4]);    // aggression
      tribeData[tribeName][5].push(genes[base + 5]);    // cohesion
      
      globalGenes[0].push(genes[base]);
      globalGenes[1].push(genes[base + 1]);
      globalGenes[2].push(genes[base + 2]);
      globalGenes[3].push(genes[base + 3]);
      globalGenes[4].push(genes[base + 4]);
      globalGenes[5].push(genes[base + 5]);
    }
  }
  
  // Helper to calculate statistics
  const calcStats = (values: number[]) => {
    if (values.length === 0) return { min: 0, max: 0, mean: 0, std: 0 };
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance);
    
    return { mean, min, max, std };
  };
  
  // Process each tribe
  for (const [tribeName, geneArrays] of Object.entries(tribeData)) {
    const tribeIndex = tribeNames.indexOf(tribeName);
    const [r, g, b] = hueToRgb(tribeColors[tribeIndex] || 0);
    
    const speedStats = calcStats(geneArrays[0]);
    const visionStats = calcStats(geneArrays[1]);
    const metabStats = calcStats(geneArrays[2]);
    const reproStats = calcStats(geneArrays[3]);
    const aggroStats = calcStats(geneArrays[4]);
    const cohesionStats = calcStats(geneArrays[5]);
    
    byTribe[tribeName] = {
      count: geneArrays[0].length,
      births: birthsByTribe[tribeIndex] || 0,
      deaths: deathsByTribe[tribeIndex] || 0,
      color: `rgb(${r},${g},${b})`,
      mean: {
        speed: speedStats.mean,
        vision: visionStats.mean,
        metabolism: metabStats.mean,
        aggression: aggroStats.mean,
        cohesion: cohesionStats.mean,
        reproChance: reproStats.mean,
      },
      distribution: {
        speed: { min: speedStats.min, max: speedStats.max, std: speedStats.std },
        vision: { min: visionStats.min, max: visionStats.max, std: visionStats.std },
        metabolism: { min: metabStats.min, max: metabStats.max, std: metabStats.std },
        aggression: { min: aggroStats.min, max: aggroStats.max, std: aggroStats.std },
        cohesion: { min: cohesionStats.min, max: cohesionStats.max, std: cohesionStats.std },
        reproChance: { min: reproStats.min, max: reproStats.max, std: reproStats.std },
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
      },
      distribution: {
        speed: { min: globalSpeed.min, max: globalSpeed.max, std: globalSpeed.std },
        vision: { min: globalVision.min, max: globalVision.max, std: globalVision.std },
        metabolism: { min: globalMetab.min, max: globalMetab.max, std: globalMetab.std },
        aggression: { min: globalAggro.min, max: globalAggro.max, std: globalAggro.std },
        cohesion: { min: globalCohesion.min, max: globalCohesion.max, std: globalCohesion.std },
        reproChance: { min: globalRepro.min, max: globalRepro.max, std: globalRepro.std },
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
    
    // Initialize food grid
    foodCols = init.world.foodGrid?.cols || 64;
    foodRows = init.world.foodGrid?.rows || 64;
    foodRegen = init.world.foodGrid?.regen || 0.1;
    foodCapacity = init.world.foodGrid?.capacity || 1;
    foodGrid = new Float32Array(foodCols * foodRows);
    // Start with some food
    for (let i = 0; i < foodGrid.length; i++) {
      foodGrid[i] = foodCapacity * 0.5;
    }
    
    birthsByTribe = new Uint32Array(init.tribes.length);
    deathsByTribe = new Uint32Array(init.tribes.length);
    killsByTribe = new Uint32Array(init.tribes.length);
    starvedByTribe = new Uint32Array(init.tribes.length);
    tribeNames = init.tribes.map(t => t.name);
    tribeColors = [];
    
    // Initialize RNG
    rand = createRng(init.seed);
    
    // Spawn tribes
    count = 0;
    init.tribes.forEach((tribe, ix) => {
      const baseGenes = clampGene({
        ...defaultGenes,
        ...tribe.genes,
      });
      tribeColors[ix] = baseGenes.colorHue;
      
      for (let i = 0; i < tribe.count; i++) {
        if (count >= cap) break;
        const ang = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * tribe.spawn.radius;
        const x = tribe.spawn.x + Math.cos(ang) * r;
        const y = tribe.spawn.y + Math.sin(ang) * r;
        spawnEntity(count++, x, y, baseGenes, ix);
      }
    });
    
    grid = new SpatialHash(world.width, world.height, 16, cap);
    
    // Send ready message with SABs
    const payload: MainMsg = {
      type: 'ready',
      payload: {
        sab: { pos: sabPos, color: sabCol, alive: sabAlive },
        meta: { count },
      },
    };
    self.postMessage(payload);
    
    // Main simulation loop with performance tracking
    let last = performance.now();
    let lastStatsTime = 0;
    let lastPerfTime = 0;
    let simSteps = 0;
    
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000); // cap large pause
      last = now;
      
      if (!paused && speedMul > 0) {
        // Simple fixed timestep for smooth movement
        const simDt = dt * speedMul * 3; // Triple effective speed
        step(simDt);
        simSteps++;
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