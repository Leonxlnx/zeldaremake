/** Run: node src/world/props/geometry.test.mjs (Node 20+, no browser needed). */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as geometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory. No global loader hooks or
// Node24 APIs, so Fable's Node22 runner executes the same geometry assertions.
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)((name) => {
    if (name === 'three') return THREE;
    if (name === 'three/addons/utils/BufferGeometryUtils.js') return geometryUtils;
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(file), name);
      for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
        if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
      }
    }
    throw new Error(`Unexpected test dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const {create,placementAllowed}=loadTs(path.join(here,'index.ts'));
const {LAYOUT}=loadTs(path.join(here,'../layout.ts'));
const {WORLD}=loadTs(path.join(here,'../config.ts'));
const {createTerrain}=loadTs(path.join(here,'../terrain/heightfield.ts'));
const {Vector3}=THREE;
const audits=[];
const woodMap = new THREE.Texture(); woodMap.name = 'weathered_planks/color';
let borrowedMapDisposals = 0; woodMap.addEventListener('dispose', () => borrowedMapDisposals++);
const ctx={textures:{load:async(set,kind)=>{assert.equal(set,'weathered_planks');assert.equal(kind,'color');return woodMap;}},terrain:createTerrain(),layout:LAYOUT,config:WORLD,quality:{shadows:true},audit:(_,fn)=>audits.push(fn)};
const one=await create(ctx), two=await create({...ctx,terrain:createTerrain()});
const audit=audits[0]();
assert.ok(audit.pots>=1 && audit.crates>=1 && audit.buckets>=1,'Each domestic prop type must actually be placed');
assert.equal(audit.platforms,1,'Platform must fit the authored placement');
assert.equal(audit.ladders,1);
assert.ok(audit.meshes<32,'Bounded draw calls');
// Regression: moving a prop toward the doorway must not silently skip it or
// leave it outside the hero frame. This tests projection, not occlusion/visual quality.
const vp = LAYOUT.viewpoints.find(v => v.id === 'B_house');
const camera = new THREE.PerspectiveCamera(vp.fov, 1280 / 720, .1, 1000);
camera.position.fromArray(vp.position);
camera.lookAt(new Vector3().fromArray(vp.target));
camera.updateMatrixWorld(true);
one.group.updateMatrixWorld(true);
const heroProjection = {};
for (const id of ['saria-small-pot', 'saria-crate', 'saria-water-bucket']) {
  const prop = one.group.getObjectByName(id);
  assert.ok(prop, `${id} must have a legal placement rather than silently skipping`);
  const center = new THREE.Box3().setFromObject(prop).getCenter(new Vector3()).project(camera);
  assert.ok(Math.abs(center.x) < .95 && Math.abs(center.y) < .95 && center.z > -1 && center.z < 1,
    `${id} must project inside B_house; actual ${center.toArray()}`);
  heroProjection[id] = [(center.x + 1) / 2, (1 - center.y) / 2];
}
const geometry=(system)=>system.group.children.flatMap(g=>g.children.map(m=>m.geometry));
const first=geometry(one),second=geometry(two);
let triangles=0;
for(let i=0;i<first.length;i++) {
  const p=first[i].attributes.position.array;
  assert.deepEqual(p,second[i].attributes.position.array,'Same seed must reproduce geometry');
  assert.deepEqual(first[i].attributes.color?.array,second[i].attributes.color?.array,'Fresh terrain and seed reproduce pigments');
  assert.ok([...p].every(Number.isFinite),'No invalid coordinates');
  const n=first[i].attributes.normal.array;
  assert.ok([...n].every(Number.isFinite),'No invalid normals');
  triangles+=p.length/9;
}
assert.ok(triangles<65000,'Props should remain a small part of scene geometry budget');
for(let i=0;i<one.group.children.length;i++) {
  assert.deepEqual(one.group.children[i].position.toArray(),two.group.children[i].position.toArray());
  assert.deepEqual(one.group.children[i].quaternion.toArray(),two.group.children[i].quaternion.toArray());
}
assert.equal(audit.pots,one.group.children.filter(g=>g.name.includes('pot')).length);
assert.equal(audit.crates,one.group.children.filter(g=>g.name.includes('crate')).length);
assert.equal(audit.buckets,one.group.children.filter(g=>g.name.includes('bucket')).length);
assert.equal(audit.platforms,one.group.children.filter(g=>g.name.includes('platform')).length);
one.group.updateMatrixWorld(true);
let contacts=0;
const ladderFeet=new Set();
for(const g of one.group.children) for(const mesh of g.children) {
  for(const index of mesh.geometry.userData.contactIndices??[]) {
    const v=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(mesh.matrixWorld);
    const gap=v.y-ctx.terrain.height(v.x,v.z);
    assert.ok(Math.abs(gap+.008)<.006,`Actual underside contact gap ${gap} on ${g.name}`);
    contacts++;
    if(g.name.includes('platform') && v.z-g.position.z>1.1) ladderFeet.add(v.x<g.position.x?'left':'right');
  }
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
  for(const i of mesh.geometry.userData.recomputedFaces??[]) {
    const a=new Vector3().fromBufferAttribute(p,i),b=new Vector3().fromBufferAttribute(p,i+1),c=new Vector3().fromBufferAttribute(p,i+2);
    const expected=b.sub(a).cross(c.sub(a));
    if(expected.lengthSq()<1e-16) continue;
    expected.normalize();
    for(let j=0;j<3;j++) assert.ok(expected.dot(new Vector3().fromBufferAttribute(n,i+j))>.9999,'Edited triangle normals match final surface');
  }
}
assert.ok(contacts>100,'Check real underside geometry, not just origins');
assert.equal(ladderFeet.size,2,'Both ladder feet have sampled geometric ground contacts');
for(const [x,y,z] of audit.samplePositions.bases) assert.ok(Math.abs(ctx.terrain.height(x,z)-y)<1e-8,'Audited bases touch actual terrain');
assert.equal(placementAllowed(ctx,0,0,.3),false,'Keep plaza path clear');
assert.equal(placementAllowed(ctx,12.5,-11.5,.3),false,'Keep house interior clear');
assert.equal(placementAllowed(ctx,-11.5,-7.2,.3),false,'Keep giant trunk clear');
const blocked={...ctx,terrain:{...ctx.terrain,mask:()=>({path:1,stairs:1,structure:1,cliff:1})}};
const empty=await create(blocked);
assert.equal(empty.group.children.length,0,'No fallback placements on forbidden ground');
// Normal alignment is measurable, not merely a stored audit claim.
for(const g of one.group.children) if(!g.name.includes('platform')) {
  const actual=new Vector3(0,1,0).applyQuaternion(g.quaternion);
  assert.ok(actual.dot(ctx.terrain.normal(g.position.x,g.position.z,new Vector3()))>.9999);
}
const propMeshes=one.group.children.flatMap(g=>g.children);
const mapped=propMeshes.filter(m=>m.geometry.attributes.aCrateGrainMean);
assert.equal(mapped.length,2,'Only the two crate wood batches borrow the map');
assert.equal(new Set(mapped.map(m=>m.material)).size,1,'One owned crate material, no per-board materials');
for(const mesh of propMeshes) {
  const crate=mesh.name.endsWith('crate-wood');
  assert.equal(!!mesh.geometry.attributes.uv,crate,'UVs remain crate-only');
  assert.equal(!!mesh.geometry.attributes.aCrateGrainMean,crate,'Surface tag remains crate-only');
  if(!crate)continue;
  assert.equal(mesh.material.map,null,'Borrow through a color-only sampler; keep automatic depth programs unchanged');
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  mesh.material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.crateWoodMap.value,woodMap);
  assert.equal(mesh.material.normalMap,null);
  assert.equal(mesh.material.roughnessMap,null);
  const uv=mesh.geometry.attributes.uv,mean=mesh.geometry.attributes.aCrateGrainMean;
  assert.ok([...uv.array,...mean.array].every(Number.isFinite));
  for(let i=0;i<mean.count;i+=3) {
    assert.equal(mean.getX(i),mean.getX(i+1),'Every triangle stays inside one board surface');
    assert.equal(mean.getX(i),mean.getX(i+2));
  }
}
let disposedGeometry=0,disposedMaterial=0;
first.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));
const mats=new Set(one.group.children.flatMap(g=>g.children.map(m=>m.material)));
mats.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));
console.log(JSON.stringify({passed:true,triangles,contacts,heroProjection,...audit},null,2));
one.dispose();two.dispose();empty.dispose();
assert.equal(disposedGeometry,first.length,'Every owned geometry is disposed');
assert.equal(disposedMaterial,mats.size,'Every used material is disposed');
assert.equal(one.group.children.length,0,'Dispose detaches meshes');

assert.equal(borrowedMapDisposals,0,'Props must never dispose the cached shared texture');
