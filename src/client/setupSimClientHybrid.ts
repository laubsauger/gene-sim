import type { MainMsg, WorkerMsg, SimInit } from '../sim/types';

export type SimMode = 'js' | 'multi-worker';

export interface SimClientConfig {
  mode?: SimMode;
  workerCount?: number;
  useWasm?: boolean;
}

export class HybridSimClient {
  private _worker: Worker | null = null;
  private listeners: Array<(msg: MainMsg) => void> = [];
  private ready = false;
  private mode: SimMode;
  private config: SimClientConfig;
  private pos: Float32Array | null = null;
  private color: Uint8Array | null = null;
  private alive: Uint8Array | null = null;
  private food: Uint8Array | null = null;
  private count = 0;
  private foodCols = 0;
  private foodRows = 0;
  
  constructor(config: SimClientConfig = {}) {
    this.mode = config.mode || 'js';
    this.config = config;
    console.log(`[SimClient] Initializing in ${this.mode} mode`);
  }
  
  async init(params: SimInit) {
    // Prevent re-initialization
    if (this.ready) {
      console.warn('[SimClient] Already initialized, skipping re-init');
      return;
    }
    
    // Choose worker based on mode
    switch (this.mode) {
      case 'multi-worker':
        // Use coordinator for multiple workers
        this._worker = new Worker(
          new URL('../sim/coordinator.worker.ts', import.meta.url),
          { type: 'module' }
        );
        // Add multi-worker specific config
        params = {
          ...params,
          workerCount: this.config.workerCount || 4,
          useWasm: this.config.useWasm !== false,
        };
        break;
        
      case 'js':
      default:
        // Use standard JS worker
        this._worker = new Worker(
          new URL('../sim/sim.worker.ts', import.meta.url),
          { type: 'module' }
        );
        break;
    }
    
    // Set up message handler
    this._worker.onmessage = (e: MessageEvent<MainMsg>) => {
      const msg = e.data;
      
      if (msg.type === 'ready') {
        this.ready = true;
        console.log(`[SimClient] Worker ready in ${this.mode} mode`);
        
        // Extract shared buffers
        const { sab, meta, foodMeta } = msg.payload;
        console.log('[SimClient] Received SharedArrayBuffers:', {
          pos: sab.pos?.byteLength,
          color: sab.color?.byteLength,
          alive: sab.alive?.byteLength,
          food: sab.food?.byteLength,
          meta,
          foodMeta
        });
        this.pos = new Float32Array(sab.pos);
        this.color = new Uint8Array(sab.color);
        this.alive = new Uint8Array(sab.alive);
        if (sab.food) {
          this.food = new Uint8Array(sab.food);
        }
        this.count = meta.count;
        if (foodMeta) {
          this.foodCols = foodMeta.cols;
          this.foodRows = foodMeta.rows;
        }
        console.log('[SimClient] Buffers initialized, count:', this.count);
      }
      
      // Notify all listeners
      this.listeners.forEach(listener => listener(msg));
    };
    
    // Send initialization message
    this._worker.postMessage({
      type: 'init',
      payload: params,
    } as WorkerMsg);
    
    // Wait for ready
    return new Promise<void>((resolve) => {
      const checkReady = () => {
        if (this.ready) {
          resolve();
        } else {
          setTimeout(checkReady, 10);
        }
      };
      checkReady();
    });
  }
  
  setSpeed(speedMul: number) {
    this._worker?.postMessage({
      type: 'setSpeed',
      payload: { speedMul },
    } as WorkerMsg);
  }
  
  pause(paused: boolean) {
    this._worker?.postMessage({
      type: 'pause',
      payload: { paused },
    } as WorkerMsg);
  }
  
  setPaused(paused: boolean) {
    this.pause(paused);
  }
  
  sendRenderFps(fps: number) {
    this._worker?.postMessage({
      type: 'renderFps',
      payload: { fps },
    } as WorkerMsg);
  }
  
  onMessage(listener: (msg: MainMsg) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  terminate() {
    this._worker?.terminate();
    this._worker = null;
    this.ready = false;
    this.listeners = [];
    this.pos = null;
    this.color = null;
    this.alive = null;
    this.food = null;
  }
  
  getMode(): SimMode {
    return this.mode;
  }
  
  isReady(): boolean {
    return this.ready;
  }
  
  // Compatibility with old client interface
  get buffers() {
    return {
      pos: this.pos,
      color: this.color,
      alive: this.alive,
      food: this.food,
      count: this.count,
      foodCols: this.foodCols,
      foodRows: this.foodRows,
    };
  }
  
  // Expose worker for compatibility (though it shouldn't be used directly)
  get worker(): Worker {
    if (!this._worker) {
      throw new Error('Worker not initialized');
    }
    return this._worker;
  }
}

/**
 * Detect best mode based on browser capabilities
 */
export function detectBestMode(): SimMode {
  // Check for SharedArrayBuffer support
  if (typeof SharedArrayBuffer === 'undefined') {
    console.warn('[SimClient] SharedArrayBuffer not available, using JS mode');
    return 'js';
  }
  
  // Check core count for multi-worker decision
  const cores = navigator.hardwareConcurrency || 4;
  if (cores >= 4) {
    console.log(`[SimClient] ${cores} cores detected, using multi-worker mode`);
    return 'multi-worker';
  }
  
  return 'js';
}

/**
 * Create simulation client with auto-detection
 */
export function createSimClient(config?: SimClientConfig): HybridSimClient {
  const mode = config?.mode || detectBestMode();
  return new HybridSimClient({ ...config, mode });
}

// Type alias for backward compatibility
export type SimClient = HybridSimClient;