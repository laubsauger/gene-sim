import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlanet3DStore } from '../../stores/usePlanet3DStore';

interface LensFlareProps {
  sunPosition: THREE.Vector3;
  intensity?: number;
}

export function LensFlareEffect({ sunPosition, intensity = 1.0 }: LensFlareProps) {
  const { camera, gl } = useThree();
  const showLensFlare = usePlanet3DStore(state => state.showLensFlare);
  const lensFlareIntensity = usePlanet3DStore(state => state.lensFlareIntensity);
  
  const spritesRef = useRef<THREE.Group>(null);
  
  // Create lens flare sprites
  const sprites = useMemo(() => {
    const group = new THREE.Group();
    
    // Define flare elements with different sizes, colors, and positions along the axis
    const flareElements = [
      { size: 0.5, color: new THREE.Color(1.0, 0.95, 0.8), distance: 0, opacity: 0.6 }, // Main bright flare
      { size: 0.3, color: new THREE.Color(1.0, 0.8, 0.4), distance: 0.2, opacity: 0.4 },
      { size: 0.2, color: new THREE.Color(0.8, 0.6, 1.0), distance: 0.4, opacity: 0.3 },
      { size: 0.15, color: new THREE.Color(0.6, 0.8, 1.0), distance: 0.6, opacity: 0.3 },
      { size: 0.25, color: new THREE.Color(1.0, 0.6, 0.3), distance: 0.8, opacity: 0.35 },
      { size: 0.1, color: new THREE.Color(0.7, 0.9, 1.0), distance: 1.0, opacity: 0.2 },
      { size: 0.08, color: new THREE.Color(1.0, 0.7, 0.5), distance: 1.2, opacity: 0.2 },
    ];
    
    flareElements.forEach((element) => {
      const geometry = new THREE.PlaneGeometry(element.size, element.size);
      const material = new THREE.MeshBasicMaterial({
        color: element.color,
        transparent: true,
        opacity: element.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      
      const sprite = new THREE.Mesh(geometry, material);
      sprite.userData = { distance: element.distance, baseOpacity: element.opacity };
      group.add(sprite);
    });
    
    return group;
  }, []);
  
  useFrame(() => {
    if (!spritesRef.current || !showLensFlare) return;
    
    // Calculate sun position in screen space
    const sunScreenPos = sunPosition.clone();
    sunScreenPos.project(camera);
    
    // Check if sun is in front of camera
    if (sunScreenPos.z > 1) {
      spritesRef.current.visible = false;
      return;
    }
    
    spritesRef.current.visible = true;
    
    // Calculate center of screen (0, 0 in NDC)
    const screenCenter = new THREE.Vector2(0, 0);
    const sunScreen2D = new THREE.Vector2(sunScreenPos.x, sunScreenPos.y);
    
    // Calculate the direction from sun to center
    const flareDirection = screenCenter.clone().sub(sunScreen2D);
    
    // Calculate distance-based fade (fade out near edges)
    const distanceFromCenter = sunScreen2D.length();
    const edgeFade = Math.max(0, 1 - distanceFromCenter / 1.5);
    
    // Position each flare element along the axis
    spritesRef.current.children.forEach((sprite, index) => {
      const userData = sprite.userData as { distance: number; baseOpacity: number };
      
      // Position along the flare axis
      const flarePos = sunScreen2D.clone().add(
        flareDirection.clone().multiplyScalar(userData.distance)
      );
      
      // Convert back to 3D position
      sprite.position.set(flarePos.x * 2, flarePos.y * 2, -1);
      
      // Look at camera
      sprite.lookAt(camera.position);
      
      // Adjust opacity based on edge fade and intensity
      if (sprite.material instanceof THREE.MeshBasicMaterial) {
        sprite.material.opacity = userData.baseOpacity * edgeFade * intensity * lensFlareIntensity;
      }
      
      // Scale based on distance (subtle scaling)
      const scaleFactor = 1.0 + (1.0 - userData.distance) * 0.3;
      sprite.scale.setScalar(scaleFactor);
    });
  });
  
  if (!showLensFlare) return null;
  
  return (
    <group ref={spritesRef}>
      <primitive object={sprites} />
    </group>
  );
}