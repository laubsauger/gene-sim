import React, { useEffect, useMemo, useRef } from 'react';
import { Scene2D } from './render/Scene2D';
import { setupSimClient } from './client/setupSimClient';
import SimWorker from './sim/sim.worker.ts?worker';
import { Controls } from './ui/Controls';
import { StatsPanel } from './ui/StatsPanel';
import './App.css';

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

export default function App() {
  const worker = useMemo(() => new SimWorker(), []);
  const client = useMemo(() => setupSimClient(worker), [worker]);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
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
          count: 1500,
          spawn: { x: 1000, y: 1000, radius: 200 },
          genes: { speed: 70, aggression: 0.9, cohesion: 0.7, metabolism: 0.25, colorHue: 0 }  // Red - aggressive warriors
        },
        {
          name: 'Swarm',
          count: 2500,
          spawn: { x: 3000, y: 1000, radius: 200 },
          genes: { speed: 40, vision: 30, cohesion: 0.95, aggression: 0.4, colorHue: 120 }  // Green - highly coordinated
        },
        {
          name: 'Survivors',
          count: 2000,
          spawn: { x: 2000, y: 3000, radius: 200 },
          genes: { speed: 50, metabolism: 0.08, reproChance: 0.02, vision: 40, colorHue: 210 }  // Blue - efficient survivors
        },
      ],
      });
    }
  }, [client]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 320px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#0a0a0a',
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
        padding: '16px',
        overflowY: 'auto',
        background: '#111',
        borderLeft: '1px solid #222',
      }}>
        <h1 style={{
          margin: '0 0 16px 0',
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#fff',
        }}>
          Genetic Simulation
        </h1>
        <StatsPanel client={client} />
      </div>
    </div>
  );
}