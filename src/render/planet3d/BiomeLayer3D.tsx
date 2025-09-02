import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BiomeType, BIOME_CONFIGS, BiomeGenerator } from '../../sim/biomes';

interface BiomeLayer3DProps {
  biomeGenerator: BiomeGenerator;
  radius: number;
}

export function BiomeLayer3D({ biomeGenerator, radius }: BiomeLayer3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    const grid = biomeGenerator.getBiomeGrid();
    const { width: gridWidth, height: gridHeight } = biomeGenerator.getGridDimensions();

    const canvas = document.createElement('canvas');
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext('2d')!;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const biomeType = grid[y][x];
        const biomeConfig = BIOME_CONFIGS[biomeType];
        const color = biomeConfig.color;

        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const geometry = new THREE.SphereGeometry(radius * 0.99, 64, 32);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8
    });

    return { geometry, material };
  }, [biomeGenerator, radius]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      if (material.map) material.map.dispose();
    };
  }, [geometry, material]);

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
}