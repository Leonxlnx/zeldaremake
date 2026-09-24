#!/usr/bin/env node
/**
 * diffmap.mjs — where two frames of the same pose differ, and by how much.
 *
 *   node art/environment/squad2-2026-09-23/diffmap.mjs --a shipped.png --b allhigh.png \
 *        --out sheet.jpg [--label-a "shipped LODs"] [--label-b "every tree at its highest LOD"] \
 *        [--tol 8] [--width 760] [--grid 8]
 *
 * Writes a three-panel sheet: A, B, and A with the changed pixels tinted red (alpha by magnitude).
 * Prints the overall changed share and the `grid`×`grid` cells ranked by changed share, so a claim
 * about WHERE a LOD swap shows can be checked against the numbers.
 */
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
const tol = Number(args.tol ?? 8);
const grid = Number(args.grid ?? 8);
const panelWidth = Number(args.width ?? 760);
const bar = 26;

const load = async (file) => {
  const { data, info } = await sharp(path.resolve(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
};
const A = await load(args.a);
const B = await load(args.b);
if (A.width !== B.width || A.height !== B.height) throw new Error(`size mismatch ${A.width}×${A.height} vs ${B.width}×${B.height}`);
const { width, height } = A;

const overlay = Buffer.alloc(width * height * 3);
const cells = Array.from({ length: grid * grid }, () => ({ changed: 0, total: 0, sum: 0 }));
let changed = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * A.channels;
    const o = (y * width + x) * 3;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    const cell = cells[Math.min(grid - 1, Math.floor((y / height) * grid)) * grid + Math.min(grid - 1, Math.floor((x / width) * grid))];
    cell.total++;
    if (d > tol) {
      changed++;
      cell.changed++;
      cell.sum += d;
    }
    // A, with the changed pixels pushed toward red in proportion to the magnitude
    const w = d > tol ? Math.min(1, 0.35 + (d - tol) / 80) : 0;
    overlay[o] = Math.round(A.data[i] * (1 - w) + 255 * w);
    overlay[o + 1] = Math.round(A.data[i + 1] * (1 - w) * (1 - w * 0.5));
    overlay[o + 2] = Math.round(A.data[i + 2] * (1 - w) * (1 - w * 0.5));
  }
}
console.log(`changed > ${tol} levels: ${((100 * changed) / (width * height)).toFixed(2)} % of the frame`);
const ranked = cells
  .map((c, k) => ({ share: c.changed / c.total, mean: c.changed ? c.sum / c.changed : 0, x: k % grid, y: Math.floor(k / grid) }))
  .sort((p, q) => q.share - p.share)
  .slice(0, 6);
for (const c of ranked) {
  console.log(`  cell x ${(c.x / grid).toFixed(2)}–${((c.x + 1) / grid).toFixed(2)} y ${(c.y / grid).toFixed(2)}–${((c.y + 1) / grid).toFixed(2)}: ${(100 * c.share).toFixed(1)} % changed, mean Δ ${c.mean.toFixed(1)} levels`);
}

const panels = [
  { label: args['label-a'] ?? 'A', buffer: await sharp(path.resolve(args.a)).removeAlpha().resize({ width: panelWidth }).png().toBuffer() },
  { label: args['label-b'] ?? 'B', buffer: await sharp(path.resolve(args.b)).removeAlpha().resize({ width: panelWidth }).png().toBuffer() },
  { label: `what changed (> ${tol} levels, red)`, buffer: await sharp(overlay, { raw: { width, height, channels: 3 } }).resize({ width: panelWidth }).png().toBuffer() },
];
const panelHeight = Math.round((height / width) * panelWidth);
const sheetWidth = panels.length * panelWidth + (panels.length - 1) * 4;
let x = 0;
const labels = panels
  .map((p) => {
    const t = `<rect x="${x}" y="0" width="${panelWidth}" height="${bar}" fill="#101014"/><text x="${x + 10}" y="${bar - 8}" font-family="DejaVu Sans, sans-serif" font-size="15" fill="#f2f2f2">${p.label.replace(/[<>&]/g, '')}</text>`;
    x += panelWidth + 4;
    return t;
  })
  .join('');
const composite = [{ input: Buffer.from(`<svg width="${sheetWidth}" height="${panelHeight + bar}">${labels}</svg>`), left: 0, top: 0 }];
x = 0;
for (const p of panels) {
  composite.push({ input: p.buffer, left: x, top: bar });
  x += panelWidth + 4;
}
const out = path.resolve(args.out ?? 'diffmap.jpg');
await sharp({ create: { width: sheetWidth, height: panelHeight + bar, channels: 3, background: '#101014' } })
  .composite(composite)
  .jpeg({ quality: Number(args.quality ?? 88) })
  .toFile(out);
console.log(`→ ${out} (${sheetWidth}×${panelHeight + bar})`);
