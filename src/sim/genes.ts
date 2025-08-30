import type { GeneSpec } from './types';

export type { GeneSpec };

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(25, Math.max(5, g.speed)),  // 5-25 units/s for reasonable movement
  vision: Math.min(100, Math.max(5, g.vision)),  // Higher vision range
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
  aggression: Math.min(1, Math.max(0, g.aggression || 0.3)),
  cohesion: Math.min(0.75, Math.max(0, g.cohesion || 0.5)), // Cap at 0.75 to prevent excessive flocking
  foodStandards: Math.min(1, Math.max(0, g.foodStandards || 0.3)), // Default 0.3 = moderately picky
  diet: Math.min(1, Math.max(-1, g.diet || -0.5)), // Default -0.5 = mostly herbivore
  viewAngle: Math.min(180, Math.max(30, g.viewAngle || 120)), // 30-180 degrees, default 120
});

export const mutate = (
  g: GeneSpec, 
  rand: () => number, 
  intensity = 0.12  // Increased from 0.05 to 0.12 for more diversity
): GeneSpec => {
  // Occasionally have larger mutations for breakthrough evolution
  const mutationBoost = rand() < 0.05 ? 2.5 : 1;  // 5% chance of major mutation
  const actualIntensity = intensity * mutationBoost;
  
  // Mutate speed first
  const newSpeed = g.speed * (1 + (rand() * 2 - 1) * actualIntensity);

  // Correlate metabolism with speed - higher speed requires higher metabolism
  // Base metabolism scales with speed^0.7 (sub-linear to allow some efficiency gains)
  const speedRatio = newSpeed / 15; // Normalize to base speed
  const baseMetabolism = 0.15 * Math.pow(speedRatio, 0.7);

  // Add some variation to metabolism but keep it correlated
  const metabolismVariation = (rand() * 2 - 1) * actualIntensity * 0.3;
  const newMetabolism = baseMetabolism * (1 + metabolismVariation);
  
  // Mutate diet
  const newDiet = Math.min(1, Math.max(-1, (g.diet || -0.5) + (rand() * 2 - 1) * actualIntensity * 2));
  
  // Correlate view angle with diet
  // Carnivores (diet > 0) tend toward narrow FOV (60-120°)
  // Herbivores (diet < 0) tend toward wide FOV (120-180°)
  // Calculate ideal view angle based on diet
  const dietNormalized = (newDiet + 1) / 2; // 0 = herbivore, 1 = carnivore
  const idealViewAngle = 180 - (dietNormalized * 90); // 180° for herbivore, 90° for carnivore
  
  // Add variation but keep it correlated with diet
  const viewAngleVariation = (rand() * 2 - 1) * actualIntensity * 20;
  const newViewAngle = idealViewAngle + viewAngleVariation;

  const mutated = {
    speed: newSpeed,
    vision: g.vision * (1 + (rand() * 2 - 1) * actualIntensity),
    metabolism: newMetabolism,
    reproChance: Math.max(0, g.reproChance + (rand() * 2 - 1) * actualIntensity * 0.015),
    colorHue: g.colorHue + (rand() * 2 - 1) * actualIntensity * 40,
    aggression: Math.min(1, Math.max(0, g.aggression + (rand() * 2 - 1) * actualIntensity * 1.2)),
    cohesion: Math.min(0.75, Math.max(0, g.cohesion + (rand() * 2 - 1) * actualIntensity * 1.2)), // Cap at 0.75
    foodStandards: Math.min(1, Math.max(0, (g.foodStandards || 0.3) + (rand() * 2 - 1) * actualIntensity * 1.5)),
    diet: newDiet,
    viewAngle: newViewAngle,
  };
  return clampGene(mutated);
};

export const defaultGenes: GeneSpec = {
  speed: 15,  // More reasonable default speed
  vision: 20,
  metabolism: 0.15,
  reproChance: 0.012,  // Slightly higher base reproduction for larger world
  colorHue: 180,
  aggression: 0.3,
  cohesion: 0.5,
  foodStandards: 0.3,
  diet: -0.5,  // Default to herbivore
  viewAngle: 120, // 120 degree field of view by default
};