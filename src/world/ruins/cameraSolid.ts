/**
 * The play camera's view of the ruins (camera/collision.ts, through `ctx.shared.cameraSolidGrids`):
 * one grid over the site at 0.25 m, grown by a cell, holding the shells the camera keeps Link in
 * front of —
 *  - the rock as built: the cliff, the ivy rock, the slab bridge and its pile (the cliff builder's
 *    geometry), and the gate boulders (as balls);
 *  - the masonry the walker never stands on: the terrace block's outer faces and the retaining wall
 *    up to UNDER_TOP under the walked tops, the ruined parapet on the terrace section's wall top, the
 *    parapet with its posts and finials, the arch's ring and pendant, the colonnade's lintel, the
 *    broken arch's piers and surviving ring.
 * The walked surfaces (paving, treads, the outcrop) stay out: the camera's lift keeps it over the
 * character's ground already, and a shell there would pull it in whenever it stood low behind Link.
 * The columns are slim (`ruinsColumnBlockers`, published with the fallen pieces: the camera refuses
 * to stand inside one but may look past it). Built for play only (never under a headless capture).
 */
import { Box3, type BufferGeometry, Matrix4, Vector3 } from 'three';
import { EXPANSION_RUINS } from '../layout';
import { VoxelGrid, worldBounds } from '../util/voxelGrid';
import { PARAPET_POSTS, PARAPET_Z, type Blocker } from './masonry';

const R = EXPANSION_RUINS;
const T = R.terrace;
const W = R.wall;
const A = R.arch;
const P = R.parapet;
/** the grid's cell (m), the structures' camera grid's */
const CELL = 0.25;
/**
 * The masonry's solid stops this far under a walked top: grown by a cell (and rounded to one) it
 * stays under the camera's clearance over that top (collision.ts CLEARANCE 0.35).
 */
const UNDER_TOP = 0.45;

type Ground = (x: number, z: number) => number;

/**
 * The columns and piers as walker/camera discs (x, z, foot radius, top): the arch's two, the
 * colonnade's (the stump its broken height), the broken arch's piers. The character's ground blocks
 * the same feet (terrain/ruins.ts `RUINS_COLUMN_FEET`); the camera reads these as slim parts.
 */
export function ruinsColumnBlockers(): Blocker[] {
  const off = A.span / 2 + A.columnR;
  const out: Blocker[] = [
    { x: A.x, z: A.z - off, r: A.columnR + 0.18, top: T.y + A.columnH },
    { x: A.x, z: A.z + off, r: A.columnR + 0.18, top: T.y + A.columnH },
  ];
  for (const [x, h] of R.colonnade.columns) out.push({ x, z: R.colonnade.z, r: 0.42, top: T.y + (h > 0 ? h + 0.42 : -h) });
  out.push({ x: R.brokenArch.x, z: R.brokenArch.z[0], r: 0.55, top: T.y + 2.8 });
  out.push({ x: R.brokenArch.x, z: R.brokenArch.z[1], r: 0.55, top: T.y + 1.7 });
  return out;
}

export interface RuinsCameraSolid {
  grid: VoxelGrid;
  report: { cells: number; bytes: number; triangles: number; ms: number };
}

