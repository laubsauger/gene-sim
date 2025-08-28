import { useEffect, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FoodMeshProps {
  foodGrid: Float32Array;
  cols: number;
  rows: number;
  world: { width: number; height: number };
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D foodTexture;
  varying vec2 vUv;
  
  void main() {
    float food = texture2D(foodTexture, vUv).r;
    
    // Brighter gradient for better visibility
    vec3 depleted = vec3(0.08, 0.08, 0.08);  // Very dark gray
    vec3 full = vec3(0.20, 0.22, 0.25);      // Medium gray with blue-green tint
    
    vec3 color = mix(depleted, full, food);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function FoodMesh({ foodGrid, cols, rows, world }: FoodMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.DataTexture>();
  
  // Create data texture for food values
  const texture = useMemo(() => {
    const data = new Uint8Array(cols * rows);
    const tex = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    textureRef.current = tex;
    return tex;
  }, [cols, rows]);
  
  // Update texture data from food grid
  useFrame(() => {
    if (!textureRef.current || !foodGrid) return;
    
    const data = textureRef.current.image.data as Uint8Array;
    
    // Direct copy - no flipping needed since we're using a plane
    for (let i = 0; i < foodGrid.length && i < data.length; i++) {
      data[i] = Math.floor(Math.max(0, Math.min(1, foodGrid[i])) * 255);
    }
    
    textureRef.current.needsUpdate = true;
  });
  
  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        foodTexture: { value: texture }
      },
      vertexShader,
      fragmentShader,
    }),
    [texture]
  );
  
  return (
    <mesh 
      ref={meshRef}
      position={[world.width / 2, world.height / 2, -1]}
      material={material}
    >
      <planeGeometry args={[world.width, world.height]} />
    </mesh>
  );
}