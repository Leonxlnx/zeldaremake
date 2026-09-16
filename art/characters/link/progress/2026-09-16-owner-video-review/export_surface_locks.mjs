// Append only the reviewed hair mesh; preserve the runtime rig, clips and binary.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Matrix4, Quaternion, Vector3} from 'three';
const dir=new URL('./',import.meta.url);
function read(file){
  const raw=fs.readFileSync(file),length=raw.readUInt32LE(12);
  const doc=JSON.parse(raw.subarray(20,20+length));
  return {doc,bin:raw.subarray(28+length,28+length+doc.buffers[0].byteLength)};
}
const original=read('E:/zeldaremake-daylight/public/models/link/link-runtime.glb');
const addition=read(new URL('hair-addition.glb',dir));
const doc=structuredClone(original.doc),parts=[original.bin];let size=original.bin.length;
const node=addition.doc.nodes.find(n=>n.name==='Review hair addition');
assert.ok(node && !node.matrix && !node.translation && !node.rotation && !node.scale);
const mesh=structuredClone(addition.doc.meshes[node.mesh]);
const views=new Map(),accessors=new Map();
function accessor(index){
  if(accessors.has(index))return accessors.get(index);
  const a=structuredClone(addition.doc.accessors[index]);assert.ok(!a.sparse);
  if(!views.has(a.bufferView)){
    const v=addition.doc.bufferViews[a.bufferView];assert.equal(v.buffer,0);
    const pad=Buffer.alloc((4-size%4)%4);parts.push(pad);size+=pad.length;
    const bytes=addition.bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);
    views.set(a.bufferView,doc.bufferViews.length);
    doc.bufferViews.push({...v,byteOffset:size});parts.push(bytes);size+=bytes.length;
  }
  a.bufferView=views.get(a.bufferView);accessors.set(index,doc.accessors.length);doc.accessors.push(a);
  return accessors.get(index);
}
for(const p of mesh.primitives){
  assert.ok(p.attributes.COLOR_0!==undefined && !p.targets);
  for(const key of Object.keys(p.attributes))p.attributes[key]=accessor(p.attributes[key]);
  p.indices=accessor(p.indices);
  const material=addition.doc.materials[p.material];
  assert.ok(!JSON.stringify(material).includes('Texture'));
  p.material=doc.materials.length;doc.materials.push(material);
}
const head=doc.nodes.findIndex(n=>n.name==='head');assert.ok(head>=0);
function world(index){
  const n=doc.nodes[index];
  const local=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(
    new Vector3().fromArray(n.translation??[0,0,0]),new Quaternion().fromArray(n.rotation??[0,0,0,1]),new Vector3().fromArray(n.scale??[1,1,1]));
  const parent=doc.nodes.findIndex(n=>n.children?.includes(index));
  return parent<0?local:world(parent).multiply(local);
}
const bind=world(head),inverse=bind.clone().invert();
assert.ok(bind.clone().multiply(inverse).elements.every((v,i)=>Math.abs(v-(i%5===0?1:0))<1e-10));
const skin=doc.skins.findIndex(s=>s.joints.includes(head));assert.ok(skin>=0);
const joint=doc.skins[skin].joints.indexOf(head);
const ibm=doc.accessors[doc.skins[skin].inverseBindMatrices],iv=doc.bufferViews[ibm.bufferView];
assert.equal(ibm.componentType,5126);assert.equal(ibm.type,'MAT4');
const start=(iv.byteOffset??0)+(ibm.byteOffset??0)+joint*(iv.byteStride??64);
assert.ok(inverse.elements.every((v,i)=>Math.abs(v-original.bin.readFloatLE(start+4*i))<1e-5));
function appendAttribute(bytes,count,componentType){
  const pad=Buffer.alloc((4-size%4)%4);parts.push(pad);size+=pad.length;
  const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});parts.push(bytes);size+=bytes.length;
  const index=doc.accessors.length;doc.accessors.push({bufferView,componentType,count,type:'VEC4'});return index;
}
for(const p of mesh.primitives){
  const count=doc.accessors[p.attributes.POSITION].count,joints=Buffer.alloc(count*8),weights=Buffer.alloc(count*16);
  for(let i=0;i<count;i++){joints.writeUInt16LE(joint,i*8);weights.writeFloatLE(1,i*16);}
  p.attributes.JOINTS_0=appendAttribute(joints,count,5123);p.attributes.WEIGHTS_0=appendAttribute(weights,count,5126);
}
const bodyNode=doc.nodes.findIndex(n=>n.mesh===2 && n.skin===skin);
const parent=doc.nodes.findIndex(n=>n.children?.includes(bodyNode));assert.ok(parent>=0);
assert.deepEqual(world(parent).elements,new Matrix4().elements);
doc.nodes[parent].children.push(doc.nodes.length);
doc.nodes.push({name:'Link secondary hair locks',mesh:doc.meshes.length,skin});
doc.meshes.push(mesh);doc.buffers[0].byteLength=size;
const json=Buffer.from(JSON.stringify(doc)),jp=Buffer.alloc((4-json.length%4)%4,32),bp=Buffer.alloc((4-size%4)%4);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+size+bp.length,8);header.writeUInt32LE(json.length+jp.length,12);header.write('JSON',16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(size+bp.length);bh.write('BIN\0',4);
const output=new URL('surface-locks-candidate.glb',dir);
fs.writeFileSync(output,Buffer.concat([header,json,jp,bh,...parts,bp]));
const check=read(output);
assert.ok(check.bin.subarray(0,original.bin.length).equals(original.bin));
for(const key of ['animations','skins','images','textures'])assert.deepEqual(check.doc[key],original.doc[key]);
assert.deepEqual(check.doc.meshes.slice(0,original.doc.meshes.length),original.doc.meshes);
const report={original_binary_exact:true,original_meshes_rig_clips_textures_exact:true,added_bytes:size-original.bin.length,added_meshes:1,added_materials:1,head_bind_identity:true,head_skin_joint:joint,status:'Pending actual renderer review'};
fs.writeFileSync(new URL('surface-locks-export.json',dir),JSON.stringify(report,null,2));console.log(report);
