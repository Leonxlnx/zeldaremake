/** Pure paired Link IK. Trials never mutate a rig, contact clock or geometry. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import type { Rig } from './rig';
import type { LegFrames, PairFrames } from './lower-body-clearance';

const DOWN = new Vector3(0, -1, 0), FORWARD = new Vector3(0, 0, 1);
export interface SolePose { position: Vector3; rotation: Quaternion }
export interface PairRequest {
  root: Vector3; visualYaw: number; hipsLocal: Vector3; hipsRotation: Quaternion;
  soles: [SolePose, SolePose];
  /** Optional world pole directions; omitted retains the original hips-forward solver. */
  poles?: [Vector3, Vector3];
}
export interface JointPose {
  thigh: Quaternion; knee: Quaternion; ankle: Quaternion;
  frames: LegFrames;
  distance: number; projection: number; kneeHeight: number; flex: number;
  upperDownDot: number; calfUpDot: number;
}
export interface PairPose {
  request: PairRequest; frames: PairFrames; legs: [JointPose, JointPose];
  status: 'clear' | 'unreachable' | 'singular';
}
export function cloneSole(p: SolePose): SolePose {
  return { position: p.position.clone(), rotation: p.rotation.clone() };
}
export function cloneRequest(p: PairRequest): PairRequest {
  return { root: p.root.clone(), visualYaw: p.visualYaw, hipsLocal: p.hipsLocal.clone(),
    hipsRotation: p.hipsRotation.clone(), soles: p.soles.map(cloneSole) as [SolePose, SolePose],
    ...(p.poles?{poles:p.poles.map(v=>v.clone()) as [Vector3,Vector3]}:{}) };
}
export function interpolateRequest(a: PairRequest, b: PairRequest, u: number): PairRequest {
  const p = cloneRequest(a);
  p.root.lerp(b.root, u); p.hipsLocal.lerp(b.hipsLocal, u);
  p.visualYaw += Math.atan2(Math.sin(b.visualYaw-a.visualYaw), Math.cos(b.visualYaw-a.visualYaw))*u;
  p.hipsRotation.slerp(b.hipsRotation,u);
  p.soles.forEach((f,i) => { f.position.lerp(b.soles[i].position,u); f.rotation.slerp(b.soles[i].rotation,u); });
  if(p.poles&&b.poles)p.poles.forEach((v,i)=>{
    const rotation=new Quaternion().setFromUnitVectors(v.clone().normalize(),b.poles![i].clone().normalize());
    v.applyQuaternion(new Quaternion().slerp(rotation,u)).normalize();
  });
  return p;
}

export function createPairIK(rig: Rig, applyRig:Rig=rig) {
  const a = rig.props.hipY-rig.props.kneeY, b=rig.props.kneeY-rig.props.ankleY;
  const reach=a+b-.002;
  function solve(request: PairRequest): PairPose {
    const p=cloneRequest(request), rootQ=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),p.visualYaw);
    const hipsQ=rootQ.clone().multiply(p.hipsRotation), invHips=hipsQ.clone().invert();
    const hips=p.hipsLocal.clone().applyQuaternion(rootQ).add(p.root);
    let status: PairPose['status']='clear';
    const legs=p.soles.map((sole,i):JointPose => {
      const side=i===0?1:-1;
      const hip=new Vector3(side*rig.props.hipHalfWidth,0,0).applyQuaternion(hipsQ).add(hips);
      const ankle=sole.position.clone().sub(rig.sole.clone().applyQuaternion(sole.rotation));
      const delta=ankle.clone().sub(hip).applyQuaternion(invHips), d=delta.length();
      if (!Number.isFinite(d)||d>reach+1e-9||d<Math.abs(a-b)+.01) status='unreachable';
      // The calculation is clamped only to keep a failed trial finite. It cannot be committed.
      const cd=MathUtils.clamp(d,Math.abs(a-b)+.01,a+b-.001), n=delta.normalize();
      const pole=p.poles?p.poles[i].clone().applyQuaternion(invHips).normalize():FORWARD.clone();
      const forward=pole.clone().addScaledVector(n,-pole.dot(n));
      const projection=forward.length();
      if(projection<1e-4) status='singular';
      forward.normalize();
      const flex=Math.acos(MathUtils.clamp((cd*cd-a*a-b*b)/(2*a*b),-1,1));
      const offset=Math.atan2(b*Math.sin(flex),a+b*Math.cos(flex));
      const upper=n.clone().multiplyScalar(Math.cos(offset)).addScaledVector(forward,Math.sin(offset));
      const thighQ=new Quaternion().setFromUnitVectors(DOWN,upper);
      const axis=forward.clone().cross(n).normalize().applyQuaternion(thighQ.clone().invert());
      const kneeQ=new Quaternion().setFromAxisAngle(axis,flex);
      const hipWorldQ=hipsQ.clone().multiply(thighQ), kneeWorldQ=hipWorldQ.clone().multiply(kneeQ);
      const knee=hip.clone().add(new Vector3(0,-a,0).applyQuaternion(hipWorldQ));
      const actualAnkle=knee.clone().add(new Vector3(0,-b,0).applyQuaternion(kneeWorldQ));
      const ankleQ=kneeWorldQ.clone().invert().multiply(sole.rotation);
      return { thigh:thighQ,knee:kneeQ,ankle:ankleQ,
        frames:{hip:{position:hip,rotation:hipWorldQ},knee:{position:knee,rotation:kneeWorldQ},
          ankle:{position:actualAnkle,rotation:sole.rotation.clone()}},
        distance:d,projection,kneeHeight:a*Math.sin(offset),flex,
        upperDownDot:DOWN.dot(upper),
        calfUpDot:new Vector3(0,1,0).dot(knee.clone().sub(actualAnkle).normalize().applyQuaternion(sole.rotation.clone().invert())) };
    }) as [JointPose,JointPose];
    return {request:p,legs,frames:{left:legs[0].frames,right:legs[1].frames},status};
  }
  function apply(p:PairPose) {
    if(p.status!=='clear') throw new Error(`Unaccepted paired IK: ${p.status}`);
    applyRig.root.position.copy(p.request.root); applyRig.root.rotation.y=p.request.visualYaw;
    applyRig.hips.position.copy(p.request.hipsLocal); applyRig.hips.quaternion.copy(p.request.hipsRotation);
    p.legs.forEach((l,i)=>{
      (i===0?applyRig.thighL:applyRig.thighR).quaternion.copy(l.thigh);
      (i===0?applyRig.kneeL:applyRig.kneeR).quaternion.copy(l.knee);
      (i===0?applyRig.ankleL:applyRig.ankleR).quaternion.copy(l.ankle);
    });
    applyRig.root.updateMatrixWorld(true);
  }
  /** Largest shared pelvis height allowed by both contacts, without stretching either leg. */
  function pelvis(request:PairRequest, desiredY:number, previousY:number, maxTravel:number):number|null {
    const rootQ=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),request.visualYaw);
    const hipsQ=rootQ.clone().multiply(request.hipsRotation);
    let ceiling=Infinity;
    for(let i=0;i<2;i++){
      const offset=new Vector3((i===0?1:-1)*rig.props.hipHalfWidth,0,0).applyQuaternion(hipsQ)
        .add(new Vector3(request.hipsLocal.x,0,request.hipsLocal.z).applyQuaternion(rootQ));
      const ankle=request.soles[i].position.clone().sub(rig.sole.clone().applyQuaternion(request.soles[i].rotation));
      const horizontal=Math.hypot(request.root.x+offset.x-ankle.x,request.root.z+offset.z-ankle.z);
      if(horizontal>=reach) return null;
      ceiling=Math.min(ceiling,ankle.y+Math.sqrt(reach*reach-horizontal*horizontal)-offset.y-request.root.y);
    }
    if(ceiling<previousY-maxTravel-1e-9)return null;
    return Math.min(ceiling,MathUtils.clamp(desiredY,previousY-maxTravel,previousY+maxTravel));
  }
  return {solve,apply,pelvis,a,b,reach};
}

