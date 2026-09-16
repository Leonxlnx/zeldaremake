/** Real vegetation lifecycle: dormant LODs and instance buffers must be released once. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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

const resources = new Map();
function watch(resource) {
  if (resources.has(resource)) return;
  resources.set(resource, 0);
  resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1));
}
let grass;
const grassModule=read('vegetation/grass'), originalGrass=grassModule.buildGrass;
grassModule.buildGrass=async (...args)=>{
  grass=await originalGrass(...args);
  for(const tile of grass.tiles) for(const geometry of tile.lods) watch(geometry);
  return grass;
};
const materials=read('vegetation/materials');
for (const name of ['createVegMaterial','createVegShadowMaterials']) {
  const original=materials[name];
  materials[name]=(...args)=>{
    const result=original(...args);
    if(result.isMaterial) watch(result); else {watch(result.depth);watch(result.distance);}
    return result;
  };
}
const {WORLD}=read('config'),{LAYOUT}=read('layout');
const camera=new THREE.PerspectiveCamera(), scene=new THREE.Scene();
const ctx={config:WORLD,layout:LAYOUT,scene,camera,
  terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),
  wind:read('wind/wind').createWind(),quality:{tier:'low',density:.02,distance:.6,shadows:true,pixelRatio:1},
  progress(){},audit(){}};
const system=await read('vegetation/index').create(ctx);
scene.add(system.group);
system.group.traverse(object=>{if(object.isInstancedMesh){watch(object);watch(object.geometry);}});
assert.ok(grass.tiles.length>0);
const dormant=grass.tiles.flatMap(tile=>tile.lods.filter(g=>g!==tile.mesh.geometry));
assert.equal(dormant.length, grass.tiles.length*2);
assert.ok([...resources.keys()].some(r=>r.isMeshDepthMaterial));
assert.ok([...resources.keys()].some(r=>r.isMeshDistanceMaterial));
for(const count of resources.values()) assert.equal(count,0,'No premature release');
system.dispose();
assert.equal(system.group.parent,null,'Disposed vegetation leaves scene');
for(const [resource,count] of resources) assert.equal(count,1,`Release ${resource.type} ${resource.name} exactly once`);
for(const geometry of dormant) assert.equal(resources.get(geometry),1,'Release dormant grass LOD');
system.dispose();
system.update(0,0,ctx);
system.onCameraMove(camera,ctx);
for(const count of resources.values()) assert.equal(count,1,'Repeated disposal is harmless');
console.log(`PASS: ${resources.size} resources released once, including ${dormant.length} dormant grass LODs; CPU disposal events only`);
