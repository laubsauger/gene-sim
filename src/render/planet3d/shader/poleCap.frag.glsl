// Support for logarithmic depth buffer
#ifdef USE_LOGDEPTHBUF
  #ifdef USE_LOGDEPTHBUF_EXT
    #extension GL_EXT_frag_depth : enable
    varying float vFragDepth;
  #endif
  uniform float logDepthBufFC;
#endif

varying vec2 vUv;
varying vec3 vWorldNormal;

uniform sampler2D uIceTexture;
uniform vec3 uLightDir;

void main() {
  // Sample ice texture
  vec4 iceColor = texture2D(uIceTexture, vUv);

  // Calculate lighting using WORLD space normal (matches terrain)
  vec3 worldNormal = normalize(vWorldNormal);
  float NdotL = max(dot(worldNormal, uLightDir), 0.0);

  // Extremely low ambient to match terrain
  vec3 ambient = vec3(0.005, 0.008, 0.012);

  // Add blue-white emissive glow for ice
  vec3 emissive = vec3(0.88, 0.95, 1.0) * 0.15;

  // Combine lighting - reduced to 0.85 to match terrain
  vec3 finalColor = iceColor.rgb * (ambient + NdotL * 0.85) + emissive;

  // Handle logarithmic depth buffer in fragment shader
  #ifdef USE_LOGDEPTHBUF_EXT
    gl_FragDepthEXT = log2(vFragDepth) * logDepthBufFC * 0.5;
  #endif

  gl_FragColor = vec4(finalColor, 1.0);
}
