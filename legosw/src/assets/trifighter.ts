import type { SmallCraft } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Droid tri-fighter (~16 studs span). Owner: asset agent C. */
export function triFighter(o: { lod?: 0 | 1 } = {}): SmallCraft {
  const group = placeholderGroup('trifighter', 16, 16, 10, 'dbg');
  return { group, length: 10, muzzles: [], engines: [] };
}
