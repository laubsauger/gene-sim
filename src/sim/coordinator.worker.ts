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
  actualPopulation: number;
  worldWidth: number;
  worldHeight: number;
  paused: boolean;
  speedMul: number;
  renderFps: number;
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
    orientations: SharedArrayBuffer;
    ages: SharedArrayBuffer;
  } | null = null;
  private foodBuffer: SharedArrayBuffer | null = null;
  private foodCols = 0;
  private foodRows = 0;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private workersReady = 0;
  private allWorkersReadyCallback: (() => void) | null = null;
  private perfStats: Map<number, any> = new Map();
  private lastPerfSend = 0;
  private workerStats: Map<number, SimStats> = new Map();
  private lastStatsTime = 0;
  
  constructor() {
    this.state = {
      workers: [],
      workerCount: 0,
      entityCount: 0,
      actualPopulation: 0,  // Track actual starting population for rendering
      worldWidth: 1000,
      worldHeight: 1000,
      paused: true,
      speedMul: 1,
      renderFps: 0,
    };
  }
  
  /**
   * Initialize the coordinator with simulation parameters
   */
  async init(msg: any) {
    const init = msg.payload;
    console.log('[Coordinator] ===== RECEIVED CONFIG FROM MAIN THREAD =====');
    console.log('[Coordinator] Full configuration:', {
      seed: init.seed,
      cap: init.cap,
      energy: init.energy,
      worldSize: init.world ? `${init.world.width}x${init.world.height}` : 'default',
      foodGrid: init.world?.foodGrid,
      hybridization: init.hybridization,
      tribesCount: init.tribes?.length || 0,
      totalPopulation: init.tribes?.reduce((sum: number, t: any) => sum + t.count, 0) || 0
    });
    console.log('[Coordinator] Tribes:', init.tribes?.map((t: any) => ({
      name: t.name,
      count: t.count,
      hasSpawn: !!t.spawn,
      hasGenes: !!t.genes
    })));
    console.log('[Coordinator] ============================================');
    
    // Determine worker count based on available cores
    const coreCount = navigator.hardwareConcurrency || 4;
    this.state.workerCount = Math.min(init.workerCount || 4, coreCount);
    
    // Cap is maximum capacity, actual starting population comes from tribes
    this.state.entityCount = init.cap; // Keep this as cap for buffer allocation
    const actualPopulation = init.tribes?.reduce((sum: number, t: any) => sum + t.count, 0) || 0;
    this.state.actualPopulation = actualPopulation;  // Store for rendering
    
    this.state.worldWidth = init.world.width;
    this.state.worldHeight = init.world.height;
    
    console.log(`[Coordinator] Allocating for cap: ${this.state.entityCount}, starting population: ${actualPopulation}`)
    
    console.log(`[Coordinator] Using ${this.state.workerCount} workers`);
    
    // Allocate shared memory for all entities
    this.allocateSharedMemory(init);
    
    // Spawn and initialize workers
    await this.spawnWorkers(init);
    
    // Wait for all workers to be ready
    await this.waitForAllWorkers();
    
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
      orientations: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count),
      ages: new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * count),
    };
    
    // CRITICAL: Initialize buffers to prevent random memory issues
    const aliveView = new Uint8Array(this.sharedBuffers.alive);
    aliveView.fill(0);
    
    // Initialize positions far outside the world to prevent dead entities from rendering
    // World is 4000x4000, so put them at -10000,-10000
    const posView = new Float32Array(this.sharedBuffers.positions);
    for (let i = 0; i < count; i++) {
      posView[i * 2] = -10000;     // x
      posView[i * 2 + 1] = -10000;  // y  
    }
    
    console.log(`[Coordinator] Initialized buffers (alive=0, pos=-10000,-10000) for ${count} slots`);
    
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
      
      // Send initialization to sub-worker
      workerInfo.worker.postMessage({ 
        type: 'init-sub-worker', 
        payload: {
          sharedBuffers: {
            ...this.sharedBuffers,
            foodGrid: this.foodBuffer
          },
          config: init,
          workerId: i,
          entityRange: {
            start: workerInfo.entityStart,
            end: workerInfo.entityEnd,
            actualStart,
            actualEnd
          },
          region: {
            x: workerInfo.regionX,
            y: workerInfo.regionY,
            width: workerInfo.regionWidth,
            height: workerInfo.regionHeight
          }
        }
      });
      
      this.state.workers.push(workerInfo);
      
      console.log(`[Coordinator] Worker ${i}: buffer ${workerInfo.entityStart}-${workerInfo.entityEnd}, actual ${actualStart}-${actualEnd} in region (${col},${row})`);
    }
  }
  
  /**
   * Wait for all workers to be ready
   */
  private waitForAllWorkers(): Promise<void> {
    return new Promise((resolve) => {
      console.log(`[Coordinator] Waiting for workers: ${this.workersReady}/${this.state.workerCount} ready`);
      if (this.workersReady >= this.state.workerCount) {
        console.log(`[Coordinator] All workers ready, proceeding`);
        resolve();
      } else {
        this.allWorkersReadyCallback = resolve;
      }
    });
  }
  
  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: number, msg: any) {
    const worker = this.state.workers[workerId];
    
    switch (msg.type) {
      case 'worker-ready':
        console.log(`[Coordinator] Worker ${workerId} ready (${this.workersReady + 1}/${this.state.workerCount})`);
        worker.status = 'idle';
        this.workersReady++;
        
        if (this.workersReady >= this.state.workerCount && this.allWorkersReadyCallback) {
          console.log(`[Coordinator] All workers ready, calling callback`);
          
          // Add debugging to verify the final spawning results
          setTimeout(() => {
            console.log(`[Coordinator] ===== SPAWNING VERIFICATION =====`);
            console.log(`[Coordinator] Expected population: ${this.state.actualPopulation}`);
            console.log(`[Coordinator] Buffer capacity: ${this.state.entityCount}`);
            console.log(`[Coordinator] Workers: ${this.state.workerCount}`);
            
            // Request immediate stats from all workers to verify spawning
            this.state.workers.forEach(w => {
              w.worker.postMessage({ type: 'stats' });
            });
            console.log(`[Coordinator] Stats requested from all workers for verification`);
            console.log(`[Coordinator] =========================================`);
          }, 500); // Wait 500ms for workers to finish spawning
          
          this.allWorkersReadyCallback();
          this.allWorkersReadyCallback = null;
        }
        break;
        
      case 'sync_request':
        // Worker needs data from other workers (ghost zones)
        this.handleSyncRequest(workerId, msg.payload);
        break;
        
      case 'migration':
        // Entity moving to different region
        this.handleEntityMigration(workerId, msg.payload);
        break;
        
      case 'worker-stats':
        // Aggregate stats from all workers
        this.aggregateStats(workerId, msg.payload.stats);
        break;
        
      case 'worker-perf':
        // Store performance metrics from worker
        this.perfStats.set(workerId, msg.payload);
        
        // Send aggregated stats periodically (250ms)
        const now = performance.now();
        if (now - this.lastPerfSend > 250 && this.perfStats.size === this.state.workerCount) {
          this.lastPerfSend = now;
          this.sendAggregatedPerfStats();
        }
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
  private aggregateStats(workerId: number, stats: SimStats) {
    // Removed debug spam - stats logged in aggregate only
    
    // Store stats from this worker
    this.workerStats.set(workerId, stats);
    
    // When we have stats from all workers, combine and send to main thread
    if (this.workerStats.size === this.state.workerCount) {
      const now = performance.now();
      if (now - this.lastStatsTime > 400) { // Throttle to prevent flickering
        this.lastStatsTime = now;
        
        // Aggregate all worker stats
        const aggregated: SimStats = {
          population: 0,
          time: 0,
          byTribe: {},
          food: { current: 0, capacity: 0, percentage: 0 },
          global: {
            mean: {
              speed: 0, vision: 0, metabolism: 0, aggression: 0,
              cohesion: 0, reproChance: 0, foodStandards: 0,
              diet: 0, viewAngle: 0
            },
            distribution: {
              speed: { min: Infinity, max: -Infinity, std: 0 },
              vision: { min: Infinity, max: -Infinity, std: 0 },
              metabolism: { min: Infinity, max: -Infinity, std: 0 },
              aggression: { min: Infinity, max: -Infinity, std: 0 },
              cohesion: { min: Infinity, max: -Infinity, std: 0 },
              reproChance: { min: Infinity, max: -Infinity, std: 0 },
              foodStandards: { min: Infinity, max: -Infinity, std: 0 },
              diet: { min: Infinity, max: -Infinity, std: 0 },
              viewAngle: { min: Infinity, max: -Infinity, std: 0 },
            }
          }
        };
        
        // Merge stats from all workers
        this.workerStats.forEach(workerStat => {
          aggregated.population += workerStat.population;
          aggregated.time = Math.max(aggregated.time, workerStat.time);
          
          // Merge food stats if available
          if (workerStat.food) {
            aggregated.food!.current += workerStat.food.current;
            aggregated.food!.capacity += workerStat.food.capacity;
          }
          
          // Merge tribe stats
          Object.entries(workerStat.byTribe).forEach(([tribeName, tribeData]) => {
            if (!aggregated.byTribe[tribeName]) {
              aggregated.byTribe[tribeName] = {
                population: 0,
                births: 0,
                deaths: 0,
                starved: 0,
                kills: 0,
                averageAge: 0,
                averageEnergy: 0,
                color: tribeData.color,
                mean: {
                  speed: 0,
                  vision: 0,
                  metabolism: 0,
                  aggression: 0,
                  cohesion: 0,
                  reproChance: 0,
                  foodStandards: 0,
                  diet: 0,
                  viewAngle: 0
                }
              };
            }
            const aggTribe = aggregated.byTribe[tribeName];
            aggTribe.population += tribeData.population;
            aggTribe.births += tribeData.births;
            aggTribe.deaths += tribeData.deaths;
            aggTribe.starved += tribeData.starved;
            aggTribe.kills += tribeData.kills;
            aggTribe.averageAge += tribeData.averageAge * tribeData.population;
            aggTribe.averageEnergy += tribeData.averageEnergy * tribeData.population;
            
            // Aggregate mean gene values (weighted by population)
            if (tribeData.mean) {
              Object.keys(tribeData.mean).forEach(gene => {
                aggTribe.mean[gene] += tribeData.mean[gene] * tribeData.population;
              });
            }
          });
        });
        
        // Calculate weighted averages for tribes
        Object.values(aggregated.byTribe).forEach(tribe => {
          if (tribe.population > 0) {
            tribe.averageAge /= tribe.population;
            tribe.averageEnergy /= tribe.population;
            
            // Calculate mean gene values
            if (tribe.mean) {
              Object.keys(tribe.mean).forEach(gene => {
                tribe.mean[gene] /= tribe.population;
              });
            }
          }
        });
        
        // Calculate global means and distributions across all tribes
        if (aggregated.population > 0) {
          const geneNames = ['speed', 'vision', 'metabolism', 'aggression', 'cohesion', 'reproChance', 'foodStandards', 'diet', 'viewAngle'] as const;
          
          // Calculate global means (weighted by tribe populations)
          geneNames.forEach(gene => {
            let weightedSum = 0;
            Object.values(aggregated.byTribe).forEach(tribe => {
              if (tribe.mean && tribe.population > 0) {
                weightedSum += tribe.mean[gene] * tribe.population;
              }
            });
            aggregated.global.mean[gene] = weightedSum / aggregated.population;
          });
          
          // Calculate global distributions (use worker stats if available)
          this.workerStats.forEach(workerStat => {
            if (workerStat.global && workerStat.global.distribution) {
              geneNames.forEach(gene => {
                const workerDist = workerStat.global.distribution[gene];
                const globalDist = aggregated.global.distribution[gene];
                
                if (workerDist) {
                  globalDist.min = Math.min(globalDist.min, workerDist.min);
                  globalDist.max = Math.max(globalDist.max, workerDist.max);
                  // Simple approximation for std - could be improved
                  globalDist.std = Math.max(globalDist.std, workerDist.std);
                }
              });
            }
          });
          
          // Fix any infinite values that weren't set
          geneNames.forEach(gene => {
            const dist = aggregated.global.distribution[gene];
            if (dist.min === Infinity) dist.min = 0;
            if (dist.max === -Infinity) dist.max = 0;
          });
        }
        
        // Calculate food percentage after aggregation
        if (aggregated.food && aggregated.food.capacity > 0) {
          aggregated.food.percentage = (aggregated.food.current / aggregated.food.capacity) * 100;
        }
        
        // Log stats summary occasionally instead of every frame
        this.statsLogCounter = (this.statsLogCounter || 0) + 1;
        if (this.statsLogCounter % 50 === 0) { // Every ~12 seconds
          const summary = Object.entries(aggregated.byTribe)
            .map(([name, data]) => `${name}:${data.population}`)
            .join(', ');
          console.log(`[Coordinator] Population: ${aggregated.population} (${summary})`);
        }
        
        // Send aggregated stats
        self.postMessage({ type: 'stats', payload: aggregated } as MainMsg);
        
        // Clear for next round
        this.workerStats.clear();
      }
    }
  }
  
  /**
   * Aggregate and send performance stats from all workers
   */
  private sendAggregatedPerfStats() {
    if (this.perfStats.size === 0) return;
    
    // Calculate aggregate performance metrics across all workers
    let totalEntities = 0;
    let avgSimHz = 0;
    let maxStepTime = 0;
    let totalAvgStepTime = 0;
    
    // Aggregate metrics from all workers
    this.perfStats.forEach(stats => {
      totalEntities += stats.entityCount || 0;
      avgSimHz += stats.simHz || 0;
      maxStepTime = Math.max(maxStepTime, stats.maxStepTime || 0);
      totalAvgStepTime += stats.avgStepTime || 0;
    });
    
    // Average the Hz and step times
    avgSimHz = this.perfStats.size > 0 ? avgSimHz / this.perfStats.size : 0;
    totalAvgStepTime = this.perfStats.size > 0 ? totalAvgStepTime / this.perfStats.size : 0;
    
    // Send aggregated performance stats
    self.postMessage({
      type: 'perf',
      payload: {
        simHz: avgSimHz,
        renderFps: this.state.renderFps,
        entityCount: totalEntities,
        avgStepTime: totalAvgStepTime,
        maxStepTime,
        workerCount: this.state.workerCount
      }
    } as MainMsg);
  }
  
  /**
   * Main coordination loop
   */
  private startCoordinationLoop() {
    let lastSyncTime = 0;
    let lastPerfRequest = 0;
    const SYNC_INTERVAL = 16.67; // Sync at 60Hz
    const PERF_INTERVAL = 250; // Request perf stats at 4Hz
    
    const tick = () => {
      const now = performance.now();
      
      // Periodic synchronization
      if (now - lastSyncTime > SYNC_INTERVAL) {
        this.synchronizeWorkers();
        lastSyncTime = now;
      }
      
      // Request performance stats from workers
      if (now - lastPerfRequest > PERF_INTERVAL) {
        this.state.workers.forEach(w => {
          w.worker.postMessage({ type: 'perf' });
        });
        lastPerfRequest = now;
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
  sendReadyMessage() {
    if (!this.sharedBuffers) return;
    
    const payload: MainMsg = {
      type: 'ready',
      payload: {
        sab: {
          pos: this.sharedBuffers.positions,  // This contains x,y interleaved
          color: this.sharedBuffers.colors,
          alive: this.sharedBuffers.alive,
          ages: this.sharedBuffers.ages,
          food: this.foodBuffer || new SharedArrayBuffer(Uint8Array.BYTES_PER_ELEMENT * 256 * 256),
        },
        meta: { count: this.state.entityCount },  // Full buffer size for sparse entity storage
        foodMeta: { cols: this.foodCols || 256, rows: this.foodRows || 256 },
      },
    };
    
    self.postMessage(payload);
  }
  
  /**
   * Start sending stats to main thread
   */
  private startStatsReporting() {
    // Send stats every 500ms - but only when simulation is running
    (this as any).statsTimer = setInterval(() => {
      // Only request stats if simulation is not paused and has workers
      if (this.state.workers.length > 0 && !this.state.paused) {
        // Request stats from all workers
        this.state.workers.forEach(w => {
          w.worker.postMessage({ type: 'stats' });
        });
      }
    }, 500);
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
        // Broadcast to all workers
        this.state.workers.forEach(w => w.worker.postMessage(msg));
        break;
        
      case 'pause':
        this.state.paused = msg.payload.paused;
        // Broadcast to all workers  
        this.state.workers.forEach((w) => {
          w.worker.postMessage(msg);
        });
        break;
        
      case 'renderFps':
        // Store render FPS and forward to workers
        this.state.renderFps = msg.payload.fps;
        this.state.workers.forEach(w => w.worker.postMessage(msg));
        break;
        
      case 'updateFoodParams':
        // Forward to all workers to update their food systems
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
    // Prevent multiple initializations more aggressively
    if (initializationInProgress || (coordinator && coordinator.isInitialized())) {
      console.warn('[Coordinator] Already initialized or initializing, ignoring duplicate init');
      // Send ready message if already initialized
      if (coordinator && coordinator.isInitialized()) {
        coordinator.sendReadyMessage();
      }
      return;
    }
    
    initializationInProgress = true;
    
    try {
      if (!coordinator) {
        coordinator = new SimulationCoordinator();
      }
      
      await coordinator.init(msg);
    } catch (error) {
      console.error('[Coordinator] Initialization failed:', error);
      initializationInProgress = false;
      throw error;
    }
    
    initializationInProgress = false;
  } else if (coordinator) {
    coordinator.handleControlMessage(msg);
  } else {
    console.error('[Coordinator] Received message before initialization');
  }
};