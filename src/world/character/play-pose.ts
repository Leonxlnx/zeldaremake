/** Stateful foot contacts belong to live play only. Reference captures use animation.ts. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import { applyPose, type GroundSampler } from './animation';
import { strideLength, type MotionState } from './locomotion';
import type { Rig } from './rig';

const DOWN = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = MathUtils.clamp;
const mix = MathUtils.lerp;

export function createPlayPose(rig: Rig, ground: GroundSampler) {
  const feet = [1, -1].map((side) => ({
    side, anchor: new Vector3(), from: new Vector3(), to: new Vector3(), target: new Vector3(),
    takeoffRoot: new Vector3(),
    swing: false, initialised: false, yaw: 0,
  }));
  const ankle = new Vector3(), local = new Vector3(), upper = new Vector3();
  const forward = new Vector3(), axis = new Vector3(), soleOffset = new Vector3();
  const parentQ = new Quaternion(), footQ = new Quaternion(), desiredUpper = new Quaternion();
  const hipWorld = new Vector3(), movingFrom = new Vector3();
  const previous = new Vector3(), restTarget = new Vector3(), delta = new Vector3();
  let wasGrounded = true;
  let pelvisY = NaN;
  let transitionTime = 1;
  const upperJoints = [rig.hips, rig.chest, rig.neck, rig.shoulderL, rig.shoulderR, rig.elbowL, rig.elbowR, ...(rig.cap ? [rig.cap] : [])];
  const lastUpper = upperJoints.map(j => j.quaternion.clone());
  const transitionUpper = upperJoints.map(j => j.quaternion.clone());
  const reset = () => {
    for (const f of feet) f.initialised = false;
    wasGrounded = true; pelvisY = NaN; transitionTime = 1;
  };

  // The rendered boot-sole in link.ts is .108 x .172 m, centred at ankle Z=.03.
  // Contacts refer to rig.sole (Z=.025), so check the full sole, including toe/heel.
  const supportHeight = (x: number, z: number, yaw: number) => {
    const sn = Math.sin(yaw), cs = Math.cos(yaw);
    let h = ground(x, z);
    for (const ox of [-0.054, 0, 0.054]) for (const localZ of [-0.056, 0.03, 0.116]) {
      const oz = localZ - rig.sole.z;
      h = Math.max(h, ground(x + cs * ox + sn * oz, z - sn * ox + cs * oz));
    }
    return h;
  };

  const solve = (side: number, target: Vector3, yaw: number) => {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const knee = side > 0 ? rig.kneeL : rig.kneeR;
    const foot = side > 0 ? rig.ankleL : rig.ankleR;
    footQ.setFromAxisAngle(UP, yaw);
    soleOffset.copy(rig.sole).applyQuaternion(footQ);
    ankle.copy(target).sub(soleOffset);
    rig.hips.worldToLocal(local.copy(ankle));
    local.sub(thigh.position);
    const a = rig.props.hipY - rig.props.kneeY;
    const b = rig.props.kneeY - rig.props.ankleY;
    const d = clamp(local.length(), Math.abs(a - b) + 0.01, a + b - 0.001);
    local.normalize();
    // Bend the knee toward the character's forward direction, with a full 3D hip swing.
    const flex = Math.acos(clamp((d * d - a * a - b * b) / (2 * a * b), -1, 1));
    const offset = Math.atan2(b * Math.sin(flex), a + b * Math.cos(flex));
    forward.set(0, 0, 1);
    forward.addScaledVector(local, -forward.dot(local)).normalize();
    upper.copy(local).multiplyScalar(Math.cos(offset)).addScaledVector(forward, Math.sin(offset));
    thigh.quaternion.setFromUnitVectors(DOWN, upper);
    // Orient the knee's hinge in the hip bend plane, including sideways steps/turns.
    axis.crossVectors(forward, local).normalize().applyQuaternion(thigh.quaternion.clone().invert());
    knee.quaternion.setFromAxisAngle(axis, flex);
    rig.root.updateMatrixWorld(true);
    knee.getWorldQuaternion(parentQ);
    foot.quaternion.copy(parentQ.invert()).multiply(footQ);
  };

  return {
    reset,
    /** Actual sole targets, useful for motion/contact diagnostics. */
    contacts: feet.map((f) => f.target),
    update(s: MotionState, t: number, dt = 1 / 120) {
      const r = rig;
      if (s.grounded !== wasGrounded) {
        transitionTime = 0;
        transitionUpper.forEach((q, i) => q.copy(lastUpper[i]));
        // Preserve the descending feet instead of restarting at a mid-stride target.
        for (const f of feet) {
          f.anchor.copy(f.target); f.from.copy(f.target); f.swing = false;
          f.takeoffRoot.set(s.x, s.y, s.z);
        }
      }
      r.root.position.set(s.x, s.y, s.z);
      r.root.rotation.y = s.yaw;
      applyPose(r, { gait: 'idle', t, phase: 0, lookWeight: 0 });
      const w = s.moveWeight, run = s.runWeight, stair = s.stairWeight;
      const phi = s.phase * TAU, wave = Math.sin(phi);
      const arm = mix(0.32, 0.66, run) * w;
      r.hips.position.x *= 1 - w;
      r.hips.rotation.set(0, 0.045 * wave * w, 0.022 * wave * w);
      r.chest.rotation.set(0.025 + (0.07 + 0.13 * run + 0.07 * stair) * w, -0.035 * wave * w, 0);
      r.chest.position.y += 0.004 * Math.cos(phi * 2) * w;
      r.shoulderL.rotation.set(arm * wave, 0, 0.1);
      r.shoulderR.rotation.set(-arm * wave, 0, -0.1);
      r.elbowL.rotation.x = r.elbowR.rotation.x = -mix(0.18, 1.1, run) - 0.16 * w;
      r.neck.rotation.x = -0.04 * w;
      if (r.cap) r.cap.rotation.set(0.02 + 0.055 * w * Math.cos(phi * 2 - 0.7), 0, 0.025 * wave * w);

      if (!s.grounded) {
        // Quiet hop: knees tuck on ascent, feet reach for the ground on descent.
        const rising = clamp(s.vy / 4.8, 0, 1);
        r.chest.rotation.x = 0.10 + 0.08 * rising;
        r.thighL.rotation.x = -0.20 - 0.45 * rising;
        r.thighR.rotation.x = -0.12 - 0.32 * rising;
        r.kneeL.rotation.x = 0.30 + 0.8 * rising;
        r.kneeR.rotation.x = 0.22 + 0.7 * rising;
        r.ankleL.rotation.x = -(r.thighL.rotation.x + r.kneeL.rotation.x);
        r.ankleR.rotation.x = -(r.thighR.rotation.x + r.kneeR.rotation.x);
        r.shoulderL.rotation.set(-0.55 - 0.3 * rising, 0, 0.22);
        r.shoulderR.rotation.set(-0.55 - 0.3 * rising, 0, -0.22);
      }

      transitionTime += dt;
      const progress = clamp(transitionTime / 0.12, 0, 1);
      const transition = progress * progress * (3 - 2 * progress);
      upperJoints.forEach((joint, i) => {
        desiredUpper.copy(joint.quaternion);
        joint.quaternion.slerpQuaternions(transitionUpper[i], desiredUpper, transition);
        lastUpper[i].copy(joint.quaternion);
      });

      // A slight knee bend gives the leg solver room; landing compresses without moving physics.
      if (s.grounded) r.hips.position.y -= 0.035 + 0.04 * w + 0.01 * run + 0.055 * s.landing;
      r.root.updateMatrixWorld(true);
      const duty = mix(0.52, 0.36, run);
      const stride = strideLength(run, stair);
      const lead = Math.min(0.245, stride * duty * 0.5) * w;
      for (const f of feet) {
        previous.copy(f.target);
        const phase = ((s.phase + (f.side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
        const swinging = w > 0.05 && phase >= duty;
        const lateral = f.side * (r.props.hipHalfWidth + 0.018);
        const rest = (out: Vector3, z: number) => {
          out.set(lateral, 0, z).applyAxisAngle(UP, s.yaw).add(r.root.position);
          out.y = supportHeight(out.x, out.z, f.yaw);
        };
        if (!f.initialised) {
          f.yaw = s.yaw;
          rest(f.anchor, 0.025);
          f.from.copy(f.anchor); f.to.copy(f.anchor); f.target.copy(f.anchor);
          previous.copy(f.target);
          f.swing = false; f.initialised = true;
        }
        if (s.grounded && swinging && !f.swing) {
          f.from.copy(f.target);
          f.takeoffRoot.copy(r.root.position);
          rest(f.to, lead + 0.025);
        }
        if (!s.grounded) {
          // Approach the authored airborne pose through continuous world-space targets.
          (f.side > 0 ? r.ankleL : r.ankleR).localToWorld(f.target.copy(r.sole));
        } else if (swinging) {
          // Retarget only the free foot so planted soles do not skate when the camera turns.
          rest(f.to, lead + 0.025);
          const u = clamp((phase - duty) / (1 - duty), 0, 1);
          const ease = u * u * (3 - 2 * u);
          // Carry the free foot with the moving pelvis while it swings. Its world-space
          // lift-off point alone would lag behind a running body and overextend the knee.
          movingFrom.copy(f.from);
          movingFrom.x += s.x - f.takeoffRoot.x;
          movingFrom.z += s.z - f.takeoffRoot.z;
          f.target.lerpVectors(movingFrom, f.to, ease);
          const lift = (0.07 + 0.10 * run + 0.12 * stair) * Math.sin(Math.PI * u);
          f.target.y = Math.max(f.target.y, supportHeight(f.target.x, f.target.z, f.yaw)) + lift;
        } else {
          if (f.swing) f.anchor.copy(f.target);
          f.target.copy(f.anchor);
          f.target.y = supportHeight(f.target.x, f.target.z, f.yaw);
        }
        if (s.grounded && w < 0.15) {
          // A stopped phase can be halfway through a swing. Settle from the actual
          // current contact instead of snapping to the planned touchdown point.
          rest(restTarget, 0.025);
          f.target.copy(previous).lerp(restTarget, 1 - Math.exp(-12 * dt));
          f.anchor.copy(f.target); f.from.copy(f.target);
        }
        // Turning can leave an old contact behind the hips. Release it into a short
        // recovery step before it exceeds the leg's horizontal reach.
        rest(restTarget, 0.025);
        delta.copy(f.target).sub(restTarget); delta.y = 0;
        if (delta.length() > 0.29) {
          delta.setLength(0.29);
          f.target.x = restTarget.x + delta.x; f.target.z = restTarget.z + delta.z;
          f.anchor.copy(f.target); f.from.copy(f.target); f.takeoffRoot.copy(r.root.position);
        }
        // A held-up swing must catch up gradually once it clears the riser.
        delta.copy(f.target).sub(previous); delta.y = 0;
        const travel = 8 * dt;
        if (delta.length() > travel && dt > 0) {
          delta.setLength(travel);
          f.target.x = previous.x + delta.x; f.target.z = previous.z + delta.z;
        }
        const angle = s.yaw - f.yaw;
        const yawStep = clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -9 * dt, 9 * dt);
        const nextYaw = f.yaw + yawStep;
        const vertical = (s.grounded ? 3 : 7) * dt;
        const floor = supportHeight(f.target.x, f.target.z, nextYaw);
        if (floor > previous.y + vertical + 1e-5) {
          f.target.x = previous.x; f.target.z = previous.z;
          f.target.y = previous.y + Math.min(floor - previous.y, vertical);
        } else {
          f.target.y = Math.max(floor, clamp(f.target.y, previous.y - vertical, previous.y + vertical));
          f.yaw = nextYaw;
        }
        if (!swinging || !s.grounded) f.anchor.copy(f.target);
        f.swing = s.grounded && swinging;
      }
      // Smooth the visible pelvis across a tread or landing without moving physics.
      const desiredPelvisY = s.y + r.hips.position.y;
      if (!Number.isFinite(pelvisY)) pelvisY = desiredPelvisY;
      const pelvisTravel = (s.grounded ? 3 : 6) * dt;
      pelvisY += clamp(desiredPelvisY - pelvisY, -pelvisTravel, pelvisTravel);
      r.hips.position.y = pelvisY - s.y;
      r.root.updateMatrixWorld(true);
      // Both contacts constrain the pelvis. In particular a rear foot on the lower stair
      // must remain reachable after the controller steps onto the next tread.
      let drop = 0;
      const reach = r.props.hipY - r.props.ankleY - 0.002;
      for (const f of feet) {
        (f.side > 0 ? r.thighL : r.thighR).getWorldPosition(hipWorld);
        footQ.setFromAxisAngle(UP, f.yaw);
        soleOffset.copy(rig.sole).applyQuaternion(footQ);
        ankle.copy(f.target).sub(soleOffset);
        const horizontal = Math.hypot(hipWorld.x - ankle.x, hipWorld.z - ankle.z);
        const allowedY = ankle.y + Math.sqrt(Math.max(0.001, reach * reach - horizontal * horizontal));
        drop = Math.max(drop, hipWorld.y - allowedY);
      }
      r.hips.position.y -= drop;
      pelvisY -= drop;
      r.root.updateMatrixWorld(true);
      for (const f of feet) solve(f.side, f.target, f.yaw);
      wasGrounded = s.grounded;
      r.root.updateMatrixWorld(true);
    },
  };
}
