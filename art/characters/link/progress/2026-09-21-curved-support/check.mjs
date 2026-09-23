// CPU regression: the actual crown under the planted boot must reach the planned support.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {launchBrowser} from '../../../../../gauntlet/scripts/lib/browser.mjs';
const dir='art/characters/link/progress/2026-09-21-curved-support';
const before=process.argv.includes('--before');
process.env.ZR_NATIVE_GPU='0';
const raw=await fs.readFile('src/world/character/glbLink.ts','utf8');
const source=(before?execFileSync('git',['show','6c13f70c:src/world/character/glbLink.ts'],{encoding:'utf8'}):raw)+'\nexport {footConfig};';
const {trace,boot}=JSON.parse(await fs.readFile(dir+'/plant-fixture.json','utf8'));
const server=await createServer({root:path.resolve('.'),server:{host:'127.0.0.1',port:0},plugins:[{
  name:'cpu-curved-contact',enforce:'pre',
  configureServer(s){s.middlewares.use('/__curved-check',(_req,res)=>res.end('<!doctype html><title>Curved support CPU check</title>'));},
  transform(code,id){if(id.replaceAll('\\','/').endsWith('/src/world/character/glbLink.ts'))return source;},
}]});
let browser;
try {
  await server.listen();browser=await launchBrowser();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0]+'__curved-check');
  const result=await page.evaluate(async({trace,boot})=>{
    const [{footConfig},{createGround},{createTerrain},{LAYOUT},{WORLD},{createRng},{buildStairway},{buildLogNosings},{Group,Mesh,Raycaster,Vector3}]=await Promise.all([
      import('/src/world/character/glbLink.ts'),import('/src/world/character/ground.ts'),import('/src/world/terrain/heightfield.ts'),import('/src/world/layout.ts'),import('/src/world/config.ts'),import('/src/world/util/prng.ts'),import('/src/world/hardscape/stairs.ts'),import('/src/world/hardscape/logNosings.ts'),import('/node_modules/three/build/three.module.js'),
    ]);
    const terrain=createTerrain(),ground=createGround(terrain,LAYOUT),def=LAYOUT.stairs.find(s=>s.id==='main'),hardscape=new Group();hardscape.name='hardscape';
    for(const [name,geometry]of [['stairs-main',buildStairway(def,terrain,createRng(WORLD.seed).fork('hardscape').fork('stairs-main'),WORLD.seed).geometry],['stairs-main-logs',buildLogNosings(def,WORLD.seed).geometry]]){const mesh=new Mesh(geometry);mesh.name=name;hardscape.add(mesh);}
    hardscape.updateMatrixWorld(true);ground.attachSurface(hardscape);
    const {x,z,fx,fz,yawRel,fp}=trace,cfg={shift:0,support:0,pitch:0,back:0,ahead:0};
    footConfig(ground.surface,ground.height,x,z,fx,fz,yawRel,fp,cfg,true);
    const ray=new Raycaster(),down=new Vector3(0,-1,0),contacts=[];
    for(const p of boot){ray.set(new Vector3(p.x,3,p.z),down);ray.far=4;const hit=ray.intersectObjects(hardscape.children,false)[0];if(!hit)throw Error('Missing physical boot contact');contacts.push({requiredSupport:hit.point.y-p.offset,mesh:hit.object.name});}
    const flat=()=>0,flatCfg={...cfg};footConfig(flat,flat,0,0,0,1,0,fp,flatCfg,true);
    return {cfg,contacts,flatCfg,missingSupport:Math.max(...contacts.map(p=>p.requiredSupport-cfg.support))};
  },{trace,boot});
  result.before=before;result.pageErrors=errors;result.sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
  await fs.writeFile(dir+'/check-'+(before?'before':'after')+'.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);
  assert.equal(result.flatCfg.support,0,'Flat support must stay exactly zero');
  assert.equal(result.flatCfg.shift,0,'Flat placement must stay unchanged');
  assert.equal(result.cfg.shift,0,'Existing planted position must not shift');
  assert.ok(result.contacts.some(p=>p.mesh==='stairs-main-logs'),'Fixture must hit an outward timber crown');
  assert.ok(result.missingSupport<=.00002,'Planned support is below the physical crown under the boot');
  console.log('PASS: planned footprint clears the actual crown before root and IK, with flat placement unchanged.');
} finally {await browser?.close();await server.close();}
