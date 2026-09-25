import type { Object3D } from 'three';
import { eta2 } from './eta2';
import { astromech } from './astromech';

/** Lab entries for the Jedi interceptors and astromechs (owner: asset agent A). */
export const LAB_A: Record<string, () => Object3D> = {
  'eta2-anakin': () => {
    const f = eta2({ variant: 'anakin' });
    f.setFoils(1);
    f.setEngine(1);
    const r2 = astromech({ variant: 'r2d2', socket: true });
    f.astromechAnchor.add(r2.group);
    return f.group;
  },
  'eta2-obiwan': () => {
    const f = eta2({ variant: 'obiwan' });
    f.setFoils(1);
    f.setEngine(1);
    const r4 = astromech({ variant: 'r4p17', socket: true });
    f.astromechAnchor.add(r4.group);
    return f.group;
  },
  'eta2-anakin-cruise': () => {
    const f = eta2({ variant: 'anakin' });
    f.setFoils(0);
    f.setEngine(0.6);
    return f.group;
  },
  r2d2: () => astromech({ variant: 'r2d2' }).group,
  r4p17: () => astromech({ variant: 'r4p17' }).group,
};
