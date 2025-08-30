uniform vec3 uLightDir;
uniform float uAmbientNight;
uniform vec3 uDayTint;
uniform vec3 uNightTint;
uniform float uTerminatorSoftness;
uniform float uLightWrap;
uniform vec3 uBaseColor;

varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(uLightDir);
  
  // Basic lambertian with light wrap for softer terminator
  float NdotL = dot(normal, lightDir);
  float wrapped = (NdotL + uLightWrap) / (1.0 + uLightWrap);
  float dayAmount = smoothstep(-uTerminatorSoftness, uTerminatorSoftness, wrapped);
  
  // Mix day and night colors
  vec3 dayColor = uBaseColor * uDayTint;
  vec3 nightColor = uBaseColor * uNightTint * uAmbientNight;
  vec3 color = mix(nightColor, dayColor, dayAmount);
  
  // Add slight rim lighting
  vec3 viewDir = normalize(vViewPosition);
  float rim = 1.0 - abs(dot(viewDir, normal));
  color += rim * rim * 0.1 * uDayTint;
  
  gl_FragColor = vec4(color, 1.0);
}