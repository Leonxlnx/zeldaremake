// Diagnostic art comparison, never a gauntlet take or production-loader replacement.
// Setup: detached world checkout with world_review.ts copied to src/astra-art-review.ts,
// import/install it after createWorld in main.ts, copy GLB to public/astra-link.glb, npm run build.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';
const world=process.env.LINK_WORLD_ROOT||'E:/zeldaremake-world-review';
const output=path.join(ROOT,'art/characters/link/progress',new Date().toISOString().replace(/[:.]/g,'-')+'-world-review');
await fs.mkdir(output,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const report={kind:'Isolated world art overlay; original controller/root placement; no candidate terrain IK; not gauntlet evidence',
  world_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:world,encoding:'utf8'}).trim(),
  glb_sha256:hash(await fs.readFile(path.join(world,'public/astra-link.glb'))),images:{},errors:[]};
for(const name of ['main.ts','astra-art-review.ts']){
 const data=await fs.readFile(path.join(world,'src',name));await fs.writeFile(path.join(output,name),data);
}
const server=await serveStatic(path.join(world,'dist'));let browser;
try{
 browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:180000,
  args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720}});
 const page=await browser.newPage();page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);});
 page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
 await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__ZR__&&window.__LINK_REVIEW__,{timeout:180000});
 await page.evaluate(()=>{window.__artReady='pending';__ZR__.ready().then(()=>window.__artReady='ok',e=>window.__artReady='error: '+e.message);});
 await page.waitForFunction(()=>window.__artReady!=='pending',{timeout:180000});
 assert.equal(await page.evaluate(()=>window.__artReady),'ok');
 report.gpu=await page.evaluate(()=>{const gl=__LINK_RENDERER__.getContext();const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 console.log('World ready',report.gpu);
 const views=await page.evaluate(()=>__ZR__.viewpoints());
 for(const view of views){
  for(const candidate of [false,true]){
   await page.evaluate(async({id,candidate})=>{if(!__ZR__.setViewpoint(id))throw new Error('Unknown world view');__ZR__.setTime(42);__LINK_REVIEW__.pose('idle',0);__LINK_REVIEW__.show(candidate);await __ZR__.render(2,0);},{id:view.id,candidate});
   const name=view.id+(candidate?'-candidate':'-existing');assert.match(name,/^[\w-]+$/);
   const png=await page.screenshot({path:path.join(output,name+'.png')});
   report.images[name]={sha256:hash(png),candidate,clip:candidate?'idle':null,stats:await page.evaluate(()=>__ZR__.stats())};
   console.log('Captured',name);
  }
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
}finally{await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(JSON.stringify({output,views:Object.keys(report.images).length}));
