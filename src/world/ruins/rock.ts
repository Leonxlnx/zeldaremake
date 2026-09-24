/**
 * Round 57 (expansion-ruins): the ruins' natural rock — the west cliff the fall pours from, the great
 * ivy rock right of the stair, the gate and shore boulders, the pale skin of the outcrop the trail
 * climbs onto, and the natural slab bridging the pool's west end (the reference's upper-left slab).
 *
 * All of it is smooth-shaded grids on the live ground (terrain/ruins.ts gives the cliff's face line
 * and the ivy rock's radius, so the walker's rules and the rock agree), written into two builders:
 * `cliff` (the cliff, the ivy rock, the slab and its pile — a darker weathered limestone) and
 * `boulder` (the boulders and the outcrop — the pale cracked stone of the reference's foreground).
 */
import { Vector3 } from 'three';
import { EXPANSION_RUINS } from '../layout';
import { CLIFF_DEPTH_M, cliffFaceX, pillarRadius, platformSigned, poolSigned } from '../terrain/ruins';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { MeshBuilder, type RGB } from './geom';

const R = EXPANSION_RUINS;
type Ground = (x: number, z: number) => number;

export interface Rock {
  cliff: MeshBuilder;
  boulder: MeshBuilder;
  blockers: { x: number; z: number; r: number; top: number }[];
  counts: Record<string, number>;
}

const n1 = new Noise2D('ruins-rock-a');
const n2 = new Noise2D('ruins-rock-b');
const n3 = new Noise2D('ruins-rock-c');
/** a cheap 3D value from 2D simplex slices, in about [-1, 1] */
const noise3 = (x: number, y: number, z: number) => (n1.noise(x + 0.31 * y, z - 0.17 * y) + n2.noise(y + 0.29 * z, x - 0.23 * z) + n3.noise(z + 0.37 * x, y - 0.19 * x)) / 2.2;

/**
 * A grid patch (MeshBuilder.grid) with smooth normals, turned to face `dir` at the probe cell
 * (u, v) — the winding is checked after the fact, so no caller has to get it right by hand.
 */
function patch(mb: MeshBuilder, nu: number, nv: number, at: (u: number, v: number) => { p: Vector3; c: RGB; moss?: number; wet?: number }, probe: [number, number], dir: Vector3): void {
  const v0 = mb.vertexCount;
  const t0 = mb.idx.length;
  mb.grid(nu, nv, at, false);
  mb.smoothNormals(v0, mb.vertexCount, t0);
  // a pole row (all its points one point) has only degenerate triangles: take the next row's normals
  const row = nu + 1;
  for (let k = v0; k < mb.vertexCount; k++) {
    if (Math.hypot(mb.nrm[k * 3], mb.nrm[k * 3 + 1], mb.nrm[k * 3 + 2]) > 0.5) continue;
    const nb = k - v0 < row ? k + row : k - row;
    for (let c = 0; c < 3; c++) mb.nrm[k * 3 + c] = mb.nrm[nb * 3 + c];
  }
  const pi = v0 + Math.round(probe[1] * nv) * (nu + 1) + Math.round(probe[0] * nu);
  if (mb.nrm[pi * 3] * dir.x + mb.nrm[pi * 3 + 1] * dir.y + mb.nrm[pi * 3 + 2] * dir.z >= 0) return;
  for (let t = t0; t < mb.idx.length; t += 3) {
    const b = mb.idx[t + 1];
    mb.idx[t + 1] = mb.idx[t + 2];
    mb.idx[t + 2] = b;
  }
  for (let k = v0 * 3; k < mb.vertexCount * 3; k++) mb.nrm[k] = -mb.nrm[k];
}

// ---------------------------------------------------------------------------------------------
// the west cliff's surface: one column per z, v 0 → CLIFF_FACE_V up the face from its foot to the
// lip, CLIFF_FACE_V → 1 over the rounded brow and down the back slope. The fall's water (water.ts)
// runs over the same function, so its sheet sits on the rock the mesh shows.
// ---------------------------------------------------------------------------------------------

const CLIFF_FACE_ROWS = 30;
const CLIFF_TOP_ROWS = 12;
const CLIFF_ROWS = CLIFF_FACE_ROWS + CLIFF_TOP_ROWS;
/** the v of the face's top row (the lip) */
export const CLIFF_FACE_V = CLIFF_FACE_ROWS / CLIFF_ROWS;
/** the cliff mesh's z range (the run and the slumped ends past it) */
export const CLIFF_Z: readonly [number, number] = [R.cliff.z0 - 2.5, R.cliff.z1 + 2.5];

