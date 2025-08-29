import { useEffect, useRef, useState } from 'react';
import { Scene2D } from './render/Scene2D';
import { createSimClient, detectBestMode, type SimMode, type SimClient } from './client/setupSimClientHybrid';
import { Controls } from './ui/Controls';
import { StatsPanel } from './ui/StatsPanel';
import { SimulationSetup } from './ui/SimulationSetup';
import { GameOver } from './ui/GameOver';
import { ModeSelector } from './ui/ModeSelector';
import type { SimStats } from './sim/types';
import './App.css';

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

function getDefaultInitParams(seed: number) {
  return {
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
          vision: 80,
          metabolism: 0.25,
          reproChance: 0.008,
          aggression: 0.95,
          cohesion: 0.6,
          diet: 0.95,
          foodStandards: 0.1,
          viewAngle: 140,
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
          diet: -0.9,
          foodStandards: 0.7,
          viewAngle: 90,
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
          diet: 0.2,
          foodStandards: 0.4,
          viewAngle: 120,
          colorHue: 210
        }
      },
    ],
  };
}

export default function App() {
  // Detect mode once and store in state
  const [simMode, setSimMode] = useState<SimMode>(() => detectBestMode());
  
  // Create client once and store in ref to persist across renders
  const clientRef = useRef<SimClient | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const initialized = useRef(false);
  const [simConfig, setSimConfig] = useState<any>(null);
  
  // Initialize client if not exists
  if (!clientRef.current) {
    console.log('[App] Creating client with mode:', simMode);
    clientRef.current = createSimClient({ mode: simMode });
  }
  
  const client = clientRef.current;
  const [isRunning, setIsRunning] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [currentSeed, setCurrentSeed] = useState<number>(Date.now());
  const [gameOver, setGameOver] = useState<{ finalTime: number; finalStats: SimStats } | null>(null);

  useEffect(() => {
    const initClient = async () => {
      // Only initialize if we have a config from SimulationSetup
      if (!simConfig) {
        console.log('[App] Waiting for config from SimulationSetup...');
        return;
      }
      
      // If already initialized and not running, reinitialize with new config
      if (client.isReady() && !isRunning) {
        console.log('[App] Re-initializing with updated config from SimulationSetup');
        client.terminate();
        clientRef.current = createSimClient({ mode: simMode });
        initialized.current = false;
        setClientReady(false);
        
        await clientRef.current.init(simConfig);
        initialized.current = true;
        setClientReady(true);
        return;
      }
      
      // First time initialization
      if (!initialized.current && client && !client.isReady()) {
        initialized.current = true;
        console.log('[App] Initial client setup with config from SimulationSetup');
        await client.init(simConfig);
        setClientReady(true);
      }
    };
    
    if (simConfig) {
      initClient();
    }
  }, [simConfig, isRunning, simMode]); // Re-init when config changes (but not while running)

  const handleStart = () => {
    setIsRunning(true);
    setShowSetup(false);
    setGameOver(null);
    client.pause(false); // Unpause the simulation
  };
  
  const handleRestart = () => {
    // Reset with same seed
    setGameOver(null);
    setShowSetup(true);
    setIsRunning(false);
    // Seed is already set, just restart
  };
  
  const handleNewSimulation = () => {
    // Reset with new seed
    const newSeed = Date.now();
    setCurrentSeed(newSeed);
    setGameOver(null);
    setShowSetup(true);
    setIsRunning(false);
  };
  
  const handleModeChange = (newMode: SimMode) => {
    if (newMode === simMode) return;
    
    console.log('[App] Changing mode from', simMode, 'to', newMode);
    
    // Stop current simulation
    setIsRunning(false);
    client.setPaused(true);
    client.terminate();
    
    // Create new client with new mode
    console.log('[App] Creating new client with mode:', newMode);
    clientRef.current = createSimClient({ mode: newMode });
    setSimMode(newMode);
    
    // Reset initialization flag and re-initialize
    initialized.current = false;
    setClientReady(false);
    setShowSetup(true);
    
    // If we have a config, initialize with it
    if (simConfig) {
      console.log('[App] Re-initializing with existing config');
      clientRef.current.init(simConfig).then(() => {
        setClientReady(true);
        initialized.current = true;
      });
    }
    // Otherwise wait for config from SimulationSetup
  };

  // Track pause state
  useEffect(() => {
    const unsubscribe = client.onMessage((msg) => {
      // Listen for extinction event
      if (msg.type === 'extinction') {
        setGameOver({
          finalTime: msg.payload.finalTime,
          finalStats: msg.payload.finalStats
        });
        setIsRunning(false);
      }
    });
    return unsubscribe;
  }, [client]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[App] Cleaning up on unmount');
      if (clientRef.current) {
        clientRef.current.terminate();
      }
    };
  }, []);

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
          {showSetup && (
            <ModeSelector
              currentMode={simMode}
              onModeChange={handleModeChange}
              disabled={isRunning}
            />
          )}
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
            onConfigChange={setSimConfig}
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
      
      {gameOver && (
        <GameOver
          finalTime={gameOver.finalTime}
          finalStats={gameOver.finalStats}
          onRestart={handleRestart}
          onNewSimulation={handleNewSimulation}
          seed={currentSeed}
        />
      )}
    </div>
  );
}