/**
 * `TubePath` (see system.ts) from the rings a `tube()` sweep emitted. The sweep places one ring
 * at each centreline point with its nominal radius and joins consecutive rings with straight
 * triangle strips, so between two rings the built tube's axis and radius are exactly linear in
 * the ring parameter: `centre(s)` / `radius(s)` here reproduce the mesh's axis (before the bark
 * relief) at any s, not a smoothed or re-fitted curve. Rings must be in increasing `s` order;
 * outside `range` the end rings are held.
 */
import { Vector3 } from 'three';
import type { TubePath } from '../system';

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
