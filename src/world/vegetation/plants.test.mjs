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
assert.ok(a.plants.bushes.count>113,'Ledge clusters add shrubs to the original high-quality first pass');
for(const id of['A_stairs','B_house','D_log']){
  const p=LAYOUT.viewpoints.find(v=>v.id===id).position;
  for(const set of a.plants.all){set.update(new THREE.Vector3().fromArray(p),true);assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),set.count);}
}
for(const fixture of[a,b]){const geos=new Set();fixture.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of fixture.plants.materials)m.dispose();}
console.log(JSON.stringify({passed:true,checkedVertices,checkedBases,shadowMeshes,bushes:a.plants.bushes.count,note:'CPU geometry/placement contracts only; GPU capture and foliage appearance still require review.'}));
