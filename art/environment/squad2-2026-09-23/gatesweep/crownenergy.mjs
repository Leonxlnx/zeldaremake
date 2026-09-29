#!/usr/bin/env node
/**
 * crownenergy.mjs — `dither/PROPOSAL.md` check 2 ("the pattern can crawl"), as a number.
 *
 *   node art/environment/squad2-2026-09-23/gatesweep/crownenergy.mjs \
 *        --dir /tmp/sweep-off --dir /tmp/sweep-on --gates 29,30,31,32,33,34,35 \
 *        [--box 0.25,0.07,0.15,0.20] [--size 960x540]
 *
 * A screen-door mask that reads as noise raises the LOCAL HIGH-FREQUENCY ENERGY of the region it
 * covers: half the fragments of a crown discarded on a `gl_FragCoord` hash is a per-pixel checker, and
 * a checker is the highest-frequency signal a raster can hold. So take the Laplacian variance of the
 * crown box the diffmap ranked first, over every gate of a sweep, and compare the dithered build's
 * range against the undithered one's. A stipple that a player would see as noise cannot hide here.
 *
 * `--box x,y,w,h` is in frame fractions. Defaults to the cell `gatesweep` found the rung swap in at the
 * owner's north pose.
 */
import path from 'node:path';
import sharp from 'sharp';
import { laplacianVariance } from '../../../../gauntlet/scripts/lib/image.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const dirs = argv.reduce((acc, a, i) => (a === '--dir' && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);
if (!dirs.length) throw new Error('pass at least one --dir <sweep output dir>');
const [W, H] = String(flag('size', '960x540')).split('x').map(Number);
const gates = String(flag('gates', '29,30,31,32,33,34,35')).split(',').map(Number);
const [fx, fy, fw, fh] = String(flag('box', '0.25,0.07,0.15,0.20')).split(',').map(Number);
const box = { left: Math.round(fx * W), top: Math.round(fy * H), width: Math.round(fw * W), height: Math.round(fh * H) };

for (const dir of dirs) {
  const cells = [];
  for (const g of gates) {
    const file = path.join(dir, `gate-${String(g).replace('.', 'p')}.png`);
    const { data, info } = await sharp(file).extract(box).greyscale().raw().toBuffer({ resolveWithObject: true });
    const gray = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) gray[i] = data[i] / 255;
    cells.push({ gate: g, energy: Number(laplacianVariance(gray, info.width, info.height).toFixed(5)) });
  }
  const lo = Math.min(...cells.map((c) => c.energy));
  const hi = Math.max(...cells.map((c) => c.energy));
  console.log(`${path.basename(dir).padEnd(12)} ${cells.map((c) => `${c.gate}:${c.energy.toFixed(5)}`).join('  ')}   range ${lo.toFixed(5)}–${hi.toFixed(5)}`);
}
