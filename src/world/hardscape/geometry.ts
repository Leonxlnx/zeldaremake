/**
 * Small geometry toolkit for cut-stone shapes: jittered polygon outlines, insets, bevelled
 * extrusions with a dished (worn) top, and a triangle accumulator that emits one BufferGeometry
 * with position / normal / uv / color / aMoss attributes.
 */
import { BufferGeometry, Float32BufferAttribute, Matrix4, ShapeUtils, Vector2, Vector3 } from 'three';
import type { Rng } from '../util/prng';

export interface P2 {
  x: number;
  z: number;
}

export function polygonArea(p: P2[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].z - p[j].x * p[i].z;
  }
  return a / 2;
}

export function centroid(p: P2[]): P2 {
  let x = 0;
  let z = 0;
  for (const q of p) {
    x += q.x;
    z += q.z;
  }
  return { x: x / p.length, z: z / p.length };
}

/**
 * Ensure counter-clockwise order as seen from above (+y looking down). With x right and z toward
 * the viewer that is a NEGATIVE signed xz area; this winding makes the top-face normals point up.
 */
export function ccw(p: P2[]): P2[] {
  return polygonArea(p) > 0 ? [...p].reverse() : p;
}

/** Miter-offset inset (positive = shrink). Works for convex and mildly concave outlines. */
export function inset(p: P2[], d: number): P2[] {
  const n = p.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n];
    const b = p[i];
    const c = p[(i + 1) % n];
    // edge normals (pointing inward for ccw polygons)
    let e1x = b.x - a.x;
    let e1z = b.z - a.z;
    let e2x = c.x - b.x;
    let e2z = c.z - b.z;
    const l1 = Math.hypot(e1x, e1z) || 1;
    const l2 = Math.hypot(e2x, e2z) || 1;
    e1x /= l1;
    e1z /= l1;
    e2x /= l2;
    e2z /= l2;
    // inward normals for our (seen-from-above ccw) winding
    const n1x = e1z;
    const n1z = -e1x;
    const n2x = e2z;
    const n2z = -e2x;
    let bx = n1x + n2x;
    let bz = n1z + n2z;
    const bl = Math.hypot(bx, bz);
    if (bl < 1e-6) {
      bx = n1x;
      bz = n1z;
    } else {
      bx /= bl;
      bz /= bl;
    }
    const cosHalf = Math.max(0.35, bx * n1x + bz * n1z);
    const k = Math.min(d / cosHalf, Math.min(l1, l2) * 0.45);
    out.push({ x: b.x + bx * k, z: b.z + bz * k });
  }
  return out;
}

/** Distance from a point to the closest edge of a polygon (0 when on an edge; sign-less). */
export function distToPolygon(p: P2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ax = p[j].x;
    const az = p[j].z;
    const ex = p[i].x - ax;
    const ez = p[i].z - az;
    const l2 = ex * ex + ez * ez || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
    const d = Math.hypot(x - (ax + ex * t), z - (az + ez * t));
    if (d < best) best = d;
  }
  return best;
}

/** Point-in-polygon (ray casting). */
export function pointInPolygon(p: P2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const pi = p[i];
    const pj = p[j];
    if (pi.z > z !== pj.z > z && x < ((pj.x - pi.x) * (z - pi.z)) / (pj.z - pi.z) + pi.x) inside = !inside;
  }
  return inside;
}

/**
 * Hand-cut rectangle: edges split into segments with perpendicular jitter, corners optionally
 * chipped (chamfered). Returned ccw, centred on the rectangle centre.
 */
