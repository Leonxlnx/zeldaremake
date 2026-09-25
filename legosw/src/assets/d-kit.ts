import { Box3, BufferGeometry, Group, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from 'three';
import { PLATE, type Builder } from '../core/builder';
import { cylinder, MeshAcc, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { hash1, type Rng } from '../core/rng';

/**
 * Shared construction kit for asset agent D (Separatist capital ships + hangar).
 *
 * Big curved hulls are built the way large LEGO display models are: an inner frame (the "core",
 * only ever seen through the seams) skinned with individual plates and tiles laid along the
 * facets of a lofted cross-section. Every tile is its own chamfered part with a real gap to its
 * neighbours, so the hull reads as brick-built at any distance; tiles can carry studs, be left
 * out (recesses) or be replaced by custom greeble fills in a local surface frame.
 */

export interface Sec {
  z: number;
  /** half width */
  a: number;
  /** half height of the upper half */
  b: number;
  /** half height of the lower half (defaults to b) */
  bb?: number;
  x0?: number;
  y0?: number;
  /** superellipse exponent of the upper half (2 = ellipse, larger = squarer) */
  n?: number;
  /** exponent of the lower half */
  nb?: number;
}

const spow = (c: number, e: number): number => Math.sign(c) * Math.pow(Math.abs(c), e);

/** Point on a section at angle th (0 = top, π/2 = +X / port, π = bottom). */
export function secPoint(s: Sec, th: number): V3 {
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const top = c >= 0;
  const nn = top ? s.n ?? 2 : s.nb ?? s.n ?? 2;
  const e = 2 / nn;
  const h = top ? s.b : s.bb ?? s.b;
  return [(s.x0 ?? 0) + s.a * spow(sn, e), (s.y0 ?? 0) + h * spow(c, e), s.z];
}

export function lerpSec(p: Sec, q: Sec, t: number): Sec {
  const L = (a: number, b: number) => a + (b - a) * t;
  return {
    z: L(p.z, q.z),
    a: L(p.a, q.a),
    b: L(p.b, q.b),
    bb: L(p.bb ?? p.b, q.bb ?? q.b),
    x0: L(p.x0 ?? 0, q.x0 ?? 0),
    y0: L(p.y0 ?? 0, q.y0 ?? 0),
    n: L(p.n ?? 2, q.n ?? 2),
    nb: L(p.nb ?? p.n ?? 2, q.nb ?? q.n ?? 2),
  };
}

export function secAt(secs: Sec[], z: number): Sec {
  if (z <= secs[0].z) return { ...secs[0], z };
  for (let i = 0; i < secs.length - 1; i++) {
    const p = secs[i];
    const q = secs[i + 1];
    if (z <= q.z) return lerpSec(p, q, (z - p.z) / (q.z - p.z || 1));
  }
  return { ...secs[secs.length - 1], z };
}

/** Insert interpolated stations at the given z values so tile rows break exactly there. */
export function cutSecs(secs: Sec[], zs: number[]): Sec[] {
  const out = secs.map((s) => ({ ...s }));
  for (const z of zs) {
    if (z <= out[0].z + 1e-3 || z >= out[out.length - 1].z - 1e-3) continue;
    if (out.some((s) => Math.abs(s.z - z) < 0.05)) continue;
    out.push(secAt(out, z));
    out.sort((a, b) => a.z - b.z);
  }
  return out;
}

/** Stations of an elongated pod: profile f(t) = (1 - |t|^m)^(1/m) along z ∈ [z0, z1]. */
export function podSecs(z0: number, z1: number, base: Omit<Sec, 'z'>, o: { m?: number; ts?: number[]; cuts?: number[]; front?: number; back?: number } = {}): Sec[] {
  const m = o.m ?? 2.5;
  const ts = o.ts ?? [-1, -0.985, -0.95, -0.88, -0.76, -0.58, -0.3, 0, 0.3, 0.58, 0.76, 0.88, 0.95, 0.985, 1];
  const zc = (z0 + z1) / 2;
  const hl = (z1 - z0) / 2;
  const out: Sec[] = [];
  for (const t of ts) {
    const mm = t < 0 ? o.back ?? m : o.front ?? m;
    const f = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), mm)), 1 / mm);
    const g = Math.max(f, 0.02);
    out.push({ ...base, z: zc + t * hl, a: base.a * g, b: base.b * g, bb: (base.bb ?? base.b) * g });
  }
  return o.cuts ? cutSecs(out, o.cuts) : out;
}