/** the grid from the cliff builder's geometry (world space) and the layout's masonry */
export function buildRuinsCameraSolid(rock: BufferGeometry, ground: Ground): RuinsCameraSolid {
  const t0 = performance.now();
  const identity = new Matrix4();
  const box = worldBounds([{ geometry: rock, matrix: identity }], 1);
  const east = Math.max(W.x1, ...R.gate.map((g) => g[0] + g[2]));
  box.union(new Box3(new Vector3(W.x0 - 1, -2.5, Math.min(T.z0, ...R.gate.map((g) => g[1] - g[2])) - 1), new Vector3(east + 1, T.y + A.columnH + A.span / 2 + 1.5, W.z + W.half + 1)));
  const grid = new VoxelGrid(box, CELL);
  const bottom = grid.y0;
  const at = (v: number, o: number) => Math.floor((v - o) / CELL);
  /** every cell of the axis-aligned box */
  const fillBox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => {
    for (let iz = at(z0, grid.z0); iz <= at(z1, grid.z0); iz++) {
      for (let iy = at(y0, grid.y0); iy <= at(y1, grid.y0); iy++) {
        for (let ix = at(x0, grid.x0); ix <= at(x1, grid.x0); ix++) grid.set(ix, iy, iz);
      }
    }
  };
  /** a ring's sector in the (z, y) plane at x: centre (zc, yc), radii r0…r1, angles a0…a1 (from +z toward +y), half depth hd along x */
  const fillRing = (x: number, yc: number, zc: number, r0: number, r1: number, a0: number, a1: number, hd: number) => {
    const h = CELL * 0.5;
    for (let r = r0; r <= r1 + 1e-6; r += h) {
      for (let a = a0; a <= a1 + 1e-6; a += h / Math.max(r, 0.25)) {
        for (let dx = -hd; dx <= hd + 1e-6; dx += h) grid.set(at(x + dx, grid.x0), at(yc + r * Math.sin(a), grid.y0), at(zc + r * Math.cos(a), grid.z0));
      }
    }
  };

  // the rock as built
  grid.addGeometry(rock, identity);
  for (const [x, z, r] of R.gate) grid.addSphere(x, ground(x, z) + 0.4 * r, z, 0.9 * r);

  // the terrace block's outer faces (a 0.4 m skin behind each), the stair's cut and the notch left open
  const top = T.y - UNDER_TOP;
  const cutN = R.stairs.base[2] - R.stairs.width / 2;
  const cutS = R.stairs.base[2] + R.stairs.width / 2;
  fillBox(T.x1 - 0.4, T.x1, bottom, top, cutS, W.z);
  fillBox(T.x1 - 0.4, T.x1, bottom, top, T.notchZ, cutN);
  fillBox(T.notchX - 0.4, T.notchX, bottom, top, T.z0, T.notchZ);
  fillBox(T.notchX, T.x1, bottom, top, T.notchZ, T.notchZ + 0.4);
  fillBox(T.x0, T.notchX, bottom, top, T.z0, T.z0 + 0.4);

  // the retaining wall under the terrace's and the outcrop's walked tops, the parapet over it
  fillBox(W.x0, T.x1, bottom, top, W.z - W.half, W.z + W.half);
  // the terrace section's ruined parapet on the wall's outer half (masonry.ts: blocks up to 0.62 m
  // over the paving, some lost; the gaps are filled too)
  fillBox(W.x0, T.x1 - 0.4, top, T.y + 0.62, W.z + W.half - 0.44, W.z + W.half - 0.02);
  fillBox(T.x1, W.x1, bottom, R.platform.y - UNDER_TOP, W.z - W.half, W.z + W.half);
  const base = R.platform.y - 0.02;
  fillBox(Math.min(P.x0, P.x1), Math.max(P.x0, P.x1), base, base + P.height, PARAPET_Z - P.half, PARAPET_Z + P.half);
  for (const px of PARAPET_POSTS) fillBox(px - 0.27, px + 0.27, base, base + P.height + 0.32, PARAPET_Z - 0.27, PARAPET_Z + 0.27);

  // the hero arch's ring (the keystone standing proud) and the pendant under it
  const spring = T.y + A.columnH;
  const r0 = A.span / 2;
  fillRing(A.x, spring, A.z, r0 - 0.05, r0 + 0.5, 0, Math.PI, 0.3);
  fillRing(A.x, spring, A.z, r0 + 0.5, r0 + 0.67, Math.PI * (6 / 13), Math.PI * (7 / 13), 0.31);
  fillBox(A.x - 0.16, A.x + 0.16, spring + r0 - 0.55, spring + r0, A.z - 0.16, A.z + 0.16);

  // the colonnade's lintel over its standing columns
  const standing = R.colonnade.columns.filter((c) => c[1] > 0);
  if (standing.length >= 2) {
    const xs = standing.map((c) => c[0]);
    const ly = T.y + standing[0][1] + 0.2;
    fillBox(Math.min(...xs) - 0.55, Math.max(...xs) + 0.55, ly - 0.21, ly + 0.21, R.colonnade.z - 0.27, R.colonnade.z + 0.27);
  }

  // the broken arch: its two piers in courses (≈ 0.52 m each, five and three) and the ring's five surviving voussoirs
  const Bk = R.brokenArch;
  const [zA, zB] = Bk.z;
  const yA = T.y + 5 * 0.52;
  fillBox(Bk.x - 0.46, Bk.x + 0.46, T.y - 0.1, yA, zA - 0.45, zA + 0.45);
  fillBox(Bk.x - 0.46, Bk.x + 0.46, T.y - 0.1, T.y + 3 * 0.52, zB - 0.45, zB + 0.45);
  const ringR0 = Math.abs(zB - zA) / 2 - 0.45;
  fillRing(Bk.x, yA, (zA + zB) / 2, ringR0, ringR0 + 0.45, Math.PI - (5 / 11) * Math.PI, Math.PI, 0.26);

  grid.dilate(1);
  return { grid, report: { cells: grid.count(), bytes: grid.bytes(), triangles: grid.triangles, ms: Math.round(performance.now() - t0) } };
}
