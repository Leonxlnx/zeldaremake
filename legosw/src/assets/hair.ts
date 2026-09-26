import { BufferAttribute, BufferGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three';
import { MATERIAL_QUALITY, plasticRoughnessTexture, swatch, type ColorKey } from '../core/palette';
import { Rng } from '../core/rng';

/**
 * Sculpted minifig hair pieces, built the way the moulded parts are designed: a hollow shell that
 * hugs the head at a fixed clearance (nothing pokes through, nothing gaps) with a thick rounded rim,
 * carrying chunky locks as real geometry. Each lock is a rounded strand bundle with incised strand
 * grooves, swept over the shell from its root (the parting, the hairline or the crown) to a pointed
 * tip that overhangs the hem and flicks outward. Where locks meet they intersect in crisp V-grooves,
 * so the glossy highlights break along the strands like on the real plastic.
 *
 * Head frame: y = 0 at the neck, head top at 1.08 (stud to 1.30), head radius 0.6, face toward +Z,
 * +X = the figure's left. Lock paths are drawn in a "crown chart": (X, Z) = σ·(sin θ, cos θ), where
 * σ is the arc length over the head from the top centre and θ the azimuth (0 = the face).
 */

export type V2 = [number, number];

export interface LockSpec {
  /** path in the crown chart, root → tip (Catmull-Rom through the points) */
  pts: V2[];
  /** half-width (head units) */
  w: number;
  /** height of the rounded top above its base level */
  h: number;
  /** base level above the shell: upper layers sit on the locks below */
  layer?: number;
  /** outward lift of the tip */
  curl?: number;
  /** incised strand grooves along the lock */
  grooves?: 0 | 1 | 2 | 3;
  /** fraction of the length that tapers into the tip */
  tip?: number;
  /**
   * blunt rounded root (at a parting), a long taper (tucked under other locks), or a roll: the
   * rounded nose curls down onto the head (a hairline swept up and back)
   */
  root?: 'blunt' | 'taper' | 'roll';
  /** extra height through the middle of the lock (a rolled quiff) */
  arch?: number;
  /** lateral wave along the lock: amplitude, wavelength (arc length), phase (rad) */
  wave?: [number, number, number];
}

export interface LockKit {
  /** σ of the shell hem at an azimuth (deg) */
  hem(deg: number): number;
  /** chart point at azimuth deg, arc distance s from the top centre */
  at(deg: number, s: number): V2;
  /** chart point `ext` beyond the hem at azimuth deg */
  beyond(deg: number, ext: number): V2;
  /**
   * A combed strand from `p`: the circular arc through the poles F and B (a bipolar flow field, so
   * neighbouring strands run side by side), followed toward B until `ext` beyond the hem or `len` long.
   */
  flow(p: V2, F: V2, B: V2, opt?: { ext?: number; len?: number }): V2[];
  rng: Rng;
}

export interface HairSpec {
  key: ColorKey;
  /** exact moulding colour (defaults to the palette key's) */
  hex?: number;
  /** shell hem height by azimuth: [|deg|, y] from the face (0) round to the back (180) */
  hem: V2[];
  /** shell wall over the crown and at the sides */
  crownT: number;
  sideT: number;
  /** the crown wall holds crownT out to arc s0 and eases to sideT by s1 (default [0, 0.95]) */
  dome?: V2;
  /** outward flare of the wall toward a long hem, and how far a long hem hangs off the head */
  flare: number;
  hang: number;
  /** extra wall toward the back (fraction) */
  backVol: number;
  /** parting groove along a chart segment */
  part?: { a: V2; b: V2; depth: number; width: number };
  /** raised volume around a chart point (quiff) */
  lift?: { at: V2; r: number; h: number };
  locks: (k: LockKit) => LockSpec[];
  seed: number;
}

/* ------------------------------------------------------------------ the shell */

const HEAD_R = 0.6;
const HEAD_RC = 0.13;
const HEAD_TOP = 1.08;
const CLEAR = 0.012;
const R0 = HEAD_R - HEAD_RC;
const RC = HEAD_RC + CLEAR;
const YC = HEAD_TOP - HEAD_RC;
const S1 = R0;
const S2 = R0 + (Math.PI / 2) * RC;
const STUD_COVER = 1.3 + 0.03 - (HEAD_TOP + CLEAR);
const DEG = Math.PI / 180;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** the clearance surface around the head (stud ignored — it sits inside the wall): (r, y, nr, ny) at arc length s from the top */
function profile(s: number): [number, number, number, number] {
  if (s <= S1) return [s, HEAD_TOP + CLEAR, 0, 1];
  if (s <= S2) {
    const a = (s - S1) / RC;
    const sa = Math.sin(a), ca = Math.cos(a);
    return [R0 + RC * sa, YC + RC * ca, sa, ca];
  }
  return [HEAD_R + CLEAR, YC - (s - S2), 1, 0];
}

function sOfY(y: number): number {
  if (y <= YC) return S2 + (YC - y);
  return S1 + RC * Math.acos(Math.max(-1, Math.min(1, (y - YC) / RC)));
}

/** monotone cubic through (xs, ys), flat at both ends (the hem is mirror-symmetric) */
function monotone(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

interface Samp {
  /** clearance-surface point */
  x: number;
  y: number;
  z: number;
  /** its outward normal */
  nx: number;
  ny: number;
  nz: number;
  /** wall thickness here */
  t: number;
  /** arc length from the top, and the hem's arc length at this azimuth */
  s: number;
  sh: number;
}

class Shell {
  private hemY: (deg: number) => number;
  /** cut the parting groove into the wall (off while placing locks, so they ride over it) */
  carve = true;
  constructor(readonly spec: HairSpec) {
    this.hemY = monotone(
      spec.hem.map((h) => h[0]),
      spec.hem.map((h) => h[1]),
    );
  }
  hemS(deg: number): number {
    return sOfY(this.hemY(Math.abs(deg)));
  }
  sample(X: number, Z: number, o: Samp): Samp {
    const sp = this.spec;
    const s = Math.hypot(X, Z);
    const sn = s > 1e-9 ? X / s : 0, cs = s > 1e-9 ? Z / s : 1;
    const deg = Math.atan2(sn, cs) / DEG;
    const [r, y, nr, ny] = profile(s);
    const sh = this.hemS(deg);
    const long = smooth(0.95, 1.35, sh);
    const f = smooth(sh - 0.6, sh, s);
    const hang = sp.hang * long * f * f;
    const ri = r + nr * hang, yi = y + ny * hang;
    // domed crown: the wall thins from the top centre toward the sides
    const [d0, d1] = sp.dome ?? [0, 0.95];
    const dq = Math.max(0, Math.min(1, (s - d0) / (d1 - d0)));
    let t = sp.sideT + (sp.crownT - sp.sideT) * 0.5 * (1 + Math.cos(Math.PI * dq));
    t *= 1 + sp.backVol * 0.5 * (1 - cs) * smooth(0.15, 0.6, s);
    t += sp.flare * long * f * f;
    if (sp.lift) {
      const dx = X - sp.lift.at[0], dz = Z - sp.lift.at[1];
      t += sp.lift.h * Math.exp(-(dx * dx + dz * dz) / (sp.lift.r * sp.lift.r));
    }
    if (sp.part && this.carve) {
      const { a, b, depth, width } = sp.part;
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const u = ((X - a[0]) * ex + (Z - a[1]) * ez) / (ex * ex + ez * ez);
      const uc = Math.max(0, Math.min(1, u));
      const px = a[0] + uc * ex - X, pz = a[1] + uc * ez - Z;
      t -= depth * Math.exp(-(px * px + pz * pz) / (width * width)) * smooth(-0.12, 0.04, u) * (1 - smooth(0.96, 1.12, u));
    }
    // the wall must enclose the top stud (r 0.3, up to y 1.30): smooth max with a floor over it
    const over = 1 - smooth(0.3, 0.5, s);
    const floor = STUD_COVER * over;
    t = 0.5 * (t + floor + Math.sqrt((t - floor) * (t - floor) + 0.0009 * over * over));
    o.x = ri * sn;
    o.y = yi;
    o.z = ri * cs;
    o.nx = nr * sn;
    o.ny = ny;
    o.nz = nr * cs;
    o.t = t;
    o.s = s;
    o.sh = sh;
    return o;
  }
  /** outer wall surface point at a chart position, raised `e` along the wall normal */
  point(X: number, Z: number, e: number, o: Samp, out: number[]): void {
    this.sample(X, Z, o);
    const k = o.t + e;
    out[0] = o.x + o.nx * k;
    out[1] = o.y + o.ny * k;
    out[2] = o.z + o.nz * k;
  }
}

/* ------------------------------------------------------------------ mesh assembly */

class Acc {
  pos: number[] = [];
  idx: number[] = [];
  get n(): number {
    return this.pos.length / 3;
  }
  v(x: number, y: number, z: number): number {
    this.pos.push(x, y, z);
    return this.n - 1;
  }
  /** front-facing quad a-b-c-d given in the order (a, d, c, b) is counter-clockwise from outside */
  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, d, c, a, c, b);
  }
}

