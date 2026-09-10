/**
 * Flagstone paving (W03). Seeds are dart-thrown over the paved mask (paths + plaza) in three
 * size classes (a few big 1.4–1.7 m slabs, the 0.6–1.2 m bulk, small fillers) with a random
 * elliptical footprint each, so the weighted Voronoi cells come out as a hand-laid mix of large,
 * small, squat and elongated stones rather than a hexagonal tiling. Each cell — clipped to the
 * paved boundary, shrunk by the joint width (3–8 cm of soil), corners worn by a per-stone amount
 * and edges hand-jittered — IS the slab outline, so every stone is unique and neighbours never
 * overlap. Slabs are seated on the terrain (≈ 20 samples per stone), tilted gently to the local
 * normal, with ≤ 4 cm height jitter, and merged into ONE geometry (vertex colour = per-stone
 * tint + rim dirt, aMoss = joint moss) → a single draw call.
 */
import { Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { surfaceMask, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, ccw, centroid, pointInPolygon, polygonArea, type P2 } from './geometry';
import type { StairFrame } from './stairs';
import { inStairFootprint } from './stairs';

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

/**
 * Elongation of a convex cell: extent along its principal axis over the extent across it.
 * Boundary cells at the path fringe get squeezed into long slivers; those are split (W03 asks for
 * hand-laid stones, and nobody lays a 2.5:1 sliver).
 */
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
  // judge the stone as it will be cut: the joint + chamfer (~7 cm) shrink both extents
  const shrunk = (a.major - 0.14) / Math.max(a.minor - 0.14, 1e-3);
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

interface OutlineStyle {
  /** joint width (m) — the cell shrinks by half of it on every side */
  joint: number;
  /** corner wear: fraction of each edge taken off at the corners (0.03 angular … 0.2 rounded) */
  wear: number;
  /** one corner knocked off (fraction of the edge), 0 = none */
  chip: number;
  /** edge waviness (m) */
  jitter: number;
  maxRadius: number;
}

/**
 * Turn a Voronoi cell (seed-local coords) into a hand-cut slab outline: shrink by half the joint,
 * wear the corners by a per-stone amount (some slabs stay angular, some are rounded), knock a
 * chip off one corner now and then, and split long edges with a small perpendicular jitter.
 * Returns null if the result is too small to read as a stone.
 */
function cellToOutline(cell: P2[], st: OutlineStyle, rng: Rng): P2[] | null {
  let pts = dedupe(cell, 0.025);
  if (pts.length < 3) return null;
  const c = centroid(pts);
  // radial shrink by joint/2 (robust for the near-convex cells we get from clipping)
  pts = pts.map((p) => {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const l = Math.hypot(dx, dz) || 1e-6;
    const k = Math.max(0, l - st.joint / 2) / l;
    return { x: c.x + dx * k, z: c.z + dz * k };
  });
  // cap the slab size (very sparse seed → shrink toward the centroid, the joint widens there)
  let maxR = 0;
  for (const p of pts) maxR = Math.max(maxR, Math.hypot(p.x - c.x, p.z - c.z));
  if (maxR > st.maxRadius) {
    const k = st.maxRadius / maxR;
    pts = pts.map((p) => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }));
  }
  // worn corners: each corner becomes two points along its edges. The amount is per stone
  // (angular slabs keep ~3 % of the edge, rounded ones lose ~20 %) with a little per-corner
  // variation; one corner may carry a bigger chip.
  const n = pts.length;
  const chipAt = st.chip > 0 ? rng.int(0, n) : -1;
  const cham: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.09) {
      cham.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
      continue;
    }
    const w0 = i === chipAt ? st.chip : st.wear * rng.range(0.6, 1.3);
    const w1 = (i + 1) % n === chipAt ? st.chip : st.wear * rng.range(0.6, 1.3);
    const t0 = clamp(w0 * (0.5 / Math.max(len, 0.3)), 0.015, 0.42);
    const t1 = clamp(w1 * (0.5 / Math.max(len, 0.3)), 0.015, 0.42);
    cham.push({ x: a.x + (b.x - a.x) * t0, z: a.z + (b.z - a.z) * t0 });
    cham.push({ x: a.x + (b.x - a.x) * (1 - t1), z: a.z + (b.z - a.z) * (1 - t1) });
  }
  // hand-cut edges: split edges > 0.22 m (twice when > 0.6 m) with a perpendicular wobble
  const out: P2[] = [];
  const m = cham.length;
  for (let i = 0; i < m; i++) {
    const a = cham[i];
    const b = cham[(i + 1) % m];
    out.push(a);
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const len = Math.hypot(ex, ez);
    if (len > 0.6) {
      for (const f of [0.33, 0.66]) {
        const j = rng.range(-st.jitter, st.jitter);
        out.push({ x: a.x + ex * f - (ez / len) * j, z: a.z + ez * f + (ex / len) * j });
      }
    } else if (len > 0.22) {
      const j = rng.range(-st.jitter, st.jitter);
      out.push({ x: a.x + ex * 0.5 - (ez / len) * j, z: a.z + ez * 0.5 + (ex / len) * j });
    }
  }
  const final = dedupe(out, 0.012);
  if (final.length < 4) return null;
  // size gate: min radius from the centroid ≥ 7 cm and area ≥ 0.04 m² (small fillers are kept —
  // dropping them leaves bare holes in the paving; undersized *cells* are already removed at the
  // seed level so this rarely triggers)
  const cc = centroid(final);
  let minR = Infinity;
  for (const p of final) minR = Math.min(minR, Math.hypot(p.x - cc.x, p.z - cc.z));
  if (minR < 0.05 || Math.abs(polygonArea(final)) < 0.03) return null;
  return ccw(final);
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
}

