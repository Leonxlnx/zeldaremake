#!/usr/bin/env node
/**
 * cellzoom.mjs — magnify one `diffmap.mjs` grid cell of a before/after pair, side by side.
 *
 *   node art/environment/squad2-2026-09-23/cellzoom.mjs --a before.png --b after.png \
 *        --cell 0.75,0.88,0.13,0.25 --out cell-6x.png [--zoom 6] [--grid 8] [--gap 8]
 *
 * `--cell x0,x1,y0,y1` takes the fractional bounds diffmap prints for a ranked cell, so the crop is
 * exactly the cell whose changed share is under discussion. Alternatively `--ij col,row` with `--grid`.
 *
 * This exists because of the rule in INDEX.md: a small changed-share is not a small change. 0.52 % of
 * hero A once deleted two distant trunks and the two full frames were indistinguishable at 1x. The
 * only way to know what a share means is to look at the worst cell at a magnification where a missing
 * trunk cannot hide.
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
const zoom = Number(args.zoom ?? 6);
const grid = Number(args.grid ?? 8);
const gap = Number(args.gap ?? 8);

const meta = await sharp(path.resolve(args.a)).metadata();
let x0;
let x1;
let y0;
let y1;
if (args.cell) {
  [x0, x1, y0, y1] = String(args.cell).split(',').map(Number);
} else if (args.ij) {
  const [col, row] = String(args.ij).split(',').map(Number);
  x0 = col / grid;
  x1 = (col + 1) / grid;
  y0 = row / grid;
  y1 = (row + 1) / grid;
} else {
  console.error('pass --cell x0,x1,y0,y1 or --ij col,row');
  process.exit(1);
}
const left = Math.round(x0 * meta.width);
const top = Math.round(y0 * meta.height);
const w = Math.max(1, Math.round((x1 - x0) * meta.width));
const h = Math.max(1, Math.round((y1 - y0) * meta.height));

const crop = async (file) =>
  await sharp(path.resolve(file))
    .extract({ left, top, width: w, height: h })
    .resize({ width: w * zoom, height: h * zoom, kernel: 'nearest' })
    .removeAlpha()
    .raw()
    .toBuffer();

const A = await crop(args.a);
const B = await crop(args.b);
const cw = w * zoom;
const ch = h * zoom;
const sheet = Buffer.alloc((cw * 2 + gap) * ch * 3, 24);
for (let y = 0; y < ch; y++) {
  A.copy(sheet, (y * (cw * 2 + gap)) * 3, y * cw * 3, (y + 1) * cw * 3);
  B.copy(sheet, (y * (cw * 2 + gap) + cw + gap) * 3, y * cw * 3, (y + 1) * cw * 3);
}
await sharp(sheet, { raw: { width: cw * 2 + gap, height: ch, channels: 3 } })
  .png()
  .toFile(path.resolve(args.out));

// the numbers that go with the picture: how much of THIS cell moved and by how much
let changed = 0;
let sum = 0;
let max = 0;
for (let i = 0; i < A.length; i += 3) {
  const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
  if (d > 2) {
    changed++;
    sum += d;
  }
  if (d > max) max = d;
}
const px = A.length / 3;
console.log(
  `cell x ${x0}-${x1} y ${y0}-${y1} (${w}x${h} px at ${zoom}x): ${((changed / px) * 100).toFixed(2)} % changed, ` +
    `mean delta ${changed ? (sum / changed).toFixed(1) : '0.0'} levels, max ${max} -> ${args.out}`,
);