const tmpS: Samp = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, t: 0, s: 0, sh: 0 };
const tmpP = [0, 0, 0];

/** The moulded wall: outer surface from the crown to the hem, a rounded rim, the inner surface back up. */
function buildShell(sh: Shell, NT: number, NO: number, NI: number, acc: Acc): void {
  const o = tmpS;
  const P = tmpP;
  const cols: { X: number; Z: number; sh: number }[] = [];
  for (let i = 0; i < NT; i++) {
    const deg = -180 + (360 * i) / NT;
    cols.push({ X: Math.sin(deg * DEG), Z: Math.cos(deg * DEG), sh: sh.hemS(deg) });
  }
  const rings: number[][] = [];
  sh.point(0, 0, 0, o, P);
  const pole = acc.v(P[0], P[1], P[2]);
  rings.push(new Array(NT).fill(pole));
  for (let j = 1; j <= NO; j++) {
    const ring: number[] = [];
    const q = j / NO;
    const f = 0.55 * q + 0.45 * Math.sin((q * Math.PI) / 2);
    for (const c of cols) {
      const s = c.sh * f;
      sh.point(c.X * s, c.Z * s, 0, o, P);
      ring.push(acc.v(P[0], P[1], P[2]));
    }
    rings.push(ring);
  }
  // rounded lip: from the outer hem edge down round to the inner edge
  const lipB = [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
  for (const b of lipB) {
    const ring: number[] = [];
    for (const c of cols) {
      sh.sample(c.X * c.sh, c.Z * c.sh, o);
      const px = o.x, py = o.y, pz = o.z, nx = o.nx, ny = o.ny, nz = o.nz, t = o.t;
      sh.sample(c.X * (c.sh + 0.01), c.Z * (c.sh + 0.01), o);
      let dx = o.x - px, dy = o.y - py, dz = o.z - pz;
      const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l;
      dy /= l;
      dz /= l;
      const a = (t * (1 + Math.cos(b))) / 2, d = t * 0.36 * Math.sin(b);
      ring.push(acc.v(px + nx * a + dx * d, py + ny * a + dy * d, pz + nz * a + dz * d));
    }
    rings.push(ring);
  }
  for (let j = NI; j >= 1; j--) {
    const ring: number[] = [];
    const q = j / NI;
    for (const c of cols) {
      const s = c.sh * q;
      sh.sample(c.X * s, c.Z * s, o);
      ring.push(acc.v(o.x, o.y, o.z));
    }
    rings.push(ring);
  }
  sh.sample(0, 0, o);
  const ipole = acc.v(o.x, o.y, o.z);
  rings.push(new Array(NT).fill(ipole));
  for (let j = 0; j < rings.length - 1; j++) {
    const A = rings[j], B = rings[j + 1];
    for (let i = 0; i < NT; i++) {
      const i1 = (i + 1) % NT;
      const a = A[i], b = A[i1], c = B[i1], d = B[i];
      if (a === b) acc.idx.push(a, d, c);
      else if (c === d) acc.idx.push(a, d, b);
      else acc.quad(a, b, c, d);
    }
  }
}

function catmull2(p: V2[], u: number): V2 {
  const n = p.length - 1;
  const x = Math.max(0, Math.min(0.99999, u)) * n;
  const i = Math.floor(x), t = x - i;
  const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[Math.min(n, i + 1)], p3 = p[Math.min(n, i + 2)];
  const t2 = t * t, t3 = t2 * t;
  const f = (k: 0 | 1) => {
    const m1 = (p2[k] - p0[k]) * 0.5, m2 = (p3[k] - p1[k]) * 0.5;
    return (2 * t3 - 3 * t2 + 1) * p1[k] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[k] + (t3 - t2) * m2;
  };
  return [f(0), f(1)];
}

const PROF_P = 2.4;
const topProf = (x: number) => {
  const a = Math.abs(x);
  return a >= 1 ? 0 : Math.pow(1 - Math.pow(a, PROF_P), 1 / PROF_P);
};
const BOTTOM_X = [0.8, 0.35, -0.35, -0.8];
/** lock rings: base pitch along the lock, the most it may turn per ring (rad), and a cap */
const RING_PITCH = 0.075;
const RING_BEND = 0.13;
const RINGS_MAX = 44;

function sectionXs(grooves: number): { xs: number[]; gs: number[] } {
  const gs = grooves === 1 ? [0.04] : grooves === 2 ? [-0.34, 0.38] : grooves === 3 ? [-0.52, 0.02, 0.54] : [];
  const base = [-1, -0.95, -0.85, -0.68, -0.46, -0.22, 0, 0.22, 0.46, 0.68, 0.85, 0.95, 1];
  const xs = base.filter((x) => gs.every((g) => Math.abs(x - g) > 0.1));
  for (const g of gs) xs.push(g - 0.075, g, g + 0.075);
  xs.sort((a, b) => a - b);
  return { xs, gs };
}

/** One sculpted lock swept over the shell. */
function buildLock(L: LockSpec, sh: Shell, acc: Acc, jitter: number): void {
  const o = tmpS;
  const P = [0, 0, 0];
  // arc-length parametrised path
  const NSMP = 96;
  const chart: V2[] = [];
  const p3: number[][] = [];
  const cum: number[] = [0];
  for (let k = 0; k <= NSMP; k++) {
    const c = catmull2(L.pts, k / NSMP);
    chart.push(c);
    sh.point(c[0], c[1], 0, o, P);
    if (k > 0) cum.push(cum[k - 1] + Math.hypot(P[0] - p3[k - 1][0], P[1] - p3[k - 1][1], P[2] - p3[k - 1][2]));
    p3.push([P[0], P[1], P[2]]);
  }
  const len = cum[NSMP];
  const chartAt = (arc: number): V2 => {
    let k = 1;
    while (k < NSMP && cum[k] < arc) k++;
    const f = (arc - cum[k - 1]) / Math.max(1e-9, cum[k] - cum[k - 1]);
    return [chart[k - 1][0] + (chart[k][0] - chart[k - 1][0]) * f, chart[k - 1][1] + (chart[k][1] - chart[k - 1][1]) * f];
  };
  const roll = L.root === 'roll';
  const us = L.root === 'taper' ? 0.3 : roll ? Math.min(0.2, 0.12 / len) : 0.07;
  const ut = 1 - (L.tip ?? 0.32);
  // ring spacing: a base pitch, finer through the root and the tip and wherever the path bends
  const bend = p3.map((q, k) => {
    if (k === 0 || k === NSMP) return 0;
    const a = p3[k - 1], b = p3[k + 1];
    const ax = q[0] - a[0], ay = q[1] - a[1], az = q[2] - a[2];
    const bx = b[0] - q[0], by = b[1] - q[1], bz = b[2] - q[2];
    const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
    const c = (ax * bx + ay * by + az * bz) / (la * lb || 1);
    return Math.acos(Math.max(-1, Math.min(1, c))) / (0.5 * (la + lb) || 1);
  });
  const rootLen = us * len, tipLen = (1 - ut) * len;
  const density = (k: number) => {
    const a = cum[k];
    const kap = (bend[Math.max(0, k - 1)] + 2 * bend[k] + bend[Math.min(NSMP, k + 1)]) / 4;
    const rootD = L.root === 'taper' ? 0 : (4 / rootLen) * (1 - smooth(rootLen, 1.5 * rootLen, a));
    const tipD = (6 / tipLen) * smooth(len - 1.15 * tipLen, len - tipLen, a);
    return Math.max(1 / RING_PITCH, rootD, tipD, kap / RING_BEND);
  };
  const phi = [0];
  for (let k = 1; k <= NSMP; k++) phi.push(phi[k - 1] + 0.5 * (density(k - 1) + density(k)) * (cum[k] - cum[k - 1]));
  const N = Math.max(8, Math.min(RINGS_MAX, Math.round(phi[NSMP])));
  const layer = (L.layer ?? 0) + jitter;
  const H = L.h;
  const curl = L.curl ?? 0;
  const arch = L.arch ?? 0;
  const { xs, gs } = sectionXs(L.grooves ?? 2);
  const nTop = xs.length;
  const loop = nTop + BOTTOM_X.length;
  // shallow, soft strand grooves: the lock reads as one moulded mass, the V where locks meet carries the sculpt
  const groove = (x: number) => {
    let g = 0;
    for (const c of gs) g += Math.exp(-Math.pow((x - c) / 0.075, 2));
    return g;
  };
  // ring centres
  const U: number[] = [];
  let C: V2[] = [];
  const centres = () =>
    C.map(([x, z]) => {
      sh.point(x, z, 0, o, P);
      return [P[0], P[1], P[2]];
    });
  for (let i = 0, k = 1; i <= N; i++) {
    const target = (i / N) * phi[NSMP];
    while (k < NSMP && phi[k] < target) k++;
    const f = (target - phi[k - 1]) / Math.max(1e-9, phi[k] - phi[k - 1]);
    const arc = cum[k - 1] + (cum[k] - cum[k - 1]) * Math.max(0, Math.min(1, f));
    U.push(arc / len);
    C.push(chartAt(arc));
  }
  let Pc = centres();
  const eps = 1e-3;
  const pa = [0, 0, 0], pb = [0, 0, 0];
  /** chart offset per unit of lateral (N × T) distance at ring i: least squares through the chart Jacobian */
  const lateral = (i: number): V2 => {
    const [cx, cz] = C[i];
    const Pn = Pc[Math.min(N, i + 1)], Pp = Pc[Math.max(0, i - 1)];
    let tx = Pn[0] - Pp[0], ty = Pn[1] - Pp[1], tz = Pn[2] - Pp[2];
    sh.point(cx + eps, cz, 0, o, pa);
    sh.point(cx - eps, cz, 0, o, pb);
    const ax = (pa[0] - pb[0]) / (2 * eps), ay = (pa[1] - pb[1]) / (2 * eps), az = (pa[2] - pb[2]) / (2 * eps);
    sh.point(cx, cz + eps, 0, o, pa);
    sh.point(cx, cz - eps, 0, o, pb);
    const bx = (pa[0] - pb[0]) / (2 * eps), by = (pa[1] - pb[1]) / (2 * eps), bz = (pa[2] - pb[2]) / (2 * eps);
    let nx = by * az - bz * ay, ny = bz * ax - bx * az, nz = bx * ay - by * ax;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const tn = tx * nx + ty * ny + tz * nz;
    tx -= nx * tn;
    ty -= ny * tn;
    tz -= nz * tn;
    let lx = ny * tz - nz * ty, ly = nz * tx - nx * tz, lz = nx * ty - ny * tx;
    const ll = Math.hypot(lx, ly, lz) || 1;
    lx /= ll;
    ly /= ll;
    lz /= ll;
    const aa = ax * ax + ay * ay + az * az, ab = ax * bx + ay * by + az * bz, bb = bx * bx + by * by + bz * bz;
    const la = ax * lx + ay * ly + az * lz, lb = bx * lx + by * ly + bz * lz;
    const det = aa * bb - ab * ab || 1e-9;
    return [(bb * la - ab * lb) / det, (aa * lb - ab * la) / det];
  };
  if (L.wave) {
    const [amp, lam, ph] = L.wave;
    const lat = C.map((_, i) => lateral(i));
    C = C.map(([x, z], i) => {
      const off = amp * smooth(0, 0.3, U[i]) * Math.sin((2 * Math.PI * U[i] * len) / lam + ph);
      return [x + lat[i][0] * off, z + lat[i][1] * off];
    });
    Pc = centres();
  }
  // a tip that ends on the shell rather than past the hem dives under the locks around it
  sh.sample(C[N][0], C[N][1], o);
  const endIn = 1 - smooth(o.sh - 0.04, o.sh + 0.03, o.s);
  const base = acc.n;
  for (let i = 0; i <= N; i++) {
    const u = U[i];
    const [cx, cz] = C[i];
    const [dX, dZ] = lateral(i);
    // section size along the lock
    const qr = Math.min(1, u / us);
    const rootF = L.root === 'taper' ? Math.pow(qr, 0.65) : Math.sqrt(Math.max(0, 1 - (1 - qr) * (1 - qr)));
    const v = Math.max(0, (u - ut) / (1 - ut));
    const tipF = Math.pow(Math.max(0, 1 - Math.pow(v, 1.8)), 0.62);
    const w = L.w * (roll ? 0.35 + 0.65 * rootF : rootF) * tipF * (1 + 0.12 * Math.sin(Math.PI * u));
    const hh = H * (roll ? 1 : 0.45 + 0.55 * rootF) * (1 - 0.3 * v * v) + arch * Math.pow(Math.sin(Math.PI * u), 2);
    const lift = curl * v * v - endIn * Math.pow(v, 1.6) * (layer + hh + 0.012);
    for (let k = 0; k < loop; k++) {
      const top = k < nTop;
      const x = top ? xs[k] : BOTTOM_X[k - nTop];
      const X = cx + dX * x * w, Z = cz + dZ * x * w;
      sh.sample(X, Z, o);
      const beyond = smooth(o.sh - 0.04, o.sh + 0.03, o.s);
      const d0 = layer + 0.026;
      const D = d0 + (o.t - 0.004 - d0) * beyond;
      let e: number;
      if (top) {
        const tp = topProf(x);
        e = layer + hh * (tp - 0.16 * groove(x) * Math.sqrt(tp));
        if (roll) {
          const eb = -D * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x)) / 0.95, 4)), 0.25);
          e = eb + (e - eb) * rootF;
        }
      } else {
        const bp = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / 0.95, 4)), 0.25);
        e = -D * bp;
      }
      const k2 = o.t + e + lift;
      acc.v(o.x + o.nx * k2, o.y + o.ny * k2, o.z + o.nz * k2);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < loop; k++) {
      const k1 = (k + 1) % loop;
      acc.quad(base + i * loop + k, base + i * loop + k1, base + (i + 1) * loop + k1, base + (i + 1) * loop + k);
    }
  }
}

