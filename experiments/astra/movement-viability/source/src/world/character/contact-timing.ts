/** Bounded current-motion estimate. Future input is not assumed to be guaranteed. */
import { Vector3 } from 'three';
import { MOVE, type MotionState } from './locomotion';
export function estimateStepTime(s:MotionState,previousVelocity:Vector3,distance:number,dt:number){
  if(distance<=0)return 0;
  const velocity=new Vector3(s.vx,0,s.vz);
  const rate=!s.grounded?MOVE.airAcceleration:s.speed<previousVelocity.length()?MOVE.braking:MOVE.acceleration;
  const divisor=Math.expm1(rate*dt);
  const inferred=velocity.clone().addScaledVector(velocity.clone().sub(previousVelocity),divisor>0?1/divisor:0);
  if(inferred.length()>MOVE.runSpeed)inferred.setLength(MOVE.runSpeed);
  const travel=(time:number)=>{
    let sum=0;const n=8;
    for(let i=0;i<=n;i++){
      const t=time*i/n,w=i===0||i===n?1:i%2?4:2;
      sum+=inferred.clone().addScaledVector(velocity.clone().sub(inferred),Math.exp(-rate*t)).length()*w;
    }return sum*time/(3*n);
  };
  let lo=0,hi=1.5;
  for(let i=0;i<12;i++){const mid=(lo+hi)*.5;if(travel(mid)<distance)lo=mid;else hi=mid;}
  return hi;
}

export interface PlanarDisk { centre:Vector3; radius:number }
/** Exact closest candidate for two planar disks intersected with one half-plane.
 * The bounded candidate set contains interior projection and every boundary crossing.
 */
export function projectPlanarTarget(preferred:Vector3,disks:[PlanarDisk,PlanarDisk],normal:Vector3,minimum:number):Vector3|null{
  const candidates=[preferred.clone()],eps=1e-9;
  const dot=(v:Vector3)=>v.x*normal.x+v.z*normal.z;
  const tangent=new Vector3(-normal.z,0,normal.x);
  candidates.push(preferred.clone().addScaledVector(normal,minimum-dot(preferred)));
  for(const disk of disks){
    if(!Number.isFinite(disk.radius)||disk.radius<0)return null;
    const delta=preferred.clone().sub(disk.centre).setY(0);
    if(delta.lengthSq()<1e-18)delta.copy(normal);
    candidates.push(disk.centre.clone().addScaledVector(delta.normalize(),disk.radius));
    const k=minimum-dot(disk.centre);
    if(Math.abs(k)<=disk.radius+eps){
      const h=Math.sqrt(Math.max(0,disk.radius*disk.radius-k*k));
      const centre=disk.centre.clone().addScaledVector(normal,k);
      candidates.push(centre.clone().addScaledVector(tangent,h),centre.clone().addScaledVector(tangent,-h));
    }
  }
  const [a,b]=disks,delta=b.centre.clone().sub(a.centre).setY(0),d=delta.length();
  if(d>eps&&d<=a.radius+b.radius+eps&&d>=Math.abs(a.radius-b.radius)-eps){
    const x=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.radius*a.radius-x*x));
    const axis=delta.divideScalar(d),cross=new Vector3(-axis.z,0,axis.x),centre=a.centre.clone().addScaledVector(axis,x);
    candidates.push(centre.clone().addScaledVector(cross,h),centre.clone().addScaledVector(cross,-h));
  }
  let best:Vector3|null=null,distance=Infinity;
  for(const p of candidates){
    if(dot(p)<minimum-eps||disks.some(d=>Math.hypot(p.x-d.centre.x,p.z-d.centre.z)>d.radius+eps))continue;
    const q=(p.x-preferred.x)**2+(p.z-preferred.z)**2;
    if(q<distance){best=p.clone();best.y=preferred.y;distance=q;}
  }return best;
}
