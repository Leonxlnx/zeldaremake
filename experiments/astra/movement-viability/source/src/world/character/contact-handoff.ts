/** Accepted air pair -> actual sole contacts. Pure, staged and event-split. */
import { MathUtils, Quaternion, Vector3 } from 'three';
import { MOVE, type MotionState } from './locomotion';
import type { GroundSampler } from './animation';
import type { PairedAirState } from './paired-air';
import { cloneRequest, cloneSole, interpolateRequest, type PairPose, type PairRequest, type SolePose } from './contact-pose';
import { advanceHeightHermite, type HeightState } from './contact-height';
import { advanceConfiguration, constructConfiguration, preferredConfiguration, type ConfigurationDimensions, type PairConfiguration } from './air-configuration';
import { advanceFlex, planFlex } from './contact-flex';
import { configurationSoleVelocities, rebaseConfigurationRates } from './contact-kinematics';
import { flexPlanMaximumRate, solveContactHeightVelocity } from './contact-height-rate';
import { planSupportRecovery } from './support-recovery';

const UP=new Vector3(0,1,0),clamp=MathUtils.clamp;
export interface HandoffState {
  configuration:PairConfiguration; worldHeight:HeightState; remaining:number;
  targetHeight:number; targets:[SolePose,SolePose]; targetVelocity:[Vector3,Vector3];
  anchored:[boolean,boolean]; anchors:[SolePose,SolePose]; recoveryDuration:number; moving:boolean;
  time:number; contacts:number; recoveryPlanned:boolean;
}
export interface HandoffInput {
  state:MotionState; previousPhysical:MotionState; dt:number; yaw:number;
  hipsLocal:Vector3; hipsRotation:Quaternion; poles:[Vector3,Vector3];
  accepted:PairPose; air:PairedAirState|null; footVelocity:[Vector3,Vector3];
  dimensions:ConfigurationDimensions; ground:GroundSampler; sinceAir:number;
}
interface FramePoint {request:PairRequest;rootVelocity:Vector3;yawRate:number;localVelocity:Vector3;hipsOmega:Vector3}
interface Sample {request:PairRequest;configuration:PairConfiguration;worldHeight:HeightState;velocities:[Vector3,Vector3];localHeightVelocity:number}
const copyConfig=(c:PairConfiguration)=>c.map(v=>({...v,direction:v.direction.clone(),directionVelocity:v.directionVelocity.clone(),footRotation:v.footRotation.clone(),footAngularVelocity:v.footAngularVelocity.clone()})) as PairConfiguration;
const copyState=(s:HandoffState):HandoffState=>({...s,configuration:copyConfig(s.configuration),worldHeight:{...s.worldHeight},targets:s.targets.map(cloneSole) as [SolePose,SolePose],targetVelocity:s.targetVelocity.map(v=>v.clone()) as [Vector3,Vector3],anchored:[...s.anchored],anchors:s.anchors.map(cloneSole) as [SolePose,SolePose]});

