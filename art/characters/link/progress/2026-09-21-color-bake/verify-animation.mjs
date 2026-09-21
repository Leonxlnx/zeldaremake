// Independent raw GLTFLoader animation decoding; no project loader, grade or renderer.
// node verify-animation.mjs SOURCE.glb SOURCE_SHA256 DELIVERY.glb DELIVERY_SHA256
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';
import { sha } from './patch.mjs';
assert.equal(process.argv.length, 6, 'node verify-animation.mjs SOURCE.glb SOURCE_SHA256 DELIVERY.glb DELIVERY_SHA256');
const [sourcePath, sourceHash, deliveryPath, deliveryHash] = process.argv.slice(2);
const buffers = await Promise.all([sourcePath, deliveryPath].map(p => fs.readFile(p)));
assert.equal(sha(buffers[0]), sourceHash); assert.equal(sha(buffers[1]), deliveryHash);
const report = { kind: 'Independent GLTFLoader animation parity', source: path.resolve(sourcePath), sourceSha256: sourceHash,
  delivery: path.resolve(deliveryPath), deliverySha256: deliveryHash, projectLoaderInvocations: 0, rendererCreated: false, errors: [] };
process.env.ZR_NATIVE_GPU = '0';
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'delivery-animation-parity', configureServer(s) {
    s.middlewares.use('/__animation-parity', (_req, res) => res.end('<!doctype html><title>CPU animation parity</title>'));
    buffers.forEach((b, i) => s.middlewares.use('/__animation-' + i + '.glb', (_req, res) => {
      res.setHeader('Content-Type', 'model/gltf-binary'); res.end(b);
    }));
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__animation-parity'); report.browser = await browser.version();
  const decoded = await page.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const hash = async array => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength))))
      .map(n => n.toString(16).padStart(2, '0')).join('');
    const results = [];
    for (const i of [0, 1]) {
      const gltf = await new GLTFLoader().loadAsync('/__animation-' + i + '.glb'), clips = [];
      for (const clip of gltf.animations) {
        const tracks = [];
        for (const t of clip.tracks) tracks.push({ name: t.name, valueType: t.ValueTypeName, interpolation: t.getInterpolation(),
          timesType: t.times.constructor.name, valuesType: t.values.constructor.name,
          timesLength: t.times.length, valuesLength: t.values.length,
          timesSha256: await hash(t.times), valuesSha256: await hash(t.values) });
        clips.push({ name: clip.name, duration: clip.duration, blendMode: clip.blendMode, tracks });
      }
      results.push(clips);
    }
    return results;
  });
  assert.deepEqual(decoded[1], decoded[0], 'all decoded animation names, timing, interpolation and track bytes exact');
  assert.deepEqual(report.errors, []); report.clips = decoded[1]; report.allDecodedAnimationDataExact = true;
  report.decodedAnimationSha256 = sha(JSON.stringify(decoded[1]));
  await fs.writeFile(deliveryPath + '.animation-parity.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ deliverySha256: deliveryHash, allDecodedAnimationDataExact: true,
    clips: report.clips.map(c => ({ name: c.name, duration: c.duration, tracks: c.tracks.length })),
    decodedAnimationSha256: report.decodedAnimationSha256, errors: report.errors }, null, 2));
} finally { if (browser) await browser.close(); await server.close(); }
