#!/usr/bin/env node
/**
 * Compare a capture with the reference frames (and optionally the previous take).
 *
 *   node gauntlet/scripts/compare.mjs --in gauntlet/out/last [--previous gauntlet/out/prev] [--ref reference/frames]
 *
 * Writes <in>/compare.json and <in>/<viewpoint>.compare.png strips: [reference | ours | previous].
 *
 * Metrics per viewpoint (all pure JS on top of sharp decode/resize — identical on every machine):
 *   ssim               256×144 luminance SSIM vs reference
 *   phashDistance      Hamming distance of 64-bit DCT pHashes
 *   hueDiffDeg/satDiff/lumDiff   64×36 RGB colour stats, sky masked
 *   sharpnessRatio     Laplacian variance ours / reference at 256×144
 *   skyFraction / overexposedFraction / purpleFraction   on our 256×144 frame
 *   determinismDiff    <det>.png vs <det>.det.png, fraction of pixels differing by > 8/255 (full res)
 *   motionRegionsMoving  <det>.png vs <det>.motion.png, 4×4 regions with mean |Δ| > 1.5/255
 *   depth              copied from checks.json (skyFraction, farLayerCount, maxBucketBeyond20m)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, REFERENCE_FRAMES, readJson, resolveArg, rel, loadRubric } from './lib/paths.mjs';
import { parseArgs } from './lib/cli.mjs';
import { toGray, toRgb, phash, hamming, ssim, laplacianVariance, colorStats, hueDistance, pixelDiffFraction, decodeNative, regionMotion, svgEscape } from './lib/image.mjs';

const SSIM_W = 256;
const SSIM_H = 144;
const COLOR_W = 64;
const COLOR_H = 36;

export const METRIC_KEYS = ['ssim', 'phashDistance', 'hueDiffDeg', 'satDiff', 'lumDiff', 'sharpnessRatio', 'skyFraction', 'overexposedFraction', 'purpleFraction', 'determinismDiff', 'motionRegionsMoving'];

function findImage(dir, id) {
  if (!dir) return null;
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
    const p = path.join(dir, id + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function listViewpoints(inDir) {
  const stats = readJson(path.join(inDir, 'stats.json'), null);
  if (stats?.viewpoints?.length) return stats.viewpoints.map((v) => ({ id: v.id, label: v.label, refSeconds: v.refSeconds }));
  return fs
    .readdirSync(inDir)
    .filter((f) => /^[A-Z]_[A-Za-z0-9]+\.png$/.test(f))
    .map((f) => ({ id: f.replace(/\.png$/, ''), label: f.replace(/\.png$/, ''), refSeconds: null }));
}

export async function compareImages(ours, ref) {
  const [gA, gB] = await Promise.all([toGray(ours, SSIM_W, SSIM_H), toGray(ref, SSIM_W, SSIM_H)]);
  const [hA, hB] = await Promise.all([phash(ours), phash(ref)]);
  const [cA, cB] = await Promise.all([toRgb(ours, COLOR_W, COLOR_H), toRgb(ref, COLOR_W, COLOR_H)]);
  const [fA] = await Promise.all([toRgb(ours, SSIM_W, SSIM_H)]);
  const sA = colorStats(cA, COLOR_W, COLOR_H);
  const sB = colorStats(cB, COLOR_W, COLOR_H);
  const fine = colorStats(fA, SSIM_W, SSIM_H);
  const sharpOurs = laplacianVariance(gA, SSIM_W, SSIM_H);
  const sharpRef = laplacianVariance(gB, SSIM_W, SSIM_H);
  return {
    ssim: round(ssim(gA, gB, SSIM_W, SSIM_H), 4),
    phash: hA,
    refPhash: hB,
    phashDistance: hamming(hA, hB),
    hueDiffDeg: round(hueDistance(sA.meanHue, sB.meanHue), 2),
    satDiff: round(Math.abs(sA.meanSat - sB.meanSat), 4),
    lumDiff: round(Math.abs(sA.meanLum - sB.meanLum), 4),
    sharpness: round(sharpOurs, 6),
    refSharpness: round(sharpRef, 6),
    sharpnessRatio: sharpRef > 0 ? round(sharpOurs / sharpRef, 3) : null,
    skyFraction: round(fine.skyFraction, 4),
    overexposedFraction: round(fine.overexposedFraction, 5),
    purpleFraction: round(fine.purpleFraction, 5),
    meanHue: round(sA.meanHue, 1),
    meanSat: round(sA.meanSat, 3),
    meanLum: round(sA.meanLum, 3),
    ref: { meanHue: round(sB.meanHue, 1), meanSat: round(sB.meanSat, 3), meanLum: round(sB.meanLum, 3), skyFraction: round(sB.skyFraction, 4), purpleFraction: round(sB.purpleFraction, 5) },
  };
}

export async function ownMetrics(ours) {
  const fA = await toRgb(ours, SSIM_W, SSIM_H);
  const fine = colorStats(fA, SSIM_W, SSIM_H);
  return { skyFraction: round(fine.skyFraction, 4), overexposedFraction: round(fine.overexposedFraction, 5), purpleFraction: round(fine.purpleFraction, 5) };
}

export async function determinismDiff(a, b, tol = 8) {
  const A = await decodeNative(a);
  const B = await sharp(b).resize(A.width, A.height, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  return round(pixelDiffFraction(A.rgb, B, tol), 5);
}

export async function motionMetrics(a, b) {
  const A = await decodeNative(a);
  let B = await decodeNative(b);
  if (B.width !== A.width || B.height !== A.height) B = await decodeNative(await sharp(b).resize(A.width, A.height, { fit: 'fill' }).png().toBuffer());
  const m = regionMotion(A.gray, B.gray, A.width, A.height, 4, 1.5 / 255);
  return { motionRegionsMoving: m.moving, motionRegionMeans: m.means.map((x) => round(x * 255, 3)), motionVariance: round(m.variance * 255 * 255, 4) };
}

function round(v, d) {
  return typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : v ?? null;
}

const PANEL_W = 640;
const PANEL_H = 360;
const LABEL_H = 26;
const FOOTER_H = 46;

function labelSvg(text, w, h, { fill = '#111', color = '#fff', size = 14, weight = 600 } = {}) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/>` +
      `<text x="10" y="${Math.round(h / 2 + size * 0.36)}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${svgEscape(text)}</text></svg>`,
  );
}

function footerSvg(lines, w, h) {
  const size = 13;
  const texts = lines.map((t, i) => `<text x="10" y="${18 + i * 18}" font-family="DejaVu Sans Mono, DejaVu Sans, monospace" font-size="${size}" fill="#e8e8e8">${svgEscape(t)}</text>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1b1b1b"/>${texts}</svg>`);
}

async function panel(image, label, tint) {
  const img = image
    ? await sharp(image).resize(PANEL_W, PANEL_H, { fit: 'fill' }).removeAlpha().png().toBuffer()
    : await sharp({ create: { width: PANEL_W, height: PANEL_H, channels: 3, background: '#2a2a2a' } })
        .composite([{ input: labelSvg('no previous take', PANEL_W, PANEL_H, { fill: '#2a2a2a', color: '#777', size: 18, weight: 400 }), top: 0, left: 0 }])
        .png()
        .toBuffer();
  return sharp({ create: { width: PANEL_W, height: PANEL_H + LABEL_H, channels: 3, background: '#000' } })
    .composite([
      { input: labelSvg(label, PANEL_W, LABEL_H, { fill: tint }), top: 0, left: 0 },
      { input: img, top: LABEL_H, left: 0 },
    ])
    .png()
    .toBuffer();
}

export function metricLines(m, extra = {}) {
  const f = (v, d = 3) => (typeof v === 'number' ? v.toFixed(d) : '—');
  const pct = (v) => (typeof v === 'number' ? (v * 100).toFixed(1) + ' %' : '—');
  const l1 = `SSIM ${f(m.ssim)}  pHash ${m.phashDistance ?? '—'}  hueΔ ${f(m.hueDiffDeg, 1)}°  satΔ ${f(m.satDiff)}  lumΔ ${f(m.lumDiff)}  sharp ×${f(m.sharpnessRatio, 2)}  sky ${pct(m.skyFraction)}  over ${pct(m.overexposedFraction)}  purple ${pct(m.purpleFraction)}`;
  const parts = [];
  if (typeof m.determinismDiff === 'number') parts.push(`determinism ${pct(m.determinismDiff)}`);
  if (typeof m.motionRegionsMoving === 'number') parts.push(`motion ${m.motionRegionsMoving}/16 regions`);
  if (m.depth) parts.push(`depth: ${m.depth.farLayerCount} far layers, max bucket >20 m ${pct(m.depth.maxBucketBeyond20m)}`);
  if (extra.deltaText) parts.push(extra.deltaText);
  if (extra.caption) parts.push(extra.caption);
  return [l1, parts.join('  ·  ') || ' '];
}

export async function buildStrip({ reference, ours, previous, labels, metrics, deltaText, caption, out }) {
  const panels = await Promise.all([
    panel(reference, labels.reference, '#7a3b00'),
    panel(ours, labels.ours, '#0d5a2c'),
    panel(previous, labels.previous, '#333'),
  ]);
  const W = PANEL_W * 3;
  const H = LABEL_H + PANEL_H + FOOTER_H;
  await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } })
    .composite([
      { input: panels[0], top: 0, left: 0 },
      { input: panels[1], top: 0, left: PANEL_W },
      { input: panels[2], top: 0, left: PANEL_W * 2 },
      { input: footerSvg(metricLines(metrics, { deltaText, caption }), W, FOOTER_H), top: LABEL_H + PANEL_H, left: 0 },
    ])
    .png({ compressionLevel: 6 })
    .toFile(out);
  return out;
}

export function metricDeltas(cur, prev) {
  if (!prev) return null;
  const d = {};
  for (const k of METRIC_KEYS) if (typeof cur?.[k] === 'number' && typeof prev?.[k] === 'number') d[k] = round(cur[k] - prev[k], 4);
  return d;
}

export function deltaSummary(deltas, limit = 3) {
  if (!deltas) return '';
  const better = { ssim: 1, phashDistance: -1, hueDiffDeg: -1, satDiff: -1, lumDiff: -1, sharpnessRatio: 1, overexposedFraction: -1, determinismDiff: -1, motionRegionsMoving: 1 };
  const items = Object.entries(deltas)
    .filter(([k, v]) => v !== 0 && better[k])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}${better[k] * v > 0 ? ' ▲' : ' ▼'}`);
  return items.join(', ');
}

/**
 * `previousMetrics` = { [viewpoint]: metrics } overrides <previousDir>/compare.json (used when the
 * previous take comes from the monitor branch, which stores metrics in takes.json only).
 */
