/**
 * FAR COLOUR LOD: a mesh keeps its vertices and gains a coarser triangle list appended to its index
 * (after a shadow proxy's, shadowProxy.ts); the geometry's draw range selects the fine list or the
 * coarse one (`FarLod.set`), so the colour pass — and the shadow pass, where no proxy swaps the range —
 * draws whichever is set.
 *
 * The coarse list clusters the fine one's vertices on a grid whose cell grows with each vertex's
 * distance from wherever the camera can be while the coarse list is set (`cellAt`, metres): the cell
 * is quantised down to √2 steps from `minCell`, and a vertex whose cell falls under `minCell` stays
 * as it is. A cluster holds the vertices of one connected piece of the mesh, in one cell, facing one
 * of six ways and on one half-tile patch of the texture, so the pieces, hard creases and uv seams
 * stay apart; it keeps its vertex nearest the cluster's mean, and every triangle is re-pointed at its
 * corners' keepers — those that collapse, or repeat one already kept (same corners, same winding),
 * are dropped. The keepers are vertices of the fine surface with their own normal, uv and colour, so
 * the coarse surface runs through it and gives up only relief finer than its cells. A piece with
 * fewer than `minTriangles` triangles, or whose coarse triangles cover less than `area` of its fine
 * surface (a blade or a ribbon narrower than its cells, a leaf card), keeps its own triangles; a
 * round rope or stem keeps a coarser tube, its facings apart.
 */
import { BufferAttribute, type BufferGeometry, type Matrix4, type Mesh } from 'three';

export interface FarLodOptions {
  /** the smallest cell (m); a vertex whose cell comes out smaller keeps its place */
  minCell?: number;
  /** a piece whose coarse area falls under this share of its fine area keeps its triangles */
  area?: number;
  /** a piece with fewer triangles than this keeps them */
  minTriangles?: number;
  /** nothing is attached unless the coarse list saves at least this share of the fine one */
  minSaving?: number;
}

export interface FarLod {
  name: string;
  /** triangles of the fine list and of the coarse one */
  fine: number;
  coarse: number;
  /** draw the coarse list (true) or the fine one */
  set(far: boolean): void;
}

const LOG_SQRT2 = Math.log(Math.SQRT2);
const AXIS = 4096;

/**
 * The coarse triangle list (vertex indices) of the first `count` indices of `geometry` (see the
 * header), with positions taken to world space by `matrixWorld`. Null when nothing clusters.
 */
