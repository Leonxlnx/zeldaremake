// CPU regression against outward production meshes at grid-cell centres. No renderer or source writes.
// Default reads raw production; only explicit --before requires a historical Git object.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

process.env.ZR_NATIVE_GPU='0';
const root=path.resolve('.');
const fixture=JSON.parse(await fs.readFile('art/characters/link/progress/2026-09-21-stair-clearance/ground-log-fixture.json','utf8'));
const negative=process.argv.includes('--before');
const source=negative?execFileSync('git',['show',fixture.baselineGroundRef+':src/world/character/ground.ts'],{encoding:'utf8'}):await fs.readFile('src/world/character/ground.ts','utf8');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const server=await createServer({root,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'cpu-exact-stair-grid',enforce:'pre',
  configureServer(s){s.middlewares.use('/__grid-check',(_req,res)=>res.end('<!doctype html><title>Stair grid CPU check</title>'));},
  transform(_code,id){if(id.replaceAll('\\','/').endsWith('/src/world/character/ground.ts'))return source;},
}]});
let browser;
try{
  await server.listen();browser=await launchBrowser();const page=await browser.newPage(),pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'__grid-check');
  const result=await page.evaluate(async()=>{
    const [{createGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway,stairFrame,stairToWorld},{buildLogNosings,STAIR_LOGS,LOG_FLIGHTS},{Group,Mesh,Raycaster,Vector3}]=await Promise.all([
      import('/src/world/character/ground.ts'),import('/src/world/terrain/heightfield.ts'),import('/src/world/layout.ts'),import('/src/world/config.ts'),import('/src/world/util/prng.ts'),import('/src/world/hardscape/stairs.ts'),import('/src/world/hardscape/logNosings.ts'),import('/node_modules/three/build/three.module.js'),
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
    const plain=createGround(terrain,LAYOUT),full=createGround(terrain,LAYOUT);
    plain.attachSurface(stoneScene);full.attachSurface(fullScene);
    const cell=full.surfaceInfo().stairs.cellSize,ray=new Raycaster(),down=new Vector3(0,-1,0);
    const out={stoneTriangles:stone.triangles,timberTriangles:timber.triangles,stoneGrid:plain.surfaceInfo().stairs,fullGrid:full.surfaceInfo().stairs,queries:0,timberSamples:0,shoulderSamples:0,steepestNormalY:1,minTimberNormalDot:1,stoneHeights:[],placementHeights:[],heightMaxDeltaM:0,maxTimberUnderestimateM:0,worst:null};
    for(let step=0;step<def.steps;step++)for(const across of [-def.width/4,0,def.width/4])for(const offset of Array.from({length:21},(_,i)=>(i-10)*.01)){
      const [wx,wz]=stairToWorld(frame,across,step*def.tread+offset);
      const x=(Math.floor(wx/cell)+.5)*cell,z=(Math.floor(wz/cell)+.5)*cell;
      out.queries++;
      out.stoneHeights.push(Math.round(plain.surface(x,z)*1e6));out.placementHeights.push(Math.round(plain.height(x,z)*1e6));
      out.heightMaxDeltaM=Math.max(out.heightMaxDeltaM,Math.abs(full.height(x,z)-plain.height(x,z)));
      ray.set(new Vector3(x,def.base[1]+(step+1)*def.rise+1,z),down);ray.far=2;
      const hit=ray.intersectObjects(fullScene.children,false)[0];
      if(!hit||hit.object.name!=='stairs-main-logs'||hit.face.normal.y<=0)continue;
      out.timberSamples++;if(hit.face.normal.y<.5)out.shoulderSamples++;out.steepestNormalY=Math.min(out.steepestNormalY,hit.face.normal.y);
      // The authored timber normals point outward: catch the old inward triangle winding too.
      const normals=timber.geometry.attributes.normal,face=hit.face;
      const normalDot=[face.a,face.b,face.c].reduce((sum,i)=>sum+face.normal.x*normals.getX(i)+face.normal.y*normals.getY(i)+face.normal.z*normals.getZ(i),0)/3;
      out.minTimberNormalDot=Math.min(out.minTimberNormalDot,normalDot);
      const missing=hit.point.y-full.surface(x,z);
      if(missing>out.maxTimberUnderestimateM){out.maxTimberUnderestimateM=missing;out.worst={step,x,z,actual:hit.point.y,sampled:full.surface(x,z),normalY:hit.face.normal.y,faceIndex:hit.faceIndex};}
    }
    const hash=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(value=>value.toString(16).padStart(2,'0')).join('');
    out.geometry={stonePositionsSha256:await hash(stone.geometry.attributes.position.array),stoneIndicesSha256:stone.geometry.index?await hash(stone.geometry.index.array):null,timberPositionsSha256:await hash(timber.geometry.attributes.position.array),timberIndicesSha256:timber.geometry.index?await hash(timber.geometry.index.array):null};
    return out;
  });
  result.stoneSurfaceSha256=digest(JSON.stringify(result.stoneHeights));result.placementHeightSha256=digest(JSON.stringify(result.placementHeights));
  delete result.stoneHeights;delete result.placementHeights;result.pageErrors=pageErrors;
  result.inputs={negative,sourceSha256:digest(source),fixture,logSourceSha256:digest(await fs.readFile('src/world/hardscape/logNosings.ts')),createdAt:new Date().toISOString()};
  const file='art/characters/link/progress/2026-09-21-stair-clearance/ground-log-check-'+(negative?'before':'after')+'.json';
  await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert.deepEqual(pageErrors,[]);
  assert.equal(fixture.quantizationM,1e-6,'Fixture height quantization changed');
  assert.equal(result.queries,fixture.queries,'Historical stone fixture query set changed');
  assert.equal(result.stoneSurfaceSha256,fixture.stoneSurfaceSha256,'Stone-only sampler changed at 1 micrometre precision');
  assert.equal(result.placementHeightSha256,fixture.placementHeightSha256,'Placement-height baseline changed at 1 micrometre precision');
  assert.ok(result.timberSamples>0,'Fixture must hit outward timber');
  assert.ok(result.minTimberNormalDot>0,'Timber triangle winding disagrees with its outward normals');
  assert.ok(result.shoulderSamples>0,'Fixture must include upward shoulders below the stone cutoff');
  assert.equal(result.heightMaxDeltaM,0,'Analytic placement height changed');
  // Bound applies at these grid-cell centres, not arbitrary locations inside a cell.
  assert.ok(result.maxTimberUnderestimateM<.00002,'Sampled outward timber is missing from stair support');
  assert.ok(result.fullGrid.triangles>result.stoneGrid.triangles,'Timber triangles missing from the support grid');
  console.log('PASS: sampled outward timber at cell centres; stone baseline and analytic height preserved.');
}finally{await browser?.close();await server.close();}
