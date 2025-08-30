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
  
  // Use continuous functions for smoother transitions
  float dayFactor = smoothstep(-0.3, 0.3, sunDot);
  float sunsetFactor = exp(-10.0 * abs(sunDot)) * 2.0;  // Peak at terminator
  float nightFactor = smoothstep(0.3, -0.3, sunDot);
  
  // Define atmosphere colors - vibrant and saturated
  vec3 dayColor = vec3(0.3, 0.6, 1.0);        // Beautiful bright blue
  vec3 sunsetColor = vec3(1.0, 0.35, 0.05);   // Intense orange sunset glow
  vec3 twilightColor = vec3(0.5, 0.25, 0.6);  // Vibrant purple twilight
  vec3 nightColor = vec3(0.03, 0.06, 0.15);   // Deep dark blue night
  
  // Blend colors smoothly with multiple layers
  vec3 color = dayColor * dayFactor;
  color += sunsetColor * sunsetFactor * (1.0 - dayFactor * 0.5);
  color += twilightColor * nightFactor * (1.0 - sunsetFactor);
  color = mix(color, nightColor, nightFactor * 0.7);
  
  // Smooth intensity
  float intensity = 0.2 + dayFactor * 0.5 + sunsetFactor * 0.2;
  intensity = max(intensity, 0.15); // Ensure night side has minimum visibility
  
  // Apply atmosphere thickness and intensity
  float alpha = atmosphereThickness * intensity;
  
  // Gentle fade at edges - no dark bands, just smooth transition to space
  // float edgeFade = 1.0 - pow(limb, 3.0);  // Cubic falloff for smoother transition
  // alpha *= (0.5 + edgeFade * 0.5);  // Keep minimum visibility while fading edges
  
  // Overall atmosphere opacity
  alpha *= uDensity * 0.6;  // More visible atmosphere
  
  // Apply exposure for vibrant colors
  color *= uExposure * 1.5;  // Strong boost for vibrant colors
  
  // Very minimal cutoff to avoid artifacts
  if (alpha < 0.01) discard;
  
  // Output with sRGB for proper gradient
  gl_FragColor = vec4(pow(color, vec3(1.0/2.2)), alpha);
}