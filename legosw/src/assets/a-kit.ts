import { Matrix4, Vector3, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import type { Builder } from '../core/builder';
import { MeshAcc, box, catmull, cylinder, prism, sweep, tube, type MeshData, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';

/**
 * Part helpers for asset agent A (Eta-2, astromechs): convex-footprint layers with clipping, studs
 * inside arbitrary outlines, oriented slabs / beams / rods between 3D points, glass panes, and
 * curved "printed" panels that sit just proud of spheres and cylinders. The second half is a small
 * LEGO part vocabulary (seamed plates and tiles, prints, grilles, slopes, Technic holes and pins,
 * hoses) that works in any face frame (`onFace`).
 */

export type P2 = [number, number];

export function area2(p: P2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], r = p[(i + 1) % p.length];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a / 2;
}

function dedupe(p: P2[]): P2[] {
  const out: P2[] = [];
  for (const q of p) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-5) out.push(q);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-5) out.pop();
  return out;
}

/** Keep the part of a convex polygon where n·p <= d (Sutherland–Hodgman against one line). */
export function clipHalf(poly: P2[], nx: number, nz: number, d: number): P2[] {
  const out: P2[] = [];
  const f = (p: P2) => nx * p[0] + nz * p[1] - d;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const fa = f(a), fb = f(b);
    if (fa <= 1e-9) out.push(a);
    if ((fa <= 1e-9) !== (fb <= 1e-9)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return dedupe(out);
}

/** Clip to an axis-aligned box [x0,x1]×[z0,z1]. */
export function clipBox(poly: P2[], x0: number, x1: number, z0: number, z1: number): P2[] {
  let p = poly;
  p = clipHalf(p, -1, 0, -x0);
  p = clipHalf(p, 1, 0, x1);
  p = clipHalf(p, 0, -1, -z0);
  p = clipHalf(p, 0, 1, z1);
  return p;
}

/** Keep the side of the line a→b where the polygon lies to the LEFT (a→b in x,z). */
export function clipLine(poly: P2[], a: P2, b: P2, keepLeft = true): P2[] {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  // left normal of (dx,dz) in the x,z plane (x right, z up in plan) is (-dz, dx)
  let nx = dz, nz = -dx;
  if (!keepLeft) {
    nx = -nx;
    nz = -nz;
  }
  return clipHalf(poly, nx, nz, nx * a[0] + nz * a[1]);
}

export function rect(x0: number, z0: number, x1: number, z1: number): P2[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/**
 * Convex outline minus a convex hole, as convex pieces whose seams continue the hole's edges
 * (the way a ring of plates is actually built around an opening).
 */
export function ringPieces(outline: P2[], hole: P2[]): P2[][] {
  const H = area2(hole) < 0 ? [...hole].reverse() : hole;
  const out: P2[][] = [];
  for (let i = 0; i < H.length; i++) {
    let p = outline;
    for (let j = 0; j < i && p.length >= 3; j++) p = clipLine(p, H[j], H[(j + 1) % H.length], true);
    if (p.length >= 3) p = clipLine(p, H[i], H[(i + 1) % H.length], false);
    if (p.length >= 3 && Math.abs(area2(p)) > 0.01) out.push(p);
  }
  return out;
}

/** A convex polygon shrunk by `d` (every edge moved inward, neighbouring edges re-intersected). */
export function inset(poly: P2[], d: number): P2[] {
  const n = poly.length;
  const s = area2(poly) > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const c = poly[(i + 1) % n];
    const dx = c[0] - a[0], dz = c[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return { px: a[0] - (dz / l) * s * d, pz: a[1] + (dx / l) * s * d, dx, dz };
  });
  return lines.map((l1, i) => {
    const l0 = lines[(i - 1 + n) % n];
    const det = l1.dx * l0.dz - l0.dx * l1.dz;
    const ex = l1.px - l0.px, ez = l1.pz - l0.pz;
    const t = Math.abs(det) < 1e-9 ? 0 : (l1.dx * ez - ex * l1.dz) / det;
    return [l0.px + l0.dx * t, l0.pz + l0.dz * t] as P2;
  });
}

/** z on the segment a→b (plan points) at a given x. */
export function zAt(a: P2, b: P2, x: number): number {
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}

/** Cut a convex polygon into strips at the given z (and/or x) positions. */
export function split(poly: P2[], cutsZ: number[] = [], cutsX: number[] = []): P2[][] {
  let parts: P2[][] = [poly];
  for (const z of cutsZ) parts = parts.flatMap((p) => [clipHalf(p, 0, 1, z), clipHalf(p, 0, -1, -z)]);
  for (const x of cutsX) parts = parts.flatMap((p) => [clipHalf(p, 1, 0, x), clipHalf(p, -1, 0, -x)]);
  return parts.filter((p) => p.length >= 3 && Math.abs(area2(p)) > 0.02);
}

/** A plate / tile / brick with a convex footprint (skips degenerate clips). */
export function layer(b: Builder, key: ColorKey, poly: P2[], y0: number, h: number, o: { c?: number; hideBottom?: boolean } = {}): void {
  if (poly.length < 3 || Math.abs(area2(poly)) < 0.02) return;
  b.shape(key, poly, y0, h, o);
}

export function inside(poly: P2[], x: number, z: number, margin = 0): boolean {
  const s = Math.sign(area2(poly)) || 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length];
    const dx = c[0] - a[0], dz = c[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    const cross = (dx * (z - a[1]) - dz * (x - a[0])) / l;
    if (cross * s < margin) return false;
  }
  return true;
}

