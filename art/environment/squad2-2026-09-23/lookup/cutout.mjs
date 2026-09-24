#!/usr/bin/env node
/**
 * cutout.mjs — lane 2's measurement of "the canopy reads as flat dark cut-out cards": the owner's
 * look-up (2026-09-23 23:00, owner-2300-foliage-lookup.png) is dark foliage with hard edges over a
 * pale grey wash, and his recording is pale warm crowns at several depths with bright gaps between
 * them. Both are a relation between the foliage pixels and the gap pixels, so split the region at
 * its own median luminance and report, in a band of the frame:
 *
 *   leaf   L, S  — the darker half: the foliage itself (fable-5's read of the 14-58 m crowns was
 *                  HSL s 0.15 / l 0.29 against the reference's 0.05 / 0.42)
 *   gap    L     — the brighter half: the sky and mist between the crowns, which must STAY bright
 *   cutout       — gap L minus leaf L: the silhouette contrast, the "cut-out" itself
 *   edges        — mean |dL| between neighbouring pixels across the split, in %: how hard the
 *                  outlines are (a stencil scores high, layered crowns in haze low)
 *
 *   node cutout.mjs --band 0.0,0.7 [--x 0,1] before.png after.png reference.jpg …
 */
import path from 'node:path';
import sharp from 'sharp';

const argv = process.argv.slice(2);
const files = [];
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
  else files.push(argv[i]);
}
const [y0, y1] = String(args.band || '0,0.7').split(',').map(Number);
const [x0, x1] = String(args.x || '0,1').split(',').map(Number);

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = (r, g, b) => {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2;
  return mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
};

console.log("file                                  leafL  leafS   gapL  cutout  edges%  split");
for (const file of files) {
  const { data, info } = await sharp(path.resolve(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx0 = Math.round(x0 * width);
  const cx1 = Math.round(x1 * width);
  const ry0 = Math.round(y0 * height);
  const ry1 = Math.round(y1 * height);
  const at = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const ls = [];
  for (let y = ry0; y < ry1; y++) for (let x = cx0; x < cx1; x++) ls.push(lum(...at(x, y)));
  // the split is the region's own median unless one is given: a veil lifts far leaves over a median
  // of their own frame and they change class, so a before/after pair must be read at ONE threshold
  const median = args.split !== undefined ? Number(args.split) : ls.slice().sort((a, b) => a - b)[ls.length >> 1];
  let leafL = 0;
  let leafS = 0;
  let leafN = 0;
  let gapL = 0;
  let gapN = 0;
  let edge = 0;
  let edgeN = 0;
  for (let y = ry0; y < ry1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const p = at(x, y);
      const l = lum(...p);
      if (l < median) {
        leafL += l;
        leafS += sat(...p);
        leafN++;
      } else {
        gapL += l;
        gapN++;
      }
      // the outline's hardness: the step to the right neighbour wherever the two straddle the split
      if (x + 1 < cx1) {
        const l2 = lum(...at(x + 1, y));
        if (l < median !== l2 < median) {
          edge += Math.abs(l2 - l);
          edgeN++;
        }
      }
    }
  }
  const name = path.basename(file).padEnd(36).slice(0, 36);
  const f = (v, d = 3) => v.toFixed(d).padStart(6);
  console.log(`${name}${f(leafL / leafN)} ${f(leafS / leafN)} ${f(gapL / gapN)}  ${f(gapL / gapN - leafL / leafN)}  ${f((100 * edge) / Math.max(1, edgeN), 1)}  ${f(median)}`);
}
