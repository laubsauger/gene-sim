import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BiomeType, BIOME_CONFIGS, BIOME_HIGHLIGHT_COLORS, BiomeGenerator } from '../sim/biomes';

interface BiomeLayerProps {
  biomeGenerator: BiomeGenerator;
  worldWidth: number;
  worldHeight: number;
  highlightMode?: boolean;
}

export function BiomeLayer({ biomeGenerator, worldWidth, worldHeight, highlightMode = false }: BiomeLayerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const { geometry, material } = useMemo(() => {
    const grid = biomeGenerator.getBiomeGrid();
    const cellSize = biomeGenerator.getCellSize();
    const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();
    
    const canvas = document.createElement('canvas');
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext('2d')!;
    
    // Create 16-bit sprite patterns for each biome
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const biomeType = grid[y][x];
        let color = highlightMode ? 
          BIOME_HIGHLIGHT_COLORS[biomeType] : 
          BIOME_CONFIGS[biomeType].color;
        
        // Use simple hash for pseudo-random variation
        const hash = ((x * 374761393 + y * 668265263) >>> 0) / 0xffffffff;
        const hash2 = ((x * 668265263 + y * 374761393) >>> 0) / 0xffffffff;
        
        if (!highlightMode) {
          // Add texture patterns for each biome type - 16-bit sprite style
          switch(biomeType) {
            case BiomeType.OCEAN:
              // Subtle wave pattern - much less noisy
              const wavePattern = Math.sin(x * 0.1 + y * 0.08) * 0.5 + 0.5;
              if (wavePattern > 0.7 && hash > 0.8) {
                color = new THREE.Color(0x0f2940); // Very subtle lighter water
              } else if (hash2 > 0.95) {
                color = new THREE.Color(0x0a1f30); // Subtle darker depth
              }
              break;
              
            case BiomeType.MOUNTAIN:
              // Darker rocky texture with subtle snow caps
              if (hash > 0.85) {
                color = new THREE.Color(0x4a4a4a); // Subtle snow cap - medium grey
              } else if (hash > 0.7) {
                color = new THREE.Color(0x353535); // Mid-tone rocky grey
              } else if (hash2 > 0.8) {
                color = new THREE.Color(0x1f1f1f); // Very dark crevices
              }
              // Subtle mountain ridges
              const mountainPattern = (x + y) % 4;
              if (mountainPattern === 0 && hash2 < 0.2) {
                color = new THREE.Color(0x252525); // Subtle shadow lines
              }
              break;
              
            case BiomeType.FOREST:
              // Tree canopy pattern
              const treePattern = ((x % 3) + (y % 3)) % 2;
              if (treePattern === 0 && hash > 0.4) {
                color = new THREE.Color(0x1f4a1f); // Darker tree shadows
              } else if (hash > 0.8) {
                color = new THREE.Color(0x3a6a3a); // Lighter tree tops
              }
              // Add occasional clearing
              if (hash2 > 0.95) {
                color = new THREE.Color(0x4a7a4a); // Small clearings
              }
              break;
              
            case BiomeType.GRASSLAND:
              // Grass texture with variation - vibrant green
              const grassPattern = (x + y * 2) % 4;
              if (grassPattern === 0 && hash > 0.3) {
                color = new THREE.Color(0x3a8d2a); // Darker grass patches
              } else if (hash > 0.9) {
                color = new THREE.Color(0x5aad4a); // Lighter grass/flowers
              }
              // Add path-like patterns
              if (hash2 > 0.93) {
                color = new THREE.Color(0x4a9d3a); // Worn paths (base color)
              }
              break;
              
            case BiomeType.DESERT:
              // Sand dune pattern - light sandy yellow
              const dunePattern = Math.sin(x * 0.3) * Math.cos(y * 0.3);
              if (dunePattern > 0.3 && hash > 0.4) {
                color = new THREE.Color(0xf0d090); // Dune highlights - lighter sand
              } else if (dunePattern < -0.3) {
                color = new THREE.Color(0xd0a050); // Dune shadows - darker sand
              }
              // Add occasional rocks
              if (hash2 > 0.96) {
                color = new THREE.Color(0x9a7a4a); // Desert rocks
              }
              break;
              
            case BiomeType.SAVANNA:
              // Dry grass with scattered trees pattern - reddish brown
              const savannaPattern = ((x * 2) % 5) + ((y * 2) % 5);
              if (savannaPattern === 0 && hash > 0.7) {
                color = new THREE.Color(0x8a5c3c); // Acacia tree shadows
              } else if (hash > 0.85) {
                color = new THREE.Color(0xb88c5c); // Dry grass highlights
              }
              // Add bare patches
              if (hash2 > 0.9) {
                color = new THREE.Color(0x986c3c); // Bare earth
              }
              break;
          }
        }
        
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    
    // Add grid lines in highlight mode for better visibility
    if (highlightMode) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 0.05;
      
      // Draw vertical lines every 10 cells
      for (let x = 0; x <= gridWidth; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gridHeight);
        ctx.stroke();
      }
      
      // Draw horizontal lines every 10 cells
      for (let y = 0; y <= gridHeight; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gridWidth, y);
        ctx.stroke();
      }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.flipY = true; // Need to flip Y to match coordinate system
    
    const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
    const material = new THREE.MeshBasicMaterial({ 
      map: texture,
      transparent: true,
      opacity: highlightMode ? 0.9 : 0.85
    });
    
    return { geometry, material };
  }, [biomeGenerator, worldWidth, worldHeight, highlightMode]);
  
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      if (material.map) material.map.dispose();
    };
  }, [geometry, material]);
  
  return (
    <mesh ref={meshRef} position={[worldWidth / 2, worldHeight / 2, -0.1]} geometry={geometry} material={material} />
  );
}