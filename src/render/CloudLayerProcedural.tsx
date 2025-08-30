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
      
      // Different wind patterns at different altitudes with smooth variation
      if (type === 'cumulus') {
        // Low altitude - slower, more variable with gentle undulation
        const variation = Math.sin(state.clock.elapsedTime * 0.05) * 0.2 + 
                         Math.sin(state.clock.elapsedTime * 0.03) * 0.1;
        windSpeed = speed * 2.0 * (1 + variation);
      } else if (type === 'cirrus') {
        // High altitude - faster jet stream with slight variation
        const variation = Math.sin(state.clock.elapsedTime * 0.02) * 0.15;
        windSpeed = speed * 3.0 * (1 + variation);
      } else {
        // Mid altitude - moderate speed with medium variation
        const variation = Math.sin(state.clock.elapsedTime * 0.04) * 0.1;
        windSpeed = speed * 2.5 * (1 + variation);
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
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;  // Local sphere position
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
    varying vec3 vPosition;
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
      
      // Use UV coordinates for stable cloud positioning
      // This avoids stretching at poles
      float theta = vUv.x * 3.14159 * 2.0 - 3.14159; // Longitude: -PI to PI
      float phi = (vUv.y - 0.5) * 3.14159; // Latitude: -PI/2 to PI/2
      
      // Convert to 3D position for noise sampling
      vec3 spherePos;
      spherePos.x = cos(phi) * cos(theta);
      spherePos.y = sin(phi);
      spherePos.z = cos(phi) * sin(theta);
      
      // Scale for cloud features
      vec3 pos = spherePos * 50.0;
      
      // Calculate latitude for wind effects
      float latitude = sin(phi);
      
      // Simulate trade winds with smooth transitions between zones
      float windOffset = 0.0;
      float absLat = abs(latitude);
      
      if (absLat < 0.4) {
        // Equatorial to subtropical - smooth transition
        float tradeStrength = smoothstep(0.4, 0.0, absLat);
        windOffset = time * 0.08 * tradeStrength;
      }
      
      if (absLat > 0.3 && absLat < 0.7) {
        // Mid-latitude westerlies with smooth blend
        float westerliesStrength = smoothstep(0.3, 0.5, absLat) * smoothstep(0.7, 0.5, absLat);
        windOffset += -time * 0.1 * westerliesStrength;
      }
      
      if (absLat > 0.6) {
        // Polar easterlies with smooth transition
        float polarStrength = smoothstep(0.6, 0.8, absLat);
        windOffset += time * 0.05 * polarStrength;
      }
      
      // Add subtle turbulence
      float turbulence = noise3D(pos * 0.5 + vec3(time * 0.05)) * 0.2;
      
      // Apply wind by offsetting the longitude
      theta += windOffset * (1.0 + turbulence);
      
      // Recalculate position with wind offset
      pos.x = cos(phi) * cos(theta) * 50.0;
      pos.z = cos(phi) * sin(theta) * 50.0;
      
      float cloud = 0.0;
      vec3 cloudColor = vec3(1.0);
      
      if (cloudType < 0.5) {
        // Cumulus - puffy cotton ball clouds
        
        // Apply movement for cumulus clouds
        theta += time * 0.02;  // Even slower movement
        pos.x = cos(phi) * cos(theta) * 50.0;
        pos.z = cos(phi) * sin(theta) * 50.0;
        
        // Create puffy cumulus shapes
        vec3 stretchedPos = pos;
        float positionVariation = noise3D(pos * 0.2);
        
        // Make them more spherical/puffy
        stretchedPos *= 1.2;  // Uniform scaling for rounder clouds
        stretchedPos.y *= 1.0 + sin(pos.x * 0.1) * 0.2;  // Slight vertical variation
        
        // Slower, gentler billowing motion
        float billowing = sin(time * 0.008 + pos.x * 0.3) * 0.2;
        float puffing = cos(time * 0.01 + pos.z * 0.2) * 0.15;
        
        vec3 timeOffset1 = vec3(
          time * 0.004 + sin(time * 0.002 + pos.x * 0.1) * 0.3,
          time * 0.003 + billowing,
          time * 0.002 + puffing
        );
        vec3 timeOffset2 = vec3(
          time * 0.008 + sin(pos.z * 0.2) * 0.2,
          time * 0.005 + sin(time * 0.004) * 0.3 + billowing * 0.5,
          time * 0.004
        );
        vec3 timeOffset3 = vec3(
          time * 0.01,
          time * 0.006 + billowing * 0.3,
          time * 0.005 + cos(time * 0.003) * 0.15
        );
        
        // Larger cumulus shapes
        float sizeVariation = 1.0 + positionVariation * 0.2;
        
        // Use Worley noise for puffy cotton-ball effect - larger scale
        float puffyBase = 1.0 - worleyNoise(stretchedPos * 0.08 * sizeVariation + timeOffset1);
        float puffyMed = 1.0 - worleyNoise(stretchedPos * 0.2 * sizeVariation + timeOffset2);
        
        // Create distinct cumulus puffs
        float puffiness = pow(puffyBase, 2.0);  // Sharper peaks for puffs
        
        // Build puffy cumulus
        cloud = puffiness * 0.7 + puffyMed * 0.3;
        
        // Strong threshold for distinct cloud shapes
        cloud = smoothstep(0.35, 0.5, cloud);
        
        // Add blur by smoothing
        cloud = smoothstep(0.0, 1.0, cloud * 1.2);
        
        // Less aggressive gaps between cumulus clusters
        float clusterPattern = 0.6 + 0.4 * smoothstep(0.2, 0.8, noise3D(pos * 0.015 + vec3(time * 0.0005)));
        cloud *= clusterPattern;
        
        // Boost opacity for cumulus
        cloud *= 1.5;
        
        // Add occasional towering cumulus
        if (positionVariation > 0.8) {
          cloud *= 1.2;  // Slightly denser/taller clouds
        }
        
        cloudColor = vec3(0.95);
      } else if (cloudType < 1.5) {
        // Cirrus - simple high altitude wisps
        vec3 stretchedPos = pos * vec3(6.0, 0.2, 2.0);
        
        // Simple flow
        vec3 timeOffset1 = vec3(
          time * 0.02,
          time * 0.005,
          time * 0.008
        );
        
        // Denser cirrus streaks
        float largeStreak = noise3D(stretchedPos * 0.12 + timeOffset1);
        float blur = noise3D(stretchedPos * 0.25 + timeOffset1 * 1.2);
        
        cloud = largeStreak * 0.7 + blur * 0.3;
        
        // Soft wispy appearance but more visible
        cloud = smoothstep(0.25, 0.55, cloud);
        cloud = smoothstep(0.0, 1.0, cloud * 1.3);  // Add blur
        
        // More visible
        cloud *= 0.9;
        cloudColor = vec3(0.98);
      } else {
        // Stratus - simple sheet clouds
        vec3 timeOffset1 = vec3(
          time * 0.003,
          time * 0.002,
          time * 0.002
        );
        
        // Very simple sheets
        float largeSheet = noise3D(pos * 0.25 + timeOffset1);
        
        // Less aggressive holes for denser coverage
        float holes = 0.7 + 0.3 * smoothstep(0.1, 0.5, noise3D(pos * 0.04 + vec3(time * 0.0008)));
        
        // Simple structure
        cloud = largeSheet;
        cloud = smoothstep(0.15, 0.45, cloud);
        
        // Add blur
        cloud = smoothstep(0.0, 1.0, cloud * 1.2);
        
        // Apply holes but keep more coverage
        cloud *= holes;
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
      {/* Low cumulus clouds - slowest, puffy clouds */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={25}
        opacity={0.9}  // More opaque
        speed={0.005}  // Even slower
        type="cumulus"
        sunRotation={sunRotation}
      />
      
      {/* Mid stratus clouds - moderate speed */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={35}
        opacity={0.75}  // More opaque
        speed={0.012}  // Slower
        type="stratus"
        sunRotation={sunRotation}
      />
      
      {/* High cirrus clouds - fastest, in jet stream */}
      <CloudLayerProcedural
        planetRadius={planetRadius}
        altitude={45}
        opacity={0.65}  // More opaque
        speed={0.02}  // Slower jet stream
        type="cirrus"
        sunRotation={sunRotation}
      />
    </>
  );
}