import { Object3D } from 'three';
import type { BuzzDroid } from './types';
import { placeholderGroup } from './placeholder';

/** STUB — Buzz droid (~2.6 studs ball, arms deploy). Owner: asset agent C. */
export function buzzDroid(o: { seed?: number } = {}): BuzzDroid {
  const group = placeholderGroup('buzzdroid', 2.6, 2.6, 2.6, 'flatSilver');
  const head = new Object3D();
  group.add(head);
  return { group, setDeploy: () => {}, animate: () => {}, head };
}
