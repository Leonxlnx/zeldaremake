#!/usr/bin/env node
/**
 * ablate.mjs — the matched ablation matrix on fixed viewpoints (round 38, perf-2).
 *
 * One browser and one static server; every flag set is a fresh page (a fresh world) rendered at the
 * capture's viewpoint and simulation time, then K finished frames are timed (a GPU sync after each
 * `step` — Chromium's finish() is a flush, so a one-pixel readPixels — so the number is the frame's
 * GPU cost natively and SwiftShader's raster cost here). The
 * report has every config's draw calls, triangles, finished-frame median and issue time, the PNG's
 * byte-identity with the baseline's, and the relative delta of each against the baseline.
 *
 *   node gauntlet/perf/ablate.mjs --dist dist --out gauntlet/perf/ablations
 *        [--views A_stairs] [--width 640 --height 360] [--settle 8] [--timed 5] [--time 12.5]
 *        [--configs "baseline;fx=off;fx=noao;fx=norays;fx=nobloom;fx=nosoft;shadow=1024;shadow=0;veg=0.5,0.5;scale=0.5"]
 *        [--ref baseline]  (the config the deltas and the PNG identity are measured against)
 *        [--isolate]       (the ref config only: each system alone, its draws / triangles)
 *
 * Config names are the URL flags themselves (`baseline` = none), `;`-separated (a flag may carry a
 * comma: `veg=0.5,0.5`). One pseudo-flag is the harness's own: `cull=off` switches the composer's
 * shadow-caster cull off through `__ATMO_SETTINGS__` before the page loads (the shipped path before
 * round 38's optimisation), so `--ref cull=off` measures every flag — and the cull itself — against
 * it. Writes `<out>/results.json`, `<out>/TABLE.md` and the PNGs. Absolute numbers on SwiftShader
 * are CPU-bound proxies — read the deltas, not the milliseconds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { serveStatic, launchBrowser } from '../scripts/lib/browser.mjs';
import { measureView } from './viewstats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_CONFIGS = ['baseline', 'fx=off', 'fx=noao', 'fx=norays', 'fx=nobloom', 'fx=nosoft', 'shadow=1024', 'shadow=0', 'veg=0.5,0.5', 'scale=0.5'];

/** split a config into the URL flags and the harness's own pseudo-flags */
function splitConfig(config) {
  const url = [];
  let cullOff = false;
  for (const tok of config === 'baseline' ? [] : config.split('&')) {
    if (tok === 'cull=off') cullOff = true;
    else if (tok) url.push(tok);
  }
  const init = cullOff ? 'globalThis.__ATMO_SETTINGS__ = Object.assign(globalThis.__ATMO_SETTINGS__ || {}, { shadowCasterCull: false });' : null;
  return { params: url.join('&'), init };
}

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

const dist = path.resolve(ROOT, args.dist ?? 'dist');
const out = path.resolve(ROOT, args.out ?? 'gauntlet/perf/ablations');
const views = String(args.views ?? 'A_stairs').split(',').filter(Boolean);
const width = Number(args.width ?? 640);
const height = Number(args.height ?? 360);
const settle = Number(args.settle ?? 8);
const timed = Number(args.timed ?? 5);
const simTime = Number(args.time ?? 12.5);
const isolate = !!args.isolate;
const configs = typeof args.configs === 'string' ? args.configs.split(/[;]/).map((s) => s.trim()).filter(Boolean) : DEFAULT_CONFIGS;
const ref = typeof args.ref === 'string' ? args.ref : 'baseline';
if (!configs.includes(ref)) configs.unshift(ref);

