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
assert.ok(a.plants.hedge.count>=3,'Hedge row present for shot A');
for(const it of a.plants.hedge.items){
  assert.ok(top(a.plants.hedge,it)<=1.3,`Hedge crown top ${top(a.plants.hedge,it)} stays below Saria's door threshold as seen from camera B (≤ 1.3 m above plaza level)`);
  assert.ok(it.z<=-5.1,'Hedge stays out of camera C\'s left edge');
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
for(const id of['A_stairs','B_house','D_log']){
  const p=LAYOUT.viewpoints.find(v=>v.id===id).position;
  for(const set of a.plants.all){set.update(new THREE.Vector3().fromArray(p),true);assert.equal(set.group.children.reduce((n,m)=>n+m.count,0),set.count);}
}
for(const fixture of[a,b]){const geos=new Set();fixture.group.traverse(o=>{if(o.isMesh){geos.add(o.geometry);o.dispose();}});for(const g of geos)g.dispose();for(const m of fixture.plants.materials)m.dispose();}
console.log(JSON.stringify({passed:true,checkedVertices,checkedBases,shadowMeshes,bushes:a.plants.bushes.count,note:'CPU geometry/placement contracts only; GPU capture and foliage appearance still require review.'}));
