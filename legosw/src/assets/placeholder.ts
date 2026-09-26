import { Group, Object3D } from 'three';
import { Builder } from '../core/builder';
import type { ColorKey } from '../core/palette';

/** Grey box stand-in used by asset stubs until the real model lands. */
export function placeholderGroup(name: string, w: number, h: number, d: number, key: ColorKey = 'lbg'): Group {
  const b = new Builder({ seed: 1 });
  b.box(key, 0, 0, 0, w, h, d, { c: Math.min(w, h, d) * 0.05 });
  const g = b.build(name).group;
  return g;
}

export function anchor(name: string, parent: Object3D, x = 0, y = 0, z = 0): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
