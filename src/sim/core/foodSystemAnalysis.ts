// Analysis of food system math to identify precision issues
// Run with: yarn node src/sim/core/foodSystemAnalysis.ts

// Biome configurations (copied to avoid Three.js import)
const BIOME_CONFIGS = {
  OCEAN: { foodCapacity: 0, foodRegenRate: 0 },
  MOUNTAIN: { foodCapacity: 0, foodRegenRate: 0 },
  FOREST: { foodCapacity: 1.5, foodRegenRate: 1.2 },
  GRASSLAND: { foodCapacity: 1.0, foodRegenRate: 1.0 },
  DESERT: { foodCapacity: 0.3, foodRegenRate: 0.5 },
  SAVANNA: { foodCapacity: 0.7, foodRegenRate: 0.8 },
};

// Test configuration values
const TEST_CONFIG = {
  foodRegen: 0.89,  // Default regen rate
  foodCapacity: 7,  // Default base capacity
  scarcity: 0.25,   // Default scarcity threshold
  dt: 1/60,         // 60 FPS timestep
};

// Helper to calculate actual food values for a biome
function calculateFoodValues(biomeName: string, initialRoll: number) {
  const biomeConfig = BIOME_CONFIGS[biomeName as keyof typeof BIOME_CONFIGS];
  const baseCapacity = TEST_CONFIG.foodCapacity;
  
  // Calculate variance based on initial roll (0-1)
  const varianceMin = 0.2;
  const varianceMax = 1.0;
  const variance = varianceMin + initialRoll * (varianceMax - varianceMin);
  
  // Initial food amount
  const initialFood = baseCapacity * variance * biomeConfig.foodCapacity;
  
  // Max capacity (fixed based on biome, not initial roll)
  const maxCapacity = baseCapacity * varianceMax * biomeConfig.foodCapacity;
  
  // Regen rate with biome multiplier
  const regenRate = TEST_CONFIG.foodRegen * biomeConfig.foodRegenRate;
  
  return {
    initialFood,
    maxCapacity,
    regenRate,
    biomeMultiplier: biomeConfig.foodCapacity,
    regenMultiplier: biomeConfig.foodRegenRate,
  };
}

// Calculate time to regenerate from depleted to full
function timeToRegenerate(currentFood: number, maxCapacity: number, regenRate: number): number {
  if (regenRate <= 0) return Infinity;
  if (currentFood >= maxCapacity) return 0;
  
  const foodToRegen = maxCapacity - currentFood;
  const regenPerSecond = regenRate * maxCapacity;
  return foodToRegen / regenPerSecond;
}

// Simulate regeneration over time with floating point precision tracking
function simulateRegen(startFood: number, maxCapacity: number, regenRate: number, seconds: number) {
  let food = startFood;
  const dt = TEST_CONFIG.dt;
  const steps = Math.floor(seconds / dt);
  
  let minDelta = Infinity;
  let maxDelta = 0;
  let totalDelta = 0;
  let zeroDeltas = 0;
  
  for (let i = 0; i < steps; i++) {
    const oldFood = food;
    
    // Actual regen calculation from foodSystem.ts
    const regenAmount = regenRate * maxCapacity * dt;
    food = Math.min(food + regenAmount, maxCapacity);
    
    const delta = food - oldFood;
    
    // Track precision issues
    if (delta === 0 && food < maxCapacity) {
      zeroDeltas++;
    }
    if (delta > 0) {
      minDelta = Math.min(minDelta, delta);
      maxDelta = Math.max(maxDelta, delta);
      totalDelta += delta;
    }
  }
  
  return {
    finalFood: food,
    percentFull: (food / maxCapacity) * 100,
    minDelta: minDelta === Infinity ? 0 : minDelta,
    maxDelta,
    avgDelta: steps > 0 ? totalDelta / steps : 0,
    zeroDeltas,
    precisionIssue: zeroDeltas > 0,
  };
}

// Run tests for all biomes
console.log('=== FOOD SYSTEM MATH ANALYSIS ===\n');
console.log('Current configuration:');
console.log(`  Base regen rate: ${TEST_CONFIG.foodRegen}`);
console.log(`  Base capacity: ${TEST_CONFIG.foodCapacity}`);
console.log(`  Scarcity threshold: ${TEST_CONFIG.scarcity}`);
console.log(`  Timestep: ${TEST_CONFIG.dt.toFixed(6)}s (${1/TEST_CONFIG.dt} FPS)\n`);

