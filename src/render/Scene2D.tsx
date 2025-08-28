import { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Stats } from '@react-three/drei';
import { EntityPoints } from './EntityPoints';
import type { SimClient } from '../client/setupSimClient';

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
      if (client.worker) {
        client.worker.postMessage({
          type: 'renderFps',
          payload: { fps }
        });
      }
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

function EntitiesLayer({ client }: { client: SimClient }) {
  const { buffers } = client;
  const [ready, setReady] = useState(false);
  const [updateKey, setUpdateKey] = useState(0);

  // Force re-render on config updates
  useEffect(() => {
    const handleConfigUpdate = () => {
      setUpdateKey(prev => prev + 1);
    };

    window.addEventListener('simConfigUpdate', handleConfigUpdate);
    return () => {
      window.removeEventListener('simConfigUpdate', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    // Check if buffers exist immediately
    if (buffers?.pos && buffers?.color && buffers?.alive) {
      setReady(true);
      return;
    }
    
    // Listen for ready message
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'ready') {
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
  
  if (!ready || !buffers?.pos || !buffers?.color || !buffers?.alive) {
    return null;
  }

  return (
    <EntityPoints
      key={updateKey}
      pos={buffers.pos}
      color={buffers.color}
      alive={buffers.alive}
      count={buffers.count}
      pointSize={10}
    />
  );
}

export interface Scene2DProps {
  client: SimClient;
  world: { width: number; height: number };
}

export function Scene2D({ client, world }: Scene2DProps) {
  // Calculate camera settings to show the full world centered
  const padding = 200; // Padding to ensure all borders are visible
  const viewWidth = world.width + padding * 2;
  const viewHeight = world.height + padding * 2;
  
  // Calculate zoom to fit the entire world in the viewport
  // Account for the sidebar taking up space (320px from the grid layout)
  const availableWidth = window.innerWidth - 320;
  const availableHeight = window.innerHeight;
  const zoom = Math.min(availableWidth / viewWidth, availableHeight / viewHeight) * 0.9; // Increased to 0.9 for better fit
  
  // Center the camera on the world
  const centerX = world.width / 2;
  const centerY = world.height / 2;
  
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
      
      {/* Grid lines for reference */}
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
      
      <EntitiesLayer client={client} />
    </Canvas>
  );
}