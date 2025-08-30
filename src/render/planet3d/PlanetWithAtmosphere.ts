import * as THREE from 'three';
import atmosphereMatVertexShader from './shader/atmosphereMat.vertex.glsl'
import atmosphereMatFragmentShader from './shader/atmosphereMat.frag.glsl'
import planetMatVertexShader from './shader/planetMat.vertex.glsl'
import planetMatFragmentShader from './shader/planetMat.frag.glsl'

export function makePlanetWithAtmosphere({
  radius = 1,
  atmosphereColor = new THREE.Color(0x78a6ff),
  mieColor = new THREE.Color(0xfff2d1),
  atmosphereThickness = 0.03,
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

  // ----- Surface (opaque) - renderOrder 0 -----
  const planetUniforms = {
    ...shared,
    uAmbientNight: { value: 0.12 },
    uDayTint: { value: new THREE.Color(0xffffff) },
    uNightTint: { value: new THREE.Color(0x6aa5ff) },
    uTerminatorSoftness: { value: 0.28 },
    uLightWrap: { value: 0.15 },
    uBaseColor: { value: new THREE.Color(0x3a6f4f) },
  };

  // Planet surface material with day/night cycle
  const planetMat = new THREE.ShaderMaterial({
    uniforms: planetUniforms,
    vertexShader: planetMatVertexShader,
    fragmentShader: planetMatFragmentShader,
    transparent: false,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
  });

  const planetGeo = new THREE.SphereGeometry(radius, 96, 64);
  const planetMesh = new THREE.Mesh(planetGeo, planetMat);
  planetMesh.renderOrder = 0;
  planetMesh.frustumCulled = false;
  planetMesh.castShadow = true;
  planetMesh.receiveShadow = true;
  group.add(planetMesh);

  // ----- Atmosphere (additive BackSide) - renderOrder 3 -----
  const atmUniforms = {
    ...shared,
    uPlanetRadius: { value: radius },
    uColorRayleigh: { value: new THREE.Color(atmosphereColor) },
    uColorMie: { value: new THREE.Color(mieColor) },
    uAnisotropy: { value: anisotropy },
    uRimPower: { value: 3.0 },
    uDensity: { value: 1.0 },
  };

  const atmosphereMat = new THREE.ShaderMaterial({
    uniforms: atmUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: atmosphereMatVertexShader,
    fragmentShader: atmosphereMatFragmentShader,
  });

  const atmosphereGeo = new THREE.SphereGeometry(radius * (1.0 + atmosphereThickness), 96, 64);
  const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  atmosphereMesh.renderOrder = 3;
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
    uniforms: { shared, planetUniforms, atmUniforms },
    update,
  };
}