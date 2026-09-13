/**
 * Vegetation placement field. A coarse grid caches the expensive terrain mask/normal queries so
 * a million grass candidates can be tested quickly; anything near a path/stair edge is
 * re-checked exactly against `terrain.vegetationAllowed` so no blade lands on flagstones.
 * Also owns the authored-layout influences (path verges, stair flanks, giant trunks, hero
 * boulders, NPC spots) and the clustering noise that keeps the grass from being a carpet.
 */
import { Vector3 } from 'three';
import { houseSteppingStones, type SteppingStone } from '../layout';
import type { WorldContext } from '../system';
import { Noise2D, smoothstep, clamp, lerp } from '../util/noise';

export interface FieldSample {
  /** soft 0..1 “vegetation may grow here” (1 = certainly) */
  allow: number;
  path: number;
  stairs: number;
  structure: number;
  cliff: number;
  plateau: number;
  slope: number;
  nx: number;
  ny: number;
  nz: number;
  h: number;
}

type P3 = readonly [number, number, number];

/** distance to a polyline, and whether the closest point is one of its two end vertices (its round end cap) */
function polylineClosest(points: readonly P3[], x: number, z: number): { dist: number; cap: boolean } {
  let best = Infinity;
  let cap = false;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0];
    const az = points[i][2];
    const dx = points[i + 1][0] - ax;
    const dz = points[i + 1][2] - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    t = clamp(t, 0, 1);
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) {
      best = d2;
      cap = (i === 0 && t === 0) || (i === points.length - 2 && t === 1);
    }
  }
  return { dist: Math.sqrt(best), cap };
}

function polylineDistance(points: readonly P3[], x: number, z: number): number {
  return polylineClosest(points, x, z).dist;
}

/** parameter 0..1 of the closest point on a→b to (x, z) */
function segmentT(seg: { ax: number; az: number; bx: number; bz: number }, x: number, z: number): number {
  const dx = seg.bx - seg.ax;
  const dz = seg.bz - seg.az;
  const len2 = dx * dx + dz * dz;
  return len2 > 0 ? clamp(((x - seg.ax) * dx + (z - seg.az) * dz) / len2, 0, 1) : 0;
}

function segmentDistance(seg: { ax: number; az: number; bx: number; bz: number }, x: number, z: number): number {
  const t = segmentT(seg, x, z);
  return Math.hypot(x - seg.ax - (seg.bx - seg.ax) * t, z - seg.az - (seg.bz - seg.az) * t);
}

interface StairRect {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  run: number;
  halfWidth: number;
}

/** Soft-edged axis-aligned world box [x0, z0, x1, z1] → 1 inside, fading to 0 over `feather` metres. */
function softBox(x: number, z: number, box: readonly [number, number, number, number], feather: number): number {
  const dx = Math.max(box[0] - x, x - box[2], 0);
  const dz = Math.max(box[1] - z, z - box[3], 0);
  return 1 - smoothstep(0, feather, Math.hypot(dx, dz));
}

/**
 * Reference-driven "keep it low" areas (world boxes; see reference/ANALYSIS.md §2):
 *  - the slope east of the north path between camera C and the main stairs, which the reference
 *    shows as low grass (frame 46: the stair foot is visible over it; frame 56: low verge with a
 *    few ferns right of the path, nothing above ~0.5 m).
 *  - the plaza end of the main stair's south bank (terrain S_BANK), camera A's right foreground
 *    3–6 m out (frame 1: x 0.78–1.0 × 0.7–1.0): the reference shows the Kokiri kid standing in
 *    lit grass tufts on the bank's face, no fronds — without this the ferns' slope boost fills
 *    the ~50° face with fronds.
 */
const LOW_ZONES: readonly [number, number, number, number][] = [
  [1.5, -16, 8, -4],
  [3.0, 4.6, 6.0, 7.2],
];
/**
 * Frame 14 s' left third (B 0–0.3 × 0.62–0.9): a low green LAWN band with white dots meets the
 * flagstones at a soft grass edge. The paving's lawn pocket is hardscape's; the turf this side of
 * it — the spine's west verge from the pocket's north end to the shot-D boulder, also frame 56's
 * bottom-left grass strip — reads as dense short turf with clover and white clumps, no fern clumps
 * or tall herbs (in take 65 a dozen 0.6–1.1 m fern clumps stood in it, hiding the far dots).
 */
const LAWN_BAND: readonly [number, number, number, number] = [-3.3, -10.5, -1.6, -6.4];
/**
 * Camera C stands IN the grass at (3.2, −9.5): anything 1–3 m to its left/front is in frame at
 * frond scale, so the ground around the camera is grass only (≤ 0.4 m). The sight line itself
 * (frame 46's left third, where the stair foot shows at (0.12, 0.67) and the stair-foot rock at
 * (0.28, 0.5)) is a wedge computed from the viewpoint, see `VegField.sightlineC`.
 */
const C_GRASS_BOX: readonly [number, number, number, number] = [1.5, -12, 7.5, -4];
/** screen-x span of frame 46 that must stay clear (the box is x 0–0.3; ±margin for frond reach) */
const C_FRAME_SX: readonly [number, number] = [-0.02, 0.34];
/** view depth of the wedge: up to the stair-foot rock's near face (centre 12.7 m); beyond it the rock, the stairs and the plaza fill the view */
const C_FRAME_DEPTH = 12;
/**
 * Verge south-east of the plaza, the right foreground of frames 1 and 8: tidy short tufts. The
 * plaza end of the south bank's face (the low zone above) is left out: there the reference's tufts
 * are the untrimmed lit grass the kid stands in, and the low zone already keeps them short.
 */
