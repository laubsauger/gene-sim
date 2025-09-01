import * as THREE from 'three';

// Aurora shader for northern/southern lights effect
const auroraVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPosition; // Position in planet's local space
  varying vec2 vUv;
  
  void main() {
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vLocalPosition = position; // Keep local position for pole detection
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const auroraFragmentShader = `
  uniform float uTime;
  uniform vec3 uLightDir;
  uniform float uIntensity;
  uniform vec3 uCameraPos;
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  
  // Noise function for aurora movement
  float noise(vec3 p) {
    return sin(p.x * 2.1) * cos(p.y * 1.7) * sin(p.z * 2.3) +
           sin(p.x * 3.7) * cos(p.y * 2.9) * sin(p.z * 1.8) * 0.5;
  }
  
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.03;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 localNormal = normalize(vLocalPosition);
    
    // Use local Y position for pole detection (planet's actual poles)
    float latitude = abs(localNormal.y);
    float polarMask = smoothstep(0.65, 0.9, latitude); // Aurora zone at high latitudes
    
    // Calculate view angle
    vec3 viewDir = normalize(uCameraPos - vPosition);
    float viewAngle = dot(normal, viewDir);
    
    // Aurora more visible on night side
    float nightSide = smoothstep(0.2, -0.2, dot(normal, uLightDir));
    // Increase night side intensity
    nightSide = pow(nightSide, 0.7);
    
    // Aurora visibility - similar approach to clouds
    // Check if we're looking at the front side of the sphere
    float frontFacing = step(0.0, viewAngle); // 1 if front-facing, 0 if back-facing
    
    // Discard if not at poles or on back side
    if (polarMask < 0.01 || frontFacing < 0.5) discard;
    
    // Edge visibility for side views
    float edgeFade = 1.0 - abs(viewAngle);
    edgeFade = pow(edgeFade, 0.5);
    
    // Pole visibility for top-down views
    // When viewing pole from above, viewAngle is near 1 (or -1 for back)
    float poleViewFactor = smoothstep(0.5, 0.9, abs(viewAngle));
    float poleVisibility = polarMask * poleViewFactor * 0.8;
    
    // Combine and only show on front-facing side
    float viewVisibility = max(edgeFade, poleVisibility) * frontFacing;
    
    // Ensure some minimum visibility at poles when front-facing
    viewVisibility = max(viewVisibility, polarMask * 0.3 * frontFacing);
    
    // Animated aurora curtains - slower animation
    float timeOffset = uTime * 0.0002; // Slower animation
    // Use local position for stable aurora patterns
    vec3 auroraPos = vLocalPosition * 0.5 + vec3(timeOffset, timeOffset * 0.7, timeOffset * 0.3);
    
    // Create vertical curtain patterns using local position
    float curtains = fbm(auroraPos + vec3(0.0, vLocalPosition.y * 2.0, 0.0));
    curtains = smoothstep(-0.5, 0.5, curtains);
    
    // Add horizontal bands - slower movement
    float bands = sin(latitude * 30.0 + uTime * 0.0004) * 0.5 + 0.5;
    bands *= sin(latitude * 50.0 - uTime * 0.0006) * 0.5 + 0.5;
    
    // Combine patterns - ensure aurora is visible at poles
    float aurora = curtains * bands * polarMask * nightSide;
    
    // Add a base glow at poles that's always visible
    float baseGlow = polarMask * nightSide * 0.3;
    aurora = max(aurora * viewVisibility, baseGlow);
    aurora *= uIntensity;
    
    // Aurora colors - green to purple gradient
    vec3 color1 = vec3(0.0, 1.0, 0.4); // Green
    vec3 color2 = vec3(0.4, 0.0, 1.0); // Purple
    vec3 color3 = vec3(0.0, 0.6, 1.0); // Cyan
    
    // Vary color based on altitude and pattern
    float colorMix = curtains + noise(auroraPos * 3.0) * 0.5;
    vec3 auroraColor = mix(color1, color2, colorMix);
    auroraColor = mix(auroraColor, color3, bands * 0.5);
    
    // Add shimmer - slower
    float shimmer = sin(uTime * 0.004 + curtains * 10.0) * 0.2 + 0.8;
    aurora *= shimmer;
    
    // Increase overall intensity and ensure minimum alpha at poles
    float finalAlpha = max(aurora * 1.2, polarMask * nightSide * 0.2);
    gl_FragColor = vec4(auroraColor * aurora * 3.0, finalAlpha);
  }
`;

export function createAuroraEffect(planetRadius: number) {
  const geometry = new THREE.SphereGeometry(
    planetRadius * 1.08, // Back to original height above atmosphere
    128,
    64
  );
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uIntensity: { value: 1.2 }, // Increased intensity
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) }
    },
    vertexShader: auroraVertexShader,
    fragmentShader: auroraFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true, // Keep depth test for proper occlusion
    side: THREE.DoubleSide // Render both sides like clouds
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2; // Render after planet
  
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