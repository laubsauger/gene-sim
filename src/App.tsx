import { useEffect, useRef, useState } from 'react';
import { Scene2D } from './render/Scene2D';
import { Scene3D } from './render/Scene3D';
import { Scene3DPlanetCanvas } from './render/Scene3DPlanetCanvas';
import { createSimClient, detectBestMode, type SimMode, type SimClient } from './client/setupSimClientHybrid';
import { Controls } from './ui/Controls';
import { StatsPanel } from './ui/StatsPanel';
import { SimulationSetup } from './ui/SimulationSetup';
import { GameOver } from './ui/GameOver';
import { COIStatus } from './ui/COIStatus';
import { BiomeLegend } from './ui/BiomeLegend';
import type { SimStats } from './sim/types';
import { useUIStore } from './stores/useUIStore';
import './App.css';

const WORLD_WIDTH = 8000;
const WORLD_HEIGHT = 8000;

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
  const [entitySize, setEntitySize] = useState(() => {
    const defaultSize = 10.0; // Increased from 6.0 for better visibility
    console.log('[App] Initializing default entity size to:', defaultSize);
    return defaultSize;
  }); // Default entity size
  const [showFood, setShowFood] = useState(true); // Toggle food display
  const [showBoundaries, setShowBoundaries] = useState(true); // Toggle boundary visualization - enabled by default
  const [biomeMode, setBiomeMode] = useState<'hidden' | 'natural' | 'highlight'>('natural'); // Biome display mode
  const [biomeLegendCollapsed, setBiomeLegendCollapsed] = useState(true); // Biome legend collapse state - collapsed by default
  const [simRestartKey, setSimRestartKey] = useState(0); // Force re-render on simulation restart
  const { controlsHidden, renderMode, setRenderMode } = useUIStore(); // Get UI state from store

  const lastConfigRef = useRef<any>(null);
  
  useEffect(() => {
    const initClient = async () => {
      // Only initialize if we have a config from SimulationSetup
      if (!simConfig) {
        console.log('[App] Waiting for config from SimulationSetup...');
        return;
      }
      
      // Check if config actually changed (not just a re-render)
      const configChanged = JSON.stringify(simConfig) !== JSON.stringify(lastConfigRef.current);
      
      // First time initialization
      if (!initialized.current && client && !client.isReady()) {
        initialized.current = true;
        lastConfigRef.current = simConfig;
        console.log('[App] Initial client setup with config from SimulationSetup');
        await client.init(simConfig);
        setClientReady(true);
        return;
      }
      
      // Reinit on any config changes when not running
      if (configChanged && client.isReady() && !isRunning) {
        const oldConfig = lastConfigRef.current;
        const newConfig = simConfig;
        
        // Check for significant changes
        const tribeCountChanged = (oldConfig?.tribes?.length || 0) !== (newConfig?.tribes?.length || 0);
        const worldSizeChanged = oldConfig?.world?.width !== newConfig?.world?.width || 
                                oldConfig?.world?.height !== newConfig?.world?.height;
        const foodSettingsChanged = oldConfig?.world?.foodGrid?.regen !== newConfig?.world?.foodGrid?.regen ||
                                   oldConfig?.world?.foodGrid?.capacity !== newConfig?.world?.foodGrid?.capacity ||
                                   oldConfig?.world?.foodGrid?.cols !== newConfig?.world?.foodGrid?.cols ||
                                   oldConfig?.world?.foodGrid?.rows !== newConfig?.world?.foodGrid?.rows ||
                                   JSON.stringify(oldConfig?.world?.foodGrid?.distribution) !== JSON.stringify(newConfig?.world?.foodGrid?.distribution);
        
        // Check for energy changes
        const energyChanged = oldConfig?.energy?.start !== newConfig?.energy?.start ||
                             oldConfig?.energy?.max !== newConfig?.energy?.max ||
                             oldConfig?.energy?.repro !== newConfig?.energy?.repro;
        
        // Check for population changes (individual tribe counts or total population)
        const oldTotalPop = oldConfig?.tribes?.reduce((sum: number, tribe: any) => sum + (tribe.count || 0), 0) || 0;
        const newTotalPop = newConfig?.tribes?.reduce((sum: number, tribe: any) => sum + (tribe.count || 0), 0) || 0;
        const populationChanged = oldTotalPop !== newTotalPop;
        
        // Check if individual tribe population targets changed
        const tribePopulationChanged = oldConfig?.tribes?.some((oldTribe: any, index: number) => 
          oldTribe.count !== newConfig?.tribes?.[index]?.count) || false;
        
        // Check for tribe-level changes (spawn patterns, gene changes, names, etc.)
        const tribePropertiesChanged = oldConfig?.tribes?.some((oldTribe: any, index: number) => {
          const newTribe = newConfig?.tribes?.[index];
          if (!newTribe) return true; // Tribe removed
          
          // Check tribe name changes
          if (oldTribe.name !== newTribe.name) return true;
          
          // Check spawn pattern changes
          if (oldTribe.spawn?.pattern !== newTribe.spawn?.pattern) return true;
          if (oldTribe.spawn?.x !== newTribe.spawn?.x || oldTribe.spawn?.y !== newTribe.spawn?.y) return true;
          if (oldTribe.spawn?.radius !== newTribe.spawn?.radius) return true;
          
          // Check major gene changes (metabolism, aggression, diet - things that affect behavior significantly)
          const oldGenes = oldTribe.genes || {};
          const newGenes = newTribe.genes || {};
          const significantGenes = ['metabolism', 'aggression', 'diet', 'speed', 'vision', 'reproChance'];
          if (significantGenes.some(gene => Math.abs((oldGenes[gene] || 0) - (newGenes[gene] || 0)) > 0.01)) {
            return true;
          }
          
          return false;
        }) || false;
        
        // Debug: Log what we're comparing
        if (configChanged) {
          console.log('[App] Config comparison details:', {
            tribeCountChanged,
            worldSizeChanged,
            foodSettingsChanged,
            energyChanged,
            populationChanged,
            tribePopulationChanged,
            tribePropertiesChanged,
            oldTotalPop,
            newTotalPop,
            energy: {
              old: oldConfig?.energy,
              new: newConfig?.energy
            },
            tribesCount: {
              old: oldConfig?.tribes?.length || 0,
              new: newConfig?.tribes?.length || 0
            }
          });
        }
        
        const significantChange = tribeCountChanged || worldSizeChanged || foodSettingsChanged || 
                                 populationChanged || tribePopulationChanged || tribePropertiesChanged ||
                                 energyChanged;
        
        if (significantChange) {
          console.log('[App] Significant config change detected - reinitializing...', {
            tribeCountChanged,
            worldSizeChanged, 
            foodSettingsChanged,
            energyChanged,
            populationChanged,
            tribePopulationChanged,
            tribePropertiesChanged
          });
          client.reinit(simConfig).then(() => {
            setClientReady(true);
            console.log('[App] Reinit complete');
            // Trigger config update for renderer
            window.dispatchEvent(new CustomEvent('simConfigUpdate'));
          });
        }
        
        lastConfigRef.current = simConfig;
      }
    };
    
    if (simConfig) {
      initClient();
    }
  }, [simConfig, isRunning, client]);

  const handleStart = () => {
    console.log('[App] ===== STARTING SIMULATION =====');
    console.log('[App] Current tribes in config:', simConfig?.tribes?.map((t: any) => ({
      name: t.name,
      count: t.count,
      spawn: { x: t.spawn?.x, y: t.spawn?.y, radius: t.spawn?.radius }
    })));
    console.log('[App] Client ready:', clientReady, 'Initialized:', initialized.current);
    console.log('[App] ================================');
    
    setIsRunning(true);
    setShowSetup(false);
    setGameOver(null);
    setSimRestartKey(prev => prev + 1); // Force re-render of food/entity layers
    
    console.log('[App] About to unpause simulation...');
    client.pause(false); // Unpause the simulation
    console.log('[App] Simulation unpaused');
  };
  
  const handleRestart = async () => {
    // Reset with same seed and config
    setGameOver(null);
    setIsRunning(false);
    setSimRestartKey(prev => prev + 1); // Force re-render of food/entity layers
    
    // Re-initialize with the same config (force reinit)
    if (simConfig && client) {
      console.log('[App] Restarting with same config and seed');
      await client.init(simConfig, true); // force=true to reinitialize
      setIsRunning(true);
      client.pause(false); // Start immediately
    }
  };
  
  const handleNewSimulation = () => {
    // Return to setup screen for new configuration
    setGameOver(null);
    setShowSetup(true);
    setIsRunning(false);
    client.pause(true); // Pause the simulation
  };
  
  const handleModeChange = (newMode: SimMode) => {
    if (newMode === simMode) return;
    
    console.log('[App] Changing mode from', simMode, 'to', newMode);
    
    // Stop current simulation if running
    if (isRunning) {
      setIsRunning(false);
      client.setPaused(true);
    }
    
    // Terminate old client and create new client with new mode
    client.terminate();
    console.log('[App] Creating new client with mode:', newMode);
    clientRef.current = createSimClient({ mode: newMode });
    setSimMode(newMode);
    
    // Reset initialization flag and re-initialize if we have config
    initialized.current = false;
    setClientReady(false);
    setShowSetup(true); // Show setup again to allow configuration
    
    if (simConfig) {
      console.log('[App] Re-initializing with existing config');
      clientRef.current.init(simConfig, true).then(() => { // force=true
        setClientReady(true);
        initialized.current = true;
      });
    }
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
  // Note: Fullscreen handling and keyboard shortcuts (F for fullscreen, H for hide UI) are now handled in Controls.tsx via UIStore
  
  // Trigger resize event when UI visibility changes
  useEffect(() => {
    // Dispatch resize event to update canvas dimensions
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50); // Small delay to ensure DOM has updated
  }, [controlsHidden]);
  
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
      display: controlsHidden ? 'block' : 'grid',
      gridTemplateColumns: controlsHidden ? '1fr' : 
        biomeMode !== 'hidden' ? 
          (biomeLegendCollapsed ? '1fr 40px 420px' : '1fr 260px 420px') : 
          '1fr 420px',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      transition: 'grid-template-columns 0.3s ease',
      // background: '#0a0a0a',
    }}>
      {!controlsHidden && <COIStatus />}
      <div style={{ position: 'relative' }}>
        {renderMode === '2D' ? (
          <>
            <Scene2D 
              client={client} 
              world={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
              entitySize={entitySize}
              seed={currentSeed}
              showFood={showFood}
              showBoundaries={showBoundaries}
              biomeMode={biomeMode}
              simRestartKey={simRestartKey}
            />
          </>
        ) : renderMode === '3D' ? (
          <Scene3D
            client={client} 
            world={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
            entitySize={entitySize}
            seed={currentSeed}
            showFood={showFood}
            biomeMode={biomeMode}
          />
        ) : (
          <Scene3DPlanetCanvas
            client={client} 
            world={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }}
            entitySize={entitySize}
            seed={currentSeed}
            showFood={showFood}
            biomeMode={biomeMode}
          />
        )}
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
            entitySize={entitySize}
            onEntitySizeChange={setEntitySize}
            renderMode={renderMode}
            onRenderModeChange={setRenderMode}
            showFood={showFood}
            onShowFoodChange={setShowFood}
            showBoundaries={showBoundaries}
            onShowBoundariesChange={setShowBoundaries}
            biomeMode={biomeMode}
            onBiomeModeChange={setBiomeMode}
          />
        </div>
      </div>
      
      {biomeMode !== 'hidden' && !controlsHidden && (
        <BiomeLegend 
          biomeMode={biomeMode} 
          collapsed={biomeLegendCollapsed}
          onToggleCollapse={() => {
            setBiomeLegendCollapsed(!biomeLegendCollapsed);
            // Trigger resize event to update canvas dimensions
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 350); // After transition completes (300ms + buffer)
          }}
          position="right"
        />
      )}
      
      {!controlsHidden && (
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
            simMode={simMode}
            onModeChange={handleModeChange}
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
      )}
      
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