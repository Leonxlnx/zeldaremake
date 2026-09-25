import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { Builder } from '../core/builder';
import { MeshAcc, box, cylinder, lathe, profile, sphere, type BoxFaces, type MeshData, type ProfileSeg, type V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';

/**
 * Shared helpers for asset agent C (droid fighters, missile, buzz droid, battle droid): rig
 * pivots, oriented parts, rods between points, studs clipped to wedge-plate footprints.
 */

export interface Tally {
  tris: number;
  calls: number;
}
export const newTally = (): Tally => ({ tris: 0, calls: 0 });

/** Merge a builder into a named group, parent it and count its triangles / draw calls. */
export function emit(b: Builder, name: string, parent: Object3D | null, tally?: Tally): Group {
  const built = b.build(name);
  if (tally) {
    tally.tris += built.triangles;
    tally.calls += built.parts.length;
  }
  parent?.add(built.group);
  return built.group;
}

export function pivot(name: string, parent: Object3D, x = 0, y = 0, z = 0): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** Placement matrix: local +Z → dir, local +Y → up (orthogonalised), origin at c. */
export function frame(c: V3, dir: V3, up: V3 = [0, 1, 0]): Matrix4 {
  const z = new Vector3(dir[0], dir[1], dir[2]).normalize();
  let u = new Vector3(up[0], up[1], up[2]);
  const x = new Vector3().crossVectors(u, z);
  if (x.lengthSq() < 1e-9) {
    u = Math.abs(z.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    x.crossVectors(u, z);
  }
  x.normalize();
  const y = new Vector3().crossVectors(z, x);
  const m = new Matrix4().makeBasis(x, y, z);
  m.setPosition(c[0], c[1], c[2]);
  return m;
}

const Y_TO_Z = new Matrix4().makeRotationX(Math.PI / 2);

/** Unchamfered cylinder (side + caps only) for chamfer-free LOD builders. */
function plainCylinder(r: number, h: number, radial: number, top = true, bottom = true): MeshData {
  const y1 = h / 2, y0 = -h / 2;
  const segs: ProfileSeg[] = [];
  if (top) segs.push([0, y1, 0, 1, r, y1, 0, 1]);
  segs.push([r, y1, 1, 0, r, y0, 1, 0]);
  if (bottom) segs.push([r, y0, 0, -1, 0, y0, 0, -1]);
  return lathe(segs, radial);
}

/** Round rod (bar, barrel, piston, strut) from a to c. */
export function rod(b: Builder, key: ColorKey, a: V3, c: V3, r: number, o: { radial?: number; ch?: number; top?: boolean; bottom?: boolean; tint?: number } = {}): void {
  const d: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  if (len < 1e-5) return;
  const ch = o.ch ?? Math.min(b.chamfer, 0.03, r * 0.25);
  const md = ch > 0 ? cylinder(r, len, ch, o.radial ?? 8, { top: o.top, bottom: o.bottom }) : plainCylinder(r, len, o.radial ?? 8, o.top, o.bottom);
  const m = frame([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], d).multiply(Y_TO_Z);
  b.add(key, md, m, { tint: o.tint });
}

/** Chamfered box with an arbitrary orientation (local Z along dir, Y along up). */
export function boxAt(b: Builder, key: ColorKey, c: V3, dir: V3, up: V3, w: number, h: number, d: number, o: { c?: number; hide?: BoxFaces } = {}): void {
  b.add(key, box(w, h, d, o.c ?? b.chamfer, o.hide ?? {}), frame(c, dir, up));
}

/** Cone from a base disc (radius r, centred at `base`) to a point at `tip`. */
export function cone(b: Builder, key: ColorKey, base: V3, tip: V3, r: number, radial = 8): void {
  const d: V3 = [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]];
  const h = Math.hypot(d[0], d[1], d[2]);
  if (h < 1e-5) return;
  b.add(key, lathe(profile([[0, h], [r, 0], [0, 0]], 30), radial), frame(base, d).multiply(Y_TO_Z));
}

/** Sphere (ball joint, knob) at c. */
export function ball(b: Builder, key: ColorKey, c: V3, r: number, radial = 10, rings = 6): void {
  b.add(key, sphere(r, radial, rings), new Matrix4().makeTranslation(c[0], c[1], c[2]));
}

/** Cylinder whose axis is an arbitrary direction, centred at c. */
export function cylAt(b: Builder, key: ColorKey, c: V3, dir: V3, r: number, h: number, o: { radial?: number; ch?: number; top?: boolean; bottom?: boolean } = {}): void {
  const n = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const hd = h / 2 / n;
  rod(b, key, [c[0] - dir[0] * hd, c[1] - dir[1] * hd, c[2] - dir[2] * hd], [c[0] + dir[0] * hd, c[1] + dir[1] * hd, c[2] + dir[2] * hd], r, o);
}

/** Signed distance of (x, z) inside a convex polygon (positive inside). */
export function insideDist(poly: number[][], x: number, z: number): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  const s = area >= 0 ? 1 : -1;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const ex = q[0] - p[0], ez = q[1] - p[1];
    const l = Math.hypot(ex, ez) || 1;
    // inward normal for CCW (in x→z orientation) is (-ez, ex)
    const nx = (-ez / l) * s, nz = (ex / l) * s;
    d = Math.min(d, (x - p[0]) * nx + (z - p[1]) * nz);
  }
  return d;
}

