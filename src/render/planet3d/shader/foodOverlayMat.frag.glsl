uniform sampler2D uFoodTexture;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Sample food texture with proper coordinate transformation
  vec2 adjustedUv = vUv;

  // IMPORTANT: The sphere UV covers the full sphere (poles included)
  // But our food data only covers the middle 85% (the actual world area)
  // We need to:
  // 1. Check if we're in the pole regions (top/bottom 7.5%)
  // 2. If in poles, discard (no food there)
  // 3. If in world area, map from the 85% band to full texture
  
  // Check if we're in pole regions
  if (adjustedUv.y < 0.075 || adjustedUv.y > 0.925) {
    discard; // No food in pole regions
  }
  
  // Map from the middle 85% of sphere UV to full food texture
  // adjustedUv.y is in range [0.075, 0.925] 
  // We need to map this to [0, 1] for the food texture
  adjustedUv.y = (adjustedUv.y - 0.075) / 0.85;
  
  // Flip Y to match the 2D scene (since we're not using flipY on texture)
  adjustedUv.y = 1.0 - adjustedUv.y;
  
  float food = texture2D(uFoodTexture, adjustedUv).r;
  
  // Skip completely empty cells for transparency
  if (food < 0.01) {
    discard;
  }
  
  // Normalize food value (0-255 to 0-1)
  float foodLevel = food / 255.0;
  
  // Purple gradient for food visualization (matching Scene2D)
  // Darker = depleted, Brighter = more food available
  vec3 depleted = vec3(0.15, 0.05, 0.2);   // Very dark purple (almost consumed)
  vec3 sparse = vec3(0.3, 0.15, 0.5);      // Dark purple (low food)
  vec3 medium = vec3(0.5, 0.3, 0.8);       // Medium purple (moderate food)
  vec3 abundant = vec3(0.7, 0.5, 1.0);     // Bright purple (plenty of food)
  vec3 full = vec3(0.85, 0.7, 1.0);        // Very bright purple (untouched)
  
  vec3 color;
  float alpha = uOpacity;
  
  // Create smoother gradient with 5 levels for better visualization
  if (foodLevel < 0.2) {
    // Very low food - dark and less visible
    color = mix(depleted, sparse, foodLevel * 5.0);
    alpha *= (0.4 + foodLevel * 2.0); // Less visible when depleted
  } else if (foodLevel < 0.4) {
    // Low food - transitioning to more visible
    color = mix(sparse, medium, (foodLevel - 0.2) * 5.0);
    alpha *= 0.7;
  } else if (foodLevel < 0.6) {
    // Medium food - clearly visible
    color = mix(medium, abundant, (foodLevel - 0.4) * 5.0);
    alpha *= 0.8;
  } else if (foodLevel < 0.8) {
    // High food - bright and visible
    color = mix(abundant, full, (foodLevel - 0.6) * 5.0);
    alpha *= 0.9;
  } else {
    // Full food - brightest
    color = full;
    alpha *= 1.0; // Full visibility for untouched areas
  }
  
  // Fade near edges of the sphere for better blending
  float edgeFade = 1.0 - pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPosition))), 2.0);
  alpha *= edgeFade;
  
  gl_FragColor = vec4(color, alpha);
}