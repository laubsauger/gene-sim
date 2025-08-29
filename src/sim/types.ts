export type Seed = number;

export type GeneSpec = {
  speed: number;        // movement units/s
  vision: number;       // sense radius
  metabolism: number;   // energy drain/s
  reproChance: number;  // probability per second when energy > threshold
  colorHue: number;     // phenotype base hue
  aggression: number;   // 0-1, likelihood to attack others
  cohesion: number;     // 0-1, tendency to stay with tribe
  foodStandards?: number; // 0-1, pickiness about food density (0=desperate, 1=very picky)
  diet?: number;        // -1 to 1, -1=pure herbivore, 0=omnivore, 1=pure carnivore
  viewAngle?: number;   // field of view in degrees (30-180)
};

export type SpawnPattern = 'blob' | 'scattered' | 'herd' | 'adaptive';

export type TribeInit = {
  name: string;
  count: number;
  spawn: { 
    x: number; 
    y: number; 
    radius: number;
    pattern?: SpawnPattern; // 'blob' (default), 'scattered', 'herd', 'adaptive' (based on diet)
  };
  genes?: Partial<GeneSpec>;
};

export type WorldInit = {
  width: number;
  height: number;
  foodGrid: { 
    cols: number; 
    rows: number; 
    regen: number; 
    capacity: number;
    distribution?: {
      scale: number;      // Noise scale (5-50, lower = larger features)
      threshold: number;  // Food threshold (0-1, higher = less food islands)
      frequency?: number; // Noise frequency/octaves (1-5, higher = more detail)
    };
  };
};

export type SimInit = {
  seed: Seed;
  tribes: TribeInit[];
  world: WorldInit;
  cap: number; // max entities
  energy?: {
    start: number;    // Starting energy for new entities
    max: number;      // Maximum energy capacity
    repro: number;    // Energy required for reproduction
  };
  hybridization?: boolean; // Allow inter-tribe mating
  // WASM and multi-worker options
  useWasm?: boolean;
  workerCount?: number;
};

export type TribeStats = {
  count: number;
  births: number;
  deaths: number;
  kills: number;    // deaths caused by combat
  starved: number;  // deaths caused by starvation
  color: string;
  mean: {
    speed: number;
    vision: number;
    metabolism: number;
    aggression: number;
    cohesion: number;
    reproChance: number;
    foodStandards: number;
    diet: number;
    viewAngle: number;
  };
  distribution: {
    speed: { min: number; max: number; std: number };
    vision: { min: number; max: number; std: number };
    metabolism: { min: number; max: number; std: number };
    aggression: { min: number; max: number; std: number };
    cohesion: { min: number; max: number; std: number };
    reproChance: { min: number; max: number; std: number };
    foodStandards: { min: number; max: number; std: number };
    diet: { min: number; max: number; std: number };
    viewAngle: { min: number; max: number; std: number };
  };
};

export type SimStats = {
  t: number; // sim time in seconds
  population: number;
  byTribe: Record<string, TribeStats>;
  global: {
    mean: {
      speed: number;
      vision: number;
      metabolism: number;
      aggression: number;
      cohesion: number;
      reproChance: number;
      foodStandards: number;
      diet: number;
      viewAngle: number;
    };
    distribution: {
      speed: { min: number; max: number; std: number };
      vision: { min: number; max: number; std: number };
      metabolism: { min: number; max: number; std: number };
      aggression: { min: number; max: number; std: number };
      cohesion: { min: number; max: number; std: number };
      reproChance: { min: number; max: number; std: number };
      foodStandards: { min: number; max: number; std: number };
      diet: { min: number; max: number; std: number };
      viewAngle: { min: number; max: number; std: number };
    };
  };
};

export type WorkerMsg =
  | { type: 'init'; payload: SimInit }
  | { type: 'setSpeed'; payload: { speedMul: number } }
  | { type: 'pause'; payload: { paused: boolean } }
  | { type: 'requestSnapshot' }
  | { type: 'setViewport'; payload: { x: number; y: number; w: number; h: number; zoom: number } }
  | { type: 'renderFps'; payload: { fps: number } };

export type PerfStats = {
  fps: number;      // render frame rate
  simSpeed: number; // simulation Hz
  speedMul: number; // current speed multiplier
};

export interface PerfBreakdown {
  spatialHash: string;
  foodRegrow: string;
  entityUpdate: string;
  foodConsume: string;
  movement: string;
  physics: string;
  total: string;
  entities: number;
}

export type MainMsg =
  | { type: 'ready'; payload: { 
      sab: { 
        pos: SharedArrayBuffer; 
        color: SharedArrayBuffer; 
        alive: SharedArrayBuffer;
        food?: SharedArrayBuffer;  // Food SharedArrayBuffer
      };
      meta: { count: number };
      foodMeta?: { cols: number; rows: number };
    }}
  | { type: 'stats'; payload: SimStats }
  | { type: 'perf'; payload: PerfStats }
  | { type: 'perfBreakdown'; payload: PerfBreakdown }
  | { type: 'foodUpdate'; payload: { foodGrid: ArrayBuffer } }
  | { type: 'extinction'; payload: { finalTime: number; finalStats: SimStats } };