/** 1 in the fall's channel (its water-worn notch), 0 more than ≈ 2.3 m to either side */
export function fallChannel(z: number): number {
  return 1 - smoothstep(R.fall.width * 0.35, R.fall.width * 0.75, Math.abs(z - R.fall.z));
}

/** the brow's height along z: the cliff's top, dipping to the fall's lip (the face's top row sits 0.35 m under it) */
function cliffTopAt(z: number): number {
  const C = R.cliff;
  const F = R.fall;
  const lip = 1 - smoothstep(F.width * 0.45, F.width * 1.5, Math.abs(z - F.z));
  return lerp(C.top + 0.5 * n1.noise(z * 0.21, 3.3) + 0.25 * n2.noise(z * 0.7, 1.1), F.top + 0.35, lip);
}

/** 1 along the cliff's run, easing to 0 past its ends (the mass slumps to a slope there) */
function cliffRunAt(z: number): number {
  return smoothstep(CLIFF_Z[0], R.cliff.z0 + 1.0, z) * (1 - smoothstep(R.cliff.z1 - 1.0, CLIFF_Z[1], z));
}

const strataAt = (z: number, y: number) => Math.sin(y * 2.3 + 1.7 * n1.noise(z * 0.3, y * 0.2));

/** the cliff's surface point at (z, v) with its tone, moss and damp (see CLIFF_FACE_V) */
export function cliffPoint(z: number, v: number, ground: Ground): { p: Vector3; c: RGB; moss: number; wet: number } {
  const C = R.cliff;
  const F = R.fall;
  const Q = R.pool;
  const back = C.x - CLIFF_DEPTH_M;
  const r = cliffRunAt(z);
  const face = cliffFaceX(z, 2);
  const g = ground(face + 0.6, z);
  const top = lerp(g + 0.4, cliffTopAt(z), Math.pow(r, 0.7));
  // behind the fall the rock is water-worn: a quarter of the relief, no knobs on the brow
  const worn = 1 - 0.75 * fallChannel(z);
  let x: number;
  let y: number;
  let ledge = 1;
  if (v <= CLIFF_FACE_V) {
    // up the face: strata ledges and fissures on the wandering face line, a flared foot
    const s = v / CLIFF_FACE_V;
    y = lerp(g - 0.6, top - 0.35, s);
    const strata = 0.22 * strataAt(z, y) + 0.12 * Math.sin(y * 5.1 + z * 0.4);
    const fiss = 0.3 * Math.pow(Math.abs(n2.noise(z * 0.55, y * 0.08)), 0.5) - 0.18;
    x = cliffFaceX(z, y) + (strata + fiss + 0.25 * noise3(z * 0.9, y * 0.6, 1.3)) * r * worn - (1 - r) * 1.5 * s;
    if (s < 0.06) x += 0.35 * (1 - s / 0.06);
    ledge = smoothstep(0.08, 0.2, strataAt(z, y) * 0.2 + 0.1);
  } else {
    // over the brow and down the back
    const s = (v - CLIFF_FACE_V) / (1 - CLIFF_FACE_V);
    const fx = cliffFaceX(z, top);
    const brow = Math.sin(Math.min(1, s * 3) * Math.PI * 0.5);
    const gy = ground(back - 0.5, z);
    const knobs = 1 - fallChannel(z);
    y = s < 0.35 ? top - 0.35 + 0.35 * brow + 0.3 * knobs * noise3(z * 0.6, s * 3, 7.1) : lerp(top + 0.25 * noise3(z * 0.4, 2.2, s), gy - 0.4, smoothstep(0.35, 1, s));
    x = lerp(fx - 0.3, back, s) + 0.3 * knobs * noise3(z * 0.5, y * 0.4, 4.4);
  }
  // tone: bleached toward the brow, greyer and damp toward the foot and by the fall
  const hRel = clamp((y - g) / Math.max(top - g, 0.5), 0, 1);
  const k = 0.86 + 0.16 * hRel + 0.08 * n3.noise(z * 0.8, y * 0.5);
  const nearFall = 1 - smoothstep(F.width * 0.6, F.width * 2.4, Math.abs(z - F.z));
  const byPool = poolSigned(face + 0.6, z) < 1.5 ? 1 - smoothstep(0.0, 1.4, y - Q.water) : 0;
  const wet = clamp(nearFall * (0.55 + 0.45 * (1 - hRel)) + byPool, 0, 1);
  const moss = clamp(0.25 * ledge + 0.35 * (1 - hRel) + 0.15 * nearFall * (1 - fallChannel(z)) + 0.2 * n2.noise(z * 0.4, y * 0.3), 0, 1);
  return { p: new Vector3(x, y, z), c: [k, k * 0.99, k * 0.96], moss, wet };
}

