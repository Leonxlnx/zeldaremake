/** Pure, bounded recovery endpoint admission. A found endpoint is feasible;
 * neither the height search nor a failed point sample claims global optimality.
 */
import type { Vector3 } from 'three';
import { certifyFlexHermite, type FlexPlan, type FlexState } from './contact-flex';
import { flexPlanMaximumRate } from './contact-height-rate';

interface Interval { min:number;max:number }
export interface RecoveryOutgoingSample {
  /** Time after the planned second-foot contact. Both soles remain stationary. */
  time:number; hipBase:[Vector3,Vector3]; hipVelocityBase:[Vector3,Vector3];
}
export interface RecoveryEndpointInput {
  /** Hip positions with WORLD pelvis height H=0, including rotated side offsets. */
  hipBase:[Vector3,Vector3];
  /** Actual world hip velocities with WORLD pelvis vertical velocity V=0. */
  hipVelocityBase:[Vector3,Vector3];
  /** Actual ankle targets after applying each stationary foot's sole offset. */
  ankles:[Vector3,Vector3];
  a:number;b:number;start:FlexState;duration:number;
  nominalHeight:number;nominalVelocity:number;heightBounds:Interval;
  flexLimit:number;pelvisLimit:number;
  outgoing:{reserveTime:number;samples:RecoveryOutgoingSample[]};
}
export interface RecoveryEndpointDiagnostics {
  queries:number;heightInterval:Interval;sampledHeights:number[];
  /** Largest remaining gap between sampled heights and the interval boundaries. */
  maxUnsampledGap:number;
  /** True unless the feasible height is exactly the reach-clipped preference. */
  unresolvedNearerHeight:boolean;
  velocityInterval?:Interval;leadingEndRateInterval?:Interval;
  maximumLeadingRate?:number;lastReason?:string;
  outgoingSamples:number; minimumOutgoingReachSlack?:number; minimumOutgoingTangentSlack?:number;
}
export type RecoveryEndpointResult=
  | {status:'clear';height:number;velocity:number;plan:FlexPlan;
      configurationEnd:[{flex:number;flexVelocity:number},{flex:number;flexVelocity:number}];
      diagnostics:RecoveryEndpointDiagnostics}
  | {status:'uncertain'|'infeasible';reason:string;diagnostics:RecoveryEndpointDiagnostics};

const RATE_GUARD=1e-6,MAX_HEIGHT_QUERIES=32;
const finiteVector=(v:Vector3)=>[v.x,v.y,v.z].every(Number.isFinite);
const intersection=(a:Interval,b:Interval):Interval=>({min:Math.max(a.min,b.min),max:Math.min(a.max,b.max)});
const empty=(a:Interval)=>a.min>a.max;
const evaluate=(a:number,b:number,c:number,u:number)=>(a*u+b)*u+c;

/** Stable finite roots of a quadratic; identically zero has no isolated roots. */
function quadraticRoots(A:number,B:number,C:number):number[]{
  if(A===0)return B===0?[]:[-C/B];
  const scale=Math.max(Math.abs(A),Math.abs(B),Math.abs(C)),a=A/scale,b=B/scale,c=C/scale;
  const discriminant=b*b-4*a*c;
  if(discriminant<0)return [];
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(discriminant));
  return q===0?[-b/(2*a)]:[q/a,c/q];
}

/** Exact whole-Hermite derivative admission as an interval of terminal rates.
 * With D=(f1-f0)/T, f'(u)=A(u)+u(3u-2)*v1. Constraints are affine in v1.
 * Every ratio extremum is a quadratic root; zeros of its denominator have
 * explicit one-sided limits. Bernstein control failure is never a rejection.
 */
