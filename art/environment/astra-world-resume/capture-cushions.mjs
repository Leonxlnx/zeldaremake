// Diagnostic ablation of the current world. The existing hide hook is reset after every pose.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { serveStatic, launchBrowser, openWorld } from '../../../gauntlet/scripts/lib/browser.mjs';

assert.equal(process.env.ZR_NATIVE_GPU, '1');
assert.equal(process.env.CAPSLOT_STALE_MIN, 'Infinity');
const holder = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'zeldaremake-capslot/lock/holder.json')));
assert.equal(holder.agent, 'astra-world-resume');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const out = path.resolve('art/environment/astra-world-resume/native-current');
assert(!fs.existsSync(path.join(out, 'manifest.json')), 'Do not overwrite capture evidence');
fs.mkdirSync(out, { recursive: true });
const sha = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(cp.execFileSync('git', ['diff', 'HEAD', '--', 'src', 'public'], { encoding: 'utf8' }), '');
const views = [
  { name: 'w05-spine-d', p: [0, 1.45, 0.56], t: [0, 0.01, -1.94], fov: 46 },
  { name: 'w16-spine-d', p: [2.87, 3.78, -32.24], t: [3.29, 2.98, -34.71], fov: 46 },
];
const report = { sha, sourceDiff: '', time: 12.6, quality: 'high', views, holder, images: {}, errors: [] };
report.bundles = Object.fromEntries(fs.readdirSync('dist/assets').filter(f => f.endsWith('.js')).map(f => [f, hash(fs.readFileSync(path.join('dist/assets', f)))]));
report.characterSha256 = hash(fs.readFileSync('dist/models/link/link-runtime.glb'));
const server = await serveStatic(path.resolve('dist')); let browser;
try {
  browser = await launchBrowser();
  report.browser = await browser.version();
  const { page, consoleLines, url } = await openWorld(browser, server.url);
  report.url = url; report.console = consoleLines;
  report.renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  assert(!/swiftshader|software|llvmpipe/i.test(report.renderer));
  for (const pose of views) {
    await page.evaluate(async pose => { __ZR__.setPose(pose.p, pose.t, pose.fov); __ZR__.setTime(12.6); await __ZR__.render(14, 0); }, pose);
    for (const hidden of [false, true]) {
      await page.evaluate(async hidden => { window.__ATMO_HIDE__ = hidden ? ['joint-sprouts-p5-v4'] : []; __ZR__.setTime(12.6); await __ZR__.render(2, 0); }, hidden);
      const name = `${pose.name}-${hidden ? 'hide-cushions' : 'world'}`;
      const image = await page.screenshot({ path: path.join(out, name + '.png') });
      report.images[name] = { sha256: hash(image), hidden: hidden ? ['joint-sprouts-p5-v4'] : [], ...await page.evaluate(() => ({ stats: __ZR__.stats(), camera: __ZR__.cameraPose(), lighting: __ZR__.audit().systems.lighting, hardscape: __ZR__.audit().systems.hardscape, failures: __ZR__.audit().systemFailures })) };
      assert.deepEqual(report.images[name].failures, []);
      console.log('Captured', name);
    }
    await page.evaluate(() => { window.__ATMO_HIDE__ = []; });
  }
  report.errors = consoleLines.filter(s => /^\[pageerror\]/.test(s) || (/^\[page:error\]/.test(s) && /THREE|WebGL|shader|GL_INVALID/.test(s)));
  assert.deepEqual(report.errors, []);
  report.complete = true;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await server.close();
}
console.log(out);
