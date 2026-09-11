/** Pure paired airborne configuration. No rig mutation, root integration or contact clock. */
import { Quaternion, Vector3 } from 'three';
import { cloneRequest, type PairPose, type PairRequest } from './contact-pose';

export interface LegConfiguration {
  /** Root-yaw-local hip-to-ankle direction and its tangent derivative. */
  direction:Vector3; directionVelocity:Vector3;
  flex:number; flexVelocity:number;
  /** World foot orientation and world angular velocity in radians/second. */
  footRotation:Quaternion; footAngularVelocity:Vector3;
}
export type PairConfiguration=[LegConfiguration,LegConfiguration];
export interface ConfigurationDimensions { a:number; b:number; hipHalfWidth:number; sole:Vector3 }
export interface ConfigurationFailure { status:'invalid'|'singular'; reason:string; side?:number }
export type ConfigurationResult={status:'clear';configuration:PairConfiguration}|ConfigurationFailure;
export type ConstructedConfiguration={status:'clear';request:PairRequest}|ConfigurationFailure;
const UP=new Vector3(0,1,0);
const finiteVector=(v:Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
const unitQuaternion=(q:Quaternion)=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z)&&Number.isFinite(q.w)&&Math.abs(q.lengthSq()-1)<1e-8;
const validDimensions=(d:ConfigurationDimensions)=>Number.isFinite(d.a)&&Number.isFinite(d.b)&&d.a>0&&d.b>0&&
  d.a+d.b-.002>Math.abs(d.a-d.b)+.01&&Number.isFinite(d.hipHalfWidth)&&d.hipHalfWidth>=0&&finiteVector(d.sole);
const validRequest=(p:PairRequest)=>finiteVector(p.root)&&finiteVector(p.hipsLocal)&&Number.isFinite(p.visualYaw)&&unitQuaternion(p.hipsRotation)&&
  p.soles.every(s=>finiteVector(s.position)&&unitQuaternion(s.rotation));
function validLeg(c:LegConfiguration):boolean {
  return finiteVector(c.direction)&&Math.abs(c.direction.lengthSq()-1)<1e-8&&finiteVector(c.directionVelocity)&&
    Math.abs(c.direction.dot(c.directionVelocity))<1e-8*(1+c.directionVelocity.length())&&
    Number.isFinite(c.flex)&&c.flex>=0&&c.flex<=Math.PI&&Number.isFinite(c.flexVelocity)&&
    unitQuaternion(c.footRotation)&&finiteVector(c.footAngularVelocity);
}
const copyLeg=(c:LegConfiguration):LegConfiguration=>({direction:c.direction.clone(),directionVelocity:c.directionVelocity.clone(),
  flex:c.flex,flexVelocity:c.flexVelocity,footRotation:c.footRotation.clone(),footAngularVelocity:c.footAngularVelocity.clone()});
function hipPosition(p:PairRequest,d:ConfigurationDimensions,i:number):Vector3 {
  const yaw=new Quaternion().setFromAxisAngle(UP,p.visualYaw),hipsQ=yaw.clone().multiply(p.hipsRotation);
  return new Vector3((i===0?1:-1)*d.hipHalfWidth,0,0).applyQuaternion(hipsQ).add(p.hipsLocal.clone().applyQuaternion(yaw)).add(p.root);
}
function rotationLog(q:Quaternion):Vector3 {
  const p=q.clone();
  // Select the same shortest chart for q and -q, including a deterministic pi tie.
  if(p.w<0||(p.w===0&&(p.x<0||(p.x===0&&(p.y<0||(p.y===0&&p.z<0))))))p.set(-p.x,-p.y,-p.z,-p.w);
  const length=Math.hypot(p.x,p.y,p.z);
  return length===0?new Vector3():new Vector3(p.x,p.y,p.z).multiplyScalar(2*Math.atan2(length,p.w)/length);
}
function rotationExp(r:Vector3):Quaternion {
  const theta=r.length(),t2=theta*theta;
  const scale=theta<1e-5?.5-t2/48+t2*t2/3840:Math.sin(theta*.5)/theta;
  return new Quaternion(r.x*scale,r.y*scale,r.z*scale,Math.cos(theta*.5));
}
function leftJacobian(r:Vector3,v:Vector3,inverse=false):Vector3 {
  const theta=r.length(),t2=theta*theta,cross=r.clone().cross(v),cross2=r.clone().cross(cross);
  if(inverse){
    const coefficient=theta<1e-4?1/12+t2/720+t2*t2/30240:(1-.5*theta/Math.tan(.5*theta))/t2;
    return v.clone().addScaledVector(cross,-.5).addScaledVector(cross2,coefficient);
  }
  const a=theta<1e-4?.5-t2/24+t2*t2/720:(1-Math.cos(theta))/t2;
  const b=theta<1e-4?1/6-t2/120+t2*t2/5040:(theta-Math.sin(theta))/(theta*t2);
  return v.clone().addScaledVector(cross,a).addScaledVector(cross2,b);
}
function scalarHermite(p:number,v:number,end:number,endV:number,T:number,dt:number):{position:number;velocity:number} {
  if(dt===0)return {position:p,velocity:v};
  if(dt>=T)return {position:end+(dt-T)*endV,velocity:endV};
  const u=dt/T,u2=u*u,u3=u2*u;
  return {position:(2*u3-3*u2+1)*p+(u3-2*u2+u)*T*v+(-2*u3+3*u2)*end+(u3-u2)*T*endV,
    velocity:((6*u2-6*u)*p+(3*u2-4*u+1)*T*v+(-6*u2+6*u)*end+(3*u2-2*u)*T*endV)/T};
}
function vectorHermite(p:Vector3,v:Vector3,end:Vector3,endV:Vector3,T:number,dt:number):{position:Vector3;velocity:Vector3} {
  const x=scalarHermite(p.x,v.x,end.x,endV.x,T,dt),y=scalarHermite(p.y,v.y,end.y,endV.y,T,dt),z=scalarHermite(p.z,v.z,end.z,endV.z,T,dt);
  return {position:new Vector3(x.position,y.position,z.position),velocity:new Vector3(x.velocity,y.velocity,z.velocity)};
}

