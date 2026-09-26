#!/usr/bin/env node
// The README's tables from the outputs of views / attrib / play-probe / playtest.mjs (exp-east lane):
//   node art/environment/exp-east-2026-09-23/tools/final-report.mjs --base <views dir> [--base3 <views dir>] --branch <views dir> [--k300 <views dir>]
//        [--ab <attrib dir>] [--play <play-probe dir>] [--pt <playtest dir>]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter((e) => e.length),
);
const read = (f) => (f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const counts = (d) => (d ? Object.fromEntries((read(path.join(d, 'counts.json')) ?? []).map((r) => [r.pose, r])) : {});
const cb = counts(args.base);
const cb3 = counts(args.base3);
const cr = counts(args.branch);
const ck = counts(args.k300);
const M = (t) => (t / 1e6).toFixed(3);
const out = [];

// ---- perf ----
out.push('### perf\n');
out.push('| view | draws canonical | draws branch | triangles canonical (M) | triangles branch (M) | east tiers |');
out.push('| --- | ---: | ---: | ---: | ---: | --- |');
let worst = { tri: null, draw: null };
for (const [pose, r] of Object.entries(cr)) {
  const b = /^[A-F]_/.test(pose) && cb3[pose] ? cb3[pose] : cb[pose];
  const k = ck[pose];
  const draws = k ? k.drawCalls : r.drawCalls;
  const tris = k ? k.triangles : r.triangles;
  out.push(`| \`${pose}\` | ${b ? b.drawCalls : '—'} | ${draws}${k ? ` (K 400: ${r.drawCalls})` : ''} | ${b ? M(b.triangles) : '—'} | ${M(tris)}${k ? ` (K 400: ${M(r.triangles)})` : ''} | ${r.tiers?.length ? r.tiers.join(', ') : 'none'} |`);
  if (!worst.tri || tris > worst.tri[1]) worst.tri = [pose, tris];
  if (!worst.draw || draws > worst.draw[1]) worst.draw = [pose, draws];
}
out.push(`\nheaviest: triangles ${worst.tri?.[0]} ${worst.tri ? M(worst.tri[1]) : ''} M; draws ${worst.draw?.[0]} ${worst.draw?.[1]}`);
if (Object.keys(cb3).length) {
  const same = Object.keys(cb3).map((p) => [p, cb[p] && cb[p].drawCalls === cb3[p].drawCalls && cb[p].triangles === cb3[p].triangles]);
  out.push(`canonical heroes, e438c6e5 vs 7ecbd670 identical counts: ${same.map(([p, s]) => `${p} ${s ? 'yes' : 'NO'}`).join(', ')}`);
}

// ---- clipped whites (check 38): pixels with every channel over 235 / 245 ----
out.push('\n### clipped whites\n');
for (const [pose] of Object.entries(cr)) {
  const f = path.join(args.branch, `${pose}.png`);
  if (!fs.existsSync(f)) continue;
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let o235 = 0;
  let o245 = 0;
  let brightest = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) {
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    if (mn > 235) o235++;
    if (mn > 245) o245++;
    if (data[i] + data[i + 1] + data[i + 2] > brightest[0] + brightest[1] + brightest[2]) brightest = [data[i], data[i + 1], data[i + 2]];
  }
  out.push(`${pose}: over 235 ${o235}, over 245 ${o245}, brightest (${brightest.join(', ')}) [${info.width}x${info.height}]`);
}

// ---- A/B ----
for (const dir of [args.ab, args.abk].filter(Boolean)) {
  const ab = read(path.join(dir, 'attrib.json'));
  if (!ab) continue;
  out.push(`\n### A/B ${dir}\n`);
  for (const r of ab) {
    const on = r.stats ?? r.on?.stats;
    out.push(`${r.pose ?? r.name}: on ${on ? `${on.drawCalls} / ${M(on.triangles)} M` : '?'}; control ${r.control ? `over6 ${r.control.over6} max ${r.control.max}` : '—'}`);
    for (const [tag, v] of Object.entries(r.ab ?? {})) out.push(`  ${tag}: ${v.stats.drawCalls} / ${M(v.stats.triangles)} M; pixels over 6: ${v.diff.over6}, over 16: ${v.diff.over16}, max ${v.diff.max}, box ${JSON.stringify(v.diff.box)}`);
  }
}

