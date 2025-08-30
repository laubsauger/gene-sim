import { useMemo } from 'react';
import * as THREE from 'three';

interface StarfieldProps {
  count?: number;
  radius?: number;
}

export function Starfield({ count = 5000, radius = 8000 }: StarfieldProps) {
  const [positions, colors, sizes] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // Random position on sphere surface
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      
      // Star colors - mostly white with some slight color variations
      const starType = Math.random();
      if (starType < 0.7) {
        // White stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      } else if (starType < 0.85) {
        // Blueish stars
        colors[i * 3] = 0.8;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 1;
      } else if (starType < 0.95) {
        // Yellowish stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.95;
        colors[i * 3 + 2] = 0.8;
      } else {
        // Reddish stars
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.7;
      }
      
      // Vary star sizes - most are small, few are larger
      const sizeRand = Math.random();
      if (sizeRand < 0.8) {
        sizes[i] = Math.random() * 0.5 + 0.5; // Small stars: 0.5-1.0
      } else if (sizeRand < 0.95) {
        sizes[i] = Math.random() * 1 + 1; // Medium stars: 1.0-2.0
      } else {
        sizes[i] = Math.random() * 2 + 2; // Large stars: 2.0-4.0
      }
    }
    
    return [positions, colors, sizes];
  }, [count, radius]);
  
  const vertexShader = `
    attribute float size;
    attribute vec3 color;
    varying vec3 vColor;
    
    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Size based on distance for realistic appearance
      gl_PointSize = size * (1000.0 / -mvPosition.z);
    }
  `;
  
  const fragmentShader = `
    varying vec3 vColor;
    
    void main() {
      // Create circular star shape with soft edges
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      
      // Discard pixels outside circle
      if (dist > 0.5) discard;
      
      // Create soft glow falloff
      float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
      intensity = pow(intensity, 2.0); // Sharper center, softer edges
      
      // Add twinkle effect
      float twinkle = 0.8 + 0.2 * sin(dist * 50.0);
      
      gl_FragColor = vec4(vColor * intensity * twinkle, intensity);
    }
  `;
  
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}