/**
 * Turf carpet (round 39) CPU contracts: real placement, geometry and materials, no renderer.
 * Run: node --test src/world/vegetation/carpet.test.mjs
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
  },m,m.exports);return m.exports;
}
const read=name=>load(path.join(root,name+'.ts'));
const {WORLD}=read('config'),{LAYOUT,houseSteppingStones}=read('layout'),{VegField,newSample}=read('vegetation/field');
const {CLUMP_GRID,MAT_GRID,CLUMP_TILES,MAT_TILES,CLUMP_CHARACTERS}=read('vegetation/clump-atlas');
// round 40: six distinct tile characters (Astra's "repeated fans") — one per tile, no two alike, a slant each way
assert.equal(CLUMP_CHARACTERS.length,CLUMP_TILES,'one character per clump tile');
assert.equal(new Set(CLUMP_CHARACTERS.map(c=>JSON.stringify(c))).size,CLUMP_TILES,'no two clump tiles share a character');
assert.ok(CLUMP_CHARACTERS.some(c=>c.leanBias<-0.2)&&CLUMP_CHARACTERS.some(c=>c.leanBias>0.2),'a wind-swept tile each way');
assert.ok(Math.max(...CLUMP_CHARACTERS.map(c=>c.spread))/Math.min(...CLUMP_CHARACTERS.map(c=>c.spread))>=1.8,'spreads from upright to open');
assert.ok(Math.max(...CLUMP_CHARACTERS.map(c=>c.blades[0]))/Math.min(...CLUMP_CHARACTERS.map(c=>c.blades[0]))>=1.6,'blade counts from sparse to dense');
const {clumpCardGeometry,turfMatGeometry,CLUMP_CELL,MAT_CELL}=read('vegetation/carpet');
function make(){const ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5}};
  const group=new THREE.Group(),field=new VegField(ctx,WORLD.detailRadius+6,.5);return{ctx,group,field,carpet:read('vegetation/carpet').buildCarpet(ctx,field,group)};}
const a=make(),b=make();
const scaleX=it=>Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]),scaleY=it=>Math.hypot(it.matrix[4],it.matrix[5],it.matrix[6]);
const inBox=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
const s=newSample();

// the card geometries: three crossed planes × two rows (12 triangles) near, one row (6) far; the mat one quad
{const near=clumpCardGeometry(3,2,0.2),far=clumpCardGeometry(3,1,0.2),mat=turfMatGeometry();
  assert.equal(near.index.count/3,12);assert.equal(far.index.count/3,6);assert.equal(mat.index.count/3,2);
  for(const g of[near,far]){const p=g.attributes.position.array,uv=g.attributes.uv.array;let minY=1,maxY=0;
    for(let i=0;i<p.length;i+=3){minY=Math.min(minY,p[i+1]);maxY=Math.max(maxY,p[i+1]);assert.ok(Math.abs(p[i])<=0.5+0.25&&Math.abs(p[i+2])<=0.5+0.25,'a unit card stays inside its footprint');}
    assert.equal(minY,0,'roots at y 0');assert.ok(maxY>0.95&&maxY<=1,'tips at ≈ y 1 (the tilt shortens the rise)');
    for(let i=0;i<uv.length;i+=2)assert.ok(uv[i]>=0&&uv[i]<=1&&uv[i+1]>=0&&uv[i+1]<=1,'uv inside the tile');}
  assert.deepEqual([...a.carpet.clumps.opts.variants[0].map(g=>g.index.count/3)],[12,6],'clump LODs: 12 then 6 triangles');
  assert.equal(a.carpet.mats.opts.variants[0][0].index.count/3,2);
  assert.equal(a.carpet.clumps.lodCount,2);assert.equal(a.carpet.mats.lodCount,1);
  for(const g of[near,far,mat])g.dispose();}
// the atlas layout the shader decodes: six clump tiles two across, four mat tiles in the bottom row, blocks never overlapping
assert.equal(CLUMP_TILES,6);assert.equal(MAT_TILES,4);
assert.deepEqual([...CLUMP_GRID],[0.5,0.25,2,1]);assert.deepEqual([...MAT_GRID],[0.25,0.25,4,0.25]);
assert.ok(CLUMP_GRID[3]-CLUMP_GRID[1]*Math.ceil(CLUMP_TILES/CLUMP_GRID[2])>=MAT_GRID[3]-1e-9,'clump block ends where the mat block starts');
assert.equal(a.carpet.atlas.texture,null,'no DOM canvas under node: the atlas is skipped, the streams untouched');
// every card carries the blades' aData encoding: phase, stiffness, tint slot, atlas tile + dryness —
// a mat's first float is its continuous palette position instead (materials.ts blends the entries)
const {matPalettePosition}=read('vegetation/carpet');
assert.deepEqual([-1,-0.48,-0.28,-0.08,0.12,0.3,0.48,0.66,1].map(t=>Math.round(matPalettePosition(t)*1000)/1000),[0,0,0.5,1,1.526,2,2.5,3,3],'palette position: piecewise linear, the blades\' bin midpoints land near the half entries');
// round 46: the north corridor's fans are their own set (carpet.ts NORTH_CARPET) — a clump set in every check below
const isClumps=set=>set===a.carpet.clumps||set===a.carpet.northClumps;
for(const set of a.carpet.all){assert.deepEqual(set.opts.instanceData,{attribute:'aData',size:4});
  const tiles=isClumps(set)?CLUMP_TILES:MAT_TILES;
  for(const it of set.items){assert.equal(it.data.length,4);
    if(set===a.carpet.mats){assert.ok(it.data[0]>=0&&it.data[0]<=3&&it.data[1]===1,'mats: palette position 0..3, full stiffness');assert.equal(Math.floor(it.data[2]*4),0,'mats leave the integer palette index unused');}
    else assert.ok(it.data[0]>=0&&it.data[0]<1&&it.data[1]>=0.05&&it.data[1]<=1,'phase / stiffness in range');
    const slot=it.data[2]*4,idx=Math.floor(slot);assert.ok(idx>=0&&idx<=3,'palette index 0..3');assert.ok(slot-idx>=0&&slot-idx<=0.75+1e-6,'slot fraction is a shade lift or a bank darkening');
    const tile=Math.floor(it.data[3]+1e-3);assert.ok(tile>=0&&tile<tiles,`atlas tile ${tile} of ${tiles}`);
    // round 40: a clump's fraction is (dryness step 0..15 + mirror flag 0.25 / 0.75) / 16 (materials.ts CARD_COLOR_VERTEX); a mat keeps its continuous dryness ≤ 0.95
    if(isClumps(set)){const slot=(it.data[3]-tile)*16,step=Math.floor(slot),sub=slot-step;assert.ok(step>=0&&step<=15,`dryness step ${step}`);assert.ok(Math.abs(sub-0.25)<1e-4||Math.abs(sub-0.75)<1e-4,`mirror flag in the sub-step: ${sub.toFixed(4)}`);}
    else assert.ok(it.data[3]-tile<=0.95+1e-6,'dryness ≤ 0.95');}}
// round 40 (Astra's "repeated fans"): per-card variation without a stream draw — all six tiles in use, ≈ half the cards
// mirrored, the width / height jitter (0.8–1.25 × / 0.7–1.3 ×) shows as a spread of aspect ratios, and the instance
// colour carries a hue / lightness jitter (no card is plain white)
{const cl=a.carpet.clumps.items;const tilesUsed=new Set(cl.map(it=>Math.floor(it.data[3]+1e-3)));assert.equal(tilesUsed.size,CLUMP_TILES,`all ${CLUMP_TILES} clump tiles in use`);
  const mirrored=cl.filter(it=>{const slot=(it.data[3]-Math.floor(it.data[3]+1e-3))*16;return slot-Math.floor(slot)>0.5;}).length/cl.length;assert.ok(mirrored>0.42&&mirrored<0.58,`${(mirrored*100).toFixed(0)} % of the cards mirrored`);
  const aspects=cl.map(it=>scaleX(it)/scaleY(it)).sort((p,r)=>p-r);const qa=f=>aspects[Math.min(aspects.length-1,Math.floor(f*aspects.length))];
  assert.ok(qa(0.9)/qa(0.1)>=1.6,`card aspect spread p90 / p10 = ${(qa(0.9)/qa(0.1)).toFixed(2)} (≥ 1.6)`);
  let cool=0,warm=0,plain=0;for(const it of cl){const [r,g,b]=it.color;if(Math.abs(r-1)<1e-6&&Math.abs(g-1)<1e-6&&Math.abs(b-1)<1e-6)plain++;if(b>r)cool++;else warm++;assert.ok(r>0.8&&r<1.2&&g>0.85&&g<1.15&&b>0.8&&b<1.2,`card colour jitter in range: ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`);}
  assert.equal(plain,0,'no card is plain white');assert.ok(cool/cl.length>0.4&&warm/cl.length>0.4,`hue jitter both ways: ${(cool/cl.length*100).toFixed(0)} % cool, ${(warm/cl.length*100).toFixed(0)} % warm`);
  for(const it of a.carpet.mats.items)assert.deepEqual(it.color,[1,1,1],'mats stay white');}
// neighbouring mats never step hard in tone (the blades' drift at half strength, continuous): of every pair of
// mats within 0.8 m, the median differs by < 0.35 entries, the 99th percentile by < 0.75, the steepest (the
// giants' litter-floor offset meeting the tint mottle) by < 1.25
{const ms=a.carpet.mats.items.filter(it=>Math.hypot(it.x,it.z)<14);const steps=[];
  const g=new Map(),key=(x,z)=>`${Math.floor(x/0.8)},${Math.floor(z/0.8)}`;for(const it of ms){const k=key(it.x,it.z);(g.get(k)||g.set(k,[]).get(k)).push(it);}
  for(const p of ms){const cx=Math.floor(p.x/0.8),cz=Math.floor(p.z/0.8);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const arr=g.get(`${cx+dx},${cz+dz}`);if(!arr)continue;
    for(const r of arr){if(r===p||r.x<p.x||(r.x===p.x&&r.z<=p.z))continue;if(Math.hypot(p.x-r.x,p.z-r.z)>0.8)continue;steps.push(Math.abs(p.data[0]-r.data[0]));}}}
  steps.sort((p,r)=>p-r);const q=f=>steps[Math.min(steps.length-1,Math.floor(f*steps.length))];
  assert.ok(steps.length>=5000&&q(1)<1.25&&q(0.99)<0.75&&q(0.5)<0.35,`${steps.length} mat pairs within 0.8 m, median palette step ${q(0.5).toFixed(3)}, p99 ${q(0.99).toFixed(3)}, largest ${q(1).toFixed(3)}`);}
// determinism: a fresh seed and terrain reproduce every card
for(const k of['clumps','northClumps','mats']){const first=a.carpet[k],second=b.carpet[k];assert.equal(first.count,second.count,`${k} count`);
  for(let i=0;i<first.count;i++)assert.deepEqual(first.items[i],second.items[i],`${k} ${i} reproduced`);}
// counts and density: a closed carpet over the lawns (≈ 4 clumps / m², ≈ 4 mats / m²)
assert.ok(a.carpet.clumps.count>=12000&&a.carpet.clumps.count<=30000,`clumps: ${a.carpet.clumps.count}`);
// round 46: the north tiles' mats take NORTH_CARPET.matKeep and the falloff floor (≈ +500 two-triangle mats: was ≤ 28 000)
assert.ok(a.carpet.mats.count>=12000&&a.carpet.mats.count<=32000,`mats: ${a.carpet.mats.count}`);
// round 46: the north corridor's own fans — north of NORTH_CARPET.z only, running to 25 m, shorter, and the disc's set
// holds none north of the line; both sets seat inside the reach
{const {NORTH_CARPET}=read('vegetation/carpet');assert.ok(NORTH_CARPET.maxDistance>=25&&NORTH_CARPET.z<=-20&&NORTH_CARPET.keep>=0.85&&NORTH_CARPET.reachFloor>=0.75,'the north carpet runs to 25 m, dense');
  assert.deepEqual(a.carpet.northClumps.opts.lodDistances,a.carpet.clumps.opts.lodDistances);assert.equal(a.carpet.northClumps.opts.maxDistance,NORTH_CARPET.maxDistance);assert.strictEqual(a.carpet.northClumps.opts.variants,a.carpet.clumps.opts.variants,'the same cards');
  assert.ok(a.carpet.northClumps.count>=1500,`north clumps: ${a.carpet.northClumps.count}`);
  for(const it of a.carpet.northClumps.items)assert.ok(it.z<NORTH_CARPET.z,`north clump at z ${it.z}`);for(const it of a.carpet.clumps.items)assert.ok(it.z>=NORTH_CARPET.z-8,`disc clump at z ${it.z}`);
  // the hollow floor and the plain (survey-2 #06 boxes) carry a closed carpet: ≥ 2 fans / m² of allowed ground
  for(const [name,b] of [['hollow floor west',[-12,-45,-5,-34]],['north plain',[-5,-60,12,-50]]]){const w=(b[2]-b[0])*(b[3]-b[1]);let allowed=0;for(let x=b[0]+0.25;x<b[2];x+=0.5)for(let z=b[1]+0.25;z<b[3];z+=0.5){a.field.sample(x,z,s);if(a.field.allowed(x,z,s,true)&&!a.field.insideGiantTrunk(x,z))allowed+=0.25;}
    const n=a.carpet.northClumps.items.filter(it=>inBox(it,b)).length;assert.ok(n/Math.max(1,allowed)>=2,`${name}: ${(n/Math.max(1,allowed)).toFixed(2)} north fans / m² over ${allowed.toFixed(0)} m² allowed (${(100*allowed/w).toFixed(0)} % of the box)`);}}
assert.ok(CLUMP_CELL<=0.45&&MAT_CELL<=0.6);
const perM2=(set,b)=>set.items.filter(it=>inBox(it,b)).length/((b[2]-b[0])*(b[3]-b[1]));
// (the north verge lies in shot D's soil shoulder — frame 56 s' ragged earth edge — where the mats thin like the blades)
for(const [name,b,mats] of[['lawn band',[-3.1,-8.4,-1.9,-6.6],2],['north verge',[-2.2,-13.5,-1.6,-11.0],1],['grass close-up',[-5,5,-2,8],2],['terrace lawn',[6.3,-11,8.8,-8.4],2]]){
  assert.ok(perM2(a.carpet.clumps,b)>=3,`${name}: ${perM2(a.carpet.clumps,b).toFixed(2)} clumps / m²`);
  assert.ok(perM2(a.carpet.mats,b)>=mats,`${name}: ${perM2(a.carpet.mats,b).toFixed(2)} mats / m²`);}
// seating: on allowed turf, off the giant trunks, roots sunk ≤ 3 cm (clumps) / lifted 1.8 cm (mats), tilt to the normal
for(const set of a.carpet.all)for(const it of set.items){
  a.field.sample(it.x,it.z,s);assert.ok(a.field.allowed(it.x,it.z,s,true),`${set.opts.name} root on turf at (${it.x},${it.z})`);
  assert.ok(!a.field.insideGiantTrunk(it.x,it.z));
  const gap=a.ctx.terrain.height(it.x,it.z)-it.y;
  if(isClumps(set))assert.ok(gap>=-1e-4&&gap<=0.0301,`clump sunk ${gap.toFixed(4)} m`);else assert.ok(Math.abs(gap+0.018)<1e-4,`mat lifted ${(-gap).toFixed(4)} m`);
  const clr=a.field.clearing(it.x,it.z);assert.ok(!clr.insideBoulder,'no card inside a boulder');}
// heights: the reference's 0.15–0.35 m tufts, never over camera C's 0.35 m stair-foot rule
const hs=a.carpet.clumps.items.map(scaleY);const q=(arr,f)=>{const t=[...arr].sort((p,r)=>p-r);return t[Math.min(t.length-1,Math.floor(f*t.length))];};
assert.ok(q(hs,1)<=0.3201,`tallest clump ${q(hs,1).toFixed(3)} m`);assert.ok(q(hs,0.5)>=0.18&&q(hs,0.5)<=0.3,`median clump ${q(hs,0.5).toFixed(3)} m`);
// the paved rims keep a band of real blades: no card root within its clear band, no card over the slabs
for(const it of a.carpet.clumps.items){const e=a.field.lawnEdgeDistance(it.x,it.z,true);assert.ok(e>=0.14,`clump ${e.toFixed(2)} m from the paving`);assert.ok(scaleX(it)*0.5<=e+0.01,'card inside the lawn');}
for(const it of a.carpet.mats.items){const e=a.field.lawnEdgeDistance(it.x,it.z,true);assert.ok(e>=0.1);assert.ok(scaleX(it)*0.5<=e+0.01,'mat inside the lawn');}
// the walk corridor (frames 14 / 24: the trodden strip and the stones' 0.5 m carry nothing over the herb layer)
const stones=houseSteppingStones(),stoneDist=(x,z)=>Math.min(...stones.map(st=>Math.hypot(x-st.x,z-st.z)-st.r));
for(const it of a.carpet.clumps.items){const h=scaleY(it);
  if(stoneDist(it.x,it.z)<0.5)assert.ok(h<=0.25,`clump ${h.toFixed(2)} m within 0.5 m of a stepping stone`);
  if(a.field.troddenZone(it.x,it.z,true)>0.6)assert.ok(h<=0.25,`clump ${h.toFixed(2)} m in the trodden strip`);
  assert.ok(stoneDist(it.x,it.z)>=0.22,'no clump on a stepping stone');}
for(const it of a.carpet.mats.items)assert.ok(stoneDist(it.x,it.z)>=0.12&&scaleX(it)*0.5<=stoneDist(it.x,it.z)+0.05,'mats stop at the stones');
// NPC spots: nothing over 0.3 m within 0.6 m
for(const spot of LAYOUT.npcSpots)for(const it of a.carpet.clumps.items)if(Math.hypot(it.x-spot.position[0],it.z-spot.position[2])<0.6)assert.ok(scaleY(it)<=0.3,`clump at NPC spot ${spot.id}`);
// shot D's right verge (plants.test: ≤ 0.55 m) and the house flight's south flank (≤ 0.12 m + the lawn's feather)
for(const it of a.carpet.clumps.items){if(inBox(it,[1.5,-16,7,-4]))assert.ok(scaleY(it)<=0.55);
  const hl=a.field.houseFlightLocal(it.x,it.z);if(hl&&hl.v>0&&a.field.houseFlankZone(it.x,it.z)>0.99)assert.ok(scaleY(it)<=0.1201,`south flank clump ${scaleY(it).toFixed(3)} m`);}
// v9 / v13: the frames' bank masses and camera C's trodden foot are not tufted turf — the fans thin to ≤ 40 % of
// the lawn's density in the bank cores and ≤ 30 % in the foot core, and no mat seats in either core (v13: a
// metre-wide lit plane there is a single bright decal on frames 14 / 24 / 46 s' dark ground; the blades' dusty
// fringe and the soil do those cells); a mat never takes the shade lift (slot fraction 0.25 exactly where it is
// not bank-darkened) — it faces the sky the lifted blades under-collect
{const {C_FOOT}=read('vegetation/field');const lawn=[-3.1,-8.4,-1.9,-6.6];
  const core=(set,pick)=>{const n=set.items.filter(pick).length;return n;};
  const footPick=it=>a.field.cFoot(it.x,it.z)>0.95&&a.field.lawnEdgeDistance(it.x,it.z,true)>0.5;
  const bankPick=it=>a.field.bankDark(it.x,it.z)>0.9&&a.field.lawnEdgeDistance(it.x,it.z,true)>0.5;
  // offered cells in each core: count the jittered-grid cells whose centre passes the same pick (turf allowed)
  const cells=(pick,cell)=>{let n=0;for(let z=-30;z<30;z+=cell)for(let x=-30;x<30;x+=cell){a.field.sample(x,z,s);if(!a.field.allowed(x,z,s,true))continue;if(pick({x,z}))n++;}return n;};
  const footCells=cells(footPick,CLUMP_CELL),bankCells=cells(bankPick,CLUMP_CELL);
  assert.ok(footCells>20&&bankCells>20,`foot ${footCells} / bank ${bankCells} cells sampled`);
  const lawnClumps=perM2(a.carpet.clumps,lawn)*CLUMP_CELL*CLUMP_CELL,lawnMats=perM2(a.carpet.mats,lawn)*MAT_CELL*MAT_CELL;
  const footClumps=core(a.carpet.clumps,footPick)/footCells,bankClumps=core(a.carpet.clumps,bankPick)/bankCells;
  assert.ok(footClumps<=0.3*lawnClumps,`foot clumps ${footClumps.toFixed(2)} / cell vs lawn ${lawnClumps.toFixed(2)}`);
  assert.ok(bankClumps<=0.4*lawnClumps,`bank clumps ${bankClumps.toFixed(2)} / cell vs lawn ${lawnClumps.toFixed(2)}`);
  assert.ok(lawnMats>0.5,`lawn mats ${lawnMats.toFixed(2)} / cell`);
  for(const it of a.carpet.mats.items){assert.ok(a.field.cFoot(it.x,it.z)<1,`mat in the C-foot core at ${it.x.toFixed(1)},${it.z.toFixed(1)}`);assert.ok(a.field.bankDark(it.x,it.z)<1,`mat in the bank core at ${it.x.toFixed(1)},${it.z.toFixed(1)}`);}
  // the feathers still thin: within the half-zones the mats run under half the lawn's density
  const footHalf=it=>a.field.cFoot(it.x,it.z)>0.5&&a.field.lawnEdgeDistance(it.x,it.z,true)>0.5,bankHalf=it=>a.field.bankDark(it.x,it.z)>0.5&&a.field.lawnEdgeDistance(it.x,it.z,true)>0.5;
  const footMats=core(a.carpet.mats,footHalf)/cells(footHalf,MAT_CELL),bankMatsD=core(a.carpet.mats,bankHalf)/cells(bankHalf,MAT_CELL);
  assert.ok(footMats<=0.5*lawnMats&&bankMatsD<=0.5*lawnMats,`foot ${footMats.toFixed(2)} / bank ${bankMatsD.toFixed(2)} mats per cell over the half-zones vs lawn ${lawnMats.toFixed(2)}`);
  // v10: the shade embankment keeps its mats (closed) but half its fans (frame 8's right bank is a blur)
  const shadePick=it=>a.field.shadeZone(it.x,it.z)>0.9&&a.field.lawnEdgeDistance(it.x,it.z,true)>0.5;
  const shadeClumps=core(a.carpet.clumps,shadePick)/cells(shadePick,CLUMP_CELL),shadeMats=core(a.carpet.mats,shadePick)/cells(shadePick,MAT_CELL);
  assert.ok(shadeClumps>=0.35*lawnClumps&&shadeClumps<=0.65*lawnClumps,`shade clumps ${shadeClumps.toFixed(2)} / cell vs lawn ${lawnClumps.toFixed(2)}`);
  assert.ok(shadeMats>=0.85*lawnMats,`shade mats ${shadeMats.toFixed(2)} / cell vs lawn ${lawnMats.toFixed(2)}: the bank stays closed`);
  assert.ok(inBox({x:(C_FOOT[0]+C_FOOT[2])/2,z:(C_FOOT[1]+C_FOOT[3])/2},C_FOOT));
  let shaded=0;for(const it of a.carpet.mats.items){if(a.field.bankDark(it.x,it.z)>0.01)continue;assert.ok(Math.abs(it.data[2]*4-0.25)<1e-6,`mat slot fraction ${(it.data[2]*4).toFixed(3)}: no shade lift`);if(a.field.shadeZone(it.x,it.z)>0.9)shaded++;}
  assert.ok(shaded>=100,`${shaded} mats in the shade zone core`);}
// steep faces: no clump where the slope exceeds the thin band's end (≈ 70°); the mats, which lie on the face, hold
// to the cliffs (0.5–0.75 ≈ 60–75°) so the stair flanks' blade turf sits on turf, and shrink across the band
for(const it of a.carpet.clumps.items){a.field.sample(it.x,it.z,s);assert.ok(s.slope<0.7,`clump on a ${s.slope.toFixed(2)} slope`);}
{let steep=0,flat=0,steepW=0,flatW=0;for(const it of a.carpet.mats.items){a.field.sample(it.x,it.z,s);assert.ok(s.slope<0.75,`mat on a ${s.slope.toFixed(2)} slope`);
    const w=scaleX(it);if(s.slope>0.5){steep++;steepW+=w;}else if(s.slope<0.2){flat++;flatW+=w;}}
  assert.ok(steep>=30&&steep<=400,`${steep} mats on the 0.5–0.75 slopes (the fade band)`);
  assert.ok(steepW/steep<0.9*(flatW/flat),`steep mats ${(steepW/steep).toFixed(2)} m wide vs flat ${(flatW/flat).toFixed(2)} m`);}
// the sets: no shadow casting (the blade tiles never cast), receive on, one draw per LOD, culled per instance
for(const set of a.carpet.all){set.update(new THREE.Vector3(0,1.5,0),true);
  for(const m of set.group.children){assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,true);assert.ok(m.geometry.attributes.aData.isInstancedBufferAttribute,'aData rides the pack mesh');}
  assert.equal(set.group.children.length,set.lodCount,'one draw per LOD');
  // v11: the fans end at 16 m with the blade tiles' last LOD (the mats alone carry the far turf); a mat is never left out
  const eye=new THREE.Vector3(0,1.5,0),inRange=set.items.filter(it=>set.opts.maxDistance===undefined||Math.hypot(it.x-eye.x,it.z-eye.z)<set.opts.maxDistance).length;
  // round 46: the north corridor's fans run to 25 m (NORTH_CARPET) — from the plaza's eye only the line's first metre is in range
  if(set===a.carpet.clumps){assert.equal(set.opts.maxDistance,16);assert.ok(inRange<set.count*0.5&&inRange>1500,`${inRange} of ${set.count} fans inside 16 m`);}
  else if(set===a.carpet.northClumps){assert.equal(set.opts.maxDistance,25);assert.ok(inRange<set.count*0.02,`${inRange} of ${set.count} north fans inside 25 m of the plaza`);}
  else assert.equal(set.opts.maxDistance,undefined);
  assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),inRange,'every card in range bucketed');
  const cam=new THREE.PerspectiveCamera(50,16/9,0.1,200);cam.position.set(0,1.5,0);cam.lookAt(0,1,-10);cam.updateMatrixWorld();
  set.cull(cam,new THREE.Vector3(0.5,0.6,0.5).normalize(),true);
  const submitted=set.group.children.reduce((n,m)=>n+m.count,0);assert.ok(submitted<set.count*0.6,`${set.opts.name}: ${submitted} of ${set.count} submitted to a 50° frame`);
  // the data attribute follows the submission
  for(const m of set.group.children){const d=m.geometry.attributes.aData.array;for(let k=0;k<m.count;k++){const tile=Math.floor(d[k*4+3]+1e-3);assert.ok(tile>=0&&tile<(isClumps(set)?CLUMP_TILES:MAT_TILES));}}}
// the materials: the card kind, alpha-tested, the clumps double sided with wind, the mats single sided and static
const [clumpMat,matMat]=a.carpet.materials;
assert.equal(clumpMat.name,'veg-grass-clumps');assert.equal(matMat.name,'veg-turf-mats');
assert.equal(clumpMat.alphaTest,0.5);assert.equal(matMat.alphaTest,0.5);assert.equal(clumpMat.side,THREE.DoubleSide);assert.equal(matMat.side,THREE.FrontSide);
{const base=THREE.ShaderLib.standard;
  for(const[mat,mode]of[[clumpMat,0],[matMat,1]]){const sh={uniforms:THREE.UniformsUtils.clone(base.uniforms),vertexShader:base.vertexShader,fragmentShader:base.fragmentShader};mat.onBeforeCompile(sh,{});
    assert.equal(sh.uniforms.uCardMode.value,mode);assert.deepEqual(sh.uniforms.uTileGrid.value.toArray(),[...(mode?MAT_GRID:CLUMP_GRID)]);
    assert.match(sh.vertexShader,/attribute vec4 aData;/);assert.match(sh.vertexShader,/windGrass\(vegWorld\.xyz, uv\.y, aData\.x, aData\.y\)/,'the blades\' wind layer');
    assert.match(sh.vertexShader,/uniform float uTime;/);assert.match(sh.fragmentShader,/texture2D\(uAtlas, vAtlasUv\)/);
    // the card normal: the facing flips on the back planes, the up part never does (three's whole-normal flip is replaced)
    assert.doesNotMatch(sh.fragmentShader,/#include <normal_fragment_begin>/);assert.match(sh.fragmentShader,/normalize\(vCardFace\) \* faceDirection, normalize\(vCardUp\), uUpMix/,'facing-only flip');
    assert.equal(sh.uniforms.uUpMix.value,mode?1:0.55,'the blades\' 0.55 terrain-up blend on the clumps, ground-flat mats');
    assert.match(sh.fragmentShader,/#include <alphatest_fragment>/);assert.match(sh.fragmentShader,/uTransmission \* vegAtlasT/,'translucency from the atlas');
    assert.match(sh.fragmentShader,/uShadeFill \* vShadeLift/,'the blades\' shade fill');
    for(const[,chunk]of sh.vertexShader.matchAll(/#include <([\w_]+)>/g))assert.ok(THREE.ShaderChunk[chunk]!==undefined,`known chunk ${chunk}`);
    for(const[,chunk]of sh.fragmentShader.matchAll(/#include <([\w_]+)>/g))assert.ok(THREE.ShaderChunk[chunk]!==undefined,`known chunk ${chunk}`);}}
assert.throws(()=>read('vegetation/materials').createVegMaterial(a.ctx,'card'),/card options/);
for(const fixture of[a,b]){for(const set of fixture.carpet.all){set.dispose();for(const v of set.opts.variants)for(const g of v)g.dispose();}for(const m of fixture.carpet.materials)m.dispose();}
console.log(JSON.stringify({passed:true,clumps:a.carpet.clumps.count,mats:a.carpet.mats.count,clumpsPerM2LawnBand:Math.round(perM2(a.carpet.clumps,[-3.1,-8.4,-1.9,-6.6])*100)/100,note:'CPU placement / geometry / shader-text contracts only; the carpet\'s look is judged on captures.'}));
