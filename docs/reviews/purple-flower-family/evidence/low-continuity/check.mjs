import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import ts from 'typescript';import * as T from 'three';
import {pin,source,candidateSource,verifyReceipt} from './source.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),raw=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const ghash=g=>sha(Buffer.concat([...Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).flatMap(([k,a])=>[Buffer.from(k),raw(a.array)]),raw(g.index.array)]));
function env(candidate){const cache=new Map(),rngStreams=new Map(),traces=new WeakMap(),materialOptions=[];let currentBuild=null;
 function record(seed,key,args,value){const name=JSON.stringify([currentBuild,seed]);let stream=rngStreams.get(name);if(!stream){stream={count:0,hash:createHash('sha256')};rngStreams.set(name,stream);}stream.count++;stream.hash.update(JSON.stringify([key,args,value]));}
 function wrap(raw,seed){const fn=()=>{const v=raw();record(seed,'next',[],v);return v;};for(const key of Object.keys(raw))fn[key]=key==='fork'?label=>{record(seed,key,[label],null);return wrap(raw.fork(label),seed+'/'+label);}:typeof raw[key]==='function'?(...args)=>{const v=raw[key](...args);record(seed,key,args,v);return v;}:raw[key];return fn;}
 const trace=m=>{if(!traces.has(m))traces.set(m,{heads:[],parts:[]});return traces.get(m);};
 function headTrace(label,fn,args){const[m,center,normal,radius]=args,start=m.p.length/3,firstIndex=m.i.length;fn(...args);trace(m).heads.push({label,start,end:m.p.length/3,firstIndex,endIndex:m.i.length,center:center.toArray(),normal:normal.toArray(),radius});}
 function load(f){f=path.posix.normalize(f);if(cache.has(f))return cache.get(f).exports;const mod={exports:{}};cache.set(f,mod);let s=candidate?candidateSource(f):source(f);
 if(f==='src/world/vegetation/plantgeo.ts'){
  for(const name of ['clusterHead','purpleCorollaHead'])if(s.includes('function '+name+'(')){s=s.replace('function '+name+'(', 'function '+name+'Original(');s+='\nfunction '+name+'(...args: any[]) { return headTrace("'+name+'", '+name+'Original, args); }\n';}
 }
 new Function('require','module','exports','headTrace',ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:load(path.posix.join(path.posix.dirname(f),id+'.ts')),mod,mod.exports,headTrace);
 if(f==='src/world/util/prng.ts'){const orig=mod.exports.createRng;mod.exports.createRng=seed=>wrap(orig(seed),String(seed));}
 if(f==='src/world/vegetation/geometry.ts'){
  for(const name of ['tube','curvedLeaf','foldedLeaf']){const orig=mod.exports[name];mod.exports[name]=(mesh,...args)=>{const start=mesh.p.length/3,firstIndex=mesh.i.length;orig(mesh,...args);trace(mesh).parts.push({name,start,end:mesh.p.length/3,firstIndex,endIndex:mesh.i.length,args:JSON.stringify(args)});};}
  const orig=mod.exports.MeshBuilder.prototype.finish;mod.exports.MeshBuilder.prototype.finish=function(...args){const preY=this.p[1],g=orig.apply(this,args);g.userData.trace={...trace(this),groundOffset:g.attributes.position.getY(0)-preY};return g;};
 }
 if(f==='src/world/vegetation/plantgeo.ts'){
  const orig=mod.exports.variants;mod.exports.variants=(count,seed,pal,build,lods=['high','mid','low'])=>orig(count,seed,pal,(s,p,d,v)=>{const prev=currentBuild;currentBuild=[seed,d];const g=build(s,p,d,v);currentBuild=prev;return g;},lods);
 }
 if(f==='src/world/vegetation/materials.ts'){const orig=mod.exports.createVegMaterial;mod.exports.createVegMaterial=(ctx,kind,options)=>{materialOptions.push([kind,options]);return orig(ctx,kind,options);};}
 return mod.exports;}
 return{load,materialOptions,rng:()=>Object.fromEntries([...rngStreams].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,{count:v.count,hash:v.hash.copy().digest('hex')}]))};
}
function build(e){const read=n=>e.load('src/world/'+n+'.ts'),{WORLD}=read('config'),{LAYOUT}=read('layout'),ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1}},group=new T.Group(),field=new(read('vegetation/field').VegField)(ctx,WORLD.detailRadius+6,.5),plants=read('vegetation/plants').buildPlants(ctx,field,group);return{ctx,plants,group};}
console.log('CPU fixture: frozen family / isolated Low proposal');
const ea=env(false),a=build(ea),eb=env(true),b=build(eb);
assert.deepEqual(ea.materialOptions,eb.materialOptions);
const changed=[],unchanged=[],geometryRows=[];
const bytes=g=>({attributes:Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),indices:g.index.array.byteLength,vertices:g.attributes.position.count,triangles:g.index.count/3,indexType:g.index.array.constructor.name});
for(let i=0;i<a.plants.all.length;i++){
 const old=a.plants.all[i],now=b.plants.all[i];
 assert.deepEqual(old.items,now.items);assert.deepEqual(old.packLayout,now.packLayout);
 for(const name of ['lodDistances','castShadowLods','hysteresis','receiveShadow'])assert.deepEqual(old.opts[name],now.opts[name]);
 for(let v=0;v<old.opts.variants.length;v++)for(let lod=0;lod<old.opts.variants[v].length;lod++){
  const ga=old.opts.variants[v][lod],gb=now.opts.variants[v][lod],label=[old.opts.name,v,lod];
  const authorized=old.opts.name==='flowers'&&v<2&&lod===2;
  if(!authorized){assert.equal(ghash(ga),ghash(gb),'Frozen geometry '+label);unchanged.push(label);}
  else {assert.notEqual(ghash(ga),ghash(gb));changed.push(label);}
  if(old.opts.name==='flowers')geometryRows.push({label,before:bytes(ga),after:bytes(gb),hashBefore:ghash(ga),hashAfter:ghash(gb),boundsBefore:[ga.boundingBox.min.toArray(),ga.boundingBox.max.toArray()],boundsAfter:[gb.boundingBox.min.toArray(),gb.boundingBox.max.toArray()]});
 }
}
assert.equal(changed.length,2);assert.equal(unchanged.length,96);
const attachmentRows=[];
for(let v=0;v<2;v++){
 const gm=b.plants.flowers.opts.variants[v][1],gl=b.plants.flowers.opts.variants[v][2];
 const tm=gm.userData.trace,tl=gl.userData.trace;
 assert.equal(tm.heads.length,7);assert.equal(tl.heads.length,7);
 assert.equal(tm.groundOffset,tl.groundOffset);assert.equal(gl.boundingBox.min.y,0);
 assert.equal(gl.index.count/3,182);
 for(const attr of Object.values(gl.attributes))assert([...attr.array].every(Number.isFinite));
 const tubesM=tm.parts.filter(p=>p.name==='tube'),tubesL=tl.parts.filter(p=>p.name==='tube');
 assert.equal(tubesL.length,7);assert.equal(tl.parts.length,7,'Low emits only stem tubes outside heads');
 for(let h=0;h<7;h++){
  const hm=tm.heads[h],hl=tl.heads[h];
  for(const key of ['center','normal','radius'])assert.deepEqual(hm[key],hl[key]);
  assert.equal((hl.endIndex-hl.firstIndex)/3,14);
  // Grounded first rings are byte-exact: original tangent/root, unchanged UV and colour.
  for(const name of ['position','uv','color']){
   const am=gm.attributes[name],al=gl.attributes[name],m=tubesM[h].start,l=tubesL[h].start;
   assert.deepEqual(raw(am.array.slice(m*am.itemSize,(m+3)*am.itemSize)),raw(al.array.slice(l*al.itemSize,(l+3)*al.itemSize)));
  }
  // Low keeps actual petal root, shoulders and tip, plus the complete tiny medium throat.
  for(let p=0;p<6;p++)for(const [k,m] of [0,1,3,5].entries())for(const name of ['position','uv','color']){
   const am=gm.attributes[name],al=gl.attributes[name],im=hm.start+p*6+m,il=hl.start+p*4+k;
   assert.deepEqual(raw(am.array.slice(im*am.itemSize,(im+1)*am.itemSize)),raw(al.array.slice(il*al.itemSize,(il+1)*al.itemSize)));
  }
  for(const name of ['position','uv','color']){
   const am=gm.attributes[name],al=gl.attributes[name];
   assert.deepEqual(raw(am.array.slice((hm.end-4)*am.itemSize,hm.end*am.itemSize)),raw(al.array.slice((hl.end-4)*al.itemSize,hl.end*al.itemSize)));
  }
  let minArea=Infinity,minProjectedArea=Infinity,minNormal=Infinity,maxNormal=0;
  const n=new T.Vector3().fromArray(hl.normal).normalize();
  for(let j=hl.firstIndex;j<hl.endIndex;j+=3){const points=Array.from(gl.index.array.slice(j,j+3),k=>new T.Vector3().fromBufferAttribute(gl.attributes.position,k)),cross=points[1].sub(points[0]).cross(points[2].sub(points[0]));minArea=Math.min(minArea,cross.length()/2);minProjectedArea=Math.min(minProjectedArea,cross.dot(n)/2);}
  for(let j=hl.start;j<hl.end;j++){const length=new T.Vector3().fromBufferAttribute(gl.attributes.normal,j).length();minNormal=Math.min(minNormal,length);maxNormal=Math.max(maxNormal,length);}
  assert(minArea>1e-10&&minProjectedArea>1e-10);assert(minNormal>.999999&&maxNormal<1.000001);
  attachmentRows.push({variant:v,head:h,center:hl.center,normal:hl.normal,radius:hl.radius,groundOffset:tl.groundOffset,minArea,minProjectedArea,normalRange:[minNormal,maxNormal]});
 }
}
const ra=ea.rng(),rb=eb.rng(),streamChanges=[];
for(const key of new Set([...Object.keys(ra),...Object.keys(rb)])){
 if(JSON.stringify(ra[key])===JSON.stringify(rb[key]))continue;
 const[build,seed]=JSON.parse(key);
 assert.equal(build[0],a.ctx.config.seed+'/flower');assert.equal(build[1],'low');
 assert(new RegExp('^'+a.ctx.config.seed+'/flower/[01](/head-[0-6])?$').test(seed));
 assert(rb[key]);streamChanges.push({key,before:ra[key]??null,after:rb[key]});
 const midKey=JSON.stringify([[build[0],'mid'],seed]);assert.deepEqual(rb[key],rb[midKey],'Low samples the true medium plant and petals');
}
assert.equal(streamChanges.length,16);assert.equal(streamChanges.filter(s=>s.before===null).length,14);
const pg=eb.load('src/world/vegetation/plantgeo.ts');
for(let v=0;v<2;v++)for(const[lod,d]of ['high','mid','low'].entries()){
 const repeat=pg.purpleFlowerGeometry(`${a.ctx.config.seed}/flower/${v}`,pg.makePalette(a.ctx.config.palette),d);
 assert.equal(ghash(repeat),ghash(b.plants.flowers.opts.variants[v][lod]));repeat.dispose();
}
const packRows=[];
for(let lod=0;lod<3;lod++)for(const pack of a.plants.flowers.packLayout[lod]){
 const ga=ea.load('src/world/vegetation/lodset.ts').packGeometries(pack.map(v=>a.plants.flowers.opts.variants[v][lod]));
 const gb=eb.load('src/world/vegetation/lodset.ts').packGeometries(pack.map(v=>b.plants.flowers.opts.variants[v][lod]));
 packRows.push({lod,pack,before:bytes(ga),after:bytes(gb),instanceCapacity:a.plants.flowers.items.filter(it=>pack.includes(it.variant)).length});
 ga.dispose();gb.dispose();
}
const cameras=[a.ctx.layout.viewpoints.find(v=>v.id==='D_log'),{id:'M11-north',position:[.2,1.45,-6],target:[4.5,2.75,-42],fov:48}];
const inventory=a.plants.flowers.opts.variants.map((_,v)=>a.plants.flowers.items.filter(it=>it.variant===v).length);
const packDelta=packRows.filter(r=>r.lod===2).reduce((n,r)=>n+r.after.triangles-r.before.triangles,0);
const cameraInventories=cameras.map(vp=>{
 const counts=Array.from({length:4},()=>[0,0,0]);
 for(const it of a.plants.flowers.items){const d=Math.hypot(it.x-vp.position[0],it.z-vp.position[2]);counts[it.variant][d<9?0:d<16?1:2]++;}
 const lowAll=counts.reduce((n,c)=>n+c[2],0),lowCluster=counts[0][2]+counts[1][2];
 return {camera:vp,countsByVariantAndLod:counts,lowAll,lowCluster,submittedLowTrianglesAddedBeforeFrustumCulling:lowAll*packDelta,nonCollapsedClusterLowTrianglesAdded:lowCluster*17};
});
const receipt={pin,scope:'Scratch CPU fixture against frozen High/Medium family; no production build/render or GPU/FPS verdict.',changed,unchangedGeometryCount:unchanged.length,unchanged,highMidBuffersExact:true,allPlantInstances:a.plants.all.reduce((n,s)=>n+s.items.length,0),purpleInventoryByVariant:inventory,yellowInstances:a.plants.yellowFlowers.items.length,allInstanceRecordsSettingsPacksExact:true,allMaterialOptionsExact:true,flowerMaterialOptions:ea.materialOptions.find(([_,o])=>o.name==='veg-flowers'),rootRingPositionUvColorExact:true,headAttachmentAxisRadiusExact:true,lowCommonPetalPositionUvColorExact:true,groundOffsetsExact:true,allOtherRngStreamsExact:true,streamChanges,deterministicAllPurpleLodsExact:true,geometryRows,attachmentRows,packRows,cameraInventories,allLowInventoryUpperBound:{submittedTrianglesAdded:a.plants.flowers.items.length*packDelta,nonCollapsedClusterTrianglesAdded:(inventory[0]+inventory[1])*17}};
verifyReceipt('evidence.json',receipt);
console.log(JSON.stringify({changed,unchanged:unchanged.length,inventory,packRows,cameraInventories,allLowInventoryUpperBound:receipt.allLowInventoryUpperBound},null,2));

