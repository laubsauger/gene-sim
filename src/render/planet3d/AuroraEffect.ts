import * as THREE from 'three';
import auroraMatVertexShader from './shader/auroraMat.vertex.glsl'
import auroraMatFragmentShader from './shader/auroraMat.frag.glsl'

export function createAuroraEffect(planetRadius: number) {
  const geometry = new THREE.SphereGeometry(
    planetRadius * 1.07, // Lower altitude, closer to planet surface
    128,
    64
  );
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uIntensity: { value: 1.3 }, // Increased for better visibility of rings
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
      uActivityLevel: { value: 1.0 }, // Default full activity, can be modulated
      uPlanetRadius: { value: planetRadius } // For occlusion calculation
    },
    vertexShader: auroraMatVertexShader,
    fragmentShader: auroraMatFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true, // Disable depth test to prevent occlusion issues
    side: THREE.DoubleSide // Render both sides for visibility
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5; // Render after atmosphere (3) with some buffer
  
  return {
    mesh,
    update: (time: number, lightDir: THREE.Vector3, cameraPos: THREE.Vector3) => {
      material.uniforms.uTime.value = time;
      material.uniforms.uLightDir.value.copy(lightDir);
      material.uniforms.uCameraPos.value.copy(cameraPos);
    },
    setIntensity: (intensity: number) => {
      material.uniforms.uIntensity.value = intensity;
    }
  };
}