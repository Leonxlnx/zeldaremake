// node art/environment/astra-bank-distribution/check-surface.mjs
// Regenerate raw inputs with geometry-worker.mjs 68b3eb96 0 and 588d3681 1 (README).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(dir, '../../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const base = read('baseline-geometry-local.json'), on = read('candidate-geometry-local.json');
const original = read('original-core-reference.json'), rim = read('original-rim-bounds.json');
const candidate = cp.execFileSync('git',['rev-parse','588d3681'],{cwd:root,encoding:'utf8'}).trim();
for (const [ref,run] of [[base.ref,base],[candidate,on]]) for (const [file,hash] of Object.entries(run.sourceHashes)) {
  const source=cp.execFileSync('git',['show',`${ref}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:16000000}).replaceAll('\r\n','\n');
  assert.equal(sha(source),hash,`${ref} source binding: ${file}`);
}
assert.equal(base.ref,'68b3eb96dc19886154e54e8de584fadf91f5eda7');
assert.equal(on.ref,candidate);
assert.deepEqual(on.context,base.context);
const changedSources=Object.keys(on.sourceHashes).filter(f=>on.sourceHashes[f]!==base.sourceHashes[f]).sort();
assert.deepEqual(changedSources,['src/world/trees/giant.ts','src/world/trees/nearCanopy.ts']);
const index=base.assets.findIndex(a=>a.builder.endsWith(':createGiantTree')&&a.input.def.id==='stair-bank-giant');
const old=base.assets[index], changed=on.assets[index], proof=changed.bankProof;
const body=old.geometry.find(g=>g.path==='asset.authoredLeaves'), bodyOn=changed.geometry.find(g=>g.path===body.path);
const a=Buffer.from(old.bankProof.positionsBase64,'base64'), b=Buffer.from(proof.positionsBase64,'base64');
assert.equal(a.length,b.length);
const expected=new Map();
for(const group of original.groups){const data=Buffer.from(group.positionsBase64,'base64');for(let i=0;i<group.ids.length;i++)expected.set(group.ids[i],data.subarray(i*12,(i+1)*12));}
let restoredCoreVertices=0;
for(let v=0;v<a.length/12;v++){
  const oldVertex=a.subarray(v*12,(v+1)*12), newVertex=b.subarray(v*12,(v+1)*12);
  if(expected.has(v)){assert(newVertex.equals(expected.get(v)),'Original core vertex restored exactly');restoredCoreVertices+=Number(!newVertex.equals(oldVertex));}
  else assert(newVertex.equals(oldVertex),'Non-core original positions exact');
}
assert.equal(restoredCoreVertices,1479);
for(const [name,attr] of Object.entries(body.attrs))if(name!=='position')assert.deepEqual(bodyOn.attrs[name],attr,`Far ${name} exact`);
assert.deepEqual(bodyOn.index,body.index);assert.deepEqual(bodyOn.bounds,body.bounds);assert.deepEqual(bodyOn.sphere,body.sphere);
const changedPaths=new Set(['asset.authoredLeaves',...proof.groups.map(g=>`asset.nearCanopy.${g.partIndex}.geometry`)]);
const normalized=structuredClone(on.assets); normalized[index].bankProof=old.bankProof;
normalized[index].geometry=normalized[index].geometry.map(g=>changedPaths.has(g.path)?old.geometry.find(x=>x.path===g.path):g);
assert.deepEqual(normalized,base.assets,'All other built geometry and source asset bindings exact');
const selectedNames=new Set(proof.groups.map(g=>`giant-near-canopy-stair-bank-giant-lobe-${g.partIndex}`));
const normalizedScene=on.rendered.map(r=>{
  if(r.name==='giants-authored-leaves-stair-bank-giant'||selectedNames.has(r.name)){
    const oldRow=base.rendered.find(b=>b.name===r.name);assert(oldRow);
    if(selectedNames.has(r.name)){assert.equal(r.visible,true);assert.equal(r.castShadow,false);assert.equal(r.material,'giantTreeNearCanopy');}
    return {...r,geometry:oldRow.geometry};
  }return r;
});
assert.deepEqual(normalizedScene,base.rendered,'All scene visibility, materials, transforms, instances and shadows exact');
const bindings=structuredClone(on.placementBinding);
for(const p of bindings.nearCanopies)if(p.tree==='stair-bank-giant'&&[24,25,26].includes(p.group)&&p.kind==='lobe'){
  const prior=base.placementBinding.nearCanopies.find(n=>n.id===p.id);
  for(const key of ['triangles','leaves'])p[key]=prior[key];
}
assert.deepEqual(bindings,base.placementBinding,'All placement/LOD/persistence/corridor bindings exact');
for(const group of proof.groups){
  const prior=old.bankProof.groups.find(g=>g.group===group.group);
  assert.deepEqual(group.recordedWood,prior.recordedWood,'Original stem/secondary/twig records exact');
  const bounds=rim.groups.find(g=>g.group===group.group).totalBounds;
  for(let c=0;c<3;c++)for(const side of ['min','max'])assert(Math.abs(bounds[side][c]-group.authoredEnvelopeWorld[side][c])<2e-6,'Near envelope equals original total leaf/core/card AABB');
  assert(group.minAnalyticMargin.every(x=>x>=0),'All-phase wind stays within original total envelope');
  const quantError=0.5/65535,h=group.physicalWorldBounds.max[1]-group.originY;
  const dirLength=Math.hypot(.72,-.69),flexError=quantError*.85*.06*h*.5*.3;
  const packedError=[.72/dirLength*flexError+.6*.85*quantError,.4*.85*quantError,.69/dirLength*flexError+.5*.85*quantError];
  assert(group.minAnalyticMargin.every((x,i)=>x>packedError[i]),'Raw analytic margin also contains worst-case Uint16 wind rounding');
  if(group.group===26)assert(group.analyticWorldBounds.min[1]-packedError[1]>=group.floorWorld,'Packed wind floor');
  group.additionalPackedWindErrorBoundM=packedError;
  assert(group.near.leaves<=group.leafCap);
  assert(group.surfaceCoverage.fractionCentroidsOutside>0.9,'At least90% of leaves have centroids beyond original core surface');
}
const cost={leaves:proof.groups.reduce((n,g)=>n+g.near.leaves,0),triangles:proof.groups.reduce((n,g)=>n+g.near.triangles,0),woodTriangles:proof.groups.reduce((n,g)=>n+g.near.woodTriangles,0),rawBuilderBytes:proof.groups.reduce((n,g)=>n+g.near.bytes,0),packedRenderedBytes:on.rendered.filter(r=>selectedNames.has(r.name)).reduce((n,r)=>n+r.geometry.bytes,0)};
assert(cost.triangles<=65440,'Fixed total near triangle ceiling');
assert(cost.woodTriangles<=8640,'Maximum wood budget at full leaf caps');
const beforeCost={triangles:old.bankProof.groups.reduce((n,g)=>n+g.near.triangles,0),leaves:old.bankProof.groups.reduce((n,g)=>n+g.near.leaves,0)};
const receipt={verdict:'PASS',baseline:base.ref,candidate,changedSources,restoredCoreVertices,cost,deltaFrom68:{triangles:cost.triangles-beforeCost.triangles,leaves:cost.leaves-beforeCost.leaves,meshes:0,materials:0,textures:0},
  exactUnrelatedGeometryRecords:base.summary.builtGeometryRecords-4,exactOtherNearParts:base.summary.nearCanopyParts-3,whiteBarkGeometrySha256:on.summary.whiteBarkGeometrySha256,
  checks:['1479 core vertices byte-exact original reference','all other far positions/attributes/indices exact','far cards byte-exact including existing below-floor corners','original authored culling box/sphere exact','all560 unrelated geometry records and423 unrelated near parts exact','original stem/secondary/twig records exact','all scene/LOD/persistence/material/shadow bindings exact','whole laminae within fixed caps','deterministic chunked rebuilds exact','original authored tones local to new leaves','new geometry and all-phase wind within original total card/leaf/core envelope','new group26 geometry above floor4.75','actual leaf centroids predominantly outside original backing'],
  inputs:Object.fromEntries(['baseline-geometry-local.json','candidate-geometry-local.json','original-core-reference.json','original-rim-bounds.json'].map(f=>[f,sha(fs.readFileSync(path.join(dir,f)))])),
  sourceBindings:{baseline:base.sourceHashes,candidate:on.sourceHashes},groups:proof.groups,
  limitations:['CPU geometric proof, pending native C/F review.','The original opaque core and original cards are retained; no claim of complete surface coverage from every camera.','Existing G26 alpha-card vertices reach4.663728m; only new geometry is constrained above4.75m.']};
fs.writeFileSync(path.join(dir,'surface-proof.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({verdict:receipt.verdict,candidate,cost,delta:receipt.deltaFrom68,exactUnrelatedGeometryRecords:receipt.exactUnrelatedGeometryRecords,groups:proof.groups.map(g=>({group:g.group,near:g.near,surfaceCoverage:g.surfaceCoverage,minAnalyticMargin:g.minAnalyticMargin}))},null,2));
