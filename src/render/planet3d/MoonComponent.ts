import * as THREE from 'three';
import { MOON_RADIUS, MOON_COLOR, MOON_EMISSIVE, MOON_ORBIT_RADIUS, MOON_ORBIT_SPEED } from './planetUtils';

export function makeMoon(planetRadius: number) {
  const group = new THREE.Group();
  const moonRadius = planetRadius * MOON_RADIUS;
  
  // Moon material - MUST be opaque for proper depth sorting
  const moonMat = new THREE.MeshStandardMaterial({
    color: MOON_COLOR,
    emissive: MOON_EMISSIVE,
    emissiveIntensity: 0.05,
    roughness: 0.9,
    metalness: 0.0,
    // CRITICAL: These ensure moon stays in opaque queue
    transparent: false,
    opacity: 1.0,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
  });

  // Moon geometry
  const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 24);
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.castShadow = true;
  moonMesh.receiveShadow = true;
  
  // Position moon at orbit radius
  moonMesh.position.set(planetRadius * MOON_ORBIT_RADIUS, 0, 0);
  
  group.add(moonMesh);
  
  return {
    group,
    mesh: moonMesh,
    material: moonMat,
    update: (time: number) => {
      // Orbit around planet
      group.rotation.y = time * MOON_ORBIT_SPEED;
      // Moon's own rotation (tidally locked would be same speed as orbit)
      moonMesh.rotation.y = time * MOON_ORBIT_SPEED;
    }
  };
}