/** CPU atlas contract: actual candidate vs pinned baseline and correctly encoded brush oracle. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { LinearToSRGB, SRGBToLinear } from 'three/src/math/ColorManagement.js';

const ref = process.argv[2] || '64d5b7c9';
const out = resolve('gauntlet/tmp/atlas-encoding-candidate');
mkdirSync(out, { recursive: true });
const { createCanvas, ImageData } = createRequire(import.meta.url)('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const source = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8' });
function compile(text, corrected = false) {
  if (corrected) for (const channel of ['r', 'g', 'b']) {
    text = text.replaceAll(`Math.round(c.${channel} * 255)`, `Math.round(encodeAtlasChannel(c.${channel}) * 255)`);
  }
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'encodeAtlasChannel', code)((id) => { assert.equal(id, 'three'); return THREE; }, module, module.exports, LinearToSRGB);
  return module.exports;
}
const leavesSource = source('src/world/trees/leaf-cluster-texture.ts');
const roofSource = source('src/world/canopy/atlas.ts');
assert.equal((leavesSource.match(/Math.round\(c.r \* 255\)/g) || []).length, 3);
assert.equal((roofSource.match(/Math.round\(c.r \* 255\)/g) || []).length, 1);
const candidateLeavesSource = readFileSync('src/world/trees/leaf-cluster-texture.ts', 'utf8');
const candidateRoofSource = readFileSync('src/world/canopy/atlas.ts', 'utf8');
const leaves = [compile(leavesSource), compile(candidateLeavesSource)];
const roofs = [compile(roofSource), compile(candidateRoofSource)];
const leafOracle = compile(leavesSource, true), roofOracle = compile(roofSource, true);
// Every statement outside the private Color-to-CSS helper declarations is unchanged.
function withoutHelpers(text) {
  return text.replaceAll('\r\n', '\n').replace(/^  const srgb = new Color\(\);\n/gm, '')
    .replace(/^  const css = [^\n]+? => \{\n[\s\S]*?^  \};/gm, '  const css = COLOR_HELPER;')
    .replace(/^  const css = [^\n]+? => [^\n]+;/gm, '  const css = COLOR_HELPER;');
}
assert.equal(withoutHelpers(candidateLeavesSource), withoutHelpers(leavesSource), 'Only three leaf brush helpers may change');
assert.equal(withoutHelpers(candidateRoofSource), withoutHelpers(roofSource), 'Only the roof brush helper may change');
const { createRng } = compile(source('src/world/util/prng.ts'));
const { WORLD } = compile(source('src/world/config.ts'));
const palette = WORLD.palette;
const rgb = (c) => [c.r, c.g, c.b];
const weights = [0.2126, 0.7152, 0.0722];
const luma = (c) => c.reduce((sum, value, i) => sum + value * weights[i], 0);
const decode = Array.from({ length: 256 }, (_, i) => SRGBToLinear(i / 255));
const cases = [
  { name: 'cluster-512', module: leaves, fn: 'createLeafClusterTexture', fork: 'trees/leaf-cluster', size: 512, threshold: 0.42, solidPatch: true },
  { name: 'detail-1024', module: leaves, fn: 'createLeafClusterDetail', fork: 'trees/leaf-cluster', size: 1024, threshold: 0.42, solidPatch: true },
  { name: 'detail-512', module: leaves, fn: 'createLeafClusterDetail', fork: 'trees/leaf-cluster', size: 512, threshold: 0.42, solidPatch: true },
  { name: 'far-crown-1024', module: leaves, fn: 'createFarCrownAtlas', fork: 'trees', size: 1024, threshold: 0.3, cells: true },
  { name: 'roof-1024', module: roofs, fn: 'createRoofAtlas', fork: 'canopy-roof', size: 1024, threshold: 0.4, cells: true },
  { name: 'roof-512', module: roofs, fn: 'createRoofAtlas', fork: 'canopy-roof', size: 512, threshold: 0.4, cells: true },
];
function pixels(texture) {
  const { width, height } = texture.image;
  const data = texture.isDataTexture ? new Uint8ClampedArray(texture.image.data) : texture.image.getContext('2d').getImageData(0, 0, width, height).data;
  return { width, height, data, texture, flipped: Boolean(texture.isDataTexture) };
}
function render(spec, index) {
  const result = spec.module[index][spec.fn](createRng(WORLD.seed).fork(spec.fork), palette, spec.size);
  return { color: pixels(result.color || result), auxiliary: result.normal ? pixels(result.normal) : result.depth ? pixels(result.depth) : null };
}
function measure(pix, spec, cell = null) {
  const total = [0, 0, 0], enc = [0, 0, 0], detail = [0, 0, 0], lower = [0, 0, 0];
  const luminances = [];
  const { data, width, height } = pix;
  let count = 0, allLower = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (spec.solidPatch && x < Math.ceil(width * 0.1) && y >= height - Math.ceil(height * 0.1)) continue;
    if (cell !== null && (Math.floor(x / (width / 2)) + 2 * Math.floor(y / (height / 2))) !== cell) continue;
    const i = (y * width + x) * 4;
    if (data[i + 3] < spec.threshold * 255) continue;
    const v = [decode[data[i]], decode[data[i + 1]], decode[data[i + 2]]];
    count++; luminances.push(luma(v));
    if (v.every((c) => c / 0.8 <= 0.45)) allLower++;
    for (let c = 0; c < 3; c++) {
      total[c] += v[c]; enc[c] += data[i + c] / 255;
      detail[c] += Math.min(1.9, Math.max(0.45, v[c] / 0.8));
      if (v[c] / 0.8 <= 0.45) lower[c]++;
    }
  }
  const linearMean = total.map((v) => v / count), encodedMean = enc.map((v) => v / count);
  luminances.sort((a, b) => a - b);
  return { coveredPixels: count, linearMean, linearLuma: luma(linearMean), encodedMean, encodedLuma: luma(encodedMean),
    linearPercentiles: [0.05, 0.5, 0.95].map((p) => luminances[Math.floor((count - 1) * p)]),
    nearDetailMean: detail.map((v) => v / count), nearDetailLuma: luma(detail.map((v) => v / count)),
    nearDetailLowerClampFraction: lower.map((v) => v / count), allChannelsLowerClamped: allLower / count };
}
function alphaHash(pix) { return hash(Uint8Array.from({ length: pix.width * pix.height }, (_, i) => pix.data[i * 4 + 3])); }
function paintDisplay(pix, context, x, y, size) {
  const canvas = createCanvas(pix.width, pix.height), ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(pix.data, pix.width, pix.height), 0, 0);
  context.save();
  if (pix.flipped) { context.translate(x, y + size); context.scale(1, -1); context.drawImage(canvas, 0, 0, size, size); }
  else context.drawImage(canvas, x, y, size, size);
  context.restore();
}
const sheet = createCanvas(1072, 6 * 320 + 52), sc = sheet.getContext('2d');
sc.fillStyle = '#9db7ca'; sc.fillRect(0, 0, sheet.width, sheet.height);
sc.fillStyle = '#14202c'; sc.font = '17px Arial';
sc.fillText('CPU Canvas2D: current bytes', 12, 25); sc.fillText('Color channels encoded once before CSS', 540, 25);
const report = { ref, kind: 'CPU Canvas2D authoring evidence; not a world render or exact Chrome raster', sourceHashes: { leaves: hash(leavesSource), roof: hash(roofSource) },
  candidateSourceHashes: { leaves: hash(candidateLeavesSource), roof: hash(candidateRoofSource) },
  seed: WORLD.seed, palette: { leafCanopy: palette.leafCanopy, leafSun: palette.leafSun },
  simplePalette: {}, cases: [] };
// The far atlas uses the 128px cluster as an alpha mask only. Its RGB must not be
// mistaken for another multiplication or another stage of the color error.
const maskOnlySource = leavesSource.replace(/^  const css = \(c: Color\) =>[^\n]+/m, (line) => {
  for (const channel of ['r', 'g', 'b']) line = line.replace(`Math.round(c.${channel} * 255)`, `Math.round(encodeAtlasChannel(c.${channel}) * 255)`);
  return line;
});
const maskOnly = compile(maskOnlySource);
const oldFar = pixels(leaves[0].createFarCrownAtlas(createRng(WORLD.seed).fork('trees'), palette));
const maskFar = pixels(maskOnly.createFarCrownAtlas(createRng(WORLD.seed).fork('trees'), palette));
assert.equal(hash(oldFar.data), hash(maskFar.data), 'Encoding the internal alpha-mask RGB alone cannot change the far atlas');
report.internalFarTuftRgbHasNoEffect = true;
oldFar.texture.dispose(); maskFar.texture.dispose();
for (const name of ['leafCanopy', 'leafSun']) {
  const c = new THREE.Color(palette[name]);
  const intendedLinear = rgb(c), wrongBytes = intendedLinear.map((v) => Math.round(v * 255)), correctBytes = intendedLinear.map((v) => Math.round(LinearToSRGB(v) * 255));
  const sampledWrong = wrongBytes.map((v) => decode[v]), sampledCorrect = correctBytes.map((v) => decode[v]);
  report.simplePalette[name] = { intendedLinear, wrongBytes, correctBytes, sampledWrong, sampledCorrect,
    lumaWrong: luma(sampledWrong), lumaCorrect: luma(sampledCorrect), intendedSignalRetained: luma(sampledWrong) / luma(sampledCorrect) };
}
for (let row = 0; row < cases.length; row++) {
  const spec = cases[row], a = render(spec, 0), b = render(spec, 1);
  const oracleSpec = { ...spec, module: [null, spec.module === leaves ? leafOracle : roofOracle] };
  const oracle = render(oracleSpec, 1), repeat = render(spec, 1);
  assert.equal(hash(b.color.data), hash(oracle.color.data), `${spec.name}: actual helper returns correctly encoded brush RGB`);
  assert.equal(hash(b.color.data), hash(repeat.color.data), `${spec.name}: actual candidate is deterministic`);
  assert.equal(alphaHash(a.color), alphaHash(b.color), `${spec.name}: alpha coverage remains exact`);
  if (a.auxiliary) assert.equal(hash(a.auxiliary.data), hash(b.auxiliary.data), `${spec.name}: data channels remain exact`);
  for (const key of ['colorSpace', 'minFilter', 'magFilter', 'generateMipmaps', 'anisotropy', 'wrapS', 'wrapT']) assert.equal(a.color.texture[key], b.color.texture[key]);
  const before = measure(a.color, spec), after = measure(b.color, spec);
  const entry = { name: spec.name, threshold: spec.threshold, size: spec.size, alphaUnchanged: true, auxiliaryUnchanged: a.auxiliary ? true : null,
    correctBrushEncoding: true, deterministic: true,
    before, corrected: after, linearLumaRatio: after.linearLuma / before.linearLuma,
    nearDetailLumaRatio: after.nearDetailLuma / before.nearDetailLuma,
    floorResponse: [new THREE.Color(1, 1, 1), new THREE.Color(palette.leafCanopy)].map((tint) => {
      const oldD = luma(before.linearMean.map((v, i) => v * rgb(tint)[i]));
      const newD = luma(after.linearMean.map((v, i) => v * rgb(tint)[i]));
      return { tintLinear: rgb(tint), beforeAlbedoLuma: oldD, afterAlbedoLuma: newD,
        farFloorLumaRatio: (0.54 + 2.4 * newD) / (0.54 + 2.4 * oldD),
        note: 'Floor-only response for ordinary giant card at >=10m, achromatic ambient/filter; excludes direct lighting, fog, grade, transmission and vLeafShade.' };
    }) };
  if (spec.cells) entry.cells = [0, 1, 2, 3].map((cell) => { const before = measure(a.color, spec, cell), after = measure(b.color, spec, cell); return { storageCell: cell, beforeLuma: before.linearLuma, afterLuma: after.linearLuma, ratio: after.linearLuma / before.linearLuma }; });
  report.cases.push(entry);
  sc.fillStyle = '#14202c'; sc.font = '16px Arial'; sc.fillText(spec.name, 12, 54 + row * 320);
  paintDisplay(a.color, sc, 96, 66 + row * 320, 280); paintDisplay(b.color, sc, 624, 66 + row * 320, 280);
  for (const result of [a, b, oracle, repeat]) { result.color.texture.dispose(); result.auxiliary?.texture.dispose(); }
}
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(out, 'cpu-atlas-encoding.png'), sheet.toBuffer('image/png'));
console.log(JSON.stringify({ ref, out, palette: report.simplePalette, cases: report.cases.map(({ name, before, corrected, linearLumaRatio, nearDetailLumaRatio, floorResponse, alphaUnchanged, auxiliaryUnchanged }) =>
  ({ name, coveredPixels: before.coveredPixels, linearLuma: [before.linearLuma, corrected.linearLuma], linearLumaRatio, nearDetailLuma: [before.nearDetailLuma, corrected.nearDetailLuma], nearDetailLumaRatio,
    clampFraction: [before.allChannelsLowerClamped, corrected.allChannelsLowerClamped], farFloorRatios: floorResponse.map((f) => f.farFloorLumaRatio), alphaUnchanged, auxiliaryUnchanged })) }, null, 2));
