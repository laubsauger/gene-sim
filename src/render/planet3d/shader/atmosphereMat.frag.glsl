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

  // Rim effect - atmosphere glows at edges
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float rim = pow(1.0 - NdotV, uRimPower);

  // Day/night transition with soft terminator
  float NdotL = dot(N, L);
  float dayBias = smoothstep(-0.35, 0.35, NdotL);

  // Scattering calculations
  float cosTheta = dot(L, V);
  float mie = henyeyGreenstein(cosTheta, clamp(uAnisotropy, 0.0, 0.9));
  float rayleigh = 0.75 * (1.0 + cosTheta * cosTheta);

  // Combine scattering with rim and day/night
  vec3 scatterColor = uColorRayleigh * rayleigh + uColorMie * mie * 0.5;
  vec3 finalColor = scatterColor * rim * dayBias * uDensity * 0.25;
  
  // Apply exposure
  finalColor *= uExposure;
  
  // Output with sRGB conversion and alpha based on intensity
  float alpha = clamp(rim * dayBias * uDensity * 0.6, 0.0, 1.0);
  gl_FragColor = vec4(toSRGB(finalColor), alpha);
}