import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimInit, TribeInit, SpawnPattern } from '../sim/types';
import { throttle } from '../utils/throttle';

interface SimulationSetupProps {
  client: SimClient;
  onStart: () => void;
  isRunning: boolean;
  onSeedChange?: (seed: number) => void;
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
function generateTribesFromSeed(seed: number): TribeInit[] {
  const rng = seededRandom(seed);
  const tribesCount = 3 + Math.floor(rng() * 2); // 3-4 tribes
  const tribes: TribeInit[] = [];

  const archetypes = [
    // Pure Herbivore Herds (most common)
    {
      name: 'Grazers',
      genes: {
        speed: 20 + rng() * 40,
        vision: 40 + rng() * 30,
        metabolism: 0.08 + rng() * 0.12,
        reproChance: 0.012 + rng() * 0.018, // Higher reproduction
        aggression: 0.1 + rng() * 0.2,
        cohesion: 0.6 + rng() * 0.4,
        diet: -1.0 + rng() * 0.3, // -1.0 to -0.7 (strong herbivore)
        foodStandards: 0.4 + rng() * 0.4,
        viewAngle: 120 + rng() * 60,
        colorHue: 90 + rng() * 60 // Green spectrum
      },
      spawnPattern: 'herd' as const
    },
    // Another herbivore variant
    {
      name: 'Browsers',
      genes: {
        speed: 30 + rng() * 30,
        vision: 50 + rng() * 30,
        metabolism: 0.1 + rng() * 0.1,
        reproChance: 0.01 + rng() * 0.015,
        aggression: 0.05 + rng() * 0.15,
        cohesion: 0.7 + rng() * 0.3,
        diet: -0.9 + rng() * 0.3, // -0.9 to -0.6 (herbivore)
        foodStandards: 0.5 + rng() * 0.3,
        viewAngle: 140 + rng() * 40,
        colorHue: 120 + rng() * 40 // Yellow-green spectrum
      },
      spawnPattern: 'herd' as const
    },
    // Mostly herbivore omnivores
    {
      name: 'Foragers',
      genes: {
        speed: 40 + rng() * 30,
        vision: 35 + rng() * 25,
        metabolism: 0.12 + rng() * 0.08,
        reproChance: 0.008 + rng() * 0.012,
        aggression: 0.2 + rng() * 0.3,
        cohesion: 0.4 + rng() * 0.3,
        diet: -0.6 + rng() * 0.4, // -0.6 to -0.2 (herbivore-leaning omnivore)
        foodStandards: 0.3 + rng() * 0.3,
        viewAngle: 110 + rng() * 40,
        colorHue: 180 + rng() * 60 // Blue spectrum
      },
      spawnPattern: 'adaptive' as const
    },
    // Balanced Omnivores
    {
      name: 'Adaptors',
      genes: {
        speed: 45 + rng() * 35,
        vision: 30 + rng() * 40,
        metabolism: 0.12 + rng() * 0.13,
        reproChance: 0.008 + rng() * 0.012,
        aggression: 0.3 + rng() * 0.3,
        cohesion: 0.3 + rng() * 0.4,
        diet: -0.4 + rng() * 0.5, // -0.4 to 0.1 (mostly herbivore omnivore)
        foodStandards: 0.2 + rng() * 0.4,
        viewAngle: 100 + rng() * 40,
        colorHue: 200 + rng() * 40 // Cyan spectrum
      },
      spawnPattern: 'adaptive' as const
    },
    // Opportunistic Omnivores (slight carnivore tendency - rare)
    {
      name: 'Scavengers',
      genes: {
        speed: 50 + rng() * 30,
        vision: 45 + rng() * 25,
        metabolism: 0.14 + rng() * 0.1,
        reproChance: 0.006 + rng() * 0.008,
        aggression: 0.4 + rng() * 0.3,
        cohesion: 0.2 + rng() * 0.3,
        diet: -0.2 + rng() * 0.5, // -0.2 to 0.3 (omnivore with slight carnivore potential)
        foodStandards: 0.1 + rng() * 0.3,
        viewAngle: 130 + rng() * 40,
        colorHue: 270 + rng() * 60 // Purple spectrum
      },
      spawnPattern: 'scattered' as const
    },
    // Rare mild carnivore (only occasionally appears)
    {
      name: 'Hunters',
      genes: {
        speed: 60 + rng() * 20, // Reduced speed
        vision: 50 + rng() * 30, // Reduced vision
        metabolism: 0.18 + rng() * 0.12, // Higher metabolism cost
        reproChance: 0.004 + rng() * 0.006, // Lower reproduction
        aggression: 0.5 + rng() * 0.3, // Reduced aggression
        cohesion: 0.4 + rng() * 0.3,
        diet: 0.2 + rng() * 0.4, // 0.2 to 0.6 (mild carnivore, not pure)
        foodStandards: 0.1 + rng() * 0.2,
        viewAngle: 90 + rng() * 40, // Narrower vision
        colorHue: 0 + rng() * 30 // Red spectrum
      },
      spawnPattern: 'scattered' as const
    }
  ];

  // Weighted selection - herbivores are more common
  const weightedArchetypes: typeof archetypes[0][] = [];
  
  // Add herbivores multiple times for higher weight
  for (let j = 0; j < 3; j++) {
    if (archetypes[0]) weightedArchetypes.push(archetypes[0]); // Grazers x3
    if (archetypes[1]) weightedArchetypes.push(archetypes[1]); // Browsers x3
  }
  for (let j = 0; j < 2; j++) {
    if (archetypes[2]) weightedArchetypes.push(archetypes[2]); // Foragers x2
    if (archetypes[3]) weightedArchetypes.push(archetypes[3]); // Adaptors x2
  }
  if (archetypes[4]) weightedArchetypes.push(archetypes[4]); // Scavengers x1
  
  // Hunters always available but with lower weight
  if (archetypes[5]) {
    weightedArchetypes.push(archetypes[5]); // Hunters x1 (less common than herbivores)
  }
  
  // Shuffle the weighted list
  const shuffled = weightedArchetypes.sort(() => rng() - 0.5);
  
  // Pick unique archetypes (avoid duplicates)
  const selectedArchetypes = new Set<typeof archetypes[0]>();
  for (let i = 0; i < tribesCount && selectedArchetypes.size < tribesCount; i++) {
    if (i < shuffled.length) {
      selectedArchetypes.add(shuffled[i]);
    }
  }

  let tribeIndex = 0;
  for (const archetype of selectedArchetypes) {
    // Add random offset to angle so tribes don't always spawn in same pattern
    const angleOffset = rng() * Math.PI * 0.5; // Random offset up to 90 degrees
    const angle = (tribeIndex / tribesCount) * Math.PI * 2 + angleOffset;
    const distance = 1200 + rng() * 800;
    
    // Hunters get smaller initial population
    const isHunter = archetype.name === 'Hunters';
    const baseCount = isHunter ? 400 : 800;
    const varCount = isHunter ? 200 : 400;

    tribes.push({
      name: archetype.name,
      count: baseCount + Math.floor(rng() * varCount), // Hunters: 400-600, Others: 800-1200
      spawn: {
        x: 2000 + Math.cos(angle) * distance,
        y: 2000 + Math.sin(angle) * distance,
        radius: 150 + rng() * 100,
        pattern: archetype.spawnPattern
      },
      genes: archetype.genes
    });
    tribeIndex++;
  }

  return tribes;
}

export function SimulationSetup({ client, onStart, isRunning, onSeedChange }: SimulationSetupProps) {
  const [seed, setSeed] = useState(Date.now());
  const [tribes, setTribes] = useState(() => generateTribesFromSeed(Date.now()));
  const [worldWidth, setWorldWidth] = useState(4000);
  const [worldHeight, setWorldHeight] = useState(4000);
  const [foodCols, setFoodCols] = useState(256);
  const [foodRows, setFoodRows] = useState(256);
  const [foodRegen, setFoodRegen] = useState(0.08);
  const [foodCapacity, setFoodCapacity] = useState(3);
  const [foodDistScale, setFoodDistScale] = useState(35);
  const [foodDistThreshold, setFoodDistThreshold] = useState(0.35);
  const [foodDistFrequency, setFoodDistFrequency] = useState(3);
  const [maxEntities, setMaxEntities] = useState(120000);
  const [startEnergy, setStartEnergy] = useState(50);
  const [maxEnergy, setMaxEnergy] = useState(100);
  const [reproEnergy, setReproEnergy] = useState(60);
  const [allowHybrids, setAllowHybrids] = useState(false);
  const [entityRenderSize, setEntityRenderSize] = useState(48);
  const [initialized, setInitialized] = useState(false);

  const updateConfigImmediate = useCallback((overrides?: { seed?: number; tribes?: TribeInit[] }) => {
    const config: SimInit = {
      seed: overrides?.seed ?? seed,
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
        }
      },
      tribes: overrides?.tribes ?? tribes,
      energy: {
        start: startEnergy,
        max: maxEnergy,
        repro: reproEnergy
      },
      hybridization: allowHybrids
    };
    client.init(config);
    setInitialized(true);
    window.dispatchEvent(new CustomEvent('simConfigUpdate'));
  }, [client, seed, maxEntities, worldWidth, worldHeight, foodCols, foodRows, foodRegen, foodCapacity, foodDistScale, foodDistThreshold, foodDistFrequency, tribes, startEnergy, maxEnergy, reproEnergy, allowHybrids]);

  // Create throttled version for live updates
  const updateConfig = useMemo(
    () => throttle(updateConfigImmediate, 300),
    [updateConfigImmediate]
  );

  // Auto-update config when any setting changes
  useEffect(() => {
    if (initialized && !isRunning) {
      updateConfig();
    }
  }, [initialized, isRunning, updateConfig, seed, maxEntities, worldWidth, worldHeight,
    foodCols, foodRows, foodRegen, foodCapacity, foodDistScale, foodDistThreshold, foodDistFrequency, tribes, startEnergy, maxEnergy, reproEnergy, allowHybrids]);

  // Initial config on mount
  useEffect(() => {
    if (!initialized) {
      updateConfigImmediate();
    }
  }, [initialized, updateConfigImmediate]);

  const randomizeSeed = () => {
    const newSeed = Date.now() + Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    setTribes(generateTribesFromSeed(newSeed));
    if (onSeedChange) onSeedChange(newSeed);
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
        speed: 50,
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
    setTribes([...tribes, newTribe]);
  };

  const removeTribe = (index: number) => {
    setTribes(tribes.filter((_, i) => i !== index));
  };

  const updateTribe = (index: number, updates: Partial<TribeInit>) => {
    const updated = [...tribes];
    updated[index] = { ...updated[index], ...updates };
    setTribes(updated);
  };

  const updateTribeGene = (index: number, gene: string, value: number) => {
    const updated = [...tribes];
    const defaultGenes = {
      speed: 50,
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
                    const newTribes = generateTribesFromSeed(newSeed);
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
                        marginRight: '8px',
                        fontSize: '13px',
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '140px' }}>
                      <span style={{ color: '#a0aec0', fontSize: '12px', flexShrink: 0 }}>Pop:</span>
                      <StyledSlider
                        min={100}
                        max={5000}
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
                        float: 'right',
                        background: '#dc2626',
                        border: 'none',
                        borderRadius: '3px',
                        color: '#fff',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
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
                          speed: 50,
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                        <div>
                          <label style={{ color: '#718096', fontSize: '11px' }}>Regen Rate</label>
                          <input
                            type="number"
                            value={foodRegen}
                            onChange={(e) => setFoodRegen(Number(e.target.value))}
                            step="0.01"
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
                  </div>

                  {/* Food Distribution */}
                  <div>
                    <label style={{ color: '#a0aec0', fontSize: '12px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                      Food Distribution
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ color: '#718096', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                          Island Size ({foodDistScale})
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
                        Scarcity ({foodDistThreshold.toFixed(2)} - {foodDistThreshold === 0 ? 'everywhere' : foodDistThreshold < 0.3 ? 'abundant' : foodDistThreshold < 0.5 ? 'islands' : 'rare peaks'})
                      </label>
                      <StyledSlider
                        min={0}
                        max={0.8}
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
                        min={5}
                        max={100}
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
            style={{
              width: '100%',
              padding: '12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            Start Simulation
          </button>
        </div>
      )}
    </div>
  );
}