/**
 * Studs on the stud grid (x integer, z half-integer by default) that fit inside a footprint.
 */
export function studsIn(b: Builder, key: ColorKey, poly: P2[], yTop: number, o: { gx?: number; gz?: number; margin?: number; skip?: (x: number, z: number) => boolean } = {}): number {
  const gx = o.gx ?? 0, gz = o.gz ?? 0.5, m = o.margin ?? 0.42;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  let n = 0;
  for (let x = Math.ceil(minX - gx) + gx; x <= maxX; x += 1) {
    for (let z = Math.ceil(minZ - gz) + gz; z <= maxZ; z += 1) {
      if (!inside(poly, x, z, m)) continue;
      if (o.skip?.(x, z)) continue;
      b.stud(key, x, yTop, z);
      n++;
    }
  }
  return n;
}

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _n = new Vector3(), _u = new Vector3(), _w = new Vector3();

function newell(pts: V3[], out: Vector3): Vector3 {
  out.set(0, 0, 0);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    out.x += (p[1] - q[1]) * (p[2] + q[2]);
    out.y += (p[2] - q[2]) * (p[0] + q[0]);
    out.z += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return out.normalize();
}

export function facetNormal(pts: V3[]): V3 {
  const n = newell(pts, new Vector3());
  return [n.x, n.y, n.z];
}

/**
 * A chamfered slab whose face is the (nearly planar, convex) polygon `pts`. `side` = +1 grows the
 * slab along the polygon normal (right-hand winding), −1 against it, 0 centred.
 */
export function slab3(b: Builder, key: ColorKey, pts: V3[], t: number, o: { c?: number; side?: number; tint?: number } = {}): void {
  const n = newell(pts, _n).clone();
  const p0 = _a.set(...pts[0]).clone();
  const u = _u.set(...pts[1]).sub(p0).normalize().clone();
  const v = new Vector3().crossVectors(n, u).normalize();
  const poly = pts.map((p) => {
    _b.set(...p).sub(p0);
    return [_b.dot(u), _b.dot(v)];
  });
  const md = prism(poly, t, o.c ?? 0.03, {});
  const side = o.side ?? 1;
  const m = new Matrix4().makeBasis(u, v, n).setPosition(p0.clone().addScaledVector(n, (side * t) / 2));
  b.add(key, md, m, { tint: o.tint });
}

/** Box beam from a to c (w across, h along `up`), optional extension past both ends. */
export function beam(b: Builder, key: ColorKey, a: V3, c: V3, w: number, h: number, up: V3 = [0, 1, 0], o: { c?: number; ext?: number; hide?: { ny?: boolean } } = {}): void {
  const A = _a.set(...a).clone(), C = _c.set(...c).clone();
  const z = C.clone().sub(A);
  const len = z.length();
  if (len < 1e-4) return;
  z.divideScalar(len);
  const y = _w.set(...up).clone();
  y.addScaledVector(z, -y.dot(z));
  if (y.lengthSq() < 1e-8) y.set(1, 0, 0).addScaledVector(z, -z.x);
  y.normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  const ext = o.ext ?? 0;
  const md = box(w, h, len + 2 * ext, o.c ?? Math.min(0.03, w * 0.2, h * 0.2), o.hide ?? {});
  const m = new Matrix4().makeBasis(x, y, z).setPosition(A.add(C).multiplyScalar(0.5));
  b.add(key, md, m);
}

