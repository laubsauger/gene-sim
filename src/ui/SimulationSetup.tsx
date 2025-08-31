import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SimClient, SimMode } from '../client/setupSimClientHybrid';
import type { SimInit, TribeInit, SpawnPattern } from '../sim/types';
import { throttle } from '../utils/throttle';
import { ModeSelector } from './ModeSelector';
import { BiomeGenerator } from '../sim/biomes';

interface SimulationSetupProps {
  client: SimClient;
  onStart: () => void;
  isRunning: boolean;
  onSeedChange?: (seed: number) => void;
  onConfigChange?: (config: SimInit) => void;
  simMode?: SimMode;
  onModeChange?: (newMode: SimMode) => void;
}


// Custom slider with styled track
interface StyledSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  style?: React.CSSProperties;
}

const StyledSlider = ({ min, max, value, onChange, step = 1, style = {} }: StyledSliderProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      style={{
        width: '100%',
        height: '12px',
        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #2d3748 ${percentage}%, #2d3748 100%)`,
        borderRadius: '3px',
        outline: 'none',
        ...style
      }}
      className="custom-slider"
    />
  );
};

// Simple seeded random number generator
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Generate deterministic tribe configs based on seed
function generateTribesFromSeed(seed: number, worldWidth: number = 6000, worldHeight: number = 6000): TribeInit[] {
  const rng = seededRandom(seed);
  const tribesCount = 3 + Math.floor(rng() * 2); // 3-4 tribes
  const tribes: TribeInit[] = [];

  const archetypes = [
    // Pure Herbivore Herds (most common)
    {
      name: 'Grazers',
      genes: {
        speed: 8 + rng() * 6,  // 8-14 units/s
        vision: 40 + rng() * 30,
        metabolism: 0.08 + rng() * 0.12,
        reproChance: 0.018 + rng() * 0.022, // Much higher reproduction for herbivores
        aggression: 0.1 + rng() * 0.2,
        cohesion: 0.5 + rng() * 0.25, // Max 0.75
        diet: -1.0 + rng() * 0.3, // -1.0 to -0.7 (strong herbivore)
        foodStandards: 0.4 + rng() * 0.4,
        viewAngle: 120 + rng() * 60,
        colorHue: 90 + rng() * 60 // Green spectrum
      }
    },
    // Another herbivore variant
    {
      name: 'Browsers',
      genes: {
        speed: 10 + rng() * 5,  // 10-15 units/s
        vision: 50 + rng() * 30,
        metabolism: 0.1 + rng() * 0.1,
        reproChance: 0.015 + rng() * 0.02,  // High reproduction for herbivores
        aggression: 0.05 + rng() * 0.15,
        cohesion: 0.55 + rng() * 0.2, // Max 0.75
        diet: -0.9 + rng() * 0.3, // -0.9 to -0.6 (herbivore)
        foodStandards: 0.5 + rng() * 0.3,
        viewAngle: 140 + rng() * 40,
        colorHue: 120 + rng() * 40 // Yellow-green spectrum
      }
    },
    // Mostly herbivore omnivores
    {
      name: 'Foragers',
      genes: {
        speed: 12 + rng() * 6,  // 12-18 units/s
        vision: 35 + rng() * 25,
        metabolism: 0.12 + rng() * 0.08,
        reproChance: 0.01 + rng() * 0.01,   // Moderate reproduction for omnivores
        aggression: 0.2 + rng() * 0.3,
        cohesion: 0.4 + rng() * 0.3, // Max 0.7
        diet: -0.6 + rng() * 0.4, // -0.6 to -0.2 (herbivore-leaning omnivore)
        foodStandards: 0.3 + rng() * 0.3,
        viewAngle: 110 + rng() * 40,
        colorHue: 180 + rng() * 60 // Blue spectrum
      }
    },
    // Balanced Omnivores
    {
      name: 'Adaptors',
      genes: {
        speed: 14 + rng() * 7,  // 14-21 units/s
        vision: 30 + rng() * 40,
        metabolism: 0.12 + rng() * 0.13,
        reproChance: 0.009 + rng() * 0.009,  // Moderate reproduction for omnivores
        aggression: 0.3 + rng() * 0.3,
        cohesion: 0.3 + rng() * 0.4, // Max 0.7
        diet: -0.4 + rng() * 0.5, // -0.4 to 0.1 (mostly herbivore omnivore)
        foodStandards: 0.2 + rng() * 0.4,
        viewAngle: 100 + rng() * 40,
        colorHue: 200 + rng() * 40 // Cyan spectrum
      }
    },
    // Opportunistic Omnivores (slight carnivore tendency - rare)
    {
      name: 'Scavengers',
      genes: {
        speed: 15 + rng() * 5,  // 15-20 units/s
        vision: 45 + rng() * 25,
        metabolism: 0.14 + rng() * 0.1,
        reproChance: 0.007 + rng() * 0.008,  // Lower reproduction for scavengers
        aggression: 0.4 + rng() * 0.3,
        cohesion: 0.2 + rng() * 0.3, // Max 0.5
        diet: -0.2 + rng() * 0.5, // -0.2 to 0.3 (omnivore with slight carnivore potential)
        foodStandards: 0.1 + rng() * 0.3,
        viewAngle: 130 + rng() * 40,
        colorHue: 270 + rng() * 60 // Purple spectrum
      }
    },
    // Rare mild carnivore (only occasionally appears)
    {
      name: 'Hunters',
      genes: {
        speed: 18 + rng() * 5,  // 18-23 units/s - fast but not crazy
        vision: 50 + rng() * 30, // Reduced vision
        metabolism: 0.18 + rng() * 0.12, // Higher metabolism cost
        reproChance: 0.003 + rng() * 0.004,  // Much lower reproduction for carnivores
        aggression: 0.6 + rng() * 0.3, // Higher aggression for carnivores
        cohesion: 0.4 + rng() * 0.3, // Max 0.7
        diet: 0.3 + rng() * 0.5, // 0.3 to 0.8 (stronger carnivore tendency)
        foodStandards: 0.1 + rng() * 0.2,
        viewAngle: 90 + rng() * 40, // Narrower vision
        colorHue: 0 + rng() * 30 // Red spectrum
      }
    }
  ];

  // Weighted selection favoring diet diversity but maintaining determinism
  const selectedArchetypes: typeof archetypes[0][] = [];
  
  // Create weighted pool with higher chances for balanced diets
  const weightedPool: typeof archetypes[0][] = [];
  
  // Herbivores: common but not overwhelming (40% of pool)
  for (let i = 0; i < 4; i++) {
    if (archetypes[0]) weightedPool.push(archetypes[0]); // Grazers
    if (archetypes[1]) weightedPool.push(archetypes[1]); // Browsers
  }
  
  // Omnivores: moderate presence (50% of pool)
  for (let i = 0; i < 3; i++) {
    if (archetypes[2]) weightedPool.push(archetypes[2]); // Foragers
    if (archetypes[3]) weightedPool.push(archetypes[3]); // Adaptors
  }
  for (let i = 0; i < 2; i++) {
    if (archetypes[4]) weightedPool.push(archetypes[4]); // Scavengers
  }
  
  // Carnivores: guaranteed presence but rare (10% of pool)
  for (let i = 0; i < 2; i++) {
    if (archetypes[5]) weightedPool.push(archetypes[5]); // Hunters
  }
  
  // Select tribes from weighted pool without replacement
  const availablePool = [...weightedPool];
  for (let i = 0; i < tribesCount && selectedArchetypes.length < tribesCount; i++) {
    if (availablePool.length === 0) {
      // Refill pool if empty
      availablePool.push(...weightedPool);
    }
    
    const idx = Math.floor(rng() * availablePool.length);
    const selected = availablePool[idx];
    selectedArchetypes.push(selected);
    
    // Remove all instances of this archetype to avoid duplicates
    for (let j = availablePool.length - 1; j >= 0; j--) {
      if (availablePool[j] === selected) {
        availablePool.splice(j, 1);
      }
    }
  }

  let tribeIndex = 0;
  // Ensure colors are visually distinct
  const usedHues = new Set<number>();
  
  for (const archetype of selectedArchetypes) {
    // Adjust population based on diet type for natural ecosystem balance
    // In larger world (4096x4096), we want much larger populations
    const diet = archetype.genes.diet || -0.5;
    const isHerbivore = diet < -0.5;  // Strong herbivores
    const isCarnivore = diet > 0.2;   // Carnivore tendency

    // Herbivores: largest populations (65% of total ~40k target)
    // Omnivores: medium populations (25% of total)
    // Carnivores: smallest populations (10% of total)
    let baseCount, varCount;
    if (isHerbivore) {
      baseCount = 2500;  // Was 800
      varCount = 1500;   // Was 400
    } else if (isCarnivore) {
      baseCount = 800;   // Was 400
      varCount = 400;    // Was 200
    } else {
      baseCount = 1500;  // Was 800
      varCount = 800;    // Was 400
    }
    const tribeCount = baseCount + Math.floor(rng() * varCount);
    
    // Scale spawn radius with population to avoid overcrowding
    // Use a moderate scaling for balanced spread
    const minRadius = 200; // Moderate minimum radius
    // Quadratic scaling for better spread at high populations
    const radiusScale = Math.pow(tribeCount / 175, 0.75); // Balanced scaling
    const spawnRadius = Math.max(minRadius, minRadius * radiusScale + rng() * 100); // Moderate random variation
    // Add extra radius for very large populations
    const extraRadius = tribeCount > 1800 ? (tribeCount - 1800) * 0.12 : 0; // Moderate extra scaling
    const finalSpawnRadius = spawnRadius + extraRadius;
    
    // Add random offset to angle so tribes don't always spawn in same pattern
    const angleOffset = rng() * Math.PI * 0.3; // Random offset up to 54 degrees
    const angle = (tribeIndex / tribesCount) * Math.PI * 2 + angleOffset;
    // Keep spawns well within world bounds but closer to center
    const worldCenter = Math.min(worldWidth, worldHeight) / 2;
    const maxDistance = Math.min(worldCenter * 0.6, worldCenter - finalSpawnRadius - 200); // Don't spawn too close to edges
    const distance = worldCenter * 0.3 + rng() * Math.min(worldCenter * 0.25, maxDistance - worldCenter * 0.3);
    
    // Make sure colors are distinct - if too similar to existing, shift hue
    let finalGenes = { ...archetype.genes };
    let hue = finalGenes.colorHue;
    
    // Check if hue is too close to any existing
    for (const usedHue of usedHues) {
      const hueDiff = Math.min(Math.abs(hue - usedHue), 360 - Math.abs(hue - usedHue));
      if (hueDiff < 40) { // Too similar
        // Shift hue by at least 60 degrees
        hue = (usedHue + 60 + rng() * 60) % 360;
      }
    }
    finalGenes.colorHue = hue;
    usedHues.add(hue);

    tribes.push({
      name: archetype.name,
      count: tribeCount,
      spawn: {
        x: worldWidth / 2 + Math.cos(angle) * distance,
        y: worldHeight / 2 + Math.sin(angle) * distance,
        radius: finalSpawnRadius,
        pattern: 'adaptive' as const  // Explicitly set adaptive pattern for diet-based clustering
      },
      genes: finalGenes
    });
    tribeIndex++;
  }

  return tribes;
}

