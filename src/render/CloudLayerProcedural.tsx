import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudLayerProceduralProps {
  planetRadius: number;
  altitude: number;
  opacity: number;
  speed: number;
  type: 'cumulus' | 'cirrus' | 'stratus';
  sunRotation?: number;
}

export function CloudLayerProcedural({ planetRadius, altitude, opacity, speed, type, sunRotation = 0 }: CloudLayerProceduralProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Static sun position
  const sunPosition = useMemo(() => {
    const sunDistance = planetRadius * 8;
    return new THREE.Vector3(sunDistance, planetRadius * 2, sunDistance * 0.5);
  }, [planetRadius]);
  
  // Rotate cloud layer and update time
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Global wind circulation - speed varies by altitude and type
      let windSpeed = speed;
      
      // Different wind patterns at different altitudes
      if (type === 'cumulus') {
        // Low altitude - slower, more variable
        windSpeed = speed * 2.0 * (1 + Math.sin(state.clock.elapsedTime * 0.1) * 0.3);
      } else if (type === 'cirrus') {
        // High altitude - faster jet stream
        windSpeed = speed * 3.0;
      } else {
        // Mid altitude - moderate speed
        windSpeed = speed * 2.5;
      }
      
      meshRef.current.rotation.y += windSpeed * delta;
      
      const material = meshRef.current.material as THREE.ShaderMaterial;
      if (material.uniforms?.time) {
        material.uniforms.time.value = state.clock.elapsedTime;
      }
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
    uniform vec3 sunPosition;
    
    // Better noise functions for cloud structure
    vec3 hash3(vec3 p) {
      p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
               dot(p, vec3(269.5, 183.3, 246.1)),
               dot(p, vec3(113.5, 271.9, 124.6)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    
    float noise3D(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      
      return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                         dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
                     mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                         dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x), f.y),
                 mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                         dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
                     mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                         dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x), f.y), f.z);
    }
    
    float worleyNoise(vec3 p) {
      vec3 id = floor(p);
      vec3 fd = fract(p);
      
      float minDist = 1.0;
      for(int x = -1; x <= 1; x++) {
        for(int y = -1; y <= 1; y++) {
          for(int z = -1; z <= 1; z++) {
            vec3 neighbor = vec3(float(x), float(y), float(z));
            vec3 point = hash3(id + neighbor) * 0.5 + 0.5;
            float dist = length(neighbor + point - fd);
            minDist = min(minDist, dist);
          }
        }
      }
      return minDist;
    }
    
    void main() {
      // Check visibility
      vec3 fragmentDir = normalize(vWorldPos);
      vec3 cameraDir = normalize(cameraPosition);
      float visibility = dot(fragmentDir, cameraDir);
      
      if (visibility < -0.05) discard;
      
      // Use spherical coordinates to avoid banding
      vec3 sphereNormal = normalize(vWorldPos);
      float theta = atan(sphereNormal.z, sphereNormal.x); // Longitude
      float phi = asin(sphereNormal.y); // Latitude
      
      // Create 3D sampling position from spherical coords
      vec3 pos = vec3(
        theta * 2.0,  // Scale longitude
        phi * 3.0,    // Scale latitude 
        length(vWorldPos) * 0.01  // Use radius for depth
      );
      
      // Calculate latitude for wind effects
      float latitude = sphereNormal.y;
      
      // Simulate trade winds and jet streams based on latitude
      float windOffset = 0.0;
      if (abs(latitude) < 0.3) {
        // Equatorial trade winds - easterly (stronger)
        windOffset = time * 0.15;
      } else if (abs(latitude) > 0.6) {
        // Polar easterlies (moderate)
        windOffset = time * 0.08;
      } else {
        // Mid-latitude westerlies (jet stream zone - much stronger)
        windOffset = -time * 0.2; // Opposite direction
      }
      
      // Apply wind offset to longitude (theta) for proper spherical movement
      pos.x += windOffset;  // Move in longitude direction
      
      float cloud = 0.0;
      vec3 cloudColor = vec3(1.0);
      
      if (cloudType < 0.5) {
        // Cumulus - highly varied puffy clouds with dynamic evolution
        
        // Apply additional wind movement for cumulus in spherical space
        pos.x += time * 0.12;  // Base movement in longitude
        pos.y += sin(time * 0.05 + pos.x) * 0.05;  // Slight vertical wobble
        
        // Create varied aspect ratios and sizes by stretching position differently
        vec3 stretchedPos = pos;
        float positionVariation = noise3D(pos * 0.3);
        
        // Vary X and Z stretching based on position for different cloud shapes
        stretchedPos.x *= 0.8 + positionVariation * 0.8;  // Moderate variation in width
        stretchedPos.z *= 0.9 + positionVariation * 0.6;  // Moderate variation in depth
        stretchedPos.y *= 1.0 + sin(pos.x * 0.2) * 0.3;   // Subtle vertical stretching
        
        // Dynamic billowing motion - clouds rise and fall
        float billowing = sin(time * 0.015 + pos.x * 0.5) * 0.3;
        float puffing = cos(time * 0.02 + pos.z * 0.3) * 0.2;
        
        vec3 timeOffset1 = vec3(
          time * 0.008 + sin(time * 0.003 + pos.x * 0.1) * 0.5,
          time * 0.005 + billowing,
          time * 0.003 + puffing
        );
        vec3 timeOffset2 = vec3(
          time * 0.015 + sin(pos.z * 0.2) * 0.3,
          time * 0.01 + sin(time * 0.007) * 0.4 + billowing * 0.5,
          time * 0.007
        );
        vec3 timeOffset3 = vec3(
          time * 0.02,
          time * 0.012 + billowing * 0.3,
          time * 0.009 + cos(time * 0.005) * 0.2
        );
        
        // Use different scales for variety - but keep within reasonable bounds
        float sizeVariation = 0.7 + positionVariation * 1.2;
        
        // Large scale structure with varied sizes
        float largeScale = 1.0 - worleyNoise(stretchedPos * 0.4 * sizeVariation + timeOffset1);
        // Medium scale with position-based variation
        float medScale = 1.0 - worleyNoise(stretchedPos * 1.5 * sizeVariation + timeOffset2);
        // Fine turbulent details
        float detail = noise3D(stretchedPos * 4.0 * sizeVariation + timeOffset3);
        float turbulence = noise3D(stretchedPos * 10.0 + vec3(time * 0.03, 0.0, 0.0)) * 0.3;
        
        // Dynamic coverage that varies by position
        float localCoverage = 0.5 + 0.3 * sin(time * 0.01 + pos.x * 0.15) + 0.2 * cos(time * 0.007 + pos.z * 0.1);
        
        // Morphing that creates growing and shrinking clouds
        float morphFactor = 0.3 + 0.7 * sin(time * 0.004 + positionVariation * 3.14);
        
        // Build cloud with high variation
        cloud = largeScale * 0.4 + medScale * 0.3 + detail * 0.2 + turbulence * 0.1;
        
        // Variable thresholds for different cloud densities
        float threshold = 0.25 + positionVariation * 0.2;
        cloud = smoothstep(threshold - localCoverage * 0.1, 0.65 * morphFactor, cloud);
        
        // Create highly varied gaps - some areas dense, others sparse
        float gapVariation = 0.3 + sin(pos.x * 0.3 + time * 0.005) * 0.4;
        cloud *= smoothstep(gapVariation, 0.7, largeScale);
        
        // Add occasional towering cumulus
        if (positionVariation > 0.8) {
          cloud *= 1.2;  // Slightly denser/taller clouds
        }
        
        cloudColor = vec3(0.95);
      } else if (cloudType < 1.5) {
        // Cirrus - wispy streaks that flow and evolve
        vec3 stretchedPos = pos * vec3(6.0, 0.3, 2.0);
        
        // Complex flow patterns with wave-like motion
        vec3 timeOffset1 = vec3(
          time * 0.018 + sin(pos.x * 0.1 + time * 0.002) * 2.0,
          time * 0.006,
          time * 0.01 + cos(pos.z * 0.1 + time * 0.003) * 1.5
        );
        vec3 timeOffset2 = vec3(
          time * 0.025 + sin(time * 0.004) * 1.0,
          time * 0.015,
          time * 0.02
        );
        
        float largeStreak = noise3D(stretchedPos * 0.3 + timeOffset1);
        float medStreak = noise3D(stretchedPos + timeOffset2);
        float detail = noise3D(stretchedPos * 2.0 + vec3(time * 0.03, 0.0, 0.0));
        
        // Animated wisp intensity with multiple waves
        float wispiness = 0.5 + 0.15 * sin(time * 0.008) + 0.1 * cos(time * 0.012);
        
        // Streaking effect that moves across the sky
        float streak = sin(pos.x * 0.5 + time * 0.01) * 0.3;
        
        cloud = largeStreak * 0.4 + medStreak * 0.4 + detail * 0.2 + streak;
        cloud = smoothstep(0.4 - wispiness * 0.1, 0.6, cloud) * wispiness;
        cloudColor = vec3(0.98);
      } else {
        // Stratus - sheet clouds with complex evolving patterns
        vec3 timeOffset1 = vec3(
          time * 0.004 + sin(time * 0.002) * 0.3,
          time * 0.003,
          time * 0.002 + cos(time * 0.003) * 0.2
        );
        vec3 timeOffset2 = vec3(
          time * 0.008,
          time * 0.006 + sin(time * 0.004) * 0.4,
          time * 0.005
        );
        
        float largeSheet = noise3D(pos * 0.5 + timeOffset1);
        float medSheet = noise3D(pos * 1.5 + timeOffset2);
        
        // Complex hole animation with multiple frequencies
        float holeAnimation = sin(time * 0.005) * 0.2 + cos(time * 0.008) * 0.1;
        float holeEvolution = sin(time * 0.003 + pos.x * 0.1) * 0.15;
        float holes = worleyNoise(pos * 1.2 + vec3(time * 0.003, holeEvolution, 0.0));
        
        // Breathing effect - the whole layer expands and contracts
        float breathing = 1.0 + sin(time * 0.006) * 0.1;
        
        cloud = (largeSheet * 0.6 + medSheet * 0.4) * smoothstep(0.15 + holeAnimation, 0.6, holes);
        cloud = smoothstep(0.2, 0.5 * breathing, cloud) * (0.7 + holeAnimation * 0.5);
        cloudColor = vec3(0.9);
      }
      
      // Fade at edges
      float edgeFade = smoothstep(-0.05, 0.15, visibility);
      cloud *= edgeFade;
      
      // Natural lighting based on sun position
      vec3 fragmentNormal = normalize(vWorldPos);
      vec3 sunDir = normalize(sunPosition);
      float sunLight = dot(fragmentNormal, sunDir);
      
      // Softer lighting transition with extended twilight zone
      float lighting;
      if (sunLight > 0.1) {
        // Day side - full brightness
        lighting = 1.0;
      } else if (sunLight > -0.3) {
        // Twilight zone - gradual transition
        float t = (sunLight - (-0.3)) / 0.4; // Normalize to 0-1
        lighting = 0.2 + 0.8 * smoothstep(0.0, 1.0, t);
      } else {
        // Night side - minimal lighting
        float t = smoothstep(-0.3, -0.6, sunLight);
        lighting = 0.2 - 0.15 * t;
      }
      
      cloudColor *= lighting;
      
      float alpha = cloud * opacity;
      if (alpha < 0.01) discard; // Don't render nearly transparent pixels
      
      gl_FragColor = vec4(cloudColor, alpha);
    }
  `;
  
  const radius = planetRadius + altitude;
  const cloudTypeValue = type === 'cumulus' ? 0 : type === 'cirrus' ? 1 : 2;
  
  return (
    <mesh ref={meshRef} receiveShadow renderOrder={50}>
      <sphereGeometry args={[radius, 128, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          opacity: { value: opacity },
          time: { value: 0 },
          cloudType: { value: cloudTypeValue },
          sunPosition: { value: sunPosition }
        }}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}  // Don't write depth for transparency
        depthTest={false}   // Disable to prevent planet occlusion
      />
    </mesh>
  );
}

export function CloudSystemProcedural({ planetRadius, sunRotation }: { planetRadius: number; sunRotation?: number }) {
  return (
    <>
      {/* Low cumulus clouds - slowest, affected by surface friction */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={25}
        opacity={0.7}
        speed={0.025}  // Adjusted for better movement
        type="cumulus"
        sunRotation={sunRotation}
      />
      
      {/* Mid stratus clouds - moderate speed */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={35}
        opacity={0.5}
        speed={0.035}  // Increased from 0.012
        type="stratus"
        sunRotation={sunRotation}
      />
      
      {/* High cirrus clouds - fastest, in jet stream */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={45}
        opacity={0.4}
        speed={0.06}  // Increased from 0.025 - jet stream level
        type="cirrus"
        sunRotation={sunRotation}
      />
      
      {/* Very high altitude large structure clouds - moderate */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={65}
        opacity={0.3}
        speed={0.045}  // Increased from 0.018
        type="stratus"
        sunRotation={sunRotation}
      />
    </>
  );
}