/** Cylinder from a to c. */
export function rod(b: Builder, key: ColorKey, a: V3, c: V3, r: number, o: { radial?: number; c?: number; top?: boolean; bottom?: boolean } = {}): void {
  const A = _a.set(...a).clone(), C = _c.set(...c).clone();
  const y = C.clone().sub(A);
  const len = y.length();
  if (len < 1e-4) return;
  y.divideScalar(len);
  const t = Math.abs(y.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const x = new Vector3().crossVectors(y, t).normalize();
  const z = new Vector3().crossVectors(x, y).normalize();
  const md = cylinder(r, len, o.c ?? Math.min(0.035, r * 0.2), o.radial ?? 16, { top: o.top, bottom: o.bottom });
  const m = new Matrix4().makeBasis(x, y, z).setPosition(A.add(C).multiplyScalar(0.5));
  b.add(key, md, m);
}

/** Any MeshData placed with its local +Y along `dir`, at `at` (spin = roll about dir). */
export function place(b: Builder, key: ColorKey, md: MeshData, at: V3, dir: V3, o: { spin?: number; tint?: number } = {}): void {
  const y = new Vector3(...dir).normalize();
  const t = Math.abs(y.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
  const z = t.clone().addScaledVector(y, -t.dot(y)).normalize();
  const x = new Vector3().crossVectors(y, z).normalize();
  if (o.spin) {
    const q = new Matrix4().makeRotationAxis(y, o.spin);
    x.applyMatrix4(q);
    z.applyMatrix4(q);
  }
  const m = new Matrix4().makeBasis(x, y, z).setPosition(at[0], at[1], at[2]);
  b.add(key, md, m, { tint: o.tint });
}

/**
 * Solid between two convex outlines with matching vertex order (e.g. a raked nose: the same
 * footprint at two heights, shifted and scaled). Flat facets; side quads split into triangles.
 */
export function loft(bot: V3[], top: V3[], o: { caps?: boolean } = {}): MeshData {
  const acc = new MeshAcc();
  const n = bot.length;
  const all = [...bot, ...top];
  const C: V3 = all.reduce((s, p) => [s[0] + p[0] / all.length, s[1] + p[1] / all.length, s[2] + p[2] / all.length] as V3, [0, 0, 0] as V3);
  const face = (a: V3, b: V3, c: V3) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l; ny /= l; nz /= l;
    const mx = (a[0] + b[0] + c[0]) / 3 - C[0], my = (a[1] + b[1] + c[1]) / 3 - C[1], mz = (a[2] + b[2] + c[2]) / 3 - C[2];
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    acc.tri(a, b, c, [nx, ny, nz]);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face(bot[i], bot[j], top[j]);
    face(bot[i], top[j], top[i]);
  }
  if (o.caps ?? true) {
    for (let i = 1; i < n - 1; i++) {
      face(bot[0], bot[i], bot[i + 1]);
      face(top[0], top[i], top[i + 1]);
    }
  }
  return acc.done();
}

/** Zero-thickness glass (the transparent materials are double sided). */
export function pane(b: Builder, key: ColorKey, pts: V3[], inset = 0): void {
  const n = facetNormal(pts);
  let P = pts;
  if (inset) {
    const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length] as V3, [0, 0, 0] as V3);
    P = pts.map((p) => [p[0] + (c[0] - p[0]) * inset, p[1] + (c[1] - p[1]) * inset, p[2] + (c[2] - p[2]) * inset] as V3);
  }
  const acc = new MeshAcc();
  for (let i = 1; i < P.length - 1; i++) acc.tri(P[0], P[i], P[i + 1], n);
  b.add(key, acc.done(), undefined, { tint: 0 });
}

/**
 * Closed thin patch on a sphere (centre origin): polar φ0..φ1 (0 = top), azimuth θ0..θ1 (θ = 0 → +Z,
 * toward +X), from radius r0 (hidden, inside) to r1 (the visible face). Printed dome panels.
 */
