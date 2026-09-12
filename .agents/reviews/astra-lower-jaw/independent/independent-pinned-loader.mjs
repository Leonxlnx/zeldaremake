import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import * as T from 'three';
import * as U from 'three/addons/utils/BufferGeometryUtils.js';

const root=process.cwd(), dir=path.dirname(new URL(import.meta.url).pathname);
const ctx=new Proxy({}, {get:(_,k)=>String(k).endsWith('Gradient')?()=>({addColorStop(){}}):k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):()=>{}});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
export function loader(candidate){const cache=new Map();function load(rel){const file=path.resolve(root,rel);if(cache.has(file))return cache.get(file).exports;const base=path.basename(file);let source=fs.readFileSync(candidate&&['face-geometry.ts','lower-face-geometry.ts','link.ts'].includes(base)?path.join(dir,base):!candidate&&['face-geometry.ts','link.ts'].includes(base)?path.join(dir,'baseline',base):file,'utf8');if(base==='link.ts')source=source.replace('  batchStaticLinkParts(rig);','');const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>id==='three'?T:id.includes('BufferGeometryUtils')?U:load(path.resolve(path.dirname(file),id+'.ts')),m,m.exports);return m.exports;}return load;}
