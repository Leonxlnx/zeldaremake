import { Matrix4, ShapeUtils, Vector2, Vector3 } from 'three';
import { Builder, GAP, PLATE, type BuilderOpts } from '../core/builder';
import { MeshAcc, cached, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import { Rng, hash3 } from '../core/rng';

/**
 * Asset agent B's construction kit for macro-scale brick hulls: convex-polygon helpers, cheap
 * chamfered tiles (only the visible top edges are rounded), grille tiles, planar panel frames and a
 * module-based tile packer that covers any convex panel with tiles, plates and cropped wedge pieces
 * on the stud grid of the panel's own frame.
 */

export type P2 = [number, number];

// ─── 2D convex polygon helpers ──────────────────────────────────────────────────────────────────

export function area2(P: P2[]): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function ccw(P: P2[]): P2[] {
  return area2(P) < 0 ? P.slice().reverse() : P;
}

export function dedupe(P: P2[], eps = 1e-4): P2[] {
  const out: P2[] = [];
  for (const p of P) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > eps || Math.abs(q[1] - p[1]) > eps) out.push(p);
  }
  while (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) <= eps && Math.abs(out[0][1] - out[out.length - 1][1]) <= eps) out.pop();
  return out;
}

export function centroid2(P: P2[]): P2 {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    const k = p[0] * q[1] - q[0] * p[1];
    a += k;
    cx += (p[0] + q[0]) * k;
    cy += (p[1] + q[1]) * k;
  }
  if (Math.abs(a) < 1e-9) {
    let x = 0, y = 0;
    for (const p of P) { x += p[0]; y += p[1]; }
    return [x / P.length, y / P.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Outward unit normals of a CCW polygon's edges (edge i = P[i] → P[i+1]). */
export function edgeNormals(P: P2[]): P2[] {
  const n = P.length;
  const N: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    N.push([dy / l, -dx / l]);
  }
  return N;
}

/** Sutherland–Hodgman: subject clipped by a CCW convex polygon. */
export function clipConvex(S: P2[], C: P2[]): P2[] {
  let out = S;
  for (let i = 0; i < C.length && out.length; i++) {
    const a = C[i], b = C[(i + 1) % C.length];
    const inp = out;
    out = [];
    const side = (p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let j = 0; j < inp.length; j++) {
      const p = inp[j], q = inp[(j + 1) % inp.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return dedupe(out);
}

/** Clip a CCW convex polygon by the half-plane a·x + b·y <= c. */
export function clipHalf(S: P2[], a: number, b: number, c: number): P2[] {
  const out: P2[] = [];
  for (let j = 0; j < S.length; j++) {
    const p = S[j], q = S[(j + 1) % S.length];
    const sp = c - (a * p[0] + b * p[1]), sq = c - (a * q[0] + b * q[1]);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return dedupe(out);
}

export function inConvex(P: P2[], x: number, y: number, eps = 1e-7): boolean {
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -eps) return false;
  }
  return true;
}

/** Offset every edge of a CCW convex polygon inward by d (null if it collapses). */
export function insetConvex(P: P2[], d: number): P2[] | null {
  const n = P.length;
  if (n < 3) return null;
  const N = edgeNormals(P);
  const Q: P2[] = [];
  for (let j = 0; j < n; j++) {
    const a = N[(j - 1 + n) % n], b = N[j];
    const k = 1 + a[0] * b[0] + a[1] * b[1];
    if (k < 0.02) return null;
    Q.push([P[j][0] - (d * (a[0] + b[0])) / k, P[j][1] - (d * (a[1] + b[1])) / k]);
  }
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const pe0 = P[i1][0] - P[i][0], pe1 = P[i1][1] - P[i][1];
    const qe0 = Q[i1][0] - Q[i][0], qe1 = Q[i1][1] - Q[i][1];
    if (pe0 * qe0 + pe1 * qe1 <= 0) return null;
  }
  return Q;
}

/**
 * Polygon whose edges are the edges of P shifted inward by per-edge offsets (edge directions are
 * kept, so a frustum between P and the result has planar side faces).
 */
export function offsetEdges(P: P2[], off: number[]): P2[] {
  const n = P.length;
  const N = edgeNormals(P);
  const out: P2[] = [];
  for (let j = 0; j < n; j++) {
    const i0 = (j - 1 + n) % n, i1 = j;
    // line i: N_i · x = N_i · P_i − off_i
    const a1 = N[i0][0], b1 = N[i0][1], c1 = a1 * P[i0][0] + b1 * P[i0][1] - off[i0];
    const a2 = N[i1][0], b2 = N[i1][1], c2 = a2 * P[i1][0] + b2 * P[i1][1] - off[i1];
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-9) out.push([P[j][0] - N[i1][0] * off[i1], P[j][1] - N[i1][1] * off[i1]]);
    else out.push([(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det]);
  }
  return out;
}

// ─── meshes ─────────────────────────────────────────────────────────────────────────────────────

const UP: V3 = [0, 1, 0];

/**
 * Slab with a convex footprint in the local XZ plane, bottom at y = 0, top at y = h. Only the top
 * edges are chamfered (the underside always sits on something), so a rectangular tile is 18 tris.
 */
export function slabMD(poly: P2[], h: number, c: number, walls = true): MeshData {
  const acc = new MeshAcc();
  const P = ccw(dedupe(poly));
  const n = P.length;
  if (n < 3 || Math.abs(area2(P)) < 1e-6) return acc.done();
  const N = edgeNormals(P);
  c = Math.min(c, h * 0.45);
  let Q: P2[] | null = null;
  for (let k = 0; k < 4 && c > 1e-4; k++) {
    Q = insetConvex(P, c);
    if (Q) break;
    c *= 0.5;
  }
  if (!Q) {
    Q = P;
    c = 0;
  }
  for (let j = 1; j < n - 1; j++) acc.tri([Q[0][0], h, Q[0][1]], [Q[j][0], h, Q[j][1]], [Q[j + 1][0], h, Q[j + 1][1]], UP);
  const hc = h - c;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const nn: V3 = [N[i][0], 0, N[i][1]];
    if (c > 0) acc.quad([Q[i][0], h, Q[i][1]], [Q[i1][0], h, Q[i1][1]], [P[i1][0], hc, P[i1][1]], [P[i][0], hc, P[i][1]], UP, UP, nn, nn);
    if (walls && hc > 1e-4) acc.quad([P[i][0], hc, P[i][1]], [P[i1][0], hc, P[i1][1]], [P[i1][0], 0, P[i1][1]], [P[i][0], 0, P[i][1]], nn);
  }
  return acc.done();
}

/** Top face only of a convex footprint at height h (far-LOD tiles: 2 tris for a rectangle). */
export function topMD(poly: P2[], h: number): MeshData {
  const acc = new MeshAcc();
  const P = ccw(dedupe(poly));
  for (let j = 1; j < P.length - 1; j++) acc.tri([P[0][0], h, P[0][1]], [P[j][0], h, P[j][1]], [P[j + 1][0], h, P[j + 1][1]], UP);
  return acc.done();
}

const rect = (w: number, d: number): P2[] => [
  [-w / 2, -d / 2],
  [w / 2, -d / 2],
  [w / 2, d / 2],
  [-w / 2, d / 2],
];

export function tileTopMD(w: number, d: number, h: number): MeshData {
  return cached(`btt|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}`, () => topMD(rect(w, d), h));
}

/** Cached rectangular tile / plate body centred on the origin in XZ, bottom at y = 0. */
export function tileMD(w: number, d: number, h: number, c: number): MeshData {
  return cached(`bt|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${c.toFixed(4)}`, () =>
    slabMD(
      [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ],
      h,
      c,
    ),
  );
}

/** Axis-aligned box without a bottom face and without chamfers (10 tris). */
export function rawBox(acc: MeshAcc, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  acc.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
  acc.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
  acc.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  acc.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  acc.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
}

/**
 * Grille tile (the 1×2 "grille" with slots): a low chamfered body with raised bars running along
 * the longer side. Centred in XZ, bottom at y = 0.
 */
export function grilleMD(w: number, d: number, h: number, c: number): MeshData {
  return cached(`bg|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${c.toFixed(4)}`, () => {
    const acc = new MeshAcc();
    acc.append(grilleBaseMD(w, d, h, c));
    acc.append(grilleBarsMD(w, d, h));
    return acc.done();
  });
}

/** The body of a grille tile without its bars (what a grille reads as from far away). */
export function grilleBaseMD(w: number, d: number, h: number, c: number): MeshData {
  return cached(`bgb|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${c.toFixed(4)}`, () =>
    slabMD(
      [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ],
      h * 0.62,
      c,
    ),
  );
}

/** Just the bars of a grille tile (sub-stud detail: belongs in a near-only detail tier). */
export function grilleBarsMD(w: number, d: number, h: number): MeshData {
  return cached(`bgr|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}`, () => {
    const acc = new MeshAcc();
    const along = w >= d; // bars run along X if the tile is longer in X
    const L = along ? w : d, W = along ? d : w;
    const nb = Math.max(2, Math.round(W * 4));
    const pitch = (W - 0.16) / nb;
    const bw = pitch * 0.55;
    for (let k = 0; k < nb; k++) {
      const cw = -W / 2 + 0.08 + pitch * (k + 0.5);
      const a0 = -L / 2 + 0.1, a1 = L / 2 - 0.1;
      if (along) rawBox(acc, a0, h * 0.62 - 0.01, cw - bw / 2, a1, h, cw + bw / 2);
      else rawBox(acc, cw - bw / 2, h * 0.62 - 0.01, a0, cw + bw / 2, h, a1);
    }
    return acc.done();
  });
}

/** Flat-shaded cone solid from an apex to a (possibly concave) section polygon at z = zs. */
export function coneSolidMD(apex: V3, section: P2[], zs: number): MeshData {
  const acc = new MeshAcc();
  const S = area2(section) < 0 ? section.slice().reverse() : section;
  const n = S.length;
  const c3 = (p: P2): V3 => [p[0], p[1], zs];
  for (let i = 0; i < n; i++) {
    const a = c3(S[i]), b = c3(S[(i + 1) % n]);
    const nn = faceNormal(apex, a, b);
    // orient outward: away from the section centroid axis
    const cen = centroid2(S);
    const mid: V3 = [(a[0] + b[0]) / 2 - cen[0], (a[1] + b[1]) / 2 - cen[1], 0];
    const s = nn[0] * mid[0] + nn[1] * mid[1] >= 0 ? 1 : -1;
    acc.tri(apex, a, b, [nn[0] * s, nn[1] * s, nn[2] * s]);
  }
  const tris = ShapeUtils.triangulateShape(S.map((p) => new Vector2(p[0], p[1])), []);
  const nz: V3 = [0, 0, zs < apex[2] ? -1 : 1];
  for (const t of tris) acc.tri(c3(S[t[0]]), c3(S[t[1]]), c3(S[t[2]]), nz);
  return acc.done();
}

/** Flat-shaded convex prism between two parallel-edged polygons (frustum) — for hidden cores. */
export function frustumMD(bottom: P2[], y0: number, top: P2[], y1: number, o: { noBottom?: boolean } = {}): MeshData {
  const acc = new MeshAcc();
  const n = bottom.length;
  const B = (p: P2): V3 => [p[0], y0, p[1]];
  const T = (p: P2): V3 => [p[0], y1, p[1]];
  const cen = centroid2(bottom);
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const a = B(bottom[i]), b = B(bottom[i1]), c = T(top[i1]), d = T(top[i]);
    const nn = faceNormal(a, b, c);
    const mid = [(a[0] + b[0]) / 2 - cen[0], (a[2] + b[2]) / 2 - cen[1]];
    const s = nn[0] * mid[0] + nn[2] * mid[1] >= 0 ? 1 : -1;
    const q: V3 = [nn[0] * s, nn[1] * s, nn[2] * s];
    acc.quad(a, b, c, d, q);
  }
  for (let j = 1; j < n - 1; j++) {
    acc.tri(T(top[0]), T(top[j]), T(top[j + 1]), [0, 1, 0]);
    if (!o.noBottom) acc.tri(B(bottom[0]), B(bottom[j]), B(bottom[j + 1]), [0, -1, 0]);
  }
  return acc.done();
}