/** Surface point and outward normal of a loft at (z, th). */
export function surf(secs: Sec[], z: number, th: number): { p: Vector3; n: Vector3 } {
  const e = 1e-3;
  const p = new Vector3(...secPoint(secAt(secs, z), th));
  const pz = new Vector3(...secPoint(secAt(secs, z + e), th)).sub(new Vector3(...secPoint(secAt(secs, z - e), th)));
  const pt = new Vector3(...secPoint(secAt(secs, z), th + e)).sub(new Vector3(...secPoint(secAt(secs, z), th - e)));
  const n = new Vector3().crossVectors(pz, pt).normalize();
  return { p, n };
}

/** Angle on the upper half of a section whose point has the given x (bisection). */
export function thForX(s: Sec, x: number): number {
  const x0 = s.x0 ?? 0;
  const side = x >= x0 ? 1 : -1;
  const target = Math.abs(x - x0);
  let lo = 0;
  let hi = Math.PI / 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const px = Math.abs(secPoint(s, mid)[0] - x0);
    if (px < target) lo = mid;
    else hi = mid;
  }
  const th = (lo + hi) / 2;
  return side > 0 ? th : -th;
}

/** Angle on the section whose point has the given y, on the +X (side = 1) or -X side. */
export function thForY(s: Sec, y: number, side = 1): number {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const py = secPoint(s, mid)[1];
    if (py > y) lo = mid;
    else hi = mid;
  }
  const th = (lo + hi) / 2;
  return side > 0 ? th : -th;
}

/** Local frame on a surface: Y = normal, Z = `fwd` projected onto the tangent plane, X = Y × Z. */
export function frameFwd(o: Vector3, n: Vector3, fwd: Vector3 = new Vector3(0, 0, 1)): Matrix4 {
  const Z = fwd.clone().addScaledVector(n, -fwd.dot(n));
  if (Z.lengthSq() < 1e-8) Z.set(0, 1, 0).addScaledVector(n, -n.y);
  Z.normalize();
  const X = new Vector3().crossVectors(n, Z);
  return new Matrix4().makeBasis(X, n, Z).setPosition(o);
}

export function withFrame(b: Builder, m: Matrix4, fn: () => void): void {
  b.push();
  b.apply(m);
  fn();
  b.pop();
}

const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];
const lerp3 = (a: Vector3, b: Vector3, t: number) => new Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export function polyArea(P: number[][]): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function dedupe(P: number[][], eps = 1e-3): number[][] {
  const out: number[][] = [];
  for (const p of P) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps) out.pop();
  return out;
}

/** Inset a convex polygon by g (returns CCW), or null when it collapses. */
export function insetPoly(P0: number[][], g: number): number[][] | null {
  let P = dedupe(P0);
  if (P.length < 3) return null;
  if (polyArea(P) < 0) P = [...P].reverse();
  if (Math.abs(polyArea(P)) < 1e-4) return null;
  if (g <= 0) return P;
  const n = P.length;
  const L: { p: number[]; d: number[] }[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[i];
    const b = P[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) return null;
    L.push({ p: [a[0] - (dy / l) * g, a[1] + (dx / l) * g], d: [dx / l, dy / l] });
  }
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const l1 = L[(i - 1 + n) % n];
    const l2 = L[i];
    const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    if (Math.abs(den) < 1e-9) {
      out.push(l2.p);
      continue;
    }
    const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
    out.push([l1.p[0] + l1.d[0] * t, l1.p[1] + l1.d[1] * t]);
  }
  if (polyArea(out) <= 1e-3) return null;
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    if ((b[0] - a[0]) * L[i].d[0] + (b[1] - a[1]) * L[i].d[1] <= 0) return null;
  }
  return out;
}

/** Is (x, z) inside a CCW convex polygon with at least `margin` clearance? */
export function insidePoly(P: number[][], x: number, z: number, margin = 0): boolean {
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    if ((dx * (z - a[1]) - dy * (x - a[0])) / l < margin) return false;
  }
  return true;
}

