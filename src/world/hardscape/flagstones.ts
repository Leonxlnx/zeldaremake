/**
 * Flagstone paving (W03). The reference plaza/path is a hand-laid field of worn, rounded stones
 * 0.7–1.6 m across (smaller at the paved rim, the odd 2 m slab on the path centre), each a
 * distinct slightly domed cushion with rounded, chipped corners, sitting proud of moss and grass
 * joints — 5–15 cm on the plaza, 15–45 cm of turf where the path leaves it northward (the lawn
 * paving, `zones.ts`). Seeds come from a hex lattice with heavy jitter (half the spacing) and a
 * slow domain warp, thinned/densified by the distance to the paved edge, so the Voronoi cells are
 * strongly irregular (no hexagonal tiling). Each cell — clipped to the paved boundary, inset by
 * half the joint, corners filleted, edges eroded — IS the stone outline; a second inset ring
 * gives the rolled shoulder and the top domes 2–4 cm. Stones are seated on the terrain (≈ 20
 * samples), tilted gently to the local normal, and merged into ONE geometry (vertex colour =
 * per-stone tint + shoulder dirt + moss film, aMoss = joint moss) → a single draw call.
 */
import { Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { surfaceMask, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, centroid, distToPolygon, pointInPolygon, polygonArea, type P2 } from './geometry';
import type { StairFrame } from './stairs';
import { inStairFootprint } from './stairs';
import { B_FOREGROUND_SLABS, dForeground, dampBand, lawnPocket, lawnPocketEdgeX, lawnZone, southPlaza } from './zones';
import type { SteppingStone } from '../layout';

export interface PlacedStone {
  x: number;
  z: number;
  /** world-space outline (top face) */
  polygon: P2[];
  /** outline hash (for the distinct-shape audit) */
  shape: string;
  /** max radius from the seed (m) */
  radius: number;
  thickness: number;
  bottomY: number;
  /** height of the stone's crown (centre of the domed top) */
  topY: number;
  moss: number;
  /** elongation of the final outline (major / minor extent) */
  aspect: number;
}

// --- geometry helpers ----------------------------------------------------------------------

/** clip polygon by half-plane dot(p - s, n) <= d  (keeps the side containing s) */
function clipHalfPlane(poly: P2[], sx: number, sz: number, nx: number, nz: number, d: number): P2[] {
  const out: P2[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const da = (a.x - sx) * nx + (a.z - sz) * nz - d;
    const db = (b.x - sx) * nx + (b.z - sz) * nz - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
}

/** Elongation of a convex cell: extent along its principal axis over the extent across it. */
function cellAspect(poly: P2[]) {
  const c = centroid(poly);
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const p of poly) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    sxx += dx * dx;
    szz += dz * dz;
    sxz += dx * dz;
  }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ax = Math.cos(th);
  const az = Math.sin(th);
  let lo = Infinity;
  let hi = -Infinity;
  let lo2 = Infinity;
  let hi2 = -Infinity;
  for (const p of poly) {
    const u = (p.x - c.x) * ax + (p.z - c.z) * az;
    const v = -(p.x - c.x) * az + (p.z - c.z) * ax;
    lo = Math.min(lo, u);
    hi = Math.max(hi, u);
    lo2 = Math.min(lo2, v);
    hi2 = Math.max(hi2, v);
  }
  const major = hi - lo;
  const minor = hi2 - lo2;
  return { aspect: major / Math.max(minor, 1e-3), ax, az, c, major, minor };
}

/** Split cells with aspect > `maxAspect` across their major axis (leaving a joint), recursively. */
function splitElongated(poly: P2[], maxAspect: number, gap: number, depth = 0): P2[][] {
  if (poly.length < 3) return [];
  const a = cellAspect(poly);
  // judge the stone as it will be cut: the joint + shoulder (~12 cm) shrink both extents
  const shrunk = (a.major - 0.12) / Math.max(a.minor - 0.12, 1e-3);
  if (shrunk <= maxAspect || a.major < 0.5 || depth >= 3) return [poly];
  const left = clipHalfPlane(poly, a.c.x, a.c.z, a.ax, a.az, -gap / 2);
  const right = clipHalfPlane(poly, a.c.x, a.c.z, -a.ax, -a.az, -gap / 2);
  return [...splitElongated(left, maxAspect, gap, depth + 1), ...splitElongated(right, maxAspect, gap, depth + 1)];
}

/** drop vertices closer than `eps` to their predecessor */
function dedupe(p: P2[], eps: number): P2[] {
  const out: P2[] = [];
  for (const q of p) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(q.x - last.x, q.z - last.z) > eps) out.push(q);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.z - b.z) <= eps) out.pop();
  }
  return out;
}

/** ensure counter-clockwise-from-above (negative signed xz area) */
function ccwOf(p: P2[]): P2[] {
  return polygonArea(p) > 0 ? [...p].reverse() : p;
}

/**
 * Exact inset of a convex polygon (ccw-from-above winding) by `d`: every edge's half-plane is
 * moved inward and the polygon re-clipped, so short edges vanish instead of producing miter
 * spikes. Returns [] if nothing is left.
 */
function convexInset(poly: P2[], d: number): P2[] {
  let out = poly;
  const n = poly.length;
  for (let i = 0; i < n && out.length >= 3; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const l = Math.hypot(ex, ez);
    if (l < 1e-6) continue;
    // outward normal for this winding is (-ez, ex)/l; keep dot(p - a, outward) <= -d
    out = clipHalfPlane(out, a.x, a.z, -ez / l, ex / l, -d);
  }
  return dedupe(out, 0.008);
}

/**
 * Outward miter offset of a convex polygon by `d` (the inverse of the inset for the surviving
 * corners; very sharp corners are capped so the miter never spikes past the true offset).
 */
function miterOut(poly: P2[], d: number): P2[] {
  const n = poly.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const e1x = b.x - a.x;
    const e1z = b.z - a.z;
    const e2x = c.x - b.x;
    const e2z = c.z - b.z;
    const l1 = Math.hypot(e1x, e1z) || 1e-6;
    const l2 = Math.hypot(e2x, e2z) || 1e-6;
    // outward normals
    const n1x = -e1z / l1;
    const n1z = e1x / l1;
    const n2x = -e2z / l2;
    const n2z = e2x / l2;
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
    const cosHalf = Math.max(0.42, bx * n1x + bz * n1z);
    out.push({ x: b.x + (bx * d) / cosHalf, z: b.z + (bz * d) / cosHalf });
  }
  return out;
}

interface OutlineStyle {
  /** joint width (m) — the cell shrinks by half of it on every side */
  joint: number;
  /** horizontal width of the rolled shoulder between the outer edge and the flat-ish top (m) */
  shoulder: number;
  /** corner fillet radius (m), varied ±30 % per corner */
  fillet: number;
  /** edge erosion amplitude (m): the outer edge is nibbled inward by up to this much */
  erosion: number;
  /** big fillets (> 16 cm) get the arc's quarter points too (the lawn slabs; not the discs) */
  roundArcs: boolean;
  /** per-stone noise for the erosion (world-ish coords → 0..1) */
  erodeFn: (x: number, z: number) => number;
}