/** Exact angular derivative of Three's shortest slerp, including its nlerp branch. */
function angularVelocity(a:Quaternion,b0:Quaternion,u:number,T:number){
  const b=b0.clone();let dot=a.dot(b);if(dot<0){b.set(-b.x,-b.y,-b.z,-b.w);dot=-dot;}
  if(dot>=.9995){
    const av=a.toArray(),bv=b.toArray(),d=bv.map((x,i)=>x-av[i]),raw=av.map((x,i)=>x+u*d[i]),n=Math.hypot(...raw),q=raw.map(x=>x/n);
    const projection=q.reduce((v,x,i)=>v+x*d[i],0),dq=d.map((x,i)=>(x-q[i]*projection)/(n*T));
    const omega=new Quaternion(...dq as [number,number,number,number]).multiply(new Quaternion(...q as [number,number,number,number]).invert());
    return new Vector3(omega.x,omega.y,omega.z).multiplyScalar(2);
  }
  const d=b.multiply(a.clone().invert()),n=Math.hypot(d.x,d.y,d.z);
  return new Vector3(d.x,d.y,d.z).multiplyScalar(2*Math.atan2(n,d.w)/(n*T));
}
function makeFrame(input:HandoffInput){
  const {accepted,state:s,previousPhysical:previous,dt,ground}=input,start=accepted.request;
  const end=cloneRequest(start);end.root.set(s.x,s.y,s.z);end.visualYaw=input.yaw;end.hipsLocal.copy(input.hipsLocal);end.hipsRotation.copy(input.hipsRotation);end.poles=input.poles.map(v=>v.clone()) as [Vector3,Vector3];
  const floor=ground(s.x,s.z),velocity=end.root.clone().sub(start.root).divideScalar(dt);
  const yawRate=Math.atan2(Math.sin(end.visualYaw-start.visualYaw),Math.cos(end.visualYaw-start.visualYaw))/dt;
  let physicalEvent:number|null=null;
  if(!previous.grounded&&s.grounded){
    const h=start.root.y-floor,disc=previous.vy*previous.vy+2*MOVE.gravity*h;
    physicalEvent=(previous.vy+Math.sqrt(Math.max(0,disc)))/MOVE.gravity;
    if(physicalEvent<0||physicalEvent>dt+1e-8)return {status:'invalid' as const,reason:'physical-event-time',physicalEvent};
  }
  const at=(time:number,eventSide:'left'|'right'='right'):FramePoint=>{
    const u=clamp(time/dt,0,1),request=interpolateRequest(start,end,u),rv=velocity.clone();
    let localOmega=angularVelocity(start.hipsRotation,end.hipsRotation,u,dt),yr=yawRate;
    const localVelocity=end.hipsLocal.clone().sub(start.hipsLocal).divideScalar(dt);
    if(time>dt){request.root.addScaledVector(new Vector3(s.vx,0,s.vz),time-dt);rv.set(s.vx,0,s.vz);localVelocity.set(0,0,0);localOmega.set(0,0,0);yr=0;}
    else if(physicalEvent!==null){
      if(time<physicalEvent||(time===physicalEvent&&eventSide==='left')){request.root.y=start.root.y+previous.vy*time-.5*MOVE.gravity*time*time;rv.y=previous.vy-MOVE.gravity*time;}
      else{request.root.y=floor;rv.y=0;}
    }
    const q=new Quaternion().setFromAxisAngle(UP,request.visualYaw);
    return {request,rootVelocity:rv,yawRate:yr,localVelocity,hipsOmega:localOmega.applyQuaternion(q).addScaledVector(UP,yr)};
  };
  // Forecast ordinary body motion from the actual current derivative. The actual
  // interval remains identical; this only avoids an artificial angular stop in
  // the support-recovery horizon beyond the new physical timestamp.
  const recoveryAt=(time:number):FramePoint=>{
    if(time<=dt)return at(time);
    const p=at(time),end=at(dt),extra=time-dt;
    p.request.visualYaw=end.request.visualYaw+end.yawRate*extra;p.yawRate=end.yawRate;
    const endRootQ=new Quaternion().setFromAxisAngle(UP,end.request.visualYaw);
    const localOmega=end.hipsOmega.clone().addScaledVector(UP,-end.yawRate).applyQuaternion(endRootQ.invert());
    const angle=localOmega.length()*extra;
    if(angle>0)p.request.hipsRotation.premultiply(new Quaternion().setFromAxisAngle(localOmega.clone().normalize(),angle));
    p.request.hipsLocal.addScaledVector(end.localVelocity,extra);p.localVelocity.copy(end.localVelocity);
    p.hipsOmega.copy(localOmega).applyAxisAngle(UP,p.request.visualYaw).addScaledVector(UP,p.yawRate);
    return p;
  };
  return {status:'clear' as const,at,recoveryAt,physicalEvent};
}
function hipVelocities(point:FramePoint,worldHeight:HeightState,d:ConfigurationDimensions):[Vector3,Vector3]{
  const {request:p}=point,q=new Quaternion().setFromAxisAngle(UP,p.visualYaw),local=p.hipsLocal.clone();
  local.y=worldHeight.height-p.root.y;
  const lv=point.localVelocity.clone();lv.y=worldHeight.velocity-point.rootVelocity.y;
  const centre=point.rootVelocity.clone().add(UP.clone().multiplyScalar(point.yawRate).cross(local.clone().applyQuaternion(q))).add(lv.applyQuaternion(q));
  return [1,-1].map(side=>{
    const offset=new Vector3(side*d.hipHalfWidth,0,0).applyQuaternion(q.clone().multiply(p.hipsRotation));
    return centre.clone().add(point.hipsOmega.clone().cross(offset));
  }) as [Vector3,Vector3];
}
/** Original conservative eighteen sole points, now using the actual quaternion. */
function support(p:SolePose,d:ConfigurationDimensions,ground:GroundSampler){
  let y=-Infinity;
  for(const sy of[0,.018])for(const x of[-.054,0,.054])for(const z of[-.056,.03,.116]){
    const v=new Vector3(x,sy,z-d.sole.z).applyQuaternion(p.rotation);
    y=Math.max(y,ground(p.position.x+v.x,p.position.z+v.z)-v.y);
  }return y;
}
/** Exact support-only height interval. A free leg is built by FK afterwards. */
function supportHeight(p:PairRequest,side:number,sole:SolePose,d:ConfigurationDimensions,loFlex:number,hiFlex:number){
  const q=new Quaternion().setFromAxisAngle(UP,p.visualYaw),offset=new Vector3(side*d.hipHalfWidth,0,0).applyQuaternion(q.clone().multiply(p.hipsRotation));
  const lateral=new Vector3(p.hipsLocal.x,0,p.hipsLocal.z).applyQuaternion(q).add(offset),ankle=sole.position.clone().sub(d.sole.clone().applyQuaternion(sole.rotation));
  const horizontal=(p.root.x+lateral.x-ankle.x)**2+(p.root.z+lateral.z-ankle.z)**2;
  const minimum=(d.a-d.b)**2+4*d.a*d.b*Math.cos(hiFlex*.5)**2,maximum=(d.a-d.b)**2+4*d.a*d.b*Math.cos(loFlex*.5)**2;
  if(horizontal>maximum)return null;
  return {min:ankle.y-offset.y+Math.sqrt(Math.max(0,minimum-horizontal)),max:ankle.y-offset.y+Math.sqrt(maximum-horizontal)};
}

