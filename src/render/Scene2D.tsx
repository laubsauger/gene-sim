import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Stats } from '@react-three/drei';
import { EntityPoints } from './EntityPoints';
import type { SimClient } from '../client/setupSimClient';

function EntitiesLayer({ client }: { client: SimClient }) {
  const { buffers } = client;
  const [ready, setReady] = useState(false);

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
  const padding = 600; // Even more padding to ensure all borders are visible
  const viewWidth = world.width + padding * 2;
  const viewHeight = world.height + padding * 2;
  
  // Calculate zoom to fit the entire world in the viewport
  // Account for the sidebar taking up space (320px from the grid layout)
  const availableWidth = window.innerWidth - 320;
  const availableHeight = window.innerHeight;
  const zoom = Math.min(availableWidth / viewWidth, availableHeight / viewHeight) * 0.75; // 0.75 for extra padding
  
  // Center the camera on the world
  const centerX = world.width / 2;
  const centerY = world.height / 2;
  
  return (
    <Canvas
      style={{ background: '#0a0a0a' }}
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
      <ambientLight intensity={1} />
      
      {/* World boundary */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              // Bottom border
              0, 0, 0,
              world.width, 0, 0,
              // Right border
              world.width, 0, 0,
              world.width, world.height, 0,
              // Top border
              world.width, world.height, 0,
              0, world.height, 0,
              // Left border
              0, world.height, 0,
              0, 0, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#444" />
      </lineSegments>
      
      {/* Grid lines for reference */}
      <group>
        {Array.from({ length: 5 }, (_, i) => {
          const x = (i + 1) * (world.width / 5);
          const y = (i + 1) * (world.height / 5);
          return (
            <group key={i}>
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array([x, 0, 0, x, world.height, 0]), 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#222" />
              </line>
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    args={[new Float32Array([0, y, 0, world.width, y, 0]), 3]}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#222" />
              </line>
            </group>
          );
        })}
      </group>
      
      <EntitiesLayer client={client} />
    </Canvas>
  );
}