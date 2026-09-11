/**
 * Humanoid joint hierarchy shared by Link and the Kokiri kids. Plain `Group`s (no SkinnedMesh):
 * every body part is a rigid mesh parented to its joint, which is all a low-poly stylised child
 * needs and keeps the animation a pure function of time (no skeleton state).
 *
 * Model space: metres, Y up, the character faces +Z, its right-hand side is −X.
 * `root` sits at the sole level; joints hang from their parents (limb meshes extend down −Y).
 */
import { Group, Object3D, Vector3 } from 'three';

export interface Proportions {
  /** sole → top of skull (no cap) */
  height: number;
  ankleY: number;
  kneeY: number;
  hipY: number;
  hipHalfWidth: number;
  chestY: number;
  shoulderY: number;
  shoulderHalfWidth: number;
  upperArm: number;
  forearm: number;
  neckY: number;
  headCentreY: number;
  headRadius: number;
  /** ankle joint → sole contact point (local to the ankle joint) */
  sole: [number, number, number];
}

/** Young Link: 1.25 m with the cap, big head (≈ 4.2 heads), short legs (reference §10). */
export const LINK_PROPORTIONS: Proportions = {
  height: 1.18,
  ankleY: 0.065,
  kneeY: 0.29,
  hipY: 0.52,
  hipHalfWidth: 0.068,
  chestY: 0.66,
  shoulderY: 0.835,
  shoulderHalfWidth: 0.118,
  upperArm: 0.155,
  forearm: 0.14,
  neckY: 0.85,
  headCentreY: 1.035,
  headRadius: 0.145,
  sole: [0, -0.065, 0.025],
};

/** Kokiri kid ≈ 1.15 m, same silhouette scaled down with a slightly smaller head. */
export const KOKIRI_PROPORTIONS: Proportions = {
  height: 1.08,
  ankleY: 0.06,
  kneeY: 0.27,
  hipY: 0.485,
  hipHalfWidth: 0.06,
  chestY: 0.615,
  shoulderY: 0.8,
  shoulderHalfWidth: 0.125,
  upperArm: 0.155,
  forearm: 0.14,
  neckY: 0.825,
  headCentreY: 0.955,
  headRadius: 0.115,
  sole: [0, -0.06, 0.025],
};

export interface Rig {
  root: Group;
  hips: Group;
  chest: Group;
  neck: Group;
  /** group at the head centre (features are placed relative to it); rotates with `neck` */
  head: Group;
  shoulderL: Group;
  shoulderR: Group;
  elbowL: Group;
  elbowR: Group;
  thighL: Group;
  thighR: Group;
  kneeL: Group;
  kneeR: Group;
  ankleL: Group;
  ankleR: Group;
  /** Seated cap root; recursive accessory lookups remain rooted here. */
  cap: Group | null;
  /** Only the draped cloth tail sways; crown and brim stay seated. */
  capTail: Group | null;
  /** objects scaled in Y for blinking */
  eyes: Object3D[];
  props: Proportions;
  sole: Vector3;
}

function joint(name: string, parent: Object3D, x: number, y: number, z: number): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function buildRig(props: Proportions, name: string): Rig {
  const root = new Group();
  root.name = name;
  const hips = joint('hips', root, 0, props.hipY, 0);
  const chest = joint('chest', hips, 0, props.chestY - props.hipY, 0);
  const neck = joint('neck', chest, 0, props.neckY - props.chestY, 0);
  neck.rotation.order = 'YXZ';
  const head = joint('head', neck, 0, props.headCentreY - props.neckY, 0);
  const shoulderL = joint('shoulderL', chest, props.shoulderHalfWidth, props.shoulderY - props.chestY, 0);
  const shoulderR = joint('shoulderR', chest, -props.shoulderHalfWidth, props.shoulderY - props.chestY, 0);
  const elbowL = joint('elbowL', shoulderL, 0, -props.upperArm, 0);
  const elbowR = joint('elbowR', shoulderR, 0, -props.upperArm, 0);
  const thighL = joint('thighL', hips, props.hipHalfWidth, 0, 0);
  const thighR = joint('thighR', hips, -props.hipHalfWidth, 0, 0);
  const kneeL = joint('kneeL', thighL, 0, -(props.hipY - props.kneeY), 0);
  const kneeR = joint('kneeR', thighR, 0, -(props.hipY - props.kneeY), 0);
  const ankleL = joint('ankleL', kneeL, 0, -(props.kneeY - props.ankleY), 0);
  const ankleR = joint('ankleR', kneeR, 0, -(props.kneeY - props.ankleY), 0);
  return {
    root,
    hips,
    chest,
    neck,
    head,
    shoulderL,
    shoulderR,
    elbowL,
    elbowR,
    thighL,
    thighR,
    kneeL,
    kneeR,
    ankleL,
    ankleR,
    cap: null,
    capTail: null,
    eyes: [],
    props,
    sole: new Vector3(props.sole[0], props.sole[1], props.sole[2]),
  };
}

/** Reset every joint to the rest pose (called before applying a pose so poses never accumulate). */
export function resetRig(rig: Rig): void {
  const joints = [rig.hips, rig.chest, rig.neck, rig.shoulderL, rig.shoulderR, rig.elbowL, rig.elbowR, rig.thighL, rig.thighR, rig.kneeL, rig.kneeR, rig.ankleL, rig.ankleR];
  for (const j of joints) j.rotation.set(0, 0, 0);
  rig.hips.position.set(0, rig.props.hipY, 0);
  rig.chest.position.set(0, rig.props.chestY - rig.props.hipY, 0);
  if (rig.cap) rig.cap.rotation.set(0, 0, 0);
  if (rig.capTail) rig.capTail.rotation.set(0, 0, 0);
}
