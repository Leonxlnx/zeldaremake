import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const module={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('./lodset.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
    id=>{if(id==='three')return THREE;throw Error(id);},module,module.exports);
const {LodInstancedSet}=module.exports;
const material=new THREE.MeshStandardMaterial(),depth=new THREE.MeshDepthMaterial(),distance=new THREE.MeshDistanceMaterial();
const geometry=[new THREE.BoxGeometry(),new THREE.PlaneGeometry()];
function make(){
  const set=new LodInstancedSet({name:'fixture',variants:[geometry],material,shadowMaterials:{depth,distance},lodDistances:[11],castShadowLods:1});
  set.add(Float32Array.from(new THREE.Matrix4().elements),0,[.2,.4,.6]);set.build();return set;
}
const a=make(),b=make();const counts=s=>s.group.children.map(m=>m.count);
a.update(new THREE.Vector3(10.8,0,0));a.update(new THREE.Vector3(11.2,0,0));
assert.deepEqual(counts(a),[1,0],'Interactive movement gate retained');
a.update(new THREE.Vector3(11.2,0,0),true);b.update(new THREE.Vector3(11.2,0,0),true);
assert.deepEqual(counts(a),[0,1],'Explicit jump refreshes below movement threshold');
for(let round=0;round<4;round++)for(const x of [10.8,11.2]){
  a.update(new THREE.Vector3(x,0,0),true);
  assert.equal(counts(a).reduce((x,y)=>x+y),1,'Rebucketing never duplicates or loses instances');
  const mesh=a.group.children.find(m=>m.count);
  assert.deepEqual([...mesh.instanceMatrix.array.slice(0,16)],[...new THREE.Matrix4().elements]);
  assert.deepEqual([...mesh.instanceColor.array.slice(0,3)],[...Float32Array.from([.2,.4,.6])]);
}
a.update(new THREE.Vector3(10.8,0,0),true);
const near=a.group.children[0],far=a.group.children[1];
assert.equal(near.customDepthMaterial,depth);assert.equal(near.customDistanceMaterial,distance);
assert.equal(far.castShadow,false);assert.equal(far.customDepthMaterial,undefined);
assert.deepEqual(a.stats(),{drawCalls:2,triangles:24},'Estimate includes color plus one sun shadow pass');
for(const set of[a,b])for(const mesh of set.group.children)mesh.dispose();
for(const g of geometry)g.dispose();for(const m of[material,depth,distance])m.dispose();

// Variant packs: several variants share one InstancedMesh per LOD (per-vertex aVariant slot,
// per-instance aPlantVariant), every plant still lands in exactly one mesh, empty LODs stay hidden.
{
  const {packGeometries,PACK_VERTEX_ATTRIBUTE,PACK_INSTANCE_ATTRIBUTE}=module.exports;
  assert.equal(PACK_VERTEX_ATTRIBUTE,'aVariant');assert.equal(PACK_INSTANCE_ATTRIBUTE,'aPlantVariant');
  const near=[new THREE.BoxGeometry(),new THREE.PlaneGeometry(1,1,2,2),new THREE.ConeGeometry(1,1,5)],far=[new THREE.PlaneGeometry(),new THREE.PlaneGeometry(),new THREE.PlaneGeometry()];
  const variants=near.map((g,v)=>[g,far[v]]);
  const packed=packGeometries(near);
  const verts=near.reduce((n,g)=>n+g.attributes.position.count,0);
  assert.equal(packed.attributes.position.count,verts,'packed vertex count is the sum of the variants');
  assert.equal(packed.index.count,near.reduce((n,g)=>n+g.index.count,0),'packed index count is the sum of the variants');
  let base=0,k=0;
  near.forEach((g,slot)=>{
    const n=g.attributes.position.count;
    for(let i=0;i<n;i++){
      assert.equal(packed.attributes.aVariant.array[base+i],slot,'every vertex carries its variant slot');
      for(const key of['position','normal','uv'])for(let c=0;c<g.attributes[key].itemSize;c++)
        assert.equal(packed.attributes[key].array[(base+i)*g.attributes[key].itemSize+c],g.attributes[key].array[i*g.attributes[key].itemSize+c],`${key} copied verbatim`);
    }
    for(let i=0;i<g.index.count;i++)assert.equal(packed.index.array[k++],g.index.array[i]+base,'indices offset by the slot base');
    base+=n;
  });
  const set=new LodInstancedSet({name:'packed',variants,material,shadowMaterials:{depth,distance},lodDistances:[10],castShadowLods:1,packs:[[[0,1],[2]],[[0,1,2]]]});
  const m=v=>{const e=new THREE.Matrix4().makeTranslation(v,0,0).elements;return Float32Array.from(e);};
  set.add(m(1),0,[1,0,0]);set.add(m(2),1,[0,1,0]);set.add(m(3),2,[0,0,1]);set.add(m(4),2,[1,1,1]);
  set.build();
  assert.deepEqual(set.packLayout,[[[0,1],[2]],[[0,1,2]]]);
  assert.equal(set.group.children.length,3,'2 near packs + 1 far pack');
  const [n01,n2,f012]=set.group.children;
  assert.deepEqual(set.group.children.map(x=>x.name),['packed-lod0-p0-v01','packed-lod0-p1-v2','packed-lod1-p0-v012']);
  assert.equal(n01.geometry.attributes.aVariant.count,near[0].attributes.position.count+near[1].attributes.position.count);
  assert.ok(n01.geometry.attributes.aPlantVariant.isInstancedBufferAttribute,'the shown slot is a per-instance attribute');
  assert.ok(n01.castShadow&&n2.castShadow&&!f012.castShadow);
  assert.equal(n01.customDepthMaterial,depth);assert.equal(n2.customDistanceMaterial,distance);
  set.update(new THREE.Vector3(0,0,0),true);
  assert.deepEqual(set.group.children.map(x=>x.count),[2,2,0],'near camera: both near packs filled');
  assert.deepEqual(set.group.children.map(x=>x.visible),[true,true,false],'empty far LOD is not submitted');
  assert.deepEqual([...n01.geometry.attributes.aPlantVariant.array.slice(0,2)],[0,1],'variant 1 shows slot 1 of its pack');
  assert.deepEqual([...n2.geometry.attributes.aPlantVariant.array.slice(0,2)],[0,0],'variant 2 is slot 0 of its own pack');
  assert.deepEqual([...n01.instanceMatrix.array.slice(12,15)],[1,0,0]);assert.deepEqual([...n01.instanceMatrix.array.slice(16+12,16+15)],[2,0,0]);
  assert.deepEqual([...n01.instanceColor.array.slice(0,6)],[1,0,0,0,1,0]);assert.deepEqual([...n2.instanceColor.array.slice(0,6)],[0,0,1,1,1,1]);
  assert.deepEqual(set.stats(),{drawCalls:4,triangles:2*(n01.geometry.index.count/3*2+n2.geometry.index.count/3*2)},'two shadow-casting packs, collapsed variants counted as submitted');
  set.update(new THREE.Vector3(50,0,0),true);
  assert.deepEqual(set.group.children.map(x=>x.count),[0,0,4],'far camera: one draw for every variant');
  assert.deepEqual(set.group.children.map(x=>x.visible),[false,false,true]);
  assert.deepEqual([...f012.geometry.attributes.aPlantVariant.array],[0,1,2,2],'far pack slots follow the variants');
  assert.deepEqual([...f012.instanceMatrix.array.filter((_,i)=>i%16===12)],[1,2,3,4]);
  assert.deepEqual(set.stats(),{drawCalls:1,triangles:f012.geometry.index.count/3*4});
  for(let i=0;i<3;i++){set.update(new THREE.Vector3(i%2?0:50,0,0),true);assert.equal(set.group.children.reduce((n,x)=>n+x.count,0),4,'packs never duplicate or lose plants');}
  const bad=(packs,re)=>assert.throws(()=>new LodInstancedSet({name:'bad',variants,material,lodDistances:[10],packs}).build(),re);
  bad([[0,1]],/without a draw/);bad([[0,1],[1,2]],/repeated/);bad([[[0,1,2]]],/LOD entries/);bad([[0,1,3]],/missing/);
  const uniform=new LodInstancedSet({name:'uniform',variants,material,lodDistances:[10]});
  uniform.add(m(0),1,[1,1,1]);uniform.build();
  assert.deepEqual(uniform.packLayout,[[[0,1,2]],[[0,1,2]]],'default: every variant in one pack at every LOD');
  assert.equal(uniform.group.children.length,2);
  let released=0;for(const x of set.group.children){x.addEventListener('dispose',()=>released++);x.geometry.addEventListener('dispose',()=>released++);}
  set.dispose();assert.equal(released,6,'dispose releases every pack mesh and its packed geometry');
  uniform.dispose();for(const g of[...near,...far,packed])g.dispose();
}
console.log('PASS: forced LOD refresh, interactive gate, conserved matrices/colors/counts, shadow bindings, consistent estimates and variant packs (slots, hidden empty LODs, layout validation)');