export function spherePatch(r0: number, r1: number, phi0: number, phi1: number, th0: number, th1: number, nu = 8, nv = 4): MeshData {
  const acc = new MeshAcc();
  const P = (r: number, ph: number, th: number): V3 => [r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), r * Math.sin(ph) * Math.cos(th)];
  const N = (ph: number, th: number): V3 => [Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)];
  for (let i = 0; i < nu; i++) {
    const ta = th0 + ((th1 - th0) * i) / nu, tb = th0 + ((th1 - th0) * (i + 1)) / nu;
    for (let j = 0; j < nv; j++) {
      const pa = phi0 + ((phi1 - phi0) * j) / nv, pb = phi0 + ((phi1 - phi0) * (j + 1)) / nv;
      acc.quad(P(r1, pa, ta), P(r1, pa, tb), P(r1, pb, tb), P(r1, pb, ta), N(pa, ta), N(pa, tb), N(pb, tb), N(pb, ta));
    }
  }
  // rims, with explicit outward normals (±e_phi on the polar edges, ±e_theta on the azimuth edges)
  const ePhi = (ph: number, th: number, s: number): V3 => [s * Math.cos(ph) * Math.sin(th), -s * Math.sin(ph), s * Math.cos(ph) * Math.cos(th)];
  const eTh = (th: number, s: number): V3 => [s * Math.cos(th), 0, -s * Math.sin(th)];
  for (let i = 0; i < nu; i++) {
    const ta = th0 + ((th1 - th0) * i) / nu, tb = th0 + ((th1 - th0) * (i + 1)) / nu;
    if (phi0 > 1e-4) acc.quad(P(r0, phi0, ta), P(r0, phi0, tb), P(r1, phi0, tb), P(r1, phi0, ta), ePhi(phi0, ta, -1), ePhi(phi0, tb, -1), ePhi(phi0, tb, -1), ePhi(phi0, ta, -1));
    acc.quad(P(r0, phi1, tb), P(r0, phi1, ta), P(r1, phi1, ta), P(r1, phi1, tb), ePhi(phi1, tb, 1), ePhi(phi1, ta, 1), ePhi(phi1, ta, 1), ePhi(phi1, tb, 1));
  }
  if (th1 - th0 < Math.PI * 2 - 1e-4) {
    for (let j = 0; j < nv; j++) {
      const pa = phi0 + ((phi1 - phi0) * j) / nv, pb = phi0 + ((phi1 - phi0) * (j + 1)) / nv;
      acc.quad(P(r0, pb, th0), P(r0, pa, th0), P(r1, pa, th0), P(r1, pb, th0), eTh(th0, -1));
      acc.quad(P(r0, pa, th1), P(r0, pb, th1), P(r1, pb, th1), P(r1, pa, th1), eTh(th1, 1));
    }
  }
  return acc.done();
}

/** Closed thin patch on a vertical cylinder (axis Y through origin), θ = 0 → +Z. */
export function cylPatch(r0: number, r1: number, y0: number, y1: number, th0: number, th1: number, nu = 6): MeshData {
  const acc = new MeshAcc();
  const P = (r: number, y: number, th: number): V3 => [r * Math.sin(th), y, r * Math.cos(th)];
  const N = (th: number): V3 => [Math.sin(th), 0, Math.cos(th)];
  for (let i = 0; i < nu; i++) {
    const ta = th0 + ((th1 - th0) * i) / nu, tb = th0 + ((th1 - th0) * (i + 1)) / nu;
    acc.quad(P(r1, y1, ta), P(r1, y1, tb), P(r1, y0, tb), P(r1, y0, ta), N(ta), N(tb), N(tb), N(ta));
    acc.quad(P(r0, y1, ta), P(r0, y1, tb), P(r1, y1, tb), P(r1, y1, ta), [0, 1, 0]);
    acc.quad(P(r0, y0, tb), P(r0, y0, ta), P(r1, y0, ta), P(r1, y0, tb), [0, -1, 0]);
  }
  const s0: V3 = [-Math.cos(th0), 0, Math.sin(th0)], s1: V3 = [Math.cos(th1), 0, -Math.sin(th1)];
  acc.quad(P(r0, y0, th0), P(r0, y1, th0), P(r1, y1, th0), P(r1, y0, th0), s0);
  acc.quad(P(r0, y1, th1), P(r0, y0, th1), P(r1, y0, th1), P(r1, y1, th1), s1);
  return acc.done();
}

