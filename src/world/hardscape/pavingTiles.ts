/**
 * The plaza paving in tiles (fable-2, lane 6) — the pieces `index.ts` puts into one `BatchedMesh`
 * (`flagstones-batch`) so that each tile is frustum-culled on its own and swaps to its far LOD by
 * its own distance, in one draw call. `placeFlagstones` builds the paving as one non-indexed
 * geometry with every stone's vertices in one contiguous range (`PlacedStone.range`, and
 * `farRange` in the far LOD's geometry); a tile is the stones whose centres fall in one
 * `tileM` × `tileM` cell of the world's xz grid, and its geometries are those ranges copied out,
 * attribute for attribute, so a tile's bytes are the merged mesh's bytes.
 */
import { Box3, BufferAttribute, BufferGeometry } from 'three';
import type { PlacedStone } from './flagstones';

export interface PavingTile {
  /** the grid cell, `${ix},${iz}` */
  key: string;
  /** indices into the paving's `stones` */
  stones: number[];
  /** world bounds of the full geometry (the far fan lies within them) */
  box: Box3;
  /** the stones' full slabs — the paving mesh's ranges copied */
  near: BufferGeometry;
  /** the stones' far fans (null when the paving was built without its far LOD) */
  far: BufferGeometry | null;
  nearVertices: number;
  farVertices: number;
}

type TypedArray = Float32Array | Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;

/**
 * Copy the given `[first vertex, count]` ranges of a non-indexed geometry into a new geometry, every
 * attribute, in the order given. The result's bounds are computed.
 */
export function sliceRanges(src: BufferGeometry, ranges: readonly (readonly [number, number])[]): BufferGeometry {
  if (src.index) throw new Error('sliceRanges: indexed geometry');
  const total = ranges.reduce((n, r) => n + r[1], 0);
  const out = new BufferGeometry();
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as BufferAttribute;
    const arr = a.array as TypedArray;
    const Ctor = arr.constructor as { new (n: number): TypedArray };
    const dst = new Ctor(total * a.itemSize);
    let o = 0;
    for (const [s, c] of ranges) {
      dst.set(arr.subarray(s * a.itemSize, (s + c) * a.itemSize), o);
      o += c * a.itemSize;
    }
    out.setAttribute(name, new BufferAttribute(dst, a.itemSize, a.normalized));
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** the grid cell of a stone centre */
export function tileKey(x: number, z: number, tileM: number): string {
  return `${Math.floor(x / tileM)},${Math.floor(z / tileM)}`;
}

/**
 * Cut the paving into tiles. Tiles come out in the order their first stone was laid, so the
 * result is as deterministic as the paving; empty cells do not exist.
 */
export function tilePaving(stones: readonly PlacedStone[], near: BufferGeometry, far: BufferGeometry | null, tileM: number): PavingTile[] {
  const byKey = new Map<string, number[]>();
  stones.forEach((s, i) => {
    const k = tileKey(s.x, s.z, tileM);
    const list = byKey.get(k);
    if (list) list.push(i);
    else byKey.set(k, [i]);
  });
  const tiles: PavingTile[] = [];
  for (const [key, idx] of byKey) {
    const nearG = sliceRanges(near, idx.map((i) => stones[i].range));
    const farG = far ? sliceRanges(far, idx.map((i) => stones[i].farRange)) : null;
    tiles.push({
      key,
      stones: idx,
      box: nearG.boundingBox!.clone(),
      near: nearG,
      far: farG,
      nearVertices: nearG.getAttribute('position').count,
      farVertices: farG ? farG.getAttribute('position').count : 0,
    });
  }
  return tiles;
}

/**
 * A geometry with the given geometries' `position` attributes concatenated and nothing else — the
 * carrier `character/ground.ts` rasterises its walk grid from (it reads `position` and the index).
 */
export function positionsOnly(geometries: readonly BufferGeometry[]): BufferGeometry {
  let total = 0;
  for (const g of geometries) {
    if (g.index) throw new Error('positionsOnly: indexed geometry');
    total += g.getAttribute('position').count;
  }
  const dst = new Float32Array(total * 3);
  let o = 0;
  for (const g of geometries) {
    const a = g.getAttribute('position') as BufferAttribute;
    dst.set(a.array as Float32Array, o);
    o += a.count * 3;
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(dst, 3));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** planar (xz) distance from a point to a box, 0 inside */
export function planarDistanceToBox(box: Box3, x: number, z: number): number {
  const dx = Math.max(box.min.x - x, 0, x - box.max.x);
  const dz = Math.max(box.min.z - z, 0, z - box.max.z);
  return Math.hypot(dx, dz);
}