function flowPath(p: V2, F: V2, B: V2, hemS: (deg: number) => number, ext: number, len: number): V2[] {
  const mx = (F[0] + B[0]) / 2, mz = (F[1] + B[1]) / 2;
  let nx = F[1] - B[1], nz = B[0] - F[0];
  const nl = Math.hypot(nx, nz) || 1;
  nx /= nl;
  nz /= nl;
  const den = 2 * (nx * (mx - p[0]) + nz * (mz - p[1]));
  let walk: (a: number) => V2;
  if (Math.abs(den) < 1e-6) {
    const dx = B[0] - p[0], dz = B[1] - p[1], l = Math.hypot(dx, dz) || 1;
    walk = (a) => [p[0] + (dx / l) * a, p[1] + (dz / l) * a];
  } else {
    const t = ((mx - F[0]) ** 2 + (mz - F[1]) ** 2 - (mx - p[0]) ** 2 - (mz - p[1]) ** 2) / den;
    const cx = mx + t * nx, cz = mz + t * nz;
    const R = Math.hypot(p[0] - cx, p[1] - cz);
    const ang = (q: V2) => Math.atan2(q[1] - cz, q[0] - cx);
    const TAU = 2 * Math.PI;
    const mod = (a: number) => ((a % TAU) + TAU) % TAU;
    const a0 = ang(p);
    const dir = mod(ang(B) - a0) < mod(ang(F) - a0) ? 1 : -1;
    walk = (a) => [cx + R * Math.cos(a0 + (dir * a) / R), cz + R * Math.sin(a0 + (dir * a) / R)];
  }
  const out: V2[] = [p];
  const step = 0.01;
  for (let a = step; a <= len + 1e-9; a += step) {
    const q = walk(a);
    const end = Math.hypot(q[0], q[1]) >= hemS(Math.atan2(q[0], q[1]) / DEG) + ext || a + step > len;
    const last = out[out.length - 1];
    const gap = Math.hypot(q[0] - last[0], q[1] - last[1]);
    if (end) {
      if (gap < 0.05 && out.length > 1) out[out.length - 1] = q;
      else out.push(q);
      break;
    }
    if (gap >= 0.11) out.push(q);
  }
  return out;
}

