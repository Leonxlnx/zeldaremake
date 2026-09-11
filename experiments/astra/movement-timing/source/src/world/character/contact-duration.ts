/** Full scalar contact-curve admission. Preserves the exact outgoing derivative;
 * timing changes never clip a rate or replace an endpoint with a moving target.
 */
export interface ContactScalarState { value:number;velocity:number }
export interface ContactScalarCurve {
  duration:number;start:ContactScalarState;end:ContactScalarState;
  /** Cubic value coefficients in normalized time u=t/duration. */
  coefficients:[number,number,number,number];
  range:{min:number;max:number};valueCriticalTimes:number[];
  maximumSpeed:number;speedCriticalTimes:number[];
}
export type ContactDurationCertificate=
  | {status:'clear';curve:ContactScalarCurve}
  | {status:'infeasible'|'invalid';reason:string;curve?:ContactScalarCurve};
export type MinimumContactDurationResult=
  | {status:'clear';duration:number;bracket:{min:number;max:number};curve:ContactScalarCurve;iterations:number}
  | {status:'infeasible'|'uncertain';reason:string;maximumTime:number;
      effectiveMaximumTime?:number;bracket?:{min:number;max:number};iterations?:number;
      certificate?:ContactDurationCertificate};

const RATE_GUARD=1e-6,ITERATIONS=64;
const roundoff=(...values:number[])=>64*Number.EPSILON*Math.max(1,...values.map(Math.abs));
function roots(A:number,B:number,C:number):number[]{
  if(A===0)return B===0?[]:[-C/B];
  const scale=Math.max(Math.abs(A),Math.abs(B),Math.abs(C)),a=A/scale,b=B/scale,c=C/scale;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return [];
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(discriminant));
  return q===0?[-b/(2*a)]:[q/a,c/q];
}

/** Same exact quadratic extrema evaluator is used for both prescribed durations
 * and the minimum-time bracket. The public certificate retains the existing
 * numerical rate guard; the minimum-time search itself targets the nominal limit.
 */
export function certifyContactDuration(p:number,v:number,end:number,duration:number,limit:number):ContactDurationCertificate {
  if(![p,v,end,duration,limit].every(Number.isFinite)||duration<0||limit<0)
    return {status:'invalid',reason:'invalid-input'};
  if(duration===0){
    if(p!==end||v!==0)return {status:'invalid',reason:'zero-duration-nonconstant'};
    return {status:'clear',curve:{duration:0,start:{value:p,velocity:v},end:{value:end,velocity:0},
      coefficients:[p,0,0,0],range:{min:p,max:p},valueCriticalTimes:[0],maximumSpeed:0,speedCriticalTimes:[0]}};
  }
  const c0=p,c1=duration*v,c2=3*(end-p)-2*c1,c3=2*(p-end)+c1;
  if(![c0,c1,c2,c3,c1/duration,2*c2/duration,3*c3/duration].every(Number.isFinite))
    return {status:'invalid',reason:'nonfinite-polynomial'};
  const value=(u:number)=>((c3*u+c2)*u+c1)*u+c0;
  const speed=(u:number)=>(3*c3*u*u+2*c2*u+c1)/duration;
  let min=Math.min(p,end),max=Math.max(p,end),maximumSpeed=Math.abs(v);
  const valueCriticalTimes=[0,duration],speedCriticalTimes=[0,duration];
  for(const u of roots(3*c3,2*c2,c1))if(Number.isFinite(u)&&u>0&&u<1){
    const y=value(u);min=Math.min(min,y);max=Math.max(max,y);valueCriticalTimes.push(u*duration);
  }
  if(c3!==0){const u=-c2/(3*c3);if(u>0&&u<1){maximumSpeed=Math.max(maximumSpeed,Math.abs(speed(u)));speedCriticalTimes.push(u*duration);}}
  const curve:ContactScalarCurve={duration,start:{value:p,velocity:v},end:{value:end,velocity:0},
    coefficients:[c0,c1,c2,c3],range:{min,max},valueCriticalTimes:valueCriticalTimes.sort((a,b)=>a-b),
    maximumSpeed,speedCriticalTimes:speedCriticalTimes.sort((a,b)=>a-b)};
  if(![min,max,maximumSpeed].every(Number.isFinite))return {status:'invalid',reason:'nonfinite-extrema',curve};
  if(maximumSpeed>limit+RATE_GUARD)return {status:'infeasible',reason:'speed-limit',curve};
  if(p>=end){
    // y(u)-end=(1-u)^2[(p-end)+(duration*v+2*(p-end))*u].
    // Nonnegative on [0,1] iff the linear bracket is nonnegative at both ends.
    const gap=p-end,last=3*gap+duration*v;
    if(last < -roundoff(gap,duration*v)||min<end-roundoff(p,end,min))
      return {status:'infeasible',reason:'below-descending-end',curve};
  }
  return {status:'clear',curve};
}

