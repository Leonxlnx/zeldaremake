#!/usr/bin/env node
/**
 * squad3 before/after sheets: for each pose, BEFORE above AFTER (or side by side) with an
 * optional crop, written as one JPEG per pose plus a mean/percentile read of a named box.
 *
 *   node gauntlet/tmp/squad3-compare.mjs --before /tmp/before --after /tmp/after1 \
 *        --out art/environment/squad3-2026-09-23 --names l3-owner-north,l3-column-6m,...
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const before = path.resolve(args.before);
const after = path.resolve(args.after);
const out = path.resolve(args.out);
const names = String(args.names).split(',');
const crops = args.crops ? JSON.parse(fs.readFileSync(path.resolve(args.crops), 'utf8')) : {};
fs.mkdirSync(out, { recursive: true });

const label = (text, w) =>
  Buffer.from(
    `<svg width="${w}" height="26"><rect width="${w}" height="26" fill="#000" fill-opacity="0.62"/><text x="8" y="18" fill="#fff" font-size="15" font-family="sans-serif">${text}</text></svg>`,
  );

for (let i = 0; i < names.length; i++) {
  const name = names[i];
  const f = `f${String(i).padStart(4, '0')}.png`;
  const crop = crops[name];
  const prep = async (dir, tag) => {
    let img = sharp(path.join(dir, f));
    if (crop) img = sharp(await img.extract(crop).toBuffer()).resize(crop.width * (crop.zoom ?? 1));
    const buf = await img.toBuffer();
    const meta = await sharp(buf).metadata();
    return sharp(buf).composite([{ input: label(`${tag} — ${name}`, meta.width), top: 0, left: 0 }]).toBuffer();
  };
  const b = await prep(before, 'BEFORE');
  const a = await prep(after, 'AFTER');
  const mb = await sharp(b).metadata();
  const sheet = await sharp({ create: { width: mb.width * 2 + 6, height: mb.height, channels: 3, background: '#101010' } })
    .composite([
      { input: b, top: 0, left: 0 },
      { input: a, top: 0, left: mb.width + 6 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
  const file = path.join(out, `${name}-before-after.jpg`);
  fs.writeFileSync(file, sheet);
  // mean linear-ish read of the whole (cropped) frame for a quick number
  const stat = async (buf) => {
    const s = await sharp(buf).stats();
    return s.channels.slice(0, 3).map((c) => Math.round(c.mean * 10) / 10);
  };
  console.log(name, 'before rgb', await stat(b), 'after rgb', await stat(a), '->', file);
}