export function faceNormal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// ─── frames ─────────────────────────────────────────────────────────────────────────────────────

/** Orthonormal panel frame: local X = u (grid rows), local Y = n (out of the panel), local Z = v. */
export interface Frame {
  o: Vector3;
  u: Vector3;
  n: Vector3;
  v: Vector3;
  m: Matrix4;
}

export const vec = (p: V3) => new Vector3(p[0], p[1], p[2]);

/**
 * Frame at `o` with rows along `uDir`, normal = plane normal flipped toward `outward`, v pointing
 * toward `vToward` (a point in the plane). May be left-handed; the Builder handles mirrored frames.
 */
export function makeFrame(o: V3, uDir: V3, normal: V3, outward: V3, vToward?: V3): Frame {
  const O = vec(o);
  const n = vec(normal).normalize();
  if (n.dot(vec(outward)) < 0) n.negate();
  const u = vec(uDir);
  u.addScaledVector(n, -u.dot(n)).normalize();
  const v = new Vector3().crossVectors(u, n);
  if (vToward && v.dot(vec(vToward).sub(O)) < 0) v.negate();
  const m = new Matrix4().makeBasis(u, n, v).setPosition(O);
  return { o: O, u, n, v, m };
}

export function toLocal(f: Frame, p: V3 | Vector3): P2 {
  const d = (p instanceof Vector3 ? p.clone() : vec(p)).sub(f.o);
  return [d.dot(f.u), d.dot(f.v)];
}

