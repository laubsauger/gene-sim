/// <reference lib="webworker" />
import { loadWasmModule, isWasmSupported } from './wasmLoader';
import type { WorkerMsg, MainMsg } from './types';
import { updateSubWorkerEntities } from './subWorkerSimulation';

// Import the JavaScript implementation as fallback
import './sim.worker'; // This will be our fallback

let wasmCore: any = null;
let jsWorker: Worker | null = null;
let isSubWorker = false;
let workerId = -1;
let entityStart = 0;
let entityEnd = 0;
let sharedBuffers: any = null;
let foodBuffer: Uint8Array | null = null;
let foodCols = 0;
let foodRows = 0;

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

// Performance tracking
const perfStats = {
  wasm: {
    movement: 0,
    spatialHash: 0,
    physics: 0,
    total: 0,
  },
  js: {
    movement: 0,
    spatialHash: 0,
    physics: 0,
    total: 0,
  },
  samples: 0,
};

/**
 * Initialize the hybrid worker (WASM if available, JS fallback)
 */
async function initHybridWorker(msg: WorkerMsg) {
  if (msg.type !== 'init') return;
  
  const init: any = msg.payload;
  
  // Check if this is a sub-worker from coordinator
  if (init.sharedBuffers && init.workerId !== undefined) {
    isSubWorker = true;
    workerId = init.workerId;
    entityStart = init.entityStart;
    entityEnd = init.entityEnd;
    sharedBuffers = init.sharedBuffers;
    
    // Use actual entity range for initialization
    const actualStart = init.actualEntityStart || entityStart;
    const actualEnd = init.actualEntityEnd || entityEnd;
    
    // Handle food buffer if provided
    if (init.foodBuffer) {
      foodBuffer = new Uint8Array(init.foodBuffer);
      foodCols = init.foodMeta?.cols || 256;
      foodRows = init.foodMeta?.rows || 256;
    }
    
    console.log(`[Sub-Worker ${workerId}] Buffer: ${entityStart}-${entityEnd}, Initializing actual: ${actualStart}-${actualEnd}`);
    
    // Initialize as sub-worker using coordinator's buffers
    if (isWasmSupported() && init.useWasm !== false) {
      try {
        console.log(`[Sub-Worker ${workerId}] Loading WASM module...`);
        const wasmModule = await loadWasmModule();
        
        // Create WASM core for our entity range
        const entityCount = entityEnd - entityStart;
        wasmCore = new wasmModule.SimCore(
          entityCount,
          init.world.width,
          init.world.height,
          80 // Cell size for spatial hash
        );
        
        console.log(`[Sub-Worker ${workerId}] WASM module loaded successfully`);
        initSubWorkerWasm(init);
      } catch (error) {
        console.error(`[Sub-Worker ${workerId}] Failed to load WASM:`, error);
        initSubWorkerJs(init);
      }
    } else {
      initSubWorkerJs(init);
    }
  } else {
    // Standalone mode - use the regular JS worker with optional WASM acceleration
    console.log('[Hybrid Worker] Initializing in standalone mode...');
    
    // For now, just use the JS implementation until WASM is properly integrated
    // The proper approach is to use JS worker with WASM functions for hot paths
    console.log('[Hybrid Worker] Using JavaScript implementation');
    
    // Create a JS worker to handle the actual simulation
    jsWorker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    jsWorker.onmessage = (e) => {
      // Forward messages from JS worker to main thread
      self.postMessage(e.data);
    };
    
    // Forward the init message to the JS worker
    jsWorker.postMessage(msg);
  }
}

/**
 * Initialize sub-worker with WASM using coordinator's SharedArrayBuffers
 */