export interface TileCtx {
  k: number;
  j: number;
  row: number;
  col: number;
  rows: number;
  cols: number;
  /** tile centre on the loft surface */
  c: Vector3;
  /** outward normal */
  n: Vector3;
  /** size across the facet (local X) and along it (local Z) */
  w: number;
  l: number;
  /** facet centre angle */
  th: number;
  /** inset footprint in the local XZ plane */
  fp: number[][];
  /** local frame: X across, Y out of the surface, Z along (+z) */
  frame: Matrix4;
}

export interface TileSpec {
  key: ColorKey | null;
  /** exposed studs on top (true = same colour) */
  studs?: boolean | ColorKey;
  /** thickness (default one plate) */
  t?: number;
  c?: number;
  /** extra parts in the tile's local frame (Y = out of the surface, origin on the surface) */
  fill?: (b: Builder, t: TileCtx) => void;
  /** flat tiles only: which side walls to emit for raised tiles (local X across, Z along; default all) */
  walls?: { px?: boolean; nx?: boolean; pz?: boolean; nz?: boolean };
}

export interface LoftOpts {
  /** number of facets over the angular range */
  N?: number;
  /** angular range (default the full ring) */
  th0?: number;
  th1?: number;
  /** explicit facet boundary angles (overrides N / th0 / th1; a full ring spans exactly 2π) */
  ths?: number[];
  /** only station intervals whose middle lies in [zMin, zMax) (spatial chunking) */
  zMin?: number;
  zMax?: number;
  tileLen: number | ((c: Vector3, n: Vector3) => number);
  tileWid: number | ((c: Vector3, n: Vector3) => number);
  t?: number;
  gap?: number;
  chamfer?: number;
  stagger?: boolean;
  spec: (t: TileCtx) => TileSpec | ColorKey | null;
  core?: ColorKey | null;
  coreSkip?: (c: Vector3, n: Vector3) => boolean;
  /** leave facet j of the station interval centred on z out entirely (core, tiles, inner skin) */
  cut?: (j: number, z: number) => boolean;
  /** open shells: inner surface inset by `inset` (reversed) plus rim closures */
  inner?: { key: ColorKey; inset: number };
  capStart?: ColorKey;
  capEnd?: ColorKey;
  /**
   * Cheap tiles for distant / unseen regions: an inset quad per plate (2 triangles, plus side walls
   * when raised) instead of a chamfered part. The seams still show the core.
   */
  flat?: boolean | ((c: Vector3, n: Vector3) => boolean);
}

/** Per-colour accumulators for flat tiles, split into a few tint buckets so plates still vary. */
class FlatTiles {
  private m = new Map<string, { key: ColorKey; shade: number; acc: MeshAcc }>();
  get(key: ColorKey, h: number): MeshAcc {
    const k = Math.min(3, Math.floor(h * 4));
    const id = `${key}|${k}`;
    let e = this.m.get(id);
    if (!e) {
      e = { key, shade: 0.955 + k * 0.03, acc: new MeshAcc() };
      this.m.set(id, e);
    }
    return e.acc;
  }
  flush(b: Builder): void {
    for (const e of this.m.values()) if (e.acc.pos.length) b.add(e.key, e.acc.done(), undefined, { tint: 0.004, shade: e.shade });
  }
}

