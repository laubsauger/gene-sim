import { useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { EntityPoints3D } from './EntityPoints3D';
import { PlanetSphere } from './PlanetSphere';
import { Starfield } from './Starfield';
import { Sun, Moon, OrbitLine } from './CelestialBodies';
import { CloudSystem } from './CloudLayer';
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

// Atmosphere effect component that aligns with sun
function Atmosphere({ radius, sunRotation }: { radius: number; sunRotation: number }) {
  const atmosphereRadius = radius * 1.12; // Slightly smaller to avoid dark edges
  const meshRef = useRef<THREE.Mesh>(null);
  
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
    uniform vec3 sunDirection;
    uniform float sunRotation;
    
    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);
      
      // Calculate sun direction based on rotation angle
      float angle = sunRotation;
      vec3 dynamicSunDir = vec3(
        cos(angle),
        0.3,
        sin(angle)
      );
      dynamicSunDir = normalize(dynamicSunDir);
      
      // Sun angle relative to this point on the atmosphere
      float sunDot = dot(normal, dynamicSunDir);
      
      // View angle (for limb darkening/brightening)
      float viewDot = dot(viewDirection, normal);
      float limb = 1.0 - abs(viewDot);
      
      // Atmosphere thickness based on viewing angle
      float atmosphereThickness = pow(limb, 0.5);
      
      // Natural gradient progression based on sun angle
      // sunDot: 1 = direct sun, 0 = terminator, -1 = opposite side
      
      // Define color zones with smooth transitions
      vec3 dayBlue = vec3(0.3, 0.6, 1.0);           // Clear blue sky
      vec3 sunsetOrange = vec3(1.0, 0.6, 0.2);      // Orange sunset
      vec3 sunriseRed = vec3(0.8, 0.3, 0.15);       // Deep red sunrise
      vec3 duskBlue = vec3(0.15, 0.2, 0.4);         // Dusky blue
      vec3 nightDark = vec3(0.02, 0.03, 0.08);      // Near darkness
      
      vec3 atmosphereColor = vec3(0.0);
      float alpha = atmosphereThickness;
      
      if (sunDot > 0.3) {
        // Full daylight - clear blue
        atmosphereColor = dayBlue;
        alpha *= 0.8;
      }
      else if (sunDot > 0.0) {
        // Approaching sunset - blue to orange gradient
        float t = (0.3 - sunDot) / 0.3;  // 0 at day, 1 at terminator
        atmosphereColor = mix(dayBlue, sunsetOrange, smoothstep(0.0, 1.0, t));
        alpha *= 0.7 + 0.3 * t;  // Slightly stronger at terminator
      }
      else if (sunDot > -0.1) {
        // Sunset/sunrise band - orange to red
        float t = -sunDot / 0.1;  // 0 at terminator, 1 at -0.1
        atmosphereColor = mix(sunsetOrange, sunriseRed, smoothstep(0.0, 1.0, t));
        alpha *= 0.8 + 0.2 * limb;  // Enhance at limb for glow effect
      }
      else if (sunDot > -0.3) {
        // Red to dusky blue transition
        float t = (-0.1 - sunDot) / 0.2;  // 0 at -0.1, 1 at -0.3
        atmosphereColor = mix(sunriseRed, duskBlue, smoothstep(0.0, 1.0, t));
        alpha *= 0.5 * (1.0 - t * 0.5);
      }
      else if (sunDot > -0.6) {
        // Dusky blue to night transition
        float t = (-0.3 - sunDot) / 0.3;  // 0 at -0.3, 1 at -0.6
        atmosphereColor = mix(duskBlue, nightDark, smoothstep(0.0, 1.0, t));
        alpha *= 0.25 * (1.0 - t * 0.5);
      }
      else {
        // Full night - almost darkness
        atmosphereColor = nightDark;
        alpha *= 0.1;
      }
      
      // Extra glow at the terminator band specifically at the limb
      float terminatorGlow = 1.0 - smoothstep(-0.1, 0.1, abs(sunDot));
      terminatorGlow *= limb * limb;  // Only visible at limb
      atmosphereColor = mix(atmosphereColor, sunsetOrange * 1.5, terminatorGlow * 0.3);
      alpha += terminatorGlow * 0.2;
      
      // Fade at extreme viewing angles
      alpha *= 1.0 - smoothstep(0.85, 1.0, limb);
      
      // Overall opacity control
      alpha *= 0.35;
      
      gl_FragColor = vec4(atmosphereColor, alpha);
    }
  `;
  
  return (
    <mesh ref={meshRef} scale={[1, 1, 1]}>
      <sphereGeometry args={[atmosphereRadius, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          sunDirection: { value: new THREE.Vector3(1, 0.3, 0.5).normalize() },
          sunRotation: { value: sunRotation }
        }}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={true}  // Enable depth test for moon occlusion
        blending={THREE.AdditiveBlending}  // Additive for smooth glow
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
      
      {/* Planet base */}
      <PlanetSphere
        radius={PLANET_RADIUS}
        worldWidth={world.width}
        worldHeight={world.height}
      />
      
      {/* Atmosphere (render order 1 - after planet, before moon) */}
      <Atmosphere 
        radius={PLANET_RADIUS} 
        sunRotation={sunRotation}
      />
      
      {/* Entities - render on planet surface */}
      <EntitiesLayer3D
        client={client}
        entitySize={entitySize}
        worldWidth={world.width}
        worldHeight={world.height}
      />
      
      {/* Cloud layers - after entities */}
      <CloudSystem planetRadius={PLANET_RADIUS} />
      
      {/* Solar system with sun and moon - render last so moon is in front */}
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