function initSubWorkerWasm(init: any) {
  // Use actual entity count if provided
  const actualStart = init.actualEntityStart ?? entityStart;  
  const actualEnd = init.actualEntityEnd ?? entityEnd;
  const entityCount = actualEnd - actualStart;
  
  // Create views into the coordinator's SharedArrayBuffers for our entity range
  // Position buffer is interleaved x,y
  const posBuffer = new Float32Array(
    sharedBuffers.positions, 
    entityStart * 2 * Float32Array.BYTES_PER_ELEMENT, 
    entityCount * 2
  );
  
  const colorBuffer = new Uint8Array(
    sharedBuffers.colors, 
    entityStart * 3,
    entityCount * 3
  );
  
  const aliveBuffer = new Uint8Array(
    sharedBuffers.alive,
    entityStart,
    entityCount
  );
  
  const energyBuffer = new Float32Array(
    sharedBuffers.energy,
    entityStart * Float32Array.BYTES_PER_ELEMENT,
    entityCount
  );
  
  const genesBuffer = new Float32Array(
    sharedBuffers.genes,
    entityStart * 9 * Float32Array.BYTES_PER_ELEMENT,
    entityCount * 9
  );
  
  // Initialize entities based on tribes
  let localIdx = 0;
  const tribes = init.tribes || [];
  const entitiesPerTribe = Math.floor(entityCount / Math.max(tribes.length, 1));
  
  tribes.forEach((tribe: any, tribeIdx: number) => {
    const tribeEntityCount = Math.min(entitiesPerTribe, entityCount - localIdx);
    const { spawn, genes } = tribe;
    const pattern = spawn.pattern || 'blob';
    const diet = genes.diet || 0;
    const carnivoreLevel = Math.max(0, diet);
    const herbivoreLevel = Math.max(0, -diet);
    
    for (let i = 0; i < tribeEntityCount && localIdx < entityCount; i++) {
      let x: number, y: number;
      
      // Apply spawn pattern
      if (pattern === 'blob') {
        // Default circular blob
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawn.radius;
        x = spawn.x + Math.cos(ang) * r;
        y = spawn.y + Math.sin(ang) * r;
        
      } else if (pattern === 'scattered') {
        // Random scatter across entire map
        x = Math.random() * init.world.width;
        y = Math.random() * init.world.height;
        
      } else if (pattern === 'herd') {
        // Multiple small groups
        const numHerds = 4 + Math.floor(Math.random() * 4); // 4-7 herds
        const herdIndex = Math.floor(i * numHerds / tribeEntityCount);
        
        // Calculate herd center
        const baseAngle = (herdIndex / numHerds) * Math.PI * 2;
        const angleVariation = (Math.random() - 0.5) * Math.PI * 0.8;
        const herdAngle = baseAngle + angleVariation;
        const herdDistance = spawn.radius * (2 + Math.random() * 4); // 2-6x radius
        const herdCenterX = spawn.x + Math.cos(herdAngle) * herdDistance;
        const herdCenterY = spawn.y + Math.sin(herdAngle) * herdDistance;
        
        // Varied herd shapes
        const herdShape = Math.random();
        if (herdShape < 0.3) {
          // Tight circular cluster
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (spawn.radius * 0.2);
          x = herdCenterX + Math.cos(ang) * r;
          y = herdCenterY + Math.sin(ang) * r;
        } else if (herdShape < 0.6) {
          // Elongated herd
          const alongAngle = herdAngle + Math.PI / 2;
          const along = (Math.random() - 0.5) * spawn.radius * 0.8;
          const across = (Math.random() - 0.5) * spawn.radius * 0.2;
          x = herdCenterX + Math.cos(alongAngle) * along + Math.cos(herdAngle) * across;
          y = herdCenterY + Math.sin(alongAngle) * along + Math.sin(herdAngle) * across;
        } else {
          // Loose scatter around center
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (spawn.radius * 0.5);
          x = herdCenterX + Math.cos(ang) * r;
          y = herdCenterY + Math.sin(ang) * r;
        }
        
      } else if (pattern === 'adaptive') {
        // Pattern based on diet
        if (carnivoreLevel > 0.7) {
          // Carnivores: sparse, wide distribution
          if (Math.random() < 0.3) {
            // 30% on edges
            const edge = Math.floor(Math.random() * 4);
            switch (edge) {
              case 0: x = Math.random() * 200; y = Math.random() * init.world.height; break;
              case 1: x = init.world.width - Math.random() * 200; y = Math.random() * init.world.height; break;
              case 2: x = Math.random() * init.world.width; y = Math.random() * 200; break;
              default: x = Math.random() * init.world.width; y = init.world.height - Math.random() * 200; break;
            }
          } else {
            // 70% scattered across map
            x = 200 + Math.random() * (init.world.width - 400);
            y = 200 + Math.random() * (init.world.height - 400);
          }
        } else if (herbivoreLevel > 0.7) {
          // Herbivores: tight herds
          const numHerds = 2 + Math.floor(herbivoreLevel * 3);
          const herdIndex = i % numHerds;
          const herdAngle = (herdIndex / numHerds) * Math.PI * 2;
          const herdDistance = spawn.radius * (1.5 + Math.random());
          const herdCenterX = spawn.x + Math.cos(herdAngle) * herdDistance;
          const herdCenterY = spawn.y + Math.sin(herdAngle) * herdDistance;
          
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (spawn.radius * 0.3 * (2 - herbivoreLevel));
          x = herdCenterX + Math.cos(ang) * r;
          y = herdCenterY + Math.sin(ang) * r;
        } else {
          // Omnivores: medium scatter
          const ang = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * spawn.radius * 2;
          x = spawn.x + Math.cos(ang) * r;
          y = spawn.y + Math.sin(ang) * r;
        }
      } else {
        // Fallback to blob
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawn.radius;
        x = spawn.x + Math.cos(ang) * r;
        y = spawn.y + Math.sin(ang) * r;
      }
      
      // Clamp to world bounds
      x = Math.max(0, Math.min(init.world.width - 1, x));
      y = Math.max(0, Math.min(init.world.height - 1, y));
      
      posBuffer[localIdx * 2] = x;
      posBuffer[localIdx * 2 + 1] = y;
      
      // Color based on tribe
      const hue = genes.colorHue || (tribeIdx * 120);
      const rgb = hslToRgb(hue / 360, 0.7, 0.5);
      colorBuffer[localIdx * 3] = rgb[0];
      colorBuffer[localIdx * 3 + 1] = rgb[1];
      colorBuffer[localIdx * 3 + 2] = rgb[2];
      
      aliveBuffer[localIdx] = 1;
      energyBuffer[localIdx] = init.energy?.start || 100;
      
      // Store genes
      if (genesBuffer) {
        const geneOffset = localIdx * 9;
        genesBuffer[geneOffset + 0] = genes.speed || 50;
        genesBuffer[geneOffset + 1] = genes.vision || 50;
        genesBuffer[geneOffset + 2] = genes.metabolism || 0.1;
        genesBuffer[geneOffset + 3] = genes.reproChance || 0.01;
        genesBuffer[geneOffset + 4] = genes.aggression || 0.5;
        genesBuffer[geneOffset + 5] = genes.cohesion || 0.5;
        genesBuffer[geneOffset + 6] = genes.diet || 0;
        genesBuffer[geneOffset + 7] = genes.foodStandards || 0.5;
        genesBuffer[geneOffset + 8] = genes.viewAngle || 120;
      }
      
      localIdx++;
    }
  });
  
  // Fill remaining entities if any
  while (localIdx < entityCount) {
    posBuffer[localIdx * 2] = Math.random() * init.world.width;
    posBuffer[localIdx * 2 + 1] = Math.random() * init.world.height;
    colorBuffer[localIdx * 3] = 128;
    colorBuffer[localIdx * 3 + 1] = 128;
    colorBuffer[localIdx * 3 + 2] = 128;
    aliveBuffer[localIdx] = 1;
    energyBuffer[localIdx] = 100;
    localIdx++;
  }
  
  // Send ready message
  self.postMessage({ type: 'ready' });
  
  // Start simulation loop
  startSubWorkerLoop(posBuffer, colorBuffer, aliveBuffer, energyBuffer, genesBuffer, init, foodBuffer);
}

