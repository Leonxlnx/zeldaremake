/** Paired free-leg construction. No contact, physics or rig state is mutated. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { GroundSampler } from './animation';
import { MOVE, strideLength, type MotionState } from './locomotion';
import { cloneRequest, cloneSole, interpolateRequest, type PairPose, type PairRequest, type SolePose } from './contact-pose';
import { advanceHeightHermite, type HeightState } from './contact-height';
import { projectLandingXZ } from './contact-landing';
import { planFlex, advanceFlex, type FlexState } from './contact-flex';
import { captureConfiguration, preferredConfiguration, advanceConfiguration, constructConfiguration,
  type ConfigurationDimensions, type PairConfiguration } from './air-configuration';

const UP=new Vector3(0,1,0),clamp=MathUtils.clamp;
export interface PairedAirState {
  configuration:PairConfiguration; remaining:number; preparing:boolean;
  worldHeight:{height:number;velocity:number};
  prepared:null|{request:PairRequest;velocities:[Vector3,Vector3];recoveryDuration:number;moving:boolean};
}
export interface PairedAirInput {
  state:MotionState; dt:number; yaw:number; authoredYaw:number;
  hipsLocal:Vector3; hipsRotation:Quaternion; authored:[SolePose,SolePose];
  accepted:PairPose; previous:PairPose|null; height:HeightState;
  footVelocity:[Vector3,Vector3]; hipHeight:number; dimensions:ConfigurationDimensions; ground:GroundSampler;
}

function planar(p:number,v:number,end:number,T:number,t:number){
  const ramp=.15*T,cruise=(end-p-.5*v*ramp)/(T-ramp),time=Math.min(t,T);
  if(time<=ramp)return {position:p+v*time+.5*(cruise-v)*time*time/ramp,velocity:v+(cruise-v)*time/ramp};
  if(time<=T-ramp)return {position:p+.5*(v+cruise)*ramp+cruise*(time-ramp),velocity:cruise};
  const left=T-time;return {position:end-.5*cruise*left*left/ramp,velocity:cruise*left/ramp};
}
function hip(base:PairRequest,side:number,dimensions:ConfigurationDimensions){
  const rootQ=new Quaternion().setFromAxisAngle(UP,base.visualYaw);
  return new Vector3(side*dimensions.hipHalfWidth,0,0).applyQuaternion(rootQ.clone().multiply(base.hipsRotation))
    .add(base.hipsLocal.clone().applyQuaternion(rootQ)).add(base.root);
}
/** World velocity of each generated sole. Root travel remains the actual fixed
 * step displacement; local height/direction/flex and ankle angular derivatives
 * come from the continuous configuration trajectory.
 */
