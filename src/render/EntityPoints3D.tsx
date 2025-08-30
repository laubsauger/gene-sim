import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { batchWorldToSphere } from './utils/coordinateTransform';

interface EntityPoints3DProps {
  pos: Float32Array;
  color: Uint8Array;
  alive: Uint8Array;
  age?: Uint16Array;
  count: number;
  pointSize: number;
  worldWidth: number;
  worldHeight: number;
  planetRadius: number;
}

const vertexShader = `
  attribute vec3 color;
  attribute float alive;
  varying vec3 vColor;
  varying float vAlive;
  varying vec3 vWorldPos;
  uniform float size;
  
  void main() {
    vColor = color;
    vAlive = alive;
    
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    
    // Scale point size based on distance for better visibility
    // Clamp size to ensure visibility at all distances
    float distanceScale = clamp(500.0 / -mvPosition.z, 0.5, 3.0);
    gl_PointSize = size * distanceScale;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlive;
  varying vec3 vWorldPos;
  
  void main() {
    if (vAlive < 0.5) discard;
    
    // Check if entity is on front side of planet
    vec3 toCam = normalize(cameraPosition - vWorldPos);
    vec3 fromCenter = normalize(vWorldPos);  // From planet center to entity
    float facing = dot(toCam, fromCenter);
    
    // Only show entities on the hemisphere facing the camera
    if (facing < -0.05) discard;  // Hide entities on back side with small margin
    
    // Create circular points
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Soft edges with gentler fade based on facing angle
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    alpha *= smoothstep(-0.05, 0.3, facing);  // Gentler fade at edges
    
    // Add slight glow effect
    vec3 finalColor = vColor * (1.0 + (1.0 - dist) * 0.3);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function EntityPoints3D({
  pos,
  color,
  alive,
  age,
  count,
  pointSize,
  worldWidth,
  worldHeight,
  planetRadius
}: EntityPoints3DProps) {
  const meshRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const positions3DRef = useRef<Float32Array>(new Float32Array(count * 3));
  
  // Initialize geometry
  useEffect(() => {
    if (!geometryRef.current) return;
    
    const geometry = geometryRef.current;
    
    // Set up attributes
    positions3DRef.current = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions3DRef.current, 3));
    
    // Color attribute (normalized RGB)
    const colors = new Float32Array(count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Alive attribute
    const aliveAttr = new Float32Array(count);
    geometry.setAttribute('alive', new THREE.BufferAttribute(aliveAttr, 1));
    
    // Set draw range
    geometry.setDrawRange(0, count);
  }, [count]);
  
  // Update positions and attributes every frame
  useFrame(() => {
    if (!geometryRef.current || !meshRef.current) return;
    
    const geometry = geometryRef.current;
    
    // Transform 2D positions to 3D sphere surface
    positions3DRef.current = batchWorldToSphere(
      pos,
      worldWidth,
      worldHeight,
      planetRadius * 1.001  // Slightly above planet surface to avoid z-fighting with food
    );
    
    // Update position attribute
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.array = positions3DRef.current;
    posAttr.needsUpdate = true;
    
    // Update colors (convert from 0-255 to 0-1)
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const colorArray = colorAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const colorIndex = i * 3;
      colorArray[colorIndex] = color[colorIndex] / 255;
      colorArray[colorIndex + 1] = color[colorIndex + 1] / 255;
      colorArray[colorIndex + 2] = color[colorIndex + 2] / 255;
    }
    colorAttr.needsUpdate = true;
    
    // Update alive attribute
    const aliveAttr = geometry.getAttribute('alive') as THREE.BufferAttribute;
    const aliveArray = aliveAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      aliveArray[i] = alive[i];
    }
    aliveAttr.needsUpdate = true;
    
    // Update bounding sphere for proper culling
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, 0, 0),
      planetRadius * 1.1
    );
  });
  
  return (
    <points ref={meshRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          size: { value: pointSize * 1.8 }  // Good visibility
        }}
        transparent
        depthWrite={false}  // Don't write depth for transparent points
        depthTest={true}    // Test depth for planet occlusion
        blending={THREE.AdditiveBlending}  // Additive for glow effect
      />
    </points>
  );
}