const TRIM_ZONES: readonly [number, number, number, number][] = [
  [4, 0, 12, 4.6],
  [6.0, 4.6, 12, 8],
];
/**
 * The plateau flank right of the stairs in frame 8 (0.55–1 × 0.3–0.6, world x ≳ 11): shaded
 * olive moss/grass. The reference box measures ≈ 0.30 luminance with visible blade texture, so it
 * is a tint bias, not a blackout; its 2 m feather starts past the shot-A right foreground (x ≤ 10.5).
 */
const SHADE_ZONES: readonly [number, number, number, number][] = [[12.5, -3, 22, 10]];
/**
 * Saria's branch (frames 14 / 24): isolated stepping stones climb a grassy ramp, and between them
 * the footage shows a trodden strip — short sparse grass over bare dirt and litter, clover at the
 * stone rims — while the lawn either side of it is ordinary sunlit turf. The strip follows
 * `pathToHouse` at this half-width (plus each stone's disc × STONE_TRODDEN), feathered outward.
 */
const TRODDEN_HALF_WIDTH = 0.9;
const TRODDEN_FEATHER = 0.6;
const STONE_TRODDEN = 1.4;

/**
 * The paved rim the layout polylines do not describe (`buildPavedRim`): the plaza discs of the
 * heightfield and the cut where the stair's south bank meets the flagstones. Straight pieces of
 * the terrain mask's 0.5 path contour, each with its outward (grass-side) unit normal.
 */
interface RimSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  nx: number;
  nz: number;
  len: number;
  /** the turf climbs steeply straight off this rim (frame 1's bank face beside the kid) */
  bank: boolean;
}
/** the paving mask level hardscape lays slabs to (flagstones.ts `isPaved`) */
const RIM_ISO = 0.5;
/**
 * The polylines put edge 0 at their half-width, 0.1 m outside the slab edge (mask 0.5 sits at
 * 0.95 × half-width); the mask-derived rim takes the same offset so one band fits every rim.
 */
const RIM_OFFSET = 0.1;
/** mask contour pieces this close to a polyline rim are that rim (already exact) and are dropped */
const RIM_DUPLICATE = 0.35;
/** lookup grid (m) and the reach within which segment distances are exact (beyond: no verge anyway) */
const RIM_GRID = 1;
const RIM_REACH = 3.5;
/** ground rise across the half metre outside a rim that marks it as the foot of a turf bank */
const BANK_RISE = 0.22;
/** metres of that bank face (from its rim) that stay grass only, and the fade beyond */
const BANK_FACE = 0.85;
const BANK_FEATHER = 0.3;

interface Frame {
  px: number;
  pz: number;
  fwx: number;
  fwz: number;
  rx: number;
  rz: number;
  /** tan(fov/2) × aspect: screen-x half extent as a view-space slope */
  halfSlope: number;
}

/** Full pinhole of a layout viewpoint (vertical fov, 16:9, +Y up): position, forward, right, up. */
interface View {
  p: readonly [number, number, number];
  f: readonly [number, number, number];
  r: readonly [number, number, number];
  u: readonly [number, number, number];
  th: number;
  aspect: number;
}

function makeView(vp: { position: readonly number[]; target: readonly number[]; fov: number }, aspect = 16 / 9): View {
  let f: [number, number, number] = [vp.target[0] - vp.position[0], vp.target[1] - vp.position[1], vp.target[2] - vp.position[2]];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1;
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const rl = Math.hypot(f[2], f[0]) || 1;
  const r: [number, number, number] = [-f[2] / rl, 0, f[0] / rl];
  const u: [number, number, number] = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { p: [vp.position[0], vp.position[1], vp.position[2]], f, r, u, th: Math.tan((vp.fov * Math.PI) / 360), aspect };
}

/** Horizontal pinhole frame of a layout viewpoint (16:9), the same maths as the gauntlet cameras. */
function makeFrame(vp: { position: readonly number[]; target: readonly number[]; fov: number }, aspect = 16 / 9): Frame {
  let fwx = vp.target[0] - vp.position[0];
  let fwz = vp.target[2] - vp.position[2];
  const l = Math.hypot(fwx, fwz) || 1;
  fwx /= l;
  fwz /= l;
  // screen-right = forward × up
  return { px: vp.position[0], pz: vp.position[2], fwx, fwz, rx: -fwz, rz: fwx, halfSlope: Math.tan((vp.fov * Math.PI) / 360) * aspect };
}

/** view angle (radians, screen-right positive) of a screen-x fraction */
const frameAngle = (f: Frame, sx: number) => Math.atan((sx - 0.5) * 2 * f.halfSlope);

export class VegField {
  readonly cell: number;
  readonly extent: number;
  private readonly n: number;
  private readonly data: Float32Array; // 11 floats per cell
  private readonly stairs: StairRect[];
  private readonly stones: SteppingStone[] = houseSteppingStones();
  private readonly clusterNoise: Noise2D;
  private readonly tuftNoise: Noise2D;
  private readonly meadowNoise: Noise2D;
  private readonly sedgeNoise: Noise2D;
  private readonly tintNoise: Noise2D;
  private readonly dryNoise: Noise2D;
  private readonly flowerNoise: Noise2D;
  private readonly frames = new Map<string, Frame | null>();
  private readonly views = new Map<string, View | null>();
  private readonly tmpN = new Vector3();
  /** mask-derived paved rim (plaza discs, bank toe) and its lookup grid: cell key → segment indices */
  private readonly rim: RimSegment[] = [];
  private readonly rimCells = new Map<number, number[]>();

