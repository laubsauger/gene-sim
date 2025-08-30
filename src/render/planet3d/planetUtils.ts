import * as THREE from 'three';

// Shared constants for the 3D planet system
export const PLANET_RADIUS = 1.0;
export const ATMOSPHERE_THICKNESS = 0.035;
export const EARTH_ORBIT_RADIUS = 8.0;
export const EARTH_ORBIT_SPEED = 0.05;
export const EARTH_ROTATION_SPEED = 0.1; // Day/night cycle
export const MOON_ORBIT_RADIUS = 2.2;
export const MOON_ORBIT_SPEED = 0.4;
export const MOON_RADIUS = 0.27;
export const ENTITY_ALTITUDE = 0.0015; // Offset to avoid z-fighting
export const CLOUD_ROTATION_SPEED = 0.01;
export const CLOUD_ALTITUDE = 0.02; // Cloud layer altitude above surface
export const AXIAL_TILT = 23.5 * Math.PI / 180; // Earth's axial tilt

// Sun configuration
export const SUN_DISTANCE = 30;
export const SUN_HEIGHT = 15;
export const SUN_RADIUS = 0.8;
export const SUN_COLOR = 0xfff5e6;
export const SUN_INTENSITY = 2.2;

// Moon configuration
export const MOON_COLOR = 0xc0c0c0;
export const MOON_EMISSIVE = 0x101010;

// Entity rendering
export const ENTITY_SCALE = 0.002;
export const MAX_ENTITIES = 100000;

// Camera configuration matching Scene3D
export const INITIAL_CAMERA_POSITION: [number, number, number] = [
  PLANET_RADIUS * 2.5,
  PLANET_RADIUS * 0.5,
  PLANET_RADIUS * 2.5
];

export const CAMERA_CONFIG = {
  fov: 60,
  near: 0.01,
  far: 1000,
  minDistance: PLANET_RADIUS * 1.2,
  maxDistance: PLANET_RADIUS * 5,
};

// Helper to calculate sun direction for a planet
export function setSunDirForPlanet(
  planetGroup: THREE.Group,
  sunObject3D: THREE.DirectionalLight | THREE.Object3D,
  destUniform: { value: THREE.Vector3 }
) {
  const planetWorld = new THREE.Vector3();
  planetGroup.getWorldPosition(planetWorld);
  const sunWorld = new THREE.Vector3();
  sunObject3D.getWorldPosition(sunWorld);
  // Direction from planet to sun for correct terminator
  destUniform.value.copy(sunWorld.sub(planetWorld).normalize());
}

// Helper to enforce render order
export function enforcePlanetLocalOrder(earth: any, cloudMesh: THREE.Mesh | null) {
  const { planetMesh, atmosphereMesh } = earth.meshes;
  const { planetMat, atmosphereMat } = earth.materials;

  // SURFACE - renderOrder 0
  planetMesh.renderOrder = 0;

  // Only set material properties if using ShaderMaterial
  if (planetMat.transparent !== undefined) {
    planetMat.transparent = false;
    planetMat.depthTest = true;
    planetMat.depthWrite = true;
  }

  // CLOUDS - renderOrder 2 (entities will be 1)
  if (cloudMesh) {
    cloudMesh.renderOrder = 2;

    if (cloudMesh.material && 'transparent' in cloudMesh.material) {
      (cloudMesh.material as THREE.Material).transparent = true;
      (cloudMesh.material as THREE.Material).depthTest = true;
      (cloudMesh.material as THREE.Material).depthWrite = false;
    }
  }

  // ATMOSPHERE - renderOrder 3
  if (atmosphereMesh) {
    atmosphereMesh.renderOrder = 3;
    atmosphereMat.transparent = true;
    atmosphereMat.depthTest = true;
    atmosphereMat.depthWrite = false;
    atmosphereMat.side = THREE.BackSide;
  }
}

export function updateCloudUniforms(
  cloudMesh: THREE.Mesh,
  { lightDir, time, rotationSpeed }: {
    lightDir: THREE.Vector3;
    time: number;
    rotationSpeed: number;
  }
) {
  const mat = cloudMesh.material as THREE.ShaderMaterial;
  const u = mat.uniforms;
  u.uLightDir.value.copy(lightDir);
  u.uTime.value = time;

  // Apply rotation
  cloudMesh.rotation.y += rotationSpeed * 0.016; // Assuming 60fps
}