export function toWorld(f: Frame, u: number, v: number, y = 0): Vector3 {
  return f.o.clone().addScaledVector(f.u, u).addScaledVector(f.v, v).addScaledVector(f.n, y);
}

/** Newell normal of a planar 3D polygon. */
export function polyNormal(pts: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

// ─── zone-routed builder ────────────────────────────────────────────────────────────────────────

const _cen = new WeakMap<MeshData, V3>();
function mdCentroid(md: MeshData): V3 {
  let c = _cen.get(md);
  if (!c) {
    const P = md.pos;
    let x = 0, y = 0, z = 0;
    const n = P.length / 3 || 1;
    for (let i = 0; i < P.length; i += 3) {
      x += P[i];
      y += P[i + 1];
      z += P[i + 2];
    }
    c = [x / n, y / n, z / n];
    _cen.set(md, c);
  }
  return c;
}
const _zm = new Matrix4();
const _zp = new Vector3();

/**
 * A Builder that keeps only the parts whose centroid falls into its zone. Running the same
 * (deterministic) construction once per zone splits a huge model into spatial chunks (frustum
 * culling, bounded JS arrays) without the construction code knowing about it.
 */
export class ZoneBuilder extends Builder {
  constructor(o: BuilderOpts, readonly zone: number, readonly pick: (x: number, y: number, z: number) => number) {
    super(o);
  }
  /** true if a local point (current transform) belongs to this zone */
  accepts(x: number, y: number, z: number): boolean {
    _zp.set(x, y, z).applyMatrix4(this.m);
    return this.pick(_zp.x, _zp.y, _zp.z) === this.zone;
  }
  override add(key: ColorKey, md: MeshData, local?: Matrix4, o: { tint?: number; shade?: number } = {}): this {
    const c = mdCentroid(md);
    _zm.copy(this.m);
    if (local) _zm.multiply(local);
    _zp.set(c[0], c[1], c[2]).applyMatrix4(_zm);
    if (this.pick(_zp.x, _zp.y, _zp.z) !== this.zone) return this;
    return super.add(key, md, local, o);
  }
}

/** Cheap pre-check before generating expensive geometry for a spot. */
export function wants(b: Builder, x: number, y: number, z: number): boolean {
  return !(b instanceof ZoneBuilder) || b.accepts(x, y, z);
}

// ─── routed builder: spatial chunks × detail tiers in a single construction pass ─────────────────

/**
 * Detail tiers: base parts are always drawn; fine parts (studs, small greebles) only up close;
 * micro parts (grille bars, hairline rods) only very close, where they are several pixels wide.
 */
export const TIER_BASE = 0;
export const TIER_FINE = 1;
export const TIER_MICRO = 2;

const _rm = new Matrix4();
const _rp = new Vector3();

/**
 * A Builder that forwards every part (fully transformed) to one of several target builders, picked
 * by the part's world centroid and the current detail tier. One deterministic pass splits a huge
 * model into frustum-cullable chunks and into near-only detail layers. Targets must have an
 * identity transform stack.
 */
export class RouteBuilder extends Builder {
  tier = TIER_BASE;
  constructor(o: BuilderOpts, readonly route: (x: number, y: number, z: number, tier: number) => Builder) {
    super(o);
  }
  override add(key: ColorKey, md: MeshData, local?: Matrix4, o: { tint?: number; shade?: number } = {}): this {
    if (!md.pos.length) return this;
    _rm.copy(this.m);
    if (local) _rm.multiply(local);
    const c = mdCentroid(md);
    _rp.set(c[0], c[1], c[2]).applyMatrix4(_rm);
    this.route(_rp.x, _rp.y, _rp.z, this.tier).add(key, md, _rm, o);
    return this;
  }
  override studs(key: ColorKey, x: number, yP: number, z: number, sx: number, sz: number): this {
    const t = this.tier;
    this.tier = Math.max(t, TIER_FINE);
    super.studs(key, x, yP, z, sx, sz);
    this.tier = t;
    return this;
  }
  override stud(key: ColorKey, x: number, y: number, z: number): this {
    const t = this.tier;
    this.tier = Math.max(t, TIER_FINE);
    super.stud(key, x, y, z);
    this.tier = t;
    return this;
  }
}

function inTier(b: Builder, tier: number, fn: () => void): void {
  if (!(b instanceof RouteBuilder)) {
    fn();
    return;
  }
  const t = b.tier;
  b.tier = Math.max(t, tier);
  try {
    fn();
  } finally {
    b.tier = t;
  }
}

/** Run fn with every part it adds in the near-only detail tier (plain builders just add them). */
export function fine(b: Builder, fn: () => void): void {
  inTier(b, TIER_FINE, fn);
}

/** Run fn with every part it adds in the closest-range detail tier (plain builders just add them). */
export function micro(b: Builder, fn: () => void): void {
  inTier(b, TIER_MICRO, fn);
}

// ─── panel tiling ───────────────────────────────────────────────────────────────────────────────

export type TileKind = 'tile' | 'plate' | 'grille' | 'raised' | 'tall';

export interface TStyle {
  key: ColorKey;
  kind?: TileKind;
  /** candidate sizes [along u, along v] in studs, roughly in order of preference */
  sizes: P2[];
  /** height in plates (default: tile 1, raised 2, tall 3) */
  hP?: number;
  /** occasional alternative colour for single tiles */
  mottle?: ColorKey;
  mottleP?: number;
  /** far LOD: flush tiles are top faces only, raised ones have walls but no chamfer */
  flat?: boolean;
  /** inset of each tile from its cells (default GAP); 0 butts tiles together, so no seam shows the core */
  gap?: number;
  /** extra lift of this style's tiles along the panel normal (negative = sunk into the core) */
  lift?: number;
}

export interface PackOpts {
  style: (u: number, v: number) => TStyle | null;
  seed: number;
  /** tiles never cross module boundaries along u (continuous structural seams) */
  module?: number;
  /** pattern repeats every `period` modules */
  period?: number;
  studs?: boolean;
  /** skip cells whose (clipped) centre makes this true */
  mask?: (u: number, v: number) => boolean;
  minArea?: number;
  /** scatter: 0 = strict preference order, 1 = fully shuffled */
  shuffle?: number;
  /** extra lift along the panel normal */
  lift?: number;
  /** grid offset (so tiles line up with a neighbour) */
  gridU?: number;
  gridV?: number;
}

const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);

