import * as THREE from 'three';
import atmosphereMatVertexShader from './shader/atmosphereMat.vertex.glsl'
import atmosphereMatFragmentShader from './shader/atmosphereMat.frag.glsl'
// Planet now uses MeshStandardMaterial instead of custom shaders

export function makePlanetWithAtmosphere({
  radius = 1,
  atmosphereColor = new THREE.Color(0x78a6ff),
  mieColor = new THREE.Color(0xfff2d1),
  atmosphereThickness = 0.05, // Increased from 0.03 for better visibility
  anisotropy = 0.65,
  exposure = 1.2,
}: {
  radius?: number;
  atmosphereColor?: THREE.Color;
  mieColor?: THREE.Color;
  atmosphereThickness?: number;
  anisotropy?: number;
  exposure?: number;
}) {
  const group = new THREE.Group();
  const shared = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0).normalize() },
    uExposure: { value: exposure },
    uTime: { value: 0 },
  };

  // CRITICAL: Use MeshStandardMaterial for the base surface (opaque, writes depth properly)
  // The ShaderMaterial approach breaks depth writing in Three.js
  const planetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3a6f4f), // Base green color like before
    roughness: 0.9,
    metalness: 0.1,
    emissive: new THREE.Color(0x0a0f1a), // Slight dark blue emissive for night side
    emissiveIntensity: 0.1,
  });

  const planetGeo = new THREE.SphereGeometry(radius, 96, 64);
  const planetMesh = new THREE.Mesh(planetGeo, planetMat);
  planetMesh.frustumCulled = false;
  planetMesh.castShadow = true;
  planetMesh.receiveShadow = true;
  group.add(planetMesh); // Add back to group since depth works now

  // ----- Atmosphere (additive BackSide) - renderOrder 3 -----
  const atmUniforms = {
    ...shared,
    uPlanetRadius: { value: radius },
    uColorRayleigh: { value: new THREE.Color(atmosphereColor) },
    uColorMie: { value: new THREE.Color(mieColor) },
    uAnisotropy: { value: anisotropy },
    uRimPower: { value: 3.0 },
    uDensity: { value: 1.0 },
    uExposure: { value: exposure },
  };

  const atmosphereMat = new THREE.ShaderMaterial({
    uniforms: atmUniforms,
    transparent: true,
    depthWrite: false,  // Don't write depth (transparent layer)
    depthTest: true,    // Restore depth testing
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,  // Restore BackSide for proper rim effect
    vertexShader: atmosphereMatVertexShader,
    fragmentShader: atmosphereMatFragmentShader,
  });

  // Make atmosphere larger as requested - expand further out
  const atmosphereGeo = new THREE.SphereGeometry(radius * (1.0 + atmosphereThickness * 2.0), 96, 64);
  const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  atmosphereMesh.frustumCulled = false; // Always render atmosphere
  group.add(atmosphereMesh);

  function update({
    delta = 0.016,
    time = 0,
    directionalLight = null,
    cloudRotationSpeed = 0.02
  }: {
    delta?: number;
    time?: number;
    directionalLight?: THREE.DirectionalLight | null;
    cloudRotationSpeed?: number;
  }) {
    if (directionalLight) {
      const planetWorld = new THREE.Vector3();
      group.getWorldPosition(planetWorld);
      const lightPos = new THREE.Vector3();
      directionalLight.getWorldPosition(lightPos);
      shared.uLightDir.value.copy(lightPos.sub(planetWorld).normalize());
    }
    shared.uTime.value = time;

    // Rotate clouds slightly with cloudRotationSpeed
    const cloudMesh = group.children.find(child => child.userData.isCloud);
    if (cloudMesh) {
      cloudMesh.rotation.y += cloudRotationSpeed * delta;
    }
  }

  return {
    group,
    meshes: { planetMesh, atmosphereMesh },
    materials: { planetMat, atmosphereMat },
    uniforms: { shared, atmUniforms },
    update,
  };
}