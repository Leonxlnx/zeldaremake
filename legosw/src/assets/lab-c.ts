import { Group, type Mesh, type Object3D } from 'three';
import { vultureDroid } from './vulture';
import { triFighter } from './trifighter';
import { discordMissile } from './missile';
import { buzzDroid } from './buzzdroid';
import { battleDroid } from './battleDroid';

/** Visible triangles / meshes of a model (debug report in the page console). */
function report<T extends Object3D>(name: string, o: T): T {
  let tris = 0, calls = 0;
  o.traverseVisible((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    calls++;
  });
  console.info(`[lab-c] ${name}: ${tris} tris, ${calls} meshes`);
  return o;
}

/** Frame the lab camera on a detail instead of the whole bounding sphere. */
function framed<T extends Object3D>(o: T, center: [number, number, number], radius: number): T {
  o.userData.frame = { center, radius };
  return o;
}

/** Lab entries for the droid starfighters, missile, buzz droid and battle droid (owner: asset agent C). */
export const LAB_C: Record<string, () => Object3D> = {
  vulture: () => {
    const v = vultureDroid();
    v.group.userData.animate = (t: number) => v.animate?.(t);
    return report('vulture', v.group);
  },
  'vulture-head': () => framed(vultureDroid().group, [0, 2.2, 2.6], 4),
  'vulture-walk': () => {
    const v = vultureDroid();
    v.setMode(1);
    v.group.userData.animate = (t: number) => v.setGait(t * 2.2);
    return framed(report('vulture-walk', v.group), [0, -2, 0.5], 19);
  },
  'vulture-lod1': () => report('vulture-lod1', vultureDroid({ lod: 1 }).group),
  'vulture-lod1-walk': () => {
    const v = vultureDroid({ lod: 1 });
    v.setMode(1);
    v.group.userData.animate = (t: number) => v.setGait(t * 5);
    return framed(report('vulture-lod1-walk', v.group), [0, -2, 0.5], 19);
  },
  trifighter: () => framed(report('trifighter', triFighter().group), [0, 2, 0.5], 12),
  'trifighter-lod1': () => framed(report('trifighter-lod1', triFighter({ lod: 1 }).group), [0, 2, 0.5], 12),
  'trifighter-eye': () => framed(triFighter().group, [0, -0.1, 2.0], 3.4),
  missile: () => report('missile', discordMissile().group),
  'missile-half': () => {
    const m = discordMissile();
    m.setOpen(0.5);
    return m.group;
  },
  'missile-open': () => {
    const m = discordMissile();
    m.setOpen(1);
    return report('missile-open', m.group);
  },
  'missile-nose': () => {
    const m = discordMissile();
    m.group.userData.animate = (t: number) => m.setOpen(t);
    return framed(m.group, [0, 0, 2.6], 3.2);
  },
  buzzdroid: () => {
    const b = buzzDroid();
    b.setDeploy(1);
    b.group.userData.animate = (t: number) => b.animate(t);
    return report('buzzdroid', b.group);
  },
  'buzzdroid-closed': () => report('buzzdroid-closed', buzzDroid({ seed: 2 }).group),
  'buzzdroid-half': () => {
    const b = buzzDroid({ seed: 3 });
    b.setDeploy(0.5);
    b.group.userData.animate = (t: number) => b.animate(t);
    return b.group;
  },
  'buzzdroid-close': () => {
    const b = buzzDroid({ seed: 4 });
    b.setDeploy(1);
    b.group.userData.animate = (t: number) => b.animate(t);
    return framed(b.group, [0, 0.1, 0.4], 2.6);
  },
  battledroid: () => standing(report('battledroid', battleDroid().group)),
  'battledroid-aim': () => {
    const d = battleDroid();
    d.pose({ aim: 1 });
    return standing(report('battledroid-aim', d.group));
  },
  'battledroid-walk': () => {
    const d = battleDroid({ variant: 'pilot' });
    d.group.userData.animate = (t: number) => d.pose({ walk: t * 4 });
    return standing(d.group);
  },
  'battledroid-head': () => framed(battleDroid({ variant: 'commander' }).group, [0, 4.25, 0.25], 2.1),
  'battledroid-line': () => droidLine(0),
  'battledroid-line-aim': () => droidLine(1),
};

/** The four variants side by side (standard, commander, pilot, security). */
function droidLine(aim: number): Object3D {
  const g = new Group();
  (['standard', 'commander', 'pilot', 'security'] as const).forEach((variant, i) => {
    const d = battleDroid({ variant, seed: i + 3 });
    d.pose({ aim });
    d.group.position.x = (1.5 - i) * 2.1;
    g.add(d.group);
  });
  return framed(report('battledroid-line', g), [0, 2.55, 0], 5.6);
}

/** Frame a ~5-stud standing minifig so it fits the 2.39:1 lab frame head to toe. */
function standing<T extends Object3D>(o: T): T {
  return framed(o, [0, 2.55, 0.2], 4.4);
}
