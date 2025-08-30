import { createFractalNoise2D } from '../noise';
import type { Rng } from '../random';

export class FoodSystem {
  private foodGrid: Float32Array;
  public foodGridUint8: Uint8Array | null = null;
  private foodMaxCapacity: Float32Array;
  private foodRegrowTimer: Float32Array;
  private foodAccumulator: Float32Array; // Accumulate small changes
  private foodCooldown: Float32Array; // Cooldown before regrowth starts
  private cols: number;
  private rows: number;
  private worldWidth: number;
  private worldHeight: number;
  private regen: number;
  private isShared: boolean;
  private capacityParameter: number = 1; // Store the original capacity parameter for rendering

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
    this.foodCooldown = new Float32Array(size);
    this.foodGridUint8 = sharedBuffer || null;
  }

  initialize(seed: number, capacity: number = 1, distribution?: {
    scale?: number;
    threshold?: number;
    frequency?: number;
  }) {
    // Store the capacity parameter for proper rendering normalization
    this.capacityParameter = capacity;
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
        // Instead of binary threshold, use smooth transition
        // Below threshold: no food
        // Above threshold: scale smoothly from 0 to capacity
        if (val < threshold) {
          val = 0;
        } else {
          // Scale from threshold to 1 -> 0 to capacity
          val = ((val - threshold) / (1 - threshold)) * capacity;
        }
        
        // Set max capacity to full calculated value
        this.foodMaxCapacity[idx] = val;
        
        if (val > 0) {
          // Start food at 30-60% of max capacity and let it mature
          const startingPercent = 0.3 + Math.random() * 0.3; // 30-60%
          this.foodGrid[idx] = val * startingPercent;
          
          // Set initial cooldown/timer so food grows naturally
          this.foodRegrowTimer[idx] = 0;
          this.foodCooldown[idx] = Math.random() * 2; // 0-2s random initial delay
        } else {
          // No food areas stay empty
          this.foodGrid[idx] = 0;
          this.foodRegrowTimer[idx] = 0;
          this.foodCooldown[idx] = 0;
        }
      }
    }
    
    this.syncToUint8();
    
    // Debug: Count how much food was initialized
    let initFoodCount = 0;
    let initMaxValue = 0;
    for (let i = 0; i < this.foodGrid.length; i++) {
      if (this.foodGrid[i] > 0) {
        initFoodCount++;
        initMaxValue = Math.max(initMaxValue, this.foodGrid[i]);
      }
    }
    console.log(`[FoodSystem] Initialized: ${initFoodCount} cells with food (30-60% of max), max: ${initMaxValue.toFixed(3)}, capacity param: ${capacity}`);
  }

  update(dt: number) {
    // When using shared buffer, sync from it first to see other workers' consumption
    if (this.foodGridUint8 && this.isShared) {
      for (let i = 0; i < this.foodGridUint8.length; i++) {
        // Convert back using the inverse of the scaling factor
        const baseScale = 85;
        const richnessMultiplier = Math.max(0.3, this.capacityParameter / 3);
        const scaleFactor = baseScale * richnessMultiplier;
        const sharedValue = this.foodGridUint8[i] / scaleFactor;
        // Always sync consumed cells (when shared is less than local)
        // This ensures consumption by any worker is reflected
        this.foodGrid[i] = Math.min(this.foodGrid[i], sharedValue);
      }
    }
    
    // Calibrated regrowth timing:
    // regen = 0.0: Never regrows
    // regen = 0.5: 10 seconds to full capacity (mid-slider default)  
    // regen = 1.0: 1 second to full capacity (fastest)
    // Formula: totalTime = 1 + 9 * (1 - regen) seconds for regen > 0
    
    for (let i = 0; i < this.foodGrid.length; i++) {
      // Only regrow where food was originally present (maxCapacity > 0)
      const initialCapacity = this.foodMaxCapacity[i];
      if (initialCapacity > 0) {
        // Skip if no regrowth
        if (this.regen === 0) continue;
        
        // Calculate enhanced capacity for cells with initial capacity
        // Low-capacity cells can grow to be more useful over time
        let targetCapacity = initialCapacity;
        
        // If initial capacity was below consumable threshold, boost it
        if (initialCapacity < 0.3) {
          // Grow to at least consumable (0.3) plus a small bonus based on initial value
          targetCapacity = 0.3 + initialCapacity * 0.5;
        } else {
          // Higher capacity cells can grow 20% beyond their initial value
          targetCapacity = initialCapacity * 1.2;
        }
        
        // Only process if below target capacity
        if (this.foodGrid[i] < targetCapacity) {
          // Simple cooldown phase (20% of total time)
          if (this.foodCooldown[i] > 0) {
            this.foodCooldown[i] -= dt;
            continue;
          }
          
          // Calculate total regrowth time based on regen value
          const totalRegenTime = this.regen > 0 ? 1 + 18 * (1 - this.regen) : Number.MAX_VALUE;
          
          // Handle very fast regrowth case
          if (this.regen >= 0.95) {
            // Nearly instant regrowth to target capacity
            this.foodGrid[i] = targetCapacity;
            continue;
          }
          
          // Growth phase - simple linear growth
          const growthRate = targetCapacity / (totalRegenTime * 0.8); // 80% of time is growth
          const growth = growthRate * dt;
          
          // Apply growth directly for smoother visual updates
          this.foodGrid[i] = Math.min(
            targetCapacity,
            this.foodGrid[i] + growth
          );
        }
      }
      // Cells with zero initial capacity stay at zero - no growth in barren areas
    }
    
    // Sync all changes to the shared buffer for rendering
    if (this.foodGridUint8 && this.isShared) {
      let nonZeroCount = 0;
      let maxValue = 0;
      for (let i = 0; i < this.foodGrid.length; i++) {
        // Scale to make food visible with richness affecting brightness
        // Higher richness (capacity) = brighter food
        // Use fixed scaling that makes consumable threshold (0.3) visible
        const baseScale = 85; // Base scaling factor
        const richnessMultiplier = Math.max(0.3, this.capacityParameter / 3); // 0.3x to 1x multiplier
        const scaleFactor = baseScale * richnessMultiplier;
        const clamped = Math.max(0, Math.min(255, this.foodGrid[i] * scaleFactor));
        this.foodGridUint8[i] = Math.floor(clamped);
        
        // Debug counting
        if (this.foodGrid[i] > 0) {
          nonZeroCount++;
          maxValue = Math.max(maxValue, this.foodGrid[i]);
        }
      }
      
      // Debug log very rarely
      if (Math.random() < 0.00001) { // Log extremely rarely
        console.log(`[FoodSystem] Update: ${nonZeroCount} cells with food, max value: ${maxValue.toFixed(3)}, capacity: ${this.capacityParameter}`);
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
      const baseScale = 85;
      const richnessMultiplier = Math.max(0.3, this.capacityParameter / 3);
      const scaleFactor = baseScale * richnessMultiplier;
      const currentValue = this.foodGridUint8[idx] / scaleFactor;
      if (currentValue > 0.3) {
        // Use atomic-like operation to consume food
        this.foodGridUint8[idx] = 0;
        this.foodGrid[idx] = 0;
        this.foodRegrowTimer[idx] = 0;
        this.foodAccumulator[idx] = 0; // Reset accumulator
        // Simple cooldown: 20% of total regen time
        const totalTime = this.regen > 0 ? 1 + 18 * (1 - this.regen) : Number.MAX_VALUE;
        const baseCooldown = totalTime * 0.2;
        // Handle very high regen values
        this.foodCooldown[idx] = this.regen >= 0.95 ? 0.01 : Math.max(0.1, baseCooldown);
        return 1;
      }
      return 0;
    }
    
    // Fallback to local grid for non-shared mode
    if (this.foodGrid[idx] > 0.3) {
      this.foodGrid[idx] = 0;
      this.foodRegrowTimer[idx] = 0;
      this.foodAccumulator[idx] = 0; // Reset accumulator
      // Simple cooldown: 20% of total regen time
      const totalTime = this.regen > 0 ? 1 + 18 * (1 - this.regen) : Number.MAX_VALUE;
      const baseCooldown = totalTime * 0.2;
      // Handle very high regen values
      this.foodCooldown[idx] = this.regen >= 0.95 ? 0.01 : Math.max(0.1, baseCooldown);
      return 1;
    }
    return 0;
  }

  syncToUint8() {
    if (!this.foodGridUint8) return;
    
    for (let i = 0; i < this.foodGrid.length; i++) {
      // Use the same scaling as the update loop
      const baseScale = 85;
      const richnessMultiplier = Math.max(0.3, this.capacityParameter / 3);
      const scaleFactor = baseScale * richnessMultiplier;
      const clamped = Math.max(0, Math.min(255, this.foodGrid[i] * scaleFactor));
      this.foodGridUint8[i] = Math.floor(clamped);
    }
  }

  syncFromUint8() {
    if (!this.foodGridUint8) return;
    
    for (let i = 0; i < this.foodGridUint8.length; i++) {
      this.foodGrid[i] = this.foodGridUint8[i] / 255;
      this.foodMaxCapacity[i] = this.foodGrid[i];
      this.foodRegrowTimer[i] = 0;
      this.foodCooldown[i] = 0;
    }
  }

  getGrid() { return this.foodGrid; }
  getCols() { return this.cols; }
  getRows() { return this.rows; }
  
  getFoodStats() {
    let currentFood = 0;
    let maxCapacity = 0;
    
    for (let i = 0; i < this.foodGrid.length; i++) {
      currentFood += this.foodGrid[i];
      maxCapacity += this.foodMaxCapacity[i];
    }
    
    const percentage = maxCapacity > 0 ? (currentFood / maxCapacity) * 100 : 0;
    
    return {
      current: Math.round(currentFood),
      capacity: Math.round(maxCapacity),
      percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
    };
  }
  
  setCapacityParameter(capacity: number) {
    // Update the capacity parameter for proper rendering normalization
    // This allows updating the visual brightness without re-initializing the whole grid
    this.capacityParameter = capacity;
    // Immediately sync to update the visual representation
    this.syncToUint8();
  }
}