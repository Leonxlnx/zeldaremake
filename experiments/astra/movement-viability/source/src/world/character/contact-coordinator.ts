/** One paired live contact state. Reach timing is an estimate, never an all-input proof. */
import { Euler, MathUtils, Quaternion, Vector3 } from 'three';
import type { Rig } from './rig';
import type { GroundSampler } from './animation';
import { MOVE, strideLength, type MotionState } from './locomotion';
import { createLowerBodyClearance } from './lower-body-clearance';
import { estimateStepTime, projectPlanarTarget } from './contact-timing';
import { planSwingHeight } from './contact-swing-height';
import { fitOrdinarySupportHeight, type SupportHeightLeg } from './ordinary-support-height';
import { createOrdinaryBodyCurve, rotationVector, advanceRotation, type SoleMotion } from './ordinary-body-curve';
import { contactSample, checkContactPath } from './contact-path';
import { planPairedAir, type PairedAirState } from './paired-air';
import { planContactHandoff, type HandoffState } from './contact-handoff';
import { advanceHeightHermite, type HeightState, type FlexRange } from './contact-height';
import { cloneRequest, cloneSole, createPairIK, type PairPose, type PairRequest, type SolePose } from './contact-pose';

const UP=new Vector3(0,1,0),RIGHT=new Vector3(1,0,0),TAU=2*Math.PI;
const clamp=MathUtils.clamp;
type ContactMode='planted'|'swing'|'air';
interface Foot {
  side:number; pose:SolePose; velocity:Vector3; mode:ContactMode; anchor:SolePose;
  cycle:number; startPhase:number; endPhase:number; duration:number; remaining:number;
  yaw:number; pitch:number; completing:boolean; peak:number;
  releases:number; commits:number;
  completionDuration:number; completionU:number;
  landing:boolean;
  poleYaw:number; fromPoleYaw:number; landingYaw:number;
  recovery:boolean; landingFlex:number;
}
export interface ContactInput {
  state:MotionState; hipsLocal:Vector3; hipsRotation:Quaternion;
  airborne?:[SolePose,SolePose]; dt:number;
}
const copyFoot=(f:Foot):Foot=>({...f,pose:cloneSole(f.pose),anchor:cloneSole(f.anchor),velocity:f.velocity.clone()});
/** Continuous velocity with short ramps and a broad middle swing. A zero-end cubic
 * needs >9 m/s for the authored running stride; this keeps its ordinary cadence
 * within 8 m/s without the old instantaneous moving-root velocity at lift-off.
 */
function advancePlanar(p:number,v:number,end:number,T:number,dt:number){
  const duration=T,ramp=.15*duration;
  const cruise=(end-p-.5*v*ramp)/(duration-ramp),t=Math.min(dt,duration);
  let position:number,velocity:number;
  if(t<=ramp){velocity=v+(cruise-v)*t/ramp;position=p+v*t+.5*(cruise-v)*t*t/ramp;}
  else if(t<=duration-ramp){velocity=cruise;position=p+.5*(v+cruise)*ramp+cruise*(t-ramp);}
  else{const left=duration-t;velocity=cruise*left/ramp;position=end-.5*cruise*left*left/ramp;}
  return {position,velocity,maxSpeed:Math.max(Math.abs(v),Math.abs(velocity),t>=ramp?Math.abs(cruise):0)};
}

