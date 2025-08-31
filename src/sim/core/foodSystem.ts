import { createFractalNoise2D } from '../noise';
import type { Rng as _Rng } from '../random';
import { BiomeGenerator, BIOME_CONFIGS } from '../biomes';

export class FoodSystem {
  private foodGrid: Float32Array;
  public foodGridUint8: Uint8Array | null = null;
  private foodMaxCapacity: Float32Array;
  private foodRegrowTimer: Float32Array;
  private foodAccumulator: Float32Array; // Accumulate small changes
  private foodCooldown: Float32Array; // Cooldown before regrowth starts
  private foodBiomeRegenRate: Float32Array; // Store biome-specific regen multipliers
  private cols: number;
  private rows: number;
  private worldWidth: number;
  private worldHeight: number;
  private regen: number;
  private isShared: boolean;
  private capacityParameter: number = 1; // Store the original capacity parameter for rendering
  private biomeGenerator: BiomeGenerator | null = null;
  private externalBiomeData?: {
    traversabilityMap: Uint8Array;
    gridWidth: number;
    gridHeight: number;
    cellSize: number;
  };
  private globalMaxFood: number = 10; // Track the actual max food value for scaling
  private updateCount: number = 0; // Track update count for debugging
  private consumptionCount: number = 0; // Track consumption for debugging
  private lastFoodTotal: number = 0; // Track food changes

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
    this.foodBiomeRegenRate = new Float32Array(size);
    this.foodGridUint8 = sharedBuffer || null;
  }

  initialize(seed: number, capacity: number = 1, distribution?: {
    scale?: number;
    threshold?: number;
    frequency?: number;
  }, existingBiomeData?: {
    traversabilityMap: Uint8Array;
    biomeGridArray?: Uint8Array;
    gridWidth: number;
    gridHeight: number;
    cellSize: number;
  }) {
    // Store the capacity parameter for proper rendering normalization
    this.capacityParameter = capacity;
    const noiseFood = createFractalNoise2D(seed + 12345); // Different seed offset for food variance
    
    // Create or use existing biome generator
    if (existingBiomeData) {
      // Use shared biome data from coordinator - create a minimal generator wrapper
      this.biomeGenerator = {
        getFoodMultiplier: (worldX: number, worldY: number) => {
          const cellX = Math.floor(worldX / existingBiomeData.cellSize);
          const cellY = Math.floor(worldY / existingBiomeData.cellSize);
          const idx = cellY * existingBiomeData.gridWidth + cellX;
          
          // Use biomeGridArray if available, otherwise use traversability
          if (existingBiomeData.biomeGridArray && existingBiomeData.biomeGridArray[idx] !== undefined) {
            const biomeType = existingBiomeData.biomeGridArray[idx];
            return BIOME_CONFIGS[biomeType]?.foodCapacity || 0;
          }
          
          // Fallback to traversability - traversable areas get default food
          return existingBiomeData.traversabilityMap[idx] === 1 ? 1.0 : 0;
        },
        getBiomeAt: (worldX: number, worldY: number) => {
          const cellX = Math.floor(worldX / existingBiomeData.cellSize);
          const cellY = Math.floor(worldY / existingBiomeData.cellSize);
          const idx = cellY * existingBiomeData.gridWidth + cellX;
          
          // Return biome type from array if available
          if (existingBiomeData.biomeGridArray) {
            return existingBiomeData.biomeGridArray[idx] || 0;
          }
          
          // Fallback: estimate biome from traversability (grassland for traversable, ocean for not)
          return existingBiomeData.traversabilityMap[idx] === 1 ? 3 : 0; // 3=Grassland, 0=Ocean
        }
      } as any;
    } else {
      // Create new biome generator for single-worker mode
      this.biomeGenerator = new BiomeGenerator(seed, this.worldWidth, this.worldHeight);
    }
    
    // Use distribution config or defaults - now for variance within biomes
    const varianceScale = distribution?.scale || 3;  // Smaller scale for more visible patches
    const minVariance = 0.5;  // Minimum 50% of biome capacity
    const maxVariance = 1.2;  // Maximum 120% of biome capacity
    
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = y * this.cols + x;
        const nx = x / this.cols;
        const ny = y / this.rows;
        
        // Get world coordinates for biome lookup
        const worldX = (x / this.cols) * this.worldWidth;
        const worldY = (y / this.rows) * this.worldHeight;
        const biomeMultiplier = this.biomeGenerator.getFoodMultiplier(worldX, worldY);
        
        // If biome has no food (ocean/mountain), skip
        if (biomeMultiplier === 0) {
          this.foodGrid[idx] = 0;
          this.foodMaxCapacity[idx] = 0;
          this.foodRegrowTimer[idx] = 0;
          this.foodCooldown[idx] = 0;
          continue;
        }
        
        // Check distance to nearest non-traversable biome for boundary gradient
        let boundaryPenalty = 1.0;
        const checkRadius = 3; // Check within 3 cells
        let minDistToBarrier = checkRadius + 1;
        
        for (let dy = -checkRadius; dy <= checkRadius; dy++) {
          for (let dx = -checkRadius; dx <= checkRadius; dx++) {
            if (dx === 0 && dy === 0) continue;
            const checkX = x + dx;
            const checkY = y + dy;
            if (checkX >= 0 && checkX < this.cols && checkY >= 0 && checkY < this.rows) {
              const checkWorldX = (checkX / this.cols) * this.worldWidth;
              const checkWorldY = (checkY / this.rows) * this.worldHeight;
              const checkMultiplier = this.biomeGenerator.getFoodMultiplier(checkWorldX, checkWorldY);
              if (checkMultiplier === 0) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                minDistToBarrier = Math.min(minDistToBarrier, dist);
              }
            }
          }
        }
        
        // Apply boundary penalty - food decreases near oceans/mountains
        if (minDistToBarrier <= checkRadius) {
          // Exponential falloff: at distance 1 = 30% food, distance 2 = 60%, distance 3+ = 100%
          boundaryPenalty = Math.min(1.0, minDistToBarrier * 0.3);
        }
        
        // For traversable biomes, create organic distribution with gradients
        // Use multiple octaves of noise for natural-looking patches
        const scale1 = varianceScale * 0.3;  // Very large patches for major variation
        const scale2 = varianceScale * 1.0;  // Medium patches
        const scale3 = varianceScale * 3.0;  // Small details
        const scale4 = varianceScale * 8.0;  // Fine texture
        
        // Combine multiple noise octaves for organic look with stronger variation
        let variance = 0;
        variance += (noiseFood(nx * scale1, ny * scale1) + 1) * 0.4;  // 40% weight - major patches
        variance += (noiseFood(nx * scale2, ny * scale2) + 1) * 0.3;  // 30% weight - medium
        variance += (noiseFood(nx * scale3, ny * scale3) + 1) * 0.2;  // 20% weight - details
        variance += (noiseFood(nx * scale4, ny * scale4) + 1) * 0.1;  // 10% weight - texture
        variance = variance / 2; // Normalize to 0-1 range
        
        // Create more dramatic variance with smoother transitions
        variance = Math.pow(variance, 0.7); // Less bias, more range
        
        // Apply boundary penalty to variance
        variance *= boundaryPenalty;
        
        // Apply biome-specific variance ranges with more extreme differences
        let varianceMin = 0.2;  // Default minimum
        let varianceMax = 1.4;  // Default maximum
        
        // Adjust variance ranges by biome type for more dramatic character
        if (biomeMultiplier >= 2.5) {  // Very rich biomes (forest at 3.0)
          varianceMin = 0.5;  // Much higher minimum
          varianceMax = 1.5;  // Can significantly exceed base
        } else if (biomeMultiplier >= 1.0) {  // Medium biomes (grassland at 1.5)
          varianceMin = 0.3;  // Moderate minimum
          varianceMax = 1.3;  // Some excess capacity
        } else if (biomeMultiplier >= 0.5) {  // Poor biomes (savanna at 0.8)
          varianceMin = 0.15;  // Low minimum
          varianceMax = 1.0;  // Rarely full capacity
        } else {  // Very poor biomes (desert at 0.15)
          varianceMin = 0.05;  // Extremely sparse
          varianceMax = 0.6;  // Never reaches high capacity
        }
        
        // Map variance to the biome-specific range
        variance = varianceMin + variance * (varianceMax - varianceMin);
        
        // Calculate base capacity from biome
        // With scaled capacity (100 instead of 7), forest (1.5x multiplier) should peak around 150
        // Normalize to reasonable range
        let normalizedCapacity = capacity;
        let baseCapacity = normalizedCapacity * biomeMultiplier;
        
        // Apply variance to create natural patches
        let val = baseCapacity * variance;
        
        // Ensure minimum food in all traversable areas (but very low)
        // This prevents complete dead zones while allowing sparse areas
        if (biomeMultiplier > 0 && val < 1.0) {
          val = 1.0; // Very minimal food amount (scaled up from 0.05)
        }
        
        // Set max capacity based on biome potential, not initial roll
        // This allows even initially sparse areas to regrow to full biome capacity
        // Use the biome's theoretical maximum (baseCapacity at full variance)
        const biomeMaxCapacity = baseCapacity * varianceMax;
        
        // Ensure even poor areas can regrow to something useful
        this.foodMaxCapacity[idx] = Math.max(val, biomeMaxCapacity * 0.8);
        
        // Store biome-specific regen rate multiplier
        // Get the biome regen multiplier from BIOME_CONFIGS
        const biomeType = this.biomeGenerator.getBiomeAt(worldX, worldY);
        const biomeConfig = BIOME_CONFIGS[biomeType];
        this.foodBiomeRegenRate[idx] = biomeConfig?.foodRegenRate || 1.0;
        
        if (val > 0) {
          // Start food at 50-80% of max capacity for better initial availability
          const startingPercent = 0.5 + Math.random() * 0.3; // 50-80%
          this.foodGrid[idx] = val * startingPercent;
          
          // Set initial cooldown/timer so food grows naturally
          this.foodRegrowTimer[idx] = 0;
          this.foodCooldown[idx] = Math.random() * 1; // 0-1s random initial delay
        } else {
          // No food areas stay empty (only in non-traversable biomes)
          this.foodGrid[idx] = 0;
          this.foodRegrowTimer[idx] = 0;
          this.foodCooldown[idx] = 0;
        }
      }
    }
    
    // Calculate actual max food value BEFORE syncing
    this.globalMaxFood = 0;
    let foodByBiome: Record<string, { count: number; total: number; max: number }> = {};
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const idx = y * this.cols + x;
        if (this.foodGrid[idx] > 0) {
          // Track global max for scaling
          this.globalMaxFood = Math.max(this.globalMaxFood, this.foodMaxCapacity[idx]);
          
          const worldX = (x / this.cols) * this.worldWidth;
          const worldY = (y / this.rows) * this.worldHeight;
          const biomeType = this.biomeGenerator.getBiomeAt(worldX, worldY);
          
          if (!foodByBiome[biomeType]) {
            foodByBiome[biomeType] = { count: 0, total: 0, max: 0 };
          }
          foodByBiome[biomeType].count++;
          foodByBiome[biomeType].total += this.foodGrid[idx];
          foodByBiome[biomeType].max = Math.max(foodByBiome[biomeType].max, this.foodMaxCapacity[idx]);
        }
      }
    }
    
    // Add small buffer to ensure we don't clip at max
    this.globalMaxFood = this.globalMaxFood * 1.1;
    
    // Initialize food total for tracking changes
    this.lastFoodTotal = 0;
    for (let i = 0; i < this.foodGrid.length; i++) {
      this.lastFoodTotal += this.foodGrid[i];
    }
    
    console.log(`[FoodSystem] Pre-sync totalFood: ${this.lastFoodTotal.toFixed(0)}, globalMax: ${this.globalMaxFood.toFixed(2)}`);
    
    // NOW sync to Uint8 after we know the proper globalMaxFood
    this.syncToUint8();
    
    // Check if sync corrupted our values
    let postSyncTotal = 0;
    for (let i = 0; i < this.foodGrid.length; i++) {
      postSyncTotal += this.foodGrid[i];
    }
    
    console.log(`[FoodSystem] Post-sync totalFood: ${postSyncTotal.toFixed(0)} (${postSyncTotal === this.lastFoodTotal ? 'unchanged' : 'CHANGED!'})`);
    
    console.log(`[FoodSystem] Food distribution by biome:`);
    Object.entries(foodByBiome).forEach(([biome, stats]) => {
      const avg = stats.total / stats.count;
      console.log(`  ${biome}: ${stats.count} cells, avg: ${avg.toFixed(3)}, max: ${stats.max.toFixed(3)}`);
    });
  }

  update(dt: number) {
    // When using shared buffer, sync from it first to see other workers' consumption
    if (this.foodGridUint8 && this.isShared) {
      for (let i = 0; i < this.foodGridUint8.length; i++) {
        // Convert back using the SAME scaling factor as syncToUint8()
        // This ensures we read the values correctly that were written
        const scaleFactor = 255 / this.globalMaxFood;
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
      // Only regrow where food can exist (maxCapacity > 0)
      const maxCapacity = this.foodMaxCapacity[i];
      if (maxCapacity > 0) {
        // Skip if no regrowth
        if (this.regen === 0) continue;
        
        // Target capacity is the stored max capacity for this cell
        // This ensures all areas can regrow to their biome's potential
        const targetCapacity = maxCapacity;
        
        // Only process if below target capacity
        if (this.foodGrid[i] < targetCapacity) {
          // Apply biome-specific regen multiplier (moved earlier to fix scope issue)
          const biomeRegenMultiplier = this.foodBiomeRegenRate[i] || 1.0;
          const effectiveRegen = this.regen * biomeRegenMultiplier;
          
          // Cooldown when completely depleted (helps create recovery delay)
          // Only apply cooldown if food is below 2% of capacity
          if (this.foodGrid[i] < targetCapacity * 0.02) {
            if (this.foodCooldown[i] <= 0) {
              // Start cooldown when depleted
              this.foodCooldown[i] = 0.3 / effectiveRegen; // 0.3 second base cooldown (reduced)
            }
            if (this.foodCooldown[i] > 0) {
              this.foodCooldown[i] -= dt;
              // Allow small growth during cooldown to show recovery starting
              const tinyGrowth = targetCapacity * 0.005 * effectiveRegen * dt;
              this.foodGrid[i] = Math.min(targetCapacity * 0.02, this.foodGrid[i] + tinyGrowth);
              continue;
            }
          }
          
          // Calculate total regrowth time based on effective regen value
          // At regen=1.0, biome multiplier=1.0: 1 second to full
          // At regen=0.5, biome multiplier=1.0: 2 seconds to full
          // Desert (0.5x) takes 2x longer, Forest (1.2x) is 20% faster
          const totalRegenTime = effectiveRegen > 0 ? 1 / effectiveRegen : Number.MAX_VALUE;
          
          // Handle very fast regrowth case
          if (effectiveRegen >= 1.0) {
            // Nearly instant regrowth to target capacity
            this.foodGrid[i] = targetCapacity;
            continue;
          }
          
          // S-curve (sigmoid) growth for more realistic regeneration
          // Starts slow when depleted, accelerates in middle, slows near capacity
          const currentPercent = this.foodGrid[i] / targetCapacity;
          
          // Sigmoid function parameters
          // k controls steepness (higher = sharper transition)
          // x0 is the midpoint (0.5 = symmetric curve)
          const k = 4; // Reduced steepness for wider growth band
          const x0 = 0.35; // Midpoint at 35% for faster initial recovery
          
          // Calculate growth modifier using sigmoid derivative
          // This gives us the instantaneous growth rate at current capacity
          // Derivative of sigmoid: k * sigmoid(x) * (1 - sigmoid(x))
          const sigmoid = 1 / (1 + Math.exp(-k * (currentPercent - x0)));
          const growthModifier = k * sigmoid * (1 - sigmoid);
          
          // Apply S-curve modifier to base growth rate
          // Peak growth happens around 35% capacity (x0)
          // Moderate below 15%, slowing above 80%
          const baseGrowthRate = targetCapacity * effectiveRegen;
          let growth = baseGrowthRate * growthModifier * dt;
          
          // Add stronger baseline growth to prevent stagnation
          // This ensures even depleted areas can recover reasonably
          const baselineGrowth = baseGrowthRate * 0.15 * dt; // 15% of max rate as baseline
          growth += baselineGrowth;
          
          // Ensure minimum growth for precision (but smaller than before)
          if (effectiveRegen > 0 && growth < 0.008) {
            growth = 0.008; // Half the previous minimum
          }
          
          // Apply growth
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
      let totalValue = 0;
      for (let i = 0; i < this.foodGrid.length; i++) {
        // Scale food values dynamically based on actual max
        // This gives good visibility across the actual range
        const scaleFactor = 255 / this.globalMaxFood;
        const clamped = Math.max(0, Math.min(255, this.foodGrid[i] * scaleFactor));
        this.foodGridUint8[i] = Math.floor(clamped);
        
        // Debug counting
        if (this.foodGrid[i] > 0) {
          nonZeroCount++;
          maxValue = Math.max(maxValue, this.foodGrid[i]);
          totalValue += this.foodGrid[i];
        }
      }
      
      // Track consumption rate (but skip first update as it's not a real change)
      let foodChange = 0;
      if (this.updateCount > 0) {
        foodChange = totalValue - this.lastFoodTotal;
      }
      this.lastFoodTotal = totalValue;
      
      // Debug log more frequently during early updates
      if (this.updateCount < 10 || Math.random() < 0.001) { // Log first 10 updates or rarely after
        console.log(`[FoodSystem] Update #${this.updateCount}: ${nonZeroCount} cells with food, max: ${maxValue.toFixed(3)}, avg: ${nonZeroCount > 0 ? (totalValue/nonZeroCount).toFixed(3) : 0}, totalFood: ${totalValue.toFixed(0)}, change: ${foodChange.toFixed(2)}, consumed: ${this.consumptionCount}`);
        this.consumptionCount = 0; // Reset consumption counter after logging
      }
      this.updateCount++;
    }
  }

  consumeAt(worldX: number, worldY: number, pickiness: number = 0.3): number {
    if (worldX < 0 || worldX >= this.worldWidth || 
        worldY < 0 || worldY >= this.worldHeight) {
      return 0;
    }

    const fx = Math.floor((worldX / this.worldWidth) * this.cols);
    const fy = Math.floor((worldY / this.worldHeight) * this.rows);
    const idx = fy * this.cols + fx;
    
    // When using shared buffer, check and update it directly
    if (this.foodGridUint8 && this.isShared) {
      const scaleFactor = 255 / this.globalMaxFood; // Same scaling as in update
      const currentValue = this.foodGridUint8[idx] / scaleFactor;
      
      // Calculate minimum consumable threshold based on pickiness (foodStandards gene)
      // pickiness ranges from 0 (desperate, eats anything) to 1 (very picky)
      // Threshold calibration:
      // - pickiness 0.0: threshold = 0.1 (can eat desert food at 0.15 * variance)
      // - pickiness 0.3: threshold = 0.25 (can eat savanna at 0.8 * variance, maybe desert if rich patch)
      // - pickiness 0.5: threshold = 0.5 (needs grassland or better, savanna only if rich)
      // - pickiness 0.7: threshold = 1.0 (needs good grassland or forest)
      // - pickiness 1.0: threshold = 2.0 (only eats rich forest patches)
      
      // Exponential scaling for more interesting dynamics
      const minThreshold = 0.1 + pickiness * pickiness * 3.0; // 0.1 to 3.1 range
      
      if (currentValue > minThreshold) {
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
        this.consumptionCount++; // Track consumption
        return 1;
      }
      return 0;
    }
    
    // Fallback to local grid for non-shared mode
    const minThreshold = 0.1 + pickiness * pickiness * 3.0; // Same calculation as above
    if (this.foodGrid[idx] > minThreshold) {
      this.foodGrid[idx] = 0;
      this.foodRegrowTimer[idx] = 0;
      this.foodAccumulator[idx] = 0; // Reset accumulator
      // Simple cooldown: 20% of total regen time
      const totalTime = this.regen > 0 ? 1 + 18 * (1 - this.regen) : Number.MAX_VALUE;
      const baseCooldown = totalTime * 0.2;
      // Handle very high regen values
      this.foodCooldown[idx] = this.regen >= 0.95 ? 0.01 : Math.max(0.1, baseCooldown);
      this.consumptionCount++; // Track consumption
      return 1;
    }
    return 0;
  }

  syncToUint8() {
    if (!this.foodGridUint8) return;
    
    for (let i = 0; i < this.foodGrid.length; i++) {
      // Use the same scaling as the update loop (dynamic max)
      const scaleFactor = 255 / this.globalMaxFood;
      const clamped = Math.max(0, Math.min(255, this.foodGrid[i] * scaleFactor));
      this.foodGridUint8[i] = Math.floor(clamped);
    }
  }

  syncFromUint8() {
    if (!this.foodGridUint8) return;
    
    console.log(`[FoodSystem] syncFromUint8 called, globalMaxFood: ${this.globalMaxFood}`);
    
    // If globalMaxFood hasn't been set properly, estimate it
    if (this.globalMaxFood <= 15) {
      // Estimate based on expected max values
      // Check if we're using scaled values (capacity ~100) or old values (capacity ~7)
      // If we have no food cells, use a reasonable default based on expected capacity
      this.globalMaxFood = this.capacityParameter > 50 ? 200.0 : 15.0;
      console.log(`[FoodSystem] Using estimated globalMaxFood: ${this.globalMaxFood} (capacity param: ${this.capacityParameter})`);
    }
    
    // Use the same scaling factor as in the update loop
    const scaleFactor = 255 / this.globalMaxFood;
    
    let syncedCount = 0;
    let syncedMax = 0;
    
    for (let i = 0; i < this.foodGridUint8.length; i++) {
      // Reverse the scaling to get actual food values
      this.foodGrid[i] = this.foodGridUint8[i] / scaleFactor;
      
      if (this.foodGrid[i] > 0) {
        syncedCount++;
        syncedMax = Math.max(syncedMax, this.foodGrid[i]);
        // Set max capacity if not already set
        if (this.foodMaxCapacity[i] === 0) {
          this.foodMaxCapacity[i] = this.foodGrid[i] * 1.2; // Estimate max as 120% of current
        }
      }
      // Don't reset timers - preserve existing state
    }
    
    console.log(`[FoodSystem] Synced ${syncedCount} food cells, max value: ${syncedMax.toFixed(3)}`);
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
    
    // Recalculate global max when capacity changes
    // Forest biome at 1.5x multiplier with max variance should be peak
    const normalizedCapacity = capacity;
    const maxBiomeMultiplier = 1.5; // Forest
    const maxVariance = 1.3; // Maximum variance for forest
    this.globalMaxFood = normalizedCapacity * maxBiomeMultiplier * maxVariance * 1.1; // 1.1 buffer
    
    // Immediately sync to update the visual representation
    this.syncToUint8();
  }
  
  setRegen(regen: number) {
    this.regen = regen;
  }
  
  getBiomeGenerator(): BiomeGenerator | null {
    return this.biomeGenerator;
  }
}