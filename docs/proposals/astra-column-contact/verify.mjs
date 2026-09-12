import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as T from 'three';
import * as U from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const ref='ddd24fd0a3a9f71eb9991e3f16311336a4316fd0',base='a600f529d56bc3a63ee31deaf58012d6cb077647';
const treeFiles=['column.ts','index.ts','placement.ts'].map(n=>'src/world/trees/'+n);
const proposal=path.dirname(fileURLToPath(import.meta.url));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'astra-column-contact-'));
for(const f of treeFiles){const dest=path.join(tmp,'candidate',f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,execFileSync('git',['show',ref+':'+f]));}
execFileSync('patch',['--batch','-p1','--input',path.join(proposal,'candidate.patch'),'--directory',path.join(tmp,'candidate')]);
function loader(mode){const modules=new Map(),records=[];let frame;function load(f){f=path.posix.normalize(f);if(modules.has(f))return modules.get(f).exports;const m={exports:{}};modules.set(f,m);if(f==='src/world/trees/materials.ts'){m.exports={createTreeMaterials:async()=>Object.fromEntries(['whiteTree','whiteTreeDepth','giantTree','giantTreeDepth','giantCanopy','giantCanopyDepth','distant'].map(k=>[k,new T.MeshBasicMaterial({side:T.DoubleSide})]).concat([['windLayers',3],['barkTextureSets',[]]]))};return m.exports;}
const source=mode==='candidate'&&treeFiles.includes(f)?fs.readFileSync(tmp+'/candidate/'+f,'utf8'):execFileSync('git',['show',(treeFiles.includes(f)?ref:base)+':'+f],{encoding:'utf8'});
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:id.endsWith('BufferGeometryUtils.js')?U:load(path.posix.join(path.posix.dirname(f),id+'.ts')),m,m.exports);
if(f.endsWith('/writer.ts')){const original=m.exports.rootButtress;m.exports.rootButtress=(...args)=>{const first=args[0].positions.length/3,result=original(...args);frame?.push([first,args[0].positions.length/3]);return result;};}
if(f.endsWith('/column.ts')){const original=m.exports.createColumnTree;m.exports.createColumnTree=(p,pal,d,groundAt)=>{frame=[];const asset=original(p,pal,d,groundAt);records.push({key:p.seed+'-'+d,detail:d,geometry:asset.geometry,spans:frame});frame=undefined;return asset;};}return m.exports;}return{read:n=>load('src/world/'+n+'.ts'),records};}
const hash=(o)=>{const h=createHash('sha256');for(const k of Object.keys(o.geometry.attributes).sort()){h.update(k);h.update(Buffer.from(o.geometry.attributes[k].array.buffer));}if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));if(o.instanceMatrix)h.update(Buffer.from(o.instanceMatrix.array.buffer));return h.digest('hex');};
async function build(mode){const l=loader(mode),{WORLD}=l.read('config'),{LAYOUT}=l.read('layout');const camera=new T.PerspectiveCamera(50,16/9,.1,500),vp=LAYOUT.viewpoints.find(v=>v.id==='B_house');camera.position.fromArray(vp.position);camera.lookAt(new T.Vector3().fromArray(vp.target));camera.updateMatrixWorld();const audits={};const ctx={scene:new T.Scene(),camera,terrain:l.read('terrain/heightfield').createTerrain(),config:WORLD,layout:LAYOUT,rng:l.read('util/prng').createRng(WORLD.seed),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1},shared:{},progress(){},audit(n,f){audits[n]=f;},textures:{load:async()=>null}};const sys=await l.read('trees/index').create(ctx);sys.group.updateMatrixWorld(true);const columns=[],unchanged={};sys.group.traverse(o=>{if(!o.isMesh)return;if(o.userData.kind==='column')columns.push(o);else unchanged[o.name]=hash(o);});const shared={};for(let i=0;i<=20;i++)shared[i]=[...ctx.shared.lanternLimb.centre(i/20).toArray(),ctx.shared.lanternLimb.radius(i/20)];return{...l,sys,ctx,audit:audits.trees(),columns,unchanged,shared,nextRng:ctx.rng()};}
const before=await build('before'),after=await build('candidate');
assert.deepEqual(after.unchanged,before.unchanged,'All white/giant/distant geometry and matrices preserved');
assert.deepEqual(after.shared,before.shared,'Published lantern centreline and radius preserved');
assert.deepEqual(after.audit,before.audit,'Existing counts, placement and per-LOD audit unchanged');
assert.equal(after.nextRng,before.nextRng);
const matrices=new Map();for(const mesh of after.columns)if(mesh.count){assert.equal(mesh.count,1);matrices.set(mesh.name.split('@')[1],new T.Matrix4());mesh.getMatrixAt(0,matrices.get(mesh.name.split('@')[1]));}
const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
function degenerates(g){const p=g.attributes.position,ix=g.index;let count=0;for(let i=0;i<ix.count;i+=3){a.fromBufferAttribute(p,ix.getX(i));b.fromBufferAttribute(p,ix.getX(i+1));c.fromBufferAttribute(p,ix.getX(i+2));if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)count++;}return count;}
const evidence=[];let collarChecks=0;let edgeChecks=0,surfaceChecks=0,worst=0,beforeOver=0,beforeMax=-Infinity;
for(const mesh of after.columns){const [name,seat]=mesh.name.split('@'),key=name.slice('column-'.length),M=matrices.get(seat),scale=new T.Vector3().setFromMatrixScale(M).y;
const original=before.records.find(r=>r.key===key),candidate=after.records.find(r=>r.geometry===mesh.geometry);assert(original&&candidate&&M);
const g=mesh.geometry,old=original.geometry,spans=original.spans;
assert.deepEqual(candidate.spans,spans);assert.deepEqual(g.index.array,old.index.array);
for(const k of Object.keys(g.attributes)){assert([...g.attributes[k].array].every(Number.isFinite),k+' finite');if(!['position','normal'].includes(k))assert.deepEqual(g.attributes[k].array,old.attributes[k].array,k+' unchanged');}
const isRoot=new Uint8Array(g.attributes.position.count);for(const [lo,hi]of spans)for(let i=lo;i<hi;i++)isRoot[i]=1;
let minGap=Infinity,maxGap=-Infinity,edgeCount=0;for(let i=0;i<isRoot.length;i++){
const p=g.attributes.position,q=old.attributes.position,n=g.attributes.normal,on=old.attributes.normal;
if(!isRoot[i]){assert.equal(p.getX(i),q.getX(i));assert.equal(p.getY(i),q.getY(i));assert.equal(p.getZ(i),q.getZ(i));assert.equal(n.getX(i),on.getX(i));assert.equal(n.getY(i),on.getY(i));assert.equal(n.getZ(i),on.getZ(i));continue;}
assert.equal(p.getX(i),q.getX(i));assert.equal(p.getZ(i),q.getZ(i));
const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(M),worldY=after.ctx.terrain.height(v.x,v.z),gap=v.y-worldY,expected=q.getY(i)*scale;
const residual=Math.abs(gap-expected);worst=Math.max(worst,residual);assert(residual<2e-5,'Every root vertex retains its original rise above actual transformed terrain');surfaceChecks++;
if(Math.abs(q.getY(i)+.03)<1e-7){edgeChecks++;edgeCount++;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);assert(gap<0,'Buried lateral root edge');const flat=new T.Vector3().fromBufferAttribute(q,i).applyMatrix4(M),flatGap=flat.y-before.ctx.terrain.height(flat.x,flat.z);beforeMax=Math.max(beforeMax,flatGap);if(flatGap>.03)beforeOver++;}
}
// The root's inner row remains inside the real bole, not a detached terrain ribbon.
const bole=g.clone();bole.setIndex(Array.from(g.index.array).filter((_,i)=>{const face=Math.floor(i/3)*3;return g.index.getX(face)<spans[0][0]&&g.index.getX(face+1)<spans[0][0]&&g.index.getX(face+2)<spans[0][0];}));
const boleMesh=new T.Mesh(bole,new T.MeshBasicMaterial({side:T.DoubleSide}));
for(const [lo]of spans)for(let j=0;j<7;j++){
 const point=new T.Vector3().fromBufferAttribute(g.attributes.position,lo+j);
 for(const dx of [-1,1])assert(new T.Raycaster(point,new T.Vector3(dx,0,0),1e-6,2).intersectObject(boleMesh).length>0,'Inner root collar remains inside bole');
 collarChecks++;
}
bole.dispose();boleMesh.material.dispose();
const oldDegenerate=degenerates(old),newDegenerate=degenerates(g);assert.equal(newDegenerate,oldDegenerate,'No new degenerate triangles');evidence.push({seat,detail:candidate.detail,edgeCount,minGap,maxGap,triangles:g.index.count/3,oldDegenerate,newDegenerate});
}
const bytes=columns=>columns.reduce((sum,m)=>sum+Object.values(m.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+m.geometry.index.array.byteLength,0);
const result={status:'proposed-not-integrated',baseSlice:{treeFiles:ref,otherFiles:base},passed:true,seats:matrices.size,lods:3,edgeChecks,surfaceChecks,collarChecks,worstTerrainRiseResidualM:worst,beforeFloatingEdgeSamplesAllLods:beforeOver,beforeMaxGapM:beforeMax,afterFloatingEdgeSamplesAllLods:0,nonRootAttributesExact:true,allWhiteGiantDistantGeometryAndMatricesExact:true,lanternLimbExact:true,originalAuditExact:true,rngNextExact:true,columnGeometryBytes:{before:bytes(before.columns),after:bytes(after.columns)},activeColumnMeshesAtB:{before:before.columns.filter(m=>m.count).length,after:after.columns.filter(m=>m.count).length},evidence,scope:'Actual generated CPU geometry at all three LODs and each composed instance matrix. No GPU appearance or frame-time claim.'};
fs.writeFileSync(tmp+'/evidence.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,evidence:undefined,reproductionReport:tmp+'/evidence.json'},null,2));before.sys.dispose();after.sys.dispose();
