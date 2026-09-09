/**
 * Seeded placement of the white-bark trees in the 12–60 m band around the plaza: denser to the
 * north/west and on the plateaus, never on paths, stairs, structures, hero boulders, NPC spots,
 * fences, the lantern branch or inside a giant's footprint; minimum spacing between trees.
 */
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { TAU } from './writer';
import type { Age } from './whitebark';

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

export function placeWhiteBark(ctx: WorldContext, rng: Rng, variants: VariantInfo[], target: number, inner = 12, outer = 60): WhiteBarkPlacement[] {
  const r = rng.fork('whitebark-placement');
  const clump = new Noise2D('whitebark-clumps');
  const L = ctx.layout;
  const terrain = ctx.terrain;
  const out: WhiteBarkPlacement[] = [];

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
  return out;
}
