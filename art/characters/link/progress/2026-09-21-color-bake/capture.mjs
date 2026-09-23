// Captures the current real loader's one-time grade. CPU Canvas2D only; no renderer.
// node art/characters/link/progress/2026-09-21-color-bake/capture.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';
import { sha, unpack, imageBytes, contract } from './patch.mjs';

const out = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(ROOT, 'public/models/link/link-runtime.glb');
const bytes = await fs.readFile(sourcePath), source = unpack(bytes);
assert.equal(sha(bytes), 'ea93932d8afe02ec4bbcf3487fb20ce3f55272fb60f20998dc728cb637ae575f');
const runtimePath = path.join(ROOT, 'src/world/character/glbLink.ts');
const gradePath = path.join(ROOT, 'src/world/character/linkColorGrade.ts');
const runtime = await fs.readFile(runtimePath), grade = await fs.readFile(gradePath);
assert.equal(sha(grade), 'c24c50565c4027cbdaff8e715b0d7836c22c6d11b8de645b8edc89a7816afab1');
const mapping = [{ materialIndex: 1, imageIndex: 2 }, { materialIndex: 2, imageIndex: 4 }]
  .map(x => ({ ...x, material: source.doc.materials[x.materialIndex].name, image: source.doc.images[x.imageIndex].name }));
const manifest = { kind: 'Exact existing one-time grade captured as PNG; evidence only',
  capturedAt: new Date().toISOString(), source: { file: sourcePath, sha256: sha(bytes), bytes: bytes.length,
    binLength: source.bin.length, binSha256: sha(source.bin), contract: contract(source.doc) },
  runtimeSha256: sha(runtime), gradeSha256: sha(grade), errors: [] };
