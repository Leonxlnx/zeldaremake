/** Pure full-curve flex admission. No endpoint, derivative, limit or clock is silently clamped. */
export interface FlexState { value:number; velocity:number }
export interface FlexBounds { min:number; max:number }
export interface FlexHermiteSegment {
  kind:'hermite';duration:number;start:FlexState;end:FlexState;
  /** Value polynomial in normalized segment time u=t/duration. */
  coefficients:[number,number,number,number];
}
export interface FlexBrakeSegment { kind:'brake';duration:number;start:FlexState;end:FlexState;acceleration:number }
export type FlexSegment=FlexHermiteSegment|FlexBrakeSegment;
export interface FlexExtrema { range:FlexBounds;criticalTimes:number[];bezierSafe:boolean }
export type FlexHermiteCertificate=
  | ({status:'feasible';segment:FlexHermiteSegment}&FlexExtrema)
  | {status:'infeasible';reason:string;segment?:FlexHermiteSegment;range?:FlexBounds;criticalTimes?:number[];bezierSafe?:boolean};
export type FlexBrakeCertificate=
  | {status:'feasible';segment:FlexBrakeSegment;range:FlexBounds;criticalTimes:number[]}
  | {status:'infeasible';reason:string;segment?:FlexBrakeSegment;range?:FlexBounds;criticalTimes?:number[]};
export interface FlexPlan { segments:FlexSegment[];duration:number;bounds:FlexBounds }
export type FlexPlanResult=
  | {status:'feasible';plan:FlexPlan;singleCertificate:FlexHermiteCertificate;brakeCertificate?:FlexBrakeCertificate;secondCertificate?:FlexHermiteCertificate}
  | {status:'infeasible';reason:string;singleCertificate:FlexHermiteCertificate;brakeCertificate?:FlexBrakeCertificate;secondCertificate?:FlexHermiteCertificate};
export type FlexAdvanceResult=
  | {status:'clear';state:FlexState;segmentIndex:number;complete:boolean}
  | {status:'invalid';reason:string};
const finiteState=(s:FlexState)=>Number.isFinite(s.value)&&Number.isFinite(s.velocity);
const validBounds=(b:FlexBounds)=>Number.isFinite(b.min)&&Number.isFinite(b.max)&&b.min<=b.max;
const inside=(v:number,b:FlexBounds)=>v>=b.min&&v<=b.max;
const copy=(s:FlexState):FlexState=>({value:s.value,velocity:s.velocity});

/** Convex-hull admission is sufficient, but its failure is not rejection: analytic
 * derivative roots then determine the actual complete cubic range in every case.
 */
export function certifyFlexHermite(start:FlexState,end:FlexState,duration:number,bounds:FlexBounds):FlexHermiteCertificate {
  if(!finiteState(start)||!finiteState(end)||!Number.isFinite(duration)||duration<=0||!validBounds(bounds))
    return {status:'infeasible',reason:'invalid-input'};
  const c0=start.value,c1=duration*start.velocity;
  const c2=3*(end.value-start.value)-duration*(2*start.velocity+end.velocity);
  const c3=2*(start.value-end.value)+duration*(start.velocity+end.velocity);
  if(![c0,c1,c2,c3].every(Number.isFinite))return {status:'infeasible',reason:'nonfinite-polynomial'};
  const segment:FlexHermiteSegment={kind:'hermite',duration,start:copy(start),end:copy(end),coefficients:[c0,c1,c2,c3]};
  const controls=[start.value,start.value+duration*start.velocity/3,end.value-duration*end.velocity/3,end.value];
  const bezierSafe=controls.every(v=>Number.isFinite(v)&&inside(v,bounds));
  const roots:number[]=[];
  const include=(u:number)=>{if(Number.isFinite(u)&&u>0&&u<1&&!roots.includes(u))roots.push(u);};
  const A=3*c3,B=2*c2,C=c1;
  if(![A,B,C].every(Number.isFinite))return {status:'infeasible',reason:'nonfinite-derivative',segment,bezierSafe};
  if(A===0){if(B!==0)include(-C/B);}
  else {
    // Rescale the derivative before its discriminant to avoid avoidable overflow.
    const scale=Math.max(Math.abs(A),Math.abs(B),Math.abs(C)),a=A/scale,b=B/scale,c=C/scale;
    const discriminant=b*b-4*a*c;
    if(discriminant>=0){
      const root=Math.sqrt(discriminant),q=-.5*(b+(b>=0?root:-root));
      if(q===0)include(-b/(2*a));else{include(q/a);include(c/q);}
    }
  }
  roots.sort((a,b)=>a-b);
  let min=Math.min(start.value,end.value),max=Math.max(start.value,end.value);
  for(const u of roots){const value=((c3*u+c2)*u+c1)*u+c0;min=Math.min(min,value);max=Math.max(max,value);}
  const range={min,max},criticalTimes=roots.map(u=>u*duration);
  if(!Number.isFinite(min)||!Number.isFinite(max))return {status:'infeasible',reason:'nonfinite-range',segment,range,criticalTimes,bezierSafe};
  if(!inside(start.value,bounds)||!inside(end.value,bounds))return {status:'infeasible',reason:'endpoint-outside-bounds',segment,range,criticalTimes,bezierSafe};
  if(min<bounds.min||max>bounds.max)return {status:'infeasible',reason:'curve-outside-bounds',segment,range,criticalTimes,bezierSafe};
  return {status:'feasible',segment,range,criticalTimes,bezierSafe};
}

