import { useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Stats } from '@react-three/drei';
import { EntityPoints } from './EntityPoints';
import { FoodTexture } from './FoodTexture';
import { BiomeLayer } from './BiomeLayer';
import { BoundaryOverlay } from './BoundaryOverlay';
import { BiomeGenerator } from '../sim/biomes';
import type { SimClient } from '../client/setupSimClientHybrid';

// FPS tracking component
function FPSTracker({ client }: { client: SimClient }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 250) { // Update 4 times per second
      const fps = Math.round((frameCount.current * 1000) / delta);
      // Send render FPS to worker
      client.sendRenderFps(fps);
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

function FoodLayer({ client, world }: { client: SimClient; world: { width: number; height: number } }) {
  const { buffers } = client;
  const [ready, setReady] = useState(() => !!buffers?.food); // Initialize based on current buffer state
  const lastValidFoodBuffers = useRef<any>(buffers?.food ? buffers : null);
  
  useEffect(() => {
    // Always update when buffers change
    if (buffers?.food) {
      console.log('[FoodLayer] Food buffer available, setting ready');
      lastValidFoodBuffers.current = buffers; // Store valid food buffers
      setReady(true);
    }
  }, [buffers]);
  
  useEffect(() => {
    // Listen for ready message
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'ready' && msg.payload.sab.food) {
        console.log('[FoodLayer] Received ready message with food buffer');
        const { buffers: currentBuffers } = client;
        lastValidFoodBuffers.current = currentBuffers; // Store valid food buffers
        setReady(true);
      }
    });

    return unsubscribe;
  }, [client]);
  
  // Force re-render on config updates
  useEffect(() => {
    const handleConfigUpdate = () => {
      console.log('[FoodLayer] Config update detected, forcing re-render');
      // Force refresh by checking buffers again
      if (buffers?.food) {
        lastValidFoodBuffers.current = buffers;
        setReady(true);
      }
    };

    window.addEventListener('simConfigUpdate', handleConfigUpdate);
    return () => {
      window.removeEventListener('simConfigUpdate', handleConfigUpdate);
    };
  }, [buffers]);
  
  // Use current buffers if available, otherwise use last valid buffers during transition
  const activeFoodBuffers = (buffers?.food) ? buffers : lastValidFoodBuffers.current;
  
  if (!ready || !activeFoodBuffers?.food || !activeFoodBuffers?.foodCols || !activeFoodBuffers?.foodRows) {
    console.log('[FoodLayer] Not rendering:', { ready, hasFood: !!activeFoodBuffers?.food, hasCols: !!activeFoodBuffers?.foodCols, hasRows: !!activeFoodBuffers?.foodRows });
    return null;
  }
  
  return (
    <FoodTexture
      foodData={activeFoodBuffers.food}
      cols={activeFoodBuffers.foodCols}
      rows={activeFoodBuffers.foodRows}
      world={world}
    />
  );
}

function EntitiesLayer({ client, entitySize }: { client: SimClient; entitySize: number }) {
  const { buffers } = client;
  const [ready, setReady] = useState(false);
  const [renderSize, setRenderSize] = useState(() => {
    console.log('[EntitiesLayer] Initial render size from props:', entitySize);
    return entitySize;
  });
  const lastValidBuffers = useRef<any>(null);

  // Update render size when entitySize prop changes
  useEffect(() => {
    console.log('[EntitiesLayer] Entity size prop changed to:', entitySize);
    setRenderSize(entitySize);
  }, [entitySize]);
  
  // Listen for render size changes from setup
  useEffect(() => {
    const handleSizeChange = (e: CustomEvent) => {
      setRenderSize(e.detail);
    };

    window.addEventListener('entityRenderSizeChange', handleSizeChange as EventListener);
    return () => {
      window.removeEventListener('entityRenderSizeChange', handleSizeChange as EventListener);
    };
  }, []);

  useEffect(() => {
    // Check if buffers exist immediately
    if (buffers?.pos && buffers?.color && buffers?.alive) {
      // console.log('[EntitiesLayer] Buffers already available, count:', buffers.count);
      lastValidBuffers.current = buffers; // Store valid buffers
      setReady(true);
      return;
    }
    
    // Listen for ready message
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'ready') {
        // console.log('[EntitiesLayer] Got ready message, checking buffers...');
        const { buffers: currentBuffers } = client;
        // console.log('[EntitiesLayer] Current buffers:', {
        //   hasPos: !!currentBuffers?.pos,
        //   hasColor: !!currentBuffers?.color,
        //   hasAlive: !!currentBuffers?.alive,
        //   count: currentBuffers?.count,
        //   posLength: currentBuffers?.pos?.length,
        //   aliveSum: currentBuffers?.alive?.reduce((sum, val) => sum + val, 0) // Count alive entities
        // });
        lastValidBuffers.current = currentBuffers; // Store valid buffers  
        setReady(true);
      }
    });
    
    // Fallback check after delay
    const timer = setTimeout(() => {
      const { buffers: currentBuffers } = client;
      if (currentBuffers?.pos) {
        setReady(true);
      }
    }, 100);
    
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [client, buffers]);
  
  // Use current buffers if available, otherwise use last valid buffers during transition
  const activeBuffers = (buffers?.pos && buffers?.color && buffers?.alive) ? buffers : lastValidBuffers.current;
  
  if (!ready || !activeBuffers?.pos || !activeBuffers?.color || !activeBuffers?.alive) {
    return null;
  }

  // Don't log on every render - too spammy
  return (
    <EntityPoints
      pos={activeBuffers.pos}
      color={activeBuffers.color}
      alive={activeBuffers.alive}
      age={activeBuffers.age}
      count={activeBuffers.count}
      pointSize={renderSize}
    />
  );
}

