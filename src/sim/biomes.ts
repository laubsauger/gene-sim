import { createRng, type Rng } from './random';
import * as THREE from 'three';

export enum BiomeType {
  OCEAN = 'ocean',
  MOUNTAIN = 'mountain',
  FOREST = 'forest',
  GRASSLAND = 'grassland',
  DESERT = 'desert',
  SAVANNA = 'savanna'
}

export interface Biome {
  type: BiomeType;
  traversable: boolean;
  foodMultiplier: number;
  color: THREE.Color;
  elevation: number;
}

export const BIOME_CONFIGS: Record<BiomeType, Omit<Biome, 'type'>> = {
  [BiomeType.OCEAN]: {
    traversable: false,
    foodMultiplier: 0,  // No food in water
    color: new THREE.Color(0x0d2438), // Darker, deeper ocean blue
    elevation: -0.02
  },
  [BiomeType.MOUNTAIN]: {
    traversable: false,
    foodMultiplier: 0,  // No food on rocky peaks
    color: new THREE.Color(0x2a2a2a), // Much darker grey for mountains
    elevation: 0.05
  },
  [BiomeType.FOREST]: {
    traversable: true,
    foodMultiplier: 3.0,  // Very rich ecosystem, abundant food
    color: new THREE.Color(0x2d5a2d), // Classic forest green
    elevation: 0.01
  },
  [BiomeType.GRASSLAND]: {
    traversable: true,
    foodMultiplier: 1.5,  // Good grazing land
    color: new THREE.Color(0x7db85c), // Bright grass green like Link to the Past
    elevation: 0
  },
  [BiomeType.DESERT]: {
    traversable: true,
    foodMultiplier: 0.15,  // Very sparse vegetation, minimal food
    color: new THREE.Color(0xd4a76a), // Sandy beige like classic desert tiles
    elevation: 0
  },
  [BiomeType.SAVANNA]: {
    traversable: true,
    foodMultiplier: 0.8,  // Seasonal grassland, moderate food
    color: new THREE.Color(0x9b8653), // Dry yellow-brown grass
    elevation: 0
  }
};

// High contrast colors for overlay mode - Clear biome identification
export const BIOME_HIGHLIGHT_COLORS: Record<BiomeType, THREE.Color> = {
  [BiomeType.OCEAN]: new THREE.Color(0x0066cc), // Deep blue - impassable
  [BiomeType.MOUNTAIN]: new THREE.Color(0x333333), // Dark grey - impassable
  [BiomeType.FOREST]: new THREE.Color(0x00cc00), // Bright green - high food
  [BiomeType.GRASSLAND]: new THREE.Color(0x88ff88), // Light green - medium food
  [BiomeType.DESERT]: new THREE.Color(0xffaa00), // Orange - low food
  [BiomeType.SAVANNA]: new THREE.Color(0xcccc66), // Yellow-tan - moderate food
};

export class BiomeGenerator {
  private rng: Rng;
  private biomeGrid: BiomeType[][];
  private cellSize: number;
  private gridWidth: number;
  private gridHeight: number;

  constructor(
    seed: number,
    worldWidth: number,
    worldHeight: number,
    cellSize: number = 50
  ) {
    this.rng = createRng(seed);
    this.cellSize = cellSize;
    this.gridWidth = Math.ceil(worldWidth / cellSize);
    this.gridHeight = Math.ceil(worldHeight / cellSize);
    this.biomeGrid = this.generateBiomes();
  }

