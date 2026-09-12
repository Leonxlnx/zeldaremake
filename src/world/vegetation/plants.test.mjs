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
function make(){const ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5}};
  const group=new THREE.Group(),field=new VegField(ctx,WORLD.detailRadius+6,.5);return{ctx,group,field,plants:read('vegetation/plants').buildPlants(ctx,field,group)};
}
const a=make(),b=make();
const hash=array=>createHash('sha256').update(Buffer.from(array.buffer,array.byteOffset,array.byteLength)).digest('hex');
let checkedVertices=0,checkedBases=0,shadowMeshes=0;
for(let j=0;j<a.plants.all.length;j++){
  const first=a.plants.all[j],second=b.plants.all[j];assert.equal(first.count,second.count);
  assert.ok(first.count>0,`${first.opts.name} must be present`);
  for(let i=0;i<first.count;i++){
    const item=first.items[i];assert.deepEqual(item,second.items[i],'Fresh seed/terrain reproduces transforms, variant and pigment');
    const sample=a.field.sample(item.x,item.z,newSample());
    assert.ok(a.field.allowed(item.x,item.z,sample),'Placed root obeys original field exclusions');
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
assert.ok(a.plants.bushes.items.filter(it=>it.x>-7.5&&it.x<-2&&it.z>-23&&it.z<-14).length>=4,'Shrub mass on the boulder bank west of the north path (shot D left-centre)');
// reference-driven composition constraints (see plants.ts / field.ts zones)
const top=(set,it)=>{const g=set.opts.variants[it.variant][0];return it.y+g.boundingBox.max.y*Math.hypot(it.matrix[4],it.matrix[5],it.matrix[6]);};
// the hedge set holds two scatters: the door-side row of shot A/B (z <= -5.1) and, since round 12,
// the crest of the south bank behind the shot-A kid (box (6.0, 3.9)-(8.6, 5.6), crowns up to ~2.4 m
// with the bank's 1.15 m crest) - only the door-side row is bound by Saria's threshold.
const doorHedge=a.plants.hedge.items.filter(it=>it.z<=-3),bankHedge=a.plants.hedge.items.filter(it=>it.z>-3);
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
const inBox=(it,b)=>it.x>=b[0]&&it.z>=b[1]&&it.x<=b[2]&&it.z<=b[3];
// pinhole projection of the layout cameras (vertical fov, 16:9, +Y up) — the gauntlet's maths
const camera=id=>{const v=LAYOUT.viewpoints.find(v=>v.id===id),p=v.position,f=[v.target[0]-p[0],v.target[1]-p[1],v.target[2]-p[2]],fl=Math.hypot(...f),fw=f.map(c=>c/fl);
  let r=[-fw[2],0,fw[0]];const rl=Math.hypot(...r);r=r.map(c=>c/rl);const u=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];const th=Math.tan(v.fov*Math.PI/360),aspect=16/9;
  return w=>{const d=[w[0]-p[0],w[1]-p[1],w[2]-p[2]],z=d[0]*fw[0]+d[1]*fw[1]+d[2]*fw[2];if(z<=0.05)return null;
    return{sx:0.5+0.5*((d[0]*r[0]+d[1]*r[1]+d[2]*r[2])/z)/(th*aspect),sy:0.5-0.5*((d[0]*u[0]+d[1]*u[1]+d[2]*u[2])/z)/th,depth:z,perM:0.5/(z*th*aspect)};};};
const reach=(set,it)=>{const b=set.opts.variants[it.variant][0].boundingBox;return Math.max(-b.min.x,b.max.x,-b.min.z,b.max.z)*Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]);};
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
const dHero=a.plants.heroFerns.items.filter(it=>Math.hypot(it.x+3.7,it.z+10.3)<1.6);
assert.ok(dHero.length>=3,'Hero fern crowns west of the shot-D boulder');
for(const it of dHero){const p=camD([it.x,it.y,it.z]),h=top(a.plants.heroFerns,it)-it.y;
  assert.ok(p&&p.sx>=-0.02&&p.sx<=0.16&&p.sy>=0.6&&p.sy<=0.74,`Hero crown root projects into D's left box, got (${p?.sx.toFixed(2)},${p?.sy.toFixed(2)})`);
  assert.ok(h>=0.65&&h<=1.05,`Hero crown ${h.toFixed(2)} m tall`);}