/**
 * Cover a convex polygon (local u/v coordinates of the builder's current frame; local +Y is the
 * panel normal) with tiles on the stud grid. Cells take their style at their (clipped) centre;
 * tiles only merge cells of the same style object; boundary tiles are cropped into wedge pieces.
 */
export function packPanel(b: Builder, poly: P2[], o: PackOpts): number {
  const P = ccw(dedupe(poly));
  if (P.length < 3) return 0;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of P) {
    u0 = Math.min(u0, p[0]);
    u1 = Math.max(u1, p[0]);
    v0 = Math.min(v0, p[1]);
    v1 = Math.max(v1, p[1]);
  }
  const gu = o.gridU ?? 0, gv = o.gridV ?? 0;
  const gi0 = Math.floor(u0 - gu) , gj0 = Math.floor(v0 - gv);
  const nu = Math.ceil(u1 - gu) - gi0, nv = Math.ceil(v1 - gv) - gj0;
  if (nu <= 0 || nv <= 0) return 0;
  const N = nu * nv;
  const state = new Uint8Array(N); // 0 out, 1 partial, 2 full
  const used = new Uint8Array(N);
  const sty: (TStyle | null)[] = new Array(N).fill(null);
  const minCell = 0.05;
  for (let j = 0; j < nv; j++) {
    const cv = gj0 + j + gv;
    for (let i = 0; i < nu; i++) {
      const cu = gi0 + i + gu;
      const k = j * nu + i;
      let st = 0;
      let cx = cu + 0.5, cy = cv + 0.5;
      const n4 = (inConvex(P, cu, cv) ? 1 : 0) + (inConvex(P, cu + 1, cv) ? 1 : 0) + (inConvex(P, cu + 1, cv + 1) ? 1 : 0) + (inConvex(P, cu, cv + 1) ? 1 : 0);
      if (n4 === 4) st = 2;
      else {
        const cl = clipConvex(
          [
            [cu, cv],
            [cu + 1, cv],
            [cu + 1, cv + 1],
            [cu, cv + 1],
          ],
          P,
        );
        if (cl.length >= 3) {
          const a = area2(cl);
          if (a > minCell) {
            st = 1;
            const c = centroid2(cl);
            cx = c[0];
            cy = c[1];
          }
        }
      }
      if (!st) continue;
      if (o.mask && o.mask(cx, cy)) continue;
      const s = o.style(cx, cy);
      if (!s) continue;
      state[k] = st;
      sty[k] = s;
    }
  }
  const M = o.module ?? 1 << 20;
  const per = o.period ?? 1 << 20;
  const shuffle = o.shuffle ?? 0.5;
  const lift = o.lift ?? 0;
  const c = b.chamfer;
  const minArea = o.minArea ?? 0.08;
  let count = 0;
  const fits = (i: number, j: number, su: number, sv: number, s: TStyle, iB: number) => {
    if (i + su > iB || j + sv > nv) return false;
    for (let jj = j; jj < j + sv; jj++)
      for (let ii = i; ii < i + su; ii++) {
        const k = jj * nu + ii;
        if (!state[k] || used[k] || sty[k] !== s) return false;
      }
    return true;
  };
  const mA = Math.floor((gi0 + gu) / M), mB = Math.floor((gi0 + gu + nu - 1) / M);
  for (let m = mA; m <= mB; m++) {
    const rng = new Rng(Math.floor(hash3(((m % per) + per) % per, o.seed, 911) * 4294967296) >>> 0);
    const iA = Math.max(0, Math.ceil(m * M - gu) - gi0), iB = Math.min(nu, Math.ceil((m + 1) * M - gu) - gi0);
    for (let j = 0; j < nv; j++) {
      for (let i = iA; i < iB; i++) {
        const k = j * nu + i;
        if (!state[k] || used[k]) continue;
        const s = sty[k]!;
        const cands = s.sizes
          .map((sz, idx) => ({ sz, w: idx + rng.next() * s.sizes.length * shuffle }))
          .sort((a, b2) => a.w - b2.w)
          .map((e) => e.sz);
        let su = 1, sv = 1;
        for (const [a, bb] of cands) {
          if (fits(i, j, a, bb, s, iB)) {
            su = a;
            sv = bb;
            break;
          }
        }
        let allFull = true;
        for (let jj = j; jj < j + sv; jj++)
          for (let ii = i; ii < i + su; ii++) {
            const kk = jj * nu + ii;
            used[kk] = 1;
            if (state[kk] !== 2) allFull = false;
          }
        const u = gi0 + i + gu, v = gj0 + j + gv;
        if (emitTile(b, s, u, v, su, sv, allFull, P, rng, c, lift, o.studs ?? true, minArea, state, nu, i, j)) count++;
      }
    }
  }
  return count;
}

