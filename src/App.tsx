import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scene2D } from './render/Scene2D';
import { setupSimClient } from './client/setupSimClient';
import SimWorker from './sim/sim.worker.ts?worker';
import { Controls } from './ui/Controls';
import { StatsPanel } from './ui/StatsPanel';
import { SimulationSetup } from './ui/SimulationSetup';
import './App.css';

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

export default function App() {
  const worker = useMemo(() => new SimWorker(), []);
  const client = useMemo(() => setupSimClient(worker), [worker]);
  const initialized = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Initialize with default config but don't start
      client.init({
        seed: Date.now(),
        cap: 120_000,
        world: {
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          foodGrid: { cols: 256, rows: 256, regen: 0.1, capacity: 1 }
        },
        tribes: [
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
        ],
      });
    }
  }, [client]);

  const handleStart = () => {
    setIsRunning(true);
    setShowSetup(false);
    client.pause(false); // Unpause the simulation
  };

  // Track pause state
  useEffect(() => {
    const unsubscribe = client.onMessage(() => {
      // We could track pause state from worker if needed
    });
    return unsubscribe;
  }, [client]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      // background: '#0a0a0a',
    }}>
      <div style={{ position: 'relative' }}>
        <Scene2D 
          client={client} 
          world={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }} 
        />
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
        }}>
          <Controls client={client} />
        </div>
      </div>
      
      <div style={{
        overflowY: 'auto',
        background: '#111',
        borderLeft: '1px solid #222',
      }}>
        {showSetup ? (
          <SimulationSetup
            client={client}
            onStart={handleStart}
            isRunning={isRunning}
          />
        ) : (
          <StatsPanel client={client} />
        )}
        {isRunning && (
          <button
            onClick={() => setShowSetup(!showSetup)}
            style={{
              position: 'fixed',
              bottom: '16px',
              right: '16px',
              padding: '8px 12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              zIndex: 100,
            }}
          >
            {showSetup ? 'Show Stats' : 'Show Setup'}
          </button>
        )}
      </div>
    </div>
  );
}