/**
 * Initialize sub-worker with JS using coordinator's SharedArrayBuffers
 */
function initSubWorkerJs(init: any) {
  // Use actual entity count if provided
  const actualStart = init.actualEntityStart ?? entityStart;
  const actualEnd = init.actualEntityEnd ?? entityEnd;
  const actualEntityCount = actualEnd - actualStart;
  
  // Create views into the coordinator's SharedArrayBuffers
  // Use the BUFFER range for views, not actual count
  const bufferEntityCount = entityEnd - entityStart;
  const posBuffer = new Float32Array(
    sharedBuffers.positions, 
    entityStart * 2 * Float32Array.BYTES_PER_ELEMENT, 
    bufferEntityCount * 2
  );
  
  const colorBuffer = new Uint8Array(
    sharedBuffers.colors, 
    entityStart * 3,
    entityCount * 3
  );
  
  const aliveBuffer = new Uint8Array(
    sharedBuffers.alive,
    entityStart,
    entityCount
  );
  
  // Initialize entities based on tribes (JS version)
  let localIdx = 0;
  const tribes = init.tribes || [];
  const entitiesPerTribe = Math.floor(entityCount / Math.max(tribes.length, 1));
  
  tribes.forEach((tribe: any, tribeIdx: number) => {
    const tribeEntityCount = Math.min(entitiesPerTribe, entityCount - localIdx);
    const { spawn, genes } = tribe;
    const pattern = spawn.pattern || 'blob';
    
    for (let i = 0; i < tribeEntityCount && localIdx < entityCount; i++) {
      let x: number, y: number;
      
      // Simple patterns for JS version
      if (pattern === 'scattered') {
        x = Math.random() * init.world.width;
        y = Math.random() * init.world.height;
      } else if (pattern === 'herd') {
        // Simple herd - multiple small clusters
        const numHerds = 3;
        const herdIndex = Math.floor(i * numHerds / tribeEntityCount);
        const herdAngle = (herdIndex / numHerds) * Math.PI * 2;
        const herdDistance = spawn.radius * 3;
        const herdCenterX = spawn.x + Math.cos(herdAngle) * herdDistance;
        const herdCenterY = spawn.y + Math.sin(herdAngle) * herdDistance;
        
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawn.radius * 0.5;
        x = herdCenterX + Math.cos(ang) * r;
        y = herdCenterY + Math.sin(ang) * r;
      } else {
        // Default blob pattern
        const ang = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawn.radius;
        x = spawn.x + Math.cos(ang) * r;
        y = spawn.y + Math.sin(ang) * r;
      }
      
      x = Math.max(0, Math.min(init.world.width - 1, x));
      y = Math.max(0, Math.min(init.world.height - 1, y));
      
      posBuffer[localIdx * 2] = x;
      posBuffer[localIdx * 2 + 1] = y;
      
      // Color based on tribe
      const hue = genes.colorHue || (tribeIdx * 120);
      const rgb = hslToRgb(hue / 360, 0.7, 0.5);
      colorBuffer[localIdx * 3] = rgb[0];
      colorBuffer[localIdx * 3 + 1] = rgb[1];
      colorBuffer[localIdx * 3 + 2] = rgb[2];
      
      aliveBuffer[localIdx] = 1;
      localIdx++;
    }
  });
  
  // Fill remaining
  while (localIdx < entityCount) {
    posBuffer[localIdx * 2] = Math.random() * init.world.width;
    posBuffer[localIdx * 2 + 1] = Math.random() * init.world.height;
    colorBuffer[localIdx * 3] = 128;
    colorBuffer[localIdx * 3 + 1] = 128;
    colorBuffer[localIdx * 3 + 2] = 128;
    aliveBuffer[localIdx] = 1;
    localIdx++;
  }
  
  // Send ready message
  self.postMessage({ type: 'ready' });
  
  // Start simulation loop
  startSubWorkerLoop(posBuffer, colorBuffer, aliveBuffer, null, null, init, foodBuffer);
}