  private noise2D(x: number, y: number, scale: number = 0.05): number {
    const nx = x * scale;
    const ny = y * scale;
    
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < 4; i++) {
      value += this.pseudoNoise(nx * frequency, ny * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }

  private pseudoNoise(x: number, y: number): number {
    const intX = Math.floor(x);
    const intY = Math.floor(y);
    const fracX = x - intX;
    const fracY = y - intY;
    
    const a = this.hash(intX, intY);
    const b = this.hash(intX + 1, intY);
    const c = this.hash(intX, intY + 1);
    const d = this.hash(intX + 1, intY + 1);
    
    const u = fracX * fracX * (3 - 2 * fracX);
    const v = fracY * fracY * (3 - 2 * fracY);
    
    return this.lerp(
      this.lerp(a, b, u),
      this.lerp(c, d, u),
      v
    );
  }

  private hash(x: number, y: number): number {
    let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    h ^= h >>> 15;
    return (h >>> 0) / 0xffffffff;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private generateBiomes(): BiomeType[][] {
    const grid: BiomeType[][] = [];
    
    const centerX = this.gridWidth / 2;
    const centerY = this.gridHeight / 2;
    const continentRadius = Math.min(this.gridWidth, this.gridHeight) * 0.35;
    
    for (let y = 0; y < this.gridHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < this.gridWidth; x++) {
        const dx = (x - centerX) / continentRadius;
        const dy = (y - centerY) / continentRadius;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        const elevation = this.noise2D(x, y, 0.03);
        const moisture = this.noise2D(x + 1000, y + 1000, 0.04);
        const temperature = this.noise2D(x + 2000, y + 2000, 0.02);
        
        const continentShape = Math.max(0, 1 - distFromCenter * 0.8);
        const islandNoise = this.noise2D(x, y, 0.01) * 0.3;
        const landMass = continentShape + islandNoise + elevation * 0.2;
        
        let biome: BiomeType;
        
        if (landMass < 0.3) {
          biome = BiomeType.OCEAN;
        } else if (elevation > 0.7 && landMass > 0.5) {
          biome = BiomeType.MOUNTAIN;
        } else if (moisture > 0.6 && temperature > 0.4) {
          biome = BiomeType.FOREST;
        } else if (moisture < 0.3 && temperature > 0.6) {
          biome = BiomeType.DESERT;
        } else if (moisture > 0.4 && temperature > 0.5) {
          biome = BiomeType.SAVANNA;
        } else {
          biome = BiomeType.GRASSLAND;
        }
        
        grid[y][x] = biome;
      }
    }
    
    return grid;
  }

  getBiomeAt(worldX: number, worldY: number): BiomeType {
    const gridX = Math.floor(worldX / this.cellSize);
    const gridY = Math.floor(worldY / this.cellSize);
    
    if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
      return BiomeType.OCEAN;
    }
    
    return this.biomeGrid[gridY][gridX];
  }

  getBiomeConfig(worldX: number, worldY: number): Biome {
    const type = this.getBiomeAt(worldX, worldY);
    return {
      type,
      ...BIOME_CONFIGS[type]
    };
  }

  isTraversable(worldX: number, worldY: number): boolean {
    const biome = this.getBiomeConfig(worldX, worldY);
    return biome.traversable;
  }

  getFoodMultiplier(worldX: number, worldY: number): number {
    const biome = this.getBiomeConfig(worldX, worldY);
    return biome.foodMultiplier;
  }

  getBiomeGrid(): BiomeType[][] {
    return this.biomeGrid;
  }

  getCellSize(): number {
    return this.cellSize;
  }

  getGridDimensions(): { width: number; height: number } {
    return { width: this.gridWidth, height: this.gridHeight };
  }

  // Generate a compact traversability map for efficient collision detection
  getTraversabilityMap(): Uint8Array {
    const map = new Uint8Array(this.gridWidth * this.gridHeight);
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const idx = y * this.gridWidth + x;
        const biome = this.biomeGrid[y][x];
        // 1 = traversable, 0 = blocked
        map[idx] = BIOME_CONFIGS[biome].traversable ? 1 : 0;
      }
    }
    return map;
  }

  // Get the full biome grid as a Uint8Array for sharing
  getBiomeGridArray(): Uint8Array {
    const map = new Uint8Array(this.gridWidth * this.gridHeight);
    const biomeToInt: Record<BiomeType, number> = {
      [BiomeType.OCEAN]: 0,
      [BiomeType.MOUNTAIN]: 1,
      [BiomeType.FOREST]: 2,
      [BiomeType.GRASSLAND]: 3,
      [BiomeType.DESERT]: 4,
      [BiomeType.SAVANNA]: 5
    };
    
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const idx = y * this.gridWidth + x;
        const biome = this.biomeGrid[y][x];
        map[idx] = biomeToInt[biome];
      }
    }
    return map;
  }
}