/**
 * Square plate (w × w, height h, centred) with a round hole of radius rIn — the socket collar.
 * `floor` closes the bottom of the hole.
 */
export function squareRing(w: number, rIn: number, h: number, seg = 32, o: { floor?: boolean; c?: number } = {}): MeshData {
  const acc = new MeshAcc();
  const hw = w / 2, y1 = h / 2, y0 = -h / 2;
  const c = o.c ?? 0.035;
  const up: V3 = [0, 1, 0];
  // boundary point on the (chamfer-inset) square in direction a
  const sq = (a: number, inset: number): [number, number] => {
    const dx = Math.sin(a), dz = Math.cos(a);
    const k = (hw - inset) / Math.max(Math.abs(dx), Math.abs(dz));
    return [dx * k, dz * k];
  };
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const i0: V3 = [rIn * Math.sin(a0), y1, rIn * Math.cos(a0)], i1: V3 = [rIn * Math.sin(a1), y1, rIn * Math.cos(a1)];
    const s0 = sq(a0, c), s1 = sq(a1, c);
    acc.quad(i0, i1, [s1[0], y1, s1[1]], [s0[0], y1, s0[1]], up);
    // hole wall (normal inward)
    const n0: V3 = [-Math.sin(a0), 0, -Math.cos(a0)], n1: V3 = [-Math.sin(a1), 0, -Math.cos(a1)];
    acc.quad([i0[0], y1, i0[2]], [i1[0], y1, i1[2]], [i1[0], y0, i1[2]], [i0[0], y0, i0[2]], n0, n1, n1, n0);
    if (o.floor) acc.tri([0, y0 + 0.001, 0], [i1[0], y0 + 0.001, i1[2]], [i0[0], y0 + 0.001, i0[2]], up);
  }
  // outer chamfered walls
  const walls: [number, number, number, number][] = [
    [hw, 0, 1, 0],
    [-hw, 0, -1, 0],
    [0, hw, 0, 1],
    [0, -hw, 0, -1],
  ];
  for (const [px, pz, nx, nz] of walls) {
    const tx = -nz, tz = nx;
    const A: V3 = [px + tx * hw, y1 - c, pz + tz * hw], B: V3 = [px - tx * hw, y1 - c, pz - tz * hw];
    const A0: V3 = [A[0], y0, A[2]], B0: V3 = [B[0], y0, B[2]];
    acc.quad(A, B, B0, A0, [nx, 0, nz]);
    const e = hw - c;
    const Ai: V3 = [px - nx * c + tx * e, y1, pz - nz * c + tz * e], Bi: V3 = [px - nx * c - tx * e, y1, pz - nz * c - tz * e];
    acc.quad(Ai, Bi, B, A, [nx * 0.7071, 0.7071, nz * 0.7071]);
  }
  return acc.done();
}

/**
 * A run of 1×2 grille tiles along X or Z. `x0,z0` = min corner, `len` studs long, `w` studs wide,
 * bottom `y0`. Each tile is a full-height frame (side rails, end caps) round square bars. The grooves
 * are deep enough to lie in their own shadow, so no shadow edge crawls across a groove floor, and
 * nothing inside the frame is bevelled (a bevel this small is a sub-pixel highlight that twinkles).
 */