export function farColourIndex(geometry: BufferGeometry, matrixWorld: Matrix4, count: number, cellAt: (x: number, y: number, z: number) => number, options: FarLodOptions = {}): number[] | null {
  const { minCell = 0.02, area = 0.5, minTriangles = 8 } = options;
  const index = geometry.index;
  const pos = geometry.attributes.position;
  if (!index || !pos) return null;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const idx = index.array;
  const n = pos.count;
  const tris = Math.floor(Math.min(count, idx.length) / 3);

  // the connected pieces
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  for (let t = 0; t < tris; t++) {
    const a = find(idx[t * 3]);
    const b = find(idx[t * 3 + 1]);
    if (a !== b) parent[a] = b;
    const c = find(idx[t * 3 + 2]);
    const r = find(b);
    if (c !== r) parent[c] = r;
  }
  const comp = new Int32Array(n);
  for (let i = 0; i < n; i++) comp[i] = find(i);

  // world positions, and the grid's origin
  const e = matrixWorld.elements;
  const W = new Float64Array(n * 3);
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    W[i * 3] = wx;
    W[i * 3 + 1] = wy;
    W[i * 3 + 2] = wz;
    if (wx < x0) x0 = wx;
    if (wy < y0) y0 = wy;
    if (wz < z0) z0 = wz;
  }

  // clusters: key = level, cell, facing, uv patch; the pieces sharing a key are chained apart
  const cluster = new Int32Array(n).fill(-1);
  const head = new Map<number, number>();
  const nextOf: number[] = [];
  const compOf: number[] = [];
  const sums: number[] = [];
  let clustered = 0;
  for (let i = 0; i < n; i++) {
    const wx = W[i * 3];
    const wy = W[i * 3 + 1];
    const wz = W[i * 3 + 2];
    const want = cellAt(wx, wy, wz);
    if (!(want >= minCell)) continue;
    const level = Math.min(7, Math.floor(Math.log(want / minCell) / LOG_SQRT2 + 1e-9));
    const cell = minCell * Math.pow(Math.SQRT2, level);
    const ix = Math.floor((wx - x0) / cell);
    const iy = Math.floor((wy - y0) / cell);
    const iz = Math.floor((wz - z0) / cell);
    if (ix >= AXIS || iy >= AXIS || iz >= AXIS) continue;
    let facing = 6;
    if (nor) {
      const nx = nor.getX(i);
      const ny = nor.getY(i);
      const nz = nor.getZ(i);
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const az = Math.abs(nz);
      facing = ax >= ay && ax >= az ? (nx > 0 ? 0 : 1) : ay >= az ? (ny > 0 ? 2 : 3) : nz > 0 ? 4 : 5;
    }
    let patch = 0;
    if (uv) patch = ((Math.floor(uv.getX(i) * 2) & 31) << 5) | (Math.floor(uv.getY(i) * 2) & 31);
    const key = ((((level * AXIS + ix) * AXIS + iy) * AXIS + iz) * 8 + facing) * 1024 + patch;
    let c = head.get(key);
    let at = c ?? -1;
    while (at >= 0 && compOf[at] !== comp[i]) at = nextOf[at];
    if (at < 0) {
      at = compOf.length;
      compOf.push(comp[i]);
      nextOf.push(c ?? -1);
      sums.push(0, 0, 0, 0);
      head.set(key, at);
      c = at;
    }
    cluster[i] = at;
    sums[at * 4] += wx;
    sums[at * 4 + 1] += wy;
    sums[at * 4 + 2] += wz;
    sums[at * 4 + 3]++;
    clustered++;
  }
  if (clustered === 0) return null;
  const clusters = compOf.length;
  const keeper = new Int32Array(clusters).fill(-1);
  const best = new Float64Array(clusters).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const c = cluster[i];
    if (c < 0) continue;
    const w = sums[c * 4 + 3];
    const dx = W[i * 3] - sums[c * 4] / w;
    const dy = W[i * 3 + 1] - sums[c * 4 + 1] / w;
    const dz = W[i * 3 + 2] - sums[c * 4 + 2] / w;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best[c]) {
      best[c] = d;
      keeper[c] = i;
    }
  }
  const keep = (v: number) => (cluster[v] < 0 ? v : keeper[cluster[v]]);
  const triArea = (a: number, b: number, c: number) => {
    const ux = W[b * 3] - W[a * 3];
    const uy = W[b * 3 + 1] - W[a * 3 + 1];
    const uz = W[b * 3 + 2] - W[a * 3 + 2];
    const vx = W[c * 3] - W[a * 3];
    const vy = W[c * 3 + 1] - W[a * 3 + 1];
    const vz = W[c * 3 + 2] - W[a * 3 + 2];
    return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  };

  // the coarse triangles, each piece's fine and coarse area
  const fineArea = new Float64Array(n);
  const coarseArea = new Float64Array(n);
  const pieceTris = new Int32Array(n);
  const coarse: number[] = [];
  const seen = new Set<number | string>();
  const packed = n * n * n < Number.MAX_SAFE_INTEGER;
  for (let t = 0; t < tris; t++) {
    const a = idx[t * 3];
    const b = idx[t * 3 + 1];
    const c = idx[t * 3 + 2];
    const r = comp[a];
    fineArea[r] += triArea(a, b, c);
    pieceTris[r]++;
    const A = keep(a);
    const B = keep(b);
    const C = keep(c);
    if (A === B || B === C || A === C) continue;
    // one key per triangle whatever corner it starts from; the winding is kept
    const first = A < B && A < C ? 0 : B < C ? 1 : 2;
    const p = first === 0 ? A : first === 1 ? B : C;
    const q = first === 0 ? B : first === 1 ? C : A;
    const s = first === 0 ? C : first === 1 ? A : B;
    const key = packed ? (p * n + q) * n + s : `${p},${q},${s}`;
    if (seen.has(key)) continue;
    seen.add(key);
    coarse.push(A, B, C, r);
    coarseArea[r] += triArea(A, B, C);
  }
  const whole = (r: number) => pieceTris[r] < minTriangles || coarseArea[r] < area * fineArea[r];
  const out: number[] = [];
  for (let q = 0; q < coarse.length; q += 4) if (!whole(coarse[q + 3])) out.push(coarse[q], coarse[q + 1], coarse[q + 2]);
  for (let t = 0; t < tris; t++) if (whole(comp[idx[t * 3]])) out.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  return out;
}

/**
 * Give `mesh` a far colour LOD (see the header) unless its geometry is unindexed, grouped or
 * offset, is shared with another mesh (`users` counts them), or the coarse list saves less than
 * `minSaving` of its fine one. The fine list is the geometry's current draw range (a shadow proxy's
 * coarse list stays after it, untouched). Returns what it attached, the fine list set.
 */
export function attachFarLod(mesh: Mesh, cellAt: (x: number, y: number, z: number) => number, options: FarLodOptions & { users?: Map<BufferGeometry, number> } = {}): FarLod | null {
  const { minSaving = 0.15 } = options;
  const g = mesh.geometry;
  const index = g.index;
  if (!index || g.groups.length > 0 || g.drawRange.start !== 0 || (options.users?.get(g) ?? 1) > 1) return null;
  const fine = Math.min(index.count, g.drawRange.count);
  mesh.updateWorldMatrix(true, false);
  const coarse = farColourIndex(g, mesh.matrixWorld, fine, cellAt, options);
  if (!coarse || coarse.length === 0 || coarse.length > fine * (1 - minSaving)) return null;
  const base = index.count;
  const Ctor = index.array.constructor as new (n: number) => Uint16Array | Uint32Array;
  const both = new Ctor(base + coarse.length);
  both.set(index.array as ArrayLike<number>);
  both.set(coarse, base);
  g.setIndex(new BufferAttribute(both, 1));
  g.setDrawRange(0, fine);
  let far = false;
  const lod: FarLod = {
    name: mesh.name,
    fine: fine / 3,
    coarse: coarse.length / 3,
    set(on: boolean) {
      if (on === far) return;
      far = on;
      if (on) g.setDrawRange(base, coarse.length);
      else g.setDrawRange(0, fine);
    },
  };
  mesh.userData.farLod = { fine: lod.fine, coarse: lod.coarse };
  return lod;
}
