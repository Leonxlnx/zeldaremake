/**
 * `TubePath` (see system.ts) from the rings a `tube()` sweep emitted. The sweep places one ring
 * at each centreline point with its nominal radius and joins consecutive rings with straight
 * triangle strips, so between two rings the built tube's axis and radius are exactly linear in
 * the ring parameter: `centre(s)` / `radius(s)` here reproduce the mesh's axis (before the bark
 * relief) at any s, not a smoothed or re-fitted curve. Rings must be in increasing `s` order;
 * outside `range` the end rings are held.
 */
import { Vector3 } from 'three';
import type { TrunkSeat, TubePath } from '../system';

export function tubePathFromRings(centres: readonly Vector3[], s: readonly number[], radii: readonly number[]): TubePath {
  const count = centres.length;
  if (count < 2 || s.length !== count || radii.length !== count) throw new Error('trees: a tube path needs ≥ 2 rings with one s and one radius each');
  for (let i = 1; i < count; i++) if (!(s[i] >= s[i - 1])) throw new Error('trees: tube path rings must be in increasing s order');
  const points = centres.map((p) => p.clone());
  const params = s.slice();
  const rad = radii.slice();
  /** index i of the segment [i, i+1] holding x, and the fraction along it */
  const locate = (x: number): [number, number] => {
    if (x <= params[0]) return [0, 0];
    if (x >= params[count - 1]) return [count - 2, 1];
    let lo = 0;
    let hi = count - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (params[mid] <= x) lo = mid;
      else hi = mid;
    }
    const span = params[hi] - params[lo];
    return [lo, span > 0 ? (x - params[lo]) / span : 0];
  };
  return {
    range: [params[0], params[count - 1]],
    centre(x, out = new Vector3()) {
      const [i, t] = locate(x);
      return out.copy(points[i]).lerp(points[i + 1], t);
    },
    radius(x) {
      const [i, t] = locate(x);
      return rad[i] + (rad[i + 1] - rad[i]) * t;
    },
  };
}

/**
 * `TrunkSeat` (see system.ts) from a bole's rings in world space (`centres` already carry the
 * seat's yaw / scale / translation, `radii` its scale). The parameter is height above `base`:
 * ring i sits at h = centres[i].y − base.y, and between rings the sweep's axis and radius are
 * linear in h exactly as the mesh is (before the bark relief). Rings run base → top (a grown bole
 * rises monotonically; should a ring ever dip, the first segment reaching h wins); below the first
 * ring (the skirt under the terrain) and above the last (the fork) the end ring's radius and x/z
 * are held while y follows h.
 */
export function trunkSeatFromRings(id: string, base: Vector3, yaw: number, scale: number, centres: readonly Vector3[], radii: readonly number[], bareHeight: number): TrunkSeat {
  const count = centres.length;
  if (count < 2 || radii.length !== count) throw new Error('trees: a trunk seat needs ≥ 2 rings with one radius each');
  const points = centres.map((p) => p.clone());
  const baseY = base.y;
  const heights = points.map((p) => p.y - baseY);
  const rad = radii.slice();
  /** index i of the segment [i, i+1] holding h, and the fraction along it */
  const locate = (h: number): [number, number] => {
    if (h <= heights[0]) return [0, 0];
    if (h >= heights[count - 1]) return [count - 2, 1];
    let i = 0;
    while (i < count - 2 && heights[i + 1] < h) i++;
    const span = heights[i + 1] - heights[i];
    return [i, span > 0 ? Math.max(0, Math.min(1, (h - heights[i]) / span)) : 0];
  };
  return {
    id,
    x: base.x,
    y: base.y,
    z: base.z,
    yaw,
    scale,
    bareHeight,
    radiusAt(h) {
      const [i, t] = locate(h);
      return rad[i] + (rad[i + 1] - rad[i]) * t;
    },
    axisAt(h, out = new Vector3()) {
      const [i, t] = locate(h);
      out.copy(points[i]).lerp(points[i + 1], t);
      out.y = baseY + h;
      return out;
    },
  };
}
