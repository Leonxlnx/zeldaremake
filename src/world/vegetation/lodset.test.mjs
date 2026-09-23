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
// Submission culling (round 15): after cull() a bucket only submits the instances whose padded
// sphere meets the view frustum, plus — on shadow-casting LODs — those whose shadow sweep along
// the sun reaches the frame; buckets still account for every plant, kept instances keep their
// matrices / colours, and a cull with an unchanged view and unchanged buckets is a no-op.
{
  const {CULL_PAD_M,SHADOW_FLOOR_Y}=module.exports;
  assert.ok(CULL_PAD_M>=1&&SHADOW_FLOOR_Y<=-1,'conservative pad and a floor under the terrain');
  const near=[new THREE.BoxGeometry(0.5,0.5,0.5)],far=[new THREE.PlaneGeometry(0.5,0.5)];
  const set=new LodInstancedSet({name:'culled',variants:[[near[0],far[0]]],material,shadowMaterials:{depth,distance},lodDistances:[20],castShadowLods:1});
  const at=(x,y,z)=>Float32Array.from(new THREE.Matrix4().makeTranslation(x,y,z).elements);
  // near LOD (casts): ahead / behind / behind but shadow lands ahead / just outside the frustum edge (within the pad)
  set.add(at(0,0,-10),0,[1,0,0]);set.add(at(0,0,8),0,[0,1,0]);set.add(at(0,0,3),0,[0,0,1]);
  // far LOD (no shadow): ahead / behind
  set.add(at(0,0,-40),0,[1,1,0]);set.add(at(0,0,40),0,[0,1,1]);
  set.build();
  const camera=new THREE.PerspectiveCamera(60,16/9,0.1,100);camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();
  const shadowAhead=new THREE.Vector3(0,0.2,1).normalize(); // low sun behind the camera: long shadows fall into the frame
  const shadowBehind=new THREE.Vector3(0,0.5,-1).normalize();
  const [nearMesh,farMesh]=set.group.children;
  set.update(new THREE.Vector3(0,0,0),true);
  assert.deepEqual([nearMesh.count,farMesh.count],[3,2],'whole buckets before the first cull');
  set.cull(camera,shadowBehind,true);
  assert.deepEqual([nearMesh.count,farMesh.count],[1,1],'behind the camera with the shadow falling behind: culled');
  assert.deepEqual([...nearMesh.instanceMatrix.array.slice(12,15)],[0,0,-10]);assert.deepEqual([...nearMesh.instanceColor.array.slice(0,3)],[1,0,0]);
  assert.deepEqual([...farMesh.instanceMatrix.array.slice(12,15)],[0,0,-40]);
  assert.deepEqual(set.submission().map(m=>[m.lod,m.bucket,m.submitted]),[[0,3,1],[1,2,1]],'buckets keep every plant, submitted is the trimmed count');
  assert.equal(set.stats().triangles,nearMesh.geometry.index.count/3*2+farMesh.geometry.index.count/3,'stats follow the submitted instances');
  set.cull(camera,shadowAhead,true);
  assert.equal(nearMesh.count,3,'casters behind the camera whose shadow sweeps into the frame stay in the depth map');
  assert.equal(farMesh.count,1,'the non-casting LOD ignores the sun');
  const versionBefore=nearMesh.instanceMatrix.version;
  set.cull(camera,shadowAhead);
  assert.equal(nearMesh.instanceMatrix.version,versionBefore,'unchanged view + buckets: nothing re-uploaded');
  // the pad: an instance a little outside the frustum's edge is kept, one far outside is not
  const edge=new LodInstancedSet({name:'edge',variants:[[near[0]]],material,lodDistances:[]});
  const halfW=10*Math.tan(THREE.MathUtils.degToRad(30))*(16/9);
  edge.add(at(halfW+CULL_PAD_M*0.5,0,-10),0,[1,1,1]);edge.add(at(halfW+CULL_PAD_M*4,0,-10),0,[1,1,1]);
  edge.build();edge.update(new THREE.Vector3(0,0,0),true);edge.cull(camera,shadowBehind,true);
  assert.equal(edge.group.children[0].count,1,'the pad admits the instance at the frustum edge and drops the one well outside');
  assert.ok(edge.group.children[0].boundingSphere.radius>=CULL_PAD_M,'the aggregate sphere carries the pad');
  // the sphere's centre is the pack centroid (three's opaque sort key) and never moves with the submission
  const centre=edge.group.children[0].boundingSphere.center.clone();
  assert.ok(Math.abs(centre.x-(halfW+CULL_PAD_M*2.25))<1e-6,'centre = mean of every plant of the pack');
  camera.position.set(0,0,-30);camera.lookAt(0,0,-31);camera.updateMatrixWorld();edge.cull(camera,shadowBehind);
  assert.equal(edge.group.children[0].count,0);camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();edge.cull(camera,shadowBehind);
  assert.deepEqual(edge.group.children[0].boundingSphere.center.toArray(),centre.toArray(),'the centre is fixed across culls');
  // cull: false — the set keeps submitting whole buckets (the audit's scene-graph claims rely on it)
  const whole=new LodInstancedSet({name:'whole',variants:[[near[0]]],material,lodDistances:[],cull:false});
  whole.add(at(0,0,-10),0,[1,1,1]);whole.add(at(0,0,50),0,[1,1,1]);whole.build();whole.update(new THREE.Vector3(0,0,0),true);
  whole.cull(camera,shadowBehind,true);
  assert.equal(whole.group.children[0].count,2,'cull: false leaves the plant behind the camera submitted');
  whole.dispose();
  // re-pose: buckets change, cull re-trims from the new buckets
  set.update(new THREE.Vector3(0,0,-35),true);
  assert.deepEqual(set.submission().map(m=>m.bucket),[1,4],'re-bucketed by the new distance');
  camera.position.set(0,0,-35);camera.lookAt(0,0,-36);camera.updateMatrixWorld();
  set.cull(camera,shadowBehind);
  assert.deepEqual([nearMesh.count,farMesh.count,farMesh.visible],[1,0,false],'from -35 looking -Z: only the plant ahead (-40) survives, the emptied far bucket is hidden');
  assert.deepEqual([...nearMesh.instanceMatrix.array.slice(12,15)],[0,0,-40]);
  set.dispose();edge.dispose();for(const g of[...near,...far])g.dispose();
}

