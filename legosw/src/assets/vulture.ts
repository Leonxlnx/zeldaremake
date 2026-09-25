import type { VultureDroid } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Vulture droid starfighter (flight / walking modes, ~24 studs span). Owner: asset agent C. */
export function vultureDroid(o: { lod?: 0 | 1; seed?: number } = {}): VultureDroid {
  const group = placeholderGroup('vulture', 24, 3, 14, 'tan');
  return { group, length: 14, muzzles: [], engines: [], setMode: () => {}, setGait: () => {} };
}
