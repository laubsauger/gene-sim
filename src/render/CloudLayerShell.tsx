import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudLayerShellProps {
  planetRadius: number;
  altitude: number;
  opacity: number;
  speed: number;
  type: 'cumulus' | 'cirrus' | 'stratus';
}

export function CloudLayerShell({ planetRadius, altitude, opacity, speed, type }: CloudLayerShellProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Rotate cloud layer
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += speed * delta;
    }
  });
  
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  
  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    uniform float opacity;
    uniform float time;
    uniform float cloudType; // 0=cumulus, 1=cirrus, 2=stratus
    
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    
    float fbm(vec2 p, int octaves, float persistence) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      float maxValue = 0.0;
      
      for(int i = 0; i < octaves; i++) {
        value += amplitude * noise(p * frequency);
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2.0;
      }
      
      return value / maxValue;
    }
    
    void main() {
      // Check visibility from camera
      vec3 fragmentDir = normalize(vWorldPos);  // Direction from origin to fragment
      vec3 cameraDir = normalize(cameraPosition);  // Direction from origin to camera
      float visibility = dot(fragmentDir, cameraDir);
      
      // Only show on hemisphere facing camera
      if (visibility < -0.05) discard;  // Hide on far side
      
      vec2 st = vUv * 8.0; // Scale for cloud patterns
      
      float cloud = 0.0;
      vec3 cloudColor = vec3(1.0);
      
      if (cloudType < 0.5) {
        // Cumulus - puffy, dense clouds
        st *= 2.0;
        cloud = fbm(st + vec2(time * 0.01), 4, 0.5);
        cloud = smoothstep(0.4, 0.6, cloud);
        cloud *= fbm(st * 0.5 + vec2(time * 0.005), 3, 0.7);
        cloudColor = vec3(0.95, 0.95, 0.95);
      } else if (cloudType < 1.5) {
        // Cirrus - wispy, thin clouds
        st *= 4.0;
        cloud = fbm(st + vec2(time * 0.02), 6, 0.3);
        cloud = smoothstep(0.5, 0.7, cloud);
        cloud *= 0.6;
        cloudColor = vec3(0.98, 0.98, 1.0);
      } else {
        // Stratus - sheet-like clouds
        st *= 1.5;
        cloud = fbm(st + vec2(time * 0.005), 3, 0.6);
        cloud = smoothstep(0.3, 0.5, cloud);
        cloud *= 0.8;
        cloudColor = vec3(0.9, 0.9, 0.9);
      }
      
      // Fade at edges
      float edgeFade = smoothstep(-0.05, 0.15, visibility);
      cloud *= edgeFade;
      
      // Slightly darken near edges for depth
      cloudColor *= 0.8 + 0.2 * smoothstep(0.0, 0.5, visibility);
      
      float alpha = cloud * opacity;
      gl_FragColor = vec4(cloudColor, alpha);
    }
  `;
  
  const radius = planetRadius + altitude;
  const cloudTypeValue = type === 'cumulus' ? 0 : type === 'cirrus' ? 1 : 2;
  
  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[radius, 64, 32]} />
      <meshPhongMaterial
        color="white"
        opacity={opacity * 0.8}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function CloudSystemShell({ planetRadius }: { planetRadius: number }) {
  return (
    <>
      {/* Low cumulus clouds */}
      <CloudLayerShell
        planetRadius={planetRadius}
        altitude={25}  // Raised from 10
        opacity={0.6}
        speed={0.01}
        type="cumulus"
      />
      
      {/* Mid stratus clouds */}
      <CloudLayerShell
        planetRadius={planetRadius}
        altitude={40}  // Raised from 20
        opacity={0.4}
        speed={0.008}
        type="stratus"
      />
      
      {/* High cirrus clouds */}
      <CloudLayerShell
        planetRadius={planetRadius}
        altitude={50}  // Slightly lower
        opacity={0.3}
        speed={0.015}
        type="cirrus"
      />
    </>
  );
}