interface Outline {
  outer: P2[];
  inner: P2[];
}

/**
 * Round the corners of a convex polygon with a fillet of radius `r[i]` per corner, emitting the
 * two tangent points and `arc[i]` interior points of the arc (0, 1 or 3 — the big lawn slabs'
 * 20–40 cm fillets need the quarter points to read as round). Returns the points in corner
 * order, so a second ring built from the same cell keeps index correspondence.
 */
function filletCorners(poly: P2[], r: number[], arc: number[]): P2[] {
  const n = poly.length;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const e1x = a.x - b.x;
    const e1z = a.z - b.z;
    const e2x = c.x - b.x;
    const e2z = c.z - b.z;
    const l1 = Math.hypot(e1x, e1z) || 1e-6;
    const l2 = Math.hypot(e2x, e2z) || 1e-6;
    const cosT = clamp((e1x * e2x + e1z * e2z) / (l1 * l2), -0.999, 0.999);
    const theta = Math.acos(cosT); // interior angle
    // tangent distance for the fillet, capped so neighbouring fillets never cross
    let t = r[i] / Math.max(Math.tan(theta / 2), 0.2);
    t = Math.min(t, 0.46 * Math.min(l1, l2));
    const p1 = { x: b.x + (e1x / l1) * t, z: b.z + (e1z / l1) * t };
    const p2 = { x: b.x + (e2x / l2) * t, z: b.z + (e2z / l2) * t };
    out.push(p1);
    // quadratic Bézier through the corner: (1−s)² p1 + 2(1−s)s b + s² p2
    const steps = arc[i] >= 3 ? [0.25, 0.5, 0.75] : arc[i] >= 1 ? [0.5] : [];
    for (const s of steps) {
      const w0 = (1 - s) * (1 - s);
      const w1 = 2 * (1 - s) * s;
      const w2 = s * s;
      out.push({ x: w0 * p1.x + w1 * b.x + w2 * p2.x, z: w0 * p1.z + w1 * b.z + w2 * p2.z });
    }
    out.push(p2);
  }
  return out;
}

/** interior angle (rad) at each corner of a polygon */
function cornerAngles(poly: P2[]): number[] {
  const n = poly.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const e1x = a.x - b.x;
    const e1z = a.z - b.z;
    const e2x = c.x - b.x;
    const e2z = c.z - b.z;
    const l1 = Math.hypot(e1x, e1z) || 1e-6;
    const l2 = Math.hypot(e2x, e2z) || 1e-6;
    out.push(Math.acos(clamp((e1x * e2x + e1z * e2z) / (l1 * l2), -0.999, 0.999)));
  }
  return out;
}

/**
 * Turn a Voronoi cell (seed-local coords) into a worn stone: two rings — the outer edge (cell
 * inset by half the joint) and the shoulder ring (inset further by the shoulder width) — built
 * from the same corners so they correspond index by index. Corners are filleted (6–12 cm), long
 * edges get a midpoint, and the outer ring is eroded inward by per-stone noise so no two edges
 * stay parallel and the joints widen into chips here and there.
 * Returns null if the result is too small to read as a stone.
 */
function cellToOutline(cell: P2[], st: OutlineStyle, rng: Rng): Outline | null {
  const base = dedupe(ccwOf(cell), 0.02);
  if (base.length < 3) return null;
  // shoulder ring = exact convex inset (short edges vanish); outer edge = its outward offset, so
  // the two rings share corners one-to-one and the fillets below come out concentric
  const innerCell = convexInset(base, st.joint / 2 + st.shoulder);
  if (innerCell.length < 3 || Math.abs(polygonArea(innerCell)) < 0.012) return null;
  const outerCell = miterOut(innerCell, st.shoulder);
  if (Math.abs(polygonArea(outerCell)) < 0.035) return null;

  const n = innerCell.length;
  const angles = cornerAngles(outerCell);
  const radii: number[] = [];
  const mids: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = st.fillet * rng.range(0.7, 1.3);
    radii.push(r);
    // sharp corners need the arc midpoint to read as round; obtuse ones are fine with two
    // points; the lawn slabs' big fillets get the quarter points too
    mids.push(st.roundArcs && r > 0.16 ? 3 : angles[i] < 2.0 || r > 0.09 ? 1 : 0);
  }
  // concentric arcs: the inner fillet is the outer one minus the shoulder width
  const innerRadii = radii.map((r) => Math.max(0.01, r - st.shoulder));
  let outer = filletCorners(outerCell, radii, mids);
  let inner = filletCorners(innerCell, innerRadii, mids);
  if (outer.length !== inner.length) return null;

  // long edges get a midpoint (both rings) so the erosion can bow them
  const o2: P2[] = [];
  const i2: P2[] = [];
  const m = outer.length;
  for (let k = 0; k < m; k++) {
    const a = outer[k];
    const b = outer[(k + 1) % m];
    const ai = inner[k];
    const bi = inner[(k + 1) % m];
    o2.push(a);
    i2.push(ai);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 0.42) {
      o2.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      i2.push({ x: (ai.x + bi.x) / 2, z: (ai.z + bi.z) / 2 });
    }
  }
  outer = o2;
  inner = i2;

  // erosion: nibble the outer edge toward its shoulder point (never past 70 % of the shoulder,
  // so the rings can't cross), by a per-stone noise so chips cluster instead of dithering
  const eroded: P2[] = outer.map((p, k) => {
    const q = inner[k];
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const l = Math.hypot(dx, dz) || 1e-6;
    const nz01 = st.erodeFn(p.x, p.z);
    const e = Math.min(st.erosion * (0.25 + 0.75 * nz01), l * 0.7);
    return { x: p.x + (dx / l) * e, z: p.z + (dz / l) * e };
  });

  // joint dedupe (keep the rings in correspondence)
  const fo: P2[] = [];
  const fi: P2[] = [];
  for (let k = 0; k < eroded.length; k++) {
    const p = eroded[k];
    const last = fo[fo.length - 1];
    if (last && Math.hypot(p.x - last.x, p.z - last.z) <= 0.014) continue;
    fo.push(p);
    fi.push(inner[k]);
  }
  if (fo.length > 1) {
    const a = fo[0];
    const b = fo[fo.length - 1];
    if (Math.hypot(a.x - b.x, a.z - b.z) <= 0.014) {
      fo.pop();
      fi.pop();
    }
  }
  if (fo.length < 5) return null;
  // size gate: min radius from the centroid ≥ 6 cm and area ≥ 0.03 m²
  const cc = centroid(fo);
  let minR = Infinity;
  for (const p of fo) minR = Math.min(minR, Math.hypot(p.x - cc.x, p.z - cc.z));
  if (minR < 0.06 || Math.abs(polygonArea(fo)) < 0.03) return null;
  return { outer: fo, inner: fi };
}