// Test each biome type
for (const biomeName of Object.keys(BIOME_CONFIGS)) {
  const biomeConfig = BIOME_CONFIGS[biomeName as keyof typeof BIOME_CONFIGS];
  
  // Skip non-traversable biomes
  if (biomeConfig.foodCapacity === 0) {
    console.log(`${biomeName}: Non-traversable (no food)\n`);
    continue;
  }
  
  console.log(`=== ${biomeName} ===`);
  console.log(`Base multipliers: foodCap=${biomeConfig.foodCapacity}, regenRate=${biomeConfig.foodRegenRate}`);
  
  // Test with different initial rolls
  const rolls = [0.1, 0.5, 0.9];  // Low, medium, high initial food
  
  for (const roll of rolls) {
    const values = calculateFoodValues(biomeName, roll);
    
    console.log(`\nInitial roll: ${roll}`);
    console.log(`  Initial food: ${values.initialFood.toFixed(3)}`);
    console.log(`  Max capacity: ${values.maxCapacity.toFixed(3)}`);
    console.log(`  Effective regen rate: ${values.regenRate.toFixed(6)}`);
    
    // Time to regenerate from empty
    const timeFromEmpty = timeToRegenerate(0, values.maxCapacity, values.regenRate);
    console.log(`  Time from empty to full: ${timeFromEmpty.toFixed(2)}s`);
    
    // Time to regenerate from initial
    const timeFromInitial = timeToRegenerate(values.initialFood, values.maxCapacity, values.regenRate);
    console.log(`  Time from initial to full: ${timeFromInitial.toFixed(2)}s`);
    
    // Simulate 1 second of regeneration from empty
    const sim1s = simulateRegen(0, values.maxCapacity, values.regenRate, 1);
    console.log(`  After 1s from empty: ${sim1s.finalFood.toFixed(3)} (${sim1s.percentFull.toFixed(1)}%)`);
    
    // Check for precision issues
    if (sim1s.precisionIssue) {
      console.log(`  ⚠️ PRECISION ISSUE: ${sim1s.zeroDeltas} frames with zero delta`);
    }
    
    // Show actual regeneration per frame
    const regenPerFrame = values.regenRate * values.maxCapacity * TEST_CONFIG.dt;
    console.log(`  Regen per frame: ${regenPerFrame.toFixed(9)}`);
    
    // Check if regen per frame is too small (potential precision issue)
    if (regenPerFrame < 0.0001 && regenPerFrame > 0) {
      console.log(`  ⚠️ WARNING: Very small regen per frame, may cause precision issues`);
    }
  }
  
  console.log('');
}

// Test specific precision issue scenarios
console.log('=== PRECISION ISSUE TESTS ===\n');

// Test very small regen rates
const testRates = [0.0001, 0.001, 0.01, 0.1, 0.5, 0.89];
const testCapacity = 7.0;

for (const rate of testRates) {
  const regenPerFrame = rate * testCapacity * TEST_CONFIG.dt;
  const framesNeeded = testCapacity / regenPerFrame;
  
  console.log(`Regen rate ${rate}:`);
  console.log(`  Per frame: ${regenPerFrame.toFixed(9)}`);
  console.log(`  Frames to full: ${framesNeeded.toFixed(0)}`);
  console.log(`  Time to full: ${(framesNeeded * TEST_CONFIG.dt).toFixed(2)}s`);
  
  // Check if it's below JavaScript's epsilon
  if (regenPerFrame < Number.EPSILON) {
    console.log(`  ⚠️ CRITICAL: Below JS epsilon (${Number.EPSILON}), will be treated as 0`);
  } else if (regenPerFrame < 0.0001) {
    console.log(`  ⚠️ WARNING: Very small value, may have precision issues`);
  }
  
  console.log('');
}

// Recommendations
console.log('=== RECOMMENDATIONS ===\n');

console.log('1. Minimum viable regen rate to avoid precision issues:');
const minViableRate = (0.0001 / (testCapacity * TEST_CONFIG.dt));
console.log(`   Rate should be >= ${minViableRate.toFixed(4)} (currently ${TEST_CONFIG.foodRegen})`);

console.log('\n2. For desired regeneration times:');
const desiredTimes = [1, 3, 5, 10, 30];  // seconds
for (const time of desiredTimes) {
  const requiredRate = 1 / time;  // Rate to go from 0 to max in X seconds
  console.log(`   ${time}s to full: rate = ${requiredRate.toFixed(3)}`);
}

console.log('\n3. Biome-specific recommendations with current settings:');
for (const biomeName of Object.keys(BIOME_CONFIGS)) {
  const biomeConfig = BIOME_CONFIGS[biomeName as keyof typeof BIOME_CONFIGS];
  if (biomeConfig.foodCapacity === 0) continue;
  
  const maxCap = TEST_CONFIG.foodCapacity * biomeConfig.foodCapacity;
  const effectiveRate = TEST_CONFIG.foodRegen * biomeConfig.foodRegenRate;
  const timeToFull = 1 / effectiveRate;
  
  console.log(`   ${biomeName}:`);
  console.log(`     Max capacity: ${maxCap.toFixed(2)}`);
  console.log(`     Effective rate: ${effectiveRate.toFixed(3)}`);
  console.log(`     Time to full: ${timeToFull.toFixed(2)}s`);
}

console.log('\n4. SOLUTION: Scale up food values to avoid precision issues');
console.log('   Instead of food values 0-7, use 0-700 or 0-7000');
console.log('   This gives more precision for small increments');

// Test with scaled values
console.log('\n=== TESTING WITH SCALED VALUES (x100) ===\n');

const SCALED_CONFIG = {
  foodCapacity: 700,  // 100x larger
  foodRegen: 0.89,    // Same rate
  dt: 1/60,
};

for (const biomeName of ['FOREST', 'DESERT']) {
  const biomeConfig = BIOME_CONFIGS[biomeName as keyof typeof BIOME_CONFIGS];
  const maxCapacity = SCALED_CONFIG.foodCapacity * biomeConfig.foodCapacity;
  const regenRate = SCALED_CONFIG.foodRegen * biomeConfig.foodRegenRate;
  const regenPerFrame = regenRate * maxCapacity * SCALED_CONFIG.dt;
  
  console.log(`${biomeName} with scaled values:`);
  console.log(`  Max capacity: ${maxCapacity.toFixed(1)}`);
  console.log(`  Regen per frame: ${regenPerFrame.toFixed(6)}`);
  console.log(`  Time to full: ${(1/regenRate).toFixed(2)}s`);
  
  // Check precision
  if (regenPerFrame < 0.01) {
    console.log(`  ⚠️ Still has precision issues`);
  } else {
    console.log(`  ✅ Good precision`);
  }
  console.log('');
}