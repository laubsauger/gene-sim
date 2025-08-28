export type Seed = number;

export type GeneSpec = {
  speed: number;        // movement units/s
  vision: number;       // sense radius
  metabolism: number;   // energy drain/s
  reproChance: number;  // probability per second when energy > threshold
  colorHue: number;     // phenotype base hue
  aggression: number;   // 0-1, likelihood to attack others
  cohesion: number;     // 0-1, tendency to stay with tribe
};

export type TribeInit = {
  name: string;
  count: number;
  spawn: { x: number; y: number; radius: number };
  genes?: Partial<GeneSpec>;
};

export type WorldInit = {
  width: number;
  height: number;
  foodGrid: { cols: number; rows: number; regen: number; capacity: number };
};

export type SimInit = {
  seed: Seed;
  tribes: TribeInit[];
  world: WorldInit;
  cap: number; // max entities
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
  };
  distribution: {
    speed: { min: number; max: number; std: number };
    vision: { min: number; max: number; std: number };
    metabolism: { min: number; max: number; std: number };
    aggression: { min: number; max: number; std: number };
    cohesion: { min: number; max: number; std: number };
    reproChance: { min: number; max: number; std: number };
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
    };
    distribution: {
      speed: { min: number; max: number; std: number };
      vision: { min: number; max: number; std: number };
      metabolism: { min: number; max: number; std: number };
      aggression: { min: number; max: number; std: number };
      cohesion: { min: number; max: number; std: number };
      reproChance: { min: number; max: number; std: number };
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

export type MainMsg =
  | { type: 'ready'; payload: { 
      sab: { 
        pos: SharedArrayBuffer; 
        color: SharedArrayBuffer; 
        alive: SharedArrayBuffer 
      };
      meta: { count: number } 
    }}
  | { type: 'stats'; payload: SimStats }
  | { type: 'perf'; payload: PerfStats };