import { createFractalNoise2D } from '../noise';
import type { Rng } from '../random';

export class FoodSystem {
  private foodGrid: Float32Array;
  public foodGridUint8: Uint8Array | null = null;
  private foodMaxCapacity: Float32Array;
  private foodRegrowTimer: Float32Array;
  private foodAccumulator: Float32Array; // Accumulate small changes
  private cols: number;
  private rows: number;
  private worldWidth: number;
  private worldHeight: number;
  private regen: number;
  private isShared: boolean;

  constructor(
    cols: number,
    rows: number,
    worldWidth: number,
    worldHeight: number,
    regen: number = 0.05,
    sharedBuffer?: Uint8Array
  ) {
    this.cols = cols;
    this.rows = rows;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.regen = regen;
    this.isShared = !!sharedBuffer;
    
    const size = cols * rows;
    this.foodGrid = new Float32Array(size);
    this.foodMaxCapacity = new Float32Array(size);
    this.foodRegrowTimer = new Float32Array(size);
    this.foodAccumulator = new Float32Array(size);
    this.foodGridUint8 = sharedBuffer || null;
  }

  initialize(seed: number, capacity: number = 1, distribution?: {
    scale?: number;
    threshold?: number;
    frequency?: number;
  }) {
    const noiseFood = createFractalNoise2D(seed);
    
    // Use distribution config or defaults
    const scale = distribution?.scale || 10;  // Default scale
    const threshold = distribution?.threshold || 0.4;  // Default threshold
    const frequency = distribution?.frequency || 1;  // Default frequency
    
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = y * this.cols + x;
        const nx = x / this.cols;
        const ny = y / this.rows;
        
        // Apply scale to noise coordinates
        let val = (noiseFood(nx * scale * frequency, ny * scale * frequency) + 1) / 2;
        val = Math.pow(val, 1.5);
        val = val > threshold ? capacity : 0;
        
        this.foodGrid[idx] = val;
        this.foodMaxCapacity[idx] = val;
        this.foodRegrowTimer[idx] = 0;
      }
    }
    
    this.syncToUint8();
  }

  update(dt: number) {
    // When using shared buffer, sync from it first to see other workers' consumption
    if (this.foodGridUint8 && this.isShared) {
      for (let i = 0; i < this.foodGridUint8.length; i++) {
        const sharedValue = this.foodGridUint8[i] / 255;
        // Always sync consumed cells (when shared is less than local)
        // This ensures consumption by any worker is reflected
        this.foodGrid[i] = Math.min(this.foodGrid[i], sharedValue);
      }
    }
    
    // Now regrow based on current state with accumulation for small values
    for (let i = 0; i < this.foodGrid.length; i++) {
      if (this.foodGrid[i] < this.foodMaxCapacity[i]) {
        // Use exponential curve: rate = base^(10*regen - 5)
        // regen=0.0: no regrowth
        // regen=0.1: very slow (~100s to reach 0.3)
        // regen=0.3: slow (~20s to reach 0.3)
        // regen=0.5: moderate (~5s to reach 0.3)
        // regen=0.7: fast (~2s to reach 0.3)
        // regen=0.9: very fast (~0.5s to reach 0.3)
        // regen=1.0: instant
        const scaledRegen = this.regen === 0 ? 0 : 
                           this.regen === 1 ? 10 : // Instant regrowth
                           Math.pow(2, this.regen * 10 - 5) * 0.01;
        const regenPerFrame = scaledRegen * dt;
        
        // Accumulate small changes to avoid precision loss
        this.foodAccumulator[i] += regenPerFrame;
        
        // Only apply accumulated changes when they're meaningful (>= 0.001)
        if (this.foodAccumulator[i] >= 0.001) {
          const newValue = Math.min(
            this.foodMaxCapacity[i],
            this.foodGrid[i] + this.foodAccumulator[i]
          );
          this.foodGrid[i] = newValue;
          this.foodAccumulator[i] = 0; // Reset accumulator
        }
      }
    }
    
    // Sync all changes to the shared buffer for rendering
    if (this.foodGridUint8 && this.isShared) {
      for (let i = 0; i < this.foodGrid.length; i++) {
        this.foodGridUint8[i] = Math.floor(Math.max(0, Math.min(1, this.foodGrid[i])) * 255);
      }
    }
  }

  consumeAt(worldX: number, worldY: number): number {
    if (worldX < 0 || worldX >= this.worldWidth || 
        worldY < 0 || worldY >= this.worldHeight) {
      return 0;
    }

    const fx = Math.floor((worldX / this.worldWidth) * this.cols);
    const fy = Math.floor((worldY / this.worldHeight) * this.rows);
    const idx = fy * this.cols + fx;
    
    // When using shared buffer, check and update it directly
    if (this.foodGridUint8 && this.isShared) {
      const currentValue = this.foodGridUint8[idx] / 255;
      if (currentValue > 0.3) {
        // Use atomic-like operation to consume food
        this.foodGridUint8[idx] = 0;
        this.foodGrid[idx] = 0;
        this.foodRegrowTimer[idx] = 0;
        this.foodAccumulator[idx] = 0; // Reset accumulator
        return 1;
      }
      return 0;
    }
    
    // Fallback to local grid for non-shared mode
    if (this.foodGrid[idx] > 0.3) {
      this.foodGrid[idx] = 0;
      this.foodRegrowTimer[idx] = 0;
      this.foodAccumulator[idx] = 0; // Reset accumulator
      return 1;
    }
    return 0;
  }

  syncToUint8() {
    if (!this.foodGridUint8) return;
    
    for (let i = 0; i < this.foodGrid.length; i++) {
      this.foodGridUint8[i] = Math.floor(
        Math.max(0, Math.min(1, this.foodGrid[i])) * 255
      );
    }
  }

  syncFromUint8() {
    if (!this.foodGridUint8) return;
    
    for (let i = 0; i < this.foodGridUint8.length; i++) {
      this.foodGrid[i] = this.foodGridUint8[i] / 255;
      this.foodMaxCapacity[i] = this.foodGrid[i];
      this.foodRegrowTimer[i] = 0;
    }
  }

  getGrid() { return this.foodGrid; }
  getCols() { return this.cols; }
  getRows() { return this.rows; }
}