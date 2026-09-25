/**
 * A world-aligned occupancy bitset built from triangle soups and spheres: every cell a surface
 * passes through is set, then the set is grown by whole cells (`dilate`), optionally keeping the
 * set as written (`core`). The play camera sweeps its line of sight through two of these
 * (camera/collision.ts): the structures' solid shells, which it keeps Link in front of, and their
 * slim parts (posts, pods, the plaza bough), which it only refuses to stand inside.
 */
import { Box3, type BufferGeometry, Matrix4, Vector3 } from 'three';

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

export class VoxelGrid {
  readonly x0: number;
  readonly y0: number;
  readonly z0: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly cell: number;
  bits: Uint32Array;
  /** the set as written, before `dilate(n, true)` grew it — the cells a surface itself passes through */
  core: Uint32Array | null = null;
  /** surface triangles and spheres written (audit) */
  triangles = 0;
  spheres = 0;

  constructor(bounds: Box3, cell: number) {
    this.cell = cell;
    this.x0 = Math.floor(bounds.min.x / cell) * cell;
    this.y0 = Math.floor(bounds.min.y / cell) * cell;
    this.z0 = Math.floor(bounds.min.z / cell) * cell;
    this.nx = Math.max(1, Math.ceil((bounds.max.x - this.x0) / cell) + 1);
    this.ny = Math.max(1, Math.ceil((bounds.max.y - this.y0) / cell) + 1);
    this.nz = Math.max(1, Math.ceil((bounds.max.z - this.z0) / cell) + 1);
    this.bits = new Uint32Array(Math.ceil((this.nx * this.ny * this.nz) / 32));
  }

  private index(ix: number, iy: number, iz: number): number {
    return (iz * this.ny + iy) * this.nx + ix;
  }

  set(ix: number, iy: number, iz: number): void {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.nx || iy >= this.ny || iz >= this.nz) return;
    const i = this.index(ix, iy, iz);
    this.bits[i >>> 5] |= 1 << (i & 31);
  }

  has(ix: number, iy: number, iz: number): boolean {
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.nx || iy >= this.ny || iz >= this.nz) return false;
    const i = this.index(ix, iy, iz);
    return (this.bits[i >>> 5] & (1 << (i & 31))) !== 0;
  }

  hasPoint(x: number, y: number, z: number): boolean {
    return this.has(Math.floor((x - this.x0) / this.cell), Math.floor((y - this.y0) / this.cell), Math.floor((z - this.z0) / this.cell));
  }

  /** whether (x, y, z) is in a cell of the undilated set (the grown set when no core was kept) */
  hasCorePoint(x: number, y: number, z: number): boolean {
    const ix = Math.floor((x - this.x0) / this.cell);
    const iy = Math.floor((y - this.y0) / this.cell);
    const iz = Math.floor((z - this.z0) / this.cell);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= this.nx || iy >= this.ny || iz >= this.nz) return false;
    const i = this.index(ix, iy, iz);
    return ((this.core ?? this.bits)[i >>> 5] & (1 << (i & 31))) !== 0;
  }

  private mark(x: number, y: number, z: number): void {
    this.set(Math.floor((x - this.x0) / this.cell), Math.floor((y - this.y0) / this.cell), Math.floor((z - this.z0) / this.cell));
  }

  /** mark every cell the triangle passes through (barycentric samples at ≤ half a cell) */
  addTriangle(a: Vector3, b: Vector3, c: Vector3): void {
    const edge = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const n = Math.min(256, Math.max(1, Math.ceil(edge / (this.cell * 0.5))));
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / n;
        const v = j / n;
        const w = 1 - u - v;
        this.mark(a.x * w + b.x * u + c.x * v, a.y * w + b.y * u + c.y * v, a.z * w + b.z * u + c.z * v);
      }
    }
    this.triangles++;
  }

  /** every triangle of an indexed or plain geometry, through `matrix` (world placement) */
  addGeometry(geometry: BufferGeometry, matrix: Matrix4): void {
    const pos = geometry.attributes.position;
    if (!pos || !pos.array) return;
    const idx = geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const ia = idx ? idx.getX(t) : t;
      const ib = idx ? idx.getX(t + 1) : t + 1;
      const ic = idx ? idx.getX(t + 2) : t + 2;
      _a.fromBufferAttribute(pos, ia).applyMatrix4(matrix);
      _b.fromBufferAttribute(pos, ib).applyMatrix4(matrix);
      _c.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
      this.addTriangle(_a, _b, _c);
    }
  }

  /** a solid ball */
  addSphere(x: number, y: number, z: number, r: number): void {
    const c = this.cell;
    const ix0 = Math.floor((x - r - this.x0) / c);
    const ix1 = Math.floor((x + r - this.x0) / c);
    const iy0 = Math.floor((y - r - this.y0) / c);
    const iy1 = Math.floor((y + r - this.y0) / c);
    const iz0 = Math.floor((z - r - this.z0) / c);
    const iz1 = Math.floor((z + r - this.z0) / c);
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const cx = this.x0 + (ix + 0.5) * c - x;
          const cy = this.y0 + (iy + 0.5) * c - y;
          const cz = this.z0 + (iz + 0.5) * c - z;
          if (cx * cx + cy * cy + cz * cz <= (r + c * 0.5) ** 2) this.set(ix, iy, iz);
        }
      }
    }
    this.spheres++;
  }

  /** grow the set by `n` cells along each axis (a separable box dilation: a cube of 2n + 1 cells); `keepCore` keeps the set as written in `core` */
  dilate(n = 1, keepCore = false): void {
    if (keepCore) this.core = this.bits.slice();
    const { nx, ny, nz } = this;
    for (let axis = 0; axis < 3; axis++) {
      const src = this.bits.slice();
      const stride = axis === 0 ? 1 : axis === 1 ? nx : nx * ny;
      const len = axis === 0 ? nx : axis === 1 ? ny : nz;
      for (let w = 0; w < src.length; w++) {
        let word = src[w];
        if (word === 0) continue;
        while (word !== 0) {
          const bit = 31 - Math.clz32(word & -word);
          word &= word - 1;
          const i = w * 32 + bit;
          const coord = axis === 0 ? i % nx : axis === 1 ? Math.floor(i / nx) % ny : Math.floor(i / (nx * ny));
          for (let d = -n; d <= n; d++) {
            if (d === 0) continue;
            const k = coord + d;
            if (k < 0 || k >= len) continue;
            const j = i + d * stride;
            this.bits[j >>> 5] |= 1 << (j & 31);
          }
        }
      }
    }
  }

  count(): number {
    let n = 0;
    for (let w = 0; w < this.bits.length; w++) {
      let v = this.bits[w];
      while (v) {
        v &= v - 1;
        n++;
      }
    }
    return n;
  }

  bytes(): number {
    return this.bits.byteLength + (this.core?.byteLength ?? 0);
  }
}

/** the world-space bounds of a set of geometries under their matrices */
export function worldBounds(parts: { geometry: BufferGeometry; matrix: Matrix4 }[], pad = 0): Box3 {
  const box = new Box3();
  const tmp = new Box3();
  for (const p of parts) {
    if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
    tmp.copy(p.geometry.boundingBox!).applyMatrix4(p.matrix);
    box.union(tmp);
  }
  if (pad > 0 && !box.isEmpty()) box.expandByScalar(pad);
  return box;
}
