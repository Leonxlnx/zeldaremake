/**
 * Round 57 (expansion-ruins): a small mesh builder for the ruins — flat-shaded polygons with an
 * explicit outward normal (the winding is fixed from it, so no builder has to get it right by
 * hand), smooth grids with computed normals, and the per-vertex streams the ruins' stone shader
 * reads: `color` (the stone's own tint, grime), `aMoss` (moss cover 0…1) and `aWet` (the damp band).
 */
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';

export type RGB = [number, number, number];

const _e1 = new Vector3();
const _e2 = new Vector3();
const _c = new Vector3();

export class MeshBuilder {
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly col: number[] = [];
  readonly moss: number[] = [];
  readonly wet: number[] = [];
  readonly uv: number[] = [];
  readonly idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  vertex(p: Vector3, n: Vector3, c: RGB, moss = 0, wet = 0, u = 0, v = 0): number {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.col.push(c[0], c[1], c[2]);
    this.moss.push(moss);
    this.wet.push(wet);
    this.uv.push(u, v);
    return this.vertexCount - 1;
  }

  /**
   * A flat convex polygon (≥ 3 points, in order around it either way) facing `normal`: fanned from
   * its first point, every triangle wound counter-clockwise seen from the side `normal` points to.
   * `mossAt` / `wetAt` give per-point values (default 0).
   */
  poly(pts: Vector3[], normal: Vector3, c: RGB, mossAt?: (p: Vector3) => number, wetAt?: (p: Vector3) => number, uvAt?: (p: Vector3) => [number, number]): void {
    if (pts.length < 3) return;
    const n = normal.clone().normalize();
    // orient the loop once: its signed area about the normal
    _c.set(0, 0, 0);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      _c.x += (a.y - b.y) * (a.z + b.z);
      _c.y += (a.z - b.z) * (a.x + b.x);
      _c.z += (a.x - b.x) * (a.y + b.y);
    }
    const loop = _c.dot(n) >= 0 ? pts : [...pts].reverse();
    const ids = loop.map((p) => {
      const uv = uvAt ? uvAt(p) : [0, 0];
      return this.vertex(p, n, c, mossAt ? mossAt(p) : 0, wetAt ? wetAt(p) : 0, uv[0], uv[1]);
    });
    for (let i = 1; i + 1 < ids.length; i++) this.idx.push(ids[0], ids[i], ids[i + 1]);
  }

  /**
   * A smooth grid of (nu + 1) × (nv + 1) vertices from `at(u, v)` (u, v in 0…1) — normals are
   * computed from the grid afterwards (`build(true)` or `smoothGridNormals`). `flip` reverses the
   * winding (the grid faces the other way).
   */
  grid(nu: number, nv: number, at: (u: number, v: number) => { p: Vector3; c: RGB; moss?: number; wet?: number }, flip = false): { start: number; nu: number; nv: number } {
    const start = this.vertexCount;
    const up = new Vector3(0, 1, 0);
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = at(i / nu, j / nv);
        this.vertex(s.p, up, s.c, s.moss ?? 0, s.wet ?? 0, i / nu, j / nv);
      }
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = start + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        if (flip) this.idx.push(a, c, b, b, c, d);
        else this.idx.push(a, b, c, b, d, c);
      }
    }
    return { start, nu, nv };
  }

  /** area-weighted vertex normals over the triangles that use vertices [from, to) */
  smoothNormals(from = 0, to = this.vertexCount, triFrom = 0): void {
    const acc = new Float32Array((to - from) * 3);
    const P = this.pos;
    const va = new Vector3();
    const vb = new Vector3();
    const vc = new Vector3();
    for (let t = triFrom; t < this.idx.length; t += 3) {
      const a = this.idx[t];
      const b = this.idx[t + 1];
      const c = this.idx[t + 2];
      if (a < from || a >= to || b < from || b >= to || c < from || c >= to) continue;
      va.fromArray(P, a * 3);
      vb.fromArray(P, b * 3);
      vc.fromArray(P, c * 3);
      _e1.subVectors(vb, va);
      _e2.subVectors(vc, va);
      _e1.cross(_e2);
      for (const k of [a, b, c]) {
        acc[(k - from) * 3] += _e1.x;
        acc[(k - from) * 3 + 1] += _e1.y;
        acc[(k - from) * 3 + 2] += _e1.z;
      }
    }
    for (let k = from; k < to; k++) {
      const o = (k - from) * 3;
      const l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]);
      // a vertex on degenerate triangles only gets a zero normal (lathe() patches its poles)
      this.nrm[k * 3] = l > 1e-12 ? acc[o] / l : 0;
      this.nrm[k * 3 + 1] = l > 1e-12 ? acc[o + 1] / l : 0;
      this.nrm[k * 3 + 2] = l > 1e-12 ? acc[o + 2] / l : 0;
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMoss', new Float32BufferAttribute(this.moss, 1));
    g.setAttribute('aWet', new Float32BufferAttribute(this.wet, 1));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setIndex(new Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** a point rotated about +Y by `yaw` round (cx, cz), then offset — the blocks' placement frame */
export function frameOf(cx: number, cy: number, cz: number, yaw: number) {
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return {
    /** local (a along, y up, b across) → world */
    p(a: number, y: number, b: number): Vector3 {
      return new Vector3(cx + a * cs - b * sn, cy + y, cz + a * sn + b * cs);
    },
    /** local direction → world */
    d(a: number, y: number, b: number): Vector3 {
      return new Vector3(a * cs - b * sn, y, a * sn + b * cs);
    },
  };
}

export interface BlockOpts {
  /** chamfer (m) */
  bevel?: number;
  /** the stone's tint */
  color: RGB;
  /** moss on the top face (0…1) and down the sides (0…1, fading down) */
  mossTop?: number;
  mossSide?: number;
  /** world y under which the faces are damp (the wet band, `aWet`) */
  wetBelow?: number;
  /** per-corner jitter of the top face (m): a worn, settled block */
  sag?: [number, number, number, number];
  /** skip faces (a local axis sign: '+a', '-a', '+y', '-y', '+b', '-b') */
  skip?: string[];
  /** moss / damp per point and world normal (override `mossTop` / `mossSide` / `wetBelow`) */
  mossFn?: (p: Vector3, n: Vector3) => number;
  wetFn?: (p: Vector3, n: Vector3) => number;
}

/**
 * A chamfered block: centre (cx, cy, cz), half extents along its local axes (ha along `yaw`'s
 * direction, hy up, hb across), flat-shaded faces, bevel strips and corner facets.
 */
export function block(mb: MeshBuilder, cx: number, cy: number, cz: number, ha: number, hy: number, hb: number, yaw: number, o: BlockOpts): void {
  const f = frameOf(cx, cy, cz, yaw);
  const bev = Math.min(o.bevel ?? 0.04, ha * 0.45, hy * 0.45, hb * 0.45);
  const h = [ha, hy, hb];
  const sag = o.sag ?? [0, 0, 0, 0];
  const skip = new Set(o.skip ?? []);
  const wetBelow = o.wetBelow ?? -Infinity;
  const mossTop = o.mossTop ?? 0;
  const mossSide = o.mossSide ?? 0;
  // local point with the top face's sag (by the corner quadrant)
  const P = (l: [number, number, number]) => {
    let y = l[1];
    if (y > 0) {
      const qa = l[0] >= 0 ? 1 : 0;
      const qb = l[2] >= 0 ? 1 : 0;
      y += sag[qa * 2 + qb] * (l[1] / hy);
    }
    return f.p(l[0], y, l[2]);
  };
  const mossFn = o.mossFn;
  const wetFn = o.wetFn;
  const mossAt = (n: Vector3) => (p: Vector3) => {
    if (mossFn) return mossFn(p, n);
    if (n.y > 0.7) return mossTop;
    const rel = (p.y - (cy - hy)) / (2 * hy);
    return mossSide * Math.max(0, rel - 0.3) * (n.y > -0.3 ? 1 : 0);
  };
  const wetAt = (n: Vector3) => (p: Vector3) => (wetFn ? wetFn(p, n) : p.y < wetBelow ? Math.min(1, (wetBelow - p.y) / 0.35) : 0);
  const axisName = ['a', 'y', 'b'];
  // faces
  for (let ax = 0; ax < 3; ax++) {
    for (const s of [-1, 1]) {
      if (skip.has(`${s > 0 ? '+' : '-'}${axisName[ax]}`)) continue;
      const b1 = (ax + 1) % 3;
      const b2 = (ax + 2) % 3;
      const pts: Vector3[] = [];
      for (const [u, v] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const l: [number, number, number] = [0, 0, 0];
        l[ax] = s * h[ax];
        l[b1] = u * (h[b1] - bev);
        l[b2] = v * (h[b2] - bev);
        pts.push(P(l));
      }
      const nl: [number, number, number] = [0, 0, 0];
      nl[ax] = s;
      const n = f.d(nl[0], nl[1], nl[2]);
      mb.poly(pts, n, o.color, mossAt(n), wetAt(n));
    }
  }
  if (bev <= 1e-4) return;
  // bevel strips
  for (let a1 = 0; a1 < 3; a1++) {
    for (let a2 = a1 + 1; a2 < 3; a2++) {
      const a3 = 3 - a1 - a2;
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          const pts: Vector3[] = [];
          for (const [k1, k2, s3] of [
            [1, 0, -1],
            [0, 1, -1],
            [0, 1, 1],
            [1, 0, 1],
          ]) {
            const l: [number, number, number] = [0, 0, 0];
            l[a1] = s1 * (h[a1] - (k1 ? 0 : bev));
            l[a2] = s2 * (h[a2] - (k2 ? 0 : bev));
            l[a3] = s3 * (h[a3] - bev);
            pts.push(P(l));
          }
          const nl: [number, number, number] = [0, 0, 0];
          nl[a1] = s1;
          nl[a2] = s2;
          const n = f.d(nl[0], nl[1], nl[2]).normalize();
          mb.poly(pts, n, o.color, mossAt(n), wetAt(n));
        }
      }
    }
  }
  // corner facets
  for (const sa of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sb of [-1, 1]) {
        const s = [sa, sy, sb];
        const pts: Vector3[] = [];
        for (let ax = 0; ax < 3; ax++) {
          const l: [number, number, number] = [0, 0, 0];
          for (let k = 0; k < 3; k++) l[k] = s[k] * (h[k] - (k === ax ? 0 : bev));
          pts.push(P(l));
        }
        const n = f.d(sa, sy, sb).normalize();
        mb.poly(pts, n, o.color, mossAt(n), wetAt(n));
      }
    }
  }
}

