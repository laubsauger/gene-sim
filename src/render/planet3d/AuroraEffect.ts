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
  uniform float uActivityLevel; // 0-1 for aurora activity
  
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  
  // Smoother noise function for aurora movement
  float noise(vec3 p) {
    return sin(p.x * 1.5) * cos(p.y * 1.3) * sin(p.z * 1.7) +
           sin(p.x * 2.7) * cos(p.y * 2.3) * sin(p.z * 1.4) * 0.3;
  }
  
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for(int i = 0; i < 3; i++) { // Reduced iterations for smoother appearance
      value += amplitude * noise(p);
      p *= 1.87; // Less aggressive frequency increase
      amplitude *= 0.55;
    }
    return value;
  }
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 localNormal = normalize(vLocalPosition);
    
    // Use local Y position for pole detection (planet's actual poles)
    float latitude = abs(localNormal.y);
    float polarMask = smoothstep(0.72, 0.92, latitude); // Narrower aurora zone at higher latitudes
    
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
    
    // Activity-based intensity modulation
    // Creates periods of high and low aurora activity
    float activityCycle = sin(uTime * 0.00008) * 0.5 + 0.5; // Very slow cycle
    float burstActivity = sin(uTime * 0.0003) * sin(uTime * 0.00017) * 0.5 + 0.5; // Occasional bursts
    float currentActivity = mix(activityCycle, burstActivity, 0.3) * uActivityLevel;
    
    // Early exit if activity is too low
    if (currentActivity < 0.1) discard;
    
    // Animated aurora curtains - much slower and smoother
    float timeOffset = uTime * 0.00015; // Even slower animation
    // Use local position for stable aurora patterns
    vec3 auroraPos = vLocalPosition * 0.3 + vec3(timeOffset, timeOffset * 0.5, timeOffset * 0.2);
    
    // Create smoother vertical curtain patterns
    float curtains = fbm(auroraPos + vec3(0.0, vLocalPosition.y * 1.5, 0.0));
    curtains = smoothstep(-0.3, 0.3, curtains) * currentActivity;
    
    // Add subtle horizontal bands - much slower movement
    float bands = sin(latitude * 20.0 + uTime * 0.0002) * 0.4 + 0.6;
    bands *= sin(latitude * 35.0 - uTime * 0.0003) * 0.3 + 0.7;
    
    // Combine patterns - ensure aurora is visible at poles
    float aurora = curtains * bands * polarMask * nightSide;
    
    // Add a very subtle base glow at poles during high activity
    float baseGlow = polarMask * nightSide * 0.15 * currentActivity;
    aurora = max(aurora * viewVisibility, baseGlow);
    aurora *= uIntensity * currentActivity;
    
    // Aurora colors - green to purple gradient
    vec3 color1 = vec3(0.0, 1.0, 0.4); // Green
    vec3 color2 = vec3(0.4, 0.0, 1.0); // Purple
    vec3 color3 = vec3(0.0, 0.6, 1.0); // Cyan
    
    // Vary color based on altitude and pattern
    float colorMix = curtains + noise(auroraPos * 3.0) * 0.5;
    vec3 auroraColor = mix(color1, color2, colorMix);
    auroraColor = mix(auroraColor, color3, bands * 0.5);
    
    // Add subtle shimmer - much slower
    float shimmer = sin(uTime * 0.002 + curtains * 6.0) * 0.15 + 0.85;
    aurora *= shimmer;
    
    // More subtle final appearance
    float finalAlpha = aurora * 0.8 * currentActivity;
    gl_FragColor = vec4(auroraColor * aurora * 2.0, finalAlpha);
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
      uIntensity: { value: 0.8 }, // Reduced base intensity
      uCameraPos: { value: new THREE.Vector3(0, 0, 0) },
      uActivityLevel: { value: 1.0 } // Default full activity, can be modulated
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