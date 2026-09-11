/** One support/free-foot recovery plan. No scene mutation or physics integration. */
import { Quaternion, Vector3 } from 'three';
import { cloneRequest, cloneSole, type PairRequest, type SolePose } from './contact-pose';
import { advanceConfiguration, constructConfiguration, preferredConfiguration, type PairConfiguration, type ConfigurationDimensions } from './air-configuration';
import { advanceFlex } from './contact-flex';
import { rebaseConfigurationRates } from './contact-kinematics';
import { projectRecoveryEndpoint } from './contact-recovery-endpoint';
import type { HeightState } from './contact-height';

const UP=new Vector3(0,1,0);
export interface RecoveryFrame { request:PairRequest; rootVelocity:Vector3; yawRate:number; localVelocity:Vector3; hipsOmega:Vector3 }
export interface RecoverySample { request:PairRequest; configuration:PairConfiguration; worldHeight:HeightState; velocities:[Vector3,Vector3]; localHeightVelocity:number }
export interface SupportRecoveryInput {
  configuration:PairConfiguration; worldHeight:HeightState; soles:[SolePose,SolePose]; velocities:[Vector3,Vector3];
  duration:number; fresh:boolean; dt:number; frameStart:number; frameAt:(t:number)=>RecoveryFrame; dimensions:ConfigurationDimensions;
  nextBoundaryHips:{positions:[Vector3,Vector3];velocities:[Vector3,Vector3]}|null;nextBoundaryStatus:string;
  nominalHeight:(t:number)=>HeightState; ground:(x:number,z:number)=>number;
}
function hipFrame(point:RecoveryFrame,d:ConfigurationDimensions){
  const {request:p}=point,yaw=new Quaternion().setFromAxisAngle(UP,p.visualYaw),q=yaw.clone().multiply(p.hipsRotation);
  const local=new Vector3(p.hipsLocal.x,0,p.hipsLocal.z).applyQuaternion(yaw),localV=point.localVelocity.clone();localV.y=0;localV.applyQuaternion(yaw);
  const centre=p.root.clone().add(local);centre.y=0;
  const velocity=point.rootVelocity.clone();velocity.y=0;velocity.add(localV).add(UP.clone().multiplyScalar(point.yawRate).cross(local));
  const offsets=[1,-1].map(side=>new Vector3(side*d.hipHalfWidth,0,0).applyQuaternion(q));
  return {positions:offsets.map(o=>centre.clone().add(o)) as [Vector3,Vector3],velocities:offsets.map(o=>velocity.clone().add(point.hipsOmega.clone().cross(o))) as [Vector3,Vector3]};
}
function supportHeight(sole:SolePose,d:ConfigurationDimensions,ground:SupportRecoveryInput['ground']){
  let height=-Infinity;
  for(const y of[0,.018])for(const x of[-.054,0,.054])for(const z of[-.056,.03,.116]){
    const v=new Vector3(x,y,z-d.sole.z).applyQuaternion(sole.rotation);height=Math.max(height,ground(sole.position.x+v.x,sole.position.z+v.z)-v.y);
  }return height;
}
/** Exact cubic values/derivatives; this only evaluates a plan, never clips it. */
function cubic(a:number,v:number,b:number,T:number,t:number){
  const u=t/T,c1=T*v,c2=3*(b-a)-2*c1,c3=2*(a-b)+c1;
  return {position:t===0?a:t===T?b:a+c1*u+c2*u*u+c3*u*u*u,velocity:t===0?v:t===T?0:(c1+2*c2*u+3*c3*u*u)/T};
}
function verticalCertificate(a:number,v:number,b:number,T:number){
  const c1=T*v,c2=3*(b-a)-2*c1,c3=2*(a-b)+c1,times=[0,T];
  if(c3!==0){const u=-c2/(3*c3);if(u>0&&u<1)times.push(u*T);}
  let maximum=0;for(const t of times)maximum=Math.max(maximum,Math.abs(cubic(a,v,b,T,t).velocity));
  // A ground crossing is also detected at derivative roots, not just samples.
  const valueTimes=[0,T],A=3*c3,B=2*c2,C=c1;
  if(A===0){if(B!==0){const u=-C/B;if(u>0&&u<1)valueTimes.push(u*T);}}
  else{const disc=B*B-4*A*C;if(disc>=0)for(const u of[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)])if(u>0&&u<1)valueTimes.push(u*T);}
  return {maximum,minimum:Math.min(...valueTimes.map(t=>cubic(a,v,b,T,t).position)),rateTimes:times,valueTimes};
}
const rotationConfiguration=(current:PairConfiguration,end:Quaternion):[PairConfiguration,PairConfiguration]=>{
  const copy=(target:boolean)=>current.map((c,i)=>({...c,direction:c.direction.clone(),directionVelocity:new Vector3(),flexVelocity:0,
    footRotation:target&&i===1?end.clone():c.footRotation.clone(),footAngularVelocity:target?new Vector3():c.footAngularVelocity.clone()})) as PairConfiguration;
  return [copy(false),copy(true)];
};
export function planSupportRecovery(input:SupportRecoveryInput){
  const {dimensions:d}=input,anchor=cloneSole(input.soles[0]);
  const ankle=anchor.position.clone().sub(d.sole.clone().applyQuaternion(anchor.rotation)),free=input.soles[1],v=input.velocities[1];
  let T=input.duration;
  if(!(T>0)||!Number.isFinite(T))return {status:'recovery-time' as const,detail:{T}};
  // The first contact's prepared recovery is at an apex. Its ordinary cubic
  // duration lower bound follows directly from the existing3 m/s limit.
  if(input.fresh&&Math.abs(v.y)<1e-10){const floor=supportHeight(free,d,input.ground);T=Math.max(T,1.5*Math.max(0,free.position.y-floor)/3);}
  const final=input.frameAt(T),hip1=hipFrame(final,d),rotation=new Quaternion().setFromAxisAngle(UP,final.request.visualYaw);
  const goal={position:free.position.clone().addScaledVector(new Vector3(v.x,0,v.z),T*.5),rotation};goal.position.y=supportHeight(goal,d,input.ground);
  const vertical=verticalCertificate(free.position.y,v.y,goal.position.y,T);
  if(vertical.maximum>3+1e-6||vertical.minimum<goal.position.y-1e-6)return {status:'recovery-vertical-curve' as const,detail:{T,vertical}};
  if(Math.hypot(v.x,v.z)>8+1e-6)return {status:'recovery-planar-entry' as const,detail:{velocity:v.toArray()}};
  const freeAnkle=goal.position.clone().sub(d.sole.clone().applyQuaternion(rotation)),nominal=input.nominalHeight(T);
  // Forecast through the actual physical-tick boundary after second-foot contact.
  // On its final replan this includes the exact same-tick double-support tail.
  const contactTime=input.frameStart+T,ticks=contactTime/input.dt,nearest=Math.round(ticks);
  // Canonicalize arithmetic at an explicit tick event, never a physical margin.
  const boundaryTicks=Math.abs(ticks-nearest)<=128*Number.EPSILON*Math.max(1,Math.abs(ticks))?nearest:Math.ceil(ticks);
  const boundary=boundaryTicks*input.dt;
  const tail=Math.max(0,boundary-contactTime),steps=Math.max(1,Math.ceil(tail/.004));
  const outgoing=Array.from({length:tail>0?steps+1:1},(_,i)=>{
    const time=tail>0?tail*i/steps:0,hip=hipFrame(input.frameAt(T+time),d);
    return {time,hipBase:hip.positions,hipVelocityBase:hip.velocities};
  });
  if(boundaryTicks===1){
    if(!input.nextBoundaryHips)return {status:'recovery-next-body-unavailable' as const,detail:{T,contactTime,boundary,status:input.nextBoundaryStatus}};
    // A second sample at the same boundary admits the next ordinary chord's
    // right derivative in addition to the actual outgoing handoff derivative.
    outgoing.push({time:tail,hipBase:input.nextBoundaryHips.positions,hipVelocityBase:input.nextBoundaryHips.velocities});
  }
  const endpoint=projectRecoveryEndpoint({hipBase:hip1.positions,hipVelocityBase:hip1.velocities,ankles:[ankle,freeAnkle],a:d.a,b:d.b,
    start:{value:input.configuration[0].flex,velocity:input.configuration[0].flexVelocity},duration:T,nominalHeight:nominal.height,nominalVelocity:nominal.velocity,
    heightBounds:{min:0,max:.64},flexLimit:10.75,pelvisLimit:3,outgoing:{reserveTime:input.dt,samples:outgoing}});
  if(endpoint.status!=='clear')return {status:'recovery-endpoint' as const,detail:{T,endpoint,nominal,goal}};
  const rotations=rotationConfiguration(input.configuration,rotation);let reason:unknown=null;
  const sample=(time:number):RecoverySample|null=>{
    if(Math.abs(time-T)<=1e-12)time=T; // roundoff at this explicit contact event
    if(time<0||time>T+1e-10){reason={type:'time',time,T};return null;}
    const point=input.frameAt(time),hips=hipFrame(point,d),p=cloneRequest(point.request),f=advanceFlex(endpoint.plan,time);
    if(f.status!=='clear'){reason={type:'support-flex',result:f,time};return null;}
    const dx=ankle.x-hips.positions[0].x,dz=ankle.z-hips.positions[0].z,dxv=-hips.velocities[0].x,dzv=-hips.velocities[0].z;
    const distanceSquared=d.a*d.a+d.b*d.b+2*d.a*d.b*Math.cos(f.state.value),square=distanceSquared-dx*dx-dz*dz;
    if(!(square>1e-12)){reason={type:'support-height-radicand',time,square};return null;}
    const y=Math.sqrt(square),height=ankle.y-hips.positions[0].y+y;
    const velocity=-hips.velocities[0].y+(-d.a*d.b*Math.sin(f.state.value)*f.state.velocity-dx*dxv-dz*dzv)/y;
    p.hipsLocal.y=height-p.root.y;
    const footRotation=advanceConfiguration(rotations[0],rotations[1],T,time,
      input.configuration.map(c=>({value:c.flex,velocity:0})) as [{value:number;velocity:number},{value:number;velocity:number}]);
    if(footRotation.status!=='clear'){reason={type:'foot-orientation',time,result:footRotation};return null;}
    const sy=cubic(free.position.y,v.y,goal.position.y,T,time),u=time/T;
    const position=free.position.clone().addScaledVector(new Vector3(v.x,0,v.z),time-.5*time*time/T);position.y=sy.position;
    const soleVelocity=new Vector3(v.x*(1-u),sy.velocity,v.z*(1-u));
    p.soles=[cloneSole(anchor),{position,rotation:footRotation.configuration[1].footRotation.clone()}];
    const configuration=preferredConfiguration(p,d);if(configuration.status!=='clear'){reason={type:'configuration',time,result:configuration};return null;}
    // preferences must reconstruct both actual geometries exactly. A projected
    // distance cannot make an unreachable actual endpoint acceptable.
    const reconstructed=constructConfiguration(configuration.configuration,p,d);
    if(reconstructed.status!=='clear'||p.soles.some((s,i)=>s.position.distanceTo(reconstructed.request.soles[i].position)>1e-8)){
      reason={type:'actual-reach',time,request:p};return null;
    }
    configuration.configuration[0].footAngularVelocity.set(0,0,0);
    configuration.configuration[1].footAngularVelocity.copy(footRotation.configuration[1].footAngularVelocity);
    const velocities:[Vector3,Vector3]=[new Vector3(),soleVelocity],actualHipVelocity=hips.velocities.map(x=>x.clone().addScaledVector(UP,velocity)) as [Vector3,Vector3];
    const rates=rebaseConfigurationRates(configuration.configuration,p.visualYaw,point.yawRate,actualHipVelocity,velocities,d);
    if(rates.status!=='clear'){reason={type:'configuration-rates',time,result:rates};return null;}
    if(!Number.isFinite(height)||!Number.isFinite(velocity)){reason={type:'nonfinite-height',time};return null;}
    return {request:p,configuration:rates.configuration,worldHeight:{height,velocity},velocities,localHeightVelocity:velocity-point.rootVelocity.y};
  };
  const first=sample(0);
  if(!first||Math.abs(first.worldHeight.height-input.worldHeight.height)>1e-8||Math.abs(first.worldHeight.velocity-input.worldHeight.velocity)>1e-7||
    first.configuration.some((c,i)=>Math.abs(c.flex-input.configuration[i].flex)>1e-8||Math.abs(c.flexVelocity-input.configuration[i].flexVelocity)>1e-7||
      c.direction.distanceTo(input.configuration[i].direction)>1e-8||c.directionVelocity.distanceTo(input.configuration[i].directionVelocity)>1e-7))
    return {status:'recovery-continuity' as const,detail:{reason,first,expected:input.configuration,worldHeight:input.worldHeight}};
  return {status:'clear' as const,duration:T,goal,endpoint,vertical,sample,diagnostic:()=>reason};
}
