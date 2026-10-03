// Deterministic seeded noise utilities for Emberfall world generation.

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic hash of integer coords + seed -> [0,1)
export function rand2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function rand3(seed: number, x: number, y: number, z: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 ^ 0x5bf03635);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number { return t * t * (3 - 2 * t); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export class Noise2 {
  seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  raw(x: number, y: number): number { return rand2(this.seed, x, y) * 2 - 1; }
  /** Smooth value noise in [-1,1] */
  n(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = this.raw(xi, yi), b = this.raw(xi + 1, yi);
    const c = this.raw(xi, yi + 1), d = this.raw(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  /** Fractal brownian motion, roughly [-1,1] */
  fbm(x: number, y: number, oct: number, lac = 2, gain = 0.5): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.n(x * freq, y * freq);
      norm += amp;
      amp *= gain; freq *= lac;
    }
    return sum / norm;
  }
  /** Ridged multifractal, [0,1] */
  ridge(x: number, y: number, oct: number): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      const v = 1 - Math.abs(this.n(x * freq, y * freq));
      sum += amp * v * v;
      norm += amp;
      amp *= 0.5; freq *= 2.1;
    }
    return sum / norm;
  }
}

export class Noise3 {
  seed: number;
  constructor(seed: number) { this.seed = (seed ^ 0x9e3779b9) >>> 0; }
  raw(x: number, y: number, z: number): number { return rand3(this.seed, x, y, z) * 2 - 1; }
  n(x: number, y: number, z: number): number {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = smooth(xf), v = smooth(yf), w = smooth(zf);
    const c000 = this.raw(xi, yi, zi), c100 = this.raw(xi + 1, yi, zi);
    const c010 = this.raw(xi, yi + 1, zi), c110 = this.raw(xi + 1, yi + 1, zi);
    const c001 = this.raw(xi, yi, zi + 1), c101 = this.raw(xi + 1, yi, zi + 1);
    const c011 = this.raw(xi, yi + 1, zi + 1), c111 = this.raw(xi + 1, yi + 1, zi + 1);
    const x00 = lerp(c000, c100, u), x10 = lerp(c010, c110, u);
    const x01 = lerp(c001, c101, u), x11 = lerp(c011, c111, u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
  }
  fbm(x: number, y: number, z: number, oct: number): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.n(x * freq, y * freq, z * freq);
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  }
}