const slug = (s) => (s === 'baseline' ? 'baseline' : s.replace(/[^a-z0-9.]+/gi, '_'));
const isRef = (r) => r.config === ref;
const fmtMs = (v) => (v == null ? '—' : v >= 100 ? v.toFixed(0) : v.toFixed(1));
const fmtPct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%`);
const rel = (v, base) => (v == null || base == null || !(base > 0) ? null : v / base - 1);

function gitInfo() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { sha, branch };
  } catch {
    return { sha: null, branch: null };
  }
}

function table(results, view) {
  const rows = results.filter((r) => r.viewpoint === view);
  const base = rows.find(isRef);
  const lines = [];
  lines.push(`### ${view} (${width}×${height}, settle ${settle}, ${timed} finished frames, t=${simTime}s; deltas vs \`${ref}\`)`);
  lines.push('');
  lines.push('| config | frame ms (median) | Δ frame | issue ms | draws | Δ draws | triangles | Δ tris | casters culled | ready s | PNG vs ref |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const r of rows) {
    const s = r.stats ?? {};
    const t = r.timing ?? {};
    const b = base ?? {};
    const bs = b.stats ?? {};
    const bt = b.timing ?? {};
    const png = isRef(r) ? '(reference)' : r.pngIdentical === true ? 'identical' : r.pngIdentical === false ? 'differs' : '—';
    const cull = r.postfx?.shadowCasterCull === false ? 'off' : r.postfx?.shadowCastersTested != null ? `${r.postfx.shadowCastersCulled}/${r.postfx.shadowCastersTested}` : '—';
    lines.push(
      `| ${r.error ? `${r.config} (FAILED)` : r.config} | ${fmtMs(t.medianMs)} | ${isRef(r) ? '—' : fmtPct(rel(t.medianMs, bt.medianMs))} | ${fmtMs(t.issueMedianMs)} | ${s.drawCalls ?? '—'} | ${isRef(r) ? '—' : fmtPct(rel(s.drawCalls, bs.drawCalls))} | ${s.triangles?.toLocaleString?.('en-US') ?? '—'} | ${isRef(r) ? '—' : fmtPct(rel(s.triangles, bs.triangles))} | ${cull} | ${r.readyMs != null ? (r.readyMs / 1000).toFixed(1) : '—'} | ${png} |`,
    );
  }
  lines.push('');
  if (base?.isolate) {
    lines.push(`#### ${view} — each system alone (\`${ref}\`; colour pass only, lighting kept)`);
    lines.push('');
    lines.push('| system | draws | triangles |');
    lines.push('| --- | ---: | ---: |');
    for (const [name, v] of Object.entries(base.isolate)) lines.push(`| ${name} | ${v?.drawCalls ?? v?.calls ?? '—'} | ${(v?.triangles ?? 0).toLocaleString('en-US')} |`);
    lines.push('');
  }
  return lines.join('\n');
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const git = gitInfo();
  const startedAt = new Date().toISOString();
  console.error(`ablate: ${configs.length} configs × ${views.length} views from ${dist} (${git.branch}@${git.sha}) → ${out}`);
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  const results = [];
  try {
    for (const view of views) {
      let basePng = null;
      for (const config of configs) {
        const { params, init } = splitConfig(config);
        const png = path.join(out, `${view}.${slug(config)}.png`);
        const t0 = Date.now();
        console.error(`\n=== ${view} ${config} ===`);
        try {
          const r = await measureView(browser, server.url, {
            params,
            viewpoint: view,
            width,
            height,
            settle,
            simTime,
            timed,
            isolate: isolate && config === ref,
            out: png,
            init,
            log: (m) => console.error(`  ${m}`),
          });
          r.config = config;
          r.wallMs = Date.now() - t0;
          if (config === ref) basePng = fs.readFileSync(png);
          else if (basePng) r.pngIdentical = fs.readFileSync(png).equals(basePng);
          results.push(r);
          const s = r.stats ?? {};
          console.error(`  → frame ${fmtMs(r.timing?.medianMs)} ms (issue ${fmtMs(r.timing?.issueMedianMs)}), ${s.drawCalls} draws, ${s.triangles} tris, casters culled ${r.postfx?.shadowCastersCulled ?? '—'}/${r.postfx?.shadowCastersTested ?? '—'}, tier ${r.tier}, flags ${JSON.stringify(r.flags)}${r.pngIdentical != null ? `, png ${r.pngIdentical ? 'identical' : 'differs'}` : ''}`);
        } catch (e) {
          console.error(`  FAILED: ${e.message}`);
          results.push({ config, viewpoint: view, params, error: String(e.message ?? e) });
        }
        // write after every config so a killed run still leaves its rows
        fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ git, startedAt, dist, width, height, settle, timed, simTime, configs, ref, views, results }, null, 2));
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const md = [
    `# Ablation matrix — ${git.branch}@${git.sha}`,
    '',
    `Generated ${startedAt} by \`gauntlet/perf/ablate.mjs\` from \`${path.relative(ROOT, dist)}\` on headless Chrome + SwiftShader (software raster: the milliseconds are CPU-bound proxies; read the deltas).`,
    '',
    ...views.map((v) => table(results, v)),
  ].join('\n');
  fs.writeFileSync(path.join(out, 'TABLE.md'), md);
  console.log(md);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
