import { Matrix3, Matrix4, Vector3 } from 'three';

/**
 * Brick primitives as flat triangle soups (position + normal). Every hard edge is a chamfer whose
 * normals blend from one face to the next, so 44 triangles read as a moulded brick with a rounded
 * edge that catches a highlight — the single most important cue that something is LEGO.
 */

export type V3 = [number, number, number];
export interface MeshData {
  pos: Float32Array;
  nrm: Float32Array;
}

export class MeshAcc {
  pos: number[] = [];
  nrm: number[] = [];

  tri(a: V3, b: V3, c: V3, na: V3, nb: V3 = na, nc: V3 = na): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const g2 = gx * gx + gy * gy + gz * gz;
    if (g2 < 1e-16) return;
    const sx = na[0] + nb[0] + nc[0], sy = na[1] + nb[1] + nc[1], sz = na[2] + nb[2] + nc[2];
    if (gx * sx + gy * sy + gz * sz < 0) {
      const t = b; b = c; c = t;
      const tn = nb; nb = nc; nc = tn;
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.nrm.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
  }

  quad(a: V3, b: V3, c: V3, d: V3, na: V3, nb: V3 = na, nc: V3 = na, nd: V3 = na): void {
    this.tri(a, b, c, na, nb, nc);
    this.tri(a, c, d, na, nc, nd);
  }

  append(md: MeshData, m?: Matrix4): void {
    if (!m) {
      for (let i = 0; i < md.pos.length; i++) this.pos.push(md.pos[i]);
      for (let i = 0; i < md.nrm.length; i++) this.nrm.push(md.nrm[i]);
      return;
    }
    const e = m.elements;
    const nm = new Matrix3().getNormalMatrix(m).elements;
    for (let i = 0; i < md.pos.length; i += 3) {
      const x = md.pos[i], y = md.pos[i + 1], z = md.pos[i + 2];
      this.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const a = md.nrm[i], b = md.nrm[i + 1], c = md.nrm[i + 2];
      let nx = nm[0] * a + nm[3] * b + nm[6] * c;
      let ny = nm[1] * a + nm[4] * b + nm[7] * c;
      let nz = nm[2] * a + nm[5] * b + nm[8] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      this.nrm.push(nx, ny, nz);
    }
  }

  done(): MeshData {
    return { pos: new Float32Array(this.pos), nrm: new Float32Array(this.nrm) };
  }
}

const cache = new Map<string, MeshData>();
export function cached(key: string, make: () => MeshData): MeshData {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

export function transformMD(md: MeshData, m: Matrix4): MeshData {
  const acc = new MeshAcc();
  acc.append(md, m);
  return acc.done();
}

export function mergeMD(list: MeshData[]): MeshData {
  const acc = new MeshAcc();
  for (const md of list) acc.append(md);
  return acc.done();
}

function signedArea(P: number[][]): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i], q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export interface PrismOpts {
  /** omit the +z cap */
  noFront?: boolean;
  /** omit the -z cap */
  noBack?: boolean;
  /** polygon edges whose flat wall is omitted (e.g. added separately in another colour) */
  skipWalls?: number[];
  /** only emit these walls (flat faces), nothing else */
  onlyWalls?: number[];
}

/**
 * Convex polygon (XY) extruded along Z (centred), with a rounded chamfer `c` on every edge.
 * Edge i runs from poly[i] to poly[i+1] (after CCW normalisation).
 */
