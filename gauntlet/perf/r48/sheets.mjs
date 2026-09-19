#!/usr/bin/env node
/**
 * sheets.mjs — small evidence images from the six-view captures (fable-6, round 48): per variant a
 * 3×2 contact sheet of the six views, and per view a baseline | variant | difference strip with the
 * share of pixels that changed (the full PNGs stay out of the repo; these JPEGs go in).
 *
 *   node gauntlet/perf/r48/sheets.mjs [--dir gauntlet/perf/r48] [--variants lod18,lod25,prewarm,lod18prewarm] [--out gauntlet/perf/r48/sheets]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else {
    args[a.slice(2)] = n;
    i++;
  }
}
const dir = path.resolve(args.dir ?? 'gauntlet/perf/r48');
const out = path.resolve(args.out ?? path.join(dir, 'sheets'));
const variants = String(args.variants ?? 'lod18,lod25,prewarm,lod18prewarm').split(',').filter(Boolean);
const VIEWS = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
fs.mkdirSync(out, { recursive: true });

const label = (text, w) => Buffer.from(`<svg width="${w}" height="22"><rect width="${w}" height="22" fill="#000" fill-opacity="0.7"/><text x="6" y="15" font-family="Consolas, monospace" font-size="12" fill="#f2b866">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

async function contactSheet(variant) {
  const capDir = path.join(dir, `cap-${variant}`);
  if (!fs.existsSync(path.join(capDir, 'A_stairs.png'))) return null;
  const compare = JSON.parse(fs.readFileSync(path.join(capDir, 'compare.json'), 'utf8'));
  const w = 426, h = 240;
  const tiles = [];
  for (const [i, id] of VIEWS.entries()) {
    const buf = await sharp(path.join(capDir, `${id}.png`)).resize(w, h).composite([{ input: label(`${id.charAt(0)} ${id.slice(2)} · SSIM ${compare.viewpoints?.[id]?.ssim?.toFixed(4) ?? '—'}`, w), top: h - 22, left: 0 }]).toBuffer();
    tiles.push({ input: buf, left: (i % 3) * (w + 2), top: Math.floor(i / 3) * (h + 2) });
  }
  const file = path.join(out, `views-${variant}.jpg`);
  await sharp({ create: { width: w * 3 + 4, height: h * 2 + 2, channels: 3, background: '#000' } }).composite(tiles).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  return file;
}

/** share of pixels whose max channel difference exceeds 8/255, and a difference image (amplified ×4) */
async function diffOf(a, b) {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer({ resolveWithObject: true }), sharp(b).raw().toBuffer({ resolveWithObject: true })]);
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) throw new Error('size mismatch');
  const n = ra.info.width * ra.info.height;
  const ch = ra.info.channels;
  const outBuf = Buffer.alloc(n * 3);
  let changed = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(ra.data[i * ch + c] - rb.data[i * ch + c]));
    if (m > 8) changed++;
    const v = Math.min(255, m * 4);
    outBuf[i * 3] = v; outBuf[i * 3 + 1] = v; outBuf[i * 3 + 2] = v;
  }
  return { fraction: changed / n, image: sharp(outBuf, { raw: { width: ra.info.width, height: ra.info.height, channels: 3 } }) };
}

async function diffStrips(variant) {
  const base = path.join(dir, 'cap-baseline');
  const cap = path.join(dir, `cap-${variant}`);
  if (!fs.existsSync(path.join(cap, 'A_stairs.png')) || !fs.existsSync(path.join(base, 'A_stairs.png'))) return [];
  const w = 640, h = 360;
  const results = [];
  for (const id of VIEWS) {
    const a = path.join(base, `${id}.png`);
    const b = path.join(cap, `${id}.png`);
    const { fraction, image } = await diffOf(a, b);
    // explicit PNG output: a raw-input pipeline would otherwise hand composite() raw bytes
    const tiles = await Promise.all([
      sharp(a).resize(w, h).composite([{ input: label(`baseline · ${id}`, w), top: h - 22, left: 0 }]).png().toBuffer(),
      sharp(b).resize(w, h).composite([{ input: label(`${variant} · ${id}`, w), top: h - 22, left: 0 }]).png().toBuffer(),
      image.resize(w, h).composite([{ input: label(`difference ×4 · ${(fraction * 100).toFixed(2)} % of pixels changed`, w), top: h - 22, left: 0 }]).png().toBuffer(),
    ]);
    const file = path.join(out, `diff-${variant}-${id}.jpg`);
    await sharp({ create: { width: w * 3 + 4, height: h, channels: 3, background: '#000' } }).composite(tiles.map((input, i) => ({ input, left: i * (w + 2), top: 0 }))).jpeg({ quality: 80, mozjpeg: true }).toFile(file);
    results.push({ view: id, fraction, file: path.relative(dir, file) });
  }
  return results;
}

const summary = {};
for (const v of ['baseline', ...variants]) {
  const sheet = await contactSheet(v);
  if (!sheet) { console.error(`sheets: cap-${v} not captured yet`); continue; }
  const diffs = v === 'baseline' ? [] : await diffStrips(v);
  summary[v] = { sheet: path.relative(dir, sheet), diffs };
  console.error(`sheets: ${v} → ${path.relative(dir, sheet)}${diffs.length ? ` · changed pixels ${diffs.map((d) => `${d.view.charAt(0)} ${(d.fraction * 100).toFixed(2)} %`).join(', ')}` : ''}`);
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(summary, null, 2));
