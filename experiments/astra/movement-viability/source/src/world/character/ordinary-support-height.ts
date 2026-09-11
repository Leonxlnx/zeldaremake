/** One shared C1 height target, admitted against supplied ordinary-contact samples.
 * Sample inequalities and a linear tangent reserve are not a swept-geometry proof.
 */
import { advanceHeightHermite, type HeightState } from './contact-height';

export interface SupportHeightInterval { min:number; max:number }
export interface SupportHeightLeg {
  horizontalSq:number;
  /** dx*dxDot + dz*dzDot, not the derivative of horizontalSq (which is twice this). */
  horizontalDot:number;
  verticalOffset:number;
  verticalVelocityOffset:number;
  minDistance:number;
  maxDistance:number;
  maxFlexRate:number;
}
export interface OrdinarySupportHeightInput {
  state:HeightState; horizon:number; dt:number; nominalTarget:number;
  targetBounds:SupportHeightInterval; heightBounds:SupportHeightInterval;
  speedLimit:number; reserveTime:number; a:number; b:number;
  samples:{time:number;legs:[SupportHeightLeg,SupportHeightLeg]}[];
}
interface Diagnostics {
  samples:number; affineConstraints:number; rateConstraints:number;
  rootIterations:number; isolatedRoots:number; fixedConstraints:number;
  guarantee:'supplied samples plus exact consumed scalar height/speed extrema';
  reserve:'linear tangent estimate only';
  selectedDistance?:number; failure?:unknown;
}
export type OrdinarySupportHeightResult =
  | {status:'clear';target:number;intervals:SupportHeightInterval[];diagnostics:Diagnostics;
      sample:(time:number)=>HeightState|null}
  | {status:'infeasible'|'uncertain';reason:string;diagnostics:Diagnostics;intervals:SupportHeightInterval[]};

type Polynomial=number[]; // ascending coefficient order
const EPS=Number.EPSILON;
const finite=(x:number)=>Number.isFinite(x);
const validInterval=(x:SupportHeightInterval)=>finite(x.min)&&finite(x.max)&&x.min<=x.max;
const add=(a:Polynomial,b:Polynomial)=>Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]??0)+(b[i]??0));
const scale=(a:Polynomial,s:number)=>a.map(v=>v*s);
const multiply=(a:Polynomial,b:Polynomial)=>{
  const c=Array(a.length+b.length-1).fill(0) as number[];
  a.forEach((v,i)=>b.forEach((w,j)=>{c[i+j]+=v*w;}));return c;
};
const evaluate=(p:Polynomial,x:number)=>{let y=0;for(let i=p.length-1;i>=0;i--)y=y*x+p[i];return y;};
const trim=(p:Polynomial)=>{const r=[...p];while(r.length>1&&r.at(-1)===0)r.pop();return r;};
const derivative=(p:Polynomial)=>p.slice(1).map((v,i)=>v*(i+1));
const roundoff=(...values:number[])=>128*EPS*Math.max(1,...values.map(Math.abs));
function substitute(p:Polynomial,centre:number,radius:number){
  let out:Polynomial=[0];
  for(let i=p.length-1;i>=0;i--)out=add(multiply(out,[centre,radius]),[p[i]]);
  return trim(out);
}
function affineHeight(state:HeightState,T:number,t:number){
  const u=t/T,B=u*u*(3-2*u),Bd=6*u*(1-u)/T;
  return {constant:(1-B)*state.height+T*u*(1-u)*(1-u)*state.velocity,coefficient:B,
    velocityConstant:-Bd*state.height+(1-4*u+3*u*u)*state.velocity,velocityCoefficient:Bd};
}

/** Isolate simple real roots on [-1,1] by the roots of the derivative.
 * A near-multiple root is deliberately unresolved, never silently discarded.
 */