// Static source triangles on the frozen family's same 16 m / D-bearing probes. This measures
// actual open petal coverage; no rendered crop, hidden dome, wind, occlusion or AA simulation.
function projectedTriangles(g,h,matrix,camera){
 const points=[];
 for(let i=h.start;i<h.end;i++){const p=new T.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix).project(camera);points.push([(p.x+1)*640,(1-p.y)*360]);}
 const triangles=[];for(let i=h.firstIndex;i<h.endIndex;i+=3)triangles.push(Array.from(g.index.array.slice(i,i+3),k=>points[k-h.start]));return triangles;
}
function inside(x,y,t){const cross=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);const a=cross(t[0],t[1]),b=cross(t[1],t[2]),c=cross(t[2],t[0]);return(a>=-1e-10&&b>=-1e-10&&c>=-1e-10)||(a<=1e-10&&b<=1e-10&&c<=1e-10);}
const vp=cameras[0],direction=new T.Vector3().fromArray(vp.target).sub(new T.Vector3().fromArray(vp.position)).normalize(),rows=[];
for(let v=0;v<2;v++){
 const item=a.plants.flowers.items.findIndex(it=>it.variant===v),it=a.plants.flowers.items[item],matrix=new T.Matrix4().fromArray(it.matrix),dx=vp.position[0]-it.x,dz=vp.position[2]-it.z,len=Math.hypot(dx,dz);
 const camera=new T.PerspectiveCamera(vp.fov,1280/720,.08,900);camera.position.set(it.x+dx/len*16,vp.position[1],it.z+dz/len*16);camera.lookAt(camera.position.clone().add(direction));camera.updateMatrixWorld(true);
 const gs=[a.plants.flowers.opts.variants[v][1],a.plants.flowers.opts.variants[v][2],b.plants.flowers.opts.variants[v][2]],ts=gs.map(g=>g.userData.trace.heads.flatMap(h=>projectedTriangles(g,h,matrix,camera)));
 const all=ts.flat(2),x0=Math.min(...all.map(p=>p[0])),x1=Math.max(...all.map(p=>p[0])),y0=Math.min(...all.map(p=>p[1])),y1=Math.max(...all.map(p=>p[1])),step=.125,nx=Math.ceil((x1-x0)/step),ny=Math.ceil((y1-y0)/step),counts=[0,0,0],inter=[0,0],union=[0,0],xor=[0,0];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const x=x0+(i+.5)*step,y=y0+(j+.5)*step,hit=ts.map(tris=>tris.some(t=>inside(x,y,t)));
  for(let k=0;k<3;k++)counts[k]+=Number(hit[k]);
  for(let k=0;k<2;k++){inter[k]+=Number(hit[0]&&hit[k+1]);union[k]+=Number(hit[0]||hit[k+1]);xor[k]+=Number(hit[0]!==hit[k+1]);}
 }
 rows.push({variant:v,item,cameraPosition:camera.position.toArray(),rootDistanceM:16,sampleStepPx:step,headCounts:gs.map(g=>g.userData.trace.heads.length),unionAreaPx2:{frozenMedium:counts[0]*step*step,frozenLow:counts[1]*step*step,candidateLow:counts[2]*step*step},midToLowIoU:{frozen:inter[0]/union[0],candidate:inter[1]/union[1]},symmetricDifferencePx2:{frozen:xor[0]*step*step,candidate:xor[1]*step*step}});
}
verifyReceipt('low-transition-evidence.json',{pin,scope:'Same two existing-instance16m probes as frozen family. Union of actual head triangles on1/8px lattice; excludes stems/leaves, wind, world occlusion, AA, shading and GPU/continuous-motion judgment.',rows});
console.log(JSON.stringify({lowTransition:rows},null,2));

console.log("Portable Low adaptation: original evidence and projection receipts reproduced exactly; no files written.");
