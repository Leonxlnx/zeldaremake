import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import * as U from 'three/addons/utils/BufferGeometryUtils.js';
import {triangles,tree,nearest} from './triangle-distance.mjs';
const sourceDir=path.dirname(new URL(import.meta.url).pathname), root=process.cwd();
const dir=path.resolve('gauntlet/tmp/monotone-sleeve-replay/contacts');fs.mkdirSync(dir,{recursive:true});
const pin='579078ca77b7af846f4805c27fbfecf21c784d72';
const baselineHelper=execFileSync('git',['show',pin+':src/world/character/sleeve-drape.ts'],{encoding:'utf8'});
const ctx=new Proxy({}, {get:(_,k)=>String(k).endsWith('Gradient')?()=>({addColorStop(){}}):k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
function loader(old){const cache=new Map(),hashes={};function load(rel){const file=path.resolve(root,rel);if(cache.has(file))return cache.get(file).exports;let source=old&&file.endsWith('/sleeve-drape.ts')?baselineHelper:fs.readFileSync(file,'utf8');hashes[path.relative(root,file)]=createHash('sha256').update(source).digest('hex');if(file.endsWith('/link.ts'))source=source.replace('  batchStaticLinkParts(rig);','');const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:id.includes('BufferGeometryUtils')?U:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}return{load,hashes};}
const modules=[loader(true),loader(false)],actors=modules.map(m=>m.load('src/world/character/link.ts').createLink());
const meshKey=o=>{let parts=[];for(let n=o;n.parent;n=n.parent)parts.push(n.name+':'+n.parent.children.filter(x=>x.name===n.name).indexOf(n));return parts.reverse().join('/');};
const meshes=a=>{const out=[];a.group.traverse(o=>{if(o.isMesh)out.push(o)});return out;};
const buf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
let exactArrays=0,exactMeshes=0;
const before=new Map(meshes(actors[0]).map(m=>[meshKey(m),m]));
for(const m of meshes(actors[1])){const old=before.get(meshKey(m));assert(old);if(['sleeve','sleeve-stitches'].includes(m.name))continue;for(const key of Object.keys(m.geometry.attributes)){assert(buf(m.geometry.attributes[key].array).equals(buf(old.geometry.attributes[key].array)),meshKey(m)+key);exactArrays++;}if(m.geometry.index){assert(buf(m.geometry.index.array).equals(buf(old.geometry.index.array)));exactArrays++;}exactMeshes++;}
assert.equal(modules[1].hashes['src/world/character/sleeve-drape.ts'],'a636053e4e8deadcef93a4918482955a3c69df38b225dd36e94cdfe584c889d0','check out the reviewed helper');
const snapshots=[];
const snapshot=(name,state=null)=>({name,state,joints:Object.fromEntries(Object.entries(actors[1].rig).filter(([k,v])=>v?.isGroup).map(([k,v])=>[k,{position:v.position.toArray(),quaternion:v.quaternion.toArray(),scale:v.scale.toArray()}]))});
snapshots.push(snapshot('construction'));
const motion=JSON.parse(fs.readFileSync(path.join(sourceDir,'capture-inputs.json'),'utf8'));
const ground={height:()=>0,blocked:()=>false,onStairs:()=>false};
for(const c of motion.captures.slice(0,3)){
 const actor=actors[1],control=modules[1].load('src/world/character/locomotion.ts').createLocomotion(ground,0,.5,Math.PI),pose=modules[1].load('src/world/character/play-pose.ts').createPlayPose(actor.rig,ground.height);
 pose.reset();pose.update(control.state,0,0);
 for(let i=0;i<Math.round(c.seconds*120);i++)control.update(1/120,{moveX:0,moveZ:-c.move,run:c.run,jump:false},(s,dt)=>pose.update(s,s.time,dt));
 // Vertical ground translation and leg IK differ; upper-body relative pose is
 // determined by these identical recorded inputs and the same clock.
 for(const key of ['x','z','yaw','vx','vz','speed','phase','moveWeight','runWeight','stairWeight','landing','jumps','time'])assert(Math.abs(control.state[key]-c.character.locomotion[key])<1e-9,`${c.name} ${key}`);
 assert.equal(control.state.grounded,c.character.locomotion.grounded);
 snapshots.push(snapshot(c.name,structuredClone(control.state)));
}
for(const phase of [Math.PI/2,3*Math.PI/2]){modules[1].load('src/world/character/animation.ts').applyPose(actors[1].rig,{gait:'run',t:0,phase,lookWeight:0});snapshots.push(snapshot('reference-run-'+phase));}
function apply(a,p){for(const[k,v]of Object.entries(p.joints)){a.rig[k].position.fromArray(v.position);a.rig[k].quaternion.fromArray(v.quaternion);a.rig[k].scale.fromArray(v.scale);}a.syncGeometry();a.group.updateMatrixWorld(true);}
function targets(a){const excluded=[a.rig.shoulderL,a.rig.shoulderR,a.rig.thighL,a.rig.thighR,a.rig.neck];return meshes(a).filter(o=>{for(let p=o.parent;p;p=p.parent)if(excluded.includes(p))return false;return true;});}
function contactFaces(ts,other){const result=[];for(const t of ts){const n=nearest(tree([t]),other);if(n.distance<1e-9)result.push(t.id);}return result;}
const reports=[];let failure=null, checkedGarmentPairs=0, checkedThreadPairs=0, minThreadGarmentGap=Infinity;
for(const pose of snapshots){for(const a of actors)apply(a,pose);const frame={name:pose.name,pairs:[]};
 for(const side of ['L','R']){
  const all=actors.map(a=>{const shoulder=a.rig['shoulder'+side],inverse=shoulder.matrixWorld.clone().invert(),sleeve=shoulder.getObjectByName('sleeve'),stitches=shoulder.getObjectByName('sleeve-stitches'),skin=shoulder.getObjectByName('arm-skin');return{inverse,sleeve:triangles(sleeve.geometry),stitches:triangles(stitches.geometry),skin:triangles(skin.geometry,inverse.clone().multiply(skin.matrixWorld)),targets:targets(a)};});
  const skin=all.map(v=>tree(v.skin)),skinDistances=all.map((v,i)=>nearest(tree(v.sleeve),skin[i]));
  const oldContact=contactFaces(all[0].sleeve,skin[0]),newContact=contactFaces(all[1].sleeve,skin[1]);
  const threadGap=nearest(tree(all[1].stitches),skin[1]);
  frame.pairs.push({side,target:'arm-skin',baseline:skinDistances[0],candidate:skinDistances[1],oldContact,newContact,threadGap});
  if(newContact.some(id=>!oldContact.includes(id))){failure={pose:pose.name,side,kind:'new sleeve/skin face',newContact,oldContact};break;}
  const oldTargets=new Map(all[0].targets.map(m=>[meshKey(m),m]));
  for(const target of all[1].targets){const old=oldTargets.get(meshKey(target));assert(old);const targetTrees=[old,target].map((m,i)=>tree(triangles(m.geometry,all[i].inverse.clone().multiply(m.matrixWorld))));
   checkedGarmentPairs++;checkedThreadPairs++;
   const td=all.map((v,i)=>nearest(tree(v.stitches),targetTrees[i]));
   minThreadGarmentGap=Math.min(minThreadGarmentGap,td[1].distance);
   if(td.some(n=>n.distance<=1e-8)){
    const tc=all.map((v,i)=>contactFaces(v.stitches,targetTrees[i]));
    if(JSON.stringify(tc[0])!==JSON.stringify(tc[1])){failure={pose:pose.name,side,kind:'changed thread garment-contact faces',target:meshKey(target),contacts:tc};break;}
    const mesh=actors[1].rig['shoulder'+side].getObjectByName('sleeve-stitches');
    for(const face of tc[1])for(let k=0;k<3;k++)assert((side==='L'?1:-1)*mesh.geometry.attributes.position.getX(mesh.geometry.index.getX(face*3+k))<=.011418040841817856,'thread contact outside protected join');
   }
   const d=all.map((v,i)=>nearest(tree(v.sleeve),targetTrees[i]));
   if(d.every(n=>n.distance>1e-8))continue;
   const contacts=all.map((v,i)=>contactFaces(v.sleeve,targetTrees[i]));
   frame.pairs.push({side,target:meshKey(target),baseline:d[0],candidate:d[1],oldContact:contacts[0],newContact:contacts[1]});
   if(JSON.stringify(contacts[0])!==JSON.stringify(contacts[1])){failure={pose:pose.name,side,kind:'changed garment-contact faces',target:meshKey(target),contacts};break;}
   const positions=actors[1].rig['shoulder'+side].getObjectByName('sleeve').geometry.attributes.position;
   const ix=actors[1].rig['shoulder'+side].getObjectByName('sleeve').geometry.index;
   for(const face of contacts[1])for(let k=0;k<3;k++)assert((side==='L'?1:-1)*positions.getX(ix.getX(face*3+k))<=.011418040841817856,`contact face ${face} outside fixed join`);
  }if(failure)break;
 }reports.push(frame);console.log(JSON.stringify({pose:pose.name,pairs:frame.pairs.length,failure}));if(failure)break;
}
const result={pin,candidateHelper:modules[1].hashes['src/world/character/sleeve-drape.ts'],exactMeshes,exactArrays,checkedGarmentPairs,checkedThreadPairs,minThreadGarmentGap,snapshots,reports,failure,limitations:['Six configurations only, no swept or all-pose proof.','Actual01/02/03 upper-body inputs match recorded source; ground height and leg IK are excluded by shoulder-local frame.','Triangle helper excludes only exactly zero-area inherited faces; no nonzero-area cutoff.','Contact face identity protects the whole measured join; positive neighbour distance is exact static triangle-pair search with floating-point tolerances.']};
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2)+'\n');
assert.equal(failure,null,JSON.stringify(failure));assert.equal(reports.length,6);console.log('PASS '+JSON.stringify({exactMeshes,exactArrays,poses:reports.length}));
