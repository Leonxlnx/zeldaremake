/**
 * Flagstone paving (W03). The owner's boards (02 paths, 07 path texture, 06 steps & paths) show
 * a field of flat, BROKEN stones 0.4–0.9 m across (the odd 1.0–1.2 m; smaller at the paved rim),
 * cracked straight edges and chipped corners, set in 5–10 cm dark dirt/moss seams with grass
 * bridging the joints along the path edges. Camera B/E's foreground keeps the 1.0–1.6 m slabs in
 * 15–45 cm of turf measured from reference frame 14 s (the lawn paving, `zones.ts`), and camera
 * A's near foreground its ~1 m slabs (frame 1 s), both with the same flat profile; camera D's
 * foreground path is re-broken to frame 56 s's 1.5–2.5 m slabs. Seeds come
 * from hex lattices with heavy jitter (half the spacing) and a slow domain warp, thinned/densified
 * by the distance to the paved edge, so the Voronoi cells are strongly irregular (no hexagonal
 * tiling); cells over their target size are then BROKEN along off-centre straight chords into
 * two or three pieces, like a slab cracked in place. Each piece — clipped to the paved boundary,
 * inset by half the joint, corners filleted (small) or chamfered (chipped), edges notched and
 * eroded, its edges bowed by a slow wobble — IS the stone outline; a second inset ring gives the
 * narrow shoulder and the top rises 0.3–1.3 cm, or (the big path slabs) is trodden hollow
 * 0.6–1.8 cm. Stones are seated on the terrain (≈ 20 samples), tilted gently to the local
 * normal, and merged into ONE geometry (vertex colour = per-stone tint + shoulder dirt + moss
 * film, aMoss = joint moss, aWear = the shader's lichen/grime mottling, aCrack = a dirt-filled
 * crack line on one slab in eight) → a single draw call.
 */
import { Matrix4, Mesh, Quaternion, Vector3, type Material } from 'three';
import { surfaceMask, type Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, centroid, distToPolygon, pointInPolygon, polygonArea, type P2 } from './geometry';
import type { StairFrame } from './stairs';
import { inStairFootprint } from './stairs';
import { B_FOREGROUND_SLABS, aForeground, dForeground, dampBand, discField, earthPatch, lawnPocket, lawnPocketEdgeX, lawnZone, southPlaza } from './zones';
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
  /** profile (m) for the audit: crown rise of the top (negative = a worn dish that deep), shoulder roll height, shoulder width, corner fillet radius, geometric joint */
  crown: number;
  bevel: number;
  shoulder: number;
  fillet: number;
  joint: number;
  /** broken-edge features on this stone: V-notches in the edges, corners chamfered straight instead of filleted */
  notches: number;
  chips: number;
  /** a dirt-filled crack line runs across the top (shader, `aCrack`) */
  cracked: boolean;
  /** within-stone mottle weights drawn for this stone (material.ts `aMottle`): moss cushions, grey lichen */
  mottleMoss: number;
  mottleGrey: number;
  /** the stone's whole-slab luminance factor (the vertex tint's level; 1 = the material's own) */
  lum: number;
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

/** equivalent-area diameter of a cell (m) — the "across" size the size audits use */
function acrossOf(poly: P2[]) {
  return 2 * Math.sqrt(Math.abs(polygonArea(poly)) / Math.PI);
}

/**
 * Break a cell that is bigger than `target` across into pieces along straight chords, the way a
 * slab cracks in place (boards 02/06/07: flat stones with straight broken edges). The crack runs
 * roughly across the cell's long axis (± 35°) and off-centre by up to a quarter of its length, so
 * the pieces come out unequal and the cracks never line up with the Voronoi edges; both pieces
 * must stay ≥ `minAcross` or the cut is retried elsewhere (and given up after three tries).
 * Recurses until every piece is under the target or three cracks deep.
 */
function breakCell(poly: P2[], target: number, gap: number, minAcross: number, rng: Rng, depth = 0): P2[][] {
  if (poly.length < 3) return [];
  const size = acrossOf(poly);
  if (size <= target || depth >= 3) return [poly];
  const a = cellAspect(poly);
  for (let attempt = 0; attempt < 3; attempt++) {
    // a cell far over its target is cut nearer its middle so the halves can each be cut again
    const ang = Math.atan2(a.az, a.ax) + rng.range(-0.6, 0.6);
    const nx = Math.cos(ang);
    const nz = Math.sin(ang);
    const off = rng.range(-0.25, 0.25) * a.major * (size > 1.6 * target ? 0.5 : 1);
    const px = a.c.x + nx * off;
    const pz = a.c.z + nz * off;
    const left = clipHalfPlane(poly, px, pz, nx, nz, -gap / 2);
    const right = clipHalfPlane(poly, px, pz, -nx, -nz, -gap / 2);
    if (left.length < 3 || right.length < 3) continue;
    if (acrossOf(left) < minAcross || acrossOf(right) < minAcross) continue;
    // no slivers: each piece must be ≥ 30 cm wide across its narrow axis or the joint inset eats it
    if (cellAspect(left).minor < 0.3 || cellAspect(right).minor < 0.3) continue;
    return [...breakCell(left, target, gap, minAcross, rng, depth + 1), ...breakCell(right, target, gap, minAcross, rng, depth + 1)];
  }
  return [poly];
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
  /**
   * broken-edge profile (boards 02/06/07; everything but the stepping-stone discs): a third of the
   * corners are chamfered straight instead of filleted (chipped), fillet radii swing ±50 %, and
   * long edges may take a V-notch — `notchChance` per eligible edge (two per stone at most),
   * `notchDepth` m deep
   */
  broken: boolean;
  notchChance: number;
  notchDepth: number;
  /** per-stone noise for the erosion (world-ish coords → 0..1) */
  erodeFn: (x: number, z: number) => number;
  /**
   * edge wobble amplitude (m; 0 = none): both rings bow in and out together by up to this much
   * under `wobbleFn` (0..1, slow along the edge), on segments subdivided to ≤ 24 cm, so the
   * outline reads rounded-irregular instead of polygonal (frame 1 s / 56 s); the cell is inset by
   * the same amount first so a bulge never crosses the joint's centreline
   */
  wobble: number;
  wobbleFn: (x: number, z: number) => number;
  /** corners chamfered straight (chipped) instead of filleted: chance per corner (broken stones) */
  chipChance: number;
}

interface Outline {
  outer: P2[];
  inner: P2[];
  notches: number;
  chips: number;
  /** the rings were wobbled (the top's fan centre must be validated like a notched top's) */
  wobbled: boolean;
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
  const innerCell = convexInset(base, st.joint / 2 + st.shoulder + st.wobble);
  if (innerCell.length < 3 || Math.abs(polygonArea(innerCell)) < 0.012) return null;
  const outerCell = miterOut(innerCell, st.shoulder);
  if (Math.abs(polygonArea(outerCell)) < 0.035) return null;