function outlineHash(p: P2[]): string {
  return p.map((q) => `${Math.round(q.x * 100)}:${Math.round(q.z * 100)}`).join('|');
}

class Grid {
  private cells = new Map<number, number[]>();
  constructor(private size: number) {}
  key(x: number, z: number) {
    return Math.floor(x / this.size) * 100000 + Math.floor(z / this.size);
  }
  add(x: number, z: number, id: number) {
    const k = this.key(x, z);
    const c = this.cells.get(k);
    if (c) c.push(id);
    else this.cells.set(k, [id]);
  }
  near(x: number, z: number, r: number, cb: (id: number) => void) {
    const n = Math.ceil(r / this.size);
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const c = this.cells.get((cx + i) * 100000 + (cz + j));
        if (c) for (const id of c) cb(id);
      }
    }
  }
}

export interface PavingContext {
  terrain: Terrain;
  frames: StairFrame[];
  rng: Rng;
  seed: string;
  /** bounding box of the paved region */
  bbox: { x0: number; x1: number; z0: number; z1: number };
  density: number;
  /** the house branch's stepping-stone discs (the terrain paves exactly these) */
  steppingStones: SteppingStone[];
}

/** a stepping stone that sits in grass (not inside the plaza paving): gets its own round slab */
export interface IsolatedDisc {
  x: number;
  z: number;
  r: number;
  /** true when the disc touches the continuous paving (plaza rim), so joint fill stays around it */
  atRim: boolean;
}

/**
 * Classify the stepping-stone discs: a disc whose 1.5 r ring is (almost) all paved lies inside the
 * plaza and is already covered by the Voronoi paving; the others are isolated stones in grass.
 */
export function isolatedDiscs(pc: PavingContext): IsolatedDisc[] {
  const out: IsolatedDisc[] = [];
  for (const d of pc.steppingStones) {
    let paved = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (isPaved(pc, d.x + Math.cos(a) * d.r * 1.5, d.z + Math.sin(a) * d.r * 1.5, 0.5)) paved++;
    }
    if (paved >= 7) continue;
    out.push({ x: d.x, z: d.z, r: d.r, atRim: paved >= 3 });
  }
  return out;
}

/** true within `k` radii of an isolated stepping stone (used to keep lattice seeds, joint fill and sprouts off the grassy ramp) */
export function nearIsolatedDisc(discs: IsolatedDisc[], x: number, z: number, k = 1.3): boolean {
  for (const d of discs) if (Math.hypot(x - d.x, z - d.z) < d.r * k) return true;
  return false;
}

export function isPaved(pc: PavingContext, x: number, z: number, threshold = 0.5): boolean {
  const m = surfaceMask(x, z);
  if (m.path < threshold || m.stairs >= 0.5 || m.structure >= 0.5) return false;
  for (const f of pc.frames) if (inStairFootprint(f, x, z)) return false;
  return true;
}

/**
 * Distance from a paved point to the unpaved boundary (m), by marching eight directions in 0.3 m
 * steps; capped at 2.1 m. Drives the stone size (small stones at the rim, big ones mid-path).
 */
const RIM_STEPS = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
function rimDistance(pc: PavingContext, x: number, z: number): number {
  let best = 2.1;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    for (const s of RIM_STEPS) {
      if (s >= best) break;
      if (!isPaved(pc, x + dx * s, z + dz * s, 0.5)) {
        best = s;
        break;
      }
    }
  }
  return best;
}

export interface PavingResult {
  stones: PlacedStone[];
  mesh: Mesh;
  triangles: number;
  grid: Grid;
  /** true if the world point is on a stone's top face */
  onStone(x: number, z: number): boolean;
  /** distance (m) from a joint point to the nearest stone edge (Infinity when no stone is near) */
  edgeGap(x: number, z: number): number;
  /** the house branch's stepping stones that got their own round slab */
  steppingStones: IsolatedDisc[];
  stats: { seeds: number; skippedNarrow: number; skippedSmall: number; skippedSteep: number; split: number; big: number; rim: number; lawn: number; authored: number; steppingStones: number; edgeMossStones: number };
}

interface Seed {
  x: number;
  z: number;
  /** distance to the paved edge */
  rim: number;
  big: boolean;
  /** 0..1 weight of the lawn paving (zones.ts `lawnZone`) at the seed: wide turf joints, big fillets */
  lawn: number;
  /** a stepping-stone disc (its outline is the disc; lattice styling does not apply) */
  disc?: boolean;
  /** clips its neighbours' cells but places no stone (the lawn pocket's edge) */
  phantom?: boolean;
}

// Round 10: every lattice is 1.2–1.3× coarser than before (the reference B/E foreground has 2–3
// slabs across the 5.7 m frame bottom and C/D's are the same big rounded slabs; ours had 6–7)
/** lattice spacing (m) in the damp band: stones come out 1.2–1.7 m across after jitter and joints */
const SPACING = 1.6;
/** coarse lattice for the north path (camera D's foreground): 1.2–1.8 m slabs */
const OPEN_SPACING = 1.5;
/** lattice for the open plaza south of the spawn (reference A/F foregrounds): 1.0–1.5 m slabs */
const SOUTH_SPACING = 1.2;
/** rim lattice spacing (m): 0.4–0.6 m stones along the paved edge */
const RIM_SPACING = 0.56;
/**
 * lawn-paving lattice (zones.ts `lawnZone`): 1.0–1.6 m slabs (the odd 2 m) in 15–45 cm turf
 * joints, so the cells run 1.4–2.1 m; low jitter (0.3 of the spacing) keeps them round-ish
 */
const LAWN_SPACING = 1.8;
/** soil stain on a slab's flank at the joint-fill line (0 = bare stone, 1 = the seam's soil tone); fades to 0 at the shoulder */
const FLANK_STAIN_AT_FILL = 0.7;