process.env.ZR_NATIVE_GPU = '0';
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'exact-colour-capture', configureServer(s) {
    s.middlewares.use('/__color-capture', (_req, res) => res.end('<!doctype html><title>CPU colour capture</title>'));
    s.middlewares.use('/__color-source.glb', (_req, res) => { res.setHeader('Content-Type', 'model/gltf-binary'); res.end(bytes); });
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => manifest.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__color-capture');
  manifest.browser = await browser.version();
  const result = await page.evaluate(async ({ mapping, browName }) => {
    const [{ GLTFLoader }, { loadGlbLink }] = await Promise.all([
      import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'), import('/src/world/character/glbLink.ts'),
    ]);
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const hash = async b => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)))
      .map(n => n.toString(16).padStart(2, '0')).join('');
    const pixels = img => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      return { canvas: c, rgba: ctx.getImageData(0, 0, c.width, c.height).data };
    };
    const materials = root => {
      const result = new Map(); root.traverse(o => {
        if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) result.set(m.name, m);
      }); return result;
    };
    const describe = async mats => {
      const result = {}, cache = new Map();
      for (const [name, m] of mats) {
        const row = { color: m.color.toArray(), opacity: m.opacity, roughness: m.roughness,
          metalness: m.metalness, normalScale: m.normalScale?.toArray(), clearcoat: m.clearcoat,
          clearcoatRoughness: m.clearcoatRoughness, side: m.side, maps: {} };
        for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap']) if (m[key]) {
          const t = m[key];
          if (!cache.has(t)) cache.set(t, await hash(pixels(t.image).rgba));
          row.maps[key] = { rgbaSha256: cache.get(t), width: t.image.width, height: t.image.height,
            colorSpace: t.colorSpace, flipY: t.flipY, channel: t.channel,
            wrapS: t.wrapS, wrapT: t.wrapT, minFilter: t.minFilter, magFilter: t.magFilter,
            offset: t.offset.toArray(), repeat: t.repeat.toArray(), rotation: t.rotation };
        }
        result[name] = row;
      } return result;
    };
    const raw = await new GLTFLoader().loadAsync('/__color-source.glb'), rawMats = materials(raw.scene);
    const before = await describe(rawMats);
    // This is the only invocation of the production loader (and therefore the only grade).
    const puppet = await loadGlbLink('/__color-source.glb'), bakedMats = materials(puppet.group);
    const after = await describe(bakedMats), images = [];
    for (const item of mapping) {
      const image = bakedMats.get(item.material).map.image;
      check(image instanceof HTMLCanvasElement, 'real loader returned a graded canvas');
      const sourcePixels = pixels(rawMats.get(item.material).map.image).rgba;
      const rgba = image.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, image.width, image.height).data;
      let changedPixels = 0, alphaChanged = 0, nonOpaquePixels = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (sourcePixels[i] !== rgba[i] || sourcePixels[i + 1] !== rgba[i + 1] || sourcePixels[i + 2] !== rgba[i + 2]) changedPixels++;
        if (sourcePixels[i + 3] !== rgba[i + 3]) alphaChanged++;
        if (rgba[i + 3] !== 255) nonOpaquePixels++;
      }
      const png = image.toDataURL('image/png'), pngBlob = await (await fetch(png)).blob();
      const roundtrip = await createImageBitmap(pngBlob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const rgbaHash = await hash(rgba), roundtripHash = await hash(pixels(roundtrip).rgba); roundtrip.close();
      check(rgbaHash === roundtripHash, 'PNG roundtrip RGBA exact'); check(alphaChanged === 0, 'alpha unchanged');
      images.push({ ...item, width: image.width, height: image.height, sourceRgbaSha256: await hash(sourcePixels),
        rgbaSha256: rgbaHash, roundtripRgbaSha256: roundtripHash, changedPixels, alphaChanged, nonOpaquePixels, png });
    }
    return { before, after, images, gradeAudit: puppet.asset.colorGrade,
      brow: { material: browName, materialIndex: 3, sourceLinearRGBA: [...rawMats.get(browName).color.toArray(), rawMats.get(browName).opacity],
        bakedLinearRGBA: [...bakedMats.get(browName).color.toArray(), bakedMats.get(browName).opacity] } };
  }, { mapping, browName: source.doc.materials[3].name });
  manifest.images = [];
  for (const image of result.images) {
    const { png, ...entry } = image, encoded = Buffer.from(png.split(',')[1], 'base64');
    entry.file = 'baked-' + image.image + '.png'; entry.pngSha256 = sha(encoded); entry.pngBytes = encoded.length;
    entry.sourcePngSha256 = sha(imageBytes(source, image.imageIndex));
    // Independent libvips decoding checks actual PNG bytes outside the browser/Canvas2D implementation.
    const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(decoded.info.width, image.width); assert.equal(decoded.info.height, image.height);
    assert.equal(sha(decoded.data), image.rgbaSha256, 'independent PNG decoder exact');
    entry.independentPngRgbaSha256 = sha(decoded.data);
    await fs.writeFile(path.join(out, 'source-' + image.image + '.png'), imageBytes(source, image.imageIndex));
    await fs.writeFile(path.join(out, entry.file), encoded); manifest.images.push(entry);
  }
  manifest.brow = result.brow; manifest.gradeAudit = result.gradeAudit;
  manifest.before = result.before; manifest.after = result.after;
  const restored = structuredClone(result.after);
  for (const image of mapping) restored[image.material].maps.map = result.before[image.material].maps.map;
  restored[result.brow.material].color = result.before[result.brow.material].color;
  assert.deepEqual(restored, result.before, 'all other material/map state unchanged');
  assert.deepEqual(result.brow.bakedLinearRGBA, [.3, .155, .04, 1]);
  assert.equal(manifest.gradeAudit.maps.length, 2); assert.deepEqual(manifest.errors, []);
  assert.equal(sha(await fs.readFile(runtimePath)), sha(runtime), 'runtime unchanged during capture');
  assert.equal(sha(await fs.readFile(gradePath)), sha(grade), 'table unchanged during capture');
  assert.equal(sha(await fs.readFile(sourcePath)), sha(bytes), 'production GLB unchanged during capture');
  manifest.checks = { oneProductionLoaderGrade: true, pngRoundtripExact: true, independentPngDecodeExact: true,
    alphaExact: true, allOtherMaterialAndMapStateExact: true, productionFilesUnchanged: true };
  await fs.writeFile(path.join(out, 'source-glbLink.ts.txt'), runtime);
  await fs.writeFile(path.join(out, 'source-linkColorGrade.ts.txt'), grade);
  await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ sourceSha256: manifest.source.sha256, runtimeSha256: manifest.runtimeSha256,
    images: manifest.images, brow: manifest.brow, gradeAudit: manifest.gradeAudit, checks: manifest.checks }, null, 2));
} finally { if (browser) await browser.close(); await server.close(); }
