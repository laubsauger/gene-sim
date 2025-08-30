import { useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { EntityPoints3D } from './EntityPoints3D';
import { PlanetSphere } from './PlanetSphere';
import { Starfield } from './Starfield';
import { Sun, Moon } from './CelestialBodies';
import { CloudSystemProcedural } from './CloudLayerProcedural';
import { DebugArrows } from './DebugArrows';
import type { SimClient } from '../client/setupSimClientHybrid';

const PLANET_RADIUS = 500;
const AXIAL_TILT = 23.5 * Math.PI / 180; // Earth's axial tilt

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
function Atmosphere({ radius, staticSunPosition }: { radius: number; staticSunPosition: THREE.Vector3 }) {
  const atmosphereRadius = radius * 1.15; // Larger for better coverage
  
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
      // Calculate view and sun directions
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);
      vec3 sunDir = normalize(sunPosition);
      vec3 sphereNormal = normalize(vWorldPosition);
      
      // Sun angle determines day/night
      float sunDot = dot(sphereNormal, sunDir);
      
      // Atmosphere thickness - thicker at edges when viewed from outside
      float viewDot = dot(viewDirection, normal);
      float limb = 1.0 - abs(viewDot);
      float atmosphereThickness = pow(limb, 0.8);
      
      // Color gradient based on sun position
      vec3 color;
      float intensity;
      
      if (sunDot > 0.1) {
        // Day side
        float dayStrength = smoothstep(0.1, 0.4, sunDot);
        color = mix(vec3(0.4, 0.65, 1.0), vec3(0.3, 0.6, 1.0), dayStrength);
        intensity = 0.6 + dayStrength * 0.1;
      } else if (sunDot > -0.1) {
        // Terminator zone - smooth transition
        float t = (sunDot + 0.1) / 0.2;
        vec3 sunsetColor = vec3(1.0, 0.5, 0.15);
        vec3 dayColor = vec3(0.4, 0.65, 1.0);
        vec3 twilightColor = vec3(0.7, 0.25, 0.1);
        
        if (t > 0.5) {
          color = mix(sunsetColor, dayColor, (t - 0.5) * 2.0);
        } else {
          color = mix(twilightColor, sunsetColor, t * 2.0);
        }
        
        intensity = 0.5 + t * 0.2;
        
        // Terminator glow
        float terminatorGlow = exp(-20.0 * abs(sunDot));
        color = mix(color, vec3(1.0, 0.7, 0.3), terminatorGlow * 0.4);
        intensity *= (1.0 + terminatorGlow * 0.5);
      } else {
        // Night side
        float nightDepth = smoothstep(-0.1, -0.4, sunDot);
        color = mix(vec3(0.1, 0.15, 0.3), vec3(0.01, 0.02, 0.05), nightDepth);
        intensity = 0.25 - nightDepth * 0.2;
      }
      
      // Apply atmosphere thickness and intensity
      float alpha = atmosphereThickness * intensity;
      
      // Smooth the edges without creating bands
      alpha *= 0.35;
      
      // Very minimal cutoff to avoid artifacts
      if (alpha < 0.005) discard;
      
      gl_FragColor = vec4(color, alpha);
    }
  `;
  
  return (
    <mesh scale={[1, 1, 1]} renderOrder={100}>
      <sphereGeometry args={[atmosphereRadius, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          sunPosition: { value: staticSunPosition }
        }}
        transparent
        side={THREE.DoubleSide}  // Render both sides
        depthWrite={false}
        depthTest={false}  // Disable to prevent planet occlusion
        blending={THREE.AdditiveBlending}  // Better for atmosphere glow
      />
    </mesh>
  );
}

function EntitiesLayer3D({ 
  client, 
  entitySize,
  worldWidth,
  worldHeight,
  staticSunPosition
}: { 
  client: SimClient; 
  entitySize: number;
  worldWidth: number;
  worldHeight: number;
  staticSunPosition: THREE.Vector3;
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
      sunRotation={0}  // Static sun, no rotation needed
    />
  );
}

// Planet and moon system - rotates together
function PlanetSystem({ planetRadius, isPaused, children }: { 
  planetRadius: number;
  isPaused: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tiltedGroupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const moonOrbitRadius = planetRadius * 2;
  
  useFrame((state, delta) => {
    if (tiltedGroupRef.current) {
      // Rotate planet around its tilted axis (always rotate, even when paused for now)
      rotationRef.current += delta * 0.1; // Day/night cycle speed
      tiltedGroupRef.current.rotation.y = rotationRef.current;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Apply axial tilt first */}
      <group rotation={[0, 0, AXIAL_TILT]}>
        {/* Then rotate around the tilted Y axis */}
        <group ref={tiltedGroupRef}>
          {children}
        </group>
        
        {/* Moon orbits around the tilted axis */}
        <Moon 
          planetRadius={planetRadius} 
          orbitRadius={moonOrbitRadius}
          orbitSpeed={0.2}
        />
      </group>
    </group>
  );
}

export interface Scene3DProps {
  client: SimClient;
  world: { width: number; height: number };
  entitySize: number;
}

export function Scene3D({ client, world, entitySize }: Scene3DProps) {
  const controlsRef = useRef<any>(null);
  const [isPaused, setIsPaused] = useState(true);
  
  // Static sun position
  const staticSunPosition = useMemo(() => {
    const sunDistance = PLANET_RADIUS * 8;
    return new THREE.Vector3(sunDistance, PLANET_RADIUS * 2, sunDistance * 0.5);
  }, []);
  
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
      
      {/* Minimal ambient to prevent pure black shadows */}
      <ambientLight intensity={0.01} />
      
      {/* Very subtle hemisphere light for slight color variation */}
      <hemisphereLight
        color="#4a6fa5"
        groundColor="#0a0502"
        intensity={0.02}
      />
      
      {/* Static sun at fixed position */}
      <group position={staticSunPosition.toArray()}>
        <Sun position={[0, 0, 0]} />
      </group>
      
      {/* Main directional light from static sun */}
      <directionalLight
        position={staticSunPosition.toArray()}
        intensity={2.0}
        color="#fff5e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-1500}
        shadow-camera-right={1500}
        shadow-camera-top={1500}
        shadow-camera-bottom={-1500}
        shadow-camera-near={1}
        shadow-camera-far={10000}
        target-position={[0, 0, 0]}
      />
      
      {/* Rotating planet system */}
      <PlanetSystem planetRadius={PLANET_RADIUS} isPaused={isPaused}>
        {/* Planet base */}
        <PlanetSphere
          radius={PLANET_RADIUS}
          worldWidth={world.width}
          worldHeight={world.height}
        />
        
        {/* Entities on surface */}
        <EntitiesLayer3D
          client={client}
          entitySize={entitySize}
          worldWidth={world.width}
          worldHeight={world.height}
          staticSunPosition={staticSunPosition}
        />
        
        {/* Cloud layers above entities */}
        <CloudSystemProcedural
          planetRadius={PLANET_RADIUS}
          sunRotation={0}  // Static sun
        />
      </PlanetSystem>
      
      {/* Atmosphere - outside rotating group, stays aligned with sun */}
      <Atmosphere
        radius={PLANET_RADIUS}
        staticSunPosition={staticSunPosition}
      />

      {/* Static starfield background - doesn't rotate with camera */}
      <group>
        <Starfield count={12000} radius={15000} />
      </group>

      {/* Debug visualization - disabled for now */}
      {/* <DebugArrows
        planetRadius={PLANET_RADIUS}
        sunRotation={0}  // Static sun
        staticSunPosition={staticSunPosition}
      /> */}
    </Canvas>
  );
}