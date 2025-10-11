varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;
varying vec3 vWorldNormal;

uniform sampler2D uBiomeTexture;
uniform vec3 uLightDir;
uniform float uTime;

void main() {
  // DEBUG MODE 1: Output solid red to test if shader is running at all
  // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
  // return;
  
  // DEBUG MODE 2: Output UV coordinates as colors to test UV mapping
  // gl_FragColor = vec4(vUv.x, vUv.y, 0.0, 1.0);
  // return;
  
  // DEBUG MODE 3: Output biome texture directly to test texture sampling
  vec4 biomeData = texture2D(uBiomeTexture, vUv);
  gl_FragColor = vec4(biomeData.rgb, 1.0);
  return;
  
  // DEBUG MODE 4: Output normals as colors to test geometry
  // vec3 normal = normalize(vNormal);
  // gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
  // return;
  
  // DEBUG MODE 5: Output elevation as grayscale to test vertex displacement
  // float elev = vElevation * 10.0 + 0.5;
  // gl_FragColor = vec4(elev, elev, elev, 1.0);
  // return;
}