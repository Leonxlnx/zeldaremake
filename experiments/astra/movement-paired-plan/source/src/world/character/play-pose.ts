/** Stateful paired contacts belong to live Link play only. Reference poses are unchanged. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import { applyPose, type GroundSampler } from './animation';
import type { MotionState } from './locomotion';
import type { Rig } from './rig';
import { createContactCoordinator } from './contact-coordinator';
import type { SolePose } from './contact-pose';
import { createPoseStage } from './pose-stage';
const TAU=Math.PI*2,clamp=MathUtils.clamp,mix=MathUtils.lerp;
export function createPlayPose(rig:Rig,ground:GroundSampler){
  const stage=createPoseStage(rig),r=stage.rig;
  const coordinator=createContactCoordinator(rig,ground,r);
  let wasGrounded=true,transitionTime=1,initialised=false;
  const upperJoints=[r.hips,r.chest,r.neck,r.shoulderL,r.shoulderR,r.elbowL,r.elbowR,...(r.capTail?[r.capTail]:[])];
  const lastUpper=upperJoints.map(j=>j.quaternion.clone());
  const transitionUpper=upperJoints.map(j=>j.quaternion.clone()),desiredUpper=new Quaternion();
  const savedUpper=lastUpper.map(q=>q.clone()),savedTransition=transitionUpper.map(q=>q.clone());
  return {
    reset(){
      coordinator.reset();wasGrounded=true;transitionTime=1;initialised=false;stage.rollback();
      upperJoints.forEach((joint,i)=>{lastUpper[i].copy(joint.quaternion);transitionUpper[i].copy(joint.quaternion);});
    },
    contacts:coordinator.contacts,
    clearance:coordinator,
    update(s:MotionState,t:number,dt=1/120){
      stage.begin();
      const savedTime=transitionTime;
      lastUpper.forEach((q,i)=>savedUpper[i].copy(q));
      transitionUpper.forEach((q,i)=>savedTransition[i].copy(q));
      try {
      if(s.grounded!==wasGrounded){transitionTime=0;transitionUpper.forEach((q,i)=>q.copy(lastUpper[i]));}
      r.root.position.set(s.x,s.y,s.z);
      r.root.rotation.y=initialised?coordinator.snapshot().visualYaw:s.yaw;
      applyPose(r,{gait:'idle',t,phase:0,lookWeight:0});
      const w = s.moveWeight, run = s.runWeight, stair = s.stairWeight;
      const phi = coordinator.phase(s.phase) * TAU, wave = Math.sin(phi);
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

      const airborne=!s.grounded?[r.ankleL,r.ankleR].map(j=>({
        position:j.localToWorld(r.sole.clone()),rotation:j.getWorldQuaternion(new Quaternion()),
      })) as [SolePose,SolePose]:undefined;
      coordinator.update({state:s,hipsLocal:r.hips.position.clone(),hipsRotation:r.hips.quaternion.clone(),airborne,dt,upperTransitionComplete:progress===1});
      } catch(error) {
        transitionTime=savedTime;
        lastUpper.forEach((q,i)=>q.copy(savedUpper[i]));
        transitionUpper.forEach((q,i)=>q.copy(savedTransition[i]));
        stage.rollback();
        throw error;
      }
      stage.commit();
      wasGrounded=s.grounded;initialised=true;
    },
  };
}
