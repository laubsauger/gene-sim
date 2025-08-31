import * as THREE from 'three';
import { useMemo, useEffect, useLayoutEffect, useRef } from 'react';
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
  const initialSizeRef = useRef(pointSize);
  
  const mat = useMemo(() => {
    console.log('[EntityPoints] Creating material with initial size:', pointSize);
    return new THREE.ShaderMaterial({
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

        // Age-based scale and color adjustments
        // Age transitions: 0-10 = newborn, 10-30 = young, 30-60 = adult, 60+ = old
        float ageValue = aAge;
        float scaleFactor = 0.7; // Start at 0.7x size
        float lightnessFactor = 1.4; // Start lighter (1.4x brightness)
        
        if (ageValue < 10.0) {
          // Newborn to young: rapid growth, transition from light to normal
          float t = ageValue / 10.0;
          scaleFactor = 0.7 + 0.2 * t; // 0.7 to 0.9
          lightnessFactor = 1.4 - 0.3 * t; // 1.4 to 1.1 (lighter to normal)
        } else if (ageValue < 30.0) {
          // Young to adult: slower growth, continue darkening
          float t = (ageValue - 10.0) / 20.0;
          scaleFactor = 0.9 + 0.1 * t; // 0.9 to 1.0
          lightnessFactor = 1.1 - 0.1 * t; // 1.1 to 1.0
        } else if (ageValue < 60.0) {
          // Adult: peak size and normal color
          scaleFactor = 1.0;
          lightnessFactor = 1.0;
        } else {
          // Old: maintain size but darker colors
          float t = min(1.0, (ageValue - 60.0) / 40.0);
          scaleFactor = 1.0;
          lightnessFactor = 1.0 - 0.3 * t; // Darken to 0.7 brightness
        }
        
        // Color transitions based on age
        if (ageValue < 0.2) {
          // Very brief white birth flare (0.2 seconds)
          vec3 birthColor = vec3(0.95, 0.95, 1.0); // Slightly blue-tinted white
          float t = ageValue / 0.2; // Quick transition
          // Mix from white to lighter tribe color
          vec3 lightTribeColor = mix(aCol, vec3(1.0, 1.0, 1.0), 0.4); // 40% lighter
          vColor = mix(birthColor, lightTribeColor, t);
          scaleFactor = 0.5 + 0.2 * t; // Start very small
        } else if (ageValue < 10.0) {
          // Baby to young: lighter version of tribe color
          float t = (ageValue - 0.2) / 9.8;
          // Transition from 40% lighter to 15% lighter
          float lightness = 0.4 - 0.25 * t;
          vColor = mix(aCol, vec3(1.0, 1.0, 1.0), lightness);
          scaleFactor = 0.7 + 0.2 * t; // Grow to 0.9
        } else if (ageValue < 30.0) {
          // Young to adult: from slightly light to normal
          float t = (ageValue - 10.0) / 20.0;
          float lightness = 0.15 - 0.15 * t; // From 15% lighter to normal
          vColor = mix(aCol, vec3(1.0, 1.0, 1.0), lightness);
          scaleFactor = 0.9 + 0.1 * t; // Grow to full size
        } else if (ageValue < 60.0) {
          // Adult: normal tribe color
          vColor = aCol;
          scaleFactor = 1.0;
        } else {
          // Elder: darker tribe color
          float t = min(1.0, (ageValue - 60.0) / 40.0);
          vColor = aCol * (1.0 - 0.3 * t); // Darken up to 30%
          scaleFactor = 1.0;
        }

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
        uSize: { value: initialSizeRef.current } // Use the actual initial size
      },
    });
  }, []); // Only create material once

  // Update uniform immediately on mount and when pointSize changes
  useLayoutEffect(() => {
    mat.uniforms.uSize.value = pointSize;
    mat.needsUpdate = true;
    console.log('[EntityPoints] Setting size uniform to:', pointSize, 'Material exists:', !!mat);
  }, [pointSize, mat]);

  // Create buffer attributes from SharedArrayBuffer views
  useEffect(() => {  
    if (!pos || !color || !alive) {
      // console.log('[EntityPoints] Missing buffers:', { hasPos: !!pos, hasColor: !!color, hasAlive: !!alive });
      return;
    }
    
    const aliveSum = alive.reduce((sum, val) => sum + val, 0);
    
    // Only log on significant changes or initial setup
    const shouldLog = !geom.attributes.aPos || Math.abs(aliveSum - (geom.userData?.lastAliveSum || 0)) > count * 0.1;
    if (shouldLog) {
      // console.log('[EntityPoints] Updating buffers:', { 
      //   count,
      //   posLength: pos.length,
      //   colorLength: color.length,
      //   aliveLength: alive.length,
      //   aliveSum
      // });
      geom.userData = { lastAliveSum: aliveSum };
      
      // Debug: Check where alive entities actually are
      let visibleCount = 0;
      for (let i = 0; i < Math.min(count, 196000); i++) {
        if (alive[i]) {
          const x = pos[i * 2];
          const y = pos[i * 2 + 1];
          if (x > -1000 && x < 5000 && y > -1000 && y < 5000) {
            visibleCount++;
            // if (visibleCount <= 3) {
            //   console.log(`[EntityPoints] Alive entity at index ${i}: (${x.toFixed(1)}, ${y.toFixed(1)})`);
            // }
          }
        }
      }
      // console.log(`[EntityPoints] ${visibleCount} entities in visible range out of ${aliveSum} alive`);
    }
    
    // Debug: Check if entities are outside expected bounds - very infrequent
    if (shouldLog) {
      const positionsOutOfBounds = [];
      for (let i = 0; i < Math.min(count, 20); i++) { // Check only first 20 for performance
        if (alive[i]) {
          const x = pos[i * 2];
          const y = pos[i * 2 + 1];
          if (x < -100 || x > 10000 || y < -100 || y > 10000) { // Check for far out of bounds positions
            positionsOutOfBounds.push({ i, x: x.toFixed(1), y: y.toFixed(1) });
          }
        }
      }
      // if (positionsOutOfBounds.length > 0) {
      //   console.warn('[EntityPoints] Entities outside bounds:', positionsOutOfBounds);
      // }
    }
    
    // Always recreate attributes when buffers change to ensure updates
    const posAttr = new THREE.BufferAttribute(pos, 2);
    const colAttr = new THREE.BufferAttribute(color, 3, true); // normalized for colors
    const aliveAttr = new THREE.BufferAttribute(alive, 1);
    
    // Add age attribute if available, otherwise use a default
    if (age) {
      const ageAttr = new THREE.BufferAttribute(age, 1);
      ageAttr.usage = THREE.DynamicDrawUsage;
      geom.setAttribute('aAge', ageAttr);
    } else {
      // Create a default age buffer filled with zeros for newborns
      const defaultAge = new Float32Array(count);
      const ageAttr = new THREE.BufferAttribute(defaultAge, 1);
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