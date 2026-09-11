/** One next ordinary body endpoint under unchanged unobstructed controller input.
 * This predicts a planning domain; it never advances or edits physical state.
 */
import { Euler, MathUtils } from 'three';
import { MOVE, strideLength, type MotionState } from './locomotion';
import { cloneRequest, type PairRequest } from './contact-pose';
import type { GroundSampler } from './animation';
const clamp=MathUtils.clamp,TAU=Math.PI*2;
export interface BodyForecastInput {
  state:MotionState;previousPhysical:MotionState;previous:PairRequest;current:PairRequest;
  dt:number;ground:GroundSampler;upperTransitionComplete:boolean;
}
export function forecastOrdinaryBody(input:BodyForecastInput){
  const {state:s,previousPhysical:physical,current:p,dt,ground}=input;
  if(!input.upperTransitionComplete||!s.grounded||!physical.grounded)
    return {status:'unavailable' as const,reason:'upper-or-ground-transition'};
  if(!Number.isFinite(dt)||dt<=0)return {status:'unavailable' as const,reason:'invalid-duration'};
  // Preserve the existing branch ambiguity and zero-snap exclusions exactly.
  const zeroTransition=(s.vx===0&&physical.vx!==0)||(s.vz===0&&physical.vz!==0);
  const branches=[MOVE.acceleration,MOVE.braking].flatMap(response=>{
    const retain=Math.exp(-response*dt),gain=1-retain;
    const targetX=(s.vx-physical.vx*retain)/gain,targetZ=(s.vz-physical.vz*retain)/gain;
    const desiredSpeed=Math.hypot(targetX,targetZ);
    const actualResponse=desiredSpeed<physical.speed-128*Number.EPSILON?MOVE.braking:MOVE.acceleration;
    if(actualResponse!==response||desiredSpeed>MOVE.runSpeed+1e-9)return [];
    const nextResponse=desiredSpeed<s.speed-128*Number.EPSILON?MOVE.braking:MOVE.acceleration;
    const factor=nextResponse===response?retain:retain*(1-Math.exp(-nextResponse*dt))/gain;
    const vx=s.vx+(s.vx-physical.vx)*factor,vz=s.vz+(s.vz-physical.vz)*factor;
    const snapRisk=(vx!==0&&Math.abs(vx)<.005&&Math.abs(targetX)<1e-9)
      ||(vz!==0&&Math.abs(vz)<.005&&Math.abs(targetZ)<1e-9);
    return snapRisk?[]:[{response,nextResponse,vx,vz,desiredSpeed}];
  });
  const continuation=branches.length===1&&!zeroTransition?branches[0]:null;
  const response=continuation?.response??null,vx=continuation?.vx??NaN,vz=continuation?.vz??NaN;
  const speed=Math.hypot(vx,vz),x=s.x+vx*dt,z=s.z+vz*dt,y=continuation?ground(x,z):NaN;
  const stairRetain=Math.exp(-12*dt);
  const stairTarget=(s.stairWeight-physical.stairWeight*stairRetain)/(1-stairRetain);
  const available=[vx,vz,speed,x,z,y,stairTarget].every(Number.isFinite)&&speed<=MOVE.runSpeed+1e-9
    &&Math.abs(y-s.y)<=MOVE.stepHeight&&stairTarget>=-1e-9&&stairTarget<=1+1e-9;
  if(!available)return {status:'unavailable' as const,reason:'controller-domain',speed,groundRise:y-s.y,stairTarget,branches,zeroTransition};
  const mt=clamp(speed/.45,0,1),rt=clamp((speed-MOVE.walkSpeed)/(MOVE.runSpeed-MOVE.walkSpeed),0,1);
  const w=mt+(s.moveWeight-mt)*Math.exp(-14*dt),r=rt+(s.runWeight-rt)*Math.exp(-10*dt);
  const st=speed>.05?stairTarget:0,stairs=st+(s.stairWeight-st)*stairRetain;
  const phase=s.phase+speed*dt/strideLength(r,stairs),wave=Math.sin(phase*TAU);
  const predicted=cloneRequest(p);predicted.root.set(x,y,z);
  predicted.visualYaw+=Math.atan2(Math.sin(p.visualYaw-input.previous.visualYaw),Math.cos(p.visualYaw-input.previous.visualYaw));
  predicted.hipsLocal.x=.012*Math.sin((s.time+dt)*.45)*(1-w);
  predicted.hipsRotation.setFromEuler(new Euler(0,.045*wave*w,.022*wave*w));
  return {status:'clear' as const,request:predicted,response,predictedSpeed:speed,
    domain:'unchanged unobstructed controller response and turn rate' as const};
}