export function prism(poly: number[][], depth: number, c: number, o: PrismOpts = {}): MeshData {
  let P = poly.map((p) => [p[0], p[1]]);
  if (signedArea(P) < 0) P = P.reverse();
  const n = P.length;
  const hz = depth / 2;
  let minEdge = Infinity;
  for (let i = 0; i < n; i++) minEdge = Math.min(minEdge, Math.hypot(P[(i + 1) % n][0] - P[i][0], P[(i + 1) % n][1] - P[i][1]));
  c = Math.max(0, Math.min(c, depth * 0.45, minEdge * 0.4));
  const N: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    N.push([dy / l, -dx / l]);
  }
  const Q: number[][] = [];
  for (let j = 0; j < n; j++) {
    const a = N[(j - 1 + n) % n], b = N[j];
    const k = Math.max(0.25, 1 + a[0] * b[0] + a[1] * b[1]);
    Q.push([P[j][0] - (c * (a[0] + b[0])) / k, P[j][1] - (c * (a[1] + b[1])) / k]);
  }
  const acc = new MeshAcc();
  const zc = hz - c;
  const skip = new Set(o.skipWalls ?? []);
  const only = o.onlyWalls ? new Set(o.onlyWalls) : null;
  for (let i = 0; i < n; i++) {
    if (skip.has(i) || (only && !only.has(i))) continue;
    const i1 = (i + 1) % n;
    const w0 = [Q[i][0] + N[i][0] * c, Q[i][1] + N[i][1] * c];
    const w1 = [Q[i1][0] + N[i][0] * c, Q[i1][1] + N[i][1] * c];
    const nn: V3 = [N[i][0], N[i][1], 0];
    acc.quad([w0[0], w0[1], -zc], [w1[0], w1[1], -zc], [w1[0], w1[1], zc], [w0[0], w0[1], zc], nn);
  }
  if (only) return acc.done();
  if (c > 0) {
    for (let j = 0; j < n; j++) {
      const a = N[(j - 1 + n) % n], b = N[j];
      const A = [Q[j][0] + a[0] * c, Q[j][1] + a[1] * c];
      const B = [Q[j][0] + b[0] * c, Q[j][1] + b[1] * c];
      const na: V3 = [a[0], a[1], 0], nb: V3 = [b[0], b[1], 0];
      acc.quad([A[0], A[1], -zc], [B[0], B[1], -zc], [B[0], B[1], zc], [A[0], A[1], zc], na, nb, nb, na);
      for (const s of [1, -1]) {
        if (s === 1 && o.noFront) continue;
        if (s === -1 && o.noBack) continue;
        const nz: V3 = [0, 0, s];
        acc.tri([A[0], A[1], s * zc], [B[0], B[1], s * zc], [Q[j][0], Q[j][1], s * hz], na, nb, nz);
      }
    }
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const w0 = [Q[i][0] + N[i][0] * c, Q[i][1] + N[i][1] * c];
      const w1 = [Q[i1][0] + N[i][0] * c, Q[i1][1] + N[i][1] * c];
      const nw: V3 = [N[i][0], N[i][1], 0];
      for (const s of [1, -1]) {
        if (s === 1 && o.noFront) continue;
        if (s === -1 && o.noBack) continue;
        const nz: V3 = [0, 0, s];
        acc.quad([w0[0], w0[1], s * zc], [w1[0], w1[1], s * zc], [Q[i1][0], Q[i1][1], s * hz], [Q[i][0], Q[i][1], s * hz], nw, nw, nz, nz);
      }
    }
  }
  for (const s of [1, -1]) {
    if (s === 1 && o.noFront) continue;
    if (s === -1 && o.noBack) continue;
    const nz: V3 = [0, 0, s];
    for (let j = 1; j < n - 1; j++) acc.tri([Q[0][0], Q[0][1], s * hz], [Q[j][0], Q[j][1], s * hz], [Q[j + 1][0], Q[j + 1][1], s * hz], nz);
  }
  return acc.done();
}

export interface BoxFaces {
  px?: boolean;
  nx?: boolean;
  py?: boolean;
  ny?: boolean;
  pz?: boolean;
  nz?: boolean;
}

/** Chamfered box centred on the origin. `hide` omits flat faces that can never be seen. */
export function box(w: number, h: number, d: number, c = 0.03, hide: BoxFaces = {}): MeshData {
  const key = `box|${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${c.toFixed(4)}|${JSON.stringify(hide)}`;
  return cached(key, () => {
    const skip: number[] = [];
    if (hide.ny) skip.push(0);
    if (hide.px) skip.push(1);
    if (hide.py) skip.push(2);
    if (hide.nx) skip.push(3);
    return prism(
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ],
      d,
      c,
      { skipWalls: skip, noFront: hide.pz, noBack: hide.nz },
    );
  });
}

/** One segment of a lathe profile: (r, y) endpoints with their (nr, ny) normals. */
export type ProfileSeg = [number, number, number, number, number, number, number, number];

/**
 * Profile from points ordered top → bottom along the outside. Vertex normals are averaged where
 * the turn is below `creaseDeg`, split otherwise.
 */