export function isPaved(pc: PavingContext, x: number, z: number, threshold = 0.5): boolean {
  const m = surfaceMask(x, z);
  if (m.path < threshold || m.stairs >= 0.5 || m.structure >= 0.5) return false;
  for (const f of pc.frames) if (inStairFootprint(f, x, z)) return false;
  return true;
}

export interface PavingResult {
  stones: PlacedStone[];
  mesh: Mesh;
  triangles: number;
  grid: Grid;
  /** true if the world point is on a stone's top face */
  onStone(x: number, z: number): boolean;
  stats: { seeds: number; skippedNarrow: number; skippedSmall: number; split: number };
}

/**
 * A paving seed with an elliptical footprint: `r` is the mean radius, the ellipse is stretched
 * `st`× along the unit axis (ax, az) and squeezed by the same factor across it.
 */
interface Seed {
  x: number;
  z: number;
  r: number;
  ax: number;
  az: number;
  st: number;
}

/** radius of the seed's ellipse toward the unit direction (dx, dz) */
function seedReach(s: Seed, dx: number, dz: number): number {
  const u = dx * s.ax + dz * s.az;
  const v = -dx * s.az + dz * s.ax;
  return s.r / Math.hypot(u / s.st, v * s.st);
}

export function placeFlagstones(pc: PavingContext, material: Material): PavingResult {
  const { terrain, rng, bbox } = pc;
  const sizeNoise = new Noise2D(`${pc.seed}/flag-size`);
  const tintNoise = new Noise2D(`${pc.seed}/flag-tint`);
  const wearN = new Noise2D(`${pc.seed}/flag-wear`);

  // 1. dart-throw seeds. Three passes — a few big slabs first, then the bulk, then small
  // fillers into whatever room is left — so sizes are intermixed everywhere (the reference plaza
  // has 1.5 m slabs beside 0.5 m stones) instead of graded by the slow size noise alone. Every
  // seed gets an elliptical reach: 45 % are clearly elongated (1.2–1.65:1), the rest near-round.
  const seeds: Seed[] = [];
  const grid = new Grid(1.0);
  const radiusAt = (x: number, z: number) => {
    const n = sizeNoise.fbm(x * 0.14 + 3, z * 0.14 - 1, 2) * 0.5 + 0.5;
    const plaza = 1 - smoothstep(4.5, 7.5, Math.hypot(x, z));
    return 0.24 + 0.2 * n + 0.06 * plaza;
  };
  const attempts = Math.round(90000 * clamp(pc.density, 0.5, 1.5));
  const passes: { share: number; size: [number, number]; elongated: number; stretch: [number, number] }[] = [
    { share: 0.14, size: [1.4, 1.7], elongated: 0.5, stretch: [1.15, 1.35] },
    { share: 0.56, size: [0.78, 1.25], elongated: 0.45, stretch: [1.2, 1.45] },
    { share: 0.3, size: [0.5, 0.72], elongated: 0.35, stretch: [1.2, 1.5] },
  ];
  for (const pass of passes) {
    const n = Math.round(attempts * pass.share);
    for (let a = 0; a < n; a++) {
      const x = rng.range(bbox.x0, bbox.x1);
      const z = rng.range(bbox.z0, bbox.z1);
      const r = radiusAt(x, z) * rng.range(pass.size[0], pass.size[1]);
      const ang = rng.range(0, Math.PI);
      const st = rng.chance(pass.elongated) ? rng.range(pass.stretch[0], pass.stretch[1]) : rng.range(1.0, 1.1);
      const cand: Seed = { x, z, r, ax: Math.cos(ang), az: Math.sin(ang), st };
      if (!isPaved(pc, x, z, 0.5)) continue;
      let ok = true;
      grid.near(x, z, r * st + 1.9, (id) => {
        if (!ok) return;
        const s = seeds[id];
        const dx = s.x - x;
        const dz = s.z - z;
        const d = Math.hypot(dx, dz) || 1e-6;
        if (d < (seedReach(cand, dx / d, dz / d) + seedReach(s, -dx / d, -dz / d)) * 0.93) ok = false;
      });
      if (!ok) continue;
      grid.add(x, z, seeds.length);
      seeds.push(cand);
    }
  }

  // 2. Voronoi cell per seed, clipped to the paved boundary → slab outline
  const stones: PlacedStone[] = [];
  const up = new Vector3(0, 1, 0);
  const nrm = new Vector3();
  const q = new Quaternion();
  const pos = new Vector3();
  const stoneGrid = new Grid(1.0);
  const stats = { seeds: seeds.length, skippedNarrow: 0, skippedSmall: 0, split: 0 };
  const all = new MeshBuilder();
  const one = new Matrix4();

  const active = new Uint8Array(seeds.length).fill(1);
  const cellFor = (si: number): P2[] => {
    const s = seeds[si];
    let cell: P2[] = [
      { x: s.x - 1.7, z: s.z - 1.7 },
      { x: s.x + 1.7, z: s.z - 1.7 },
      { x: s.x + 1.7, z: s.z + 1.7 },
      { x: s.x - 1.7, z: s.z + 1.7 },
    ];
    grid.near(s.x, s.z, 3.4, (id) => {
      if (id === si || !active[id] || cell.length < 3) return;
      const o = seeds[id];
      const dx = o.x - s.x;
      const dz = o.z - s.z;
      const l = Math.hypot(dx, dz);
      if (l < 1e-6 || l > 3.4) return;
      // power-diagram bisector (weights 0.6·r²): the plane is shared by both cells, and — unlike
      // the ratio-of-reaches bisector used before — the three planes around every vertex concur,
      // so the tessellation has no triangular holes where slabs of different size meet. The
      // weight is damped so small seeds are not squeezed to nothing beside big ones (the dart
      // throw already spaces seeds by size, so plain bisectors are nearly right). Elongation
      // comes from the anisotropic seed spacing, which keeps neighbours further away along the
      // long axis.
      const d = (l * l + 0.6 * (s.r * s.r - o.r * o.r)) / (2 * l);
      cell = clipHalfPlane(cell, s.x, s.z, dx / l, dz / l, clamp(d, 0.08, l - 0.08));
    });
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
  // cells too small to become a stone (< 0.07 m² or thinner than 20 cm before the joint shrink)
  // drop their seed so the neighbours grow into the space — dropping the *stone* instead leaves
  // a 20–40 cm soil hole, and there were ~35 of those, reading as huge joints at every corner
  const tooSmall = (cell: P2[]) => {
    if (cell.length < 3) return true;
    if (Math.abs(polygonArea(cell)) < 0.07) return true;
    const c = centroid(cell);
    let minR = Infinity;
    for (const p of cell) minR = Math.min(minR, Math.hypot(p.x - c.x, p.z - c.z));
    return minR < 0.12;
  };
  for (let iter = 0; iter < 4; iter++) {
    let dropped = 0;
    for (let si = 0; si < seeds.length; si++) {
      if (!active[si]) continue;
      if (tooSmall(cellFor(si))) {
        active[si] = 0;
        dropped++;
      }
    }
    stats.skippedNarrow += dropped;
    if (!dropped) break;
  }

  for (let si = 0; si < seeds.length; si++) {
    if (!active[si]) continue;
    const cell = cellFor(si);
    if (cell.length < 3) continue;
    // sliver fringe cells (aspect > 3) become two or more stones with a joint between them; the
    // deliberately elongated seeds (≤ 1.5:1 reach → ≈ 2.2:1 stones) stay whole
    const pieces = splitElongated(cell, 3.0, rng.range(0.04, 0.07));
    if (pieces.length > 1) stats.split += pieces.length - 1;
    for (const piece of pieces) emitStone(piece);
  }

  function emitStone(cell: P2[]) {
    if (cell.length < 3) return;
    // the stone is built around its own centroid (== the seed for unsplit cells, near enough)
    const sc = centroid(cell);
    const s = { x: sc.x, z: sc.z };
    // reference joints are 3–8 cm of soil; wider still where the paving is old (macro noise)
    const jointN = wearN.fbm(s.x * 0.3 + 11, s.z * 0.3 - 4, 2) * 0.5 + 0.5;
    // (the bevels and the exposed sides add another ~2 cm of visual joint on each side, and every
    // worn corner opens a small soil triangle where three slabs meet, so the geometric gap is
    // kept at 2.5–7 cm — the rendered seam then reads 3–8 cm, ≈ 8 % of the plaza seen from above)
    const style: OutlineStyle = {
      joint: 0.025 + 0.035 * jointN + rng.range(0, 0.01),
      wear: rng.chance(0.3) ? rng.range(0.01, 0.024) : rng.range(0.024, 0.055),
      chip: rng.chance(0.2) ? rng.range(0.12, 0.2) : 0,
      jitter: rng.range(0.006, 0.014),
      // corner radius cap (a 1.6 m slab has 0.9–1.0 m corners); scaling a cell down to the cap
      // opens a wide soil ring around it, so this must stay above what the seed sizes produce
      maxRadius: 1.0,
    };
    // work in seed-local coordinates (the slab is built around the seed, then placed)
    const local = cell.map((p) => ({ x: p.x - s.x, z: p.z - s.z }));
    const outline = cellToOutline(local, style, rng);
    if (!outline) {
      stats.skippedSmall++;
      return;
    }
    const c = centroid(outline);
    let radius = 0;
    for (const p of outline) radius = Math.max(radius, Math.hypot(p.x, p.z));

    // 3. seat on the terrain: sample height under ≈ 20 points of the slab
    const hCentre = terrain.height(s.x, s.z);
    let hSum = hCentre;
    let hMin = hSum;
    let n = 1;
    terrain.normal(s.x, s.z, nrm);
    const nAcc = nrm.clone();
    const stride = Math.max(1, Math.floor(outline.length / 10));
    for (let i = 0; i < outline.length; i += stride) {
      for (const f of [0.5, 0.85]) {
        const px = s.x + c.x + (outline[i].x - c.x) * f;
        const pz = s.z + c.z + (outline[i].z - c.z) * f;
        const h = terrain.height(px, pz);
        hSum += h;
        hMin = Math.min(hMin, h);
        n++;
        if (f > 0.6) nAcc.add(terrain.normal(px, pz, nrm));
      }
    }
    const hMean = hSum / n;
    nAcc.normalize();
    // gentle tilt only: blend the terrain normal toward up so slabs never look like ramps
    nAcc.lerp(up, 0.35).normalize();
    const thickness = rng.range(0.075, 0.11);
    // the top sits 1.2–2 cm proud of the mean ground (joint fill is at +0.8 cm) so the pavement
    // reads as one flush surface with soil-filled cracks, not as separate pillows — from the
    // low cameras every centimetre of exposed side reads as ~3 cm of joint. If an edge would
    // float > 3 cm over the lowest sampled ground point, sink the slab, but never below a 1.5 cm
    // lip at the centre (measured at the bottom of the dish) so the top always clears the joint
    // fill — otherwise the fill shows through the dish as a soil blob on the slab
    const exposed = rng.range(0.012, 0.02);
    const dipK = rng.range(0.004, 0.01);
    let bottomY = hMean + exposed - thickness;
    bottomY = Math.min(bottomY, hMin + 0.03, hCentre + 0.05 - thickness);
    bottomY = Math.max(bottomY, hCentre + 0.015 + dipK - thickness);
    const topY = bottomY + thickness;

    // 4. per-stone look. Reference slabs differ visibly stone to stone: ≈ ±8 % luminance, ±3°
    // hue (a 3 % swing of R against G), ±0.03 saturation (B against R), and about one in five is
    // a cooler, greyer stone. The macro noise adds a slow pale ↔ mid drift across the plaza.
    const tn = tintNoise.fbm(s.x * 0.35, s.z * 0.35, 2) * 0.5 + 0.5;
    const grey = rng.chance(0.22);
    const lum = (0.88 + 0.16 * tn + rng.range(-0.12, 0.12)) * (grey ? 0.93 : 1);
    const hueK = rng.range(-0.03, 0.03);
    const satK = rng.range(-0.045, 0.045) + (grey ? 0.07 : 0);
    const tint: [number, number, number] = [lum * (1 + hueK), lum * (1 - hueK * 0.4), lum * (1 - hueK * 0.3 + satK)];
    // moss lives in the joints and creeps only a little onto the bevels (E frame: dark soil
    // seams with grass sprouts, the slab tops themselves stay clean)
    const moss = clamp(0.2 + 0.6 * (tintNoise.fbm(s.x * 0.5 + 7, s.z * 0.5, 2) * 0.5 + 0.5) - 0.25 * smoothstep(3, 0, Math.hypot(s.x, s.z)), 0.05, 0.8);
    // rim dirt: soil and dust collect on the worn bevel and the outer hand of the top, so every
    // slab darkens toward its edge (the reference stones read as a pale centre in a dark halo)
    const rim = rng.range(0.06, 0.15);
    const uvO: [number, number] = [rng() * 4, rng() * 4];

    // 5. build the slab into the shared geometry and place it
    const from = all.vertexCount;
    buildSlab(all, outline, {
      thickness,
      // a soft roll-over (smoothed with the top) rather than a wide facet: a wide dark bevel
      // reads as joint from the low cameras and the reference slab tops stay pale to the seam
      bevel: rng.range(0.007, 0.014),
      softBevel: true,
      dip: dipK,
      color: tint,
      sideColor: [tint[0] * 0.86, tint[1] * 0.84, tint[2] * 0.8],
      mossEdge: 0.45 * moss,
      mossInner: 0.03 * moss,
      mossFn: (x, z) => 0.3 + 0.7 * (wearN.fbm((x + s.x) * 2.2, (z + s.z) * 2.2, 2) * 0.5 + 0.5),
      colorFn: (x, z, part, edge) => {
        const n = 0.75 + 0.5 * (wearN.fbm((x + s.x) * 1.7 + 5, (z + s.z) * 1.7, 2) * 0.5 + 0.5);
        if (part === 'side') return 0.95;
        if (part === 'bevel') return 1 - 0.4 * rim * n;
        return 1 - rim * n * smoothstep(0.45, 1, edge) * 0.8;
      },
      uvScale: 0.55,
      uvOffset: uvO,
      topNoise: (x, z) => 0.003 * wearN.noise((x + s.x) * 7 + 3, (z + s.z) * 7),
      rings: radius > 0.55 ? 3 : 2,
    });
    q.setFromUnitVectors(up, nAcc);
    pos.set(s.x, bottomY, s.z);
    one.compose(pos, q, new Vector3(1, 1, 1));
    all.transform(one, from);

    const poly = outline.map((p) => ({ x: p.x + s.x, z: p.z + s.z }));
    const stone: PlacedStone = { x: s.x, z: s.z, polygon: poly, shape: outlineHash(outline), radius, thickness, bottomY, topY, moss, aspect: cellAspect(outline).aspect };
    stoneGrid.add(s.x, s.z, stones.length);
    stones.push(stone);
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

  return { stones, mesh, triangles: all.vertexCount / 3, grid: stoneGrid, onStone, stats };
}
