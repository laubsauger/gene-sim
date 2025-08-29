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
      console.log(`[Worker Region ${this.workerRegion!.x},${this.workerRegion!.y}] Processing ${inRegion} entities (${outRegion} outside)`);
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

    // Death checks
    const maxAge = this.fullAge ? this.fullAge[i] > energyConfig.deathAge : false;
    if (this.fullEnergy![i] <= 0 || maxAge) {
      this.fullAlive![i] = 0;
      this.deathsByTribe[this.fullTribeId![i]]++;
      if (this.fullEnergy![i] <= 0) {
        this.starvedByTribe[this.fullTribeId![i]]++;
      }
      return;
    }

    // Movement - use full arrays
    if (this.fullPos && this.fullVel) {
      efficientMovementOptimized(
        i,
        this.fullPos,
        this.fullVel,
        this.fullAlive,
        this.fullEnergy,
        this.fullTribeId,
        this.fullGenes,
        this.grid,
        this.food.getGrid(),
        this.food.getCols(),
        this.food.getRows(),
        { width: this.worldWidth, height: this.worldHeight },
        this.rand,
        dt,
        this.killsByTribe,
        this.deathsByTribe,
        this.fullColor,
        this.birthsByTribe,
        this.allowHybrids,
        this.fullOrientation,
        this.fullAge,
        this.fullPos,
        this.fullAlive,
        this.fullTribeId,
        this.fullGenes,
        this.fullEnergy,
        this.fullVel
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
      return;  // Exit early for dead entities
    }
      
      // Movement and interactions
      if (this.fullPos && this.fullAlive) {
        // Multi-worker mode: use full arrays for neighbor queries but local arrays for updates
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
          // Pass full arrays for neighbor queries
          this.fullPos,
          this.fullAlive,
          this.fullTribeId,
          this.fullGenes,
          this.fullEnergy
        );
      } else {
        // Single worker mode: use local arrays only
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
          this.entities.age
        );
      }
      
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
            if (this.entities.reproduce(i, j, this.rand, this.tribeColors)) {
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
          }
        };
      }
      
      byTribe[tribeName].population++;
      byTribe[tribeName].count++;  // Update count too
      byTribe[tribeName].averageAge += this.entities.age[i];
      byTribe[tribeName].averageEnergy += this.entities.energy[i];
      
      // Accumulate gene values for mean calculation
      const base = i * GENE_COUNT;
      byTribe[tribeName].mean.speed += this.entities.genes[base];
      byTribe[tribeName].mean.vision += this.entities.genes[base + 1];
      byTribe[tribeName].mean.metabolism += this.entities.genes[base + 2];
      byTribe[tribeName].mean.reproChance += this.entities.genes[base + 3];
      byTribe[tribeName].mean.aggression += this.entities.genes[base + 4];
      byTribe[tribeName].mean.cohesion += this.entities.genes[base + 5];
      byTribe[tribeName].mean.foodStandards += this.entities.genes[base + 6];
      byTribe[tribeName].mean.diet += this.entities.genes[base + 7];
      byTribe[tribeName].mean.viewAngle += this.entities.genes[base + 8];
    }
    
    // Calculate averages
    Object.values(byTribe).forEach((tribe: any) => {
      if (tribe.population > 0) {
        tribe.averageAge /= tribe.population;
        tribe.averageEnergy /= tribe.population;
        
        // Calculate mean gene values
        Object.keys(tribe.mean).forEach(key => {
          tribe.mean[key] /= tribe.population;
        });
      }
    });
    
    // Calculate global means
    const globalMean = {
      speed: 0, vision: 0, metabolism: 0, aggression: 0,
      cohesion: 0, reproChance: 0, foodStandards: 0,
      diet: 0, viewAngle: 0
    };
    
    if (population > 0) {
      Object.values(byTribe).forEach((tribe: any) => {
        if (tribe.population > 0) {
          Object.keys(globalMean).forEach(key => {
            globalMean[key as keyof typeof globalMean] += tribe.mean[key] * tribe.population;
          });
        }
      });
      
      Object.keys(globalMean).forEach(key => {
        globalMean[key as keyof typeof globalMean] /= population;
      });
    }
    
    return {
      population,
      time: this.time,
      t: this.time,  // UI expects 't' field
      byTribe,
      global: {
        mean: globalMean,
        distribution: {
          speed: { min: 0, max: 0, std: 0 },
          vision: { min: 0, max: 0, std: 0 },
          metabolism: { min: 0, max: 0, std: 0 },
          aggression: { min: 0, max: 0, std: 0 },
          cohesion: { min: 0, max: 0, std: 0 },
          reproChance: { min: 0, max: 0, std: 0 },
          foodStandards: { min: 0, max: 0, std: 0 },
          diet: { min: 0, max: 0, std: 0 },
          viewAngle: { min: 0, max: 0, std: 0 },
        }
      }
    };
  }
}