import type { GeneSpec } from './types';

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(200, Math.max(10, g.speed)),  // Higher speed range
  vision: Math.min(100, Math.max(5, g.vision)),  // Higher vision range
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
  aggression: Math.min(1, Math.max(0, g.aggression || 0.3)),
  cohesion: Math.min(1, Math.max(0, g.cohesion || 0.5)),
});

export const mutate = (
  g: GeneSpec, 
  rand: () => number, 
  intensity = 0.05
): GeneSpec => {
  const mutated = {
    speed: g.speed * (1 + (rand() * 2 - 1) * intensity),
    vision: g.vision * (1 + (rand() * 2 - 1) * intensity),
    metabolism: g.metabolism * (1 + (rand() * 2 - 1) * intensity),
    reproChance: Math.max(0, g.reproChance + (rand() * 2 - 1) * intensity * 0.01),
    colorHue: g.colorHue + (rand() * 2 - 1) * intensity * 30,
    aggression: g.aggression + (rand() * 2 - 1) * intensity,
    cohesion: g.cohesion + (rand() * 2 - 1) * intensity,
  };
  return clampGene(mutated);
};

export const defaultGenes: GeneSpec = {
  speed: 50,  // Increased base speed for more visible movement
  vision: 20,  // Increased vision range
  metabolism: 0.15,  // Slightly lower metabolism
  reproChance: 0.008,  // Slightly higher reproduction
  colorHue: 180,
  aggression: 0.3,
  cohesion: 0.5,
};