/** Nearest flat-ground endpoint in an annulus, speed disk and lateral half-plane.
 * This is endpoint geometry only; no time, contact commitment or path is advanced.
 */
import { Vector3 } from 'three';

export interface LandingAnnulus { centre:Vector3; minRadius:number; maxRadius:number }
export interface LandingDisk { centre:Vector3; radius:number }
export interface LandingHalfPlane { normal:Vector3; minimum:number }
export interface LandingWitness {
  annulusDistance:number; speedDistance:number; lateralProjection:number;
  /** Signed distance slack in metres, using a unit XZ half-plane normal. */
  slacks:{inner:number;outer:number;speed:number;lateral:number};
  active:('inner'|'outer'|'speed'|'lateral')[];
}
export type LandingProjection =
  | {status:'feasible';target:Vector3;distance:number;witness:LandingWitness;candidates:number;numericalTolerance:number}
  | {status:'infeasible';reason:string;candidates:number;numericalTolerance:number};
interface Point { x:number; z:number }
interface Circle extends Point { radius:number }
const finiteVector=(v:Vector3)=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

/** The closest feasible point is the preference itself, a stationary point on one
 * boundary, or an intersection of boundaries. Enumerating these includes the
 * inner circle of the nonconvex annulus; a convex-only disk projection is insufficient.
 * A tiny, reported roundoff tolerance applies to signed distance residuals only.
 */
export function projectLandingXZ(preferred:Vector3,annulus:LandingAnnulus,speed:LandingDisk,
  halfPlane:LandingHalfPlane):LandingProjection {
  if(!finiteVector(preferred)||!finiteVector(annulus.centre)||!finiteVector(speed.centre)||!finiteVector(halfPlane.normal)||
    !Number.isFinite(annulus.minRadius)||!Number.isFinite(annulus.maxRadius)||annulus.minRadius<0||annulus.maxRadius<annulus.minRadius||
    !Number.isFinite(speed.radius)||speed.radius<0||!Number.isFinite(halfPlane.minimum))
    return {status:'infeasible',reason:'invalid-input',candidates:0,numericalTolerance:0};
  const normalLength=Math.hypot(halfPlane.normal.x,halfPlane.normal.z);
  if(!Number.isFinite(normalLength))return {status:'infeasible',reason:'unsupported-numeric-scale',candidates:0,numericalTolerance:0};
  if(normalLength===0)return {status:'infeasible',reason:'zero-half-plane-normal',candidates:0,numericalTolerance:0};
  const nx=halfPlane.normal.x/normalLength,nz=halfPlane.normal.z/normalLength,minimum=halfPlane.minimum/normalLength;
  const scale=Math.max(1,Math.abs(preferred.x),Math.abs(preferred.z),Math.abs(annulus.centre.x),Math.abs(annulus.centre.z),
    Math.abs(speed.centre.x),Math.abs(speed.centre.z),annulus.maxRadius,speed.radius,Math.abs(minimum));
  const tolerance=128*Number.EPSILON*scale;
  if(!Number.isFinite(normalLength)||!Number.isFinite(scale*scale))return {status:'infeasible',reason:'unsupported-numeric-scale',candidates:0,numericalTolerance:tolerance};
  const circles:Circle[]=[
    {x:annulus.centre.x,z:annulus.centre.z,radius:annulus.maxRadius},
    {x:speed.centre.x,z:speed.centre.z,radius:speed.radius},
    ...(annulus.minRadius>0?[{x:annulus.centre.x,z:annulus.centre.z,radius:annulus.minRadius}]:[]),
  ];
  const candidates:Point[]=[];
  const add=(x:number,z:number)=>{if(Number.isFinite(x)&&Number.isFinite(z))candidates.push({x,z});};
  add(preferred.x,preferred.z);
  const lineDistance=nx*preferred.x+nz*preferred.z-minimum;
  add(preferred.x-lineDistance*nx,preferred.z-lineDistance*nz);
  for(const c of circles){
    const dx=preferred.x-c.x,dz=preferred.z-c.z,d=Math.hypot(dx,dz);
    if(c.radius===0)add(c.x,c.z);
    else if(d>0)add(c.x+c.radius*dx/d,c.z+c.radius*dz/d);
    else {
      // All points on this circle tie. If no cardinal point is feasible, a
      // nonempty proper feasible arc has an enumerated boundary intersection.
      add(c.x+c.radius,c.z);add(c.x-c.radius,c.z);add(c.x,c.z+c.radius);add(c.x,c.z-c.radius);
    }
    const signed=nx*c.x+nz*c.z-minimum;
    if(Math.abs(signed)<=c.radius+tolerance){
      const h2=c.radius*c.radius-signed*signed;
      if(h2>=-tolerance*Math.max(1,c.radius,Math.abs(signed))){
        const h=Math.sqrt(Math.max(0,h2)),x=c.x-signed*nx,z=c.z-signed*nz;
        add(x-h*nz,z+h*nx);if(h>0)add(x+h*nz,z-h*nx);
      }
    }
  }
  for(let i=0;i<circles.length;i++)for(let j=i+1;j<circles.length;j++){
    const a=circles[i],b=circles[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    // Equal concentric circles need no special intersections: their stationary
    // points and any intersections with the remaining boundaries are above.
    if(d===0||d>a.radius+b.radius+tolerance||d<Math.abs(a.radius-b.radius)-tolerance)continue;
    const along=((a.radius-b.radius)*(a.radius+b.radius)+d*d)/(2*d),h2=a.radius*a.radius-along*along;
    if(h2< -tolerance*Math.max(1,a.radius,Math.abs(along)))continue;
    const h=Math.sqrt(Math.max(0,h2)),ux=dx/d,uz=dz/d,x=a.x+along*ux,z=a.z+along*uz;
    add(x-h*uz,z+h*ux);if(h>0)add(x+h*uz,z-h*ux);
  }
  const witness=(p:Point):LandingWitness=>{
    const annulusDistance=Math.hypot(p.x-annulus.centre.x,p.z-annulus.centre.z);
    const speedDistance=Math.hypot(p.x-speed.centre.x,p.z-speed.centre.z),lateralProjection=nx*p.x+nz*p.z;
    const slacks={inner:annulusDistance-annulus.minRadius,outer:annulus.maxRadius-annulusDistance,
      speed:speed.radius-speedDistance,lateral:lateralProjection-minimum};
    const active=(Object.keys(slacks) as (keyof typeof slacks)[]).filter(k=>Math.abs(slacks[k])<=tolerance);
    return {annulusDistance,speedDistance,lateralProjection,slacks,active};
  };
  let best:{point:Point;distance:number;witness:LandingWitness}|null=null;
  for(const point of candidates){
    const w=witness(point);if(Object.values(w.slacks).some(s=>s< -tolerance))continue;
    const distance=Math.hypot(point.x-preferred.x,point.z-preferred.z);
    if(!best||distance<best.distance||(distance===best.distance&&(point.x<best.point.x||(point.x===best.point.x&&point.z<best.point.z))))
      best={point,distance,witness:w};
  }
  if(!best)return {status:'infeasible',reason:'empty-intersection',candidates:candidates.length,numericalTolerance:tolerance};
  return {status:'feasible',target:new Vector3(best.point.x,preferred.y,best.point.z),distance:best.distance,
    witness:best.witness,candidates:candidates.length,numericalTolerance:tolerance};
}
