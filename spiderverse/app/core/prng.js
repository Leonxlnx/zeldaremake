// Deterministic randomness. No Math.random anywhere in the production - every frame has to
// be reproducible or before/after comparison means nothing.

/** Mulberry32. Returns a function producing numbers in [0,1). */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless 2D hash in [0,1). */
export function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
}

/** Stateless 3D hash in [0,1). */
export function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** Value noise in [-1,1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(i, seed) * 2 - 1;
  const b = hash2(i + 1, seed) * 2 - 1;
  return lerp(a, b, fade(f));
}

/** Value noise in [-1,1]. */
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash3(ix, iy, seed) * 2 - 1;
  const b = hash3(ix + 1, iy, seed) * 2 - 1;
  const c = hash3(ix, iy + 1, seed) * 2 - 1;
  const d = hash3(ix + 1, iy + 1, seed) * 2 - 1;
  const u = fade(fx);
  const v = fade(fy);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Fractal value noise in roughly [-1,1]. */
export function fbm2(x, y, seed = 0, octaves = 4, gain = 0.5, lacunarity = 2.0) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(fx, fy, seed + o * 31) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / Math.max(norm, 1e-6);
}

/** Fractal 1D noise in roughly [-1,1]. */
export function fbm1(x, seed = 0, octaves = 4, gain = 0.5, lacunarity = 2.0) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(fx, seed + o * 31) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
  }
  return sum / Math.max(norm, 1e-6);
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = lerp;
export { lerp };

/** Ease curves used throughout the acting. */
export const ease = {
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const c = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
  },
  /** Snappy anticipation-then-overshoot, the workhorse of stylised timing. */
  snap: (t) => {
    if (t < 0.22) return -0.18 * Math.sin((t / 0.22) * Math.PI);
    const u = (t - 0.22) / 0.78;
    return 1 + 0.26 * Math.pow(1 - u, 2.2) * Math.sin(u * Math.PI * 2.1) - Math.pow(1 - u, 3.4);
  },
};
