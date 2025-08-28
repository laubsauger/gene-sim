import type { GeneSpec } from './types';

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(100, Math.max(2, g.speed)),
  vision: Math.min(50, Math.max(2, g.vision)),
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
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
  };
  return clampGene(mutated);
};

export const defaultGenes: GeneSpec = {
  speed: 20,
  vision: 12,
  metabolism: 0.2,
  reproChance: 0.005,
  colorHue: 180,
};