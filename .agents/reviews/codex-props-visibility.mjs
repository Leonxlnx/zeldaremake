/** CPU-only opaque triangle visibility review. Run node .agents/reviews/codex-props-visibility.mjs. */
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
    if (name === 'three/addons/utils/BufferGeometryUtils.js' || name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return geometryUtils;
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => loadTs(path.join(root, 'src/world', name));
const {LAYOUT}=read('layout.ts'), {WORLD}=read('config.ts');
// Only texture rasterization is stubbed. Geometry builders and material sidedness run unchanged.
const noop=()=>{};
const drawing=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
  createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},
  {get:(object,key)=>object[key]??noop,set:(object,key,value)=>(object[key]=value,true)});
globalThis.document={createElement:tag=>{if(tag!=='canvas')throw Error(`Unexpected DOM ${tag}`);return{width:1,height:1,getContext:()=>drawing};}};
const textureSets=new Set();
const ctx={scene:new THREE.Scene(),renderer:{capabilities:{getMaxAnisotropy:()=>1}},
  terrain:read('terrain/heightfield.ts').createTerrain(),wind:read('wind/wind.ts').createWind(),
  quality:{tier:'high',distance:1,density:1,shadows:true,pixelRatio:1.5},
  layout:LAYOUT,config:WORLD,rng:read('util/prng.ts').createRng(WORLD.seed),sun:null,headless:true,
  textures:{load:async(set,kind)=>{textureSets.add(set);const t=new THREE.Texture();t.name=`placeholder:${set}/${kind}`;return t;},
    loaded:()=>[...textureSets],missing:()=>[]},audit:noop,progress:noop};
const systems=[];
for(const name of ['terrain','hardscape','structures','props']){
  const system=await read(`${name}/index.ts`).create(ctx);systems.push(system);ctx.scene.add(system.group);
}
ctx.scene.updateMatrixWorld(true);
const props=systems.find(s=>s.name==='props');
const solid=[], excluded=[];
for(const system of systems)system.group.traverse(o=>{
  if(!o.isMesh)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(mats.some(m=>m.transparent||m.alphaTest>0||m.alphaMap))excluded.push(`${system.name}/${o.name}`);
  else solid.push(o);
});
const ray=new THREE.Raycaster();
const results=[];
for(const id of ['B_house','D_log']){
  const vp=LAYOUT.viewpoints.find(v=>v.id===id),camera=new THREE.PerspectiveCamera(vp.fov,1280/720,.1,1000);
  camera.position.fromArray(vp.position);camera.lookAt(new THREE.Vector3().fromArray(vp.target));camera.updateMatrixWorld(true);
  for(const name of ['saria-small-pot','saria-crate','saria-water-bucket']){
    const prop=props.group.getObjectByName(name);if(!prop)throw Error(`Missing ${name}`);
    const box=new THREE.Box3().setFromObject(prop),center=box.getCenter(new THREE.Vector3()),ndc=center.clone().project(camera);
    const samples=[];
    for(const f of [.3,.5,.7]){
      const point=center.clone();point.y=box.min.y+(box.max.y-box.min.y)*f;
      const direction=point.clone().sub(camera.position).normalize();ray.set(camera.position,direction);ray.far=point.distanceTo(camera.position)+box.getSize(new THREE.Vector3()).length();
      const hit=ray.intersectObjects(solid,false)[0];
      let ancestor=hit?.object, own=false;while(ancestor){if(ancestor===prop)own=true;ancestor=ancestor.parent;}
      samples.push({heightFraction:f,firstHit:hit?.object.name??null,ownPropFirst:own,distance:hit?.distance??null});
    }
    results.push({view:id,prop:name,screen:[(ndc.x+1)/2,(1-ndc.y)/2],inFrame:Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1&&ndc.z>-1&&ndc.z<1,samples});
  }
}
console.log(JSON.stringify({scope:'CPU opaque triangles: terrain, hardscape, structures, props; no trees/rocks/vegetation/alpha/shaders/fog proof',solidMeshes:solid.length,excludedAlphaMeshes:excluded.length,results},null,2));


// The placement search was withdrawn after Fable confirmed intentional root occlusion.
for (const system of systems) system.dispose?.();
