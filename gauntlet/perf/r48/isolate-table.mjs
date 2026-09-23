#!/usr/bin/env node
/**
 * isolate-table.mjs — each system alone per hero view (ablate.mjs --isolate results.json) as one
 * Markdown matrix: draw calls and triangles per system and view, with the system's share of the
 * whole frame's triangles, plus the finished-frame timing per view (fable-6, round 48).
 *
 *   node gauntlet/perf/r48/isolate-table.mjs gauntlet/perf/r48/views-0116/results.json
 */
import fs from 'node:fs';

const file = process.argv[2];
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = r.results.filter((x) => x.isolate && !x.error);
const views = rows.map((x) => x.viewpoint);
const systems = [...new Set(rows.flatMap((x) => Object.keys(x.isolate)))];
const M = (v) => (v / 1e6).toFixed(2);
const lines = [];
lines.push(`| view | draws | triangles (M) | finished frame ms median / min / max (${rows[0]?.timing?.frames ?? '?'} frames) | issue ms | shadow casters culled |`);
lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const x of rows) lines.push(`| ${x.viewpoint} | ${x.stats?.drawCalls ?? '—'} | ${x.stats?.triangles ? M(x.stats.triangles) : '—'} | ${x.timing ? `${x.timing.medianMs.toFixed(1)} / ${x.timing.minMs.toFixed(1)} / ${x.timing.maxMs.toFixed(1)}` : '—'} | ${x.timing ? x.timing.issueMedianMs.toFixed(1) : '—'} | ${x.postfx ? `${x.postfx.shadowCastersCulled} / ${x.postfx.shadowCastersTested}` : '—'} |`);
lines.push('');
lines.push(`| system alone (colour pass + lighting) | ${views.map((v) => `${v.charAt(0)} draws / tris (M) / share`).join(' | ')} |`);
lines.push(`| --- | ${views.map(() => '---:').join(' | ')} |`);
const totals = rows.map((x) => Object.values(x.isolate).reduce((n, s) => n + (s?.triangles ?? 0), 0));
for (const s of systems) {
  lines.push(`| ${s} | ${rows.map((x, i) => { const v = x.isolate[s]; if (!v) return '—'; const tris = v.triangles ?? 0; return `${v.drawCalls ?? v.calls ?? '—'} / ${M(tris)} / ${totals[i] ? `${((100 * tris) / totals[i]).toFixed(0)} %` : '—'}`; }).join(' | ')} |`);
}
lines.push(`| **sum of the systems** | ${rows.map((x, i) => `${Object.values(x.isolate).reduce((n, s) => n + (s?.drawCalls ?? s?.calls ?? 0), 0)} / ${M(totals[i])}`).join(' | ')} |`);
lines.push('');
lines.push('Each system rendered alone (`__ZR__.isolate`: its group + the lighting, no post chain, no shadow pass), so the sum of the systems is the colour pass; the frame above it adds the shadow depth pass and the composer stages.');
console.log(lines.join('\n'));
