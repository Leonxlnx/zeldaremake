#!/usr/bin/env node
/**
 * ab-table.mjs — the interleaved on/off pairs of viewstats.mjs --ab as one Markdown table (fable-6,
 * round 48): per view and switch, the on / off medians of the finished frame, the pair-wise median
 * delta, the relative saving, and the draw calls / triangles with the switch off.
 *
 *   node gauntlet/perf/r48/ab-table.mjs gauntlet/perf/r48/ab-A_stairs.json [gauntlet/perf/r48/ab-C_lookback.json …]
 */
import fs from 'node:fs';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const NAMES = { cull: 'shadow-caster cull (round 38) off', ao: 'SSAO off', rays: 'god rays off', bloom: 'bloom off', soft: 'softening pass off', all: 'all four composer stages off', 'veg0.5': 'vegetation LOD ×0.5' };
const f1 = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(1));
const lines = ['| view | switch | on ms (median) | off ms (median) | off − on, pair-wise median | saving with it off | draws off | tris off (M) |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
for (const file of files) {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const timed = r.timing ? ` (${r.timing.frames} finished frames: median ${f1(r.timing.medianMs)} ms, min ${f1(r.timing.minMs)}, max ${f1(r.timing.maxMs)})` : '';
  lines.push(`| **${r.viewpoint}**${timed} | | | | | | ${r.stats?.drawCalls ?? '—'} | ${r.stats?.triangles ? (r.stats.triangles / 1e6).toFixed(2) : '—'} |`);
  for (const [stage, v] of Object.entries(r.ab ?? {})) {
    const saving = v.onMedianMs > 0 ? ((v.onMedianMs - v.offMedianMs) / v.onMedianMs) * 100 : null;
    lines.push(`| | ${NAMES[stage] ?? stage} | ${f1(v.onMedianMs)} | ${f1(v.offMedianMs)} | ${v.pairDeltaMedianMs >= 0 ? '+' : '−'}${f1(Math.abs(v.pairDeltaMedianMs))} ms | ${saving == null ? '—' : `${saving >= 0 ? '−' : '+'}${Math.abs(saving).toFixed(0)} %`} | ${v.offDrawCalls ?? '—'} | ${v.offTriangles ? (v.offTriangles / 1e6).toFixed(2) : '—'} |`);
  }
}
lines.push('');
lines.push('Both arms of a pair render on the same page under the same box load (`viewstats.mjs --ab`, 12 pairs per switch, order alternated); off − on < 0 means the frame is that much cheaper with the switch off, i.e. the stage costs that much.');
console.log(lines.join('\n'));
