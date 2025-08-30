import { EntitySystem } from './entitySystem';
import { FoodSystem } from './foodSystem';
import { SpatialHash } from '../spatialHash';
import { efficientMovementOptimized } from '../spatialBehaviorsOptimized';
import { createRng, type Rng } from '../random';
import { energyConfig, GENE_COUNT, FIXED_TIMESTEP } from './constants';
import type { SimStats } from '../types';

export class SimulationCore {
  // Systems
  entities: EntitySystem;
  food: FoodSystem;
  grid: SpatialHash;
  
  // State
  time: number = 0;
  paused: boolean = true;  // Start paused until user clicks start
  speedMul: number = 1;
  count: number = 0;
  
  // Random
  rand: Rng;
  
  // Full views for multi-worker spatial queries (optional)
  fullPos?: Float32Array;
  fullAlive?: Uint8Array;
  fullTribeId?: Uint16Array;
  fullGenes?: Float32Array;
  fullEnergy?: Float32Array;
  fullVel?: Float32Array;
  fullAge?: Float32Array;
  fullColor?: Uint8Array;
  fullOrientation?: Float32Array;
  
  // World
  worldWidth: number;
  worldHeight: number;
  
  // Statistics
  birthsByTribe: Uint32Array;
  deathsByTribe: Uint32Array;
  starvedByTribe: Uint32Array;
  killsByTribe: Uint32Array;
  tribeNames: string[] = [];
  tribeColors: number[] = [];
  
  // Config
  allowHybrids: boolean = true;
  updateFood: boolean = true;  // Whether this instance should update food
  workerRegion?: { x: number; y: number; width: number; height: number; x2: number; y2: number };
  isMultiWorker: boolean = false;
  startIdx: number = 0;  // Start index for this worker's entities
  endIdx: number = 0;    // End index for this worker's entities
  
  constructor(
    worldWidth: number,
    worldHeight: number,
    cap: number,
    seed: number,
    tribeCount: number = 3,
    totalEntities: number = cap  // For multi-worker mode: total entities across all workers
  ) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.rand = createRng(seed);
    
    // Initialize systems
    this.entities = new EntitySystem(cap);
    this.food = new FoodSystem(256, 256, worldWidth, worldHeight);
    // Use totalEntities for spatial hash to handle multi-worker neighbor queries
    this.grid = new SpatialHash(worldWidth, worldHeight, 80, totalEntities);
    
    // Initialize stats
    this.birthsByTribe = new Uint32Array(tribeCount);
    this.deathsByTribe = new Uint32Array(tribeCount);
    this.starvedByTribe = new Uint32Array(tribeCount);
    this.killsByTribe = new Uint32Array(tribeCount);
    