// ---- playtest ----
const pt = read(args.pt && path.join(args.pt, 'playtest.json'));
if (pt) {
  out.push('\n### walk routes\n');
  out.push('| route | waypoints | stuck | length | camera speed p95 / max (m/s) | camera accel max (m/s²) → largest second difference | spikes over 100 m/s² (jump) | camera over ground, min | sole gap p50 / p95 / max (cm) |');
  out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const dt = 1 / 30;
  for (const w of pt.walk ?? []) {
    const c = w.camera;
    const sp = c?.spikes?.length ? c.spikes.map((s) => `${s.accelMps2} (${s.jumpM} m)`).join(', ') : 'none';
    const f = w.feet?.soleGapAbsM;
    out.push(`| \`${w.name}\` | ${w.waypointsReached} / ${w.of} | ${w.stuck.length} | ${w.lengthM} m | ${c?.speedMps.p95} / ${c?.speedMps.max} | ${c?.accelMps2.max} → ${(c?.accelMps2.max * dt * dt).toFixed(3)} m | ${sp} | ${w.minCameraAboveGroundM} m | ${f ? `${(f.p50 * 100).toFixed(2)} / ${(f.p95 * 100).toFixed(2)} / ${(f.max * 100).toFixed(2)}` : '—'} |`);
  }
  const ep = pt.eastProbes;
  if (ep) {
    const by = {};
    for (const r of ep.rows) (by[r.where] ??= [0, 0])[r.ok ? 0 : 1]++;
    out.push(`\neastProbes: ok ${ep.ok}, ${ep.rows.length - ep.failed} / ${ep.rows.length} as intended; ${Object.entries(by).map(([k, [a, b]]) => `${k} ${a}${b ? ` (${b} failed)` : ''}`).join(', ')}`);
    for (const r of ep.rows.filter((x) => !x.ok)) out.push(`  FAILED ${JSON.stringify(r)}`);
  }
  out.push(`page errors: ${JSON.stringify(pt.pageErrors ?? [])}`);
}

// ---- play probe ----
const pp = read(args.play && path.join(args.play, 'east-play.json'));
if (pp) {
  out.push('\n### pushes\n');
  let minStop = Infinity;
  let maxDrop = 0;
  for (const p of pp.pushes ?? []) {
    out.push(`${p.name}: end (${p.end.join(', ')}), drop ${p.dropM} m, closest to rope/stumps ${p.minFenceM} m`);
    if (/fence|rope|run|stump/.test(p.name)) minStop = Math.min(minStop, p.minFenceM);
    maxDrop = Math.max(maxDrop, p.dropM);
  }
  out.push(`fence/rope/stump pushes: closest ${minStop} m; largest drop of any push ${maxDrop} m`);
  out.push('\n### footsteps\n');
  const line = [[45.59, 2.45], [47.33, 2.4], [49.92, 2.1]];
  const segD = (x, z, a, b) => {
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / (ex * ex + ez * ez)));
    return Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t);
  };
  for (const s of pp.steps ?? []) {
    const onDeck = s.heard.filter((h) => h.at[0] >= 45.8 && h.at[0] <= 50.0 && Math.min(segD(h.at[0], h.at[2], line[0], line[1]), segD(h.at[0], h.at[2], line[1], line[2])) < 0.6);
    const deckTally = {};
    for (const h of onDeck) deckTally[h.surface] = (deckTally[h.surface] ?? 0) + 1;
    out.push(`${s.name}: reached ${s.reached}, ${s.steps} steps ${JSON.stringify(s.tally)}; on the steps or deck: ${JSON.stringify(deckTally)}; off them: ${JSON.stringify(s.heard.filter((h) => !onDeck.includes(h)).reduce((t, h) => ((t[h.surface] = (t[h.surface] ?? 0) + 1), t), {}))}`);
  }
  out.push(`audio state: ${pp.audioState}`);
  if (pp.camWalks) {
    out.push('\n### camera walks\n');
    for (const c of pp.camWalks) out.push(`${c.name}: reached ${c.reached}, ${c.frames} frames, max jump ${c.maxJumpM} m, max pop ${c.maxPopM} m at ${JSON.stringify(c.popAt)}, trunk clearance ${c.minTrunkClearM} m (${JSON.stringify(c.trunkAt)}), over the walk ${c.minAboveWalkM} m, min keep ${c.minKeep}, hits ${JSON.stringify(c.hits)}, shots ${c.shots.map((s) => s.file).join(', ')}`);
  }
  out.push(`page errors: ${JSON.stringify(pp.pageErrors ?? [])}`);
}
console.log(out.join('\n'));