  constructor(
    private readonly ctx: WorldContext,
    extent = 52,
    cell = 0.5,
  ) {
    this.cell = cell;
    this.extent = extent;
    this.n = Math.round((extent * 2) / cell) + 1;
    this.data = new Float32Array(this.n * this.n * 11);
    const seed = ctx.config.seed;
    this.clusterNoise = new Noise2D(`${seed}/veg-cluster`);
    this.tuftNoise = new Noise2D(`${seed}/veg-tuft`);
    this.meadowNoise = new Noise2D(`${seed}/veg-meadow`);
    this.sedgeNoise = new Noise2D(`${seed}/veg-sedge`);
    this.tintNoise = new Noise2D(`${seed}/veg-tint`);
    this.dryNoise = new Noise2D(`${seed}/veg-dry`);
    this.flowerNoise = new Noise2D(`${seed}/veg-flower`);
    this.stairs = ctx.layout.stairs.map((s) => {
      const l = Math.hypot(s.dir[0], s.dir[1]);
      return { ox: s.base[0], oz: s.base[2], dx: s.dir[0] / l, dz: s.dir[1] / l, run: s.steps * s.tread, halfWidth: s.width / 2 };
    });
    this.fill();
    this.buildPavedRim();
  }

  private fill() {
    const T = this.ctx.terrain;
    const n = this.n;
    const nrm = this.tmpN;
    for (let j = 0; j < n; j++) {
      const z = -this.extent + j * this.cell;
      for (let i = 0; i < n; i++) {
        const x = -this.extent + i * this.cell;
        const m = T.mask(x, z);
        T.normal(x, z, nrm);
        const slope = 1 - clamp(nrm.y, 0, 1);
        const o = (j * n + i) * 11;
        const d = this.data;
        d[o] = m.path < 0.5 && m.stairs < 0.5 && m.structure < 0.5 && m.cliff < 0.8 ? 1 : 0;
        d[o + 1] = m.path;
        d[o + 2] = m.stairs;
        d[o + 3] = m.structure;
        d[o + 4] = m.cliff;
        d[o + 5] = m.plateau;
        d[o + 6] = slope;
        d[o + 7] = nrm.x;
        d[o + 8] = nrm.y;
        d[o + 9] = nrm.z;
        d[o + 10] = T.height(x, z);
      }
    }
  }

  /** cached path-mask value at grid node (i, j) */
  private nodePath(i: number, j: number): number {
    return this.data[(j * this.n + i) * 11 + 1];
  }