/**
 * A surface of revolution: `profile` (radius, height) pairs bottom to top in the local frame,
 * `segs` around, each point through `place` (local x, y, z → world). `radiusAt(theta, y, r)`
 * reshapes the radius (flutes, twists, breakage), `mossAt(y)` the moss. Smooth normals.
 */
export function lathe(
  mb: MeshBuilder,
  profile: [number, number][],
  segs: number,
  place: (x: number, y: number, z: number) => Vector3,
  c: RGB,
  mossAt: (y: number) => number = () => 0,
  radiusAt: (theta: number, y: number, r: number) => number = (_t, _y, r) => r,
  yAt: (theta: number, y: number) => number = (_t, y) => y,
): void {
  const start = mb.vertexCount;
  const tri0 = mb.idx.length;
  mb.grid(
    segs,
    profile.length - 1,
    (u, v) => {
      const k = Math.round(v * (profile.length - 1));
      const [r0, y0] = profile[k];
      const th = u * Math.PI * 2;
      const r = radiusAt(th, y0, r0);
      const y = yAt(th, y0);
      return { p: place(r * Math.cos(th), y, r * Math.sin(th)), c, moss: mossAt(y0) };
    },
    true,
  );
  mb.smoothNormals(start, mb.vertexCount, tri0);
  // the seam: average the first and last column's normals (the same points)
  const row = segs + 1;
  const N = mb.nrm;
  for (let j = 0; j < profile.length; j++) {
    const a = start + j * row;
    const b = a + segs;
    const mx = N[a * 3] + N[b * 3];
    const my = N[a * 3 + 1] + N[b * 3 + 1];
    const mz = N[a * 3 + 2] + N[b * 3 + 2];
    const l = Math.hypot(mx, my, mz);
    if (l < 1e-9) continue;
    for (const v of [a, b]) {
      N[v * 3] = mx / l;
      N[v * 3 + 1] = my / l;
      N[v * 3 + 2] = mz / l;
    }
  }
  // a pole (a ring at r = 0) has only degenerate triangles: it takes its neighbour ring's normals
  for (let j = 0; j < profile.length; j++) {
    const a = start + j * row;
    if (Math.hypot(N[a * 3], N[a * 3 + 1], N[a * 3 + 2]) > 0.5) continue;
    const nb = start + (j > 0 ? j - 1 : j + 1) * row;
    for (let i = 0; i <= segs; i++) for (let k = 0; k < 3; k++) N[(a + i) * 3 + k] = N[(nb + i) * 3 + k];
  }
}

/** a colour scaled by `k` and nudged by (dr, dg, db) */
export function tint(c: RGB, k: number, dr = 0, dg = 0, db = 0): RGB {
  return [c[0] * k + dr, c[1] * k + dg, c[2] * k + db];
}
