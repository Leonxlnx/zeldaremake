/** Pure C1 ordinary foot yaw/pitch curves; callers own compatible pose, timing and targets. */
import { Quaternion, Vector3 } from 'three';

export interface OrdinaryOrientationState {
  yaw:number; pitch:number; yawVelocity:number; pitchVelocity:number;
}
export interface OrdinaryOrientationInput {
  start:OrdinaryOrientationState; target:OrdinaryOrientationState;
  duration:number; dt:number; yawLimit:number; pitchLimit:number;
}
export interface OrdinaryOrientationSample extends OrdinaryOrientationState {
  rotation:Quaternion; angularVelocity:Vector3;
}
export interface OrientationVelocityExtrema {
  minVelocity:number; maxVelocity:number; maxAbsVelocity:number;
  /** Absolute elapsed times where an endpoint or quadratic derivative extremum is checked. */
  criticalTimes:number[];
}
export interface OrdinaryOrientationDiagnostics {
  duration:number; consumedDuration:number; holdDuration:number;
  unwrappedTarget:OrdinaryOrientationState;
  yaw:OrientationVelocityExtrema; pitch:OrientationVelocityExtrema;
  scope:'exact velocity extrema over the consumed scalar curves';
}
export type OrdinaryOrientationResult =
  | {status:'clear';diagnostics:OrdinaryOrientationDiagnostics;
      sample:(time:number)=>OrdinaryOrientationSample|null}
  | {status:'infeasible';reason:string;diagnostics?:OrdinaryOrientationDiagnostics};

const UP=new Vector3(0,1,0),RIGHT=new Vector3(1,0,0);
const finite=Number.isFinite;
const validState=(s:OrdinaryOrientationState)=>!!s&&[s.yaw,s.pitch,s.yawVelocity,s.pitchVelocity].every(finite);
const rounding=(a:number,b:number)=>64*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));

function scalar(start:number,startVelocity:number,end:number,endVelocity:number,T:number,consumed:number){
  if(T===0)return {at:()=>({value:start,velocity:0}),extrema:{minVelocity:0,maxVelocity:0,maxAbsVelocity:0,criticalTimes:[0]}};
  if(endVelocity===startVelocity&&end===start+T*startVelocity){
    return {at:(time:number)=>({value:time>=T?end:start+time*startVelocity,velocity:startVelocity}),
      extrema:{minVelocity:startVelocity,maxVelocity:startVelocity,maxAbsVelocity:Math.abs(startVelocity),criticalTimes:consumed===0?[0]:[0,consumed]}};
  }
  const c0=start,c1=T*startVelocity,c2=3*(end-start)-T*(2*startVelocity+endVelocity),c3=2*(start-end)+T*(startVelocity+endVelocity);
  if(![c0,c1,c2,c3,2*c2,3*c3].every(finite))return null;
  const at=(time:number)=>{
    if(time===0)return {value:start,velocity:startVelocity};
    if(time>=T)return {value:end,velocity:endVelocity};
    const u=time/T;
    return {value:((c3*u+c2)*u+c1)*u+c0,velocity:(c1+u*(2*c2+3*c3*u))/T};
  };
  const criticalTimes=consumed===0?[0]:[0,consumed];
  if(c3!==0){const t=-c2*T/(3*c3);if(t>0&&t<consumed)criticalTimes.push(t);}
  criticalTimes.sort((a,b)=>a-b);
  const velocities=criticalTimes.map(t=>at(t).velocity);
  if(!velocities.every(finite))return null;
  const minVelocity=Math.min(...velocities),maxVelocity=Math.max(...velocities);
  return {at,extrema:{minVelocity,maxVelocity,maxAbsVelocity:Math.max(Math.abs(minVelocity),Math.abs(maxVelocity)),criticalTimes}};
}

