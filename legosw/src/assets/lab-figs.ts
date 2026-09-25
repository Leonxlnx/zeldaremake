import { Group, type Object3D } from 'three';
import { ANAKIN_HAIR, OBIWAN_HAIR } from './hair';
import { ANAKIN_SPEC, OBIWAN_SPEC, minifig, type Minifig } from './minifig';
import type { Mouth } from './prints';

export function anakin(): Minifig {
  return minifig(ANAKIN_SPEC(ANAKIN_HAIR));
}
export function obiwan(): Minifig {
  return minifig(OBIWAN_SPEC(OBIWAN_HAIR));
}

function standing(f: Minifig): Object3D {
  const g = new Group();
  f.group.position.y = 1.25;
  f.pose({ armL: 0.15, armR: 0.35, splayL: 0.05, splayR: 0.05, headYaw: 0.15 });
  g.add(f.group);
  return g;
}

/** Lab entries for the minifigures (owner: lead). */
export const LAB_FIGS: Record<string, () => Object3D> = {
  anakin: () => {
    const f = anakin();
    f.setFace({ mouth: 'smirk', brows: -0.3, lookX: 0.02, lookY: 0, blink: 0, squint: 0.1 });
    return standing(f);
  },
  obiwan: () => {
    const f = obiwan();
    f.setFace({ mouth: 'grin', brows: 0.2, lookX: -0.02, lookY: 0, blink: 0, squint: 0 });
    return standing(f);
  },
  'faces-anakin': () => {
    const g = new Group();
    const mouths: Mouth[] = ['smirk', 'grit', 'open', 'frown'];
    mouths.forEach((m, i) => {
      const f = anakin();
      f.setFace({ mouth: m, brows: [-0.3, -1, 0.3, 0.8][i], lookX: 0, lookY: 0, blink: 0, squint: [0.1, 0.3, 0, 0][i] });
      f.group.position.set((i - 1.5) * 2.6, 1.25, 0);
      f.pose({ armL: 0.2, armR: 0.2 });
      g.add(f.group);
    });
    return g;
  },
  'faces-obiwan': () => {
    const g = new Group();
    const mouths: Mouth[] = ['smile', 'frown', 'shout', 'talk'];
    mouths.forEach((m, i) => {
      const f = obiwan();
      f.setFace({ mouth: m, brows: [0, 0.9, -0.6, 0.3][i], lookX: 0, lookY: 0, blink: 0, squint: 0 });
      f.group.position.set((i - 1.5) * 2.6, 1.25, 0);
      f.pose({ armL: 0.2, armR: 0.2 });
      g.add(f.group);
    });
    return g;
  },
  'anakin-head': () => {
    const f = anakin();
    f.setFace({ mouth: 'smirk', brows: -0.3, lookX: 0.0, lookY: 0, blink: 0, squint: 0.1 });
    const g = standing(f);
    g.userData.frame = { center: [0, 3.75, 0], radius: 1.1 };
    return g;
  },
  'obiwan-head': () => {
    const f = obiwan();
    f.setFace({ mouth: 'frown', brows: 0.8, lookX: 0.0, lookY: 0, blink: 0, squint: 0 });
    const g = standing(f);
    g.userData.frame = { center: [0, 3.75, 0], radius: 1.1 };
    return g;
  },
  'anakin-seated': () => {
    const f = anakin();
    f.seated();
    f.setFace({ mouth: 'grit', brows: -0.8, lookX: 0, lookY: 0, blink: 0, squint: 0.2 });
    const g = new Group();
    g.add(f.group);
    return g;
  },
};
