/** Plant-only CPU integration: real placement, geometry and materials; no renderer. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
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
const {WORLD}=read('config'),{LAYOUT}=read('layout'),{VegField,newSample}=read('vegetation/field');
// round 51 (vegetation-28, item 3): the fixture reads the LEGACY terrain view — the one src/world/index.ts hands the
// vegetation system (SYSTEMS: `terrain: 'legacy'`, expansion-2) — not `createTerrain()`'s live default. Under the live
// view the expansion's stepping discs and the bank add paved rims the field reads off the mask, so the disc-wide
// rim-cluster sampler (plants.ts 'weeds-rim-clusters', a 44-cluster budget over one stream) accepted centres along the
// west path and its consumption shifted: that, not 52be8f2d's layout, was the "re-roll" the round-49 re-bases measured.
// The rendered world never changed (frames C / F byte-identical at the merge); the fixture now measures it.
const vegetationTerrain=()=>read('terrain/heightfield').getLegacyTerrain();
function make(shared={}){const ctx={config:WORLD,layout:LAYOUT,terrain:vegetationTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5},shared};
  const group=new THREE.Group(),field=new VegField(ctx,WORLD.detailRadius+6,.5);return{ctx,group,field,plants:read('vegetation/plants').buildPlants(ctx,field,group)};
}
// round 48 (vegetation-26): the passes north of the log arch's north lip (field.ts NORTH_ZONE_Z) seat on ground the field
// grid's coarse `allowed` cannot answer — the far floor runs past the grid, the moss at the standing stones' feet stands
// on the clearing's paving by design — so their roots are held to the exact terrain mask instead
const {STONE_CIRCLE_STONES}=read('terrain/heightfield');
const NORTH_GATE_Z=-59;
const stoneDistance=(x,z)=>Math.min(...STONE_CIRCLE_STONES.map(st=>Math.hypot(x-st.x,z-st.z)));
const a=make(),b=make();
const hash=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
// round 50 (vegetation-27, W06 / W05): two edges.ts passes seat on the paving's gravel verge, where the field's `allowed`
// is false by design — the rim band's lip tufts and moss cushions (inside the band over a paved rim, edges.ts rimCells),
// and the C bank's foot moss (its foot IS the plaza's verge; ≥ 4 cm off the slabs, inside a C_TERRACES box). Never on
// the slabs themselves (lawnEdgeDistance ≥ RIM_INNER), never in a trunk or a prop footprint (checked below like every root).
const edges=read('vegetation/edges');
const onVergeByDesign=(set,x,z)=>{
  if(set!==a.plants.tufts&&set!==a.plants.moss)return false;
  const d=a.field.lawnEdgeDistance(x,z,true);
  if(edges.inRimRegion(x,z)&&d>=edges.RIM_INNER-1e-6&&d<=edges.RIM_BAND+1e-6)return true;
  return set===a.plants.moss&&d>=0.04&&edges.C_TERRACES.some(f=>x>=f.box[0]&&x<=f.box[2]&&z>=f.box[1]&&z<=f.box[3]);
};
let checkedVertices=0,checkedBases=0,shadowMeshes=0,vergeSeats=0;
for(let j=0;j<a.plants.all.length;j++){
  const first=a.plants.all[j],second=b.plants.all[j];assert.equal(first.count,second.count);
  assert.ok(first.count>0,`${first.opts.name} must be present`);
  for(let i=0;i<first.count;i++){
    const item=first.items[i];assert.deepEqual(item,second.items[i],'Fresh seed/terrain reproduces transforms, variant and pigment');
    const sample=a.field.sample(item.x,item.z,newSample());
    if(item.z>=NORTH_GATE_Z){
      if(!a.field.allowed(item.x,item.z,sample)){assert.ok(onVergeByDesign(first,item.x,item.z),`Placed root obeys original field exclusions (${first.opts.name} at ${item.x}, ${item.z})`);vergeSeats++;}
    }
    else{const m=a.ctx.terrain.mask(item.x,item.z);
      if(first===a.plants.moss&&stoneDistance(item.x,item.z)<0.7)assert.ok(m.structure<0.5&&stoneDistance(item.x,item.z)>=0.3,`stone-foot moss off the stone's footprint (${first.opts.name})`);
      else assert.ok(a.ctx.terrain.vegetationAllowed(item.x,item.z),`round-48 north root obeys the exact terrain mask (${first.opts.name} at ${item.x}, ${item.z})`);}
    assert.ok(!a.field.insideGiantTrunk(item.x,item.z),'No root inside giant trunk');
    const gap=a.ctx.terrain.height(item.x,item.z)-item.y;
    assert.ok(gap>=-.004&&gap<.061,`Root contact gap ${gap} for ${first.opts.name}`);checkedBases++;
  }
  for(let v=0;v<first.opts.variants.length;v++)for(let l=0;l<first.opts.variants[v].length;l++){
    const g=first.opts.variants[v][l],other=second.opts.variants[v][l];
    for(const key of['position','normal','color']){
      const data=g.attributes[key].array;assert.ok(data.every(Number.isFinite),`${key} is finite`);assert.equal(hash(data),hash(other.attributes[key].array));
    }
    checkedVertices+=g.attributes.position.count;
    if(l>0)assert.ok(g.index.count<=first.opts.variants[v][l-1].index.count,'LOD reduces triangle count');
  }
  for(const mesh of first.group.children)if(mesh.castShadow){
    assert.ok(mesh.customDepthMaterial?.isMeshDepthMaterial);assert.ok(mesh.customDistanceMaterial?.isMeshDistanceMaterial);shadowMeshes++;
  }
}
assert.ok(a.plants.bushes.count>=80,'W19: at least 80 bushes');
// round 44 (survey-1 #7): the three bush variants and their mirror images interleaved — variant 2k + 1 is 2k flipped in x
// (its bounds swap sides, the same triangles), the originals and the mirrors in separate packs past the ultra ring, and
// a third to two thirds of the placed bushes flipped
{const V=a.plants.bushes.opts.variants;assert.equal(V.length,6,'three variants and their mirrors');
  for(let k=0;k<3;k++)for(let l=0;l<V[0].length;l++){const g=V[2*k][l],m=V[2*k+1][l];assert.equal(g.index.count,m.index.count);
    assert.ok(Math.abs(g.boundingBox.max.x+m.boundingBox.min.x)<1e-6&&Math.abs(g.boundingBox.min.x+m.boundingBox.max.x)<1e-6&&Math.abs(g.boundingBox.max.y-m.boundingBox.max.y)<1e-6,`bush ${k} lod ${l}: the mirror's bounds swap sides`);
    const gp=g.attributes.position.array,mp=m.attributes.position.array;assert.ok(Math.abs(gp[0]+mp[0])<1e-9&&Math.abs(gp[1]-mp[1])<1e-9&&Math.abs(gp[2]-mp[2])<1e-9,'x negated, y / z kept');
    const gi=g.index.array,mi=m.index.array;assert.ok(gi[0]===mi[0]&&gi[1]===mi[2]&&gi[2]===mi[1],'winding reversed');}
  assert.deepEqual(a.plants.bushes.packLayout,[[[0],[1],[2],[3],[4],[5]],[[0,2,4],[1,3,5]],[[0,2,4],[1,3,5]],[[0,2,4],[1,3,5]]]);
  const flipped=a.plants.bushes.items.filter(it=>it.variant%2===1).length;assert.ok(flipped>=a.plants.bushes.count/3&&flipped<=a.plants.bushes.count*2/3,`${flipped} of ${a.plants.bushes.count} bushes mirrored`);}
assert.ok(a.plants.bushes.items.filter(it=>it.x>-7.5&&it.x<-2&&it.z>-23&&it.z<-14).length>=4,'Shrub mass on the boulder bank west of the north path (shot D left-centre)');
// reference-driven composition constraints (see plants.ts / field.ts zones)
// round 43: a set's leading `nearLods` refine the geometry inside arm's reach of the live camera; the
// contracts measure a plant from the first LOD after them — what every fixed camera sees
const layoutLod=set=>set.opts.nearLods??0;
const top=(set,it)=>{const g=set.opts.variants[it.variant][layoutLod(set)];return it.y+g.boundingBox.max.y*Math.hypot(it.matrix[4],it.matrix[5],it.matrix[6]);};
// the hedge set holds three scatters: the door-side row of shot A/B (z <= -5.1), since round 12
// the crest of the south bank behind the shot-A kid (box (6.0, 3.9)-(8.6, 5.6), crowns up to ~2.4 m
// with the bank's 1.15 m crest) and, since round 32, a low clipped tier on the plateau shelf right
// of the main flight (box (8.7, 3.8)-(13.6, 7.4), crowns <= 0.9 m: frames 8 / 46's dark bank mass)
// - only the door-side row is bound by Saria's threshold. Round 38 adds two low tiers at the
// trunk base beside the door path (box (8.2, −11.2)-(10.9, −6.9), crowns ≤ 0.9 m): they stand at
// the doorway's dark posts, never over frame 14 s' lit threshold (B 0.71–0.80 × 0.35–0.56).
const doorTierBox=[8.2,-11.2,10.9,-6.9],inBox0=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
const doorTier=a.plants.hedge.items.filter(it=>inBox0(it,doorTierBox));
const doorHedge=a.plants.hedge.items.filter(it=>it.z<=-3&&!inBox0(it,doorTierBox)),bankHedge=a.plants.hedge.items.filter(it=>it.z>-3&&it.x<8.65),shelfHedge=a.plants.hedge.items.filter(it=>it.z>-3&&it.x>=8.65);
assert.ok(doorHedge.length>=3,'Hedge row present for shot A');
for(const it of doorHedge){
  assert.ok(top(a.plants.hedge,it)<=1.3,`Hedge crown top ${top(a.plants.hedge,it)} stays below Saria's door threshold as seen from camera B (≤ 1.3 m above plaza level)`);
  assert.ok(it.z<=-5.1,'Hedge stays out of camera C\'s left edge');
}
assert.ok(bankHedge.length>=2,'Bank hedge present behind the shot-A kid');
for(const it of bankHedge){
  assert.ok(it.x>=6.0&&it.x<=8.6&&it.z>=3.9&&it.z<=5.6,`Bank hedge stays in its box (${it.x.toFixed(2)}, ${it.z.toFixed(2)})`);
  assert.ok(top(a.plants.hedge,it)<=2.7,`Bank hedge crown top ${top(a.plants.hedge,it)} stays below 2.7 m (reference A hedge top y ≈ 0.30)`);
}
assert.ok(shelfHedge.length>=6,`Shelf hedge tier present right of the main flight (frames 8 / 46's dark bank mass): ${shelfHedge.length}`);
for(const it of shelfHedge){
  assert.ok(it.x>=8.7&&it.x<=13.6&&it.z>=3.8&&it.z<=7.4,`Shelf hedge stays in its box (${it.x.toFixed(2)}, ${it.z.toFixed(2)})`);
  assert.ok(top(a.plants.hedge,it)-it.y<=0.95,`Shelf hedge crown ${(top(a.plants.hedge,it)-it.y).toFixed(2)} m stays a low tier (≤ 0.95 m)`);
}
const inBox=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
// pinhole projection of the layout cameras (vertical fov, 16:9, +Y up) — the gauntlet's maths
const camera=id=>{const v=LAYOUT.viewpoints.find(v=>v.id===id),p=v.position,f=[v.target[0]-p[0],v.target[1]-p[1],v.target[2]-p[2]],fl=Math.hypot(...f),fw=f.map(c=>c/fl);
  let r=[-fw[2],0,fw[0]];const rl=Math.hypot(...r);r=r.map(c=>c/rl);const u=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];const th=Math.tan(v.fov*Math.PI/360),aspect=16/9;
  return w=>{const d=[w[0]-p[0],w[1]-p[1],w[2]-p[2]],z=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];if(z<=0.05)return null;
    return{sx:0.5+0.5*((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/z)/(th*aspect),sy:0.5-0.5*((d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z)/th,depth:z,perM:0.5/(z*th*aspect)};};};
const reach=(set,it)=>{const b=set.opts.variants[it.variant][layoutLod(set)].boundingBox;return Math.max(-b.min.x,b.max.x,-b.min.z,b.max.z)*Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]);};
const camC=camera('C_lookback'),camB=camera('B_house');
// Frame 46: camera C's left third (0–0.3 × 0.5–0.9) shows the stair foot (≈ 8 m) and its mossy
// rock (near face ≈ 12 m) over short grass. Up to the rock nothing taller than 0.35 m may project
// into that box, fronds included — the camera stands in the grass, so this covers plants 1 m
// away as well.
const dRight=[1.5,-16,7,-4];
for(const set of a.plants.all)for(const it of set.items){
  const h=top(set,it)-it.y,root=camC([it.x,it.y,it.z]);
  if(root&&root.depth<12&&h>0.35){
    const tip=camC([it.x,top(set,it),it.z])??root,halfW=reach(set,it)*root.perM;
    const inX=root.sx+halfW>=-0.02&&root.sx-halfW<=0.32,inY=Math.max(root.sy,tip.sy)>=0.48&&Math.min(root.sy,tip.sy)<=0.92;
    assert.ok(!(inX&&inY),`${set.opts.name} ${h.toFixed(2)} m tall at (${it.x.toFixed(2)},${it.z.toFixed(2)}) projects into camera C's stair-foot box at (${root.sx.toFixed(2)},${root.sy.toFixed(2)}) ${root.depth.toFixed(1)} m`);
  }
  if(inBox(it,dRight))assert.ok(h<=0.55,`${set.opts.name} taller than 0.55 m on shot D's right verge`);
}
// Frame 14: fern clumps and a purple clump at camera B's right edge (reference 0.90–1.0 × 0.55–0.75
// and (0.95, 0.60)), on the stair-flank bank just off camera C's left edge.
const atBEdge=(set,x0,y0,y1)=>set.items.filter(it=>{const p=camB([it.x,top(set,it),it.z]);return p&&p.depth<13&&p.sx>=x0&&p.sx<=1&&p.sy>=y0&&p.sy<=y1;});
assert.ok(atBEdge(a.plants.ferns,0.84,0.35,0.8).length>=5,'Fern clumps at shot B\'s right edge');
assert.ok(atBEdge(a.plants.flowers,0.88,0.35,0.7).length>=4,'Purple clump at shot B\'s right edge');
assert.ok(a.plants.ferns.items.filter(it=>Math.hypot(it.x+3.2,it.z+10.2)<2.3).length>=3,'Fern cluster beside the shot-D boulder');
// Frame 56: the big lit fern clump sits LEFT of the mossy rock (reference 0.05–0.14 × 0.55–0.68),
// 0.7–1.0 m tall, with pale-yellow blooms at its feet; the near west verge (D's bottom-left
// corner) shows grass and litter, not a lavender bed.
const camD=camera('D_log');
// 2026-09-21 (fable-2's W23 move, take-0128): the shot-D boulder and its mound stand at the frame's spot (−2.0, −7.6);
// the hero clump is authored at plants.ts HERO_CLUMP_SPOTS around (−4.4, −12.4), the spots that project into the
// reference's 0.05–0.14 × 0.55–0.68 on today's ground (following the rock had put the crowns at sx −0.04, sy 0.75)
const dHero=a.plants.heroFerns.items.filter(it=>Math.hypot(it.x+4.4,it.z+12.4)<1.6);
assert.ok(dHero.length>=3,'Hero fern crowns west of the shot-D boulder');
for(const it of dHero){const p=camD([it.x,it.y,it.z]),h=top(a.plants.heroFerns,it)-it.y;
  assert.ok(p&&p.sx>=-0.02&&p.sx<=0.16&&p.sy>=0.6&&p.sy<=0.74,`Hero crown root projects into D's left box, got (${p?.sx.toFixed(2)},${p?.sy.toFixed(2)})`);
  assert.ok(h>=0.65&&h<=1.05,`Hero crown ${h.toFixed(2)} m tall`);}
assert.ok(a.plants.yellowFlowers.items.filter(it=>Math.hypot(it.x+5.4,it.z+12.8)<1.8).length>=4,'Pale-yellow blooms in the shot-D clump');
assert.equal(a.plants.flowers.items.filter(it=>it.x>-3.1&&it.x<-1.4&&it.z>-9.4&&it.z<-6.3).length,0,'No violets on the near west verge in D\'s bottom-left corner');
// Frames 1 / 8: the east bank (stair right flank) carries ferns, moss and broad-leaf cover, while
// the Kokiri spots stay clear (nothing above 0.3 m within 0.6 m).
assert.ok(a.plants.ferns.items.filter(it=>inBox(it,[9,-3.2,16.5,7.5])).length>=40,'Fern cover on the east bank');
assert.ok(a.plants.moss.items.filter(it=>inBox(it,[9,-3.2,16.5,7.5])).length>=40,'Moss cushions on the east bank');
for(const spot of LAYOUT.npcSpots)for(const set of a.plants.all)for(const it of set.items){
  if(Math.hypot(it.x-spot.position[0],it.z-spot.position[2])<0.6)assert.ok(top(set,it)-it.y<=0.3,`${set.opts.name} taller than 0.3 m at NPC spot ${spot.id}`);}
assert.ok(a.plants.flowers.count>=150,'W18: at least 150 flower clusters');
// Frames 14 / 24: Saria's branch is a grassy ramp with stepping stones and a trodden strip between
// them — nothing standing within 0.5 m of a stone, clover tufts at every rim, and the strip's turf
// at most 40 % of the lawn's height (grass checked below). Round 32: the strip is the field's
// corrected one (`troddenZone(x, z, true)`): the house flight and its flank banks are paving and
// bank turf, not a strip, so frame 56 s' tufts stand on the bank beside the risers.
const {houseSteppingStones}=read('layout'),stones=houseSteppingStones();
assert.ok(stones.length>=6,'Stepping stones present on the house branch');
const stoneDist=(x,z)=>Math.min(...stones.map(s=>Math.hypot(x-s.x,z-s.z)-s.r));
// round 38: the walk corridor (the strip's core and the stones' 0.5 m) carries nothing over 0.25 m
for(const set of a.plants.all)for(const it of set.items){
  if(stoneDist(it.x,it.z)<0.5)assert.ok(top(set,it)-it.y<=0.25,`${set.opts.name} ${(top(set,it)-it.y).toFixed(2)} m tall within 0.5 m of a stepping stone at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);
  if(a.field.troddenZone(it.x,it.z,true)>0.6)assert.ok(top(set,it)-it.y<=0.25,`${set.opts.name} ${(top(set,it)-it.y).toFixed(2)} m tall in the trodden strip at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);}
for(const s of stones){const n=a.plants.clover.items.filter(it=>{const d=Math.hypot(it.x-s.x,it.z-s.z)-s.r;return d>=0&&d<=0.3;}).length;
  assert.ok(n>=4,`Clover fringe at the stepping stone (${s.x.toFixed(2)},${s.z.toFixed(2)}): ${n} tufts`);}
// Round 38 — frames 14 / 24 s' understory around Saria's terrace (plants.ts round 38), hemmed in
// by the other frames' contracts above (camera C's stair-foot box, D's right verge, the corridor)
// and by what take r38/cap-a measured per frame: camera C's bank and frame 8 s' dark mass take
// nothing new, the terrace keeps the turf's tone, the lobe's south-east corner is the one lit ground.
{const scale=it=>Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]),camF=camera('F_canopy'),camC=camera('C_lookback');
  // (T) the terrace lawn north of the stones: 0.36–0.5 m crowns in groups, hostas, cushions, tufts, clover
  const TN=[6.3,-11,8.8,-8.4],tFerns=a.plants.ferns.items.filter(it=>inBox(it,TN));
  assert.ok(tFerns.length>=16&&tFerns.every(it=>{const h=top(a.plants.ferns,it)-it.y;return h>=0.36&&h<=0.5;}),`terrace crowns 0.36–0.5 m north of the stones: ${tFerns.length}`);
  assert.ok(a.plants.weeds.items.filter(it=>inBox(it,TN)&&scale(it)>=1.5).length>=45,'hosta clumps on the terrace lawn');
  assert.ok(a.plants.moss.items.filter(it=>inBox(it,TN)).length>=75,'moss cushions on the terrace lawn (thickest at the trunk base)');
  assert.ok(a.plants.tufts.items.filter(it=>inBox(it,TN)).length>=240&&a.plants.clover.items.filter(it=>inBox(it,TN)).length>=200,'tufts and clover carpet the terrace lawn');
  // every terrace crown keeps its fronds off camera F's frame (frame 8 s' dark left mass starts at its edge)
  for(const it of tFerns){const p=camF([it.x,it.y,it.z]);if(p)assert.ok(p.sx+reach(a.plants.ferns,it)*p.perM<0.02,`terrace crown at (${it.x.toFixed(2)},${it.z.toFixed(2)}) shows at F.sx ${p.sx.toFixed(3)}`);}
  // camera C's bank (field.ts C_FOOT, frame 46 s' bottom-left at 2–5 m and frame 1 s' hazed mound):
  // the round-35 population only — 46 plants over 0.12 m at take 105
  const CF=a.field.cFootBox();
  let cf=0;for(const set of a.plants.all)for(const it of set.items)if(inBox(it,CF)&&top(set,it)-it.y>0.12)cf++;
  // round 44: 47 after the merge of r44/ground (the hollow's re-seated stones re-index a shared joint-gap
  // stream; one plant's stone-clearance test flipped) — one over the take-105 count, C's frame unchanged
  // (2026-09-21: 48 — one hosta of the 'weeds-c-foreground' top-up that keeps C's foreground clusters at 16)
  assert.ok(cf<=48,`plants over 0.12 m on camera C's bank: ${cf} (take 105: 46; round 44: 47; 2026-09-21: 48)`);
  // (SE) the lobe's south-east corner — frame 14 s' right-edge crown group: lit crowns 0.3–0.45 m,
  // hostas, clover, tufts over the round-35 population (6 / 43 / 102 / 98), every new plant east of
  // frame 8 s' mass (F.sx − reach ≥ 0.17) and out of camera C's foreground (no new root inside its
  // frame within 8 m: 35 over 0.12 m at take 105)
  const SE=[6.7,-4.9,8.5,-2.4],seFerns=a.plants.ferns.items.filter(it=>inBox(it,SE));
  assert.ok(seFerns.length>=7&&seFerns.filter(it=>{const h=top(a.plants.ferns,it)-it.y;return h>=0.3&&h<=0.45;}).length>=2,`corner crowns: ${seFerns.length}`);
  assert.ok(a.plants.weeds.items.filter(it=>inBox(it,SE)&&scale(it)>=1.5).length>=52,'hosta clumps in the lobe corner');
  assert.ok(a.plants.clover.items.filter(it=>inBox(it,SE)).length>=130&&a.plants.tufts.items.filter(it=>inBox(it,SE)).length>=108,'clover and tufts through the lobe corner');
  let seF=0,cNear=0;for(const set of a.plants.all)for(const it of set.items){if(!inBox(it,SE)||top(set,it)-it.y<=0.12)continue;
    const pf=camF([it.x,it.y,it.z]);if(pf){const hw=reach(set,it)*pf.perM;if(pf.sx-hw<0.17&&pf.sx+hw>=0)seF++;}
    const pc=camC([it.x,it.y,it.z]);if(pc&&pc.depth<8){const hw=reach(set,it)*pc.perM;if(!(pc.sx+hw<-0.02||pc.sx-hw>1.02||pc.sy<-0.02))cNear++;}}
  // round 49's re-base to 144 measured the fixture's LIVE view, not the world (see `vegetationTerrain`): the
  // 'weeds-rim-clusters' stream re-rolled only there (93 → 104 weeds in the box). Round 51 (vegetation-28): the
  // fixture reads the legacy view the world builds against and measures take 105's 139 again — frame F was
  // byte-identical throughout — so the contract is back at 139
  // 2026-09-21: 142 — the hero clump's authored move (HERO_CLUMP_SPOTS) shifts the sets that test nearFern /
  // crownLeft against it; the three extra sit at sx 0.15–0.18 behind the lobe's mass (F measured at the take)
  assert.ok(seF<=142,`corner plants over 0.12 m reaching frame 8 s' mass: ${seF} (take 105: 139; 2026-09-21: 142)`);
  assert.ok(cNear<=35,`corner plants over 0.12 m in camera C's foreground: ${cNear} (take 105: 35)`);
  // (H) the trunk-base tiers: two clipped crowns ≤ 0.9 m at the doorway's dark posts, never over frame 14 s' lit threshold (B 0.71–0.80 × 0.35–0.56)
  assert.equal(doorTier.length,2,'two trunk-base hedge tiers beside the door path');
  for(const it of doorTier){const h=top(a.plants.hedge,it)-it.y,p=camB([it.x,top(a.plants.hedge,it),it.z]),hw=reach(a.plants.hedge,it)*p.perM;
    assert.ok(h<=0.9,`trunk-base tier ${h.toFixed(2)} m stays a low crown`);
    assert.ok(p.sx+hw<0.71||p.sx-hw>0.80||p.sy>0.56,`trunk-base tier at (${it.x.toFixed(2)},${it.z.toFixed(2)}) covers the doorway at B (${p.sx.toFixed(2)},${p.sy.toFixed(2)})`);}
  // verge flowers: white and straw-yellow clumps (≤ 0.26 m) along the stones' lawn and in the corner
  const TB=[6.2,-11,10.6,-6.3],verge=it=>inBox(it,TB)||inBox(it,SE);
  assert.ok(a.plants.whiteFlowers.items.filter(verge).length>=10,'white verge clumps around the terrace');
  const yv=a.plants.yellowFlowers.items.filter(verge);
  assert.ok(yv.length>=7&&yv.every(it=>top(a.plants.yellowFlowers,it)-it.y<=0.26),`straw-yellow verge clumps around the terrace: ${yv.length}`);
  // frame 8 s' dark left mass (F 0–0.17 × 0.44–0.665 within 14 m) keeps its round-35 population: the
  // round-38 sets are gated out of it. 575 plants over 0.12 m at take 105; re-baseline only with a
  // frame-F comparison that shows the mass unchanged.
  let fMass=0;for(const set of a.plants.all)for(const it of set.items){const p=camF([it.x,it.y,it.z]);if(!p||p.depth>14||top(set,it)-it.y<=0.12)continue;const hw=reach(set,it)*p.perM;
    if(p.sx+hw>=0&&p.sx-hw<=0.17&&p.sy>=0.44&&p.sy<=0.665)fMass++;}
  assert.ok(fMass<=590,`plants in frame 8 s' dark left mass: ${fMass} (take 105: 575)`);}
// Round 8, concept sheets (reference/CONCEPTS.md): the sheets rule plant shapes, flower kinds and
// the path-edge treatment; the video frames still rule the scored compositions.
const cams=LAYOUT.viewpoints.map(v=>[v.position[0],v.position[2]]),nearCam=(it,r)=>cams.some(([x,z])=>Math.hypot(it.x-x,it.z-z)<r);
// White forest flowers (sheet 01 “Flower clumps”): ≤ 0.3 m clumps 0.3–0.5 m across, ~40 within
// 25 m of the cameras, in each authored region, off the trodden strip, never on a violet.
const whites=a.plants.whiteFlowers;
assert.ok(whites.items.filter(it=>nearCam(it,25)).length>=40,`≥ 40 white clumps within 25 m of a camera (${whites.count})`);
for(const it of whites.items){const h=top(whites,it)-it.y,r=reach(whites,it);
  assert.ok(h<=0.3,`white clump ${h.toFixed(2)} m tall`);assert.ok(r>=0.1&&r<=0.27,`white clump reach ${r.toFixed(2)} m (0.3–0.5 m across)`);
  assert.equal(a.field.troddenZone(it.x,it.z),0,'white clumps stay off the trodden strip');
  assert.ok(!a.plants.flowers.items.some(f=>Math.hypot(f.x-it.x,f.z-it.z)<0.45),'white clumps do not cover the violets');
  // round 13: the corner is frame 14 s' lawn band, so its white dots are the rim-side strip that shows past the kid at B (0.035, 0.885)
  if(it.x>-3.1&&it.x<-1.4&&it.z>-9.4&&it.z<-6.3){const p=camB([it.x,it.y,it.z]);
    assert.ok(it.x>-2.5&&it.z<-6.7&&a.field.lawnEdgeDistance(it.x,it.z)<=0.9&&p&&p.sx>=0.07&&p.sx<=0.16&&p.sy>=0.6&&p.sy<=0.85,`D's near west verge keeps grass and litter only, bar the B-rim / lawn-band dots (${it.x.toFixed(2)},${it.z.toFixed(2)})`);
    // and those clumps are not buried under the boulder cluster's paddle leaves
    assert.ok(!a.plants.weeds.items.some(w=>{const r=reach(a.plants.weeds,w);return r>=0.25&&Math.hypot(w.x-it.x,w.z-it.z)<r-0.02;}),`B-rim white clump at (${it.x.toFixed(2)},${it.z.toFixed(2)}) sits under a big weed`);}}
const camA=camera('A_stairs'),inFrame=(cam,set,it,b)=>{const p=cam([it.x,it.y,it.z]);return p&&p.depth<30&&p.sx>=b[0]&&p.sx<=b[2]&&p.sy>=b[1]&&p.sy<=b[3];};
assert.ok(whites.items.filter(it=>inFrame(camB,whites,it,[0,0.6,0.4,0.85])).length>=6,'white dots on B/E\'s left lawn edge (frame 14 s)');
// the far west-verge clumps hide behind nearer ferns from B; the rim cluster 8–10 m out is the one that reads
assert.ok(whites.items.filter(it=>{const p=camB([it.x,it.y,it.z]);return p&&p.depth<10.5&&inFrame(camB,whites,it,[0.07,0.6,0.15,0.85]);}).length>=3,'unoccluded white clumps on B\'s west rim within 10.5 m');
assert.ok(whites.items.filter(it=>it.x>-3.1&&it.x<-1.4&&it.z>-9.4&&it.z<-6.3).length<=12,'the lawn-band dots stay a strip in D\'s bottom-left corner');
assert.ok(whites.items.filter(it=>inFrame(camA,whites,it,[0.8,0.3,1,0.6])).length>=4,'white clumps on A\'s right bank near the kid');
assert.ok(whites.items.filter(it=>inFrame(camD,whites,it,[0,0.5,0.25,0.8])).length>=3,'a few white clumps among the D verge ferns');
assert.ok(whites.items.filter(it=>a.field.rampDistance(it.x,it.z)<3.2&&it.x>1&&it.z>-10.5&&it.z<-1.5).length>=6,'white clumps on the ramp\'s outer lawn');
for(const g of whites.opts.variants.flat()){const c=g.attributes.color.array;let white=0,yellow=0;
  for(let i=0;i<c.length;i+=3){const r=c[i],g=c[i+1],b=c[i+2];if(r>0.72&&g>0.72&&b>0.66&&Math.max(r,g,b)-Math.min(r,g,b)<0.12)white++;else if(r>0.7&&g>0.5&&b<0.4)yellow++;}
  assert.ok(white>=8*4*3&&yellow>=8*3,'each variant carries ≥ 8 white five-petal blooms with yellow centres');}
// Fiddleheads (sheet 01 “Forest buds”): 2–4 buds of 0.25–0.45 m at every hero crown and at
// ≈ 30 % of the ordinary fern clumps within 15 m of a camera.
const buds=a.plants.fiddleheads,budsNear=(x,z,r)=>buds.items.filter(it=>Math.hypot(it.x-x,it.z-z)<=r&&top(buds,it)-it.y<=0.45).length;
// the shot-D hero clump is the exception: frame 56's lit mass left of the rock is tall bud stalks (0.5–0.9 m)
// (2026-09-21: the clump is authored at HERO_CLUMP_ANCHOR (−4.4, −12.4) since the rock moved; its stalks stand west of the crowns)
const dTall=it=>Math.hypot(it.x+4.4,it.z+12.4)<2.2&&it.x<-3.6;
for(const it of buds.items){const h=top(buds,it)-it.y;assert.ok(h>=0.25&&h<=(dTall(it)?0.9:0.45),`fiddlehead ${h.toFixed(3)} m tall at (${it.x.toFixed(1)},${it.z.toFixed(1)})`);}
const dStalks=buds.items.filter(it=>dTall(it)&&top(buds,it)-it.y>=0.45);assert.ok(dStalks.length>=2,`tall bud stalks at the shot-D clump: ${dStalks.length}`);
for(const it of dStalks){const p=camD([it.x,it.y,it.z]);assert.ok(p&&p.sx>=-0.02&&p.sx<=0.12&&p.sy>=0.6&&p.sy<=0.74,`shot-D stalk root projects left of the rock, got (${p?.sx.toFixed(2)},${p?.sy.toFixed(2)})`);}
for(const it of a.plants.heroFerns.items){const n=budsNear(it.x,it.z,0.2);assert.ok(n>=2&&n<=4,`${n} buds at the hero crown (${it.x.toFixed(1)},${it.z.toFixed(1)})`);}
const nearFerns=a.plants.ferns.items.filter(it=>nearCam(it,15)),budded=nearFerns.filter(it=>budsNear(it.x,it.z,0.16)>0).length/nearFerns.length;
assert.ok(budded>=0.22&&budded<=0.38,`${(budded*100).toFixed(0)} % of the near fern clumps carry fiddleheads (≈ 30 %)`);
assert.ok(buds.items.every(it=>dTall(it)||a.plants.ferns.items.concat(a.plants.heroFerns.items).some(f=>Math.hypot(f.x-it.x,f.z-it.z)<=0.2)),'every bud sits in a fern crown');
// Leaf shapes (sheet 01 “Leaves & plants”): heart / ovate / round broad-leaf variants, 3–6 leaves
// per plant, 0.15–0.35 m, with a lighter midrib; glossy top face via the material.
const weeds=a.plants.weeds;assert.equal(weeds.variantCount,3,'heart, ovate and round variants');
for(const [v,lods] of weeds.opts.variants.entries()){const g=lods[0],b=g.boundingBox,span=Math.max(b.max.x-b.min.x,b.max.z-b.min.z);
  assert.ok(span>=0.15&&span<=0.36,`variant ${v} spans ${span.toFixed(2)} m`);assert.ok(b.max.y<=0.3,`variant ${v} height ${b.max.y.toFixed(2)}`);
  const c=g.attributes.color.array;let lum=[];for(let i=0;i<c.length;i+=3)lum.push(0.2126*c[i]+0.7152*c[i+1]+0.0722*c[i+2]);
  const sorted=[...lum].sort((p,q)=>p-q);assert.ok(sorted[sorted.length-1]/sorted[Math.floor(sorted.length*0.5)]>=1.12,`variant ${v} has a visibly lighter midrib`);}
const weedMat=a.plants.materials.find(m=>m.name==='veg-weeds');assert.ok(weedMat,'weed material');
{const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};weedMat.onBeforeCompile(sh,{});
  assert.equal(sh.uniforms.uTopRoughness.value,0.55,'waxy top face roughness 0.55');assert.match(sh.fragmentShader,/roughnessFactor = gl_FrontFacing && \(vLeafUv\.x < 1\.5 \|\| \(vLeafUv\.x >= 6\.0 && vLeafUv\.x < 7\.0\)\) \? uTopRoughness : roughnessFactor;/,'round 47: the sheen is the laminae\'s only — cores, stems and twigs stay matte');assert.ok(weedMat.roughness>=0.85,'matte underside');}
// Path-edge softening (sheet 02): dense short moss in the 0.25 m band outside the flagstone rim
// of the spine / stair branch / plaza, nothing on the slabs (every root passed `allowed` above).
// Since aff169d / e17f310 the stair branch ends at (6.6, −0.5) inside the plaza's east lobe, so its
// paved rim toward the stair foot is the lobe's north arc (x 4–6, z −4.5..−2.4), the branch's short
// north rim (z ≈ −2.4) and its end cap north of the foot — the box below is that rim, no longer the
// branch polyline's own half-width band (which now lies on the paving).
const rimMoss=a.plants.moss.items.filter(it=>{const e=a.field.lawnEdgeDistance(it.x,it.z);return e>=-0.05&&e<=0.25;});
assert.ok(rimMoss.length>=100,`moss cushions along the paved rim: ${rimMoss.length}`);
assert.ok(rimMoss.filter(it=>it.x>1.5&&it.z>-4.5&&it.z<1).length>=6,'rim moss along the stair branch too');
assert.ok(rimMoss.every(it=>top(a.plants.moss,it)-it.y<=0.12),'rim moss stays a short cushion');
// The flagstones end where the heightfield's plaza discs end and at the toe of the stair's south
// bank (e17f310: S_BANK, (3.3, 5.9) → 0.25 m past the first riser's south corner), not at the
// polylines' half-width. The field reads those rims off the terrain mask (`pavedRimDistance`) so the
// turf treatment follows them; the toe (≈ 6.9 m) is the foot of the bank the shot-A kid stands on
// and keeps grass only (frame 1: lit tufts overhang the slabs — no cushions, herbs or broad leaves).
const rimStats=a.field.pavedRimStats();
assert.ok(rimStats.metres>=20&&rimStats.bankMetres>=6,`mask-derived paved rim: ${rimStats.metres.toFixed(1)} m, ${rimStats.bankMetres.toFixed(1)} m of it the bank toe`);
assert.ok(rimMoss.filter(it=>a.field.pavedRimDistance(it.x,it.z)<=0.25).length>=15,`rim moss along the plaza discs' own rim: ${rimMoss.filter(it=>a.field.pavedRimDistance(it.x,it.z)<=0.25).length}`);
// round 31: the grass tufts (plantgeo.ts tuftGeometry) ARE frame 1's lit tufts on that face — the one plant set the face grows
// round 47: `bankFace` is every paved rim flagged `bank` — since expansion-1 it includes the north
// clearing's banks (z ≈ −74), which are not frame 1's face; the contract is the shot-A face (`aFace`).
{const bs=newSample();for(const set of a.plants.all)for(const it of set.items){if(set===a.plants.tufts||a.field.aFace(it.x,it.z)<=0.3)continue;a.field.sample(it.x,it.z,bs);
  assert.ok(bs.slope<=0.2,`${set.opts.name} on the shot-A bank face at (${it.x.toFixed(2)},${it.z.toFixed(2)}), slope ${bs.slope.toFixed(2)}`);}}
// Round 13 — foreground framing (owner boards 01 / 02 / 06 / 08; frames 1 s / 14 s / 46 s / 56 s).
const scaleOf=it=>Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]),kidSpots=[...LAYOUT.npcSpots.map(n=>[n.position[0],n.position[2]]),[4.96,5.29],[6.21,3.2]];
const kidClear=(it,r)=>kidSpots.every(([x,z])=>Math.hypot(it.x-x,it.z-z)>=r);
// (2) frame 14 s' lawn band (field.ts LAWN_BAND, the near west verge): no fern clumps but the shot-D
// boulder ring's, clover, three moss cushions for the mossy stones, and ≥ 8 white dots that read past
// the kid in B's band box (sx ≥ 0.075, 0.6–0.86); every dot still keeps its clearances (checked above)
// the ring is laid around the rock's clearance radius (layout `clearRadius`, 0.9 m; the rock itself
// renders at 0.6 m since layout round 6), so the ring test measures from that radius
const dBoulder=LAYOUT.heroBoulders.find(b=>b.id==='shot-d-boulder'),dClear=dBoulder.clearRadius??dBoulder.radius,bandBox=a.field.lawnBandBox();
assert.ok(dClear>=dBoulder.radius,'the shot-D rock renders inside its vegetation clearance ring');
for(const it of a.plants.ferns.items)if(a.field.lawnBand(it.x,it.z)>0.5)assert.ok(Math.hypot(it.x-dBoulder.position[0],it.z-dBoulder.position[2])-dClear<=1.15,`fern clump in the lawn band at (${it.x.toFixed(2)},${it.z.toFixed(2)}) is not the boulder ring's`);
assert.ok(a.plants.clover.items.filter(it=>inBox(it,bandBox)).length>=60,'clover through the lawn band');
const bandMoss=a.plants.moss.items.filter(it=>inBox(it,bandBox)&&reach(a.plants.moss,it)>=0.25);
// (2026-09-21: 3 → 2 — the shot-D boulder's clearance disc now stands in the lawn band (W23 move, take-0128))
assert.ok(bandMoss.length>=2&&bandMoss.every(it=>top(a.plants.moss,it)-it.y<=0.2&&a.field.lawnEdgeDistance(it.x,it.z)>=0.3),`mossy "stones" in the lawn band: ${bandMoss.length}`);
assert.ok(whites.items.filter(it=>{const p=camB([it.x,it.y,it.z]);return p&&p.depth<14&&p.sx>=0.075&&p.sx<=0.3&&p.sy>=0.6&&p.sy<=0.86;}).length>=8,'white dots past the kid in B\'s lawn band');
// (1)/(3) the west verge bed: frame 1 s' left edge and frame 56's bottom-left cluster on the verge
// north of the boulder — ferns, purple clumps and broad leaves that project into D's 0–0.22 × 0.56–0.74
const westBed=[-4.8,-16.5,-2.3,-11.2],inD=(set,it,b)=>inFrame(camD,set,it,b);
const bedFerns=a.plants.ferns.items.filter(it=>inBox(it,westBed));
assert.ok(bedFerns.length>=12&&bedFerns.filter(it=>inD(a.plants.ferns,it,[-0.02,0.5,0.24,0.74])).length>=8,`fern cluster on the west verge bed: ${bedFerns.length}`);
// round 32: frame 56 s' bed is 1 % violet — two small patches at D (0.17–0.27, 0.60–0.67) and
// (0.05–0.12, 0.55–0.60) beside a lit fern mass, not a field (ours was 9.5 % of the bed box): the
// heads outside the patches are pruned, the first patch keeps ~40 % of its heads (≈ 15 remain)
assert.ok(a.plants.flowers.items.filter(it=>inBox(it,westBed)&&inD(a.plants.flowers,it,[-0.02,0.5,0.28,0.76])).length>=12,'purple clumps through the west verge bed (frame 56 / frame 1 left edge)');
assert.ok(a.plants.flowers.items.filter(it=>{const p=camD([it.x,it.y+(top(a.plants.flowers,it)-it.y)*0.75,it.z]);return p&&p.depth<=20&&p.sx>=0.1&&p.sx<=0.3&&p.sy>=0.55&&p.sy<=0.85&&!(p.sx>=0.17&&p.sx<=0.27&&p.sy>=0.6&&p.sy<=0.67)&&!(p.sx>=0.05&&p.sx<=0.12&&p.sy>=0.55&&p.sy<=0.6);}).length===0,'round 32: no violet heads in D\'s boulder bed outside frame 56 s\' two patches');
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,westBed)&&scaleOf(it)>=1.5).length>=12,'broad-leaf clusters in the west verge bed');
assert.ok(a.plants.ferns.items.concat(a.plants.flowers.items).filter(it=>inFrame(camA,a.plants.ferns,it,[-0.02,0.45,0.12,0.6])).length>=20,'the bed fills frame 1 s\' left edge (A 0–0.12 × 0.45–0.6)');
// (1) frame 1 s' right bank: 0.4–0.8 m fern clumps and a broad-leaf skirt on the crest behind the
// kid (A 0.8–1.05 × 0.5–0.75), on flat ground off the bank face, ≥ 1.2 m from both kid spots
const crestFerns=a.plants.ferns.items.filter(it=>inBox(it,[6.0,3.5,8.8,5.6]));
assert.ok(crestFerns.length>=3,`fern clumps on the south bank's crest: ${crestFerns.length}`);
{const cs=newSample();for(const it of crestFerns){a.field.sample(it.x,it.z,cs);const p=camA([it.x,it.y,it.z]),h=top(a.plants.ferns,it)-it.y;
  assert.ok(p&&p.sx>=0.8&&p.sx<=1.05&&p.sy>=0.5&&p.sy<=0.75&&h>=0.38&&h<=0.85&&cs.slope<=0.2&&a.field.bankFace(it.x,it.z)<=0.3&&kidClear(it,1.2),`crest fern at (${it.x.toFixed(2)},${it.z.toFixed(2)}) A(${p?.sx.toFixed(2)},${p?.sy.toFixed(2)}) h${h.toFixed(2)} slope${cs.slope.toFixed(2)}`);}}
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,[6.0,3.2,9.0,5.6])&&scaleOf(it)>=1.5&&top(a.plants.weeds,it)-it.y<=0.35).length>=8,'broad leaves on the crest behind the shot-A kid');
// (2) frame 14 s' right foreground mass on the stair-flank bank 8–10 m out (B 0.85–1.0 × 0.52–0.86):
// fern clumps with buds, purple clumps and broad leaves, none in camera C's wedge (checked above)
const bMass=[8.0,-6.2,9.6,-3.4],bMassFrame=[0.84,0.5,1.02,0.86];
assert.ok(a.plants.ferns.items.filter(it=>inBox(it,bMass)&&inFrame(camB,a.plants.ferns,it,bMassFrame)).length>=12,'fern clumps in B\'s right foreground mass');
assert.ok(a.plants.fiddleheads.items.filter(it=>inBox(it,bMass)).length>=6,'fiddleheads among B\'s right-edge clumps');
assert.ok(a.plants.flowers.items.filter(it=>inBox(it,bMass)&&inFrame(camB,a.plants.flowers,it,bMassFrame)).length>=16,'purple clumps in B\'s right foreground mass');
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,bMass)&&scaleOf(it)>=1.5).length>=12,'broad leaves in B\'s right foreground mass');
// (3) frame 56's right verge: low purple heads (≤ 0.55 m, camera C's grass box) and leaf clusters in D's 0.74–1.0 × 0.52–0.86
assert.ok(a.plants.flowers.items.filter(it=>inBox(it,[4,-15,9,-8])&&inD(a.plants.flowers,it,[0.72,0.5,1.02,0.86])).length>=16,'purple clumps on D\'s right verge');
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,[3,-13,8,-7])&&scaleOf(it)>=1.4&&inD(a.plants.weeds,it,[0.72,0.5,1.02,0.9])).length>=20,'broad-leaf clusters on D\'s right verge');
// (4) frame 46: heart-leaf clusters in the grass 3–5 m before camera C (≤ 0.35 m, the stair-foot rule above) and white clumps on the bank beside the stair foot
// round 49 re-based this to 13 after 52be8f2d "re-rolled the weed stream" (box 32 → 28, C's frame 17 → 13) — but only
// the fixture's live view had: the world's legacy view kept the 'weeds-rim-clusters' pass' four hostas at C's stair foot
// (its cluster at ≈ (5.9, −4.6) is 0.3–1.3 m off the lobe's rim), and frame C never lost them. Round 51 (vegetation-28,
// item 3): the fixture reads the world's view (`vegetationTerrain`) and measures 17 in the frame region again, the
// round-45 population; the contract is back at ≥ 16. No frame changes — the world is what it was.
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,[3.6,-5.8,6.8,-3.4])&&scaleOf(it)>=1.05&&inFrame(camC,a.plants.weeds,it,[-0.02,0.76,0.34,1.02])).length>=16,'broad-leaf clusters in C\'s foreground (round 45: 16; round 51: 17 on the world\'s view)');
assert.ok(whites.items.filter(it=>{const p=camC([it.x,it.y,it.z]);return p&&p.depth>=12.2&&p.sx>=0.12&&p.sx<=0.32&&p.sy>=0.4&&p.sy<=0.58&&kidClear(it,1.0);}).length>=2,'white clumps on the bank beside C\'s stair foot');
// (5) board 06: broad-leaf weeds along the path edges in clusters of 5–12 (≥ 40 clusters of 15–30 cm leaves within 22 m of a camera)
{const big=a.plants.weeds.items.filter(it=>scaleOf(it)>=1.3&&nearCam(it,22)&&a.field.lawnEdgeDistance(it.x,it.z)>=0.2&&a.field.lawnEdgeDistance(it.x,it.z)<=1.8);
  assert.ok(big.length>=250,`broad leaves along the rims: ${big.length}`);
  const clustered=big.filter(it=>big.filter(o=>o!==it&&Math.hypot(o.x-it.x,o.z-it.z)<=0.6).length>=4).length;
  assert.ok(clustered/big.length>=0.6,`${(clustered/big.length*100).toFixed(0)} % of the rim leaves grow in clusters`);
  // the boulder cluster's paddle leaves (scale up to 3.3) are the one taller broad-leaf plant
  for(const it of big){if(Math.hypot(it.x-dBoulder.position[0],it.z-dBoulder.position[2])<=2.2)continue;
    assert.ok(top(a.plants.weeds,it)-it.y<=0.4,`rim leaf ${(top(a.plants.weeds,it)-it.y).toFixed(2)} m tall at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);
    assert.ok(a.field.bankFace(it.x,it.z)<=0.3,'rim leaves stay off the bank face');}}
for(const id of['A_stairs','B_house','D_log']){
  const p=LAYOUT.viewpoints.find(v=>v.id===id).position;
  // every instance bucketed — bar the ones past a set's far cut (round 39: clover 16 m, tufts 22 m, fiddleheads / moss 24 m), which no bucket carries
  for(const set of a.plants.all){set.update(new THREE.Vector3().fromArray(p),true);
    const far=set.opts.maxDistance??Infinity,inRange=set.items.filter(it=>Math.hypot(it.x-p[0],it.z-p[2])<far).length;
    assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),inRange,`${set.opts.name} bucketed from ${id}`);
    if(far<Infinity&&id==='A_stairs')assert.ok(inRange<set.count,`${set.opts.name}: the ${far} m cut drops something from ${id}`);}
}
// the round-39 far cuts: the herb layer and the tufts / cushions the carpet's cards stand for past 22–24 m; the hero sets have none
assert.deepEqual([a.plants.clover,a.plants.fiddleheads,a.plants.tufts,a.plants.moss].map(s=>s.opts.maxDistance),[16,24,22,24]);
// round 44: the north corridor's own fern / broad-leaf sets stop at 30 m (the fixed cameras stand 40 m+ off the plain)
assert.deepEqual([a.plants.fernsNorth,a.plants.weedsNorth].map(s=>s.opts.maxDistance),[30,30]);
// round 48: the clearing banks' shrubs stop at 36 m (camera A looks north over them), the pad's tufts at the tufts' 22 m
assert.deepEqual([a.plants.bushesNorth,a.plants.tuftsNorth].map(s=>s.opts.maxDistance),[36,22]);
for(const set of a.plants.all)if(![a.plants.clover,a.plants.fiddleheads,a.plants.tufts,a.plants.moss,a.plants.fernsNorth,a.plants.weedsNorth,a.plants.bushesNorth,a.plants.tuftsNorth].includes(set))assert.equal(set.opts.maxDistance,undefined,`${set.opts.name} has no far cut`);
assert.deepEqual(a.plants.tufts.opts.lodDistances,[10]);assert.deepEqual(a.plants.ferns.opts.lodDistances,[12,20]);
// the pack layout: the round-13 trade (flowers mid LOD in pairs, near weeds / fiddleheads per variant) holds
// (round 43: one ultra tier ahead of them — flowers / weeds pack it whole, one draw for the few clumps inside the ring)
assert.deepEqual(a.plants.flowers.packLayout[2],[[0,1],[2,3]],'flower mid LOD pairs the heads and the spikes');
assert.deepEqual(a.plants.weeds.packLayout[1],[[0],[1],[2]],'near weeds draw per variant');
assert.deepEqual(a.plants.fiddleheads.packLayout,[[[0],[1],[2]],[[0],[1],[2]],[[0],[1],[2]]],'fiddleheads: per variant at all three LODs (round 39 / 40)');
assert.deepEqual(a.plants.flowers.packLayout[3],[[0,1],[2,3]],'flower far LOD in pairs too (round 39)');
assert.deepEqual(a.plants.flowers.packLayout[0],[[0],[1],[2],[3]],'flower ultra LOD one variant a draw (4.2–5.1 K triangles a variant; packed, shot D paid 18 K a clump)');
assert.deepEqual(a.plants.weeds.packLayout[0],[[0,1,2]],'weed ultra LOD in one draw');
// round 43 — the close-scale herb layer: an ultra tier inside FLOWER / BROADLEAF / MOSS_ULTRA_M, built from the high
// LOD's own layout stream (same stems, blooms, leaves; the swap keeps the silhouette within a few mm), the fixed
// cameras standing outside every ring; the flowers' materials compile the petal band, not the leaf block
{const {FLOWER_ULTRA_M,BROADLEAF_ULTRA_M,MOSS_ULTRA_M,FLOWER_DETAILS,WHITE_FLOWER_DETAILS,BROADLEAF_DETAILS,MOSS_DETAILS,WHITE_BUD_SHARE,BROADLEAF_HUE_SPREAD,MOSS_RIM_GAIN,MOSS_TOP_GAIN,flowerGeometry,flowerSpikeGeometry,whiteFlowerGeometry,weedGeometry,cloverGeometry,mossGeometry,makePalette}=read('vegetation/plantgeo');
  const {PETAL_U}=read('vegetation/geometry');
  // round 46 (survey-2 check 28): the moss ultra ring may run to 6 m — the mid cluster still read as sphere clusters at 2–4 m
  assert.ok(FLOWER_ULTRA_M>=3&&FLOWER_ULTRA_M<=5&&BROADLEAF_ULTRA_M>=2&&BROADLEAF_ULTRA_M<=4&&MOSS_ULTRA_M>=2.5&&MOSS_ULTRA_M<=6,'ultra rings 2–6 m (sized to the fixed cameras\' budgets)');
  assert.deepEqual([FLOWER_DETAILS[0],WHITE_FLOWER_DETAILS[0],BROADLEAF_DETAILS[0],MOSS_DETAILS[0]],['ultra','ultra','ultra','ultra']);
  assert.deepEqual(a.plants.flowers.opts.lodDistances,[FLOWER_ULTRA_M,9,16]);assert.deepEqual(a.plants.yellowFlowers.opts.lodDistances,[FLOWER_ULTRA_M,9,16]);
  assert.deepEqual(a.plants.whiteFlowers.opts.lodDistances,[FLOWER_ULTRA_M,12]);assert.deepEqual(a.plants.weeds.opts.lodDistances,[BROADLEAF_ULTRA_M,13]);
  // round 44: the cushions' mid tier (a cheaper lobe cluster) reaches MOSS_MID_M, the dome only past it
  const {MOSS_MID_M,MOSS_MID_LOBE_STEP,MOSS_MID_LOBE_GROW}=read('vegetation/plantgeo');
  assert.ok(MOSS_MID_M>=8&&MOSS_MID_M<=14&&MOSS_MID_LOBE_STEP>=2&&MOSS_MID_LOBE_GROW>1&&MOSS_MID_LOBE_GROW<=1.5,'the mid ring 8–14 m, every second lobe grown to close the gaps');
  assert.deepEqual(MOSS_DETAILS,['ultra','high','low']);
  assert.deepEqual(a.plants.clover.opts.lodDistances,[BROADLEAF_ULTRA_M,9]);assert.deepEqual(a.plants.moss.opts.lodDistances,[MOSS_ULTRA_M,MOSS_MID_M]);
  assert.deepEqual(a.plants.moss.packLayout,[[[0,1]],[[0],[1]],[[0],[1]]],'moss: the mid cluster and the far dome one variant a draw (packed, every far cushion submitted both domes), the ultra tier packed');
  for(const set of [a.plants.flowers,a.plants.yellowFlowers,a.plants.whiteFlowers,a.plants.weeds,a.plants.clover,a.plants.moss])assert.equal(set.opts.nearLods,1,`${set.opts.name} declares its ultra tier`);
  for(const set of [a.plants.heroFerns,a.plants.fiddleheads,a.plants.ferns,a.plants.tufts])assert.equal(set.opts.nearLods??0,0,`${set.opts.name} unchanged`);
  const {LAYOUT}=read('layout');
  for(const vp of LAYOUT.viewpoints)for(const set of [a.plants.flowers,a.plants.yellowFlowers,a.plants.whiteFlowers,a.plants.weeds,a.plants.clover]){
    const ring=set.opts.lodDistances[0],near=set.items.filter(it=>Math.hypot(it.x-vp.position[0],it.z-vp.position[2])<ring).length;
    assert.ok(near<=40,`${set.opts.name}: ${near} ultra instances inside ${ring} m of ${vp.id} (round 43 rings: at most 28 flowers at F, ≤ 10 of any other set)`);}
  // round 46: the moss ring runs to MOSS_ULTRA_M = 6 m and camera C stands in a bed of cushions (≈ 280 inside it, 10 inside
  // the round-43 3 m ring), so the moss is bounded by its triangle cost instead: the ultra − mid delta over every cushion
  // inside the ring ≤ 0.25 M at each fixed camera (before the frustum cull; the ring itself is checked above);
  // the velvet pass (MOSS_FUZZ_*: ≈ 15 pads × 14 one-triangle hairs a cushion) takes it to ≤ 0.32 M — C's whole-scene
  // delta against take-0115 stays under the +0.3 M view budget (cap-2 of round 46 measured +0.06 M before the hairs)
  {const pal0=makePalette(a.ctx.config.palette),s0=a.ctx.config.seed;const delta=Math.max(...[0,1].map(v=>(mossGeometry(`${s0}/moss/${v}`,pal0,'ultra').index.count-mossGeometry(`${s0}/moss/${v}`,pal0,'high').index.count)/3));
    for(const vp of LAYOUT.viewpoints){const near=a.plants.moss.items.filter(it=>Math.hypot(it.x-vp.position[0],it.z-vp.position[2])<MOSS_ULTRA_M).length;
      assert.ok(near*delta<=320e3,`moss: ${near} ultra cushions inside ${MOSS_ULTRA_M} m of ${vp.id} × ${delta} extra triangles = ${(near*delta/1e3).toFixed(0)} K`);}}
  // the ultra tier keeps the high LOD's envelope: height within 5 mm (unit scale), footprint within 10 %, more triangles
  const pal=makePalette(a.ctx.config.palette),seed=a.ctx.config.seed;
  for(let v=0;v<2;v++){const u=mossGeometry(`${seed}/moss/${v}`,pal,'ultra'),h=mossGeometry(`${seed}/moss/${v}`,pal,'high'),l=mossGeometry(`${seed}/moss/${v}`,pal,'low');
    const tris=g=>g.index.count/3;assert.ok(tris(h)>=250&&tris(h)<=0.4*tris(u),`moss ${v}: mid ${tris(h)} triangles against ultra ${tris(u)}`);assert.ok(tris(l)<=60,`moss ${v}: far dome ${tris(l)} triangles`);
    const L=g=>{const c=g.attributes.color.array;let s=0;for(let i=0;i<c.length;i+=3)s+=0.2126*c[i]+0.7152*c[i+1]+0.0722*c[i+2];return s/(c.length/3);};
    assert.ok(Math.abs(L(l)-L(u))<=0.12*L(u),`moss ${v}: far dome luminance ${L(l).toFixed(3)} vs ultra ${L(u).toFixed(3)} (no pop at MOSS_MID_M)`);
    // round 46: the ultra BODY keeps the dome's height; only its MOSS_BLADES grass blades (≤ MOSS_BLADES[1] strips, few
    // vertices) and the velvet's hair tips (one vertex a hair, MOSS_FUZZ_PER_LOBE a pad) stand over the crown, by
    // MOSS_BLADE_RISE × the height at most — so the ultra's vertices above the dome are few
    {const {MOSS_BLADES,MOSS_BLADE_RISE,MOSS_FUZZ_PER_LOBE,MOSS_ULTRA_LOBES}=read('vegetation/plantgeo');const H=h.boundingBox.max.y,p=u.attributes.position.array;let over=0;for(let i=1;i<p.length;i+=3)if(p[i]>H+0.005)over++;
      assert.ok(Math.abs(l.boundingBox.max.y-H)<=0.005,`moss ${v}: the far dome keeps the mid's height`);
      assert.ok(u.boundingBox.max.y>H+0.01&&u.boundingBox.max.y<=H*(1+MOSS_BLADE_RISE)+0.005,`moss ${v}: blades stand ${(u.boundingBox.max.y-H).toFixed(3)} over the ${H.toFixed(3)} crown`);
      assert.ok(over>=4&&over<=MOSS_BLADES[1]*12+MOSS_FUZZ_PER_LOBE*(MOSS_ULTRA_LOBES[1]+1),`moss ${v}: ${over} ultra vertices over the crown — the blades and the hair tips alone`);}
    // every tier is lit from the crown down to a dark rim (the dome's own top-heavy blend read as a pale ball)
    for(const [name,g] of [['mid',h],['far',l]]){const p=g.attributes.position.array,c=g.attributes.color.array,H=g.boundingBox.max.y;const rim=[],crown=[];
      for(let i=0;i<p.length/3;i++){const y=p[i*3+1],lum=0.2126*c[i*3]+0.7152*c[i*3+1]+0.0722*c[i*3+2];if(y<0.12*H)rim.push(lum);else if(y>0.75*H)crown.push(lum);}
      const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;assert.ok(mean(crown)>=1.6*mean(rim),`moss ${v} ${name}: lit top ${mean(crown).toFixed(3)} over dark rim ${mean(rim).toFixed(3)}`);}
    // the mid tier's lobes stand where the ultra's do: its base outline is lumpy too (no smooth dome)
    {const p=h.attributes.position.array;const base=[];for(let i=0;i<p.length/3;i++)if(p[i*3+1]<1e-6)base.push(Math.hypot(p[i*3],p[i*3+2]));assert.ok(Math.max(...base)/Math.min(...base)>=1.15,`moss ${v} mid: lumpy base outline`);}}
  const pair=(name,fn,v=0)=>[fn(`${seed}/${name}/${v}`,pal,'ultra',v),fn(`${seed}/${name}/${v}`,pal,'high',v)];
  const span=g=>Math.max(-g.boundingBox.min.x,g.boundingBox.max.x,-g.boundingBox.min.z,g.boundingBox.max.z);
  for(const [name,fn,n] of [['flower',flowerGeometry,2],['flower-spike',flowerSpikeGeometry,2],['flower-white',whiteFlowerGeometry,3],['weed',weedGeometry,3],['clover',cloverGeometry,3],['moss',(s,p,d)=>mossGeometry(s,p,d),2]])for(let v=0;v<n;v++){
    const [u,h]=pair(name,fn,v);
    assert.ok(u.index.count>h.index.count*1.5,`${name} ${v}: ultra ${u.index.count/3} tris > high ${h.index.count/3}`);
    // (round 46: the moss ultra's blades stand over its crown by design — its body's envelope is checked above)
    if(name!=='moss')assert.ok(Math.abs(u.boundingBox.max.y-h.boundingBox.max.y)<=0.005,`${name} ${v}: ultra height ${u.boundingBox.max.y.toFixed(3)} vs high ${h.boundingBox.max.y.toFixed(3)}`);
    assert.ok(Math.abs(span(u)-span(h))<=0.1*span(h),`${name} ${v}: ultra span ${span(u).toFixed(3)} vs high ${span(h).toFixed(3)}`);
    for(const key of['position','color'])assert.ok(u.attributes[key].array.every(Number.isFinite),`${name} ${v} ultra ${key} finite`);
    // deterministic: the same seed builds the same bytes
    const again=fn(`${seed}/${name}/${v}`,pal,'ultra',v);assert.equal(hash(u.attributes.position.array),hash(again.attributes.position.array),`${name} ${v} ultra deterministic`);}
  // the ultra petals carry the petal band (geometry.ts PETAL_U) and the flowers compile it; leaves and far petals stay laminae
  const petalU=g=>{const uv=g.attributes.uv.array;let n=0;for(let i=0;i<uv.length;i+=2)if(uv[i]>=PETAL_U&&uv[i]<PETAL_U+1)n++;return n;};
  for(const [name,fn] of [['flower',flowerGeometry],['flower-spike',flowerSpikeGeometry],['flower-white',whiteFlowerGeometry]]){const [u,h]=pair(name,fn);assert.ok(petalU(u)>=100,`${name}: ${petalU(u)} petal-band vertices at ultra`);assert.equal(petalU(h),0,`${name}: none at high`);}
  for(const label of['veg-flowers','veg-flowers-yellow','veg-flowers-white']){const m=a.plants.materials.find(m=>m.name===label);const sh={vertexShader:'#include <project_vertex>\n#include <begin_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <lights_fragment_end>\n#include <roughnessmap_fragment>',uniforms:{}};m.onBeforeCompile(sh);
    assert.ok(sh.fragmentShader.includes(`vLeafUv.x >= ${PETAL_U.toFixed(1)} && vLeafUv.x < ${(PETAL_U+1).toFixed(1)}`),`${label} compiles the petal band`);assert.ok(!sh.fragmentShader.includes('vLeafUv.x < 1.5'),`${label} takes no leaf block`);}
  // the ultra broad laminae sit in the broad-lamina band (geometry.ts BROADLEAF_U) and the weeds' material compiles it
  // beside the leaf block (stronger midrib / arcing veins / cupped margin / lit edge); the high rosette stays a plain lamina
  {const {BROADLEAF_U,NOT_LAMINA}=read('vegetation/geometry'),{BROADLEAF_DETAIL}=read('vegetation/materials');
    const broadU=g=>{const uv=g.attributes.uv.array;let n=0;for(let i=0;i<uv.length;i+=2)if(uv[i]>=BROADLEAF_U&&uv[i]<BROADLEAF_U+1)n++;return n;};
    assert.ok(BROADLEAF_U>=NOT_LAMINA+1&&(BROADLEAF_U>=PETAL_U+1||BROADLEAF_U+1<=PETAL_U),'the band is clear of the stems and the petals');
    for(let v=0;v<3;v++){const [u,h]=pair('weed',weedGeometry,v);assert.ok(broadU(u)>=100&&broadU(u)>=u.attributes.uv.count*0.55,`weed ${v}: ${broadU(u)} of ${u.attributes.uv.count} vertices in the broad band at ultra`);assert.equal(broadU(h),0,`weed ${v}: none at high`);}
    assert.ok(BROADLEAF_DETAIL.rib>0.22&&BROADLEAF_DETAIL.vein>0.1&&BROADLEAF_DETAIL.margin>0.08&&BROADLEAF_DETAIL.edge>0.14,'the broad band is drawn stronger than the fern-pinna block');
    const m=a.plants.materials.find(m=>m.name==='veg-weeds');const sh={vertexShader:'#include <project_vertex>\n#include <begin_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <lights_fragment_end>\n#include <roughnessmap_fragment>',uniforms:{}};m.onBeforeCompile(sh);
    assert.ok(sh.fragmentShader.includes('vLeafUv.x < 1.5')&&sh.fragmentShader.includes(`vLeafUv.x >= ${BROADLEAF_U.toFixed(1)} && vLeafUv.x < ${(BROADLEAF_U+1).toFixed(1)}`),'veg-weeds compiles the leaf block and the broad band');
    assert.ok(sh.fragmentShader.includes(`+ ${BROADLEAF_DETAIL.rib.toFixed(2)} * rib + ${BROADLEAF_DETAIL.vein.toFixed(2)} * vein`),'the band gains are the declared constants');}
  // round 46 (survey-2 #05, checks 21 / 22: "identical spheres, no petals" at 1–5 m — the round-43 floret ball's 1 cm bells
  // fell under a pixel): the violet cluster's head at ultra / high / mid is an OPEN BLOOM of 4–6 petal cards round a centre
  // disc (petalHead: PETAL_HEAD_*), the far LOD keeps the cheap blob; the heads' radii jitter so no two match, fewer heads a clump
  {const {PETAL_HEAD_PETALS,PETAL_HEAD_REACH,PETAL_HEAD_SIZE_JITTER,PETAL_HEAD_TILT}=read('vegetation/plantgeo');
    assert.ok(PETAL_HEAD_PETALS[0]>=4&&PETAL_HEAD_PETALS[1]<=6&&PETAL_HEAD_PETALS[1]>=PETAL_HEAD_PETALS[0],'4–6 petals a head');
    assert.ok(PETAL_HEAD_REACH>=1&&PETAL_HEAD_REACH<=1.6&&PETAL_HEAD_SIZE_JITTER>=0.1&&PETAL_HEAD_TILT>0,'open blooms, sized and tilted apart');
    // every violet head at every near LOD carries a centre disc / boss (yellowish vertices) beside its violet petal cards
    for(let v=0;v<2;v++)for(const d of['ultra','high','mid']){const g=flowerGeometry(`${seed}/flower/${v}`,pal,d),c=g.attributes.color.array;let eye=0,violet=0;
      for(let i=0;i<c.length/3;i++){const [r,gg,b]=[c[i*3],c[i*3+1],c[i*3+2]];if(b>r&&b>gg*1.6)violet++;else if(r>b&&r>gg*0.8&&gg>b*1.2)eye++;}
      assert.ok(eye>=5*3&&violet>=5*PETAL_HEAD_PETALS[0]*3,`flower ${v} ${d}: ${eye} centre-disc vertices, ${violet} petal vertices`);}}
  // round 44 (survey-1 #10) — the violets: a violet hue (the palette's purples 265–290°, inside the purple metric's 255–320°
  // band with a margin; round 9's sat at 260°), smaller heads (FLOWER_HEAD_SCALE), per-head tone / hue spread from forked
  // streams (the layout stream stays: the flower-lod contracts hold), shaded undersides, thicker graded stems at high / mid,
  // and a per-clump pigment lean in plants.ts — no two heads or clumps the one blue
  {const {FLOWER_HEAD_SCALE,FLOWER_TONE_SPREAD,FLOWER_HUE_LEAN,FLOWER_UNDERSIDE,FLOWER_STEM_RADIUS}=read('vegetation/plantgeo'),{FLOWER_CLUMP_SPREAD,FLOWER_CLUMP_LEAN}=read('vegetation/plants');
    assert.ok(FLOWER_HEAD_SCALE>=0.75&&FLOWER_HEAD_SCALE<=0.9&&FLOWER_TONE_SPREAD>=0.08&&FLOWER_HUE_LEAN>=0.05&&FLOWER_UNDERSIDE>=0.5&&FLOWER_UNDERSIDE<=0.75&&FLOWER_STEM_RADIUS[0]>0.0026&&FLOWER_CLUMP_SPREAD>=0.08&&FLOWER_CLUMP_LEAN>=0.05);
    const hue=c=>{const [r,g,b]=Array.isArray(c)?c:[c.r,c.g,c.b];const M=Math.max(r,g,b),m=Math.min(r,g,b),d=M-m||1e-9;let h=M===r?((g-b)/d)%6:M===g?(b-r)/d+2:(r-g)/d+4;h*=60;return h<0?h+360:h;};
    for(const key of['purple','purpleLight','purpleDeep'])assert.ok(hue(pal[key])>=265&&hue(pal[key])<=290,`${key} hue ${hue(pal[key]).toFixed(1)}°`);
    const petals=g=>{const c=g.attributes.color.array,p=g.attributes.position.array,uv=g.attributes.uv.array,out=[];for(let i=0;i<c.length/3;i++){const [r,gg,b]=[c[i*3],c[i*3+1],c[i*3+2]];if(b>r&&b>gg*1.6)out.push({r,g:gg,b,y:p[i*3+1],lam:uv[i*2]<1.5||uv[i*2]>=PETAL_U});}return out;};
    const lum=c=>0.2126*c.r+0.7152*c.g+0.0722*c.b,mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;
    for(const [name,fn] of [['flower',flowerGeometry],['flower-spike',flowerSpikeGeometry]])for(let v=0;v<2;v++){
      const seedV=`${seed}/${name}/${v}`;const [u,h]=pair(name,fn,v);
      // the heads' violets spread in hue: the petal vertices' hue standard deviation ≥ 2° at high and at ultra (one violet before)
      for(const [d,g] of [['high',h],['ultra',u]]){const ps=petals(g);assert.ok(ps.length>=60,`${name} ${v} ${d}: ${ps.length} violet vertices`);const hs=ps.map(hue);const mh=mean(hs);const sd=Math.sqrt(mean(hs.map(x=>(x-mh)**2)));
        assert.ok(sd>=2&&mh>=262&&mh<=295,`${name} ${v} ${d}: petal hue ${mh.toFixed(1)}° ± ${sd.toFixed(1)}`);
        // the lit tops over the shaded undersides: the brightest fifth of the violet vertices ≥ 1.35 × the darkest fifth
        const ls=ps.map(lum).sort((a,b)=>a-b),n=Math.floor(ls.length/5);assert.ok(mean(ls.slice(-n))>=1.35*mean(ls.slice(0,n)),`${name} ${v} ${d}: lit ${mean(ls.slice(-n)).toFixed(3)} over shaded ${mean(ls.slice(0,n)).toFixed(3)}`);}
      // the high LOD's stems are graded (their vertices carry more than one tone) and thicker than round 43's 2.6 mm
      {const c=h.attributes.color.array,uv=h.attributes.uv.array,tones=new Set();for(let i=0;i<c.length/3;i++)if(uv[i*2]>=1.5&&uv[i*2]<2.5&&!(c[i*3+2]>c[i*3]))tones.add(`${c[i*3].toFixed(3)},${c[i*3+1].toFixed(3)}`);assert.ok(tones.size>=4,`${name} ${v}: ${tones.size} stem tones at high`);}
      // deterministic and the same layout as before this round's colour work: the mid LOD's stems land where the high LOD's do (flower-lod.test)
      assert.equal(hash(fn(seedV,pal,'high',v).attributes.position.array),hash(h.attributes.position.array));}
    // the placed clumps' pigments lean both ways (plants.ts): red / blue ratios spread ≥ 6 % across the set
    {const ratios=a.plants.flowers.items.map(it=>it.color[0]/it.color[2]);const mr=mean(ratios);assert.ok(Math.max(...ratios)/Math.min(...ratios)>=1.06&&ratios.filter(r=>r>mr).length>a.plants.flowers.items.length*0.3&&ratios.filter(r=>r<mr).length>a.plants.flowers.items.length*0.3,'clump pigments lean toward magenta and toward blue');}}
  // the bloom variation and tints are declared
  assert.ok(WHITE_BUD_SHARE>=0.1&&WHITE_BUD_SHARE<=0.35&&BROADLEAF_HUE_SPREAD>=0.05&&BROADLEAF_HUE_SPREAD<=0.15&&MOSS_RIM_GAIN<0.75&&MOSS_TOP_GAIN>1.15);
  // the ultra cushion is a cluster of lobes (MOSS_ULTRA_LOBES sub-cushions on a lobed body, ≥ 500 triangles — a smooth dome
  // with surface noise read smooth at 0.8 m), lumpy at the base ring (its radii spread) and lit from the crown down to a dark
  // rim (the vertex colours' luminance rises with y) at the high dome's mean luminance (within 12 %: no brightness pop at MOSS_ULTRA_M)
  {const {MOSS_ULTRA_LOBES,MOSS_ULTRA_RUFFLE}=read('vegetation/plantgeo');assert.ok(MOSS_ULTRA_LOBES[0]>=6&&MOSS_ULTRA_LOBES[1]>=MOSS_ULTRA_LOBES[0]&&MOSS_ULTRA_RUFFLE>=0.15,'a lobed cluster');
    for(let v=0;v<2;v++){const [u,h]=pair('moss',(s,p,d)=>mossGeometry(s,p,d),v);assert.ok(u.index.count/3>=500,`moss ${v}: ${u.index.count/3} triangles`);
      const L=g=>{const c=g.attributes.color.array;let s=0;for(let i=0;i<c.length;i+=3)s+=0.2126*c[i]+0.7152*c[i+1]+0.0722*c[i+2];return s/(c.length/3);};
      assert.ok(Math.abs(L(u)-L(h))<=0.12*L(h),`moss ${v}: mean luminance ${L(u).toFixed(3)} vs high ${L(h).toFixed(3)}`);
      assert.ok(u.boundingBox.min.y>=-1e-6,`moss ${v}: seats on y = 0`);}
    // the moss material carries the shoots' grain inside the ultra ring (materials.ts MOSS_GRAIN, gone by MOSS_ULTRA_M)
    const m=a.plants.materials.find(m=>m.name==='veg-moss');const sh={vertexShader:'#include <begin_vertex>\n#include <project_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <lights_fragment_end>\n#include <roughnessmap_fragment>',uniforms:{}};m.onBeforeCompile(sh);
    assert.ok(sh.uniforms.uMossGrainFade&&Math.abs(sh.uniforms.uMossGrainFade.value.y-MOSS_ULTRA_M)<1e-9&&sh.uniforms.uMossGrainFade.value.x<MOSS_ULTRA_M,'the grain fades out by the ultra ring');
    assert.ok(sh.fragmentShader.includes('mossNoise(vMossWorld * 180.0)'),'veg-moss compiles the grain');}
  {const g=mossGeometry(`${seed}/moss/0`,pal,'ultra'),p=g.attributes.position.array,c=g.attributes.color.array;const base=[],lum=[];
    for(let i=0;i<p.length/3;i++){const y=p[i*3+1];const l=0.2126*c[i*3]+0.7152*c[i*3+1]+0.0722*c[i*3+2];if(y<1e-6)base.push(Math.hypot(p[i*3],p[i*3+2]));lum.push([y,l]);}
    assert.ok(Math.max(...base)/Math.min(...base)>=1.15,`lumpy base outline: ${Math.min(...base).toFixed(3)}…${Math.max(...base).toFixed(3)}`);
    const rim=lum.filter(([y])=>y<0.05).map(([,l])=>l),crown=lum.filter(([y])=>y>0.35).map(([,l])=>l);
    const mean=xs=>xs.reduce((s,x)=>s+x,0)/xs.length;assert.ok(mean(crown)>=1.8*mean(rim),`lit top ${mean(crown).toFixed(3)} over dark rim ${mean(rim).toFixed(3)}`);}
}
// the trodden strip's turf (blades with trodden ≥ 0.99) against the ramp lawn beside it (trodden 0);
// round 32: the strip the grass pass grows is the corrected one (house flight + flanks exempt)
const grassMaterial=read('vegetation/materials').createVegMaterial(a.ctx,'grass');
const grass=await read('vegetation/grass').buildGrass(a.ctx,a.field,grassMaterial,new THREE.Group(),()=>{});
const strip=[],lawn=[];
for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array;
  for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<1.5||x>10||z<-10.5||z>-3)continue;
    const h=Math.hypot(m[i*16+4],m[i*16+5],m[i*16+6]),tr=a.field.troddenZone(x,z,true);if(tr>=0.99)strip.push(h);else if(tr===0)lawn.push(h);}}
const q=(arr,f)=>{const s=[...arr].sort((p,r)=>p-r);return s[Math.min(s.length-1,Math.floor(f*s.length))];};
assert.ok(strip.length>=100&&lawn.length>=500,`Turf sampled on the strip (${strip.length}) and the lawn (${lawn.length})`);
assert.ok(q(strip,1)<=0.4*q(lawn,1),`Tallest strip blade ${q(strip,1).toFixed(3)} ≤ 0.4 × tallest lawn blade ${q(lawn,1).toFixed(3)}`);
assert.ok(q(strip,0.95)<=0.4*q(lawn,0.95),`Strip p95 height ${q(strip,0.95).toFixed(3)} ≤ 0.4 × lawn p95 ${q(lawn,0.95).toFixed(3)}`);
// Path-edge softening (sheet 02): the blades in the 0.25 m band before the paving bend (local +z)
// toward the slabs and lean their roots the same way; blades further out keep a random yaw.
let rimBlades=0,rimToward=0,rimLean=0,lawnToward=0,lawnBlades=0;
for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array;
  for(let i=0;i<t.count;i++){const o=i*16,x=m[o+12],z=m[o+14];if(Math.hypot(x,z)>20)continue;
    const e=a.field.lawnEdgeDistance(x,z);if(e<0||e>1)continue;
    const gx=a.field.lawnEdgeDistance(x+0.05,z)-a.field.lawnEdgeDistance(x-0.05,z),gz=a.field.lawnEdgeDistance(x,z+0.05)-a.field.lawnEdgeDistance(x,z-0.05),gl=Math.hypot(gx,gz);if(gl<1e-6)continue;
    const toward=(-gx*m[o+8]-gz*m[o+10])/(gl*Math.hypot(m[o+8],m[o+10])||1);
    if(e<0.25){rimBlades++;if(toward>0.3)rimToward++;const up=[m[o+4],m[o+5],m[o+6]],ul=Math.hypot(...up);if((-gx*up[0]-gz*up[2])/(gl*ul)>0.1)rimLean++;}
    else{lawnBlades++;if(toward>0.3)lawnToward++;}}}
assert.ok(rimBlades>=300,`rim blades sampled: ${rimBlades}`);
assert.ok(rimToward/rimBlades>=0.85,`${(rimToward/rimBlades*100).toFixed(0)} % of the rim blades bend toward the slabs`);
assert.ok(rimLean/rimBlades>=0.6,`${(rimLean/rimBlades*100).toFixed(0)} % of the rim blades lean over the paving`);
assert.ok(lawnToward/lawnBlades<0.6,`lawn blades beyond the band keep a random yaw (${(lawnToward/lawnBlades*100).toFixed(0)} % toward)`);
// Round 13: frame 14 s' lawn band (field.ts LAWN_BAND) is dense short turf — its interior south of
// the boulder carries ≥ 150 blades / m² at ≤ 0.27 m (p95), shorter than the verge north of the boulder
{const turf=box=>{const hs=[];for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array;for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<box[0]||x>box[2]||z<box[1]||z>box[3])continue;hs.push(Math.hypot(m[i*16+4],m[i*16+5],m[i*16+6]));}}
    return{perM2:hs.length/((box[2]-box[0])*(box[3]-box[1])),p50:q(hs,0.5),p95:q(hs,0.95)};};
  const band=turf([-3.1,-8.4,-1.9,-6.6]),north=turf([-2.2,-13.5,-1.6,-11.0]);
  // (2026-09-21: the shot-D boulder's clearance disc (W23 move, take-0128) stands on the band box — its density is read
  // over the turf that is left: the box area less the disc's share of it, sampled on a 5 cm grid)
  {const b=[-3.1,-8.4,-1.9,-6.6],db=LAYOUT.heroBoulders.find(x=>x.id==='shot-d-boulder'),dr=db.clearRadius??db.radius;let inDisc=0,n=0;
    for(let x=b[0]+0.025;x<b[2];x+=0.05)for(let z=b[1]+0.025;z<b[3];z+=0.05){n++;if(Math.hypot(x-db.position[0],z-db.position[2])<dr)inDisc++;}
    band.perM2*=n/Math.max(1,n-inDisc);}
  // round 39: the base pass runs at ≈ 0.7 × density under the turf carpet (carpet.test: ≥ 3 clump cards / m² here, ≈ 200 atlas blades each), the band pass unchanged
  assert.ok(band.perM2>=110,`lawn band turf density ${band.perM2.toFixed(0)} / m²`);
  // round 40: the tufts' 0.6–1.4 × height multiplier is damped to 1 in the band (its p50 / p95 are frame 14 s' authored cut) while the
  // verge north of the boulder takes it, whose p50 (102 blades in the box) slips ≈ 2 % under the skewed product — the band stays the shorter turf (ratio 0.821)
  // round 47: the coverage fill (grass.ts INFILL_*) tufts the verge's gaps north of the boulder with turf-height blades (102 → ≈ 134 in the
  // box), which pulls its p50 down a little; the band stays the shorter turf (ratio ≤ 0.9, was 0.83 at round 40's 0.821)
  assert.ok(band.p95<=0.27&&band.p50<=0.9*north.p50,`lawn band turf p50 ${band.p50.toFixed(3)} / p95 ${band.p95.toFixed(3)} against the north verge's p50 ${north.p50.toFixed(3)}`);}
// Round 39: the rubric's W15 floor (≥ 400 000 grass instances) rests on the blade tiles, the weeds and the
// tufts alone — the always-in-the-scene-graph sets (index.ts grassInstances; the culled clump cards are not
// counted) — with a margin over the reduced base density; the blade LODs end at 26 m under the carpet
assert.ok(grass.count+a.plants.weeds.count+a.plants.tufts.count>=405000,`W15: blades ${grass.count} + weeds ${a.plants.weeds.count} + tufts ${a.plants.tufts.count} ≥ 405 000`);
// (2026-09-22, owner: the lawn past 16 m read as sparse clumps at player height — the mid blades run to 26 m)
assert.deepEqual(grass.lodDistances,[6,26,26],'blade LOD ranges (round 39; 2026-09-22: 26 m)');
// Round 40 — the owner's video review ("thinner blades, rooted clusters, varied heights"): the blades
// grow as tufts of 5–9 about a root inside 0.075 m (grass.ts scatterClusters), so a blade's mean
// neighbour count inside that radius runs well over the uniform expectation (density × π r²) — the
// round-39 scatter measured 1.1–1.4 × over the cluster noise, the tufts 1.6–2.9 ×; the per-tuft
// 0.6–1.4 × height multiplier widens the height spread (heightCV 0.516 → 0.574); the near LOD
// geometries carry aNear = 1 (the shader halves the broad sedge there), the far tile 0.
{const pc=(box,r)=>{const pts=[];for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array;for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<box[0]||x>box[2]||z<box[1]||z>box[3])continue;pts.push([x,z]);}}
    const grid=new Map(),key=(x,z)=>`${Math.floor(x/r)},${Math.floor(z/r)}`;for(const p of pts){const k=key(p[0],p[1]);(grid.get(k)??grid.set(k,[]).get(k)).push(p);}
    let nb=0;for(const p of pts){const cx=Math.floor(p[0]/r),cz=Math.floor(p[1]/r);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const q of grid.get(`${cx+dx},${cz+dz}`)??[]){if(q!==p&&Math.hypot(q[0]-p[0],q[1]-p[1])<=r)nb++;}}
    const dens=pts.length/((box[2]-box[0])*(box[3]-box[1]));return{n:pts.length,ratio:nb/pts.length/(dens*Math.PI*r*r)};};
  // round 47: the coverage fill (grass.ts INFILL_*) tufts the gaps with 5–9-blade clusters like the passes' — more blades over a box
  // (open lawn 1 993 → ≈ 2 100, the 1.5 m² verge box 102 → ≈ 166) at the same neighbour counts, so the ratio's uniform baseline
  // rises: the open lawn's floor 2.2 → 2.0, the north verge's 1.4 → 1.25 (measured 1.31); the tufts are the same rooted clusters
  // (2026-09-21: open lawn 2.0 → 1.75 — measured 1.78 since the shot-D boulder moved (take-0128; its ring's blade
  // clearing left the box, the infill's clusters spread): A / B / E were pixel-unchanged at that take)
  // (2026-09-23: open lawn 1.75 → 1.70 — measured 1.74. The walked verge pass (grass.ts VERGE_EXTRA) thickens the
  // strip within 2.4 m of the spine's paving, whose last 0.2 m clips this box's east edge: the box's MEAN density is
  // the ratio's uniform baseline, so a denser corner lowers it while every blade in it is still a rooted cluster's.)
  for(const [name,box,floor] of [['open lawn',[-8,-8,-4,-4],1.70],['east flank',[10,-3,14,1],1.6],['north verge',[-2.2,-13.5,-1.6,-11.0],1.25]]){const r=pc(box,0.075);
    assert.ok(r.n>=100&&r.ratio>=floor,`${name}: ${r.n} blades, ${r.ratio.toFixed(2)} × the uniform neighbour count inside 0.075 m (≥ ${floor})`);}
  // round 40 (Astra's "tall dark spikes" at the west ledge): the lawn's spike cap (grass.ts LAWN_SPIKE_CAP) takes the
  // 0.5–0.9 m tail off the flat lawns — the CV settles at ≈ 0.45 (0.574 uncapped) — while the tuft factor still
  // spreads the heights: on the open lawn no blade stands over 0.32 × 1.4 m, the meadow stalks are still there
  // (capped, not culled), and the p90 / p10 height ratio stays ≥ 2
  assert.ok(grass.heightCV>=0.42,`tuft heights spread the blade heights: CV ${grass.heightCV.toFixed(3)}`);
  {const hs=[],types=[0,0,0],ls=newSample();for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array,d=t.mesh.geometry.getAttribute('aData').array;for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<-8||x>-4||z<-8||z>-4)continue;a.field.sample(x,z,ls);if(ls.slope>=0.45)continue;hs.push(Math.hypot(m[i*16+4],m[i*16+5],m[i*16+6]));types[Math.floor(d[i*4+3]+1e-3)]++;}}
    assert.ok(hs.length>=1000&&types[1]>=30,`open lawn: ${hs.length} blades, ${types[1]} meadow stalks`);
    assert.ok(q(hs,1)<=0.32*1.4+1e-3,`tallest open-lawn blade ${q(hs,1).toFixed(3)} m ≤ 0.448`);
    assert.ok(q(hs,0.9)/q(hs,0.1)>=2,`open-lawn height spread p90 / p10 = ${(q(hs,0.9)/q(hs,0.1)).toFixed(2)}`);}
  for(const t of grass.tiles){assert.equal(t.lods.length,3);for(let l=0;l<3;l++){const n=t.lods[l].getAttribute('aNear');assert.ok(n&&n.array.every(v=>v===(l<2?1:0)),`LOD ${l} carries aNear = ${l<2?1:0}`);}}
  // frame 1's circled right foreground (field.ts aFace: the south bank's face 3–7 m before camera A, A 0.75–0.95 × 0.66–0.95)
  // is fine dense turf: ≥ 3 × the round-39 blades on the face (649), ≤ 6 % of them the broad sedge (11 %), median height ≥ 0.14 m (0.105)
  {const hs=[];let sedge=0;for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array,d=t.mesh.geometry.getAttribute('aData').array;for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<3.5||x>7||z<3.5||z>6.5||a.field.bankFace(x,z)<0.5)continue;if(Math.floor(d[i*4+3])===2)sedge++;hs.push(Math.hypot(m[i*16+4],m[i*16+5],m[i*16+6]));}}
    assert.ok(hs.length>=1800,`blades on the shot-A bank face: ${hs.length} (round 39: 649)`);
    assert.ok(sedge/hs.length<=0.06,`broad sedge share on the face: ${(sedge/hs.length*100).toFixed(1)} % (round 39: 11 %)`);
    assert.ok(q(hs,0.5)>=0.14&&q(hs,0.95)<=0.4,`face blade heights p50 ${q(hs,0.5).toFixed(3)} / p95 ${q(hs,0.95).toFixed(3)} (round 39: 0.105 / 0.223)`);
    // the face keeps its round-31 rule: nothing but tufts stands on it (the ferns' slope boost is what the low zone holds off)
    for(const set of a.plants.all){if(set===a.plants.tufts)continue;for(const it of set.items)if(a.field.aFace(it.x,it.z)>0.3)assert.ok(top(set,it)-it.y<=0.3,`${set.opts.name} ${(top(set,it)-it.y).toFixed(2)} m on the shot-A face at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);}}}
grassMaterial.dispose();for(const t of grass.tiles){t.mesh.dispose();for(const g of t.lods)g.dispose();}
// Round 40 — verge transitions (plants.ts / litter.ts round-40 passes): where the lawn meets the paving
// the 0.25–1.3 m outside the rim carries small ferns (≤ 0.5 m), broad leaves, short tufts and clover,
// where it meets the main flight's flank banks the same at the feet (flankZone 0.05–0.6); the paths
// stay clear (every root passed `allowed` above, the stones' 0.5 m and the trodden strip hold ≤ 0.25 m)
{const band=(set,pred=()=>true)=>set.items.filter(it=>{const e=a.field.lawnEdgeDistance(it.x,it.z,true);return e>=0.25&&e<=1.3&&pred(it);}).length;
  assert.ok(band(a.plants.ferns,it=>top(a.plants.ferns,it)-it.y<=0.5)>=76,`small ferns in the verge band: ${band(a.plants.ferns,it=>top(a.plants.ferns,it)-it.y<=0.5)} (round 39: 61)`);
  assert.ok(band(a.plants.weeds)>=980&&band(a.plants.tufts)>=1200&&band(a.plants.clover)>=1520,`broad leaves ${band(a.plants.weeds)} / tufts ${band(a.plants.tufts)} / clover ${band(a.plants.clover)} in the verge band (round 39: 862 / 984 / 1401)`);
  const fb=a.field.flankBox(),foot=set=>set.items.filter(it=>inBox(it,fb)&&a.field.flankZone(it.x,it.z)>0.05&&a.field.flankZone(it.x,it.z)<0.6).length;
  assert.ok(foot(a.plants.ferns)>=15&&foot(a.plants.weeds)>=46&&foot(a.plants.tufts)>=66&&foot(a.plants.clover)>=68,`ferns ${foot(a.plants.ferns)} / leaves ${foot(a.plants.weeds)} / tufts ${foot(a.plants.tufts)} / clover ${foot(a.plants.clover)} at the flank feet (round 39: 13 / 40 / 58 / 58)`);}
// Round 40 — the hero ferns' near-camera detail (plantgeo.ts 'ultra': bipinnate pinnae with cupped
// pinnules and a midrib, inside HERO_FERN_ULTRA_M; the tree-base audit saw flat single-colour fronds
// 2 m from the eye): a fourth LOD ahead of the round-39 three, drawn per variant (no pack collapse
// multiplies its triangles), ≥ 3 × the high LOD's triangles and the same footprint
{const {HERO_FERN_ULTRA_M,ULTRA_STEM_SIDES,STEM_UNDERSIDE,STEM_RIDGE,STEM_GRADIENT_POW,stemShade,heroFernGeometry,heroRachisTones,makePalette}=read('vegetation/plantgeo');assert.deepEqual(a.plants.heroFerns.opts.lodDistances,[HERO_FERN_ULTRA_M,16,32]);assert.ok(HERO_FERN_ULTRA_M>=4&&HERO_FERN_ULTRA_M<=8);
  // round 40 follow-up (the tree-base audit's flat wedge = the rachis at 10 cm): the ultra rachis has 7–8 sides and a
  // lengthwise gradient (plantgeo.ts heroRachisTones) — darker and warmer (higher r/g) at the foot, lit green at the
  // tip — the other LODs keep the 5 / 3-sided flat-toned tube. The gradient's end colours appear as vertex colours in
  // the ultra geometry (its rachis rings: ULTRA_STEM_SIDES vertices at v = 0 and v = 1), each scaled by the baked
  // stem shade (plantgeo.ts stemShade: the underside to STEM_UNDERSIDE, the top to 1, ± STEM_RIDGE a facet — the
  // re-rendered tile showed the ambient-lit 8-sided tube as flat as the wedge), and nowhere in the high LOD
  assert.ok(ULTRA_STEM_SIDES>=7&&ULTRA_STEM_SIDES<=8,`ultra rachis sides ${ULTRA_STEM_SIDES}`);
  assert.ok(STEM_UNDERSIDE>=0.65&&STEM_UNDERSIDE<=0.8&&STEM_RIDGE>=0.03&&STEM_RIDGE<=0.1&&STEM_GRADIENT_POW>=1&&STEM_GRADIENT_POW<=2,'stem shade constants');
  {const shades=[];for(let k=0;k<ULTRA_STEM_SIDES;k++){const under=stemShade(-1,k),top=stemShade(1,k),level=stemShade(0,k);shades.push(level/(1+STEM_UNDERSIDE)*2);
      assert.ok(Math.abs(under/top-STEM_UNDERSIDE)<1e-9&&under<level&&level<top,`facet ${k}: underside ${under.toFixed(3)} < level ${level.toFixed(3)} < top ${top.toFixed(3)}`);
      assert.ok(top<=1+STEM_RIDGE+1e-9&&under>=STEM_UNDERSIDE*(1-STEM_RIDGE)-1e-9,`facet ${k} inside the shade range`);}
    const ridges=shades.map(s=>Math.round(s*1e6)/1e6);assert.equal(new Set(ridges).size,ULTRA_STEM_SIDES,`${ULTRA_STEM_SIDES} distinct facet ridges: ${ridges.join(' ')}`);
    assert.ok(Math.max(...shades)-Math.min(...shades)>=1.6*STEM_RIDGE,`ridge spread ${(Math.max(...shades)-Math.min(...shades)).toFixed(3)}`);}
  {const pal=makePalette(WORLD.palette),{foot,tip}=heroRachisTones(pal),lum=c=>0.3*c[0]+0.59*c[1]+0.11*c[2];
    assert.ok(lum(foot)<0.8*lum(tip),`rachis foot ${lum(foot).toFixed(3)} darker than the tip ${lum(tip).toFixed(3)}`);
    assert.ok(foot[0]/foot[1]>tip[0]/tip[1]+0.05,`rachis foot warmer (r/g ${(foot[0]/foot[1]).toFixed(2)}) than the tip (${(tip[0]/tip[1]).toFixed(2)})`);
    assert.ok(tip[1]>tip[0]&&tip[1]>tip[2],'the tip is a green');
    // vertices carrying an end tone under some shade s ∈ [STEM_UNDERSIDE (1 − STEM_RIDGE), 1 + STEM_RIDGE]: the same hue, scaled
    const sLo=STEM_UNDERSIDE*(1-STEM_RIDGE)-1e-6,sHi=1+STEM_RIDGE+1e-6;
    const count=(g,c)=>{const col=g.getAttribute('color').array;let n=0,lo=9,hi=0;for(let i=0;i<col.length;i+=3){const s=col[i]/c[0];if(s>=sLo&&s<=sHi&&Math.abs(col[i+1]-c[1]*s)<1e-5&&Math.abs(col[i+2]-c[2]*s)<1e-5){n++;lo=Math.min(lo,s);hi=Math.max(hi,s);}}return {n,lo,hi};};
    for(const v of [0,1,2]){const ultra=heroFernGeometry(`${WORLD.seed}/hero-fern/${v}`,pal,'ultra'),high=heroFernGeometry(`${WORLD.seed}/hero-fern/${v}`,pal,'high');
      const f=count(ultra,foot),t=count(ultra,tip);
      assert.ok(f.n>=6*ULTRA_STEM_SIDES&&f.n%ULTRA_STEM_SIDES===0,`ultra ${v}: ${f.n} foot-tone vertices, whole ${ULTRA_STEM_SIDES}-sided rings`);
      assert.ok(t.n>=6*ULTRA_STEM_SIDES&&t.n%ULTRA_STEM_SIDES===0,`ultra ${v}: ${t.n} tip-tone vertices`);
      // the arched rachis tips lie over: their rings' undersides and tops sit ≥ 0.2 apart in shade; the steep feet stay level
      assert.ok(t.hi-t.lo>=0.2&&t.lo<STEM_UNDERSIDE+0.08&&t.hi>0.95,`ultra ${v}: tip rings shaded ${t.lo.toFixed(3)}…${t.hi.toFixed(3)}`);
      assert.ok(f.hi-f.lo>=1.5*STEM_RIDGE&&f.hi-f.lo<0.3,`ultra ${v}: foot rings ridged ${f.lo.toFixed(3)}…${f.hi.toFixed(3)}`);
      assert.equal(count(high,foot).n+count(high,tip).n,0,`high ${v}: flat stem tone`);
      ultra.dispose();high.dispose();}
    // the same for the fiddlehead stalk (the wedge in the northwest-base tile was shot D's thumb-thick bud stalk, not a
    // rachis): an ultra LOD inside FIDDLEHEAD_ULTRA_M with ULTRA_STEM_SIDES-sided graded stalks, the high LOD's layout
    const {FIDDLEHEAD_ULTRA_M,FIDDLEHEAD_DETAILS,fiddleheadGeometry,fiddleheadStalkTones}=read('vegetation/plantgeo');
    assert.deepEqual([...FIDDLEHEAD_DETAILS],['ultra','high','low']);assert.deepEqual(a.plants.fiddleheads.opts.lodDistances,[FIDDLEHEAD_ULTRA_M,14]);assert.ok(FIDDLEHEAD_ULTRA_M>=3&&FIDDLEHEAD_ULTRA_M<=8);
    for(const vp of LAYOUT.viewpoints){const [cx,cy,cz]=vp.position;assert.equal(a.plants.fiddleheads.items.filter(it=>Math.hypot(it.x-cx,it.y-cy,it.z-cz)<=FIDDLEHEAD_ULTRA_M).length,0,`${vp.id}: no fiddlehead inside the ultra range (the six views' budgets untouched)`);}
    const st=fiddleheadStalkTones(pal);assert.ok(lum(st.foot)<0.8*lum(st.tip)&&st.foot[0]/st.foot[1]>st.tip[0]/st.tip[1]+0.05,`stalk foot ${lum(st.foot).toFixed(3)} darker and warmer than its tip ${lum(st.tip).toFixed(3)}`);
    for(const v of [0,1,2]){const ultra=fiddleheadGeometry(`${WORLD.seed}/fiddlehead/${v}`,pal,'ultra'),high=fiddleheadGeometry(`${WORLD.seed}/fiddlehead/${v}`,pal,'high');
      const f=count(ultra,st.foot),t=count(ultra,st.tip);
      assert.ok(f.n>=2*ULTRA_STEM_SIDES&&f.n%ULTRA_STEM_SIDES===0&&t.n>=2*ULTRA_STEM_SIDES&&t.n%ULTRA_STEM_SIDES===0,`ultra fiddlehead ${v}: ${f.n} foot / ${t.n} tip stalk vertices in ${ULTRA_STEM_SIDES}-sided rings`);
      // the near-upright stalks: ridged all round, the lean tilting the top rings' shade a little
      assert.ok(f.hi-f.lo>=1.5*STEM_RIDGE&&t.hi-t.lo>=1.5*STEM_RIDGE&&t.hi-t.lo>f.hi-f.lo,`ultra fiddlehead ${v}: stalk rings shaded foot ${f.lo.toFixed(3)}…${f.hi.toFixed(3)}, top ${t.lo.toFixed(3)}…${t.hi.toFixed(3)}`);
      assert.equal(count(high,st.foot).n+count(high,st.tip).n,0,`high fiddlehead ${v}: flat stalk tone`);
      const ub=ultra.boundingBox,hb=high.boundingBox;assert.ok(Math.abs(ub.max.y-hb.max.y)<0.01,'the ultra bud keeps the high LOD\'s height');
      assert.ok(ultra.index.count>high.index.count&&ultra.index.count<high.index.count+400*3,`ultra bud ${ultra.index.count/3} vs high ${high.index.count/3} triangles`);
      ultra.dispose();high.dispose();}}
  assert.deepEqual(a.plants.heroFerns.packLayout.slice(0,2),[[[0],[1],[2]],[[0],[1],[2]]],'ultra and high hero ferns draw per variant');assert.equal(a.plants.tufts.opts.castShadowLods,0,'tufts cast no shadow (round 40)');
  for(const lods of a.plants.heroFerns.opts.variants){assert.equal(lods.length,4);const [ultra,high]=lods;assert.ok(ultra.index.count>=3*high.index.count,`ultra ${ultra.index.count/3} vs high ${high.index.count/3} triangles`);
    const ub=ultra.boundingBox,hb=high.boundingBox;assert.ok(Math.abs(ub.max.y-hb.max.y)<0.12&&Math.abs((ub.max.x-ub.min.x)-(hb.max.x-hb.min.x))<0.25,'the ultra frond keeps the high LOD\'s silhouette');}}
// dirt-seam litter along the rim (sheet 02 “Path boundary”), none of it on the slabs
{const litterMaterial=read('vegetation/materials').createVegMaterial(a.ctx,'litter'),litter=read('vegetation/litter').buildLitter(a.ctx,a.field,litterMaterial,new THREE.Group());
  const seam=litter.leaves.items.concat(litter.twigs.items).filter(it=>{const e=a.field.lawnEdgeDistance(it.x,it.z);return e>=0&&e<=0.3&&a.field.stairDistance(it.x,it.z)>0.1;});
  assert.ok(seam.length>=250,`litter in the rim seam: ${seam.length}`);
  // the seam runs along the plaza discs and collects at the bank toe as well (the rim there is grass, not moss)
  assert.ok(seam.filter(it=>a.field.bankFace(it.x,it.z)>0.3).length>=10,`seam litter at the bank toe: ${seam.filter(it=>a.field.bankFace(it.x,it.z)>0.3).length}`);
  // round 40: the leaf drift keeps collecting through the lawn's first 1.3 m beyond the seam (the verge transition), thinning into the lawn
  const drift=(lo,hi)=>litter.leaves.items.concat(litter.twigs.items).filter(it=>{const e=a.field.lawnEdgeDistance(it.x,it.z,true);return e>=lo&&e<=hi&&a.field.stairDistance(it.x,it.z)>0.1;}).length;
  // round 56: the south exit's path paves the band's arc round the spine's old end cap (its west side); expansionCull
  // prunes the 27 leaves and twigs there (655 → 628)
  assert.ok(drift(0.3,1.3)>=610,`litter in the verge band beyond the seam: ${drift(0.3,1.3)} (round 39: 554)`);
  assert.ok(drift(0.3,0.8)>drift(0.8,1.3),`the drift thins into the lawn: ${drift(0.3,0.8)} in 0.3–0.8 m against ${drift(0.8,1.3)} in 0.8–1.3 m`);
  const sample=newSample();for(const it of litter.twigs.items){a.field.sample(it.x,it.z,sample);assert.ok(a.field.allowed(it.x,it.z,sample),'twigs never lie on the paving');}
  for(const it of seam){a.field.sample(it.x,it.z,sample);assert.ok(a.field.allowed(it.x,it.z,sample)||it.y-a.ctx.terrain.height(it.x,it.z)>0.03,'seam litter is grass-seated; only the lifted sprinkle lies on slabs');}
  // round 39: the leaves keep every instance submitted (cull: false, the B3 claim) but switch to a cheap
  // lamina past LEAF_FAR_M (round 43: the two-triangle fold, 17 K a view under the four-triangle curved one); the far lamina keeps the near one's footprint (same length / heading from one stream)
  // round 43: an ultra tier ahead of both inside LITTER_ULTRA_M (curled, cupped, veined laminae and skeletons; twigs
  // with bark grain, knots and an acorn / seed pod), from the same stream, packed into one draw
  const {LEAF_FAR_M,LITTER_ULTRA_M,TWIG_ULTRA_M,SKELETON_SHARE,TWIG_GRAIN}=read('vegetation/litter');
  assert.ok(LITTER_ULTRA_M>=2&&LITTER_ULTRA_M<=5&&LITTER_ULTRA_M<LEAF_FAR_M&&TWIG_ULTRA_M>=1.5&&TWIG_ULTRA_M<=LITTER_ULTRA_M,'litter ultra rings 2–5 m, the twigs\' no wider than the leaves\'');
  assert.equal(litter.leaves.opts.cull,false,'leaves are never trimmed to the frame');
  assert.deepEqual(litter.leaves.opts.lodDistances,[LITTER_ULTRA_M,LEAF_FAR_M],'leaf ultra ring, then the far LOD at LEAF_FAR_M');
  assert.deepEqual(litter.twigs.opts.lodDistances,[TWIG_ULTRA_M]);assert.equal(litter.leaves.opts.nearLods,1);assert.equal(litter.twigs.opts.nearLods,1);
  // round 44: the north corridor's litter — the disc sets' geometry and LODs in culled, range-cut sets
  {const {NORTH_TWIG_MAX_M,NORTH_LEAF_MAX_M}=read('vegetation/litter');
    assert.ok(NORTH_TWIG_MAX_M>=25&&NORTH_TWIG_MAX_M<=40&&NORTH_LEAF_MAX_M>=NORTH_TWIG_MAX_M&&NORTH_LEAF_MAX_M<=60,'north litter cuts: twigs 25–40 m, leaves no nearer');
    assert.equal(litter.northTwigs.opts.maxDistance,NORTH_TWIG_MAX_M);assert.equal(litter.northLeaves.opts.maxDistance,NORTH_LEAF_MAX_M);
    assert.equal(litter.twigs.opts.maxDistance,undefined);assert.equal(litter.leaves.opts.maxDistance,undefined,'the disc litter is never cut');
    assert.strictEqual(litter.northTwigs.opts.variants,litter.twigs.opts.variants,'north twigs: the disc twigs\' geometry');assert.deepEqual(litter.northTwigs.opts.lodDistances,[TWIG_ULTRA_M]);
    assert.deepEqual(litter.northLeaves.opts.lodDistances,[LITTER_ULTRA_M,LEAF_FAR_M]);assert.deepEqual(litter.northLeaves.packLayout,[[[0,1,2,3]],[[0],[1],[2],[3]],[[0,1],[2,3]]],'north leaves: far folds in pairs');
    assert.deepEqual(litter.northTwigs.packLayout,[[[0,1,2]],[[0,1,2]]],'north twigs: one draw a LOD');
    // round 46 (survey-2 #06): the north pass floors the disc falloff at NORTH_LITTER_REACH_FLOOR — the hollow floor and the
    // plain are strewn to 25 m (≈ 6.4 K leaves, was ≈ 4.7 K ≤ 6 000); its leaves' far LOD lies FLAT on the floor (the fold's
    // clipped sliver read as a raised chip) and every piece seats on the exact terrain height and normal
    // round 48: the far-floor pass strews the plain past the round-44 pass' reach to z ≈ −95 (+ ≈ 2 K leaves, ≈ 200 twigs)
    assert.ok(litter.northTwigs.count>=300&&litter.northTwigs.count<=1200&&litter.northLeaves.count>=3000&&litter.northLeaves.count<=11000,`north litter ${litter.northTwigs.count} twigs, ${litter.northLeaves.count} leaves`);
    {const far=litter.northLeaves.items.filter(it=>it.z<-84&&it.z>-96&&Math.abs(it.x+1.5)<14).length;assert.ok(far>=400,`${far} far-floor leaves past z −84`);
      const pad=litter.northLeaves.items.filter(it=>it.x>-3.1&&it.x<1.7&&it.z>-79.8&&it.z<-76.8).length;assert.ok(pad<=40,`${pad} leaves left on the terrace pad`);}
    {const {NORTH_LITTER_REACH_FLOOR,NORTH_LITTER_LIFT}=read('vegetation/litter');assert.ok(NORTH_LITTER_REACH_FLOOR>=0.75&&NORTH_LITTER_LIFT<=0.002);
      const onPath=it=>{a.field.sample(it.x,it.z,sampleN);return sampleN.path>0.5;};const sampleN=newSample();const nrm=new THREE.Vector3();
      for(const it of litter.northLeaves.items){if(onPath(it))continue;const gap=it.y-a.ctx.terrain.height(it.x,it.z);assert.ok(Math.abs(gap-NORTH_LITTER_LIFT)<5e-5,`north leaf ${gap.toFixed(5)} m over the ground (float32 seat)`);
        a.ctx.terrain.normal(it.x,it.z,nrm);const uy=[it.matrix[4],it.matrix[5],it.matrix[6]],l=Math.hypot(...uy);assert.ok(Math.abs(uy[0]/l-nrm.x)<1e-4&&Math.abs(uy[1]/l-nrm.y)<1e-4&&Math.abs(uy[2]/l-nrm.z)<1e-4,'north leaf up = the exact terrain normal');}
      for(const [,,flat] of litter.northLeaves.opts.variants){flat.computeBoundingBox();const fb=flat.boundingBox;assert.equal(flat.index.count/3,2,'north far leaf: two triangles');assert.ok(fb.min.y>=0&&fb.max.y<=0.012,`north far leaf lies flat: y ${fb.min.y.toFixed(4)}…${fb.max.y.toFixed(4)}`);}
      for(const [ultra,near] of litter.northLeaves.opts.variants){assert.equal(near.index.count/3,14);assert.ok(ultra.index.count/3>=28);}}
    assert.ok(litter.northTwigs.items.every(it=>it.z<-15)&&litter.northTwigs.items.some(it=>it.z<-56),'north twigs lie north of the plaza, some past the arch');
    // (round 48: the far-floor pass' twigs lie past the field grid's north edge — held to the exact terrain mask)
    const sample=newSample();for(const it of litter.northTwigs.items){a.field.sample(it.x,it.z,sample);assert.ok(it.z<NORTH_GATE_Z?a.ctx.terrain.vegetationAllowed(it.x,it.z):a.field.allowed(it.x,it.z,sample),'north twigs never lie on the paving');}
    assert.equal(litter.count,litter.leaves.count+litter.northLeaves.count+litter.twigs.count+litter.northTwigs.count+litter.roots.count,'every litter piece audited once');}
  assert.deepEqual(litter.leaves.packLayout[0],[[0,1,2,3]],'ultra leaves in one draw');assert.deepEqual(litter.leaves.packLayout[1],[[0],[1],[2],[3]],'near leaves per variant');
  for(const [ultra,near,far] of litter.leaves.opts.variants){assert.equal(near.index.count/3,14);assert.equal(far.index.count/3,2,'far leaf: the two-triangle fold');
    assert.ok(ultra.index.count/3>=28&&ultra.index.count/3<=130,`ultra leaf ${ultra.index.count/3} triangles`);
    ultra.computeBoundingBox();near.computeBoundingBox();far.computeBoundingBox();const ub=ultra.boundingBox,nb=near.boundingBox,fb=far.boundingBox;
    assert.ok(Math.abs((nb.max.x-nb.min.x)-(fb.max.x-fb.min.x))<0.03&&Math.abs((nb.max.z-nb.min.z)-(fb.max.z-fb.min.z))<0.03,'far leaf keeps the near footprint');
    assert.ok(Math.abs((ub.max.x-ub.min.x)-(nb.max.x-nb.min.x))<0.03&&Math.abs((ub.max.z-ub.min.z)-(nb.max.z-nb.min.z))<0.03,'ultra leaf keeps the near footprint');
    assert.ok(ub.max.y<=nb.max.y+0.02&&ub.min.y>=-0.002,`ultra leaf keeps the near arch (y ${ub.min.y.toFixed(3)}…${ub.max.y.toFixed(3)} vs ${nb.max.y.toFixed(3)})`);
    for(const key of['position','color','uv'])assert.ok(ultra.attributes[key].array.every(Number.isFinite),`ultra leaf ${key} finite`);}
  assert.ok(SKELETON_SHARE>0&&SKELETON_SHARE<0.3);assert.ok(TWIG_GRAIN.sides>=5);
  for(const [ultra,near] of litter.twigs.opts.variants){assert.ok(ultra.index.count>near.index.count*2,`ultra twig ${ultra.index.count/3} tris > ${near.index.count/3}`);
    ultra.computeBoundingBox();near.computeBoundingBox();assert.ok(ultra.boundingBox.max.y<=near.boundingBox.max.y+0.012,'ultra twig stays low');
    for(const key of['position','color'])assert.ok(ultra.attributes[key].array.every(Number.isFinite),`ultra twig ${key} finite`);}
  const again=read('vegetation/litter').buildLitter(a.ctx,a.field,litterMaterial,new THREE.Group());
  for(let v=0;v<litter.leaves.opts.variants.length;v++)assert.equal(hash(litter.leaves.opts.variants[v][0].attributes.position.array),hash(again.leaves.opts.variants[v][0].attributes.position.array),'ultra leaf deterministic');
  for(const set of again.all)for(const vv of set.opts.variants)for(const g of vv)g.dispose();
  const camA=new THREE.Vector3(0.4,1.8,8.6);litter.leaves.update(camA,true);
  const sub=litter.leaves.submission();assert.equal(sub.reduce((n,m)=>n+m.mesh.count,0),litter.leaves.count,'every leaf submitted from camera A');
  assert.ok(sub.filter(m=>m.lod===2).reduce((n,m)=>n+m.mesh.count,0)>=0.9*litter.leaves.count,'≥ 90 % of the leaves are past LEAF_FAR_M from camera A');
  assert.ok(sub.filter(m=>m.lod===0).reduce((n,m)=>n+m.mesh.count,0)<=40,'≤ 40 ultra leaves inside the ring from camera A (15 at 2.5 m; 99 at 4 m)');
  // the litter material compiles the dry-leaf block
  {const sh={vertexShader:'#include <project_vertex>\n#include <begin_vertex>\n#include <worldpos_vertex>',fragmentShader:'#include <color_fragment>\n#include <lights_fragment_end>',uniforms:{}};
    read('vegetation/materials').createVegMaterial(a.ctx,'litter',{leafDetail:true}).onBeforeCompile(sh);assert.ok(sh.fragmentShader.includes('vLeafUv.x < 1.5')&&sh.fragmentShader.includes('vegLeafTrans = leafFade * 0.4 * v;'),'litter block');}
  litterMaterial.dispose();for(const set of litter.all)for(const v of set.opts.variants)for(const g of v)g.dispose();}
// round 48 (vegetation-26): the ground north of the log arch — the second clearing's banks, the ledge terrace's pad, the
// standing stones' feet and the forest floor beyond the tunnel (plants.ts NORTH_BUSH_MAX_M …; field.ts NORTH_ZONE_Z)
{const P=a.plants,N=P.north;
  // the clearing banks' shrubs and the pad's tufts are their own sets (the disc bushes draw their far LOD at any range,
  // the disc tufts back the B3 claim), the disc sets' geometry and material, cut like the north ferns; both north of the gate
  assert.strictEqual(P.bushesNorth.opts.variants,P.bushes.opts.variants);assert.strictEqual(P.bushesNorth.opts.material,P.bushes.opts.material);
  assert.ok(P.bushesNorth.opts.maxDistance>=30&&P.bushesNorth.opts.maxDistance<=40,`north bushes cut at ${P.bushesNorth.opts.maxDistance} m`);
  assert.strictEqual(P.tuftsNorth.opts.variants,P.tufts.opts.variants);assert.equal(P.tuftsNorth.opts.maxDistance,P.tufts.opts.maxDistance);
  for(const set of[P.bushesNorth,P.tuftsNorth])for(const it of set.items)assert.ok(it.z<NORTH_GATE_Z,`${set.opts.name} at z ${it.z} is north of the gate`);
  // (1) the banks: dark ferns off the paving, thickest in the first two metres, the two authored clumps at the terrace flanks
  const inBox=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
  const bankFerns=P.fernsNorth.items.filter(it=>inBox(it,[-11,-84,11,-60])&&Math.hypot(it.x+1.5,it.z+69.8)>4.6);
  assert.ok(N.clearingFerns>=150&&bankFerns.length>=N.clearingFerns,`${N.clearingFerns} clearing-bank ferns (${bankFerns.length} north ferns in the box)`);
  for(const [fx,fz] of[[-3.5,-78.5],[2.4,-79.0]]){const n=P.fernsNorth.items.filter(it=>Math.hypot(it.x-fx,it.z-fz)<1.4).length;assert.ok(n>=6,`terrace-flank clump at (${fx}, ${fz}): ${n} fronds`);}
  assert.ok(N.flankFerns>=12,`${N.flankFerns} flank ferns`);
  assert.ok(N.clearingBushes>=6&&N.clearingBushes<=60,`${N.clearingBushes} clearing shrubs`);
  for(const it of P.bushesNorth.items)assert.ok(Math.hypot(it.x+1.5,it.z+69.8)>4.6+1.8,`shrub ${it.x}, ${it.z} stays off the clearing's rim`);
  // the ferns' tint is ref-04's dark green: the bank fronds (this pass' 0.76 × among the round-44 corridor ferns' 0.94 ×) are mostly dark
  const dark=bankFerns.filter(it=>it.color[1]<0.85).length;assert.ok(dark>=0.6*bankFerns.length,`${dark} of ${bankFerns.length} bank fronds dark`);
  // (2) the terrace pad: tufts and clover a Kokiri stands on, short at her feet
  const pad=[-3.1,-79.8,1.7,-76.8];const padTufts=P.tuftsNorth.items.filter(it=>inBox(it,pad));
  assert.ok(N.padTufts>=40&&padTufts.length>=0.6*P.tuftsNorth.count,`${N.padTufts} pad tufts (${padTufts.length} on the pad of ${P.tuftsNorth.count})`);
  for(const it of P.tuftsNorth.items){assert.ok(it.variant%3<2,'no tall tuft on the pad');if(Math.hypot(it.x+0.6,it.z+78.4)<0.9)assert.equal(it.variant%3,0,'short tufts at the Kokiri feet');}
  assert.ok(N.padClover>=20,`${N.padClover} pad clover`);
  // (3) moss cushions at every standing stone's foot, in the ring off its footprint
  for(const st of STONE_CIRCLE_STONES){const n=P.moss.items.filter(it=>{const d=Math.hypot(it.x-st.x,it.z-st.z);return d>=0.3&&d<0.7;}).length;assert.ok(n>=5,`stone (${st.x.toFixed(2)}, ${st.z.toFixed(2)}): ${n} moss cushions at its foot`);}
  assert.ok(N.stoneMoss>=5*STONE_CIRCLE_STONES.length,`${N.stoneMoss} stone-foot cushions`);
  // (4) the far floor: a low herb carpet past the clearing (z −83 … −95, where the round-44 pass' reach ran out) and ferns at the trees' feet
  const farHerbs=[...P.weedsNorth.items,...P.clover.items,...P.moss.items].filter(it=>it.z<-83&&it.z>-96&&Math.abs(it.x+1.5)<12).length;
  assert.ok(N.farHerbs>=300&&farHerbs>=60,`${N.farHerbs} far-floor herbs (${farHerbs} past z −83)`);
  assert.ok(N.farFeet>=1&&N.farFootFerns>=N.farFeet*4,`${N.farFootFerns} ferns at ${N.farFeet} far tree feet`);
  // nothing north seats inside the standing stones' footprints or on the north paving (the moss ring excepted above)
  for(const set of[P.fernsNorth,P.weedsNorth,P.clover,P.bushesNorth,P.tuftsNorth])for(const it of set.items)if(it.z<NORTH_GATE_Z)assert.ok(stoneDistance(it.x,it.z)>=0.3,`${set.opts.name} off the standing stones`);
  // (5) a prop footprint published before the build (ctx.shared.propFootprints) rejects every standing plant inside it — the
  // disc streams' too (fable-3's fern through the pot); the footprint here sits in the shot-D fern bank
  const foot={x:-3.9,z:-11.4,r:0.9};const inside=set=>set.items.filter(it=>Math.hypot(it.x-foot.x,it.z-foot.z)<foot.r).length;
  const before=inside(P.ferns)+inside(P.weeds)+inside(P.tufts);assert.ok(before>=3,`${before} disc plants stand in the test footprint before it is published`);
  const c=make({propFootprints:[foot]});
  for(const set of[c.plants.ferns,c.plants.heroFerns,c.plants.fiddleheads,c.plants.tufts,c.plants.flowers,c.plants.whiteFlowers,c.plants.weeds,c.plants.seedheads,c.plants.fernsNorth,c.plants.weedsNorth,c.plants.bushesNorth,c.plants.tuftsNorth])assert.equal(inside(set),0,`${set.opts.name}: none inside the published footprint`);
  assert.ok(c.plants.north.propRejected>=before,`${c.plants.north.propRejected} rejected by the footprint`);
  // the footprint moves nothing else: every fern outside it keeps its seat
  const outside=set=>set.items.filter(it=>Math.hypot(it.x-foot.x,it.z-foot.z)>=foot.r).map(it=>`${it.x},${it.z}`).join('|');
  assert.equal(outside(c.plants.ferns),outside(P.ferns),'the disc ferns outside the footprint are the same');
  {const geos=new Set();c.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of c.plants.materials)m.dispose();}}
for(const fixture of[a,b]){const geos=new Set();fixture.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of fixture.plants.materials)m.dispose();}
console.log(JSON.stringify({passed:true,checkedVertices,checkedBases,shadowMeshes,bushes:a.plants.bushes.count,stripBlades:strip.length,stripHeightRatio:Math.round(q(strip,0.95)/q(lawn,0.95)*1000)/1000,note:'CPU geometry/placement contracts only; GPU capture and foliage appearance still require review.'}));
