import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file); if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const js = ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',js)((name)=>{
    if(name==='three')return THREE; if(name==='three/examples/jsm/utils/BufferGeometryUtils.js')return BufferGeometryUtils;
    if(name.startsWith('.')){const p=path.resolve(path.dirname(file),name);for(const f of[p,p+'.ts',path.join(p,'index.ts')])if(f.endsWith('.ts')&&existsSync(f))return loadTs(f);}
    throw new Error(name);
  },module,module.exports);return module.exports;
}
const code=readFileSync('src/world/trees/index.ts','utf8'),ast=ts.createSourceFile('index.ts',code,ts.ScriptTarget.Latest,true);let profiles;
for(const s of ast.statements)if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)if(d.name.getText(ast)==='GIANT_PROFILES'){
 const m={exports:{}};new Function('module',ts.transpileModule('module.exports='+d.initializer.getText(ast),{}).outputText)(m);profiles=m.exports;
}
const {createGiantTree}=loadTs('src/world/trees/giant.ts'),{createRng}=loadTs('src/world/util/prng.ts'),{createTerrain}=loadTs('src/world/terrain/heightfield.ts'),{LAYOUT}=loadTs('src/world/layout.ts'),{WORLD}=loadTs('src/world/config.ts');
const terrain=createTerrain(),rng=createRng(WORLD.seed).fork('trees');
const poses=JSON.parse(readFileSync('art/environment/astra-quality/settings.json','utf8')).poses;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y,z)=>{const v=Math.sin(x*12.9898+y*78.233+z*24.11)*43758.5453;return v-Math.floor(v);};
const noise=([x,y,z])=>{const i=[Math.floor(x),Math.floor(y),Math.floor(z)],f=[ss(0,1,x-i[0]),ss(0,1,y-i[1]),ss(0,1,z-i[2])];return mix(mix(mix(hash(...i),hash(i[0]+1,i[1],i[2]),f[0]),mix(hash(i[0],i[1]+1,i[2]),hash(i[0]+1,i[1]+1,i[2]),f[0]),f[1]),mix(mix(hash(i[0],i[1],i[2]+1),hash(i[0]+1,i[1],i[2]+1),f[0]),mix(hash(i[0],i[1]+1,i[2]+1),hash(i[0]+1,i[1]+1,i[2]+1),f[0]),f[1]),f[2]);};
const field=p=>noise(p.map(x=>x*13))*0.55+noise(p.map(x=>x*41+11))*0.45;
const az=WORLD.sun.azimuthDeg*Math.PI/180,el=WORLD.sun.elevationDeg*Math.PI/180,sunDir=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el));
const results=[];
for(const [id,poseId] of [['stair-bank-giant','sn-bole-stair-bank'],['lantern-tree','sn-bole-lantern-tree'],['north-west-near','sn-bole-nw-near']]){
 const def=LAYOUT.giantTrees.find(d=>d.id===id),[x,,z]=def.position,y=terrain.height(x,z),origin=new THREE.Vector3(x,y,z);
 const a=createGiantTree(def,rng,{groundAt:(u,v)=>terrain.height(x+u,z+v)-y,palette:WORLD.palette,profile:profiles[id],sunDir,pathAt:(u,v)=>terrain.mask(x+u,z+v).path});
 const geo=a.nearBase; if(!geo)throw new Error('No near base');const pos=geo.attributes.position,norm=geo.attributes.normal,root=geo.attributes.aRoot,colour=geo.attributes.color,index=geo.index;
 const pose=poses[poseId],cam=new THREE.PerspectiveCamera(pose.fov,16/9,.1,400);cam.position.fromArray(pose.p);cam.lookAt(new THREE.Vector3(...pose.t));cam.updateMatrixWorld();cam.updateProjectionMatrix();
 const tally={id,poseId,triangles:0,weight:0,rawMoss:0,fullMask:0,cushions:0,oldCover:0,newCover:0,oldDense:0,newDense:0,affected:0,affectedWeight:0,samples:[]};
 const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),p=new THREE.Vector3(),n=new THREE.Vector3(),toEye=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
 for(let j=0;j<index.count;j+=3){const ids=[index.getX(j),index.getX(j+1),index.getX(j+2)];const w=ids.reduce((s,k)=>s+root.getW(k),0)/3;if(w>=.5)continue;
   va.fromBufferAttribute(pos,ids[0]);vb.fromBufferAttribute(pos,ids[1]);vc.fromBufferAttribute(pos,ids[2]);p.copy(va).add(vb).add(vc).divideScalar(3).add(origin);const screen=p.clone().project(cam);if(Math.abs(screen.x)>1||Math.abs(screen.y)>1||screen.z>1||screen.z<0)continue;
   n.set(0,0,0);for(const k of ids)n.add(new THREE.Vector3().fromBufferAttribute(norm,k));n.normalize();toEye.copy(cam.position).sub(p);const d=toEye.length();toEye.divideScalar(d);const facing=n.dot(toEye);if(facing<=0)continue;
   const weight=ab.subVectors(vb,va).cross(ac.subVectors(vc,va)).length()*.5*facing/(d*d);const mask=w<0&&w>-.5?Math.min(1,-w/.45):w<=-1&&w>-1.5?(-w-1)/.45:0;
   const fine=field(p.toArray()),oldCover=ss(.34,.82,mask*(.5+.95*fine)),newCover=mix(ss(.40,.84,mask)*ss(.24,.58,fine),oldCover,ss(.96,1,mask));
   tally.triangles++;tally.weight+=weight;tally.rawMoss+=mask*weight;tally.fullMask+=(mask>.995?weight:0);tally.cushions+=(w<-.47&&w>-.5?weight:0);tally.oldCover+=oldCover*weight;tally.newCover+=newCover*weight;tally.oldDense+=(oldCover>.5?weight:0);tally.newDense+=(newCover>.5?weight:0);
   if(mask>.35){tally.affectedWeight+=weight;tally.affected+=(1-newCover)*weight;}
   const color=[0,1,2].map(axis=>ids.reduce((s,k)=>s+colour.array[k*3+axis],0)/3);tally.samples.push({p:p.toArray(),mask,fine,weight,oldCover,newCover,color,cushion:w<-.47&&w>-.5});
 }
 for(const key of ['rawMoss','fullMask','cushions','oldCover','newCover','oldDense','newDense'])tally[key]/=tally.weight;
 tally.barkInAffected=tally.affected/tally.affectedWeight;
 const surface=tally.samples.filter(p=>!p.cushion),affected=surface.filter(p=>p.mask>.35),sum=(rows,fn)=>rows.reduce((s,p)=>s+fn(p)*p.weight,0);
 tally.barkSurface={oldMeanCover:sum(surface,p=>p.oldCover)/sum(surface,()=>1),newMeanCover:sum(surface,p=>p.newCover)/sum(surface,()=>1),oldBarkInAffected:sum(affected,p=>1-p.oldCover)/sum(affected,()=>1),newBarkInAffected:sum(affected,p=>1-p.newCover)/sum(affected,()=>1)};
 console.log(JSON.stringify({...tally,samples:undefined},null,2));results.push(tally);
 for(const key of['geometry','cards','authoredLeaves','authoredCards','nearBase'])a[key]?.dispose();
}
writeFileSync('gauntlet/tmp/astra-bark-mask.json',JSON.stringify(results));
