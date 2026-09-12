/** Stateful foot contacts belong to live play only. Reference captures use animation.ts. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import { applyPose, type GroundSampler } from './animation';
import { createLocomotion, getMotionContext, MOVE, strideLength, type MotionState } from './locomotion';
import { createFootSwing, sampleFootSwing, type FootSwing } from './foot-swing';
import type { Rig } from './rig';

const DOWN = new Vector3(0, -1, 0);
const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);
const TAU = Math.PI * 2;
const clamp = MathUtils.clamp;
const mix = MathUtils.lerp;

export function createPlayPose(rig: Rig, ground: GroundSampler) {
  const feet = [1, -1].map((side) => ({
    side, anchor: new Vector3(), from: new Vector3(), to: new Vector3(), target: new Vector3(),
    takeoffRoot: new Vector3(),
    swing: false, initialised: false, yaw: 0, pitch: 0, transitionPitch: 0,
    settling: false, settleTime: 0,
    curve: null as FootSwing | null, velocity: new Vector3(), legacyRecovery: false,
  }));
  const ankle = new Vector3(), local = new Vector3(), upper = new Vector3();
  const forward = new Vector3(), axis = new Vector3(), soleOffset = new Vector3();
  const parentQ = new Quaternion(), footQ = new Quaternion(), pitchQ = new Quaternion(), desiredUpper = new Quaternion();
  const hipWorld = new Vector3(), movingFrom = new Vector3();
  const previous = new Vector3(), restTarget = new Vector3(), delta = new Vector3();
  let wasGrounded = true;
  let pelvisY = NaN;
  let transitionTime = 1;
  let previousSpeed = 0;
  let lastIntent = '';
  let forecast: ReturnType<typeof createLocomotion> | null = null;
  let forecastSurface: NonNullable<ReturnType<typeof getMotionContext>>['surface'] | undefined;
  const landing = new Vector3();
  const upperJoints = [rig.hips, rig.chest, rig.neck, rig.shoulderL, rig.shoulderR, rig.elbowL, rig.elbowR, ...(rig.capTail ? [rig.capTail] : [])];
  const lastUpper = upperJoints.map(j => j.quaternion.clone());
  const transitionUpper = upperJoints.map(j => j.quaternion.clone());
  const reset = () => {
    for (const f of feet) { f.initialised = false; f.pitch = 0; f.transitionPitch = 0; f.settling = false; f.curve = null; f.velocity.set(0, 0, 0); f.legacyRecovery = false; }
    wasGrounded = true; pelvisY = NaN; transitionTime = 1; previousSpeed = 0; lastIntent = '';
  };

  // The rounded sole stays inside this .108 x .172 x .018 m envelope. Check both
  // height levels: pitch can put an upper bevel ahead of the underside at a riser.
  const supportHeight = (x: number, z: number, yaw: number, pitch: number) => {
    const sn = Math.sin(yaw), cs = Math.cos(yaw);
    const sp = Math.sin(pitch), cp = Math.cos(pitch);
    let h = ground(x, z);
    for (const height of [0, 0.018]) for (const ox of [-0.054, 0, 0.054]) for (const localZ of [-0.056, 0.03, 0.116]) {
      const oz = localZ - rig.sole.z;
      const dy = height * cp - oz * sp, dz = height * sp + oz * cp;
      h = Math.max(h, ground(x + cs * ox + sn * dz, z - sn * ox + cs * dz) - dy);
    }
    return h;
  };

  const orientFoot = (yaw: number, pitch: number) =>
    footQ.setFromAxisAngle(UP, yaw).multiply(pitchQ.setFromAxisAngle(RIGHT, pitch));

  const solve = (side: number, target: Vector3, yaw: number, pitch: number) => {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const knee = side > 0 ? rig.kneeL : rig.kneeR;
    const foot = side > 0 ? rig.ankleL : rig.ankleR;
    orientFoot(yaw, pitch);
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
      const deceleration = dt > 0 ? (previousSpeed - s.speed) / dt : 0;
      const accelerating = s.speed > previousSpeed + 0.001;
      const context = getMotionContext(s), held = context?.input;
      const intentKey = held ? `${held.moveX},${held.moveZ},${held.run}` : '';
      const changedIntent = intentKey !== lastIntent;
      lastIntent = intentKey;
      const ordinary = !!context && !!held && Math.hypot(held.moveX, held.moveZ) > 0.05
        && s.stairWeight < 1e-5 && !context.surface.onStairs(s.x, s.z);
      // Invert the controller's known braking response. A deliberate analogue
      // slowdown has a nonzero target; decreasing speed alone is not a stop.
      const brakingGain = -Math.expm1(-MOVE.braking * dt);
      const brakingTarget = brakingGain > 0 ? previousSpeed + (s.speed - previousSpeed) / brakingGain : s.speed;
      previousSpeed = s.speed;
      // Infer late braking from actual velocity, without settling a planted foot
      // during a steady walk, a slow analogue walk or the normal stair gait.
      const forwardSpeed = s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw);
      const stopping = s.grounded && !accelerating && (s.speed === 0 ||
        (brakingTarget < 0.01 && forwardSpeed > s.speed * 0.95 &&
          (s.speed < 0.02 || (s.speed < 1 && deceleration > 0.2))));
      if (!s.grounded || accelerating) for (const f of feet) {
        if (f.settling) {
          f.legacyRecovery = s.grounded;
          f.from.copy(f.target); f.takeoffRoot.set(s.x, s.y, s.z); f.swing = false;
        }
        f.settling = false;
      }
      if (s.grounded !== wasGrounded) {
        transitionTime = 0;
        transitionUpper.forEach((q, i) => q.copy(lastUpper[i]));
        // Preserve the descending feet instead of restarting at a mid-stride target.
        for (const f of feet) {
          f.transitionPitch = f.pitch;
          f.curve = null; f.legacyRecovery = false;
          f.anchor.copy(f.target); f.from.copy(f.target); f.swing = false;
          f.takeoffRoot.set(s.x, s.y, s.z);
        }
      }
      r.root.position.set(s.x, s.y, s.z);
      r.root.rotation.y = s.yaw;
      applyPose(r, { gait: 'idle', t, phase: 0, lookWeight: 0 });
      const w = s.moveWeight, run = s.runWeight, stair = s.stairWeight;
      const phi = s.phase * TAU, wave = Math.sin(phi);
      const duty = mix(0.52, 0.36, run);
      // Arms pass neutral with the feet at mid-stance/mid-swing; positive shoulder X
      // swings backward as the same-side foot reaches forward for touchdown.
      const armWave = Math.cos(phi + Math.PI * (0.5 - duty));
      const arm = mix(0.32, 0.66, run) * w;
      r.hips.position.x *= 1 - w;
      r.hips.rotation.set(0, 0.045 * wave * w, 0.022 * wave * w);
      r.chest.rotation.set(0.025 + (0.07 + 0.13 * run + 0.07 * stair) * w, -0.035 * wave * w, 0);
      r.chest.position.y += 0.004 * Math.cos(phi * 2) * w;
      r.shoulderL.rotation.set(arm * armWave, 0, 0.1);
      r.shoulderR.rotation.set(-arm * armWave, 0, -0.1);
      r.elbowL.rotation.x = r.elbowR.rotation.x = -mix(0.18, 1.1, run) - 0.16 * w;
      r.neck.rotation.x = -0.04 * w;
      if (r.capTail) r.capTail.rotation.set(0.02 + 0.055 * w * Math.cos(phi * 2 - 0.7), 0, 0.025 * wave * w);

      if (!s.grounded) {
        // Retain a small asymmetric tuck at the apex. Extend for landing only
        // as downward motion brings the body near the upcoming ground.
        const rising = clamp(s.vy / 4.8, 0, 1);
        const clearance = s.y - ground(s.x + s.vx * 0.1, s.z + s.vz * 0.1);
        const prepare = clamp(-s.vy / 2.5, 0, 1) * (1 - MathUtils.smoothstep(clearance, 0.1, 0.65));
        const tuck = 1 - prepare;
        r.chest.rotation.x = 0.10 + 0.05 * tuck + 0.03 * rising;
        r.thighL.rotation.x = mix(-0.20, -0.52 - 0.10 * rising, tuck);
        r.thighR.rotation.x = mix(-0.12, -0.33 - 0.07 * rising, tuck);
        r.kneeL.rotation.x = mix(0.30, 0.88 + 0.20 * rising, tuck);
        r.kneeR.rotation.x = mix(0.22, 0.64 + 0.18 * rising, tuck);
        r.ankleL.rotation.x = -(r.thighL.rotation.x + r.kneeL.rotation.x);
        r.ankleR.rotation.x = -(r.thighR.rotation.x + r.kneeR.rotation.x);
        // Arms follow the jump itself, then lower as the existing landing
        // preparation extends the legs. Ground speed must not lock the elbows
        // in a sprint curl for the entire airborne interval.
        const armRecovery = prepare * prepare * (3 - 2 * prepare);
        const shoulder = mix(-0.55 - 0.3 * rising, -0.40, armRecovery);
        r.shoulderL.rotation.set(shoulder, 0, 0.22);
        r.shoulderR.rotation.set(shoulder, 0, -0.22);
        r.elbowL.rotation.x = r.elbowR.rotation.x = -mix(0.58 + 0.10 * rising, 0.50, armRecovery);
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
      const stride = strideLength(run, stair);
      const lead = Math.min(0.245, stride * duty * 0.5) * w;
      if (stopping && !feet.some(f => f.settling)) {
        // A short final step starts from the actual sole. Keep the other foot
        // anchored instead of pulling both planted feet toward idle together.
        let next: typeof feet[number] | undefined;
        let furthest = 0.025;
        for (const f of feet) {
          if (!f.initialised) continue;
          restTarget.set(f.side * (r.props.hipHalfWidth + 0.018), 0, 0.025)
            .applyAxisAngle(UP, s.yaw).add(r.root.position);
          restTarget.y = supportHeight(restTarget.x, restTarget.z, f.yaw, f.pitch);
          const distance = f.target.distanceTo(restTarget);
          if (distance > 0.025 && (!next || (f.swing && !next.swing) ||
            (f.swing === next.swing && distance > furthest))) { next = f; furthest = distance; }
        }
        if (next) { next.settling = true; next.settleTime = 0; next.from.copy(next.target); next.curve = null; }
      }
      const settling = stopping || feet.some(f => f.settling);
      for (const f of feet) {
        previous.copy(f.target);
        const previousPitch = f.pitch;
        // Terrain, stopping, or an unknown caller state returns ownership to
        // the existing gait from the last accepted sole, never an old endpoint.
        const useLegacyGait = () => {
          f.curve = null; f.legacyRecovery = false;
          f.anchor.copy(f.target); f.from.copy(f.target);
          f.takeoffRoot.copy(r.root.position); f.swing = false;
        };
        if (f.curve && !ordinary) useLegacyGait();
        const phase = ((s.phase + (f.side > 0 ? 0 : 0.5)) % 1 + 1) % 1;
        const phaseSwinging = !settling && w > 0.05 && phase >= duty;
        // An interrupted stopping step keeps the existing recovery until this
        // foot's next actual lift-off; it is not a new flat sliding swing.
        if (!phaseSwinging) f.legacyRecovery = false;
        // A stored curve owns its release-to-contact interval. A phase crossing
        // cannot freeze an unfinished curve and leave a stale completion behind.
        let swinging = !settling && (phaseSwinging || f.curve !== null);
        let sampledCurve = false;
        let completingCurve = false;
        const swingU = clamp((phase - duty) / (1 - duty), 0, 1);
        // A small toe-down / toe-up recovery, with zero value and slope at each endpoint.
        const desiredPitch = phaseSwinging ? mix(0.10, 0.20, run) * Math.sin(TAU * swingU) * Math.sin(Math.PI * swingU) * w : 0;
        f.pitch = s.grounded ? (swinging ? mix(f.transitionPitch, desiredPitch, transition) : 0)
          : f.transitionPitch * (1 - transition);
        // A foot held at a riser may resume after its phase has advanced. Catch the angle
        // up gradually; normal walk/run recovery is already slower than this limit.
        if (s.grounded && (swinging || settling) && phase >= duty) {
          f.pitch = previousPitch + clamp(f.pitch - previousPitch, -6 * dt, 6 * dt);
        }
        const lateral = f.side * (r.props.hipHalfWidth + 0.018);
        const rest = (out: Vector3, z: number) => {
          out.set(lateral, 0, z).applyAxisAngle(UP, s.yaw).add(r.root.position);
          out.y = supportHeight(out.x, out.z, f.yaw, f.pitch);
        };
        if (!f.initialised) {
          f.yaw = s.yaw;
          rest(f.anchor, 0.025);
          f.from.copy(f.anchor); f.to.copy(f.anchor); f.target.copy(f.anchor);
          previous.copy(f.target);
          f.swing = false; f.initialised = true;
        }
        if (s.grounded && progress === 1 && ordinary && !f.legacyRecovery && swinging && (!f.swing || (changedIntent && f.curve))) {
          if (!forecast || forecastSurface !== context!.surface) {
            forecastSurface = context!.surface;
            forecast = createLocomotion(forecastSurface, s.x, s.z, s.yaw);
          }
          forecast.reset(s.x, s.z, s.yaw);
          Object.assign(forecast.state, s);
          // A forecast is a separate controller with its own input association.
          // Its future assumes no new jump press; observed flight clears the curve.
          const intent = { ...held!, jump: false };
          const endPhase = Math.floor(s.phase + (f.side > 0 ? 0 : 0.5)) + 1;
          let duration = 0, ordinaryWindow = true;
          while (duration < 8 && forecast.state.phase + (f.side > 0 ? 0 : 0.5) < endPhase) {
            forecast.update(MOVE.fixedStep, intent); duration += MOVE.fixedStep;
            if (!forecast.state.grounded || forecast.state.stairWeight > 1e-5 || forecast.state.speed === 0) {
              ordinaryWindow = false; break;
            }
          }
          // Choose the existing stair/cliff/blocked-motion mode before building
          // a curve; it is not entered after a failed trajectory-rate check.
          if (ordinaryWindow) {
            duration = Math.max(MOVE.fixedStep, duration);
            const future = forecast.state;
            const futureDuty = mix(0.52, 0.36, future.runWeight);
            const futureLead = Math.min(0.245, strideLength(future.runWeight, future.stairWeight) * futureDuty * 0.5) * future.moveWeight;
            landing.set(lateral, 0, futureLead + 0.025).applyAxisAngle(UP, future.yaw);
            landing.x += future.x; landing.z += future.z;
            landing.y = supportHeight(landing.x, landing.z, future.yaw, 0);
            f.curve = createFootSwing(s.time - dt, duration + dt, f.target, f.velocity, landing,
              0.07 + 0.10 * future.runWeight, f.curve);
            f.legacyRecovery = false;
            f.from.copy(f.target); f.to.copy(landing); f.takeoffRoot.copy(r.root.position);
          } else if (f.curve) {
            // Changed intent can turn an otherwise ordinary swing toward stairs,
            // an obstruction, or a ledge. The old forecast no longer owns it.
            useLegacyGait(); swinging = phaseSwinging;
          }
        }
        if (s.grounded && swinging && !f.swing && !f.curve) {
          f.from.copy(f.target); f.takeoffRoot.copy(r.root.position);
          rest(f.to, lead + 0.025);
        }
        if (!s.grounded) {
          // Approach the authored airborne pose through continuous world-space targets.
          (f.side > 0 ? r.ankleL : r.ankleR).localToWorld(f.target.copy(r.sole));
        } else if (f.settling) {
          f.settleTime += dt;
          const u = clamp(f.settleTime / 0.20, 0, 1);
          rest(restTarget, 0.025);
          f.target.lerpVectors(f.from, restTarget, u * u * (3 - 2 * u));
          f.target.y += 0.025 * Math.sin(Math.PI * u);
        } else if (swinging && f.curve) {
          sampleFootSwing(f.curve, s.time, f.target, f.velocity);
          sampledCurve = true;
          completingCurve = s.time >= f.curve.start + f.curve.duration - 1e-10;
        } else if (swinging) {
          // Preserve the existing jump/landing transition. The next actual
          // ordinary lift-off starts a stored curve after that transition ends.
          rest(f.to, lead + 0.025);
          const u = swingU, ease = u * u * (3 - 2 * u);
          movingFrom.copy(f.from);
          movingFrom.x += s.x - f.takeoffRoot.x;
          movingFrom.z += s.z - f.takeoffRoot.z;
          f.target.lerpVectors(movingFrom, f.to, ease);
          const lift = (0.07 + 0.10 * run + 0.12 * stair) * Math.sin(Math.PI * u);
          f.target.y = Math.max(f.target.y, supportHeight(f.target.x, f.target.z, f.yaw, f.pitch)) + lift;
        } else {
          if (f.swing) f.anchor.copy(f.target);
          f.target.copy(f.anchor); f.velocity.set(0, 0, 0);
          f.target.y = supportHeight(f.target.x, f.target.z, f.yaw, f.pitch);
        }
        landing.copy(f.target);
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
        const floor = supportHeight(f.target.x, f.target.z, nextYaw, f.pitch);
        if (floor > previous.y + vertical + 1e-5) {
          f.target.x = previous.x; f.target.z = previous.z;
          f.target.y = previous.y + Math.min(floor - previous.y, vertical);
          // Hold orientation as well as position until the toe/bevel clears the riser.
          // Rotating a held foot can otherwise introduce a new contact across the step edge.
          f.pitch = previousPitch;
        } else {
          f.target.y = Math.max(floor, clamp(f.target.y, previous.y - vertical, previous.y + vertical));
          f.yaw = nextYaw;
        }
        if (f.settling && f.settleTime >= 0.20 && f.target.distanceTo(restTarget) < 0.012) f.settling = false;
        // A downstream support/riser correction changes the accepted trajectory.
        // Keep its observed velocity with that accepted position for any replan.
        if (dt > 0 && (!sampledCurve || f.target.distanceToSquared(landing) > 1e-18)) {
          f.velocity.copy(f.target).sub(previous).divideScalar(dt);
        }
        if (completingCurve && f.curve && f.target.distanceToSquared(f.curve.to) < 1e-16) {
          f.anchor.copy(f.target); f.curve = null; f.velocity.set(0, 0, 0);
          f.swing = false;
        } else {
          if (!swinging || !s.grounded) f.anchor.copy(f.target);
          f.swing = s.grounded && swinging;
        }
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
        orientFoot(f.yaw, f.pitch);
        soleOffset.copy(rig.sole).applyQuaternion(footQ);
        ankle.copy(f.target).sub(soleOffset);
        const horizontal = Math.hypot(hipWorld.x - ankle.x, hipWorld.z - ankle.z);
        const allowedY = ankle.y + Math.sqrt(Math.max(0.001, reach * reach - horizontal * horizontal));
        drop = Math.max(drop, hipWorld.y - allowedY);
      }
      r.hips.position.y -= drop;
      pelvisY -= drop;
      r.root.updateMatrixWorld(true);
      for (const f of feet) solve(f.side, f.target, f.yaw, f.pitch);
      wasGrounded = s.grounded;
      r.root.updateMatrixWorld(true);
    },
  };
}
