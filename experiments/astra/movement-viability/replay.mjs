import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import * as T from 'three';
import {ConvexHull} from 'three/addons/math/ConvexHull.js';
import * as U from 'three/addons/utils/BufferGeometryUtils.js';
const folder=path.dirname(fileURLToPath(import.meta.url)),root=path.join(folder,'source');
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));
for(const [file,entry] of Object.entries(manifest.changedFiles)){const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');if(digest!==entry.candidateSha256)throw new Error('Checkpoint hash mismatch: '+file);}
function readSource(file){if(fs.existsSync(file))return fs.readFileSync(file,'utf8');const relative=path.relative(root,file).split(path.sep).join('/');return execFileSync('git',['show',manifest.baseRevision+':'+relative],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
const context=new Proxy({}, {get:(_,k)=>k==='createImageData'||k==='getImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}):String(k).endsWith('Gradient')?()=>({addColorStop(){}}):()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const cache=new Map();
function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(readSource(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:id.includes('ConvexHull')?{ConvexHull}:id.includes('BufferGeometryUtils')?U:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}
const createLink=load('src/world/character/link.ts').createLink;
const flat={height:()=>0,blocked:()=>false,onStairs:()=>false};
const {createPlayPose}=load('src/world/character/play-pose.ts'),{createLocomotion}=load('src/world/character/locomotion.ts');
const rows=[];
for(const kind of ['standing','walking','running']){
 const actor=createLink(),r=actor.rig;
 const play=createPlayPose(r,flat.height),ctrl=createLocomotion(flat,0,0,0);let failure=null,frame=0;const history=[];const focused=[];const kneePeaks=[];let previous=null;const costs=[];const audit={maxKneeStep:0,maxPoleStep:0,maxPlantedPositionDrift:0,maxPlantedQuaternionChange:0,rejectionGraphExact:null};let beforeAttempt='',beforeCoordinator='',beforeGeometry=null;const geometryDigest=()=>{const h=crypto.createHash('sha256');r.root.traverse(o=>{if(o.isMesh){h.update(o.name);for(const key of Object.keys(o.geometry.attributes).sort()){const a=o.geometry.attributes[key].array;h.update(key);h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}if(o.geometry.index){const a=o.geometry.index.array;h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}}});return h.digest('hex');};const graph=()=>{const out=[];r.root.traverse(o=>out.push([o.id,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray(),o.rotation.toArray(),o.matrix.elements.slice(),o.matrixWorld.elements.slice(),o.matrixWorldNeedsUpdate]));return JSON.stringify(out);};
 try {for(;frame<(kind==='standing'?204:34);frame++){
  const moving=kind!=='standing'&&frame<336;
  const input={moveX:moving&&frame>=264&&frame<300?1:0,moveZ:!moving?0:frame<264?1:frame<300?0:-1,run:kind==='running',jump:frame>=120&&frame<180};
  ctrl.update(1/120,input,(s,dt)=>{beforeAttempt=graph();beforeCoordinator=JSON.stringify(play.clearance.snapshot());beforeGeometry=geometryDigest();const started=performance.now();try{play.update(s,s.time,dt);}finally{costs.push(performance.now()-started);}actor.syncGeometry();const snapshot=play.clearance.snapshot();const sample={snapshot,knees:[r.kneeL,r.kneeR].map(j=>j.getWorldPosition(new T.Vector3())),soles:[r.ankleL,r.ankleR].map(j=>({position:j.localToWorld(r.sole.clone()),rotation:j.getWorldQuaternion(new T.Quaternion())}))};if(previous){for(let k=0;k<2;k++){const kneeStep=sample.knees[k].distanceTo(previous.knees[k]);if(kneeStep>audit.maxKneeStep)kneePeaks.push({frame,side:k,step:kneeStep,previous:previous.snapshot,current:snapshot});audit.maxKneeStep=Math.max(audit.maxKneeStep,kneeStep);audit.maxPoleStep=Math.max(audit.maxPoleStep,snapshot.request.poles[k].angleTo(previous.snapshot.request.poles[k]));if(snapshot.feet[k].mode==='planted'&&previous.snapshot.feet[k].mode==='planted'&&snapshot.feet[k].commits===previous.snapshot.feet[k].commits){audit.maxPlantedPositionDrift=Math.max(audit.maxPlantedPositionDrift,sample.soles[k].position.distanceTo(previous.soles[k].position));audit.maxPlantedQuaternionChange=Math.max(audit.maxPlantedQuaternionChange,...sample.soles[k].rotation.toArray().map((v,i)=>Math.abs(v-previous.soles[k].rotation.toArray()[i])));}}}previous=sample;if(frame>=194||[119,120].includes(frame))focused.push({frame,state:{...s},snapshot});history.push({frame,state:{...s},snapshot:play.clearance.snapshot()});if(history.length>8)history.shift();});
 }}catch(error){failure=error.failure??String(error);audit.rejectionGraphExact=beforeAttempt===graph();audit.rejectionCoordinatorExact=beforeCoordinator===JSON.stringify(play.clearance.snapshot());audit.rejectionGeometryExact=beforeGeometry===geometryDigest();}
 const sorted=costs.slice().sort((a,b)=>a-b);const cpu={count:costs.length,totalMs:costs.reduce((a,b)=>a+b,0),medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maximumMs:Math.max(...costs)};rows.push({kind,frame,failure,rejection:failure?{graphBefore:JSON.parse(beforeAttempt),graphAfter:JSON.parse(graph()),coordinatorBefore:JSON.parse(beforeCoordinator),coordinatorAfter:play.clearance.snapshot(),geometryBefore:beforeGeometry,geometryAfter:geometryDigest()}:null,history,focused,kneePeaks,audit,cpu,diagnostics:play.clearance.diagnostics,snapshot:play.clearance.snapshot(),stats:play.clearance.geometry.stats});
 console.log(JSON.stringify({kind,frame,firstFailure:failure?.detail?.[0]?.status??failure?.reason??failure,diagnostics:play.clearance.diagnostics,cpu,audit}));
}
fs.writeFileSync(path.join(folder,'reproduced-prefix.json'),JSON.stringify(rows,null,2));