function velocities(config:PairConfiguration,base:PairRequest,previous:PairRequest,
  dimensions:ConfigurationDimensions,dt:number,heightVelocity:number,segment={endpoint:base,duration:dt}):[Vector3,Vector3]{
  const q=new Quaternion().setFromAxisAngle(UP,base.visualYaw),rootVelocity=base.root.clone().sub(previous.root).divideScalar(dt);
  const yawRate=Math.atan2(Math.sin(base.visualYaw-previous.visualYaw),Math.cos(base.visualYaw-previous.visualYaw))/dt;
  const omega=UP.clone().multiplyScalar(yawRate);
  const qa=previous.hipsRotation,qb=segment.endpoint.hipsRotation.clone();
  let dot=qa.dot(qb);if(dot<0){qb.set(-qb.x,-qb.y,-qb.z,-qb.w);dot=-dot;}
  let localOmega:Vector3;
  if(dot>=.9995){
    // Three.js uses normalized linear interpolation in this small-angle range.
    // Its angular rate is not the average logarithmic rotation over the interval.
    const a=qa.toArray(),b=qb.toArray(),c=base.hipsRotation.toArray(),u=dt/segment.duration;
    const difference=b.map((v,i)=>v-a[i]);
    const length=Math.hypot(...a.map((v,i)=>v+u*difference[i]));
    const projection=c.reduce((sum,v,i)=>sum+v*difference[i],0);
    const derivative=difference.map((v,i)=>(v-c[i]*projection)/(length*segment.duration));
    const angular=new Quaternion(derivative[0],derivative[1],derivative[2],derivative[3]).multiply(base.hipsRotation.clone().invert());
    localOmega=new Vector3(angular.x,angular.y,angular.z).multiplyScalar(2);
  }else{
    const delta=qb.multiply(qa.clone().invert()),sine=Math.hypot(delta.x,delta.y,delta.z);
    localOmega=new Vector3(delta.x,delta.y,delta.z).multiplyScalar(2*Math.atan2(sine,delta.w)/(sine*segment.duration));
  }
  const hipsOmega=localOmega.applyQuaternion(q).add(omega);
  const localVelocity=base.hipsLocal.clone().sub(previous.hipsLocal).divideScalar(dt);localVelocity.y=heightVelocity;
  const centreVelocity=rootVelocity.add(omega.clone().cross(base.hipsLocal.clone().applyQuaternion(q)))
    .add(localVelocity.applyQuaternion(q));
  return config.map((leg,i)=>{
    // Exact derivative of the same yaw/local-hips interpolation used by the
    // sampled request, including the tiny authored hips twist and roll.
    const offset=new Vector3((i===0?1:-1)*dimensions.hipHalfWidth,0,0).applyQuaternion(q.clone().multiply(base.hipsRotation));
    const hv=centreVelocity.clone().add(hipsOmega.clone().cross(offset));
    const d=Math.sqrt(dimensions.a**2+dimensions.b**2+2*dimensions.a*dimensions.b*Math.cos(leg.flex));
    const dd=-dimensions.a*dimensions.b*Math.sin(leg.flex)*leg.flexVelocity/d;
    const relative=leg.direction.clone().multiplyScalar(d).applyQuaternion(q);
    const local=leg.directionVelocity.clone().multiplyScalar(d).addScaledVector(leg.direction,dd).applyQuaternion(q);
    const sole=dimensions.sole.clone().applyQuaternion(leg.footRotation);
    return hv.add(omega.clone().cross(relative)).add(local).add(leg.footAngularVelocity.clone().cross(sole));
  }) as [Vector3,Vector3];
}
function endpointRates(config:PairConfiguration,base:PairRequest,dimensions:ConfigurationDimensions,
  bodyVelocity:Vector3,soleVelocity:[Vector3,Vector3]){
  const inverse=new Quaternion().setFromAxisAngle(UP,-base.visualYaw);
  config.forEach((leg,i)=>{
    const d=Math.sqrt(dimensions.a**2+dimensions.b**2+2*dimensions.a*dimensions.b*Math.cos(leg.flex));
    const v=soleVelocity[i].clone().sub(bodyVelocity).applyQuaternion(inverse);
    const radial=v.dot(leg.direction);
    leg.directionVelocity.copy(v).addScaledVector(leg.direction,-radial).divideScalar(d);
    leg.flexVelocity=-d*radial/(dimensions.a*dimensions.b*Math.sin(leg.flex));
    leg.footAngularVelocity.set(0,0,0);
  });
}

