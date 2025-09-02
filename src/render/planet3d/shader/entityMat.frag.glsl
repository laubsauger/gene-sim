#include <common>
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDir;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  #include <logdepthbuf_fragment>

  // Calculate lighting using world space normal and light direction (same as clouds)
  vec3 L = normalize(uLightDir);
  float NdotL = dot(normalize(vNormal), L);
  
  // Use tighter light wrap and terminator for sharper shadows
  float lightWrap = 0.15;  // Less wrap for sharper shadow transition
  float terminator = 0.25;  // Smaller terminator for sharper cutoff
  float wrap = clamp((NdotL + lightWrap) / (1.0 + lightWrap), 0.0, 1.0);
  float day = smoothstep(0.0, terminator, wrap);
  
  // Lighting calculation with steeper falloff
  // Narrower transition bands for more dramatic shadows
  float dayFactor = smoothstep(-0.2, 0.3, NdotL);  // Steeper transition
  float sunsetFactor = exp(-8.0 * abs(NdotL)) * 1.5;  // Narrower terminator band
  float nightFactor = smoothstep(0.2, -0.2, NdotL);  // Steeper night transition
  
  // Make the darkest part almost invisible
  // Scale darkness based on how far into shadow we are
  float shadowDepth = clamp(-NdotL, 0.0, 1.0);  // 0 at terminator, 1 at opposite side
  float nightBrightness = mix(0.005, 0.0005, shadowDepth);  // From 0.5% to 0.05% brightness
  
  // Color calculation with much darker nights
  vec3 dayCol = vColor;  // Full brightness in daylight
  vec3 sunsetCol = vColor * vec3(1.0, 0.65, 0.35);  // Warmer at sunset
  vec3 nightCol = vColor * nightBrightness;  // Almost invisible in deep shadow
  
  // Blend colors using same approach as clouds
  vec3 finalColor = dayCol * dayFactor;
  finalColor += sunsetCol * sunsetFactor * (1.0 - dayFactor * 0.7);
  finalColor = mix(finalColor, nightCol, nightFactor * 0.95);  // More aggressive night mixing
  
  gl_FragColor = vec4(finalColor, 1.0);
}