/**
 * Studs on a 1-stud grid (centres at ox + i, oz + j) wherever the whole stud fits inside a convex
 * footprint (local XZ) — the look of a wedge plate's exposed studs. Returns the count.
 */
export function studsIn(b: Builder, key: ColorKey, poly: number[][], y: number, o: { ox?: number; oz?: number; margin?: number; keep?: (x: number, z: number) => boolean; max?: number } = {}): number {
  const m = o.margin ?? 0.33;
  const ox = o.ox ?? 0.5, oz = o.oz ?? 0.5;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of poly) {
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    z0 = Math.min(z0, p[1]);
    z1 = Math.max(z1, p[1]);
  }
  let n = 0;
  for (let x = ox + Math.ceil(x0 - ox); x <= x1; x += 1) {
    for (let z = oz + Math.ceil(z0 - oz); z <= z1; z += 1) {
      if (o.max !== undefined && n >= o.max) return n;
      if (insideDist(poly, x, z) < m) continue;
      if (o.keep && !o.keep(x, z)) continue;
      b.stud(key, x, y, z);
      n++;
    }
  }
  return n;
}

/** Drop consecutive near-duplicate points (a quad whose side collapsed becomes a triangle). */
export function clean(poly: number[][], eps = 0.02): number[][] {
  const out: number[][] = [];
  for (const p of poly) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > eps) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= eps) out.pop();
  return out;
}

/** Linear interpolation in a table of rows keyed by column 0. */
export function lerpTable(rows: number[][], u: number): number[] {
  if (u <= rows[0][0]) return rows[0].slice(1);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1];
    if (u <= c[0]) {
      const t = (u - a[0]) / (c[0] - a[0] || 1);
      return a.slice(1).map((v, k) => v + (c[k + 1] - v) * t);
    }
  }
  return rows[rows.length - 1].slice(1);
}

/**
 * Loft through rings of points (every ring has the same count, same winding, closed loop) with
 * smooth normals and fan caps at both ends. `pick(ring, seg)` sorts each quad into an output
 * bucket (e.g. a painted marking); returns one MeshData per bucket index.
 */
