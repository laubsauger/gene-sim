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
          name: 'Alpha',
          count: 2000,
          spawn: { x: 1000, y: 1000, radius: 200 },
          genes: { speed: 25, reproChance: 0.008, colorHue: 0 }  // Red
        },
        {
          name: 'Beta',
          count: 2000,
          spawn: { x: 3000, y: 1000, radius: 200 },
          genes: { speed: 15, vision: 20, colorHue: 120 }  // Green
        },
        {
          name: 'Gamma',
          count: 2000,
          spawn: { x: 2000, y: 3000, radius: 200 },
          genes: { metabolism: 0.1, reproChance: 0.012, colorHue: 210 }  // Sky Blue
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