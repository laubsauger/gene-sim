/// <reference lib="webworker" />
import type { WorkerMsg, MainMsg, SimStats } from './types';

interface WorkerInfo {
  id: number;
  worker: Worker;
  entityStart: number;
  entityEnd: number;
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
  status: 'idle' | 'computing' | 'syncing';
}

interface CoordinatorState {
  workers: WorkerInfo[];
  workerCount: number;
  entityCount: number;
  worldWidth: number;
  worldHeight: number;
  paused: boolean;
  speedMul: number;
}

class SimulationCoordinator {
  private state: CoordinatorState;
  private sharedBuffers: {
    positions: SharedArrayBuffer;
    velocities: SharedArrayBuffer;
    colors: SharedArrayBuffer;
    alive: SharedArrayBuffer;
    energy: SharedArrayBuffer;
    tribeIds: SharedArrayBuffer;
    genes: SharedArrayBuffer;
  } | null = null;
  private foodBuffer: SharedArrayBuffer | null = null;
  private foodCols = 0;
  private foodRows = 0;
  private statsTimer: any = null;
  private initialized = false;
  
  constructor() {
    this.state = {
      workers: [],
      workerCount: 0,
      entityCount: 0,
      worldWidth: 1000,
      worldHeight: 1000,
      paused: true,
      speedMul: 1,
    };
  }
  
  /**
   * Initialize the coordinator with simulation parameters
   */
  async init(msg: any) {
    const init = msg.payload;
    console.log('[Coordinator] Received init config:', {
      cap: init.cap,
      tribesCount: init.tribes?.length,
      totalPopulation: init.tribes?.reduce((sum: number, t: any) => sum + t.count, 0),
      tribes: init.tribes?.map((t: any) => ({ name: t.name, count: t.count, spawn: t.spawn })),
      foodGrid: init.world?.foodGrid
    });
    
    // Determine worker count based on available cores
    const coreCount = navigator.hardwareConcurrency || 4;
    this.state.workerCount = Math.min(init.workerCount || 4, coreCount);
    
    // Cap is maximum capacity, actual starting population comes from tribes
    this.state.entityCount = init.cap; // Keep this as cap for buffer allocation
    const actualPopulation = init.tribes?.reduce((sum: number, t: any) => sum + t.count, 0) || 0;
    
    this.state.worldWidth = init.world.width;
    this.state.worldHeight = init.world.height;
    
    console.log(`[Coordinator] Allocating for cap: ${this.state.entityCount}, starting population: ${actualPopulation}`)
    
    console.log(`[Coordinator] Using ${this.state.workerCount} workers`);
    
    // Allocate shared memory for all entities
    this.allocateSharedMemory(init);
    
    // Spawn and initialize workers
    await this.spawnWorkers(init);
    
    // Start coordination loop
    this.startCoordinationLoop();
    
    // Mark as initialized
    this.initialized = true;
    
    // Send ready message
    this.sendReadyMessage();
    
    // Start stats reporting
    this.startStatsReporting();
  }
  
