/** Pure conversion between free-leg configuration rates and world sole velocity.
 * A frame change alters derivatives, never the accepted pose or contact state.
 */
import { Quaternion, Vector3 } from 'three';
import type { ConfigurationDimensions, ConfigurationFailure, ConfigurationResult,
  LegConfiguration, PairConfiguration } from './air-configuration';

export type SoleVelocityResult={status:'clear';velocities:[Vector3,Vector3]}|ConfigurationFailure;
const UP=new Vector3(0,1,0);
const finiteVector=(v:Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);
const finiteQuaternion=(q:Quaternion)=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&Number.isFinite(q.z)&&Number.isFinite(q.w);
const copyLeg=(c:LegConfiguration):LegConfiguration=>({direction:c.direction.clone(),directionVelocity:c.directionVelocity.clone(),
  flex:c.flex,flexVelocity:c.flexVelocity,footRotation:c.footRotation.clone(),footAngularVelocity:c.footAngularVelocity.clone()});

function frame(configuration:PairConfiguration,yaw:number,yawRate:number,worldHipVelocity:[Vector3,Vector3],dimensions:ConfigurationDimensions):
  {status:'clear';rotation:Quaternion;omega:Vector3;distances:[number,number]}|ConfigurationFailure {
  const {a,b,hipHalfWidth,sole}=dimensions;
  if(!Number.isFinite(yaw)||!Number.isFinite(yawRate)||!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0||
    !Number.isFinite(hipHalfWidth)||hipHalfWidth<0||!finiteVector(sole)||!Number.isFinite(a*b))
    return {status:'invalid',reason:'invalid-frame-or-dimensions'};
  const distances:number[]=[];
  for(let i=0;i<2;i++){
    const c=configuration[i];
    if(!finiteVector(worldHipVelocity[i])||!finiteVector(c.direction)||Math.abs(c.direction.lengthSq()-1)>=1e-8||
      !finiteVector(c.directionVelocity)||Math.abs(c.direction.dot(c.directionVelocity))>=1e-8*(1+c.directionVelocity.length())||
      !Number.isFinite(c.flex)||c.flex<0||c.flex>Math.PI||!Number.isFinite(c.flexVelocity)||
      !finiteQuaternion(c.footRotation)||Math.abs(c.footRotation.lengthSq()-1)>=1e-8||!finiteVector(c.footAngularVelocity))
      return {status:'invalid',reason:'invalid-configuration-or-hip-rate',side:i};
    // The inverse flex derivative is not defined at a fully straight/folded knee.
    if(c.flex===0||c.flex===Math.PI)return {status:'singular',reason:'singular-flex-derivative',side:i};
    const distance=Math.sqrt((a-b)**2+4*a*b*Math.cos(c.flex*.5)**2);
    if(!Number.isFinite(distance))return {status:'invalid',reason:'nonfinite-leg-distance',side:i};
    if(!(distance>0)||a*b*Math.sin(c.flex)===0)return {status:'singular',reason:'singular-leg-distance',side:i};
    distances.push(distance);
  }
  return {status:'clear',rotation:new Quaternion().setFromAxisAngle(UP,yaw),omega:UP.clone().multiplyScalar(yawRate),distances:distances as [number,number]};
}

/** The supplied hip velocities must already include root translation, local pelvis
 * motion and each hip offset's exact rotation under authored hips/root motion.
 * Foot angular velocities are world vectors and remain authoritative.
 */
export function configurationSoleVelocities(configuration:PairConfiguration,yaw:number,yawRate:number,
  worldHipVelocity:[Vector3,Vector3],dimensions:ConfigurationDimensions):SoleVelocityResult {
  const f=frame(configuration,yaw,yawRate,worldHipVelocity,dimensions);if(f.status!=='clear')return f;
  const velocities:Vector3[]=[];
  for(let i=0;i<2;i++){
    const c=configuration[i],d=f.distances[i];
    const dd=-dimensions.a*dimensions.b*Math.sin(c.flex)*c.flexVelocity/d;
    const relative=c.direction.clone().multiplyScalar(d).applyQuaternion(f.rotation);
    const local=c.directionVelocity.clone().multiplyScalar(d).addScaledVector(c.direction,dd).applyQuaternion(f.rotation);
    const sole=dimensions.sole.clone().applyQuaternion(c.footRotation);
    const velocity=worldHipVelocity[i].clone().add(f.omega.clone().cross(relative)).add(local)
      .add(c.footAngularVelocity.clone().cross(sole));
    if(!finiteVector(velocity))return {status:'invalid',reason:'nonfinite-sole-velocity',side:i};
    velocities.push(velocity);
  }
  return {status:'clear',velocities:velocities as [Vector3,Vector3]};
}

/** Re-express exact desired world sole velocities in the new hip/yaw frame.
 * Only directionVelocity and flexVelocity change. No pose normalization, velocity
 * clipping, reach projection, or zeroing of foot angular velocity is performed.
 */
export function rebaseConfigurationRates(configuration:PairConfiguration,yaw:number,yawRate:number,
  worldHipVelocity:[Vector3,Vector3],desiredWorldSoleVelocity:[Vector3,Vector3],dimensions:ConfigurationDimensions):ConfigurationResult {
  const f=frame(configuration,yaw,yawRate,worldHipVelocity,dimensions);if(f.status!=='clear')return f;
  const inverse=f.rotation.clone().invert(),result:LegConfiguration[]=[];
  for(let i=0;i<2;i++){
    if(!finiteVector(desiredWorldSoleVelocity[i]))return {status:'invalid',reason:'invalid-world-sole-rate',side:i};
    const c=copyLeg(configuration[i]),d=f.distances[i];
    const relative=c.direction.clone().multiplyScalar(d).applyQuaternion(f.rotation);
    const sole=dimensions.sole.clone().applyQuaternion(c.footRotation);
    const local=desiredWorldSoleVelocity[i].clone().sub(worldHipVelocity[i]).sub(f.omega.clone().cross(relative))
      .sub(c.footAngularVelocity.clone().cross(sole)).applyQuaternion(inverse);
    const dd=c.direction.dot(local);
    c.directionVelocity.copy(local).addScaledVector(c.direction,-dd).divideScalar(d);
    c.flexVelocity=-d*dd/(dimensions.a*dimensions.b*Math.sin(c.flex));
    if(!finiteVector(c.directionVelocity)||!Number.isFinite(c.flexVelocity))return {status:'invalid',reason:'nonfinite-rebased-rate',side:i};
    result.push(c);
  }
  return {status:'clear',configuration:result as PairConfiguration};
}
