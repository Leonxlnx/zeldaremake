/** Transform-only shadow rig: authored poses cannot touch the rendered character before acceptance. */
import { Group, Object3D } from 'three';
import type { Rig } from './rig';

const JOINTS = ['root', 'hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR',
  'elbowL', 'elbowR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'] as const;

function copyTransform(source: Object3D, target: Object3D, preserveEuler = false): void {
  target.position.copy(source.position);
  // Root yaw is authored by assigning Euler Y alone. Preserve that representation:
  // canonicalizing a large yaw can introduce X/Z = pi and change the next Y update.
  // IK joints are authored as quaternions and keep those exact values instead.
  if (preserveEuler) target.rotation.copy(source.rotation);
  else {
    target.rotation.order = source.rotation.order;
    target.quaternion.copy(source.quaternion);
  }
  target.scale.copy(source.scale);
  target.up.copy(source.up);
  target.visible = source.visible;
  target.matrixAutoUpdate = source.matrixAutoUpdate;
  target.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
  target.matrix.copy(source.matrix);
  target.matrixWorld.copy(source.matrixWorld);
  target.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate;
}

export function createPoseStage(source: Rig) {
  // This one non-rendering parent reproduces the actual root parent's cached world
  // transform, including attachment to a scene after the player was constructed.
  // Refreshing it does not update or write any object in the actual scene.
  const parent = new Group();
  parent.name = 'pose-stage-parent';
  parent.matrixAutoUpdate = false;
  const clones = new Map<Object3D, Group>();
  const pairs: { actual: Object3D; staged: Group }[] = [];
  const clone = (actual: Object3D): Group => {
    const found = clones.get(actual);
    if (found) return found;
    let at: Object3D = parent;
    if (actual !== source.root) {
      if (!actual.parent) throw new Error('Animated pose object must descend from the rig root');
      at = clone(actual.parent);
    }
    const staged = new Group();
    staged.name = actual.name;
    copyTransform(actual, staged, actual === source.root);
    at.add(staged);
    clones.set(actual, staged);
    pairs.push({ actual, staged });
    return staged;
  };
  // Only animated objects and the ancestors joining them are cloned. No meshes,
  // geometry, materials, textures, render hooks or mutable userData are shared.
  const joints = Object.fromEntries(JOINTS.map(key => [key, clone(source[key])])) as Pick<Rig, typeof JOINTS[number]>;
  const rig: Rig = {
    ...joints,
    cap: source.cap ? clone(source.cap) : null,
    capTail: source.capTail ? clone(source.capTail) : null,
    eyes: source.eyes.map(clone),
    props: { ...source.props, sole: [...source.props.sole] },
    sole: source.sole.clone(),
  };
  const begin = () => {
    if (source.root.parent) parent.matrix.copy(source.root.parent.matrixWorld);
    else parent.matrix.identity();
    for (const { actual, staged } of pairs) copyTransform(actual, staged, actual === source.root);
    parent.updateMatrixWorld(true);
  };
  begin();
  return {
    rig,
    begin,
    /** Discard a rejected attempt; the actual graph has not been modified. */
    rollback: begin,
    /** Called once, only after the coordinator accepts and applies IK to the shadow rig. */
    commit() {
      for (const { actual, staged } of pairs) copyTransform(staged, actual, actual === source.root);
      source.root.updateMatrixWorld(true);
    },
  };
}