function leadingRateInterval(start:FlexState,endValue:number,T:number,K:number):Interval|null {
  const v0=start.velocity,D=(endValue-start.value)/T;
  const roundoff=128*Number.EPSILON*Math.max(1,Math.abs(v0),Math.abs(D),K);
  const mid=(4*D-v0)/3;
  if(Math.abs(v0)>K+roundoff||Math.abs(mid)>K+roundoff)return null;
  let admitted:Interval={min:-K,max:K};
  for(const upper of[true,false]){
    const bound=upper?K:-K;
    // Canonicalize only algebraic boundary cancellation at floating precision.
    // The actual stored outgoing derivative and the final plan stay untouched.
    const n0=Math.abs(bound-v0)<=roundoff?0:bound-v0;
    const nm=Math.abs(bound-mid)<=roundoff?0:bound-mid;
    const roots=quadraticRoots(3*(D-v0),-3*n0,n0);
    const A2=-6*D+3*v0,A1=6*D-4*v0;
    const ratio=(u:number)=>(bound-evaluate(A2,A1,v0,u))/(u*(3*u-2));
    const atZero=n0===0?3*D-2*v0:n0>0?-Infinity:Infinity;
    const atMidLeft=nm===0?D:nm>0?-Infinity:Infinity;
    const atMidRight=nm===0?D:nm>0?Infinity:-Infinity;
    const left=[atZero,atMidLeft],right=[atMidRight,bound];
    for(const u of roots){
      if(!Number.isFinite(u)||u<=0||u>=1||u===2/3)continue;
      const value=ratio(u);if(Number.isNaN(value))return null;
      (u<2/3?left:right).push(value);
    }
    if(upper){admitted.min=Math.max(admitted.min,...left);admitted.max=Math.min(admitted.max,...right);}
    else{admitted.max=Math.min(admitted.max,...left);admitted.min=Math.max(admitted.min,...right);}
  }
  if(empty(admitted)){
    if(admitted.min-admitted.max>roundoff)return null;
    // A constant boundary-rate curve can produce oppositely rounded bounds.
    // Keep the represented intersection on the declared endpoint-rate bound;
    // the unchanged actual cubic still receives the final existing rate guard.
    const joined=Math.max(-K,Math.min(K,(admitted.min+admitted.max)*.5));
    return {min:joined,max:joined};
  }
  return admitted;
}

function affineInterval(baseline:number,slope:number,bounds:Interval):Interval {
  if(slope===0)return baseline>=bounds.min&&baseline<=bounds.max?
    {min:-Infinity,max:Infinity}:{min:Infinity,max:-Infinity};
  const a=(bounds.min-baseline)/slope,b=(bounds.max-baseline)/slope;
  return {min:Math.min(a,b),max:Math.max(a,b)};
}

