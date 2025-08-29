import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { SimClient } from '../client/setupSimClient';
import type { SimInit, TribeInit } from '../sim/types';
import { throttle } from '../utils/throttle';

interface SimulationSetupProps {
  client: SimClient;
  onStart: () => void;
  isRunning: boolean;
}

const defaultTribes: TribeInit[] = [
  {
    name: 'Warmongers',
    count: 1000,
    spawn: { x: 500, y: 500, radius: 200 },  // Top-left corner
    genes: {
      speed: 70,
      vision: 35,
      metabolism: 0.25,
      reproChance: 0.01,
      aggression: 0.9,
      cohesion: 0.7,
      colorHue: 0,
      foodStandards: 0.2,
      diet: 0.3,  // Carnivore-leaning
      viewAngle: 90  // Narrow FOV for hunting focus
    }
  },
  {
    name: 'Swarm',
    count: 1000,
    spawn: { x: 3500, y: 500, radius: 200 },  // Top-right corner
    genes: {
      speed: 40,
      vision: 30,
      metabolism: 0.15,
      reproChance: 0.02,
      cohesion: 0.95,
      aggression: 0.4,
      colorHue: 270,  // Purple
      foodStandards: 0.5,
      diet: -0.5,  // Herbivore-leaning
      viewAngle: 140  // Wide FOV for predator detection
    }
  },
  {
    name: 'Survivors',
    count: 1000,
    spawn: { x: 500, y: 3500, radius: 200 },  // Bottom-left corner
    genes: {
      speed: 30,
      vision: 45,
      metabolism: 0.08,
      reproChance: 0.015,
      aggression: 0.2,
      cohesion: 0.55,
      colorHue: 210,
      foodStandards: 0.7,
      diet: -0.8,  // Strong herbivore
      viewAngle: 160  // Very wide FOV for maximum awareness
    }
  },
  {
    name: 'Nomads',
    count: 1000,
    spawn: { x: 3500, y: 3500, radius: 200 },  // Bottom-right corner
    genes: {
      speed: 60,
      vision: 50,
      metabolism: 0.18,
      reproChance: 0.008,
      aggression: 0.5,
      cohesion: 0.3,
      colorHue: 120,  // Green
      foodStandards: 0.1,
      diet: 0,  // Omnivore
      viewAngle: 120  // Balanced FOV
    }
  },
];

// Custom slider with styled track
const StyledSlider = ({ min, max, value, onChange, step = 1, style = {} }: any) => {
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

export function SimulationSetup({ client, onStart, isRunning }: SimulationSetupProps) {
  const [seed, setSeed] = useState(Date.now());
  const [tribes, setTribes] = useState(defaultTribes);
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
  const [initialized, setInitialized] = useState(false);

  const updateConfigImmediate = useCallback(() => {
    const config: SimInit = {
      seed,
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
      tribes,
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
  };

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
                  onChange={(e) => setSeed(Number(e.target.value))}
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
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '13px',
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion', 'foodStandards', 'diet', 'colorHue'].map((gene) => {
                        const value = (tribe.genes as any)?.[gene] ?? {
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
                          colorHue: 'Color Hue'
                        };
                        return (
                          <div key={gene}>
                            <label style={{ color: '#a0aec0', fontSize: '11px' }}>
                              {geneLabels[gene] || gene}
                            </label>
                            <input
                              type="number"
                              step={gene === 'colorHue' ? 10 : gene === 'diet' ? 0.1 : 0.01}
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