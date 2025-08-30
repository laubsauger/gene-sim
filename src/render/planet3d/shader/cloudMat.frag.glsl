precision highp float;

#include <common>
#include <logdepthbuf_pars_fragment>

varying vec3 vN;
varying vec3 vPosW;
uniform vec3 uLightDir;
uniform float uTime, uCoverage, uDensity, uLightWrap, uTerminator;
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
  // Use world position for stable cloud sampling
  // Clouds move east-west (around Y axis) with Earth's rotation, with slight north-south drift
  vec3 spherePos = normalize(vPosW);
  // Apply rotation-based movement (longitude) and slight latitude drift
  float longitude = atan(spherePos.z, spherePos.x);
  float latitude = asin(spherePos.y);
  vec3 p = vec3(
    cos(latitude) * cos(longitude + 0.003*uTime),  // Much slower east-west movement
    sin(latitude + 0.001*sin(uTime*0.1)),          // Very slight north-south oscillation
    cos(latitude) * sin(longitude + 0.003*uTime)   // Much slower east-west movement
  ) * 6.0;
  float k=1.5; 
  float base=fbm(p*k); 
  float detail=fbm(p*k*2.3); 
  float mask=smoothstep(uCoverage, 1.0, mix(base, detail, 0.55));
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