import { Group, type Object3D } from 'three';
import { eta2 } from './eta2';
import { astromech } from './astromech';
import { anakin, obiwan } from './lab-figs';
import type { Eta2 } from './types';

type Variant = 'anakin' | 'obiwan';

/** A fighter as the film uses it: pilot seated, socket droid in place. */
function fighter(variant: Variant, o: { foils?: number; engine?: number; lod?: 0 | 1; pilot?: boolean; droid?: boolean } = {}): Eta2 {
  const f = eta2({ variant, lod: o.lod });
  f.setFoils(o.foils ?? 1);
  f.setEngine(o.engine ?? 1);
  if (o.droid ?? true) f.astromechAnchor.add(astromech({ variant: variant === 'anakin' ? 'r2d2' : 'r4p17', socket: true, lod: o.lod }).group);
  if (o.pilot ?? true) {
    const fig = variant === 'anakin' ? anakin() : obiwan();
    fig.seated();
    fig.setFace(variant === 'anakin' ? { mouth: 'grit', brows: -0.7, lookX: 0, lookY: 0, blink: 0, squint: 0.2 } : { mouth: 'frown', brows: 0.3, lookX: 0, lookY: 0, blink: 0, squint: 0 });
    f.cockpitAnchor.add(fig.group);
  }
  return f;
}

function framed(o: Object3D, center: [number, number, number], radius: number): Object3D {
  o.userData.frame = { center, radius };
  return o;
}

/** Lab entries for the Jedi interceptors and astromechs (owner: asset agent A). */
export const LAB_A: Record<string, () => Object3D> = {
  'eta2-anakin': () => fighter('anakin').group,
  'eta2-obiwan': () => fighter('obiwan').group,
  'eta2-anakin-cruise': () => fighter('anakin', { foils: 0, engine: 0.6 }).group,
  'eta2-obiwan-cruise': () => fighter('obiwan', { foils: 0, engine: 0.6 }).group,
  'eta2-anakin-lod1': () => fighter('anakin', { lod: 1, pilot: false }).group,
  'eta2-obiwan-lod1': () => fighter('obiwan', { lod: 1, pilot: false }).group,
  'eta2-anakin-bare': () => fighter('anakin', { pilot: false, droid: false }).group,
  'eta2-anakin-cockpit': () => framed(fighter('anakin').group, [0, 3.0, 1.2], 2.4),
  'eta2-obiwan-cockpit': () => framed(fighter('obiwan').group, [0, 3.0, 1.2], 2.4),
  'eta2-anakin-socket': () => framed(fighter('anakin').group, [3.6, 1.7, 1.5], 2.3),
  'eta2-obiwan-socket': () => framed(fighter('obiwan').group, [3.6, 1.7, 1.5], 2.3),
  'eta2-anakin-nose': () => framed(fighter('anakin').group, [0, 1.0, 7.5], 4.2),
  'eta2-anakin-tail': () => framed(fighter('anakin').group, [0, 1.2, -8.5], 4.8),
  'eta2-obiwan-nose': () => framed(fighter('obiwan').group, [0, 1.0, 7.5], 4.2),
  'eta2-anakin-canopy-open': () => {
    const f = fighter('anakin');
    f.canopy.rotation.x = -0.9;
    return f.group;
  },
  r2d2: () => astromech({ variant: 'r2d2' }).group,
  r4p17: () => astromech({ variant: 'r4p17' }).group,
  'astromechs-pair': () => {
    const g = new Group();
    const a = astromech({ variant: 'r2d2' });
    a.group.position.x = 1.6;
    a.setHeadYaw(0.3);
    const c = astromech({ variant: 'r4p17' });
    c.group.position.x = -1.6;
    c.setHeadYaw(-0.3);
    g.add(a.group, c.group);
    return g;
  },
  'astromechs-socket': () => {
    const g = new Group();
    const a = astromech({ variant: 'r2d2', socket: true });
    a.group.position.x = 1.3;
    const c = astromech({ variant: 'r4p17', socket: true });
    c.group.position.x = -1.3;
    g.add(a.group, c.group);
    return g;
  },
};
