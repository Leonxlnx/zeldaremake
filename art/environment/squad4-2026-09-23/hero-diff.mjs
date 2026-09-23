/**
 * squad4 — how far the five hero views moved. SSIM and the changed-pixel share between two render
 * directories of `hero.json` (A / B / C / D / F; E is B's pose).
 *
 *   node art/environment/squad4-2026-09-23/hero-diff.mjs <beforeDir> <afterDir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { toGray, toRgb, ssim, pixelDiffFraction } from '../../../gauntlet/scripts/lib/image.mjs';

const [before, after] = process.argv.slice(2);
if (!before || !after) throw new Error('usage: hero-diff.mjs <beforeDir> <afterDir>');
const shots = JSON.parse(fs.readFileSync(path.resolve('art/environment/squad4-2026-09-23/hero.json'), 'utf8'));
const W = 960;
const H = 540;
for (let i = 0; i < shots.length; i++) {
  const f = `f${String(i).padStart(4, '0')}.png`;
  const a = path.join(before, f);
  const b = path.join(after, f);
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  const [ga, gb] = [await toGray(a, W, H), await toGray(b, W, H)];
  const [ra, rb] = [await toRgb(a, W, H), await toRgb(b, W, H)];
  console.log(`${shots[i].name.padEnd(12)} SSIM ${ssim(ga, gb, W, H).toFixed(4)}   pixels changed > 8/255: ${(pixelDiffFraction(ra, rb, 8) * 100).toFixed(2)} %`);
}
