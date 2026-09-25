#!/usr/bin/env node
/**
 * review.mjs — objective checks over a recorded take, before and after the encode.
 *
 *   node art/environment/opus-cinematic-b-sept25/review.mjs --take gauntlet/out/opus-cinematic-b-sept25/take1
 *        --shots art/environment/opus-cinematic-b-sept25/shots.json [--only a,b] [--out <take>/review]
 *
 * Per shot, from the receipt (camera pose actually set, per frame) and the frames themselves:
 *   - camera jitter: the high-frequency part of the camera path, as screen pixels. The pose is split
 *     into a smooth part (centred 7-frame binomial) and the residual; the residual's angular size at the
 *     shot's fov is reported in px (rotation) and the position residual in mm. A cinematic move has
 *     sub-pixel residuals; a shaking follow camera shows > 0.5 px.
 *   - camera acceleration spikes: frames whose second difference is far above the shot's median
 *     (a hitch / whip / snap), also in px.
 *   - pop-in: 64-cell grid of downscaled luma; a cell whose change between frames i-1 and i is a lone
 *     spike (≥ 4× the median of its own ±4-frame neighbourhood and ≥ 6 grey levels) is a candidate
 *     pop. Motion makes steady diffs; a popping LOD / tile / shadow makes a one-frame step.
 *   - flicker: whole-frame mean luma steps against the local trend.
 *   - clipping: share of pixels with a channel at ≥ 254 (blown) and ≤ 1 (crushed).
 * Per player shot, from steps-<shot>.json (every 60 Hz tick):
 *   - foot slide: during each stance interval, the sole's world x/z drift (edges trimmed 2 ticks)
 *     and its peak speed; a planted foot should stay within a few mm.
 *   - reach clamps, camera clamps, gaits.
 * Writes <out>/review.json and prints a table. Exit code 0 always (it is a report, not a gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const sharp = require('sharp');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const take = path.resolve(opt('take'));
const shotsFile = path.resolve(opt('shots', path.join(HERE, 'shots.json')));
const only = opt('only') ? new Set(opt('only').split(',')) : null;
const outDir = path.resolve(opt('out', path.join(take, 'review')));
fs.mkdirSync(outDir, { recursive: true });
const FPS = 30;
const receipt = JSON.parse(fs.readFileSync(path.join(take, 'receipt.json'), 'utf8'));
const shotsRaw = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
const list = Array.isArray(shotsRaw) ? shotsRaw : shotsRaw.shots;
let f0 = 0;
const plan = list.map((s) => { const n = Math.round(s.s * FPS); const r = { name: s.name, kind: s.kind ?? 'camera', start: f0, frames: n, fovHint: s.camera?.fov }; f0 += n; return r; });

const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const norm = (a) => { const l = len(a) || 1; return a.map((v) => v / l); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
const W7 = [1, 6, 15, 20, 15, 6, 1];
const smooth7 = (arr, i) => {
  let acc = null, w = 0;
  for (let k = -3; k <= 3; k++) {
    const j = Math.min(arr.length - 1, Math.max(0, i + k));
    const c = W7[k + 3];
    acc = acc ? acc.map((v, d) => v + arr[j][d] * c) : arr[j].map((v) => v * c);
    w += c;
  }
  return acc.map((v) => v / w);
};

const GRID_X = 16, GRID_Y = 9, SW = 320, SH = 180;
async function lumaGrid(file) {
  const { data } = await sharp(file).resize(SW, SH, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const cells = new Float64Array(GRID_X * GRID_Y);
  const cw = SW / GRID_X, ch = SH / GRID_Y;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) cells[Math.floor(y / ch) * GRID_X + Math.floor(x / cw)] += data[y * SW + x];
  for (let i = 0; i < cells.length; i++) cells[i] /= cw * ch;
  return { data, cells };
}
async function clipStats(file) {
  const { data, info } = await sharp(file).resize(640, 360, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let hi = 0, lo = 0;
  const n = info.width * info.height;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    if (r >= 254 || g >= 254 || b >= 254) hi++;
    if (r <= 1 && g <= 1 && b <= 1) lo++;
  }
  return { blownPct: +(100 * hi / n).toFixed(3), crushedPct: +(100 * lo / n).toFixed(3) };
}

const report = { take: path.relative(ROOT, take).replaceAll('\\', '/'), shots: [] };
for (const s of plan) {
  if (only && !only.has(s.name)) continue;
  const frames = [];
  for (let i = 0; i < s.frames; i++) {
    const file = `f${String(s.start + i).padStart(4, '0')}.png`;
    const r = receipt.frames[file];
    if (!r || r.shot !== s.name) break;
    frames.push({ file, r });
  }
  const R = { name: s.name, kind: s.kind, start: s.start, frames: s.frames, recorded: frames.length };
  if (frames.length < s.frames) { R.missing = s.frames - frames.length; report.shots.push(R); console.log(`${s.name}: ${frames.length}/${s.frames} frames recorded — skipped`); continue; }
  // ---- camera path
  const P = frames.map((f) => f.r.cameraPose.actual.position);
  const D = frames.map((f) => norm(f.r.cameraPose.actual.direction));
  const fov = frames.map((f) => f.r.cameraPose.actual.fov);
  const pxPerRad = (i) => (1080 / 2) / Math.tan((fov[i] * Math.PI) / 360);
  let rotResMax = 0, rotResRms = 0, posResMax = 0, accPeak = 0, accPeakAt = -1;
  const acc = [];
  let nRes = 0;
  for (let i = 0; i < P.length; i++) {
    // residuals on interior frames only: the centred window clamps at a shot's ends, which biases a moving path
    if (i >= 3 && i < P.length - 3) {
      const ps = smooth7(P, i), ds = norm(smooth7(D, i));
      const rr = Math.acos(Math.min(1, D[i][0] * ds[0] + D[i][1] * ds[1] + D[i][2] * ds[2])) * pxPerRad(i);
      rotResMax = Math.max(rotResMax, rr);
      rotResRms += rr * rr;
      nRes++;
      posResMax = Math.max(posResMax, len(sub(P[i], ps)) * 1000);
    }
    if (i > 0 && i < P.length - 1) {
      // angular acceleration of the view direction (px / frame²) + positional (mm / frame²)
      const a = sub(sub(D[i + 1], D[i]), sub(D[i], D[i - 1]));
      acc.push({ i, px: len(a) * pxPerRad(i), mm: len(sub(sub(P[i + 1], P[i]), sub(P[i], P[i - 1]))) * 1000 });
    }
  }
  const accMed = median(acc.map((a) => a.px));
  for (const a of acc) if (a.px > accPeak) { accPeak = a.px; accPeakAt = a.i; }
  const speedPx = D.slice(1).map((d, i) => Math.acos(Math.min(1, d[0] * D[i][0] + d[1] * D[i][1] + d[2] * D[i][2])) * pxPerRad(i));
  R.camera = {
    rotResidualPxMax: +rotResMax.toFixed(3), rotResidualPxRms: +Math.sqrt(rotResRms / Math.max(1, nRes)).toFixed(3), posResidualMmMax: +posResMax.toFixed(2),
    angAccPxPeak: +accPeak.toFixed(3), angAccPxPeakFrame: accPeakAt, angAccPxMedian: +accMed.toFixed(3), panPxPerFrameMax: +Math.max(...speedPx).toFixed(2),
    travelM: +P.slice(1).reduce((a, p, i) => a + len(sub(p, P[i])), 0).toFixed(3), clampedFrames: frames.filter((f) => f.r.cameraClamped).length,
  };
  // ---- pixels
  const grids = [];
  const clip = { blownPctMax: 0, crushedPctMax: 0 };
  for (const f of frames) {
    const p = path.join(take, 'frames', f.file);
    grids.push((await lumaGrid(p)).cells);
  }
  for (const i of [0, frames.length >> 1, frames.length - 1]) {
    const c = await clipStats(path.join(take, 'frames', frames[i].file));
    clip.blownPctMax = Math.max(clip.blownPctMax, c.blownPct);
    clip.crushedPctMax = Math.max(clip.crushedPctMax, c.crushedPct);
  }
  const cellDiff = [];
  for (let i = 1; i < grids.length; i++) cellDiff.push(grids[i].map((v, k) => Math.abs(v - grids[i - 1][k])));
  const pops = [];
  for (let i = 0; i < cellDiff.length; i++) {
    for (let k = 0; k < GRID_X * GRID_Y; k++) {
      const nb = [];
      for (let j = Math.max(0, i - 4); j <= Math.min(cellDiff.length - 1, i + 4); j++) if (j !== i) nb.push(cellDiff[j][k]);
      const m = median(nb);
      const d = cellDiff[i][k];
      if (d >= 6 && d >= 4 * Math.max(m, 0.6)) pops.push({ frame: s.start + i + 1, cell: [k % GRID_X, Math.floor(k / GRID_X)], diff: +d.toFixed(1), neighbourhoodMedian: +m.toFixed(2) });
    }
  }
  const meanL = grids.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const flicker = [];
  for (let i = 1; i < meanL.length - 1; i++) {
    const trend = (meanL[i - 1] + meanL[i + 1]) / 2;
    if (Math.abs(meanL[i] - trend) > 1.2) flicker.push({ frame: s.start + i, meanLuma: +meanL[i].toFixed(2), trend: +trend.toFixed(2) });
  }
  R.pixels = { popCandidates: pops.length, pops: pops.slice(0, 40), flicker, clip, meanLuma: [+meanL[0].toFixed(1), +meanL.at(-1).toFixed(1)] };
  // ---- feet
  const stepsFile = path.join(take, `steps-${s.name}.json`);
  if (s.kind === 'player' && fs.existsSync(stepsFile)) {
    const st = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
    const rows = st.rows.filter((r) => r.rec);
    const feet = rows[0]?.feet ?? ['L', 'R'];
    const slides = [];
    for (let fi = 0; fi < feet.length; fi++) {
      let run = [];
      const flush = () => {
        if (run.length >= 8) {
          const core = run.slice(2, -2);
          const a = core[0].sole[fi], b = core.at(-1).sole[fi];
          const drift = Math.hypot(b[0] - a[0], b[2] - a[2]) * 1000;
          let vmax = 0;
          for (let k = 1; k < core.length; k++) vmax = Math.max(vmax, Math.hypot(core[k].sole[fi][0] - core[k - 1].sole[fi][0], core[k].sole[fi][2] - core[k - 1].sole[fi][2]) * 1000 * 60);
          slides.push({ foot: feet[fi], fromEdit: run[0].edit, ticks: run.length, driftMm: +drift.toFixed(1), peakMmPerS: +vmax.toFixed(0), gait: run[run.length >> 1].gait });
        }
        run = [];
      };
      for (const r of rows) { if (r.stance[fi]) run.push(r); else flush(); }
      flush();
    }
    const gaits = {};
    for (const r of rows) gaits[r.gait] = (gaits[r.gait] ?? 0) + 1;
    R.feet = {
      gaits, stanceIntervals: slides.length, footfalls: st.events.filter((e) => e.rec).length,
      maxDriftMm: slides.length ? Math.max(...slides.map((x) => x.driftMm)) : 0, medianDriftMm: +median(slides.map((x) => x.driftMm)).toFixed(1),
      worst: [...slides].sort((a, b) => b.driftMm - a.driftMm).slice(0, 4),
      reachClampedTicks: rows.filter((r) => r.reachClamped).length, minGapM: Math.min(...rows.flatMap((r) => r.gapM)), maxGapInStanceM: Math.max(...rows.flatMap((r) => r.gapM.filter((g, i) => r.stance[i]))),
    };
  }
  report.shots.push(R);
  console.log(`${s.name.padEnd(16)} cam res ${R.camera.rotResidualPxMax}px/${R.camera.posResidualMmMax}mm acc ${R.camera.angAccPxPeak}px@${R.camera.angAccPxPeakFrame} pan≤${R.camera.panPxPerFrameMax}px/f | pops ${pops.length} flicker ${flicker.length} blown ${clip.blownPctMax}% | ${R.feet ? `slide max ${R.feet.maxDriftMm} mm med ${R.feet.medianDriftMm} mm, reach ${R.feet.reachClampedTicks}, gaits ${JSON.stringify(R.feet.gaits)}` : ''}`);
}
fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify(report, null, 1));
console.log(`→ ${path.relative(ROOT, path.join(outDir, 'review.json'))}`);
