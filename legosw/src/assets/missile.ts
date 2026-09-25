import type { Missile } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Discord missile that opens to release buzz droids (~9 studs long). Owner: asset agent C. */
export function discordMissile(): Missile {
  const group = placeholderGroup('missile', 2.4, 2.4, 9, 'dbg');
  return { group, length: 9, muzzles: [], engines: [], setOpen: () => {}, payloadAnchors: [] };
}