/**
 * Simulation loop for sub-workers
 */
function startSubWorkerLoop(
  posBuffer: Float32Array,
  colorBuffer: Uint8Array, 
  aliveBuffer: Uint8Array,
  energyBuffer: Float32Array | null,
  genesBuffer: Float32Array | null,
  init: any,
  foodBuf: Uint8Array | null = null
) {
  let paused = true;
  let speedMul = 1;
  const entityCount = entityEnd - entityStart;
  
  // Initialize food if we're worker 0 (temp fix - should be done by all workers for their regions)
  if (workerId === 0 && foodBuf) {
    console.log(`[Sub-Worker ${workerId}] Initializing food grid`);
    // Simple test pattern - just set some food values
    for (let i = 0; i < foodBuf.length; i++) {
      // Create a simple pattern for testing
      foodBuf[i] = Math.floor(Math.random() * 128);
    }
  }
  
  const tick = () => {
    if (!paused) {
      // Use improved simulation logic
      updateSubWorkerEntities({
        posBuffer,
        colorBuffer,
        aliveBuffer,
        energyBuffer,
        genesBuffer,
        foodBuffer: foodBuf,
        entityCount,
        entityStart,
        entityEnd,
        world: init.world,
        speedMul,
        dt: 0.016, // ~60 FPS
        foodCols: foodCols || 256,
        foodRows: foodRows || 256
      });
    }
    
    setTimeout(tick, 16); // ~60 FPS
  };
  
  // Listen for control messages
  self.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type === 'pause') {
      paused = msg.payload.paused;
    } else if (msg.type === 'setSpeed') {
      speedMul = msg.payload.speedMul;
    }
  });
  
  // Start with simulation paused
  tick();
}

/**
 * Initialize WASM-based simulation (standalone mode)
 */
