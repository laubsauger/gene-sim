import * as THREE from 'three';

export function makeProceduralCloudShell({ radius }: { radius: number }) {
  const cloudUniforms = {
    uLightDir: { value: new THREE.Vector3(1, 0, 0) },
    uTime: { value: 0 },
    uCoverage: { value: 0.5 },
    uDensity: { value: 0.6 },
    uLightWrap: { value: 0.25 },
    uTerminator: { value: 0.35 },
    uDayTint: { value: new THREE.Color(1, 1, 1) },
    uNightTint: { value: new THREE.Color(0.5, 0.65, 1.0) },
  };

  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false, // Transparent, no depth write
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */`
      varying vec3 vN; 
      varying vec3 vPosW;
      void main(){ 
        vN = normalize(normalMatrix*normal); 
        vec4 w=modelMatrix*vec4(position,1.0); 
        vPosW=w.xyz; 
        gl_Position=projectionMatrix*viewMatrix*w; 
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float; 
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
        f=f*f*(3.0-2.0*f); 
        return mix(
          mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), 
              mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y), 
          mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), 
              mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), 
          f.z
        ); 
      }
      
      float fbm(vec3 p, float t){ 
        float a=0.0, w=0.5, f=1.0; 
        for(int i=0; i<4; i++){ 
          a += w*noise(p*f + vec3(t*0.02, t*0.03, t*0.01)); 
          w*=0.5; f*=2.0; 
        } 
        return a; 
      }
      
      void main(){ 
        vec3 n=normalize(vN), l=normalize(uLightDir), sn=normalize(vPosW);
        float nl=dot(sn,l), wr=(nl+uLightWrap)/(1.0+uLightWrap), 
              dy=smoothstep(-uTerminator, uTerminator, wr);
        vec3 p=sn*4.0;
        float cld=fbm(p, uTime); 
        cld=smoothstep(1.0-uCoverage, 1.0-uCoverage*0.3, cld)*uDensity; 
        vec3 c=mix(uNightTint*0.15, uDayTint, dy);
        gl_FragColor=vec4(c, cld); 
      }
    `,
  });

  const cloudRadius = radius * 1.02;
  const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 48);
  const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
  cloudMesh.renderOrder = 2;
  cloudMesh.userData.isCloud = true;

  return { mesh: cloudMesh, uniforms: cloudUniforms, material: cloudMat };
}