  /**
   * Allocate SharedArrayBuffers for entity data
   */
  private allocateSharedMemory(init: any) {
    const count = this.state.entityCount;
    
    this.sharedBuffers = {
      positions: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count * 2),
      velocities: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count * 2),
      colors: new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * count * 3),
      alive: new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * count),
      energy: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count),
      tribeIds: new SharedArrayBuffer(Uint16Array.BYTES_PER_ELEMENT * count),
      genes: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count * 9),
    };
    
    console.log('[Coordinator] Allocated shared memory for', count, 'entities');
    
    // Allocate food grid if specified
    if (init.world?.foodGrid) {
      const { cols, rows } = init.world.foodGrid;
      this.foodBuffer = new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * cols * rows);
      this.foodCols = cols;
      this.foodRows = rows;
      
      // Don't initialize food here - worker 0 will initialize it with proper noise pattern
      console.log('[Coordinator] Allocated food grid:', cols, 'x', rows);
    }
  }
  
  /**
   * Spawn worker threads with spatial partitioning
   */
  private async spawnWorkers(init: any) {
    const { workerCount, worldWidth, worldHeight, entityCount } = this.state;
    
    // Get actual starting population
    const actualPopulation = init.tribes?.reduce((sum: number, t: any) => sum + t.count, 0) || 0;
    
    // Calculate spatial partitioning (2x2, 2x3, 2x4, etc.)
    const cols = Math.ceil(Math.sqrt(workerCount));
    const rows = Math.ceil(workerCount / cols);
    const regionWidth = worldWidth / cols;
    const regionHeight = worldHeight / rows;
    const entitiesPerWorker = Math.ceil(entityCount / workerCount);
    const actualEntitiesPerWorker = Math.ceil(actualPopulation / workerCount);
    
    console.log(`[Coordinator] Spatial layout: ${cols}x${rows} regions`);
    
    // Create workers
    for (let i = 0; i < workerCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const workerInfo: WorkerInfo = {
        id: i,
        worker: new Worker(
          new URL('./sim.worker.ts', import.meta.url),
          { type: 'module' }
        ),
        entityStart: i * entitiesPerWorker,
        entityEnd: Math.min((i + 1) * entitiesPerWorker, entityCount),
        regionX: col * regionWidth,
        regionY: row * regionHeight,
        regionWidth,
        regionHeight,
        status: 'idle',
      };
      
      // Initialize worker with its partition
      // For actual entities, distribute the real population
      const actualStart = Math.min(i * actualEntitiesPerWorker, actualPopulation);
      const actualEnd = Math.min((i + 1) * actualEntitiesPerWorker, actualPopulation);
      
      const workerInit = {
        ...init,
        workerId: i,
        entityStart: workerInfo.entityStart, // Buffer allocation range
        entityEnd: workerInfo.entityEnd,     // Buffer allocation range
        actualEntityStart: actualStart,      // Actual entities to initialize
        actualEntityEnd: actualEnd,          // Actual entities to initialize
        regionBounds: {
          x: workerInfo.regionX,
          y: workerInfo.regionY,
          width: workerInfo.regionWidth,
          height: workerInfo.regionHeight,
        },
        sharedBuffers: this.sharedBuffers,
        foodBuffer: this.foodBuffer,
        foodMeta: { cols: this.foodCols, rows: this.foodRows },
        totalWorkers: workerCount,
      };
      
      // Set up message handler
      workerInfo.worker.onmessage = (e) => this.handleWorkerMessage(i, e.data);
      
      // Send initialization
      workerInfo.worker.postMessage({ type: 'init', payload: workerInit });
      
      this.state.workers.push(workerInfo);
      
      console.log(`[Coordinator] Worker ${i}: buffer ${workerInfo.entityStart}-${workerInfo.entityEnd}, actual ${actualStart}-${actualEnd} in region (${col},${row})`);
    }
  }
  
  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: number, msg: any) {
    const worker = this.state.workers[workerId];
    
    switch (msg.type) {
      case 'ready':
        console.log(`[Coordinator] Worker ${workerId} ready`);
        worker.status = 'idle';
        break;
        
      case 'sync_request':
        // Worker needs data from other workers (ghost zones)
        this.handleSyncRequest(workerId, msg.payload);
        break;
        
      case 'migration':
        // Entity moving to different region
        this.handleEntityMigration(workerId, msg.payload);
        break;
        
      case 'stats':
        // Aggregate stats from all workers
        this.aggregateStats(workerId, msg.payload);
        break;
        
      case 'perf':
        // Performance metrics from worker
        console.log(`[Coordinator] Worker ${workerId} perf:`, msg.payload);
        break;
    }
  }
  
  /**
   * Handle synchronization requests for ghost zones
   */
  private handleSyncRequest(workerId: number, _request: any) {
    const worker = this.state.workers[workerId];
    const { regionX, regionY, regionWidth, regionHeight } = worker;
    
    // Find neighboring workers
    const neighbors = this.state.workers.filter(w => {
      if (w.id === workerId) return false;
      
      // Check if regions are adjacent or overlapping
      const distance = Math.sqrt(
        Math.pow(w.regionX - regionX, 2) + 
        Math.pow(w.regionY - regionY, 2)
      );
      
      return distance < Math.max(regionWidth, regionHeight) * 1.5;
    });
    
    // Request ghost data from neighbors
    neighbors.forEach(neighbor => {
      neighbor.worker.postMessage({
        type: 'ghost_request',
        payload: {
          requesterId: workerId,
          bounds: {
            x: regionX - 100, // 100 unit ghost zone
            y: regionY - 100,
            width: regionWidth + 200,
            height: regionHeight + 200,
          },
        },
      });
    });
  }
  
  /**
   * Handle entity migration between workers
   */
  private handleEntityMigration(fromWorkerId: number, migration: any) {
    const { entityId, newX, newY } = migration;
    
    // Find target worker based on new position
    const targetWorker = this.state.workers.find(w => {
      return newX >= w.regionX && 
             newX < w.regionX + w.regionWidth &&
             newY >= w.regionY && 
             newY < w.regionY + w.regionHeight;
    });
    
    if (targetWorker && targetWorker.id !== fromWorkerId) {
      console.log(`[Coordinator] Migrating entity ${entityId} from worker ${fromWorkerId} to ${targetWorker.id}`);
      
      // Send migration command to target worker
      targetWorker.worker.postMessage({
        type: 'accept_migration',
        payload: migration,
      });
      
      // Tell source worker to release entity
      this.state.workers[fromWorkerId].worker.postMessage({
        type: 'release_entity',
        payload: { entityId },
      });
    }
  }
  
  /**
   * Aggregate statistics from all workers
   */
  private aggregateStats(_workerId: number, _stats: SimStats) {
    // Store stats from this worker
    // When we have stats from all workers, combine and send to main thread
    // ... (implementation depends on stats structure)
  }
  
  /**
   * Main coordination loop
   */
  private startCoordinationLoop() {
    let lastSyncTime = 0;
    const SYNC_INTERVAL = 16.67; // Sync at 60Hz
    
    const tick = () => {
      const now = performance.now();
      
      // Periodic synchronization
      if (now - lastSyncTime > SYNC_INTERVAL) {
        this.synchronizeWorkers();
        lastSyncTime = now;
      }
      
      setTimeout(tick, 0);
    };
    
    tick();
  }
  
  /**
   * Synchronize all workers
   */
  private synchronizeWorkers() {
    // Send sync signal to all workers
    this.state.workers.forEach(worker => {
      worker.worker.postMessage({ type: 'sync' });
    });
  }
  
  /**
   * Send ready message to main thread
   */
  private sendReadyMessage() {
    if (!this.sharedBuffers) return;
    
    const payload: MainMsg = {
      type: 'ready',
      payload: {
        sab: {
          pos: this.sharedBuffers.positions,  // This contains x,y interleaved
          color: this.sharedBuffers.colors,
          alive: this.sharedBuffers.alive,
          food: this.foodBuffer || new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * 256 * 256),
        },
        meta: { count: this.state.entityCount },
        foodMeta: { cols: this.foodCols || 256, rows: this.foodRows || 256 },
      },
    };
    
    self.postMessage(payload);
  }
  
  /**
   * Start sending stats to main thread
   */
  private startStatsReporting() {
    // Send stats every 100ms
    this.statsTimer = setInterval(() => {
      if (!this.state.paused) {
        this.sendStats();
      }
    }, 100);
  }
  
  /**
   * Calculate and send stats
   */
  private sendStats() {
    if (!this.sharedBuffers) return;
    
    const aliveBuffer = new Uint8Array(this.sharedBuffers.alive);
    const colorBuffer = new Uint8Array(this.sharedBuffers.colors);
    
    // Count alive entities and tribes
    let aliveCount = 0;
    const tribeCounts = new Map<number, number>();
    
    for (let i = 0; i < this.state.entityCount; i++) {
      if (aliveBuffer[i]) {
        aliveCount++;
        // Use color as a simple tribe identifier (red channel)
        const tribeId = colorBuffer[i * 3];
        tribeCounts.set(tribeId, (tribeCounts.get(tribeId) || 0) + 1);
      }
    }
    
    // Build tribe stats
    const tribeStats = Array.from(tribeCounts.entries()).map(([id, count]) => ({
      name: `Tribe ${id}`,
      count,
      avgSpeed: 50, // Placeholder
      avgEnergy: 100, // Placeholder
    }));
    
    const stats = {
      time: Date.now(),
      alive: aliveCount,
      dead: this.state.entityCount - aliveCount,
      tribes: tribeStats,
      performance: {
        fps: 60, // Placeholder
        updateTime: 0,
        renderTime: 0,
      },
    };
    
    self.postMessage({ type: 'stats', payload: stats });
  }
  
  /**
   * Check if coordinator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Handle control messages from main thread
   */
  handleControlMessage(msg: WorkerMsg) {
    switch (msg.type) {
      case 'setSpeed':
        this.state.speedMul = msg.payload.speedMul;
        console.log(`[Coordinator] Setting speed to ${msg.payload.speedMul}`);
        // Broadcast to all workers
        this.state.workers.forEach(w => w.worker.postMessage(msg));
        break;
        
      case 'pause':
        this.state.paused = msg.payload.paused;
        console.log(`[Coordinator] Setting paused to ${msg.payload.paused}`);
        // Broadcast to all workers  
        this.state.workers.forEach(w => w.worker.postMessage(msg));
        break;
        
      case 'renderFps':
        // Forward render FPS to workers
        this.state.workers.forEach(w => w.worker.postMessage(msg));
        break;
    }
  }
}

// Create coordinator instance (singleton)
let coordinator: SimulationCoordinator | null = null;
let initializationInProgress = false;

// Message handler
self.onmessage = async (e: MessageEvent<WorkerMsg>) => {
  const msg = e.data;
  
  if (msg.type === 'init') {
    // Prevent multiple initializations
    if (initializationInProgress || (coordinator && coordinator.isInitialized())) {
      console.warn('[Coordinator] Already initialized or initializing, ignoring duplicate init');
      return;
    }
    
    initializationInProgress = true;
    
    if (!coordinator) {
      coordinator = new SimulationCoordinator();
    }
    
    await coordinator.init(msg);
    initializationInProgress = false;
  } else if (coordinator) {
    coordinator.handleControlMessage(msg);
  } else {
    console.error('[Coordinator] Received message before initialization');
  }
};