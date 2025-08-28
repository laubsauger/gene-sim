export type Seed = number;

export type GeneSpec = {
  speed: number;        // movement units/s
  vision: number;       // sense radius
  metabolism: number;   // energy drain/s
  reproChance: number;  // probability per second when energy > threshold
  colorHue: number;     // phenotype base hue
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

export type SimStats = {
  t: number; // sim time in seconds
  population: number;
  byTribe: Record<string, { count: number; births: number; deaths: number; color: string }>;
  mean: { speed: number; vision: number; metabolism: number };
};

export type WorkerMsg =
  | { type: 'init'; payload: SimInit }
  | { type: 'setSpeed'; payload: { speedMul: number } }
  | { type: 'pause'; payload: { paused: boolean } }
  | { type: 'requestSnapshot' }
  | { type: 'setViewport'; payload: { x: number; y: number; w: number; h: number; zoom: number } };

export type MainMsg =
  | { type: 'ready'; payload: { 
      sab: { 
        pos: SharedArrayBuffer; 
        color: SharedArrayBuffer; 
        alive: SharedArrayBuffer 
      };
      meta: { count: number } 
    }}
  | { type: 'stats'; payload: SimStats };