import { mutate, type GeneSpec } from '../genes';
import type { Rng } from '../random';
import { energyConfig, GENE_COUNT } from './constants';

export class EntitySystem {
  // Entity data arrays
  pos: Float32Array;
  vel: Float32Array;
  color: Uint8Array;
  alive: Uint8Array;
  energy: Float32Array;
  age: Float32Array;
  tribeId: Uint16Array;
  genes: Float32Array;
  orientation: Float32Array;
  
  // Metadata
  count: number = 0;
  cap: number;
  
  constructor(cap: number, buffers?: {
    pos: Float32Array;
    vel: Float32Array;
    color: Uint8Array;
    alive: Uint8Array;
    energy: Float32Array;
    age: Float32Array;
    tribeId: Uint16Array;
    genes: Float32Array;
    orientation: Float32Array;
  }) {
    this.cap = cap;
    
    if (buffers) {
      // Use provided buffers (shared memory)
      this.pos = buffers.pos;
      this.vel = buffers.vel;
      this.color = buffers.color;
      this.alive = buffers.alive;
      this.energy = buffers.energy;
      this.age = buffers.age;
      this.tribeId = buffers.tribeId;
      this.genes = buffers.genes;
      this.orientation = buffers.orientation;
    } else {
      // Allocate new buffers
      this.pos = new Float32Array(cap * 2);
      this.vel = new Float32Array(cap * 2);
      this.color = new Uint8Array(cap * 3);
      this.alive = new Uint8Array(cap);
      this.energy = new Float32Array(cap);
      this.age = new Float32Array(cap);
      this.tribeId = new Uint16Array(cap);
      this.genes = new Float32Array(cap * GENE_COUNT);
      this.orientation = new Float32Array(cap);
    }
  }

  spawn(
    idx: number,
    x: number,
    y: number,
    geneSpec: GeneSpec,
    tribe: number,
    initialEnergy: number = energyConfig.start,
    initialAge: number = 0
  ) {
    this.pos[idx * 2] = x;
    this.pos[idx * 2 + 1] = y;
    this.vel[idx * 2] = 0;
    this.vel[idx * 2 + 1] = 0;
    this.alive[idx] = 1;
    this.energy[idx] = initialEnergy;
    this.age[idx] = initialAge;
    this.tribeId[idx] = tribe;
    this.orientation[idx] = Math.random() * Math.PI * 2;
    
    // Set genes
    const base = idx * GENE_COUNT;
    this.genes[base] = geneSpec.speed;
    this.genes[base + 1] = geneSpec.vision;
    this.genes[base + 2] = geneSpec.metabolism;
    this.genes[base + 3] = geneSpec.reproChance;
    this.genes[base + 4] = geneSpec.aggression;
    this.genes[base + 5] = geneSpec.cohesion;
    this.genes[base + 6] = geneSpec.foodStandards;
    this.genes[base + 7] = geneSpec.diet;
    this.genes[base + 8] = geneSpec.viewAngle;
    
    // Set initial color
    this.updateColor(idx, geneSpec.colorHue || 0);
  }

  updateColor(idx: number, hue: number, brightness: number = 1.0) {
    const h = hue;
    const s = 0.8;
    const l = 0.5 * brightness;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    
    let r = 0, g = 0, b = 0;
    if (h < 60) {
      r = c; g = x; b = 0;
    } else if (h < 120) {
      r = x; g = c; b = 0;
    } else if (h < 180) {
      r = 0; g = c; b = x;
    } else if (h < 240) {
      r = 0; g = x; b = c;
    } else if (h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }
    
    this.color[idx * 3] = Math.min(255, ((r + m) * 255 * brightness) | 0);
    this.color[idx * 3 + 1] = Math.min(255, ((g + m) * 255 * brightness) | 0);
    this.color[idx * 3 + 2] = Math.min(255, ((b + m) * 255 * brightness) | 0);
  }

  kill(idx: number) {
    this.alive[idx] = 0;
    this.age[idx] = 0;
  }

  reproduce(
    parentIdx: number,
    childIdx: number,
    rand: Rng,
    tribeColors: number[],
    worldWidth?: number,
    worldHeight?: number
  ): boolean {
    if (childIdx >= this.cap || this.alive[childIdx]) {
      return false;
    }
    
    // Clear any leftover data to prevent ghosts
    this.color[childIdx * 3] = 0;
    this.color[childIdx * 3 + 1] = 0;
    this.color[childIdx * 3 + 2] = 0;
    this.pos[childIdx * 2] = -10000;
    this.pos[childIdx * 2 + 1] = -10000;

    const base = parentIdx * GENE_COUNT;
    const parentGenes: GeneSpec = {
      speed: this.genes[base],
      vision: this.genes[base + 1],
      metabolism: this.genes[base + 2],
      reproChance: this.genes[base + 3],
      aggression: this.genes[base + 4],
      cohesion: this.genes[base + 5],
      foodStandards: this.genes[base + 6],
      diet: this.genes[base + 7],
      viewAngle: this.genes[base + 8],
      colorHue: tribeColors[this.tribeId[parentIdx]],
    };
    
    const mutatedGenes = mutate(parentGenes, rand);
    // Preserve tribe color - don't mutate it
    mutatedGenes.colorHue = tribeColors[this.tribeId[parentIdx]];
    
    // Spawn child near parent
    const px = this.pos[parentIdx * 2];
    const py = this.pos[parentIdx * 2 + 1];
    const spawnOffset = 10 + rand() * 15;
    const spawnAngle = rand() * Math.PI * 2;
    let childX = px + Math.cos(spawnAngle) * spawnOffset;
    let childY = py + Math.sin(spawnAngle) * spawnOffset;
    
    // Wrap coordinates to stay within world bounds
    if (worldWidth && worldHeight) {
      childX = ((childX % worldWidth) + worldWidth) % worldWidth;
      childY = ((childY % worldHeight) + worldHeight) % worldHeight;
    }
    
    this.spawn(
      childIdx,
      childX,
      childY,
      mutatedGenes,
      this.tribeId[parentIdx],
      energyConfig.start * 0.7,
      rand() * 10
    );
    
    // Parent pays energy cost
    this.energy[parentIdx] -= 25;
    
    if (childIdx >= this.count) {
      this.count = childIdx + 1;
    }
    
    return true;
  }
}