export function grilleRun(b: Builder, baseKey: ColorKey, barKey: ColorKey, x0: number, z0: number, len: number, w: number, y0: number, alongZ: boolean, o: { bars?: number; tile?: number; hBody?: number } = {}): void {
  const tile = o.tile ?? 2;
  const hF = o.hBody ?? 0.14;
  const top = 0.396;
  const cap = 0.08;
  const nb = o.bars ?? 4 * w - 1;
  const bw = (w * 0.8) / (2 * nb - 1);
  const rail = 0.1 * w + bw;
  // u across the run, v along it, both from the min corner; tiles butt (see SEAM)
  const put = (key: ColorKey, u0: number, u1: number, v0: number, v1: number, ya: number, yb: number, c: number) => {
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    if (alongZ) b.box(key, x0 + cu, (ya + yb) / 2, z0 + cv, u1 - u0, yb - ya, v1 - v0, { c, hide: { ny: true } });
    else b.box(key, x0 + cv, (ya + yb) / 2, z0 + cu, v1 - v0, yb - ya, u1 - u0, { c, hide: { ny: true } });
  };
  for (let s = 0; s < len - 1e-6; s += tile) {
    const l = Math.min(tile, len - s);
    const v0 = s, v1 = s + l;
    if (nb < 2) {
      put(baseKey, 0, w, v0, v1, y0, y0 + top, 0.03);
      continue;
    }
    const ya = y0 + hF, yb = y0 + top;
    put(baseKey, 0, w, v0, v1, y0, ya, 0.03);
    put(baseKey, 0, rail, v0, v1, ya, yb, 0);
    put(baseKey, w - rail, w, v0, v1, ya, yb, 0);
    put(baseKey, rail, w - rail, v0, s + cap, ya, yb, 0);
    put(baseKey, rail, w - rail, s + l - cap, v1, ya, yb, 0);
    for (let k = 1; k < nb - 1; k++) {
      const u = 0.1 * w + k * 2 * bw;
      put(barKey, u, u + bw, s + cap, s + l - cap, ya, yb, 0);
    }
  }
}

/** 1×1 round tile / plate (radius 0.4 · s), base centre at (x, y, z), +Y up. */
export function roundTile(b: Builder, key: ColorKey, x: number, y: number, z: number, r = 0.38, h = 0.4, radial = 16): void {
  b.cyl(key, x, y + h / 2, z, r, h, { radial, c: 0.03, bottom: false });
}

const satinCache = new Map<string, MeshStandardMaterial>();

/**
 * LEGO's silver colours are pearlescent plastic, not metal: at the palette's 0.92 metalness a big
 * curved part (a droid dome) mirrors the black space sky and reads as black. Swap the given keys'
 * materials under `root` for one shared satin clone per key (diffuse body + metallic sheen).
 */
export function satin(root: Object3D, keys: ColorKey[]): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const src = m.material as MeshStandardMaterial;
    const key = keys.find((k) => src.name === `lego:${k}`);
    if (!key) return;
    let s = satinCache.get(key);
    if (!s) {
      s = src.clone();
      s.name = `lego:${key}:satin`;
      s.metalness = 0.45;
      s.roughness = 0.3;
      satinCache.set(key, s);
    }
    m.material = s;
  });
}

export const V = (x: number, y: number, z: number): V3 => [x, y, z];
export const mirX = (p: V3): V3 => [-p[0], p[1], p[2]];
export const lerp3 = (a: V3, c: V3, t: number): V3 => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];

// ——— LEGO part vocabulary ———
// Every helper below works in the builder's current frame with the part's "top" along local +Y, so
// the same calls dress a deck (identity frame) or a flank / raked face (inside `onFace`).

/**
 * Seam between neighbouring parts: each footprint is shrunk by this much per side. Zero: the two
 * chamfers alone make the groove (a few pixels wide at chase distance, lit on one side, shaded on
 * the other). Any real gap is a deep, sub-pixel black slit that blinks as it crosses pixel centres;
 * the butting walls it would expose are enclosed by the parts on either side.
 */
export const SEAM = 0;

/** Run `fn` with local +Y along the face normal `n` and local +Z along `f` (projected into the face), origin `o`. */
export function onFace(b: Builder, o: V3, n: V3, f: V3, fn: () => void): void {
  const y = new Vector3(...n).normalize();
  const z = new Vector3(...f);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new Vector3().crossVectors(y, z);
  b.push();
  b.apply(new Matrix4().makeBasis(x, y, z).setPosition(o[0], o[1], o[2]));
  fn();
  b.pop();
}