/** Skin a lofted hull with individual tiles over a dark core. */
export function loft(b: Builder, secs: Sec[], o: LoftOpts): void {
  const th0 = o.th0 ?? 0;
  const th1 = o.th1 ?? Math.PI * 2;
  const N0 = o.N ?? 32;
  const ths = o.ths ?? Array.from({ length: N0 + 1 }, (_, j) => th0 + ((th1 - th0) * j) / N0);
  const N = ths.length - 1;
  const full = Math.abs(ths[N] - ths[0] - Math.PI * 2) < 1e-6;
  const rings = secs.map((s) => ths.map((th) => new Vector3(...secPoint(s, th))));
  const T = o.t ?? PLATE;
  const gap = o.gap ?? 0.03;
  const chamfer = o.chamfer ?? b.chamfer;
  const coreKey = o.core === undefined ? 'dbg' : o.core;
  const acc = coreKey ? new MeshAcc() : null;
  const zMin = o.zMin ?? -Infinity;
  const zMax = o.zMax ?? Infinity;
  const flatTiles = new FlatTiles();
  const inRange = (k: number) => {
    const zm = (secs[k].z + secs[k + 1].z) / 2;
    return zm >= zMin && zm < zMax;
  };
  const zMid = (k: number) => (secs[k].z + secs[k + 1].z) / 2;
  for (let k = 0; k < secs.length - 1; k++) {
    if (!inRange(k)) continue;
    for (let j = 0; j < N; j++) {
      if (o.cut?.(j, zMid(k))) continue;
      const A = rings[k][j];
      const B = rings[k][j + 1];
      const D = rings[k + 1][j];
      const C = rings[k + 1][j + 1];
      const along = D.clone().sub(A).add(C).sub(B);
      const across = B.clone().sub(A).add(C).sub(D);
      const fn = new Vector3().crossVectors(along, across);
      if (fn.lengthSq() < 1e-14) continue;
      fn.normalize();
      const fc = A.clone().add(B).add(C).add(D).multiplyScalar(0.25);
      if (acc && !o.coreSkip?.(fc, fn)) acc.quad(v3(A), v3(B), v3(C), v3(D), v3(fn));
      const len = (A.distanceTo(D) + B.distanceTo(C)) / 2;
      const wid = (A.distanceTo(B) + D.distanceTo(C)) / 2;
      if (len < 0.05 || wid < 0.05) continue;
      const L = typeof o.tileLen === 'function' ? o.tileLen(fc, fn) : o.tileLen;
      const W = typeof o.tileWid === 'function' ? o.tileWid(fc, fn) : o.tileWid;
      const rows = Math.max(1, Math.round(len / L));
      const cols = Math.max(1, Math.round(wid / W));
      const tb: number[] = [0];
      if ((o.stagger ?? true) && rows >= 2 && j & 1) for (let r = 0; r < rows; r++) tb.push((r + 0.5) / rows);
      else for (let r = 1; r < rows; r++) tb.push(r / rows);
      tb.push(1);
      const thc = (ths[j] + ths[j + 1]) / 2;
      for (let r = 0; r < tb.length - 1; r++) {
        for (let q = 0; q < cols; q++) {
          const s0 = q / cols;
          const s1 = (q + 1) / cols;
          const t0 = tb[r];
          const t1 = tb[r + 1];
          const P = (s: number, tt: number) => lerp3(lerp3(A, B, s), lerp3(D, C, s), tt);
          const c00 = P(s0, t0);
          const c10 = P(s1, t0);
          const c11 = P(s1, t1);
          const c01 = P(s0, t1);
          const tAl = c01.clone().sub(c00).add(c11).sub(c10);
          const tAc = c10.clone().sub(c00).add(c11).sub(c01);
          const n = new Vector3().crossVectors(tAl, tAc);
          if (n.lengthSq() < 1e-14) continue;
          n.normalize();
          const cc = c00.clone().add(c10).add(c11).add(c01).multiplyScalar(0.25);
          const Z = tAl.clone().addScaledVector(n, -tAl.dot(n));
          if (Z.lengthSq() < 1e-12) continue;
          Z.normalize();
          const X = new Vector3().crossVectors(n, Z);
          const frame = new Matrix4().makeBasis(X, n, Z).setPosition(cc);
          const raw = [c00, c10, c11, c01].map((p) => {
            const d = p.clone().sub(cc);
            return [d.dot(X), d.dot(Z)];
          });
          const fp = insetPoly(raw, gap);
          if (!fp) continue;
          let minx = Infinity;
          let maxx = -Infinity;
          let minz = Infinity;
          let maxz = -Infinity;
          for (const p of fp) {
            minx = Math.min(minx, p[0]);
            maxx = Math.max(maxx, p[0]);
            minz = Math.min(minz, p[1]);
            maxz = Math.max(maxz, p[1]);
          }
          const ctx: TileCtx = { k, j, row: r, col: q, rows: tb.length - 1, cols, c: cc, n, w: maxx - minx, l: maxz - minz, th: thc, fp, frame };
          const raw2 = o.spec(ctx);
          if (raw2 === null) continue;
          const sp: TileSpec = typeof raw2 === 'string' ? { key: raw2 } : raw2;
          const th = sp.t ?? T;
          const isFlat = typeof o.flat === 'function' ? o.flat(cc, n) : !!o.flat;
          if (isFlat && sp.key) {
            const acc = flatTiles.get(sp.key, hash1((k * 7919 + j * 104729 + r * 31 + q * 17) | 0));
            const P3 = fp.map(([fx, fz]) => cc.clone().addScaledVector(X, fx).addScaledVector(Z, fz));
            const top = P3.map((p) => v3(p.clone().addScaledVector(n, th)));
            for (let i = 1; i < top.length - 1; i++) acc.tri(top[0], top[i], top[i + 1], v3(n));
            if (th > PLATE * 1.5) {
              for (let i = 0; i < P3.length; i++) {
                const a0 = P3[i];
                const a1 = P3[(i + 1) % P3.length];
                const en = new Vector3().crossVectors(n, a1.clone().sub(a0)).normalize();
                const wl = sp.walls;
                if (wl) {
                  const ex = en.dot(X);
                  const ez = en.dot(Z);
                  if (!((ex > 0.5 && wl.px) || (ex < -0.5 && wl.nx) || (ez > 0.5 && wl.pz) || (ez < -0.5 && wl.nz))) continue;
                }
                acc.quad(v3(a0), v3(a1), top[(i + 1) % P3.length], top[i], v3(en));
              }
            }
          }
          b.push();
          b.apply(frame);
          if (sp.key) {
            if (!isFlat) b.shape(sp.key, fp, 0, th, { c: sp.c ?? chamfer });
            if (sp.studs) {
              const sk = sp.studs === true ? sp.key : sp.studs;
              const nx = Math.floor(maxx - minx + 0.08);
              const nz = Math.floor(maxz - minz + 0.08);
              const cx = (minx + maxx) / 2;
              const cz = (minz + maxz) / 2;
              for (let i = 0; i < nx; i++) {
                for (let jj = 0; jj < nz; jj++) {
                  const px = cx + i - (nx - 1) / 2;
                  const pz = cz + jj - (nz - 1) / 2;
                  if (insidePoly(fp, px, pz, 0.3)) b.stud(sk, px, th, pz);
                }
              }
            }
          }
          sp.fill?.(b, ctx);
          b.pop();
        }
      }
    }
  }
  flatTiles.flush(b);
  if (acc) {
    const cap = (k: number, key: ColorKey | undefined, sgn: number) => {
      if (!key || !full) return;
      const s = secs[k];
      const zm = s.z;
      if (zm < zMin - 1e-6 || zm > zMax + 1e-6) return;
      const cen: V3 = [s.x0 ?? 0, s.y0 ?? 0, s.z];
      const ca = new MeshAcc();
      for (let j = 0; j < N; j++) ca.tri(cen, v3(rings[k][j]), v3(rings[k][j + 1]), [0, 0, sgn]);
      b.add(key, ca.done());
    };
    cap(0, o.capStart, -1);
    cap(secs.length - 1, o.capEnd, 1);
    if (acc.pos.length) b.add(coreKey!, acc.done());
  }
  if (o.inner) {
    const ins = o.inner.inset;
    const inRings = secs.map((s) => {
      const si: Sec = { ...s, a: Math.max(0.01, s.a - ins), b: Math.max(0.01, s.b - ins), bb: Math.max(0.01, (s.bb ?? s.b) - ins) };
      return ths.map((th) => new Vector3(...secPoint(si, th)));
    });
    const ia = new MeshAcc();
    for (let k = 0; k < secs.length - 1; k++) {
      if (!inRange(k)) continue;
      for (let j = 0; j < N; j++) {
        if (o.cut?.(j, zMid(k))) continue;
        const A = inRings[k][j];
        const B = inRings[k][j + 1];
        const D = inRings[k + 1][j];
        const C = inRings[k + 1][j + 1];
        const fn = new Vector3().crossVectors(D.clone().sub(A).add(C).sub(B), B.clone().sub(A).add(C).sub(D));
        if (fn.lengthSq() < 1e-14) continue;
        fn.normalize().negate();
        ia.quad(v3(A), v3(B), v3(C), v3(D), v3(fn));
      }
      if (!full) {
        for (const [jj, sgn] of [[0, -1], [N, 1]] as const) {
          if (o.cut?.(Math.min(jj, N - 1), zMid(k))) continue;
          const A = rings[k][jj];
          const D = rings[k + 1][jj];
          const Ai = inRings[k][jj];
          const Di = inRings[k + 1][jj];
          const tan = new Vector3(...secPoint(secs[k], ths[jj] + 1e-3 * sgn)).sub(A).normalize();
          ia.quad(v3(A), v3(D), v3(Di), v3(Ai), v3(tan));
        }
      }
    }
    for (const [k, sgn] of [[0, -1], [secs.length - 1, 1]] as const) {
      const zm = secs[k].z;
      if (zm < zMin - 1e-6 || zm > zMax + 1e-6) continue;
      const kk = k === 0 ? 0 : k - 1;
      for (let j = 0; j < N; j++) {
        if (o.cut?.(j, zMid(kk))) continue;
        ia.quad(v3(rings[k][j]), v3(rings[k][j + 1]), v3(inRings[k][j + 1]), v3(inRings[k][j]), [0, 0, sgn]);
      }
    }
    if (ia.pos.length) b.add(o.inner.key, ia.done());
  }
}