  /**
   * The paved rim the polylines miss. The heightfield paves more than the spine and the stair
   * branch: the plaza discs (the plaza, its eastern lobe, the small disc at the bank's toe) and it
   * cuts that paving along the stair's south bank. Those rims are taken from the mask itself —
   * marching squares over the cached 0.5 m path grid at hardscape's slab level, each crossing then
   * bisected on the exact terrain mask (≈ 2 mm) — so the turf's rim treatment (lean, moss cushions,
   * seam litter) follows wherever the flagstones really end, the toe line included. Pieces that
   * the polylines or the stair footprints already describe, and the stepping stones of the house
   * ramp (a grassy ramp, no rim), are dropped. Each piece keeps its outward normal and whether the
   * ground climbs steeply straight off it (`bank`), and goes into a coarse lookup grid.
   */
  private buildPavedRim() {
    const T = this.ctx.terrain;
    const R = this.ctx.config.detailRadius + 2;
    const L = this.ctx.layout;
    const hw = L.pathHalfWidth;
    const n = this.n;
    const at = (i: number, j: number): [number, number] => [-this.extent + i * this.cell, -this.extent + j * this.cell];
    const pathAt = (x: number, z: number) => T.mask(x, z).path;
    // crossing of the iso level on the grid edge (i, j) → (i + di, j + dj): linear in the node
    // values for the pass that decides which pieces to keep, bisected on the exact mask (8 steps,
    // ≈ 2 mm) for the kept ones only — the exact mask is the expensive call. Cached per edge.
    type Edge = { i: number; j: number; horizontal: boolean };
    const refined = new Map<number, [number, number]>();
    const edgeKey = (e: Edge) => (e.i * n + e.j) * 2 + (e.horizontal ? 1 : 0);
    const ends = (e: Edge): [number, number, number, number] => {
      const [ax, az] = at(e.i, e.j);
      const [bx, bz] = at(e.horizontal ? e.i + 1 : e.i, e.horizontal ? e.j : e.j + 1);
      return [ax, az, bx, bz];
    };
    const coarse = (e: Edge): [number, number] => {
      const [ax, az, bx, bz] = ends(e);
      const pa = this.nodePath(e.i, e.j);
      const pb = this.nodePath(e.horizontal ? e.i + 1 : e.i, e.horizontal ? e.j : e.j + 1);
      const t = clamp((RIM_ISO - pa) / (pb - pa || 1e-6), 0, 1);
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    };
    const refine = (e: Edge): [number, number] => {
      const key = edgeKey(e);
      let c = refined.get(key);
      if (c) return c;
      let [ax, az, bx, bz] = ends(e);
      const aIn = this.nodePath(e.i, e.j) >= RIM_ISO;
      for (let k = 0; k < 8; k++) {
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        if ((pathAt(mx, mz) >= RIM_ISO) === aIn) {
          ax = mx;
          az = mz;
        } else {
          bx = mx;
          bz = mz;
        }
      }
      c = [(ax + bx) / 2, (az + bz) / 2];
      refined.set(key, c);
      return c;
    };
    // marching squares: corners 0 (i,j) 1 (i+1,j) 2 (i+1,j+1) 3 (i,j+1); edges 0 bottom 1 right 2 top 3 left
    const EDGES: number[][][] = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [], [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], [], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
    const edgeOf = (i: number, j: number, e: number): Edge => (e === 0 ? { i, j, horizontal: true } : e === 1 ? { i: i + 1, j, horizontal: false } : e === 2 ? { i, j: j + 1, horizontal: true } : { i, j, horizontal: false });
    const s = newSample();
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const c0 = this.nodePath(i, j);
        const c1 = this.nodePath(i + 1, j);
        const c2 = this.nodePath(i + 1, j + 1);
        const c3 = this.nodePath(i, j + 1);
        const idx = (c0 >= RIM_ISO ? 1 : 0) | (c1 >= RIM_ISO ? 2 : 0) | (c2 >= RIM_ISO ? 4 : 0) | (c3 >= RIM_ISO ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const [cx, cz] = at(i, j);
        if (Math.hypot(cx + this.cell / 2, cz + this.cell / 2) > R) continue;
        let pairs = EDGES[idx];
        if (idx === 5 || idx === 10) {
          // saddle: the centre decides which diagonal pair of corners is joined
          const centreIn = (c0 + c1 + c2 + c3) / 4 >= RIM_ISO;
          pairs = (idx === 5) === centreIn ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
        }
        for (const [e0, e1] of pairs) {
          const ea = edgeOf(i, j, e0);
          const eb = edgeOf(i, j, e1);
          {
            const [ax, az] = coarse(ea);
            const [bx, bz] = coarse(eb);
            const mx = (ax + bx) / 2;
            const mz = (az + bz) / 2;
            if (this.stairDistance(mx, mz) < RIM_DUPLICATE || this.stoneDistance(mx, mz) < 1.0) continue;
            // the polyline walk offsets perpendicular to its segments, so it never reaches the
            // round end caps (the stair branch's, north of the foot): pieces there are kept
            const spine = polylineClosest(L.pathSpine, mx, mz);
            const branch = polylineClosest(L.pathToStairs, mx, mz);
            if ((!spine.cap && Math.abs(spine.dist - hw) < RIM_DUPLICATE) || (!branch.cap && Math.abs(branch.dist - hw * 0.8) < RIM_DUPLICATE)) continue;
          }
          const [ax, az] = refine(ea);
          const [bx, bz] = refine(eb);
          const len = Math.hypot(bx - ax, bz - az);
          if (len < 1e-3) continue;
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          // outward = toward falling path mask (the grass side)
          let nx = -(bz - az) / len;
          let nz = (bx - ax) / len;
          const outer = this.sample(mx + nx * 0.2, mz + nz * 0.2, s).path;
          const inner = this.sample(mx - nx * 0.2, mz - nz * 0.2, s).path;
          if (outer > inner) {
            nx = -nx;
            nz = -nz;
          }
          const rise = T.height(mx + nx * 0.65, mz + nz * 0.65) - T.height(mx + nx * 0.15, mz + nz * 0.15);
          this.rim.push({ ax, az, bx, bz, nx, nz, len, bank: rise > BANK_RISE });
        }
      }
    }
    // lookup grid: every cell whose centre lies within reach of the segment lists it
    const pad = RIM_REACH + RIM_GRID * 0.71;
    for (let k = 0; k < this.rim.length; k++) {
      const seg = this.rim[k];
      const x0 = Math.floor((Math.min(seg.ax, seg.bx) - pad) / RIM_GRID);
      const x1 = Math.floor((Math.max(seg.ax, seg.bx) + pad) / RIM_GRID);
      const z0 = Math.floor((Math.min(seg.az, seg.bz) - pad) / RIM_GRID);
      const z1 = Math.floor((Math.max(seg.az, seg.bz) + pad) / RIM_GRID);
      for (let gz = z0; gz <= z1; gz++) {
        for (let gx = x0; gx <= x1; gx++) {
          if (segmentDistance(seg, (gx + 0.5) * RIM_GRID, (gz + 0.5) * RIM_GRID) > pad) continue;
          const key = gx * 65536 + gz;
          let arr = this.rimCells.get(key);
          if (!arr) this.rimCells.set(key, (arr = []));
          arr.push(k);
        }
      }
    }
  }

  /** nearest mask-derived rim piece within reach: signed distance (negative on the paving) and the piece */
  private nearestRim(x: number, z: number): { dist: number; seg: RimSegment } | null {
    const arr = this.rimCells.get(Math.floor(x / RIM_GRID) * 65536 + Math.floor(z / RIM_GRID));
    if (!arr) return null;
    let best = Infinity;
    let bestSeg: RimSegment | null = null;
    for (const k of arr) {
      const seg = this.rim[k];
      const d = segmentDistance(seg, x, z);
      if (d < best) {
        best = d;
        bestSeg = seg;
      }
    }
    if (!bestSeg || best > RIM_REACH) return null;
    // side of the piece: the closest point's offset along the outward normal
    const t = segmentT(bestSeg, x, z);
    const px = bestSeg.ax + (bestSeg.bx - bestSeg.ax) * t;
    const pz = bestSeg.az + (bestSeg.bz - bestSeg.az) * t;
    const side = (x - px) * bestSeg.nx + (z - pz) * bestSeg.nz;
    return { dist: side < 0 ? -best : best, seg: bestSeg };
  }

  /**
   * Signed distance to the mask-derived paved rim (plaza discs, bank toe; see `buildPavedRim`),
   * with the polylines' 0.1 m rim offset; +Infinity where no such rim is within reach.
   */
  pavedRimDistance(x: number, z: number): number {
    const near = this.nearestRim(x, z);
    return near ? near.dist - RIM_OFFSET : Infinity;
  }

  /**
   * 0..1 on the turf face that climbs straight off a paved rim (reference frame 1: the Kokiri kid
   * stands in lit grass tufts on the stair's south bank, no herbs or broad leaves) — the first
   * `BANK_FACE` metres outside a rim piece flagged `bank`, feathered out beyond.
   */
  bankFace(x: number, z: number): number {
    const near = this.nearestRim(x, z);
    if (!near || !near.seg.bank || near.dist < -0.05) return 0;
    return 1 - smoothstep(BANK_FACE, BANK_FACE + BANK_FEATHER, near.dist);
  }

  /** Bilinear sample of the cached field. Outside the grid → not allowed. */
  sample(x: number, z: number, out: FieldSample): FieldSample {
    const fx = (x + this.extent) / this.cell;
    const fz = (z + this.extent) / this.cell;
    const i0 = Math.floor(fx);
    const j0 = Math.floor(fz);
    if (i0 < 0 || j0 < 0 || i0 >= this.n - 1 || j0 >= this.n - 1) {
      out.allow = 0;
      out.path = out.stairs = out.structure = 0;
      out.cliff = 1;
      out.plateau = out.slope = 0;
      out.nx = out.nz = 0;
      out.ny = 1;
      out.h = 0;
      return out;
    }
    const tx = fx - i0;
    const tz = fz - j0;
    const d = this.data;
    const o00 = (j0 * this.n + i0) * 11;
    const o10 = o00 + 11;
    const o01 = o00 + this.n * 11;
    const o11 = o01 + 11;
    const w00 = (1 - tx) * (1 - tz);
    const w10 = tx * (1 - tz);
    const w01 = (1 - tx) * tz;
    const w11 = tx * tz;
    const at = (k: number) => d[o00 + k] * w00 + d[o10 + k] * w10 + d[o01 + k] * w01 + d[o11 + k] * w11;
    out.allow = at(0);
    out.path = at(1);
    out.stairs = at(2);
    out.structure = at(3);
    out.cliff = at(4);
    out.plateau = at(5);
    out.slope = at(6);
    out.nx = at(7);
    out.ny = at(8);
    out.nz = at(9);
    out.h = at(10);
    return out;
  }

  /**
   * True if vegetation may grow at (x, z). Uses the coarse grid where the answer is certain and
   * the exact terrain mask in the transition band around paths, stairs, pads and cliffs.
   */
  allowed(x: number, z: number, s: FieldSample): boolean {
    if (s.allow <= 0.02) return false;
    if (s.allow >= 0.98 && s.path < 0.05 && s.stairs < 0.05 && s.structure < 0.05 && s.cliff < 0.4) return true;
    return this.ctx.terrain.vegetationAllowed(x, z);
  }

  /**
   * Distance from the nearest path edge (negative inside). The house branch counts with its old
   * 0.7 × half-width so the plant scatters keep their corridor clear (and their candidate streams)
   * now that it is a grassy ramp; the turf uses `lawnEdgeDistance`, which ignores it.
   */
  pathEdgeDistance(x: number, z: number): number {
    const L = this.ctx.layout;
    const hw = L.pathHalfWidth;
    const a = polylineDistance(L.pathSpine, x, z) - hw;
    const b = polylineDistance(L.pathToStairs, x, z) - hw * 0.8;
    const c = polylineDistance(L.pathToHouse, x, z) - hw * 0.7;
    return Math.min(a, b, c);
  }

  /**
   * Hard-edge distance for the turf: flagstone paving and stairs only — the spine and stair-branch
   * polylines, the stair footprints, and the mask-derived rim of the plaza discs and the bank toe
   * (`pavedRimDistance`), since the flagstones end there, not at the branch's half-width. Saria's
   * branch is a grassy ramp with stepping stones, not paving, so it grows ordinary lawn with no
   * verge; the trodden strip between its stones is `troddenZone` / `stoneDistance`.
   */
  lawnEdgeDistance(x: number, z: number): number {
    const L = this.ctx.layout;
    const hw = L.pathHalfWidth;
    const a = polylineDistance(L.pathSpine, x, z) - hw;
    const b = polylineDistance(L.pathToStairs, x, z) - hw * 0.8;
    return Math.min(a, b, this.stairDistance(x, z), this.pavedRimDistance(x, z));
  }

  /** Distance to the centreline of Saria's stepping-stone ramp (`pathToHouse`). */
  rampDistance(x: number, z: number): number {
    return polylineDistance(this.ctx.layout.pathToHouse, x, z);
  }

  /**
   * Candidate points in the lawn band just outside the flagstone rim of the spine, the stair
   * branch and the plaza (the house branch is a grassy ramp with no rim), for the path-edge
   * softening of concept sheet 02. Walks the layout polylines within the detail radius, drawing
   * `perMetre` points per metre of rim per side from `rng` (t, side, offset — three draws each, so
   * callers can keep their acceptance draws stable), then the mask-derived rim pieces of the plaza
   * discs and the bank toe (`buildPavedRim`; two draws each, one grass side), and visits those the
   * terrain mask puts in 0..`band` m of grass beyond the paving (the mask, not the polyline, says
   * where the plaza, pads and corners really end).
   */
  rimCandidates(rng: () => number, perMetre: number, band: number, visit: (x: number, z: number, edge: number) => void) {
    const L = this.ctx.layout;
    const R = this.ctx.config.detailRadius;
    const rims: [readonly P3[], number][] = [
      [L.pathSpine, L.pathHalfWidth],
      [L.pathToStairs, L.pathHalfWidth * 0.8],
    ];
    const offer = (x: number, z: number) => {
      const edge = this.lawnEdgeDistance(x, z);
      if (edge < -0.05 || edge > band || this.stairDistance(x, z) < 0.1) return;
      visit(x, z, Math.max(0, edge));
    };
    for (const [line, hw] of rims) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, , az] = line[i];
        const [bx, , bz] = line[i + 1];
        if (Math.hypot((ax + bx) / 2, (az + bz) / 2) > R) continue;
        const len = Math.hypot(bx - ax, bz - az);
        const dx = (bx - ax) / len;
        const dz = (bz - az) / len;
        const n = Math.round(len * perMetre * 2);
        for (let k = 0; k < n; k++) {
          const t = rng();
          const side = rng() < 0.5 ? -1 : 1;
          const off = hw + rng() * band;
          offer(ax + dx * t * len - dz * side * off, az + dz * t * len + dx * side * off);
        }
      }
    }
    // the pieces are 0.1–0.7 m long: carry the fractional count so short ones are not starved
    let carry = 0;
    for (const seg of this.rim) {
      if (Math.hypot((seg.ax + seg.bx) / 2, (seg.az + seg.bz) / 2) > R) continue;
      carry += seg.len * perMetre;
      const n = Math.floor(carry);
      carry -= n;
      for (let k = 0; k < n; k++) {
        const t = rng();
        const off = RIM_OFFSET + rng() * band;
        offer(seg.ax + (seg.bx - seg.ax) * t + seg.nx * off, seg.az + (seg.bz - seg.az) * t + seg.nz * off);
      }
    }
  }

  /** total length (m) of the mask-derived rim pieces and how many are bank feet — for audits and tests */
  pavedRimStats(): { pieces: number; metres: number; bankMetres: number } {
    let metres = 0;
    let bankMetres = 0;
    for (const seg of this.rim) {
      metres += seg.len;
      if (seg.bank) bankMetres += seg.len;
    }
    return { pieces: this.rim.length, metres, bankMetres };
  }

  /** Distance to the nearest stepping-stone rim of the house branch (negative on the stone). */
  stoneDistance(x: number, z: number): number {
    let best = Infinity;
    for (const s of this.stones) best = Math.min(best, Math.hypot(x - s.x, z - s.z) - s.r);
    return best;
  }

  /** 0..1 inside the trodden strip between Saria's stepping stones (1 = strip core). */
  troddenZone(x: number, z: number): number {
    const along = polylineDistance(this.ctx.layout.pathToHouse, x, z);
    let v = 1 - smoothstep(TRODDEN_HALF_WIDTH, TRODDEN_HALF_WIDTH + TRODDEN_FEATHER, along);
    for (const s of this.stones) {
      const d = Math.hypot(x - s.x, z - s.z);
      v = Math.max(v, 1 - smoothstep(s.r * STONE_TRODDEN, s.r * STONE_TRODDEN + TRODDEN_FEATHER, d));
    }
    return v;
  }

  /** Distance from the nearest stair footprint (0 inside). */
  stairDistance(x: number, z: number): number {
    let best = Infinity;
    for (const f of this.stairs) {
      const rx = x - f.ox;
      const rz = z - f.oz;
      const u = rx * f.dx + rz * f.dz;
      const v = -rx * f.dz + rz * f.dx;
      const du = Math.max(0, -u, u - f.run);
      const dv = Math.max(0, Math.abs(v) - f.halfWidth);
      best = Math.min(best, Math.hypot(du, dv));
    }
    return best;
  }

  /** Distance to the nearest hard edge (path or stair). Verges live in 0..2.5 m. */
  edgeDistance(x: number, z: number): number {
    return Math.min(this.pathEdgeDistance(x, z), this.stairDistance(x, z));
  }

  /** 1 at a giant trunk centre, 0 beyond trunkRadius + reach. */
  giantProximity(x: number, z: number, reach = 2.5): number {
    let best = 0;
    for (const g of this.ctx.layout.giantTrees) {
      const d = Math.hypot(x - g.position[0], z - g.position[2]);
      best = Math.max(best, 1 - smoothstep(g.trunkRadius * 0.9, g.trunkRadius + reach, d));
    }
    return best;
  }

  /** Inside a giant trunk footprint (no plants at all). */
  insideGiantTrunk(x: number, z: number, margin = 0.2): boolean {
    for (const g of this.ctx.layout.giantTrees) {
      if (Math.hypot(x - g.position[0], z - g.position[2]) < g.trunkRadius + margin) return true;
    }
    return false;
  }

  /** Distance to the nearest giant trunk surface (for litter/roots under canopy). */
  giantDistance(x: number, z: number): number {
    let best = Infinity;
    for (const g of this.ctx.layout.giantTrees) {
      best = Math.min(best, Math.hypot(x - g.position[0], z - g.position[2]) - g.trunkRadius);
    }
    return best;
  }

  /** 1 inside the “keep short” clearings: NPC spots and a ring around hero boulders. */
  clearing(x: number, z: number): { npc: number; boulder: number; insideBoulder: boolean } {
    let npc = 0;
    for (const s of this.ctx.layout.npcSpots) {
      const d = Math.hypot(x - s.position[0], z - s.position[2]);
      npc = Math.max(npc, 1 - smoothstep(0.9, 1.6, d));
    }
    let boulder = 0;
    let insideBoulder = false;
    for (const b of this.ctx.layout.heroBoulders) {
      const d = Math.hypot(x - b.position[0], z - b.position[2]);
      if (d < b.radius * 0.95) insideBoulder = true;
      boulder = Math.max(boulder, 1 - smoothstep(b.radius + 0.6, b.radius + 0.9, d));
    }
    return { npc, boulder, insideBoulder };
  }

  /** Distance to the nearest hero boulder surface. */
  boulderDistance(x: number, z: number): number {
    let best = Infinity;
    for (const b of this.ctx.layout.heroBoulders) best = Math.min(best, Math.hypot(x - b.position[0], z - b.position[2]) - b.radius);
    return best;
  }

  /** Distance to the nearest house trunk surface, and whether the point is on its shaded side. */
  houseInfo(x: number, z: number): { dist: number; shade: number } {
    let dist = Infinity;
    let shade = 0;
    const sunAz = (this.ctx.config.sun.azimuthDeg * Math.PI) / 180;
    // vector pointing away from the sun (toward where shadows fall)
    const sx = -Math.sin(sunAz);
    const sz = -Math.cos(sunAz);
    for (const h of this.ctx.layout.houses) {
      const dx = x - h.position[0];
      const dz = z - h.position[2];
      const d = Math.hypot(dx, dz) - h.trunkRadius;
      if (d < dist) {
        dist = d;
        const l = Math.hypot(dx, dz) || 1;
        shade = clamp((dx / l) * sx + (dz / l) * sz, 0, 1);
      }
    }
    return { dist, shade };
  }

  /** Distance to the log arch axis minus its radius (negative inside the log). */
  logDistance(x: number, z: number): number {
    const la = this.ctx.layout.logArch;
    const yaw = (la.yawDeg * Math.PI) / 180;
    const dx = x - la.position[0];
    const dz = z - la.position[2];
    const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const du = Math.max(0, Math.abs(u) - la.length / 2);
    return Math.hypot(du, Math.abs(v)) - la.radius;
  }

  /** Clustered coverage 0.2..1.3: fbm clumps × fine tufts. Never uniform. */
  cluster(x: number, z: number): number {
    const c = this.clusterNoise.fbm(x * 0.21, z * 0.21, 3);
    const t = this.tuftNoise.noise(x * 0.85, z * 0.85);
    const clumps = 0.25 + 0.85 * smoothstep(-0.55, 0.5, c);
    const tufts = 0.6 + 0.4 * (0.5 + 0.5 * t);
    return clumps * tufts;
  }

  /** 0..1 patches where tall meadow grass dominates. */
  meadow(x: number, z: number): number {
    return smoothstep(0.02, 0.45, this.meadowNoise.fbm(x * 0.17 + 3.1, z * 0.17 - 1.4, 2));
  }

  /** 0..1 patches of broad sedge-like blades. */
  sedge(x: number, z: number): number {
    return smoothstep(0.12, 0.5, this.sedgeNoise.noise(x * 0.23 - 7.3, z * 0.23 + 2.2));
  }

  /** -1..1 slow colour drift for tint choice. */
  tint(x: number, z: number): number {
    return this.tintNoise.fbm(x * 0.13 + 11, z * 0.13 + 5, 2);
  }

  /** 0..1 dry/straw-tipped patches. */
  dry(x: number, z: number): number {
    return smoothstep(0.25, 0.65, this.dryNoise.noise(x * 0.16 + 21, z * 0.16 - 9));
  }

  /** 0..1 patches where flowers/weeds like to grow. */
  flowerPatch(x: number, z: number): number {
    return smoothstep(0.05, 0.55, this.flowerNoise.fbm(x * 0.27 - 4, z * 0.27 + 8, 2));
  }

  /** 0..1 inside the reference's low-verge areas (short grass, no tall plants). */
  lowZone(x: number, z: number): number {
    let v = 0;
    for (const b of LOW_ZONES) v = Math.max(v, softBox(x, z, b, 0.8));
    return v;
  }

  /** 0..1 in frame 14 s' lawn band west of the spine (dense short turf, clover and white dots; no fern clumps). */
  lawnBand(x: number, z: number): number {
    return softBox(x, z, LAWN_BAND, 0.5);
  }

  /** the lawn band's world box [x0, z0, x1, z1] grown by `pad` metres (its feather is 0.5 m) */
  lawnBandBox(pad = 0): [number, number, number, number] {
    return [LAWN_BAND[0] - pad, LAWN_BAND[1] - pad, LAWN_BAND[2] + pad, LAWN_BAND[3] + pad];
  }

  private frame(viewpointId: string): Frame | null {
    let f = this.frames.get(viewpointId);
    if (f === undefined) {
      const vp = this.ctx.layout.viewpoints.find((v) => v.id === viewpointId);
      f = vp ? makeFrame(vp) : null;
      this.frames.set(viewpointId, f);
    }
    return f;
  }

  /**
   * Horizontal screen-x of (x, z) in a layout viewpoint's frame (0 = left edge, 1 = right edge)
   * and its depth along the view axis; null behind the camera or for unknown viewpoints. A
   * ground-level approximation (the hero cameras are pitched ≤ 4°), used to keep frame 46's stair
   * foot clear and to seat shot-B's edge plants just off camera C's left edge.
   */
  screenX(viewpointId: string, x: number, z: number): { sx: number; depth: number } | null {
    const f = this.frame(viewpointId);
    if (!f) return null;
    const dx = x - f.px;
    const dz = z - f.pz;
    const depth = dx * f.fwx + dz * f.fwz;
    if (depth <= 0.05) return null;
    return { sx: 0.5 + (0.5 * ((dx * f.rx + dz * f.rz) / depth)) / f.halfSlope, depth };
  }

  /**
   * Full pinhole projection of a world point into a layout viewpoint (0..1, y down; the
   * gauntlet's camera maths): screen x / y and view depth, null behind the camera. For placements
   * that must land in a reference frame's box on rising ground, where `screenX` cannot say how
   * high they sit.
   */
  screenPoint(viewpointId: string, x: number, y: number, z: number): { sx: number; sy: number; depth: number } | null {
    let v = this.views.get(viewpointId);
    if (v === undefined) {
      const vp = this.ctx.layout.viewpoints.find((p) => p.id === viewpointId);
      v = vp ? makeView(vp) : null;
      this.views.set(viewpointId, v);
    }
    if (!v) return null;
    const dx = x - v.p[0];
    const dy = y - v.p[1];
    const dz = z - v.p[2];
    const depth = dx * v.f[0] + dy * v.f[1] + dz * v.f[2];
    if (depth <= 0.05) return null;
    const sx = 0.5 + (0.5 * ((dx * v.r[0] + dy * v.r[1] + dz * v.r[2]) / depth)) / (v.th * v.aspect);
    const sy = 0.5 - (0.5 * ((dx * v.u[0] + dy * v.u[1] + dz * v.u[2]) / depth)) / v.th;
    return { sx, sy, depth };
  }

  /**
   * 0..1 where a plant of horizontal reach `margin` (metres) would show in camera C's left third
   * (frame 46: the stair foot and its mossy rock over short grass). 1 inside the grass box around
   * the camera and inside the frame wedge out to the stair-foot rock; fades to 0 over `margin`
   * outside them, so callers reject while > 0 with their own frond/crown reach.
   */
  sightlineC(x: number, z: number, margin = 0.6): number {
    // the box is a hard "grass around the camera" rule; only the wedge needs the plant's reach,
    // since everything east of the box that could lean into frame is inside the wedge already
    const v = softBox(x, z, C_GRASS_BOX, 0.5);
    const f = this.frame('C_lookback');
    if (!f || v >= 1) return v;
    const dx = x - f.px;
    const dz = z - f.pz;
    const depth = dx * f.fwx + dz * f.fwz;
    if (depth <= 0) return v;
    const d = Math.hypot(dx, dz);
    const ang = Math.atan2(dx * f.rx + dz * f.rz, depth);
    const angMin = frameAngle(f, C_FRAME_SX[0]);
    const angMax = frameAngle(f, C_FRAME_SX[1]);
    // metres outside the wedge: angular miss × distance, or view depth past the far limit
    const angular = ang < angMin ? Math.sin(angMin - ang) * d : ang > angMax ? Math.sin(ang - angMax) * d : 0;
    const outside = Math.max(angular, depth - C_FRAME_DEPTH);
    return Math.max(v, 1 - smoothstep(0, Math.max(margin, 0.05), outside));
  }

  /** 0..1 where the foreground tufts of frames 1 / 8 must stay short. */
  trimZone(x: number, z: number): number {
    let v = 0;
    for (const b of TRIM_ZONES) v = Math.max(v, softBox(x, z, b, 1.5));
    return v;
  }

  /** 0..1 where grass reads as shaded, desaturated moss/turf (frame 8's plateau flank). */
  shadeZone(x: number, z: number): number {
    let v = 0;
    for (const b of SHADE_ZONES) v = Math.max(v, softBox(x, z, b, 2));
    return v;
  }

  /** Hero-area falloff: full detail near the plaza, thinning toward the detail radius. */
  falloff(x: number, z: number): number {
    const r = Math.hypot(x, z);
    const R = this.ctx.config.detailRadius;
    return lerp(1, 0.32, smoothstep(18, R, r));
  }
}