function initWasmSimulation(init: any) {
  // Allocate SharedArrayBuffers for data exchange
  const cap = init.cap;
  const sabPosX = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
  const sabPosY = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
  const sabVelX = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
  const sabVelY = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
  const sabCol = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap * 3);
  const sabAlive = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cap);
  const sabTribe = new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * cap);
  const sabEnergy = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap);
  const sabGenes = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 9);
  
  // Create views
  const posX = new Float32Array(sabPosX);
  const posY = new Float32Array(sabPosY);
  const velX = new Float32Array(sabVelX);
  const velY = new Float32Array(sabVelY);
  // const color = new Uint8Array(sabCol); // Not used in this stub
  const alive = new Uint8Array(sabAlive);
  const tribeId = new Uint16Array(sabTribe);
  const energy = new Float32Array(sabEnergy);
  const genes = new Float32Array(sabGenes);
  
  // Initialize entities (same logic as JS worker)
  // ... (entity spawning code here - would be copied from sim.worker.ts)
  
  // Load data into WASM module
  wasmCore.load_from_buffers(posX, posY, velX, velY, energy, alive, tribeId, genes);
  
  // Send ready message with SharedArrayBuffers
  const payload: MainMsg = {
    type: 'ready',
    payload: {
      sab: {
        pos: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * cap * 2), // Combined pos buffer
        color: sabCol,
        alive: sabAlive,
        food: new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * 256 * 256), // Food grid
      },
      meta: { count: init.tribes.reduce((sum: number, t: any) => sum + t.count, 0) },
      foodMeta: { cols: 256, rows: 256 },
    },
  };
  
  self.postMessage(payload);
  
  // Start simulation loop
  startWasmSimulationLoop();
}

/**
 * Initialize JavaScript fallback simulation
 */
function initJsSimulation(init: any) {
  // Create a separate JS worker and forward messages
  jsWorker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
  
  // Forward the init message
  jsWorker.postMessage({ type: 'init', payload: init });
  
  // Forward all messages from JS worker to main thread
  jsWorker.onmessage = (e) => {
    self.postMessage(e.data);
  };
}

/**
 * WASM simulation loop
 */
function startWasmSimulationLoop() {
  let lastTime = performance.now();
  let paused = true;
  let speedMul = 1;
  const FIXED_TIMESTEP = 1/60;
  let accumulator = 0;
  
  const tick = () => {
    const now = performance.now();
    const frameTime = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    
    if (!paused && speedMul > 0) {
      accumulator += frameTime * speedMul;
      
      // Run fixed timestep simulation
      while (accumulator >= FIXED_TIMESTEP) {
        const stepStart = performance.now();
        
        // Rebuild spatial hash
        const hashStart = performance.now();
        wasmCore.rebuild_spatial_hash();
        perfStats.wasm.spatialHash = performance.now() - hashStart;
        
        // Process movement (main bottleneck)
        const moveStart = performance.now();
        wasmCore.process_movement_batch(0, wasmCore.count, FIXED_TIMESTEP);
        perfStats.wasm.movement = performance.now() - moveStart;
        
        // Integrate physics
        const physicsStart = performance.now();
        wasmCore.integrate_physics_batch(0, wasmCore.count, FIXED_TIMESTEP);
        perfStats.wasm.physics = performance.now() - physicsStart;
        
        perfStats.wasm.total = performance.now() - stepStart;
        perfStats.samples++;
        
        accumulator -= FIXED_TIMESTEP;
      }
      
      // Write back to SharedArrayBuffers
      // wasmCore.write_to_buffers(posX, posY, velX, velY);
    }
    
    // Log performance every 2 seconds
    if (perfStats.samples >= 120) {
      const avg = {
        movement: perfStats.wasm.movement / perfStats.samples,
        spatialHash: perfStats.wasm.spatialHash / perfStats.samples,
        physics: perfStats.wasm.physics / perfStats.samples,
        total: perfStats.wasm.total / perfStats.samples,
      };
      
      console.log('[WASM Performance]', {
        movement: avg.movement.toFixed(2),
        spatialHash: avg.spatialHash.toFixed(2),
        physics: avg.physics.toFixed(2),
        total: avg.total.toFixed(2),
        improvement: `${((perfStats.js.total / avg.total) || 1).toFixed(1)}x faster than JS`,
      });
      
      // Reset counters
      perfStats.samples = 0;
      perfStats.wasm = { movement: 0, spatialHash: 0, physics: 0, total: 0 };
    }
    
    setTimeout(tick, 0);
  };
  
  tick();
}

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data;
  
  if (msg.type === 'init') {
    await initHybridWorker(msg);
  } else if (jsWorker) {
    // Forward to JS worker if using fallback
    jsWorker.postMessage(msg);
  } else {
    // Handle messages for WASM simulation
    switch (msg.type) {
      case 'setSpeed':
        // Update speed multiplier
        break;
      case 'pause':
        // Update pause state
        break;
    }
  }
};