/** A plate / tile / brick with a convex footprint, shrunk by the seam; studs on the stud grid if asked. */
export function part(
  b: Builder,
  key: ColorKey,
  poly: P2[],
  y0: number,
  h: number,
  o: { studs?: ColorKey | boolean; seam?: number; c?: number; hideBottom?: boolean; gx?: number; gz?: number; margin?: number; skip?: (x: number, z: number) => boolean } = {},
): void {
  if (poly.length < 3 || Math.abs(area2(poly)) < 0.02) return;
  const s = o.seam ?? SEAM;
  layer(b, key, s > 0 ? inset(poly, s) : poly, y0, h, { c: o.c, hideBottom: o.hideBottom });
  if (o.studs) studsIn(b, o.studs === true ? key : o.studs, poly, y0 + h, { gx: o.gx, gz: o.gz, margin: o.margin, skip: o.skip });
}

/** Axis-aligned part over [x0, x1] × [z0, z1]. */
export function partR(b: Builder, key: ColorKey, x0: number, z0: number, x1: number, z1: number, y0: number, h: number, o: Parameters<typeof part>[5] = {}): void {
  part(b, key, rect(x0, z0, x1, z1), y0, h, o);
}

/** A footprint built from several parts: cut at the z (and x) lines, one part per piece. */
export function parts(b: Builder, key: ColorKey, poly: P2[], y0: number, h: number, cutsZ: number[] = [], cutsX: number[] = [], o: Parameters<typeof part>[5] = {}): void {
  for (const p of split(poly, cutsZ, cutsX)) part(b, key, p, y0, h, o);
}

/**
 * Printed / stickered detail: a thin convex patch on a surface at local height y. It is sunk 0.004
 * into the surface and stands `t` proud, so it never shares a plane with the part it is printed on.
 */
export function decal(b: Builder, key: ColorKey, poly: P2[], y: number, t = 0.014): void {
  if (poly.length < 3 || Math.abs(area2(poly)) < 1e-4) return;
  b.shape(key, poly, y - 0.004, t + 0.004, { c: Math.min(0.004, t * 0.3), hideBottom: true });
}

export function decalR(b: Builder, key: ColorKey, x0: number, z0: number, x1: number, z1: number, y: number, t?: number): void {
  decal(b, key, rect(x0, z0, x1, z1), y, t);
}

/** Printed disc (or ring when rIn > 0) at (x, y, z), local +Y up. */
export function decalDisc(b: Builder, key: ColorKey, x: number, y: number, z: number, r: number, o: { rIn?: number; t?: number; radial?: number } = {}): void {
  const t = o.t ?? 0.014;
  const n = o.radial ?? 20;
  if (o.rIn) b.add(key, tube(r, o.rIn, t + 0.004, 0.003, n), new Matrix4().makeTranslation(x, y + (t - 0.004) / 2, z));
  else b.cyl(key, x, y + (t - 0.004) / 2, z, r, t + 0.004, { radial: n, bottom: false, c: 0.003 });
}

/** Printed arc band between radii rIn..r over angles a0..a1 (θ = 0 → +Z, toward +X), as convex wedges. */
export function decalArc(b: Builder, key: ColorKey, x: number, y: number, z: number, rIn: number, r: number, a0: number, a1: number, o: { t?: number; steps?: number } = {}): void {
  const n = o.steps ?? Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.2));
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const P = (rr: number, t: number): P2 => [x + rr * Math.sin(t), z + rr * Math.cos(t)];
    decal(b, key, [P(rIn, t0), P(r, t0), P(r, t1), P(rIn, t1)], y, o.t);
  }
}

/** Diagonal bands of `key` printed across the rectangle (hazard stripes / chevrons). */
export function stripes(b: Builder, key: ColorKey, x0: number, z0: number, x1: number, z1: number, y: number, pitch = 0.32, o: { angle?: number; duty?: number; t?: number; phase?: number } = {}): void {
  const a = o.angle ?? Math.PI / 4;
  const dx = Math.cos(a), dz = Math.sin(a);
  const R = rect(x0, z0, x1, z1);
  const us = R.map(([x, z]) => x * dx + z * dz);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const w = pitch * (o.duty ?? 0.5);
  for (let u = u0 + pitch * (o.phase ?? 0.25) - pitch; u < u1; u += pitch) {
    let p = clipHalf(R, -dx, -dz, -u);
    p = clipHalf(p, dx, dz, u + w);
    if (p.length >= 3 && Math.abs(area2(p)) > 2e-3) decal(b, key, p, y, o.t);
  }
}

