/**
 * Terrain lines of sight. The ground is the one occluder every system can sample exactly
 * (`ctx.terrain.height`): the east plateau's lip hides the plaza from the lane and the lane's
 * ground-level work from the plain under it. Used by the east lane's tiers (structures/east.ts)
 * and the kids (character/index.ts).
 */

type Point = { x: number; y: number; z: number };

/** true when the ground rises over the straight line from `from` to (x, y, z) (ends excluded, 0.5 m steps) */
export function groundHides(from: Point, x: number, y: number, z: number, heightAt: (x: number, z: number) => number): boolean {
  const dx = x - from.x;
  const dy = y - from.y;
  const dz = z - from.z;
  const n = Math.ceil(Math.hypot(dx, dz) / 0.5);
  for (let k = 2; k < n - 2; k++) {
    const t = k / n;
    if (heightAt(from.x + dx * t, from.z + dz * t) > from.y + dy * t + 0.05) return true;
  }
  return false;
}

/** true when the ground leaves `from` a clear line to at least one of `points` (`groundHides`' rule) */
export function seesAny(from: Point, points: readonly Point[], heightAt: (x: number, z: number) => number): boolean {
  return points.some((p) => !groundHides(from, p.x, p.y, p.z, heightAt));
}