/** Exactly one optional brake: outgoing velocity reaches zero at constant
 * acceleration over Tb=min(T/3,headroom/abs(v0)), consuming at most half headroom.
 * The remaining Hermite retains the originally requested final value and velocity.
 */
export function planFlex(start:FlexState,end:FlexState,duration:number,bounds:FlexBounds):FlexPlanResult {
  const singleCertificate=certifyFlexHermite(start,end,duration,bounds);
  if(singleCertificate.status==='feasible')return {status:'feasible',plan:{segments:[singleCertificate.segment],duration,bounds:{...bounds}},singleCertificate};
  if(singleCertificate.reason!=='curve-outside-bounds')return {status:'infeasible',reason:'invalid-single-curve',singleCertificate};
  if(start.velocity===0)return {status:'infeasible',reason:'no-outgoing-rate-to-brake',singleCertificate};
  const headroom=start.velocity>0?bounds.max-start.value:start.value-bounds.min;
  if(!(headroom>0))return {status:'infeasible',reason:'no-braking-headroom',singleCertificate};
  const brakeTime=Math.min(duration/3,headroom/Math.abs(start.velocity));
  if(!(brakeTime>0)||!Number.isFinite(brakeTime)||duration-brakeTime<=0)return {status:'infeasible',reason:'invalid-braking-time',singleCertificate};
  const joined:FlexState={value:start.value+.5*start.velocity*brakeTime,velocity:0};
  const brake:FlexBrakeSegment={kind:'brake',duration:brakeTime,start:copy(start),end:joined,acceleration:-start.velocity/brakeTime};
  const range={min:Math.min(start.value,joined.value),max:Math.max(start.value,joined.value)};
  const brakeCertificate:FlexBrakeCertificate=!finiteState(joined)||!Number.isFinite(brake.acceleration)?
    {status:'infeasible',reason:'nonfinite-brake',segment:brake,range,criticalTimes:[]}:
    range.min<bounds.min||range.max>bounds.max?{status:'infeasible',reason:'brake-outside-bounds',segment:brake,range,criticalTimes:[]}:
    {status:'feasible',segment:brake,range,criticalTimes:[]};
  if(brakeCertificate.status!=='feasible')return {status:'infeasible',reason:'brake-infeasible',singleCertificate,brakeCertificate};
  const secondCertificate=certifyFlexHermite(joined,end,duration-brakeTime,bounds);
  if(secondCertificate.status!=='feasible')return {status:'infeasible',reason:'brake-then-contact-infeasible',singleCertificate,brakeCertificate,secondCertificate};
  return {status:'feasible',plan:{segments:[brake,secondCertificate.segment],duration,bounds:{...bounds}},singleCertificate,brakeCertificate,secondCertificate};
}

/** Evaluate a prescribed admitted plan at elapsed dt from its start. The junction
 * and endpoint use the stored states exactly. A stationary final state may hold;
 * overrun with nonzero final velocity is invalid instead of silently stopping it.
 */
export function advanceFlex(plan:FlexPlan,dt:number):FlexAdvanceResult {
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(plan.duration)||plan.duration<=0||!validBounds(plan.bounds)||plan.segments.length<1||plan.segments.length>2)
    return {status:'invalid',reason:'invalid-plan-time'};
  let total=0;
  for(let i=0;i<plan.segments.length;i++){
    const s=plan.segments[i];
    if(!Number.isFinite(s.duration)||s.duration<=0||!finiteState(s.start)||!finiteState(s.end)||
      (s.kind==='hermite'?!s.coefficients.every(Number.isFinite):!Number.isFinite(s.acceleration)))return {status:'invalid',reason:'invalid-segment'};
    if(i>0&&(s.start.value!==plan.segments[i-1].end.value||s.start.velocity!==plan.segments[i-1].end.velocity))return {status:'invalid',reason:'discontinuous-plan'};
    total+=s.duration;
  }
  if(Math.abs(total-plan.duration)>Number.EPSILON*8*Math.max(1,total,plan.duration))return {status:'invalid',reason:'duration-mismatch'};
  const last=plan.segments[plan.segments.length-1];
  if(dt>plan.duration&&last.end.velocity!==0)return {status:'invalid',reason:'nonstationary-overrun'};
  if(dt>=plan.duration)return {status:'clear',state:copy(last.end),segmentIndex:plan.segments.length-1,complete:true};
  let elapsed=dt;
  for(let i=0;i<plan.segments.length;i++){
    const segment=plan.segments[i];
    if(elapsed<=segment.duration){
      let state:FlexState;
      if(elapsed===0)state=copy(segment.start);
      else if(elapsed===segment.duration)state=copy(segment.end);
      else if(segment.kind==='brake')state={value:segment.start.value+segment.start.velocity*elapsed+.5*segment.acceleration*elapsed*elapsed,
        velocity:segment.start.velocity+segment.acceleration*elapsed};
      else{
        const u=elapsed/segment.duration,[c0,c1,c2,c3]=segment.coefficients;
        state={value:((c3*u+c2)*u+c1)*u+c0,velocity:(3*c3*u*u+2*c2*u+c1)/segment.duration};
      }
      if(!finiteState(state))return {status:'invalid',reason:'nonfinite-evaluation'};
      return {status:'clear',state,segmentIndex:i,complete:false};
    }
    elapsed-=segment.duration;
  }
  return {status:'invalid',reason:'plan-time-gap'};
}
