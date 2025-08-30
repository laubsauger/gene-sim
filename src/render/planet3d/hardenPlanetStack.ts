import * as THREE from 'three';

export function hardenPlanetStack({
  planetMesh,
  entitiesMesh,
  cloudMesh,
  atmosphereMesh,
}: {
  planetMesh: THREE.Mesh;
  entitiesMesh?: THREE.InstancedMesh | null;
  cloudMesh?: THREE.Mesh | null;
  atmosphereMesh?: THREE.Mesh | null;
}) {
  // 1) SURFACE — must be opaque + depth writing
  if (planetMesh && planetMesh.material) {
    const mat = planetMesh.material as THREE.Material;
    mat.transparent = false;
    mat.depthTest = true;
    mat.depthWrite = true;
    planetMesh.renderOrder = 0;
  }

  // 2) ENTITIES — opaque instancing (writes depth)
  if (entitiesMesh && entitiesMesh.material) {
    const mat = entitiesMesh.material as THREE.Material;
    mat.transparent = false;
    mat.depthTest = true;
    mat.depthWrite = true;
    entitiesMesh.renderOrder = 1;
  }

  // 3) CLOUDS — transparent, depth-test, no depth write
  if (cloudMesh && cloudMesh.material) {
    const mat = cloudMesh.material as THREE.Material;
    mat.transparent = true;
    mat.depthTest = true;
    mat.depthWrite = false;
    cloudMesh.renderOrder = 2;
  }

  // 4) ATMOSPHERE — additive, BackSide, depth-test, no depth write
  if (atmosphereMesh && atmosphereMesh.material) {
    const mat = atmosphereMesh.material as THREE.Material;
    mat.transparent = true;
    mat.depthTest = true;
    mat.depthWrite = false;
    if ('blending' in mat) {
      (mat as any).blending = THREE.AdditiveBlending;
    }
    if ('side' in mat) {
      (mat as any).side = THREE.BackSide;
    }
    atmosphereMesh.renderOrder = 3;
  }

  console.log('[HardenPlanetStack] Applied settings:', {
    planet: planetMesh ? { renderOrder: planetMesh.renderOrder, depthWrite: (planetMesh.material as any).depthWrite } : null,
    entities: entitiesMesh ? { renderOrder: entitiesMesh.renderOrder, depthWrite: (entitiesMesh.material as any).depthWrite } : null,
    clouds: cloudMesh ? { renderOrder: cloudMesh.renderOrder, depthWrite: (cloudMesh.material as any).depthWrite } : null,
    atmosphere: atmosphereMesh ? { renderOrder: atmosphereMesh.renderOrder, depthWrite: (atmosphereMesh.material as any).depthWrite } : null,
  });
}