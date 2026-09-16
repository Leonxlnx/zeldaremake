// Native-GPU daylight comparisons through the existing capture API and tuning hooks.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer-core';
import {ROOT,serveStatic,findChrome} from './lib/browser.mjs';

const settings=process.argv[2]?JSON.parse(await fs.readFile(process.argv[2],'utf8')):{};
const out=path.join(ROOT,'art/environment',new Date().toISOString().replace(/[:.]/g,'-')+'-daylight');
await fs.mkdir(out,{recursive:true});
const report={sha:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),settings,images:{},errors:[]};
report.captureScriptSha256=crypto.createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const diff=execFileSync('git',['diff','HEAD','--','src'],{cwd:ROOT,encoding:'utf8'});
await fs.writeFile(path.join(out,'source.diff'),diff);
report.sourceDiffSha256=crypto.createHash('sha256').update(diff).digest('hex');
const server=await serveStatic(path.join(ROOT,'dist'));let browser;
try {
 browser=await puppeteer.launch({executablePath:findChrome(),headless:true,pipe:true,protocolTimeout:180000,args:['--no-sandbox','--disable-gpu-sandbox','--use-angle=d3d11','--no-proxy-server','--hide-scrollbars','--mute-audio'],defaultViewport:{width:1280,height:720}});
 const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.evaluateOnNewDocument(s=>{window.__ATMO_SKY__=s.sky;window.__ATMO_FOG__=s.fog;window.__ATMO_LIGHT__=s.light;window.__ATMO_SETTINGS__=s.postfx;window.__ATMO_SHADOWFILTER__=s.shadowFilter;},settings);
 await page.goto(server.url+'/?capture=1&dev=0&hud=0&quality=high&'+new URLSearchParams(settings.params??{}),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__ZR__,{timeout:180000});await page.evaluate(()=>__ZR__.ready());
 await page.waitForFunction(()=>{const el=document.getElementById('loading');return !el||getComputedStyle(el).opacity==='0';},{timeout:180000});
 const views=await page.evaluate(()=>__ZR__.viewpoints().filter(v=>!v.diagnostic).map(v=>v.id));
 for(const id of settings.views??[...views,'sky-opening']) {
  await page.evaluate(async id=>{if(id==='sky-opening')__ZR__.setPose([0,1.8,.5],[0,18,-15],72);else if(id==='shadow-contact'){const h=__ZR__.probe(0,.5).height;__ZR__.setPose([1.8,h+1.1,3.4],[0,h+.15,.5],48);}else if(!__ZR__.setViewpoint(id))throw Error('Unknown viewpoint');__ZR__.setTime(12.6);await __ZR__.render(2,0);},id);
  const png=await page.screenshot({path:path.join(out,id+'.png')});
  report.images[id]={sha256:crypto.createHash('sha256').update(png).digest('hex'),...await page.evaluate(()=>({stats:__ZR__.stats(),camera:__ZR__.cameraPose(),lighting:__ZR__.audit().systems.lighting}))};
  console.log('Captured',id);
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
} finally {await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2));await browser?.close();await server.close();}
console.log(out);
