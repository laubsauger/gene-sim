// Simple 2D Perlin-like noise for food distribution
// Based on value noise with interpolation

export function createNoise2D(seed: number) {
  // Simple hash function for deterministic randomness
  const hash = (x: number, y: number): number => {
    let h = seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  };

  // Smooth interpolation
  const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
  
  // Linear interpolation
  const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

  return (x: number, y: number, scale: number = 10): number => {
    // Scale coordinates
    x /= scale;
    y /= scale;

    // Get grid coordinates
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    // Get interpolation weights
    const sx = fade(x - x0);
    const sy = fade(y - y0);

    // Get noise values at corners
    const n00 = hash(x0, y0);
    const n10 = hash(x1, y0);
    const n01 = hash(x0, y1);
    const n11 = hash(x1, y1);

    // Interpolate
    const nx0 = lerp(n00, n10, sx);
    const nx1 = lerp(n01, n11, sx);
    return lerp(nx0, nx1, sy);
  };
}

// Multi-octave noise for more natural patterns
export function createFractalNoise2D(seed: number) {
  const noise = createNoise2D(seed);
  
  return (x: number, y: number, scale: number = 10, octaves: number = 3): number => {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += noise(x * frequency, y * frequency, scale) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  };
}