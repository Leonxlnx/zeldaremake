import type { Object3D } from 'three';
import { VENATOR_DIMS, venator } from './venator';
import { arc170 } from './arc170';

const S = VENATOR_DIMS.scale;

/** Venator framed on one spot (studs) so the turntable orbits it: close-ups of the hero areas. */
function venatorSpot(lod: 0 | 1 | 2, x: number, y: number, z: number, radius: number): Object3D {
  const v = venator({ lod });
  v.group.userData.frame = { center: [x * S, y * S, z * S], radius: radius * S };
  return v.group;
}

const deckY = (z: number) => VENATOR_DIMS.dorsalY(0, z);
const rimX = (z: number) => 96 * VENATOR_DIMS.tz(z);

/** Lab entries for the Venator and the ARC-170 (owner: asset agent B). */
export const LAB_B: Record<string, () => Object3D> = {
  venator: () => venator({ lod: 0 }).group,
  'venator-lod1': () => venator({ lod: 1 }).group,
  'venator-lod2': () => venator({ lod: 2 }).group,
  // hero-shot close-ups (lod 0)
  'venator-towers': () => venatorSpot(0, 0, 44, -164, 30),
  'venator-bridge': () => venatorSpot(0, 14, 56, -164, 12),
  'venator-supfront': () => venatorSpot(0, 0, 20, -100, 22),
  'venator-deck': () => venatorSpot(0, 0, deckY(-20), -20, 10),
  'venator-deck-far': () => venatorSpot(0, 0, deckY(40), 40, 40),
  'venator-port': () => venatorSpot(0, rimX(-40), 0, -40, 20),
  'venator-trench': () => venatorSpot(0, rimX(-120) - 4, -6, -120, 14),
  'venator-turret': () => venatorSpot(0, rimX(-118) - 27, 8, -118, 8),
  'venator-stern': () => venatorSpot(0, 0, -8, -196, 100),
  'venator-bow': () => venatorSpot(0, 0, 0, 170, 30),
  // long-take close-ups: deck-edge service trench, dorsal wing plating, door leaves, level-1 roof,
  // the block between the towers, the bridge underside, the engine bells
  'venator-band': () => venatorSpot(0, 10, 5.5, 60, 9),
  'venator-wing': () => venatorSpot(0, 26, 4.3, 20, 14),
  'venator-leaf': () => venatorSpot(0, 3, deckY(40), 40, 7),
  'venator-l1roof': () => venatorSpot(0, 0, 25, -80, 18),
  'venator-neck': () => venatorSpot(0, 0, 37, -168, 12),
  'venator-bridge-under': () => venatorSpot(0, 14, 50, -165, 12),
  'venator-engines': () => venatorSpot(0, 30, -14, -200, 30),
  // stern dressing (rear window bands over the engine housing), housing roof, a medium turret
  'venator-rear': () => venatorSpot(0, 0, 12, -186, 36),
  'venator-housing': () => venatorSpot(0, 20, 3, -191, 16),
  'venator-medium': () => {
    const [x, z] = VENATOR_DIMS.mediumXZ[1];
    return venatorSpot(0, x, VENATOR_DIMS.dorsalY(x, z) + 1.5, z, 5);
  },
  'venator-lod1-stern': () => venatorSpot(1, 0, 5, -150, 110),
  'venator-lod1-port': () => venatorSpot(1, rimX(-100), 5, -100, 45),
  'venator-lod2-port': () => venatorSpot(2, rimX(-100), 5, -100, 45),
  arc170: () => arc170().group,
  'arc170-lod1': () => arc170({ lod: 1 }).group,
  'arc170-cockpit': () => arcSpot(0, 3, 12, 9),
  'arc170-engine': () => arcSpot(6.3, 0, 2, 8),
  'arc170-cannon': () => arcSpot(27, 0, 16, 8),
  'arc170-tail': () => arcSpot(0, 2, -18, 12),
  // S-foils: t = 0 shut, t ≈ 1.05 half, t ≈ 2.09 open (cycles in the live lab)
  'arc170-foils': () => {
    const a = arc170();
    a.group.userData.animate = (t: number) => a.setFoils(0.5 - 0.5 * Math.cos(t * 1.5));
    return a.group;
  },
  'arc170-closed': () => {
    const a = arc170();
    a.setFoils(0);
    return a.group;
  },
  'arc170-lod1-closed': () => {
    const a = arc170({ lod: 1 });
    a.setFoils(0);
    return a.group;
  },
  'arc170-foil-shut': () => arcSpot(16, -0.5, -8, 7, 0),
};

/** ARC-170 framed on one spot (studs, model space) for close-ups. */
function arcSpot(x: number, y: number, z: number, radius: number, foils = 1): Object3D {
  const a = arc170();
  a.setFoils(foils);
  a.group.userData.frame = { center: [x, y, z], radius };
  return a.group;
}
