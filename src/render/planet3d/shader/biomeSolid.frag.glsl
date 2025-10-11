// Ultra-simple solid shader for debugging
varying vec2 vUv;
uniform sampler2D uBiomeTexture;

void main() {
  // Sample biome texture
  vec4 biomeColor = texture2D(uBiomeTexture, vUv);
  
  // Output solid color with full opacity
  gl_FragColor = vec4(biomeColor.rgb, 1.0);
}