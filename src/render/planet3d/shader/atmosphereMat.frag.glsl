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
  
  // Smooth day/night/sunset transitions
  float dayFactor = smoothstep(-0.3, 0.3, sunDot);
  float sunsetFactor = exp(-10.0 * abs(sunDot)) * 2.0; // Peak at terminator
  float nightFactor = smoothstep(0.3, -0.3, sunDot);
  
  // Define atmosphere colors - PURE saturated colors
  vec3 dayColor = vec3(0.1, 0.5, 1.0);         // Pure sky blue
  vec3 sunsetColor = vec3(1.0, 0.6, 0.2);      // Pure orange sunset
  vec3 twilightColor = vec3(0.4, 0.2, 0.5);    // Purple twilight
  vec3 nightColor = vec3(0.02, 0.05, 0.15);    // Dark blue night
  
  // Simple, clean blending without dilution
  vec3 color;
  if (sunDot > 0.0) {
    // Day side
    color = mix(sunsetColor, dayColor, smoothstep(0.0, 0.3, sunDot));
  } else {
    // Night side
    color = mix(nightColor, twilightColor, smoothstep(-0.3, 0.0, sunDot));
  }
  
  // Add sunset band at terminator
  float sunsetBand = exp(-20.0 * sunDot * sunDot); // Sharp peak at terminator
  color = mix(color, sunsetColor, sunsetBand * 0.8);
  
  // Intensity based on sun angle
  float intensity = mix(0.3, 1.0, dayFactor);
  
  // Apply atmosphere thickness and intensity
  float alpha = atmosphereThickness * intensity * 0.8;
  
  // Smoother edge transition
  float edgeFade = smoothstep(0.0, 0.1, limb) * smoothstep(1.0, 0.8, limb);
  alpha *= (0.3 + edgeFade * 0.7);
  
  // Overall atmosphere opacity
  alpha *= uDensity * 0.45;
  
  // Don't over-expose, just use natural colors
  color *= uExposure;
  
  // Very minimal cutoff to avoid artifacts
  if (alpha < 0.01) discard;
  
  // Output with sRGB for proper gradient
  gl_FragColor = vec4(pow(color, vec3(1.0/2.2)), alpha);
}