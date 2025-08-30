import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

interface DebugArrowsProps {
  planetRadius: number;
  sunRotation: number;
  staticSunPosition?: THREE.Vector3;
}

export function DebugArrows({ planetRadius, sunRotation, staticSunPosition }: DebugArrowsProps) {
  const lastLogTime = useRef(0);
  const arrowRef = useRef<any>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  
  // Use static sun position if provided, otherwise calculate from rotation
  const sunPosition = useMemo(() => {
    if (staticSunPosition) {
      return staticSunPosition;
    }
    
    // Fallback to calculated position
    const sunDistance = planetRadius * 8;
    const baseSunPos = new THREE.Vector3(sunDistance, planetRadius * 2, sunDistance * 0.5);
    
    // Rotate around Y axis - matches actual directional light
    const cos = Math.cos(sunRotation);
    const sin = Math.sin(sunRotation);
    
    const rotatedPos = new THREE.Vector3(
      baseSunPos.x * cos - baseSunPos.z * sin,
      baseSunPos.y,
      baseSunPos.x * sin + baseSunPos.z * cos
    );
    
    return rotatedPos;
  }, [planetRadius, sunRotation, staticSunPosition]);
  
  // Log vectors every 2 seconds
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastLogTime.current > 5) {  // Less frequent logging
      lastLogTime.current = now;
      
      const cameraPos = state.camera.position;
      console.log('===== Frame Debug =====');
      console.log('Camera Position:', cameraPos.x.toFixed(0), cameraPos.y.toFixed(0), cameraPos.z.toFixed(0));
      console.log('========================');
    }
  });
  
  // Arrow from planet center to sun - dynamically updated
  const planetToSunPoints = useMemo(() => {
    const sunDir = sunPosition.clone().normalize();
    const arrowEnd = sunDir.multiplyScalar(planetRadius * 2); // Fixed length arrow
    return [
      new THREE.Vector3(0, 0, 0),
      arrowEnd
    ];
  }, [sunPosition, planetRadius]);
  
  // Dynamic camera arrow needs to be created in component
  const cameraArrowRef = useRef<THREE.Vector3[]>([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)
  ]);
  
  useFrame((state) => {
    // Update camera arrow
    const cameraDir = state.camera.position.clone().normalize().multiplyScalar(planetRadius * 1.5);
    cameraArrowRef.current[1] = cameraDir;
  });
  
  return (
    <group>
      {/* Arrow to sun - yellow */}
      <Line
        points={planetToSunPoints}
        color="yellow"
        lineWidth={3}
      />
      {/* Sun direction indicator sphere */}
      <mesh position={planetToSunPoints[1]}>
        <sphereGeometry args={[30, 16, 16]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
      
      {/* Actual sun position indicator (far away) - removed to prevent crashes */}
    </group>
  );
}