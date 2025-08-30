import * as THREE from 'three';
import { useMemo, useEffect, useRef } from 'react';
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
    transparent: false, // No transparency needed - all entities are opaque
    vertexShader: `
      attribute vec2 aPos;
      attribute vec3 aCol;
      attribute float aAlive;
      attribute float aAge;
      varying vec3 vColor;
      varying float vAlive;
      uniform float uSize;
      
      void main() {
        vAlive = aAlive;
        vec4 mvPosition = modelViewMatrix * vec4(aPos, 0.0, 1.0);

        // Age-based scale and brightness
        // Age transitions: 0-10 = newborn, 10-30 = young, 30-60 = adult, 60+ = old
        float ageValue = aAge;
        float scaleFactor = 0.8; // Start at 0.8x size
        float brightnessFactor = 0.8; // Start at 0.8 brightness
        
        if (ageValue < 10.0) {
          // Newborn to young: rapid growth
          float t = ageValue / 10.0;
          scaleFactor = 0.8 + 0.15 * t; // 0.8 to 0.95
          brightnessFactor = 0.8 + 0.15 * t; // 0.8 to 0.95
        } else if (ageValue < 30.0) {
          // Young to adult: slower growth
          float t = (ageValue - 10.0) / 20.0;
          scaleFactor = 0.95 + 0.05 * t; // 0.95 to 1.0
          brightnessFactor = 0.95 + 0.05 * t; // 0.95 to 1.0
        } else if (ageValue < 60.0) {
          // Adult: peak size and brightness
          scaleFactor = 1.0;
          brightnessFactor = 1.0;
        } else {
          // Old: slight dimming but maintain size
          float t = min(1.0, (ageValue - 60.0) / 40.0);
          scaleFactor = 1.0;
          brightnessFactor = 1.0 - 0.2 * t; // Fade to 0.8 brightness
        }
        
        // Apply brightness to color (not opacity)
        vColor = aCol * brightnessFactor;

        // Account for perspective - make points scale with distance
        // For orthographic camera, this will be constant
        float perspectiveFactor = 1.0;
        #ifdef USE_PERSPECTIVE
          perspectiveFactor = 300.0 / -mvPosition.z;
        #endif
        
        // Apply age-based scaling to point size
        gl_PointSize = max(1.5, uSize * perspectiveFactor * scaleFactor);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec3 vColor;
      varying float vAlive;
      
      void main() {
        if (vAlive < 0.5) discard;
        
        // Create circular point with outline
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float dist = dot(p, p);
        
        if (dist > 1.0) discard;
        
        // Create outline effect
        float outerRadius = 1.0;
        float innerRadius = 0.75; // Adjust for outline thickness
        float outlineStrength = 0.0;
        
        if (dist > innerRadius * innerRadius) {
          // We're in the outline region
          outlineStrength = 1.0;
        }
        
        // Mix between entity color and darker outline
        vec3 outlineColor = vColor * 0.3; // Darker version of entity color
        vec3 finalColor = mix(vColor, outlineColor, outlineStrength);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    uniforms: {
      uSize: { value: pointSize }
    },
  }), [pointSize]);

  // Create buffer attributes from SharedArrayBuffer views
  useEffect(() => {
    if (!pos || !color || !alive) {
      console.log('[EntityPoints] Missing buffers:', { hasPos: !!pos, hasColor: !!color, hasAlive: !!alive });
      return;
    }
    
    const aliveSum = alive.reduce((sum, val) => sum + val, 0);
    
    // Only log on significant changes or initial setup
    const shouldLog = !geom.attributes.aPos || Math.abs(aliveSum - (geom.userData?.lastAliveSum || 0)) > count * 0.1;
    if (shouldLog) {
      console.log('[EntityPoints] Updating buffers:', { 
        count, 
        posLength: pos.length, 
        colorLength: color.length,
        aliveLength: alive.length,
        aliveSum
      });
      geom.userData = { lastAliveSum: aliveSum };
      
      // Debug: Check where alive entities actually are
      let visibleCount = 0;
      for (let i = 0; i < Math.min(count, 120000); i++) {
        if (alive[i]) {
          const x = pos[i * 2];
          const y = pos[i * 2 + 1];
          if (x > -1000 && x < 5000 && y > -1000 && y < 5000) {
            visibleCount++;
            if (visibleCount <= 3) {
              console.log(`[EntityPoints] Alive entity at index ${i}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            }
          }
        }
      }
      console.log(`[EntityPoints] ${visibleCount} entities in visible range out of ${aliveSum} alive`);
    }
    
    // Debug: Check if entities are outside expected bounds - very infrequent
    if (shouldLog) {
      const positionsOutOfBounds = [];
      for (let i = 0; i < Math.min(count, 20); i++) { // Check only first 20 for performance
        if (alive[i]) {
          const x = pos[i * 2];
          const y = pos[i * 2 + 1];
          if (x < -100 || x > 4100 || y < -100 || y > 4100) { // World is 4000x4000, so slight margin
            positionsOutOfBounds.push({ i, x: x.toFixed(1), y: y.toFixed(1) });
          }
        }
      }
      if (positionsOutOfBounds.length > 0) {
        console.warn('[EntityPoints] Entities outside bounds:', positionsOutOfBounds);
      }
    }
    
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

  // Update buffers smartly based on what actually changes
  const { camera } = useThree();
  const frameCountRef = useRef(0);
  const lastZoomRef = useRef(0);
  
  useFrame(() => {
    frameCountRef.current++;
    
    const posAttr = geom.getAttribute('aPos') as THREE.BufferAttribute;
    const colAttr = geom.getAttribute('aCol') as THREE.BufferAttribute;
    const aliveAttr = geom.getAttribute('aAlive') as THREE.BufferAttribute;
    const ageAttr = geom.getAttribute('aAge') as THREE.BufferAttribute;
    
    if (posAttr && colAttr && aliveAttr) {
      // Position always updates (entities move every frame)
      posAttr.needsUpdate = true;
      
      // Color rarely changes - only on age transitions (slow) or mutations (rare)
      // Update every 60 frames (~1 Hz) is plenty for color changes
      if (frameCountRef.current % 60 === 0) {
        colAttr.needsUpdate = true;
      }
      
      // Alive status rarely changes - update every 30 frames (~2 Hz)
      if (frameCountRef.current % 30 === 0) {
        aliveAttr.needsUpdate = true;
      }
      
      // Age changes slowly - update every 60 frames (~1 Hz)
      if (ageAttr && frameCountRef.current % 60 === 0) {
        ageAttr.needsUpdate = true;
      }
      
      geom.setDrawRange(0, count);
    }

    // Only update point size when camera zoom actually changes
    if (camera && 'zoom' in camera) {
      const zoom = (camera as THREE.OrthographicCamera).zoom;
      if (Math.abs(zoom - lastZoomRef.current) > 0.001) {
        lastZoomRef.current = zoom;
        // Use square root scaling for more gentle size changes
        // This prevents entities from becoming too tiny when zoomed in
        const zoomFactor = Math.sqrt(zoom);
        const scaledSize = pointSize * zoomFactor * 1.5; // 1.5x multiplier for better visibility
        mat.uniforms.uSize.value = Math.max(2, Math.min(100, scaledSize));
      }
    }
  });

  return (
    <points frustumCulled={false}>
      <primitive object={geom} attach="geometry" />
      <primitive object={mat} attach="material" />
    </points>
  );
}