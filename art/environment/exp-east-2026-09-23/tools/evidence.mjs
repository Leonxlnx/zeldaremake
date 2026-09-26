#!/usr/bin/env node
// Evidence from two views.mjs runs (canonical and branch): hero diffs (SSIM, share of pixels changed by
// more than 8/255, the changed pixels' box) with a before | after | |diff| x4 sheet, a perf table, and
// labelled contact sheets of the lane's walking views (JPG, each kept under 400 KB).
//   node art/environment/exp-east-2026-09-23/tools/evidence.mjs --base <dir> --branch <dir> --out <dir> [--sheets name:pose,pose;name:pose,...]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { toGray, toRgb, ssim } from '../../../../gauntlet/scripts/lib/image.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const base = path.resolve(args.base);
const branch = path.resolve(args.branch);
const out = path.resolve(args.out);
fs.mkdirSync(out, { recursive: true });
const W = 960;
const H = 540;
const counts = (d) => Object.fromEntries(JSON.parse(fs.readFileSync(path.join(d, 'counts.json'), 'utf8')).map((r) => [r.pose, r]));
const cb = counts(base);
const cr = counts(branch);
const heroes = Object.keys(cr).filter((k) => /^[A-F]_/.test(k));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const labelSvg = (w, h, text, size = 20) =>
  Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="${Math.min(w - 12, 14 + text.length * size * 0.56)}" height="${size + 12}" rx="4" fill="rgba(0,0,0,0.6)"/><text x="13" y="${size + 10}" font-family="DejaVu Sans, sans-serif" font-weight="bold" font-size="${size}" fill="#fff">${esc(text)}</text></svg>`);
const panel = async (file, w, h, text) => sharp(await sharp(file).resize(w, h, { fit: 'fill' }).png().toBuffer()).composite([{ input: labelSvg(w, h, text, Math.round(h / 14)), top: 0, left: 0 }]).png().toBuffer();
async function jpgUnder(img, file, maxKB = 390) {
  for (const q of [82, 76, 70, 64, 58, 52]) {
    const buf = await sharp(img).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    if (buf.length <= maxKB * 1024 || q === 52) {
      fs.writeFileSync(file, buf);
      return { file, kb: Math.round(buf.length / 1024), q };
    }
  }
}

// ---- hero diffs ----
const heroRows = [];
const diffPanels = [];
for (const id of heroes) {
  const fa = path.join(base, `${id}.png`);
  const fb = path.join(branch, `${id}.png`);
  if (!fs.existsSync(fa) || !fs.existsSync(fb)) continue;
  const [ga, gb] = [await toGray(fa, W, H), await toGray(fb, W, H)];
  const [ra, rb] = [await toRgb(fa, W, H), await toRgb(fb, W, H)];
  let changed = 0;
  const box = { x0: W, y0: H, x1: -1, y1: -1 };
  const diff = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const d = Math.max(Math.abs(ra[i * 3] - rb[i * 3]), Math.abs(ra[i * 3 + 1] - rb[i * 3 + 1]), Math.abs(ra[i * 3 + 2] - rb[i * 3 + 2]));
    for (let c = 0; c < 3; c++) diff[i * 3 + c] = Math.min(255, Math.abs(ra[i * 3 + c] - rb[i * 3 + c]) * 4);
    if (d > 8) {
      changed++;
      const x = i % W;
      const y = Math.floor(i / W);
      box.x0 = Math.min(box.x0, x);
      box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y);
      box.y1 = Math.max(box.y1, y);
    }
  }
  const row = { id, ssim: +ssim(ga, gb, W, H).toFixed(4), changedPct: +((100 * changed) / (W * H)).toFixed(2), box: changed ? box : null };
  heroRows.push(row);
  const pw = 426;
  const ph = 240;
  const diffPng = await sharp(diff, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  diffPanels.push([await panel(fa, pw, ph, `${id} canonical`), await panel(fb, pw, ph, `${id} branch`), await panel(diffPng, pw, ph, `|diff| x4  ${row.changedPct}%`)]);
}
if (diffPanels.length) {
  const pw = 426;
  const ph = 240;
  const sheet = sharp({ create: { width: pw * 3, height: ph * diffPanels.length, channels: 3, background: '#111' } }).composite(diffPanels.flatMap((r, j) => r.map((input, i) => ({ input, left: i * pw, top: j * ph }))));
  const res = await jpgUnder(await sheet.png().toBuffer(), path.join(out, 'hero-diffs.jpg'));
  console.error(`[evidence] hero sheet ${res.kb} KB q${res.q}`);
}

// ---- perf table ----
const fmtM = (t) => (t / 1e6).toFixed(3);
const perf = Object.keys(cr).map((k) => ({ pose: k, baseDraws: cb[k]?.drawCalls ?? null, draws: cr[k].drawCalls, baseTris: cb[k]?.triangles ?? null, tris: cr[k].triangles, tiers: cr[k].tiers }));
let md = '| pose | draws canonical | draws branch | triangles canonical (M) | triangles branch (M) | east tiers drawn |\n| --- | ---: | ---: | ---: | ---: | --- |\n';
for (const p of perf) md += `| \`${p.pose}\` | ${p.baseDraws ?? '—'} | ${p.draws} | ${p.baseTris != null ? fmtM(p.baseTris) : '—'} | ${fmtM(p.tris)} | ${p.tiers?.length ? p.tiers.join(', ') : 'none'} |\n`;
md += '\n| hero | SSIM | pixels changed (> 8/255) | box of changed pixels |\n| --- | ---: | ---: | --- |\n';
for (const r of heroRows) md += `| ${r.id} | ${r.ssim} | ${r.changedPct} % | ${r.box ? `x ${r.box.x0}–${r.box.x1}, y ${r.box.y0}–${r.box.y1}` : '—'} |\n`;
fs.writeFileSync(path.join(out, 'evidence.md'), md);
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ perf, heroes: heroRows }, null, 1));
console.log(md);

// ---- contact sheets ----
const sheetSpec = String(args.sheets ?? '')
  .split(';')
  .filter(Boolean)
  .map((s) => {
    const [name, list] = s.split(':');
    return { name, poses: list.split(',') };
  });
// a sheet entry is a pose of the branch run, or `label=path/to.png` for any other frame
for (const { name, poses } of sheetSpec) {
  const files = poses
    .map((p) => (p.includes('=') ? [p.split('=')[0], path.resolve(p.split('=')[1])] : [p, path.join(branch, `${p}.png`)]))
    .filter(([, f]) => fs.existsSync(f));
  const cols = files.length > 6 ? 3 : 2;
  const pw = cols === 3 ? 426 : 640;
  const ph = cols === 3 ? 240 : 360;
  const rows = Math.ceil(files.length / cols);
  const tiles = [];
  for (const [i, [p, f]] of files.entries()) tiles.push({ input: await panel(f, pw, ph, cr[p] ? `${p}  ${cr[p].drawCalls} draws, ${fmtM(cr[p].triangles)} M` : p), left: (i % cols) * pw, top: Math.floor(i / cols) * ph });
  const img = await sharp({ create: { width: pw * cols, height: ph * rows, channels: 3, background: '#111' } }).composite(tiles).png().toBuffer();
  const res = await jpgUnder(img, path.join(out, `${name}.jpg`));
  console.error(`[evidence] sheet ${name}: ${files.length} views, ${res.kb} KB q${res.q}`);
}
