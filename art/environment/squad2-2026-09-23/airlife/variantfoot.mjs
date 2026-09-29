/**
 * variantfoot.mjs — the footprint of one family, measured WITHOUT a runtime hook.
 *
 * Why this exists: hiding an object from the page (`object.visible = false`) is not safe for
 * families whose own `update()` writes `visible` every frame — `atmosphere/motes.ts` does, so an
 * object-level hide is undone before the frame draws and the family reads as painting nothing.
 * The honest measurement is two builds that differ only in that family's draw, rendered at the
 * same pose with the world clock frozen (`frozen.mjs`), then compared here.
 *
 *   node .../frozen.mjs dist          /tmp/on  --poses p.json --views A_stairs --settle 8
 *   node .../frozen.mjs dist-variant  /tmp/off --poses p.json --views A_stairs --settle 8
 *   node .../variantfoot.mjs /tmp/on /tmp/off
 *
 * The delta math is the same as airlife.mjs, so the numbers drop straight into its table:
 * a pixel counts as moved above 2/255, which ignores dither and keeps faint additive sprites.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [withDir, withoutDir] = process.argv.slice(2);
if (!withDir || !withoutDir) throw new Error('usage: variantfoot.mjs <with-dir> <without-dir>');

const raw = async (file) => await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });

const counts = (dir) => {
  const f = path.join(dir, 'counts.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
const on = counts(withDir);
const off = counts(withoutDir);

const rows = [];
for (const name of Object.keys(on)) {
  const a = path.join(withDir, `${name}.png`);
  const b = path.join(withoutDir, `${name}.png`);
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const A = await raw(a);
  const B = await raw(b);
  let moved = 0;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < A.data.length; i += 3) {
    const d = Math.max(
      Math.abs(A.data[i] - B.data[i]),
      Math.abs(A.data[i + 1] - B.data[i + 1]),
      Math.abs(A.data[i + 2] - B.data[i + 2]),
    );
    if (d > max) max = d;
    if (d > 2) {
      moved++;
      sum += d;
    }
  }
  const px = A.info.width * A.info.height;
  rows.push({
    pose: name,
    drawsWith: on[name]?.draws ?? null,
    drawsWithout: off[name]?.draws ?? null,
    md5With: on[name]?.md5?.slice(0, 8) ?? null,
    md5Without: off[name]?.md5?.slice(0, 8) ?? null,
    sharePct: Math.round(((100 * moved) / px) * 1000) / 1000,
    pixels: moved,
    meanDelta: moved ? Math.round((sum / moved) * 10) / 10 : 0,
    maxDelta: max,
  });
}

for (const r of rows) {
  console.error(
    `${r.pose}: ${r.sharePct} % of pixels (${r.pixels} px) mean Δ ${r.meanDelta}/255 max ${r.maxDelta}/255 — draws ${r.drawsWith} → ${r.drawsWithout}, md5 ${r.md5With} → ${r.md5Without}`,
  );
}
console.log(JSON.stringify(rows, null, 1));