/* ------------------------------------------------------------------ geometry + material */

const geoCache = new Map<HairSpec, Map<number, BufferGeometry>>();

/** The merged hair geometry (cached per spec and detail). */
export function hairGeometry(spec: HairSpec, detail = 1): BufferGeometry {
  let byDetail = geoCache.get(spec);
  if (!byDetail) {
    byDetail = new Map();
    geoCache.set(spec, byDetail);
  }
  const hit = byDetail.get(detail);
  if (hit) return hit;
  const sh = new Shell(spec);
  const acc = new Acc();
  buildShell(sh, Math.round(120 * detail), Math.round(20 * detail), Math.max(3, Math.round(6 * detail)), acc);
  const rng = new Rng(spec.seed);
  const kit: LockKit = {
    hem: (deg) => sh.hemS(deg),
    at: (deg, s) => [s * Math.sin(deg * DEG), s * Math.cos(deg * DEG)],
    beyond: (deg, ext) => {
      const s = sh.hemS(deg) + ext;
      return [s * Math.sin(deg * DEG), s * Math.cos(deg * DEG)];
    },
    flow: (p, F, B, opt) => flowPath(p, F, B, (deg) => sh.hemS(deg), opt?.ext ?? 0.04, opt?.len ?? 4),
    rng,
  };
  const locks = spec.locks(kit);
  sh.carve = false;
  locks.forEach((L, i) => buildLock(L, sh, acc, ((i * 7) % 11) * 0.0006));
  const g = new BufferGeometry();
  const pos = new Float32Array(acc.pos);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(acc.idx);
  g.computeVertexNormals();
  // box-projected UVs for the plastic micro-texture
  const nrm = g.getAttribute('normal');
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0; i < pos.length / 3; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const [a, b] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y];
    uv[i * 2] = a * 0.45 + spec.seed * 0.137;
    uv[i * 2 + 1] = b * 0.45 + spec.seed * 0.291;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  g.userData.locks = locks.length;
  byDetail.set(detail, g);
  return g;
}