/**
 * Facet boundaries for a loft: N uniform steps over [th0, th1] with the nearest free step snapped
 * onto every break angle (or a new boundary inserted), so bands such as window trenches start and
 * end exactly on facet edges.
 */
export function thList(N: number, breaks: number[] = [], th0 = 0, th1 = Math.PI * 2): number[] {
  const step = (th1 - th0) / N;
  const out = Array.from({ length: N + 1 }, (_, j) => th0 + step * j);
  const locked = new Set<number>([0, N]);
  const extra: number[] = [];
  for (const br0 of breaks) {
    let br = br0;
    while (br < th0) br += Math.PI * 2;
    while (br > th1) br -= Math.PI * 2;
    let best = -1;
    let bd = Infinity;
    for (let j = 1; j < N; j++) {
      const d = Math.abs(out[j] - br);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    if (best > 0 && bd < step * 0.5 && !locked.has(best)) {
      out[best] = br;
      locked.add(best);
    } else extra.push(br);
  }
  return [...out, ...extra].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-5);
}

/** Is (x, y) inside the section, shrunk by margin m? */
export function insideSec(s: Sec, x: number, y: number, m = 0): boolean {
  const dy = y - (s.y0 ?? 0);
  const top = dy >= 0;
  const h = (top ? s.b : s.bb ?? s.b) - m;
  const a = s.a - m;
  if (h <= 0 || a <= 0) return false;
  const n = top ? s.n ?? 2 : s.nb ?? s.n ?? 2;
  return Math.pow(Math.abs(x - (s.x0 ?? 0)) / a, n) + Math.pow(Math.abs(dy) / h, n) < 1;
}

