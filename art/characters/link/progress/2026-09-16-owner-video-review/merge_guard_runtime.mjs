// Append the four guard meshes to the current character without re-exporting its animation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const dir=new URL('./',import.meta.url);
function read(file){
 const raw=fs.readFileSync(file),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length));
 return {doc,bin:Buffer.from(raw.subarray(28+length,28+length+doc.buffers[0].byteLength))};
}
const original=read('E:/zeldaremake-daylight/public/models/link/link-runtime.glb'),addition=read(new URL('guard-addition.glb',dir));
const doc=structuredClone(original.doc),a=addition.doc;
assert.equal(a.skins.length,1);assert.equal(doc.skins.length,1);assert.equal(a.meshes.length,4);
assert.ok(!a.animations?.length);
function matrix(model,index,joint){
 const acc=model.doc.accessors[index],v=model.doc.bufferViews[acc.bufferView];assert.equal(acc.type,'MAT4');assert.equal(acc.componentType,5126);
 return Array.from({length:16},(_,k)=>model.bin.readFloatLE((v.byteOffset??0)+(acc.byteOffset??0)+joint*(v.byteStride??64)+k*4));
}
const map=a.skins[0].joints.map((node,i)=>{
 const name=a.nodes[node].name,j=doc.skins[0].joints.findIndex(n=>doc.nodes[n].name===name);assert.ok(j>=0,name);
 const before=matrix(original,doc.skins[0].inverseBindMatrices,j),after=matrix(addition,a.skins[0].inverseBindMatrices,i);
 assert.ok(before.every((v,k)=>Math.abs(v-after[k])<1e-5),'Bind mismatch '+name);return j;
});
const touched=new Set();
for(const mesh of a.meshes)for(const p of mesh.primitives){
 const index=p.attributes.JOINTS_0;assert.ok(index!==undefined);
 if(touched.has(index))continue;touched.add(index);
 const acc=a.accessors[index],v=a.bufferViews[acc.bufferView];assert.ok(!acc.sparse);assert.equal(acc.type,'VEC4');assert.ok([5121,5123].includes(acc.componentType));const bytes=acc.componentType===5121?1:2;
 for(let i=0;i<acc.count;i++)for(let k=0;k<4;k++){
  const offset=(v.byteOffset??0)+(acc.byteOffset??0)+i*(v.byteStride??4*bytes)+k*bytes,old=addition.bin.readUIntLE(offset,bytes);
  assert.ok(map[old]!==undefined);addition.bin.writeUIntLE(map[old],offset,bytes);
 }
}
const padding=Buffer.alloc((4-original.bin.length%4)%4),offset=original.bin.length+padding.length;
const vi=doc.bufferViews.length,ai=doc.accessors.length,mi=doc.materials.length;
for(const v of a.bufferViews){assert.equal(v.buffer,0);doc.bufferViews.push({...v,byteOffset:(v.byteOffset??0)+offset});}
for(const ac of a.accessors){assert.ok(!ac.sparse);doc.accessors.push({...ac,bufferView:ac.bufferView+vi});}
const ti=(doc.textures??=[]).length,ii=(doc.images??=[]).length,si=(doc.samplers??=[]).length;
for(const im of a.images??[]){assert.ok(im.bufferView!==undefined&&!im.uri);doc.images.push({...im,bufferView:im.bufferView+vi});}
doc.samplers.push(...(a.samplers??[]));
for(const tex of a.textures??[])doc.textures.push({...tex,source:tex.source+ii,...(tex.sampler===undefined?{}:{sampler:tex.sampler+si})});
for(const mat of a.materials){
 const m=structuredClone(mat);
 assert.ok(!m.pbrMetallicRoughness?.baseColorTexture&&!m.pbrMetallicRoughness?.metallicRoughnessTexture&&!m.occlusionTexture&&!m.emissiveTexture);
 if(m.normalTexture)m.normalTexture.index+=ti;
 doc.materials.push(m);
}
if(a.extensionsUsed)doc.extensionsUsed=[...new Set([...(doc.extensionsUsed??[]),...a.extensionsUsed])];
const parent=doc.nodes.findIndex(n=>n.children?.some(i=>doc.nodes[i].mesh===2));assert.ok(parent>=0);
for(const n of a.nodes.filter(n=>n.mesh!==undefined)){
 assert.equal(n.skin,0);assert.ok(!n.matrix&&!n.translation&&!n.rotation&&!n.scale);
 const m=structuredClone(a.meshes[n.mesh]);
 for(const p of m.primitives){assert.ok(!p.targets);p.indices+=ai;p.material+=mi;for(const key of Object.keys(p.attributes))p.attributes[key]+=ai;}
 doc.nodes[parent].children.push(doc.nodes.length);doc.nodes.push({name:n.name,skin:0,mesh:doc.meshes.length});doc.meshes.push(m);
}
const binary=Buffer.concat([original.bin,padding,addition.bin]);doc.buffers[0].byteLength=binary.length;
const json=Buffer.from(JSON.stringify(doc)),jp=Buffer.alloc((4-json.length%4)%4,32),bp=Buffer.alloc((4-binary.length%4)%4);
const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jp.length+binary.length+bp.length,8);header.writeUInt32LE(json.length+jp.length,12);header.write('JSON',16);
const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length+bp.length);bh.write('BIN\0',4);
const result=Buffer.concat([header,json,jp,bh,binary,bp]),path=new URL('guard-runtime-candidate.glb',dir);fs.writeFileSync(path,result);
const check=read(path);assert.ok(check.bin.subarray(0,original.bin.length).equals(original.bin));
for(const key of ['animations','skins'])assert.deepEqual(check.doc[key],original.doc[key]);
for(const key of ['images','textures'])assert.deepEqual(check.doc[key].slice(0,original.doc[key].length),original.doc[key]);
assert.deepEqual(check.doc.meshes.slice(0,original.doc.meshes.length),original.doc.meshes);
const report={sha256:crypto.createHash('sha256').update(result).digest('hex'),addedMeshes:4,addedImages:a.images?.length??0,originalBinaryExact:true,originalMeshesRigClipsImagesExact:true,jointBindsVerified:map.length,status:'Runtime review pending'};
fs.writeFileSync(new URL('guard-runtime-export.json',dir),JSON.stringify(report,null,2));console.log(report);
