import * as THREE from 'three';
import { BiomeType, BIOME_CONFIGS, BiomeGenerator } from '../../sim/biomes';

/**
 * Generates a texture for biome visualization on the planet surface
 * This is separated to allow GPU-efficient texture-based rendering
 */
export function createBiomeTexture(
  biomeGenerator: BiomeGenerator, 
  mode: 'natural' | 'highlight'
): THREE.CanvasTexture {
  const grid = biomeGenerator.getBiomeGrid();
  const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();
  
  // Create higher resolution texture for spherical mapping to reduce pixelation
  const textureWidth = gridWidth * 8;  // Increased from 4 to 8
  const textureHeight = gridHeight * 8; // Increased from 4 to 8
  
  const canvas = document.createElement('canvas');
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  
  // Fill biome texture with proper scaling
  // Add padding for poles (since we use 85% of latitude range)
  const poleHeight = Math.floor(textureHeight * 0.075); // 7.5% padding on each pole
  
  // Fill pole regions with ice cap colors
  // North pole - gradient from white to light blue
  const northGradient = ctx.createLinearGradient(0, 0, 0, poleHeight);
  northGradient.addColorStop(0, '#ffffff');    // Pure white at top
  northGradient.addColorStop(0.7, '#f0f8ff');  // Light ice blue
  northGradient.addColorStop(1, '#e0f0ff');    // Transition to main area
  ctx.fillStyle = northGradient;
  ctx.fillRect(0, 0, textureWidth, poleHeight);
  
  // South pole - similar gradient
  const southGradient = ctx.createLinearGradient(0, textureHeight - poleHeight, 0, textureHeight);
  southGradient.addColorStop(0, '#e0f0ff');    // Transition from main area
  southGradient.addColorStop(0.3, '#f0f8ff');  // Light ice blue
  southGradient.addColorStop(1, '#ffffff');    // Pure white at bottom
  ctx.fillStyle = southGradient;
  ctx.fillRect(0, textureHeight - poleHeight, textureWidth, poleHeight);
  
  // Fill the main biome area (85% of vertical space)
  const mainAreaStart = poleHeight;
  const mainAreaHeight = textureHeight - (2 * poleHeight);
  const scaleY = mainAreaHeight / gridHeight;
  
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      // Don't invert Y here - use grid directly as it matches world coordinates
      const biomeType = grid[y][x];
      const config = BIOME_CONFIGS[biomeType];
      let color = mode === 'highlight' ? 
        getHighlightColor(biomeType) : 
        config.color;
      
      // Add variation for natural mode
      if (mode === 'natural') {
        const hash = ((x * 374761393 + y * 668265263) >>> 0) / 0xffffffff;
        color = addBiomeVariation(biomeType, color, hash);
      }
      
      ctx.fillStyle = `#${color.getHexString()}`;
      // Scale and position within the 85% band with higher resolution
      const scaleFactor = 8; // Match the increased texture resolution
      ctx.fillRect(
        x * scaleFactor, 
        mainAreaStart + Math.floor(y * scaleY), 
        scaleFactor, 
        Math.ceil(scaleY)
      );
    }
  }
  
  // Apply smoothing for natural mode
  if (mode === 'natural') {
    applySmoothing(ctx, textureWidth, textureHeight);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping; // Clamp vertically to avoid pole artifacts
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  
  return texture;
}

function getHighlightColor(biomeType: BiomeType): THREE.Color {
  const colors: Record<BiomeType, string> = {
    [BiomeType.OCEAN]: '#0066cc',
    [BiomeType.GRASSLAND]: '#66ff66',
    [BiomeType.FOREST]: '#006600',
    [BiomeType.DESERT]: '#ffcc66',
    [BiomeType.SAVANNA]: '#cc9966',
    [BiomeType.MOUNTAIN]: '#666666'
  };
  return new THREE.Color(colors[biomeType]);
}

function addBiomeVariation(biomeType: BiomeType, baseColor: THREE.Color, hash: number): THREE.Color {
  const color = baseColor.clone();
  
  switch(biomeType) {
    case BiomeType.OCEAN:
      if (hash > 0.8) {
        color.lerp(new THREE.Color(0x0a2540), 0.3);
      } else if (hash > 0.95) {
        color.lerp(new THREE.Color(0x0f3050), 0.2);
      }
      break;
      
    case BiomeType.FOREST:
      if (hash > 0.7) {
        color.lerp(new THREE.Color(0x1a3a1a), 0.3);
      } else if (hash > 0.9) {
        color.lerp(new THREE.Color(0x2a5a2a), 0.2);
      }
      break;
      
    case BiomeType.DESERT:
      if (hash > 0.6) {
        color.lerp(new THREE.Color(0xf0d090), 0.3);
      } else if (hash < 0.2) {
        color.lerp(new THREE.Color(0xd0a050), 0.3);
      }
      break;
      
    case BiomeType.MOUNTAIN:
      if (hash > 0.8) {
        color.lerp(new THREE.Color(0x808080), 0.4);
      } else if (hash < 0.3) {
        color.lerp(new THREE.Color(0x1a1a1a), 0.3);
      }
      break;
      
    case BiomeType.GRASSLAND:
      if (hash > 0.85) {
        color.lerp(new THREE.Color(0x5aad4a), 0.3);
      } else if (hash < 0.15) {
        color.lerp(new THREE.Color(0x3a8d2a), 0.3);
      }
      break;
      
    case BiomeType.SAVANNA:
      if (hash > 0.8) {
        color.lerp(new THREE.Color(0xb88c5c), 0.3);
      } else if (hash < 0.2) {
        color.lerp(new THREE.Color(0x8a5c3c), 0.3);
      }
      break;
  }
  
  return color;
}

function applySmoothing(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const tempData = new Uint8ClampedArray(data);
  const blurRadius = 2;
  
  for (let y = blurRadius; y < height - blurRadius; y++) {
    for (let x = blurRadius; x < width - blurRadius; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let dy = -blurRadius; dy <= blurRadius; dy++) {
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          r += tempData[idx];
          g += tempData[idx + 1];
          b += tempData[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = r / count;
      data[idx + 1] = g / count;
      data[idx + 2] = b / count;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}