/** Convex (z, y) side profile extruded along X, centred on x = xc (fins, towers, deck tiers). */
export function sideProfile(b: Builder, key: ColorKey, pts: number[][], width: number, xc = 0, o: { c?: number; noFront?: boolean; noBack?: boolean } = {}): void {
  b.push();
  b.translate(xc, 0, 0);
  b.rotateY(Math.PI / 2);
  b.prism(key, pts.map(([z, y]) => [-z, y]), width, o);
  b.pop();
}

const QUAD_MD = (() => {
  const a = new MeshAcc();
  a.quad([-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [0, 1, 0]);
  return a.done();
})();

/** Flat single-sided quad facing +Y (window lights, decals, light panels): 2 triangles. */
export function flatQuad(b: Builder, key: ColorKey, x: number, y: number, z: number, w: number, l: number): void {
  b.add(key, QUAD_MD, new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeScale(w, 1, l)), { tint: 0.12 });
}

/** Cylinder between two points (bars, antennas, pipes, barrels). */
export function bar(b: Builder, key: ColorKey, p0: V3, p1: V3, r: number, o: { radial?: number; c?: number } = {}): void {
  const a = new Vector3(...p0);
  const d = new Vector3(...p1).sub(a);
  const len = d.length();
  if (len < 1e-6) return;
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d.clone().normalize());
  const m = new Matrix4().compose(a.clone().addScaledVector(d, 0.5), q, new Vector3(1, 1, 1));
  b.add(key, cylinder(r, len, o.c ?? Math.min(0.03, r * 0.2), o.radial ?? 8), m);
}

/** Anchor at a builder-local point, oriented so its +Z follows `dir` (and +Y roughly `up`). */
export function anchorFrom(b: Builder, name: string, parent: Object3D, p: V3, dir: V3 = [0, 0, 1], up: V3 = [0, 1, 0]): Object3D {
  const m = b.m;
  const pos = new Vector3(...p).applyMatrix4(m);
  const z = new Vector3(...dir).transformDirection(m);
  const u = new Vector3(...up).transformDirection(m);
  const x = new Vector3().crossVectors(u, z);
  if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
  x.normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  const o = new Object3D();
  o.name = name;
  o.position.copy(pos);
  o.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  parent.add(o);
  return o;
}

