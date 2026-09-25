import type { CapitalShip } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Venator-class Star Destroyer, macro-brick scale, ~3200 units long. Owner: asset agent B. */
export function venator(o: { lod: 0 | 1 | 2; seed?: number }): CapitalShip {
  const group = placeholderGroup('venator', 1400, 300, 3200, 'white');
  return { group, length: 3200, turrets: [], engineGlows: [], anchors: {} };
}
