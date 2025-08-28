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
    count: 2000,
    spawn: { x: 1000, y: 1000, radius: 200 },
    genes: {
      speed: 70,
      vision: 35,
      metabolism: 0.25,
      reproChance: 0.01,
      aggression: 0.9,
      cohesion: 0.7,
      colorHue: 0
    }
  },
  {
    name: 'Swarm',
    count: 2000,
    spawn: { x: 3000, y: 1000, radius: 200 },
    genes: {
      speed: 40,
      vision: 30,
      metabolism: 0.15,
      reproChance: 0.012,
      cohesion: 0.95,
      aggression: 0.4,
      colorHue: 120
    }
  },
  {
    name: 'Survivors',
    count: 2000,
    spawn: { x: 2000, y: 3000, radius: 200 },
    genes: {
      speed: 50,
      vision: 40,
      metabolism: 0.08,
      reproChance: 0.02,
      aggression: 0.2,
      cohesion: 0.5,
      colorHue: 210
    }
  },
];

export function SimulationSetup({ client, onStart, isRunning }: SimulationSetupProps) {
  const [seed, setSeed] = useState(Date.now());
  const [tribes, setTribes] = useState(defaultTribes);
  const [worldWidth, setWorldWidth] = useState(4000);
  const [worldHeight, setWorldHeight] = useState(4000);
  const [foodCols, setFoodCols] = useState(256);
  const [foodRows, setFoodRows] = useState(256);
  const [foodRegen, setFoodRegen] = useState(0.1);
  const [foodCapacity, setFoodCapacity] = useState(1);
  const [maxEntities, setMaxEntities] = useState(120000);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const updateConfigImmediate = useCallback(() => {
    const config: SimInit = {
      seed,
      cap: maxEntities,
      world: {
        width: worldWidth,
        height: worldHeight,
        foodGrid: { cols: foodCols, rows: foodRows, regen: foodRegen, capacity: foodCapacity }
      },
      tribes
    };
    client.init(config);
    setInitialized(true);
    // Force a re-render by updating a timestamp
    window.dispatchEvent(new CustomEvent('simConfigUpdate'));
  }, [client, seed, maxEntities, worldWidth, worldHeight, foodCols, foodRows, foodRegen, foodCapacity, tribes]);

  // Create throttled version for live updates
  const updateConfig = useMemo(
    () => throttle(updateConfigImmediate, 300),
    [updateConfigImmediate]
  );

  // Auto-update config when any setting changes (but only after first initialization)
  useEffect(() => {
    if (initialized && !isRunning) {
      updateConfig();
    }
  }, [initialized, isRunning, updateConfig]);

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
    const colors = [60, 180, 240, 300]; // Yellow, Cyan, Purple, Magenta
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
        colorHue: colors[tribes.length % colors.length]
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
    // Ensure all genes exist with defaults
    const defaultGenes = {
      speed: 50,
      vision: 35,
      metabolism: 0.15,
      reproChance: 0.01,
      aggression: 0.5,
      cohesion: 0.5,
      colorHue: 180
    };
    updated[index].genes = { ...defaultGenes, ...updated[index].genes, [gene]: value };
    setTribes(updated);
  };

  return (
    <div style={{
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '6px',
      fontSize: '12px',
      color: '#fff',
      // maxHeight: '80vh',
      overflowY: 'auto',
    }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
        Simulation Setup
      </h3>

      {!isRunning && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '4px' }}>
              Seed
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                style={{
                  flex: 1,
                  padding: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '3px',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
              <button
                onClick={randomizeSeed}
                style={{
                  padding: '4px 8px',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                🎲 Random
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', color: '#888', marginBottom: '4px' }}>
              Tribes ({tribes.length})
            </label>
            {tribes.map((tribe, i) => (
              <details key={i} style={{ marginBottom: '6px' }}>
                <summary style={{
                  cursor: 'pointer',
                  padding: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '3px',
                  borderLeft: `3px solid hsl(${tribe.genes?.colorHue || 0}, 100%, 50%)`,
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
                    }}
                  />
                  <span style={{ color: '#888' }}>Pop: </span>
                  <input
                    type="number"
                    value={tribe.count}
                    onChange={(e) => updateTribe(i, { ...tribe, count: Number(e.target.value) })}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '60px',
                      padding: '2px',
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTribe(i);
                    }}
                    style={{
                      float: 'right',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#fff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      fontSize: '10px',
                    }}
                  >
                    Remove
                  </button>
                </summary>
                <div style={{ padding: '8px', fontSize: '11px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                    {['speed', 'vision', 'metabolism', 'reproChance', 'aggression', 'cohesion', 'colorHue'].map((gene) => {
                      const value = (tribe.genes as any)?.[gene] ?? {
                        speed: 50,
                        vision: 35,
                        metabolism: 0.15,
                        reproChance: 0.01,
                        aggression: 0.5,
                        cohesion: 0.5,
                        colorHue: 180
                      }[gene];
                      return (
                        <div key={gene}>
                          <label style={{ color: '#888', fontSize: '10px' }}>
                            {gene}
                          </label>
                          <input
                            type="number"
                            step={gene === 'colorHue' ? 10 : 0.01}
                            value={value}
                            onChange={(e) => updateTribeGene(i, gene, Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '2px',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '2px',
                              color: '#fff',
                              fontSize: '10px',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <label style={{ color: '#888', fontSize: '10px' }}>
                      Spawn Location
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
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
                          padding: '2px',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '2px',
                          color: '#fff',
                          fontSize: '10px',
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
                          padding: '2px',
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '2px',
                          color: '#fff',
                          fontSize: '10px',
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
                padding: '6px',
                background: 'rgba(59, 130, 246, 0.3)',
                border: '1px solid #3b82f6',
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
                marginTop: '6px',
              }}
            >
              + Add Tribe
            </button>
          </div>

          <details style={{ marginBottom: '12px' }}>
            <summary style={{
              cursor: 'pointer',
              padding: '6px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '3px',
              fontSize: '11px',
            }}>
              Advanced Settings
            </summary>
            <div style={{ padding: '8px', fontSize: '11px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div>
                  <label style={{ color: '#888', fontSize: '10px' }}>World Size</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      value={worldWidth}
                      onChange={(e) => setWorldWidth(Number(e.target.value))}
                      placeholder="Width"
                      style={{
                        flex: 1,
                        padding: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                        color: '#fff',
                        fontSize: '10px',
                      }}
                    />
                    <input
                      type="number"
                      value={worldHeight}
                      onChange={(e) => setWorldHeight(Number(e.target.value))}
                      placeholder="Height"
                      style={{
                        flex: 1,
                        padding: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                        color: '#fff',
                        fontSize: '10px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ color: '#888', fontSize: '10px' }}>Food Grid</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
                    <input
                      type="number"
                      value={foodRegen}
                      onChange={(e) => setFoodRegen(Number(e.target.value))}
                      step="0.01"
                      placeholder="Regen"
                      style={{
                        padding: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                        color: '#fff',
                        fontSize: '10px',
                      }}
                    />
                    <input
                      type="number"
                      value={foodCapacity}
                      onChange={(e) => setFoodCapacity(Number(e.target.value))}
                      step="0.1"
                      placeholder="Capacity"
                      style={{
                        padding: '2px',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '2px',
                        color: '#fff',
                        fontSize: '10px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ color: '#888', fontSize: '10px' }}>Max Entities</label>
                  <input
                    type="number"
                    value={maxEntities}
                    onChange={(e) => setMaxEntities(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '2px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                      color: '#fff',
                      fontSize: '10px',
                    }}
                  />
                </div>
              </div>
            </div>
          </details>

          <button
            onClick={onStart}
            style={{
              width: '100%',
              padding: '10px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Start Simulation
          </button>
        </>
      )}

      {isRunning && (
        <div style={{ textAlign: 'center', color: '#888', padding: '20px' }}>
          Simulation is running. Pause to modify settings.
        </div>
      )}
    </div>
  );
}