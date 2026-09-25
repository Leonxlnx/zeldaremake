import type { Object3D } from 'three';
import { vultureDroid } from './vulture';
import { triFighter } from './trifighter';
import { discordMissile } from './missile';
import { buzzDroid } from './buzzdroid';
import { battleDroid } from './battleDroid';

/** Lab entries for the droid starfighters, missile, buzz droid and battle droid (owner: asset agent C). */
export const LAB_C: Record<string, () => Object3D> = {
  vulture: () => vultureDroid().group,
  'vulture-walk': () => {
    const v = vultureDroid();
    v.setMode(1);
    return v.group;
  },
  trifighter: () => triFighter().group,
  missile: () => discordMissile().group,
  'missile-open': () => {
    const m = discordMissile();
    m.setOpen(1);
    return m.group;
  },
  buzzdroid: () => {
    const b = buzzDroid();
    b.setDeploy(1);
    b.group.userData.animate = (t: number) => b.animate(t);
    return b.group;
  },
  battledroid: () => battleDroid().group,
  'battledroid-aim': () => {
    const d = battleDroid();
    d.pose({ aim: 1 });
    return d.group;
  },
};
