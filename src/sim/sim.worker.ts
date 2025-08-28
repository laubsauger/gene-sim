/// <reference lib="webworker" />
import { createRng } from './random';
import { clampGene, mutate, defaultGenes } from './genes';
import { SpatialHash } from './spatialHash';
import type { SimInit, WorkerMsg, MainMsg, SimStats, GeneSpec } from './types';

// Simulation state
let pos!: Float32Array, vel!: Float32Array, color!: Uint8Array, alive!: Uint8Array, tribeId!: Uint16Array;
let genes!: Float32Array; // packed [speed, vision, metabolism, repro]
let count = 0, cap = 0;
let rand = Math.random;
let t = 0, speedMul = 1, paused = false;
let grid!: SpatialHash;
let tribeNames: string[] = [];
let tribeColors: number[] = [];
let birthsByTribe: Uint32Array, deathsByTribe: Uint32Array;
let world = { width: 1000, height: 1000 };

const G = 4; // floats per entity in genes array

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

function spawnEntity(i: number, x: number, y: number, g: GeneSpec, tribeIx: number) {
  pos[i * 2] = x;
  pos[i * 2 + 1] = y;
  
  const ang = rand() * Math.PI * 2;
  const sp = g.speed * (0.6 + rand() * 0.8);
  vel[i * 2] = Math.cos(ang) * sp;
  vel[i * 2 + 1] = Math.sin(ang) * sp;
  
  alive[i] = 1;
  tribeId[i] = tribeIx;
  
  const base = i * G;
  genes[base] = g.speed;
  genes[base + 1] = g.vision;
  genes[base + 2] = g.metabolism;
  genes[base + 3] = g.reproChance;
  
  const [r, gc, b] = hueToRgb(g.colorHue);
  color[i * 3] = r | 0;
  color[i * 3 + 1] = gc | 0;
  color[i * 3 + 2] = b | 0;
}

function step(dt: number) {
  if (paused) return;
  
  const n = count;
  t += dt * speedMul;
  
  // Simple behavior: random drift + boundary wrap + occasional reproduction
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue;
    
    const base = i * G;
    const sp = genes[base];
    const metab = genes[base + 2];
    const repro = genes[base + 3];
    
    // Jitter velocity
    const jx = (rand() * 2 - 1) * sp * 0.5;
    const jy = (rand() * 2 - 1) * sp * 0.5;
    vel[i * 2] += jx * dt;
    vel[i * 2 + 1] += jy * dt;
    
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
    
    // Wrap around boundaries
    if (pos[i * 2] < 0) pos[i * 2] += world.width;
    else if (pos[i * 2] > world.width) pos[i * 2] -= world.width;
    
    if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] += world.height;
    else if (pos[i * 2 + 1] > world.height) pos[i * 2 + 1] -= world.height;
    
    // Death chance from metabolism
    if (rand() < metab * dt * 0.001) {
      alive[i] = 0;
      deathsByTribe[tribeId[i]]++;
    }
    
    // Reproduction
    if (alive[i] && rand() < repro * dt) {
      // Find a free slot
      for (let j = 0; j < cap; j++) {
        if (!alive[j]) {
          const childGenes: GeneSpec = {
            speed: genes[base],
            vision: genes[base + 1],
            metabolism: genes[base + 2],
            reproChance: genes[base + 3],
            colorHue: tribeColors[tribeId[i]],
          };
          
          const mutatedGenes = mutate(childGenes, rand, 0.02);
          spawnEntity(j, pos[i * 2], pos[i * 2 + 1], mutatedGenes, tribeId[i]);
          birthsByTribe[tribeId[i]]++;
          if (j >= count) count = j + 1;
          break;
        }
      }
    }
  }
}

function stats(): SimStats {
  const byTribe: SimStats['byTribe'] = {};
  let aliveCount = 0, meanS = 0, meanV = 0, meanM = 0;
  
  for (let i = 0; i < count; i++) {
    if (alive[i]) {
      aliveCount++;
      const base = i * G;
      meanS += genes[base];
      meanV += genes[base + 1];
      meanM += genes[base + 2];
      
      const name = tribeNames[tribeId[i]] || 'Unknown';
      if (!byTribe[name]) {
        const [r, g, b] = hueToRgb(tribeColors[tribeId[i]] || 0);
        byTribe[name] = {
          count: 0,
          births: birthsByTribe[tribeId[i]] || 0,
          deaths: deathsByTribe[tribeId[i]] || 0,
          color: `rgb(${r},${g},${b})`,
        };
      }
      byTribe[name].count++;
    }
  }
  
  const inv = 1 / Math.max(1, aliveCount);
  return {
    t,
    population: aliveCount,
    byTribe,
    mean: {
      speed: meanS * inv,
      vision: meanV * inv,
      metabolism: meanM * inv,
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
    
    pos = new Float32Array(sabPos);
    vel = new Float32Array(sabVel);
    color = new Uint8Array(sabCol);
    alive = new Uint8Array(sabAlive);
    tribeId = new Uint16Array(sabTribe);
    genes = new Float32Array(sabGenes);
    
    birthsByTribe = new Uint32Array(init.tribes.length);
    deathsByTribe = new Uint32Array(init.tribes.length);
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
    
    // Main simulation loop
    let last = performance.now();
    let lastStatsTime = 0;
    const tick = () => {
      const now = performance.now();
      let dt = Math.min(0.1, (now - last) / 1000); // cap large pause
      last = now;
      
      if (!paused && speedMul > 0) {
        // Multiple micro-steps for stability at high speed
        const stepDt = 1 / 60;
        let acc = dt * speedMul;
        while (acc > 0) {
          const h = Math.min(stepDt, acc);
          step(h);
          acc -= h;
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
  }
};