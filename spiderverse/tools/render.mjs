#!/usr/bin/env node
// Batch renderer for "Into the Ant-Verse". Owner: director.
//
//   node spiderverse/tools/render.mjs --shots S01,S02 [--scale 0.5] [--out dir] [--force]
//   node spiderverse/tools/render.mjs --from 0 --to 2879 --step 1
//   node spiderverse/tools/render.mjs --frames 0,120,264 --out spiderverse/out/look-frames
//
// Recoverable: frames that already exist are skipped (unless --force), and every frame appends
// a line to <out>/manifest.jsonl with its shot, timing, and which modules were real vs proxy.
// Frames are rendered in order within each contiguous run so motion-vector bookkeeping holds.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { startServer, launchBrowser, SV_ROOT } from './lib/headless.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

const scale = Number(opt('scale', '1'));
const ss = Number(opt('ss', '1'));
const outDir = path.resolve(opt('out', path.join(SV_ROOT, 'out', scale === 1 ? 'frames' : `frames_${scale}`)));
const force = flag('force');
const priority = !flag('no-priority');
const step = Number(opt('step', '1'));

const edit = await import(path.join(SV_ROOT, 'app/core/edit.js'));

let frames = [];
if (opt('frames')) frames = opt('frames').split(',').map(Number);
else if (opt('shots')) {
  for (const id of opt('shots').split(',')) {
    const s = edit.shotById(id.trim().toUpperCase());
    if (!s) throw new Error('unknown shot ' + id);
    for (let f = s.start; f < s.end; f += step) frames.push(f);
  }
} else {
  const from = Number(opt('from', '0'));
  const to = Number(opt('to', String(edit.DURATION_FRAMES - 1)));
  for (let f = from; f <= to; f += step) frames.push(f);
}
frames = [...new Set(frames)].sort((a, b) => a - b);

fs.mkdirSync(outDir, { recursive: true });
const name = (f) => path.join(outDir, `frame_${String(f).padStart(5, '0')}.png`);
const todo = force ? frames : frames.filter((f) => !fs.existsSync(name(f)));
console.log(`[render] ${frames.length} requested, ${todo.length} to render -> ${outDir} (scale ${scale}, ss ${ss})`);
if (!todo.length) process.exit(0);

const srv = await startServer();
const browser = await launchBrowser({ priority });
const page = await browser.newPage();
const W = Math.round(edit.WIDTH * scale);
const H = Math.round(edit.HEIGHT * scale);
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('console', (m) => {
  const t = m.text();
  // Missing modules are expected while the team is still delivering; the registry reports them.
  if (t.startsWith('Failed to load resource')) return;
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[page:${m.type()}]`, t.slice(0, 300));
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(srv.url(`/spiderverse/app/index.html?scale=${scale}&ss=${ss}`), { waitUntil: 'load', timeout: 0 });
await page.waitForFunction('window.__ready === true || window.__error', { timeout: 0, polling: 100 });
const bootErr = await page.evaluate(() => window.__error || null);
if (bootErr) {
  console.error('[render] boot failed:', bootErr);
  process.exit(1);
}
const info0 = await page.evaluate(() => window.__sv.info());
console.log('[render] modules:', JSON.stringify(Object.fromEntries(Object.entries(info0.report.modules).map(([k, v]) => [k, v.ok ? v.using || 'ok' : 'missing']))), 'renderer:', info0.report.renderer);

const manifest = fs.createWriteStream(path.join(outDir, 'manifest.jsonl'), { flags: 'a' });
const t0 = Date.now();
let done = 0;
for (const f of todo) {
  const ts = Date.now();
  const res = await page.evaluate((fr) => window.__sv.renderFrame(fr), f);
  const buf = Buffer.from(res.data, 'base64');
  await sharp(buf, { raw: { width: res.width, height: res.height, channels: 4 } })
    .removeAlpha()
    .png({ compressionLevel: 3 })
    .toFile(name(f));
  done++;
  const ms = Date.now() - ts;
  const info = await page.evaluate(() => {
    const r = window.__sv.info().report;
    return { renderer: r.renderer, assets: r.assets || {}, shots: r.shots || {} };
  });
  manifest.write(
    JSON.stringify({
      frame: f,
      shot: res.shot,
      f: res.f,
      held: res.held,
      placeholder: res.placeholder,
      transition: res.transition,
      ms,
      renderer: info.renderer,
      proxies: Object.entries(info.assets).filter(([, v]) => v === 'proxy').map(([k]) => k),
      errors: res.errors,
    }) + '\n',
  );
  if (res.errors && res.errors.length) console.log(`[render] f${f} errors:`, res.errors.slice(0, 3).join(' | '));
  if (done % 12 === 0 || done === todo.length) {
    const el = (Date.now() - t0) / 1000;
    console.log(`[render] ${done}/${todo.length}  last ${ms} ms  avg ${((el * 1000) / done).toFixed(0)} ms/frame  eta ${(((todo.length - done) * el) / done / 60).toFixed(1)} min`);
  }
}
manifest.end();
await browser.close();
await srv.close();
console.log(`[render] done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
