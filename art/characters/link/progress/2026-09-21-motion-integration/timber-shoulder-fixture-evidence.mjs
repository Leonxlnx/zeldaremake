// Read-only virtual-source experiment derived from the existing timber contact check. Not a production regression.
// CPU check against exact production stone/timber meshes; no renderer or source writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

process.env.ZR_NATIVE_GPU='0';
const root=path.resolve('.');
const oldSource=execFileSync('git',['show','6c13f70c:src/world/character/ground.ts'],{encoding:'utf8'});
const negative=process.argv.includes('--before');
const rawSource=negative?oldSource:await fs.readFile('src/world/character/ground.ts','utf8');
const candidate=process.argv.includes('--timber-up');
let source=rawSource;
if(candidate){
  const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Unique experimental hook: '+a);source=source.replace(a,b);};
  replace('function buildSurfaceGrid(geometry: BufferGeometry, CELL: number): SurfaceGrid | null {','function buildSurfaceGrid(geometry: BufferGeometry, CELL: number, timberTriangleStart = Infinity): SurfaceGrid | null {');
  replace('if (nLen < 1e-9 || Math.abs(nY) / nLen < 0.5) continue;','if (nLen < 1e-9 || (t < timberTriangleStart ? Math.abs(nY) / nLen < 0.5 : nY <= 0)) continue;');
  replace('const g = buildSurfaceGrid(merged ?? m.geometry, STAIR_CELL);','const timberTriangleStart = merged ? (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3 : Infinity;\n          const g = buildSurfaceGrid(merged ?? m.geometry, STAIR_CELL, timberTriangleStart);');
}
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const virtual=path.resolve('src/world/character/__ground_before.ts').replaceAll('\\','/');
const server=await createServer({root,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'cpu-exact-stair-grid',enforce:'pre',
  configureServer(s){s.middlewares.use('/__grid-check',(_req,res)=>res.end('<!doctype html><title>Stair grid CPU check</title>'));},
  resolveId(id){if(id.replaceAll('\\','/').endsWith('/__ground_before.ts'))return virtual;},
  load(id){if(id===virtual)return oldSource;},
  transform(_code,id){if(id.replaceAll('\\','/').endsWith('/src/world/character/ground.ts'))return source;},
}]});
let browser;
try{
  await server.listen();browser=await launchBrowser();const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]+'__grid-check');
  const result=await page.evaluate(async()=>{
    const [{createGround},{createGround:oldGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway,stairFrame,stairToWorld},{buildLogNosings,STAIR_LOGS,LOG_FLIGHTS},{Group,Mesh,Raycaster,Vector3}]=await Promise.all([
      import('/src/world/character/ground.ts'),import('/src/world/character/__ground_before.ts'),import('/src/world/terrain/heightfield.ts'),import('/src/world/layout.ts'),import('/src/world/config.ts'),import('/src/world/util/prng.ts'),import('/src/world/hardscape/stairs.ts'),import('/src/world/hardscape/logNosings.ts'),import('/node_modules/three/build/three.module.js'),
    ]);
    const terrain=createTerrain(),def=LAYOUT.stairs.find(s=>s.id==='main'),frame=stairFrame(def);
    if(!STAIR_LOGS||!LOG_FLIGHTS.has(def.id))throw Error('Main-flight timber must be enabled');
    const stone=buildStairway(def,terrain,createRng(WORLD.seed).fork('hardscape').fork('stairs-main'),WORLD.seed);
    const timber=buildLogNosings(def,WORLD.seed);
    const scene=withLogs=>{
      const g=new Group();g.name='hardscape';
      const s=new Mesh(stone.geometry);s.name='stairs-main';g.add(s);
      if(withLogs){const m=new Mesh(timber.geometry);m.name='stairs-main-logs';g.add(m);}
      g.updateMatrixWorld(true);return g;
    };
    const stoneScene=scene(false),fullScene=scene(true);
    const old=oldGround(terrain,LAYOUT),plain=createGround(terrain,LAYOUT),full=createGround(terrain,LAYOUT);
    old.attachSurface(stoneScene);plain.attachSurface(stoneScene);full.attachSurface(fullScene);
    const cell=full.surfaceInfo().stairs.cellSize,ray=new Raycaster(),down=new Vector3(0,-1,0);
    const out={stoneTriangles:stone.triangles,timberTriangles:timber.triangles,stoneGrid:plain.surfaceInfo().stairs,fullGrid:full.surfaceInfo().stairs,queries:0,timberSamples:0,stoneOnlyMaxDeltaM:0,heightMaxDeltaM:0,maxTimberUnderestimateM:0,worst:null,normalBands:{},misses:0,baselineStoneMicrometres:[],baselineHeightMicrometres:[]};
    for(let step=0;step<def.steps;step++)for(const across of [-def.width/4,0,def.width/4])for(const offset of Array.from({length:21},(_,i)=>(i-10)*.01)){
      const [wx,wz]=stairToWorld(frame,across,step*def.tread+offset);
      const x=(Math.floor(wx/cell)+.5)*cell,z=(Math.floor(wz/cell)+.5)*cell;
      out.queries++;out.baselineStoneMicrometres.push(Math.round(old.surface(x,z)*1e6));out.baselineHeightMicrometres.push(Math.round(old.height(x,z)*1e6));
      out.stoneOnlyMaxDeltaM=Math.max(out.stoneOnlyMaxDeltaM,Math.abs(plain.surface(x,z)-old.surface(x,z)));
      out.heightMaxDeltaM=Math.max(out.heightMaxDeltaM,Math.abs(full.height(x,z)-old.height(x,z)));
      ray.set(new Vector3(x,def.base[1]+(step+1)*def.rise+1,z),down);ray.far=2;
      const hit=ray.intersectObjects(fullScene.children,false)[0];
      if(!hit||hit.object.name!=='stairs-main-logs'||hit.face.normal.y<=0)continue;
      out.timberSamples++;
      const missing=hit.point.y-full.surface(x,z);
      const band=hit.face.normal.y<.5?'shoulderBelowHalf':'crownAtLeastHalf';
      const stats=out.normalBands[band]??={samples:0,misses:0,maxUnderestimateM:0};
      stats.samples++;stats.maxUnderestimateM=Math.max(stats.maxUnderestimateM,missing);
      if(missing>.00002){stats.misses++;out.misses++;}
      if(missing>out.maxTimberUnderestimateM){out.maxTimberUnderestimateM=missing;out.worst={step,x,z,actual:hit.point.y,sampled:full.surface(x,z),normalY:hit.face.normal.y,faceIndex:hit.faceIndex};}
    }
    return out;
  });
  result.inputs={negative,candidate,rawSourceSha256:digest(rawSource),sourceSha256:digest(source),baselineSha256:digest(oldSource),gitHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),createdAt:new Date().toISOString()};
  const file='art/characters/link/progress/2026-09-21-motion-integration/timber-shoulder-fixture-evidence.json';
  const fixture={version:1,baselineGroundRef:'6c13f70c',baselineGroundSha256:digest(oldSource),quantizationM:1e-6,queries:result.queries,stoneSurfaceSha256:digest(JSON.stringify(result.baselineStoneMicrometres)),placementHeightSha256:digest(JSON.stringify(result.baselineHeightMicrometres)),provenance:'Historical stone-only sampler queried against current deterministic production stone meshes, 20 main-flight steps × 3 lanes × 21 offsets, snapped to 1 cm cell centres; captured 2026-09-21.'};
  await fs.writeFile('art/characters/link/progress/2026-09-21-stair-clearance/ground-log-fixture.json',JSON.stringify(fixture,null,2)+'\n');
  delete result.baselineStoneMicrometres;delete result.baselineHeightMicrometres;
  await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert.ok(result.timberSamples>0,'Fixture must hit the actual timber tops');
  assert.equal(result.stoneOnlyMaxDeltaM,0,'Stone-only sampler changed');
  assert.equal(result.heightMaxDeltaM,0,'Analytic placement height changed');
  assert.ok(result.maxTimberUnderestimateM<.00002,'Rendered timber top is missing from stair support');
  assert.ok(result.fullGrid.triangles>result.stoneGrid.triangles,'Timber triangles missing from the support grid');
  console.log('PASS: exact timber support, unchanged stone-only surface and unchanged analytic placement.');
}finally{await browser?.close();await server.close();}
