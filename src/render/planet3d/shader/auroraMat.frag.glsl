#include <common>
#include <logdepthbuf_pars_fragment>

uniform float uTime;
uniform vec3 uLightDir;
uniform float uIntensity;
uniform vec3 uCameraPos;
uniform float uActivityLevel; // 0-1 for aurora activity
uniform float uPlanetRadius; // Planet radius for occlusion

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vLocalPosition;
varying vec3 vViewPosition;
varying vec2 vUv;

// Smoother noise function for aurora movement
float noise(vec3 p) {
  return sin(p.x * 1.5) * cos(p.y * 1.3) * sin(p.z * 1.7) +
          sin(p.x * 2.7) * cos(p.y * 2.3) * sin(p.z * 1.4) * 0.3;
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for(int i = 0; i < 4; i++) { // More iterations for finer detail
    value += amplitude * noise(p);
    p *= 2.13; // Higher frequency for finer features
    amplitude *= 0.48;
  }
  return value;
}

void main() {
  #include <logdepthbuf_fragment>
  
  vec3 normal = normalize(vNormal);
  vec3 localNormal = normalize(vLocalPosition);
  
  // Use local Y position for pole detection (planet's actual poles)
  float latitude = abs(localNormal.y);
  float polarMask = smoothstep(0.75, 0.88, latitude); // Narrower aurora zone, closer to poles
  
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
  
  // Only discard if definitely not at poles
  if (polarMask < 0.001) discard;
  
  // Edge visibility for side views
  float edgeFade = 1.0 - abs(viewAngle);
  edgeFade = pow(edgeFade, 0.5);
  
  // Pole visibility for top-down views
  // When viewing pole from above, viewAngle is near 1 (or -1 for back)
  float poleViewFactor = smoothstep(0.5, 0.9, abs(viewAngle));
  float poleVisibility = polarMask * poleViewFactor * 0.8;
  
  // Combine and only show on front-facing side
  float viewVisibility = max(edgeFade, poleVisibility) * frontFacing;
  
  // Ensure some minimum visibility at poles
  viewVisibility = max(viewVisibility, polarMask * 0.4);
  
  // Activity-based intensity modulation
  // Creates periods of high and low aurora activity
  float activityCycle = sin(uTime * 0.00015) * 0.5 + 0.5; // Slower, more realistic cycle
  float burstActivity = sin(uTime * 0.0004) * sin(uTime * 0.00025) * 0.5 + 0.5; // Less frequent bursts
  float currentActivity = mix(activityCycle, burstActivity, 0.3) * uActivityLevel;
  
  // Lower threshold for visibility
  if (currentActivity < 0.02) discard;
  
  // Animated aurora curtains - slower, more realistic speed
  float timeOffset = uTime * 0.0003; // Slower, graceful animation
  // Use local position for stable aurora patterns with much finer detail
  vec3 auroraPos = vLocalPosition * 0.8 + vec3(timeOffset, timeOffset * 0.5, timeOffset * 0.2);
  
  // Create much finer vertical curtain patterns
  float curtains = fbm(auroraPos * 3.2 + vec3(0.0, vLocalPosition.y * 4.0, 0.0));
  curtains = smoothstep(-0.15, 0.15, curtains) * currentActivity;
  
  // Add much finer horizontal bands - slower movement
  float bands = sin(latitude * 50.0 + uTime * 0.0004) * 0.3 + 0.7;
  bands *= sin(latitude * 75.0 - uTime * 0.0006) * 0.2 + 0.8;
  
  // Combine patterns - ensure aurora is visible at poles
  float aurora = curtains * bands * polarMask * nightSide;
  
  // Add subtle base glow at poles during activity
  float baseGlow = polarMask * nightSide * 0.2 * currentActivity;
  aurora = max(aurora * viewVisibility, baseGlow);
  aurora *= uIntensity * currentActivity * 1.2; // Moderate boost
  
  // Aurora colors - green to purple gradient
  vec3 color1 = vec3(0.0, 1.0, 0.4); // Green
  vec3 color2 = vec3(0.4, 0.0, 1.0); // Purple
  vec3 color3 = vec3(0.0, 0.6, 1.0); // Cyan
  
  // Vary color based on altitude and pattern
  float colorMix = curtains + noise(auroraPos * 3.0) * 0.5;
  vec3 auroraColor = mix(color1, color2, colorMix);
  auroraColor = mix(auroraColor, color3, bands * 0.5);
  
  // Add subtle shimmer effect
  float shimmer = sin(uTime * 0.004 + curtains * 8.0) * 0.15 + 0.85;
  aurora *= shimmer;
  
  // Balanced final appearance
  float finalAlpha = aurora * 0.9;
  gl_FragColor = vec4(auroraColor * aurora * 2.5, finalAlpha);
}