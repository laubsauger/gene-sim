precision highp float;

#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDir;
uniform vec3 uColorRayleigh;
uniform vec3 uColorMie;
uniform float uAnisotropy;
uniform float uRimPower;
uniform float uDensity;
uniform float uPlanetRadius;
uniform float uExposure;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPosition;
varying vec3 vPosition;  // Local position from vertex shader
varying vec3 vWorldNormal;  // World space normal from vertex shader

// Henyey-Greenstein phase function for Mie scattering
float henyeyGreenstein(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5);
}

// sRGB conversion for proper color output
vec3 toSRGB(vec3 color) {
  return pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));
}

void main() {
  #include <logdepthbuf_fragment>
  
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightDir);  // This is direction FROM sun TO earth
  
  // DEBUG: Let's visualize what vWorldPos actually contains
  // The problem is vWorldPos is in WORLD space, including Earth's orbital position
  // We need the LOCAL position on the sphere surface
  
  // For atmosphere on BackSide, vWorldPos is the world position of atmosphere shell
  // We need to get the direction from Earth CENTER to this point
  
  // Since the atmosphere is centered at Earth's position, we need to subtract Earth's position
  // But we don't have Earth's position in the shader... 
  
  // Calculate proper sun angle using world-space normal
  // L points FROM sun TO earth
  // We had the sign wrong - for BackSide rendering we need positive L
  float sunDot = dot(normalize(vWorldNormal), L);
  
  // Remove debug visualization - proceed with actual atmosphere rendering
  
  // Atmosphere thickness based on edge proximity
  float viewDot = dot(V, N);
  float limb = 1.0 - abs(viewDot);
  float atmosphereThickness = pow(limb, 0.8) + 0.1; // Add base to reach surface
  
  // Use continuous functions for smoother transitions with wider bands
  float dayFactor = smoothstep(-0.5, 0.5, sunDot);  // Wider transition from -0.5 to 0.5
  float sunsetFactor = exp(-5.0 * abs(sunDot)) * 2.0;  // Wider terminator band (was -10.0)
  float nightFactor = smoothstep(0.5, -0.5, sunDot);  // Match wider transition
  
  // Define atmosphere colors - from working Scene3D
  vec3 dayColor = vec3(0.35, 0.6, 1.0);        // Sky blue
  vec3 sunsetColor = vec3(1.0, 0.5, 0.15);     // Orange terminator glow
  vec3 twilightColor = vec3(0.3, 0.2, 0.4);    // Purple twilight
  vec3 nightColor = vec3(0.05, 0.08, 0.15);    // Dark blue night
  
  // EXACT blending from Scene3D
  vec3 color = dayColor * dayFactor;
  color += sunsetColor * sunsetFactor * (1.0 - dayFactor * 0.5);
  color += twilightColor * nightFactor * (1.0 - sunsetFactor);
  color = mix(color, nightColor, nightFactor * 0.7);
  
  // EXACT intensity from Scene3D
  float intensity = 0.2 + dayFactor * 0.5 + sunsetFactor * 0.2;
  
  // Ensure night side has minimum visibility - FROM Scene3D
  intensity = max(intensity, 0.15);
  
  // Apply atmosphere thickness and intensity - match Scene3D
  float alpha = atmosphereThickness * intensity;
  
  // Smooth edge transition from Scene3D
  // float edgeFade = smoothstep(0.0, 0.1, limb) * smoothstep(1.0, 0.8, limb);
  // alpha *= (0.4 + edgeFade * 0.6);  // Higher minimum for surface visibility
  
  // Enhance atmosphere on day side, reduce on night side
  // dayFactor is 1 on day side, 0 on night side
  float dayEnhancement = 0.3 + dayFactor * 0.7;  // Range from 0.3 (night) to 1.0 (day)
  
  // Overall atmosphere opacity - match Scene3D
  alpha *= 0.4 * dayEnhancement;
  
  // Very minimal cutoff to avoid artifacts
  if (alpha < 0.008) discard;  // Match Scene3D cutoff
  
  // Output directly - Scene3D doesn't use sRGB conversion
  gl_FragColor = vec4(color, alpha);
}