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
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    float food = texture2D(foodTexture, vUv).r;
    
    // Enhanced visual with subtle animation
    float pulse = 0.95 + 0.05 * sin(time * 2.0 + vUv.x * 10.0 + vUv.y * 10.0);
    food *= pulse;
    
    // Better color gradient
    vec3 depleted = vec3(0.05, 0.05, 0.06);  // Nearly black
    vec3 sparse = vec3(0.08, 0.10, 0.08);    // Dark green-gray
    vec3 medium = vec3(0.12, 0.16, 0.10);    // Medium green
    vec3 full = vec3(0.18, 0.24, 0.14);      // Brighter green
    
    vec3 color;
    if (food < 0.33) {
      color = mix(depleted, sparse, food * 3.0);
    } else if (food < 0.66) {
      color = mix(sparse, medium, (food - 0.33) * 3.0);
    } else {
      color = mix(medium, full, (food - 0.66) * 3.0);
    }
    
    gl_FragColor = vec4(color, 1.0);
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
    tex.needsUpdate = true;
    textureRef.current = tex;
    return tex;
  }, [cols, rows]);
  
  // Update texture only when food data changes significantly
  // Use frame skipping for performance
  useFrame((state) => {
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
    
    // Update time uniform less frequently for subtle animation
    // Only update every 10 frames to reduce uniform updates
    if (materialRef.current && frameCount.current % 10 === 0) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });
  
  const material = useMemo(
    () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          foodTexture: { value: texture },
          time: { value: 0 }
        },
        vertexShader,
        fragmentShader,
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
      position={[world.width / 2, world.height / 2, -1]}
      material={material}
    >
      <planeGeometry args={[world.width, world.height]} />
    </mesh>
  );
}