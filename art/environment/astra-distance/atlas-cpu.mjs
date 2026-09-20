/** CPU-only evidence: actual Canvas2D atlas painter, no browser/WebGL and no installed dependency. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import sharp from 'sharp';

const bundledCanvas = process.env.ZR_CPU_CANVAS_PACKAGE || 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas';
const { createCanvas, loadImage } = createRequire(import.meta.url)(bundledCanvas);
globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return createCanvas(1, 1); } };
const compile = (source) => {
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => { assert.equal(id, 'three'); return THREE; }, module, module.exports);
  return module.exports;
};
const file = 'src/world/trees/leaf-cluster-texture.ts';
const baselineRef = process.argv[2] || 'fcc66490';
const before = compile(execFileSync('git', ['show', `${baselineRef}:${file}`], { encoding: 'utf8' }));
const after = compile(readFileSync(file, 'utf8'));
const { createRng } = compile(readFileSync('src/world/util/prng.ts', 'utf8'));
const palette = { leafCanopy: 0x5e764a, leafSun: 0xa1b46d };
const hash = (data) => createHash('sha256').update(data).digest('hex');
const evidence = resolve('art/environment/astra-distance/atlas-cpu');
mkdirSync(evidence, { recursive: true });

function render(painter) {
  const streams = new Map();
  const wrap = (r, path) => {
    const record = (method, args) => { const value = method === 'draw' ? r() : r[method](...args); streams.get(path).push([method, ...args, value]); return value; };
    streams.set(path, []);
    const out = () => record('draw', []);
    for (const method of ['range', 'int', 'pick', 'chance', 'gauss']) out[method] = (...args) => record(method, args);
    out.fork = (label) => wrap(r.fork(label), `${path}/${label}`);
    return out;
  };
  const started = performance.now();
  const texture = painter(wrap(createRng('kokiri-forest-phase1').fork('trees'), 'trees'), palette);
  const ms = performance.now() - started;
  const result = { data: Buffer.from(texture.image.data), width: texture.image.width, height: texture.image.height, ms,
    streams: Object.fromEntries([...streams].map(([key, values]) => [key, { calls: values.length, hash: hash(JSON.stringify(values)) }])),
    texture: { width: texture.image.width, height: texture.image.height, mipmaps: texture.generateMipmaps,
      minFilter: texture.minFilter, magFilter: texture.magFilter, colorSpace: texture.colorSpace, anisotropy: texture.anisotropy, wrapS: texture.wrapS, wrapT: texture.wrapT } };
  texture.dispose();
  return result;
}
function mip({ data, width, height }) {
  const w = width / 2, h = height / 2, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let sum = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) sum += data[((y * 2 + dy) * width + x * 2 + dx) * 4 + c];
    out[(y * w + x) * 4 + c] = Math.round(sum / 4);
  }
  return { data: out, width: w, height: h };
}
function cells({ data, width, height }) {
  const cell = width / 2, result = [];
  for (let i = 0; i < 4; i++) {
    const ox = (i % 2) * cell, oy = (1 - Math.floor(i / 2)) * cell;
    let covered = 0, alpha = 0, sumLum = 0, minX = cell, minY = cell, maxX = 0, maxY = 0;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const k = ((oy + y) * width + ox + x) * 4, a = data[k + 3] / 255;
      alpha += a;
      if (a >= 0.3) {
        covered++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        sumLum += (data[k] * 0.2126 + data[k + 1] * 0.7152 + data[k + 2] * 0.0722) / 255;
      }
    }
    // Transparent components that cannot reach the cell border are real internal sky gaps.
    const visited = new Uint8Array(cell * cell);
    let gaps = 0, gapPixels = 0;
    for (let sy = 0; sy < cell; sy++) for (let sx = 0; sx < cell; sx++) {
      const start = sy * cell + sx;
      if (visited[start] || data[((oy + sy) * width + ox + sx) * 4 + 3] >= 0.3 * 255) continue;
      const queue = [start]; visited[start] = 1;
      let edge = false;
      for (let head = 0; head < queue.length; head++) {
        const p = queue[head], x = p % cell, y = Math.floor(p / cell);
        if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) edge = true;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || ny < 0 || nx >= cell || ny >= cell) continue;
          const q = ny * cell + nx;
          if (!visited[q] && data[((oy + ny) * width + ox + nx) * 4 + 3] < 0.3 * 255) { visited[q] = 1; queue.push(q); }
        }
      }
      if (!edge && queue.length >= 4) { gaps++; gapPixels += queue.length; }
    }
    result.push({ cell: i, coverage: covered / (cell * cell), alphaMean: alpha / (cell * cell), coveredMeanLuma: sumLum / covered, gaps, gapPixels,
      bounds: [minX / cell, minY / cell, (maxX + 1) / cell, (maxY + 1) / cell] });
  }
  return result;
}

const a = render(before.createFarCrownAtlas), b = render(after.createFarCrownAtlas), repeat = render(after.createFarCrownAtlas);
assert.deepEqual(b.texture, a.texture, 'atlas size and sampling remain unchanged');
assert.equal(hash(b.data), hash(repeat.data), 'seeded painter is reproducible');
for (let i = 0; i < 4; i++) assert.deepEqual(b.streams[`trees/far-crown-${i}`], a.streams[`trees/far-crown-${i}`], 'all original clump/leaflet draws remain identical');
await sharp(a.data, { raw: { width: a.width, height: a.height, channels: 4 } }).flip().png().toFile(resolve(evidence, 'before-atlas.png'));
await sharp(b.data, { raw: { width: b.width, height: b.height, channels: 4 } }).flip().png().toFile(resolve(evidence, 'candidate-atlas.png'));
const sheet = createCanvas(1064, 576), sc = sheet.getContext('2d');
sc.fillStyle = '#90b2cb'; sc.fillRect(0, 0, 1064, 576);
sc.fillStyle = '#172730'; sc.font = '18px Arial';
sc.fillText('CPU atlas / original', 16, 28); sc.fillText('CPU atlas / leaf-shaped clumps candidate', 544, 28);
sc.drawImage(await loadImage(resolve(evidence, 'before-atlas.png')), 0, 0, 512, 512, 16, 48, 512, 512);
sc.drawImage(await loadImage(resolve(evidence, 'candidate-atlas.png')), 0, 0, 512, 512, 544, 48, 512, 512);
writeFileSync(resolve(evidence, 'cpu-comparison.png'), sheet.toBuffer('image/png'));
const levels = [];
for (let ma = a, mb = b; ma.width >= 32; ma = mip(ma), mb = mip(mb)) {
  levels.push({ cellPixels: ma.width / 2, before: cells(ma), after: cells(mb) });
}
for (const level of levels) for (let i = 0; i < 4; i++) {
  const old = level.before[i], next = level.after[i];
  assert.ok(next.coverage / old.coverage >= 0.9 && next.coverage / old.coverage <= 1.1, `cell ${i} retains its silhouette at ${level.cellPixels}px`);
  assert.ok(Math.abs(next.coveredMeanLuma / old.coveredMeanLuma - 1) < 0.03, `cell ${i} retains its tone at ${level.cellPixels}px`);
  if (level.cellPixels === 512) {
    assert.ok(Math.abs(next.coverage - old.coverage) < 0.015, `cell ${i} preserves covered area`);
    next.bounds.forEach((v, j) => assert.ok(Math.abs(v - old.bounds[j]) < 0.025, `cell ${i} preserves its outer footprint`));
  }
}
assert.ok(levels[0].after.reduce((sum, c) => sum + c.gaps, 0) > levels[0].before.reduce((sum, c) => sum + c.gaps, 0), 'leaf margins open real internal gaps');
const report = { baselineRef, sourceFile: file, sourceSha256: hash(readFileSync(file)), kind: 'CPU Canvas2D atlas evidence, not a world render',
  renderer: '@napi-rs/canvas from bundled runtime; box-filter alpha mip simulation', beforeHash: hash(a.data), afterHash: hash(b.data),
  deterministic: true, originalStreamsUnchanged: true, texture: b.texture, renderMs: { before: a.ms, after: b.ms, repeat: repeat.ms }, levels };
writeFileSync(resolve(evidence, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ deterministic: report.deterministic, originalStreamsUnchanged: report.originalStreamsUnchanged, texture: report.texture, renderMs: report.renderMs,
  levels: levels.map((l) => ({ cellPixels: l.cellPixels, before: l.before.map((c) => ({ coverage: c.coverage, luma: c.coveredMeanLuma, gaps: c.gaps, gapPixels: c.gapPixels })), after: l.after.map((c) => ({ coverage: c.coverage, luma: c.coveredMeanLuma, gaps: c.gaps, gapPixels: c.gapPixels })) })) }, null, 2));