export function profile(points: number[][], creaseDeg = 35): ProfileSeg[] {
  const segN: number[][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dr = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([-dy / l, dr / l]);
  }
  const cosC = Math.cos((creaseDeg * Math.PI) / 180);
  const out: ProfileSeg[] = [];
  for (let i = 0; i < segN.length; i++) {
    let n0 = segN[i], n1 = segN[i];
    if (i > 0) {
      const p = segN[i - 1];
      if (p[0] * n0[0] + p[1] * n0[1] > cosC) {
        const s = [p[0] + n0[0], p[1] + n0[1]];
        const l = Math.hypot(s[0], s[1]) || 1;
        n0 = [s[0] / l, s[1] / l];
      }
    }
    if (i < segN.length - 1) {
      const q = segN[i + 1];
      if (q[0] * n1[0] + q[1] * n1[1] > cosC) {
        const s = [q[0] + n1[0], q[1] + n1[1]];
        const l = Math.hypot(s[0], s[1]) || 1;
        n1 = [s[0] / l, s[1] / l];
      }
    }
    const a = points[i], b = points[i + 1];
    out.push([a[0], a[1], n0[0], n0[1], b[0], b[1], n1[0], n1[1]]);
  }
  return out;
}

/** Rounded-chamfer cylinder profile (the stud / round-brick silhouette). */
export function cylProfile(r: number, h: number, c: number, o: { top?: boolean; bottom?: boolean; y0?: number } = {}): ProfileSeg[] {
  const top = o.top ?? true;
  const bottom = o.bottom ?? true;
  const y0 = o.y0 ?? -h / 2;
  const y1 = y0 + h;
  c = Math.min(c, r * 0.5, h * 0.45);
  const segs: ProfileSeg[] = [];
  if (top) {
    segs.push([0, y1, 0, 1, r - c, y1, 0, 1]);
    segs.push([r - c, y1, 0, 1, r, y1 - c, 1, 0]);
  }
  segs.push([r, top ? y1 - c : y1, 1, 0, r, bottom ? y0 + c : y0, 1, 0]);
  if (bottom) {
    segs.push([r, y0 + c, 1, 0, r - c, y0, 0, -1]);
    segs.push([r - c, y0, 0, -1, 0, y0, 0, -1]);
  }
  return segs;
}

/**
 * Revolve a profile around +Y. θ = 0 points at +Z (the "front"), increasing toward +X.
 */
export function lathe(segs: ProfileSeg[], radial = 24, theta0 = 0, thetaLen = Math.PI * 2): MeshData {
  const acc = new MeshAcc();
  for (let k = 0; k < radial; k++) {
    const ta = theta0 + (thetaLen * k) / radial;
    const tb = theta0 + (thetaLen * (k + 1)) / radial;
    const sa = Math.sin(ta), ca = Math.cos(ta), sb = Math.sin(tb), cb = Math.cos(tb);
    for (const s of segs) {
      const [r0, y0, nr0, ny0, r1, y1, nr1, ny1] = s;
      const p00: V3 = [r0 * sa, y0, r0 * ca];
      const p01: V3 = [r0 * sb, y0, r0 * cb];
      const p10: V3 = [r1 * sa, y1, r1 * ca];
      const p11: V3 = [r1 * sb, y1, r1 * cb];
      const n00: V3 = [nr0 * sa, ny0, nr0 * ca];
      const n01: V3 = [nr0 * sb, ny0, nr0 * cb];
      const n10: V3 = [nr1 * sa, ny1, nr1 * ca];
      const n11: V3 = [nr1 * sb, ny1, nr1 * cb];
      acc.quad(p00, p01, p11, p10, n00, n01, n11, n10);
    }
  }
  return acc.done();
}

export function cylinder(r: number, h: number, c = 0.03, radial = 24, o: { top?: boolean; bottom?: boolean } = {}): MeshData {
  const key = `cyl|${r.toFixed(4)}|${h.toFixed(4)}|${c.toFixed(4)}|${radial}|${o.top ?? 1}|${o.bottom ?? 1}`;
  return cached(key, () => lathe(cylProfile(r, h, c, o), radial));
}

/** Hollow tube (e.g. engine nozzle, round plate rim) with rounded rims. */
export function tube(rOut: number, rIn: number, h: number, c = 0.02, radial = 24): MeshData {
  const key = `tube|${rOut}|${rIn}|${h}|${c}|${radial}`;
  return cached(key, () => {
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
    return lathe(segs, radial);
  });
}

