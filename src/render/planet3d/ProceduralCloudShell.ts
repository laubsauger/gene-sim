import * as THREE from 'three';
import cloudMatVertexShader from './shader/cloudMat.vertex.glsl'
import cloudMatFragmentShader from './shader/cloudMat.frag.glsl'

export function makeProceduralCloudShell({ radius }: { radius: number }) {
  const cloudUniforms = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uTime: { value: 0 },
    uCoverage: { value: 0.48 },  // Moderate coverage for realistic clouds
    uDensity: { value: 0.7 },    // Balanced opacity for visible but not overwhelming clouds
    uLightWrap: { value: 0.25 },
    uTerminator: { value: 0.35 },
    uDayTint: { value: new THREE.Color(1, 1, 1) },
    uNightTint: { value: new THREE.Color(0.5, 0.65, 1.0) },
  };

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false, // Transparent, no depth write
    blending: THREE.NormalBlending,
    vertexShader: cloudMatVertexShader,
    fragmentShader: cloudMatFragmentShader,
  });

  const cloudRadius = radius * 1.015;  // Closer to surface for realistic cloud layer
  const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 48);
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.userData.isCloud = true;

  return { mesh: cloudMesh, uniforms: cloudUniforms, material: cloudMat };
}