    // Initialize entity range (will be overridden in multi-worker mode)
    this.endIdx = cap;
  }

  step(dt: number) {
    if (this.paused) return;
    
    this.time += dt;
    
    // Rebuild spatial hash - use full views if available (multi-worker mode)
    if (this.fullPos && this.fullAlive) {
      // Multi-worker: use full entity data for spatial queries
      const totalCount = this.fullPos.length / 2;
      this.grid.rebuild(this.fullPos, this.fullAlive, totalCount);
    } else {
      // Single worker: use local entities only
      this.grid.rebuild(this.entities.pos, this.entities.alive, this.count);
    }
    
    // Update food (only if enabled - for multi-worker, only worker 0 updates)
    if (this.updateFood) {
      this.food.update(dt);
    }
    
    // Update entities based on spatial region
    const entitiesToCheck = this.isMultiWorker && this.fullPos ? this.fullPos.length / 2 : this.count;
    
    // Log once per second what each worker is processing
    if (this.isMultiWorker && Math.floor(this.time) % 5 === 0 && Math.floor(this.time) !== Math.floor(this.time - dt)) {
      let inRegion = 0;
      let outRegion = 0;
      for (let i = 0; i < entitiesToCheck; i++) {
        if (!this.fullAlive![i]) continue;
        const px = this.fullPos![i * 2];
        const py = this.fullPos![i * 2 + 1];
        const inOur = px >= this.workerRegion!.x && px < this.workerRegion!.x2 &&
                     py >= this.workerRegion!.y && py < this.workerRegion!.y2;
        if (inOur) inRegion++;
        else outRegion++;
      }
      // Log occasionally to avoid spam
      if (this.totalStepCount % 100 === 0) {
        console.log(`[Worker Region ${this.workerRegion!.x},${this.workerRegion!.y}] Processing ${inRegion} entities (${outRegion} outside)`);
      }
    }

    for (let i = 0; i < entitiesToCheck; i++) {
      // In multi-worker mode, only process entities in our region
      if (this.isMultiWorker && this.workerRegion && this.fullPos && this.fullAlive) {
        if (!this.fullAlive[i]) continue;

        const px = this.fullPos[i * 2];
        const py = this.fullPos[i * 2 + 1];
        const inOurRegion = px >= this.workerRegion.x && px < this.workerRegion.x2 &&
          py >= this.workerRegion.y && py < this.workerRegion.y2;

        if (!inOurRegion) continue;

        // Process using full arrays
        this.updateEntityMultiWorker(i, dt);
      } else {
        // Single worker mode
        if (!this.entities.alive[i]) continue;
        this.updateEntitySingleWorker(i, dt);
      }
    }
  }

  private updateEntityMultiWorker(i: number, dt: number) {
    // Multi-worker: use full arrays for everything
    const base = i * GENE_COUNT;
    const metabolism = this.fullGenes![base + 2];

    // Age and metabolism
    if (this.fullAge) {
      this.fullAge[i] += dt;
    }
    this.fullEnergy![i] -= energyConfig.metabolismBase * metabolism * dt;

    // Death checks - lifespan varies by metabolism and individual variance
    // Higher metabolism = shorter life (more wear and tear)
    const metabolismFactor = 1 + (metabolism - 0.15) * 2; // 0.7x to 1.3x based on metabolism
    // Add individual variance using entity index as seed for consistency
    const individualVariance = 0.8 + 0.4 * ((i * 0.618033988749895) % 1); // 0.8x to 1.2x variance
    const adjustedDeathAge = (energyConfig.deathAge / metabolismFactor) * individualVariance;
    const maxAge = this.fullAge ? this.fullAge[i] > adjustedDeathAge : false;
    if (this.fullEnergy![i] <= 0 || maxAge) {
      this.fullAlive![i] = 0;
      this.deathsByTribe[this.fullTribeId![i]]++;
      if (this.fullEnergy![i] <= 0) {
        this.starvedByTribe[this.fullTribeId![i]]++;
      }
      // Clear color to prevent ghost colors on respawn
      if (this.fullColor) {
        this.fullColor[i * 3] = 0;
        this.fullColor[i * 3 + 1] = 0;
        this.fullColor[i * 3 + 2] = 0;
      }
      return;
    }

    // Movement - use full arrays
    if (this.fullPos && this.fullVel) {
      efficientMovementOptimized(
        i,
        this.fullPos!,
        this.fullVel!,
        this.fullAlive!,
        this.fullEnergy!,
        this.fullTribeId!,
        this.fullGenes!,
        this.grid,
        this.food.getGrid(),
        this.food.getCols(),
        this.food.getRows(),
        { width: this.worldWidth, height: this.worldHeight },
        this.rand,
        dt,
        this.killsByTribe,
        this.deathsByTribe,
        this.fullColor || undefined,
        this.birthsByTribe,
        this.allowHybrids,
        this.fullOrientation || undefined,
        this.fullAge || undefined,
        this.fullPos!,
        this.fullAlive!,
        this.fullTribeId!,
        this.fullGenes!,
        this.fullEnergy!,
        this.fullVel!
      );

      // Apply velocity
      const vx = this.fullVel[i * 2];
      const vy = this.fullVel[i * 2 + 1];
      this.fullPos[i * 2] += vx * dt;
      this.fullPos[i * 2 + 1] += vy * dt;

      // Wrap world
      this.fullPos[i * 2] = ((this.fullPos[i * 2] % this.worldWidth) + this.worldWidth) % this.worldWidth;
      this.fullPos[i * 2 + 1] = ((this.fullPos[i * 2 + 1] % this.worldHeight) + this.worldHeight) % this.worldHeight;
    }

    // Food consumption
    const consumed = this.food.consumeAt(this.fullPos![i * 2], this.fullPos![i * 2 + 1]);
    if (consumed > 0) {
      const diet = this.fullGenes![base + 7];
      const plantFoodEfficiency = diet < 0 ? 1.0 : Math.max(0.3, 1.0 - Math.abs(diet));
      this.fullEnergy![i] += Math.min(30, consumed * 8 * plantFoodEfficiency);
      this.fullEnergy![i] = Math.min(this.fullEnergy![i], energyConfig.max);
    }

    // Reproduction (normal asexual reproduction, not inter-tribe hybrids)
    const reproChance = this.fullGenes![base + 3];
    if (this.fullEnergy![i] > energyConfig.repro && this.rand() < reproChance * dt) {
      // Find free slot within worker's range
      const workerStart = this.startIdx;
      const workerEnd = this.endIdx;
      for (let j = workerStart; j < workerEnd; j++) {
        if (!this.fullAlive![j]) {
          // Spawn child near parent
          const px = this.fullPos![i * 2];
          const py = this.fullPos![i * 2 + 1];
          const spawnOffset = 10 + this.rand() * 15;
          const spawnAngle = this.rand() * Math.PI * 2;
          let childX = px + Math.cos(spawnAngle) * spawnOffset;
          let childY = py + Math.sin(spawnAngle) * spawnOffset;
          
          // Wrap coordinates
          childX = ((childX % this.worldWidth) + this.worldWidth) % this.worldWidth;
          childY = ((childY % this.worldHeight) + this.worldHeight) % this.worldHeight;
          
          // Initialize child
          this.fullPos![j * 2] = childX;
          this.fullPos![j * 2 + 1] = childY;
          
          const ang = this.rand() * Math.PI * 2;
          const childBase = j * GENE_COUNT;
          
          // Copy and mutate genes
          for (let g = 0; g < GENE_COUNT; g++) {
            const mutation = 0.95 + this.rand() * 0.1; // ±5% mutation
            this.fullGenes![childBase + g] = this.fullGenes![base + g] * mutation;
          }
          
          // Calculate child speed based on metabolism
          const childMetabolism = this.fullGenes![childBase + 2];
          const childRawSpeed = this.fullGenes![childBase];
          const childMetabEfficiency = Math.min(1, Math.sqrt(childMetabolism / 0.15));
          const childSpeed = childRawSpeed * childMetabEfficiency;
          
          this.fullVel![j * 2] = Math.cos(ang) * childSpeed * 0.5;
          this.fullVel![j * 2 + 1] = Math.sin(ang) * childSpeed * 0.5;
          
          this.fullAlive![j] = 1;
          this.fullEnergy![j] = energyConfig.start * 0.7;
          this.fullTribeId![j] = this.fullTribeId![i];
          
          if (this.fullAge) {
            this.fullAge[j] = 0;
          }
          
          if (this.fullOrientation) {
            this.fullOrientation[j] = ang;
          }
          
          // Set child color based on tribe (shader will handle birth flare)
          if (this.fullColor) {
            const tribeHue = this.tribeColors[this.fullTribeId![i]] || 0;
            // Convert HSL to RGB for the tribe's base color
            const h = tribeHue / 360;
            const s = 0.8;
            const l = 0.5;
            
            const c = (1 - Math.abs(2 * l - 1)) * s;
            const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
            const m = l - c / 2;
            
            let r = 0, g = 0, b = 0;
            const hPrime = h * 6;
            if (hPrime < 1) {
              r = c; g = x; b = 0;
            } else if (hPrime < 2) {
              r = x; g = c; b = 0;
            } else if (hPrime < 3) {
              r = 0; g = c; b = x;
            } else if (hPrime < 4) {
              r = 0; g = x; b = c;
            } else if (hPrime < 5) {
              r = x; g = 0; b = c;
            } else {
              r = c; g = 0; b = x;
            }
            
            this.fullColor[j * 3] = Math.floor((r + m) * 255);
            this.fullColor[j * 3 + 1] = Math.floor((g + m) * 255);
            this.fullColor[j * 3 + 2] = Math.floor((b + m) * 255);
          }
          
          // Parent pays energy cost
          this.fullEnergy![i] -= 25;
          
          // Track birth
          this.birthsByTribe[this.fullTribeId![i]]++;
          
          // Update entity count if needed
          if (j >= this.count) {
            this.count = j + 1;
          }
          
          break;
        }
      }
    }
  }

  private updateEntitySingleWorker(i: number, dt: number) {
    // Age and metabolism
    this.entities.age[i] += dt;
    const base = i * GENE_COUNT;
    const metabolism = this.entities.genes[base + 2];
    this.entities.energy[i] -= energyConfig.metabolismBase * metabolism * dt;

    // Death checks
    if (this.entities.energy[i] <= 0 || this.entities.age[i] > energyConfig.deathAge) {
      this.entities.kill(i);
      this.deathsByTribe[this.entities.tribeId[i]]++;
      if (this.entities.energy[i] <= 0) {
        this.starvedByTribe[this.entities.tribeId[i]]++;
      }
      // Clear color to prevent ghost colors on respawn
      this.entities.color[i * 3] = 0;
      this.entities.color[i * 3 + 1] = 0;
      this.entities.color[i * 3 + 2] = 0;
      return;  // Exit early for dead entities
    }
      
      // Movement and interactions - always run
      efficientMovementOptimized(
        i, 
        this.entities.pos,
        this.entities.vel,
        this.entities.alive,
        this.entities.energy,
        this.entities.tribeId,
        this.entities.genes,
        this.grid,
        this.food.getGrid(),
        this.food.getCols(),
        this.food.getRows(),
        { width: this.worldWidth, height: this.worldHeight },
        this.rand,
        dt,
        this.killsByTribe,
        this.deathsByTribe,
        this.entities.color,
        this.birthsByTribe,
        this.allowHybrids,
        this.entities.orientation,
        this.entities.age,
        // Pass full arrays for multi-worker mode, undefined for single-worker
        this.fullPos || undefined,
        this.fullAlive || undefined,
        this.fullTribeId || undefined,
        this.fullGenes || undefined,
        this.fullEnergy || undefined,
        this.fullVel || undefined
      );
      
      // Apply velocity to position (physics integration)
      const vx = this.entities.vel[i * 2];
      const vy = this.entities.vel[i * 2 + 1];
      
      // Update position with velocity
      this.entities.pos[i * 2] += vx * dt;
      this.entities.pos[i * 2 + 1] += vy * dt;
      
      // Wrap around world boundaries
      if (this.entities.pos[i * 2] < 0) this.entities.pos[i * 2] += this.worldWidth;
      if (this.entities.pos[i * 2] >= this.worldWidth) this.entities.pos[i * 2] -= this.worldWidth;
      if (this.entities.pos[i * 2 + 1] < 0) this.entities.pos[i * 2 + 1] += this.worldHeight;
      if (this.entities.pos[i * 2 + 1] >= this.worldHeight) this.entities.pos[i * 2 + 1] -= this.worldHeight;
      
      // Food consumption
      const consumed = this.food.consumeAt(
        this.entities.pos[i * 2],
        this.entities.pos[i * 2 + 1]
      );
      
      if (consumed > 0) {
        const diet = this.entities.genes[base + 7];
        const plantFoodEfficiency = diet < 0 ? 1.0 : Math.max(0.3, 1.0 - Math.abs(diet));
        this.entities.energy[i] += Math.min(30, consumed * 8 * plantFoodEfficiency);
        this.entities.energy[i] = Math.min(this.entities.energy[i], energyConfig.max);
      }
      
      // Reproduction
      const reproChance = this.entities.genes[base + 3];
      if (this.entities.energy[i] > energyConfig.repro && this.rand() < reproChance * dt) {
        // Find free slot
        for (let j = 0; j < this.entities.cap; j++) {
          if (!this.entities.alive[j]) {
            if (this.entities.reproduce(i, j, this.rand, this.tribeColors, this.worldWidth, this.worldHeight)) {
              this.birthsByTribe[this.entities.tribeId[i]]++;
              if (j >= this.count) this.count = j + 1;
              break;
            }
          }
        }
      }
  }

  getStats(): SimStats {
    const byTribe: Record<string, any> = {};
    let population = 0;
    
    for (let i = 0; i < this.count; i++) {
      if (!this.entities.alive[i]) continue;
      population++;
      
      const tribeName = this.tribeNames[this.entities.tribeId[i]] || `Tribe ${this.entities.tribeId[i]}`;
      const tribeId = this.entities.tribeId[i];
      
      if (!byTribe[tribeName]) {
        byTribe[tribeName] = {
          population: 0,
          count: 0,  // UI expects count field
          births: this.birthsByTribe[tribeId],
          deaths: this.deathsByTribe[tribeId],
          starved: this.starvedByTribe[tribeId],
          kills: this.killsByTribe[tribeId],
          averageAge: 0,
          averageEnergy: 0,
          color: `hsl(${this.tribeColors[tribeId]}, 80%, 50%)`,
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
          },
          distribution: {
            speed: { min: Infinity, max: -Infinity, std: 0, values: [] },
            vision: { min: Infinity, max: -Infinity, std: 0, values: [] },
            metabolism: { min: Infinity, max: -Infinity, std: 0, values: [] },
            aggression: { min: Infinity, max: -Infinity, std: 0, values: [] },
            cohesion: { min: Infinity, max: -Infinity, std: 0, values: [] },
            reproChance: { min: Infinity, max: -Infinity, std: 0, values: [] },
            foodStandards: { min: Infinity, max: -Infinity, std: 0, values: [] },
            diet: { min: Infinity, max: -Infinity, std: 0, values: [] },
            viewAngle: { min: Infinity, max: -Infinity, std: 0, values: [] },
          }
        };
      }
      
      byTribe[tribeName].population++;
      byTribe[tribeName].count++;  // Update count too
      byTribe[tribeName].averageAge += this.entities.age[i];
      byTribe[tribeName].averageEnergy += this.entities.energy[i];
      
      // Accumulate gene values for mean calculation and collect for distribution
      const base = i * GENE_COUNT;
      const genes = [
        this.entities.genes[base],
        this.entities.genes[base + 1],
        this.entities.genes[base + 2],
        this.entities.genes[base + 3],
        this.entities.genes[base + 4],
        this.entities.genes[base + 5],
        this.entities.genes[base + 6],
        this.entities.genes[base + 7],
        this.entities.genes[base + 8]
      ];
      
      byTribe[tribeName].mean.speed += genes[0];
      byTribe[tribeName].mean.vision += genes[1];
      byTribe[tribeName].mean.metabolism += genes[2];
      byTribe[tribeName].mean.reproChance += genes[3];
      byTribe[tribeName].mean.aggression += genes[4];
      byTribe[tribeName].mean.cohesion += genes[5];
      byTribe[tribeName].mean.foodStandards += genes[6];
      byTribe[tribeName].mean.diet += genes[7];
      byTribe[tribeName].mean.viewAngle += genes[8];
      
      // Collect values for distribution
      byTribe[tribeName].distribution.speed.values.push(genes[0]);
      byTribe[tribeName].distribution.vision.values.push(genes[1]);
      byTribe[tribeName].distribution.metabolism.values.push(genes[2]);
      byTribe[tribeName].distribution.reproChance.values.push(genes[3]);
      byTribe[tribeName].distribution.aggression.values.push(genes[4]);
      byTribe[tribeName].distribution.cohesion.values.push(genes[5]);
      byTribe[tribeName].distribution.foodStandards.values.push(genes[6]);
      byTribe[tribeName].distribution.diet.values.push(genes[7]);
      byTribe[tribeName].distribution.viewAngle.values.push(genes[8]);
    }
    
    // Calculate averages and distributions for each tribe
    Object.values(byTribe).forEach((tribe: any) => {
      if (tribe.population > 0) {
        tribe.averageAge /= tribe.population;
        tribe.averageEnergy /= tribe.population;
        
        // Calculate mean gene values and distributions
        Object.keys(tribe.mean).forEach(key => {
          tribe.mean[key] /= tribe.population;
          
          // Calculate distribution stats for this trait
          const dist = tribe.distribution[key];
          if (dist.values.length > 0) {
            dist.min = Math.min(...dist.values);
            dist.max = Math.max(...dist.values);
            
            // Calculate standard deviation
            const mean = tribe.mean[key];
            const variance = dist.values.reduce((acc: number, val: number) => 
              acc + Math.pow(val - mean, 2), 0) / dist.values.length;
            dist.std = Math.sqrt(variance);
            
            // Remove values array to save memory
            delete dist.values;
          } else {
            dist.min = 0;
            dist.max = 0;
            dist.std = 0;
          }
        });
      }
    });
    
    // Calculate global means and distributions
    const globalMean = {
      speed: 0, vision: 0, metabolism: 0, aggression: 0,
      cohesion: 0, reproChance: 0, foodStandards: 0,
      diet: 0, viewAngle: 0
    };
    
    const globalDistribution: Record<string, {min: number, max: number, std: number, values: number[]}> = {
      speed: { min: Infinity, max: -Infinity, std: 0, values: [] },
      vision: { min: Infinity, max: -Infinity, std: 0, values: [] },
      metabolism: { min: Infinity, max: -Infinity, std: 0, values: [] },
      aggression: { min: Infinity, max: -Infinity, std: 0, values: [] },
      cohesion: { min: Infinity, max: -Infinity, std: 0, values: [] },
      reproChance: { min: Infinity, max: -Infinity, std: 0, values: [] },
      foodStandards: { min: Infinity, max: -Infinity, std: 0, values: [] },
      diet: { min: Infinity, max: -Infinity, std: 0, values: [] },
      viewAngle: { min: Infinity, max: -Infinity, std: 0, values: [] },
    };
    
    // Collect values for distribution calculation
    if (population > 0) {
      // First pass: collect all values
      for (let i = 0; i < this.count; i++) {
        if (!this.entities.alive[i]) continue;
        
        const base = i * GENE_COUNT;
        globalDistribution.speed.values.push(this.entities.genes[base]);
        globalDistribution.vision.values.push(this.entities.genes[base + 1]);
        globalDistribution.metabolism.values.push(this.entities.genes[base + 2]);
        globalDistribution.reproChance.values.push(this.entities.genes[base + 3]);
        globalDistribution.aggression.values.push(this.entities.genes[base + 4]);
        globalDistribution.cohesion.values.push(this.entities.genes[base + 5]);
        globalDistribution.foodStandards.values.push(this.entities.genes[base + 6]);
        globalDistribution.diet.values.push(this.entities.genes[base + 7]);
        globalDistribution.viewAngle.values.push(this.entities.genes[base + 8]);
      }
      
      // Calculate means and distributions
      Object.keys(globalMean).forEach(key => {
        const dist = globalDistribution[key];
        if (dist.values.length > 0) {
          // Calculate mean
          const sum = dist.values.reduce((a, b) => a + b, 0);
          const mean = sum / dist.values.length;
          globalMean[key as keyof typeof globalMean] = mean;
          
          // Find min/max
          dist.min = Math.min(...dist.values);
          dist.max = Math.max(...dist.values);
          
          // Calculate standard deviation
          const variance = dist.values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / dist.values.length;
          dist.std = Math.sqrt(variance);
        } else {
          dist.min = 0;
          dist.max = 0;
          dist.std = 0;
        }
      });
    }
    
    // Get food statistics if food system exists
    const foodStats = this.foodSystem ? this.foodSystem.getFoodStats() : undefined;
    
    // Clean up distribution for return (remove values array)
    const cleanDistribution: Record<string, {min: number, max: number, std: number}> = {};
    Object.keys(globalDistribution).forEach(key => {
      cleanDistribution[key] = {
        min: globalDistribution[key].min === Infinity ? 0 : globalDistribution[key].min,
        max: globalDistribution[key].max === -Infinity ? 0 : globalDistribution[key].max,
        std: globalDistribution[key].std
      };
    });
    
    return {
      population,
      time: this.time,
      byTribe,
      food: foodStats,
      global: {
        mean: globalMean,
        distribution: cleanDistribution as any
      }
    };
  }
}