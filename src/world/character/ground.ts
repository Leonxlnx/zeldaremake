/**
 * Walkable ground for the characters: the terrain heightfield everywhere, except inside a stair
 * footprint where the feet stand on the tread slabs (the heightfield is trenched 0.18 m under
 * them; see hardscape/stairs.ts: tread i tops out at base.y + (i + 1) · rise).
 */
import type { Layout } from '../layout';
import type { Terrain } from '../terrain/heightfield';

export interface Ground {
  height(x: number, z: number): number;
  /** true inside a stair run (for the stair-climb gait) */
  onStairs(x: number, z: number): boolean;
  /** true where walking is blocked (structure pads: trunks, the log) */
  blocked(x: number, z: number): boolean;
}

interface StairFrame {
  ox: number;
  oz: number;
  dx: number;
  dz: number;
  run: number;
  tread: number;
  rise: number;
  steps: number;
  halfWidth: number;
  baseY: number;
}

export function createGround(terrain: Terrain, layout: Layout): Ground {
  const frames: StairFrame[] = layout.stairs.map((s) => {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    return { ox: s.base[0], oz: s.base[2], dx: s.dir[0] / l, dz: s.dir[1] / l, run: s.steps * s.tread, tread: s.tread, rise: s.rise, steps: s.steps, halfWidth: s.width / 2, baseY: s.base[1] };
  });
  const stairAt = (x: number, z: number): number | null => {
    for (const f of frames) {
      const rx = x - f.ox;
      const rz = z - f.oz;
      const u = rx * f.dx + rz * f.dz;
      const v = -rx * f.dz + rz * f.dx;
      if (Math.abs(v) > f.halfWidth || u < -0.05 || u > f.run + 1.6) continue;
      if (u >= f.run) return f.baseY + f.steps * f.rise;
      const i = Math.max(0, Math.floor(u / f.tread));
      return f.baseY + (i + 1) * f.rise;
    }
    return null;
  };
  return {
    height(x, z) {
      const h = terrain.height(x, z);
      const s = stairAt(x, z);
      return s === null ? h : Math.max(h, s);
    },
    onStairs(x, z) {
      return stairAt(x, z) !== null;
    },
    blocked(x, z) {
      return terrain.mask(x, z).structure > 0.5;
    },
  };
}
