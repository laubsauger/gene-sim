precision highp float;

#include <common>
#include <logdepthbuf_pars_fragment>

varying vec3 vN;
varying vec3 vPosW;
varying vec3 vPosObject; // Receive object space position from vertex shader
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
  float NdotL = dot(N, L);
  float wrap = clamp((NdotL + uLightWrap)/(1.0+uLightWrap), 0.0, 1.0);
  float day = smoothstep(0.0, uTerminator, wrap);
  
  // Use object space position (normalized position on sphere) 
  // This ensures clouds are always sampled from the same place regardless of camera
  vec3 spherePos = normalize(vPosObject); // Use vertex position in object space
  
  // Direct 3D noise sampling in object space
  float timeMultiplier = 1.0 - uPaused;  // 0 when paused, 1 when moving
  
  // Much slower cloud movement
  float slowTime = uTime * 0.00005 * timeMultiplier;  // MUCH slower rotation
  
  // Simple rotation around Y axis in object space
  float angle = slowTime;
  vec3 rotatedPos = vec3(
    spherePos.x * cos(angle) - spherePos.z * sin(angle),
    spherePos.y,
    spherePos.x * sin(angle) + spherePos.z * cos(angle)
  );
  
  // Final sampling position - use rotated object space position
  vec3 p = rotatedPos * 4.0;  // Scale for appropriate cloud size
  float k=1.5;  // Lower frequency for larger cloud formations
  float base=fbm(p*k); 
  float detail=fbm(p*k*3.0);  // More detailed overlay
  float mask=smoothstep(uCoverage, 1.0, mix(base, detail, 0.7));  // More detail influence
  float thickness = mask; 
  float grazed = 1.0 - clamp(NdotL*0.7 + 0.3, 0.0, 1.0); 
  float shade = mix(1.0, 0.75, grazed * thickness);
  float limb = pow(1.0 - clamp(dot(N,V), 0.0, 1.0), 1.2);
  vec3 dayCol = uDayTint * shade; 
  vec3 nightCol = uNightTint * 0.4;
  vec3 col = mix(nightCol, dayCol, day) * mask;
  float alpha = uDensity * mask * mix(0.1, 1.0, day) * mix(1.0, 0.6, limb);
  if(alpha < 0.01) discard; 
  gl_FragColor = vec4(col, alpha);
}