const matCache = new Map<string, Material>();

/** Glossy moulded ABS: a touch smoother than the brick plastic, the way hair pieces shine. */
function hairMaterial(spec: HairSpec): Material {
  const hex = spec.hex ?? swatch(spec.key).hex;
  const id = `${hex}|${MATERIAL_QUALITY.clearcoat ? 1 : 0}`;
  let m = matCache.get(id);
  if (!m) {
    m = MATERIAL_QUALITY.clearcoat
      ? new MeshPhysicalMaterial({ color: hex, roughness: 0.46, roughnessMap: plasticRoughnessTexture(), metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.14, envMapIntensity: 1.0 })
      : new MeshStandardMaterial({ color: hex, roughness: 0.34, roughnessMap: plasticRoughnessTexture(), metalness: 0 });
    m.name = `lego:hair:${hex.toString(16)}`;
    matCache.set(id, m);
  }
  return m;
}

export function hairMesh(spec: HairSpec, detail = 1): Mesh {
  const m = new Mesh(hairGeometry(spec, detail), hairMaterial(spec));
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'hair';
  return m;
}

/* ------------------------------------------------------------------ the cast */

/**
 * Anakin (ROTS): mid-length, centre-parted, tousled. Curtain locks fall from the parting to frame
 * the face, the side locks sweep over the ears to the jaw and flick out, the back fans from the
 * crown to a jagged nape.
 */
