/**
 * Deterministic seeded randomness. Every placement system in the world MUST use this
 * (never Math.random) so captures are reproducible across machines and CI runs — the
 * gauntlet compares screenshots between commits, which is meaningless with nondeterminism.
 */

export function hashString(value: string | number): number {
  const s = String(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Rng {
  /** uniform [0,1) */
  (): number;
  range(min: number, max: number): number;
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
  /** approximately gaussian, mean 0, sd 1 */
  gauss(): number;
  /** derive an independent child stream */
  fork(label: string | number): Rng;
}

export function createRng(seed: string | number): Rng {
  let state = hashString(seed) || 0x9e3779b9;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const rng = next as Rng;
  rng.range = (a, b) => a + (b - a) * next();
  rng.int = (a, b) => a + Math.floor(next() * (b - a));
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  rng.chance = (p) => next() < p;
  rng.gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  rng.fork = (label) => createRng(`${seed}/${label}`);
  return rng;
}

/** Stable 2D hash in [0,1) for spatial jitter (no state). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(Math.floor(x) | 0, 374761393) ^ Math.imul(Math.floor(y) | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