export function loft(rings: V3[][], o: { caps?: boolean; pick?: (ring: number, seg: number) => number; buckets?: number } = {}): MeshData[] {
  const nb = o.buckets ?? 1;
  const acc = Array.from({ length: nb }, () => new MeshAcc());
  const nr = rings.length, n = rings[0].length;
  const P = (i: number, j: number) => rings[Math.max(0, Math.min(nr - 1, i))][((j % n) + n) % n];
  const cen = rings.map((r) => r.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0] as V3));
  const N: V3[][] = [];
  for (let i = 0; i < nr; i++) {
    const row: V3[] = [];
    for (let j = 0; j < n; j++) {
      const a = P(i + 1, j), b = P(i - 1, j), c = P(i, j + 1), d = P(i, j - 1);
      const u = new Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const v = new Vector3(c[0] - d[0], c[1] - d[1], c[2] - d[2]);
      const nn = new Vector3().crossVectors(v, u).normalize();
      const p = P(i, j), cc = cen[i];
      if (nn.x * (p[0] - cc[0]) + nn.y * (p[1] - cc[1]) + nn.z * (p[2] - cc[2]) < 0) nn.negate();
      row.push([nn.x, nn.y, nn.z]);
    }
    N.push(row);
  }
  for (let i = 0; i < nr - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = o.pick ? o.pick(i, j) : 0;
      acc[k].quad(P(i, j), P(i, j + 1), P(i + 1, j + 1), P(i + 1, j), N[i][j], N[i][(j + 1) % n], N[i + 1][(j + 1) % n], N[i + 1][j]);
    }
  }
  if (o.caps ?? true) {
    for (const [i, inner] of [[0, 1], [nr - 1, nr - 2]] as const) {
      const c = cen[i], q = cen[inner];
      const d = new Vector3(c[0] - q[0], c[1] - q[1], c[2] - q[2]).normalize();
      const nrm: V3 = [d.x, d.y, d.z];
      for (let j = 0; j < n; j++) acc[0].tri(c, P(i, j), P(i, j + 1), nrm);
    }
  }
  return acc.map((a) => a.done());
}

/**
 * C-shaped ring (minifig hand, clip) around local +Y: a rounded tube section swept from theta0
 * over thetaLen (lathe angles: 0 = +Z, π/2 = +X) with flat caps on the cut ends.
 */
export function cRing(rOut: number, rIn: number, h: number, theta0: number, thetaLen: number, radial = 12, c = 0.02): MeshData {
  const y1 = h / 2, y0 = -h / 2;
  c = Math.min(c, (rOut - rIn) * 0.4, h * 0.4);
  const segs: ProfileSeg[] = [
    [rIn, y1 - c, -1, 0, rIn + c, y1, 0, 1],
    [rIn + c, y1, 0, 1, rOut - c, y1, 0, 1],
    [rOut - c, y1, 0, 1, rOut, y1 - c, 1, 0],
    [rOut, y1 - c, 1, 0, rOut, y0 + c, 1, 0],
    [rOut, y0 + c, 1, 0, rOut - c, y0, 0, -1],
    [rOut - c, y0, 0, -1, rIn + c, y0, 0, -1],
    [rIn + c, y0, 0, -1, rIn, y0 + c, -1, 0],
    [rIn, y0 + c, -1, 0, rIn, y1 - c, -1, 0],
  ];
  const acc = new MeshAcc();
  acc.append(lathe(segs, radial, theta0, thetaLen));
  const sec = [[rIn, y1 - c], [rIn + c, y1], [rOut - c, y1], [rOut, y1 - c], [rOut, y0 + c], [rOut - c, y0], [rIn + c, y0], [rIn, y0 + c]];
  for (const [th, sg] of [[theta0, -1], [theta0 + thetaLen, 1]]) {
    const s = Math.sin(th), co = Math.cos(th);
    const n: V3 = [sg * co, 0, -sg * s];
    const pts = sec.map(([r, y]): V3 => [r * s, y, r * co]);
    for (let k = 1; k < pts.length - 1; k++) acc.tri(pts[0], pts[k], pts[k + 1], n);
  }
  return acc.done();
}

/** Lathe from plain (r, y) points ordered top → bottom (see geom.profile). */
export function lathePts(b: Builder, key: ColorKey, pts: number[][], o: { radial?: number; at?: V3; axis?: 'x' | 'y' | 'z'; theta0?: number; thetaLen?: number; crease?: number } = {}): void {
  b.lathe(key, profile(pts, o.crease ?? 35), { radial: o.radial, at: o.at, axis: o.axis, theta0: o.theta0, thetaLen: o.thetaLen });
}

export const smooth = (x: number) => x * x * (3 - 2 * x);
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const DEG = Math.PI / 180;
