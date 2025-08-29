import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [currentSeed, setCurrentSeed] = useState<number>(Date.now());

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      // Initialize with default config but don't start
      const seed = Date.now();
      setCurrentSeed(seed);
      client.init({
        seed,
        cap: 120_000,
        world: {
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
          foodGrid: { cols: 256, rows: 256, regen: 0.08, capacity: 3 }
        },
        tribes: [
          {
            name: 'Warmongers',
            count: 1000,
            spawn: { x: 1000, y: 1000, radius: 200, pattern: 'scattered' as const },
            genes: {
              speed: 90,
              vision: 80,  // Increased from 50 for better hunting
              metabolism: 0.25,  // Reduced from 0.35 for efficiency
              reproChance: 0.008,
              aggression: 0.95,
              cohesion: 0.6,  // Increased for pack hunting
              diet: 0.95,  // Almost pure carnivore
              foodStandards: 0.1,  // Not picky, will hunt anything
              viewAngle: 140,  // Wide view for hunting
              colorHue: 0
            }
          },
          {
            name: 'Swarm',
            count: 1000,
            spawn: { x: 3000, y: 1000, radius: 200, pattern: 'herd' as const },
            genes: {
              speed: 25,
              vision: 70,
              metabolism: 0.05,
              reproChance: 0.025,
              cohesion: 0.98,
              aggression: 0.1,
              diet: -0.9,  // Almost pure herbivore
              foodStandards: 0.7,  // Picky about food areas
              viewAngle: 90,  // Narrower view, focused on food
              colorHue: 120
            }
          },
          {
            name: 'Survivors',
            count: 1000,
            spawn: { x: 2000, y: 3000, radius: 200, pattern: 'adaptive' as const },
            genes: {
              speed: 65,
              vision: 30,
              metabolism: 0.12,
              reproChance: 0.015,
              aggression: 0.6,
              cohesion: 0.3,
              diet: 0.2,  // Omnivore, slightly carnivorous
              foodStandards: 0.4,  // Moderate standards
              viewAngle: 120,  // Balanced view
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
      gridTemplateColumns: '1fr 420px',
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
          <Controls 
            client={client} 
            isRunning={isRunning}
            onStart={handleStart}
          />
        </div>
      </div>
      
      <div style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#111',
        borderLeft: '1px solid #222',
      }}>
        {showSetup ? (
          <SimulationSetup
            client={client}
            onStart={handleStart}
            isRunning={isRunning}
            onSeedChange={setCurrentSeed}
          />
        ) : (
          <StatsPanel client={client} currentSeed={currentSeed} />
        )}
        {/* {isRunning && (
          <button
            onClick={() => setShowSetup(!showSetup)}
            style={{
              position: 'sticky',
              bottom: 0,
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#999',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            {showSetup ? '← Back to Stats' : '⚙ Setup'}
          </button>
        )} */}
      </div>
    </div>
  );
}