import type { SmallCraft } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — ARC-170 clone starfighter (~50 studs long). Owner: asset agent B. */
export function arc170(o: { lod?: 0 | 1 } = {}): SmallCraft {
  const group = placeholderGroup('arc170', 54, 6, 50, 'white');
  return { group, length: 50, muzzles: [], engines: [] };
}
