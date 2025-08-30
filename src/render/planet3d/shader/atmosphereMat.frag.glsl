uniform vec3 uLightDir;
uniform vec3 uColorRayleigh;
uniform vec3 uColorMie;
uniform float uAnisotropy;
uniform float uRimPower;
uniform float uDensity;
uniform float uPlanetRadius;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  vec3 lightDir = normalize(uLightDir);

  // Rim lighting effect
  float rim = 1.0 - abs(dot(viewDir, normal));
  rim = pow(rim, uRimPower);

  // Day/night transition
  float sunDot = dot(normal, lightDir);
  float dayNight = smoothstep(-0.3, 0.3, sunDot);

  // Mie scattering (forward scattering)
  float miePhase = dot(viewDir, lightDir);
  miePhase = 1.0 + miePhase * miePhase;

  // Combine Rayleigh (blue) and Mie (yellow/white) scattering
  vec3 rayleigh = uColorRayleigh * rim;
  vec3 mie = uColorMie * miePhase * 0.1;

  vec3 color = (rayleigh + mie) * uDensity * dayNight;
  float alpha = rim * uDensity * 0.8;

  gl_FragColor = vec4(color, alpha);
}