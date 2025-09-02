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
  float polarMask = smoothstep(0.83, 0.96, latitude); // Wider smoothstep for softer edge
  
  // Calculate view angle
  vec3 viewDir = normalize(uCameraPos - vPosition);
  float viewAngle = dot(normal, viewDir);
  
  // Aurora emits its own light - not affected by day/night
  // (Removed night side dependency)
  
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
  
  // Calculate position on sphere for noise sampling
  float azimuth = atan(localNormal.z, localNormal.x);
  float timeFlow = uTime * 0.00008; // Moderate speed for visible movement
  
  // Create noise that displaces the ring positions with much more variance
  // Different displacement for each ring to break up circular symmetry
  vec3 ringDisp1 = vec3(localNormal.x * 2.5, localNormal.z * 2.5, timeFlow * 0.8);
  vec3 ringDisp2 = vec3(localNormal.x * 3.0 + 1.5, localNormal.z * 3.0 + 1.5, timeFlow * 1.2);
  vec3 ringDisp3 = vec3(localNormal.x * 2.0 - 1.0, localNormal.z * 2.0 - 1.0, timeFlow * 0.6);
  
  // Moderate displacement for irregular but not too chaotic shapes
  float latOffset1 = fbm(ringDisp1) * 0.08; // Up to 8% latitude variance
  float latOffset2 = fbm(ringDisp2) * 0.06;
  float latOffset3 = fbm(ringDisp3) * 0.10; // More for outer ring
  
  // Define three rings with softer edges using wider smoothstep ranges
  float ring1 = smoothstep(0.865, 0.88, latitude + latOffset1) * smoothstep(0.90, 0.885, latitude + latOffset1);  // Inner ring, softer edges
  float ring2 = smoothstep(0.895, 0.91, latitude + latOffset2) * smoothstep(0.93, 0.915, latitude + latOffset2);  // Middle ring, softer edges
  float ring3 = smoothstep(0.925, 0.94, latitude + latOffset3) * smoothstep(0.96, 0.945, latitude + latOffset3);  // Outer ring, softer edges
  
  // Combine three rings with some overlap for smoother transitions
  float rings = ring1 * 0.9 + ring2 * 0.7 + ring3 * 0.5;
  rings = min(rings, 1.2); // Cap to prevent over-brightness
  
  // Add subtle temporal variation to ring brightness
  float brightnessPulse = sin(timeFlow * 2.5) * 0.1 + 0.9; // Much slower and subtler
  rings *= brightnessPulse;
  
  // Add some flowing brightness variation using 3D noise
  vec3 flowPos = vec3(localNormal.x, localNormal.y, localNormal.z) * 5.0 + vec3(0.0, 0.0, timeFlow * 1.5);
  float flowPattern = noise(flowPos) * 0.4 + 0.6;
  
  // Final aurora pattern
  float auroraPattern = rings * flowPattern;
  
  // Apply aurora pattern with pole masking only (aurora emits its own light)
  float aurora = auroraPattern * polarMask * currentActivity;
  
  // No base glow - only show the rings themselves
  aurora = aurora * viewVisibility;
  aurora *= uIntensity * currentActivity * 1.2; // Moderate boost
  
  // Aurora colors - full spectrum
  vec3 greenAurora = vec3(0.0, 1.0, 0.3);   // Classic green
  vec3 purpleAurora = vec3(0.6, 0.0, 1.0);  // Purple/violet
  vec3 redAurora = vec3(1.0, 0.2, 0.3);     // Red (high altitude)
  vec3 blueAurora = vec3(0.2, 0.4, 1.0);    // Blue
  vec3 yellowAurora = vec3(0.9, 1.0, 0.3);  // Yellow-green
  
  // Assign different colors to each ring with some mixing
  vec3 color1 = mix(greenAurora, yellowAurora, noise(vec3(localNormal.x * 5.0, localNormal.z * 5.0, timeFlow)) * 0.5 + 0.5);
  vec3 color2 = mix(greenAurora, blueAurora, noise(vec3(localNormal.x * 4.0 + 1.0, localNormal.z * 4.0, timeFlow * 1.2)) * 0.6 + 0.4);
  vec3 color3 = mix(purpleAurora, redAurora, noise(vec3(localNormal.x * 6.0, localNormal.z * 6.0 - 1.0, timeFlow * 0.8)) * 0.7 + 0.3);
  
  // Mix colors based on which ring is dominant (non-additive)
  vec3 auroraColor = vec3(0.0);
  float maxRing = max(max(ring1, ring2), ring3);
  if (maxRing > 0.01) {
    // Weight colors by ring strength but don't add them
    auroraColor = color1 * (ring1 / maxRing) * 0.5 + 
                  color2 * (ring2 / maxRing) * 0.3 + 
                  color3 * (ring3 / maxRing) * 0.2;
    auroraColor = normalize(auroraColor + vec3(0.1)) * 2.0; // Brighter
  }
  
  // Add very subtle shimmer based on time only
  float shimmer = sin(uTime * 0.001) * 0.06 + 0.95; // Slower and subtler
  shimmer *= cos(uTime * 0.002) * 0.035 + 0.85;
  aurora *= shimmer;
  
  // Variable opacity for more depth
  float opacity = aurora * (0.7 + flowPattern * 0.5); // Opacity varies with flow pattern
  float finalAlpha = min(opacity * 1.3, 1.0); // Cap at 1.0
  gl_FragColor = vec4(auroraColor * aurora * 3.0, finalAlpha);
}