import type { Object3D } from 'three';
import { munificent } from './munificent';
import { invisibleHand } from './invisibleHand';
import { hangarInterior } from './hangar';

/** Lab entries for the Separatist capital ships and the hangar (owner: asset agent D). */
export const LAB_D: Record<string, () => Object3D> = {
  munificent: () => munificent({ lod: 0 }).group,
  'invisible-hand': () => invisibleHand({ lod: 0 }).group,
  hangar: () => hangarInterior().group,
};
