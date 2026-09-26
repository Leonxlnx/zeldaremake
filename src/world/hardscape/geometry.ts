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
  /** weathering gate per vertex (`aWear`, 0..1): the stone shader's lichen/grime mottling applies where it is > 0 */
  wear: number[] = [];
  /**
   * crack coordinates per vertex (`aCrack`, vec2): signed distance across the stone's crack line
   * (m) and the position along it in units of its half-length; both are affine in the slab's
   * local xz so the interpolated value is exact over every face. (9, 9) = no crack.
   */
  crack: number[] = [];
  /**
   * within-stone mottle weights per vertex (`aMottle`, vec3): moss-cushion weight, grey-lichen
   * weight and the cushions' greenness for the stone shader's surface patches (round 34);
   * (0, 0, 0) = none
   */
  mottle: number[] = [];
  /**
   * per-vertex roughness delta (`aRough`, round 42): a per-stone micro-roughness swing the stone
   * shader adds to the roughness map, so neighbouring slabs catch the sun a little differently
   * at player height; `currentRough` is written on every triangle pushed until it is changed
   */
  rough: number[] = [];
  currentRough = 0;
  /**
   * earth weight per vertex (`aEarth`, 0..1; fable-2, lane 6 — the demo's log-risered steps): the
   * stone shader blends the surface to packed trail dirt where it is 1 — a log flight's treads are
   * trodden earth between the timbers, not slabs. `currentEarth` is written on every triangle
   * pushed until it is changed (0 = stone).
   */
  earth: number[] = [];
  currentEarth = 0;
  private groupStart = 0;

  get vertexCount() {
    return this.pos.length / 3;
  }

  beginGroup() {
    this.groupStart = this.pos.length / 3;
  }

  /**
   * push one triangle with an explicit normal (or computed from winding if omitted); `stain` is
   * the per-vertex soil-stain amount (`aStain`, clamped 0..1 in the shader after interpolation),
   * `wear` the face's weathering gate, `crack` the three vertices' crack coordinates (6 numbers)
   * and `mottle` their (moss, grey, green) mottle weights (9 numbers)
   */
  tri(a: Vector3, b: Vector3, c: Vector3, uva: Vector2, uvb: Vector2, uvc: Vector2, col: Rgb | readonly [Rgb, Rgb, Rgb], moss: [number, number, number], n?: Vector3, stain?: [number, number, number], wear = 0, crack?: readonly number[], mottle?: readonly number[]) {
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
    if (typeof col[0] === 'number') {
      const k = col as Rgb;
      this.col.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]);
    } else {
      const [ka, kb, kc] = col as readonly [Rgb, Rgb, Rgb];
      this.col.push(ka[0], ka[1], ka[2], kb[0], kb[1], kb[2], kc[0], kc[1], kc[2]);
    }
    this.moss.push(moss[0], moss[1], moss[2]);
    if (stain) this.stain.push(stain[0], stain[1], stain[2]);
    else this.stain.push(0, 0, 0);
    this.wear.push(wear, wear, wear);
    if (crack) this.crack.push(crack[0], crack[1], crack[2], crack[3], crack[4], crack[5]);
    else this.crack.push(9, 9, 9, 9, 9, 9);
    if (mottle) this.mottle.push(mottle[0], mottle[1], mottle[2], mottle[3], mottle[4], mottle[5], mottle[6], mottle[7], mottle[8]);
    else this.mottle.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.rough.push(this.currentRough, this.currentRough, this.currentRough);
    this.earth.push(this.currentEarth, this.currentEarth, this.currentEarth);
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
    cat(this.wear, other.wear);
    cat(this.crack, other.crack);
    cat(this.mottle, other.mottle);
    cat(this.rough, other.rough);
    cat(this.earth, other.earth);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.col, 3));
    g.setAttribute('aMoss', new Float32BufferAttribute(this.moss, 1));
    g.setAttribute('aStain', new Float32BufferAttribute(this.stain, 1));
    g.setAttribute('aWear', new Float32BufferAttribute(this.wear, 1));
    g.setAttribute('aCrack', new Float32BufferAttribute(this.crack, 2));
    g.setAttribute('aMottle', new Float32BufferAttribute(this.mottle, 3));
    g.setAttribute('aRough', new Float32BufferAttribute(this.rough, 1));
    g.setAttribute('aEarth', new Float32BufferAttribute(this.earth, 1));
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
  /** colour multiplier for the bevel / shoulder ring (defaults to the side colour) */
  bevelColor?: [number, number, number];
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
   * shade the top face per vertex (the colour function sampled at each corner and interpolated)
   * instead of one tone per quad: a quad of the top is 0.3–0.7 m on a tread, and one tone each
   * reads as a patchwork of facets at arm's length (the flight's survey poses at 1.5–2 m); false
   * (the default) keeps the per-quad tone the plaza's slabs were tuned with
   */
  vertexTone?: boolean;
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
  /**
   * bands in the bevel (default 1, a single chamfer). With 2–3 the bevel follows a convex
   * quarter-round from the wall (steep) to the top ring (flat) — a worn, rolled nosing whose lit
   * crown and shadowed underside grade into each other (frame 1 s stair lips).
   */
  bevelRings?: number;
  /** weathering gate (`aWear`) written on the top face and shoulder ring: the stone shader's lichen/grime mottling (0 = none) */
  wear?: number;
  /**
   * earth weight (`aEarth`, 0..1) written on the top face and the shoulder ring (fable-2, lane 6):
   * the stone shader renders those faces as packed trail dirt — a log-risered flight's treads. The
   * side walls stay stone (they are the riser band under the timber). Default 0.
   */
  earthTop?: number;
  /** earth weight (`aEarth`) on the side walls too (a log flight's riser band is packed earth under the timber). Default 0. */
  earthSides?: number;
  /**
   * weathering gate on the side walls (round 44; default 0 — a buried flank shows a centimetre or
   * two and stays clean): a kerb or cheek stone whose face stands 20–40 cm over the ground takes
   * the shader's grime and lichen mottling like its top, so the face reads as the same weathered
   * stone rather than a flat plane of the side colour
   */
  sideWear?: number;
  /**
   * blend of the side walls' shading normal toward +y (0 = the true outward normal, 1 = straight
   * up). A short wall that faces away from the sun renders as a dark band 2–3× the seam's height
   * from a grazing camera; lit like the top it reads as the stone's rounded edge and the seam
   * stays the fill's dark line. Shadowing is unchanged (the shadow map is not normal-dependent).
   */
  sideNormalUp?: number;
  /**
   * luminance of the side walls' lower triangle (the foot half) relative to the upper — the
   * default 0.75 is the buried stone's grime band; 1 for a kerb face that stands clean over paving
   */
  sideGrime?: number;
  /**
   * crack line on the top face (`aCrack`): local xz → [signed distance across the crack (m),
   * position along it in half-lengths]; must be affine in x, z. Omit for an uncracked slab.
   */
  crackFn?: (x: number, z: number) => [number, number];
  /**
   * crack line on the side walls (`aCrack`, round 42 — a riser's fissure): local (x, y, z) of a
   * wall vertex → [signed distance across the crack (m), position along it in half-lengths];
   * affine in x, y, z so the interpolated value is exact over the wall quad. Omit for none.
   */
  sideCrackFn?: (x: number, y: number, z: number) => [number, number];
  /**
   * edge spall (round 42): a vertical drop (m, ≥ 0) at an outline vertex, taken off the wall top
   * and the whole rolled shoulder at that vertex, so the slab's edge locally crumbles down into
   * a chip a hand wide (the outline's vertex spacing) and the drop deep — the broken, chipped
   * slab edges of frame 03 at player height. The top face's outer ring slopes into it. Clamped
   * to 0.9 × the wall height.
   */
  rimDrop?: (x: number, z: number) => number;
  /**
   * within-stone mottle weights on the top face and shoulder ring (`aMottle`, round 34): local xz
   * and the ring position (`edge`, 1 at the rim, 0 at the centre) → [moss-cushion weight, grey-lichen
   * weight, cushion greenness], all 0..1; the stone shader grows its surface patches where the
   * weights are > 0 and pulls the cushions from khaki toward moss with the greenness
   */
  mottleFn?: (x: number, z: number, edge: number) => [number, number, number];
  /**
   * the far LOD of a paving slab (fable-2, lane 6): the top face alone, one fan from the outline
   * to the centre — no walls, no shoulder roll, no interior rings. The rim vertices carry the full
   * slab's outer top ring values (its tone at that ring's mean `edge`, its moss, mottle, crack and
   * spall drop) and the centre the centre's, so the fan interpolates the same radial grading the
   * rings step through. n triangles where the full slab has n(3 + 2·bevelRings + 2·rings); the
   * paving swaps to it beyond `FLAGSTONE_FAR_M` (hardscape/index.ts), where a 1–3 cm roll and a
   * 6 mm crown are under a pixel.
   */
  farLod?: boolean;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _n = new Vector3();
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
  const bcol = o.bevelColor ?? scol;
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
  const vertexTone = o.vertexTone ?? false;
  const wear = o.wear ?? 0;
  const crackFn = o.crackFn;
  const NO_CRACK: readonly number[] = [9, 9, 9, 9, 9, 9];
  /** the three vertices' crack coordinates for one top-face triangle */
  const crackOf = (p: P2, q: P2, r: P2): readonly number[] => {
    if (!crackFn) return NO_CRACK;
    const a = crackFn(p.x, p.z);
    const b = crackFn(q.x, q.z);
    const c = crackFn(r.x, r.z);
    return [a[0], a[1], b[0], b[1], c[0], c[1]];
  };
  const mottleFn = o.mottleFn;
  /** the three vertices' mottle weights for one top-face / shoulder triangle (undefined = none) */
  const mottleOf = (p: P2, q: P2, r: P2, ep: number, eq: number, er: number): readonly number[] | undefined => {
    if (!mottleFn) return undefined;
    const a = mottleFn(p.x, p.z, ep);
    const b = mottleFn(q.x, q.z, eq);
    const c = mottleFn(r.x, r.z, er);
    return [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]];
  };
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
  const topY = (p: P2, ringScale: number) => t - dip * (1 - ringScale * ringScale) + topNoise(p.x, p.z) * (0.4 + 0.6 * (1 - ringScale));
  // edge spalls: the drop per outline vertex (wall top and shoulder roll come down together)
  const wallH = t - bevel;
  const drop = o.rimDrop ? outer.map((p) => Math.min(0.9 * wallH, Math.max(0, o.rimDrop!(p.x, p.z)))) : null;
  const dropAt = (i: number) => (drop ? drop[i] : 0);
  const sideCrackFn = o.sideCrackFn;
  /** the three vertices' crack coordinates for one wall triangle */
  const sideCrackOf = (a: Vector3, b: Vector3, c: Vector3): readonly number[] => {
    if (!sideCrackFn) return NO_CRACK;
    const ca = sideCrackFn(a.x, a.y, a.z);
    const cb = sideCrackFn(b.x, b.y, b.z);
    const cc = sideCrackFn(c.x, c.y, c.z);
    return [ca[0], ca[1], cb[0], cb[1], cc[0], cc[1]];
  };

  const earthBefore = mb.currentEarth;

  if (o.farLod) {
    // the far LOD: the top as one fan from the OUTER outline (the walls' footprint, so the joint
    // between two far slabs keeps the near joint's width) at the shoulder ring's height. The rim
    // takes the full slab's outer top ring's values: its per-quad tone is sampled at that ring's
    // mean edge ((1 + rings/(rings+1)) / 2) and its moss is the shoulder's 0.7 × mossEdge.
    mb.currentEarth = o.earthTop ?? earthBefore;
    mb.beginGroup();
    const rimEdge = (1 + rings / (rings + 1)) / 2;
    const rimMoss = mossEdge * 0.7;
    const rimY = (i: number) => topY(top[i], 1) - 0.85 * dropAt(i);
    const rimCol = (p: P2) => shade(col, 'top', p.x, p.z, 1, rimEdge);
    const rimMossAt = (p: P2) => rimMoss * mossFn(p.x, p.z) + mossAdd(p.x, p.z, 1);
    if (!fanCentre) {
      // a non-star-shaped outline (rare): its exact boundary triangulated, rim values throughout
      const triangles = ShapeUtils.triangulateShape(outer.map((p) => new Vector2(p.x, p.z)), []);
      for (const tri of triangles) {
        const idx = polygonArea(tri.map((i) => outer[i])) > 0 ? [...tri].reverse() : tri;
        const [p, q, r] = idx.map((i) => outer[i]);
        _a.set(p.x, rimY(idx[0]), p.z);
        _b.set(q.x, rimY(idx[1]), q.z);
        _c.set(r.x, rimY(idx[2]), r.z);
        const tc = colorFn ? ([rimCol(p), rimCol(q), rimCol(r)] as const) : col;
        mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(r), tc, [rimMossAt(p), rimMossAt(q), rimMossAt(r)], undefined, undefined, wear, crackOf(p, q, r), mottleOf(p, q, r, 1, 1, 1));
      }
    } else {
      _c.set(c.x, topY(c, 0), c.z);
      const mC = mossInner * mossFn(c.x, c.z) + mossAdd(c.x, c.z, 0);
      const cC = colorFn ? shade(col, 'top', c.x, c.z, 1, 0) : col;
      for (let i = 0; i < n; i++) {
        const i1 = (i + 1) % n;
        const p = outer[i];
        const q = outer[i1];
        _a.set(p.x, rimY(i), p.z);
        _b.set(q.x, rimY(i1), q.z);
        const tc = colorFn ? ([rimCol(p), rimCol(q), cC] as const) : col;
        mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(c), tc, [rimMossAt(p), rimMossAt(q), mC], undefined, undefined, wear, crackOf(p, q, c), mottleOf(p, q, c, 1, 1, 0));
      }
    }
    mb.smoothGroup();
    mb.currentEarth = earthBefore;
    return;
  }

  // --- side walls (flat) ---
  const sideUp = o.sideNormalUp ?? 0;
  const sideWear = o.sideWear ?? 0;
  mb.currentEarth = o.earthSides ?? earthBefore;
  for (let i = 0; i < n; i++) {
    const p = outer[i];
    const q = outer[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const u0 = (i * 0.37) % 1;
    _a.set(p.x, 0, p.z);
    _b.set(q.x, 0, q.z);
    _c.set(q.x, wallH - dropAt((i + 1) % n), q.z);
    _d.set(p.x, wallH - dropAt(i), p.z);
    // the wall's outward normal ((b − a) × (c − a) of the quad's first triangle), tilted up
    let sideN: Vector3 | undefined;
    if (sideUp > 0 && len > 1e-6) {
      sideN = _n.set((-(q.z - p.z) / len) * (1 - sideUp), sideUp, ((q.x - p.x) / len) * (1 - sideUp)).normalize();
    }
    _ua.set(u0 + uvO[0], uvO[1]);
    _ub.set(u0 + len * uvS + uvO[0], uvO[1]);
    _uc.set(u0 + len * uvS + uvO[0], (t - bevel) * uvS + uvO[1]);
    _ud.set(u0 + uvO[0], (t - bevel) * uvS + uvO[1]);
    // grime: darker toward the bottom, as a foot → shoulder gradient in the vertex colour (the foot
    // vertices a, b take the grime factor, the shoulder vertices c, d the clean tone). Until
    // 2026-09-24 the factor sat on the quad's first triangle whole and the second went clean: every
    // wall quad was a dark triangle beside a light one, split on its diagonal — the patchwork of
    // facets on the flights' risers at the tread poses (fable-5's read of #61). Moss on the lower side.
    const mSide = mossEdge * 0.8 * mossFn(p.x, p.z);
    const aP = mossAdd(p.x, p.z, 1);
    const aQ = mossAdd(q.x, q.z, 1);
    const mx = (p.x + q.x) / 2;
    const mz = (p.z + q.z) / 2;
    const cFoot = shade(scol, 'side', mx, mz, o.sideGrime ?? 0.75);
    const cTop = shade(scol, 'side', mx, mz);
    // soil stain: a, b at the foot, c, d at the shoulder ring
    mb.tri(_a, _b, _c, _ua, _ub, _uc, [cFoot, cFoot, cTop], [mSide + aP, mSide + aQ, mSide * 0.5 + aQ], sideN, [sideStain, sideStain, 0], sideWear, sideCrackOf(_a, _b, _c));
    mb.tri(_a, _c, _d, _ua, _uc, _ud, [cFoot, cTop, cTop], [mSide + aP, mSide * 0.5 + aQ, mSide * 0.5 + aP], sideN, [sideStain, 0, 0], sideWear, sideCrackOf(_a, _c, _d));
  }

  // --- bevel ring (smooth): one chamfer band, or `bevelRings` bands on a quarter-round ---
  // (the shoulder ring and the top face carry the slab's `earthTop`; the walls carry `earthSides`)
  mb.currentEarth = o.earthTop ?? earthBefore;
  mb.beginGroup();
  const bands = Math.max(1, Math.round(o.bevelRings ?? 1));
  // ring j of the roll: horizontal blend outer → top ring by 1 − cos, height by sin (convex);
  // a spalled vertex brings the wall top and the shoulder down by its drop (the top ring by 0.85
  // of it, so the roll still rolls into the chip)
  const rollRing = (j: number): { pts: P2[]; ys: number[]; m: number } => {
    if (j === 0) return { pts: outer, ys: outer.map((_, i) => wallH - dropAt(i)), m: 1 };
    if (j === bands) return { pts: top, ys: top.map((p, i) => topY(p, 1) - 0.85 * dropAt(i)), m: 0.7 };
    const th = (j / bands) * (Math.PI / 2);
    const s = 1 - Math.cos(th);
    const k = Math.sin(th);
    return {
      pts: outer.map((p, i) => ({ x: p.x + (top[i].x - p.x) * s, z: p.z + (top[i].z - p.z) * s })),
      ys: outer.map((_, i) => wallH - dropAt(i) + (topY(top[i], 1) - 0.85 * dropAt(i) - (wallH - dropAt(i))) * k),
      m: 1 - 0.3 * (j / bands),
    };
  };
  for (let j = 0; j < bands; j++) {
    const lo = rollRing(j);
    const hi = rollRing(j + 1);
    for (let i = 0; i < n; i++) {
      const i1 = (i + 1) % n;
      const p = lo.pts[i];
      const q = lo.pts[i1];
      const pi = hi.pts[i];
      const qi = hi.pts[i1];
      _a.set(p.x, lo.ys[i], p.z);
      _b.set(q.x, lo.ys[i1], q.z);
      _c.set(qi.x, hi.ys[i1], qi.z);
      _d.set(pi.x, hi.ys[i], pi.z);
      // moss / colour keyed to the outline vertex (the rings are homothetic per vertex)
      const op = outer[i];
      const oq = outer[i1];
      const aP = mossAdd(op.x, op.z, 1);
      const aQ = mossAdd(oq.x, oq.z, 1);
      const mP = mossEdge * mossFn(op.x, op.z);
      const mQ = mossEdge * mossFn(oq.x, oq.z);
      const bc = shade(bcol, 'bevel', (p.x + q.x + pi.x + qi.x) / 4, (p.z + q.z + pi.z + qi.z) / 4);
      mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(qi), bc, [mP * lo.m + aP, mQ * lo.m + aQ, mQ * hi.m + aQ], undefined, undefined, wear, crackOf(p, q, qi), mottleOf(p, q, qi, 1, 1, 1));
      mb.tri(_a, _c, _d, topUv(p), topUv(qi), topUv(pi), bc, [mP * lo.m + aP, mQ * hi.m + aQ, mP * hi.m + aP], undefined, undefined, wear, crackOf(p, qi, pi), mottleOf(p, qi, pi, 1, 1, 1));
    }
  }
  if (!o.softBevel) mb.smoothGroup();

  // --- top: concentric rings toward the centroid, then a fan ---
  if (!o.softBevel) mb.beginGroup();
  if (!fanCentre) {
    // Rare non-star-shaped outlines cannot use one radial crown. Triangulate their exact
    // boundary instead, preserving shoulder contact, UVs, noise and material attributes.
    const triangles = ShapeUtils.triangulateShape(top.map((p) => new Vector2(p.x, p.z)), []);
    for (const tri of triangles) {
      const idx = polygonArea(tri.map((i) => top[i])) > 0 ? [...tri].reverse() : tri;
      const [p, q, r] = idx.map((i) => top[i]);
      _a.set(p.x, topY(p, 1) - 0.85 * dropAt(idx[0]), p.z);
      _b.set(q.x, topY(q, 1) - 0.85 * dropAt(idx[1]), q.z);
      _c.set(r.x, topY(r, 1) - 0.85 * dropAt(idx[2]), r.z);
      const mossAt = (v: P2) => mossEdge * 0.7 * mossFn(v.x, v.z) + mossAdd(v.x, v.z, 1);
      const tc = colorFn ? (vertexTone ? ([shade(col, 'top', p.x, p.z, 1, 1), shade(col, 'top', q.x, q.z, 1, 1), shade(col, 'top', r.x, r.z, 1, 1)] as const) : shade(col, 'top', (p.x + q.x + r.x) / 3, (p.z + q.z + r.z) / 3, 1, 1)) : col;
      mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(r), tc, [mossAt(p), mossAt(q), mossAt(r)], undefined, undefined, wear, crackOf(p, q, r), mottleOf(p, q, r, 1, 1, 1));
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
      // the outermost ring is the shoulder's top ring: it carries the spall drops
      const dA = r === 0 ? 0.85 : 0;
      for (let i = 0; i < n; i++) {
        const p = A[i];
        const q = A[(i + 1) % n];
        const pi = B[i];
        const qi = B[(i + 1) % n];
        _a.set(p.x, topY(p, sA) - dA * dropAt(i), p.z);
        _b.set(q.x, topY(q, sA) - dA * dropAt((i + 1) % n), q.z);
        _c.set(qi.x, topY(qi, sB), qi.z);
        _d.set(pi.x, topY(pi, sB), pi.z);
        const m1 = mA * mossFn(p.x, p.z) + mossAdd(p.x, p.z, sA);
        const m2 = mA * mossFn(q.x, q.z) + mossAdd(q.x, q.z, sA);
        const m3 = mB * mossFn(qi.x, qi.z) + mossAdd(qi.x, qi.z, sB);
        const m4 = mB * mossFn(pi.x, pi.z) + mossAdd(pi.x, pi.z, sB);
        if (vertexTone && colorFn) {
          const cp = shade(col, 'top', p.x, p.z, 1, sA);
          const cq = shade(col, 'top', q.x, q.z, 1, sA);
          const cqi = shade(col, 'top', qi.x, qi.z, 1, sB);
          const cpi = shade(col, 'top', pi.x, pi.z, 1, sB);
          mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(qi), [cp, cq, cqi], [m1, m2, m3], undefined, undefined, wear, crackOf(p, q, qi), mottleOf(p, q, qi, sA, sA, sB));
          mb.tri(_a, _c, _d, topUv(p), topUv(qi), topUv(pi), [cp, cqi, cpi], [m1, m3, m4], undefined, undefined, wear, crackOf(p, qi, pi), mottleOf(p, qi, pi, sA, sB, sB));
          continue;
        }
        const tc = colorFn ? shade(col, 'top', (p.x + q.x + pi.x + qi.x) / 4, (p.z + q.z + pi.z + qi.z) / 4, 1, (sA + sB) / 2) : col;
        mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(qi), tc, [m1, m2, m3], undefined, undefined, wear, crackOf(p, q, qi), mottleOf(p, q, qi, sA, sA, sB));
        mb.tri(_a, _c, _d, topUv(p), topUv(qi), topUv(pi), tc, [m1, m3, m4], undefined, undefined, wear, crackOf(p, qi, pi), mottleOf(p, qi, pi, sA, sB, sB));
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
      const tc = colorFn ? (vertexTone ? ([shade(col, 'top', p.x, p.z, 1, sL), shade(col, 'top', q.x, q.z, 1, sL), shade(col, 'top', c.x, c.z, 1, 0)] as const) : shade(col, 'top', (p.x + q.x + c.x) / 3, (p.z + q.z + c.z) / 3, 1, sL / 2)) : col;
      mb.tri(_a, _b, _c, topUv(p), topUv(q), topUv(c), tc, [mL, mQ, mC], undefined, undefined, wear, crackOf(p, q, c), mottleOf(p, q, c, sL, sL, 0));
    }
  }
  mb.smoothGroup();
  mb.currentEarth = earthBefore;

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
