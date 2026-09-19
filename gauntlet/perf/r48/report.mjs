#!/usr/bin/env node
/**
 * report.mjs — one Markdown summary per perftrace JSON (fable-6, round 48), the same columns for
 * every variant so the tables in docs/PERF_2026-09-19.md are comparable.
 *
 *   node gauntlet/perf/r48/report.mjs trace-a.json [trace-b.json …] [--json out.json]
 *
 * Per trace: frame time (step ms with the GPU completion inside, median / p95 / p99), its split
 * (world.update, render issue, GPU finish), draw calls and triangles, the per-system update
 * medians, the frames per walk segment, the first-use events, the spike causes, and the trees'
 * LOD pools along the walk (peak live bytes, builds, evictions, synchronous builds, build-time
 * percentiles, the longest chunk against the 3 ms budget) from `poolSeries` / `poolFinal`.
 */
import fs from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const jsonOut = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();
const fmt = (v, d = 1) => (v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(d));
const mb = (b) => (b == null ? '—' : (b / 1048576).toFixed(1));
const pct = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q))] : NaN);

export function summariseTrace(file) {
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const p = r.pass1;
  const rows = p.rows;
  const s = p.summary;
  // steady state = the walk after the idle frames, excluding the first frame after the spawn
  const walk = rows.filter((x) => x.tag !== 'idle');
  const idle = rows.filter((x) => x.tag === 'idle').slice(1);
  const med = (arr, k) => pct(arr.map((x) => x[k] ?? 0).sort((a, b) => a - b), 0.5);
  const p95 = (arr, k) => pct(arr.map((x) => x[k] ?? 0).sort((a, b) => a - b), 0.95);
  const series = p.poolSeries ?? [];
  const trees = (x) => x?.systemPerf?.trees ?? null;
  const canopy = series.map((x) => trees(x)?.nearCanopyPool).filter(Boolean);
  const base = series.map((x) => trees(x)?.nearBasePool).filter(Boolean);
  const fin = trees(series[series.length - 1]) ?? p.poolFinal?.trees ?? null;
  const peak = (arr, k) => (arr.length ? Math.max(...arr.map((x) => x[k] ?? 0)) : null);
  const buildMs = p.setup?.buildMs ?? {};
  const buildTotal = Object.values(buildMs).reduce((a, b) => a + b, 0);
  return {
    file: path.basename(file),
    label: r.label,
    note: r.config?.note ?? null,
    warmup: !!r.config?.warmup,
    frames: rows.length,
    readyS: r.readyMs / 1000,
    buildS: buildTotal / 1000,
    buildTop: Object.entries(buildMs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(', '),
    warmupReport: p.setup?.warmup ?? null,
    step: s.step,
    update: s.update,
    render: s.render,
    finish: s.finish,
    walk: { n: walk.length, stepMed: med(walk, 'ms'), stepP95: p95(walk, 'ms'), updMed: med(walk, 'update'), rendMed: med(walk, 'render'), finMed: med(walk, 'finish') },
    idle: { n: idle.length, stepMed: med(idle, 'ms'), stepP95: p95(idle, 'ms'), updMed: med(idle, 'update'), rendMed: med(idle, 'render'), finMed: med(idle, 'finish') },
    calls: s.calls,
    tris: s.tris,
    systems: Object.fromEntries(Object.entries(s.systems).map(([k, v]) => [k, v.median])),
    systemsP95: Object.fromEntries(Object.entries(s.systems).map(([k, v]) => [k, v.p95])),
    perTag: s.perTag,
    events: s.events,
    spikes: s.spikes,
    spikeThresholdMs: s.spikeThresholdMs,
    spikeCauses: s.spikeCauses,
    rebucket: { frames: s.rebucketFrames, treesMs: s.treesRebucketMs, vegMs: s.vegRebucketMs, treesSteadyMs: s.treesSteadyMs },
    pools: fin
      ? {
          prefetchM: fin.prefetchM,
          budgetMs: fin.buildBudgetMs,
          bytesWithinM: fin.bytesWithinM,
          canopy: { cap: fin.nearCanopyPool.capBytes, final: fin.nearCanopyPool.poolBytes, peak: peak(canopy, 'poolBytes'), items: fin.nearCanopyPool.items, resident: fin.nearCanopyPool.resident, built: fin.nearCanopyPool.built, evicted: fin.nearCanopyPool.evicted, sync: fin.nearCanopyPool.syncBuilds, hits: fin.nearCanopyPool.hits, p50: fin.nearCanopyPool.buildMsP50, p95: fin.nearCanopyPool.buildMsP95, max: fin.nearCanopyPool.buildMsMax, stepMax: fin.nearCanopyPool.stepMsMax, workTotal: fin.nearCanopyPool.workMsTotal, pinnedBytesPeak: peak(canopy, 'pinnedBytes'), wantedBytesPeak: peak(canopy, 'wantedBytes') },
          base: { cap: fin.nearBasePool.capBytes, final: fin.nearBasePool.poolBytes, peak: peak(base, 'poolBytes'), items: fin.nearBasePool.items, resident: fin.nearBasePool.resident, built: fin.nearBasePool.built, evicted: fin.nearBasePool.evicted, sync: fin.nearBasePool.syncBuilds, hits: fin.nearBasePool.hits, p50: fin.nearBasePool.buildMsP50, p95: fin.nearBasePool.buildMsP95, max: fin.nearBasePool.buildMsMax, stepMax: fin.nearBasePool.stepMsMax, workTotal: fin.nearBasePool.workMsTotal, pinnedBytesPeak: peak(base, 'pinnedBytes'), wantedBytesPeak: peak(base, 'wantedBytes') },
        }
      : null,
    poolSeries: series.map((x) => ({ k: x.k, tag: x.tag, canopyMB: +mb(trees(x)?.nearCanopyPool?.poolBytes), canopyPinnedMB: +mb(trees(x)?.nearCanopyPool?.pinnedBytes), canopyEvicted: trees(x)?.nearCanopyPool?.evicted, canopySync: trees(x)?.nearCanopyPool?.syncBuilds, canopyBuilt: trees(x)?.nearCanopyPool?.built, baseMB: +mb(trees(x)?.nearBasePool?.poolBytes), baseBuilt: trees(x)?.nearBasePool?.built, baseSync: trees(x)?.nearBasePool?.syncBuilds })),
  };
}

export function table(list) {
  const L = [];
  L.push('| trace | frames | ready s | step ms med / p95 / p99 | update | issue | GPU finish | walk step med / p95 | idle step med | draws med / max | tris med / max (M) | spikes (>2× med) |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const t of list) L.push(`| ${t.label}${t.warmup ? ' (warm-up)' : ''} | ${t.frames} | ${fmt(t.readyS, 0)} | **${fmt(t.step.median)}** / ${fmt(t.step.p95)} / ${fmt(t.step.p99)} | ${fmt(t.update.median)} | ${fmt(t.render.median)} | ${t.finish ? fmt(t.finish.median) : '—'} | ${fmt(t.walk.stepMed)} / ${fmt(t.walk.stepP95)} | ${fmt(t.idle.stepMed)} | ${t.calls.median} / ${t.calls.max} | ${fmt(t.tris.median / 1e6, 2)} / ${fmt(t.tris.max / 1e6, 2)} | ${t.spikes} |`);
  L.push('');
  L.push('| trace | trees upd med / p95 | veg upd med / p95 | character | atmosphere | trees re-bucket frames (med ms) | veg re-bucket frames (med ms) | new programs / geometries / textures | spike causes |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const t of list) L.push(`| ${t.label} | ${fmt(t.systems.trees)} / ${fmt(t.systemsP95.trees)} | ${fmt(t.systems.vegetation)} / ${fmt(t.systemsP95.vegetation)} | ${fmt(t.systems.character)} | ${fmt(t.systems.atmosphere)} | ${t.rebucket.frames.trees} (${fmt(t.rebucket.treesMs.median)}) | ${t.rebucket.frames.veg} (${fmt(t.rebucket.vegMs.median)}) | ${t.events.newPrograms} / ${t.events.newGeometries} / ${t.events.newTextures} | ${Object.entries(t.spikeCauses).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  L.push('');
  L.push('| trace | canopy pool cap / peak / final MB | canopy items resident / built / evicted / **sync** | canopy build ms p50 / p95 / max · longest chunk | base pool cap / peak MB | base built / evicted / sync | pre-fetch m (canopy / base) | demand within pre-fetch radius MB (canopy / base) |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const t of list) {
    const P = t.pools;
    if (!P) { L.push(`| ${t.label} | — | — | — | — | — | — | — |`); continue; }
    const cw = P.bytesWithinM?.nearCanopy ?? {};
    const bw = P.bytesWithinM?.nearBase ?? {};
    const lastKey = (o) => Object.keys(o).map(Number).sort((a, b) => a - b).pop();
    L.push(`| ${t.label} | ${mb(P.canopy.cap)} / ${mb(P.canopy.peak)} / ${mb(P.canopy.final)} | ${P.canopy.resident} / ${P.canopy.built} / ${P.canopy.evicted} / **${P.canopy.sync}** | ${fmt(P.canopy.p50)} / ${fmt(P.canopy.p95)} / ${fmt(P.canopy.max)} · ${fmt(P.canopy.stepMax)} (budget ${P.budgetMs}) | ${mb(P.base.cap)} / ${mb(P.base.peak)} | ${P.base.built} / ${P.base.evicted} / ${P.base.sync} | ${P.prefetchM.nearCanopy} / ${P.prefetchM.nearBase} | ${mb(cw[lastKey(cw)])} / ${mb(bw[lastKey(bw)])} |`);
  }
  return L.join('\n');
}

export function perTagTable(list) {
  const tags = [...new Set(list.flatMap((t) => Object.keys(t.perTag)))];
  const L = [`| walk segment | ${list.map((t) => `${t.label} med / max ms (n)`).join(' | ')} |`, `| --- | ${list.map(() => '---:').join(' | ')} |`];
  for (const tag of tags) L.push(`| ${tag} | ${list.map((t) => { const v = t.perTag[tag]; return v ? `${fmt(v.median)} / ${fmt(v.max, 0)} (${v.n})` : '—'; }).join(' | ')} |`);
  return L.join('\n');
}

if (files.length) {
  const list = files.map(summariseTrace);
  console.log(table(list));
  console.log('');
  console.log(perTagTable(list));
  for (const t of list) {
    console.log(`\n${t.label}: ready ${fmt(t.readyS, 0)} s (world build ${fmt(t.buildS, 0)} s: ${t.buildTop})${t.warmupReport ? ` · warm-up ${JSON.stringify(t.warmupReport)}` : ''}\n  note: ${t.note}`);
    if (t.poolSeries.length) console.log(`  pool along the walk (frame · segment · canopy MB [pinned] · built / evicted / sync · base MB):\n${t.poolSeries.filter((_, i) => i % 4 === 0 || i === t.poolSeries.length - 1).map((x) => `    ${String(x.k).padStart(4)} ${x.tag.padEnd(20)} ${x.canopyMB} [${x.canopyPinnedMB}] · ${x.canopyBuilt} / ${x.canopyEvicted} / ${x.canopySync} · ${x.baseMB}`).join('\n')}`);
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(list, null, 2));
}
