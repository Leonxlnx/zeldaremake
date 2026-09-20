/**
 * The path-fringe pebbles (round 47 handoff → `docs/GOAL_MODE.md` fable-2 #4).
 *
 * The old scatter drew every candidate from ONE sequential stream — a segment index, an offset, an
 * acceptance roll, then size / yaw / variant — so a mask change at any candidate (a hardscape lane
 * moving a joint, a path point added) changed how many draws that candidate consumed and shifted
 * every pebble after it, world-wide: round 47's whole camera-D delta was pebbles that had nothing
 * to do with the change. The segment index also depended on the path's point count.
 *
 * Here every candidate is a CELL of a fixed world lattice and every draw for it is a stateless hash
 * of the cell (jitter, acceptance, size, yaw, variant): a mask edit flips only the cells whose mask
 * changed; everything else is byte-identical. The paving's fringe (`mask.path` 0.01 … 0.55) is a band
 * a few centimetres wide, so it is sampled on a fine lattice (`FINE_M`) inside the coarse cells that
 * touch paving; the sparse off-fringe scatter within 4 m of the paving samples the coarse lattice
 * (`COARSE_M`). The lattice covers the layout's paving wherever it is, so the north path and the
 * second clearing get their fringe too; cells beyond `northZ` are returned separately so the rocks
 * system can draw them as a north-locality mesh (hidden from the plaza's cameras).
 */
import { Color } from 'three';
import type { Terrain } from '../terrain/heightfield';
import { hash2, hashString } from '../util/prng';

/**
 * The pebble variants (opus #16: not "identical smooth olive ellipsoids"): angular chunks and worn
 * cobbles, flat to tall, four tints, moss on some. Each is one 80-triangle rock and one instanced
 * draw; the scatter picks per cell.
 */
export const PEBBLE_LOOKS: { cuts: number; cutDepth: [number, number]; squash: number; lump: number; crease: number; moss: number; tint: Color }[] = [
  { cuts: 3, cutDepth: [0.55, 0.78], squash: 0.62, lump: 0.35, crease: 30, moss: 0.1, tint: new Color(0.68, 0.67, 0.64) }, // grey chunk
  { cuts: 1, cutDepth: [0.8, 0.94], squash: 0.75, lump: 0.3, crease: 50, moss: 0.3, tint: new Color(0.7, 0.69, 0.66) }, // the old cobble
  { cuts: 4, cutDepth: [0.5, 0.75], squash: 0.5, lump: 0.45, crease: 30, moss: 0.05, tint: new Color(0.74, 0.7, 0.6) }, // flat tan shard
  { cuts: 2, cutDepth: [0.6, 0.85], squash: 0.85, lump: 0.4, crease: 34, moss: 0.35, tint: new Color(0.52, 0.5, 0.46) }, // dark tall chunk
  { cuts: 2, cutDepth: [0.7, 0.9], squash: 0.55, lump: 0.35, crease: 45, moss: 0.4, tint: new Color(0.66, 0.66, 0.6) }, // mossy flat cobble
  { cuts: 3, cutDepth: [0.55, 0.8], squash: 0.7, lump: 0.5, crease: 30, moss: 0.0, tint: new Color(0.78, 0.76, 0.7) }, // pale chunk, bare
  { cuts: 4, cutDepth: [0.6, 0.82], squash: 0.45, lump: 0.3, crease: 32, moss: 0.15, tint: new Color(0.6, 0.6, 0.58) }, // grey flake
  { cuts: 1, cutDepth: [0.78, 0.92], squash: 0.65, lump: 0.28, crease: 55, moss: 0.25, tint: new Color(0.72, 0.68, 0.6) }, // warm worn cobble
];
export const PEBBLE_VARIANTS = PEBBLE_LOOKS.length;

export interface PebbleInstance {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  variant: number;
}

/** coarse lattice pitch (m): the off-fringe scatter's candidates, and the cells that get subdivided */
export const COARSE_M = 0.5;
/** fine lattice pitch (m) on the paving's fringe */
export const FINE_M = 0.1;
const SUB = Math.round(COARSE_M / FINE_M);

export interface PebbleScatterOptions {
  /** the lattice's half-extent from the origin (m) */
  radius: number;
  /** cells with z below this go to the `north` list */
  northZ: number;
  /** acceptance per fine cell on the paving's fringe (mask.path 0.01 … 0.55) */
  fringe: number;
  /** acceptance per coarse cell off the fringe within 4 m of paving */
  scatter: number;
  /** overall density multiplier (the world config's) */
  density: number;
}

/** calibrated on the round-48 world at density 1 to the old ≈ 2 600 (the browser world lands ≈ 2 700 at 0.38 / 0.39 — hashes vary ± 4 % with the seed — so a notch under, to keep camera A at the head's 9.00 M) */
export const PEBBLE_DEFAULTS: Omit<PebbleScatterOptions, 'radius' | 'northZ' | 'density'> = { fringe: 0.36, scatter: 0.37 };

/**
 * Pebbles along every paved edge inside the lattice: `main` (z ≥ northZ) and `north` (z < northZ).
 * `seed` names the stream; the same seed and the same masks give the same pebbles, cell by cell.
 */