function anakinLocks(k: LockKit): LockSpec[] {
  const L: LockSpec[] = [];
  const r = k.rng;
  const j = (a: number) => r.range(-a, a);
  const crown: V2 = [0, -0.44];
  for (const side of [1, -1]) {
    const D = (deg: number) => deg * side;
    const M = (p: V2): V2 => [p[0] * side, p[1]];
    // broad side locks from the parting, front to back, over the ear to the jaw
    const roots = [0.3, 0.12, -0.06, -0.24];
    const ends = [63, 84, 106, 127];
    const ph = side > 0 ? 0.4 : 2.1;
    roots.forEach((z0, i) => {
      const deg = ends[i] + j(2);
      const root: V2 = M([0.034, z0]);
      const end = k.beyond(D(deg - 4), 0.07 + (i % 2) * 0.05 + j(0.01));
      const q = k.at(D(deg * 0.8 + 16), 0.5);
      const mid = k.at(D(deg + 3), 1.02);
      L.push({ pts: [root, [root[0] * 0.5 + q[0] * 0.5, root[1] * 0.55 + q[1] * 0.45], q, mid, end], w: 0.15 + j(0.01), h: 0.042, layer: 0.012, curl: 0.045 + j(0.01), grooves: 2, tip: 0.24, root: 'blunt', wave: [0.03, 0.62, ph + i * 0.35] });
    });
    // shorter under-layer tips between them: a layered, jagged hem
    [73, 95, 117].forEach((deg, i) => {
      const d = deg + j(2);
      L.push({ pts: [k.at(D(d - 5), 0.7), k.at(D(d - 2), 1.1), k.beyond(D(d - 3), 0.03 + (i % 2) * 0.025)], w: 0.1, h: 0.036, layer: 0.0, curl: 0.035, grooves: 1, tip: 0.36, root: 'taper' });
    });
    // curtain locks from the front of the parting, framing the forehead
    L.push({ pts: [M([0.03, 0.5]), M([0.1, 0.62]), M([0.26, 0.71]), M([0.43, 0.71]), k.beyond(D(42), 0.13)], w: 0.1, h: 0.046, layer: 0.03, curl: 0.012, grooves: 2, tip: 0.34, root: 'blunt' });
    L.push({ pts: [M([0.034, 0.36]), M([0.17, 0.46]), M([0.38, 0.56]), M([0.57, 0.6]), k.beyond(D(52), 0.18)], w: 0.105, h: 0.044, layer: 0.022, curl: 0.025, grooves: 2, tip: 0.3, root: 'blunt', wave: [0.02, 0.7, ph] });
  }
  // back locks fanning from the crown whorl down to the nape
  const backs = [143, 161, 179, -163, -145];
  backs.forEach((deg0, i) => {
    const deg = deg0 + j(2);
    const e = k.beyond(deg, 0.075 + (i % 2) * 0.045 + j(0.01));
    const d0: V2 = [Math.sin(deg * DEG), Math.cos(deg * DEG)];
    const root: V2 = [crown[0] + d0[0] * 0.03, crown[1] + d0[1] * 0.03];
    L.push({ pts: [root, [crown[0] + d0[0] * 0.3, crown[1] + d0[1] * 0.3], k.at(deg - 2, 1.0), e], w: 0.15 + j(0.008), h: 0.042, layer: 0.004 + (i % 2) * 0.005, curl: 0.04 + j(0.008), grooves: 2, tip: 0.24, root: 'taper', wave: [0.028, 0.66, 1.2 + i * 0.5] });
  });
  // the last locks off the end of the parting sweep round to the back corners, over the whorl's flanks
  for (const side of [1, -1]) {
    const M = (p: V2): V2 => [p[0] * side, p[1]];
    const deg = 146 * side;
    L.push({
      pts: [M([0.03, -0.39]), M([0.2, -0.44]), k.at(deg - 6 * side, 0.62), k.at(deg, 1.0), k.beyond(deg - 3 * side, 0.09)],
      w: 0.14,
      h: 0.042,
      layer: 0.008,
      curl: 0.04,
      grooves: 2,
      tip: 0.24,
      root: 'blunt',
      wave: [0.025, 0.64, side > 0 ? 1.0 : 2.6],
    });
  }
  return L;
}