function emitTile(
  b: Builder,
  s: TStyle,
  u: number,
  v: number,
  su: number,
  sv: number,
  allFull: boolean,
  P: P2[],
  rng: Rng,
  c: number,
  lift: number,
  studs: boolean,
  minArea: number,
  state: Uint8Array,
  nu: number,
  i0: number,
  j0: number,
): boolean {
  let key = s.key;
  if (s.mottle && rng.chance(s.mottleP ?? 0.1)) key = s.mottle;
  const kind = s.kind ?? 'tile';
  const hP = s.hP ?? (kind === 'raised' ? 2 : kind === 'tall' ? 3 : 1);
  const h = hP * PLATE;
  lift += s.lift ?? 0;
  if (!wants(b, u + su / 2, lift + h / 2, v + sv / 2)) return false;
  const flush = kind === 'tile' || kind === 'plate' || kind === 'grille';
  const gap = s.gap ?? GAP;
  if (allFull) {
    const w = su - 2 * gap, d = sv - 2 * gap;
    const at = T(u + su / 2, lift, v + sv / 2);
    if (kind === 'grille' && !s.flat && b instanceof RouteBuilder) {
      // the bars are sub-stud detail: closest tier only, the recessed body is always there
      b.add(key, grilleBaseMD(w, d, h, c), at);
      micro(b, () => b.add(key, grilleBarsMD(w, d, h), at));
      return true;
    }
    const md = s.flat ? (flush ? tileTopMD(w, d, h) : tileMD(w, d, h, 0)) : kind === 'grille' ? grilleMD(w, d, h, c) : tileMD(w, d, h, c);
    b.add(key, md, at);
    if (kind === 'plate' && studs && !s.flat) b.studs(key, u, hP + lift / PLATE, v, su, sv);
    return true;
  }
  const cl = clipConvex(
    [
      [u, v],
      [u + su, v],
      [u + su, v + sv],
      [u, v + sv],
    ],
    P,
  );
  if (cl.length < 3 || area2(cl) < minArea) return false;
  const ins = gap > 0 ? (insetConvex(ccw(cl), gap) ?? cl) : ccw(cl);
  b.add(key, s.flat ? (flush ? topMD(ins, h) : slabMD(ins, h, 0)) : slabMD(ins, h, c), lift ? T(0, lift, 0) : undefined);
  if (kind === 'plate' && studs && !s.flat) {
    for (let jj = 0; jj < sv; jj++)
      for (let ii = 0; ii < su; ii++) if (state[(j0 + jj) * nu + (i0 + ii)] === 2) b.stud(key, u + ii + 0.5, h + lift, v + jj + 0.5);
  }
  return true;
}