export function scatterPathPebbles(T: Terrain, seed: string, o: PebbleScatterOptions): { main: PebbleInstance[]; north: PebbleInstance[] } {
  const main: PebbleInstance[] = [];
  const north: PebbleInstance[] = [];
  const k = hashString(`${seed}/pebbles`);
  const R = o.radius;
  // a 1 m grid of "paving here" (mask.path > 0.005 at the cell centre): the coarse cells to
  // subdivide are those within 1 m of it, the scatter's within 4 m — coarse, cheap, and a paving
  // edit changes it only around the edit
  const G = 1;
  const gn = Math.ceil(R / G) + 5;
  const gw = 2 * gn + 1;
  const paved = new Uint8Array(gw * gw);
  for (let iz = -gn; iz <= gn; iz++) for (let ix = -gn; ix <= gn; ix++) if (T.mask(ix * G + 0.5, iz * G + 0.5).path > 0.005) paved[(iz + gn) * gw + (ix + gn)] = 1;
  const pavedWithin = (x: number, z: number, cells: number) => {
    const ix = Math.floor(x / G);
    const iz = Math.floor(z / G);
    for (let dz = -cells; dz <= cells; dz++) {
      for (let dx = -cells; dx <= cells; dx++) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (jx < -gn || jx > gn || jz < -gn || jz > gn) continue;
        if (paved[(jz + gn) * gw + (jx + gn)]) return true;
      }
    }
    return false;
  };
  const emit = (x: number, z: number, hx: number, hz: number, hk: number) => {
    const sc = 0.025 + 0.085 * hash2(hx, hz, hk + 3);
    const it: PebbleInstance = { x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: hash2(hx, hz, hk + 4) * Math.PI * 2, variant: Math.floor(hash2(hx, hz, hk + 5) * PEBBLE_VARIANTS) };
    (z < o.northZ ? north : main).push(it);
  };
  const n = Math.ceil(R / COARSE_M);
  for (let cz = -n; cz <= n; cz++) {
    for (let cx = -n; cx <= n; cx++) {
      const x0 = cx * COARSE_M;
      const z0 = cz * COARSE_M;
      const xc = x0 + COARSE_M / 2;
      const zc = z0 + COARSE_M / 2;
      if (xc * xc + zc * zc > R * R) continue;
      if (!pavedWithin(xc, zc, 4)) continue;
      if (pavedWithin(xc, zc, 1)) {
        // the fringe: fine cells, each its own hash
        for (let fz = 0; fz < SUB; fz++) {
          for (let fx = 0; fx < SUB; fx++) {
            const gx = cx * SUB + fx;
            const gz = cz * SUB + fz;
            const x = x0 + (fx + hash2(gx, gz, k)) * FINE_M;
            const z = z0 + (fz + hash2(gx, gz, k + 1)) * FINE_M;
            const m = T.mask(x, z);
            if (m.path < 0.01 || m.path > 0.55 || m.stairs > 0.5 || m.structure > 0.5) continue;
            if (hash2(gx, gz, k + 2) >= o.fringe * o.density) continue;
            emit(x, z, gx, gz, k);
          }
        }
      }
      // the sparse scatter off the fringe (coarse cell, its own hash offsets)
      const x = x0 + hash2(cx, cz, k + 7) * COARSE_M;
      const z = z0 + hash2(cx, cz, k + 8) * COARSE_M;
      const m = T.mask(x, z);
      if (m.path >= 0.01 || m.stairs > 0.5 || m.structure > 0.5) continue;
      if (hash2(cx, cz, k + 9) >= o.scatter * o.density) continue;
      emit(x, z, cx, cz, k + 10);
    }
  }
  return { main, north };
}

export interface StairLike {
  id: string;
  base: [number, number, number];
  dir: [number, number];
  width: number;
}

/**
 * Pebbles at a stair's foot: 70 per flight (× density) below the first riser, each from its own
 * hash of (stair id, index) so a flight added to the layout moves no other flight's stones.
 */
export function stairFootPebbles(T: Terrain, seed: string, s: StairLike, density: number): PebbleInstance[] {
  const out: PebbleInstance[] = [];
  const k = hashString(`${seed}/pebbles/stair/${s.id}`);
  const l = Math.hypot(s.dir[0], s.dir[1]);
  const dx = s.dir[0] / l;
  const dz = s.dir[1] / l;
  const n = Math.round(70 * density);
  for (let i = 0; i < n; i++) {
    const u = -1.6 + 1.5 * hash2(i, 0, k);
    const v = (-s.width / 2 - 1.0) + (s.width + 2.0) * hash2(i, 1, k);
    const x = s.base[0] + u * dx - v * dz;
    const z = s.base[2] + u * dz + v * dx;
    const m = T.mask(x, z);
    if (m.stairs > 0.5 || m.structure > 0.5) continue;
    const sc = 0.03 + 0.09 * hash2(i, 2, k);
    out.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: hash2(i, 3, k) * Math.PI * 2, variant: Math.floor(hash2(i, 4, k) * PEBBLE_VARIANTS) });
  }
  return out;
}
