/**
 * Vegetation placement field. A coarse grid caches the expensive terrain mask/normal queries so
 * a million grass candidates can be tested quickly; anything near a path/stair edge is
 * re-checked exactly against `terrain.vegetationAllowed` so no blade lands on flagstones.
 * Also owns the authored-layout influences (path verges, stair flanks, giant trunks, hero
 * boulders, NPC spots) and the clustering noise that keeps the grass from being a carpet.
 */
import { Vector3 } from 'three';
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

function polylineDistance(points: readonly P3[], x: number, z: number): number {
  let best = Infinity;
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
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
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
 */
const LOW_ZONES: readonly [number, number, number, number][] = [[1.5, -16, 8, -4]];
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
/** Verge south-east of the plaza, the right foreground of frames 1 and 8: tidy short tufts. */
const TRIM_ZONES: readonly [number, number, number, number][] = [[4, 0, 12, 8]];
/**
 * The plateau flank right of the stairs in frame 8 (0.55–1 × 0.3–0.6, world x ≳ 11): shaded
 * olive moss/grass. The reference box measures ≈ 0.30 luminance with visible blade texture, so it
 * is a tint bias, not a blackout; its 2 m feather starts past the shot-A right foreground (x ≤ 10.5).
 */
const SHADE_ZONES: readonly [number, number, number, number][] = [[12.5, -3, 22, 10]];

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
  private readonly clusterNoise: Noise2D;
  private readonly tuftNoise: Noise2D;
  private readonly meadowNoise: Noise2D;
  private readonly sedgeNoise: Noise2D;
  private readonly tintNoise: Noise2D;
  private readonly dryNoise: Noise2D;
  private readonly flowerNoise: Noise2D;
  private readonly frames = new Map<string, Frame | null>();
  private readonly tmpN = new Vector3();

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

  /** Distance from the nearest flagstone-path edge (negative inside the path surface). */
  pathEdgeDistance(x: number, z: number): number {
    const L = this.ctx.layout;
    const hw = L.pathHalfWidth;
    const a = polylineDistance(L.pathSpine, x, z) - hw;
    const b = polylineDistance(L.pathToStairs, x, z) - hw * 0.8;
    const c = polylineDistance(L.pathToHouse, x, z) - hw * 0.7;
    return Math.min(a, b, c);
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
