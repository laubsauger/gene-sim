precision highp float;

#include <common>
#include <logdepthbuf_pars_fragment>

varying vec3 vN;
varying vec3 vPosW;
varying vec3 vPosObject; // Receive object space position from vertex shader
varying vec3 vWorldNormal; // World space normal for proper lighting
uniform vec3 uLightDir;
uniform float uTime, uPaused, uCoverage, uDensity, uLightWrap, uTerminator;
uniform vec3 uDayTint, uNightTint;

float hash(vec3 p){ 
  return fract(sin(dot(p, vec3(17.1,31.7,11.7))) * 43758.5453); 
}

float noise(vec3 p){ 
  vec3 i=floor(p), f=fract(p); 
  vec3 u=f*f*(3.0-2.0*f); 
  float n=mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),u.x),
                  mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),u.x),u.y),
              mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),u.x),
                  mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),u.x),u.y),u.z);
  return n; 
}

float fbm(vec3 p){ 
  float a=0.5, s=0.0; 
  for(int i=0;i<5;i++){ 
    s += a*noise(p); 
    p*=2.02; 
    a*=0.5; 
  } 
  return s; 
}

void main(){
  #include <logdepthbuf_fragment>
  
  vec3 N = normalize(vN); 
  vec3 L = normalize(uLightDir); 
  vec3 V = normalize(cameraPosition - vPosW);
  
  // Use world normal for lighting calculation (same as atmosphere)
  // This ensures lighting stays aligned with the planet's actual orientation
  float NdotL = dot(normalize(vWorldNormal), L);
  float wrap = clamp((NdotL + uLightWrap)/(1.0+uLightWrap), 0.0, 1.0);
  float day = smoothstep(0.0, uTerminator, wrap);
  
  // Use object space position (normalized position on sphere) 
  // This ensures clouds are always sampled from the same place regardless of camera
  vec3 spherePos = normalize(vPosObject); // Use vertex position in object space
  
  // Direct 3D noise sampling in object space
  float timeMultiplier = 1.0 - uPaused;  // 0 when paused, 1 when moving
  
  // Faster cloud movement (increased from 0.00005 to 0.00015)
  float slowTime = uTime * 0.00015 * timeMultiplier;  // Faster rotation
  
  // Simple rotation around Y axis in object space
  float angle = slowTime;
  vec3 rotatedPos = vec3(
    spherePos.x * cos(angle) - spherePos.z * sin(angle),
    spherePos.y,
    spherePos.x * sin(angle) + spherePos.z * cos(angle)
  );
  
  // Add latitude-based bias for more clouds near equator, but ensure global coverage
  float latitude = abs(spherePos.y);
  float equatorBias = 1.0 - smoothstep(0.0, 0.8, latitude); // More clouds near equator
  float globalCoverage = 0.3; // Minimum cloud chance everywhere
  
  // Add time-based evolution to the noise (clouds change shape over time)
  float evolutionTime = uTime * 0.00008 * timeMultiplier;  // Noise structure evolution
  
  // Final sampling position - use rotated object space position with time offset
  vec3 p = rotatedPos * 4.0;  // Scale for appropriate cloud size
  float k=1.5;  // Lower frequency for larger cloud formations
  
  // Add time component to noise sampling for evolving cloud shapes
  float base=fbm(p*k + vec3(evolutionTime * 0.5, evolutionTime * 0.3, evolutionTime * 0.4)); 
  float detail=fbm(p*k*3.0 + vec3(evolutionTime * 0.7, evolutionTime * 0.5, evolutionTime * 0.6));  // More detailed overlay
  
  // Combine noise with latitude bias
  float cloudNoise = mix(base, detail, 0.7);
  float biasedNoise = mix(cloudNoise, cloudNoise + 0.2, mix(globalCoverage, equatorBias, 0.7));
  float mask=smoothstep(uCoverage, 1.0, biasedNoise);  // Apply coverage threshold
  float thickness = mask; 
  
  // Lighting calculation aligned with atmosphere shader
  // Use continuous functions for smoother transitions with wider bands (from atmosphere)
  float dayFactor = smoothstep(-0.5, 0.5, NdotL);  // Wider transition from -0.5 to 0.5
  float sunsetFactor = exp(-5.0 * abs(NdotL)) * 2.0;  // Wider terminator band
  float nightFactor = smoothstep(0.5, -0.5, NdotL);  // Match wider transition
  
  // Self-shadowing based on cloud thickness
  float selfShadow = mix(1.0, 0.7, thickness * (1.0 - dayFactor));
  
  // Cloud coloring with lighting that matches atmosphere
  vec3 dayCol = uDayTint * selfShadow;
  vec3 sunsetCol = mix(uDayTint * 0.8, vec3(1.0, 0.7, 0.4), 0.5); // Warmer sunset clouds
  vec3 nightCol = uNightTint * 0.2; // Slightly visible night clouds
  
  // Blend colors using same approach as atmosphere
  vec3 col = dayCol * dayFactor;
  col += sunsetCol * sunsetFactor * (1.0 - dayFactor * 0.5);
  col = mix(col, nightCol, nightFactor * 0.8);
  
  col *= mask;
  
  // Limb darkening/brightening
  float limb = pow(1.0 - clamp(dot(N,V), 0.0, 1.0), 1.5);
  
  // Alpha calculation similar to atmosphere - stronger on day side, minimal on night
  float intensity = 0.3 + dayFactor * 0.6 + sunsetFactor * 0.1;
  float alpha = uDensity * mask * intensity * mix(1.0, 0.7, limb);
  if(alpha < 0.01) discard; 
  gl_FragColor = vec4(col, alpha);
}