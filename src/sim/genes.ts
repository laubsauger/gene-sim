import type { GeneSpec } from './types';

export const clampGene = (g: GeneSpec): GeneSpec => ({
  speed: Math.min(40, Math.max(10, g.speed)),  // 10-40 units/s as per docs
  vision: Math.min(100, Math.max(5, g.vision)),  // Higher vision range
  metabolism: Math.min(2, Math.max(0.01, g.metabolism)),
  reproChance: Math.min(0.2, Math.max(0, g.reproChance)),
  colorHue: ((g.colorHue % 360) + 360) % 360,
  aggression: Math.min(1, Math.max(0, g.aggression || 0.3)),
  cohesion: Math.min(1, Math.max(0, g.cohesion || 0.5)),
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
  const speedRatio = newSpeed / 50; // Normalize to base speed
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
    cohesion: Math.min(1, Math.max(0, g.cohesion + (rand() * 2 - 1) * actualIntensity * 1.2)),
    foodStandards: Math.min(1, Math.max(0, (g.foodStandards || 0.3) + (rand() * 2 - 1) * actualIntensity * 1.5)),
    diet: newDiet,
    viewAngle: newViewAngle,
  };
  return clampGene(mutated);
};

export const defaultGenes: GeneSpec = {
  speed: 50,
  vision: 20,
  metabolism: 0.15,
  reproChance: 0.008,  
  colorHue: 180,
  aggression: 0.3,
  cohesion: 0.5,
  foodStandards: 0.3,
  diet: -0.5,
  viewAngle: 120, // 120 degree field of view by default
};