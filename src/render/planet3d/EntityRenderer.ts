import * as THREE from 'three';
import { PLANET_RADIUS, ENTITY_ALTITUDE } from './planetUtils';

export function updateEntitiesFromBuffers(
  mesh: THREE.InstancedMesh,
  pos: Float32Array,
  color: Uint8Array,
  alive: Uint8Array,
  count: number,
  worldWidth: number,
  worldHeight: number
) {
  const mat4 = new THREE.Matrix4();
  const vec3 = new THREE.Vector3();
  const col = new THREE.Color();
  const planetRadius = PLANET_RADIUS;
  const altitude = planetRadius + ENTITY_ALTITUDE;

  for (let i = 0; i < count; i++) {
    const isAlive = alive[i] > 0;
    
    if (isAlive) {
      const x = pos[i * 2];
      const y = pos[i * 2 + 1];
      const lon = (x / worldWidth) * Math.PI * 2;
      const lat = (y / worldHeight) * Math.PI - Math.PI / 2;
      
      const cosLat = Math.cos(lat);
      const px = altitude * cosLat * Math.cos(lon);
      const py = altitude * Math.sin(lat);
      const pz = altitude * cosLat * Math.sin(lon);
      vec3.set(px, py, pz);
      
      mat4.makeTranslation(px, py, pz);
      const scale = 0.002;
      mat4.scale(new THREE.Vector3(scale, scale, scale));
      mesh.setMatrixAt(i, mat4);
      
      const r = color[i * 3] / 255;
      const g = color[i * 3 + 1] / 255;
      const b = color[i * 3 + 2] / 255;
      col.setRGB(r, g, b);
      mesh.setColorAt(i, col);
    } else {
      mat4.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, mat4);
    }
  }
  
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

export function makeGroundEntities(count: number): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(1, 6, 4);
  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    emissive: new THREE.Color(0x111111),
    emissiveIntensity: 0.3,
    shininess: 5,
  });
  
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Initialize with zero scale
  const mat4 = new THREE.Matrix4();
  mat4.makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) {
    mesh.setMatrixAt(i, mat4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  
  return mesh;
}