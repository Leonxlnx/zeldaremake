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
console.log('PASS: forced LOD refresh, interactive gate, conserved matrices/colors/counts, shadow bindings and consistent estimates');
