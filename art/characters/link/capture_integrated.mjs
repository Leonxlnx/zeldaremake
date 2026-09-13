// Review the actual production loader in a clean, pinned world checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';

const world=process.env.LINK_WORLD_ROOT||'E:/zeldaremake-integrated-review';
const output=path.join(ROOT,'art/characters/link/progress',new Date().toISOString().replace(/[:.]/g,'-')+'-integrated');
await fs.mkdir(output,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const glb=await fs.readFile(path.join(world,'public/models/link/link-runtime.glb'));
const report={kind:'Actual production integration review on native GPU; not a gauntlet take or art acceptance',
  world_commit:execFileSync('git',['rev-parse','HEAD'],{cwd:world,encoding:'utf8'}).trim(),
  glb_sha256:hash(glb),images:{},errors:[]};
const server=await serveStatic(path.join(world,'dist'));let browser;
try{
  browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:180000,
    args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],
    defaultViewport:{width:1280,height:720}});
  for(const mode of ['glb','procedural']){
    const page=await browser.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high'+(mode==='procedural'?'&link=proc':''),{waitUntil:'domcontentloaded',timeout:180000});
    await page.waitForFunction(()=>window.__ZR__,{timeout:180000});
    await page.evaluate(()=>{window.__reviewReady='pending';__ZR__.ready().then(()=>window.__reviewReady='ok',e=>window.__reviewReady=String(e));});
    await page.waitForFunction(()=>window.__reviewReady!=='pending',{timeout:180000});
    assert.equal(await page.evaluate(()=>window.__reviewReady),'ok');
    const initial=await page.evaluate(()=>__ZR__.audit());
    assert.deepEqual(initial.systemFailures,[]);
    assert.equal(initial.systems.character.linkSource,mode);
    if(mode==='glb')assert.equal(initial.systems.character.linkAsset.sha256,report.glb_sha256);
    report.gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    const views=await page.evaluate(()=>__ZR__.viewpoints().filter(v=>!v.diagnostic));
    for(const view of views){
      await page.evaluate(async id=>{if(!__ZR__.setViewpoint(id))throw Error('Unknown view');__ZR__.setTime(12.6);await __ZR__.render(2,0);},view.id);
      const name=view.id+'-'+mode;assert.match(name,/^[\w-]+$/);
      const png=await page.screenshot({path:path.join(output,name+'.png')});
      const state=await page.evaluate(()=>({stats:__ZR__.stats(),character:__ZR__.audit().systems.character}));
      report.images[name]={sha256:hash(png),...state};console.log('Captured',name);
    }
    {
      await page.evaluate(async()=>{__ZR__.setViewpoint('A_stairs');__ZR__.setTime(12.6);await __ZR__.render(2,0);});
      const repeated=await page.screenshot({path:path.join(output,`A_stairs-${mode}-repeat.png`)});
      const firstPixels=await sharp(path.join(output,`A_stairs-${mode}.png`)).raw().toBuffer();
      const repeatPixels=await sharp(repeated).raw().toBuffer();
      let maxDelta=0,totalDelta=0;
      for(let i=0;i<firstPixels.length;i++){
        const delta=Math.abs(firstPixels[i]-repeatPixels[i]);maxDelta=Math.max(maxDelta,delta);totalDelta+=delta;
      }
      report.repeats??={};
      report.repeats[mode]={sha256:hash(repeated),matches:hash(repeated)===report.images[`A_stairs-${mode}`].sha256,
        maxChannelDelta:maxDelta,meanChannelDelta:totalDelta/firstPixels.length};
      // Diagnostic tolerance only; retain exact equality and raw differences without assigning a cause.
      assert.ok(maxDelta<=2,'Production repeat differs by more than two 8-bit levels');
    }
    if(mode==='glb'){
      await page.evaluate(async()=>{__ZR__.setTime(12.725);await __ZR__.render(2,0);});
      const motion=await page.screenshot({path:path.join(output,'A_stairs-glb-motion.png')});
      report.motion={sha256:hash(motion),character:await page.evaluate(()=>__ZR__.audit().systems.character)};
      assert.notEqual(report.motion.sha256,report.repeats.glb.sha256);
    }
    await page.close();
  }
  assert.deepEqual(report.errors,[]);report.complete=true;
}finally{
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(report,null,2));
  await browser?.close();await server.close();
}
console.log(JSON.stringify({output,images:Object.keys(report.images).length,repeats:report.repeats}));