export interface Scene2DProps {
  client: SimClient;
  world: { width: number; height: number };
  entitySize: number;
  seed?: number;
  showFood?: boolean;
  showBoundaries?: boolean;
  biomeMode?: 'hidden' | 'natural' | 'highlight';
  simRestartKey?: number;
}

export function Scene2D({ client, world, entitySize, seed = 1234, showFood = true, showBoundaries = false, biomeMode = 'natural', simRestartKey = 0 }: Scene2DProps) {
  // Calculate camera settings to show the full world centered
  const viewWidth = world.width;
  const viewHeight = world.height;
  
  // Create biome generator - use the actual seed that changes with each simulation
  const biomeGenerator = useMemo(() => {
    console.log('[Scene2D] Creating biome generator with seed:', seed);
    return new BiomeGenerator(seed, world.width, world.height);
  }, [seed, world.width, world.height]);
  
  // Calculate zoom to fit the entire world in the viewport
  // Account for the sidebar taking up space (420px from the grid layout)
  const availableWidth = window.innerWidth - 420;
  const availableHeight = window.innerHeight;
  const zoom = Math.min(availableWidth / viewWidth, availableHeight / viewHeight) * 0.85; // Closer initial zoom
  
  // Center the camera on the world with slight vertical offset
  const centerX = world.width / 2;
  const centerY = world.height / 2 - 50; // Shift view down slightly for better vertical centering
  
  return (
    <Canvas
      style={{ background: '#0f0f0f' }}
    >
      <OrthographicCamera
        makeDefault
        position={[centerX, centerY, 100]}
        zoom={zoom}
        near={0.1}
        far={1000}
      />
      <OrbitControls 
        enableRotate={false}
        zoomSpeed={1.5}
        panSpeed={1.0}
        minZoom={zoom * 0.5}
        maxZoom={zoom * 20}
        target={[centerX, centerY, 0]}
        mouseButtons={{
          LEFT: 2,  // PAN with left mouse button
          MIDDLE: 1, // ZOOM with middle
          RIGHT: 0   // ROTATE with right (disabled anyway)
        }}
      />
      <Stats showPanel={0} className="stats-panel" />
      <FPSTracker client={client} />
      <ambientLight intensity={1} />
      
      {/* World background fill */}
      <mesh position={[world.width / 2, world.height / 2, -1]}>
        <planeGeometry args={[world.width, world.height]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      
      {/* Biome layer */}
      {biomeMode !== 'hidden' && (
        <BiomeLayer 
          biomeGenerator={biomeGenerator} 
          worldWidth={world.width} 
          worldHeight={world.height} 
          highlightMode={biomeMode === 'highlight'}
        />
      )}
      
      {/* Boundary visualization overlay */}
      {showBoundaries && (
        <BoundaryOverlay
          biomeGenerator={biomeGenerator}
          worldWidth={world.width}
          worldHeight={world.height}
        />
      )}

      {/* World boundary - separate lines for different thicknesses */}
      {/* Bottom border */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              0, 0, 0,
              world.width, 0, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666" linewidth={1} />
      </line>

      {/* Right border - thicker */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              world.width, 0, 0,
              world.width, world.height, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666" linewidth={1} />
      </line>

      {/* Top border - thicker */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              world.width, world.height, 0,
              0, world.height, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666" linewidth={1} />
      </line>

      {/* Left border */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              0, world.height, 0,
              0, 0, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#666" linewidth={1} />
      </line>
      
      {/* Grid lines for reference - memoized for performance */}
      {useMemo(() => (
        <group>
          {Array.from({ length: 9 }, (_, i) => {
            const x = (i + 1) * (world.width / 9);
            const y = (i + 1) * (world.height / 9);
            return (
              <group key={i}>
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([x, 0, 0, x, world.height, 0]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color="#444" />
                </line>
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      args={[new Float32Array([0, y, 0, world.width, y, 0]), 3]}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color="#444" />
                </line>
              </group>
            );
          })}
        </group>
      ), [world.width, world.height])}
      
      {showFood && <FoodLayer client={client} world={world} />}
      <EntitiesLayer key={`entities-${seed}-${simRestartKey}`} client={client} entitySize={entitySize} />
    </Canvas>
  );
}