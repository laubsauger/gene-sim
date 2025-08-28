import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, MapControls } from '@react-three/drei';
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
  // Calculate camera settings - start zoomed in to bottom-left corner
  const padding = 100; // Small padding to see borders
  const viewWidth = world.width + padding * 2;
  const viewHeight = world.height + padding * 2;
  // Start zoomed in more - show about 1/3 of the world initially
  const zoom = Math.min(window.innerWidth / viewWidth, window.innerHeight / viewHeight) * 2.5;
  
  return (
    <Canvas
      style={{ background: '#0a0a0a' }}
    >
      <OrthographicCamera
        makeDefault
        position={[world.width * 0.3, world.height * 0.3, 100]}
        zoom={zoom}
        near={0.1}
        far={1000}
      />
      <MapControls 
        enableRotate={false}
        zoomSpeed={1.5}
        panSpeed={1.0}
        minZoom={zoom * 0.3}
        maxZoom={zoom * 10}
        target={[world.width * 0.3, world.height * 0.3, 0]}
      />
      <ambientLight intensity={1} />
      
      {/* World boundary */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              0, 0, 0,
              world.width, 0, 0,
              world.width, world.height, 0,
              0, world.height, 0,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#444" linewidth={2} />
      </lineLoop>
      
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