export function jitteredRect(rng: Rng, w: number, d: number, opts: { jitter?: number; segs?: number; chip?: number; chipChance?: number } = {}): P2[] {
  const jitter = opts.jitter ?? 0.02;
  const segs = opts.segs ?? 4;
  const chip = opts.chip ?? 0.08;
  const chipChance = opts.chipChance ?? 0.45;
  const hw = w / 2;
  const hd = d / 2;
  const corners: P2[] = [
    { x: -hw, z: -hd },
    { x: hw, z: -hd },
    { x: hw, z: hd },
    { x: -hw, z: hd },
  ];
  const pts: P2[] = [];
  for (let c = 0; c < 4; c++) {
    const a = corners[c];
    const b = corners[(c + 1) % 4];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez);
    const nx = -ez / len;
    const nz = ex / len;
    // corner chip: replace the corner by two points pulled along both edges
    const chipHere = rng.chance(chipChance);
    const c0 = chipHere ? rng.range(chip * 0.4, chip) / len : 0;
    const nSeg = Math.max(2, Math.round(segs * (len / Math.max(w, d))));
    for (let s = 0; s < nSeg; s++) {
      let t = s / nSeg;
      if (s === 0) t = c0;
      else t += rng.range(-0.15, 0.15) / nSeg;
      const jj = s === 0 ? rng.range(-jitter * 0.5, jitter * 0.5) : rng.range(-jitter, jitter);
      pts.push({ x: a.x + ex * t + nx * jj, z: a.z + ez * t + nz * jj });
    }
    if (chipHere) {
      const t1 = 1 - rng.range(chip * 0.4, chip) / len;
      pts.push({ x: a.x + ex * t1 + nx * rng.range(-jitter * 0.5, jitter * 0.5), z: a.z + ez * t1 + nz * rng.range(-jitter * 0.5, jitter * 0.5) });
    }
  }
  return ccw(pts);
}

/** Irregular convex-ish polygon with n sides, unit max radius. */
export function irregularPolygon(rng: Rng, n: number, opts: { radiusJitter?: number; angleJitter?: number; subdivide?: number; edgeJitter?: number; aspect?: number } = {}): P2[] {
  const rj = opts.radiusJitter ?? 0.2;
  const aj = opts.angleJitter ?? 0.35;
  const sub = opts.subdivide ?? 2;
  const ej = opts.edgeJitter ?? 0.03;
  const aspect = opts.aspect ?? 1;
  const base: P2[] = [];
  for (let i = 0; i < n; i++) {
    const ang = ((i + rng.range(-aj, aj)) / n) * Math.PI * 2;
    const r = 1 - rng.range(0, rj);
    base.push({ x: Math.cos(ang) * r * aspect, z: Math.sin(ang) * r });
  }
  // subdivide edges with slight perpendicular jitter → hand-cut look
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = base[i];
    const b = base[(i + 1) % n];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez);
    const nx = -ez / len;
    const nz = ex / len;
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      const j = s === 0 ? 0 : rng.range(-ej, ej);
      pts.push({ x: a.x + ex * t + nx * j, z: a.z + ez * t + nz * j });
    }
  }
  // normalise to unit max radius around the centroid
  const c = centroid(pts);
  let maxR = 0;
  for (const p of pts) maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.z - c.z));
  return ccw(pts.map((p) => ({ x: (p.x - c.x) / maxR, z: (p.z - c.z) / maxR })));
}