function roots(input:Polynomial,diagnostics:Diagnostics):{status:'clear';values:number[]}|{status:'uncertain';reason:string}{
  let p=trim(input);const magnitude=Math.max(...p.map(Math.abs));
  if(!finite(magnitude))return {status:'uncertain',reason:'nonfinite-polynomial'};
  if(magnitude===0||p.length===1)return {status:'clear',values:[]};
  p=p.map(v=>v/magnitude);
  if(p.length===2){
    const root=-p[0]/p[1];return {status:'clear',values:root>=-1&&root<=1?[root]:[]};
  }
  const critical=roots(derivative(p),diagnostics);if(critical.status!=='clear')return critical;
  const cuts=[-1,...critical.values.filter(x=>x>-1&&x<1),1].sort((a,b)=>a-b);
  const tolerance=128*EPS*p.reduce((s,x)=>s+Math.abs(x),0),out:number[]=[];
  for(const c of critical.values)if(c>-1&&c<1&&Math.abs(evaluate(p,c))<=tolerance)
    return {status:'uncertain',reason:'near-multiple-polynomial-root'};
  for(const endpoint of[-1,1])if(Math.abs(evaluate(p,endpoint))<=tolerance)out.push(endpoint);
  for(let i=1;i<cuts.length;i++){
    let lo=cuts[i-1],hi=cuts[i],flo=evaluate(p,lo),fhi=evaluate(p,hi);
    if(flo===0||fhi===0||Math.sign(flo)===Math.sign(fhi))continue;
    for(let count=0;count<80;count++){
      const mid=(lo+hi)/2;if(mid===lo||mid===hi||hi-lo<=8*EPS)break;
      const fm=evaluate(p,mid);diagnostics.rootIterations++;
      if(fm===0){lo=hi=mid;break;}
      if(Math.sign(fm)===Math.sign(flo)){lo=mid;flo=fm;}else{hi=mid;fhi=fm;}
    }
    out.push((lo+hi)/2);
  }
  const values=out.sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]);
  diagnostics.isolatedRoots+=values.length;return {status:'clear',values};
}

/** Zero requested knee speed is the unsquared quadratic equality d·dDot=0.
 * Its isolated roots must survive; the squared quartic would hide them as double roots.
 */
function equalityRoots(input:Polynomial):{status:'clear';all:boolean;values:number[]}|{status:'uncertain';reason:string}{
  let p=trim(input);const magnitude=Math.max(...p.map(Math.abs));
  if(!finite(magnitude))return {status:'uncertain',reason:'nonfinite-equality'};
  if(magnitude===0)return {status:'clear',all:true,values:[]};
  p=p.map(v=>v/magnitude);
  if(p.length===1)return {status:'clear',all:false,values:[]};
  if(p.length===2){const x=-p[0]/p[1];return {status:'clear',all:false,values:x>=-1&&x<=1?[x]:[]};}
  const [c,b,a]=p,discriminant=b*b-4*a*c;
  const error=64*EPS*(b*b+Math.abs(4*a*c));
  if(discriminant!==0&&Math.abs(discriminant)<=error)return {status:'uncertain',reason:'near-double-equality-root'};
  if(discriminant<0)return {status:'clear',all:false,values:[]};
  if(discriminant===0){const x=-b/(2*a);return {status:'clear',all:false,values:x>=-1&&x<=1?[x]:[]};}
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(discriminant));
  return {status:'clear',all:false,values:[q/a,c/q].filter(x=>x>=-1&&x<=1).sort((a,b)=>a-b)};
}

