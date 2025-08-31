import * as THREE from 'three';

// Shared constants for the 3D planet system
export const PLANET_RADIUS = 1.0;
export const ATMOSPHERE_THICKNESS = 0.035;
export const EARTH_ORBIT_RADIUS = 20.0;  // Further from large sun for proper scale
export const EARTH_ORBIT_SPEED = 0.015;  // Even slower for majestic movement
export const EARTH_ROTATION_SPEED = 0.05; // Slower day/night cycle for better visibility
export const MOON_ORBIT_RADIUS = 4;  // Slightly closer for better composition
export const MOON_ORBIT_SPEED = 0.15;  // Faster moon orbit for visual interest
export const MOON_RADIUS = 0.25;  // Slightly smaller for better visual balance
export const ENTITY_ALTITUDE = 0.0015; // Offset to avoid z-fighting
export const CLOUD_ROTATION_SPEED = 0.002;  // Even slower cloud rotation for more realistic movement
export const CLOUD_ALTITUDE = 0.02; // Cloud layer altitude above surface
export const AXIAL_TILT = 23.5 * Math.PI / 180; // Earth's axial tilt relative to ecliptic
export const MOON_ORBITAL_INCLINATION = 5.14 * Math.PI / 180; // Moon's orbit tilt from ecliptic

// Sun configuration (stylized for visual appeal)
export const SUN_DISTANCE = 0;  // Sun at origin
export const SUN_HEIGHT = 0;  // Sun at origin
export const SUN_RADIUS = 8.0;  // Much larger sun for realistic star appearance
export const SUN_COLOR = 0xfff5e6;
export const SUN_INTENSITY = 2.8;  // Brighter for larger sun

// Moon configuration
export const MOON_COLOR = 0xc0c0c0;
export const MOON_EMISSIVE = 0x101010;

// Entity rendering
export const ENTITY_SCALE = 0.002;
export const MAX_ENTITIES = 100000;

// Camera configuration for stylized system
export const INITIAL_CAMERA_POSITION: [number, number, number] = [
  PLANET_RADIUS * 8,  // Further back to see sun and Earth nicely
  PLANET_RADIUS * 4,
  PLANET_RADIUS * 8
];

export const CAMERA_CONFIG = {
  fov: 60,
  near: 0.01,
  far: 10000,
  minDistance: PLANET_RADIUS * 1.15,  // Prevent clipping through planet
  maxDistance: PLANET_RADIUS * 300,  // Allow zooming out twice as far to see full system
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