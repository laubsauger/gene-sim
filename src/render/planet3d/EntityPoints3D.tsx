import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { batchWorldToSphere } from '../utils/coordinateTransform';

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
  sunRotation?: number;
}

const vertexShader = `
  attribute vec3 color;
  attribute float alive;
  varying vec3 vColor;
  varying float vAlive;
  varying vec3 vWorldPos;
  uniform float size;
  
  void main() {
    // Pass color through - it's already normalized to 0-1
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
  uniform vec3 sunPosition;
  
  void main() {
    if (vAlive < 0.5) discard;
    
    // Check if entity is on visible side of planet
    vec3 entityDir = normalize(vWorldPos);  // Direction from origin to entity
    vec3 cameraDir = normalize(cameraPosition);  // Direction from origin to camera
    float dotProduct = dot(entityDir, cameraDir);
    
    // Show entities on hemisphere facing camera (positive dot product means same side)
    if (dotProduct < 0.0) discard;  // Hide on far side

    // Calculate sun lighting
    vec3 sunDir = normalize(sunPosition);
    float sunLight = dot(entityDir, sunDir);

    // Darken entities on night side
    float lighting = 0.2 + 0.8 * smoothstep(-0.2, 0.2, sunLight);
    
    // Create circular points
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    // Simple solid points with slight fade at edges
    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
    
    // Slight fade at horizon
    alpha *= smoothstep(-0.1, 0.1, dotProduct) * 0.8 + 0.2;
    
    // Apply lighting to color
    vec3 litColor = vColor * lighting;

    gl_FragColor = vec4(litColor, alpha);
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
  planetRadius,
  sunRotation = 0
}: EntityPoints3DProps) {
  const meshRef = useRef<THREE.Points>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const positions3DRef = useRef<Float32Array>(new Float32Array(count * 3));

  // Static sun position
  const sunPosition = useMemo(() => {
    const sunDistance = planetRadius * 8;
    return new THREE.Vector3(sunDistance, planetRadius * 2, sunDistance * 0.5);
  }, [planetRadius]);

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
      planetRadius * 1.001 // Just slightly above planet surface
    );

    // Update position attribute
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.array = positions3DRef.current;
    posAttr.needsUpdate = true;

    // Update colors - already in 0-255 range, shader expects 0-1
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const colorArray = colorAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Color data is in Uint8Array (0-255), convert to 0-1 for shader
      colorArray[idx] = color[idx] / 255.0;
      colorArray[idx + 1] = color[idx + 1] / 255.0;
      colorArray[idx + 2] = color[idx + 2] / 255.0;
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
      planetRadius * 1.01
    );
  });

  return (
    <points ref={meshRef} renderOrder={10}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          size: { value: pointSize * 0.8 },  // Reduced size for more realistic scale
          sunPosition: { value: sunPosition }
        }}
        transparent={false}
        depthWrite={false}  // Don't write depth for points
        depthTest={false}   // Disable to prevent planet occlusion
        blending={THREE.NormalBlending}  // Normal blending for proper visibility
      />
    </points>
  );
}