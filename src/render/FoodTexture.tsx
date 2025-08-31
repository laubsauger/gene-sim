import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface FoodTextureProps {
  foodData: Uint8Array | null;  // SharedArrayBuffer view
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
    
    // Higher contrast food visualization for biomes
    // Skip completely empty cells for transparency
    if (food < 0.01) {
      discard;
    }
    
    // High contrast colors that work with both natural and highlight biome modes
    vec3 depleted = vec3(0.3, 0.0, 0.3);    // Dark purple (consumed)
    vec3 sparse = vec3(0.5, 0.0, 0.5);      // Medium purple
    vec3 medium = vec3(0.7, 0.0, 0.4);      // Purple-red
    vec3 full = vec3(1.0, 0.0, 0.3);        // Bright red-purple
    
    vec3 color;
    float alpha = 0.9; // Higher base transparency for better visibility
    
    if (food < 0.33) {
      color = mix(depleted, sparse, food * 3.0);
      alpha = 0.7 + food * 0.3; // Less transparent overall
    } else if (food < 0.66) {
      color = mix(sparse, medium, (food - 0.33) * 3.0);
      alpha = 0.85;
    } else {
      color = mix(medium, full, (food - 0.66) * 3.0);
      alpha = 0.95; // Nearly opaque when full
    }
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export function FoodTexture({ foodData, cols, rows, world }: FoodTextureProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.DataTexture>(null!);
  const materialRef = useRef<THREE.ShaderMaterial>(null!);
  const frameCount = useRef(0);
  
  // Create data texture for food values
  const texture = useMemo(() => {
    const data = new Uint8Array(cols * rows);
    const tex = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.flipY = true; // Flip to match biome coordinate system
    tex.needsUpdate = true;
    textureRef.current = tex;
    return tex;
  }, [cols, rows]);
  
  // Update texture only when food data changes significantly
  // Use frame skipping for performance
  useFrame((_state) => {
    if (!textureRef.current || !foodData) return;
    
    frameCount.current++;
    
    // Only update texture every 4 frames (15 FPS for food)
    if (frameCount.current % 4 === 0) {
      const data = textureRef.current.image.data as Uint8Array;
      
      // Direct memory copy from SharedArrayBuffer view
      // This is much faster than converting from Float32Array
      if (foodData.length === data.length) {
        data.set(foodData);
      }
      
      textureRef.current.needsUpdate = true;
    }
    
    // No need to update time uniform anymore - no animation
  });
  
  const material = useMemo(
    () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          foodTexture: { value: texture }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      });
      materialRef.current = mat;
      return mat;
    },
    [texture]
  );
  
  // Cleanup
  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [texture, material]);
  
  return (
    <mesh 
      ref={meshRef}
      position={[world.width / 2, world.height / 2, -0.05]}
      material={material}
    >
      <planeGeometry args={[world.width, world.height]} />
    </mesh>
  );
}