/** Deterministic randomness. The film is a pure function of time, so nothing may call Math.random. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private f: () => number;
  constructor(seed = 1) {
    this.f = mulberry32(seed);
  }
  next(): number {
    return this.f();
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.f();
  }
  int(a: number, bInclusive: number): number {
    return a + Math.floor(this.f() * (bInclusive - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.f() * arr.length) % arr.length];
  }
  chance(p: number): boolean {
    return this.f() < p;
  }
  /** approx. normal distribution (sum of uniforms) */
  gauss(mean = 0, sd = 1): number {
    return mean + sd * (this.f() + this.f() + this.f() + this.f() - 2) * 1.2247;
  }
  fork(salt: number): Rng {
    return new Rng((Math.floor(this.f() * 4294967296) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
  }
}

/** integer hash → [0, 1) */
export function hash1(n: number): number {
  let x = Math.imul((n | 0) ^ 0x27d4eb2d, 0x165667b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hash2(x: number, y: number): number {
  return hash1(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663));
}

export function hash3(x: number, y: number, z: number): number {
  return hash1(Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791));
}

/** smooth 1D value noise in [-1, 1] */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

/** fractal 1D noise, roughly in [-1, 1] */
export function fbm1(x: number, seed = 0, octaves = 3): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * noise1(x * f, seed + o * 17);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

/** 2D value noise in [-1, 1] */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash3(a, b, seed) * 2 - 1;
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const c = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
