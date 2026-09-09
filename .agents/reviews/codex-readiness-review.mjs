// CPU-only failure-path diagnostic. Real assembler/API, injected factories; no rendering.
// Run: node .agents/reviews/codex-readiness-review.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const compile = (file, imports) => {
  const m={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>{
    if(name==='three')return THREE;
    if(name in imports)return imports[name];
    throw Error(`Unexpected dependency ${name}`);
  },m,m.exports);
  return m.exports;
};
const names=['lighting','atmosphere','terrain','hardscape','rocks','structures','trees','vegetation','props'];
const errors=[];
const originalError=console.error, originalInfo=console.info;
const terrain={height:()=>0,slope:()=>0,mask:()=>({})};
const imports={
  './config':{WORLD:{seed:'diagnostic'}},'./layout':{LAYOUT:{viewpoints:[],stairs:[]}},
  './terrain/heightfield':{getTerrain:()=>terrain},'./wind/wind':{createWind:()=>({update(){}})},
  './util/prng':{createRng:()=>({})},'./materials/textures':{createTextureLibrary:()=>({})},
};
for(const name of names)imports[`./${name}`]={create:ctx=>{
  if(name==='terrain')throw Error('injected terrain build failure');
  ctx.audit(name,()=>({built:true}));
  return{name,group:new THREE.Group()};
}};
const {createWorld,qualityFor}=compile('src/world/index.ts',imports);
const {installCaptureApi}=compile('src/capture/api.ts',{'../world/layout':imports['./layout']});
globalThis.window={};
const scene=new THREE.Scene(),audits=new Map();
const renderer={capabilities:{getMaxAnisotropy:()=>1}};
let world;
try {
  console.error=(...args)=>errors.push(args.map(String).join(' '));console.info=()=>{};
  world=await createWorld({scene,renderer,camera:new THREE.PerspectiveCamera(),quality:qualityFor('low'),headless:true,audits});
} finally {console.error=originalError;console.info=originalInfo;}
const api=installCaptureApi({scene,renderer,camera:new THREE.PerspectiveCamera(),audits,terrain,
  ready:Promise.resolve(),setViewpoint:()=>true,setPose(){},step(){},setTime(){},getTime:()=>0,setQuality(){}});
const ready=await api.ready();
assert.equal(world.systems.some(s=>s.name==='terrain'),false);
assert.equal(ready,true);
assert.equal(errors.length,1);
console.log(JSON.stringify({diagnostic:'failure is swallowed before ready',headless:true,injectedFailure:'terrain',
  builtSystems:world.systems.map(s=>s.name),ready,errors,
  limitation:'Factories are injected to exercise exception handling; this does not claim current real terrain fails.'},null,2));
