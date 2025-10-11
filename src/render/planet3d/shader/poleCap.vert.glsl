// Support for logarithmic depth buffer
#ifdef USE_LOGDEPTHBUF
  #ifdef USE_LOGDEPTHBUF_EXT
    varying float vFragDepth;
  #endif
  uniform float logDepthBufFC;
#endif

varying vec2 vUv;
varying vec3 vWorldNormal;

void main() {
  vUv = uv;

  // Calculate world normal for lighting (matches terrain shader)
  vWorldNormal = normalize(mat3(modelMatrix) * normal);

  // Transform position
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Handle logarithmic depth buffer
  #ifdef USE_LOGDEPTHBUF
    gl_Position.z = log2(max(1e-6, gl_Position.w + 1.0)) * logDepthBufFC;
    #ifdef USE_LOGDEPTHBUF_EXT
      vFragDepth = 1.0 + gl_Position.w;
    #else
      gl_Position.z = (gl_Position.z - 1.0) * gl_Position.w;
    #endif
  #endif
}
