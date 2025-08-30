import { useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { EntityPoints3D } from './EntityPoints3D';
import { PlanetSphere } from './PlanetSphere';
import { Starfield } from './Starfield';
import { Sun, Moon, OrbitLine } from './CelestialBodies';
import { CloudSystemShell } from './CloudLayerShell';
import type { SimClient } from '../client/setupSimClientHybrid';

const PLANET_RADIUS = 500;

// FPS tracking component (reused from Scene2D)
function FPSTracker({ client }: { client: SimClient }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 250) { // Update 4 times per second
      const fps = Math.round((frameCount.current * 1000) / delta);
      client.sendRenderFps(fps);
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

// Atmosphere effect component  
function Atmosphere({ radius, sunRotation }: { radius: number; sunRotation: number }) {
  const atmosphereRadius = radius * 1.15; // Larger for better coverage
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Calculate sun position in world space matching the actual sun position
  const sunPosition = useMemo(() => {
    const sunDistance = radius * 8;
    return new THREE.Vector3(
      Math.cos(sunRotation) * sunDistance,
      radius * 2,
      Math.sin(sunRotation) * sunDistance * 0.5
    );
  }, [sunRotation, radius]);
  
  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldPosition;
    uniform vec3 sunPosition;
    
    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);
      
      // Calculate sun direction from planet center to sun
      vec3 sunDir = normalize(sunPosition);
      
      // How much this point faces the sun
      float sunDot = dot(normal, sunDir);
      
      // View angle for limb effects
      float viewDot = dot(viewDirection, normal);
      float limb = 1.0 - abs(viewDot);
      float atmosphereThickness = pow(limb, 0.6);
      
      // Color palette
      vec3 dayBlue = vec3(0.3, 0.6, 1.0);
      vec3 sunsetOrange = vec3(1.0, 0.5, 0.15);
      vec3 twilightRed = vec3(0.7, 0.25, 0.1);
      vec3 duskBlue = vec3(0.1, 0.15, 0.3);
      vec3 nightDark = vec3(0.01, 0.02, 0.05);
      
      // Continuous gradient based on sun angle
      vec3 color;
      float intensity;
      
      if (sunDot > 0.5) {
        // Day side
        color = dayBlue;
        intensity = 0.7;
      } else if (sunDot > 0.0) {
        // Approaching sunset
        float t = 1.0 - (sunDot * 2.0); // 0 at 0.5, 1 at 0
        color = mix(dayBlue, sunsetOrange, t);
        intensity = 0.6 + t * 0.2;
      } else if (sunDot > -0.2) {
        // Sunset/twilight band
        float t = -sunDot * 5.0; // 0 at 0, 1 at -0.2
        color = mix(sunsetOrange, twilightRed, t);
        intensity = 0.8 - t * 0.3;
      } else if (sunDot > -0.5) {
        // Twilight to dusk
        float t = (-0.2 - sunDot) / 0.3; // 0 at -0.2, 1 at -0.5
        color = mix(twilightRed, duskBlue, t);
        intensity = 0.5 - t * 0.3;
      } else {
        // Night side
        float t = min(1.0, (-0.5 - sunDot) * 2.0);
        color = mix(duskBlue, nightDark, t);
        intensity = 0.2 - t * 0.15;
      }
      
      // Add terminator glow
      float terminator = exp(-15.0 * abs(sunDot)) * limb * limb;
      color = mix(color, sunsetOrange, terminator * 0.3);
      
      float alpha = atmosphereThickness * intensity;
      
      // Fade at extreme viewing angles
      alpha *= 1.0 - smoothstep(0.85, 1.0, limb);
      
      // Overall opacity control
      alpha *= 0.35;
      
      gl_FragColor = vec4(color, alpha);
    }
  `;
  
  // Update sun position uniform every frame
  useFrame(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms.sunPosition) {
        const sunDistance = radius * 8;
        material.uniforms.sunPosition.value.set(
          Math.cos(sunRotation) * sunDistance,
          radius * 2,
          Math.sin(sunRotation) * sunDistance * 0.5
        );
      }
    }
  });
  
  return (
    <mesh ref={meshRef} scale={[1, 1, 1]}>
      <sphereGeometry args={[atmosphereRadius, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          sunPosition: { value: sunPosition }
        }}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={true}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function EntitiesLayer3D({ 
  client, 
  entitySize,
  worldWidth,
  worldHeight 
}: { 
  client: SimClient; 
  entitySize: number;
  worldWidth: number;
  worldHeight: number;
}) {
  const { buffers } = client;
  const [ready, setReady] = useState(false);
  const lastValidBuffers = useRef<any>(null);

  useEffect(() => {
    // Check if buffers exist immediately
    if (buffers?.pos && buffers?.color && buffers?.alive) {
      lastValidBuffers.current = buffers;
      setReady(true);
      return;
    }
    
    // Listen for ready message
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'ready') {
        const { buffers: currentBuffers } = client;
        lastValidBuffers.current = currentBuffers;
        setReady(true);
      }
    });
    
    return unsubscribe;
  }, [client, buffers]);
  
  const activeBuffers = (buffers?.pos && buffers?.color && buffers?.alive) ? buffers : lastValidBuffers.current;
  
  if (!ready || !activeBuffers?.pos || !activeBuffers?.color || !activeBuffers?.alive) {
    return null;
  }

  return (
    <EntityPoints3D
      pos={activeBuffers.pos}
      color={activeBuffers.color}
      alive={activeBuffers.alive}
      age={activeBuffers.age}
      count={activeBuffers.count}
      pointSize={entitySize * 2} // Slightly larger for 3D visibility
      worldWidth={worldWidth}
      worldHeight={worldHeight}
      planetRadius={PLANET_RADIUS}
    />
  );
}

export interface Scene3DProps {
  client: SimClient;
  world: { width: number; height: number };
  entitySize: number;
}

// Solar system component to handle celestial body rotations
function SolarSystem({ planetRadius, onRotationUpdate, isPaused }: { 
  planetRadius: number;
  onRotationUpdate?: (rotation: number) => void;
  isPaused: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Always rotate for development (ignore pause)
      rotationRef.current += delta * 0.05;
      groupRef.current.rotation.y = rotationRef.current;
    }
    
    // Update rotation for atmosphere
    if (onRotationUpdate) {
      onRotationUpdate(rotationRef.current);
    }
  });
  
  const sunDistance = planetRadius * 8;
  const moonOrbitRadius = planetRadius * 2;
  
  return (
    <group ref={groupRef}>
      {/* Sun */}
      <Sun position={[sunDistance, planetRadius * 2, sunDistance * 0.5]} />
      
      {/* Moon with orbit */}
      <Moon 
        planetRadius={planetRadius} 
        orbitRadius={moonOrbitRadius}
        orbitSpeed={0.2}
      />
      
      {/* Moon orbit line */}
      <OrbitLine radius={moonOrbitRadius} color="#4a5568" opacity={0.1} />
    </group>
  );
}

export function Scene3D({ client, world, entitySize }: Scene3DProps) {
  const controlsRef = useRef<any>(null);
  const [sunRotation, setSunRotation] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  
  // Listen for pause state from simulation
  useEffect(() => {
    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === 'pauseState') {
        setIsPaused(msg.payload.paused);
      }
    });
    return unsubscribe;
  }, [client]);
  
  // Set up initial camera position
  const initialCameraPosition: [number, number, number] = [
    PLANET_RADIUS * 2.5,
    PLANET_RADIUS * 0.5,
    PLANET_RADIUS * 2.5
  ];
  
  return (
    <Canvas
      style={{ background: '#000' }}
      shadows
      gl={{ 
        antialias: true,
        logarithmicDepthBuffer: true, // Helps with z-fighting
      }}
    >
      <PerspectiveCamera
        makeDefault
        position={initialCameraPosition}
        fov={60}
        near={1}
        far={10000}
      />
      
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={1.0}
        minDistance={PLANET_RADIUS * 1.2}
        maxDistance={PLANET_RADIUS * 5}
        target={[0, 0, 0]}
      />
      
      <Stats showPanel={0} className="stats-panel" />
      <FPSTracker client={client} />
      
      {/* Reduced ambient for more dramatic lighting */}
      <ambientLight intensity={0.1} />
      
      {/* Hemisphere light for subtle sky/ground color */}
      <hemisphereLight
        color="#4a6fa5"
        groundColor="#1a0f05"
        intensity={0.15}
      />
      
      {/* Render order 0: Planet base */}
      <group renderOrder={0}>
        <PlanetSphere
          radius={PLANET_RADIUS}
          worldWidth={world.width}
          worldHeight={world.height}
        />
      </group>
      
      {/* Render order 1: Entities on planet surface */}
      <group renderOrder={1}>
        <EntitiesLayer3D
          client={client}
          entitySize={entitySize}
          worldWidth={world.width}
          worldHeight={world.height}
        />
      </group>
      
      {/* Render order 2: Cloud layers */}
      <group renderOrder={2}>
        <CloudSystemShell planetRadius={PLANET_RADIUS} />
      </group>
      
      {/* Render order 3: Atmosphere */}
      <group renderOrder={3}>
        <Atmosphere 
          radius={PLANET_RADIUS} 
          sunRotation={sunRotation}
        />
      </group>
      
      {/* Solar system with sun and moon - no explicit render order, uses per-object settings */}
      <SolarSystem 
        planetRadius={PLANET_RADIUS} 
        onRotationUpdate={setSunRotation}
        isPaused={isPaused}
      />
      
      {/* High-resolution starfield */}
      <Starfield count={8000} radius={10000} />
    </Canvas>
  );
}