  const n = innerCell.length;
  const angles = cornerAngles(outerCell);
  const radii: number[] = [];
  const mids: number[] = [];
  let chips = 0;
  for (let i = 0; i < n; i++) {
    if (st.broken) {
      // chipped corners: a straight chamfer (no arc point) on `chipChance` of the corners, and
      // the fillet radius swinging ±50 % so no two corners of a stone are cut alike
      // (round 23: the arcs get their quarter points from 11 cm - the open paving's fillets
      // are 19 % of the slab now and a single midpoint left them reading as a chamfer)
      const r = st.fillet * rng.range(0.5, 1.5);
      radii.push(r);
      const chip = rng.chance(st.chipChance);
      if (chip) chips++;
      mids.push(chip ? 0 : st.roundArcs && r > 0.15 ? 3 : angles[i] < 2.0 || r > 0.05 ? 1 : 0);
      continue;
    }
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

  // V-notches (broken edges): a 10–22 cm wide bite out of a long edge, 2.5–6 cm deep, cut into
  // both rings together (the shoulder follows the notch, so the rings cannot cross and the top
  // face stays star-shaped around its centroid)
  let notches = 0;
  if (st.broken && st.notchChance > 0) {
    const o3: P2[] = [];
    const i3: P2[] = [];
    const m2 = outer.length;
    for (let k = 0; k < m2; k++) {
      const a = outer[k];
      const b = outer[(k + 1) % m2];
      const ai = inner[k];
      const bi = inner[(k + 1) % m2];
      o3.push(a);
      i3.push(ai);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (notches >= 2 || len < 0.3 || !rng.chance(st.notchChance)) continue;
      const t = rng.range(0.3, 0.7);
      const hw = rng.range(0.05, 0.11) / len;
      const depth = st.notchDepth * rng.range(0.6, 1.0);
      const t0 = clamp(t - hw, 0.1, 0.9);
      const t1 = clamp(t + hw, 0.1, 0.9);
      if (t1 - t0 < 0.08) continue;
      // inward = from the outer edge's midpoint toward the shoulder ring's
      let dx = (ai.x + bi.x - a.x - b.x) / 2;
      let dz = (ai.z + bi.z - a.z - b.z) / 2;
      const dl = Math.hypot(dx, dz);
      if (dl < 1e-4) continue;
      dx /= dl;
      dz /= dl;
      const at = (p: P2, q: P2, s: number): P2 => ({ x: p.x + (q.x - p.x) * s, z: p.z + (q.z - p.z) * s });
      const om = at(a, b, t);
      const im = at(ai, bi, t);
      o3.push(at(a, b, t0), { x: om.x + dx * depth, z: om.z + dz * depth }, at(a, b, t1));
      i3.push(at(ai, bi, t0), { x: im.x + dx * depth * 0.85, z: im.z + dz * depth * 0.85 }, at(ai, bi, t1));
      notches++;
    }
    outer = o3;
    inner = i3;
  }

  // edge wobble (round 23; frame 1 s / 56 s: the slab outlines are irregular and their edges
  // broken, ours read as polygons): segments over 14 cm are subdivided (≤ 6 parts) and every
  // vertex of both rings moves along the outer→shoulder direction by ±wobble under the caller's
  // noise (a slow bow plus a 9 cycles/m crumble), so the edges bow in and out and break up in
  // small chips, and the seam width breathes along an edge. Noise-driven, so the stone's random
  // stream is untouched.
  let wobbled = false;
  if (st.wobble > 0) {
    const o4: P2[] = [];
    const i4: P2[] = [];
    const m3 = outer.length;
    for (let k = 0; k < m3; k++) {
      const a = outer[k];
      const b = outer[(k + 1) % m3];
      const ai = inner[k];
      const bi = inner[(k + 1) % m3];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const segs = len > 0.14 ? Math.min(6, Math.ceil(len / 0.14)) : 1;
      for (let j = 0; j < segs; j++) {
        const t = j / segs;
        o4.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        i4.push({ x: ai.x + (bi.x - ai.x) * t, z: ai.z + (bi.z - ai.z) * t });
      }
    }
    for (let k = 0; k < o4.length; k++) {
      const p = o4[k];
      const q = i4[k];
      let dx = q.x - p.x;
      let dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1e-6;
      dx /= l;
      dz /= l;
      const w = st.wobble * (2 * st.wobbleFn(p.x, p.z) - 1);
      o4[k] = { x: p.x + dx * w, z: p.z + dz * w };
      i4[k] = { x: q.x + dx * w, z: q.z + dz * w };
    }
    outer = o4;
    inner = i4;
    wobbled = true;
  }

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
  return { outer: fo, inner: fi, notches, chips, wobbled };
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

/**
 * The paving mask level at a point: the terrain's path mask, or 0 under stairs, structures and
 * the stair footprints. `isPaved(pc, x, z, t)` is `pavedLevel(pc, x, z) >= t`; the joint fill
 * marches this field to its 0.5 iso (`PAVED_ISO`), the slab level the vegetation's rim follows.
 */
export const PAVED_ISO = 0.5;
export function pavedLevel(pc: PavingContext, x: number, z: number): number {
  const m = surfaceMask(x, z);
  if (m.stairs >= 0.5 || m.structure >= 0.5) return 0;
  for (const f of pc.frames) if (inStairFootprint(f, x, z)) return 0;
  return m.path;
}

export function isPaved(pc: PavingContext, x: number, z: number, threshold = PAVED_ISO): boolean {
  return pavedLevel(pc, x, z) >= threshold;
}

/**
 * Distance from a paved point to the unpaved boundary (m), by marching eight directions in 0.3 m
 * steps; capped at 2.1 m. Drives the stone size (small stones at the rim, big ones mid-path).
 */
const RIM_STEPS = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
export function rimDistance(pc: PavingContext, x: number, z: number): number {
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
  /** the Voronoi seeds (for the offline paving audit): position, lawn weight, whether the seed kept its cell */
  seeds: { x: number; z: number; lawn: number; active: boolean; phantom: boolean }[];
  stats: { seeds: number; skippedNarrow: number; skippedSmall: number; skippedSteep: number; split: number; broken: number; brokenLawnMid: number; big: number; rim: number; lawn: number; authored: number; steppingStones: number; edgeMossStones: number; notches: number; chips: number; dished: number; cracked: number; wobbled: number; mergedD: number; earth: number; field: number; dLattice: number };
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
  /** phantom: the ground within this many metres of it stays slab-free; neighbours' cells reach up to it */
  reach?: number;
  /** a camera-B foreground seed authored to the reference frame (zones.ts): its cell is never cracked */
  authored?: boolean;
}

// Round 11: the lattices outside the lawn paving are back to ~1 m (cells 0.7–1.4 m across after
// the jitter) and every cell over its target — 0.68–1.0 m, the odd 1.25 m — is broken along
// straight chords (`breakCell`), so the stones run 0.4–0.9 m, p50 0.6–0.7, p90 ≈ 1.0 (boards
// 02/07); camera B/E's lawn slabs (frame 14 s) and camera A's ~1 m foreground (frame 1 s) keep
// their sizes
/** lattice spacing (m) in the damp band */
const SPACING = 1.2;
/** lattice for the north path (camera D's foreground) */
const OPEN_SPACING = 1.15;
/** lattice for the open plaza south of the spawn (reference A/F foregrounds) */
const SOUTH_SPACING = 1.15;
/** rim lattice spacing (m): 0.35–0.55 m stones along the paved edge */
const RIM_SPACING = 0.5;
/** the pieces of a broken cell: target across size (m) before the per-region factors, and the smallest piece allowed */
const BREAK_TARGET: [number, number] = [0.88, 1.28];
const BREAK_MIN_ACROSS = 0.42;
/**
 * lawn-paving lattice (zones.ts `lawnZone`): 1.0–1.6 m slabs (the odd 2 m) in 15–45 cm turf
 * joints, so the cells run 1.4–2.1 m; low jitter (0.3 of the spacing) keeps them round-ish
 */
const LAWN_SPACING = 1.8;
/** camera D's foreground lattice (round 34, `dThin`): rows 1.75 m apart → the frame's 1.5–2.5 m slabs */
const D_ROW = 1.75;
/** soil stain on a slab's flank at the joint-fill line (0 = bare stone, 1 = the seam's soil tone); fades to 0 at the shoulder */
const FLANK_STAIN_AT_FILL = 0.7;
/**
 * Round 34: where camera D's foreground lattices are thinned to the frame's five-to-seven 1.5–2.5 m
 * slabs — unprojected, frame 56 s's bottom quarter (y 0.72–1.0) is z −6.5 … −12 on the spine, and
 * the frame's slabs stay 1.5–2.5 m to y ≈ 0.68 (z −13.5). Tighter than zones.ts `dForeground`
 * (which starts at z −5.5) so cameras B and C's stretch of the spine south of D's frame edge
 * keeps its stones; 1 from z −6.9 to −12.4, gone by −13.8 (the disc field fades out over the same
 * metres, so B/E's far spine is the plain path either way).
 */
function dThin(z: number) {
  return smoothstep(-5.9, -6.9, z) * smoothstep(-13.8, -12.4, z);
}

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
  const stats = { seeds: 0, skippedNarrow: 0, skippedSmall: 0, skippedSteep: 0, split: 0, broken: 0, brokenLawnMid: 0, big: 0, rim: 0, lawn: 0, authored: 0, steppingStones: 0, edgeMossStones: 0, notches: 0, chips: 0, dished: 0, cracked: 0, wobbled: 0, mergedD: 0, earth: 0, field: 0, dLattice: 0 };
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
    seeds.push({ x: ax, z: az, rim, big: false, lawn: Math.max(0.6, lawnZone(ax, az)), authored: true });
    authored.push({ x: ax, z: az });
    stats.authored++;
  }
  // the lawn pocket's edge: phantom seeds 0.75 m into the pocket clip the authored and lattice
  // cells at the reference's path edge, and place no stone themselves. A cell reaches to within
  // 0.7 m of the phantom (5 cm inside the edge) however far its seed is; where the pocket fades
  // out at its north end the reach shrinks with it, so camera D's foreground keeps its stones
  // (round 38, tried and dropped: taking the reach from the pocket's weight 0.4 m north of the
  // phantom filled D's frame bottom (z −6.5 … −7.05, x −0.8 … 0.4, D (0.3–0.47, 0.9–1.0)) with
  // stone, as frame 56 s has under Link's cast shadow — but that shadow is the frame's darkest
  // ground and our Link's falls at his feet, so the pale slab there cost D 0.005 of SSIM and
  // camera B/E's pocket end 0.001 each; the bare soil stays until the shadow direction agrees)
  for (let z = -3.2; z >= -6.4; z -= 0.8) {
    const x = lawnPocketEdgeX(z) - 0.75;
    grid.add(x, z, seeds.length);
    seeds.push({ x, z, rim: 2, big: false, lawn: 1, phantom: true, reach: 0.7 * lawnPocket(x, z) });
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
  const openLattice = (spacing: number, forkName: string, regionW: (z: number) => number, bigChance: number) => {
    const rowH = (spacing * Math.sqrt(3)) / 2;
    const slat = rng.fork(forkName);
    let r = 0;
    for (let z = bbox.z0 - pad; z <= bbox.z1 + pad; z += rowH, r++) {
      for (let x = bbox.x0 - pad + (r & 1 ? spacing / 2 : 0); x <= bbox.x1 + pad; x += spacing) {
        const jr = 0.5 * spacing * Math.sqrt(slat());
        const ja = slat.range(0, Math.PI * 2);
        const [wx, wz] = warp(x + Math.cos(ja) * jr, z + Math.sin(ja) * jr);
        const u = slat();
        // round 22: on the south plaza one in ten seeds eats its neighbours (was one in 25) - frame
        // 1 s mixes 0.4 m pieces with 1.3-1.8 m slabs where our jittered hex lattice read as a
        // honeycomb of ~0.8 m; D's foreground path keeps its own big-slab thinning (one in 25)
        const big = slat.chance(bigChance);
        const open = (1 - dampBand(wz)) * regionW(wz) * (1 - lawnZone(wx, wz));
        // thin the lattice on D's foreground path so the remaining cells grow to 1.4–1.9 m
        // (round 23: 30 % → 60 % thinned - frame 56 s's foreground is 1.5–2.5 m slabs, five or six
        // across the path's bottom quarter; the seeds elsewhere are untouched, this lattice's
        // draws are the same and the base lattice never lands here)
        const dz = dForeground(wz);
        // round 33: camera A's foreground (zones.ts aForeground, z 3.4–8.5) thinned 45 % the same
        // way — frame 1 s's bottom quarter is 1.1–1.3 m slabs (two across the 2.3 m of ground in
        // its right-hand 40 %), ours were 0.6–0.75 m (three or four across the same ground); the
        // south lattice's draws are unchanged, only which seeds are kept there
        // (round 34: D's stretch 60 % → 82 % thinned, and from 0.45 m of the rim instead of 0.8 m —
        // unprojected, frame 56 s's bottom quarter is z −6.5 … −12 and shows five to seven 1.5–2.5 m
        // slabs edge to edge on the 4.5–5.2 m path; ours had 27 seeds there and 30 stones at p50
        // 0.78 m. The freed cells are clipped to flat ground (`cellFor`) instead of being skipped
        // as steep at the east bank)
        const af = aForeground(wx, wz);
        const dt = dThin(wz);
        const id = tryAdd(wx, wz, 0.33, (rim) => rim >= 0.45 && u <= open * (1 - 0.6 * dz * smoothstep(0.8, 1.4, rim)) * (1 - dt) * (1 - 0.45 * af * smoothstep(0.8, 1.4, rim)));
        // a few larger slabs down the path centre (the odd 1.0–1.25 m stone of the boards)
        if (id >= 0 && big && seeds[id].rim >= 1.4) bigCandidates.push(id);
      }
    }
  };
  openLattice(SOUTH_SPACING, 'south-lattice', southPlaza, 0.1);
  openLattice(OPEN_SPACING, 'north-lattice', (z) => 1 - southPlaza(z), 0.04);
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
      // (round 33: a quarter as many base seeds in camera A's foreground — its slabs grow with
      // the south lattice's thinning above)
      // (round 34: no base seeds on camera D's stretch, `dThin` — its own lattice below)
      const id = tryAdd(wx, wz, 0.33, (rim) => (rim >= 0.55 || thin >= 0.6) && thin >= Math.max(0.8 * open + 0.2 * Math.max(dForeground(wz), 0.75 * aForeground(wx, wz)) * smoothstep(0.8, 1.4, rim), lawn, dThin(wz)));
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
      // (round 33: three quarters of the rim fringe goes in the disc field - frames 14 s / 56 s
      // run the rounded ~1 m stones right to the grass edge with no 0.35–0.55 m fringe; the rim
      // lattice is the last one sown, so the other lattices' seeds are untouched and the freed
      // edge cells go to their neighbours)
      // (and 60 % of it in camera A's foreground: frame 1 s's bottom row runs its big slabs off the
      // frame where our plaza rim — 5.5–6.4 m from the origin at the frame's bottom edge — put a
      // row of 0.35–0.55 m fringe stones)
      // (the field's thinning is for the outermost ring only, rim < 0.55 m, and not on camera D's
      // foreground stretch: with every rim seed 75 % thinned there, the interior cells grew out to
      // the path's east bank at z −7 … −9.5 and were skipped as steep (> 0.28 m across the cell) —
      // three 1.2 m holes of earth where frame 56 s is paved edge to edge; D's rim ring is the
      // control's)
      const field = discField(wx, wz) * (1 - dForeground(wz));
      // (round 34: D's stretch thins its rim ring after all — 80 % of the seeds within 0.55 m of the
      // edge — now that the interior cells reaching the east bank are clipped to flat ground in
      // `cellFor` rather than skipped; frame 56 s's slabs run to the grass with no fringe)
      const dRim = dThin(wz);
      const keep = (1 - 0.4 * (1 - dampBand(wz))) * (1 - lawnZone(wx, wz)) * (1 - 0.6 * aForeground(wx, wz));
      if (tryAdd(wx, wz, 0.34, (rim) => rim >= 0.12 && u <= smoothstep(0.95, 0.35, rim) * keep * (1 - 0.75 * field * smoothstep(0.55, 0.25, rim)) * (1 - dRim)) >= 0) stats.rim++;
    }
  }
  // round 34 — camera D's foreground stretch (`dThin`, frame 56 s's bottom quarter: z −6.5 … −12)
  // gets a lattice of its own, laid across the path: rows 1.75 m apart, each row's seeds spread
  // evenly over the paving it finds (two per row, three on every other row, ± 0.2 m), so the
  // cells are the frame's two-to-three slabs across the 4.5–5.2 m path — 2.4 × 1.75 m and
  // 1.6 × 1.75 m, 1.9–2.3 m across; a hex lattice put its columns on the rim or off the paving
  // and left single-seed rows. Every other lattice is thinned out inside it above (the frame
  // runs its big slabs to the grass, no 0.35–0.55 m fringe). Sown last, so no seed sown before
  // it moves and the shared stream's draws stay in order for every earlier cell; its cells are
  // clipped to flat ground in `cellFor` at the banks.
  {
    const dlat = rng.fork('d-lattice');
    let r = 0;
    for (let z0 = -13.6; z0 <= -5.6; z0 += D_ROW, r++) {
      const wz = z0 + dlat.range(-0.2, 0.2);
      let lo = NaN;
      let hi = NaN;
      for (let x = -4; x <= 6; x += 0.05) {
        if (!isPaved(pc, x, wz, 0.5)) continue;
        if (Number.isNaN(lo)) lo = x;
        hi = x;
      }
      if (Number.isNaN(lo) || hi - lo < 2.4) continue;
      const inset = 0.55;
      const span = hi - lo - 2 * inset;
      const n = r & 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const wx = lo + inset + ((i + 0.5) * span) / n + dlat.range(-0.2, 0.2);
        const zj = wz + dlat.range(-0.15, 0.15);
        const u = dlat();
        if (tryAdd(wx, zj, 0.9, (rim) => rim >= 0.35 && u <= dThin(zj)) >= 0) stats.dLattice++;
      }
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
      // tessellation hole-free where three cells meet. A phantom (no stone) only keeps its reach.
      const d = o.phantom ? Math.max(l / 2, l - (o.reach ?? 0.7)) : l / 2;
      cell = clipHalfPlane(cell, s.x, s.z, dx / l, dz / l, clamp(d, 0.08, l - 0.08));
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
    const pulled = cell.map((p) => {
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
    // round 34, camera D's stretch only: a cell that runs up the bank at the path's edge is
    // pulled back to ground within 13 cm of its seed's (bisection on the height), so the big slab
    // stops at the bank's toe with earth between it and the grass (frame 56 s's ragged soil
    // edge) instead of the whole cell being skipped as steep (> 0.28 m) and left as a hole —
    // which is what stopped round 33 from thinning D's rim ring. Cells elsewhere are untouched.
    if (dThin(s.z) < 0.2 || s.disc) return pulled;
    const h0 = terrain.height(s.x, s.z);
    return pulled.map((p) => {
      if (Math.abs(terrain.height(p.x, p.z) - h0) <= 0.13) return p;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 7; k++) {
        const mid = (lo + hi) / 2;
        if (Math.abs(terrain.height(s.x + (p.x - s.x) * mid, s.z + (p.z - s.z) * mid) - h0) <= 0.13) lo = mid;
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
    const sd = seeds[si];
    // break the cell into the boards' 0.4–0.9 m stones (the odd 1.0–1.25 m where the big-slab
    // candidate or camera A's foreground raises the target); the lawn paving's cells keep the
    // frame-measured slab size (target lifted out of reach as the lawn weight comes in). The
    // stream is keyed on the seed so a lattice change elsewhere does not re-crack this cell.
    const brng = rng.fork(`break/${Math.round(sd.x * 50)}/${Math.round(sd.z * 50)}`);
    // (round 33: camera A's foreground target × 1.32 → × 1.6, 1.4–2.05 m: with the lattice thinned
    // there the grown cells must stay whole to read as frame 1 s's 1.1–1.3 m slabs)
    const base = brng.range(BREAK_TARGET[0], BREAK_TARGET[1]) * (sd.big ? 1.25 : 1) * (1 + 0.6 * aForeground(sd.x, sd.z));
    const lawnTarget = base + (2.6 - base) * smoothstep(0.15, 0.6, sd.lawn);
    // round 23: camera B's mid-ground (frame 14 s, z < −3.5 behind Link) is ~1 m slabs in narrow
    // seams, not the bottom row's 1.5 m slabs in turf: the lawn cells there are cracked over
    // 1.4 m across (the authored frame-seeded slabs stay whole). Cells that break only for this
    // reason take their sliver-split gaps from the cell's own stream and leave the shared one in
    // step, so no other cell's cut moves.
    // (round 33: 1.4 m at z < −4.8 → 1.15 m at z < −4.6, ramping from z −3.0 — frames 14 s / 24 s
    // at 2× show 0.8–1.0 m rounded stones from just behind Link (z ≈ −3) on, where our lawn cells
    // west of the authored slabs were still 1.3–1.7 m flat slabs)
    // (the 1.15 m target is for the lawn cells and the disc field only: over the open path any
    // cell with a base target above 1.15 m would have taken it too — six far-spine slabs at
    // z −28 … −60 cracked in the first cut — so the rest of the spine keeps round 23's 1.4 m)
    const midTight = sd.lawn > 0.15 || discField(sd.x, sd.z) > 0.5;
    const midTarget = sd.authored ? Infinity : midTight ? 2.6 - 1.45 * smoothstep(-3.0, -4.6, sd.z) : 2.6 - 1.2 * smoothstep(-3.2, -4.8, sd.z);
    // the crack is a joint like any other (each piece is inset by half the seam), plus 0–2 cm
    const partsOld = breakCell(cell, lawnTarget, brng.range(0, 0.02), BREAK_MIN_ACROSS, brng);
    // the shared stream's draws, exactly as before the mid-ground cuts existed
    const sharedGaps: number[] = [];
    if (partsOld.length === 1) sharedGaps.push(rng.range(0.06, 0.09) * (1 + 2.5 * sd.lawn));
    else for (let i = 0; i < partsOld.length; i++) sharedGaps.push(rng.range(0.03, 0.06));
    const midCut = midTarget < lawnTarget && acrossOf(cell) > midTarget;
    const mrng = midCut ? rng.fork(`break-mid/${Math.round(sd.x * 50)}/${Math.round(sd.z * 50)}`) : null;
    let parts: P2[][] = [];
    let partGaps: number[] = [];
    for (let i = 0; i < partsOld.length; i++) {
      const sub = mrng ? breakCell(partsOld[i], midTarget, mrng.range(0, 0.02), BREAK_MIN_ACROSS, mrng) : [partsOld[i]];
      if (sub.length > 1) stats.brokenLawnMid += sub.length - 1;
      for (const piece of sub) {
        parts.push(piece);
        partGaps.push(sub.length === 1 && partsOld.length > 1 ? sharedGaps[i] : mrng ? mrng.range(0.03, 0.06) : 0);
      }
    }
    // round 23: camera D's foreground path (zones.ts dForeground) is re-broken to a target up to
    // 90 % larger - frame 56 s's path is 1.5–2.5 m slabs (the one under Link's shadow spans half
    // the frame) where the 0.9–1.3 m target cut the thinned lattice's 1.4–1.9 m cells back into
    // ~1 m pieces. The cells that still break take their cuts from their own stream; the shared
    // stream and the other regions' cells are untouched (the seeds do not move)
    // (round 34: the weight is the larger of `dForeground` and `dThin` — the thinned stretch's own
    // lattice runs to z −12.4 where dForeground has faded to 0.35 — and × (1 + 0.9) → × (1 + 1.3),
    // 2.0–2.9 m at full weight: its 1.9–2.4 m cells are the frame's slabs and must stay whole)
    const dFore = Math.max(dForeground(sd.z), dThin(sd.z));
    if (dFore > 0.05 && !sd.authored && sd.lawn < 0.5) {
      const drng = rng.fork(`break-d/${Math.round(sd.x * 50)}/${Math.round(sd.z * 50)}`);
      // (round 38: no piece under 1.45 m across at full weight — the 0.42 m floor let a 2.3 m cell
      // at the frame's bottom edge shed a 0.96 m sliver that the stretch's 13–26 cm seams and 30 %
      // fillets cut down to a 0.3 m² chip in a pale soil gap, D (0.44, 0.91), where frame 56 s has
      // the slab under Link's shadow; the crack is retried elsewhere or given up, as any other)
      const dParts = breakCell(cell, base * (1 + 1.3 * dFore), drng.range(0, 0.02), Math.max(BREAK_MIN_ACROSS, 1.45 * dFore), drng);
      parts = dParts;
      partGaps = dParts.map(() => (dParts.length > 1 ? drng.range(0.03, 0.06) : 0));
      if (dParts.length < partsOld.length) stats.mergedD += partsOld.length - dParts.length;
    }
    // round 33: camera C's plaza (zones.ts `earthPatch`, frame 46 s: mostly dark trodden earth with
    // scattered flat stones, stone share ≈ 40 %; ours paved it edge to edge) — 55 % of the cells
    // in the patch are left as earth. Decided on a hash fork keyed on the seed after every shared
    // draw above, so the cells kept and every cell outside the patch are byte-identical; the
    // authored camera-B slabs and the stepping discs are never dropped.
    const patch = sd.authored ? 0 : earthPatch(sd.x, sd.z);
    if (patch > 0.01 && rng.fork(`patch/${Math.round(sd.x * 50)}/${Math.round(sd.z * 50)}`)() < 0.55 * patch) {
      stats.earth++;
      continue;
    }
    if (parts.length > 1) stats.broken += parts.length - 1;
    if (parts.length === 1) {
      // sliver fringe cells (aspect > 2.6) become two or more stones with a joint between them;
      // the merged path-centre slabs are allowed to be oblong (reference D has 1.3 × 0.6 m stones)
      const pieces = splitElongated(cell, sd.big ? 3.6 : 2.6, sharedGaps[0]);
      if (pieces.length > 1) stats.split += pieces.length - 1;
      for (const piece of pieces) emitStone(piece, sd);
      continue;
    }
    // the halves of a cracked slab are oblong by nature; only a real sliver (aspect > 3.4) is cut again
    const pieces: P2[][] = [];
    for (let i = 0; i < parts.length; i++) {
      const sub = splitElongated(parts[i], 3.4, partGaps[i]);
      if (sub.length > 1) stats.split += sub.length - 1;
      pieces.push(...sub);
    }
    // a piece that would not survive the outline gate or the seating (a step under it) would
    // leave a hole where the whole cell had a stone: try every piece first, and lay the cell
    // unbroken if any fails (the per-stone streams are keyed on position, so the dry run and the
    // real one agree)
    if (pieces.every((piece) => emitStone(piece, sd, true))) {
      for (const piece of pieces) emitStone(piece, sd);
    } else {
      stats.broken -= parts.length - 1;
      emitStone(cell, sd);
    }
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

  /** cut, seat and build one stone from a cell; with `dryRun` it only reports whether the stone would be laid */
  function emitStone(cell: P2[], seed: Seed, dryRun = false): boolean {
    if (cell.length < 3) return false;
    const sc = centroid(cell);
    const s = { x: sc.x, z: sc.z };
    // every per-stone draw comes from a stream keyed on the stone's position (2 cm cells), so a
    // stone's shape and tint stay put when the lattice changes elsewhere on the plaza — box
    // means then move with the region factors below instead of re-rolling every tint
    const srng = rng.fork(`stone/${Math.round(s.x * 50)}/${Math.round(s.z * 50)}`);
    // reference joints are 5–10 cm of moss and soil, wider where the paving is old (macro noise)
    const jointN = wearN.fbm(s.x * 0.3 + 11, s.z * 0.3 - 4, 2) * 0.5 + 0.5;
    const ea = srng.range(0.01, 0.026);
    // 1 on the flat open paving (big flush slabs, thin joints), 0 in the damp band. Round 23:
    // camera D's foreground path is open paving too - frame 56 s reads it as 1.5–2.5 m slabs,
    // nearly flat, in thin near-black seams (rounds 10–22 gave it round 10's domed stones in wide
    // dark joints, and its box measured 0–0.35 luminance at 39 % against the frame's 21 %)
    const open = 1 - dampBand(s.z);
    // the lawn paving (zones.ts): slabs set in 15–45 cm of turf, corners rounded off at a third
    // of the slab (reference B/E foreground: big rounded slabs in lawn, no straight seams)
    const lawn = seed.lawn;
    // the stepping-stone discs on Saria's ramp keep their round-9/10 profile and outline (the
    // reference B frame shows them domed): every draw below is shared with them, only the
    // mapping differs, so their stream — and every other stone's — stays in step
    const disc = !!seed.disc;
    // shoulder and fillet scale with the stone
    const size = Math.sqrt(Math.abs(polygonArea(cell)));
    // round 33 (zones.ts `discField`): the spine north of the plaza is a field of rounded, softly
    // domed stones in 9–22 cm gaps of earth and grass — frames 14 s (behind Link), 46 s
    // (foreground) and 56 s all read it so; our lattice of angular slabs in 3–4 cm hairlines was
    // the largest visible difference in the B/C/D lower halves. `south` is camera A's plaza, whose
    // frame-1 s joints are 5–12 cm of dark green-brown moss between angular slabs.
    const field = disc ? 0 : discField(s.x, s.z);
    const dFore = disc ? 0 : dForeground(s.z);
    const south = disc ? 0 : southPlaza(s.z) * (1 - dampBand(s.z));
    if (field > 0.5 && !dryRun) stats.field++;
    // the geometric gap is 4.5–9 cm (4–8.3 cm between the open-paving slabs); the shoulders
    // and the sunk side walls add ~1 cm of visual joint on each side, so the rendered seam
    // reads 5–10 cm of dark dirt/moss like boards 02/07
    const uJoint = srng();
    // (round 22: the open paving's seams narrow to ~55 % - frame 1 s reads 3-5 cm dark joints on its
    // ~1 m plaza slabs where ours rendered 8-12 cm of brown; A's plaza box counted 29 % brown-soil
    // pixels against the frame's 15 % and 24 % stone-like against 40 %)
    // (round 23: the open paving's geometric seam is the frame's 3–5 cm dark line itself, 2.3–4.6
    // cm (half of round 21's) breathing ±1.4 cm with the wobble below; the damp band's 3.5–6.5 cm.
    // The visible seam used to be 2–3× the geometric one - the dark flank, the flank-coloured
    // shoulder ring and the shoulder dirt on both sides - and the A/D boxes counted 6–10 px dark
    // lines against the frame's 2–3 px; those three are now stone-toned and the fill's crevice
    // shading carries the line)
    const damp0 = dampBand(s.z);
    // (round 33: camera A's plaza seams back up to 3.8–7.7 cm geometric (× 0.84, was × 0.42) —
    // measured inside the paving mask, frame 1 s's plaza has 43 % of its pixels in the joint
    // class against our 50 % but its joints are 5–12 cm of moss and dark earth where ours were
    // 2–3 px hairlines with the rest of the darkness in Link's and the trees' shadows; the seam
    // widening comes with the shoulder moss below so the joints read green-brown, not black)
    const seamJoint = disc ? (0.035 + 0.03 * jointN + 0.01 * uJoint) * (1 - 0.35 * open) + 0.015 * damp0 : (0.045 + 0.035 * jointN + 0.012 * uJoint) * (0.42 + 0.28 * damp0 + 0.42 * south) + 0.005 * damp0;
    // the disc field's gaps (no new draw: `uJoint` jitters them): 9–22 cm, frame 14 s's 0.08–0.2 m
    const fieldJoint = 0.09 + 0.09 * jointN + 0.04 * uJoint;
    // (no draw for the stones outside the lawn, so their streams stay exactly as before)
    // (12–28 cm on the bottom row: the reference's bottom-row seams are 15–25 cm, its 40 cm gaps
    // are dirt patches; round 23: camera B's mid-ground slabs, z < −2.6, sit closer - frame 14 s
    // reads 3–8 cm seams between the slabs behind Link - so the turf joint narrows to a quarter)
    const lawnMid = smoothstep(-2.6, -4.0, s.z);
    const lawnJoint = (0.12 + 0.12 * jointN + (lawn > 0 ? srng.range(0, 0.04) : 0)) * (1 - 0.75 * lawnMid);
    // where the disc field takes over the seam: everywhere in it except camera B's bottom row
    // (lawn slabs at z > −2.6, which keep their 12–28 cm turf joints); the round-23 mid-ground
    // narrowing (lawnMid) is what it replaces — frame 14 s at 3× shows the stones behind Link in
    // 8–20 cm gaps, not 3–8 cm seams
    // (and at half strength on camera D's foreground stretch: frame 56 s's bottom quarter is flat
    // 1.5–2.5 m slabs with rounded corners in 8–15 cm grass joints, not the discs of 14 s; the
    // full field there took the stone share of z −8 … −11 from 81 % to 59 % — the frame's is ≈ 75 %)
    const fieldW = field * (1 - lawn * (1 - lawnMid)) * (1 - 0.5 * dFore);
    // round 34: the thinned stretch's own lattice (`dThin`) lays 1.9–2.4 m slabs, and frame 56 s
    // at 2× sets them in 0.15–0.3 m of shadowed grass and earth (gap runs p50 0.22 m in its bottom
    // quarter against our 0.16 m, 0.10 m once the slabs merged at 9–20 cm seams): 13–26 cm
    // geometric seams there, on `uJoint` (no new draw); 0 elsewhere leaves the seam as is
    // (round 38: 13–26 → 9–19 cm north of z −7.8. Classified through the paving in camera D's
    // paved band (frame y 0.55–1.0, Link and the HUD out), stone was 60 % of the band and the
    // joint fill 40 % at a median 0.39 against the stones' 0.51, where frame 56 s at the same
    // pixels has 88 % above the fill's tone: its slabs meet in 8–11 cm dark seams (15–20 px
    // across at y 0.9, 0.55 cm/px), and the wide mid-tone bands read as runs of missing stone,
    // not as its seams. The one 0.3 m gap the frame does have is its bottom row's (y ≈ 0.84,
    // z −7.0 … −7.8 under Link's shadow), so that row keeps the 13–26 cm)
    const dThinW = disc ? 0 : dThin(s.z);
    const dNarrow = smoothstep(-7.4, -8.2, s.z);
    const dJoint = 0.13 + 0.08 * jointN + 0.05 * uJoint - (0.04 + 0.02 * jointN + 0.01 * uJoint) * dNarrow;
    // corners: 14 % of the slab (5–16 cm; round 23 - frame 1 s's plaza slabs are irregular with
    // rounded corners; 12 % read as chamfered hexagons and a quarter of the slab as cobbles set
    // in mortar, with 8–15 cm junction triangles); the lawn slabs' 18 % (7–24 cm); round 33: the
    // plaza's 17 % (frame 1 s's corners are rounder than round 23 left them), the disc field's
    // 30 % (10–42 cm: the stones read as ovals and rounded discs, frames 14 s / 56 s)
    const seamFillet = disc ? clamp(0.15 * size, 0.055, 0.12) : clamp((0.14 + 0.03 * south) * size, 0.05, 0.16 + 0.02 * south);
    const lawnFillet = clamp(0.18 * size, 0.07, 0.24);
    const fieldFillet = clamp(0.3 * size, 0.1, 0.42);
    // edge wobble (cellToOutline): ±1 cm on the open paving, ±0.6 cm on the lawn slabs, none on
    // the discs, under a noise phased per stone so the two sides of a seam move independently and
    // the seam pinches to a hairline and opens to 5–6 cm along its length (frame 1 s at 4×: the
    // joints are broken lines of uneven width, not channels); the seam is narrowed by 1.5× the
    // amplitude so its mean grows only ~0.5 cm, and never closes (min = seam − 1.5 × amplitude)
    const wobble = disc ? 0 : 0.01 * (1 - 0.4 * lawn) * (1 - 0.4 * fieldW);
    const wobblePhase = ((Math.round(s.x * 50) * 7919 + Math.round(s.z * 50) * 104729) % 977) * 0.113;
    const baseJoint = seamJoint + (lawnJoint - seamJoint) * lawn;
    const baseShoulder = disc ? clamp(0.055 * size, 0.022, 0.042) : clamp(0.04 * size, 0.016, 0.03);
    // the disc field's rolled edge: 6 % of the stone (3–6 cm), the soft shaded rim frame 14 s
    // shows round every stone at 6–10 m
    const fieldShoulder = clamp(0.06 * size, 0.03, 0.06);
    const uShoulder = srng.range(0.85, 1.15);
    const uFillet = srng.range(0.8, 1.2);
    const notchy = srng.chance(0.65);
    const style: OutlineStyle = {
      // the damp band's seams are the widest (reference B/E foreground: 8–12 cm of soil and moss
      // between the stones — its plaza box has the same dark and bright tones as ours but more
      // of its area is joint)
      joint: Math.max(0.012, baseJoint + (fieldJoint - baseJoint) * fieldW + (dJoint - baseJoint - (fieldJoint - baseJoint) * fieldW) * dThinW - 1.5 * wobble),
      // a narrow shoulder (1.6–3 cm, was 2.2–4.2): the edge reads as a break, not a roll
      shoulder: (baseShoulder + (fieldShoulder - baseShoulder) * fieldW) * uShoulder,
      // (round 38: 30 % less corner on camera D's stretch — at fieldW 0.5 the 2 m slabs carried
      // 0.23–0.35 m fillets, and with the seams those made 0.4–0.6 m earth triangles at every
      // three-way junction; frame 56 s's junctions are 0.2–0.3 m)
      fillet: (seamFillet + (lawnFillet - seamFillet) * lawn + (fieldFillet - seamFillet - (lawnFillet - seamFillet) * lawn) * fieldW) * uFillet * (1 - 0.3 * dThinW * dNarrow),
      erosion: disc ? ea * (1 + lawn) : ea * 1.3 * (1 + 0.5 * lawn) * (1 - 0.5 * fieldW),
      roundArcs: !disc,
      broken: !disc,
      // two thirds of the stones carry notches (a quarter of their long edges, two at most); none
      // in the disc field (its stones are rounded, not broken — the draw is kept for the stream)
      notchChance: disc || fieldW > 0.5 ? 0 : notchy ? 0.25 : 0,
      notchDepth: clamp(0.07 * size, 0.025, 0.06),
      erodeFn: (x, z) => wearN.fbm((x + s.x) * 5.5 + 21, (z + s.z) * 5.5 - 9, 2) * 0.5 + 0.5,
      wobble,
      // two octaves: a 2 cycles/m bow (a metre of edge bows once or twice) and a 9 cycles/m
      // crumble (the chipped, broken edge of frame 1 s at 4×)
      wobbleFn: (x, z) => 0.6 * (wearN.fbm((x + s.x) * 2.0 + 57 + wobblePhase, (z + s.z) * 2.0 - 33, 2) * 0.5 + 0.5) + 0.4 * (wearN.fbm((x + s.x) * 9.0 - 71 - wobblePhase, (z + s.z) * 9.0 + 19, 1) * 0.5 + 0.5),
      // (round 23: a sixth of the corners chipped, was a third - most of the frame's corners are round)
      chipChance: 0.17 * (1 - fieldW),
    };
    // work in seed-local coordinates (the stone is built around its centroid, then placed)
    const local = cell.map((p) => ({ x: p.x - s.x, z: p.z - s.z }));
    const outline = cellToOutline(local, style, srng);
    if (!outline) {
      if (!dryRun) stats.skippedSmall++;
      return false;
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
    // flat slabs (boards 02/06/07): the shoulder rolls down 0.7–1.2 cm to the outer edge (was
    // 1.2–2) and the top rises only 0.25–1.3 cm above it (half of round 10's 0.5–2.6) — the
    // stepping-stone discs keep the round-10 cushion
    const uBevel = srng();
    // round 33: the disc field's stones roll like the stepping discs (1.2–2 cm) and dome 0.6–2.9
    // cm — frames 14 s / 56 s read their edges as soft shaded rims, ours as flat cut slabs
    const bevel = disc ? 0.012 + 0.008 * uBevel : 0.007 + 0.005 * uBevel + (0.005 + 0.003 * uBevel) * fieldW;
    const lowCrown = srng.chance(0.35);
    const uCrown = srng();
    const crownRaw = lowCrown ? 0.005 + 0.007 * uCrown : 0.012 + 0.014 * uCrown;
    const crownFull = crownRaw * (1 - 0.45 * open);
    let crown = disc ? crownFull : 0.5 * crownFull + (1.1 * crownRaw - 0.5 * crownFull) * fieldW;
    // round 23 weathering, on the stone's own stream (a hash fork: the draws above and below stay
    // where they were). Worn dish: the big slabs (≥ 0.7 m) of the paths and plaza are trodden
    // hollow 0.6–1.8 cm (frame 56 s's path-centre slabs, frame 1 s), the lawn slabs and the
    // discs keep their crown; the dish replaces the crown (crown < 0 in the audit).
    const wrng = rng.fork(`wear/${Math.round(s.x * 50)}/${Math.round(s.z * 50)}`);
    // (round 33: no dish in the disc field — its stones are domed; the draw order is unchanged)
    const dished = !disc && size >= 0.7 && lawn < 0.5 && wrng.chance(0.75) && fieldW < 0.5;
    if (dished) crown = -(0.006 + 0.012 * wrng());
    // a dirt-filled crack across one slab in eight (≥ 0.45 m; frame 1 s shows a few cracked
    // plaza slabs): through a point within a quarter-radius of the centre, at any angle, spanning
    // the slab or (two in five) petering out at 60 % of the radius; drawn by the stone shader from
    // the affine `aCrack` coordinates, with a 3–6 mm settlement step across it
    const cracked = !disc && size >= 0.45 && wrng.chance(0.125);
    const crackAng = wrng.range(0, Math.PI);
    const crackOff = wrng.range(-0.25, 0.25);
    const crackHalf = wrng.chance(0.4) ? 0.6 : 1.1;
    const crackStep = wrng.range(0.003, 0.006) * (wrng.chance(0.5) ? 1 : -1);
    // round 34: the within-stone mottle (material.ts `aMottle`, frames 1 s / 56 s at 2×: two or
    // three tone regions on a slab). Moss cushions creep in from the shaded (north-west) rim and
    // the joints on two stones in three, grey lichen patches sit anywhere on one in two — both on
    // their own hash fork, so the streams above and below stay in step; nothing on the discs
    // (frame 14 s's stepping stones are pale to their rims). The lawn slabs (B/E's bottom row,
    // pale to their edges with the moss in the seams) take half the cushions. Camera A's plaza
    // (`south`) is the mossy one: frame 1 s's slabs carry an olive moss film over their shaded
    // halves (its dark stone pixels sit 31 % in the 50–70° hue bins against our 8 %; B / D's
    // frames 4–10 %), so nine plaza stones in ten take a cushion and the cushions there are
    // green (`mottleGreen`, the shader's moss mix) where the path's are khaki.
    const mrng2 = rng.fork(`mottle/${Math.round(s.x * 50)}/${Math.round(s.z * 50)}`);
    const mottleMoss = disc ? 0 : mrng2.chance(0.66 + 0.24 * south) ? mrng2.range(0.45, 1.0) * (1 - 0.5 * lawn) : 0;
    const mottleGrey = disc ? 0 : mrng2.chance(0.5) ? mrng2.range(0.4, 1.0) : 0;
    const mottleGreen = south;
    const mottleDir = [-0.6 + mrng2.range(-0.3, 0.3), -0.8 + mrng2.range(-0.3, 0.3)];
    const mottleL = Math.hypot(mottleDir[0], mottleDir[1]);
    mottleDir[0] /= mottleL;
    mottleDir[1] /= mottleL;
    let thickness = srng.range(0.09, 0.12);
    // the outer edge stands 1.1–1.7 cm proud of the mean ground (joint fill is at +0.8 cm; the
    // 1.6 cm centre clamp below usually decides), the shoulder rolls up another 0.7–1.2 cm, so the
    // tops sit 1.5–2.5 cm over the fill and the joint is a recessed channel whose near-black
    // crevice fill makes the dark line (round 23; frame 1 s / 56 s: thin near-black recessed
    // joints). The wall itself stays short: from the grazing A/D cameras a vertical wall projects
    // at 2–3× a gap of the same size, and round 23's first try (2–3.6 cm proud, a dark flank)
    // rendered the seams as 6–10 px lines where the frame's are 2–3 px - the frame's slabs are
    // near flush and their dark line is the crevice. The edge must clear the fill uphill and never
    // float > 3 cm downhill.
    // (round 33: the disc field's stones stand 1.6–2.7 cm proud — a rounded stone in a 9–22 cm
    // earth gap shows its rolled edge, the frame's soft dark rim round each disc)
    const exposed = srng.range(0.011, 0.017) * (1 - 0.15 * open) * (1 + 0.6 * fieldW);
    if (hMax - hMin > 0.28) {
      // a slab cannot sit across a step this high (terrace lips, bank feet): leave soil here
      if (!dryRun) stats.skippedSteep++;
      return false;
    }
    if (dryRun) return true;
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
    // a dish must not sink the top's centre below the joint fill (terrain + 0.8 cm, joints.ts):
    // keep it ≥ 1.5 cm over the ground at the centre (the first cut let a 1.8 cm dish on a
    // 1.6 cm rim put the centre 0.5 cm over the ground, under the fill)
    if (crown < 0) crown = Math.max(crown, hCentre + 0.015 - (rimY + bevel));
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
    const darkWarm = !grey && srng.chance(0.15);
    // (round 22: +-0.17 and one in five a darker warm brown - the frame's plaza stones differ more
    // stone to stone than ours did at the same mean)
    // (round 23: the whole-stone spread back to +-0.08 with one in five a darker grey (x0.91) and
    // one in seven a darker warm brown (x0.87): the band masks of take 76 show the frame's
    // variation is WITHIN a slab - pale worn spots over 0.6 and grime patches under 0.45 on the
    // same stone (the shader's aWear mottling now) - where ours was whole pale slabs beside whole
    // mid ones. The mean comes DOWN 8 %: per row of the A plaza box our mean luminance matched
    // the frame's within 0.01–0.02 while our share over 0.6 ran 34 % against 24 % - the "0.04
    // too dark" lit-stone mean was the classifier skipping our brightest, most saturated pixels,
    // not a dark albedo; the saturation is what moves below)
    // (round 34: camera D's thinned stretch spreads its slabs ± 0.14 — frame 56 s's big slabs are
    // a pale one beside a grey one beside a khaki one, between-stone lum sd 0.035 against the
    // 0.022 that eight alike 2 m slabs gave; the same draw, so nothing else re-rolls)
    // (the thinned stretch's mean + 0.04: its nine slabs drew an area-weighted 0.915 against the
    // 0.942 of the 28 they replaced — the two 2 m slabs nearest camera D at 0.84 / 0.81 — and
    // frame 56 s's stone class rendered p50 0.532 against the frame's 0.557 / the control's 0.584)
    let lum = 0.89 + 0.08 * tn + srng.range(-0.08, 0.08) * (1 + 0.7 * dThinW) + (seed.big ? 0.02 : 0) + 0.04 * dThinW;
    if (grey) lum *= 0.91;
    if (darkWarm) lum *= 0.87;
    // (round 9: the stone albedo came down 28 % as a whole (material.ts STONE_ALBEDO_SCALE) to
    // put the sunlit A/D paving on the reference; the band's own darkening shrank with it so the
    // B foreground keeps the reference's lit-top ratio to A — B/A 0.89 in sRGB, ours had 0.83)
    // (round 22: the band's darkening and greying are cut to a third. Measured on take-74 against
    // frame 14 s, B's foreground rows (y > 0.8) had NO stone above 0.6 luminance where the frame
    // has 15 % of its ground there, 26 % of the band in 0.25–0.35 against 13 %, and its lit stone
    // (lum > 0.35, sat < 0.22) at saturation 0.096 against the frame's 0.188 with hue 47° vs 40°;
    // the A plaza, outside the band, matched the frame on all three (0.189 / 0.183, 43° / 42°).
    // The band still exists — reference B's stones are a touch darker and mossier than A's — but
    // it was rendering as grey, not damp.)
    // (round 23: the band's 3 % darkening becomes a 7 % lift - B's centre-right box has 21–24 %
    // of its area in 0.45–0.6 against the frame's 42 % and its lit stone renders at 0.46 against
    // the frame's 0.49, the same as the frame's A plaza (0.49); the sun probes say those slabs are
    // lit, so the albedo carries the difference)
    // (round 33: 0.07 → 0.11 - measured inside the paving mask, camera B's stone class rendered
    // at p50 0.498 against frame 14 s's 0.528 while A's matched (0.542 / 0.545); the band is B's
    // z −1.8 … −4.8, so the lift lands where the gap is)
    lum *= 1 + 0.11 * damp;
    lum *= 1 - 0.03 * southPlaza(s.z);
    // camera D's foreground is the most trodden stretch of the path: its slab tops are the palest
    // of their own frame, but not paler than the A plaza (reference lit tops D 0.58 / A 0.63 in
    // sRGB, ours rendered 0.67 / 0.69) — no extra lift
    // (round 23: the band's hue shift halved and its blue lift cut to 0.10 - B's lit stone was
    // rendering at sat 0.153 / hue 46 against the frame's 0.183 / 43, greyer than the frame now;
    // +0.025 blue everywhere: A's lit tops sat 0.200 against 0.183)
    // (round 33: the per-stone hue swing ±0.05 → ±0.08 - segmented stone by stone inside the
    // paving mask, the frame's stones spread 8–11° in hue (B 8.2°, D 3.4°) against our 2.9° / 1.4°;
    // the whole-stone luminance spread already matched (sd 0.03–0.04 both) and stays)
    // (round 34: the thinned stretch leans grey-green like the damp band — with its slabs darker
    // and the cushions on them, frame 56 s's stone class rendered hue 36° / sat 0.36 against the
    // frame's 40° / 0.32 that the control matched)
    const hueK = srng.range(-0.05, 0.05) * 1.6 + (darkWarm ? 0.035 : 0) - 0.04 * damp - 0.06 * dThinW;
    // the shaded band renders redder and more saturated than the sunlit plaza under the warm
    // fill light (B lit tops sRGB B/R 0.61, R/G 1.20 against the reference's 0.69 / 1.12, where
    // the A plaza matches at 0.71 / 1.10) and the post chain passes only ~1/4 of an albedo
    // colour change, so its stones' albedo leans grey-green (hueK −0.22, satK +0.55 at full
    // dampness) to render as the reference's khaki grey (B lit tops 0.70 / 1.12, hue 39°)
    // (round 23: the open paving's blue up 0.11 more. Per luminance band, A's lit stone (0.45–0.6)
    // rendered at saturation p10/p50/p90 0.21/0.24/0.27 against the frame's 0.16/0.21/0.26, so
    // only 18 % of that band passed the stone classifier's sat < 0.22 against the frame's 60 %:
    // the sRGB chroma follows the linear albedo chroma at about its square root, so +13 % blue
    // is worth ≈ −0.025 of saturation. The damp band's own lift comes down to 0.06 - B's lit
    // stone rendered at 0.172 against the frame's 0.183 after the first cut and its 0.45–0.6 band
    // is already greyer than the frame's (p50 0.18 vs 0.23))
    // (measured +0.11 → +0.02 of sRGB B/R on A's 0.45–0.6 band (0.62 → 0.64, frame 0.66): the
    // post chain's highlight tint (B/R × 0.88) and warm mix take most of it; +0.22 landed at 0.68,
    // so +0.18, with red down 3 % so the hue lands on the frame's 41° rather than yellowing)
    // (round 33: the damp band's blue 0.06 → 0.10 (B's stone class rendered sat 0.360 against the
    // frame's 0.336) and camera D's foreground path a third less of the open paving's blue (D's
    // 0.313 against 0.342); A's plaza, which matched at 0.315 / 0.315, is untouched)
    const satK = srng.range(-0.04, 0.04) + (grey ? 0.075 : 0) - (darkWarm ? 0.04 : 0) + 0.1 * damp + 0.045 + 0.18 * open * (1 - 0.35 * dFore);
    const tint: [number, number, number] = [lum * (1 + hueK) * (1 - 0.03 * open), lum * (1 - hueK * 0.3), lum * (1 - hueK * 0.5 + satK)];
    // moss lives in the joints and creeps onto the shoulders; a green film covers the shaded
    // north/west side of ~30 % of the stones (damp side, reference B/E), more on the damp path
    const moss = clamp(0.25 + 0.6 * (tintNoise.fbm(s.x * 0.5 + 7, s.z * 0.5, 2) * 0.5 + 0.5) - 0.2 * smoothstep(3, 0, Math.hypot(s.x, s.z)) + 0.2 * damp, 0.05, 0.9);
    // (round 23: the film at 60 % of its strength - frame 14 s's band slabs are pale to their
    // edges with moss only in the seams, ours carried a dark green film over their shaded half;
    // the draw order is kept: same chance, same range, scaled)
    const film = srng.chance(0.3 + 0.25 * damp) ? srng.range(0.35, 0.7) * 0.6 : 0;
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
    // (round 23: a third of it on every stone, the discs too - with the moss film and the
    // flank-coloured bevel it made a 5–8 cm dark halo round every slab, the "rolled shoulder"
    // that doubled the 0.25–0.35 share in B's mid-ground; the frame's edges stay lit to the
    // break. Frame 14 s's stepping stones up the ramp are pale, lit discs; ours rendered mid-grey
    // with a dark rim, and they ARE camera B's mid-ground in the centre-right box)
    const rim = srng.range(0.06, 0.13) * 0.35;
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
    // Round 12: from camera A's low angle 42 % of a 5–10 cm joint's pixels are the far slab's
    // flank, and it rendered as lit stone (sRGB 156,134,95 against the reference seam's 78,66,45),
    // so the seam tone is as much the flank as the fill: the flank of a paved stone is darker and
    // browner (soil-grimed cut edge, frame 1 s / board 02) with a stronger stain at the fill line.
    // The stepping-stone discs keep round 11's flank (they are pixel-identical); the lawn slabs
    // keep most of theirs (B/E match) — 15 % of the darkening.
    // (round 23: the flank back to stone - 0.85 / 0.83 / 0.78 of the stone side colour, the lawn
    // slabs 40 % of that. The dark flank was the wrong cue: from the low A/D cameras the far
    // slab's wall is 2–3× the gap's height on screen, so a dark wall made every seam a 6–10 px
    // band where the frame's is a 2–3 px near-black line. The line is now the crevice fill
    // (joints.ts CREVICE_TINT) in the gap; the wall is the same stone, dust-stained at its foot)
    const flankW = disc ? 0 : 1 - 0.6 * lawn;
    const footStain = (FLANK_STAIN_AT_FILL * (1 + 0.2 * flankW) * wallH) / (wallH - fillH);
    const flankK: [number, number, number] = [1 - 0.15 * flankW, 1 - 0.17 * flankW, 1 - 0.22 * flankW];

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
    // the crack line in slab-local coordinates (affine: exact under interpolation)
    const cnx = Math.cos(crackAng);
    const cnz = Math.sin(crackAng);
    const cpx = c.x + cnz * crackOff * radius;
    const cpz = c.z - cnx * crackOff * radius;
    const crackAcross = (x: number, z: number) => (x - cpx) * cnx + (z - cpz) * cnz;
    const sideColor: [number, number, number] = [(tint[0] * 0.6 + 0.24) * flankK[0], (tint[1] * 0.58 + 0.2) * flankK[1], (tint[2] * 0.55 + 0.16) * flankK[2]];
    // the shoulder ring in the stone's own tone (a shade down), not the flank's (round 23): the
    // flank-coloured shoulder was a 1.6–3 cm dark band on both sides of every seam, and a dark
    // ring round every stepping-stone disc
    const shoulderMix = 0;
    buildSlab(all, outline.outer, {
      thickness,
      bevel,
      topRing: outline.inner,
      notchedTop: outline.notches > 0 || outline.wobbled,
      softBevel: true,
      dip: -crown,
      color: tint,
      sideColor,
      bevelColor: [tint[0] * 0.95 * (1 - shoulderMix) + sideColor[0] * shoulderMix, tint[1] * 0.95 * (1 - shoulderMix) + sideColor[1] * shoulderMix, tint[2] * 0.95 * (1 - shoulderMix) + sideColor[2] * shoulderMix],
      sideStain: footStain,
      // (round 23: the shoulder moss at 30 % on the open paving and the lawn slabs, 75 % in the
      // damp band's seams - frame 1 s / 56 s: moss in a few joints, not a film round every slab;
      // the rim stones' edge film is separate, below; the discs take the same)
      // (round 33: camera A's plaza takes the moss back to 0.7 × - frame 1 s's joints are moss and
      // dark earth creeping over the slab edges; with the seams widened the green has to be there
      // or the joints read as black lines. The disc field's stones keep the open paving's 0.4 ×:
      // frame 14 s's discs are pale to their rims with the green in the gaps)
      mossEdge: 0.3 * moss * (1 - 0.6 * Math.max(open, lawn) + 0.3 * south),
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
      // the crack's settlement: one half sits 3–6 mm lower (smooth over ±1.5 cm across the line)
      topNoise: (x, z) => 0.003 * wearN.noise((x + s.x) * 7 + 3, (z + s.z) * 7) + (cracked ? crackStep * (smoothstep(-0.015, 0.015, crackAcross(x, z)) - 0.5) : 0),
      // a second ring gives the edge film somewhere to end (5–15 cm in) on the small rim stones
      rings: radius > 0.42 || edgeMoss > 0 ? 2 : 1,
      wear: disc ? 0.75 : 1,
      // the wall shaded like the top (geometry.ts): a 1–2 cm wall facing away from the sun was a
      // dark band 2–3× the seam's height from cameras A and D
      sideNormalUp: 0.75,
      crackFn: cracked ? (x, z) => [crackAcross(x, z), ((x - cpx) * -cnz + (z - cpz) * cnx) / Math.max(0.1, crackHalf * radius)] : undefined,
      // the cushions' weight: full on the shaded rim, a third on the lit rim, fading to a fifth
      // at the centre (the shader grows lobed patches where the weight is high); the lichen's
      // weight is even over the top
      mottleFn:
        mottleMoss > 0 || mottleGrey > 0
          ? (x, z, edge) => {
              const d = ((x - c.x) * mottleDir[0] + (z - c.z) * mottleDir[1]) * invR;
              const side = 0.35 + 0.65 * smoothstep(-0.5, 0.6, d);
              return [mottleMoss * side * (0.2 + 0.8 * smoothstep(0.1, 0.95, edge)), mottleGrey, mottleGreen];
            }
          : undefined,
    });
    q.setFromUnitVectors(up, nAcc);
    pos.set(s.x, bottomY, s.z);
    one.compose(pos, q, new Vector3(1, 1, 1));
    all.transform(one, from);

    const poly = outline.outer.map((p) => ({ x: p.x + s.x, z: p.z + s.z }));
    const stone: PlacedStone = {
      x: s.x,
      z: s.z,
      polygon: poly,
      shape: outlineHash(outline.outer),
      radius,
      thickness,
      bottomY,
      topY,
      moss,
      aspect: cellAspect(outline.outer).aspect,
      crown,
      bevel,
      shoulder: style.shoulder,
      fillet: style.fillet,
      // the nominal mean seam: the inset joint plus the wobble's two half-amplitudes
      joint: style.joint + 2 * wobble,
      notches: outline.notches,
      chips: outline.chips,
      cracked,
      mottleMoss,
      mottleGrey,
      lum,
    };
    stoneGrid.add(s.x, s.z, stones.length);
    stones.push(stone);
    stats.notches += outline.notches;
    stats.chips += outline.chips;
    if (edgeMoss > 0) stats.edgeMossStones++;
    if (dished) stats.dished++;
    if (cracked) stats.cracked++;
    if (outline.wobbled) stats.wobbled++;
    return true;
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

  const seedAudit = seeds.map((s, i) => ({ x: s.x, z: s.z, lawn: s.lawn, active: active[i] === 1, phantom: !!s.phantom }));
  return { stones, mesh, triangles: all.vertexCount / 3, grid: stoneGrid, onStone, edgeGap, steppingStones: discs, seeds: seedAudit, stats };
}