export function projectRecoveryEndpoint(input:RecoveryEndpointInput):RecoveryEndpointResult {
  const {a,b,start,duration:T,flexLimit:K,pelvisLimit:P}=input;
  const heights:number[]=[];
  let heightInterval:Interval={...input.heightBounds},lastReason='';
  const preference=()=>Math.max(heightInterval.min,Math.min(heightInterval.max,input.nominalHeight));
  const diagnostics=(height?:number):RecoveryEndpointDiagnostics=>{
    const points=[heightInterval.min,...heights,heightInterval.max].sort((x,y)=>x-y);
    let gap=0;for(let i=1;i<points.length;i++)gap=Math.max(gap,points[i]-points[i-1]);
    return {queries:heights.length,heightInterval:{...heightInterval},sampledHeights:[...heights],maxUnsampledGap:gap,
      unresolvedNearerHeight:height===undefined||height!==preference(),lastReason,outgoingSamples:input.outgoing?.samples?.length??0};
  };
  const fail=(status:'infeasible'|'uncertain',reason:string):RecoveryEndpointResult=>({status,reason,diagnostics:diagnostics()});
  if(![a,b,T,K,P,start.value,start.velocity,input.nominalHeight,input.nominalVelocity,heightInterval.min,heightInterval.max].every(Number.isFinite)||
    a<=0||b<=0||T<=0||K<0||P<0||empty(heightInterval)||
    ![...input.hipBase,...input.hipVelocityBase,...input.ankles].every(finiteVector))return fail('infeasible','invalid-input');
  if(!input.outgoing||!Number.isFinite(input.outgoing.reserveTime)||input.outgoing.reserveTime<=0||
    !Array.isArray(input.outgoing.samples)||!input.outgoing.samples.some(s=>s.time===0)||
    input.outgoing.samples.some(s=>!Number.isFinite(s.time)||s.time<0||s.hipBase.length!==2||s.hipVelocityBase.length!==2||
      ![...s.hipBase,...s.hipVelocityBase].every(finiteVector)))return fail('infeasible','invalid-outgoing-reserve');
  const minimumDistance=Math.abs(a-b)+.01,maximumDistance=a+b-.002;
  if(minimumDistance>=maximumDistance)return fail('infeasible','empty-reach-reserve');
  const flexBounds={min:Math.acos((maximumDistance**2-a*a-b*b)/(2*a*b)),
    max:Math.acos((minimumDistance**2-a*a-b*b)/(2*a*b))};
  if(start.value<flexBounds.min||start.value>flexBounds.max)return fail('infeasible','initial-flex-outside-reserve');
  if(Math.abs(start.velocity)>K+RATE_GUARD)return fail('infeasible','initial-rate-outside-limit');
  const geometry=input.ankles.map((ankle,i)=>{
    const hip=input.hipBase[i],x=ankle.x-hip.x,z=ankle.z-hip.z;
    return {x,z,yAtZero:ankle.y-hip.y,horizontal:x*x+z*z};
  });
  for(const g of geometry){
    if(g.horizontal>maximumDistance**2)return fail('infeasible','horizontal-reach-empty');
    // Upper anatomical branch: hip lies at or above the target ankle.
    heightInterval=intersection(heightInterval,{
      min:g.yAtZero+Math.sqrt(Math.max(0,minimumDistance**2-g.horizontal)),
      max:g.yAtZero+Math.sqrt(maximumDistance**2-g.horizontal)});
  }
  if(empty(heightInterval))return fail('infeasible','shared-height-reach-empty');
  const outgoing:{time:number;floor:number;ceiling:number;floorVelocity:number;ceilingVelocity:number}[]=[];
  for(const sample of input.outgoing.samples)for(let i=0;i<2;i++){
    const hip=sample.hipBase[i],v=sample.hipVelocityBase[i],ankle=input.ankles[i];
    const x=ankle.x-hip.x,z=ankle.z-hip.z,horizontal=x*x+z*z,horizontalDot=-x*v.x-z*v.z;
    const upperSq=maximumDistance**2-horizontal,lowerSq=minimumDistance**2-horizontal;
    if(upperSq<0)return fail('infeasible','outgoing-horizontal-reach-empty');
    if(upperSq===0||lowerSq===0)return fail('uncertain','outgoing-reach-tangent');
    const high=Math.sqrt(upperSq),low=Math.sqrt(Math.max(0,lowerSq));
    outgoing.push({time:sample.time,floor:ankle.y-hip.y+low,ceiling:ankle.y-hip.y+high,
      floorVelocity:-v.y-(lowerSq>0?horizontalDot/low:0),ceilingVelocity:-v.y-horizontalDot/high});
  }

  const tryHeight=(height:number):RecoveryEndpointResult|null=>{
    if(heights.includes(height)||heights.length>=MAX_HEIGHT_QUERIES)return null;
    heights.push(height);
    const legs=geometry.map((g,i)=>{
      const y=g.yAtZero-height,distanceSquared=g.horizontal+y*y;
      const flex=Math.acos((distanceSquared-a*a-b*b)/(2*a*b)),denominator=a*b*Math.sin(flex),v=input.hipVelocityBase[i];
      return {flex,baseline:(g.x*v.x+y*v.y+g.z*v.z)/denominator,slope:y/denominator};
    });
    if(!legs.every(l=>[l.flex,l.baseline,l.slope].every(Number.isFinite))){lastReason='nonfinite-height-slice';return null;}
    let velocityInterval:Interval={min:-P,max:P};
    for(const s of outgoing){
      // H(s)=height+s*V; tangent reserve H(s)+tau*V uses the same
      // outgoing derivative, never an edited accepted-state velocity.
      velocityInterval=intersection(velocityInterval,affineInterval(height,s.time,{min:s.floor,max:s.ceiling}));
      const tau=input.outgoing.reserveTime;
      velocityInterval=intersection(velocityInterval,affineInterval(height,s.time+tau,
        {min:s.floor+tau*s.floorVelocity,max:s.ceiling+tau*s.ceilingVelocity}));
    }
    if(empty(velocityInterval)){lastReason='outgoing-velocity-slice-empty';return null;}
    for(const l of legs)velocityInterval=intersection(velocityInterval,affineInterval(l.baseline,l.slope,{min:-K,max:K}));
    const endRateInterval=leadingRateInterval(start,legs[0].flex,T,K);
    if(!endRateInterval){lastReason='leading-whole-rate-slice-empty-or-roundoff';return null;}
    velocityInterval=intersection(velocityInterval,affineInterval(legs[0].baseline,legs[0].slope,endRateInterval));
    if(empty(velocityInterval)){lastReason='shared-velocity-slice-empty';return null;}
    const velocity=Math.max(velocityInterval.min,Math.min(velocityInterval.max,input.nominalVelocity));
    const configurationEnd=legs.map(l=>({flex:l.flex,flexVelocity:l.baseline+l.slope*velocity})) as
      [{flex:number;flexVelocity:number},{flex:number;flexVelocity:number}];
    const end=configurationEnd[0],certificate=certifyFlexHermite(start,{value:end.flex,velocity:end.flexVelocity},T,flexBounds);
    if(certificate.status!=='feasible'){
      // Other velocities in this slice may satisfy positional bounds. This one
      // failed exact candidate is unresolved, not proof that the slice is empty.
      lastReason='chosen-velocity-value-certificate-failed';return null;
    }
    const plan:FlexPlan={segments:[certificate.segment],duration:T,bounds:{...flexBounds}};
    const rate=flexPlanMaximumRate(plan);
    if(rate.status!=='clear'||rate.maximum>K+RATE_GUARD||configurationEnd.some(c=>Math.abs(c.flexVelocity)>K+RATE_GUARD)||Math.abs(velocity)>P+RATE_GUARD){
      lastReason='chosen-velocity-rate-certificate-failed';return null;
    }
    lastReason='';
    return {status:'clear',height,velocity,plan,configurationEnd,diagnostics:{...diagnostics(height),
      velocityInterval,leadingEndRateInterval:endRateInterval,maximumLeadingRate:rate.maximum,
      minimumOutgoingReachSlack:Math.min(...outgoing.flatMap(s=>[height+s.time*velocity-s.floor,s.ceiling-height-s.time*velocity])),
      minimumOutgoingTangentSlack:Math.min(...outgoing.flatMap(s=>{const tau=input.outgoing.reserveTime,h=height+(s.time+tau)*velocity;
        return [h-s.floor-tau*s.floorVelocity,s.ceiling+tau*s.ceilingVelocity-h];}))}};
  };

  // Preference first; endpoints, then each dyadic level ordered by proximity.
  // Level-by-level refinement avoids starving distant feasible regions while
  // endlessly bisecting an infeasible neighborhood around the preference.
  for(const h of[preference(),heightInterval.min,heightInterval.max]){
    const result=tryHeight(h);if(result)return result;
  }
  if(heightInterval.min===heightInterval.max)return fail('uncertain','single-height-slice-unresolved');
  for(let level=1;heights.length<MAX_HEIGHT_QUERIES;level++){
    const denominator=2**level,points:number[]=[];
    for(let k=1;k<denominator;k+=2)points.push(heightInterval.min+(heightInterval.max-heightInterval.min)*k/denominator);
    points.sort((x,y)=>Math.abs(x-input.nominalHeight)-Math.abs(y-input.nominalHeight)||x-y);
    let added=false;
    for(const h of points){const count=heights.length,result=tryHeight(h);added ||= heights.length>count;if(result)return result;if(heights.length>=MAX_HEIGHT_QUERIES)break;}
    if(!added)return fail('uncertain','height-resolution-exhausted');
  }
  return fail('uncertain','height-query-budget-exhausted');
}
