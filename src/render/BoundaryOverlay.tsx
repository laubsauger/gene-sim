import { useMemo } from 'react';
import * as THREE from 'three';
import { BiomeGenerator } from '../sim/biomes';

interface BoundaryOverlayProps {
  biomeGenerator: BiomeGenerator;
  worldWidth: number;
  worldHeight: number;
}

export function BoundaryOverlay({ biomeGenerator, worldWidth, worldHeight }: BoundaryOverlayProps) {
  const meshes = useMemo(() => {
    const traversabilityMap = biomeGenerator.getTraversabilityMap();
    const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();
    const cellSize = biomeGenerator.getCellSize();
    
    // Thickness of the boundary lines
    const lineThickness = 8; // Thinner lines for cleaner look
    
    const rectangles: { x: number; y: number; width: number; height: number }[] = [];
    
    // Extract boundary edges and create rectangles
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const idx = y * gridWidth + x;
        const isTraversable = traversabilityMap[idx] === 1;
        
        if (!isTraversable) continue; // We only care about edges of traversable areas
        
        // Check each neighbor for boundaries
        // Right edge - place line at the boundary between cells
        if (x < gridWidth - 1) {
          const rightIdx = y * gridWidth + (x + 1);
          if (traversabilityMap[rightIdx] === 0) {
            // Line should be at the edge between cell x and x+1
            const worldX = (x + 1) * cellSize; // Right edge of current cell
            const worldY = worldHeight - (y + 0.5) * cellSize; // Center vertically in cell
            rectangles.push({
              x: worldX,
              y: worldY,
              width: lineThickness,
              height: cellSize
            });
          }
        }
        
        // Left edge - place line at the boundary between cells
        if (x > 0) {
          const leftIdx = y * gridWidth + (x - 1);
          if (traversabilityMap[leftIdx] === 0) {
            // Line should be at the edge between cell x-1 and x
            const worldX = x * cellSize; // Left edge of current cell
            const worldY = worldHeight - (y + 0.5) * cellSize; // Center vertically in cell
            rectangles.push({
              x: worldX,
              y: worldY,
              width: lineThickness,
              height: cellSize
            });
          }
        }
        
        // Top edge (in grid space, which is bottom in world space due to flip)
        if (y < gridHeight - 1) {
          const topIdx = (y + 1) * gridWidth + x;
          if (traversabilityMap[topIdx] === 0) {
            // Line should be at the edge between cell y and y+1
            const worldX = (x + 0.5) * cellSize; // Center horizontally in cell
            const worldY = worldHeight - (y + 1) * cellSize; // Bottom edge of current cell (flipped)
            rectangles.push({
              x: worldX,
              y: worldY,
              width: cellSize,
              height: lineThickness
            });
          }
        }
        
        // Bottom edge (in grid space, which is top in world space due to flip)
        if (y > 0) {
          const bottomIdx = (y - 1) * gridWidth + x;
          if (traversabilityMap[bottomIdx] === 0) {
            // Line should be at the edge between cell y-1 and y
            const worldX = (x + 0.5) * cellSize; // Center horizontally in cell
            const worldY = worldHeight - y * cellSize; // Top edge of current cell (flipped)
            rectangles.push({
              x: worldX,
              y: worldY,
              width: cellSize,
              height: lineThickness
            });
          }
        }
      }
    }
    
    // Merge adjacent rectangles for better performance
    const mergedRectangles = mergeAdjacentRectangles(rectangles);
    
    return mergedRectangles;
  }, [biomeGenerator, worldWidth, worldHeight]);
  
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({ 
      color: 0xff6b35,  // Alert orange for high visibility
      opacity: 1.0,
      transparent: false,  // No transparency for cleaner look
      side: THREE.DoubleSide
    });
  }, []);
  
  return (
    <group>
      {meshes.map((rect, index) => (
        <mesh key={index} position={[rect.x, rect.y, 0.2]}>
          <planeGeometry args={[rect.width, rect.height]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// Helper function to merge adjacent rectangles
function mergeAdjacentRectangles(rectangles: { x: number; y: number; width: number; height: number }[]) {
  const merged: { x: number; y: number; width: number; height: number }[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < rectangles.length; i++) {
    if (used.has(i)) continue;
    
    let current = { ...rectangles[i] };
    used.add(i);
    
    // Try to extend horizontally
    let extended = true;
    while (extended) {
      extended = false;
      
      for (let j = 0; j < rectangles.length; j++) {
        if (used.has(j)) continue;
        
        const rect = rectangles[j];
        
        // Check if rectangles are horizontally adjacent and same size
        if (Math.abs(current.y - rect.y) < 1 && 
            Math.abs(current.height - rect.height) < 1) {
          
          // Check if they touch on the right
          if (Math.abs((current.x + current.width/2) - (rect.x - rect.width/2)) < 2) {
            // Extend current rectangle to include the new one
            const newRight = rect.x + rect.width/2;
            const currentLeft = current.x - current.width/2;
            current.width = newRight - currentLeft;
            current.x = (currentLeft + newRight) / 2;
            used.add(j);
            extended = true;
          }
          // Check if they touch on the left
          else if (Math.abs((current.x - current.width/2) - (rect.x + rect.width/2)) < 2) {
            // Extend current rectangle to include the new one
            const newLeft = rect.x - rect.width/2;
            const currentRight = current.x + current.width/2;
            current.width = currentRight - newLeft;
            current.x = (newLeft + currentRight) / 2;
            used.add(j);
            extended = true;
          }
        }
        
        // Check if rectangles are vertically adjacent and same size
        if (Math.abs(current.x - rect.x) < 1 && 
            Math.abs(current.width - rect.width) < 1) {
          
          // Check if they touch on the top
          if (Math.abs((current.y + current.height/2) - (rect.y - rect.height/2)) < 2) {
            // Extend current rectangle to include the new one
            const newTop = rect.y + rect.height/2;
            const currentBottom = current.y - current.height/2;
            current.height = newTop - currentBottom;
            current.y = (currentBottom + newTop) / 2;
            used.add(j);
            extended = true;
          }
          // Check if they touch on the bottom
          else if (Math.abs((current.y - current.height/2) - (rect.y + rect.height/2)) < 2) {
            // Extend current rectangle to include the new one
            const newBottom = rect.y - rect.height/2;
            const currentTop = current.y + current.height/2;
            current.height = currentTop - newBottom;
            current.y = (newBottom + currentTop) / 2;
            used.add(j);
            extended = true;
          }
        }
      }
    }
    
    merged.push(current);
  }
  
  return merged;
}