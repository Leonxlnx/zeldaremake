// CPU review of new shrub placement at 34250d2. Actual plants, no renderer or replacement geometry.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
const sourceRoot=path.resolve(process.argv[2]||'.');
const modules=new Map();
function load(file){
  file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;
  const m={exports:{}};modules.set(file,m);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(id=>{
    if(id==='three')return THREE;
    if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'));
    throw Error(id);
  },m,m.exports);return m.exports;
}
const read=name=>load(path.join(sourceRoot,'src/world',name+'.ts'));
const {WORLD}=read('config'),{LAYOUT}=read('layout'),{VegField}=read('vegetation/field');
const ctx={config:WORLD,layout:LAYOUT,terrain:read('terrain/heightfield').createTerrain(),
  rng:read('util/prng').createRng(WORLD.seed),wind:read('wind/wind').createWind(),
  quality:{tier:'high',density:1,distance:1,shadows:true,pixelRatio:1.5}};
const parent=new THREE.Group(),start=performance.now();
const field=new VegField(ctx,WORLD.detailRadius+6,.5);
const plants=read('vegetation/plants').buildPlants(ctx,field,parent);
const bushes=plants.bushes;
if(bushes.count!==134)throw Error(`Expected reviewed build's 134 bushes, found ${bushes.count}; check current revision before interpreting the original/new split`);
const round=v=>Math.round(v*1000)/1000;
const rows=[];
const cameras=LAYOUT.viewpoints.filter(v=>['A_stairs','B_house','D_log'].includes(v.id)).map(vp=>{
  const camera=new THREE.PerspectiveCamera(vp.fov,1280/720,.1,1000);camera.position.fromArray(vp.position);camera.lookAt(new THREE.Vector3().fromArray(vp.target));camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  return {id:vp.id,camera,frustum};
});
for(let index=113;index<bushes.count;index++){
  const item=bushes.items[index],matrix=new THREE.Matrix4().fromArray(item.matrix),verts=[];
  const pos=bushes.opts.variants[item.variant][0].getAttribute('position');
  const box=new THREE.Box3();
  let path=Infinity,stairs=Infinity,house=Infinity;
  for(let i=0;i<pos.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);verts.push(p);box.expandByPoint(p);
    path=Math.min(path,field.pathEdgeDistance(p.x,p.z));stairs=Math.min(stairs,field.stairDistance(p.x,p.z));house=Math.min(house,field.houseInfo(p.x,p.z).dist);
  }
  const projected={};
  for(const {id,camera,frustum} of cameras){
    const screen=new THREE.Box2();let behind=0;
    for(const p of verts){if(p.clone().applyMatrix4(camera.matrixWorldInverse).z>=0){behind++;continue;}const q=p.clone().project(camera);screen.expandByPoint(new THREE.Vector2((q.x+1)/2,(1-q.y)/2));}
    projected[id]={intersects:frustum.intersectsBox(box) && screen.max.x>=0 && screen.min.x<=1 && screen.max.y>=0 && screen.min.y<=1,bounds:behind===verts.length?null:[...screen.min.toArray(),...screen.max.toArray()].map(round),behindVertices:behind};
  }
  rows.push({id:index+1,root:[item.x,item.y,item.z].map(round),worldBounds:[...box.min.toArray(),...box.max.toArray()].map(round),minimumCrownXZClearance:{path:round(path),stairs:round(stairs),house:round(house)},views:projected});
}
console.log(JSON.stringify({bushCount:bushes.count,originalCount:113,newCount:rows.length,buildMs:Math.round(performance.now()-start),views:Object.fromEntries(cameras.map(c=>[c.id,rows.filter(r=>r.views[c.id].intersects).map(r=>r.id)])),rows,note:'Actual high geometry vertices transformed by stored matrices; no grass/fullworld/renderer. Projected boxes are conservative and do not prove opaque visibility. Distances are horizontal crown-vertex distances, no wind.'},null,2));
for(const set of plants.all){for(const row of set.opts.variants)for(const g of row)g.dispose();for(const mesh of set.group.children)mesh.dispose();}for(const m of plants.materials)m.dispose();
