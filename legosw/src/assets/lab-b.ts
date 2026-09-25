import type { Object3D } from 'three';
import { venator } from './venator';
import { arc170 } from './arc170';

/** Lab entries for the Venator and the ARC-170 (owner: asset agent B). */
export const LAB_B: Record<string, () => Object3D> = {
  venator: () => venator({ lod: 0 }).group,
  'venator-lod1': () => venator({ lod: 1 }).group,
  arc170: () => arc170().group,
};
