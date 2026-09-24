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
 * cell per material is chosen so (east.ts, `attachShadowLod`).
 *
 * With a `farM` the proxy is a distance LOD: the shadow pass keeps the fine list while the camera is
 * within `farM` of the caster's bounding sphere and draws the coarse one beyond.
 */
import { BufferAttribute, Sphere, Vector3, type BufferGeometry, type Camera, type Mesh, type Object3D } from 'three';

export interface ShadowProxy {
  /** triangles the colour pass draws */
  fine: number;
  /** triangles the shadow pass draws */
  coarse: number;
  cell: number;
  /** the shadow pass draws the coarse list only while the camera is farther than this from the caster's sphere (0 = always) */
  farM: number;
}

const _sphere = new Sphere();
const _eye = new Vector3();

/** distance (m) from `point` to the surface of `mesh`'s world bounding sphere (≤ 0 inside) */
export function sphereDistance(mesh: Mesh, point: Vector3): number {
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  _sphere.copy(g.boundingSphere!).applyMatrix4(mesh.matrixWorld);
  return point.distanceTo(_sphere.center) - _sphere.radius;
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
 * ranged or the proxy would save less than `minSaving` of the triangles. With `farM` > 0 the shadow
 * pass switches to it only while the camera is farther than `farM` from the caster's bounding
 * sphere. Returns what it attached.
 */
export function attachShadowProxy(mesh: Mesh, cell: number, minSaving = 0.3, farM = 0): ShadowProxy | null {
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
  let swapped = false;
  mesh.onBeforeShadow = (_renderer, _object, camera: Camera) => {
    swapped = farM <= 0 || sphereDistance(mesh, _eye.setFromMatrixPosition(camera.matrixWorld)) >= farM;
    if (!swapped) return;
    start = g.drawRange.start;
    count = g.drawRange.count;
    g.setDrawRange(fine, coarse.length);
  };
  mesh.onAfterShadow = () => {
    if (swapped) g.setDrawRange(start, count);
    swapped = false;
  };
  const proxy = { fine: fine / 3, coarse: coarse.length / 3, cell, farM };
  mesh.userData.shadowProxy = proxy;
  return proxy;
}

/**
 * A shadow LOD over every mesh under `roots` (not below `skip`) that casts, is opaque and not
 * alpha-tested, and for which `cellOf` names a cell: each switches to its proxy only while the
 * camera is farther from its bounding sphere than every one of `keep` is (+ `marginM`, and never
 * nearer than `nearM`), so the frames taken from `keep` draw every shadow triangle.
 */
export function attachShadowLod(
  roots: Object3D[],
  cellOf: (m: Mesh) => number | null,
  keep: Vector3[],
  options: { skip?: Object3D; nearM?: number; marginM?: number; minTriangles?: number } = {},
): (ShadowProxy & { name: string })[] {
  const { skip, nearM = 20, marginM = 2, minTriangles = 1000 } = options;
  const out: (ShadowProxy & { name: string })[] = [];
  const visit = (o: Object3D) => {
    if (o === skip) return;
    const m = o as Mesh;
    if (m.isMesh && m.castShadow && !Array.isArray(m.material) && !m.material.transparent && !m.material.alphaTest && rangedTriangles(m.geometry) >= minTriangles) {
      const cell = cellOf(m);
      if (cell) {
        m.updateWorldMatrix(true, false);
        const farM = Math.max(nearM, ...keep.map((p) => sphereDistance(m, p) + marginM));
        const p = attachShadowProxy(m, cell, 0.3, farM);
        if (p) out.push({ name: m.name, ...p });
      }
    }
    for (const c of o.children) visit(c);
  };
  for (const r of roots) visit(r);
  return out;
}

/** the triangles a geometry's draw range submits (the fine list of a proxied caster) */
export function rangedTriangles(g: BufferGeometry): number {
  const n = g.index ? g.index.count : g.attributes.position.count;
  return Math.floor(Math.min(n, Math.max(0, n - g.drawRange.start), g.drawRange.count) / 3);
}