export function fitOrdinarySupportHeight(input:OrdinarySupportHeightInput):OrdinarySupportHeightResult {
  const diagnostics:Diagnostics={samples:input.samples?.length??0,affineConstraints:0,rateConstraints:0,
    rootIterations:0,isolatedRoots:0,fixedConstraints:0,
    guarantee:'supplied samples plus exact consumed scalar height/speed extrema',reserve:'linear tangent estimate only'};
  let intervals:SupportHeightInterval[]=[];
  const fail=(status:'infeasible'|'uncertain',reason:string,detail?:unknown):OrdinarySupportHeightResult=>{
    diagnostics.failure=detail;return {status,reason,diagnostics,intervals};
  };
  const {state,horizon:T,dt,a,b}=input;
  if(!state||![state.height,state.velocity,T,dt,a,b,input.nominalTarget,input.speedLimit,input.reserveTime].every(finite)
    ||T<=0||dt<=0||dt>T||a<=0||b<=0||input.speedLimit<0||input.reserveTime<0
    ||!validInterval(input.targetBounds)||!validInterval(input.heightBounds)||!Array.isArray(input.samples)
    ||!input.samples.some(s=>s.time===0)||!input.samples.some(s=>s.time===dt))return fail('infeasible','invalid-input');
  intervals=[{...input.targetBounds}];
  const constraints:{constant:number;coefficient:number;name:string;detail:unknown}[]=[];
  const polynomials:{p:Polynomial;equality:boolean;name:string;detail:unknown;
    direct:(target:number)=>{dot:number;den:number;limit:number;dotRoundoff:number}}[]=[];
  const affine=(constant:number,coefficient:number,name:string,detail:unknown)=>constraints.push({constant,coefficient,name,detail});
  const bound=(constant:number,coefficient:number,min:number,max:number,name:string,detail:unknown)=>{
    affine(constant-min,coefficient,`${name}-lower`,detail);affine(max-constant,-coefficient,`${name}-upper`,detail);
  };
  for(let index=0;index<input.samples.length;index++){
    const sample=input.samples[index];
    if(!finite(sample.time)||sample.time<0||sample.time>dt||sample.legs.length!==2)return fail('infeasible','invalid-sample',{index});
    const h=affineHeight(state,T,sample.time),tau=input.reserveTime;
    bound(h.constant,h.coefficient,input.heightBounds.min,input.heightBounds.max,'height',{index,time:sample.time});
    bound(h.velocityConstant,h.velocityCoefficient,-input.speedLimit,input.speedLimit,'height-speed',{index,time:sample.time});
    for(let side=0;side<2;side++){
      const leg=sample.legs[side],detail={index,time:sample.time,side};
      if(!Object.values(leg).every(finite)||leg.horizontalSq<0||leg.minDistance<=Math.abs(a-b)||leg.maxDistance>=a+b
        ||leg.minDistance>leg.maxDistance||leg.maxFlexRate<0)return fail('infeasible','invalid-leg',detail);
      const upperSq=leg.maxDistance**2-leg.horizontalSq;
      if(upperSq<0)return fail('infeasible','horizontal-reach',detail);
      const lowerSq=leg.minDistance**2-leg.horizontalSq;
      const high=Math.sqrt(upperSq),low=Math.sqrt(Math.max(0,lowerSq));
      const ceiling=high-leg.verticalOffset,floor=low-leg.verticalOffset;
      bound(h.constant,h.coefficient,floor,ceiling,'leg-reach',detail);
      if(tau>0){
        if(high===0)return fail('uncertain','horizontal-reach-tangent',detail);
        // At equality the active lower branch changes. Even horizontalDot=0
        // needs second-order horizontal motion not supplied by this contract.
        if(lowerSq===0)return fail('uncertain','lower-branch-tangent',detail);
        const ceilingVelocity=-leg.verticalVelocityOffset-leg.horizontalDot/high;
        const floorVelocity=-leg.verticalVelocityOffset-(lowerSq>0?leg.horizontalDot/low:0);
        bound(h.constant+tau*h.velocityConstant,h.coefficient+tau*h.velocityCoefficient,
          floor+tau*floorVelocity,ceiling+tau*ceilingVelocity,'tangent-reserve',detail);
      }
      const vertical=[h.constant+leg.verticalOffset,h.coefficient];
      const verticalVelocity=[h.velocityConstant+leg.verticalVelocityOffset,h.velocityCoefficient];
      const distanceSquared=add([leg.horizontalSq],multiply(vertical,vertical));
      const radialProduct=add([leg.horizontalDot],multiply(vertical,verticalVelocity));
      const cosineNumerator=add(distanceSquared,[-a*a-b*b]);
      const sineDenominator=add([4*a*a*b*b],scale(multiply(cosineNumerator,cosineNumerator),-1));
      const p=add(scale(sineDenominator,leg.maxFlexRate**2),scale(multiply(radialProduct,radialProduct),-4));
      polynomials.push({p:leg.maxFlexRate===0?radialProduct:p,equality:leg.maxFlexRate===0,name:'knee-rate',detail,direct(target){
        const dy=vertical[0]+vertical[1]*target,v=verticalVelocity[0]+verticalVelocity[1]*target;
        const d2=leg.horizontalSq+dy*dy,dot=leg.horizontalDot+dy*v;
        return {dot,den:4*a*a*b*b-(d2-a*a-b*b)**2,limit:leg.maxFlexRate,
          dotRoundoff:128*EPS*(Math.abs(leg.horizontalDot)+Math.abs(dy*verticalVelocity[0])+Math.abs(dy*verticalVelocity[1]*target))};
      }});
    }
  }
  for(const c of constraints){
    diagnostics.affineConstraints++;
    if(!finite(c.constant)||!finite(c.coefficient))return fail('uncertain','nonfinite-affine',c);
    if(c.coefficient===0){
      diagnostics.fixedConstraints++;
      if(c.constant< -roundoff(c.constant))return fail('infeasible',c.name,{...c,fixed:true});
      continue;
    }
    const edge=-c.constant/c.coefficient;
    intervals=intervals.map(r=>c.coefficient>0?{min:Math.max(r.min,edge),max:r.max}:{min:r.min,max:Math.min(r.max,edge)}).filter(r=>r.min<=r.max);
    if(!intervals.length)return fail('infeasible',c.name,c.detail);
  }
  for(const constraint of polynomials){
    diagnostics.rateConstraints++;
    const accepted:SupportHeightInterval[]=[];
    for(const range of intervals){
      const centre=(range.min+range.max)/2,radius=(range.max-range.min)/2;
      const targetAt=(x:number)=>x===-1?range.min:x===1?range.max:centre+radius*x;
      const p=substitute(constraint.p,centre,radius),magnitude=Math.max(...p.map(Math.abs));
      if(!finite(magnitude))return fail('uncertain','nonfinite-rate-polynomial',constraint.detail);
      if(radius===0){
        const value=constraint.direct(centre);
        if(value.den>0&&(constraint.equality?Math.abs(value.dot)<=value.dotRoundoff:
          2*Math.abs(value.dot)/Math.sqrt(value.den)<=value.limit+roundoff(value.limit)))accepted.push(range);
        continue;
      }
      if(constraint.equality){
        const isolated=equalityRoots(p);if(isolated.status!=='clear')return fail('uncertain',isolated.reason,constraint.detail);
        if(isolated.all)accepted.push(range);
        else for(const x of isolated.values){const target=targetAt(x);accepted.push({min:target,max:target});}
        continue;
      }
      if(magnitude===0){accepted.push(range);continue;}
      if(p.length===1){
        diagnostics.fixedConstraints++;
        const value=constraint.direct(centre);
        const rate=value.den>0?2*Math.abs(value.dot)/Math.sqrt(value.den):Infinity;
        if(finite(rate)&&rate<=value.limit+roundoff(rate,value.limit))accepted.push(range);
        continue;
      }
      const isolated=roots(p,diagnostics);if(isolated.status!=='clear')return fail('uncertain',isolated.reason,constraint.detail);
      const cuts=[-1,...isolated.values.filter(x=>x>-1&&x<1),1].sort((a,b)=>a-b);
      for(let i=1;i<cuts.length;i++)if(evaluate(p,(cuts[i-1]+cuts[i])/2)>0)
        accepted.push({min:targetAt(cuts[i-1]),max:targetAt(cuts[i])});
      // A boundary root can be the only legal target even when no adjacent
      // open interval is feasible. Keep directly verified isolated points.
      for(const x of isolated.values){
        const target=targetAt(x),value=constraint.direct(target);
        const rate=value.den>0?2*Math.abs(value.dot)/Math.sqrt(value.den):Infinity;
        if(finite(rate)&&rate<=value.limit+roundoff(rate,value.limit))accepted.push({min:target,max:target});
      }
    }
    accepted.sort((a,b)=>a.min-b.min);
    intervals=[];
    for(const r of accepted){
      const last=intervals.at(-1);
      if(last&&r.min<=last.max)last.max=Math.max(last.max,r.max);else intervals.push(r);
    }
    if(!intervals.length)return fail('infeasible',constraint.name,constraint.detail);
  }
  let target=NaN,distance=Infinity;
  for(const r of intervals){
    const value=Math.max(r.min,Math.min(r.max,input.nominalTarget)),d=Math.abs(value-input.nominalTarget);
    if(d<distance){target=value;distance=d;}
  }
  if(!finite(target))return fail('uncertain','nonfinite-selected-target');
  for(const c of constraints)if(c.constant+c.coefficient*target< -roundoff(c.constant,c.coefficient*target))
    return fail('uncertain','selected-affine-roundoff',c);
  // Re-evaluate unexpanded equations at the selected target. This catches
  // coefficient cancellation/root-rounding without broadening rate limits.
  for(const sample of input.samples){
    const h=affineHeight(state,T,sample.time),height=h.constant+h.coefficient*target,
      velocity=h.velocityConstant+h.velocityCoefficient*target;
    for(let side=0;side<2;side++){
      const l=sample.legs[side],dy=height+l.verticalOffset,d2=l.horizontalSq+dy*dy;
      const den=4*a*a*b*b-(d2-a*a-b*b)**2;
      const dot=l.horizontalDot+dy*(velocity+l.verticalVelocityOffset);
      if(![dy,d2,den,dot].every(finite)||dy< -roundoff(dy)||d2<l.minDistance**2-roundoff(d2)||d2>l.maxDistance**2+roundoff(d2)||den<=0)
        return fail('uncertain','selected-reach-roundoff',{time:sample.time,side,dy,d2,den});
      const rate=2*Math.abs(dot)/Math.sqrt(den);
      if(!finite(rate)||rate>l.maxFlexRate+roundoff(rate,l.maxFlexRate))return fail('uncertain','selected-rate-roundoff',{time:sample.time,side,rate,limit:l.maxFlexRate});
    }
  }
  const certificate=advanceHeightHermite(state,{height:target,velocity:0},T,dt,input.heightBounds);
  if(certificate.status!=='accepted'||certificate.maxAbsVelocity>input.speedLimit+roundoff(input.speedLimit))
    return fail('uncertain','consumed-height-certificate',certificate);
  diagnostics.selectedDistance=distance;
  return {status:'clear',target,intervals,diagnostics,sample(time){
    if(!finite(time)||time<0||time>dt)return null;
    if(time===0)return {...state};
    const h=affineHeight(state,T,time);
    return {height:h.constant+h.coefficient*target,velocity:h.velocityConstant+h.velocityCoefficient*target};
  }};
}
