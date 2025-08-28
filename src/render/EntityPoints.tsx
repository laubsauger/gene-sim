import * as THREE from 'three';
import React, { useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

interface EntityPointsProps {
  pos: Float32Array;
  color: Uint8Array;
  alive: Uint8Array;
  count: number;
  pointSize?: number;
}

export function EntityPoints({ 
  pos, 
  color, 
  alive, 
  count, 
  pointSize = 2 
}: EntityPointsProps) {
  const geom = useMemo(() => new THREE.BufferGeometry(), []);
  
  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: true,
    depthTest: true,
    transparent: true,
    vertexShader: `
      attribute vec2 aPos;
      attribute vec3 aCol;
      attribute float aAlive;
      varying vec3 vColor;
      varying float vAlive;
      uniform float uSize;
      
      void main() {
        // Pass normalized color (aCol is already 0-1 due to normalized=true)
        vColor = aCol;
        vAlive = aAlive;
        vec4 mvPosition = modelViewMatrix * vec4(aPos, 0.0, 1.0);
        gl_PointSize = uSize;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlive;
      
      void main() {
        if (vAlive < 0.5) discard;
        
        // Create circular point
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        if (dot(p, p) > 1.0) discard;
        
        // Use color directly (already normalized from attribute)
        gl_FragColor = vec4(vColor, 1.0);
      }
    `,
    uniforms: {
      uSize: { value: pointSize }
    },
  }), [pointSize]);

  // Create buffer attributes from SharedArrayBuffer views
  useEffect(() => {
    if (!pos || !color || !alive) return;
    
    // Always recreate attributes when buffers change to ensure updates
    const posAttr = new THREE.BufferAttribute(pos, 2);
    const colAttr = new THREE.BufferAttribute(color, 3, true); // normalized for colors
    const aliveAttr = new THREE.BufferAttribute(alive, 1);
    
    // Set usage to dynamic since data changes every frame
    posAttr.usage = THREE.DynamicDrawUsage;
    colAttr.usage = THREE.DynamicDrawUsage;
    aliveAttr.usage = THREE.DynamicDrawUsage;
    
    geom.setAttribute('aPos', posAttr);
    geom.setAttribute('aCol', colAttr);
    geom.setAttribute('aAlive', aliveAttr);
    geom.setDrawRange(0, count);
    
    // Force immediate update
    geom.attributes.aPos.needsUpdate = true;
    geom.attributes.aCol.needsUpdate = true;
    geom.attributes.aAlive.needsUpdate = true;
  }, [geom, pos, color, alive, count]);

  // Update every frame to reflect SharedArrayBuffer changes
  useFrame(() => {
    const posAttr = geom.getAttribute('aPos') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('aCol') as THREE.BufferAttribute;
    const aliveAttr = geom.getAttribute('aAlive') as THREE.BufferAttribute;
    
    if (posAttr && colAttr && aliveAttr) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      aliveAttr.needsUpdate = true;
      geom.setDrawRange(0, count);
    }
  });

  return (
    <points frustumCulled={false}>
      <primitive object={geom} attach="geometry" />
      <primitive object={mat} attach="material" />
    </points>
  );
}