export function SimulationSetup({ client, onStart, isRunning, onSeedChange, onConfigChange, simMode, onModeChange }: SimulationSetupProps) {
  const [seed, setSeed] = useState(Date.now());
  const [worldWidth, setWorldWidth] = useState(8000);
  const [worldHeight, setWorldHeight] = useState(8000);
  
  // Cache biome data - only regenerate when seed or world size changes
  const biomeData = useMemo(() => {
    const biomeGen = new BiomeGenerator(seed, worldWidth, worldHeight);
    const traversabilityMap = biomeGen.getTraversabilityMap();
    const biomeGridArray = biomeGen.getBiomeGridArray();
    const { width: gridWidth, height: gridHeight } = biomeGen.getGridDimensions();
    const cellSize = biomeGen.getCellSize();
    console.log('[SimulationSetup] Generated biome data for seed:', seed);
    return { traversabilityMap, biomeGridArray, gridWidth, gridHeight, cellSize };
  }, [seed, worldWidth, worldHeight]);

  // Generate food parameters from seed with modest variation
  const generateFoodParams = (seed: number) => {
    const rng = seededRandom(seed);
    // Modest variation around defaults
    const scale = 110 + (rng() - 0.5) * 44;  // 88-132 (±20%)
    const threshold = 0.25 + (rng() - 0.5) * 0.1;  // 0.20-0.30 (less scarcity, more abundant)
    // Complexity can now be very low (smooth) to moderate (noisy)
    // Range from 0.25 to 1.25, centered at 0.75
    const frequency = 0.75 + (rng() - 0.5) * 1.0;  // 0.25-1.25 (allows smooth to complex patterns)
    return { scale, threshold, frequency };
  };

  // Initialize food parameters from seed
  const initialFoodParams = generateFoodParams(seed);

  const [tribes, setTribes] = useState(() => generateTribesFromSeed(seed, 8000, 8000));
  const [foodCols, setFoodCols] = useState(512);
  const [foodRows, setFoodRows] = useState(512);
  const [foodRegen, setFoodRegen] = useState(0.89); // ~1.1 seconds to fully regrow (fast default)
  const [foodCapacity, setFoodCapacity] = useState(100); // Scaled up 10x for better precision
  const [foodDistScale, setFoodDistScale] = useState(initialFoodParams.scale);  // Island size (default ~110)
  const [foodDistThreshold, setFoodDistThreshold] = useState(initialFoodParams.threshold);  // Scarcity (default ~0.25, higher = more scarce)
  const [foodDistFrequency, setFoodDistFrequency] = useState(initialFoodParams.frequency);  // Complexity (default ~0.75, lower = smoother)
  const [maxEntities, setMaxEntities] = useState(196000);
  const [startEnergy, setStartEnergy] = useState(50);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [reproEnergy, setReproEnergy] = useState(60);
  const [allowHybrids, setAllowHybrids] = useState(false);
  const [entityRenderSize, setEntityRenderSize] = useState(5);
  const [initialized, setInitialized] = useState(false);
  const [clientInitializing, setClientInitializing] = useState(false);

  // Check client initialization status periodically
  useEffect(() => {
    const checkStatus = setInterval(() => {
      if (client) {
        const isInit = client.isInitializing?.() || false;
        setClientInitializing(isInit);
      }
    }, 100);
    
    return () => clearInterval(checkStatus);
  }, [client]);

  const updateConfigImmediate = useCallback((overrides?: { seed?: number; tribes?: TribeInit[] }) => {
    const currentSeed = overrides?.seed ?? seed;
    
    const config: SimInit = {
      seed: currentSeed,
      cap: maxEntities,
      world: {
        width: worldWidth,
        height: worldHeight,
        foodGrid: {
          cols: foodCols,
          rows: foodRows,
          regen: foodRegen,
          capacity: foodCapacity,
          distribution: foodDistThreshold > 0 ? {
            scale: foodDistScale,
            threshold: foodDistThreshold,
            frequency: foodDistFrequency
          } : undefined
        },
        biomes: biomeData  // Use cached biome data
      },
      tribes: overrides?.tribes ?? tribes,
      energy: {
        start: startEnergy,
        max: maxEnergy,
        repro: reproEnergy
      },
      hybridization: allowHybrids
    };
    
    // const totalPopulation = config.tribes.reduce((sum, t) => sum + t.count, 0);
    // console.log('[SimulationSetup] ===== FULL CONFIG UPDATE =====');
    // console.log('[SimulationSetup] Configuration being sent:', {
    //   seed: config.seed,
    //   cap: config.cap,
    //   worldSize: `${config.world.width}x${config.world.height}`,
    //   energy: config.energy,
    //   foodGrid: {
    //     cols: config.world.foodGrid.cols,
    //     rows: config.world.foodGrid.rows,
    //     regen: config.world.foodGrid.regen,
    //     capacity: config.world.foodGrid.capacity,
    //     distribution: config.world.foodGrid.distribution
    //   },
    //   hybridization: config.hybridization,
    //   tribesCount: config.tribes.length,
    //   totalPopulation
    // });

    // console.log('[SimulationSetup] Tribe details:');
    // config.tribes.forEach((tribe, idx) => {
    //   console.log(`[SimulationSetup] Tribe ${idx}: "${tribe.name}"`, {
    //     count: tribe.count,
    //     spawn: tribe.spawn,
    //     genes: tribe.genes
    //   });
    // });
    // console.log('[SimulationSetup] =====================================');
    
    // Pass config to App component
    if (onConfigChange) {
      onConfigChange(config);
    }
    
    setInitialized(true);
    window.dispatchEvent(new CustomEvent('simConfigUpdate'));
  }, [client, seed, maxEntities, worldWidth, worldHeight, foodCols, foodRows, foodRegen, foodCapacity, foodDistScale, foodDistThreshold, foodDistFrequency, tribes, startEnergy, maxEnergy, reproEnergy, allowHybrids, biomeData, onConfigChange]);

  // Create throttled version for live updates - increased to 2 seconds to avoid rapid reinits
  const updateConfig = useMemo(
    () => throttle(updateConfigImmediate, 2000),
    [updateConfigImmediate]
  );

  // Auto-update config when any setting changes (throttled to 2s)
  useEffect(() => {
    if (initialized && !isRunning) {
      // Reduced logging frequency for settings changes
      if (Math.random() < 0.1) { // Log only 10% of the time
        console.log('[SimulationSetup] Settings changed, triggering throttled config update');
      }
      updateConfig();
    }
  }, [initialized, isRunning, updateConfig, seed, maxEntities, worldWidth, worldHeight,
    foodCols, foodRows, foodRegen, foodCapacity, foodDistScale, foodDistThreshold, foodDistFrequency, tribes, startEnergy, maxEnergy, reproEnergy, allowHybrids]);
  
  // Regenerate tribes when world size changes
  useEffect(() => {
    if (initialized && !isRunning) {
      const newTribes = generateTribesFromSeed(seed, worldWidth, worldHeight);
      setTribes(newTribes);
    }
  }, [worldWidth, worldHeight, seed, initialized, isRunning]);
  
  // Send live food parameter updates when simulation is running
  useEffect(() => {
    if (isRunning && client) {
      client.updateFoodParams(foodCapacity, foodRegen);
    }
  }, [isRunning, client, foodCapacity, foodRegen]);

  // Initial config on mount
  useEffect(() => {
    if (!initialized) {
      updateConfigImmediate();
      // Also dispatch initial entity render size
      window.dispatchEvent(new CustomEvent('entityRenderSizeChange', { detail: entityRenderSize }));
    }
  }, [initialized, updateConfigImmediate, entityRenderSize]);

  const randomizeSeed = () => {
    const newSeed = Date.now() + Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    const newTribes = generateTribesFromSeed(newSeed, worldWidth, worldHeight);
    setTribes(newTribes);

    // Generate and apply food parameters from seed
    const foodParams = generateFoodParams(newSeed);
    setFoodDistScale(foodParams.scale);
    setFoodDistThreshold(foodParams.threshold);
    setFoodDistFrequency(foodParams.frequency);

    if (onSeedChange) onSeedChange(newSeed);
    // Force immediate update
    if (!isRunning) {
      updateConfigImmediate({ seed: newSeed, tribes: newTribes });
    }
  };

  // Update parent when seed changes manually
  useEffect(() => {
    if (onSeedChange) onSeedChange(seed);
  }, [seed, onSeedChange]);

  const addTribe = () => {
    const colors = [60, 180, 240, 300];
    const newTribe: TribeInit = {
      name: `Tribe ${tribes.length + 1}`,
      count: 1000,
      spawn: {
        x: Math.random() * worldWidth * 0.8 + worldWidth * 0.1,
        y: Math.random() * worldHeight * 0.8 + worldHeight * 0.1,
        radius: 200
      },
      genes: {
        speed: 15,
        vision: 35,
        metabolism: 0.15,
        reproChance: 0.01,
        aggression: 0.5,
        cohesion: 0.5,
        colorHue: colors[tribes.length % colors.length],
        foodStandards: 0.3,
        diet: -0.5,
        viewAngle: 120
      }
    };
    const updated = [...tribes, newTribe];
    setTribes(updated);
    // Force immediate update
    if (!isRunning) {
      updateConfigImmediate({ tribes: updated });
    }
  };

  const removeTribe = (index: number) => {
    const updated = tribes.filter((_, i) => i !== index);
    setTribes(updated);
    // Force immediate update
    if (!isRunning) {
      updateConfigImmediate({ tribes: updated });
    }
  };

  const updateTribe = (index: number, updates: Partial<TribeInit>) => {
    const updated = [...tribes];
    updated[index] = { ...updated[index], ...updates };
    setTribes(updated);
    // Force immediate update
    if (!isRunning) {
      updateConfigImmediate({ tribes: updated });
    }
  };

  const updateTribeGene = (index: number, gene: string, value: number) => {
    const updated = [...tribes];
    const defaultGenes = {
      speed: 15,
      vision: 35,
      metabolism: 0.15,
      reproChance: 0.01,
      aggression: 0.5,
      cohesion: 0.5,
      colorHue: 180,
      foodStandards: 0.3,
      diet: -0.5,
      viewAngle: 120
    };
    updated[index].genes = { ...defaultGenes, ...updated[index].genes, [gene]: value };
    setTribes(updated);
    // Force immediate update
    if (!isRunning) {
      updateConfigImmediate({ tribes: updated });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.9)',
      borderRadius: '6px',
      fontSize: '13px',
      color: '#fff',
      overflow: 'hidden',
    }}>
      {/* Fixed Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #2d3748',
        background: 'rgba(0, 0, 0, 0.95)',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
          Simulation Setup
        </h3>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        paddingBottom: '80px',
      }}>
        {!isRunning && (
          <>
            {/* Seed Section */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#a0aec0', marginBottom: '6px', fontSize: '13px' }}>
                Seed
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => {
                    const newSeed = Number(e.target.value);
                    setSeed(newSeed);
                    const newTribes = generateTribesFromSeed(newSeed, worldWidth, worldHeight);
                    setTribes(newTribes);
                    if (onSeedChange) onSeedChange(newSeed);
                    // Force immediate update with new values
                    if (!isRunning) {
                      updateConfigImmediate({ seed: newSeed, tribes: newTribes });
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '13px',
                  }}
                />
                <button
                  onClick={randomizeSeed}
                  style={{
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    color: 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }}
                >
                  🎲 Random
                </button>
              </div>
            </div>

            {/* Tribes Section */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#a0aec0', marginBottom: '6px', fontSize: '13px' }}>
                Tribes ({tribes.length})
              </label>
              {tribes.map((tribe, i) => (
                <details key={i} style={{ marginBottom: '8px' }}>
                  <summary style={{
                    cursor: 'pointer',
                    padding: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    borderLeft: `3px solid hsl(${tribe.genes?.colorHue || 0}, 100%, 50%)`,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <input
                      value={tribe.name}
                      onChange={(e) => updateTribe(i, { ...tribe, name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        flex: '0 0 auto',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px', flexShrink: 0 }}>Pop:</span>
                      <StyledSlider
                        min={100}
                        max={20000}
                        step={100}
                        value={tribe.count}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTribe(i, { ...tribe, count: Number(e.target.value) })}
                        style={{ width: '80px', flexShrink: 1 }}
                      />
                      <span style={{ fontSize: '12px', color: '#cbd5e0', minWidth: '35px', textAlign: 'right', flexShrink: 0 }}>
                        {tribe.count}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTribe(i);
                      }}
                      style={{
                        background: '#dc2626',
                        border: 'none',
                        borderRadius: '3px',
                        color: '#fff',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        flex: '0 0 auto',
                      }}
                    >
                      Remove
                    </button>
                  </summary>
                  <div style={{ padding: '10px', fontSize: '12px' }}>
                    {/* Special Diet Slider */}
                    <div style={{ marginBottom: '12px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                        Diet Type: {(() => {
                          const diet = tribe.genes?.diet ?? -0.5;
                          if (diet < -0.7) return '🌿 Herbivore';
                          if (diet < -0.3) return '🥗 Mostly Herbivore';
                          if (diet < 0.3) return '🍽️ Omnivore';
                          if (diet < 0.7) return '🥩 Mostly Carnivore';
                          return '🦁 Pure Carnivore';
                        })()}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#4ade80' }}>🌿</span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={tribe.genes?.diet ?? -0.5}
                          onChange={(e) => updateTribeGene(i, 'diet', Number(e.target.value))}
                          style={{
                            flex: 1,
                            height: '12px',
                            background: `linear-gradient(to right, 
                              #4ade80 0%, 
                              #22c55e 25%, 
                              #fbbf24 50%, 
                              #f97316 75%, 
                              #ef4444 100%)`,
                            borderRadius: '10px',
                            outline: 'none',
                            WebkitAppearance: 'none',
                            cursor: 'pointer',
                          }}
                          className="diet-slider"
                        />
                        <span style={{ fontSize: '11px', color: '#ef4444' }}>🥩</span>
                        <span style={{
                          minWidth: '35px',
                          textAlign: 'right',
                          fontSize: '11px',
                          color: '#cbd5e0',
                          fontFamily: 'monospace'
                        }}>
                          {(tribe.genes?.diet ?? -0.5).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {(['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion', 'foodStandards', 'viewAngle', 'colorHue'] as const).map((gene) => {
                        const value = tribe.genes?.[gene] ?? {
                          speed: 15,
                          vision: 35,
                          metabolism: 0.15,
                          reproChance: 0.01,
                          aggression: 0.5,
                          cohesion: 0.5,
                          colorHue: 180,
                          foodStandards: 0.3,
                          diet: -0.5,
                          viewAngle: 120
                        }[gene];
                        const geneLabels: Record<string, string> = {
                          speed: 'Speed',
                          vision: 'Vision',
                          metabolism: 'Metabolism',
                          reproChance: 'Repro Chance',
                          aggression: 'Aggression',
                          cohesion: 'Cohesion',
                          foodStandards: 'Pickiness',
                          diet: 'Diet (-1=Herb, 1=Carn)',
                          viewAngle: 'View Angle',
                          colorHue: 'Color Hue'
                        };
                        return (
                          <div key={gene}>
                            <label style={{ color: '#a0aec0', fontSize: '11px' }}>
                              {geneLabels[gene] || gene}
                            </label>
                            <input
                              type="number"
                              step={gene === 'colorHue' ? 10 : gene === 'viewAngle' ? 5 : 0.01}
                              min={gene === 'viewAngle' ? 30 : undefined}
                              max={gene === 'viewAngle' ? 180 : undefined}
                              value={value}
                              onChange={(e) => updateTribeGene(i, gene, Number(e.target.value))}
                              style={{
                                width: '100%',
                                padding: '4px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '3px',
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ color: '#a0aec0', fontSize: '11px' }}>
                        Spawn Location
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="number"
                          placeholder="X"
                          value={tribe.spawn.x}
                          onChange={(e) => updateTribe(i, {
                            ...tribe,
                            spawn: { ...tribe.spawn, x: Number(e.target.value) }
                          })}
                          style={{
                            flex: 1,
                            padding: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Y"
                          value={tribe.spawn.y}
                          onChange={(e) => updateTribe(i, {
                            ...tribe,
                            spawn: { ...tribe.spawn, y: Number(e.target.value) }
                          })}
                          style={{
                            flex: 1,
                            padding: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <label style={{ color: '#a0aec0', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
                          Spawn Pattern
                        </label>
                        <select
                          value={tribe.spawn.pattern || 'blob'}
                          onChange={(e) => updateTribe(i, {
                            ...tribe,
                            spawn: { ...tribe.spawn, pattern: e.target.value as SpawnPattern }
                          })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        >
                          <option value="blob">Blob (tight cluster)</option>
                          <option value="scattered">Scattered (random)</option>
                          <option value="herd">Herd (multiple groups)</option>
                          <option value="adaptive">Adaptive (diet-based)</option>
                        </select>
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <label style={{ color: '#a0aec0', fontSize: '11px' }}>
                          Spawn Radius
                        </label>
                        <input
                          type="number"
                          value={tribe.spawn.radius}
                          onChange={(e) => updateTribe(i, {
                            ...tribe,
                            spawn: { ...tribe.spawn, radius: Number(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            padding: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '3px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </details>
              ))}
              <button
                onClick={addTribe}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(59, 130, 246, 0.3)',
                  border: '1px solid #3b82f6',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginTop: '8px',
                }}
              >
                + Add Tribe
              </button>
            </div>


            {/* Advanced Settings */}
            <details style={{ marginBottom: '16px' }}>
              <summary style={{
                cursor: 'pointer',
                padding: '10px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
              }}>
                Advanced Settings
              </summary>
              <div style={{ padding: '12px', fontSize: '13px' }}>
                <div style={{ display: 'grid', gap: '12px' }}>

                  {/* Simulation Mode Selector */}
                  {simMode && onModeChange && (
                    <div>
                      <ModeSelector
                        currentMode={simMode}
                        onModeChange={onModeChange}
                        disabled={isRunning}
                      />
                    </div>
                  )}

                  {/* World Settings & Food Grid - Combined Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                        World Settings
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ color: '#718096', fontSize: '11px' }}>Width</label>
                          <input
                            type="number"
                            value={worldWidth}
                            onChange={(e) => setWorldWidth(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ color: '#718096', fontSize: '11px' }}>Height</label>
                          <input
                            type="number"
                            value={worldHeight}
                            onChange={(e) => setWorldHeight(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ color: '#718096', fontSize: '11px' }}>
                            Max Entities
                            <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '4px' }}>(population cap)</span>
                          </label>
                          <input
                            type="number"
                            value={maxEntities}
                            onChange={(e) => setMaxEntities(Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                        Food Grid
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ color: '#718096', fontSize: '11px' }}>Resolution</label>
                          <select
                            value={foodCols}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFoodCols(val);
                              setFoodRows(val);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          >
                            <option value="64">64x64 (Fast)</option>
                            <option value="128">128x128</option>
                            <option value="256">256x256 (Default)</option>
                            <option value="512">512x512 (Detailed)</option>
                            <option value="1024">1024x1024 (High Res)</option>
                            <option value="2048">2048x2048 (Ultra)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ color: '#718096', fontSize: '11px' }}>Richness</label>
                          <input
                            type="number"
                            value={foodCapacity}
                            onChange={(e) => setFoodCapacity(Number(e.target.value))}
                            step="0.1"
                            style={{
                              width: '100%',
                              padding: '6px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '12px',
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Regen Rate
                          <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '4px' }}>({foodRegen.toFixed(2)} - ~{Math.round(1 / foodRegen)}s)</span>
                        </label>
                        <StyledSlider
                          min={0.01}
                          max={1.0}
                          step={0.01}
                          value={foodRegen}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoodRegen(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Food Distribution */}
                  <div>
                    <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                      Food Distribution
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Island Size ({foodDistScale.toFixed(0)})
                        </label>
                        <StyledSlider
                          min={1}
                          max={1000}
                          value={foodDistScale}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoodDistScale(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Complexity ({foodDistFrequency.toFixed(2)})
                        </label>
                        <StyledSlider
                          min={0.01}
                          max={50}
                          step={0.01}
                          value={foodDistFrequency}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoodDistFrequency(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        Scarcity
                        <span style={{ color: '#4a5568', fontSize: '10px', marginLeft: '4px' }}>({foodDistThreshold.toFixed(2)})</span>
                      </label>
                      <StyledSlider
                        min={0.25}
                        max={1}
                        step={0.05}
                        value={foodDistThreshold}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFoodDistThreshold(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Energy Settings */}
                  <div>
                    <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                      Energy Settings
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Starting ({startEnergy})
                        </label>
                        <StyledSlider
                          min={20}
                          max={80}
                          value={startEnergy}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartEnergy(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Maximum ({maxEnergy})
                        </label>
                        <StyledSlider
                          min={80}
                          max={150}
                          value={maxEnergy}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxEnergy(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        Reproduction Threshold ({reproEnergy})
                      </label>
                      <StyledSlider
                        min={40}
                        max={80}
                        value={reproEnergy}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReproEnergy(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Hybridization */}
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={allowHybrids}
                        onChange={(e) => setAllowHybrids(e.target.checked)}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          accentColor: '#3b82f6'
                        }}
                      />
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>
                        Enable cross-tribe mating (hybrid evolution)
                      </span>
                    </label>
                  </div>

                  {/* Visual Settings */}
                  <div>
                    <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                      Visual Settings
                    </label>
                    <div>
                      <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        Entity Render Size ({entityRenderSize}px)
                      </label>
                      <StyledSlider
                        min={3}
                        max={20}
                        step={1}
                        value={entityRenderSize}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newSize = Number(e.target.value);
                          setEntityRenderSize(newSize);
                          // Dispatch event so Scene2D can update
                          window.dispatchEvent(new CustomEvent('entityRenderSizeChange', { detail: newSize }));
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: '#4a5568' }}>Tiny</span>
                        <span style={{ fontSize: '10px', color: '#4a5568' }}>Normal</span>
                        <span style={{ fontSize: '10px', color: '#4a5568' }}>Large</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </details>
          </>
        )}

        {isRunning && (
          <div style={{ textAlign: 'center', color: '#a0aec0', padding: '40px', fontSize: '14px' }}>
            Simulation is running. Pause to modify settings.
          </div>
        )}
      </div>

      {/* Fixed Footer with Start Button */}
      {!isRunning && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid #2d3748',
        }}>
          <button
            onClick={onStart}
            disabled={clientInitializing}
            style={{
              width: '100%',
              padding: '12px',
              background: clientInitializing ? 'rgba(75, 85, 99, 0.2)' : 'rgba(147, 51, 234, 0.2)',
              border: clientInitializing ? '2px solid #4b5563' : '2px solid #9333ea',
              borderRadius: '4px',
              color: clientInitializing ? '#6b7280' : '#fff',
              cursor: clientInitializing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px', // Ensure consistent height
            }}
            onMouseEnter={(e) => {
              if (!clientInitializing) {
                e.currentTarget.style.background = 'rgba(147, 51, 234, 0.3)';
                e.currentTarget.style.borderColor = '#a855f7';
              }
            }}
            onMouseLeave={(e) => {
              if (!clientInitializing) {
                e.currentTarget.style.background = 'rgba(147, 51, 234, 0.2)';
                e.currentTarget.style.borderColor = '#9333ea';
              }
            }}
          >
            {clientInitializing ? (
              <>
                <span style={{ 
                  display: 'inline-block',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px',
                  fontSize: '16px',
                }}>
                  ⟳
                </span>
                Initializing...
                <style>{`
                  @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </>
            ) : (
              <>
                <span style={{ fontSize: '16px', marginRight: '8px' }}>▶</span>
                Start Simulation
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}