/** Conservative effect of an uncertain common hip translation on final limb vertices.
 * Foot poses and the hips orientation are fixed. No sampled Jacobian is used as a bound.
 */
export function rootTranslationBound(p:PairPose, epsilon:number, a:number,b:number,maxRadius:number):number {
  if(epsilon===0)return 0;
  let result=0;
  for(const l of p.legs){
    const lo=l.distance-epsilon,hi=l.distance+epsilon;
    // c(d) is monotone only above sqrt(a²-b²); reject the folded singular branch.
    if(lo<=Math.max(Math.abs(a-b)+.01,Math.sqrt(Math.abs(a*a-b*b)))||hi>=a+b-.002)return Infinity;
    const dn=Math.min(2,2*epsilon/lo);
    const projected=l.projection-2*dn;
    if(projected<=1e-4)return Infinity;
    const de=Math.min(2,4*dn/projected);
    const c=(d:number)=>(a*a+d*d-b*b)/(2*d);
    const c0=c(l.distance), dc=Math.max(Math.abs(c(lo)-c0),Math.abs(c(hi)-c0));
    const t0=Math.sqrt(Math.max(0,a*a-c0*c0));
    const tlo=Math.sqrt(Math.max(0,a*a-c(lo)*c(lo))),thi=Math.sqrt(Math.max(0,a*a-c(hi)*c(hi)));
    const dt=Math.max(Math.abs(tlo-t0),Math.abs(thi-t0));
    const du=Math.min(2,(Math.abs(c0)*dn+dc+t0*de+dt)/a);
    const qNorm=Math.sqrt(Math.max(0,2*(1+l.upperDownDot-du)));
    if(qNorm<1e-4)return Infinity;
    const dqThigh=Math.min(2,2*Math.SQRT2*du/qNorm);
    const kneePosition=epsilon+a*du;
    const flex=(d:number)=>Math.acos(MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
    const dflex=Math.max(Math.abs(flex(lo)-l.flex),Math.abs(flex(hi)-l.flex));
    const dqKnee=Math.min(2,dqThigh+de+dn+dflex*.5);
    const dCalf=Math.min(2,2*kneePosition/b);
    const cuffNorm=Math.sqrt(Math.max(0,2*(1+l.calfUpDot-dCalf)));
    if(cuffNorm<1e-4)return Infinity;
    const dqCuff=Math.min(2,2*Math.SQRT2*dCalf/cuffNorm);
    result=Math.max(result,epsilon+2*maxRadius*dqThigh,kneePosition+2*maxRadius*dqKnee,2*maxRadius*dqCuff);
  }
  return result;
}
