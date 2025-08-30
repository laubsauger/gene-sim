import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CloudLayerProps {
  planetRadius: number;
  layerIndex: number;
  cloudCount: number;
  cloudType: 'cumulus' | 'cirrus' | 'stratus';
}

export function CloudLayer({ planetRadius, layerIndex, cloudCount, cloudType }: CloudLayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  
  // Different cloud characteristics based on type
  const cloudConfig = useMemo(() => {
    switch (cloudType) {
      case 'cumulus':
        return {
          altitude: planetRadius * 1.01 + layerIndex * 5,
          size: { min: 40, max: 80 },  // Even smaller
          opacity: 0.6,
          speed: 0.0001 + Math.random() * 0.0002,
          color: '#ffffff',
          verticalScale: 0.15,  // Very flat
        };
      case 'cirrus':
        return {
          altitude: planetRadius * 1.04 + layerIndex * 8,
          size: { min: 60, max: 120 },  // Smaller wisps
          opacity: 0.3,
          speed: 0.0003 + Math.random() * 0.0003,
          color: '#f8fcff',
          verticalScale: 0.05,  // Extremely flat
        };
      case 'stratus':
        return {
          altitude: planetRadius * 1.02 + layerIndex * 6,
          size: { min: 80, max: 150 },  // Smaller sheets
          opacity: 0.4,
          speed: 0.00008 + Math.random() * 0.0001,
          color: '#f0f0f0',
          verticalScale: 0.08,  // Very flat sheets
        };
    }
  }, [cloudType, planetRadius, layerIndex]);
  
  // Generate cloud positions and properties
  const clouds = useMemo(() => {
    const positions: THREE.Matrix4[] = [];
    const scales: number[] = [];
    
    for (let i = 0; i < cloudCount; i++) {
      // Random position on sphere at cloud altitude
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.PI * 0.3 + Math.random() * Math.PI * 0.4; // Keep away from poles
      
      const x = cloudConfig.altitude * Math.sin(phi) * Math.cos(theta);
      const y = cloudConfig.altitude * Math.sin(phi) * Math.sin(theta);
      const z = cloudConfig.altitude * Math.cos(phi);
      
      // Create transform matrix
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3(x, y, z);
      const quaternion = new THREE.Quaternion();
      const scale = cloudConfig.size.min + Math.random() * (cloudConfig.size.max - cloudConfig.size.min);
      
      // Orient cloud to follow sphere curvature
      const normal = position.clone().normalize();
      
      // Create a tangent plane at this point on the sphere
      // Choose a random tangent vector perpendicular to the normal
      const tangent1 = new THREE.Vector3();
      if (Math.abs(normal.y) < 0.9) {
        tangent1.crossVectors(normal, new THREE.Vector3(0, 1, 0)).normalize();
      } else {
        tangent1.crossVectors(normal, new THREE.Vector3(1, 0, 0)).normalize();
      }
      const tangent2 = new THREE.Vector3().crossVectors(normal, tangent1).normalize();
      
      // Create rotation matrix from tangent space
      const rotMatrix = new THREE.Matrix4();
      rotMatrix.makeBasis(tangent1, tangent2, normal);
      quaternion.setFromRotationMatrix(rotMatrix);
      
      // Add random rotation in the tangent plane for variety
      const randomAngle = Math.random() * Math.PI * 2;
      const randomRotation = new THREE.Quaternion();
      randomRotation.setFromAxisAngle(normal, randomAngle);
      quaternion.multiply(randomRotation);
      
      matrix.compose(
        position,
        quaternion,
        new THREE.Vector3(scale, scale, scale * cloudConfig.verticalScale)
      );
      
      positions.push(matrix);
      scales.push(scale);
    }
    
    return { positions, scales };
  }, [cloudCount, cloudConfig]);
  
  // Set up instanced mesh
  useMemo(() => {
    if (instancedMeshRef.current) {
      clouds.positions.forEach((matrix, i) => {
        instancedMeshRef.current!.setMatrixAt(i, matrix);
      });
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [clouds]);
  
  // Animate clouds
  useFrame((state) => {
    if (groupRef.current) {
      // Rotate cloud layer
      groupRef.current.rotation.y += cloudConfig.speed;
      
      // Animate all clouds with different movements
      if (instancedMeshRef.current) {
        const time = state.clock.elapsedTime;
        clouds.positions.forEach((baseMatrix, i) => {
          const matrix = baseMatrix.clone();
          const position = new THREE.Vector3();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          
          matrix.decompose(position, quaternion, scale);
          
          // Different animation based on cloud type
          if (cloudType === 'cumulus') {
            // Bobbing and slight pulsing
            const bobAmount = Math.sin(time * 0.3 + i * 0.5) * 1.5;
            position.y += bobAmount;
            const scaleVar = 1.0 + Math.sin(time * 0.2 + i) * 0.05;
            scale.multiplyScalar(scaleVar);
          } else if (cloudType === 'cirrus') {
            // Gentle swaying
            const swayX = Math.sin(time * 0.15 + i) * 2;
            const swayZ = Math.cos(time * 0.15 + i) * 2;
            position.x += swayX;
            position.z += swayZ;
          }
          // Stratus clouds remain relatively static
          
          matrix.compose(position, quaternion, scale);
          instancedMeshRef.current!.setMatrixAt(i, matrix);
        });
        instancedMeshRef.current.instanceMatrix.needsUpdate = true;
      }
    }
  });
  
  // Vertex shader for curved clouds
  const vertexShader = `
    varying vec2 vUv;
    varying float vOpacity;
    varying vec3 vWorldPos;
    
    void main() {
      vUv = uv;
      vOpacity = 1.0;
      
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      
      vec4 mvPosition = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  
  // Fragment shader for fluffy cloud appearance
  const fragmentShader = `
    varying vec2 vUv;
    varying float vOpacity;
    varying vec3 vWorldPos;
    uniform float opacity;
    uniform vec3 color;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      
      vec2 u = f * f * (3.0 - 2.0 * f);
      
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    
    void main() {
      vec2 st = vUv * 3.0;
      
      // Create cloud shape using multiple noise octaves
        // More stylized cloud shape
      float cloud = noise(st * 1.5);
      cloud += noise(st * 3.0) * 0.5;
      cloud += noise(st * 6.0) * 0.25;
      cloud = smoothstep(0.3, 0.7, cloud);  // Sharp threshold for stylized look
      
      // Spherical cloud shape for proper curvature
      float dist = distance(vUv, vec2(0.5));
      float roundness = 1.0 - smoothstep(0.35, 0.5, dist);
      
      cloud *= roundness;
      
      // Fade clouds based on facing angle
      vec3 toCam = normalize(cameraPosition - vWorldPos);
      vec3 fromCenter = normalize(vWorldPos);  // From planet center to cloud
      float facing = dot(toCam, fromCenter);
      
      // Hide clouds completely on far back side
      if (facing < -0.1) discard;
      
      // Fade clouds near edges and back side
      float facingFade = smoothstep(-0.1, 0.3, facing);
      
      // Apply opacity and fade edges
      float alpha = cloud * opacity * vOpacity * facingFade;
      
      // Darken clouds on back side
      vec3 finalColor = color * (0.3 + 0.7 * facingFade);
      
      gl_FragColor = vec4(finalColor, alpha);
    }
  `;
  
  // Cloud geometry - flattened sphere for disk-like clouds
  const cloudGeometry = useMemo(() => {
    // Create a very flat ellipsoid shape
    const geometry = new THREE.SphereGeometry(1, 12, 4);
    // Scale vertices to make it flatter
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      positions.setY(i, y * 0.3);  // Flatten significantly
    }
    geometry.attributes.position.needsUpdate = true;
    return geometry;
  }, []);
  
  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={instancedMeshRef}
        args={[cloudGeometry, undefined, cloudCount]}
        frustumCulled={false}
      >
        <meshStandardMaterial
          color={cloudConfig.color}
          opacity={cloudConfig.opacity}
          transparent
          depthWrite={false}
          depthTest={true}
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
          emissive={cloudConfig.color}
          emissiveIntensity={0.1}
        />
      </instancedMesh>
    </group>
  );
}

export function CloudSystem({ planetRadius }: { planetRadius: number }) {
  return (
    <>
      {/* Low cumulus clouds - puffy, dense */}
      <CloudLayer
        planetRadius={planetRadius}
        layerIndex={0}
        cloudCount={25}  // Fewer clouds
        cloudType="cumulus"
      />
      
      {/* Mid-level stratus clouds - sheet-like */}
      <CloudLayer
        planetRadius={planetRadius}
        layerIndex={1}
        cloudCount={15}  // Fewer sheets
        cloudType="stratus"
      />
      
      {/* High cirrus clouds - wispy, thin */}
      <CloudLayer
        planetRadius={planetRadius}
        layerIndex={2}
        cloudCount={20}  // Fewer wisps
        cloudType="cirrus"
      />
    </>
  );
}