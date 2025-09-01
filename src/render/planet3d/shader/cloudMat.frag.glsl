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
  
  // Faster cloud movement with latitude-dependent speed (Coriolis effect)
  float latitude = abs(spherePos.y);
  float coriolisSpeed = mix(0.0015, 0.0004, latitude); // Much faster at equator, slower at poles
  float slowTime = uTime * coriolisSpeed * timeMultiplier;
  
  // Rotation with slight tilt to avoid perfect alignment with poles
  float angle = slowTime + latitude * 0.1; // Add latitude-based offset
  vec3 rotatedPos = vec3(
    spherePos.x * cos(angle) - spherePos.z * sin(angle),
    spherePos.y * 0.98 + 0.02 * sin(angle * 3.0), // Slight vertical wave
    spherePos.x * sin(angle) + spherePos.z * cos(angle)
  );
  
  // Add latitude-based bias for more clouds near equator, but ensure global coverage
  float equatorBias = 1.0 - smoothstep(0.0, 0.8, latitude); // More clouds near equator
  float globalCoverage = 0.2; // Lower minimum for clear sky areas
  
  // Add time-based evolution with cyclic behavior to prevent accumulation
  // Use modulo to create repeating cycles instead of endless accumulation
  float evolutionTime = mod(uTime * 0.003 * timeMultiplier, 628.318);  // Cycles every ~3.5 minutes at normal speed
  
  // Final sampling position - use rotated object space position with time offset
  // Add non-repeating distortion to break up patterns
  vec3 distortion = vec3(
    sin(spherePos.y * 3.14159 + spherePos.x * 2.718 + evolutionTime) * 0.15,
    cos(spherePos.x * 2.236 + spherePos.z * 1.618 + evolutionTime * 0.7) * 0.1,
    sin(spherePos.z * 1.414 - spherePos.y * 3.732 - evolutionTime * 0.5) * 0.15
  );
  
  // Use non-uniform scaling to avoid tiling
  vec3 p = (rotatedPos + distortion) * vec3(3.7, 4.3, 3.9);  // Non-uniform scale
  
  // Multi-scale noise with prime number frequencies to avoid repetition
  float k1 = 0.97;   // Large cloud systems
  float k2 = 2.31;   // Medium cloud formations
  float k3 = 4.73;   // Small cloud details
  
  // Layer multiple noise scales with bounded flow to prevent accumulation
  // Use sin/cos to create cyclic flow instead of linear accumulation
  vec3 flow1 = vec3(
    sin(evolutionTime * 1.2) * 2.0, 
    cos(evolutionTime * 0.8) * 2.0, 
    sin(evolutionTime * 1.0) * 2.0
  );
  vec3 flow2 = vec3(
    cos(evolutionTime * 2.3) * 1.5, 
    sin(evolutionTime * 1.9) * 1.5, 
    cos(evolutionTime * 1.5) * 1.5
  );
  vec3 flow3 = vec3(
    sin(evolutionTime * 3.7) * 1.0, 
    cos(evolutionTime * 3.1) * 1.0, 
    sin(evolutionTime * 3.3) * 1.0
  );
  
  float base = fbm(p*k1 + flow1); 
  float medium = fbm(p*k2 + flow2);
  float detail = fbm(p*k3 + flow3);
  
  // Combine with more weight on animated layers
  float cloudNoise = base * 0.4 + medium * 0.4 + detail * 0.2;
  
  // Add larger weather systems with moderate evolution for visible change
  float weatherPattern = fbm(p * 0.15 + vec3(evolutionTime * 0.2, evolutionTime * 0.15, evolutionTime * 0.18));
  
  // Add slow weather cycles to prevent eternal accumulation
  float weatherCycle = sin(evolutionTime * 0.01) * 0.2 + 0.8; // Oscillates between 0.6 and 1.0
  weatherPattern *= weatherCycle;
  
  float clearSkyMask = smoothstep(0.3, 0.7, weatherPattern);
  cloudNoise = mix(cloudNoise * 0.2, cloudNoise, clearSkyMask); // More contrast between clear and cloudy
  
  // Apply latitude bias and coverage with more variation
  float biasedNoise = mix(cloudNoise, cloudNoise + 0.2, mix(globalCoverage, equatorBias, 0.7));
  float mask = smoothstep(uCoverage, uCoverage + 0.4, biasedNoise);  // Sharper cloud edges
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