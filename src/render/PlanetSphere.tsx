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
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial
        color="#1a4d2e"
        roughness={0.8}
        metalness={0.2}
        emissive="#0a1f13"
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}