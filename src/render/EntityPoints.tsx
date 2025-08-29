import * as THREE from 'three';
import { useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface EntityPointsProps {
  pos: Float32Array;
  color: Uint8Array;
  alive: Uint8Array;
  age?: Float32Array | null;
  count: number;
  pointSize?: number;
}

export function EntityPoints({ 
  pos, 
  color, 
  alive,
  age,
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
      attribute float aAge;
      varying vec3 vColor;
      varying float vAlive;
      uniform float uSize;
      
      void main() {
        // Pass normalized color (aCol is already 0-1 due to normalized=true)
        vColor = aCol;
        vAlive = aAlive;
        vec4 mvPosition = modelViewMatrix * vec4(aPos, 0.0, 1.0);

        // Scale point size based on age (young small, old larger)
        float ageInDays = aAge / 10.0; // Convert to days
        float ageFactor = 1.0;
        if (ageInDays < 2.0) {
          ageFactor = 0.9; // Young - slightly smaller
        } else if (ageInDays < 4.0) {
          ageFactor = 1.0; // Adult - normal
        } else if (ageInDays < 6.0) {
          ageFactor = 1.05; // Old - slightly larger
        } else {
          ageFactor = 1.1; // Very old - bit larger
        }

        // Account for perspective - make points scale with distance
        // For orthographic camera, this will be constant
        float perspectiveFactor = 1.0;
        #ifdef USE_PERSPECTIVE
          perspectiveFactor = 300.0 / -mvPosition.z;
        #endif
        
        // Base size is more important than age variation
        // Debug: Set a minimum size to ensure visibility
        gl_PointSize = max(2.0, uSize * perspectiveFactor * ageFactor);
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
    
    // Add age attribute if available
    if (age) {
      const ageAttr = new THREE.BufferAttribute(age, 1);
      ageAttr.usage = THREE.DynamicDrawUsage;
      geom.setAttribute('aAge', ageAttr);
    }

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
    if (age) {
      geom.attributes.aAge.needsUpdate = true;
    }
  }, [geom, pos, color, alive, age, count]);

  // Update every frame to reflect SharedArrayBuffer changes
  const { camera } = useThree();
  useFrame(() => {
    const posAttr = geom.getAttribute('aPos') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('aCol') as THREE.BufferAttribute;
    const aliveAttr = geom.getAttribute('aAlive') as THREE.BufferAttribute;
    const ageAttr = geom.getAttribute('aAge') as THREE.BufferAttribute;
    
    if (posAttr && colAttr && aliveAttr) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      aliveAttr.needsUpdate = true;
      if (ageAttr) {
        ageAttr.needsUpdate = true;
      }
      geom.setDrawRange(0, count);
    }

    // Scale point size based on camera zoom (for OrthographicCamera)
    if (camera && 'zoom' in camera) {
      // Use the pointSize prop as the base size (from UI slider)
      const zoom = (camera as THREE.OrthographicCamera).zoom;
      // Scale proportionally with zoom - entities maintain relative size to world
      const scaledSize = pointSize * zoom;
      mat.uniforms.uSize.value = Math.max(4, Math.min(200, scaledSize));
    }
  });

  return (
    <points frustumCulled={false}>
      <primitive object={geom} attach="geometry" />
      <primitive object={mat} attach="material" />
    </points>
  );
}