import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { BiomeGenerator } from '../../sim/biomes';
import { batchWorldToSphere } from '../utils/coordinateTransform';

interface BiomeBoundaries3DProps {
  biomeGenerator: BiomeGenerator;
  worldWidth: number;
  worldHeight: number;
  planetRadius: number;
}

export function BiomeBoundaries3D({
  biomeGenerator,
  worldWidth,
  worldHeight,
  planetRadius
}: BiomeBoundaries3DProps) {

  const boundaryLines = useMemo(() => {
    const boundaries = biomeGenerator.getBiomeBoundaries();
    const lines: THREE.Vector3[][] = [];
    const elevationOffset = planetRadius * 1.002; // Slightly above surface

    boundaries.forEach(boundary => {
      const points2D = new Float32Array(boundary.points.length * 2);

      // Convert boundary points to flat array
      boundary.points.forEach((point, i) => {
        points2D[i * 2] = point.x;
        points2D[i * 2 + 1] = point.y;
      });

      // Transform to 3D sphere coordinates
      const points3D = batchWorldToSphere(
        points2D,
        worldWidth,
        worldHeight,
        elevationOffset
      );

      // Convert to Vector3 array for Line component
      const linePoints: THREE.Vector3[] = [];
      for (let i = 0; i < points3D.length; i += 3) {
        linePoints.push(new THREE.Vector3(
          points3D[i],
          points3D[i + 1],
          points3D[i + 2]
        ));
      }

      // Close the loop if needed
      if (boundary.points.length > 2) {
        const first = linePoints[0];
        const last = linePoints[linePoints.length - 1];
        if (first.distanceTo(last) > 0.1) {
          linePoints.push(first.clone());
        }
      }

      lines.push(linePoints);
    });

    return lines;
  }, [biomeGenerator, worldWidth, worldHeight, planetRadius]);

  return (
    <group>
      {boundaryLines.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="#ffffff"
          lineWidth={1.5}
          opacity={0.4}
          transparent
          renderOrder={15} // Render above planet surface
        />
      ))}

      {/* Add glowing effect for major boundaries */}
      {boundaryLines.map((points, index) => (
        <Line
          key={`glow-${index}`}
          points={points}
          color="#88ccff"
          lineWidth={3}
          opacity={0.15}
          transparent
          renderOrder={14}
        />
      ))}
    </group>
  );
}