/** Pure height/contact math. Geometry intervals describe one request, not a moving-root sweep. */
import { Quaternion, Vector3 } from 'three';
import type { PairRequest } from './contact-pose';

export interface HeightState { height:number; velocity:number }
export interface HeightInterval { min:number; max:number }
export interface FlexRange { min:number; max:number }
export interface HeightGeometry { hipHalfWidth:number; a:number; b:number; sole:Vector3 }
export interface LegHeightInterval extends HeightInterval {
  side:'left'|'right'; horizontalDistance:number; ankleY:number; hipOffsetY:number;
  distanceMin:number; distanceMax:number;
}
export type SharedHeightResult =
  | {status:'feasible'; min:number; max:number; legs:[LegHeightInterval,LegHeightInterval]}
  | {status:'infeasible'; reason:string; side?:'left'|'right'; legs?:LegHeightInterval[]};
export interface HeightExtrema { minHeight:number; maxHeight:number; maxAbsVelocity:number }
export type HeightAdvanceResult =
  | ({status:'accepted'; state:HeightState}&HeightExtrema)
  | {status:'infeasible'; reason:string; candidate?:HeightState; extrema?:HeightExtrema};

const finiteVector=(v:Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
const unitQuaternion=(q:Quaternion)=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z)&&Number.isFinite(q.w)&&Math.abs(q.lengthSq()-1)<=1e-8;
const finiteState=(s:HeightState)=>Number.isFinite(s.height)&&Number.isFinite(s.velocity);

/** Exact local pelvis-Y intervals for a hip above its ankle. Flex is in [0, pi].
 * This selects the upper vertical distance branch; pole singularity, knee side,
 * full-body geometry, and the PairIK solver's own reach reserve remain separate gates.
 */
export function solveSharedHeight(request:PairRequest, geometry:HeightGeometry,
  flex:readonly [FlexRange,FlexRange]):SharedHeightResult {
  const {a,b,hipHalfWidth,sole}=geometry;
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||!Number.isFinite(hipHalfWidth)||hipHalfWidth<0||!finiteVector(sole))
    return {status:'infeasible',reason:'invalid-geometry'};
  if(!finiteVector(request.root)||!finiteVector(request.hipsLocal)||!Number.isFinite(request.visualYaw)||!unitQuaternion(request.hipsRotation))
    return {status:'infeasible',reason:'invalid-request'};
  const rootQ=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),request.visualYaw);
  const hipsQ=rootQ.clone().multiply(request.hipsRotation);
  const lateralOffset=new Vector3(request.hipsLocal.x,0,request.hipsLocal.z).applyQuaternion(rootQ);
  const legs:LegHeightInterval[]=[];
  for(let i=0;i<2;i++) {
    const side=i===0?'left':'right',range=flex[i],foot=request.soles[i];
    if(!Number.isFinite(range.min)||!Number.isFinite(range.max)||range.min<0||range.max>Math.PI||range.min>range.max)
      return {status:'infeasible',reason:'invalid-flex-range',side};
    if(!finiteVector(foot.position)||!unitQuaternion(foot.rotation))return {status:'infeasible',reason:'invalid-sole',side};
    const hipOffset=new Vector3((i===0?1:-1)*hipHalfWidth,0,0).applyQuaternion(hipsQ).add(lateralOffset);
    const ankle=foot.position.clone().sub(sole.clone().applyQuaternion(foot.rotation));
    const horizontalSq=(request.root.x+hipOffset.x-ankle.x)**2+(request.root.z+hipOffset.z-ankle.z)**2;
    // Half-angle form stays nonnegative at the folded limit, including equal links.
    const distanceMinSq=(a-b)**2+4*a*b*Math.cos(range.max*.5)**2;
    const distanceMaxSq=(a-b)**2+4*a*b*Math.cos(range.min*.5)**2;
    if(!Number.isFinite(horizontalSq)||!Number.isFinite(distanceMaxSq))return {status:'infeasible',reason:'nonfinite-distance',side};
    if(horizontalSq>distanceMaxSq)return {status:'infeasible',reason:'horizontal-reach',side,legs};
    const base=ankle.y-request.root.y-hipOffset.y;
    const min=base+Math.sqrt(Math.max(0,distanceMinSq-horizontalSq));
    const max=base+Math.sqrt(Math.max(0,distanceMaxSq-horizontalSq));
    if(!Number.isFinite(min)||!Number.isFinite(max))return {status:'infeasible',reason:'nonfinite-height',side};
    legs.push({side,min,max,horizontalDistance:Math.sqrt(horizontalSq),ankleY:ankle.y,hipOffsetY:hipOffset.y,
      distanceMin:Math.sqrt(distanceMinSq),distanceMax:Math.sqrt(distanceMaxSq)});
  }
  const min=Math.max(legs[0].min,legs[1].min),max=Math.min(legs[0].max,legs[1].max);
  if(min>max)return {status:'infeasible',reason:'disjoint-height-intervals',legs};
  return {status:'feasible',min,max,legs:legs as [LegHeightInterval,LegHeightInterval]};
}

