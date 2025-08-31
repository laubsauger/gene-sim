// Test to visualize S-curve regeneration behavior

// Sigmoid growth calculation
function calculateSigmoidGrowth(currentPercent: number, effectiveRegen: number, targetCapacity: number, dt: number = 1/60) {
  // Sigmoid parameters
  const k = 6; // Steepness
  const x0 = 0.4; // Midpoint at 40%
  
  // Calculate growth modifier using sigmoid derivative
  const sigmoid = 1 / (1 + Math.exp(-k * (currentPercent - x0)));
  const growthModifier = k * sigmoid * (1 - sigmoid);
  
  // Apply S-curve modifier to base growth rate
  const baseGrowthRate = targetCapacity * effectiveRegen;
  let growth = baseGrowthRate * growthModifier * dt;
  
  // Add baseline growth (5% of max rate)
  const baselineGrowth = baseGrowthRate * 0.05 * dt;
  growth += baselineGrowth;
  
  // Minimum growth threshold
  if (effectiveRegen > 0 && growth < 0.008) {
    growth = 0.008;
  }
  
  return growth;
}

// Simulate regeneration over time
function simulateRegeneration(startPercent: number, biome: string, biomeRegenRate: number, baseRegen: number = 0.89) {
  const targetCapacity = 100; // Using scaled capacity
  const effectiveRegen = baseRegen * biomeRegenRate;
  const dt = 1/60; // 60 FPS
  
  let current = startPercent * targetCapacity;
  let time = 0;
  const samples = [];
  
  // Track cooldown
  let cooldown = 0;
  if (startPercent < 0.05) {
    cooldown = 0.5 / effectiveRegen; // Initial cooldown when depleted
  }
  
  // Simulate until 95% capacity or 10 seconds
  while (current < targetCapacity * 0.95 && time < 10) {
    const percent = current / targetCapacity;
    
    // Handle cooldown phase
    if (current < targetCapacity * 0.05) {
      if (cooldown > 0) {
        cooldown -= dt;
        // Tiny growth during cooldown
        const tinyGrowth = targetCapacity * 0.001 * dt;
        current = Math.min(targetCapacity * 0.05, current + tinyGrowth);
      }
    } else if (cooldown <= 0) {
      // Normal S-curve growth
      const growth = calculateSigmoidGrowth(percent, effectiveRegen, targetCapacity, dt);
      current = Math.min(targetCapacity, current + growth);
    }
    
    // Sample every 10 frames (6 times per second)
    if (Math.floor(time * 60) % 10 === 0) {
      samples.push({
        time: time.toFixed(2),
        percent: (current / targetCapacity * 100).toFixed(1),
        value: current.toFixed(1)
      });
    }
    
    time += dt;
  }
  
  return {
    biome,
    startPercent: startPercent * 100,
    timeToFull: time.toFixed(2),
    samples: samples.slice(0, 20) // First 20 samples
  };
}

console.log('=== S-CURVE FOOD REGENERATION ANALYSIS ===\n');

// Test different biomes with their regen rates
const biomes = [
  { name: 'FOREST', regenRate: 1.2, capacity: 1.5 },
  { name: 'GRASSLAND', regenRate: 1.0, capacity: 1.0 },
  { name: 'SAVANNA', regenRate: 0.8, capacity: 0.7 },
  { name: 'DESERT', regenRate: 0.5, capacity: 0.3 }
];

// Test different starting conditions
const startConditions = [0, 0.1, 0.25, 0.5, 0.75];

console.log('Time to reach 95% capacity from different starting points:\n');

biomes.forEach(biome => {
  console.log(`${biome.name} (regen: ${biome.regenRate}x, capacity: ${biome.capacity}x):`);
  
  startConditions.forEach(start => {
    const result = simulateRegeneration(start, biome.name, biome.regenRate);
    console.log(`  From ${(start * 100).toFixed(0)}%: ${result.timeToFull}s`);
  });
  
  console.log('');
});

// Detailed growth curve for one example
console.log('=== DETAILED GROWTH CURVE (Grassland from 0%) ===\n');
const detailed = simulateRegeneration(0, 'GRASSLAND', 1.0);
console.log('Time(s) | Percent | Value');
console.log('--------|---------|-------');
detailed.samples.forEach(s => {
  const bar = '█'.repeat(Math.floor(parseFloat(s.percent) / 5));
  console.log(`${s.time.padStart(7)} | ${s.percent.padStart(6)}% | ${bar}`);
});

// Show growth rate at different capacity levels
console.log('\n=== GROWTH RATE AT DIFFERENT CAPACITY LEVELS ===\n');
console.log('Capacity % | Growth Rate (% of max)');
console.log('-----------|----------------------');

for (let percent = 0; percent <= 1; percent += 0.1) {
  const k = 6;
  const x0 = 0.4;
  const sigmoid = 1 / (1 + Math.exp(-k * (percent - x0)));
  const growthModifier = k * sigmoid * (1 - sigmoid);
  const baselineModifier = 0.05; // 5% baseline
  const totalModifier = growthModifier + baselineModifier;
  
  console.log(`${(percent * 100).toFixed(0).padStart(9)}% | ${(totalModifier * 100).toFixed(1)}%`);
}

console.log('\nKey characteristics:');
console.log('- Cooldown: 0.5s when depleted (below 5%)');
console.log('- Peak growth: Around 40% capacity');
console.log('- Baseline growth: 5% of max rate (prevents stagnation)');
console.log('- Minimum growth: 0.008 units per frame');