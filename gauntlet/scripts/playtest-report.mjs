#!/usr/bin/env node
/**
 * playtest-report.mjs — markdown tables comparing two playtest.json runs (before / after).
 *
 *   node gauntlet/scripts/playtest-report.mjs --before /tmp/play-baseline/playtest.json --after /tmp/play-after/playtest.json
 */
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((x) => x.length),
);
const B = JSON.parse(fs.readFileSync(args.before, 'utf8'));
const A = JSON.parse(fs.readFileSync(args.after, 'utf8'));
const out = [];
const f1 = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(1) : String(v));
const f2 = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(2) : String(v));

out.push('### Camera look range per spot (degrees of view elevation; + is up)');
out.push('');
out.push('| spot | before: rest / drag up / drag down | before: frame top max | after: rest / up / down | after: frame top max | after: nearest surface rest / up / down (m) | after: sky share looking up |');
out.push('|---|---|---|---|---|---|---|');
const bLook = Object.fromEntries((B.look ?? []).map((l) => [l.id, l]));
for (const l of A.look ?? []) {
  const b = bLook[l.id];
  const bs = b ? `${f1(b.rest.elevationDeg)} / ${f1(b.dragUp.elevationDeg)} / ${f1(b.dragDown.elevationDeg)}` : '—';
  const bt = b ? f1(b.maxVisibleAboveHorizonDeg) : '—';
  out.push(`| ${l.id} | ${bs} | ${bt} | ${f1(l.rest.elevationDeg)} / ${f1(l.dragUp.elevationDeg)} / ${f1(l.dragDown.elevationDeg)} | ${f1(l.maxVisibleAboveHorizonDeg)} | ${f2(l.rest.clearance.nearestM)} / ${f2(l.dragUp.clearance.nearestM)} / ${f2(l.dragDown.clearance.nearestM)} | ${f2(l.dragUp.clearance.skyShare)} |`);
}
out.push('');
if (B.pad || A.pad) {
  out.push(`Right stick: before ${f1(B.pad?.maxDownDeg)}° … ${f1(B.pad?.maxUpDeg)}° (stick up looked down); after ${f1(A.pad?.maxDownDeg)}° … ${f1(A.pad?.maxUpDeg)}° (stick up looks up).`);
  out.push('');
}
out.push('### Climbs (held W from 1.6 m before the foot / from the top)');
out.push('');
out.push('| flight | before up: stalls, end y, reached top | after up | before down: min camera over ground | after down |');
out.push('|---|---|---|---|---|');
for (const id of Object.keys(A.climb ?? {})) {
  const a = A.climb[id];
  const b = B.climb?.[id];
  const s = (c) => (c ? `${c.stalledFrames} stalls, y ${f2(c.end[1])}, top ${c.reachedTop}` : '—');
  out.push(`| ${id} | ${s(b?.up)} | ${s(a.up)} | ${f2(b?.down?.minCameraAboveGroundM)} m | ${f2(a.down.minCameraAboveGroundM)} m |`);
}
out.push('');
out.push('### Walk routes (camera-relative key steering)');
out.push('');
out.push('| route | before: reached, stuck | after: reached, stuck |');
out.push('|---|---|---|');
const bWalk = Object.fromEntries((B.walk ?? []).map((w) => [w.name, w]));
for (const w of A.walk ?? []) {
  const b = bWalk[w.name];
  const s = (x) => (x ? `${x.waypointsReached}/${x.of}, ${x.stuck.length ? x.stuck.map((q) => `(${q.at[0]}, ${q.at[2]})`).join(' ') : 'none'}` : '—');
  out.push(`| ${w.name} | ${s(b)} | ${s(w)} |`);
}
out.push('');
if (A.stairs) {
  out.push('### Stair collision against the rendered stone and timber (after)');
  out.push('');
  out.push('| flight | tread span: samples, share > 3 cm off, max off (m) | nose zone (±0.1 m round each riser line): share > 3 cm, max (m) |');
  out.push('|---|---|---|');
  for (const [id, s] of Object.entries(A.stairs)) {
    out.push(`| ${id} | ${s.treadSpan.samples}, ${(s.treadSpan.shareStoneOver3cmAbove * 100).toFixed(2)} %, ${f2(s.treadSpan.maxStoneAboveWalkM)} | ${(s.noseZone.shareStoneOver3cmAbove * 100).toFixed(1)} %, ${f2(s.noseZone.maxStoneAboveWalkM)} |`);
  }
  out.push('');
}
if (A.perf) {
  out.push('### Frame cost (after; this VM renders with SwiftShader on 4 CPU cores)');
  out.push('');
  out.push('| spot | draws | triangles | JS step ms (camera / world update / render issue) | drawn frame wall ms (synced) |');
  out.push('|---|---|---|---|---|');
  for (const p of A.perf) out.push(`| ${p.id} | ${p.draws} | ${(p.triangles / 1e6).toFixed(2)} M | ${f1(p.jsMs.step)} (${f1(p.jsMs.camera)} / ${f1(p.jsMs.update)} / ${f1(p.jsMs.render)}) | ${p.drawnFrameWallMs.map((v) => Math.round(v)).join(', ')} |`);
  out.push('');
}
if (A.interact) out.push(`Interactions (after): ${JSON.stringify(A.interact)}`, '');
if (A.resilience) out.push(`Resize / reload (after): ${JSON.stringify(A.resilience)}`, '');
out.push(`Page errors (after): ${(A.pageErrors ?? []).length ? A.pageErrors.join('; ') : 'none'}`);
console.log(out.join('\n'));
