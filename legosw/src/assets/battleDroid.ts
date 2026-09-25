import { Object3D } from 'three';
import type { BattleDroid } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — B1 battle droid minifig (~5 units tall, tan). Owner: asset agent C. */
export function battleDroid(o: { variant?: 'standard' | 'commander' | 'pilot' | 'security'; seed?: number } = {}): BattleDroid {
  const group = placeholderGroup('battledroid', 1.6, 5, 1, 'tan');
  const mk = () => { const x = new Object3D(); group.add(x); return x; };
  const head = mk(), torso = mk(), armL = mk(), armR = mk(), legL = mk(), legR = mk(), blaster = mk();
  return { group, head, torso, armL, armR, legL, legR, blaster, pose: () => {}, parts: [head, torso, armL, armR, legL, legR] };
}