/** Radius of a star-shaped polygon (around the origin) at angle theta. */
export function radialProfile(p: P2[], samples: number): Float32Array {
  const out = new Float32Array(samples);
  for (let s = 0; s < samples; s++) {
    const th = (s / samples) * Math.PI * 2;
    const dx = Math.cos(th);
    const dz = Math.sin(th);
    let best = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      // ray (0,0)+t*(dx,dz) vs segment a→b
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (a.x * ez - a.z * ex) / den;
      const u = (a.x * dz - a.z * dx) / den;
      if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
    }
    out[s] = best === Infinity ? 0 : best;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------

export type Rgb = [number, number, number];

export class MeshBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  moss: number[] = [];
  /** soil stain amount per vertex (`aStain`): the joint soil creeping up a slab's flank */
  stain: number[] = [];
  private groupStart = 0;

  get vertexCount() {
    return this.pos.length / 3;
  }

  beginGroup() {
    this.groupStart = this.pos.length / 3;
  }

  /**
   * push one triangle with an explicit normal (or computed from winding if omitted); `stain` is
   * the per-vertex soil-stain amount (`aStain`, clamped 0..1 in the shader after interpolation)
   */
  tri(a: Vector3, b: Vector3, c: Vector3, uva: Vector2, uvb: Vector2, uvc: Vector2, col: Rgb, moss: [number, number, number], n?: Vector3, stain?: [number, number, number]) {
    let nx: number;
    let ny: number;
    let nz: number;
    if (n) {
      nx = n.x;
      ny = n.y;
      nz = n.z;
    } else {
      const ux = b.x - a.x;
      const uy = b.y - a.y;
      const uz = b.z - a.z;
      const vx = c.x - a.x;
      const vy = c.y - a.y;
      const vz = c.z - a.z;
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
    }
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    this.nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.uv.push(uva.x, uva.y, uvb.x, uvb.y, uvc.x, uvc.y);
    this.col.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    this.moss.push(moss[0], moss[1], moss[2]);
    if (stain) this.stain.push(stain[0], stain[1], stain[2]);
    else this.stain.push(0, 0, 0);
  }

  /** average normals of coincident vertices inside the current group (smooth shading) */
  smoothGroup(tolerance = 1e-4) {
    const start = this.groupStart;
    const end = this.pos.length / 3;
    const acc = new Map<string, [number, number, number]>();
    const key = (i: number) => `${Math.round(this.pos[i * 3] / tolerance)},${Math.round(this.pos[i * 3 + 1] / tolerance)},${Math.round(this.pos[i * 3 + 2] / tolerance)}`;
    for (let i = start; i < end; i++) {
      const k = key(i);
      const a = acc.get(k) ?? [0, 0, 0];
      a[0] += this.nrm[i * 3];
      a[1] += this.nrm[i * 3 + 1];
      a[2] += this.nrm[i * 3 + 2];
      acc.set(k, a);
    }
    for (let i = start; i < end; i++) {
      const a = acc.get(key(i))!;
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      this.nrm[i * 3] = a[0] / l;
      this.nrm[i * 3 + 1] = a[1] / l;
      this.nrm[i * 3 + 2] = a[2] / l;
    }
  }

  /** transform all vertices from `from` index by a matrix (positions + normals) */
  transform(m: Matrix4, from = 0) {
    const v = new Vector3();
    const nm = new Matrix4().copy(m);
    nm.setPosition(0, 0, 0);
    for (let i = from; i < this.pos.length / 3; i++) {
      v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).applyMatrix4(m);
      this.pos[i * 3] = v.x;
      this.pos[i * 3 + 1] = v.y;
      this.pos[i * 3 + 2] = v.z;
      v.set(this.nrm[i * 3], this.nrm[i * 3 + 1], this.nrm[i * 3 + 2]).applyMatrix4(nm).normalize();
      this.nrm[i * 3] = v.x;
      this.nrm[i * 3 + 1] = v.y;
      this.nrm[i * 3 + 2] = v.z;
    }
  }

  append(other: MeshBuilder) {
    const cat = (dst: number[], src: number[]) => {
      for (let i = 0; i < src.length; i++) dst.push(src[i]);
    };
    cat(this.pos, other.pos);
    cat(this.nrm, other.nrm);
    cat(this.uv, other.uv);
    cat(this.col, other.col);
    cat(this.moss, other.moss);
    cat(this.stain, other.stain);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMoss', new Float32BufferAttribute(this.moss, 1));
    g.setAttribute('aStain', new Float32BufferAttribute(this.stain, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

export interface SlabOptions {
  /** total slab height (m) */
  thickness: number;
  /** bevel size (m) on the top edge */
  bevel: number;
  /** how much the centre of the top face sags (m) — worn dish */
  dip?: number;
  /** base colour multiplier */
  color?: [number, number, number];
  /** colour multiplier for the sides (usually darker) */
  sideColor?: [number, number, number];
  /**
   * soil stain (`aStain`) at the foot of the side walls (y = 0), falling linearly to 0 at the
   * shoulder ring; the shader clamps it to 0..1 after interpolation, so a value > 1 puts the
   * fully stained band on the buried part of the wall and the fade-out just above the fill
   */
  sideStain?: number;
  /** moss amount on the top-edge ring / sides (0..1) and how far in it creeps (0..1) */
  mossEdge?: number;
  mossInner?: number;
  /** per-vertex moss modulation callback (world-ish local x,z) */
  mossFn?: (x: number, z: number) => number;
  /**
   * additive per-vertex moss (local x,z; `edge` is 1 on the sides / bevel / shoulder ring and
   * falls to 0 at the top centre) — a moss film creeping in over a stone's edge with its own
   * falloff, independent of the multiplicative `mossFn` ring gradient
   */
  mossAdd?: (x: number, z: number, edge: number) => number;
  /** uv scale (texels per metre → 1/tile) */
  uvScale?: number;
  /** uv offset so each slab samples a different part of the texture */
  uvOffset?: [number, number];
  /** include a bottom cap (false for buried stones) */
  bottom?: boolean;
  /** extra height noise on top vertices (m) */
  topNoise?: (x: number, z: number) => number;
  /** bounded fracture relief on the top/inner shoulder only; outer walls and contact stay exact */
  topRelief?: (x: number, z: number, edge: number) => number;
  /** number of interior rings on the top face (≥1); more = smoother dish */
  rings?: number;
  /**
   * per-face luminance multiplier (local x,z of the face centre) — e.g. a worn nose highlight on
   * the front bevel of a tread, grime toward the flanks; 1 = unchanged. `edge` is 1 on the bevel
   * and sides and falls toward 0 at the centre of the top face (for rim dirt / wear gradients).
   * May return an RGB triple for a tinted multiplier (moss film, damp patches).
   */
  colorFn?: (x: number, z: number, part: 'top' | 'bevel' | 'side', edge: number) => number | [number, number, number];
  /**
   * smooth the bevel ring and the top face as one group so the rim rolls over softly (worn
   * flagstone) instead of showing a hard crease between bevel and top (cut stair nosing)
   */
  softBevel?: boolean;
  /**
   * explicit inner ring (same vertex count and order as `outline`) where the bevel/shoulder meets
   * the top face. Lets the caller build the shoulder as a proper offset of the stone's cell (a
   * rounded outline made of short segments defeats the miter inset).
   */
  topRing?: P2[];
  /** Validate the radial cap centre against concave notch edges; other slabs keep their old topology. */
  notchedTop?: boolean;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _ua = new Vector2();
const _ub = new Vector2();
const _uc = new Vector2();
const _ud = new Vector2();

/**
 * A fan and its homothetic rings must see every edge from their centre. Shallow V-notches
 * can put the ordinary vertex centroid outside that visibility kernel. Preserve the outline
 * and move only the centre to the nearest point inside the kernel (with a small inset).
 * A genuinely non-star-shaped cap has no kernel and uses the triangulated fallback below.
 */
function slabFanCentre(poly: P2[]): P2 | null {
  const original = centroid(poly);
  const sign = Math.sign(polygonArea(poly));
  const planes = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    return (p: P2) => sign * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / Math.max(length, 1e-12);
  });
  if (planes.every((d) => d(original) > 1e-8)) return original;
  const xs = poly.map((p) => p.x), zs = poly.map((p) => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  let kernel: P2[] = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  for (const distance of planes) {
    const clipped: P2[] = [];
    for (let i = 0; i < kernel.length; i++) {
      const a = kernel[i], b = kernel[(i + 1) % kernel.length];
      // 0.01 mm inward margin prevents collapsed fan wedges after float32 storage.
      const da = distance(a) - 1e-5, db = distance(b) - 1e-5;
      if (da >= 0) clipped.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        clipped.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    kernel = clipped;
    if (kernel.length < 3) return null;
  }
  const interior = centroid(kernel);
  let closest = interior, best = Infinity;
  for (let i = 0; i < kernel.length; i++) {
    const a = kernel[i], b = kernel[(i + 1) % kernel.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((original.x - a.x) * dx + (original.z - a.z) * dz) / Math.max(dx * dx + dz * dz, 1e-20)));
    const p = { x: a.x + dx * t, z: a.z + dz * t };
    const d = (p.x - original.x) ** 2 + (p.z - original.z) ** 2;
    if (d < best) { best = d; closest = p; }
  }
  return { x: closest.x + (interior.x - closest.x) * 0.02, z: closest.z + (interior.z - closest.z) * 0.02 };
}

/**
 * Build a bevelled slab from a ccw outline (local xz, y up; bottom at y=0, top at y=thickness).
 * Sides are flat-shaded, the bevel ring is smooth, the top is a smooth dished surface.
 */
export function buildSlab(mb: MeshBuilder, outline: P2[], o: SlabOptions) {
  const t = o.thickness;
  const bevel = Math.min(o.bevel, t * 0.6);
  const dip = o.dip ?? 0;
  const col = o.color ?? [1, 1, 1];
  const scol = o.sideColor ?? [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
  const sideStain = o.sideStain ?? 0;
  const uvS = o.uvScale ?? 1 / 1.6;
  const uvO = o.uvOffset ?? [0, 0];
  const rings = Math.max(1, o.rings ?? 2);
  const mossEdge = o.mossEdge ?? 0;
  const mossInner = o.mossInner ?? 0;
  const mossFn = o.mossFn ?? (() => 1);
  const mossAdd = o.mossAdd ?? (() => 0);
  const topNoise = o.topNoise ?? (() => 0);
  const colorFn = o.colorFn;
  const shade = (base: readonly [number, number, number], part: 'top' | 'bevel' | 'side', ax: number, az: number, k = 1, edge = 1): [number, number, number] => {
    const m = colorFn ? colorFn(ax, az, part, edge) : 1;
    if (typeof m === 'number') return [base[0] * m * k, base[1] * m * k, base[2] * m * k];
    return [base[0] * m[0] * k, base[1] * m[1] * k, base[2] * m[2] * k];
  };

  const reversed = polygonArea(outline) > 0;
  const outer = reversed ? [...outline].reverse() : outline;
  const n = outer.length;
  const givenTop = o.topRing && o.topRing.length === n ? (reversed ? [...o.topRing].reverse() : o.topRing) : null;
  const top = givenTop ?? inset(outer, bevel);
  const fanCentre = o.notchedTop ? slabFanCentre(top) : centroid(top);
  const c = fanCentre ?? centroid(top);
  const topUv = (p: P2) => _ua.set(p.x * uvS + uvO[0], p.z * uvS + uvO[1]).clone();
  const topY = (p: P2, ringScale: number) => {
    const y = t - dip * (1 - ringScale * ringScale) + topNoise(p.x, p.z) * (0.4 + 0.6 * (1 - ringScale));
    return o.topRelief ? y + o.topRelief(p.x, p.z, ringScale) : y;
  };

  // --- side walls (flat) ---
  for (let i = 0; i < n; i++) {
    const p = outer[i];
    const q = outer[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const u0 = (i * 0.37) % 1;
    _a.set(p.x, 0, p.z);
    _b.set(q.x, 0, q.z);
    _c.set(q.x, t - bevel, q.z);
    _d.set(p.x, t - bevel, p.z);
    _ua.set(u0 + uvO[0], uvO[1]);
    _ub.set(u0 + len * uvS + uvO[0], uvO[1]);
    _uc.set(u0 + len * uvS + uvO[0], (t - bevel) * uvS + uvO[1]);
    _ud.set(u0 + uvO[0], (t - bevel) * uvS + uvO[1]);
    // grime: darker toward the bottom → encode via colour; moss on the lower side
    const mSide = mossEdge * 0.8 * mossFn(p.x, p.z);
    const aP = mossAdd(p.x, p.z, 1);
    const aQ = mossAdd(q.x, q.z, 1);
    const mx = (p.x + q.x) / 2;
    const mz = (p.z + q.z) / 2;
    // soil stain: a, b at the foot, c, d at the shoulder ring
    mb.tri(_a, _b, _c, _ua, _ub, _uc, shade(scol, 'side', mx, mz, 0.75), [mSide + aP, mSide + aQ, mSide * 0.5 + aQ], undefined, [sideStain, sideStain, 0]);
    mb.tri(_a, _c, _d, _ua, _uc, _ud, shade(scol, 'side', mx, mz), [mSide + aP, mSide * 0.5 + aQ, mSide * 0.5 + aP], undefined, [sideStain, 0, 0]);
  }

  // --- bevel ring (smooth) ---
  mb.beginGroup();
  for (let i = 0; i < n; i++) {
    const p = outer[i];
    const q = outer[(i + 1) % n];
    const pi = top[i];
    const qi = top[(i + 1) % n];
    _a.set(p.x, t - bevel, p.z);
    _b.set(q.x, t - bevel, q.z);
    _c.set(qi.x, topY(qi, 1), qi.z);
    _d.set(pi.x, topY(pi, 1), pi.z);
    const aP = mossAdd(p.x, p.z, 1);
    const aQ = mossAdd(q.x, q.z, 1);
    const mE = mossEdge * mossFn(p.x, p.z) + aP;
    const mE2 = mossEdge * mossFn(q.x, q.z) + aQ;
    const bc = shade(scol, 'bevel', (p.x + q.x + pi.x + qi.x) / 4, (p.z + q.z + pi.z + qi.z) / 4);
    mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(qi), bc, [mE, mE2, mossEdge * mossFn(q.x, q.z) * 0.7 + aQ]);
    mb.tri(_a, _c, _d, topUv(p), topUv(qi), topUv(pi), bc, [mE, mossEdge * mossFn(q.x, q.z) * 0.7 + aQ, mossEdge * mossFn(p.x, p.z) * 0.7 + aP]);
  }
  if (!o.softBevel) mb.smoothGroup();

  // --- top: concentric rings toward the centroid, then a fan ---
  if (!o.softBevel) mb.beginGroup();
  if (!fanCentre) {
    // Rare non-star-shaped outlines cannot use one radial crown. Triangulate their exact
    // boundary instead, preserving shoulder contact, UVs, noise and material attributes.
    const triangles = ShapeUtils.triangulateShape(top.map((p) => new Vector2(p.x, p.z)), []);
    for (const tri of triangles) {
      const points = tri.map((i) => top[i]);
      if (polygonArea(points) > 0) points.reverse();
      const [p, q, r] = points;
      _a.set(p.x, topY(p, 1), p.z);
      _b.set(q.x, topY(q, 1), q.z);
      _c.set(r.x, topY(r, 1), r.z);
      const mossAt = (v: P2) => mossEdge * 0.7 * mossFn(v.x, v.z) + mossAdd(v.x, v.z, 1);
      const tc = colorFn ? shade(col, 'top', (p.x + q.x + r.x) / 3, (p.z + q.z + r.z) / 3, 1, 1) : col;
      mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(r), tc, [mossAt(p), mossAt(q), mossAt(r)]);
    }
  } else {
    const ringPts: P2[][] = [];
    for (let r = 0; r <= rings; r++) {
      const s = 1 - r / (rings + 1);
      ringPts.push(top.map((p) => ({ x: c.x + (p.x - c.x) * s, z: c.z + (p.z - c.z) * s })));
    }
    const scales = ringPts.map((_, r) => 1 - r / (rings + 1));
    for (let r = 0; r < rings; r++) {
      const A = ringPts[r];
      const B = ringPts[r + 1];
      const sA = scales[r];
      const sB = scales[r + 1];
      const mA = mossEdge * (1 - r / rings) * 0.7 + mossInner * (r / rings);
      const mB = mossEdge * (1 - (r + 1) / rings) * 0.7 + mossInner * ((r + 1) / rings);
      for (let i = 0; i < n; i++) {
        const p = A[i];
        const q = A[(i + 1) % n];
        const pi = B[i];
        const qi = B[(i + 1) % n];
        _a.set(p.x, topY(p, sA), p.z);
        _b.set(q.x, topY(q, sA), q.z);
        _c.set(qi.x, topY(qi, sB), qi.z);
        _d.set(pi.x, topY(pi, sB), pi.z);
        const m1 = mA * mossFn(p.x, p.z) + mossAdd(p.x, p.z, sA);
        const m2 = mA * mossFn(q.x, q.z) + mossAdd(q.x, q.z, sA);
        const m3 = mB * mossFn(qi.x, qi.z) + mossAdd(qi.x, qi.z, sB);
        const m4 = mB * mossFn(pi.x, pi.z) + mossAdd(pi.x, pi.z, sB);
        const tc = colorFn ? shade(col, 'top', (p.x + q.x + pi.x + qi.x) / 4, (p.z + q.z + pi.z + qi.z) / 4, 1, (sA + sB) / 2) : col;
        mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(qi), tc, [m1, m2, m3]);
        mb.tri(_a, _c, _d, topUv(p), topUv(qi), topUv(pi), tc, [m1, m3, m4]);
      }
    }
    const last = ringPts[rings];
    const sL = scales[rings];
    _c.set(c.x, topY(c, 0), c.z);
    const mC = mossInner * mossFn(c.x, c.z) + mossAdd(c.x, c.z, 0);
    for (let i = 0; i < n; i++) {
      const p = last[i];
      const q = last[(i + 1) % n];
      _a.set(p.x, topY(p, sL), p.z);
      _b.set(q.x, topY(q, sL), q.z);
      const mL = mossInner * mossFn(p.x, p.z) + mossAdd(p.x, p.z, sL);
      const mQ = mossInner * mossFn(q.x, q.z) + mossAdd(q.x, q.z, sL);
      const tc = colorFn ? shade(col, 'top', (p.x + q.x + c.x) / 3, (p.z + q.z + c.z) / 3, 1, sL / 2) : col;
      mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(c), tc, [mL, mQ, mC]);
    }
  }
  mb.smoothGroup();

  // --- bottom cap ---
  if (o.bottom) {
    const tris = ShapeUtils.triangulateShape(
      outer.map((p) => new Vector2(p.x, p.z)),
      [],
    );
    for (const [i0, i1, i2] of tris) {
      _a.set(outer[i0].x, 0, outer[i0].z);
      _b.set(outer[i2].x, 0, outer[i2].z);
      _c.set(outer[i1].x, 0, outer[i1].z);
      mb.tri(_a, _b, _c, topUv(outer[i0]), topUv(outer[i2]), topUv(outer[i1]), scol, [0, 0, 0], new Vector3(0, -1, 0));
    }
  }
}
