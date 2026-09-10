/**
 * Seeded placement of the white-bark trees in the 12–60 m band around the plaza: denser to the
 * north/west and on the plateaus, never on paths, stairs, structures, hero boulders, NPC spots,
 * fences, the lantern branch or inside a giant's footprint; minimum spacing between trees.
 */
import { Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { TAU } from './writer';
import type { Age } from './whitebark';

/** a world-space line along the sun direction that tree crowns must stay clear of */
export interface SunCorridor {
  point: Vector3;
  dir: Vector3;
  radius: number;
}

/**
 * A screen window (fractions, x right / y down, may extend past the frame) of a pinhole camera
 * that tree crowns beyond `minDistance` must not overlap — keeps a hero frame's haze gap open.
 */
export interface ViewGap {
  position: Vector3;
  target: Vector3;
  fov: number;
  aspect: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  minDistance: number;
}

export interface WhiteBarkResult {
  placements: WhiteBarkPlacement[];
  /** trees drawn again because their crown overlapped a view gap */
  reseated: number;
}

/** pinhole projection matching three.js PerspectiveCamera (vertical fov, lookAt with +Y up) */
function gapCamera(g: ViewGap) {
  const forward = g.target.clone().sub(g.position).normalize();
  const right = new Vector3(-forward.z, 0, forward.x).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const th = Math.tan((g.fov * Math.PI) / 360);
  const d = new Vector3();
  return (p: Vector3): [number, number, number] | null => {
    d.subVectors(p, g.position);
    const z = d.dot(forward);
    if (z <= 0.05) return null;
    return [0.5 + (0.5 * (d.dot(right) / z)) / (th * g.aspect), 0.5 - (0.5 * (d.dot(up) / z)) / th, z];
  };
}

export interface WhiteBarkPlacement {
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
}

export interface VariantInfo {
  height: number;
  radius: number;
  age: Age;
}

function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function placeWhiteBark(
  ctx: WorldContext,
  rng: Rng,
  variants: VariantInfo[],
  target: number,
  inner = 12,
  outer = 60,
  avoid: SunCorridor[] = [],
  gaps: ViewGap[] = [],
): WhiteBarkResult {
  const r = rng.fork('whitebark-placement');
  const clump = new Noise2D('whitebark-clumps');
  const L = ctx.layout;
  const terrain = ctx.terrain;
  const out: WhiteBarkPlacement[] = [];

  /**
   * True when the crown (a sphere of `crownRadius` around the upper 60 % of the tree) overlaps a
   * view gap window from beyond its minimum distance.
   */
  const gapCams = gaps.map((g) => ({ g, project: gapCamera(g) }));
  const crownPoint = new Vector3();
  const closesGap = (x: number, z: number, y: number, height: number, crownRadius: number): boolean => {
    for (const { g, project } of gapCams) {
      const lo = project(crownPoint.set(x, y + height * 0.4, z));
      const hi = project(crownPoint.set(x, y + height, z));
      if (!lo || !hi || lo[2] < g.minDistance) continue;
      const th = Math.tan((g.fov * Math.PI) / 360);
      const dx = crownRadius / (lo[2] * 2 * th * g.aspect);
      const dy = crownRadius / (lo[2] * 2 * th);
      const x0 = Math.min(lo[0], hi[0]) - dx;
      const x1 = Math.max(lo[0], hi[0]) + dx;
      const y0 = Math.min(lo[1], hi[1]) - dy;
      const y1 = Math.max(lo[1], hi[1]) + dy;
      if (x1 > g.xMin && x0 < g.xMax && y1 > g.yMin && y0 < g.yMax) return true;
    }
    return false;
  };

  /**
   * True when the crown (the upper 60 % of the tree) would intersect a sun corridor: the ray is
   * sampled at crown heights and its horizontal offset from the trunk compared with crown + corridor
   * radius. Trunks below the crown may cross (a thin trunk shadow is welcome dapple).
   */
  const shadesCorridor = (x: number, z: number, y: number, height: number, crownRadius: number): boolean => {
    for (const c of avoid) {
      if (c.dir.y <= 0.05) continue;
      for (let k = 0; k <= 6; k++) {
        const hy = y + height * (0.4 + 0.6 * (k / 6));
        const t = (hy - c.point.y) / c.dir.y;
        if (t < 0) continue;
        const px = c.point.x + c.dir.x * t;
        const pz = c.point.z + c.dir.z * t;
        if (Math.hypot(px - x, pz - z) < crownRadius + c.radius) return true;
      }
    }
    return false;
  };

  const blocked = (x: number, z: number, treeRadius: number): boolean => {
    // ground use: sample the centre and a ring so the root flare never touches paved surfaces
    const probes: [number, number][] = [[x, z]];
    const ring = Math.max(1.6, treeRadius * 0.35);
    for (let i = 0; i < 6; i++) probes.push([x + Math.cos((i / 6) * TAU) * ring, z + Math.sin((i / 6) * TAU) * ring]);
    for (const [px, pz] of probes) {
      const m = terrain.mask(px, pz);
      if (m.path > 0.3 || m.stairs > 0.3 || m.structure > 0.3) return true;
    }
    if (!terrain.vegetationAllowed(x, z)) return true;
    if (terrain.slope(x, z) > 0.55) return true;
    for (const h of L.houses) if (Math.hypot(x - h.position[0], z - h.position[2]) < h.trunkRadius + 5) return true;
    for (const g of L.giantTrees) if (Math.hypot(x - g.position[0], z - g.position[2]) < g.trunkRadius + 5.5) return true;
    for (const b of L.heroBoulders) if (Math.hypot(x - b.position[0], z - b.position[2]) < b.radius + 2.2) return true;
    for (const n of L.npcSpots) if (Math.hypot(x - n.position[0], z - n.position[2]) < 4.5) return true;
    for (const s of L.signposts) if (Math.hypot(x - s.position[0], z - s.position[2]) < 3) return true;
    for (const v of L.viewpoints) if (Math.hypot(x - v.position[0], z - v.position[2]) < 5) return true;
    for (const f of L.fences) {
      for (let i = 0; i < f.points.length - 1; i++) {
        if (segmentDistance(x, z, f.points[i][0], f.points[i][2], f.points[i + 1][0], f.points[i + 1][2]) < 2.2) return true;
      }
    }
    for (const s of L.stairs) {
      const l = Math.hypot(s.dir[0], s.dir[1]);
      const ex = s.base[0] + (s.dir[0] / l) * s.steps * s.tread;
      const ez = s.base[2] + (s.dir[1] / l) * s.steps * s.tread;
      if (segmentDistance(x, z, s.base[0], s.base[2], ex, ez) < s.width / 2 + 3) return true;
    }
    const lb = L.lanternBranch;
    if (segmentDistance(x, z, lb.from[0], lb.from[2], lb.to[0], lb.to[2]) < 4) return true;
    // log arch oriented box with margin
    const la = L.logArch;
    const yaw = (la.yawDeg * Math.PI) / 180;
    const ldx = x - la.position[0];
    const ldz = z - la.position[2];
    const lu = ldx * Math.cos(yaw) - ldz * Math.sin(yaw);
    const lv = ldx * Math.sin(yaw) + ldz * Math.cos(yaw);
    if (Math.abs(lu) < la.length / 2 + 3 && Math.abs(lv) < la.radius + 3) return true;
    // the authored path polylines with a wide margin (the mask alone is tight)
    const polylines = [L.pathSpine, L.pathToStairs, L.pathToHouse];
    for (const pl of polylines) {
      for (let i = 0; i < pl.length - 1; i++) {
        if (segmentDistance(x, z, pl[i][0], pl[i][2], pl[i + 1][0], pl[i + 1][2]) < L.pathHalfWidth + 2.5 + treeRadius * 0.3) return true;
      }
    }
    return false;
  };

  const density = (x: number, z: number) => {
    const north = smoothstep(8, -14, z);
    const west = smoothstep(6, -12, x);
    const plateau = terrain.mask(x, z).plateau;
    const clumps = clump.fbm(x * 0.045, z * 0.045, 3) * 0.5 + 0.5;
    return 0.32 + 0.3 * north + 0.22 * west + 0.25 * plateau + 0.35 * clumps;
  };

  const pickVariant = () => {
    const u = r();
    const want: Age = u < 0.52 ? 'mature' : u < 0.82 ? 'young' : 'sapling';
    const pool = variants.map((v, i) => (v.age === want ? i : -1)).filter((i) => i >= 0);
    return pool.length ? pool[r.int(0, pool.length)] : r.int(0, variants.length);
  };

  const fill = (testGaps: boolean) => {
    let attempts = 0;
    while (out.length < target && attempts < target * 120) {
      attempts++;
      const a = r() * TAU;
      const rad = Math.sqrt(inner * inner + (outer * outer - inner * inner) * r());
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      if (r() > density(x, z)) continue;
      const variant = pickVariant();
      const info = variants[variant];
      const scale = r.range(0.9, 1.12);
      if (blocked(x, z, info.radius * scale)) continue;
      if (avoid.length && shadesCorridor(x, z, terrain.height(x, z), info.height * scale, info.radius * scale)) continue;
      if (testGaps && closesGap(x, z, terrain.height(x, z), info.height * scale, info.radius * scale)) continue;
      let clash = false;
      for (const p of out) {
        const other = variants[p.variant];
        const minD = 2.2 + (info.radius * scale + other.radius * p.scale) * 0.35;
        if (Math.hypot(p.x - x, p.z - z) < minD) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      out.push({ variant, x, y: terrain.height(x, z), z, yaw: r() * TAU, scale });
    }
  };
  // Pass 1 is the placement every other system was tuned against; the view-gap rule is applied
  // afterwards so it can only remove trees from that set, and the replacements are drawn from the
  // continuing stream (a rule inside pass 1 would shift every later draw and reshuffle the wood).
  fill(false);
  let reseated = 0;
  if (gapCams.length) {
    const kept = out.filter((p) => !closesGap(p.x, p.z, p.y, variants[p.variant].height * p.scale, variants[p.variant].radius * p.scale));
    reseated = out.length - kept.length;
    if (reseated) {
      out.length = 0;
      out.push(...kept);
      fill(true);
    }
  }
  return { placements: out, reseated };
}
