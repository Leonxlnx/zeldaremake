/** Ordinary body interpolation with analytic velocities in the same accepted-time frame. */
import { Quaternion, Vector3 } from 'three';
import { cloneRequest, type PairRequest, type SolePose } from './contact-pose';

const UP = new Vector3(0, 1, 0);
export interface SoleMotion extends SolePose { velocity: Vector3; angularVelocity: Vector3 }

/** World-axis angular displacement taking from to to, choosing the short quaternion arc. */
export function rotationVector(from: Quaternion, to: Quaternion): Vector3 {
  const delta = to.clone().multiply(from.clone().invert()).normalize();
  if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
  const sine = Math.hypot(delta.x, delta.y, delta.z);
  if (sine < 1e-15) return new Vector3();
  return new Vector3(delta.x, delta.y, delta.z)
    .multiplyScalar(2 * Math.atan2(sine, delta.w) / sine);
}

export function advanceRotation(from: Quaternion, angularVelocity: Vector3, time: number): Quaternion {
  const speed = angularVelocity.length();
  return speed === 0 ? from.clone() : new Quaternion()
    .setFromAxisAngle(angularVelocity.clone().divideScalar(speed), speed * time).multiply(from);
}

/** Height is supplied separately by the one selected Hermite. This function never fits it. */
export function createOrdinaryBodyCurve(from: PairRequest, to: PairRequest, dt: number,
  hipHalfWidth: number, soleOffset: Vector3) {
  const yawRate = Math.atan2(Math.sin(to.visualYaw - from.visualYaw), Math.cos(to.visualYaw - from.visualYaw)) / dt;
  const rootVelocity = to.root.clone().sub(from.root).divideScalar(dt);
  const localVelocity = to.hipsLocal.clone().sub(from.hipsLocal).divideScalar(dt); localVelocity.y = 0;
  const localOmega = rotationVector(from.hipsRotation, to.hipsRotation).divideScalar(dt);
  function at(time: number, soles: [SoleMotion, SoleMotion]) {
    const u = time / dt, point = cloneRequest(from);
    point.root.addScaledVector(rootVelocity, time); point.visualYaw += yawRate * time;
    point.hipsLocal.addScaledVector(localVelocity, time);
    point.hipsRotation = advanceRotation(from.hipsRotation, localOmega, time);
    point.soles = soles.map(s => ({ position: s.position.clone(), rotation: s.rotation.clone() })) as PairRequest['soles'];
    if (point.poles && to.poles) point.poles.forEach((pole, i) => {
      const q = new Quaternion().setFromUnitVectors(pole.clone().normalize(), to.poles![i].clone().normalize());
      pole.applyQuaternion(new Quaternion().slerp(q, u)).normalize();
    });
    const rootRotation = new Quaternion().setFromAxisAngle(UP, point.visualYaw);
    const hipsRotation = rootRotation.clone().multiply(point.hipsRotation);
    const omega = localOmega.clone().applyQuaternion(rootRotation).addScaledVector(UP, yawRate);
    const localOffset = new Vector3(point.hipsLocal.x, 0, point.hipsLocal.z).applyQuaternion(rootRotation);
    const offsetVelocity = localVelocity.clone().applyQuaternion(rootRotation)
      .add(new Vector3().crossVectors(UP.clone().multiplyScalar(yawRate), localOffset));
    const hipBases:Vector3[]=[],hipVelocityBases:Vector3[]=[];
    const legs = soles.map((sole, i) => {
      const lateral = new Vector3((i === 0 ? 1 : -1) * hipHalfWidth, 0, 0).applyQuaternion(hipsRotation);
      const hipBase = point.root.clone().add(localOffset).add(lateral);
      const hipVelocity = rootVelocity.clone().add(offsetVelocity).add(new Vector3().crossVectors(omega, lateral));
      // World pelvis height is supplied separately. Preserve each horizontal
      // body point and velocity while removing the root's vertical component.
      hipBases.push(hipBase.clone().addScaledVector(UP,-point.root.y));
      hipVelocityBases.push(hipVelocity.clone().addScaledVector(UP,-rootVelocity.y));
      const rotatedOffset = soleOffset.clone().applyQuaternion(sole.rotation);
      const ankle = sole.position.clone().sub(rotatedOffset);
      const ankleVelocity = sole.velocity.clone().sub(new Vector3().crossVectors(sole.angularVelocity, rotatedOffset));
      const d = hipBase.sub(ankle), v = hipVelocity.sub(ankleVelocity);
      return { horizontalSq: d.x * d.x + d.z * d.z, horizontalDot: d.x * v.x + d.z * v.z,
        verticalOffset: d.y, verticalVelocityOffset: v.y };
    });
    return { request: point, legs, hips:{positions:hipBases as [Vector3,Vector3],velocities:hipVelocityBases as [Vector3,Vector3]} };
  }
  return { at };
}
