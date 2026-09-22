import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../..');
const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f)));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const before=read('screen-063772a4.json'),after=read('screen-588d3681.json'),proof=read('surface-proof.json'),rng=read('streams-and-floor.json');
for(const run of [before,after]) {
  for(const [file,hash]of Object.entries(run.analysisScripts))assert.equal(sha(fs.readFileSync(path.join(dir,file))),hash,`analysis binding ${file}`);
  for(const [file,hash]of Object.entries(run.sources))assert.equal(sha(cp.execFileSync('git',['show',`${run.sourceRef}:${file}`],{cwd:root,encoding:'utf8',maxBuffer:16000000}).replaceAll('\r\n','\n')),hash,`source binding ${file}`);
  assert.equal(sha(fs.readFileSync(run.nativeManifest.path)),run.nativeManifest.sha256);
}
assert.equal(after.attributePacking.applied,true);assert.equal(before.attributePacking.applied,false);
assert.equal(proof.candidate,after.sourceRef);assert.equal(rng.candidate,after.sourceRef);
const sample=(r)=>({finePercent:r.overall.frontmostFine/r.overall.projectedCorePixels*100,corePercent:r.overall.frontmostCore/r.overall.projectedCorePixels*100,frontmostFinePixels:r.overall.frontmostFine,frontmostCorePixels:r.overall.frontmostCore,emptyProjectionPixels:r.overall.noFineProjection,projectionOnlyBehindCorePixels:r.overall.projectedFineBehindCore,overlap:r.overlap.frontCoreFootprintsDividedByUniqueFrontCorePixels,largestBareComponents:r.contiguous.frontmostCore.largest.slice(0,3),outsideCoreMask:r.outsideCoreMask,rayChecks:r.independentRayCheck.sampleCount,floor:r.floor});
const views={};
for(const view of ['F_canopy','C_lookback']) {
  const a=before.views[view],b=after.views[view];
  assert.deepEqual(a.pose,b.pose);assert.equal(a.time,b.time);assert.equal(a.coreMaskSha256,b.coreMaskSha256);
  assert.equal(b.floor.floorWorld,4.75);assert.equal(b.floor.floorFineInFrontByGroup[26],0);
  views[view]={corePixels:b.overall.projectedCorePixels,coreMaskSha256:b.coreMaskSha256,before:sample(a),after:sample(b),outsideCoreUnoccludedPixelDelta:b.outsideCoreMask.fineUnoccludedPixels-a.outsideCoreMask.fineUnoccludedPixels,groups:b.groups.map(g=>({group:g.group,corePixels:g.coverage.frontmostCorePixels,fineBefore:100*a.groups.find(x=>x.group===g.group).coverage.frontmostFine/g.coverage.frontmostCorePixels,fineAfter:100*g.coverage.frontmostFine/g.coverage.frontmostCorePixels}))};
}
const patch=cp.execFileSync('git',['diff','--binary',proof.baseline,proof.candidate,'--','src/world/trees/giant.ts','src/world/trees/nearCanopy.ts'],{cwd:root});
fs.writeFileSync(path.join(dir,'source-588d3681.patch'),patch);
const fullBefore=read('baseline-geometry-local.json'),fullAfter=read('candidate-geometry-local.json');
const receipt={verdict:'REJECT_AS_DELIVERY_NO_NATIVE_CAPTURE',candidate:proof.candidate,canonicalBaseline:proof.baseline,comparisonCandidate:before.sourceRef,nativeCapture:false,
  reason:'Geometric distribution improves in both poses, but large contiguous bare core faces remain. The single candidate is frozen; no density sweep or further source tuning.',
  geometry:{...proof.cost,deltaFromCanonical:proof.deltaFrom68,exactUnrelatedGeometryRecords:proof.exactUnrelatedGeometryRecords,exactOtherNearParts:proof.exactOtherNearParts,restoredOriginalCoreVertices:proof.restoredCoreVertices},
  groups:proof.groups.map(g=>({group:g.group,leaves:g.near.leaves,triangles:g.near.triangles,woodTriangles:g.near.woodTriangles,shoots:g.retainedTubes,surfaceAreaM2:g.surfaceAreaM2,horizontalBottomAreaM2:g.floorAreaM2,minSeedSpacingM:Math.min(...g.seedSpacingM),medianShootLengthM:[...g.shootLengthsM].sort((a,b)=>a-b)[Math.floor(g.shootLengthsM.length/2)],aggregateShootLengthPerAcceptedLeafM:g.shootLengthsM.reduce((a,b)=>a+b,0)/g.near.leaves,initialBuildMs:g.initialBuildMs,rebuildMs:g.rebuildMs,allPhaseMinWorldY:g.analyticWorldBounds.min[1],additionalPackedWindErrorBoundM:g.additionalPackedWindErrorBoundM,floorLocal:g.floorLocal,originY:g.originY,floorWorld:g.floorWorld})),
  views,rng:{exactStreams:rng.rng.exactStreams,exactDraws:rng.rng.exactDraws,exactStreamAggregateSha256:rng.rng.exactStreamAggregateSha256,changedLocalStreams:rng.rng.changedLocalStreams.map(s=>s.seed)},
  packing:{before:before.attributePacking,after:after.attributePacking},
  constructionTiming:{method:'Single CPU runs; not a benchmark. Per-part initial/rebuild durations include complete synchronous builder consumption; the all-face lookup runs before the first yield. Its isolated chunk duration was not measured.',baselineElapsedMs:fullBefore.elapsedSeconds*1000,candidateElapsedMs:fullAfter.elapsedSeconds*1000},
  sourcePatchSha256:sha(patch),inputs:Object.fromEntries(['surface-proof.json','streams-and-floor.json','screen-063772a4.json','screen-588d3681.json'].map(f=>[f,sha(fs.readFileSync(path.join(dir,f)))])),
  limitations:['CPU output-pixel-centre geometry estimates, not final rendered segmentation or native acceptance.','Original alpha cards, unrelated world meshes and other original wood are omitted; visible fine area is an upper bound before these occluders.','Exact source attribute packing is applied before wind evaluation; JavaScript floating point still does not reproduce GPU float arithmetic, antialiasing or postprocessing.','No current whole-world triangle headroom inferred; canonical grass and other lanes continue independently.','Source source-588d3681.patch preserves one rejected local candidate only; no import, push or PR authorization is implied.']};
fs.writeFileSync(path.join(dir,'distribution-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({verdict:receipt.verdict,geometry:receipt.geometry,views:Object.fromEntries(Object.entries(views).map(([v,r])=>[v,{fineBefore:r.before.finePercent,fineAfter:r.after.finePercent,largestBareBefore:r.before.largestBareComponents[0],largestBareAfter:r.after.largestBareComponents[0]}]))},null,2));
