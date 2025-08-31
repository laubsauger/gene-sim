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
  vec3 L = normalize(uLightDir);
  vec3 sphereNormal = normalize(vWorldPos); // Use world position as sphere normal
  
  // Sun angle determines day/night based on sphere position
  float sunDot = dot(sphereNormal, L);
  
  // Atmosphere thickness based on edge proximity
  float viewDot = dot(V, N);
  float limb = 1.0 - abs(viewDot);
  float atmosphereThickness = pow(limb, 0.8) + 0.1; // Add base to reach surface
  
  // Use continuous functions for smoother transitions with stronger contrast
  float dayFactor = smoothstep(-0.2, 0.2, sunDot);  // Sharper day/night transition
  float sunsetFactor = exp(-10.0 * abs(sunDot)) * 3.0;  // Narrow orange band at terminator only
  float nightFactor = smoothstep(0.2, -0.4, sunDot);  // Stronger night falloff
  
  // Define atmosphere colors - proper terminator gradient
  vec3 dayColor = vec3(0.35, 0.6, 1.0);       // Nice bright blue (from Scene3D)
  vec3 sunsetColor = vec3(1.0, 0.5, 0.15);    // Orange sunset glow (from Scene3D)
  vec3 twilightColor = vec3(0.3, 0.2, 0.4);   // Purple twilight (from Scene3D)
  vec3 nightColor = vec3(0.05, 0.08, 0.15);   // Dark blue night (from Scene3D)
  
  // Blend colors smoothly with multiple layers
  vec3 color = dayColor * dayFactor;
  color += sunsetColor * sunsetFactor * (1.0 - dayFactor * 0.5);
  color += twilightColor * nightFactor * (1.0 - sunsetFactor);
  color = mix(color, nightColor, nightFactor * 0.7);
  
  // Smooth intensity with proper day/night contrast
  float intensity = 0.15 + dayFactor * 0.6 + sunsetFactor * 0.4;
  
  // Make night side much darker
  intensity = max(intensity, 0.05);
  
  // Apply atmosphere thickness and intensity with very strong boost
  float alpha = atmosphereThickness * intensity * 2.5;
  
  // Smoother edge transition that reaches the surface (from Scene3D approach)
  float edgeFade = smoothstep(0.0, 0.1, limb) * smoothstep(1.0, 0.8, limb);
  alpha *= (0.8 + edgeFade * 0.2);  // Very high base visibility
  
  // Overall atmosphere opacity with night side reduction
  float nightReduction = 1.0 - nightFactor * 0.6;  // Reduce night side visibility
  alpha *= uDensity * 1.4 * nightReduction;  // Very strong atmosphere with night reduction
  
  // Strong color boost for vibrant atmosphere
  color *= uExposure * 2.0;
  
  // Very minimal cutoff to avoid artifacts
  if (alpha < 0.008) discard;  // Match Scene3D cutoff
  
  // Output with sRGB for proper gradient
  gl_FragColor = vec4(color, alpha);
}