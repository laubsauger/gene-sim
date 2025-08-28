import type { GeneSpec } from './types';

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(200, Math.max(10, g.speed)),  // Higher speed range
  vision: Math.min(100, Math.max(5, g.vision)),  // Higher vision range
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
  aggression: Math.min(1, Math.max(0, g.aggression || 0.3)),
  cohesion: Math.min(1, Math.max(0, g.cohesion || 0.5)),
  foodStandards: Math.min(1, Math.max(0, g.foodStandards || 0.3)), // Default 0.3 = moderately picky
  diet: Math.min(1, Math.max(-1, g.diet || -0.5)), // Default -0.5 = mostly herbivore
});

export const mutate = (
  g: GeneSpec, 
  rand: () => number, 
  intensity = 0.12  // Increased from 0.05 to 0.12 for more diversity
): GeneSpec => {
  // Occasionally have larger mutations for breakthrough evolution
  const mutationBoost = rand() < 0.05 ? 2.5 : 1;  // 5% chance of major mutation
  const actualIntensity = intensity * mutationBoost;
  
  const mutated = {
    speed: g.speed * (1 + (rand() * 2 - 1) * actualIntensity),
    vision: g.vision * (1 + (rand() * 2 - 1) * actualIntensity),
    metabolism: g.metabolism * (1 + (rand() * 2 - 1) * actualIntensity * 0.8), // Slightly less variation
    reproChance: Math.max(0, g.reproChance + (rand() * 2 - 1) * actualIntensity * 0.015),
    colorHue: g.colorHue + (rand() * 2 - 1) * actualIntensity * 40,
    aggression: Math.min(1, Math.max(0, g.aggression + (rand() * 2 - 1) * actualIntensity * 1.2)),
    cohesion: Math.min(1, Math.max(0, g.cohesion + (rand() * 2 - 1) * actualIntensity * 1.2)),
    foodStandards: Math.min(1, Math.max(0, (g.foodStandards || 0.3) + (rand() * 2 - 1) * actualIntensity * 1.5)),
    diet: Math.min(1, Math.max(-1, (g.diet || -0.5) + (rand() * 2 - 1) * actualIntensity * 2)), // Can shift diet significantly
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
  foodStandards: 0.3, // Moderate pickiness about food
  diet: -0.5, // Mostly herbivore by default
};