assert.ok(a.plants.yellowFlowers.items.filter(it=>Math.hypot(it.x+3.7,it.z+10.1)<1.6).length>=4,'Pale-yellow blooms in the shot-D clump');
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
// at most 40 % of the lawn's height (grass checked below).
const {houseSteppingStones}=read('layout'),stones=houseSteppingStones();
assert.ok(stones.length>=6,'Stepping stones present on the house branch');
const stoneDist=(x,z)=>Math.min(...stones.map(s=>Math.hypot(x-s.x,z-s.z)-s.r));
for(const set of a.plants.all)for(const it of set.items){
  if(stoneDist(it.x,it.z)<0.5)assert.ok(top(set,it)-it.y<=0.3,`${set.opts.name} ${(top(set,it)-it.y).toFixed(2)} m tall within 0.5 m of a stepping stone at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);
  if(a.field.troddenZone(it.x,it.z)>0.6)assert.ok(top(set,it)-it.y<=0.3,`${set.opts.name} standing in the trodden strip at (${it.x.toFixed(2)},${it.z.toFixed(2)})`);}
for(const s of stones){const n=a.plants.clover.items.filter(it=>{const d=Math.hypot(it.x-s.x,it.z-s.z)-s.r;return d>=0&&d<=0.3;}).length;
  assert.ok(n>=4,`Clover fringe at the stepping stone (${s.x.toFixed(2)},${s.z.toFixed(2)}): ${n} tufts`);}
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
const dTall=it=>Math.hypot(it.x+2.6,it.z+9.6)<2.2&&it.x<-3.2;
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
  assert.equal(sh.uniforms.uTopRoughness.value,0.55,'waxy top face roughness 0.55');assert.match(sh.fragmentShader,/roughnessFactor = gl_FrontFacing \? uTopRoughness : roughnessFactor;/);assert.ok(weedMat.roughness>=0.85,'matte underside');}
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
{const bs=newSample();for(const set of a.plants.all)for(const it of set.items){if(a.field.bankFace(it.x,it.z)<=0.3)continue;a.field.sample(it.x,it.z,bs);
  assert.ok(bs.slope<=0.2,`${set.opts.name} on the shot-A bank face at (${it.x.toFixed(2)},${it.z.toFixed(2)}), slope ${bs.slope.toFixed(2)}`);}}
// Round 13 — foreground framing (owner boards 01 / 02 / 06 / 08; frames 1 s / 14 s / 46 s / 56 s).
const scaleOf=it=>Math.hypot(it.matrix[0],it.matrix[1],it.matrix[2]),kidSpots=[...LAYOUT.npcSpots.map(n=>[n.position[0],n.position[2]]),[4.96,5.29],[6.21,3.2]];
const kidClear=(it,r)=>kidSpots.every(([x,z])=>Math.hypot(it.x-x,it.z-z)>=r);
// (2) frame 14 s' lawn band (field.ts LAWN_BAND, the near west verge): no fern clumps but the shot-D
// boulder ring's, clover, three moss cushions for the mossy stones, and ≥ 8 white dots that read past
// the kid in B's band box (sx ≥ 0.075, 0.6–0.86); every dot still keeps its clearances (checked above)
const dBoulder=LAYOUT.heroBoulders.find(b=>b.id==='shot-d-boulder'),bandBox=a.field.lawnBandBox();
for(const it of a.plants.ferns.items)if(a.field.lawnBand(it.x,it.z)>0.5)assert.ok(Math.hypot(it.x-dBoulder.position[0],it.z-dBoulder.position[2])-dBoulder.radius<=1.15,`fern clump in the lawn band at (${it.x.toFixed(2)},${it.z.toFixed(2)}) is not the boulder ring's`);
assert.ok(a.plants.clover.items.filter(it=>inBox(it,bandBox)).length>=60,'clover through the lawn band');
const bandMoss=a.plants.moss.items.filter(it=>inBox(it,bandBox)&&reach(a.plants.moss,it)>=0.25);
assert.ok(bandMoss.length>=3&&bandMoss.every(it=>top(a.plants.moss,it)-it.y<=0.2&&a.field.lawnEdgeDistance(it.x,it.z)>=0.3),`mossy "stones" in the lawn band: ${bandMoss.length}`);
assert.ok(whites.items.filter(it=>{const p=camB([it.x,it.y,it.z]);return p&&p.depth<14&&p.sx>=0.075&&p.sx<=0.3&&p.sy>=0.6&&p.sy<=0.86;}).length>=8,'white dots past the kid in B\'s lawn band');
// (1)/(3) the west verge bed: frame 1 s' left edge and frame 56's bottom-left cluster on the verge
// north of the boulder — ferns, purple clumps and broad leaves that project into D's 0–0.22 × 0.56–0.74
const westBed=[-4.8,-16.5,-2.3,-11.2],inD=(set,it,b)=>inFrame(camD,set,it,b);
const bedFerns=a.plants.ferns.items.filter(it=>inBox(it,westBed));
assert.ok(bedFerns.length>=12&&bedFerns.filter(it=>inD(a.plants.ferns,it,[-0.02,0.5,0.24,0.74])).length>=8,`fern cluster on the west verge bed: ${bedFerns.length}`);
assert.ok(a.plants.flowers.items.filter(it=>inBox(it,westBed)&&inD(a.plants.flowers,it,[-0.02,0.5,0.28,0.76])).length>=40,'purple clumps through the west verge bed (frame 56 / frame 1 left edge)');
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
assert.ok(a.plants.weeds.items.filter(it=>inBox(it,[3.6,-5.8,6.8,-3.4])&&scaleOf(it)>=1.05&&inFrame(camC,a.plants.weeds,it,[-0.02,0.76,0.34,1.02])).length>=16,'broad-leaf clusters in C\'s foreground');
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
  for(const set of a.plants.all){set.update(new THREE.Vector3().fromArray(p),true);assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),set.count);}
}
// the pack layout: the round-13 trade (flowers mid LOD in pairs, near weeds / fiddleheads per variant) holds
assert.deepEqual(a.plants.flowers.packLayout[1],[[0,1],[2,3]],'flower mid LOD pairs the heads and the spikes');
assert.deepEqual(a.plants.weeds.packLayout[0],[[0],[1],[2]],'near weeds draw per variant');
assert.deepEqual(a.plants.fiddleheads.packLayout,[[[0],[1],[2]],[[0,1,2]]],'fiddleheads: per variant near, one far draw');
// the trodden strip's turf (blades with trodden ≥ 0.99) against the ramp lawn beside it (trodden 0)
const grassMaterial=read('vegetation/materials').createVegMaterial(a.ctx,'grass');
const grass=await read('vegetation/grass').buildGrass(a.ctx,a.field,grassMaterial,new THREE.Group(),()=>{});
const strip=[],lawn=[];
for(const t of grass.tiles){const m=t.mesh.instanceMatrix.array;
  for(let i=0;i<t.count;i++){const x=m[i*16+12],z=m[i*16+14];if(x<1.5||x>10||z<-10.5||z>-3)continue;
    const h=Math.hypot(m[i*16+4],m[i*16+5],m[i*16+6]),tr=a.field.troddenZone(x,z);if(tr>=0.99)strip.push(h);else if(tr===0)lawn.push(h);}}
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
  assert.ok(band.perM2>=150,`lawn band turf density ${band.perM2.toFixed(0)} / m²`);
  assert.ok(band.p95<=0.27&&band.p50<=0.8*north.p50,`lawn band turf p50 ${band.p50.toFixed(3)} / p95 ${band.p95.toFixed(3)} against the north verge's p50 ${north.p50.toFixed(3)}`);}