export function planOrdinaryOrientation(input:OrdinaryOrientationInput):OrdinaryOrientationResult {
  const {start,target,duration:T,dt,yawLimit,pitchLimit}=input;
  if(!validState(start)||!validState(target)||![T,dt,yawLimit,pitchLimit].every(finite)
    ||T<0||dt<0||yawLimit<0||pitchLimit<0)return {status:'infeasible',reason:'invalid-input'};
  const rawDifference=target.yaw-start.yaw;
  if(!finite(rawDifference))return {status:'infeasible',reason:'nonfinite-yaw-difference'};
  const yawDifference=Math.atan2(Math.sin(rawDifference),Math.cos(rawDifference));
  const unwrappedTarget={...target,yaw:start.yaw+yawDifference};
  if(!validState(unwrappedTarget))return {status:'infeasible',reason:'nonfinite-unwrapped-target'};
  if(dt>T&&(target.yawVelocity!==0||target.pitchVelocity!==0))
    return {status:'infeasible',reason:'nonzero-contact-hold-velocity'};
  if(T===0&&(yawDifference!==0||target.pitch!==start.pitch||start.yawVelocity!==0||start.pitchVelocity!==0
    ||target.yawVelocity!==0||target.pitchVelocity!==0))return {status:'infeasible',reason:'zero-duration-motion'};
  const consumed=Math.min(dt,T),hold=Math.max(0,dt-T);
  const yaw=scalar(start.yaw,start.yawVelocity,unwrappedTarget.yaw,target.yawVelocity,T,consumed);
  const pitch=scalar(start.pitch,start.pitchVelocity,target.pitch,target.pitchVelocity,T,consumed);
  if(!yaw||!pitch)return {status:'infeasible',reason:'nonfinite-curve'};
  const diagnostics:OrdinaryOrientationDiagnostics={duration:T,consumedDuration:consumed,holdDuration:hold,
    unwrappedTarget,yaw:yaw.extrema,pitch:pitch.extrema,scope:'exact velocity extrema over the consumed scalar curves'};
  if(yaw.extrema.maxAbsVelocity>yawLimit+rounding(yaw.extrema.maxAbsVelocity,yawLimit))
    return {status:'infeasible',reason:'yaw-rate',diagnostics};
  if(pitch.extrema.maxAbsVelocity>pitchLimit+rounding(pitch.extrema.maxAbsVelocity,pitchLimit))
    return {status:'infeasible',reason:'pitch-rate',diagnostics};
  // Endpoint holds are included in the diagnostics; their velocity is exactly zero.
  if(hold>0){
    for(const extrema of[yaw.extrema,pitch.extrema]){
      extrema.minVelocity=Math.min(0,extrema.minVelocity);extrema.maxVelocity=Math.max(0,extrema.maxVelocity);
      if(extrema.criticalTimes.at(-1)!==dt)extrema.criticalTimes.push(dt);
    }
  }
  return {status:'clear',diagnostics,sample(time){
    if(!finite(time)||time<0||time>dt)return null;
    const y=yaw.at(Math.min(time,T)),p=pitch.at(Math.min(time,T));
    const yawRotation=new Quaternion().setFromAxisAngle(UP,y.value);
    const rotation=yawRotation.clone().multiply(new Quaternion().setFromAxisAngle(RIGHT,p.value));
    const angularVelocity=RIGHT.clone().applyQuaternion(yawRotation).multiplyScalar(p.velocity).addScaledVector(UP,y.velocity);
    return {yaw:y.value,pitch:p.value,yawVelocity:y.velocity,pitchVelocity:p.velocity,rotation,angularVelocity};
  }};
}

/** Fit a soft, ordinary swing target inside the same exact velocity domain.
 * Positions and velocities at the start are immutable. Hard contact targets
 * must use planOrdinaryOrientation directly; they cannot drift during a hold.
 */
export function fitOrdinaryOrientation(input:OrdinaryOrientationInput){
  if(input.duration!==input.dt||input.duration<=0||input.yawLimit*input.duration>=Math.PI)
    return {status:'infeasible' as const,reason:'soft-target-outside-single-yaw-branch'};
  if(Math.abs(input.start.yawVelocity)>input.yawLimit||Math.abs(input.start.pitchVelocity)>input.pitchLimit)
    return {status:'infeasible' as const,reason:'incoming-orientation-rate'};
  const desired=planOrdinaryOrientation(input);
  const interior=(result:OrdinaryOrientationResult)=>result.status==='clear'
    &&result.diagnostics.yaw.maxAbsVelocity<=input.yawLimit&&result.diagnostics.pitch.maxAbsVelocity<=input.pitchLimit;
  if(interior(desired))return {...desired,targetFraction:1,requestedTarget:{...input.target}};
  if(desired.status!=='clear'&&desired.reason!=='yaw-rate'&&desired.reason!=='pitch-rate')return desired;
  if(input.duration!==input.dt||input.duration<=0)return {status:'infeasible' as const,reason:'soft-target-requires-full-moving-interval'};
  const start=input.start;
  const continuation={yaw:start.yaw+start.yawVelocity*input.duration,pitch:start.pitch+start.pitchVelocity*input.duration,
    yawVelocity:start.yawVelocity,pitchVelocity:start.pitchVelocity};
  const target={...input.target,yaw:start.yaw+Math.atan2(Math.sin(input.target.yaw-start.yaw),Math.cos(input.target.yaw-start.yaw))};
  const targetAt=(fraction:number)=>({
    yaw:continuation.yaw+(target.yaw-continuation.yaw)*fraction,
    pitch:continuation.pitch+(target.pitch-continuation.pitch)*fraction,
    yawVelocity:continuation.yawVelocity+(target.yawVelocity-continuation.yawVelocity)*fraction,
    pitchVelocity:continuation.pitchVelocity+(target.pitchVelocity-continuation.pitchVelocity)*fraction,
  });
  let fitted=planOrdinaryOrientation({...input,target:continuation});
  if(fitted.status!=='clear')return {status:'infeasible' as const,reason:'incoming-orientation-rate',detail:fitted};
  // The Hermite velocity is affine in target position/derivative. Its pointwise
  // absolute-rate constraints are convex, so this feasible ray is an interval.
  let lower=0,upper=1;
  for(let iteration=0;iteration<56;iteration++){
    const middle=(lower+upper)/2;if(middle===lower||middle===upper)break;
    const trial=planOrdinaryOrientation({...input,target:targetAt(middle)});
    if(trial.status==='clear'&&interior(trial)){lower=middle;fitted=trial;}else upper=middle;
  }
  return {...fitted,targetFraction:lower,requestedTarget:{...input.target}};
}
