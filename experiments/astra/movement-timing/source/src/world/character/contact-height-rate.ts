/** Pure endpoint height-velocity admission and prescribed scalar-rate extrema. */
import { Quaternion, Vector3 } from 'three';
import type { ConfigurationDimensions, ConfigurationFailure, PairConfiguration } from './air-configuration';
import type { FlexPlan } from './contact-flex';
import { rebaseConfigurationRates } from './contact-kinematics';

export interface ContactVelocityInterval { min:number;max:number }
export interface ContactLegHeightRate { baseline:number;slope:number;interval:ContactVelocityInterval }
export type ContactHeightVelocityResult=
  | {status:'clear';interval:ContactVelocityInterval;selected:number;legs:[ContactLegHeightRate,ContactLegHeightRate]}
  | ConfigurationFailure
  | {status:'infeasible';reason:string;side?:number;legs:ContactLegHeightRate[]};
export interface FlexRateWindow { from:number;to:number }
export type FlexMaximumRateResult=
  | {status:'clear';maximum:number;criticalTimes:number[];interval:FlexRateWindow}
  | {status:'invalid';reason:string};

/** Only the shared WORLD pelvis vertical derivative varies. Hip/ankle positions,
 * yaw motion, foot angular rates and desired world sole velocities remain fixed.
 * Per-leg unbounded intervals are explicit for a height-independent admissible rate.
 */
export function solveContactHeightVelocity(configuration:PairConfiguration,yaw:number,yawRate:number,
  worldHipVelocityAtZeroHeightRate:[Vector3,Vector3],desiredWorldSoleVelocity:[Vector3,Vector3],
  dimensions:ConfigurationDimensions,flexLimit=10.75,pelvisLimit=3):ContactHeightVelocityResult {
  if(!Number.isFinite(flexLimit)||flexLimit<0||!Number.isFinite(pelvisLimit)||pelvisLimit<0)
    return {status:'invalid',reason:'invalid-rate-limits'};
  const base=rebaseConfigurationRates(configuration,yaw,yawRate,worldHipVelocityAtZeroHeightRate,desiredWorldSoleVelocity,dimensions);
  if(base.status!=='clear')return base;
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw),legs:ContactLegHeightRate[]=[];
  let min=-pelvisLimit,max=pelvisLimit;
  for(let i=0;i<2;i++){
    const c=configuration[i],baseline=base.configuration[i].flexVelocity;
    const distance=Math.sqrt((dimensions.a-dimensions.b)**2+4*dimensions.a*dimensions.b*Math.cos(c.flex*.5)**2);
    const slope=distance*c.direction.clone().applyQuaternion(q).y/(dimensions.a*dimensions.b*Math.sin(c.flex));
    if(!Number.isFinite(slope))return {status:'invalid',reason:'nonfinite-height-rate-slope',side:i};
    let interval:ContactVelocityInterval;
    if(slope===0){
      interval=Math.abs(baseline)>flexLimit?{min:Infinity,max:-Infinity}:{min:-Infinity,max:Infinity};legs.push({baseline,slope,interval});
      if(Math.abs(baseline)>flexLimit)return {status:'infeasible',reason:'height-independent-flex-rate',side:i,legs};
    }else{
      const first=(-flexLimit-baseline)/slope,second=(flexLimit-baseline)/slope;
      interval={min:Math.min(first,second),max:Math.max(first,second)};
      legs.push({baseline,slope,interval});
    }
    min=Math.max(min,interval.min);max=Math.min(max,interval.max);
  }
  if(min>max)return {status:'infeasible',reason:'disjoint-height-rate-intervals',legs};
  return {status:'clear',interval:{min,max},selected:Math.max(min,Math.min(max,0)),legs:legs as [ContactLegHeightRate,ContactLegHeightRate]};
}

/** Exact maximum absolute derivative of the prescribed pieces over a window.
 * Times are absolute elapsed plan time. The window must lie inside the plan;
 * each piece is intersected with it before its endpoints/extrema are evaluated.
 */
export function flexPlanMaximumRate(plan:FlexPlan,window?:FlexRateWindow):FlexMaximumRateResult {
  const duration=plan.duration,range=window?{...window}:{from:0,to:duration};
  if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(range.from)||!Number.isFinite(range.to)||
    range.from<0||range.to<range.from||range.to>duration||plan.segments.length<1||plan.segments.length>2)
    return {status:'invalid',reason:'invalid-plan-window'};
  let total=0;
  for(let i=0;i<plan.segments.length;i++){
    const s=plan.segments[i];
    if(!Number.isFinite(s.duration)||s.duration<=0||![s.start.value,s.start.velocity,s.end.value,s.end.velocity].every(Number.isFinite)||
      (s.kind==='hermite'?!s.coefficients.every(Number.isFinite):s.kind!=='brake'||!Number.isFinite(s.acceleration)))
      return {status:'invalid',reason:'invalid-rate-segment'};
    if(s.kind==='hermite'&&![s.coefficients[1]/s.duration,2*s.coefficients[2]/s.duration,3*s.coefficients[3]/s.duration].every(Number.isFinite))
      return {status:'invalid',reason:'nonfinite-derivative-polynomial'};
    if(i>0&&(s.start.value!==plan.segments[i-1].end.value||s.start.velocity!==plan.segments[i-1].end.velocity))
      return {status:'invalid',reason:'discontinuous-rate-plan'};
    total+=s.duration;
  }
  if(Math.abs(total-duration)>8*Number.EPSILON*Math.max(1,total,duration))return {status:'invalid',reason:'rate-plan-duration-mismatch'};
  let start=0,maximum=0;const criticalTimes:number[]=[];
  const include=(time:number,velocity:number)=>{maximum=Math.max(maximum,Math.abs(velocity));if(!criticalTimes.includes(time))criticalTimes.push(time);};
  for(const s of plan.segments){
    const lo=Math.max(0,range.from-start),hi=Math.min(s.duration,range.to-start);
    if(lo<=hi){
      const at=(t:number)=>{
        if(t===0)return s.start.velocity;if(t===s.duration)return s.end.velocity;
        if(s.kind==='brake')return s.start.velocity+s.acceleration*t;
        const u=t/s.duration,[,c1,c2,c3]=s.coefficients;
        return (c1+2*c2*u+3*c3*u*u)/s.duration;
      };
      include(start+lo,at(lo));include(start+hi,at(hi));
      if(s.kind==='hermite'){
        const c2=s.coefficients[2],c3=s.coefficients[3];
        if(c3!==0){const extremum=-c2/(3*c3)*s.duration;if(extremum>lo&&extremum<hi)include(start+extremum,at(extremum));}
      }
    }
    start+=s.duration;
  }
  if(!Number.isFinite(maximum))return {status:'invalid',reason:'nonfinite-maximum-rate'};
  criticalTimes.sort((a,b)=>a-b);
  return {status:'clear',maximum,criticalTimes,interval:range};
}
