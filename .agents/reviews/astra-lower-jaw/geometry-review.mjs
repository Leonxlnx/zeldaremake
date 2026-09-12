import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import * as T from 'three';
import * as U from 'three/addons/utils/BufferGeometryUtils.js';

const root=process.cwd(), dir=path.resolve('gauntlet/tmp/lower-jaw-replay');fs.mkdirSync(dir,{recursive:true});
const pin='9a317b873eae4a036e0ad179027201fdfdb217c1';
const ctx=new Proxy({}, {get:(_,k)=>String(k).endsWith('Gradient')?()=>({addColorStop(){}}):k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
export function loader(candidate){const cache=new Map();function load(rel){const file=path.resolve(root,rel);if(cache.has(file))return cache.get(file).exports;const base=path.basename(file);let source=!candidate&&['face-geometry.ts','link.ts'].includes(base)?execFileSync('git',['show',pin+':'+path.relative(root,file)],{encoding:'utf8'}):fs.readFileSync(file,'utf8');if(base==='link.ts')source=source.replace('  batchStaticLinkParts(rig);','');const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:id.includes('BufferGeometryUtils')?U:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}return load;}
const modules=[loader(false),loader(true)],actors=modules.map(load=>load('src/world/character/link.ts').createLink());
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const point=(p,i)=>new T.Vector3().fromBufferAttribute(p,i);
const key=o=>{let parts=[];for(let n=o;n.parent;n=n.parent)parts.push(n.name+':'+n.parent.children.filter(x=>x.name===n.name).indexOf(n));return parts.reverse().join('/');};
const meshes=a=>{const out=[];a.group.traverse(o=>{if(o.isMesh)out.push(o)});return out;};
let exactMeshes=0,exactArrays=0;const previous=new Map(meshes(actors[0]).map(m=>[key(m),m]));
for(const m of meshes(actors[1])){const old=previous.get(key(m));assert(old);if(['skull','mouth'].includes(m.name))continue;for(const attr of Object.keys(m.geometry.attributes)){assert(bytes(m.geometry.attributes[attr].array).equals(bytes(old.geometry.attributes[attr].array)),key(m)+' '+attr);exactArrays++;}if(m.geometry.index){assert(bytes(m.geometry.index.array).equals(bytes(old.geometry.index.array)));exactArrays++;}exactMeshes++;}
const k=actors[1].rig.props.headRadius/.125,skulls=actors.map(a=>a.rig.head.getObjectByName('skull').geometry);
assert(bytes(skulls[0].index.array).equals(bytes(skulls[1].index.array)),'final skull topology exact');
assert.deepEqual(Object.keys(skulls[0].attributes),Object.keys(skulls[1].attributes),'final skull attribute set exact');
let changed=0,protectedVertices=0,maxDisplacement=0,minTriangleNormal=Infinity,minArea=Infinity;
const affected=[], badCorners=[];
for(let i=0;i<skulls[1].attributes.position.count;i++){
 const a=point(skulls[0].attributes.position,i),b=point(skulls[1].attributes.position,i);
 assert.equal(a.y,b.y);assert.equal(a.z,b.z);assert(Math.abs(b.x)<=Math.abs(a.x)+1e-10);
 const fixed=a.y>=-.030*k || Math.abs(a.x)>actors[1].rig.props.headRadius;
 if(fixed){for(const attr of ['position','normal','color'])for(let j=0;j<3;j++)assert.equal(skulls[0].attributes[attr].array[i*3+j],skulls[1].attributes[attr].array[i*3+j],'protected upper/ear '+attr);protectedVertices++;}
 if(!a.equals(b)){changed++;maxDisplacement=Math.max(maxDisplacement,a.distanceTo(b));}
}
for(let i=0;i<skulls[1].index.count;i+=3){
 const ids=[0,1,2].map(j=>skulls[1].index.getX(i+j));const p=ids.map(j=>point(skulls[1].attributes.position,j));
 const cross=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));
 assert(cross.length()>1e-13,'nondegenerate skull '+i/3);minArea=Math.min(minArea,cross.length()/2);cross.normalize();
 for(const id of ids){const dot=cross.dot(point(skulls[1].attributes.normal,id));minTriangleNormal=Math.min(minTriangleNormal,dot);if(dot<=0){const oldp=ids.map(j=>point(skulls[0].attributes.position,j)),oldCross=oldp[1].clone().sub(oldp[0]).cross(oldp[2].clone().sub(oldp[0])).normalize();badCorners.push({face:i/3,vertex:id,dot,oldDot:oldCross.dot(point(skulls[0].attributes.normal,id)),changed:!point(skulls[0].attributes.position,id).equals(point(skulls[1].attributes.position,id))});}}
 if(ids.some(j=>!point(skulls[0].attributes.position,j).equals(point(skulls[1].attributes.position,j))))affected.push(i/3);
}
console.log(JSON.stringify({badCorners}));fs.writeFileSync(path.join(dir,'bad-corners.json'),JSON.stringify(badCorners,null,2));assert(badCorners.every(c=>c.dot===c.oldDot&&!c.changed),'no new inward skull corner normals');
const blinks=[];
for(const blink of [1,.85,.7,.5838095238095872,.5,.35,.2,.12,.08,1]){
 for(const a of actors){for(const eye of a.rig.eyes)eye.scale.y=blink;a.syncGeometry();a.group.updateMatrixWorld(true);}
 let count=0;
 for(let side=0;side<2;side++)for(const name of ['eye-white','eyelid','lashes']){
  const geo=actors.map(a=>a.rig.eyes[side].getObjectByName(name).geometry);
  for(const attr of Object.keys(geo[0].attributes)){assert(bytes(geo[0].attributes[attr].array).equals(bytes(geo[1].attributes[attr].array)),name+' '+attr+' blink '+blink);count++;}
 }
 blinks.push({blink,exactArrays:count});
}
const info=meshes(actors[1]).filter(m=>['neck','mouth','hair'].includes(m.name)).map(m=>({name:m.name,key:key(m),vertices:m.geometry.attributes.position.count}));
const report={baseline:'9a317b873eae4a036e0ad179027201fdfdb217c1',helperSha:createHash('sha256').update(fs.readFileSync('src/world/character/lower-face-geometry.ts')).digest('hex'),exactMeshes,exactArrays,protectedVertices,changed,maxDisplacement,minTriangleNormal,minArea,affectedFaces:affected.length,blinks,info,limitations:['No rendered likeness acceptance.','No all-pose swept contact proof.','Neck and changed lower-skull/hair contact checks remain separate.']};
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
export {actors,modules,skulls,affected};
