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
      
      // Star colors - more vibrant with better variation
      const starType = Math.random();
      const brightness = 0.8 + Math.random() * 0.2; // Vary brightness
      
      if (starType < 0.6) {
        // White/bright stars
        colors[i * 3] = brightness;
        colors[i * 3 + 1] = brightness;
        colors[i * 3 + 2] = brightness;
      } else if (starType < 0.75) {
        // Blue giants
        colors[i * 3] = 0.6 * brightness;
        colors[i * 3 + 1] = 0.8 * brightness;
        colors[i * 3 + 2] = 1.0 * brightness;
      } else if (starType < 0.87) {
        // Yellow stars
        colors[i * 3] = 1.0 * brightness;
        colors[i * 3 + 1] = 0.9 * brightness;
        colors[i * 3 + 2] = 0.6 * brightness;
      } else if (starType < 0.95) {
        // Orange stars
        colors[i * 3] = 1.0 * brightness;
        colors[i * 3 + 1] = 0.7 * brightness;
        colors[i * 3 + 2] = 0.4 * brightness;
      } else {
        // Red giants
        colors[i * 3] = 1.0 * brightness;
        colors[i * 3 + 1] = 0.5 * brightness;
        colors[i * 3 + 2] = 0.3 * brightness;
      }
      
      // Vary star sizes - make them larger and more visible
      const sizeRand = Math.random();
      if (sizeRand < 0.7) {
        sizes[i] = Math.random() * 1.5 + 1.0; // Small stars: 1.0-2.5
      } else if (sizeRand < 0.9) {
        sizes[i] = Math.random() * 2 + 2.5; // Medium stars: 2.5-4.5
      } else if (sizeRand < 0.98) {
        sizes[i] = Math.random() * 3 + 4; // Large stars: 4.0-7.0
      } else {
        sizes[i] = Math.random() * 4 + 6; // Very large stars: 6.0-10.0
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
      
      // Size based on distance but clamped for visibility
      gl_PointSize = size * (2000.0 / -mvPosition.z);
      gl_PointSize = clamp(gl_PointSize, 1.0, 20.0);
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
      intensity = pow(intensity, 1.5); // Brighter overall
      
      // Stronger glow for better visibility
      float glow = 1.0 + 0.3 * (1.0 - dist);
      
      // Boost the alpha for better visibility against black background
      float alpha = intensity * 1.2;
      alpha = clamp(alpha, 0.0, 1.0);
      
      gl_FragColor = vec4(vColor * intensity * glow, alpha);
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