grassMaterial.dispose();for(const t of grass.tiles){t.mesh.dispose();for(const g of t.lods)g.dispose();}
// dirt-seam litter along the rim (sheet 02 “Path boundary”), none of it on the slabs
{const litterMaterial=read('vegetation/materials').createVegMaterial(a.ctx,'litter'),litter=read('vegetation/litter').buildLitter(a.ctx,a.field,litterMaterial,new THREE.Group());
  const seam=litter.leaves.items.concat(litter.twigs.items).filter(it=>{const e=a.field.lawnEdgeDistance(it.x,it.z);return e>=0&&e<=0.3&&a.field.stairDistance(it.x,it.z)>0.1;});
  assert.ok(seam.length>=250,`litter in the rim seam: ${seam.length}`);
  // the seam runs along the plaza discs and collects at the bank toe as well (the rim there is grass, not moss)
  assert.ok(seam.filter(it=>a.field.bankFace(it.x,it.z)>0.3).length>=10,`seam litter at the bank toe: ${seam.filter(it=>a.field.bankFace(it.x,it.z)>0.3).length}`);
  const sample=newSample();for(const it of litter.twigs.items){a.field.sample(it.x,it.z,sample);assert.ok(a.field.allowed(it.x,it.z,sample),'twigs never lie on the paving');}
  for(const it of seam){a.field.sample(it.x,it.z,sample);assert.ok(a.field.allowed(it.x,it.z,sample)||it.y-a.ctx.terrain.height(it.x,it.z)>0.03,'seam litter is grass-seated; only the lifted sprinkle lies on slabs');}
  litterMaterial.dispose();for(const set of litter.all)for(const v of set.opts.variants)for(const g of v)g.dispose();}
for(const fixture of[a,b]){const geos=new Set();fixture.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of fixture.plants.materials)m.dispose();}
console.log(JSON.stringify({passed:true,checkedVertices,checkedBases,shadowMeshes,bushes:a.plants.bushes.count,stripBlades:strip.length,stripHeightRatio:Math.round(q(strip,0.95)/q(lawn,0.95)*1000)/1000,note:'CPU geometry/placement contracts only; GPU capture and foliage appearance still require review.'}));
