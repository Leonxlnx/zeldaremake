import type { InvisibleHand } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Providence-class carrier "Invisible Hand" (~3000 units), with hangar mouth + ray shield. Owner: asset agent D. */
export function invisibleHand(o: { lod: 0 | 1 }): InvisibleHand {
  const group = placeholderGroup('invisible-hand', 700, 900, 3000, 'dbg');
  return { group, length: 3000, turrets: [], engineGlows: [], anchors: {}, setShield: () => {} };
}
