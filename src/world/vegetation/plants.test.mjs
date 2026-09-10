/** Plant-only CPU integration: real placement, geometry and materials; no renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const modules=new Map(),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;
  const m={exports:{}};modules.set(file,m);
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{
    if(id==='three')return THREE;if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'));throw Error(id);
  },m,m.exports);return m.exports;
}
const read=name=>load(path.join(root,name+'.ts'));
const {WORLD}=read('config'),{LAYOUT}=read('layout'),{VegField,newSample}=read('vegetation/field');
function make(){const ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5}};
  const group=new THREE.Group(),field=new VegField(ctx,WORLD.detailRadius+6,.5);return{ctx,group,field,plants:read('vegetation/plants').buildPlants(ctx,field,group)};
}
const a=make(),b=make();
const hash=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
let checkedVertices=0,checkedBases=0,shadowMeshes=0;
for(let j=0;j<a.plants.all.length;j++){
  const first=a.plants.all[j],second=b.plants.all[j];assert.equal(first.count,second.count);
  assert.ok(first.count>0,`${first.opts.name} must be present`);
  for(let i=0;i<first.count;i++){
    const item=first.items[i];assert.deepEqual(item,second.items[i],'Fresh seed/terrain reproduces transforms, variant and pigment');
    const sample=a.field.sample(item.x,item.z,newSample());
    assert.ok(a.field.allowed(item.x,item.z,sample),'Placed root obeys original field exclusions');
    assert.ok(!a.field.insideGiantTrunk(item.x,item.z),'No root inside giant trunk');
    const gap=a.ctx.terrain.height(item.x,item.z)-item.y;
    assert.ok(gap>=-.004&&gap<.061,`Root contact gap ${gap} for ${first.opts.name}`);checkedBases++;
  }
  for(let v=0;v<first.opts.variants.length;v++)for(let l=0;l<first.opts.variants[v].length;l++){
    const g=first.opts.variants[v][l],other=second.opts.variants[v][l];
    for(const key of['position','normal','color']){
      const data=g.attributes[key].array;assert.ok(data.every(Number.isFinite),`${key} is finite`);assert.equal(hash(data),hash(other.attributes[key].array));
    }
    checkedVertices+=g.attributes.position.count;
    if(l>0)assert.ok(g.index.count<=first.opts.variants[v][l-1].index.count,'LOD reduces triangle count');
  }
  for(const mesh of first.group.children)if(mesh.castShadow){
    assert.ok(mesh.customDepthMaterial?.isMeshDepthMaterial);assert.ok(mesh.customDistanceMaterial?.isMeshDistanceMaterial);shadowMeshes++;
  }
}
assert.ok(a.plants.bushes.count>=80,'W19: at least 80 bushes');
assert.ok(a.plants.bushes.items.filter(it=>it.x>-7.5&&it.x<-2&&it.z>-23&&it.z<-14).length>=4,'Shrub mass on the boulder bank west of the north path (shot D left-centre)');
// reference-driven composition constraints (see plants.ts / field.ts zones)
const top=(set,it)=>{const g=set.opts.variants[it.variant][0];return it.y+g.boundingBox.max.y*Math.hypot(it.matrix[4],it.matrix[5],it.matrix[6]);};
assert.ok(a.plants.hedge.count>=3,'Hedge row present for shot A');
for(const it of a.plants.hedge.items){
  assert.ok(top(a.plants.hedge,it)<=1.3,`Hedge crown top ${top(a.plants.hedge,it)} stays below Saria's door threshold as seen from camera B (≤ 1.3 m above plaza level)`);
  assert.ok(it.z<=-5.1,'Hedge stays out of camera C\'s left edge');
}
const inBox=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
const cSight=[3.5,-9.5,8,-4],dRight=[1.5,-16,7,-4];
for(const set of[a.plants.ferns,a.plants.bushes,a.plants.seedheads,a.plants.saplings])for(const it of set.items){
  assert.ok(!inBox(it,cSight),`${set.opts.name} at (${it.x},${it.z}) blocks camera C's sight line to the stair foot`);
  if(inBox(it,dRight))assert.ok(top(set,it)-it.y<=0.55,`${set.opts.name} taller than 0.55 m on shot D's right verge`);
}
assert.ok(a.plants.ferns.items.filter(it=>inBox(it,[8.0,-4.9,9.5,-3.6])).length>=5,'Large fern clumps at shot B\'s right edge');
assert.ok(a.plants.flowers.items.filter(it=>inBox(it,[8.5,-4.85,9.25,-4.15])).length>=4,'Purple clump at shot B\'s right edge');
assert.ok(a.plants.ferns.items.filter(it=>Math.hypot(it.x+3.2,it.z+10.2)<2.3).length>=3,'Fern cluster beside the shot-D boulder');
assert.ok(a.plants.flowers.count>=150,'W18: at least 150 flower clusters');
for(const id of['A_stairs','B_house','D_log']){
  const p=LAYOUT.viewpoints.find(v=>v.id===id).position;
  for(const set of a.plants.all){set.update(new THREE.Vector3().fromArray(p),true);assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),set.count);}
}
for(const fixture of[a,b]){const geos=new Set();fixture.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of fixture.plants.materials)m.dispose();}
console.log(JSON.stringify({passed:true,checkedVertices,checkedBases,shadowMeshes,bushes:a.plants.bushes.count,note:'CPU geometry/placement contracts only; GPU capture and foliage appearance still require review.'}));