/** Parallel printed lines along z (n lines across [x0, x1]), e.g. a vent or radiator print. */
export function decalLines(b: Builder, key: ColorKey, x0: number, z0: number, x1: number, z1: number, y: number, n: number, duty = 0.45, alongZ = true, t?: number): void {
  const span = alongZ ? x1 - x0 : z1 - z0;
  const p = span / n;
  for (let i = 0; i < n; i++) {
    const a = (alongZ ? x0 : z0) + p * i + (p * (1 - duty)) / 2;
    if (alongZ) decalR(b, key, a, z0, a + p * duty, z1, y, t);
    else decalR(b, key, x0, a, x1, a + p * duty, y, t);
  }
}

/** Technic pin hole in a face (local +Y out of the face, surface at y): dark bore inside a moulded rim. */
export function pinHole(b: Builder, rimKey: ColorKey, x: number, y: number, z: number, o: { dark?: ColorKey; radial?: number } = {}): void {
  const n = o.radial ?? 16;
  b.add(rimKey, tube(0.37, 0.27, 0.05, 0.012, n), new Matrix4().makeTranslation(x, y + 0.015, z));
  b.cyl(o.dark ?? 'black', x, y + 0.001, z, 0.285, 0.022, { radial: n, bottom: false, c: 0.004 });
}

/** Technic pin seated in a hole: the collar and the slotted head stand `len` proud of the face. */
export function pinHead(b: Builder, key: ColorKey, x: number, y: number, z: number, o: { len?: number; radial?: number } = {}): void {
  const n = o.radial ?? 16;
  const L = o.len ?? 0.14;
  b.cyl(key, x, y + 0.03, z, 0.36, 0.08, { radial: n, bottom: false, c: 0.02 });
  b.cyl(key, x, y + L / 2 + 0.02, z, 0.28, L - 0.02, { radial: n, bottom: false, c: 0.03 });
}

/** Cross axle end standing `len` proud (the two arms at different heights so no faces coincide). */
export function axleEnd(b: Builder, key: ColorKey, x: number, y: number, z: number, len = 0.08, spin = 0): void {
  b.box(key, x, y + len / 2, z, 0.56, len, 0.19, { c: 0.02, rot: [0, spin, 0] });
  b.box(key, x, y + (len - 0.008) / 2, z, 0.19, len - 0.008, 0.56, { c: 0.02, rot: [0, spin, 0] });
}

/** 30° "cheese" slope, `w` wide (along local x after rotation) and `d` deep, low edge toward −z before `rotY`. */
export function cheese(b: Builder, key: ColorKey, x: number, y: number, z: number, rotY = 0, w = 1, d = 1, h = 0.267): void {
  const g = SEAM;
  b.push();
  b.translate(x, y, z);
  b.rotateY(rotY);
  b.rotateY(-Math.PI / 2);
  b.prism(key, [[-d / 2 + g, 0], [d / 2 - g, 0], [d / 2 - g, h], [-d / 2 + g, 0.035]], w - 2 * g, { c: 0.02 });
  b.pop();
}

/** Round 1×1 plate / tile (with stud if asked), base at y. */
export function roundPlate(b: Builder, key: ColorKey, x: number, y: number, z: number, o: { r?: number; h?: number; stud?: boolean; radial?: number } = {}): void {
  const h = o.h ?? 0.4;
  b.cyl(key, x, y + h / 2, z, o.r ?? 0.46, h, { radial: o.radial ?? 16, c: 0.03, bottom: false });
  if (o.stud) b.stud(key, x, y + h, z);
}

/** Flexible hose through control points (Catmull-Rom smoothed), closed ends. */
export function hose(b: Builder, key: ColorKey, pts: V3[], r = 0.12, o: { radial?: number; steps?: number } = {}): void {
  const n = o.steps ?? Math.max(4, pts.length * 5);
  const path: V3[] = [];
  for (let i = 0; i <= n; i++) path.push(catmull(pts, i / n));
  b.add(key, sweep(path, r, o.radial ?? 10));
}

/** Small round detail (bolt head / sensor) on a face: cylinder of radius r standing h proud of y. */
export function boss(b: Builder, key: ColorKey, x: number, y: number, z: number, r: number, h: number, radial = 12): void {
  b.cyl(key, x, y + h / 2 - 0.004, z, r, h + 0.004, { radial, bottom: false, c: Math.min(0.02, r * 0.25, h * 0.4) });
}
