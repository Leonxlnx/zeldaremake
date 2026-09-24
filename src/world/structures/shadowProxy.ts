/**
 * SHADOW PROXIES: a caster keeps its vertices and gains a second, coarser triangle list appended to
 * its index; the colour pass draws the fine list (the geometry's draw range) and the sun's shadow
 * pass the coarse one (`onBeforeShadow` / `onAfterShadow` swap the range and put back whatever range
 * was set — main.ts's warm-up narrows every range to one triangle while it compiles).
 *
 * The coarse list is a vertex clustering on a `cell`-metre grid: each occupied cell keeps its vertex
 * nearest the cell's mean, every triangle is re-pointed at its corners' keepers, and the triangles
 * that collapse (two corners in one cell) or repeat (same corners, same winding) are dropped. The
 * keepers are vertices of the fine surface, so the coarse one runs through it; what it gives up is
 * relief finer than a cell. The depth a receiver compares against moves by that much at most, and
 * the sun's normal bias (lighting/index.ts, 2.8 cm) absorbs it where it stays under ≈ 2.5 cm — the
 * cell per material is chosen so (east.ts).
 */
import { BufferAttribute, type BufferGeometry, type Mesh } from 'three';

export interface ShadowProxy {
  /** triangles the colour pass draws */
  fine: number;
  /** triangles the shadow pass draws */
  coarse: number;
  cell: number;
}

/** the coarse triangle list (vertex indices) of `index` over `position`, clustered on a `cell`-metre grid */
export function clusterIndex(position: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number }, index: ArrayLike<number>, cell: number): number[] {
  const n = position.count;
  const cellOf = new Int32Array(n);
  const ids = new Map<number, number>();
  const sums: number[] = [];
  for (let v = 0; v < n; v++) {
    const ix = Math.floor(position.getX(v) / cell) + 16384;
    const iy = Math.floor(position.getY(v) / cell) + 16384;
    const iz = Math.floor(position.getZ(v) / cell) + 16384;
    const key = (ix * 32768 + iy) * 32768 + iz;
    let c = ids.get(key);
    if (c === undefined) {
      c = sums.length / 4;
      ids.set(key, c);
      sums.push(0, 0, 0, 0);
    }
    cellOf[v] = c;
    sums[c * 4] += position.getX(v);
    sums[c * 4 + 1] += position.getY(v);
    sums[c * 4 + 2] += position.getZ(v);
    sums[c * 4 + 3]++;
  }
  const cells = sums.length / 4;
  const keeper = new Int32Array(cells).fill(-1);
  const best = new Float64Array(cells).fill(Infinity);
  for (let v = 0; v < n; v++) {
    const c = cellOf[v];
    const w = sums[c * 4 + 3];
    const dx = position.getX(v) - sums[c * 4] / w;
    const dy = position.getY(v) - sums[c * 4 + 1] / w;
    const dz = position.getZ(v) - sums[c * 4 + 2] / w;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < best[c]) {
      best[c] = d;
      keeper[c] = v;
    }
  }
  const out: number[] = [];
  const seen = new Set<string>();
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = keeper[cellOf[index[t]]];
    const b = keeper[cellOf[index[t + 1]]];
    const c = keeper[cellOf[index[t + 2]]];
    if (a === b || b === c || a === c) continue;
    // one key per triangle whatever corner it starts from; the winding is kept (the shadow pass
    // draws back faces, so a collapsed thin shell keeps both of its sides)
    const key = a < b && a < c ? `${a},${b},${c}` : b < a && b < c ? `${b},${c},${a}` : `${c},${a},${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a, b, c);
  }
  return out;
}

/**
 * Give `mesh` a shadow proxy clustered on `cell` metres, unless the geometry is unindexed, already
 * ranged or the proxy would save less than `minSaving` of the triangles. Returns what it attached.
 */
export function attachShadowProxy(mesh: Mesh, cell: number, minSaving = 0.3): ShadowProxy | null {
  const g: BufferGeometry = mesh.geometry;
  const index = g.index;
  if (!index || !mesh.castShadow || g.drawRange.start !== 0 || g.drawRange.count < index.count || g.groups.length > 0) return null;
  const fine = index.count;
  const coarse = clusterIndex(g.attributes.position, index.array, cell);
  if (coarse.length > fine * (1 - minSaving)) return null;
  const Ctor = index.array.constructor as new (n: number) => Uint16Array | Uint32Array;
  const both = new Ctor(fine + coarse.length);
  both.set(index.array as ArrayLike<number>);
  both.set(coarse, fine);
  g.setIndex(new BufferAttribute(both, 1));
  g.setDrawRange(0, fine);
  let start = 0;
  let count = fine;
  mesh.onBeforeShadow = () => {
    start = g.drawRange.start;
    count = g.drawRange.count;
    g.setDrawRange(fine, coarse.length);
  };
  mesh.onAfterShadow = () => {
    g.setDrawRange(start, count);
  };
  const proxy = { fine: fine / 3, coarse: coarse.length / 3, cell };
  mesh.userData.shadowProxy = proxy;
  return proxy;
}

/** the triangles a geometry's draw range submits (the fine list of a proxied caster) */
export function rangedTriangles(g: BufferGeometry): number {
  const n = g.index ? g.index.count : g.attributes.position.count;
  return Math.floor(Math.min(n, Math.max(0, n - g.drawRange.start), g.drawRange.count) / 3);
}