/** |v|<=limit implies the speed-admissible set is an interval in reciprocal
 * duration containing zero: at 1/T=0 the derivative is v*(1-4u+3u^2), whose
 * absolute maximum is |v|. Thus positive feasible durations have one lower
 * speed boundary. A descending overshoot condition supplies an upper bound.
 * The returned upper bracket endpoint is an actually certified duration.
 */
export function minimumContactDuration(p:number,v:number,end:number,limit:number,maximumTime:number):MinimumContactDurationResult {
  const fail=(status:'infeasible'|'uncertain',reason:string,extra:Partial<MinimumContactDurationResult>={}):MinimumContactDurationResult=>
    ({status,reason,maximumTime,...extra} as MinimumContactDurationResult);
  if(![p,v,end,limit,maximumTime].every(Number.isFinite)||limit<0||maximumTime<0)
    return fail('infeasible','invalid-input');
  if(p===end&&v===0){
    const certificate=certifyContactDuration(p,v,end,0,limit);
    if(certificate.status!=='clear')return fail('uncertain','constant-certificate', {certificate});
    return {status:'clear',duration:0,bracket:{min:0,max:0},curve:certificate.curve,iterations:0};
  }
  if(maximumTime===0)return fail('infeasible','zero-time-horizon');
  if(Math.abs(v)>limit+RATE_GUARD)return fail('infeasible','outgoing-rate-outside-limit');
  if(Math.abs(v)>limit+roundoff(v,limit))
    return fail('uncertain','outgoing-rate-inside-guard-only');
  if(p===end)return fail('uncertain','zero-displacement-nonzero-rate-infimum',{
    certificate:certifyContactDuration(p,v,end,maximumTime,limit)});
  if(limit===0)return fail('infeasible','zero-speed-nonzero-displacement');
  let effectiveMaximumTime=maximumTime;
  if(p>end&&v<0)effectiveMaximumTime=Math.min(effectiveMaximumTime,3*(p-end)/-v);
  if(!(effectiveMaximumTime>0)||!Number.isFinite(effectiveMaximumTime))
    return fail('uncertain','nonfinite-effective-horizon',{effectiveMaximumTime});
  const nominal=(c:ContactDurationCertificate)=>c.status==='clear'&&
    c.curve.maximumSpeed<=limit+roundoff(limit,v,c.curve.maximumSpeed);
  let upperCertificate=certifyContactDuration(p,v,end,effectiveMaximumTime,limit);
  if(upperCertificate.status==='invalid')return fail('uncertain','upper-certificate-invalid',{effectiveMaximumTime,certificate:upperCertificate});
  if(!nominal(upperCertificate)){
    const reason=upperCertificate.status==='infeasible'&&upperCertificate.reason==='below-descending-end'?
      'descending-end-at-upper-horizon':'support-horizon-before-speed-admission';
    return fail('infeasible',reason,{effectiveMaximumTime,certificate:upperCertificate});
  }
  let lo=0,hi=effectiveMaximumTime,iterations=0;
  const tolerance=Math.max(1e-12,effectiveMaximumTime*1e-10);
  while(hi-lo>tolerance&&iterations<ITERATIONS){
    const mid=(lo+hi)*.5;if(mid===lo||mid===hi)break;
    const certificate=certifyContactDuration(p,v,end,mid,limit);iterations++;
    if(certificate.status==='invalid')return fail('uncertain','midpoint-certificate-invalid',{
      effectiveMaximumTime,bracket:{min:lo,max:hi},iterations,certificate});
    if(nominal(certificate)){hi=mid;upperCertificate=certificate;}else lo=mid;
  }
  if(upperCertificate.status!=='clear'||hi-lo>tolerance)return fail('uncertain','duration-resolution-exhausted',{
    effectiveMaximumTime,bracket:{min:lo,max:hi},iterations,certificate:upperCertificate});
  return {status:'clear',duration:hi,bracket:{min:lo,max:hi},curve:upperCertificate.curve,iterations};
}
