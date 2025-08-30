// World and simulation constants
export const WORLD_WIDTH = 4096;
export const WORLD_HEIGHT = 4096;
export const GENE_COUNT = 9; // Must match WASM
export const FIXED_TIMESTEP = 1/60; // 60Hz physics

// Energy configuration
export const energyConfig = {
  start: 50,
  max: 100,
  repro: 60,
  metabolismBase: 0.1,
  metabolismMoving: 0.3,
  combatCost: 5,
  deathAge: 80
};

// Performance constants
export const FOOD_UPDATE_INTERVAL = 100; // ms
export const STATS_UPDATE_INTERVAL = 100; // ms - Reduced from 500ms for more responsive death visualization
export const PERF_UPDATE_INTERVAL = 250; // ms