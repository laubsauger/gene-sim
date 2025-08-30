import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SunProps {
  position: [number, number, number];
}

export function Sun({ position }: SunProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Create textures for sun and flares
  const [sunTexture, setSunTexture] = useState<THREE.Texture | null>(null);
  const [flareTexture, setFlareTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    // Sun texture
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 256;
    sunCanvas.height = 256;
    const ctx = sunCanvas.getContext('2d')!;
    
    // Create radial gradient for sun
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 240, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 250, 200, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 220, 100, 1)');
    gradient.addColorStop(0.8, 'rgba(255, 180, 50, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    setSunTexture(new THREE.CanvasTexture(sunCanvas));
    
    // Flare texture (cross pattern)
    const flareCanvas = document.createElement('canvas');
    flareCanvas.width = 512;
    flareCanvas.height = 512;
    const flareCtx = flareCanvas.getContext('2d')!;
    
    // Horizontal flare
    const hGrad = flareCtx.createLinearGradient(0, 256, 512, 256);
    hGrad.addColorStop(0, 'rgba(255, 220, 150, 0)');
    hGrad.addColorStop(0.3, 'rgba(255, 230, 180, 0.3)');
    hGrad.addColorStop(0.5, 'rgba(255, 255, 220, 0.6)');
    hGrad.addColorStop(0.7, 'rgba(255, 230, 180, 0.3)');
    hGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
    
    flareCtx.fillStyle = hGrad;
    flareCtx.fillRect(0, 240, 512, 32);
    
    // Vertical flare
    const vGrad = flareCtx.createLinearGradient(256, 0, 256, 512);
    vGrad.addColorStop(0, 'rgba(255, 220, 150, 0)');
    vGrad.addColorStop(0.3, 'rgba(255, 230, 180, 0.3)');
    vGrad.addColorStop(0.5, 'rgba(255, 255, 220, 0.6)');
    vGrad.addColorStop(0.7, 'rgba(255, 230, 180, 0.3)');
    vGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
    
    flareCtx.fillStyle = vGrad;
    flareCtx.fillRect(240, 0, 32, 512);
    
    setFlareTexture(new THREE.CanvasTexture(flareCanvas));
  }, []);
  
  // Animate sun rays
  useFrame((state) => {
    if (groupRef.current) {
      // Rotate rays slowly
      groupRef.current.children.forEach((child, i) => {
        if (child.name === 'ray') {
          child.rotation.z = state.clock.elapsedTime * 0.05 * (i % 2 === 0 ? 1 : -1);
        }
      });
    }
  });
  
  return (
    <group position={position} ref={groupRef}>
      {/* Directional light */}
      <directionalLight
        position={[0, 0, 100]}
        intensity={1.5}
        color="#fff5e6"
        target-position={[0, 0, 0]}
      />
      
      {/* Point light for glow */}
      <pointLight
        intensity={0.8}
        color="#ffcc66"
        distance={5000}
        decay={2}
      />
      
      {/* Main sun core */}
      <sprite scale={[200, 200, 1]}>
        <spriteMaterial 
          map={sunTexture}
          color="#ffffff"
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={true}
        />
      </sprite>
      
      {/* Inner glow */}
      <sprite scale={[400, 400, 1]}>
        <spriteMaterial 
          map={sunTexture}
          color="#ffcc00"
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={true}
        />
      </sprite>
      
      {/* Lens flare cross - only render if texture is loaded */}
      {flareTexture && (
        <sprite scale={[1000, 1000, 1]} name="ray">
          <spriteMaterial 
            map={flareTexture}
            color="#ffffff"
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={true}
          />
        </sprite>
      )}
      
      {/* Secondary flare rotated */}
      {flareTexture && (
        <sprite scale={[800, 800, 1]} rotation={[0, 0, Math.PI / 4]} name="ray">
          <spriteMaterial 
            map={flareTexture}
            color="#ffee88"
            opacity={0.25}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={true}
          />
        </sprite>
      )}
      
      {/* Outer halo */}
      <sprite scale={[600, 600, 1]}>
        <spriteMaterial 
          map={sunTexture}
          color="#ff9900"
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={true}
        />
      </sprite>
    </group>
  );
}

interface MoonProps {
  planetRadius: number;
  orbitRadius: number;
  orbitSpeed: number;
}

