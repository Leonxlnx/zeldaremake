import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
export {T};
import {pin,file,sha,source,candidateSource} from './source.mjs';
export {pin,file,sha,source,candidateSource};
export const bytes=a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength), hashGeometry=g=>sha(Buffer.concat([...Object.keys(g.attributes).sort().flatMap(n=>[Buffer.from(n),bytes(g.attributes[n])]),bytes(g.index)]));
export function env(candidate){
 const cache=new Map();let rngCount=0;const rngHash=createHash('sha256');const log=(seed,key,args,result)=>{rngCount++;rngHash.update(JSON.stringify([seed,key,args,result]));};
 function wrap(raw,seed){const fn=()=>{const v=raw();log(seed,'next',[],v);return v;};for(const key of Object.keys(raw))fn[key]=key==='fork'?label=>{log(seed,key,[label],null);return wrap(raw.fork(label),seed+'/'+label);}:typeof raw[key]==='function'?(...args)=>{const v=raw[key](...args);log(seed,key,args,v);return v;}:raw[key];return fn;}
 function load(f){f=path.posix.normalize(f);if(cache.has(f))return cache.get(f).exports;const m={exports:{}};cache.set(f,m);const s=candidate&&f===file?candidateSource:source(f);const js=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(n=>n==='three'?T:load(path.posix.join(path.posix.dirname(f),n+'.ts')),m,m.exports);
  if(f==='src/world/util/prng.ts'){const orig=m.exports.createRng;m.exports.createRng=seed=>wrap(orig(seed),String(seed));}
  if(f==='src/world/vegetation/geometry.ts'){const traces=new WeakMap();for(const name of ['curvedLeaf','foldedLeaf','tube']){const orig=m.exports[name];m.exports[name]=(mesh,...args)=>{const entries=traces.get(mesh)??[];entries.push({name,first:mesh.p.length/3,firstIndex:mesh.i.length,args:JSON.stringify(args)});traces.set(mesh,entries);return orig(mesh,...args);};}const finish=m.exports.MeshBuilder.prototype.finish;m.exports.MeshBuilder.prototype.finish=function(...args){const g=finish.apply(this,args),entries=traces.get(this)??[];g.userData.primitives=entries.map((e,i)=>({...e,end:entries[i+1]?.first??g.attributes.position.count,endIndex:entries[i+1]?.firstIndex??g.index.count}));return g;};}
  return m.exports;
 }
 return {load,rng:()=>({calls:rngCount,sha256:rngHash.copy().digest('hex')})};
}
export function build(e){const read=n=>e.load('src/world/'+n+'.ts'),{WORLD}=read('config'),{LAYOUT}=read('layout'),ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1}},group=new T.Group(),field=new(read('vegetation/field').VegField)(ctx,WORLD.detailRadius+6,.5),plants=read('vegetation/plants').buildPlants(ctx,field,group);return{ctx,plants,group};}
export const stats=xs=>{const a=[...xs].sort((a,b)=>a-b),q=p=>a[Math.floor((a.length-1)*p)];return{count:a.length,min:a[0],p10:q(.1),median:q(.5),p90:q(.9),max:a.at(-1)};};
