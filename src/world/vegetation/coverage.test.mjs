/**
 * Round 47 — the turf coverage contract (the owner's review of 2026-09-19, item 12: "patches in
 * the grass where it's not full"). CPU only: the real field, blade tiles and carpet, then
 * coverage.ts' audit on its 0.25 m grid. Baseline at bb8fdf5 (take-0116): 3.21 % of the lawn's
 * cells uncovered (3 761 of 117 308; the open lawn 3.4 %, the north corridor 3.3 %, the far
 * south lawns' tiles 9–15 %, the corridor's last tiles 86 %).
 */
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
  },m,m.exports);return m.exports;}
const read=name=>load(path.join(root,name+'.ts'));
const {WORLD}=read('config'),{LAYOUT}=read('layout'),{VegField}=read('vegetation/field');
const cov=read('vegetation/coverage');
const ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5},progress(){},audit(){}};
const field=new VegField(ctx,WORLD.detailRadius+6,0.5),group=new THREE.Group();
const grass=await read('vegetation/grass').buildGrass(ctx,field,read('vegetation/materials').createVegMaterial(ctx,'grass',{name:'veg-grass'}),group,()=>{});
const carpet=read('vegetation/carpet').buildCarpet(ctx,field,group);

// the audit grid is the fill passes' grid (grass.ts INFILL_*, carpet.ts' closing sweep both read COVERAGE_CELL)
assert.equal(cov.COVERAGE_CELL,0.25,'the audit samples the lawn on a 0.25 m grid');
assert.ok(cov.BLADE_MIN>=2&&cov.BLADE_REACH>=0.15&&cov.MAT_FOOT>0.3&&cov.MAT_FOOT<0.5&&cov.CLUMP_FOOT>0.3&&cov.CLUMP_FOOT<0.5,'footprint constants in their measured ranges');

// the whole detail disc and the corridor: < 1 % of the lawn cells uncovered (the owner's acceptance), the open lawn itself < 0.2 %
const R=WORLD.detailRadius;
const rep=cov.auditCoverage(field,grass.tiles,[carpet.clumps,carpet.northClumps],carpet.mats,R);
assert.ok(rep.cells>=100000,`lawn cells sampled: ${rep.cells}`);
assert.ok(rep.share<0.01,`uncovered lawn cells ${(rep.share*100).toFixed(2)} % (${rep.uncovered} of ${rep.cells}) — the owner's "no bare patches" is < 1 %`);
assert.ok(rep.byZone.lawn.share<0.002,`open lawn uncovered ${(rep.byZone.lawn.share*100).toFixed(2)} %`);
assert.ok(rep.byZone.north.share<0.02,`north corridor floor uncovered ${(rep.byZone.north.share*100).toFixed(2)} %`);
assert.ok(rep.byZone.hollow.share<0.01,`D's hollow uncovered ${(rep.byZone.hollow.share*100).toFixed(2)} %`);
// the walk (art/environment/survey2: every pose stands inside reach 30) is closed tighter still
const walk=cov.auditCoverage(field,grass.tiles,[carpet.clumps,carpet.northClumps],carpet.mats,30);
assert.ok(walk.share<0.005,`uncovered lawn inside the walk's reach ${(walk.share*100).toFixed(2)} %`);
// no 8 m tile of the walk holds more than 40 uncovered cells (2.5 m² of bare lawn)
for(const [cx,cz,cells,unc] of walk.worstTiles)assert.ok(unc<=40,`tile ${cx},${cz}: ${unc} of ${cells} cells uncovered`);
// the frames' bare-by-design grounds keep their earth: camera C's foot, D's shoulders and the trodden strip's dirt are NOT filled
// to zero (their cuts are the frames'), while the report still lists them
assert.ok(rep.byZone.shoulder.cells>0&&rep.byZone.foot.cells>0,'the report splits the fixed grounds out');
// the fill passes themselves: the carpet's closing sweep seated mats, the blade tiles' infill left no open-lawn cell inside the
// walk with fewer than BLADE_MIN roots and no mat
assert.ok(carpet.infillMats>=3000,`infill mats: ${carpet.infillMats}`);
// the audit is deterministic (a second field / build reproduces it exactly)
{const f2=new VegField(ctx,WORLD.detailRadius+6,0.5),g2=new THREE.Group();
  const gr2=await read('vegetation/grass').buildGrass({...ctx,rng:read('util/prng').createRng(WORLD.seed)},f2,read('vegetation/materials').createVegMaterial(ctx,'grass',{name:'veg-grass'}),g2,()=>{});
  const c2=read('vegetation/carpet').buildCarpet({...ctx,rng:read('util/prng').createRng(WORLD.seed)},f2,g2);
  const rep2=cov.auditCoverage(f2,gr2.tiles,[c2.clumps,c2.northClumps],c2.mats,R);
  assert.equal(rep2.uncovered,rep.uncovered,'the audit reproduces');assert.equal(gr2.count,grass.count);assert.equal(c2.mats.count,carpet.mats.count);}
console.log(JSON.stringify({passed:true,cells:rep.cells,uncovered:rep.uncovered,sharePct:Math.round(rep.share*10000)/100,walkSharePct:Math.round(walk.share*10000)/100,byZone:Object.fromEntries(Object.entries(rep.byZone).map(([k,v])=>[k,Math.round(v.share*10000)/100])),blades:grass.count,mats:carpet.mats.count,infillMats:carpet.infillMats,seedStalks:grass.typeCounts[3]}));