/** Exact next-height dependence on a Hermite endpoint height. The caller can
 * invert this coefficient to choose a future target without changing entry h/v.
 * After the endpoint, its supplied velocity continues linearly (usually zero).
 */
export function hermiteHeightAffine(state:HeightState,remaining:number,dt:number,targetVelocity=0):
  {constant:number;targetCoefficient:number}|null {
  if(!finiteState(state)||!Number.isFinite(remaining)||remaining<=0||!Number.isFinite(dt)||dt<0||!Number.isFinite(targetVelocity))return null;
  if(dt>=remaining)return {constant:(dt-remaining)*targetVelocity,targetCoefficient:1};
  const u=dt/remaining,u2=u*u,u3=u2*u;
  return {constant:(2*u3-3*u2+1)*state.height+(u3-2*u2+u)*remaining*state.velocity+(u3-u2)*remaining*targetVelocity,
    targetCoefficient:-2*u3+3*u2};
}

/** Advance one fixed Hermite trajectory, preserving incoming position/velocity.
 * The entire consumed polynomial segment (and any linear tail) must stay inside
 * the supplied interval. Failure returns diagnostics, never a clamped pose.
 */
export function advanceHeightHermite(state:HeightState,target:HeightState,remaining:number,dt:number,
  interval:HeightInterval):HeightAdvanceResult {
  if(!finiteState(state)||!finiteState(target)||!Number.isFinite(remaining)||remaining<=0||!Number.isFinite(dt)||dt<0)
    return {status:'infeasible',reason:'invalid-trajectory'};
  if(!Number.isFinite(interval.min)||!Number.isFinite(interval.max)||interval.min>interval.max)
    return {status:'infeasible',reason:'invalid-height-interval'};
  const T=remaining,u=Math.min(1,dt/T),c0=state.height,c1=T*state.velocity;
  const c2=3*(target.height-state.height)-T*(2*state.velocity+target.velocity);
  const c3=2*(state.height-target.height)+T*(state.velocity+target.velocity);
  const height=(x:number)=>((c3*x+c2)*x+c1)*x+c0;
  const velocity=(x:number)=>(3*c3*x*x+2*c2*x+c1)/T;
  const next=dt>=T?{height:target.height+(dt-T)*target.velocity,velocity:target.velocity}:
    {height:height(u),velocity:velocity(u)};
  let minHeight=Math.min(state.height,next.height),maxHeight=Math.max(state.height,next.height);
  let maxAbsVelocity=Math.max(Math.abs(state.velocity),Math.abs(next.velocity),Math.abs(velocity(u)));
  const includeHeight=(x:number)=>{if(x>0&&x<u){const h=height(x);minHeight=Math.min(minHeight,h);maxHeight=Math.max(maxHeight,h);}};
  // Roots of the derivative, with a cancellation-resistant quadratic formula.
  const A=3*c3,B=2*c2,C=c1;
  if(A===0) {if(B!==0)includeHeight(-C/B);}
  else {
    const discriminant=B*B-4*A*C;
    if(discriminant>=0){
      const root=Math.sqrt(discriminant),q=-.5*(B+(B>=0?root:-root));
      if(q===0)includeHeight(-B/(2*A));
      else {includeHeight(q/A);includeHeight(C/q);}
    }
    const accelerationRoot=-c2/(3*c3);
    if(accelerationRoot>0&&accelerationRoot<u)maxAbsVelocity=Math.max(maxAbsVelocity,Math.abs(velocity(accelerationRoot)));
  }
  // The endpoint can be an interior extremum when a nonzero-velocity linear tail follows.
  if(dt>T){minHeight=Math.min(minHeight,target.height);maxHeight=Math.max(maxHeight,target.height);}
  const extrema={minHeight,maxHeight,maxAbsVelocity};
  if(!finiteState(next)||!Object.values(extrema).every(Number.isFinite))return {status:'infeasible',reason:'nonfinite-trajectory'};
  if(minHeight<interval.min||maxHeight>interval.max)return {status:'infeasible',reason:'height-interval',candidate:next,extrema};
  return {status:'accepted',state:next,...extrema};
}
