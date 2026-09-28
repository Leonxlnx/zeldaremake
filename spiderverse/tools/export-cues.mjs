#!/usr/bin/env node
// Evaluates every shot module frame (no rendering) and writes:
//   out/cues/sfx_cues.json   - per-frame sound cues exported by shot modules (frame().sfx)
//   out/cues/continuity.json - per-frame continuity facts (crumb holder/position, cap, water, camera)
// Owner: director.

import fs from 'node:fs';
import path from 'node:path';
import { startServer, launchBrowser, SV_ROOT } from './lib/headless.mjs';

const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));
const outDir = path.join(SV_ROOT, 'out', 'cues');
fs.mkdirSync(outDir, { recursive: true });

const srv = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(srv.url('/spiderverse/app/index.html?scale=0.25'), { waitUntil: 'load', timeout: 0 });
await page.waitForFunction('window.__ready === true || window.__error', { timeout: 0 });

const sfx = [];
const continuity = [];
const errors = {};
for (let f = 0; f < edit.DURATION_FRAMES; f++) {
  const ev = await page.evaluate((fr) => window.__sv.evaluate(fr), f);
  for (const c of (ev.out && ev.out.sfx) || []) sfx.push({ frame: f, shot: ev.shot, ...c });
  const o = ev.out || {};
  const ch = o.characters || {};
  const holder = Object.entries(ch).find(([, s]) => s && s.carry === 'crumb');
  continuity.push({
    frame: f,
    shot: ev.shot,
    placeholder: ev.placeholder,
    crumbHolder: holder ? holder[0] : (o.props && o.props.crumb && o.props.crumb.attachedTo) || null,
    crumbPos: o.props && o.props.crumb ? o.props.crumb.position || null : null,
    courierPos: ch.courier ? ch.courier.position || null : null,
    capPos: o.props && o.props.cap ? o.props.cap.position || null : null,
    water: o.water ? { level: o.water.level, torrent: o.water.torrent, dropFall: o.water.dropFall } : null,
    camera: o.camera ? { position: o.camera.position, target: o.camera.target, fovY: o.camera.fovY } : o.cameras ? 'split' : null,
    held: !!o.held,
  });
  if (ev.errors && ev.errors.length) errors[f] = ev.errors;
}
fs.writeFileSync(path.join(outDir, 'sfx_cues.json'), JSON.stringify(sfx, null, 1));
fs.writeFileSync(path.join(outDir, 'continuity.json'), JSON.stringify(continuity));
fs.writeFileSync(path.join(outDir, 'errors.json'), JSON.stringify(errors, null, 1));
console.log(`[cues] ${sfx.length} sfx cues, ${Object.keys(errors).length} frames with errors -> ${outDir}`);
await browser.close();
await srv.close();
