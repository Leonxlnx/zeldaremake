/** Run from repo root: node src/world/materials/sprouts.test.mjs. CPU contracts, not GPU compilation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as T from 'three';

const root=path.resolve('src/world'), override=process.argv[2] && fs.readFileSync(process.argv[2],'utf8'), cache=new Map();
function load(name){const f=path.resolve(root,name+'.ts');if(cache.has(f))return cache.get(f).exports;const m={exports:{}};cache.set(f,m);const source=name==='materials/sprouts'&&override!==undefined?override:fs.readFileSync(f,'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(id=>id==='three'?T:load(path.relative(root,path.resolve(path.dirname(f),id)).replaceAll(path.sep,'/')),m,m.exports);return m.exports;}
const sprouts=load('materials/sprouts'),{WORLD}=load('config'),{createRng}=load('util/prng'),wind=load('wind/wind').createWind();
const variants=[
  [sprouts.TUFT_A,{size:.5},true],
  [sprouts.TUFT_B,{size:.8},true],
  [sprouts.TUFT_C,{size:.3},true],
  [sprouts.CLOVER,{size:.1},false],
  [sprouts.CUSHION,{size:.5,kind:'cushion'},false],
  [sprouts.FERN,{size:.5,kind:'fern'},false],
  [sprouts.GRIT,{size:.03,kind:'grit'},false],
];
// Put fern/grit in slot zero and tuft C/A in later slots: lighting semantics must follow the
// selected botanical variant, irrespective of pack grouping or order. Clover/cushion are up-
// facing too; their normals must not accidentally opt them into a blade-specific treatment.
const reordered=[[sprouts.CLOVER,sprouts.CUSHION],[sprouts.GRIT,sprouts.TUFT_C],[sprouts.FERN,sprouts.TUFT_B,sprouts.TUFT_A]];
for(const packs of [sprouts.HARDSCAPE_PACKS,sprouts.BOULDER_PACKS,reordered]){
  const ids=new Set(packs.flat()), selected=variants.filter(([id])=>ids.has(id));
  const spots=selected.map(([id,s])=>({x:id*.2,y:0,z:0,source:'tuft-mask-contract',...s}));
  const material=sprouts.createSproutMaterial(wind,WORLD), result=sprouts.buildSproutMeshes(spots,createRng('tuft-mask-contract'),material,WORLD,packs);
  assert.equal(result.meshes.length,packs.length);
  result.meshes.forEach((mesh,packIndex)=>{
    const g=mesh.geometry,mask=g.attributes.aTuftLighting,slot=g.attributes.aVariant;
    assert(mask,'Packed sprouts must supply their semantic lighting mask');
    assert(mask.array instanceof Uint8Array);
    assert.equal(mask.normalized,true,'GPU receives exactly zero or one');
    assert.equal(mask.count,g.attributes.position.count);
    for(let v=0;v<mask.count;v+=3){
      const id=packs[packIndex][slot.getX(v)], expected=variants.find(([variant])=>variant===id)[2]?1:0;
      for(let k=0;k<3;k++)assert.equal(mask.getX(v+k),expected,'All vertices of a triangle carry its botanical semantic');
    }
    assert.equal(mesh.castShadow,false);
    assert.equal(mesh.receiveShadow,true);
    g.dispose();
  });
  const shader={uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader,{});
  assert.equal(material.side,T.DoubleSide);
  assert.equal(material.normalMap,null);
  assert.equal(material.bumpMap,null);
  assert.match(material.customProgramCacheKey(),/tuft-up-v1/);
  assert.match(shader.vertexShader,/varying vec4 vTuftLighting;/);
  assert.match(shader.fragmentShader,/#include <normal_fragment_begin>[\s\S]*?if \(vTuftLighting.w > 0.5\)/);
  assert.match(shader.fragmentShader,/nonPerturbedNormal = normal;/);
  assert.equal(shader.uniforms.uTime,wind.uniforms.uTime,'Wind remains live by reference');
  material.dispose();
}
console.log('PASS: semantic masks survive hardscape, boulder and reordered mixed packs; shared shader contract. CPU only.');