/** the x of the cliff's face at height y — the point `cliffPoint` gives the face's row at that height */
export function cliffFaceAt(z: number, y: number, ground: Ground): number {
  const g = ground(cliffFaceX(z, 2) + 0.6, z);
  const top = lerp(g + 0.4, cliffTopAt(z), Math.pow(cliffRunAt(z), 0.7));
  const s = clamp((y - (g - 0.6)) / Math.max(top - 0.35 - (g - 0.6), 0.1), 0, 1);
  return cliffPoint(z, s * CLIFF_FACE_V, ground).p.x;
}

export function buildRock(rng: Rng, ground: Ground, sun: Vector3): Rock {
  const cliff = new MeshBuilder();
  const boulder = new MeshBuilder();
  const blockers: Rock['blockers'] = [];
  const counts: Record<string, number> = { boulders: 0 };
  const C = R.cliff;
  const F = R.fall;
  const Q = R.pool;

  // the west cliff: face, rounded brow, broken top, back slope; the fall's lip notched into it
  patch(cliff, Math.ceil((CLIFF_Z[1] - CLIFF_Z[0]) / 0.32), CLIFF_ROWS, (u, v) => cliffPoint(lerp(CLIFF_Z[0], CLIFF_Z[1], u), v, ground), [0.5, 0.35], new Vector3(1, 0, 0));

  // ------------------------------------------------------------------------------------------
  // the ivy rock: a bulging, fissured column (terrain/ruins.ts pillarRadius), a mossy domed crown
  // ------------------------------------------------------------------------------------------
  {
    const P = R.pillar;
    let gMin = Infinity;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) gMin = Math.min(gMin, ground(P.x + Math.cos(a) * P.r, P.z + Math.sin(a) * P.r));
    const y0 = gMin - 0.6;
    const yTop = P.top - 0.6;
    patch(
      cliff,
      56,
      46,
      (u, v) => {
        const a = u * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        let y: number;
        let close = 1;
        if (v <= 0.9) y = y0 + (yTop - y0) * (v / 0.9);
        else {
          const w = (v - 0.9) / 0.1;
          y = yTop + 0.6 * Math.sin((w * Math.PI) / 2);
          close = Math.pow(Math.cos((w * Math.PI) / 2), 0.7);
        }
        const base = pillarRadius(a, Math.max(0, Math.min(y, yTop) - y0 - 0.6));
        const fiss = 0.09 * Math.pow(Math.abs(n1.noise(ca * 1.8 + sa * 0.4, y * 0.12)), 0.6) - 0.06;
        const lump = 0.05 * noise3(ca * 1.6, y * 0.35, sa * 1.6) + 0.02 * noise3(ca * 4.1, y * 0.9, sa * 4.1);
        // (the walker's rule is the plain radius + 0.15 m: the detail stays within 10 % of it)
        const r = Math.max(0.01, Math.min(base * (1 + fiss + lump), base * 1.1) * close);
        const crown = smoothstep(0.84, 1, v);
        const k = 0.8 + 0.12 * n2.noise(ca * 2 + y * 0.2, sa * 2) + 0.1 * smoothstep(y0 + 2, P.top - 1, y);
        const shade = 1 - smoothstep(-0.3, 0.5, ca * sun.x + sa * sun.z);
        const moss = clamp(0.2 + 0.35 * shade * (1 - smoothstep(y0, y0 + 5, y)) + 0.8 * crown + 0.25 * n3.noise(ca * 3 + y * 0.3, sa * 3), 0, 1);
        return { p: new Vector3(P.x + ca * r, y, P.z + sa * r), c: [k * 0.97, k, k * 0.95], moss, wet: 0.2 * (1 - smoothstep(y0, y0 + 2, y)) };
      },
      [0.25, 0.4],
      new Vector3(0, 0, 1),
    );
  }

  // ------------------------------------------------------------------------------------------
  // boulders: displaced spheroids, their undersides flattened and sunk into the ground
  // ------------------------------------------------------------------------------------------
  const rock = (mb: MeshBuilder, x: number, z: number, rx: number, ry: number, rz: number, yaw: number, mossTop: number, seed: number, block = true) => {
    const g = Math.min(ground(x, z), ground(x + rx, z), ground(x - rx, z), ground(x, z + rz), ground(x, z - rz));
    const cy = g + ry * 0.55;
    const cs = Math.cos(yaw);
    const sn = Math.sin(yaw);
    patch(
      mb,
      28,
      16,
      (u, v) => {
        const th = u * Math.PI * 2;
        const ph = (v - 0.5) * Math.PI;
        const dx = Math.cos(ph) * Math.cos(th);
        const dy = Math.sin(ph);
        const dz = Math.cos(ph) * Math.sin(th);
        const d = 1 + 0.16 * noise3(dx * 1.3 + seed, dy * 1.3, dz * 1.3) + 0.06 * noise3(dx * 3.4, dy * 3.4 + seed, dz * 3.4) + 0.1 * Math.max(0, Math.abs(dx) - 0.7);
        const lx = dx * rx * d;
        let ly = dy * ry * d;
        const lz = dz * rz * d;
        if (ly < -ry * 0.45) ly = -ry * 0.45 + (ly + ry * 0.45) * 0.5;
        const p = new Vector3(x + lx * cs - lz * sn, cy + ly, z + lx * sn + lz * cs);
        const up = smoothstep(-0.1, 0.8, dy);
        const k = 0.9 + 0.1 * noise3(dx * 2 + seed, dy * 2, dz * 2);
        const moss = clamp(mossTop * up * (0.6 + 0.6 * noise3(dx * 2.5, dy * 2.5, dz * 2.5 + seed)) + 0.25 * (1 - smoothstep(-0.6, -0.1, dy)), 0, 1);
        const wet = p.y < Q.water + 0.35 ? clamp((Q.water + 0.35 - p.y) / 0.4, 0, 1) : 0;
        return { p, c: [k, k * 0.985, k * 0.95], moss, wet };
      },
      [0.25, 0.5],
      new Vector3(-sn, 0, cs),
    );
    counts.boulders++;
    if (block) blockers.push({ x, z, r: Math.max(rx, rz) * 0.9, top: cy + ry });
  };
  // the gate: the two boulders the trail passes between (terrain/ruins.ts blocks them)
  const gr = rng.fork('gate');
  for (const [x, z, r] of R.gate) rock(boulder, x, z, r * gr.range(1.0, 1.15), r * gr.range(0.75, 0.95), r * gr.range(0.85, 1.0), gr.range(0, Math.PI), 0.8, gr.range(0, 50), false);
  // round the pool's rim and at the cliff's foot (hiding the lattice's soft shore)
  const br = rng.fork('shore');
  for (let k = 0; k < 16; k++) {
    const a = br.range(0, Math.PI * 2);
    const x = Q.x + Math.cos(a) * (Q.hx + 0.6);
    const z = Q.z + Math.sin(a) * (Q.hz + 0.6);
    const s = br.range(0.45, 1.25);
    const sx = br.range(1.0, 1.4);
    const sy = br.range(0.55, 0.8);
    const sz = br.range(0.8, 1.1);
    const yaw = br.range(0, Math.PI);
    const seed = br.range(0, 50);
    if (z < R.wall.z + 1.2) continue;
    if (x < C.x + 1.2 && Math.abs(z - F.z) < F.width) continue;
    rock(boulder, x, z, s * sx, s * sy, s * sz, yaw, 0.7, seed);
  }
  for (let k = 0; k < 7; k++) {
    const z = br.range(C.z0 + 1, C.z1 - 1);
    const dx = br.range(0.3, 0.9);
    const s = br.range(0.4, 0.95);
    const yaw = br.range(0, Math.PI);
    const seed = br.range(0, 50);
    if (Math.abs(z - F.z) < F.width * 0.8) continue;
    if (z > R.wall.z - 0.6 && z < R.wall.z + 0.8) continue;
    rock(boulder, cliffFaceX(z, 1) + dx, z, s * 1.2, s * 0.7, s, yaw, 0.6, seed);
  }
  // at the plunge: two wet rocks the fall breaks on
  rock(boulder, F.x + 1.6, F.z - 1.1, 0.7, 0.45, 0.6, 0.4, 0.25, 11.1, false);
  rock(boulder, F.x + 1.2, F.z + 1.35, 0.55, 0.4, 0.5, 1.3, 0.25, 17.3, false);

  // ------------------------------------------------------------------------------------------
  // the outcrop's skin: pale rock a few centimetres over the live ground, its outline where it
  // dives under the turf
  // ------------------------------------------------------------------------------------------
  {
    const Pl = R.platform;
    const xA = Pl.x0 - 0.3;
    const xB = Pl.x1 + Pl.edge + 0.6;
    const zA = Pl.z0 - Pl.edge - 0.6;
    const zB = R.wall.z - R.wall.half - 0.02;
    patch(
      boulder,
      Math.ceil((xB - xA) / 0.22),
      Math.ceil((zB - zA) / 0.22),
      (u, v) => {
        const x = lerp(xA, xB, u);
        const z = lerp(zA, zB, v);
        const g = ground(x, z);
        const sd = platformSigned(x, z);
        const edge = 0.25 * n1.noise(x * 0.9, z * 0.9) + 0.15 * n2.noise(x * 2.3, z * 2.3);
        const cover = 1 - smoothstep(0.2 + edge, 0.9 + edge, sd);
        const lump = 0.07 * Math.max(0, noise3(x * 0.8, z * 0.8, 2.2)) + 0.03 * noise3(x * 2.7, z * 2.7, 5.1);
        const k = 0.93 + 0.1 * n3.noise(x * 0.6, z * 0.6);
        const moss = clamp(0.2 + 0.55 * smoothstep(0.3, 0.9, n2.noise(x * 0.45 + 3, z * 0.45 - 2) * 0.5 + 0.5) + 0.3 * smoothstep(-0.8, 0.4, sd), 0, 1);
        return { p: new Vector3(x, g + lerp(-0.12, 0.03 + lump, cover), z), c: [k, k * 0.985, k * 0.95], moss };
      },
      [0.5, 0.5],
      new Vector3(0, 1, 0),
    );
  }

  // ------------------------------------------------------------------------------------------
  // the slab bridge: a thick, irregular natural slab from the terrace's wall across the pool's
  // west end to a rock pile on the south shore; its ends round off closed
  // ------------------------------------------------------------------------------------------
  {
    const a = new Vector3(-68.6, R.terrace.y - 0.12, R.wall.z + R.wall.half - 0.1);
    const b = new Vector3(-70.2, 3.3, Q.z + Q.hz + 0.9);
    const along = new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const across = new Vector3(along.z, 0, -along.x);
    patch(
      cliff,
      34,
      28,
      (s, v) => {
        const end = Math.pow(Math.sin(Math.min(1, Math.min(s, 1 - s) * 6) * Math.PI * 0.5), 0.35);
        const hw = (1.2 + 0.35 * n1.noise(s * 3.1, 1.7)) * end;
        const th = (0.55 + 0.2 * n2.noise(s * 2.3, 4.1)) * end;
        const cy = lerp(a.y, b.y, s) - 0.14 * Math.sin(s * Math.PI);
        // the loop: v 0 → 0.5 over the top from one edge to the other, 0.5 → 1 back under it
        const ang = v * Math.PI * 2;
        const cx = Math.cos(ang);
        const sy = Math.sin(ang);
        const ex = cx * hw * (1 + 0.08 * noise3(s * 5, cx * 2, 1.5));
        const off = sy > 0 ? 0.35 * th * Math.pow(sy, 0.35) : -th * (0.2 + 0.8 * Math.pow(-sy, 0.6));
        const p = new Vector3(lerp(a.x, b.x, s), 0, lerp(a.z, b.z, s)).addScaledVector(across, ex);
        p.y = cy + off + 0.05 * noise3(s * 8, cx * 3, sy * 3) * end;
        const k = 0.86 + 0.1 * n3.noise(s * 6, cx * 2);
        const moss = clamp((sy > 0.3 ? 0.55 : 0.15) + 0.35 * noise3(s * 4, cx * 2, sy * 2), 0, 1);
        return { p, c: [k, k * 0.98, k * 0.94], moss, wet: sy < -0.2 ? 0.25 : 0 };
      },
      [0.5, 0.25],
      new Vector3(0, 1, 0),
    );
    const pr = rng.fork('pile');
    rock(cliff, b.x + 0.2, b.z + 0.5, 1.5, 1.6, 1.3, pr.range(0, 3), 0.6, 31.7);
    rock(cliff, b.x - 1.3, b.z + 0.9, 1.0, 1.0, 0.9, pr.range(0, 3), 0.6, 37.1);
    rock(cliff, b.x + 1.5, b.z + 1.2, 0.9, 0.8, 0.8, pr.range(0, 3), 0.6, 41.9);
  }
  return { cliff, boulder, blockers, counts };
}