export function planPairedAir(previousState:PairedAirState|null,input:PairedAirInput){
  const {state:s,dt,dimensions,ground}=input;
  const capture=previousState?{status:'clear' as const,configuration:previousState.configuration}:
    captureConfiguration(input.accepted,input.previous,dt);
  if(capture.status!=='clear')return {status:'air-capture' as const,detail:capture};
  const root=new Vector3(s.x,s.y,s.z),velocity=new Vector3(s.vx,0,s.vz);
  const moving=s.moveWeight>.05&&s.speed>.01;
  const impact=s.vy<0?(s.vy+Math.sqrt(s.vy*s.vy+2*MOVE.gravity*Math.max(0,s.y-ground(s.x,s.z))))/MOVE.gravity:Infinity;
  const preparing=impact<.16;
  // impact is measured from the NEW physical state, while capture is the
  // previous accepted configuration. Keep every curve on that accepted clock.
  const contactTime=dt+impact;
  const horizon=preparing?contactTime:Math.max(dt,previousState&&previousState.remaining>0?previousState.remaining:.12);
  // The authored impact pose already includes up to55 mm landing compression.
  // Plan that same pose in advance, instead of aiming at the taller recovered stance.
  const impactStrength=s.vy<0?clamp(Math.sqrt(s.vy*s.vy+2*MOVE.gravity*Math.max(0,s.y-ground(s.x,s.z)))/MOVE.jumpSpeed,0,1):0;
  const groundedHeight=input.hipHeight-.035-.04*s.moveWeight-.01*s.runWeight-.055*impactStrength;
  const heightTarget=preparing?groundedHeight:input.hipsLocal.y;
  const height=advanceHeightHermite(input.height,{height:heightTarget,velocity:0},horizon,dt,{min:0,max:input.hipHeight+.12});
  if(height.status!=='accepted'||height.maxAbsVelocity>6+1e-6)return {status:'air-height' as const,detail:height};
  const base:PairRequest={root,visualYaw:input.yaw,hipsLocal:input.hipsLocal.clone(),hipsRotation:input.hipsRotation.clone(),
    soles:input.accepted.request.soles.map(cloneSole) as [SolePose,SolePose],poles:input.accepted.request.poles?.map(v=>v.clone()) as [Vector3,Vector3]};
  base.hipsLocal.y=height.state.height;
  let desired:PairRequest,worldTargetVelocity:[Vector3,Vector3]|null=null;
  let recoveryDuration=0;
  if(!preparing){
    desired={...cloneRequest(base),visualYaw:input.authoredYaw,hipsLocal:input.hipsLocal.clone(),soles:input.authored.map(cloneSole) as [SolePose,SolePose]};
  }else{
    const duty=MathUtils.lerp(.52,.36,s.runWeight),stride=strideLength(s.runWeight,s.stairWeight);
    recoveryDuration=duty*stride/Math.max(s.speed,.2);
    const right=new Vector3(1,0,0).applyAxisAngle(UP,input.yaw),forward=new Vector3(0,0,1).applyAxisAngle(UP,input.yaw);
    const lead=clamp(velocity.dot(forward)*recoveryDuration*.5,-.245,.245)*s.moveWeight;
    desired=cloneRequest(base);desired.root.addScaledVector(velocity,impact);desired.root.y=ground(s.x,s.z);
    desired.hipsLocal.y=groundedHeight;
    worldTargetVelocity=[new Vector3(),new Vector3()];
    for(let i=0;i<2;i++){
      const side=i===0?1:-1,recovery=moving&&i===1;
      const futureTime=impact+(recovery?recoveryDuration:0),T=dt+futureTime;
      const future=cloneRequest(desired);future.root.copy(root).addScaledVector(velocity,futureTime);future.root.y=ground(s.x,s.z);
      const rotation=new Quaternion().setFromAxisAngle(UP,input.yaw);
      const preferred=future.root.clone().addScaledVector(right,side*(dimensions.hipHalfWidth+.018)).addScaledVector(forward,lead+.025);
      preferred.y=ground(preferred.x,preferred.z);
      const centre=hip(future,side,dimensions).add(dimensions.sole.clone().applyQuaternion(rotation));
      const dy=centre.y-preferred.y;
      const reach=dimensions.a+dimensions.b-.002;
      const wantedDistance=Math.min(reach,centre.distanceTo(preferred));
      const maximumRadius=Math.sqrt(Math.max(0,wantedDistance*wantedDistance-dy*dy));
      const ramp=.15*T,speedCentre=input.accepted.request.soles[i].position.clone().addScaledVector(input.footVelocity[i],ramp*.5);
      const normal=right.clone().multiplyScalar(side);
      const projection=projectLandingXZ(preferred,{centre,minRadius:0,maxRadius:maximumRadius},
        {centre:speedCentre,radius:8*(T-ramp)},
        {normal,minimum:future.root.dot(normal)+dimensions.hipHalfWidth+.018});
      if(projection.status!=='feasible')return {status:'air-landing-region' as const,detail:{side,T,projection,preferred:preferred.toArray(),centre:centre.toArray(),maximumRadius}};
      const target=projection.target;
      if(recovery){
        const x=planar(input.accepted.request.soles[i].position.x,input.footVelocity[i].x,target.x,T,contactTime);
        const z=planar(input.accepted.request.soles[i].position.z,input.footVelocity[i].z,target.z,T,contactTime);
        target.x=x.position;target.z=z.position;target.y=ground(target.x,target.z)+.07+.10*s.runWeight;
        worldTargetVelocity[i].set(x.velocity,0,z.velocity);
      }
      desired.soles[i]={position:target,rotation};
    }
  }
  const reference=preferredConfiguration(desired,dimensions);
  if(reference.status!=='clear')return {status:'air-reference' as const,detail:reference};
  if(worldTargetVelocity)endpointRates(reference.configuration,desired,dimensions,velocity,worldTargetVelocity);
  const minimumFlex=Math.acos(((dimensions.a+dimensions.b-.002)**2-dimensions.a**2-dimensions.b**2)/(2*dimensions.a*dimensions.b));
  const maximumFlex=Math.acos(((Math.abs(dimensions.a-dimensions.b)+.01)**2-dimensions.a**2-dimensions.b**2)/(2*dimensions.a*dimensions.b));
  const plans=capture.configuration.map((leg,i)=>planFlex({value:leg.flex,velocity:leg.flexVelocity},
    {value:reference.configuration[i].flex,velocity:reference.configuration[i].flexVelocity},horizon,{min:minimumFlex,max:maximumFlex}));
  const invalid=plans.findIndex(p=>p.status!=='feasible');
  if(invalid>=0)return {status:'air-flex-plan' as const,detail:{side:invalid,plan:plans[invalid],horizon,impact,
    current:capture.configuration[invalid],target:reference.configuration[invalid],heightTarget}};
  const sampleFlex=(elapsed:number):[FlexState,FlexState]|null=>{
    const values=plans.map(p=>p.status==='feasible'?advanceFlex(p.plan,elapsed):null);
    if(values.some(p=>!p||p.status!=='clear'))return null;
    return values.map(p=>p!.status==='clear'?p!.state:{value:NaN,velocity:NaN}) as [FlexState,FlexState];
  };
  const sampled=sampleFlex(dt);
  if(!sampled)return {status:'air-flex-sample' as const,detail:{dt,horizon}};
  const advanced=advanceConfiguration(capture.configuration,reference.configuration,horizon,dt,sampled);
  if(advanced.status!=='clear')return {status:'air-configuration' as const,detail:advanced};
  const made=constructConfiguration(advanced.configuration,base,dimensions);
  if(made.status!=='clear')return {status:'air-construction' as const,detail:made};
  const speed=velocities(advanced.configuration,made.request,input.accepted.request,dimensions,dt,height.state.velocity);
  const maxSpeed=Math.max(...speed.map(v=>Math.hypot(v.x,v.z))),maxYSpeed=Math.max(...speed.map(v=>Math.abs(v.y)));
  const actualSpeed=Math.max(...made.request.soles.map((f,i)=>Math.hypot(f.position.x-input.accepted.request.soles[i].position.x,f.position.z-input.accepted.request.soles[i].position.z)/dt));
  const actualYSpeed=Math.max(...made.request.soles.map((f,i)=>Math.abs(f.position.y-input.accepted.request.soles[i].position.y)/dt));
  if(Math.max(maxSpeed,actualSpeed)>8+1e-6||Math.max(maxYSpeed,actualYSpeed)>7+1e-6)
    return {status:'air-rate' as const,detail:{maxSpeed,maxYSpeed,actualSpeed,actualYSpeed,impact}};
  const pathDiagnostic={failure:null as unknown};
  const requestAt=(u:number,endpoint:PairRequest):PairRequest|null=>{
    const elapsed=dt*u,flex=sampleFlex(elapsed);if(!flex)return null;
    const c=advanceConfiguration(capture.configuration,reference.configuration,horizon,elapsed,flex);
    const h=advanceHeightHermite(input.height,{height:heightTarget,velocity:0},horizon,elapsed,{min:0,max:input.hipHeight+.12});
    if(c.status!=='clear'||h.status!=='accepted')return null;
    const b=interpolateRequest(input.accepted.request,endpoint,u);b.hipsLocal.y=h.state.height;
    const result=constructConfiguration(c.configuration,b,dimensions);
    if(result.status!=='clear')return null;
    if(elapsed>0){
      const v=velocities(c.configuration,result.request,input.accepted.request,dimensions,elapsed,h.state.velocity,{endpoint,duration:dt});
      const planar=Math.max(...v.map(p=>Math.hypot(p.x,p.z))),vertical=Math.max(...v.map(p=>Math.abs(p.y)));
      if(planar>8+1e-6||vertical>7+1e-6){pathDiagnostic.failure={reason:'air-substep-rate',u,planar,vertical};return null;}
    }
    return result.request;
  };
  return {status:'clear' as const,request:made.request,velocities:speed,height:height.state,maxSpeed,maxYSpeed,
    recovery:preparing&&moving,recoveryDuration,impact,requestAt,pathDiagnostic,
    state:{configuration:advanced.configuration,remaining:Math.max(0,horizon-dt),preparing,
      worldHeight:{height:root.y+height.state.height,velocity:(root.y-input.accepted.request.root.y)/dt+height.state.velocity},
      prepared:preparing&&worldTargetVelocity?{request:cloneRequest(desired),velocities:worldTargetVelocity.map(v=>v.clone()) as [Vector3,Vector3],recoveryDuration,moving}:null} as PairedAirState};
}
