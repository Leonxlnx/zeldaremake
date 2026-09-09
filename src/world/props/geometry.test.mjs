/** Run: node src/world/props/geometry.test.mjs (Node 24, no browser needed). */
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier,context,next) {
    if(specifier.startsWith('.') && context.parentURL?.endsWith('.ts') && !/\.[a-z]+$/i.test(specifier)) {
      const url=new URL(specifier+'.ts',context.parentURL);
      if(existsSync(url)) return {url:url.href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    if(url.endsWith('.ts')) return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};
    return next(url,context);
  },
});
const {create,placementAllowed}=await import('./index.ts');
const {LAYOUT}=await import('../layout.ts');
const {WORLD}=await import('../config.ts');
const {createTerrain}=await import('../terrain/heightfield.ts');
const {Vector3}=await import('three');
const audits=[];
const ctx={terrain:createTerrain(),layout:LAYOUT,config:WORLD,quality:{shadows:true},audit:(_,fn)=>audits.push(fn)};
const one=create(ctx), two=create({...ctx,terrain:createTerrain()});
const audit=audits[0]();
assert.ok(audit.pots>=1 && audit.crates>=1 && audit.buckets>=1,'Each domestic prop type must actually be placed');
assert.equal(audit.platforms,1,'Platform must fit the authored placement');
assert.equal(audit.ladders,1);
assert.ok(audit.meshes<32,'Bounded draw calls');
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
for(const g of one.group.children) for(const mesh of g.children) {
  for(const index of mesh.geometry.userData.contactIndices??[]) {
    const v=new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index).applyMatrix4(mesh.matrixWorld);
    const gap=v.y-ctx.terrain.height(v.x,v.z);
    assert.ok(Math.abs(gap+.008)<.006,`Actual underside contact gap ${gap} on ${g.name}`);
    contacts++;
  }
}
assert.ok(contacts>100,'Check real underside geometry, not just origins');
for(const [x,y,z] of audit.samplePositions.bases) assert.ok(Math.abs(ctx.terrain.height(x,z)-y)<1e-8,'Audited bases touch actual terrain');
assert.equal(placementAllowed(ctx,0,0,.3),false,'Keep plaza path clear');
assert.equal(placementAllowed(ctx,12.5,-11.5,.3),false,'Keep house interior clear');
assert.equal(placementAllowed(ctx,-11.5,-7.2,.3),false,'Keep giant trunk clear');
const blocked={...ctx,terrain:{...ctx.terrain,mask:()=>({path:1,stairs:1,structure:1,cliff:1})}};
const empty=create(blocked);
assert.equal(empty.group.children.length,0,'No fallback placements on forbidden ground');
// Normal alignment is measurable, not merely a stored audit claim.
for(const g of one.group.children) if(!g.name.includes('platform')) {
  const actual=new Vector3(0,1,0).applyQuaternion(g.quaternion);
  assert.ok(actual.dot(ctx.terrain.normal(g.position.x,g.position.z,new Vector3()))>.9999);
}
let disposedGeometry=0,disposedMaterial=0;
first.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));
const mats=new Set(one.group.children.flatMap(g=>g.children.map(m=>m.material)));
mats.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));
console.log(JSON.stringify({passed:true,triangles,contacts,...audit},null,2));
one.dispose();two.dispose();empty.dispose();
assert.equal(disposedGeometry,first.length,'Every owned geometry is disposed');
assert.equal(disposedMaterial,mats.size,'Every used material is disposed');
assert.equal(one.group.children.length,0,'Dispose detaches meshes');
