#!/usr/bin/env node
/**
 * ssim-table.mjs — the six fixed views per build variant (fable-6, round 48): SSIM against the
 * reference from `cap-<variant>/compare.json` (compare.mjs), draw calls / triangles from
 * `cap-<variant>/stats.json` (capture.mjs), each as a delta against `cap-baseline`. The −0.003
 * budget every lane is held to, applied to the near-LOD variants.
 *
 *   node gauntlet/perf/r48/ssim-table.mjs [--dir gauntlet/perf/r48] [--variants baseline,lod18,…] [--monitor <takes.json>]
 *
 * `--monitor` adds the take-0116 SwiftShader SSIMs from a takes.json (the monitor's numbers) as a
 * reference row — native and SwiftShader renders differ by ±0.007, so they are shown, not compared.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else {
    args[a.slice(2)] = n;
    i++;
  }
}
const dir = path.resolve(args.dir ?? 'gauntlet/perf/r48');
const variants = String(args.variants ?? 'baseline,lod18,lod25,prewarm,lod18prewarm').split(',').filter(Boolean);
const VIEWS = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const f4 = (v) => (v == null ? '—' : v.toFixed(4));
const d4 = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(4)}`);

const rows = [];
for (const v of variants) {
  const compare = read(path.join(dir, `cap-${v}`, 'compare.json'));
  const stats = read(path.join(dir, `cap-${v}`, 'stats.json'));
  if (!compare) { rows.push({ v, missing: true }); continue; }
  const ssim = {};
  const draws = {};
  const tris = {};
  for (const id of VIEWS) {
    ssim[id] = compare.viewpoints?.[id]?.ssim ?? null;
    const s = (stats?.viewpoints ?? []).find((x) => x.id === id)?.stats;
    draws[id] = s?.drawCalls ?? null;
    tris[id] = s?.triangles ?? null;
  }
  rows.push({ v, ssim, draws, tris, sha: stats?.git?.shortSha ?? null, dirty: stats?.git?.dirty ?? null, renderer: stats?.renderer ?? null, dist: stats?.git?.dist ?? null });
}
const base = rows.find((r) => r.v === 'baseline' && !r.missing);
const lines = [];
lines.push(`| build | ${VIEWS.map((id) => id.charAt(0)).join(' | ')} | worst Δ | draws A / max | tris A (M) |`);
lines.push(`| --- | ${VIEWS.map(() => '---:').join(' | ')} | ---: | ---: | ---: |`);
if (args.monitor) {
  const takes = read(path.resolve(args.monitor));
  const t = takes?.takes?.find((x) => x.id === 'take-0116');
  if (t) lines.push(`| take-0116 as sealed (SwiftShader, the monitor) | ${VIEWS.map((id) => f4(t.shots.find((s) => s.viewpoint === id)?.metrics?.ssim)).join(' | ')} | (reference row) | ${t.stats?.drawCalls ?? '—'} | ${t.stats?.triangles ? (t.stats.triangles / 1e6).toFixed(2) : '—'} |`);
}
for (const r of rows) {
  if (r.missing) { lines.push(`| ${r.v} | ${VIEWS.map(() => '—').join(' | ')} | not captured | — | — |`); continue; }
  const deltas = VIEWS.map((id) => (base && r !== base && r.ssim[id] != null && base.ssim[id] != null ? r.ssim[id] - base.ssim[id] : null));
  const worst = deltas.filter((x) => x != null).length ? Math.min(...deltas.filter((x) => x != null)) : null;
  const cells = VIEWS.map((id, i) => (r === base ? `**${f4(r.ssim[id])}**` : `${f4(r.ssim[id])} (${d4(deltas[i])})`));
  const maxDraws = Math.max(...VIEWS.map((id) => r.draws[id] ?? 0));
  lines.push(`| ${r.v}${r.dirty ? ' (dirty tree)' : ''} | ${cells.join(' | ')} | ${r === base ? '—' : `${d4(worst)}${worst != null && worst < -0.003 ? ' ✗' : worst != null ? ' ✓' : ''}`} | ${r.draws.A_stairs ?? '—'} / ${maxDraws || '—'} | ${r.tris.A_stairs ? (r.tris.A_stairs / 1e6).toFixed(2) : '—'} |`);
}
lines.push('');
lines.push('Δ per view vs the native baseline capture of the same commit; ✓ = every view within the −0.003 budget, ✗ = at least one outside it.');
console.log(lines.join('\n'));