export const ANAKIN_HAIR: HairSpec = {
  key: 'hairAnakin',
  hex: 0x5a2c16,
  hem: [
    [0, 1.0],
    [20, 0.99],
    [34, 0.95],
    [44, 0.86],
    [50, 0.62],
    [56, 0.36],
    [64, 0.2],
    [80, 0.13],
    [100, 0.11],
    [125, 0.07],
    [145, 0.02],
    [165, -0.02],
    [180, -0.03],
  ],
  crownT: 0.31,
  sideT: 0.075,
  flare: 0.03,
  hang: 0.03,
  backVol: 0.25,
  part: { a: [0, 0.62], b: [0, -0.4], depth: 0.025, width: 0.03 },
  locks: anakinLocks,
  seed: 3,
};

const OBIWAN_PART: { a: V2; b: V2 } = { a: [0.43, 0.56], b: [0.3, -0.1] };

/**
 * Obi-Wan (ROTS): short and swept back from a side parting over his left eye, with a rolled quiff
 * and a small fringe breaking forward; tapered sides over the ears, a neat nape. The beard is printed.
 */
function obiwanLocks(k: LockKit): LockSpec[] {
  const L: LockSpec[] = [];
  const r = k.rng;
  const j = (a: number) => r.range(-a, a);
  // the big side: one combed flow from ahead of the parting, back over the crown to the nape
  const F: V2 = [0.75, 1.55], B: V2 = [-0.05, -2.6];
  // the small side (his left) is combed from the parting down and back toward the ear
  const F2: V2 = [0.2, 1.3], B2: V2 = [1.9, -1.0];
  // the hairline from the parting round to the right sideburn: every lock rolls up off it and sweeps back
  [29, 15, 1, -13, -27, -41, -50, -60].forEach((deg0, i) => {
    const deg = deg0 + (deg0 > -45 ? j(1) : 0);
    // the temple is combed flat: low locks growing out of the wall, alternately stacked
    const temple = deg0 < -45;
    const len = !temple && i % 3 === 1 ? 1.45 + j(0.08) : 4;
    L.push({
      pts: k.flow(k.beyond(deg, temple ? 0.01 : 0.02), F, B, { ext: 0.03 + (i % 2) * 0.02, len }),
      w: temple ? 0.105 : 0.1 + j(0.004),
      h: temple ? 0.034 : 0.044,
      layer: (i % 2) * (temple ? 0.01 : 0.008) + (temple ? 0.0 : 0.014),
      curl: 0.008,
      grooves: 3,
      tip: 0.3,
      root: 'roll',
      arch: temple ? 0 : 0.018,
    });
  });
  // small side: locks springing from the edge of the parting, and the temple hairline under them
  const { a, b } = OBIWAN_PART;
  const nx = a[1] - b[1], nz = b[0] - a[0], nl = Math.hypot(nx, nz);
  [0.06, 0.32, 0.58, 0.84].forEach((t, i) => {
    const p: V2 = [a[0] + (b[0] - a[0]) * t + (nx / nl) * 0.03, a[1] + (b[1] - a[1]) * t + (nz / nl) * 0.03];
    L.push({ pts: k.flow(p, F2, B2, { ext: 0.05 + (i % 2) * 0.03 }), w: 0.1 + j(0.004), h: 0.042, layer: 0.012 + (i % 2) * 0.008, curl: 0.02, grooves: 3, tip: 0.3, root: 'roll' });
  });
  L.push({ pts: k.flow(k.beyond(48, 0.01), F2, B2, { ext: 0.04 }), w: 0.105, h: 0.034, layer: 0, curl: 0.012, grooves: 3, tip: 0.3, root: 'roll' });
  // the sideburn is combed straight back over the ear
  L.push({ pts: [k.beyond(58, 0.01), k.at(76, k.hem(76) - 0.1), k.at(96, k.hem(96) - 0.07), k.beyond(112, 0.06)], w: 0.105, h: 0.034, layer: 0.01, curl: 0.015, grooves: 3, tip: 0.3, root: 'roll' });
  // an under-layer lock from the crown fills in where the combed locks fan apart
  L.push({ pts: k.flow([0.06, -0.12], F, B, { ext: 0.04 }), w: 0.11, h: 0.036, layer: 0.0, curl: 0.01, grooves: 2, tip: 0.3, root: 'taper' });
  // behind the end of the parting the two sides part company: a whorl fans down to the nape under them
  const W: V2 = [b[0], b[1] - 0.06];
  [118, 136, 154, 172].forEach((deg, i) => {
    const e = k.at(deg + j(2), 1.0);
    const dx = e[0] - W[0], dz = e[1] - W[1];
    L.push({
      pts: [[W[0] + dx * 0.04, W[1] + dz * 0.04], [W[0] + dx * 0.4, W[1] + dz * 0.4], e, k.beyond(deg, 0.05 + (i % 2) * 0.03)],
      w: 0.12,
      h: 0.04,
      layer: 0.004 + (i % 2) * 0.006,
      curl: 0.02,
      grooves: 2,
      tip: 0.3,
      root: 'taper',
    });
  });
  // nape: short tapered tips under the top layer
  [128, 146, 164, -178, -160, -142, -124].forEach((deg, i) => {
    L.push({ pts: k.flow(k.at(deg + j(2), 0.95), F, B, { ext: 0.03 + (i % 2) * 0.02 }), w: 0.1, h: 0.034, layer: 0.0, curl: 0.012, grooves: 2, tip: 0.4, root: 'taper' });
  });
  return L;
}

export const OBIWAN_HAIR: HairSpec = {
  key: 'hairObiwan',
  hex: 0x8a4318,
  hem: [
    [0, 1.02],
    [25, 1.0],
    [40, 0.95],
    [50, 0.82],
    [56, 0.66],
    [64, 0.54],
    [80, 0.5],
    [100, 0.48],
    [125, 0.41],
    [150, 0.33],
    [180, 0.29],
  ],
  crownT: 0.26,
  sideT: 0.06,
  dome: [0.15, 0.95],
  flare: 0.0,
  hang: 0.0,
  backVol: 0.06,
  part: { ...OBIWAN_PART, depth: 0.03, width: 0.034 },
  lift: { at: [-0.04, 0.26], r: 0.3, h: 0.05 },
  locks: obiwanLocks,
  seed: 5,
};