export function newSample(): FieldSample {
  return { allow: 0, path: 0, stairs: 0, structure: 0, cliff: 0, plateau: 0, slope: 0, nx: 0, ny: 1, nz: 0, h: 0 };
}

/** Compose a placement matrix: tilt toward `normal` (partially), yaw, non-uniform scale. */
export function composeMatrix(out: Float32Array, offset: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, tiltAmount: number, yaw: number, sx: number, sy: number, sz: number) {
  // blended up vector
  let ux = nx * tiltAmount;
  let uy = 1 - tiltAmount + ny * tiltAmount;
  let uz = nz * tiltAmount;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul;
  uy /= ul;
  uz /= ul;
  // rotation from (0,1,0) to u via Rodrigues: axis = up × u = (uz, 0, -ux)
  const c = uy;
  const s = Math.hypot(ux, uz);
  let r00 = 1;
  let r01 = 0;
  let r02 = 0;
  let r10 = 0;
  let r11 = 1;
  let r12 = 0;
  let r20 = 0;
  let r21 = 0;
  let r22 = 1;
  if (s > 1e-6) {
    const ax = uz / s;
    const az = -ux / s;
    const t = 1 - c;
    r00 = c + ax * ax * t;
    r01 = -az * s;
    r02 = ax * az * t;
    r10 = az * s;
    r11 = c;
    r12 = -ax * s;
    r20 = ax * az * t;
    r21 = ax * s;
    r22 = c + az * az * t;
  }
  const cy = Math.cos(yaw);
  const sy_ = Math.sin(yaw);
  // R * Yaw: yaw matrix columns: (cy,0,-sy), (0,1,0), (sy,0,cy)
  const m00 = r00 * cy - r02 * sy_;
  const m10 = r10 * cy - r12 * sy_;
  const m20 = r20 * cy - r22 * sy_;
  const m01 = r01;
  const m11 = r11;
  const m21 = r21;
  const m02 = r00 * sy_ + r02 * cy;
  const m12 = r10 * sy_ + r12 * cy;
  const m22 = r20 * sy_ + r22 * cy;
  out[offset] = m00 * sx;
  out[offset + 1] = m10 * sx;
  out[offset + 2] = m20 * sx;
  out[offset + 3] = 0;
  out[offset + 4] = m01 * sy;
  out[offset + 5] = m11 * sy;
  out[offset + 6] = m21 * sy;
  out[offset + 7] = 0;
  out[offset + 8] = m02 * sz;
  out[offset + 9] = m12 * sz;
  out[offset + 10] = m22 * sz;
  out[offset + 11] = 0;
  out[offset + 12] = x;
  out[offset + 13] = y;
  out[offset + 14] = z;
  out[offset + 15] = 1;
}
