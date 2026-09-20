// Temporary renderer inspection through Three's existing devtools hook; no production API edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { ROOT, serveStatic, findChrome, READY_TIMEOUT_MS } from '../../../gauntlet/scripts/lib/browser.mjs';
const out = path.join(ROOT, 'gauntlet/tmp/black-patch-probe' + (process.env.PROBE_MOSS_GUARD ? '-moss-guard' : ''));
await fs.mkdir(out, { recursive: true });
await fs.mkdir(path.join(ROOT, 'dist/__diag'), { recursive: true });
for (const file of ['three.module.js', 'three.core.js'])
  await fs.copyFile(path.join(ROOT, 'node_modules/three/build', file), path.join(ROOT, 'dist/__diag', file));
const settings = JSON.parse(await fs.readFile(new URL('./black-patch-poses.json', import.meta.url), 'utf8'));
const server = await serveStatic(path.join(ROOT, 'dist'));
let browser;
try {
  browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, pipe: true,
    protocolTimeout: READY_TIMEOUT_MS,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-angle=d3d11', '--no-proxy-server', '--hide-scrollbars', '--mute-audio'],
    defaultViewport: { width: 1280, height: 720 } });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.evaluateOnNewDocument(() => {
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
      if (!detail.isWebGLRenderer) return;
      window.__probeRenderer = detail;
      const render = detail.render.bind(detail);
      detail.render = (scene, camera) => {
        if (scene.children.some(o => o.name === 'trees')) {
          window.__probeScene = scene; window.__probeCamera = camera;
          window.__probeHDR = detail.getRenderTarget();
        }
        return render(scene, camera);
      };
    });
  });
  await page.goto(server.url + '/?capture=1&quality=high&dev=0&hud=0', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__ZR__, { timeout: READY_TIMEOUT_MS });
  await page.evaluate(() => __ZR__.ready());
  await page.waitForFunction(() => !document.getElementById('loading') || getComputedStyle(document.getElementById('loading')).opacity === '0', { timeout: READY_TIMEOUT_MS });
  const pose = settings.poses['stair-walk-23'];
  await page.evaluate(async p => { __ZR__.setPose(p.p, p.t, p.fov); __ZR__.setTime(12.6); await __ZR__.render(14, 0); }, pose);
  if (process.env.PROBE_MOSS_GUARD) {
    const patched = await page.evaluate(async () => {
      const materials = new Set();
      __probeScene.traverse(o => {
        for (const m of [o.material].flat().filter(Boolean)) materials.add(m);
      });
      window.__probePatched = 0;
      for (const m of materials) {
        const compile = m.onBeforeCompile, key = m.customProgramCacheKey.call(m);
        m.onBeforeCompile = function(shader, renderer) {
          compile.call(this, shader, renderer);
          if (shader.fragmentShader.includes('if (barkMossCover > 0.0) {')) {
            shader.fragmentShader = shader.fragmentShader.replace('if (barkMossCover > 0.0) {',
              'if (barkMossCover > 0.0 && dot(tbn[0], tbn[0]) > 1e-8 && dot(tbn[1], tbn[1]) > 1e-8) {');
            __probePatched++;
          }
        };
        m.customProgramCacheKey = () => key + ':probe-moss-guard';
        m.needsUpdate = true;
      }
      await __ZR__.render(14, 0);
      return __probePatched;
    });
    console.log('Patched moss programs:', patched);
    if (!patched) throw Error('No moss shader matched');
  }
  await page.screenshot({ path: path.join(out, 'beauty.png') });
  const report = await page.evaluate(async () => {
    const T = await import('/__diag/three.module.js');
    const renderer = window.__probeRenderer, target = window.__probeHDR;
    if (!target || !window.__probeScene) throw Error('Main renderer/scene/target hook missing');
    const gl = renderer.getContext(), previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    const readType = gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
    const pixels = readType === gl.FLOAT ? new Float32Array(target.width * target.height * 4) : new Uint16Array(target.width * target.height * 4);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, readType, pixels);
    const glError = gl.getError(); renderer.setRenderTarget(previous);
    if (glError) throw Error(`HDR read error ${glError}, type ${readType}`);
    const invalid = [], brightest = [];
    let count = 0, maximum = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const rgba = Array.from(pixels.slice(i, i + 4), x => readType === gl.FLOAT ? x : T.DataUtils.fromHalfFloat(x));
      const x = (i / 4) % target.width, y = target.height - 1 - Math.floor(i / 4 / target.width);
      if (!rgba.every(Number.isFinite)) { count++; if (invalid.length < 100) invalid.push({ x, y, rgba: rgba.map(v => Number.isFinite(v) ? v : String(v)) }); }
      const peak = Math.max(...rgba.slice(0, 3));
      if (Number.isFinite(peak) && peak > maximum) { maximum = peak; brightest.push({ x, y, rgba }); }
    }
    const rays = [...invalid.slice(0, 12), { x: 540, y: 494 }].map(pixel => {
      const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2((pixel.x + .5) / target.width * 2 - 1, 1 - (pixel.y + .5) / target.height * 2), window.__probeCamera);
      const hits = ray.intersectObjects(window.__probeScene.children, true).filter(hit => { for(let o = hit.object; o; o=o.parent) if (!o.visible) return false; return true; });
      return { pixel, hits: hits.slice(0, 8).map(h => ({ name: h.object.name, geometry: h.object.geometry?.name, material: h.object.material?.name,
        distance: h.distance, point: h.point.toArray(), uv: h.uv?.toArray(), normal: h.normal?.toArray(), face: h.face, instanceId: h.instanceId,
        attributes: Object.fromEntries(['normal', 'uv', 'aRoot', 'aWind'].map(name => { const a = h.object.geometry?.getAttribute(name); return [name, a && h.face ? [h.face.a,h.face.b,h.face.c].map(i => Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize))) : null]; })) })) };
    });
    return { readType, width: target.width, height: target.height, invalidPixelCount: count, invalid, maximum, brightest: brightest.slice(-5), rays, camera: __ZR__.cameraPose(), stats: __ZR__.stats() };
  });
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ invalidPixelCount: report.invalidPixelCount, maximum: report.maximum, invalid: report.invalid.slice(0, 8), out }));
} finally { await browser?.close(); await server.close(); }