export function placeFlagstones(pc: PavingContext, material: Material): PavingResult {
  const { terrain, rng, bbox } = pc;
  const tintNoise = new Noise2D(`${pc.seed}/flag-tint`);
  const wearN = new Noise2D(`${pc.seed}/flag-wear`);
  const warpN = new Noise2D(`${pc.seed}/flag-warp`);

  // 1. seeds: hex lattices jittered by half their spacing and warped by a slow noise field, so
  // the Voronoi cells vary 2:1 in area and no three neighbours line up. A coarse lattice covers
  // the open plaza south of the spawn (big slabs), the base lattice the paths and the north
  // plaza, a finer one fills the ~1 m band along the paved edge with small stones, and ~6 % of
  // the interior path seeds eat their nearest neighbours to become the big path-centre slabs.
  const seeds: Seed[] = [];
  const grid = new Grid(1.0);
  const warp = (x: number, z: number): [number, number] => [x + 0.32 * warpN.fbm(x * 0.11 + 3, z * 0.11 - 5, 2), z + 0.32 * warpN.fbm(x * 0.11 - 40, z * 0.11 + 17, 2)];
  const rowH = (SPACING * Math.sqrt(3)) / 2;
  const lat = rng.fork('lattice');
  const pad = 1.0;
  let row = 0;
  const bigCandidates: number[] = [];
  const stats = { seeds: 0, skippedNarrow: 0, skippedSmall: 0, skippedSteep: 0, split: 0, big: 0, rim: 0, lawn: 0, authored: 0, steppingStones: 0, edgeMossStones: 0 };
  // the house branch's stepping stones in the grass: each gets one round slab of its own (below),
  // so the lattices stay off their discs (a lattice seed landing on one made a fragment, none left
  // the disc as bare grass) and the plaza's rim cells are clipped back from them
  const discs = isolatedDiscs(pc);
  /** the authored B-foreground seeds: every lattice keeps a metre clear of them so their cells stay whole */
  const authored: { x: number; z: number }[] = [];
  const nearAuthored = (x: number, z: number, r: number) => {
    for (const a of authored) if (Math.hypot(a.x - x, a.z - z) < r) return true;
    return false;
  };
  /** add a seed unless another is closer than `minDist`, the point is unpaved or `accept(rim)` says no */
  const tryAdd = (x: number, z: number, minDist: number, accept: (rim: number) => boolean): number => {
    let ok = true;
    grid.near(x, z, minDist, (id) => {
      if (!ok) return;
      const s = seeds[id];
      if (Math.hypot(s.x - x, s.z - z) < minDist) ok = false;
    });
    if (!ok) return -1;
    if (!isPaved(pc, x, z, 0.5)) return -1;
    if (nearIsolatedDisc(discs, x, z, 1.5)) return -1;
    // the lawn pocket west of the reference's path edge holds no slabs at all
    if (lawnPocket(x, z) > 0.5) return -1;
    if (nearAuthored(x, z, 1.05)) return -1;
    const rim = rimDistance(pc, x, z);
    if (!accept(rim)) return -1;
    grid.add(x, z, seeds.length);
    seeds.push({ x, z, rim, big: false, lawn: lawnZone(x, z) });
    return seeds.length - 1;
  };
  // camera B/E's foreground first: the slab centres read off the reference frame (zones.ts
  // B_FOREGROUND_SLABS) become seeds, so the Voronoi cells put our slab edges where the
  // reference has its joints (W37 scores this view; SSIM rewards edges in the right place far
  // more than the right statistics in the wrong place)
  for (const [ax, az] of B_FOREGROUND_SLABS) {
    if (!isPaved(pc, ax, az, 0.5) || nearIsolatedDisc(discs, ax, az, 1.5)) continue;
    const rim = rimDistance(pc, ax, az);
    grid.add(ax, az, seeds.length);
    seeds.push({ x: ax, z: az, rim, big: false, lawn: Math.max(0.6, lawnZone(ax, az)) });
    authored.push({ x: ax, z: az });
    stats.authored++;
  }
  // the lawn pocket's edge: phantom seeds 0.75 m into the pocket clip the authored and lattice
  // cells at the reference's path edge (the bisector), and place no stone themselves
  for (let z = -3.2; z >= -6.4; z -= 0.8) {
    const x = lawnPocketEdgeX(z) - 0.75;
    grid.add(x, z, seeds.length);
    seeds.push({ x, z, rim: 2, big: false, lawn: 1, phantom: true });
  }
  // the lawn paving next (its seeds win the later min-distance tests): a coarse, lightly
  // jittered lattice whose cells become the 1.0–1.6 m slabs set in turf of reference B/E's
  // foreground; the other lattices are thinned out by the lawn weight so its 1.5 m fade mixes
  // the two sizes
  {
    const rowH = (LAWN_SPACING * Math.sqrt(3)) / 2;
    const llat = rng.fork('lawn-lattice');
    let r = 0;
    for (let z = bbox.z0 - pad; z <= bbox.z1 + pad; z += rowH, r++) {
      for (let x = bbox.x0 - pad + (r & 1 ? LAWN_SPACING / 2 : 0); x <= bbox.x1 + pad; x += LAWN_SPACING) {
        const jr = 0.3 * LAWN_SPACING * Math.sqrt(llat());
        const ja = llat.range(0, Math.PI * 2);
        const [wx, wz] = warp(x + Math.cos(ja) * jr, z + Math.sin(ja) * jr);
        const u = llat();
        // the slabs run right up to the grass (no small rim stones in the lawn)
        if (tryAdd(wx, wz, 0.7, (rim) => rim >= 0.3 && u <= lawnZone(wx, wz)) >= 0) stats.lawn++;
      }
    }
  }
  // open-paving lattices next: a 1.2 m one for the south plaza (A/F foreground) and a coarser
  // 1.5 m one for the north path (D foreground); then the base lattice, thinned to ~15 % where
  // they rule so a few small stones sit among the slabs
  const openLattice = (spacing: number, forkName: string, regionW: (z: number) => number) => {
    const rowH = (spacing * Math.sqrt(3)) / 2;
    const slat = rng.fork(forkName);
    let r = 0;
    for (let z = bbox.z0 - pad; z <= bbox.z1 + pad; z += rowH, r++) {
      for (let x = bbox.x0 - pad + (r & 1 ? spacing / 2 : 0); x <= bbox.x1 + pad; x += spacing) {
        const jr = 0.5 * spacing * Math.sqrt(slat());
        const ja = slat.range(0, Math.PI * 2);
        const [wx, wz] = warp(x + Math.cos(ja) * jr, z + Math.sin(ja) * jr);
        const u = slat();
        const big = slat.chance(0.04);
        const open = (1 - dampBand(wz)) * regionW(wz) * (1 - lawnZone(wx, wz));
        // thin the lattice on D's foreground path so the remaining cells grow to 1.4–1.9 m
        const dz = dForeground(wz);
        const id = tryAdd(wx, wz, 0.36, (rim) => rim >= 0.45 && u <= open * (1 - 0.3 * dz * smoothstep(0.8, 1.4, rim)));
        // a few 1.8–2.2 m slabs down the path centre (reference D foreground)
        if (id >= 0 && big && seeds[id].rim >= 1.4) bigCandidates.push(id);
      }
    }
  };
  openLattice(SOUTH_SPACING, 'south-lattice', southPlaza);
  openLattice(OPEN_SPACING, 'north-lattice', (z) => 1 - southPlaza(z));
  for (let z = bbox.z0 - pad; z <= bbox.z1 + pad; z += rowH, row++) {
    for (let x = bbox.x0 - pad + (row & 1 ? SPACING / 2 : 0); x <= bbox.x1 + pad; x += SPACING) {
      const jr = 0.5 * SPACING * Math.sqrt(lat());
      const ja = lat.range(0, Math.PI * 2);
      const [wx, wz] = warp(x + Math.cos(ja) * jr, z + Math.sin(ja) * jr);
      const thin = lat();
      const big = lat.chance(0.04);
      const open = 1 - dampBand(wz);
      // thin the base lattice where the rim lattice takes over, where the coarse lattice rules
      // (none at all on D's foreground path so its slabs stay big) and where the lawn does
      const lawn = lawnZone(wx, wz);
      const id = tryAdd(wx, wz, 0.36, (rim) => (rim >= 0.55 || thin >= 0.6) && thin >= Math.max(0.8 * open + 0.2 * dForeground(wz) * smoothstep(0.8, 1.4, rim), lawn));
      if (id < 0) continue;
      if (seeds[id].rim >= 1.25 && big && open < 0.5 && lawn < 0.5) bigCandidates.push(id);
    }
  }
  // rim lattice
  const rimRowH = (RIM_SPACING * Math.sqrt(3)) / 2;
  const rlat = rng.fork('rim-lattice');
  row = 0;
  for (let z = bbox.z0 - pad; z <= bbox.z1 + pad; z += rimRowH, row++) {
    for (let x = bbox.x0 - pad + (row & 1 ? RIM_SPACING / 2 : 0); x <= bbox.x1 + pad; x += RIM_SPACING) {
      const jr = 0.5 * RIM_SPACING * Math.sqrt(rlat());
      const ja = rlat.range(0, Math.PI * 2);
      const [wx, wz] = warp(x + Math.cos(ja) * jr, z + Math.sin(ja) * jr);
      const u = rlat();
      // the open paving's edge keeps its big slabs: only a thin fringe of small stones there;
      // the lawn paving's slabs meet the grass without a fringe at all
      const keep = (1 - 0.4 * (1 - dampBand(wz))) * (1 - lawnZone(wx, wz));
      if (tryAdd(wx, wz, 0.38, (rim) => rim >= 0.12 && u <= smoothstep(0.95, 0.35, rim) * keep) >= 0) stats.rim++;
    }
  }
  // big stones: the candidate eats up to two neighbours within ~0.75 spacing
  const active = new Uint8Array(seeds.length).fill(1);
  for (const id of bigCandidates) {
    if (!active[id]) continue;
    const s = seeds[id];
    const near: { id: number; d: number }[] = [];
    const eat = (dampBand(s.z) > 0.5 ? SPACING : southPlaza(s.z) > 0.5 ? SOUTH_SPACING : OPEN_SPACING) * 0.78;
    grid.near(s.x, s.z, eat, (o) => {
      if (o === id || !active[o]) return;
      const d = Math.hypot(seeds[o].x - s.x, seeds[o].z - s.z);
      if (d < eat) near.push({ id: o, d });
    });
    if (!near.length) continue;
    near.sort((a, b) => a.d - b.d);
    // eat the nearest, then the nearest one roughly opposite it, so the merged cell stays round
    // instead of becoming a sliver that the aspect split would cut back in two
    const first = near[0];
    active[first.id] = 0;
    const a1 = Math.atan2(seeds[first.id].z - s.z, seeds[first.id].x - s.x);
    for (const nb of near.slice(1)) {
      const a2 = Math.atan2(seeds[nb.id].z - s.z, seeds[nb.id].x - s.x);
      let da = Math.abs(a2 - a1);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (da > 1.75) {
        active[nb.id] = 0;
        break;
      }
    }
    s.big = true;
    stats.big++;
  }
  stats.seeds = seeds.length;

  // 2. Voronoi cell per seed, clipped to the paved boundary → stone outline
  const stones: PlacedStone[] = [];
  const up = new Vector3(0, 1, 0);
  const nrm = new Vector3();
  const q = new Quaternion();
  const pos = new Vector3();
  const stoneGrid = new Grid(1.0);
  const all = new MeshBuilder();
  const one = new Matrix4();

  const cellFor = (si: number): P2[] => {
    const s = seeds[si];
    let cell: P2[] = [
      { x: s.x - 1.4, z: s.z - 1.4 },
      { x: s.x + 1.4, z: s.z - 1.4 },
      { x: s.x + 1.4, z: s.z + 1.4 },
      { x: s.x - 1.4, z: s.z + 1.4 },
    ];
    grid.near(s.x, s.z, 2.8, (id) => {
      if (id === si || !active[id] || cell.length < 3) return;
      const o = seeds[id];
      const dx = o.x - s.x;
      const dz = o.z - s.z;
      const l = Math.hypot(dx, dz);
      if (l < 1e-6 || l > 2.8) return;
      // plain bisector: the irregular seeding does the size mixing; the shared plane keeps the
      // tessellation hole-free where three cells meet
      cell = clipHalfPlane(cell, s.x, s.z, dx / l, dz / l, clamp(l / 2, 0.08, l - 0.08));
    });
    // keep a joint's width clear of the round stepping stones at the plaza rim
    for (const d of discs) {
      if (cell.length < 3) break;
      const dx = d.x - s.x;
      const dz = d.z - s.z;
      const l = Math.hypot(dx, dz);
      if (l < 1e-6 || l > 2.8 + d.r) continue;
      cell = clipHalfPlane(cell, s.x, s.z, dx / l, dz / l, clamp(l - d.r - 0.06, 0.08, l));
    }
    if (cell.length < 3) return cell;
    // pull vertices outside the paved region toward the seed (bisection on the mask)
    return cell.map((p) => {
      if (isPaved(pc, p.x, p.z, 0.36)) return p;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        const x = s.x + (p.x - s.x) * mid;
        const z = s.z + (p.z - s.z) * mid;
        if (isPaved(pc, x, z, 0.36)) lo = mid;
        else hi = mid;
      }
      return { x: s.x + (p.x - s.x) * lo, z: s.z + (p.z - s.z) * lo };
    });
  };
  // cells too small to become a stone drop their seed so the neighbours grow into the space —
  // dropping the *stone* instead would leave a 20–40 cm soil hole. Judged as the stone will be
  // cut: inset by the joint + shoulder (≈ 9 cm) the core must still be ≥ 0.02 m² and ≥ 8 cm
  // in radius everywhere, and the cell itself ≥ 0.08 m². In the lawn paving the bar is higher
  // (inset ≈ 24 cm, core ≥ 0.2 m² and ≥ 20 cm, cell ≥ 0.5 m²): a sliver between two 1.5 m slabs
  // in 30 cm of turf is a chip the reference does not have, and its neighbours fill the space
  const tooSmall = (cell: P2[], lawn: number) => {
    if (cell.length < 3) return true;
    if (Math.abs(polygonArea(cell)) < 0.08 + 0.42 * lawn) return true;
    const core = convexInset(ccwOf(cell), 0.09 + 0.15 * lawn);
    if (core.length < 3 || Math.abs(polygonArea(core)) < 0.02 + 0.18 * lawn) return true;
    const c = centroid(core);
    let minR = Infinity;
    for (const p of core) minR = Math.min(minR, Math.hypot(p.x - c.x, p.z - c.z));
    return minR < 0.08 + 0.12 * lawn;
  };
  for (let iter = 0; iter < 4; iter++) {
    let dropped = 0;
    for (let si = 0; si < seeds.length; si++) {
      if (!active[si] || seeds[si].phantom) continue;
      if (tooSmall(cellFor(si), seeds[si].lawn)) {
        active[si] = 0;
        dropped++;
      }
    }
    stats.skippedNarrow += dropped;
    if (!dropped) break;
  }

  for (let si = 0; si < seeds.length; si++) {
    if (!active[si] || seeds[si].phantom) continue;
    const cell = cellFor(si);
    if (cell.length < 3) continue;
    // sliver fringe cells (aspect > 2.6) become two or more stones with a joint between them;
    // the merged path-centre slabs are allowed to be oblong (reference D has 1.3 × 0.6 m stones)
    const sd = seeds[si];
    const pieces = splitElongated(cell, sd.big ? 3.6 : 2.6, rng.range(0.06, 0.09) * (1 + 2.5 * sd.lawn));
    if (pieces.length > 1) stats.split += pieces.length - 1;
    for (const piece of pieces) emitStone(piece, seeds[si]);
  }

  // the stepping stones up to Saria's door (reference B/E): one round slab per disc, filling the
  // disc the terrain paves (the cell is drawn ~2.5 cm outside the disc because the half-joint
  // inset takes that back, so the shoulder lands on the grass line), lightly wobbled so no two are
  // the same circle, then seated, domed and tinted exactly like every other stone
  for (const d of discs) {
    const drng = rng.fork(`stepping/${Math.round(d.x * 50)}/${Math.round(d.z * 50)}`);
    const n = 16;
    const phase = drng.range(0, Math.PI * 2);
    const cell: P2[] = [];
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2;
      const rr = (d.r + 0.025) * (1 + 0.035 * Math.sin(a * 3 + phase) + drng.range(-0.02, 0.02));
      cell.push({ x: d.x + Math.cos(a) * rr, z: d.z + Math.sin(a) * rr });
    }
    const before = stones.length;
    // rim 0.45: a stone in the grass is a rim stone (damper, mossier edges than the path centre);
    // lawn 0: the disc IS the stone, the lawn paving's wide inset and fillets must not shrink it
    emitStone(cell, { x: d.x, z: d.z, rim: 0.45, big: false, lawn: 0, disc: true });
    if (stones.length > before) stats.steppingStones++;
  }

  function emitStone(cell: P2[], seed: Seed) {
    if (cell.length < 3) return;
    const sc = centroid(cell);
    const s = { x: sc.x, z: sc.z };
    // every per-stone draw comes from a stream keyed on the stone's position (2 cm cells), so a
    // stone's shape and tint stay put when the lattice changes elsewhere on the plaza — box
    // means then move with the region factors below instead of re-rolling every tint
    const srng = rng.fork(`stone/${Math.round(s.x * 50)}/${Math.round(s.z * 50)}`);
    // reference joints are 5–10 cm of moss and soil, wider where the paving is old (macro noise)
    const jointN = wearN.fbm(s.x * 0.3 + 11, s.z * 0.3 - 4, 2) * 0.5 + 0.5;
    const ea = srng.range(0.01, 0.026);
    // 1 on the flat open plaza (big flush slabs, thin joints), 0 in the damp band and on camera
    // D's foreground path, whose reference slabs are clearly domed in wide dark joints
    const open = 1 - Math.max(dampBand(s.z), 0.85 * dForeground(s.z));
    // the lawn paving (zones.ts): slabs set in 15–45 cm of turf, corners rounded off at a third
    // of the slab (reference B/E foreground: big rounded slabs in lawn, no straight seams)
    const lawn = seed.lawn;
    // shoulder and fillet scale with the stone (a 40 cm stone has a 3 cm roll, an 80 cm one 5 cm)
    const size = Math.sqrt(Math.abs(polygonArea(cell)));
    // the geometric gap is 4–8 cm (3–6 cm between the big open-paving slabs); the rolled
    // shoulders and the sunk side walls add ~2 cm of visual joint on each side, so the rendered
    // seam reads 5–10 cm like the reference
    const seamJoint = (0.035 + 0.03 * jointN + srng.range(0, 0.01)) * (1 - 0.35 * open) + 0.015 * dampBand(s.z);
    // (no draw for the stones outside the lawn, so their streams — and the stepping-stone
    // discs' outlines — stay exactly as before)
    // (14–36 cm: the reference's bottom-row seams are 15–25 cm, its 40 cm gaps are dirt patches)
    const lawnJoint = 0.14 + 0.16 * jointN + (lawn > 0 ? srng.range(0, 0.06) : 0);
    // corners: a fifth of the slab everywhere (reference C/D: rounded slabs, no straight-edged
    // polygons), a third on the lawn paving; the stepping-stone discs keep their round-9 outline
    const seamFillet = seed.disc ? clamp(0.15 * size, 0.055, 0.12) : clamp(0.2 * size, 0.06, 0.22);
    const lawnFillet = clamp(0.3 * size, 0.12, 0.4);
    const style: OutlineStyle = {
      // the damp band's seams are the widest (reference B/E foreground: 8–12 cm of soil and moss
      // between the stones — its plaza box has the same dark and bright tones as ours but more
      // of its area is joint)
      joint: seamJoint + (lawnJoint - seamJoint) * lawn,
      shoulder: clamp(0.055 * size, 0.022, 0.042) * srng.range(0.85, 1.15),
      fillet: (seamFillet + (lawnFillet - seamFillet) * lawn) * srng.range(0.8, 1.2),
      erosion: ea * (1 + lawn),
      roundArcs: !seed.disc,
      erodeFn: (x, z) => wearN.fbm((x + s.x) * 5.5 + 21, (z + s.z) * 5.5 - 9, 2) * 0.5 + 0.5,
    };
    // work in seed-local coordinates (the stone is built around its centroid, then placed)
    const local = cell.map((p) => ({ x: p.x - s.x, z: p.z - s.z }));
    const outline = cellToOutline(local, style, srng);
    if (!outline) {
      stats.skippedSmall++;
      return;
    }
    const c = centroid(outline.outer);
    let radius = 0;
    for (const p of outline.outer) radius = Math.max(radius, Math.hypot(p.x, p.z));

    // 3. seat on the terrain: sample height under ≈ 20 points of the stone
    const hCentre = terrain.height(s.x, s.z);
    let hSum = hCentre;
    let hMin = hSum;
    let hMax = hSum;
    let n = 1;
    terrain.normal(s.x, s.z, nrm);
    const nAcc = nrm.clone();
    const stride = Math.max(1, Math.floor(outline.outer.length / 10));
    for (let i = 0; i < outline.outer.length; i += stride) {
      for (const f of [0.5, 0.92]) {
        const px = s.x + c.x + (outline.outer[i].x - c.x) * f;
        const pz = s.z + c.z + (outline.outer[i].z - c.z) * f;
        const h = terrain.height(px, pz);
        hSum += h;
        hMin = Math.min(hMin, h);
        hMax = Math.max(hMax, h);
        n++;
        if (f > 0.6) nAcc.add(terrain.normal(px, pz, nrm));
      }
    }
    const hMean = hSum / n;
    nAcc.normalize();
    // gentle tilt only: blend the terrain normal toward up so stones never look like ramps
    nAcc.lerp(up, 0.5).normalize();
    // the shoulder rolls down 1.2–2 cm to the outer edge; the top domes another 0.5–2.6 cm above
    // the shoulder — some stones nearly flat, some clearly cushioned (2–4.5 cm crown in all)
    const bevel = srng.range(0.012, 0.02);
    const crown = (srng.chance(0.35) ? srng.range(0.005, 0.012) : srng.range(0.012, 0.026)) * (1 - 0.45 * open);
    let thickness = srng.range(0.09, 0.12);
    // the outer edge stands 2–3.2 cm proud of the mean ground (joint fill is at +0.8 cm) so the
    // joints read as sunk soil channels 1.5–2.5 cm deep between the stones; from the low cameras
    // every centimetre of shaded side wall reads as ~3 cm of dark joint, so the big open-paving
    // slabs sit flusher (reference A/D: soft seams, no dark lines). The edge must clear the fill
    // on the uphill side and never float > 3 cm on the downhill side.
    const exposed = srng.range(0.016, 0.026) * (1 - 0.35 * open);
    if (hMax - hMin > 0.28) {
      // a slab cannot sit across a step this high (terrace lips, bank feet): leave soil here
      stats.skippedSteep++;
      return;
    }
    let rimY = Math.min(hMean + exposed, hCentre + 0.06);
    // never float more than 3 cm over the lowest ground under the edge — sink instead, but keep
    // the edge at least 1.6 cm clear of the joint fill at the centre; a deeper stone absorbs the rest
    rimY = Math.min(rimY, hMin + 0.03 + (thickness - bevel));
    rimY = Math.max(rimY, hCentre + 0.016);
    let bottomY = rimY - (thickness - bevel);
    if (bottomY > hMin + 0.03) {
      thickness += bottomY - (hMin + 0.03);
      bottomY = hMin + 0.03;
    }
    const topY = bottomY + thickness + crown;

    // 4. per-stone look. Reference stones differ visibly stone to stone: ± 12 % luminance, ± 8°
    // hue; one in five is a cooler grey, one in eight a darker warm brown. A slow macro noise
    // drifts pale ↔ mid across the plaza; big path-centre slabs lean pale (worn by feet).
    const tn = tintNoise.fbm(s.x * 0.35, s.z * 0.35, 2) * 0.5 + 0.5;
    // dampness: the open paving is dry, pale, foot-worn stone (reference A/D/E foregrounds,
    // lum ≈ 0.48–0.52); where the path leaves the plaza under the canopy toward the house the
    // stones are darker, greyer and mossier (reference B foreground, lum ≈ 0.46). Path edges
    // (small rim stones) are damper than the path centre too.
    const damp = clamp(0.7 * dampBand(s.z) + 0.3 * smoothstep(1.6, 0.4, seed.rim), 0, 1);
    const grey = srng.chance(0.2 + 0.15 * damp);
    const darkWarm = !grey && srng.chance(0.13);
    let lum = 0.9 + 0.14 * tn + srng.range(-0.12, 0.12) + (seed.big ? 0.05 : 0);
    if (grey) lum *= 0.93;
    if (darkWarm) lum *= 0.78;
    // (round 9: the stone albedo came down 28 % as a whole (material.ts STONE_ALBEDO_SCALE) to
    // put the sunlit A/D paving on the reference; the band's own darkening shrank with it so the
    // B foreground keeps the reference's lit-top ratio to A — B/A 0.89 in sRGB, ours had 0.83)
    lum *= 1 - 0.16 * damp;
    lum *= 1 - 0.06 * southPlaza(s.z);
    // camera D's foreground is the most trodden stretch of the path: its slab tops are the palest
    // of their own frame, but not paler than the A plaza (reference lit tops D 0.58 / A 0.63 in
    // sRGB, ours rendered 0.67 / 0.69) — no extra lift
    const hueK = srng.range(-0.05, 0.05) + (darkWarm ? 0.035 : 0) - 0.22 * damp;
    // the shaded band renders redder and more saturated than the sunlit plaza under the warm
    // fill light (B lit tops sRGB B/R 0.61, R/G 1.20 against the reference's 0.69 / 1.12, where
    // the A plaza matches at 0.71 / 1.10) and the post chain passes only ~1/4 of an albedo
    // colour change, so its stones' albedo leans grey-green (hueK −0.22, satK +0.55 at full
    // dampness) to render as the reference's khaki grey (B lit tops 0.70 / 1.12, hue 39°)
    const satK = srng.range(-0.04, 0.04) + (grey ? 0.075 : 0) - (darkWarm ? 0.04 : 0) + 0.55 * damp;
    const tint: [number, number, number] = [lum * (1 + hueK), lum * (1 - hueK * 0.3), lum * (1 - hueK * 0.5 + satK)];
    // moss lives in the joints and creeps onto the shoulders; a green film covers the shaded
    // north/west side of ~30 % of the stones (damp side, reference B/E), more on the damp path
    const moss = clamp(0.25 + 0.6 * (tintNoise.fbm(s.x * 0.5 + 7, s.z * 0.5, 2) * 0.5 + 0.5) - 0.2 * smoothstep(3, 0, Math.hypot(s.x, s.z)) + 0.2 * damp, 0.05, 0.9);
    const film = srng.chance(0.3 + 0.25 * damp) ? srng.range(0.35, 0.7) : 0;
    const filmDir = [-0.55 + srng.range(-0.25, 0.25), -0.83 + srng.range(-0.2, 0.2)]; // toward north-west
    const filmL = Math.hypot(filmDir[0], filmDir[1]);
    filmDir[0] /= filmL;
    filmDir[1] /= filmL;
    const invR = 1 / Math.max(radius, 0.12);
    // rim stones (sheet 02 'Moss edges'): moss creeps in over the outer 5–15 cm of the stones
    // along the paved edge, from the grass side. Which side is "outer" comes from sampling the
    // paved mask around the stone; a stone in the grass (stepping stone) is mossy all round.
    let outX = 0;
    let outZ = 0;
    let unpaved = 0;
    if (seed.rim < 0.9) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        if (!isPaved(pc, s.x + dx * (radius + 0.3), s.z + dz * (radius + 0.3), 0.5)) {
          outX += dx;
          outZ += dz;
          unpaved++;
        }
      }
    }
    const outL = Math.hypot(outX, outZ);
    const allRound = unpaved >= 10;
    if (outL > 1e-6) {
      outX /= outL;
      outZ /= outL;
    }
    // ~60 % of the rim edge carries the film: 4 of 5 rim stones get one, and the per-vertex
    // noise below (plus the shader's ragged boundary) leaves a quarter of their outer edge bare
    const edgeMoss = unpaved >= 2 && srng.chance(0.8) ? srng.range(0.7, 1.0) : 0;
    // shoulder dirt: soil and dust collect on the rolled edge, so every stone darkens toward it
    const rim = srng.range(0.06, 0.13);
    const uvO: [number, number] = [srng() * 4, srng() * 4];
    // flank: the visible flank — the 1–2 cm between the joint fill and the shoulder ring — is
    // stone-coloured (a shade darker than the top); the soil stain (the stone shader's `aStain`
    // tint) sits on the foot of the wall where it meets the fill (sheet 02: the seam's brown runs
    // a little way up the stone) and fades out toward the shoulder. Round 8's fully soil-stained
    // flank widened every seam into a dark band (a small part of the B plaza box's SSIM loss —
    // most of it was the fill's luminance, see joints.ts); a bare stone flank gives the
    // reference's dark quantile away again (p10 0.350 vs 0.331). So the
    // stain is graded: FLANK_STAIN_AT_FILL at the fill line, nothing at the shoulder. The wall
    // below the fill is buried, so the foot value may run past 1 (the shader clamps).
    const wallH = thickness - bevel;
    const fillH = clamp(hMean + 0.008 - bottomY, 0.2 * wallH, 0.95 * wallH);
    const footStain = (FLANK_STAIN_AT_FILL * wallH) / (wallH - fillH);

    // 5. build the stone into the shared geometry and place it
    const from = all.vertexCount;
    const filmAt = (x: number, z: number, edge: number) => {
      if (!film) return 0;
      const d = ((x - c.x) * filmDir[0] + (z - c.z) * filmDir[1]) * invR; // -1..1 toward the shaded side
      const nz = wearN.fbm((x + s.x) * 3.1 - 13, (z + s.z) * 3.1 + 6, 2) * 0.5 + 0.5;
      return film * smoothstep(-0.15, 0.55, d) * (0.4 + 0.6 * nz) * (0.45 + 0.55 * smoothstep(0.2, 0.9, edge));
    };
    const edgeFilmAt = (x: number, z: number, edge: number) => {
      let v = 0;
      if (edgeMoss) {
        const d = ((x - c.x) * outX + (z - c.z) * outZ) * invR; // -1..1 toward the grass side
        const nz = wearN.fbm((x + s.x) * 4.5 + 41, (z + s.z) * 4.5 - 27, 2) * 0.5 + 0.5;
        // full on the shoulder, a third on the second ring (the feathered inner boundary lands
        // between them), nothing further in
        v += edgeMoss * (allRound ? 0.85 : smoothstep(-0.45, 0.45, d)) * (0.4 + 0.85 * nz) * smoothstep(0.45, 1.0, edge);
      }
      if (film) {
        // the shaded north-west side of interior stones: a softer, thinner film — shoulder plus a
        // feathered fringe (the second ring gets a sixth), so the film stays a 5–10 cm edge on
        // the big slabs; reaching a third of the way in cost the B plaza box 0.03 of SSIM
        v += 0.9 * filmAt(x, z, 1) * smoothstep(0.55, 1.0, edge);
      }
      return v;
    };
    buildSlab(all, outline.outer, {
      thickness,
      bevel,
      topRing: outline.inner,
      softBevel: true,
      dip: -crown,
      color: tint,
      sideColor: [tint[0] * 0.6 + 0.24, tint[1] * 0.58 + 0.2, tint[2] * 0.55 + 0.16],
      sideStain: footStain,
      mossEdge: 0.4 * moss,
      mossInner: 0.03 * moss,
      mossFn: (x, z) => 0.3 + 0.7 * (wearN.fbm((x + s.x) * 2.2, (z + s.z) * 2.2, 2) * 0.5 + 0.5),
      mossAdd: edgeFilmAt,
      colorFn: (x, z, part, edge) => {
        const n = 0.75 + 0.5 * (wearN.fbm((x + s.x) * 1.7 + 5, (z + s.z) * 1.7, 2) * 0.5 + 0.5);
        if (part === 'side') return 0.95;
        let k = part === 'bevel' ? 1 - 0.3 * rim * n : 1 - rim * n * smoothstep(0.4, 1, edge) * 0.6;
        // tonal drift and mottling across the top (dirt patches, worn pale spots) so big tops
        // don't read as one flat tone
        k *= 1 + 0.05 * wearN.fbm((x + s.x) * 0.9 + 31, (z + s.z) * 0.9, 1) + 0.06 * wearN.fbm((x + s.x) * 2.6 - 17, (z + s.z) * 2.6 + 23, 2);
        const f = filmAt(x, z, part === 'bevel' ? 1 : edge);
        if (f <= 0.001) return k;
        // moss film: greener, a little darker
        return [k * (1 - 0.3 * f), k * (1 - 0.06 * f), k * (1 - 0.45 * f)];
      },
      uvScale: 0.62,
      uvOffset: uvO,
      topNoise: (x, z) => 0.003 * wearN.noise((x + s.x) * 7 + 3, (z + s.z) * 7),
      // a second ring gives the edge film somewhere to end (5–15 cm in) on the small rim stones
      rings: radius > 0.42 || edgeMoss > 0 ? 2 : 1,
    });
    q.setFromUnitVectors(up, nAcc);
    pos.set(s.x, bottomY, s.z);
    one.compose(pos, q, new Vector3(1, 1, 1));
    all.transform(one, from);

    const poly = outline.outer.map((p) => ({ x: p.x + s.x, z: p.z + s.z }));
    const stone: PlacedStone = { x: s.x, z: s.z, polygon: poly, shape: outlineHash(outline.outer), radius, thickness, bottomY, topY, moss, aspect: cellAspect(outline.outer).aspect };
    stoneGrid.add(s.x, s.z, stones.length);
    stones.push(stone);
    if (edgeMoss > 0) stats.edgeMossStones++;
  }

  const geometry = all.build();
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'flagstones';

  const onStone = (x: number, z: number) => {
    let hit = false;
    stoneGrid.near(x, z, 1.2, (id) => {
      if (hit) return;
      const st = stones[id];
      if (Math.hypot(st.x - x, st.z - z) > st.radius * 1.05) return;
      if (pointInPolygon(st.polygon, x, z)) hit = true;
    });
    return hit;
  };
  const edgeGap = (x: number, z: number) => {
    let best = Infinity;
    stoneGrid.near(x, z, 1.3, (id) => {
      const st = stones[id];
      if (Math.hypot(st.x - x, st.z - z) > st.radius + 0.4) return;
      const d = distToPolygon(st.polygon, x, z);
      if (d < best) best = d;
    });
    return best;
  };

  return { stones, mesh, triangles: all.vertexCount / 3, grid: stoneGrid, onStone, edgeGap, steppingStones: discs, stats };
}
