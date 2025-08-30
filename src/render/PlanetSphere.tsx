import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface PlanetSphereProps {
  radius: number;
  worldWidth: number;
  worldHeight: number;
}

export function PlanetSphere({ radius, worldWidth, worldHeight }: PlanetSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Slowly rotate the planet for a dynamic effect (optional)
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Very slow rotation for ambient movement
      // meshRef.current.rotation.y += delta * 0.01;
    }
  });
  
  return (
    <mesh ref={meshRef} receiveShadow>
      <sphereGeometry args={[radius, 128, 64]} />
      <meshStandardMaterial
        color="#2a5d3e"
        roughness={0.95}
        metalness={0.05}
        emissive="#050a07"
        emissiveIntensity={0.02}
      />
    </mesh>
  );
}