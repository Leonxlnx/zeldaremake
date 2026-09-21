// Exact decoded pixels/materials; optional production mode also checks the adopted loader.
// node verify.mjs BAKED.glb EXPECTED_BAKED_SHA256 [production]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';
import { sha, unpack, imageBytes } from './patch.mjs';

assert.ok([4,5].includes(process.argv.length), 'node verify.mjs BAKED.glb EXPECTED_BAKED_SHA256 [production]');
const production = process.argv[4] === 'production';
assert.ok(process.argv.length === 4 || production, 'unknown verification mode');
const [input, expectedHash] = process.argv.slice(2), here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(path.join(here, 'capture.json')));
const compression = JSON.parse(await fs.readFile(path.join(here, 'png-compression.json')));
const bytes = await fs.readFile(input), glb = unpack(bytes);
assert.equal(sha(bytes), expectedHash, 'baked input SHA256');
for (const i of manifest.images) assert.ok([i.pngSha256, compression.images.find(x => x.imageIndex === i.imageIndex).pngSha256]
  .includes(sha(imageBytes(glb, i.imageIndex))), 'embedded original or lossless captured PNG');
const report = { kind: 'Independent raw GLTFLoader versus captured production grade',
  input: path.resolve(input), inputSha256: expectedHash, sourceSha256: manifest.source.sha256,
  capturedRuntimeSha256: manifest.runtimeSha256, capturedGradeSha256: manifest.gradeSha256,
  browserGradeInvocations: 0, productionLoader: production, rendererCreated: false, errors: [] };
process.env.ZR_NATIVE_GPU = '0';
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'baked-colour-parity', configureServer(s) {
    s.middlewares.use('/__color-verify', (_req, res) => res.end('<!doctype html><title>CPU baked colour parity</title>'));
    s.middlewares.use('/__color-baked.glb', (_req, res) => { res.setHeader('Content-Type', 'model/gltf-binary'); res.end(bytes); });
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__color-verify');
  report.browser = await browser.version();
  if (production) report.runtimeSha256 = sha(await fs.readFile(path.join(ROOT,'src/world/character/glbLink.ts')));
  report.materials = await page.evaluate(async production => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync('/__color-baked.glb'), mats = new Map(), result = {}, hashes = new Map();
    let scene = gltf.scene;
    if (production) {
      const {loadGlbLink} = await import('/src/world/character/glbLink.ts');
      const puppet = await loadGlbLink('/__color-baked.glb');
      if (puppet.asset.colorGrade !== null) throw new Error('Baked asset was graded again');
      scene = puppet.group;
    }
    scene.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.set(m.name, m); });
    for (const [name, m] of mats) {
      const row = { color: m.color.toArray(), opacity: m.opacity, roughness: m.roughness,
        metalness: m.metalness, normalScale: m.normalScale?.toArray(), clearcoat: m.clearcoat,
        clearcoatRoughness: m.clearcoatRoughness, side: m.side, maps: {} };
      for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (m[key]) {
        const t = m[key], image = t.image;
        if (image instanceof HTMLCanvasElement) throw new Error('raw loader must not produce a graded canvas');
        if (!hashes.has(t)) {
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0);
          const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
          hashes.set(t, Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', rgba)))
            .map(n => n.toString(16).padStart(2, '0')).join(''));
        }
        row.maps[key] = { rgbaSha256: hashes.get(t), width: image.width, height: image.height,
          colorSpace: t.colorSpace, flipY: t.flipY, channel: t.channel,
          wrapS: t.wrapS, wrapT: t.wrapT, minFilter: t.minFilter, magFilter: t.magFilter,
          offset: t.offset.toArray(), repeat: t.repeat.toArray(), rotation: t.rotation };
      }
      result[name] = row;
    } return result;
  }, production);
  // JSON normalization removes undefined optional fields just as the captured manifest does.
  assert.deepEqual(JSON.parse(JSON.stringify(report.materials)), manifest.after, 'all decoded pixels and material state equal the graded baseline');
  assert.deepEqual(report.errors, []);
  report.exactPixelAndMaterialParity = true;
  await fs.writeFile(input + (production ? '.production-parity.json' : '.parity.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ inputSha256: report.inputSha256, exactPixelAndMaterialParity: true,
    browserGradeInvocations: 0, materialCount: Object.keys(report.materials).length, errors: report.errors }, null, 2));
} finally { if (browser) await browser.close(); await server.close(); }