export function createContactCoordinator(rig:Rig,ground:GroundSampler,applyRig:Rig=rig) {
  const ik=createPairIK(rig,applyRig),geometry=createLowerBodyClearance(rig);
  let feet:Foot[]=[];
  let accepted:PairPose|null=null,wasGrounded=true,visualYaw=0,phaseBias=0;
  const previousVelocity=new Vector3();
  let airState:PairedAirState|null=null,previousPair:PairPose|null=null;
  let handoffState:HandoffState|null=null,physical:MotionState|null=null;
  let lastEvents:unknown[]=[];
  let height:HeightState={height:rig.props.hipY-.035,velocity:0},sinceAir=Infinity;
  const minimumFlex=Math.acos((ik.reach*ik.reach-ik.a*ik.a-ik.b*ik.b)/(2*ik.a*ik.b));
  const maximumFlex=Math.acos(((Math.abs(ik.a-ik.b)+.01)**2-ik.a*ik.a-ik.b*ik.b)/(2*ik.a*ik.b));
  const heightGeometry={hipHalfWidth:rig.props.hipHalfWidth,a:ik.a,b:ik.b,sole:rig.sole};
  const contacts=[new Vector3(),new Vector3()];
  const diagnostics={frames:0,trials:0,substeps:0,completions:0,rejectedYaw:0,maxYawLag:0,
    maxFootSpeed:0,maxFootYSpeed:0,minimumEstimatedSupportTime:Infinity,failures:[] as unknown[],
    path:{samples:0,refinements:0,maximumSamples:0,minimumFraction:1,minimumLowerBound:Infinity,nearSamples:0}};
  function support(p:Vector3,yaw:number,pitch:number) {
    let h=ground(p.x,p.z);const cs=Math.cos(yaw),sn=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    for(const y of[0,.018])for(const x of[-.054,0,.054])for(const z of[-.056,.03,.116]){
      const oz=z-rig.sole.z,dy=y*cp-oz*sp,dz=y*sp+oz*cp;
      h=Math.max(h,ground(p.x+cs*x+sn*dz,p.z-sn*x+cs*dz)-dy);
    }return h;
  }
  function footRotation(yaw:number,pitch:number){return new Quaternion().setFromAxisAngle(UP,yaw).multiply(new Quaternion().setFromAxisAngle(RIGHT,pitch));}
  function request(input:ContactInput,draft:Foot[],yaw:number):PairRequest {
    return {root:new Vector3(input.state.x,input.state.y,input.state.z),visualYaw:yaw,
      hipsLocal:input.hipsLocal.clone(),hipsRotation:input.hipsRotation.clone(),soles:draft.map(f=>cloneSole(f.pose)) as [SolePose,SolePose],
      // Retain the small authored hips twist in a persistent contact heading frame.
      // When contact/body headings agree this is exactly the original straight gait pole.
      poles:draft.map(f=>new Vector3(0,0,1).applyQuaternion(input.hipsRotation).applyAxisAngle(UP,f.poleYaw)) as [Vector3,Vector3]};
  }
  function fail(reason:string,input:ContactInput,detail:unknown):never{
    const failure={reason,time:input.state.time,state:{...input.state},detail};diagnostics.failures.push(failure);
    // Scratch candidate abort: no failed pose is applied and no hidden visual freeze is returned.
    throw Object.assign(new Error(`Paired contact candidate failed: ${reason} at ${input.state.time.toFixed(6)}`),{failure});
  }
  function initial(input:ContactInput){
    const s=input.state;visualYaw=s.yaw;
    feet=[1,-1].map(side=>{
      const p=new Vector3(side*(rig.props.hipHalfWidth+.018),0,.025).applyAxisAngle(UP,visualYaw).add(new Vector3(s.x,s.y,s.z));
      p.y=support(p,visualYaw,0);const pose={position:p,rotation:footRotation(visualYaw,0)};
      return {side,pose,velocity:new Vector3(),mode:'planted' as const,anchor:cloneSole(pose),cycle:-Infinity,
        startPhase:s.phase,endPhase:s.phase,duration:0,remaining:0,yaw:visualYaw,pitch:0,completing:false,peak:0,releases:0,commits:0,completionDuration:0,completionU:0,landing:false,
        poleYaw:visualYaw,fromPoleYaw:visualYaw,landingYaw:visualYaw,recovery:false,landingFlex:minimumFlex};
    });
    const p=request(input,feet,visualYaw),solved=ik.solve(p),check=contactSample(geometry,solved);
    if(solved.status!=='clear'||check.status!=='clear')fail('initial-pair',input,{ik:solved.status,check});
    accepted=solved;wasGrounded=s.grounded;height={height:p.hipsLocal.y,velocity:0};physical={...s};
  }
  function begin(f:Foot,s:MotionState,phase:number,cycle:number,yaw:number,previousPhase:number,dt:number){
    f.mode='swing';f.releases++;f.cycle=cycle;f.startPhase=previousPhase;f.endPhase=s.phase+1-phase;
    f.duration=dt+(1-phase)*strideLength(s.runWeight,s.stairWeight)/Math.max(s.speed,.2);
    f.remaining=f.duration;f.completing=false;f.landing=false;f.peak=.07+.10*s.runWeight;
    f.velocity.set(0,0,0);
    f.fromPoleYaw=f.poleYaw;f.landingYaw=yaw;
  }
  /** Constant-current-velocity support exit time. It is only an early completion estimate. */
  function supportTime(p:PairPose,draft:Foot[],s:MotionState){
    const velocity=new Vector3(s.vx,0,s.vz),v2=velocity.lengthSq();if(v2<1e-8)return Infinity;
    let time=Infinity;
    for(let i=0;i<2;i++)if(draft[i].mode==='planted'){
      const target=draft[i].pose.position.clone().sub(rig.sole.clone().applyQuaternion(draft[i].pose.rotation));
      const d=p.legs[i].frames.hip.position.clone().sub(target),dot=d.dot(velocity);
      const spare=ik.reach*ik.reach-d.lengthSq();
      const discriminant=dot*dot+v2*spare;
      if(discriminant<0)return 0;
      time=Math.min(time,Math.max(0,(-dot+Math.sqrt(discriminant))/v2));
    }return time;
  }
  function finish(input:ContactInput,p:PairRequest,draft:Foot[],maxSpeed:number,maxYSpeed:number,time:number,nextHeight:HeightState,nextAir:PairedAirState|null,
    requestAt?:(u:number)=>PairRequest|null,boundaries:number[]=[],handoff:HandoffState|null=null,events:unknown[]=[]){
    const right=RIGHT.clone().applyAxisAngle(UP,p.visualYaw);
    const gap=draft[0].pose.position.clone().sub(draft[1].pose.position).dot(right);
    if(gap<=1e-4)return {status:'ordering' as const,detail:{gap,request:cloneRequest(p)}};
    let final=ik.solve(p),check=contactSample(geometry,final);
    if(final.status!=='clear'||check.status!=='clear')return {status:'endpoint' as const,detail:{ik:final.status,check,time,request:cloneRequest(p)}};
    const rootDistance=p.root.distanceTo(accepted!.request.root);
    const footDistance=Math.max(...p.soles.map((f,i)=>f.position.distanceTo(accepted!.request.soles[i].position)));
    const angle=Math.max(Math.abs(p.visualYaw-accepted!.request.visualYaw),...p.soles.map((f,i)=>f.rotation.angleTo(accepted!.request.soles[i].rotation)),
      ...p.poles!.map((pole,i)=>pole.angleTo(accepted!.request.poles![i])));
    const steps=Math.max(1,Math.ceil(Math.max(rootDistance,footDistance)/.002),Math.ceil(angle/.02));
    // 48 covers hypot(8 m/s,7 m/s)*fixedStep at 2 mm spacing, including airborne travel.
    if(steps>48)return {status:'substep-budget' as const,detail:{steps}};
    const cuts=[0,...boundaries,1].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v-a[i-1]>1e-12);
    for(let i=1;i<cuts.length;i++){
      const from=cuts[i-1],to=cuts[i],pa=from===0?accepted!.request:requestAt!(from),pb=to===1?final.request:requestAt!(to);
      if(!pa||!pb)return {status:'event-trajectory' as const,detail:{from,to}};
      const a=from===0?accepted!:ik.solve(pa),b=to===1?final:ik.solve(pb);
      if(a.status!=='clear'||b.status!=='clear')return {status:'event-ik' as const,detail:{from,to,a:a.status,b:b.status}};
      const path=checkContactPath(ik,geometry,a,b,Math.max(1,Math.ceil(steps*(to-from))),diagnostics.path,requestAt?u=>requestAt(from+(to-from)*u):undefined);
      diagnostics.substeps+=path.samples;
      if(path.status!=='clear')return {status:path.status,detail:path.detail};
    }
    return {status:'clear' as const,feet:draft,pose:final,maxSpeed,maxYSpeed,time,height:nextHeight,air:nextAir,handoff,events};
  }
  function stage(input:ContactInput,yaw:number,forceComplete:boolean){
    const s={...input.state,phase:input.state.phase+phaseBias};
    const previousPhase=(physical?.phase??input.state.phase)+phaseBias;
    const dt=input.dt,draft=feet.map(copyFoot),root=new Vector3(s.x,s.y,s.z);
    if(handoffState||(s.grounded&&airState)){
      const proposed=request(input,draft,yaw);
      const plan=planContactHandoff(handoffState,{state:s,previousPhysical:physical!,dt,yaw,hipsLocal:input.hipsLocal,hipsRotation:input.hipsRotation,
        poles:proposed.poles!,accepted:accepted!,air:airState,footVelocity:feet.map(f=>f.velocity.clone()) as [Vector3,Vector3],dimensions:heightGeometry,ground,sinceAir});
      if(plan.status!=='clear')return plan;
      draft.forEach((f,i)=>{
        f.pose=cloneSole(plan.request.soles[i]);f.velocity.copy(plan.velocities[i]);
        const rotation=new Euler().setFromQuaternion(f.pose.rotation,'YXZ');f.yaw=rotation.y;f.pitch=rotation.x;
        if(plan.anchored[i]){if(f.mode!=='planted')f.commits++;f.mode='planted';f.anchor=cloneSole(plan.anchors[i]);f.completing=false;f.recovery=false;f.landing=false;}
        else{f.mode=plan.anchored.some(Boolean)?'swing':'air';f.recovery=i===1&&!!plan.state?.moving;f.completing=true;f.landing=false;f.remaining=plan.state?.remaining??0;}
      });
      const events=plan.events.map(e=>({...e,time:s.time-dt+e.time,frameOffset:e.time}));
      const result=finish(input,plan.request,draft,plan.maxSpeed,plan.maxYSpeed,Infinity,plan.height,null,plan.requestAt,plan.boundaries,plan.state,events);
      if(result.status!=='clear')return {...result,detail:{result:result.detail,trajectory:plan.diagnostic()}};
      return result;
    }
    if(!s.grounded){
      const plan=planPairedAir(airState,{state:s,dt,yaw,authoredYaw:visualYaw,hipsLocal:input.hipsLocal,
        hipsRotation:input.hipsRotation,authored:input.airborne!,accepted:accepted!,previous:previousPair,
        height,footVelocity:feet.map(f=>f.velocity.clone()) as [Vector3,Vector3],hipHeight:rig.props.hipY,dimensions:heightGeometry,ground});
      if(plan.status!=='clear')return plan;
      draft.forEach((f,i)=>{
        if(f.mode==='planted')f.releases++;
        f.mode='air';f.completing=false;f.pose=cloneSole(plan.request.soles[i]);f.velocity.copy(plan.velocities[i]);
        const poleDelta=Math.atan2(Math.sin(yaw-f.poleYaw),Math.cos(yaw-f.poleYaw));
        f.poleYaw+=clamp(poleDelta,-MOVE.turnSpeed*dt,MOVE.turnSpeed*dt);
        f.recovery=plan.recovery&&i===1;
        if(f.recovery){f.remaining=plan.impact+plan.recoveryDuration;f.duration=plan.recoveryDuration;}
      });
      const current={...input,hipsLocal:input.hipsLocal.clone()};current.hipsLocal.y=plan.height.height;
      const endpoint=request(current,draft,yaw);
      const result=finish(input,endpoint,draft,plan.maxSpeed,plan.maxYSpeed,Infinity,plan.height,plan.state,u=>plan.requestAt(u,endpoint));
      if(result.status!=='clear')return {...result,detail:{result:result.detail,trajectory:plan.pathDiagnostic.failure}};
      return result;
    }
    const heightPreferred=advanceHeightHermite(height,{height:input.hipsLocal.y,velocity:0},.12,dt,{min:0,max:rig.props.hipY+.12});
    if(heightPreferred.status!=='accepted')return {status:'height-trajectory' as const,detail:heightPreferred};
    const poseInput={...input,hipsLocal:input.hipsLocal.clone()};poseInput.hipsLocal.y=heightPreferred.state.height;
    const rootTravel=root.clone().sub(accepted!.request.root),velocity=new Vector3(s.vx,0,s.vz);
    const duty=MathUtils.lerp(.52,.36,s.runWeight),stride=strideLength(s.runWeight,s.stairWeight);
    const right=RIGHT.clone().applyAxisAngle(UP,yaw),forward=new Vector3(0,0,1).applyAxisAngle(UP,yaw);
    const moving=s.moveWeight>.05&&s.speed>.01;
    for(let i=0;i<2;i++){
      const f=draft[i],offset=i*.5,absolute=s.phase+offset,cycle=Math.floor(absolute),phase=absolute-cycle;
      if(!wasGrounded){
        // Landing starts from the actual airborne feet; neither is declared planted in mid-air.
        f.mode='swing';f.startPhase=s.phase;f.endPhase=s.phase+.04;
        if(f.recovery){
          // Its position/velocity and remaining time were prepared in flight.
          f.duration=f.completionDuration=Math.max(dt,f.remaining-dt);f.remaining=f.duration+dt;
          f.completing=true;f.completionU=.5;f.cycle=cycle-1;f.landing=false;
          f.peak=.07+.10*s.runWeight;f.anchor=cloneSole(f.pose);f.anchor.position.y=support(f.pose.position,f.yaw,f.pitch);
          f.fromPoleYaw=f.poleYaw;f.landingYaw=yaw;
          f.velocity.y=clamp(f.velocity.y,-3,3);
        }else{
        const height=Math.max(0,f.pose.position.y-support(f.pose.position,f.yaw,f.pitch));
        // The controller changes vertical velocity at impact. Adopt its grounded
        // 3 m/s foot recovery limit at this explicit transition; positions stay continuous.
        f.velocity.y=clamp(f.velocity.y,-3,3);
        // A long endpoint time with an inherited downward velocity overshoots the floor.
        // Constant-deceleration touchdown uses T=2h/|v| and preserves its initial velocity.
        const landingTime=Math.max(dt,Math.min(.12,f.velocity.y<-.001?2*height/-f.velocity.y:.12));
        f.duration=f.completionDuration=landingTime;f.remaining=landingTime+dt;
        f.completing=true;f.completionU=1;f.cycle=cycle-1;f.landing=true;
        f.fromPoleYaw=f.poleYaw;f.landingYaw=yaw;
        }
      }
      if(f.mode==='planted'&&moving&&!draft.some(other=>other.recovery)&&phase>=duty&&cycle>f.cycle)begin(f,s,phase,cycle,yaw,previousPhase,dt);
      if(f.mode==='planted'){
        f.pose=cloneSole(f.anchor);f.velocity.set(0,0,0);continue;
      }
      if(!f.completing){
        const nominal=dt+estimateStepTime(s,previousVelocity,Math.max(0,f.endPhase-s.phase)*stride,dt);
        f.remaining=moving?nominal:Math.min(.2,Math.max(dt,f.remaining-dt));
        if(!moving){f.completing=true;f.completionDuration=f.remaining;f.completionU=1;}
      }else f.remaining=Math.max(0,f.remaining-dt);
    }
    const base=request(poseInput,draft,yaw);
    const baseY=ik.pelvis(base,base.hipsLocal.y,accepted!.request.hipsLocal.y,(s.grounded?3:6)*dt);
    if(baseY!==null)base.hipsLocal.y=baseY;
    const basePose=ik.solve(base);
    // A previous free-foot target can be temporarily outside reach before it advances.
    // That is not an exhausted support leg; estimate only the committed support contacts.
    const time=supportTime(basePose,draft,s),supportHorizon=time+dt; // from the previous accepted pose
    diagnostics.minimumEstimatedSupportTime=Math.min(diagnostics.minimumEstimatedSupportTime,time);
    for(const f of draft)if(f.mode==='swing'){
      const remaining=Math.max(dt,f.remaining);
      if(forceComplete||(!f.completing&&supportHorizon<remaining+2*dt)){
        if(!f.completing){
          f.completionU=clamp((previousPhase-f.startPhase)/Math.max(.001,f.endPhase-f.startPhase),0,1);
          f.completionDuration=Math.max(dt,Math.min(remaining,Math.max(0,supportHorizon-2*dt)));
          if(f.completionU<.5)f.peak=Math.min(f.peak,f.completionDuration);
        }
        f.completing=true;
        // Finish the current step early; the actual curve/rate/reach gates decide whether it fits.
        f.remaining=Math.max(dt,Math.min(remaining,Math.max(0,supportHorizon-2*dt)));
      }
    }
    const ordinaryPaths:(((time:number)=>SoleMotion)|null)[]=[null,null];
    const ordinaryBreaks:number[]=[];
    const ordinaryEvents:{time:number;kind:string;pose:SolePose;velocity:Vector3;frameOffset:number}[]=[];
    let ordinaryPathReason:unknown=null;
    let maxSpeed=0,maxYSpeed=0;
    for(let i=0;i<2;i++){
      const f=draft[i];
      if(f.mode==='air'){
        maxSpeed=Math.max(maxSpeed,Math.hypot(f.velocity.x,f.velocity.z));
        maxYSpeed=Math.max(maxYSpeed,Math.abs(f.velocity.y));continue;
      }
      if(f.mode!=='swing')continue;
      let T=f.remaining;
      if(!(T>0))return {status:'ordinary-contact-clock' as const,detail:{side:f.side,remaining:T,foot:copyFoot(f)}};
      const footStart=cloneSole(f.pose),velocityStart=f.velocity.clone();
      const other=draft[1-i];
      if(!f.landing&&other.mode==='planted'){
        // A support-side half-plane can become unreachable before total leg length
        // expires. Solve that deadline from the current linear motion estimate.
        const normal=right.clone().multiplyScalar(f.side),v=velocity.dot(normal);
        if(v< -1e-8){
          const rootQ=new Quaternion().setFromAxisAngle(UP,yaw),hipsQ=rootQ.clone().multiply(input.hipsRotation);
          const centre=new Vector3(f.side*rig.props.hipHalfWidth,0,0).applyQuaternion(hipsQ).add(root)
            .add(rig.sole.clone().applyQuaternion(footRotation(f.yaw,f.pitch)));
          centre.y+=rig.props.hipY-.035-.04*s.moveWeight-.01*s.runWeight;
          const h=centre.y-support(f.pose.position,f.yaw,f.pitch);
          const radius=Math.sqrt(Math.max(0,ik.reach*ik.reach-h*h));
          const minimum=other.pose.position.dot(normal)+2*(rig.props.hipHalfWidth+.018);
          const deadline=(radius+centre.dot(normal)-minimum)/-v; // new-state time +dt, then existing one-tick reserve
          if(deadline<T){
            const currentU=f.completing?f.completionU+(1-f.completionU)*(1-clamp(T/Math.max(dt,f.completionDuration),0,1)):
              clamp((previousPhase-f.startPhase)/Math.max(.001,f.endPhase-f.startPhase),0,1);
            T=deadline;if(!(T>0))return {status:'ordinary-contact-deadline' as const,detail:{side:f.side,deadline}};f.remaining=T;f.completing=true;f.completionU=currentU;f.completionDuration=T;
          }
        }
      }
      const total=Math.max(.001,f.endPhase-f.startPhase);
      const u=f.completing?f.completionU+(1-f.completionU)*(1-clamp(T/Math.max(dt,f.completionDuration),0,1)):
        clamp((previousPhase-f.startPhase)/total,0,1);
      const stanceTime=duty*stride/Math.max(s.speed,.2);
      const lead=clamp(velocity.dot(forward)*stanceTime*.5,-.245,.245)*s.moveWeight;
      const rootAt=(duration:number)=>duration<=dt?accepted!.request.root.clone().lerp(root,duration/dt):root.clone().addScaledVector(velocity,duration-dt);
      const goalAt=(duration:number)=>{
        const predicted=rootAt(duration);
        const goal=f.landing||duration<dt?f.pose.position.clone().addScaledVector(f.velocity,duration*.5):
          predicted.addScaledVector(right,f.side*(rig.props.hipHalfWidth+.018)).addScaledVector(forward,lead+.025);
        if(!f.landing&&other.mode==='planted'){
          const separation=f.side*goal.clone().sub(other.pose.position).dot(right),span=2*(rig.props.hipHalfWidth+.018);
          if(separation<span)goal.addScaledVector(right,f.side*(span-separation));
        }
        goal.y=support(goal,yaw,0);return goal;
      };
      let goal=goalAt(T);
      const maximumTime=Math.max(T,Number.isFinite(supportHorizon)?supportHorizon-2*dt:T);
      const heightInput={position:f.pose.position.y,velocity:f.velocity.y,terminal:goal.y,
        apex:Math.max(f.anchor.position.y,goal.y)+f.peak,phase:u,duration:T,maximumTime,limit:3};
      const vertical=planSwingHeight(heightInput);
      if(vertical.status!=='clear')return {status:'swing-height-time' as const,detail:{side:f.side,T,u,time,heightInput,vertical}};
      if(vertical.duration>T+1e-12){
        T=vertical.duration;f.remaining=T;f.completing=true;f.completionU=u;f.completionDuration=T;goal=goalAt(T);
      }
      const predicted=rootAt(T);
      const uEnd=Math.min(1,u+(1-u)*Math.min(1,dt/T));
      const yawDelta=Math.atan2(Math.sin(yaw-f.yaw),Math.cos(yaw-f.yaw)),orientationTime=Math.min(dt,T);
      if(T<dt&&(Math.abs(yawDelta)>MOVE.turnSpeed*T+1e-9||Math.abs(f.pitch)>6*T+1e-9))
        return {status:'ordinary-contact-orientation-time' as const,detail:{side:f.side,T,yawDelta,pitch:f.pitch}};
      f.yaw+=clamp(yawDelta,-MOVE.turnSpeed*orientationTime,MOVE.turnSpeed*orientationTime);
      f.landingYaw=yaw;
      const poleBlend=MathUtils.smoothstep(uEnd,.55,1);
      const poleAngle=Math.atan2(Math.sin(f.landingYaw-f.fromPoleYaw),Math.cos(f.landingYaw-f.fromPoleYaw));
      const desiredPole=f.fromPoleYaw+poleBlend*poleAngle;
      const poleDelta=Math.atan2(Math.sin(desiredPole-f.poleYaw),Math.cos(desiredPole-f.poleYaw));
      f.poleYaw+=clamp(poleDelta,-MOVE.turnSpeed*orientationTime,MOVE.turnSpeed*orientationTime);
      const desiredPitch=MathUtils.lerp(.10,.20,s.runWeight)*Math.sin(TAU*uEnd)*Math.sin(Math.PI*uEnd)*s.moveWeight;
      f.pitch+=clamp(desiredPitch-f.pitch,-6*orientationTime,6*orientationTime);
      goal.y=support(goal,yaw,0);
      if(!f.landing){
        // The full continuous-velocity profile has cruise velocity
        // (goal-p-.5*v*ramp)/(T-ramp), so this disk enforces the whole8m/s curve.
        const ramp=.15*T,speedCentre=f.pose.position.clone().addScaledVector(f.velocity,.5*ramp);
        const rootQ=new Quaternion().setFromAxisAngle(UP,yaw),hipsQ=rootQ.clone().multiply(input.hipsRotation);
        const hip=new Vector3(f.side*rig.props.hipHalfWidth,0,0).applyQuaternion(hipsQ).add(predicted);
        const nominalHip=rig.props.hipY-.035-.04*s.moveWeight-.01*s.runWeight;
        hip.y+=nominalHip;
        const reachCentre=hip.add(rig.sole.clone().applyQuaternion(footRotation(yaw,0)));
        const vertical=reachCentre.y-goal.y;
        if(Math.abs(vertical)>=ik.reach)return {status:'touchdown-reach' as const,detail:{side:f.side,vertical}};
        const normal=right.clone().multiplyScalar(f.side);
        let minimum=predicted.dot(normal)+rig.props.hipHalfWidth;
        if(other.mode==='planted')minimum=Math.max(minimum,other.pose.position.dot(normal)+2*(rig.props.hipHalfWidth+.018));
        const fitted=projectPlanarTarget(goal,[{centre:speedCentre,radius:8*(T-ramp)},
          {centre:reachCentre,radius:Math.sqrt(ik.reach*ik.reach-vertical*vertical)}],normal,minimum);
        if(!fitted)return {status:'touchdown-region' as const,detail:{side:f.side,T,time,goal:goal.toArray(),minimum}};
        if(T<dt&&Math.hypot(fitted.x-goal.x,fitted.z-goal.z)>1e-8)
          return {status:'ordinary-braking-contact-region' as const,detail:{side:f.side,T,goal:goal.toArray(),fitted:fitted.toArray()}};
        goal.copy(fitted);goal.y=support(goal,yaw,0);
      }
      // The fitted XZ target may change ground height. Re-certify this same
      // admitted duration against the actual terminal quaternion's support.
      const fittedVertical=planSwingHeight({...heightInput,terminal:goal.y,apex:Math.max(f.anchor.position.y,goal.y)+f.peak,duration:T,maximumTime:T});
      if(fittedVertical.status!=='clear')return {status:'swing-height-fitted' as const,detail:{side:f.side,T,u,time,fittedVertical}};
      const planarAt=(p:number,v:number,end:number,elapsed:number)=>{
        if(T>=dt)return advancePlanar(p,v,end,T,elapsed);
        const t=Math.min(elapsed,T);return {position:p+v*(t-.5*t*t/T),velocity:t>=T?0:v*(1-t/T),maxSpeed:Math.abs(v)};
      };
      const x=planarAt(f.pose.position.x,f.velocity.x,goal.x,dt);
      const z=planarAt(f.pose.position.z,f.velocity.z,goal.z,dt);
      const y=fittedVertical.sample(dt);if(!y)return {status:'swing-height-sample' as const};
      maxSpeed=Math.max(maxSpeed,Math.hypot(x.maxSpeed,z.maxSpeed));maxYSpeed=Math.max(maxYSpeed,fittedVertical.maximumSpeed);
      f.pose.position.set(x.position,y.position,z.position);f.velocity.set(x.velocity,y.velocity,z.velocity);
      f.pose.rotation.copy(footRotation(f.yaw,f.pitch));
      const rotationEnd=f.pose.rotation.clone(),startAngles=new Euler().setFromQuaternion(footStart.rotation,'YXZ');
      const leavingContact=footStart.position.y-support(footStart.position,startAngles.y,startAngles.x)<=1e-6&&Math.abs(velocityStart.y)<1e-6;
      const smoothOrientation=T<dt||leavingContact;
      if(smoothOrientation){
        const pitchRate=1.5*Math.abs(f.pitch-startAngles.x)/orientationTime;
        const yawRate=1.5*Math.abs(Math.atan2(Math.sin(f.yaw-startAngles.y),Math.cos(f.yaw-startAngles.y)))/orientationTime;
        if(pitchRate>6+1e-6||yawRate>MOVE.turnSpeed+1e-6)return {status:'ordinary-contact-orientation-rate' as const,detail:{side:f.side,T,pitchRate,yawRate}};
      }
      const angularDisplacement=rotationVector(footStart.rotation,rotationEnd),rotationDuration=Math.min(T,dt);
      ordinaryBreaks.push(T,.15*T,.85*T,rotationDuration,...(fittedVertical.ascentTime===null?[]:[fittedVertical.ascentTime]));
      ordinaryPaths[i]=(time:number)=>{
        const x=planarAt(footStart.position.x,velocityStart.x,goal.x,time),z=planarAt(footStart.position.z,velocityStart.z,goal.z,time),y=fittedVertical.sample(time)!;
        const u=Math.min(1,time/rotationDuration),blend=smoothOrientation?u*u*(3-2*u):u;
        // At a contact inside this tick the full remaining interval is held.
        const blendRate=time>rotationDuration?0:(smoothOrientation?6*u*(1-u):1)/rotationDuration;
        return {position:new Vector3(x.position,y.position,z.position),rotation:advanceRotation(footStart.rotation,angularDisplacement,blend),
          velocity:new Vector3(x.velocity,y.velocity,z.velocity),angularVelocity:angularDisplacement.clone().multiplyScalar(blendRate)};
      };
      const floor=support(f.pose.position,f.yaw,f.pitch);
      if(f.pose.position.y<floor-1e-6)return {status:'floor' as const,detail:{side:f.side,depth:floor-f.pose.position.y}};
      if(T<=dt+1e-9&&Math.abs(f.pose.position.y-floor)<1e-5&&Math.abs(f.pitch)<1e-5){
        if(Math.abs(Math.atan2(Math.sin(f.yaw-f.poleYaw),Math.cos(f.yaw-f.poleYaw)))>.01)
          return {status:'pole-time' as const,detail:{side:f.side,poleYaw:f.poleYaw,footYaw:f.yaw}};
        ordinaryEvents.push({time:s.time-dt+T,frameOffset:T,kind:i===0?'left-contact':'right-contact',pose:cloneSole(f.pose),velocity:f.velocity.clone()});
        f.mode='planted';f.commits++;f.pose.position.y=floor;f.anchor=cloneSole(f.pose);f.velocity.set(0,0,0);f.completing=false;f.landing=false;f.recovery=false;
      }
    }
    if(maxSpeed>8+1e-6||maxYSpeed>(s.grounded?3:7)+1e-6)return {status:'rate' as const,detail:{maxSpeed,maxYSpeed,time}};
    const p=request(poseInput,draft,yaw);
    const transitionActive=!s.grounded||sinceAir<.12;
    // The authored jump spans .22..1.08 rad. Its existing 120 ms cubic
    // transition has maximum flex speed1.5*span/T; preserve that continuity
    // envelope around the accepted knees rather than post-filtering joints.
    const flexStep=1.5*(1.08-.22)/.12*dt;
    const ranges=accepted!.legs.map((leg,i):FlexRange=>({
      min:Math.max(minimumFlex,transitionActive?leg.flex-flexStep:minimumFlex,!s.grounded?draft[i].landingFlex:minimumFlex),
      max:Math.min(maximumFlex,transitionActive?leg.flex+flexStep:maximumFlex),
    })) as [FlexRange,FlexRange];
    const bodyCurve=createOrdinaryBodyCurve(accepted!.request,p,dt,rig.props.hipHalfWidth,rig.sole);
    const motionsAt=(elapsed:number)=>draft.map((f,i)=>ordinaryPaths[i]?ordinaryPaths[i]!(elapsed):
      {...cloneSole(f.pose),velocity:new Vector3(),angularVelocity:new Vector3()}) as [SoleMotion,SoleMotion];
    const beforeState=physical??s,wMax=Math.max(beforeState.moveWeight,s.moveWeight),rMax=Math.max(beforeState.runWeight,s.runWeight);
    const wDot=Math.abs(s.moveWeight-beforeState.moveWeight)/dt,rDot=Math.abs(s.runWeight-beforeState.runWeight)/dt;
    // Benchmark from the original reference knee coefficients, retimed to the
    // live distance clock and including the changing idle/move blend.
    const amplitude=(1.1+.45*rMax)*wMax;
    const amplitudeRate=.45*wMax*rDot+(1.1+.45*rMax)*wDot;
    const clockRate=TAU*Math.max(beforeState.speed,s.speed)/Math.min(strideLength(beforeState.runWeight,beforeState.stairWeight),stride);
    const authoredRate=amplitude*clockRate+3*Math.sqrt(3)/8*amplitudeRate+.02*wDot;
    // The original idle hips translation remains in live preparation. Bound
    // only its induced IK rate, without inventing a fixed idle motion floor.
    const swaySpeed=Math.abs(p.hipsLocal.x-accepted!.request.hipsLocal.x)/dt;
    const swayRate=ik.reach*swaySpeed/(ik.a*ik.b*Math.min(Math.sin(minimumFlex),Math.sin(maximumFlex)));
    const ordinaryFlexRate=authoredRate+swayRate;
    const flexRate=transitionActive?10.75:ordinaryFlexRate;
    const travel=Math.max(p.root.distanceTo(accepted!.request.root),...p.soles.map((f,i)=>f.position.distanceTo(accepted!.request.soles[i].position)));
    const intervals=Math.max(4,Math.min(48,Math.ceil(travel/.002)));
    const times=[...Array.from({length:intervals+1},(_,i)=>dt*i/intervals),...ordinaryBreaks.filter(t=>t>0&&t<dt)]
      .sort((a,b)=>a-b).filter((t,i,a)=>i===0||t-a[i-1]>1e-12);
    const samples=times.map(t=>({time:t,legs:bodyCurve.at(t,motionsAt(t)).legs.map((leg,i)=>({...leg,
      minDistance:Math.sqrt(ik.a*ik.a+ik.b*ik.b+2*ik.a*ik.b*Math.cos(ranges[i].max)),
      maxDistance:Math.sqrt(ik.a*ik.a+ik.b*ik.b+2*ik.a*ik.b*Math.cos(ranges[i].min)),maxFlexRate:flexRate})) as [SupportHeightLeg,SupportHeightLeg]}));
    const heightPlan=fitOrdinarySupportHeight({state:height,horizon:.12,dt,nominalTarget:input.hipsLocal.y,
      targetBounds:{min:0,max:rig.props.hipY+.12},heightBounds:{min:0,max:rig.props.hipY+.12},speedLimit:3,reserveTime:dt,
      a:ik.a,b:ik.b,samples});
    if(heightPlan.status!=='clear')return {status:'ordinary-support-curve' as const,detail:{heightPlan,authoredRate,swayRate,flexRate,samples,request:cloneRequest(p)}};
    const heightNext=heightPlan.sample(dt)!;p.hipsLocal.y=heightNext.height;
    const ordinaryAt=(fraction:number)=>{
      const elapsed=fraction*dt,point=bodyCurve.at(elapsed,motionsAt(elapsed)).request;
      const sampledHeight=heightPlan.sample(elapsed);if(!sampledHeight)return null;
      point.hipsLocal.y=sampledHeight.height;
      for(let i=0;i<2;i++){
        const sole=point.soles[i];let floor=-Infinity;
        for(const sy of[0,.018])for(const x of[-.054,0,.054])for(const z of[-.056,.03,.116]){
          const offset=new Vector3(x,sy,z-rig.sole.z).applyQuaternion(sole.rotation);
          floor=Math.max(floor,ground(sole.position.x+offset.x,sole.position.z+offset.z)-offset.y);
        }
        if(sole.position.y<floor-1e-6){ordinaryPathReason={type:'ordinary-sole-floor',fraction,side:i,depth:floor-sole.position.y};return null;}
      }
      return point;
    };
    const result=finish(input,p,draft,maxSpeed,maxYSpeed,time,heightNext,null,ordinaryAt,
      ordinaryEvents.map(e=>e.frameOffset/dt).filter(u=>u>0&&u<1),null,ordinaryEvents);
    if(result.status!=='clear')return {...result,detail:{failure:result.detail,trajectory:ordinaryPathReason}};
    return result;
  }

  return {
    contacts,diagnostics,geometry,
    reset(){feet=[];accepted=null;wasGrounded=true;phaseBias=0;previousVelocity.set(0,0,0);height={height:rig.props.hipY-.035,velocity:0};sinceAir=Infinity;airState=null;previousPair=null;handoffState=null;physical=null;lastEvents=[];},
    phase(value:number){return value+phaseBias;},
    snapshot(){return {visualYaw,height:{...height},sinceAir,physical:physical?{...physical}:null,handoff:handoffState?{remaining:handoffState.remaining,worldHeight:handoffState.worldHeight,anchored:handoffState.anchored,time:handoffState.time}:null,events:lastEvents,feet:feet.map(f=>({side:f.side,mode:f.mode,position:f.pose.position.toArray(),rotation:f.pose.rotation.toArray(),
      anchorPosition:f.anchor.position.toArray(),anchorRotation:f.anchor.rotation.toArray(),velocity:f.velocity.toArray(),completing:f.completing,remaining:f.remaining,
      releases:f.releases,commits:f.commits,poleYaw:f.poleYaw,fromPoleYaw:f.fromPoleYaw,landingYaw:f.landingYaw,recovery:f.recovery,landingFlex:f.landingFlex})),request:accepted?cloneRequest(accepted.request):null,
      frames:accepted?{left:accepted.legs[0].frames,right:accepted.legs[1].frames}:null};},
    update(input:ContactInput){
      const before={feet,accepted,wasGrounded,visualYaw,phaseBias,velocity:previousVelocity.clone(),height:{...height},sinceAir,airState,previousPair,handoffState,physical,lastEvents};
      try{
      if(!accepted)initial(input);
      const s=input.state,delta=Math.atan2(Math.sin(s.yaw-visualYaw),Math.cos(s.yaw-visualYaw));
      const turn=clamp(delta,-MOVE.turnSpeed*input.dt,MOVE.turnSpeed*input.dt);
      let chosen:ReturnType<typeof stage>|null=null;
      const failures:unknown[]=[];
      for(const fraction of[1,.5,.25,0]){
        diagnostics.trials++;const trial=stage(input,visualYaw+turn*fraction,false);
        if(trial.status==='clear'){chosen=trial;if(fraction<1)diagnostics.rejectedYaw++;break;}
        failures.push({fraction,...trial});
      }
      if(!chosen){diagnostics.trials++;const trial=stage(input,visualYaw,true);if(trial.status==='clear')chosen=trial;else failures.push({completion:true,...trial});}
      if(!chosen||chosen.status!=='clear')fail('no-accepted-pair',input,failures);
      const next=chosen;
      next.feet.forEach((f,i)=>{if(f.completing&&!feet[i].completing)diagnostics.completions++;});
      const recovered=next.feet.findIndex((f,i)=>feet[i].recovery&&!f.recovery&&f.mode==='planted');
      if(recovered>=0){
        // Seed ordinary gait from the actual contact that finished the landing
        // sequence. The opposite foot can release on its existing next step.
        const phase=recovered===0?0:.5;phaseBias=phase-s.phase;
        next.feet.forEach((f,i)=>f.cycle=Math.floor(phase+i*.5)-(i===recovered?0:1));
      }
      airState=next.air;handoffState=next.handoff;physical={...s};lastEvents=next.events;previousPair=accepted;height=next.height;sinceAir=s.grounded?sinceAir+input.dt:0;feet=next.feet;accepted=next.pose;visualYaw=accepted.request.visualYaw;wasGrounded=s.grounded;
      previousVelocity.set(s.vx,0,s.vz);
      diagnostics.frames++;diagnostics.maxFootSpeed=Math.max(diagnostics.maxFootSpeed,next.maxSpeed);
      diagnostics.maxFootYSpeed=Math.max(diagnostics.maxFootYSpeed,next.maxYSpeed);
      diagnostics.maxYawLag=Math.max(diagnostics.maxYawLag,Math.abs(Math.atan2(Math.sin(s.yaw-visualYaw),Math.cos(s.yaw-visualYaw))));
      ik.apply(accepted);feet.forEach((f,i)=>contacts[i].copy(f.pose.position));
      }catch(error){
        feet=before.feet;accepted=before.accepted;wasGrounded=before.wasGrounded;visualYaw=before.visualYaw;phaseBias=before.phaseBias;
        previousVelocity.copy(before.velocity);height=before.height;sinceAir=before.sinceAir;airState=before.airState;previousPair=before.previousPair;handoffState=before.handoffState;physical=before.physical;lastEvents=before.lastEvents;feet.forEach((f,i)=>contacts[i].copy(f.pose.position));
        throw error;
      }
    },
  };
}