export async function compareDir({ inDir, previousDir = null, previousMetrics = null, previousSha = null, sha = null, refDir = REFERENCE_FRAMES, rubric = null, log = console.error, strips = true } = {}) {
  const stats = readJson(path.join(inDir, 'stats.json'), null);
  const checks = readJson(path.join(inDir, 'checks.json'), null) ?? readJson(path.join(inDir, 'audit.json'), {})?.checks ?? null;
  let prevCompare = previousDir ? readJson(path.join(previousDir, 'compare.json'), null) : null;
  if (!prevCompare && previousMetrics) prevCompare = { sha: previousSha, viewpoints: previousMetrics };
  const viewpoints = listViewpoints(inDir);
  const ourSha = sha ?? stats?.git?.sha ?? null;
  const result = {
    generatedAt: new Date().toISOString(),
    in: rel(inDir),
    previous: previousDir ? rel(previousDir) : null,
    reference: rel(refDir),
    sha: ourSha,
    viewpoints: {},
  };
  const detVp = checks?.determinism?.viewpoint ?? 'A_stairs';
  for (const vp of viewpoints) {
    const ours = findImage(inDir, vp.id);
    if (!ours) {
      log(`compare: ${vp.id}.png missing — skipped`);
      continue;
    }
    const ref = findImage(refDir, vp.id);
    const prev = findImage(previousDir, vp.id);
    let m;
    if (ref) m = await compareImages(ours, ref);
    else {
      m = { ...(await ownMetrics(ours)), ssim: null, phashDistance: null, hueDiffDeg: null, satDiff: null, lumDiff: null, sharpnessRatio: null, referenceMissing: true };
      log(`compare: no reference frame for ${vp.id}`);
    }
    m.reference = ref ? rel(ref) : null;
    m.label = vp.label;
    m.refSeconds = vp.refSeconds;
    if (vp.id === detVp) {
      const det = findImage(inDir, `${vp.id}.det`);
      const mot = findImage(inDir, `${vp.id}.motion`);
      if (det) m.determinismDiff = await determinismDiff(ours, det);
      if (mot) Object.assign(m, await motionMetrics(ours, mot));
    }
    if (checks?.depth?.[vp.id]) {
      const d = checks.depth[vp.id];
      m.depth = { skyFraction: round(d.skyFraction, 4), farLayerCount: d.farLayerCount, maxBucketBeyond20m: round(d.maxBucketBeyond20m, 4) };
    }
    const prevMetrics = prevCompare?.viewpoints?.[vp.id] ?? null;
    m.deltas = metricDeltas(m, prevMetrics);
    m.previousImage = prev ? rel(prev) : null;
    result.viewpoints[vp.id] = m;
    if (strips) {
      const shortSha = ourSha ? ourSha.slice(0, 7) : '';
      const prevSha = prevCompare?.sha ? prevCompare.sha.slice(0, 7) : '';
      const stripFile = path.join(inDir, `${vp.id}.compare.png`);
      await buildStrip({
        reference: ref,
        ours,
        previous: prev,
        labels: { reference: `REFERENCE  ${vp.id}${vp.refSeconds != null ? `  (t≈${vp.refSeconds}s)` : ''}`, ours: `OURS  ${vp.id}${shortSha ? `  @${shortSha}` : ''}`, previous: prev ? `PREVIOUS  ${vp.id}${prevSha ? `  @${prevSha}` : ''}` : 'PREVIOUS' },
        metrics: m,
        deltaText: m.deltas ? `Δ prev: ${deltaSummary(m.deltas) || 'no change'}` : '',
        out: stripFile,
      });
      m.strip = path.basename(stripFile);
    }
    log(`compared ${vp.id}: ssim ${m.ssim ?? '—'}, pHash ${m.phashDistance ?? '—'}, hueΔ ${m.hueDiffDeg ?? '—'}°, sharp ×${m.sharpnessRatio ?? '—'}${typeof m.determinismDiff === 'number' ? `, det ${(m.determinismDiff * 100).toFixed(2)} %` : ''}${typeof m.motionRegionsMoving === 'number' ? `, motion ${m.motionRegionsMoving}/16` : ''}`);
  }
  fs.writeFileSync(path.join(inDir, 'compare.json'), JSON.stringify(result, null, 2));
  return result;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const inDir = resolveArg(args.in, 'gauntlet/out/last');
  const previousDir = args.previous ? resolveArg(args.previous) : fs.existsSync(path.join(ROOT, 'gauntlet/out/prev')) && inDir === path.join(ROOT, 'gauntlet/out/last') ? path.join(ROOT, 'gauntlet/out/prev') : null;
  const refDir = resolveArg(args.ref, REFERENCE_FRAMES);
  let rubric = null;
  try {
    rubric = loadRubric();
  } catch {
    /* optional */
  }
  compareDir({ inDir, previousDir, refDir, rubric, strips: !args['no-strips'] })
    .then((r) => {
      const rows = Object.entries(r.viewpoints).map(([id, m]) => ({ viewpoint: id, ssim: m.ssim, phash: m.phashDistance, hueDiffDeg: m.hueDiffDeg, satDiff: m.satDiff, lumDiff: m.lumDiff, sharpnessRatio: m.sharpnessRatio, sky: m.skyFraction, over: m.overexposedFraction, purple: m.purpleFraction, det: m.determinismDiff ?? null, motion: m.motionRegionsMoving ?? null }));
      console.table(rows);
      console.log(`wrote ${rel(path.join(inDir, 'compare.json'))}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