/** Secant/tangent estimates from accepted poses, not instantaneous measured rates.
 * The caller can replace these estimates with derivatives of its accepted trajectory.
 */
export function captureConfiguration(pose:PairPose,previousPose:PairPose|null,dt:number):ConfigurationResult {
  if(pose.status!=='clear'||!validRequest(pose.request)||(previousPose&&(previousPose.status!=='clear'||!validRequest(previousPose.request)))||
    !Number.isFinite(dt)||dt<=0)return {status:'invalid',reason:'invalid-capture'};
  const configuration:LegConfiguration[]=[];
  for(let i=0;i<2;i++){
    const leg=pose.legs[i],delta=leg.frames.ankle.position.clone().sub(leg.frames.hip.position);
    if(!finiteVector(delta)||delta.length()<1e-10)return {status:'singular',reason:'zero-captured-leg',side:i};
    const direction=delta.normalize().applyAxisAngle(UP,-pose.request.visualYaw),directionVelocity=new Vector3();
    let flexVelocity=0;const footAngularVelocity=new Vector3(),footRotation=pose.request.soles[i].rotation.clone();
    if(previousPose){
      const prior=previousPose.legs[i],oldDelta=prior.frames.ankle.position.clone().sub(prior.frames.hip.position);
      if(!finiteVector(oldDelta)||oldDelta.length()<1e-10)return {status:'singular',reason:'zero-previous-leg',side:i};
      const oldDirection=oldDelta.normalize().applyAxisAngle(UP,-previousPose.request.visualYaw);
      directionVelocity.copy(direction).sub(oldDirection).divideScalar(dt);
      directionVelocity.addScaledVector(direction,-direction.dot(directionVelocity));
      flexVelocity=(leg.flex-prior.flex)/dt;
      footAngularVelocity.copy(rotationLog(footRotation.clone().multiply(previousPose.request.soles[i].rotation.clone().invert()))).divideScalar(dt);
    }
    const c={direction,directionVelocity,flex:leg.flex,flexVelocity,footRotation,footAngularVelocity};
    if(!validLeg(c))return {status:'invalid',reason:'nonfinite-capture',side:i};configuration.push(c);
  }
  return {status:'clear',configuration:configuration as PairConfiguration};
}

/** Cartesian targets are preferences only. Clamp their reference distance to the
 * existing IK reserve before deriving flex; no applied configuration is clamped.
 */
export function preferredConfiguration(request:PairRequest,dimensions:ConfigurationDimensions):ConfigurationResult {
  if(!validDimensions(dimensions)||!validRequest(request))return {status:'invalid',reason:'invalid-preference'};
  const configuration:LegConfiguration[]=[];
  for(let i=0;i<2;i++){
    const sole=request.soles[i],hip=hipPosition(request,dimensions,i);
    const delta=sole.position.clone().sub(dimensions.sole.clone().applyQuaternion(sole.rotation)).sub(hip),length=delta.length();
    if(!finiteVector(delta)||!Number.isFinite(length)||length<1e-10)return {status:'singular',reason:'zero-preferred-leg',side:i};
    const distance=Math.min(dimensions.a+dimensions.b-.002,Math.max(Math.abs(dimensions.a-dimensions.b)+.01,length));
    const cosine=(distance*distance-dimensions.a*dimensions.a-dimensions.b*dimensions.b)/(2*dimensions.a*dimensions.b);
    const flex=Math.acos(Math.max(-1,Math.min(1,cosine)));
    const c={direction:delta.divideScalar(length).applyAxisAngle(UP,-request.visualYaw),directionVelocity:new Vector3(),flex,flexVelocity:0,
      footRotation:sole.rotation.clone(),footAngularVelocity:new Vector3()};
    if(!validLeg(c))return {status:'invalid',reason:'nonfinite-preference',side:i};configuration.push(c);
  }
  return {status:'clear',configuration:configuration as PairConfiguration};
}