/** Tile a planar convex 3D polygon: builds its frame (rows along the first edge unless given). */
export function tileFace(
  b: Builder,
  pts: V3[],
  o: PackOpts & { outward: V3; uDir?: V3; origin?: V3; vToward?: V3; worldMask?: (p: Vector3) => boolean },
): Frame {
  const nrm = polyNormal(pts);
  const origin = o.origin ?? pts[0];
  const uDir: V3 = o.uDir ?? [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
  let vT = o.vToward;
  if (!vT) {
    let x = 0, y = 0, z = 0;
    for (const p of pts) {
      x += p[0];
      y += p[1];
      z += p[2];
    }
    vT = [x / pts.length, y / pts.length, z / pts.length];
  }
  const f = makeFrame(origin, uDir, nrm, o.outward, vT);
  const poly = pts.map((p) => toLocal(f, p));
  const wm = o.worldMask;
  b.push();
  b.apply(f.m);
  packPanel(b, poly, { ...o, mask: wm ? (u, v) => wm(toWorld(f, u, v)) || (o.mask?.(u, v) ?? false) : o.mask });
  b.pop();
  return f;
}

/** Deterministic hash → [0,1) for layout decisions (never the builder's own rng). */
export function h3(a: number, b: number, c: number): number {
  return hash3(Math.floor(a), Math.floor(b), Math.floor(c));
}
