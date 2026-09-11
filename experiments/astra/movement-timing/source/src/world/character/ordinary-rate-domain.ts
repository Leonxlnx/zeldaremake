/** Fixed ordinary continuity scale from the full original authored blend domain. */
import { MOVE } from './locomotion';

export function ordinaryRateDomain(a:number,b:number,reach:number){
  const minFlex=Math.acos((reach*reach-a*a-b*b)/(2*a*b));
  const minDistance=Math.abs(a-b)+.01;
  const maxFlex=Math.acos((minDistance*minDistance-a*a-b*b)/(2*a*b));
  const swayFactor=reach/(a*b*Math.min(Math.sin(minFlex),Math.sin(maxFlex)));
  if(![a,b,reach,swayFactor].every(Number.isFinite)||a<=0||b<=0||swayFactor<0)throw new Error('Invalid ordinary-rate dimensions');
  const cases=[];
  for(const move of[0,1])for(const run of[0,1])for(const speed of[0,.45,MOVE.walkSpeed,MOVE.runSpeed]){
    const moveDot=14*(Math.min(1,speed/.45)-move);
    const runDot=10*(Math.max(0,Math.min(1,(speed-MOVE.walkSpeed)/(MOVE.runSpeed-MOVE.walkSpeed)))-run);
    const K=1.1+.45*run;
    const authored=K*move*2*Math.PI*speed/(.75+.45*run)
      +3*Math.sqrt(3)/8*Math.abs(.45*move*runDot+K*moveDot)+.02*Math.abs(moveDot);
    const sway=swayFactor*Math.hypot(.0054*(1-move),.012*moveDot);
    cases.push({move,run,speed,authored,sway,total:authored+sway});
  }
  return {limit:Math.max(...cases.map(c=>c.total)),cases};
}
