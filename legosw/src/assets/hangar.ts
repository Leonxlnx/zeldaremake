import type { Hangar } from './types';
import { anchor, placeholderGroup } from './placeholder';

/** STUB — Invisible Hand hangar bay interior at minifig scale, blue ray shield at the mouth. Owner: asset agent D. */
export function hangarInterior(): Hangar {
  const group = placeholderGroup('hangar', 200, 2, 140, 'dbg');
  return { group, setShield: () => {}, anchors: { landingA: anchor('landingA', group, -30, 1, 0), landingB: anchor('landingB', group, 30, 1, 0), mouth: anchor('mouth', group, 0, 20, 70) }, size: [100, 40, 70] };
}