/** 1×n grille tile lying along local Z (x, z = centre, y = base). */
export function grille(b: Builder, key: ColorKey, x: number, y: number, z: number, len: number, w = 1): void {
  b.box(key, x, y + 0.1, z, w - 0.04, 0.2, len - 0.04, { hide: { ny: true } });
  const ribs = Math.max(2, Math.round(len * 2));
  for (let i = 0; i < ribs; i++) b.box(key, x, y + 0.28, z - len / 2 + (i + 0.5) * (len / ribs), w - 0.12, 0.16, (len / ribs) * 0.5, { hide: { ny: true }, c: 0.02 });
}

/** 1×1 round plate with its stud. */
export function roundPlate(b: Builder, key: ColorKey, x: number, y: number, z: number, r = 0.48, h = PLATE, radial = 10): void {
  b.cyl(key, x, y + h / 2, z, r, h, { radial, bottom: false });
  b.stud(key, x, y + h, z);
}

/** A little patch of greebles filling a local rectangle (Y up), in the style of LEGO "greeble" builds. */
export function greeblePatch(b: Builder, rng: Rng, w: number, l: number, keys: ColorKey[], o: { density?: number; tall?: number; studs?: boolean } = {}): void {
  const cells = Math.max(1, Math.floor(w)) * Math.max(1, Math.floor(l));
  const n = Math.max(1, Math.round(cells * (o.density ?? 0.35)));
  const tall = o.tall ?? 1;
  for (let i = 0; i < n; i++) {
    const key = rng.pick(keys);
    const kind = rng.next();
    const x = rng.range(-w / 2 + 0.6, w / 2 - 0.6);
    const z = rng.range(-l / 2 + 0.6, l / 2 - 0.6);
    if (kind < 0.22) {
      const len = rng.pick([1, 2, 2, 3]);
      grille(b, key, x, 0, z, Math.min(len, l - 0.4), 1);
    } else if (kind < 0.4) {
      roundPlate(b, key, x, 0, z, 0.48, PLATE * rng.pick([1, 1, 3]));
    } else if (kind < 0.62) {
      const sx = rng.pick([1, 1, 2]);
      const sz = rng.pick([1, 2, 2, 3, 4]);
      const h = PLATE * rng.pick([1, 1, 2, 3]) * tall;
      b.box(key, x, h / 2, z, sx - 0.04, h, Math.min(sz, l - 0.3) - 0.04, { hide: { ny: true } });
      if (o.studs && rng.chance(0.5)) b.stud(key, x, h, z);
    } else if (kind < 0.76) {
      const len = rng.range(1.5, Math.min(4, l - 0.4));
      b.cyl(key, x, 0.22, z, 0.16, len, { axis: 'z', radial: 8 });
    } else if (kind < 0.88) {
      b.box(key, x, 0.3, z, 0.96, 0.6, 1.96, { hide: { ny: true } });
      b.cyl(rng.pick(keys), x, 0.3, z, 0.24, 1.0, { axis: 'x', radial: 8 });
    } else {
      b.prism(key, [[-0.48, 0], [0.48, 0], [0.48, 0.2], [-0.48, 0.66]], 0.96, { zc: 0 });
    }
  }
}

/**
 * Lab helper: re-centre the turntable camera on `target` (object space) with a framing radius R.
 * The lab frames the bounding box of the returned object, so every mesh's box is emptied and one
 * invisible dummy defines the box instead (geometry bounding spheres, used for culling, are kept).
 */
export function labFocus(obj: Object3D, target: Vector3, R: number): Group {
  const g = new Group();
  g.name = `${obj.name}-focus`;
  obj.position.sub(target);
  g.add(obj);
  g.updateMatrixWorld(true);
  obj.traverse((c) => {
    const m = c as Mesh;
    if (m.isMesh && m.geometry) m.geometry.boundingBox = new Box3();
  });
  const dg = new BufferGeometry();
  dg.boundingBox = new Box3(new Vector3(-R, -R, -R), new Vector3(R, R, R));
  const dummy = new Mesh(dg);
  dummy.visible = false;
  g.add(dummy);
  const anim = obj.userData.animate as ((t: number) => void) | undefined;
  if (anim) g.userData.animate = anim;
  return g;
}