/** Sphere segment from polar angle phi0 to phi1 (0 = top). */
export function sphere(r: number, radial = 24, rings = 12, phi0 = 0, phi1 = Math.PI): MeshData {
  const key = `sph|${r}|${radial}|${rings}|${phi0}|${phi1}`;
  return cached(key, () => {
    const segs: ProfileSeg[] = [];
    for (let i = 0; i < rings; i++) {
      const a = phi0 + ((phi1 - phi0) * i) / rings;
      const b = phi0 + ((phi1 - phi0) * (i + 1)) / rings;
      segs.push([r * Math.sin(a), r * Math.cos(a), Math.sin(a), Math.cos(a), r * Math.sin(b), r * Math.cos(b), Math.sin(b), Math.cos(b)]);
    }
    return lathe(segs, radial);
  });
}

/**
 * Sweep a circle of varying radius along a polyline (parallel-transport frames). Ends are closed
 * with flat caps unless `open`.
 */
export function sweep(path: V3[], radius: number | ((u: number) => number), radial = 12, o: { open?: boolean } = {}): MeshData {
  const rf = typeof radius === 'number' ? () => radius : radius;
  const acc = new MeshAcc();
  const n = path.length;
  const T: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = new Vector3(...path[Math.max(0, i - 1)]);
    const b = new Vector3(...path[Math.min(n - 1, i + 1)]);
    T.push(b.sub(a).normalize());
  }
  const up = Math.abs(T[0].y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  let Nn = new Vector3().crossVectors(T[0], up).normalize();
  const frames: { N: Vector3; B: Vector3 }[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = new Vector3().crossVectors(T[i - 1], T[i]);
      const s = axis.length();
      if (s > 1e-6) {
        const ang = Math.asin(Math.min(1, s));
        Nn = Nn.clone().applyAxisAngle(axis.normalize(), ang);
      }
    }
    const B = new Vector3().crossVectors(T[i], Nn).normalize();
    frames.push({ N: Nn.clone(), B });
  }
  const ring = (i: number) => {
    const u = n > 1 ? i / (n - 1) : 0;
    const r = rf(u);
    const pts: V3[] = [];
    const nrm: V3[] = [];
    for (let k = 0; k <= radial; k++) {
      const t = (k / radial) * Math.PI * 2;
      const nx = frames[i].N.x * Math.cos(t) + frames[i].B.x * Math.sin(t);
      const ny = frames[i].N.y * Math.cos(t) + frames[i].B.y * Math.sin(t);
      const nz = frames[i].N.z * Math.cos(t) + frames[i].B.z * Math.sin(t);
      pts.push([path[i][0] + nx * r, path[i][1] + ny * r, path[i][2] + nz * r]);
      nrm.push([nx, ny, nz]);
    }
    return { pts, nrm };
  };
  let prev = ring(0);
  for (let i = 1; i < n; i++) {
    const cur = ring(i);
    for (let k = 0; k < radial; k++) acc.quad(prev.pts[k], prev.pts[k + 1], cur.pts[k + 1], cur.pts[k], prev.nrm[k], prev.nrm[k + 1], cur.nrm[k + 1], cur.nrm[k]);
    prev = cur;
  }
  if (!o.open) {
    for (const [i, s] of [[0, -1], [n - 1, 1]] as const) {
      const rr = ring(i);
      const c: V3 = [...path[i]] as V3;
      const tn: V3 = [T[i].x * s, T[i].y * s, T[i].z * s];
      for (let k = 0; k < radial; k++) acc.tri(c, rr.pts[k], rr.pts[k + 1], tn);
    }
  }
  return acc.done();
}

/** Point on a Catmull-Rom spline through pts at u ∈ [0, 1]. */
export function catmull(pts: V3[], u: number): V3 {
  const n = pts.length - 1;
  const x = Math.max(0, Math.min(0.99999, u)) * n;
  const i = Math.floor(x);
  const t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[Math.min(n, i + 1)], p3 = pts[Math.min(n, i + 2)];
  const out: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = p1[k], b = p2[k];
    const m1 = (b - p0[k]) * 0.5, m2 = (p3[k] - a) * 0.5;
    const t2 = t * t, t3 = t2 * t;
    out[k] = (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m2;
  }
  return out;
}

/** Slope-brick side profile in (depth, height) with the slope face as edge index 3. */
export function slopeProfile(depth: number, height: number, flatBack: number, lip = 0.2): number[][] {
  // (0,0) front-bottom → (depth,0) back-bottom → (depth,height) back-top → (depth-flatBack,height) → (0,lip)
  return [
    [0, 0],
    [depth, 0],
    [depth, height],
    [depth - flatBack, height],
    [0, lip],
  ];
}

export const tmpM = new Matrix4();
