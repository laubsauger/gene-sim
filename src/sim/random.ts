// Type for random number generator function
export type Rng = () => number;

// SFC32 - Fast, high-quality PRNG with good statistical properties
export const sfc32 = (a: number, b: number, c: number, d: number): Rng => {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21 | c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
};

// Create a seeded RNG from a single seed value
export const createRng = (seed: number) => {
  // Mix the seed to get 4 initialization values
  const s = seed >>> 0;
  return sfc32(s, s ^ 0x9e3779b9, s ^ 0x85ebca6b, s ^ 0xc2b2ae35);
};