// Incremental re-bucketing (round 48, lod-1): an unforced update lists at most `maxItems` plants a
// call into staging lists and swaps the buckets when the last plant is listed; until then the old
// buckets stand. The result equals one forced re-bucket at the job's camera (same lists, same order),
// the listing is accounted exactly (`listedLast`), and a forced update cancels an open job.
{
  const geo=[new THREE.BoxGeometry(),new THREE.PlaneGeometry()];
  const at=(x,y,z)=>Float32Array.from(new THREE.Matrix4().makeTranslation(x,y,z).elements);
  const N=25,K=8;
  const build=()=>{const s=new LodInstancedSet({name:'inc',variants:[geo],material,lodDistances:[10,20],maxDistance:60,hysteresis:0.6});for(let i=0;i<N;i++)s.add(at(i*3,0,0),0,[i/N,0,0]);s.build();return s;};
  const inc=build(),ref=build();
  const buckets=s=>s.submission().map(m=>[m.lod,m.bucket]);
  const lists=s=>s.group.children.map(m=>[...m.instanceMatrix.array.slice(0,m.count*16)]);
  inc.update(new THREE.Vector3(0,0,0),true);ref.update(new THREE.Vector3(0,0,0),true);
  assert.equal(inc.listedLast,N,'a forced update lists the whole set');
  const before=buckets(inc);
  // camera moves 30 m: everything re-buckets, in ceil(N/K) = 4 calls of at most K plants
  const cam=new THREE.Vector3(30,0,0);
  let calls=0,listed=0;
  while(!inc.update(cam,false,K)){calls++;listed+=inc.listedLast;assert.ok(inc.rebucketing,'a job is open until the last plant is listed');assert.ok(inc.listedLast<=K,'never more than maxItems a call');assert.deepEqual(buckets(inc),before,'the old buckets stand while the job runs');}
  listed+=inc.listedLast;calls++;
  assert.equal(calls,Math.ceil(N/K),'ceil(N / maxItems) calls to swap');
  assert.equal(listed,N,'every plant listed exactly once');
  assert.equal(inc.rebucketing,false,'the job is closed on the swap');
  ref.update(cam,true);
  assert.deepEqual(buckets(inc),buckets(ref),'the incremental result equals one forced re-bucket at the job camera');
  assert.deepEqual(lists(inc),lists(ref),'same lists in the same order');
  assert.equal(inc.update(cam,false,K),false,'settled: no job at the same camera');assert.equal(inc.listedLast,0);
  // a camera drift below the hysteresis while a job is open does not restart it; the job keeps its own camera
  const cam2=new THREE.Vector3(60,0,0);
  assert.equal(inc.update(cam2,false,K),false);assert.ok(inc.rebucketing);
  assert.equal(inc.update(new THREE.Vector3(60.3,0,0),false,K),false,'the open job advances for its own camera');
  while(!inc.update(cam2,false,K));
  ref.update(cam2,true);
  assert.deepEqual(buckets(inc),buckets(ref),'a job bucketed for the camera it started at');
  // a forced update mid-job drops the job and re-buckets at once (the captures never see a half-listed set)
  const cam3=new THREE.Vector3(0,0,0);
  assert.equal(inc.update(cam3,false,K),false);assert.ok(inc.rebucketing);
  assert.equal(inc.update(cam3,true),true);assert.equal(inc.rebucketing,false);assert.equal(inc.listedLast,N);
  ref.update(cam3,true);assert.deepEqual(buckets(inc),buckets(ref));
  // maxItems = Infinity is the shipped one-shot
  assert.equal(inc.update(new THREE.Vector3(30,0,0)),true,'default maxItems re-buckets in one call');assert.equal(inc.listedLast,N);
  inc.dispose();ref.dispose();for(const g of geo)g.dispose();
}
console.log('PASS: forced LOD refresh, interactive gate, conserved matrices/colors/counts, shadow bindings, consistent estimates, variant packs (slots, hidden empty LODs, layout validation), submission culling (frustum, shadow sweep, pad, no-op re-cull) and incremental re-bucketing (bounded listing, exact accounting, forced cancel, same result as one-shot)');
