import * as THREE from 'three';

// Shared constants for the 3D planet system
export const PLANET_RADIUS = 1.0;
export const ATMOSPHERE_THICKNESS = 0.035;
export const EARTH_ORBIT_RADIUS = 50.0;  // Much further from larger sun for epic scale
export const EARTH_ORBIT_SPEED = 0.010;  // Slower for more majestic movement
export const EARTH_ROTATION_SPEED = 0.05; // Slower day/night cycle for better visibility
export const MOON_ORBIT_RADIUS = 4;  // Slightly closer for better composition
export const MOON_ORBIT_SPEED = 0.15;  // Faster moon orbit for visual interest
export const MOON_RADIUS = 0.25;  // Slightly smaller for better visual balance

// Venus configuration (closer to sun, similar size to Earth)
export const VENUS_ORBIT_RADIUS = 28.0;  // ~56% of Earth's distance for more spacing
export const VENUS_RADIUS = 0.95;  // 95% of Earth's size
export const VENUS_ORBIT_SPEED = 0.018;  // Faster than Earth (closer = faster orbit)
export const VENUS_ROTATION_SPEED = -0.002;  // Venus rotates backwards and very slowly
export const VENUS_COLOR = 0xFFD700;  // Yellowish color due to sulfuric clouds
export const VENUS_ATMOSPHERE_COLOR = 0xFFA500;  // Orange-yellow atmosphere

// Mars configuration (further from sun, smaller than Earth)
export const MARS_ORBIT_RADIUS = 75.0;  // 150% of Earth's distance with good spacing
export const MARS_RADIUS = 0.53;  // 53% of Earth's size
export const MARS_ORBIT_SPEED = 0.006;  // Slower than Earth (further = slower orbit)
export const MARS_ROTATION_SPEED = 0.048;  // Similar day length to Earth
export const MARS_COLOR = 0xCD5C5C;  // Rusty red color
export const MARS_ATMOSPHERE_COLOR = 0xFF6B6B;  // Thin reddish atmosphere
export const ENTITY_ALTITUDE = 0.0015; // Offset to avoid z-fighting
export const CLOUD_ROTATION_SPEED = 0.05;  // Even slower cloud rotation for more realistic movement
export const CLOUD_ALTITUDE = 0.02; // Cloud layer altitude above surface
export const AXIAL_TILT = 23.5 * Math.PI / 180; // Earth's axial tilt relative to ecliptic
export const MOON_ORBITAL_INCLINATION = 5.14 * Math.PI / 180; // Moon's orbit tilt from ecliptic

// Sun configuration (stylized for visual appeal)
export const SUN_DISTANCE = 0;  // Sun at origin
export const SUN_HEIGHT = 0;  // Sun at origin
export const SUN_RADIUS = 15.0;  // Much larger sun for epic star appearance
export const SUN_COLOR = 0xfff5e6;
export const SUN_INTENSITY = 3.2;  // Brighter for larger sun

// Moon configuration
export const MOON_COLOR = 0xc0c0c0;
export const MOON_EMISSIVE = 0x101010;

// Entity rendering
export const ENTITY_SCALE = 0.002;
export const MAX_ENTITIES = 100000;

// Camera configuration for stylized system
export const INITIAL_CAMERA_POSITION: [number, number, number] = [
  EARTH_ORBIT_RADIUS + PLANET_RADIUS * 20,  // Start with view of Earth and some sun
  PLANET_RADIUS * 10,
  PLANET_RADIUS * 20
];

export const CAMERA_CONFIG = {
  fov: 60,
  near: 0.01,
  far: 20000,
  minDistance: PLANET_RADIUS * 1.15,  // Prevent clipping through planet
  maxDistance: MARS_ORBIT_RADIUS * 3,  // Allow zooming out to see full system including Mars
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