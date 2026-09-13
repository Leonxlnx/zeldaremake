// Actual Three.js GLB renders. Reuse the repository's headless browser and server.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from '../../../gauntlet/scripts/lib/browser.mjs';
const root=path.join(ROOT,'art/characters/link');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=path.join(root,'progress',stamp+'-runtime');await fs.mkdir(output,{recursive:true});
const report={at:new Date().toISOString(),kind:'Actual Three.js runtime GLB review; not a world gauntlet capture',
  glb_sha256:crypto.createHash('sha256').update(await fs.readFile(path.join(root,'link-runtime.glb'))).digest('hex'),views:{},errors:[]};
const server=await serveStatic(ROOT);let browser;
console.log('Review server',server.url);
try{
  // Native pipes avoid this PC's stalled localhost WebSocket handshake.
  browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:60000,
    args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--mute-audio','--no-proxy-server'],
    defaultViewport:{width:720,height:820}});
  const page=await browser.newPage();
  await page.setViewport({width:720,height:820});
  page.on('pageerror',e=>{report.errors.push(e.message);console.error(e.message);});
  page.on('requestfailed',r=>console.error('Request failed',r.url(),r.failure()?.errorText));
  await page.goto(server.url+'/art/characters/link/review.html?capture=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.REVIEW?.ready,{timeout:90000});
  const durations=await page.evaluate(()=>REVIEW.durations);
  report.sole_local=await page.evaluate(()=>REVIEW.soleLocal);
  for(const [name,gait,t,view] of [
    ['01-body','idle',0,'body'],['02-front','idle',0,'front'],['03-side','idle',0,'side'],
    ['04-back','idle',0,'back'],['05-face','idle',0,'face'],['06-boots','idle',0,'boots'],
    ...['walk','run','stairs'].flatMap(gait=>[0,.25,.5,.75].map(phase=>[gait+'-'+phase,gait,durations[gait]*phase,'body']))
  ]){
    await page.evaluate(({gait,t,view})=>REVIEW.pose(gait,t,view),{gait,t,view});
    const png=await page.screenshot({path:path.join(output,name+'.png')});
    const sole_heights=await page.evaluate(()=>REVIEW.soleHeights());
    report.views[name]={gait,t,view,sole_heights,sha256:crypto.createHash('sha256').update(png).digest('hex')};
  }
  report.render=await page.evaluate(()=>REVIEW.stats());
  assert.deepEqual(report.errors,[]);
}catch(error){report.errors.push(error.message);throw error;}
finally{
  report.complete=Object.keys(report.views).length===18 && report.errors.length===0;
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(report,null,2));
  await browser?.close();await server.close();
}
console.log(JSON.stringify({output,views:Object.keys(report.views).length,render:report.render}));
