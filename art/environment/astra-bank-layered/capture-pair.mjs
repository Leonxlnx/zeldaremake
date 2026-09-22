// Native matched images from immutable, hash-verified before/after builds.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';
assert.equal(process.env.ZR_NATIVE_GPU, '1');
assert.equal(process.env.CAPSLOT_STALE_MIN, 'Infinity');
const holder = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'zeldaremake-capslot/lock/holder.json')));
assert.equal(holder.agent, 'astra-world-resume');
const dir = path.resolve(process.argv[2] || 'art/environment/astra-bank-layered/native-pair');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const builds = ['before', 'after'].map(label => JSON.parse(fs.readFileSync(path.join(dir, label + '-build.json'))));
assert.equal(builds[0].publicHash, builds[1].publicHash);
assert.equal(builds[0].sha, builds[1].sha, 'Both flag variants share the same source and accepted warmth dependency');
for (const build of builds) {
  assert.equal(build.geometrySha, '94afa311bb7cd52e07bb55418444f615c105dc86');
  assert.equal(build.warmthSourceSha, '0858f39f75ee14130be7ff84692cdd33422c83ab');
  assert.equal(build.buildEnvironment.VITE_BANK_LAYERED_CORE, build.label === 'after' ? '1' : '0');
}
const views = [{id: 'F_canopy'}, {id: 'C_lookback'}];
for (const build of builds) {
  if (process.argv[3] && build.label !== process.argv[3]) continue;
  const out = path.join(dir, build.label); assert(!fs.existsSync(path.join(out, 'manifest.json')));
  fs.mkdirSync(out, { recursive: true });
  for (const f of build.files) assert.equal(hash(fs.readFileSync(path.join(build.root, f.path))), f.sha256, f.path);
  const report = { build, holder, settings: { views, time: 12.6, width: 1280, height: 720, quality: 'high', pixelRatio: 1 }, images: {}, errors: [] };
  // Incoming manifests use portable slash paths; the Windows server compares native prefixes.
  const server = await serveStatic(path.resolve(build.root)); let browser;
  try {
    browser = await launchBrowser(); report.browser = await browser.version();
    const { page, consoleLines, url } = await openWorld(browser, server.url); report.url = url; report.console = consoleLines;
    report.runtime = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), scripts: [...document.scripts].map(s => s.src).filter(Boolean) };
    });
    assert(!/swiftshader|software|llvmpipe/i.test(report.runtime.renderer));
    assert(report.runtime.scripts.some(s => build.files.some(f => f.path.endsWith('.js') && s.endsWith('/' + f.path))));
    for (const pose of views) {
      await page.evaluate(async pose => { if (pose.p) __ZR__.setPose(pose.p, pose.t, pose.fov); else if (!__ZR__.setViewpoint(pose.id)) throw Error(pose.id); __ZR__.setTime(12.6); await __ZR__.render(14, 0); }, pose);
      const png = await page.screenshot({ path: path.join(out, pose.id + '.png') });
      const state = await page.evaluate(() => ({ stats: __ZR__.stats(), camera: __ZR__.cameraPose(), lighting: __ZR__.audit().systems.lighting, trees: __ZR__.audit().systems.trees, hardscape: __ZR__.audit().systems.hardscape, failures: __ZR__.audit().systemFailures }));
      assert.deepEqual(state.failures, []); assert.equal(state.stats.simTime, 12.6);
      report.images[pose.id] = { sha256: hash(png), ...state };
      fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report) + '\n');
      console.log(build.label, pose.id, state.stats.drawCalls, state.stats.triangles);
    }
    report.errors = consoleLines.filter(s => /^\[pageerror\]/.test(s) || (/^\[page:error\]/.test(s) && /THREE|WebGL|shader|GL_INVALID/.test(s)));
    assert.deepEqual(report.errors, []); report.complete = true;
  } finally {
    report.finishedAt = new Date().toISOString(); fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report) + '\n');
    await browser?.close(); await server.close();
  }
}
