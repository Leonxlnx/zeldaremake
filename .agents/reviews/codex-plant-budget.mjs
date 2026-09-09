// CPU plant-only budget/placement probe; no renderer or replacement geometry.
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
const full=process.argv.includes('--full');
let world, audit;
let plants;
if (full) {
  ctx.camera=new THREE.PerspectiveCamera();ctx.audit=(_name,fn)=>{audit=fn;};ctx.progress=()=>{};
  world=await read('vegetation/index').create(ctx);parent.add(world.group);
} else plants=read('vegetation/plants').buildPlants(ctx,field,parent);
parent.updateMatrixWorld(true);
const result={sourceRoot,buildMs:Math.round(performance.now()-start),counts:{},views:{},bushBounds:[]};
if(plants)for(const set of plants.all)result.counts[set.opts.name]=set.count;
else result.counts=Object.fromEntries(Object.entries(audit()).filter(([k,v])=>typeof v==='number'));
for(const vp of LAYOUT.viewpoints.filter(v=>['A_stairs','B_house','D_log'].includes(v.id))){
  const camera=new THREE.PerspectiveCamera(vp.fov,1280/720,.1,1000);camera.position.fromArray(vp.position);camera.lookAt(new THREE.Vector3().fromArray(vp.target));camera.updateMatrixWorld(true);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const totals={drawCalls:0,triangles:0,colorDrawsInCameraFrustum:0,colorTrianglesInCameraFrustum:0};
  if(world){world.onCameraMove?.(camera,ctx);if(!world.onCameraMove){ctx.camera=camera;world.update(0,0,ctx);}Object.assign(totals,audit().drawableEstimate);}
  const sets=plants?plants.all:[{group:{children:[]}}];
  if(world)parent.traverse(o=>{if(o.isMesh)sets[0].group.children.push(o);});
  for(const set of sets){if(plants){set.update(camera.position,true);const st=set.stats();totals.drawCalls+=st.drawCalls;totals.triangles+=st.triangles;}
    for(const m of set.group.children)if(m.visible&&m.count>0&&frustum.intersectsObject(m)){
      totals.colorDrawsInCameraFrustum++;totals.colorTrianglesInCameraFrustum+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3*m.count;
    }
  }
  result.views[vp.id]=totals;
}
for(const row of (plants?.bushes.opts.variants??[])){const g=row[0];g.computeBoundingBox();result.bushBounds.push({min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),triangles:g.index.count/3});}
result.note=(full?'Full vegetation, excludes postfx.':'Plants only, excludes grass/litter and postfx.')+' CPU distance/mesh-frustum estimate, not actual GPU measurement. Shadow estimate uses each revision stats semantics.';
console.log(JSON.stringify(result,null,2));
const geometries=new Set();parent.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);o.dispose();}});for(const g of geometries)g.dispose();if(plants)for(const m of plants.materials)m.dispose();else world.dispose();