export function planContactHandoff(previous:HandoffState|null,input:HandoffInput){
  const frame=makeFrame(input);if(frame.status!=='clear')return {status:'handoff-frame' as const,detail:frame};
  const {dimensions:d,dt,state:s,ground}=input;
  const minimumFlex=Math.acos(((d.a+d.b-.002)**2-d.a*d.a-d.b*d.b)/(2*d.a*d.b));
  const maximumFlex=Math.acos(((Math.abs(d.a-d.b)+.01)**2-d.a*d.a-d.b*d.b)/(2*d.a*d.b));
  let state:HandoffState;
  if(previous)state=copyState(previous);
  else{
    const air=input.air;if(!air?.prepared)return {status:'handoff-unprepared' as const};
    const landingSides=air.prepared.moving?[0]:[0,1];let duration=air.remaining;
    for(const i of landingSides){
      const foot=input.accepted.request.soles[i],gap=foot.position.y-support(foot,d,ground),v=input.footVelocity[i].y;
      if(gap< -1e-6||v>=-1e-5)return {status:'handoff-entry' as const,detail:{side:i,gap,velocity:v}};
      duration=Math.max(duration,2*gap/-v);
    }
    if(duration<=0||duration>.12)return {status:'handoff-contact-time' as const,detail:{duration}};
    state={configuration:copyConfig(air.configuration),worldHeight:{...air.worldHeight},remaining:duration,
      targetHeight:air.prepared.request.root.y+air.prepared.request.hipsLocal.y,
      targets:air.prepared.request.soles.map(cloneSole) as [SolePose,SolePose],targetVelocity:air.prepared.velocities.map(v=>v.clone()) as [Vector3,Vector3],
      anchored:[false,false],anchors:input.accepted.request.soles.map(cloneSole) as [SolePose,SolePose],recoveryDuration:air.prepared.recoveryDuration,moving:air.prepared.moving,time:s.time-dt,contacts:0,recoveryPlanned:false};
  }
  const events:{time:number;kind:'physical'|'left-contact'|'right-contact';pose?:SolePose;velocity?:Vector3}[]=[];
  if(frame.physicalEvent!==null)events.push({time:frame.physicalEvent,kind:'physical'});
  const segments:{from:number;to:number;sample:(t:number,eventSide?:'left'|'right')=>Sample|null;anchored:[boolean,boolean]}[]=[];
  let t=0,worldVelocity=input.footVelocity.map(v=>v.clone()) as [Vector3,Vector3],last:Sample|null=null;
  let maxSpeed=0,maxYSpeed=0,reason:unknown=null;
  const valid=(sample:Sample,anchored:[boolean,boolean],time:number)=>{
    const planar=Math.max(...sample.velocities.map(v=>Math.hypot(v.x,v.z))),vertical=Math.max(...sample.velocities.map(v=>Math.abs(v.y)));
    const contacted=anchored.some(Boolean),limit=contacted?3:7,heightLimit=contacted?3:6;
    if(planar>8+1e-6||vertical>limit+1e-6||Math.abs(sample.localHeightVelocity)>heightLimit+1e-6){reason={type:'rate',time,planar,vertical,limit,localHeightVelocity:sample.localHeightVelocity,heightLimit};return false;}
    if(contacted&&input.sinceAir+time<.12){
      const flexRate=Math.max(...sample.configuration.map(c=>Math.abs(c.flexVelocity))),limit=1.5*(1.08-.22)/.12;
      if(flexRate>limit+1e-6){reason={type:'authored-flex-rate',time,flexRate,limit,legs:sample.configuration.map(c=>({flex:c.flex,velocity:c.flexVelocity})),request:sample.request};return false;}
    }
    for(let i=0;i<2;i++){
      const gap=sample.request.soles[i].position.y-support(sample.request.soles[i],d,ground);
      if(gap< -1e-6){reason={type:'floor',time,side:i,gap};return false;}
      if(anchored[i]&&(sample.request.soles[i].position.distanceTo(state.anchors[i].position)>1e-9||sample.request.soles[i].rotation.angleTo(state.anchors[i].rotation)>1e-7)){reason={type:'anchor',time,side:i};return false;}
    }
    maxSpeed=Math.max(maxSpeed,planar);maxYSpeed=Math.max(maxYSpeed,vertical);return true;
  };
  while(t<dt-1e-12){
    if(segments.length>=3)return {status:'handoff-event-budget' as const};
    const start=copyState(state),startTime=t,point0=frame.at(t);
    let T=state.remaining,elapsed=Math.min(dt-t,T);
    const rebased=rebaseConfigurationRates(start.configuration,point0.request.visualYaw,point0.yawRate,hipVelocities(point0,start.worldHeight,d),worldVelocity,d);
    if(rebased.status!=='clear')return {status:'handoff-rebase' as const,detail:rebased};
    start.configuration=rebased.configuration;
    let sample:(time:number,eventSide?:'left'|'right')=>Sample|null;
    let targetHeightVelocity:number,target:PairRequest;
    if(start.anchored[0]&&!start.anchored[1]){
      const recovery=planSupportRecovery({configuration:start.configuration,worldHeight:start.worldHeight,soles:(last?.request??input.accepted.request).soles.map(cloneSole) as [SolePose,SolePose],
        velocities:worldVelocity,duration:T,fresh:!state.recoveryPlanned,dimensions:d,ground,
        frameAt:used=>frame.recoveryAt(startTime+used),
        nominalHeight:used=>{const future=Math.max(0,startTime+used-dt),landing=Math.max(0,s.landing-5*future);
          return {height:input.hipsLocal.y+ground(s.x,s.z)+.055*(s.landing-landing),velocity:landing>0?.275:0};}});
      if(recovery.status!=='clear')return recovery;
      T=recovery.duration;elapsed=Math.min(dt-t,T);state.remaining=T;state.recoveryPlanned=true;
      sample=(time:number)=>{const p=recovery.sample(time-startTime);if(!p)reason=recovery.diagnostic();return p;};
      targetHeightVelocity=recovery.endpoint.velocity;
      target=cloneRequest(frame.recoveryAt(startTime+T).request);target.hipsLocal.y=recovery.endpoint.height-target.root.y;
      target.soles=[cloneSole(start.anchors[0]),cloneSole(recovery.goal)];
    }else if(start.anchored.every(Boolean)){
      // Both contacts only consume the remaining fraction of this physical tick.
      // Carry the accepted shared height derivative into ordinary gait; a fake
      //120 ms double-support forecast would move the body past both fixed feet.
      T=dt-t;elapsed=T;state.remaining=T;
      sample=(time:number)=>{
        const point=frame.recoveryAt(time),p=cloneRequest(point.request),used=time-startTime;
        const h={height:start.worldHeight.height+start.worldHeight.velocity*used,velocity:start.worldHeight.velocity};
        p.hipsLocal.y=h.height-p.root.y;p.soles=start.anchors.map(cloneSole) as [SolePose,SolePose];
        const c=preferredConfiguration(p,d);if(c.status!=='clear'){reason={type:'double-support-configuration',time,result:c};return null;}
        const rebuilt=constructConfiguration(c.configuration,p,d);
        if(rebuilt.status!=='clear'||p.soles.some((sole,i)=>sole.position.distanceTo(rebuilt.request.soles[i].position)>1e-8)){
          reason={type:'double-support-reach',time,request:p};return null;
        }
        const velocities:[Vector3,Vector3]=[new Vector3(),new Vector3()];
        const rates=rebaseConfigurationRates(c.configuration,p.visualYaw,point.yawRate,hipVelocities(point,h,d),velocities,d);
        if(rates.status!=='clear'){reason={type:'double-support-rates',time,result:rates};return null;}
        return {request:p,configuration:rates.configuration,worldHeight:h,velocities,localHeightVelocity:h.velocity-point.rootVelocity.y};
      };
      targetHeightVelocity=start.worldHeight.velocity;target=cloneRequest(frame.recoveryAt(t+T).request);
      target.hipsLocal.y=start.worldHeight.height+start.worldHeight.velocity*T-target.root.y;target.soles=start.anchors.map(cloneSole) as [SolePose,SolePose];
    }else{
      const normal=()=>{
        let targetHeight=state.targetHeight;
        const endpoint=frame.at(t+T),target=cloneRequest(endpoint.request);
        target.soles=state.targets.map(cloneSole) as [SolePose,SolePose];
        if(state.anchored.some(Boolean)){
          targetHeight=input.hipsLocal.y+ground(s.x,s.z);
          for(let i=0;i<2;i++)if(state.anchored[i]){
            target.soles[i]=cloneSole(state.anchors[i]);
            const interval=supportHeight(target,i===0?1:-1,state.anchors[i],d,minimumFlex,maximumFlex);
            if(!interval)return {status:'handoff-support-future' as const,detail:{side:i,T,request:target}};
            targetHeight=clamp(targetHeight,interval.min,interval.max);
          }
        }
        target.hipsLocal.y=targetHeight-target.root.y;
        const preferred=preferredConfiguration(target,d);if(preferred.status!=='clear')return {status:'handoff-reference' as const,detail:preferred};
        let targetHeightVelocity=0;
        if(!start.anchored.some(Boolean)){
          const velocity=solveContactHeightVelocity(preferred.configuration,target.visualYaw,endpoint.yawRate,hipVelocities(endpoint,{height:targetHeight,velocity:0},d),state.targetVelocity,d);
          if(velocity.status!=='clear')return {status:'handoff-contact-velocity-interval' as const,detail:{T,velocity,target}};
          targetHeightVelocity=velocity.selected;
        }
        const endRates=rebaseConfigurationRates(preferred.configuration,target.visualYaw,endpoint.yawRate,hipVelocities(endpoint,{height:targetHeight,velocity:targetHeightVelocity},d),state.targetVelocity,d);
        if(endRates.status!=='clear')return {status:'handoff-end-rates' as const,detail:endRates};
        const plans=start.configuration.map((c,i)=>planFlex({value:c.flex,velocity:c.flexVelocity},{value:endRates.configuration[i].flex,velocity:endRates.configuration[i].flexVelocity},T,{min:minimumFlex,max:maximumFlex}));
        const failed=plans.findIndex(p=>p.status!=='feasible');if(failed>=0)return {status:'handoff-flex-plan' as const,detail:{side:failed,T,plan:plans[failed],target}};
        if(start.anchored.some(Boolean)){
          const active=Math.min(T,.12-input.sinceAir-startTime);
          if(active>0)for(let i=0;i<2;i++){
            const plan=plans[i];if(start.anchored[i]||plan.status!=='feasible')continue;
            const rate=flexPlanMaximumRate(plan.plan,{from:0,to:active});
            if(rate.status!=='clear'||rate.maximum>10.75+1e-6)return {status:'handoff-free-curve-rate' as const,detail:{side:i,T,active,rate,plan,targetHeightVelocity,target}};
          }
        }
        const sample=(time:number,eventSide:'left'|'right'='right'):Sample|null=>{
          const used=time-startTime,h=advanceHeightHermite(start.worldHeight,{height:targetHeight,velocity:targetHeightVelocity},T,used,{min:-1,max:2});
          if(h.status!=='accepted'){reason={type:'height',time,result:h};return null;}
          const flex=plans.map(p=>p.status==='feasible'?advanceFlex(p.plan,used):null);
          if(flex.some(v=>v?.status!=='clear')){reason={type:'flex-sample',time};return null;}
          const c=advanceConfiguration(start.configuration,endRates.configuration,T,used,flex.map(v=>v!.status==='clear'?v!.state:{value:NaN,velocity:NaN}) as [{value:number;velocity:number},{value:number;velocity:number}]);
          if(c.status!=='clear'){reason={type:'configuration',time,result:c};return null;}
          const point=frame.at(time,eventSide);point.request.hipsLocal.y=h.state.height-point.request.root.y;
          const made=constructConfiguration(c.configuration,point.request,d);if(made.status!=='clear'){reason={type:'construction',time,result:made};return null;}
          for(let i=0;i<2;i++)if(start.anchored[i])made.request.soles[i]=cloneSole(start.anchors[i]);
          const v=configurationSoleVelocities(c.configuration,made.request.visualYaw,point.yawRate,hipVelocities(point,h.state,d),d);
          if(v.status!=='clear'){reason={type:'velocity',time,result:v};return null;}
          for(let i=0;i<2;i++)if(start.anchored[i])v.velocities[i].set(0,0,0);
          let actualConfiguration=c.configuration;
          if(start.anchored.some(Boolean)){
            const actual=preferredConfiguration(made.request,d);if(actual.status!=='clear'){reason={type:'support-configuration',time,result:actual};return null;}
            const fitted=constructConfiguration(actual.configuration,made.request,d);
            if(fitted.status!=='clear'||start.anchored.some((anchored,i)=>anchored&&fitted.request.soles[i].position.distanceTo(made.request.soles[i].position)>1e-8)){
              reason={type:'support-outside-reserve',time,request:made.request};return null;
            }
            const mixed=c.configuration.map((leg,i)=>start.anchored[i]?actual.configuration[i]:leg) as PairConfiguration;
            const rates=rebaseConfigurationRates(mixed,made.request.visualYaw,point.yawRate,hipVelocities(point,h.state,d),v.velocities,d);
            if(rates.status!=='clear'){reason={type:'support-rates',time,result:rates};return null;}actualConfiguration=rates.configuration;
          }
          return {request:made.request,configuration:actualConfiguration,worldHeight:h.state,velocities:v.velocities,localHeightVelocity:h.state.velocity-point.rootVelocity.y};
        };
      return {status:'clear' as const,sample,targetHeightVelocity,target};
      };
      const planned=normal();if(planned.status!=='clear')return planned;
      sample=planned.sample;targetHeightVelocity=planned.targetHeightVelocity;target=planned.target;
    }
    const segment={from:t,to:t+elapsed,sample,anchored:[...start.anchored] as [boolean,boolean]};segments.push(segment);
    // Bounded forecast of the same complete planned configuration, including
    // actual anchored-support rates. Free-leg polynomial rate extrema above are
    // analytic; these support/body samples are finite checks, not a certificate.
    const forecastSteps=Math.min(64,Math.max(1,Math.ceil(T/.004)));
    for(let j=0;j<=forecastSteps;j++){
      const at=t+T*j/forecastSteps,p=sample(at);
      if(!p||!valid(p,start.anchored,at))return {status:'handoff-planned-trajectory' as const,detail:{failure:reason,T,forecastSteps,targetHeightVelocity,target}};
    }
    const checkpoints=[t,t+elapsed];if(frame.physicalEvent!==null&&frame.physicalEvent>t&&frame.physicalEvent<t+elapsed)checkpoints.push(frame.physicalEvent);
    for(const time of checkpoints){
      for(const side of time===frame.physicalEvent?['left','right'] as const:['right'] as const){
        const p=sample(time,side);if(!p||!valid(p,start.anchored,time))return {status:'handoff-path' as const,detail:reason};
      }
    }
    last=sample(t+elapsed)!;state.configuration=last.configuration;state.worldHeight=last.worldHeight;state.remaining=T-elapsed;worldVelocity=last.velocities;t+=elapsed;
    if(state.remaining<=1e-10){
      const landing=(state.anchored.some(Boolean)?[1]:state.moving?[0]:[0,1]).filter(i=>!state.anchored[i]);
      for(const i of landing){
        const sole=last.request.soles[i],gap=sole.position.y-support(sole,d,ground);
        if(Math.abs(gap)>1e-6||worldVelocity[i].length()>1e-5)return {status:'handoff-contact' as const,detail:{time:t,side:i,gap,velocity:worldVelocity[i].toArray(),sole}};
        state.anchored[i]=true;state.anchors[i]=cloneSole(sole);state.targetVelocity[i].set(0,0,0);state.contacts++;
        events.push({time:t,kind:i===0?'left-contact':'right-contact',pose:cloneSole(sole),velocity:worldVelocity[i].clone()});
      }
      // Check the new contact phase at the event, including a contact exactly at dt.
      if(!valid(last,state.anchored,t))return {status:'handoff-contact-rate' as const,detail:reason};
      if(state.anchored.every(Boolean)){
        // A both-contact hold consumes the rest of this same frame under ground limits.
        state.remaining=dt-t;state.targets=state.anchors.map(cloneSole) as [SolePose,SolePose];state.targetHeight=state.worldHeight.height;
      }else{
        state.remaining=state.recoveryDuration;state.targetHeight=input.hipsLocal.y+ground(s.x,s.z);
        // The recovery planner derives its target by braking this accepted
        // free-foot velocity. Keep the accepted pose here until it plans.
        state.targets=[cloneSole(state.anchors[0]),cloneSole(last.request.soles[1])];state.targetVelocity=[new Vector3(),new Vector3()];
      }
    }
  }
  if(!last)return {status:'handoff-empty' as const};
  state.time=s.time;
  const requestAt=(u:number)=>{
    const time=u*dt,segment=segments.find(p=>time<=p.to+1e-12)??segments.at(-1)!;
    const p=segment.sample(time);if(!p||!valid(p,segment.anchored,time))return null;return p.request;
  };
  return {status:'clear' as const,request:last.request,state:state.anchored.every(Boolean)?null:state,anchored:state.anchored,anchors:state.anchors,
    velocities:last.velocities,height:{height:last.request.hipsLocal.y,velocity:last.localHeightVelocity},events,
    boundaries:events.map(e=>e.time/dt).filter(u=>u>0&&u<1),requestAt,maxSpeed,maxYSpeed,diagnostic:()=>reason};
}
