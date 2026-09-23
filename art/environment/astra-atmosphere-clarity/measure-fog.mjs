// CPU evaluation of the existing heightfog equations; no rendering or source edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import {PerspectiveCamera, Vector3} from 'three';

const root=path.resolve(import.meta.dirname,'../../..');
const baseSha='664f3418570f51dae5fcc9c2babbd8eb5cd1d0f4';
const file='src/world/atmosphere/heightfog.ts';
const original=execFileSync('git',['show',`${baseSha}:${file}`],{cwd:root,encoding:'utf8'});
const current=await fs.readFile(path.join(root,file),'utf8');
function defaults(source){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
 for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)
  if(d.name.getText(ast)==='HEIGHT_FOG_DEFAULTS')return JSON.parse(JSON.stringify(vm.runInNewContext('('+d.initializer.getText(ast)+')')));
 throw Error('HEIGHT_FOG_DEFAULTS missing');
}
export const baseline=defaults(original);
export const candidate={...baseline,hazeDensity:.008,hazeFarDensity:.008,farShadeMin:.65};
assert.deepEqual(defaults(current),process.argv.includes('--baseline')?baseline:candidate,'Only the reviewed three defaults may differ');
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function altitude(ya,yb,h,s){
 const lo=Math.min(ya,yb),hi=Math.max(ya,yb),span=hi-lo;
 if(span<1e-3)return Math.exp(-Math.max(lo-h,0)/s);
 return (clamp(h-lo,0,span)+(hi>h?(Math.exp(-Math.max(lo-h,0)/s)-Math.exp(-(hi-h)/s))*s:0))/span;
}
function optical(p,d){
 if(d>=p.hazeCatchUpEnd)return p.hazeDensity*Math.max(d-p.hazeStart,0);
 const s=Math.max(p.hazeNearStart,p.hazeStart),f=Math.min(Math.max(d-p.hazeStart,0),s-p.hazeStart);
 const t=clamp(d-p.hazeStart-f,0,Math.max(p.hazeNearEnd-s,0)),c=Math.max(d-p.hazeStart-f-t,0);
 const k=(p.hazeDensity*Math.max(p.hazeCatchUpEnd-p.hazeStart,0)-p.hazeDensity*Math.max(s-p.hazeStart,0)-p.hazeNearDensity*Math.max(p.hazeNearEnd-s,0))/(p.hazeCatchUpEnd-p.hazeNearEnd);
 return f*p.hazeDensity+t*p.hazeNearDensity+c*k;
}
export function fog(p,eye,point){
 const v=point.map((x,i)=>x-eye[i]),d=Math.hypot(...v),r=v.map(x=>x/Math.max(d,1e-4)),horizontal=Math.hypot(r[0],r[2]);
 const dot=horizontal>1e-4?(r[0]*p.openDir[0]+r[2]*p.openDir[1])/horizontal:1;
 const open=Math.max(smooth(p.openLo,p.openHi,dot),smooth(p.openUpLo,p.openUpHi,r[1]));
 const a=altitude(eye[1],point[1],p.hazeUniformHeight,p.hazeScaleHeight);
 const ad=mix(altitude(eye[1],point[1],p.hazeDensityUniformHeight,p.hazeDensityScaleHeight),a,open*p.hazeDensityProfileOpen);
 const up=1-p.hazeUpwardCut*smooth(.38,.62,r[1]);
 const tau=up*(ad*mix(1,p.hazeOpenDensity,open)*optical(p,d)+a*p.hazeFarDensity*Math.max(d-p.hazeFarStart,0));
 const distFog=1-Math.exp(-tau);
 const weight=mix(p.baseWeight,1,1-smooth(p.northFullZ,p.northStartZ,point[2]));
 const exp=y=>Math.exp(clamp(-p.falloff*(y-p.baseHeight),-40,3));
 const heightAmount=p.density*weight*(Math.abs(r[1])<1e-3?exp(eye[1])*d:(exp(eye[1])-exp(point[1]))/(p.falloff*r[1]));
 const heightFog=Math.min(1-Math.exp(-heightAmount),.7);
 const hd=horizontal>1e-4?(r[0]*p.hazeHotDir[0]+r[2]*p.hazeHotDir[1])/horizontal:0;
 const hot=p.hazeHotAmount*smooth(...p.hazeHotCos,hd)*smooth(...p.hazeHotUpIn,r[1])*(1-smooth(...p.hazeHotUpOut,r[1]))*smooth(...p.hazeHotDist,d);
 const total=Math.min(1-(1-distFog)*(1-heightFog),mix(mix(p.maxFog,p.maxFogOpen,open),1,hot));
 const shade=mix(1,p.farShadeMin,smooth(p.farShadeStart,p.farShadeFull,d));
 return {distance:d,distFog,heightFog,totalFog:total,shade,ownSurfaceCoefficient:(1-total)*shade};
}
const curves=[];
for(const elevation of [0,15,30])for(const d of [5,10,15,22,30,44,49,60,80,120,190]){
 const angle=elevation*Math.PI/180,eye=[0,1.8,0],point=[0,1.8+d*Math.sin(angle),-d*Math.cos(angle)];
 curves.push({elevation,distance:d,before:fog(baseline,eye,point),after:fog(candidate,eye,point)});
}
for(const row of curves){
 assert(row.after.totalFog>=0&&row.after.totalFog<=1);
 assert(row.after.totalFog<=row.before.totalFog+1e-12);
 assert(row.after.ownSurfaceCoefficient>=row.before.ownSurfaceCoefficient-1e-12);
}
const report={baseSha,sourceFile:file,changes:{hazeDensity:[.018,.008],hazeFarDensity:[.055,.008],farShadeMin:[.3,.65]},note:'Exact existing optical-depth and non-emissive shade equations, before postfx. Peak radiance >=1.3 is progressively exempt from distance shade; no output-pixel brightness is predicted here. Low horizontal north ray includes retained height fog; source changes no colour, shaft, sky, shadow or geometry.',curves};
if(process.argv[2]&&!process.argv[2].startsWith('--')){
 const captureDir=path.resolve(process.argv[2]),m=JSON.parse(await fs.readFile(path.join(captureDir,'manifest.json'),'utf8'));
 report.nativeDepth={};
 for(const [name,im]of Object.entries(m.images)){
  if(!im.depth)continue;
  const bytes=await fs.readFile(path.join(captureDir,im.depth.file)),depth=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
  const {position,direction,fov}=im.camera,c=new PerspectiveCamera(fov,im.stats.width/im.stats.height,.1,900);c.position.fromArray(position);c.lookAt(new Vector3(...position).add(new Vector3(...direction)));c.updateMatrixWorld();
  const buckets={};
  for(let y=0;y<im.depth.height;y++)for(let x=0;x<im.depth.width;x++){
   const d=depth[y*im.depth.width+x];if(!Number.isFinite(d))continue;
   const ray=new Vector3((x+.5)/im.depth.width*2-1,1-(y+.5)/im.depth.height*2,.5).unproject(c).sub(c.position).normalize();
   const point=ray.multiplyScalar(d).add(c.position).toArray(),b=fog(baseline,position,point),a=fog(candidate,position,point);
   const key=(y<im.depth.height/2?'upper':'lower')+'/'+(d<20?'0-20':d<50?'20-50':d<100?'50-100':'100+');
   const q=buckets[key]??={n:0,beforeVeil:0,afterVeil:0,beforeSurface:0,afterSurface:0};q.n++;q.beforeVeil+=b.totalFog;q.afterVeil+=a.totalFog;q.beforeSurface+=b.ownSurfaceCoefficient;q.afterSurface+=a.ownSurfaceCoefficient;
  }
  for(const q of Object.values(buckets))for(const k of ['beforeVeil','afterVeil','beforeSurface','afterSurface'])q[k]/=q.n;
  report.nativeDepth[name]=buckets;
 }
}
await fs.writeFile(new URL('./fog-curves.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(curves.filter(r=>r.elevation===0&&[30,60,80,120].includes(r.distance)),null,2));
