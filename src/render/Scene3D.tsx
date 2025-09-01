/**
 * @deprecated This is the old 3D renderer. Use Scene3DPlanetCanvas.tsx instead.
 * This file is kept for reference but should not be used for new features.
 * All new 3D rendering features should be implemented in Scene3DPlanetCanvas.tsx
 */

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
import { DevControls3D } from '../ui/DevControls3D';
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
  const atmosphereRadius = radius * 1.12; // Slightly closer to surface to reduce gap
  
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
      
      // Atmosphere thickness based on edge proximity
      float viewDot = dot(viewDirection, normal);
      float limb = 1.0 - abs(viewDot);
      float atmosphereThickness = pow(limb, 0.8) + 0.1;  // Add base to reach surface
      
      // Proper occlusion - don't render atmosphere on far side of planet
      vec3 cameraDir = normalize(cameraPosition);
      float cameraDot = dot(sphereNormal, cameraDir);
      
      // If we're looking at a point on far side of planet, discard
      if (cameraDot < 0.0) {
        // But only if it's also behind the planet surface
        float distToCamera = length(cameraPosition - vWorldPosition);
        float distToPlanetCenter = length(cameraPosition);
        if (distToCamera > distToPlanetCenter) discard;
      }
      
      // Smooth color gradient based on sun position
      vec3 color;
      float intensity;
      
      // Use a continuous function for smoother transitions
      float dayFactor = smoothstep(-0.3, 0.3, sunDot);
      float sunsetFactor = exp(-10.0 * abs(sunDot)) * 2.0;  // Peak at terminator
      float nightFactor = smoothstep(0.3, -0.3, sunDot);
      
      // Define colors
      vec3 dayColor = vec3(0.35, 0.6, 1.0);
      vec3 sunsetColor = vec3(1.0, 0.5, 0.15);
      vec3 twilightColor = vec3(0.3, 0.2, 0.4);
      vec3 nightColor = vec3(0.05, 0.08, 0.15);
      
      // Blend colors smoothly
      color = dayColor * dayFactor;
      color += sunsetColor * sunsetFactor * (1.0 - dayFactor * 0.5);
      color += twilightColor * nightFactor * (1.0 - sunsetFactor);
      color = mix(color, nightColor, nightFactor * 0.7);
      
      // Smooth intensity
      intensity = 0.2 + dayFactor * 0.5 + sunsetFactor * 0.2;
      
      // Ensure night side has minimum visibility
      intensity = max(intensity, 0.15);
      
      // Apply atmosphere thickness and intensity
      float alpha = atmosphereThickness * intensity;
      
      // Smoother edge transition that reaches the surface
      float edgeFade = smoothstep(0.0, 0.1, limb) * smoothstep(1.0, 0.8, limb);
      alpha *= (0.4 + edgeFade * 0.6);  // Higher minimum for surface visibility
      
      // Overall atmosphere opacity
      alpha *= 0.4;
      
      // Very minimal cutoff to avoid artifacts
      if (alpha < 0.008) discard;
      
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
      sunRotation={0}  // Static sun, no rotation needed
    />
  );
}

// Planet and moon system - rotates together
function PlanetSystem({ planetRadius, autoRotate, showMoon, children }: { 
  planetRadius: number;
  autoRotate: boolean;
  showMoon: boolean;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const tiltedGroupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const moonOrbitRadius = planetRadius * 2;
  
  useFrame((_, delta) => {
    if (tiltedGroupRef.current && autoRotate) {
      // Rotate planet around its tilted axis
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
        {showMoon && (
          <Moon 
            planetRadius={planetRadius} 
            orbitRadius={moonOrbitRadius}
            orbitSpeed={0.2}
          />
        )}
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
  
  // Dev control states
  const [showEntities, setShowEntities] = useState(true);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showMoon, setShowMoon] = useState(true);
  const [showSun, setShowSun] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  
  // Static sun position
  const staticSunPosition = useMemo(() => {
    const sunDistance = PLANET_RADIUS * 8;
    return new THREE.Vector3(sunDistance, PLANET_RADIUS * 2, sunDistance * 0.5);
  }, []);

  
  // Set up initial camera position
  const initialCameraPosition: [number, number, number] = [
    PLANET_RADIUS * 2.5,
    PLANET_RADIUS * 0.5,
    PLANET_RADIUS * 2.5
  ];
  
  return (
    <>
      <DevControls3D
        showEntities={showEntities}
        setShowEntities={setShowEntities}
        showAtmosphere={showAtmosphere}
        setShowAtmosphere={setShowAtmosphere}
        showClouds={showClouds}
        setShowClouds={setShowClouds}
        autoRotate={autoRotate}
        setAutoRotate={setAutoRotate}
        showStars={showStars}
        setShowStars={setShowStars}
        showMoon={showMoon}
        setShowMoon={setShowMoon}
        showSun={showSun}
        setShowSun={setShowSun}
        showDebug={showDebug}
        setShowDebug={setShowDebug}
      />
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
        {showSun && (
          <group position={staticSunPosition.toArray()}>
            <Sun position={[0, 0, 0]} />
          </group>
        )}
        
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
        <PlanetSystem planetRadius={PLANET_RADIUS} isPaused={isPaused} autoRotate={autoRotate} showMoon={showMoon}>
          {/* Planet base */}
          <PlanetSphere
            radius={PLANET_RADIUS}
            worldWidth={world.width}
            worldHeight={world.height}
          />
          
          {/* Entities on surface */}
          {showEntities && (
            <EntitiesLayer3D
              client={client}
              entitySize={entitySize}
              worldWidth={world.width}
              worldHeight={world.height}
              staticSunPosition={staticSunPosition}
            />
          )}
          
          {/* Cloud layers above entities */}
          {showClouds && (
            <CloudSystemProcedural
              planetRadius={PLANET_RADIUS}
              sunRotation={0}  // Static sun
            />
          )}
        </PlanetSystem>
        
        {/* Atmosphere - outside rotating group, stays aligned with sun */}
        {showAtmosphere && (
          <Atmosphere
            radius={PLANET_RADIUS}
            staticSunPosition={staticSunPosition}
          />
        )}

        {/* High-resolution starfield */}
        {showStars && <Starfield count={12000} radius={15000} />}

        {/* Debug visualization */}
        {showDebug && (
          <DebugArrows
            planetRadius={PLANET_RADIUS}
            sunRotation={0}  // Static sun
            staticSunPosition={staticSunPosition}
          />
        )}
      </Canvas>
    </>
  );
}