export function Moon({ planetRadius, orbitRadius, orbitSpeed }: MoonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const moonMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      // Slower orbit around planet
      groupRef.current.rotation.y = state.clock.elapsedTime * orbitSpeed * 0.7;
    }
    
    if (meshRef.current) {
      // Even slower rotation
      meshRef.current.rotation.y = state.clock.elapsedTime * orbitSpeed * 0.3;
      
      // Update moon material based on sun direction (darker on far side)
      if (moonMaterialRef.current) {
        // Simple approximation of moon phase lighting
        const moonAngle = state.clock.elapsedTime * orbitSpeed * 0.7;
        const sunAngle = state.clock.elapsedTime * 0.05; // Match sun rotation speed
        const phase = Math.cos(moonAngle - sunAngle);
        
        // Much darker on far side
        moonMaterialRef.current.emissiveIntensity = Math.max(0, phase * 0.05);
        // Also adjust main color darkness
        const brightness = 0.3 + Math.max(0, phase) * 0.7;
        moonMaterialRef.current.color = new THREE.Color(brightness * 0.7, brightness * 0.7, brightness * 0.7);
      }
    }
  });
  
  const moonRadius = planetRadius * 0.22; // Smaller moon
  
  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} position={[orbitRadius, 50, 0]} castShadow receiveShadow>
        <sphereGeometry args={[moonRadius, 32, 32]} />
        <meshStandardMaterial
          ref={moonMaterialRef}
          color="#808080"
          roughness={0.95}
          metalness={0.02}
          emissive="#050505"
          emissiveIntensity={0.02}
          bumpScale={0.02}
        >
          {/* Add procedural bump map for moon craters */}
          <canvasTexture
            attach="bumpMap"
            image={(() => {
              const canvas = document.createElement('canvas');
              canvas.width = 512;
              canvas.height = 512;
              const ctx = canvas.getContext('2d')!;
              
              // Base gray surface
              ctx.fillStyle = '#808080';
              ctx.fillRect(0, 0, 512, 512);
              
              // Add noise for rough surface
              const imageData = ctx.getImageData(0, 0, 512, 512);
              const data = imageData.data;
              
              // Simple noise function
              for (let i = 0; i < data.length; i += 4) {
                const noise = Math.random() * 40 - 20;
                data[i] = Math.max(0, Math.min(255, data[i] + noise));
                data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
                data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
              }
              ctx.putImageData(imageData, 0, 0);
              
              // Add large craters first
              const largeCraters = [
                { x: 100, y: 150, r: 40 },
                { x: 350, y: 200, r: 50 },
                { x: 250, y: 400, r: 35 },
                { x: 400, y: 100, r: 45 },
                { x: 150, y: 350, r: 38 }
              ];
              
              for (const crater of largeCraters) {
                // Crater rim (raised edge)
                const rimGradient = ctx.createRadialGradient(
                  crater.x, crater.y, crater.r * 0.7,
                  crater.x, crater.y, crater.r
                );
                rimGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
                rimGradient.addColorStop(0.8, 'rgba(160, 160, 160, 0.5)');
                rimGradient.addColorStop(1, 'rgba(200, 200, 200, 0.8)');
                
                ctx.fillStyle = rimGradient;
                ctx.beginPath();
                ctx.arc(crater.x, crater.y, crater.r, 0, Math.PI * 2);
                ctx.fill();
                
                // Crater depression (dark center)
                const depthGradient = ctx.createRadialGradient(
                  crater.x, crater.y, 0,
                  crater.x, crater.y, crater.r * 0.8
                );
                depthGradient.addColorStop(0, 'rgba(20, 20, 20, 0.9)');
                depthGradient.addColorStop(0.5, 'rgba(40, 40, 40, 0.6)');
                depthGradient.addColorStop(1, 'rgba(80, 80, 80, 0.2)');
                
                ctx.fillStyle = depthGradient;
                ctx.beginPath();
                ctx.arc(crater.x, crater.y, crater.r * 0.8, 0, Math.PI * 2);
                ctx.fill();
              }
              
              // Add medium and small craters
              for (let i = 0; i < 25; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const radius = Math.random() * 20 + 10;
                
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, 'rgba(30, 30, 30, 0.7)');
                gradient.addColorStop(0.6, 'rgba(60, 60, 60, 0.4)');
                gradient.addColorStop(1, 'rgba(128, 128, 128, 0.1)');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
              }
              
              return canvas;
            })()}
          />
        </meshStandardMaterial>
      </mesh>
    </group>
  );
}

interface OrbitLineProps {
  radius: number;
  color?: string;
  opacity?: number;
}

export function OrbitLine({ radius, color = '#ffffff', opacity = 0.2 }: OrbitLineProps) {
  const points = [];
  const segments = 64;
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    ));
  }
  
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}