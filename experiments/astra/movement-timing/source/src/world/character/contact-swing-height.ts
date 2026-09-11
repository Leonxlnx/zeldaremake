/** Complete ordinary swing height admission on the accepted-pose clock. */
import { certifyContactDuration, minimumContactDuration } from './contact-duration';
export interface SwingHeightInput {position:number;velocity:number;terminal:number;apex:number;phase:number;duration:number;maximumTime:number;limit:number}
export function planSwingHeight(input:SwingHeightInput){
  const {position:p,velocity:v,terminal,apex,limit}=input;
  if(![p,v,terminal,apex,input.phase,input.duration,input.maximumTime,limit].every(Number.isFinite)||input.duration<=0||input.maximumTime<=0)
    return {status:'invalid' as const,reason:'swing-height-input'};
  const phase=Math.max(0,Math.min(1,input.phase)),ascending=phase<.5;
  const fraction=ascending?(.5-phase)/(1-phase):0;
  let T=input.duration;
  if(ascending){
    const up=minimumContactDuration(p,v,apex,limit,input.maximumTime*fraction);
    const down=minimumContactDuration(apex,0,terminal,limit,input.maximumTime*(1-fraction));
    if(up.status!=='clear'||down.status!=='clear')return {status:'infeasible' as const,reason:'complete-lift-fall-time',up,down};
    T=Math.max(T,up.duration/fraction,down.duration/(1-fraction));
  }else{
    const down=minimumContactDuration(p,v,terminal,limit,input.maximumTime);
    if(down.status!=='clear')return {status:'infeasible' as const,reason:'complete-fall-time',down};
    T=Math.max(T,down.duration);
  }
  if(T>input.maximumTime+1e-10)return {status:'infeasible' as const,reason:'swing-support-deadline',duration:T,maximumTime:input.maximumTime};
  const ascentTime=fraction*T,firstTime=ascending?ascentTime:T;
  const first=certifyContactDuration(p,v,ascending?apex:terminal,firstTime,limit);
  const second=ascending?certifyContactDuration(apex,0,terminal,T-ascentTime,limit):null;
  if(first.status!=='clear'||second&&second.status!=='clear')return {status:'infeasible' as const,reason:'complete-height-curve',first,second};
  const curves=[first.curve,...second&&second.status==='clear'?[second.curve]:[]];
  const maximumSpeed=Math.max(...curves.map(c=>c.maximumSpeed));
  const evaluate=(curve:typeof first.curve,t:number)=>{
    if(t===0)return {position:curve.start.value,velocity:curve.start.velocity};
    if(t>=curve.duration)return {position:curve.end.value,velocity:0};
    const u=t/curve.duration,[c0,c1,c2,c3]=curve.coefficients;
    return {position:((c3*u+c2)*u+c1)*u+c0,velocity:(c1+2*c2*u+3*c3*u*u)/curve.duration};
  };
  const sample=(elapsed:number)=>{
    if(elapsed<0||!Number.isFinite(elapsed))return null;
    if(ascending&&elapsed>ascentTime&&second?.status==='clear')return evaluate(second.curve,elapsed-ascentTime);
    return evaluate(first.curve,elapsed);
  };
  return {status:'clear' as const,duration:T,ascentTime:ascending?ascentTime:null,curves,maximumSpeed,sample};
}