/** Both legs consume one Hermite time. Direction curves are normalized with their
 * exact tangent derivative. q=Exp(r)*q0 uses world angular velocity J_left(r)*r_dot.
 */
export function advanceConfiguration(current:PairConfiguration,target:PairConfiguration,remaining:number,dt:number,
  certifiedFlex?:readonly [{value:number;velocity:number},{value:number;velocity:number}]):ConfigurationResult {
  if(!Number.isFinite(remaining)||remaining<=0||!Number.isFinite(dt)||dt<0)return {status:'invalid',reason:'invalid-time'};
  const configuration:LegConfiguration[]=[];
  for(let i=0;i<2;i++){
    const a=current[i],b=target[i];if(!validLeg(a)||!validLeg(b))return {status:'invalid',reason:'invalid-configuration',side:i};
    if(dt===0){configuration.push(copyLeg(a));continue;}
    // A sufficient nonvanishing certificate: the four cubic Bezier controls all
    // lie in a common strict hemisphere. Failure is conservative, not anatomical.
    const axis=a.direction.clone().add(b.direction);
    if(axis.length()<1e-10)return {status:'singular',reason:'antipodal-direction',side:i};axis.normalize();
    const controls=[a.direction,a.direction.clone().addScaledVector(a.directionVelocity,remaining/3),
      b.direction.clone().addScaledVector(b.directionVelocity,-remaining/3),b.direction];
    if(controls.some(c=>c.dot(axis)<=1e-8))return {status:'singular',reason:'uncertified-direction-curve',side:i};
    const curve=vectorHermite(a.direction,a.directionVelocity,b.direction,b.directionVelocity,remaining,dt),length=curve.position.length();
    if(!Number.isFinite(length)||length<1e-10)return {status:'singular',reason:'zero-direction-curve',side:i};
    const direction=curve.position.divideScalar(length),directionVelocity=curve.velocity.addScaledVector(direction,-direction.dot(curve.velocity)).divideScalar(length);
    // The caller may supply samples of a separately certified C1 flex trajectory;
    // direction and ankle orientation still consume the same physical interval.
    const flex=certifiedFlex?{position:certifiedFlex[i].value,velocity:certifiedFlex[i].velocity}:
      scalarHermite(a.flex,a.flexVelocity,b.flex,b.flexVelocity,remaining,dt);
    const delta=rotationLog(b.footRotation.clone().multiply(a.footRotation.clone().invert()));
    const endpointVelocity=leftJacobian(delta,b.footAngularVelocity,true);
    const rotationCurve=vectorHermite(new Vector3(),a.footAngularVelocity,delta,endpointVelocity,remaining,Math.min(dt,remaining));
    let footRotation:Quaternion,footAngularVelocity:Vector3;
    if(dt>=remaining){
      footRotation=rotationExp(b.footAngularVelocity.clone().multiplyScalar(dt-remaining)).multiply(b.footRotation);
      footAngularVelocity=b.footAngularVelocity.clone();
    }else{
      footRotation=rotationExp(rotationCurve.position).multiply(a.footRotation);
      footAngularVelocity=leftJacobian(rotationCurve.position,rotationCurve.velocity);
    }
    const c={direction,directionVelocity,flex:flex.position,flexVelocity:flex.velocity,footRotation,footAngularVelocity};
    if(!validLeg(c))return {status:'invalid',reason:'nonfinite-or-out-of-range-configuration',side:i};configuration.push(c);
  }
  return {status:'clear',configuration:configuration as PairConfiguration};
}

/** FK emits both actual soles under one shared root/hips request. The request's
 * pole directions are retained for the caller's final IK and geometry gates.
 */
export function constructConfiguration(configuration:PairConfiguration,baseRequest:PairRequest,
  dimensions:ConfigurationDimensions):ConstructedConfiguration {
  if(!validDimensions(dimensions)||!validRequest(baseRequest))return {status:'invalid',reason:'invalid-construction'};
  const request=cloneRequest(baseRequest),{a,b}=dimensions;
  for(let i=0;i<2;i++){
    const c=configuration[i];if(!validLeg(c))return {status:'invalid',reason:'invalid-configuration',side:i};
    const distance=Math.sqrt((a-b)**2+4*a*b*Math.cos(c.flex*.5)**2);
    if(distance>a+b-.002+1e-10||distance<Math.abs(a-b)+.01-1e-10)return {status:'invalid',reason:'configuration-outside-ik-reserve',side:i};
    const ankle=hipPosition(request,dimensions,i).add(c.direction.clone().applyAxisAngle(UP,request.visualYaw).multiplyScalar(distance));
    request.soles[i]={position:ankle.add(dimensions.sole.clone().applyQuaternion(c.footRotation)),rotation:c.footRotation.clone()};
    if(!finiteVector(request.soles[i].position))return {status:'invalid',reason:'nonfinite-constructed-sole',side:i};
  }
  return {status:'clear',request};
}
