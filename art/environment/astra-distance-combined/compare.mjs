/** CPU-only: node compare.mjs <before-settings.json> <after-settings.json> [<before> <after> ...]
 * Checks the frozen capture bindings, then writes comparison.json. --self-test checks the pool gate.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const MiB = 1024 * 1024, smallCap = 64 * MiB;
const pinned = [
  { source: 'b221732b64724ee9c3a2b4c81e757ed605a41efb', bundle: 'index-DwReWLkW.js', sha256: 'c76ed18510d9a07180fec9abccaadc9f4a585ea3b096dfec441e04e7b8fa0346' },
  { source: '1d5f12801b986ed933871a13551f0d6ade6767e3', bundle: 'index-BM1z1geb.js', sha256: '63eb19b0c11edf0e1c72d9a5ab996956de1008b08e976f931a81cb11e0b831ce' },
];
const fixedIds = ['A_stairs', 'B_house', 'C_lookback', 'D_log', 'E_ground', 'F_canopy'];
const costKeys = ['drawCalls', 'triangles', 'geometries', 'textures', 'programs'];
const finite = (value, label) => { assert(Number.isFinite(value), `${label}: missing or non-finite`); return value; };
const range = values => { assert(values.length); values.forEach(v => finite(v, 'range')); return [Math.min(...values), Math.max(...values)]; };
const distribution = values => {
  range(values);
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], max: sorted.at(-1) };
};
const controls = settings => Object.fromEntries(Object.entries(settings).filter(([key]) => !['sourceSha', 'dist', 'bundle', 'baseline', 'out', 'sourceRoot'].includes(key)));
const sameFrame = (a, b, label) => {
  assert.deepEqual(a.camera, b.camera, `${label}: camera mismatch`);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[key], b.stats[key], `${label}: ${key}`);
  assert.equal(a.stats.width, 1280); assert.equal(a.stats.height, 720);
  for (const row of [a, b]) for (const key of costKeys) finite(row.stats[key], `${label}: ${key}`);
};

function poolSummary(initial, rows, key) {
  const observations = [{ ...initial, k: -1, phase: 'pass-start' }, ...rows].map(row => {
    const pool = row.pool?.[key];
    assert(pool, `${key}: missing frame ${row.k}`);
    for (const name of ['capBytes', 'poolBytes', 'pinnedBytes', 'resident', 'pinned', 'built', 'evicted', 'syncBuilds']) finite(pool[name], `${key}/${row.k}/${name}`);
    assert(pool.capBytes > 0);
    return { k: row.k ?? -1, phase: row.phase ?? 'pass-start', ...pool };
  });
  const first = observations[0], last = observations.at(-1);
  const events = observations.filter(p => p.poolBytes > p.capBytes || p.pinnedBytes > p.capBytes || (key === 'nearCanopyPool' && (p.poolBytes > smallCap || p.pinnedBytes > smallCap)));
  return {
    observations: observations.length,
    capBytes: range(observations.map(p => p.capBytes)), residentBytes: range(observations.map(p => p.poolBytes)),
    pinnedBytes: range(observations.map(p => p.pinnedBytes)), residentItems: range(observations.map(p => p.resident)), pinnedItems: range(observations.map(p => p.pinned)),
    peakResidentMiB: Math.max(...observations.map(p => p.poolBytes)) / MiB,
    peakPinnedMiB: Math.max(...observations.map(p => p.pinnedBytes)) / MiB,
    counters: Object.fromEntries(['built', 'evicted', 'syncBuilds'].map(name => {
      assert(last[name] >= first[name], `${key}: counter reset ${name}`);
      return [name, { start: first[name], end: last[name], delta: last[name] - first[name] }];
    })),
    exceedsConfiguredCap: observations.some(p => p.poolBytes > p.capBytes || p.pinnedBytes > p.capBytes),
    exceeds64MiB: key === 'nearCanopyPool' ? observations.some(p => p.poolBytes > smallCap || p.pinnedBytes > smallCap) : null,
    overflowObservations: events.map(p => ({ k: p.k, phase: p.phase, capBytes: p.capBytes, poolBytes: p.poolBytes, pinnedBytes: p.pinnedBytes })),
  };
}

if (process.argv.includes('--self-test')) {
  const row = bytes => ({ pool: { nearCanopyPool: { capBytes: smallCap, poolBytes: bytes, pinnedBytes: bytes, resident: 1, pinned: 1, built: 0, evicted: 0, syncBuilds: 0 } } });
  assert.equal(poolSummary(row(smallCap), [row(smallCap)], 'nearCanopyPool').exceedsConfiguredCap, false);
  const exceeded = poolSummary(row(smallCap), [{ k: 0, ...row(smallCap + 1) }], 'nearCanopyPool');
  assert.equal(exceeded.exceedsConfiguredCap, true); assert.equal(exceeded.exceeds64MiB, true); assert.equal(exceeded.overflowObservations.length, 1);
  assert.throws(() => poolSummary(row(smallCap), [{}], 'nearCanopyPool'), /missing frame/);
  console.log('Pool comparison self-check passed: exact cap, one-byte overflow, missing observation.');
  process.exit(0);
}

const args = process.argv.slice(2);
assert(args.length >= 2 && args.length % 2 === 0, 'Supply paired baseline/candidate settings paths.');
const helperHash = hash(await fs.readFile(path.join(here, 'native-capture.mjs')));
const report = {
  sources: pinned, captureScriptSha256: helperHash, pairs: [], fixedViews: {}, warnings: [],
  coverage: { allSixFixedViews: false, firstAndWarmRoute: false, allRouteCanopyCaps64MiB: false },
  limitations: [
    'Completed-render-await timings include GPU readback, shader compilation, requestAnimationFrame and host scheduling; they are not FPS.',
    'Pool bounds apply only to the recorded frames. A first pass is not evidence of a cold rebuild unless the recorded counters show builds.',
    'Fixed captures reset camera state. Pixel and cost deltas describe observed changes; they do not establish visual acceptance.',
  ],
};
const routeCaps = [];
const checkPool = (pool, label) => {
  if (pool.exceedsConfiguredCap) report.warnings.push(`${label}: configured pool cap EXCEEDED (peak resident ${pool.peakResidentMiB.toFixed(3)} MiB, pinned ${pool.peakPinnedMiB.toFixed(3)} MiB).`);
  else if (pool.exceeds64MiB) report.warnings.push(`${label}: demand exceeds 64 MiB while using a larger configured pool.`);
};
async function loadCapture(settingFile, side) {
  const settingsPath = path.isAbsolute(settingFile) ? settingFile : path.resolve(here, settingFile);
  const settings = await read(settingsPath), dir = path.resolve(root, settings.out), manifestPath = path.join(dir, 'manifest.json');
  const rawManifest = await fs.readFile(manifestPath), manifest = JSON.parse(rawManifest), expected = pinned[side];
  assert.equal(manifest.complete, true, `${dir}: capture incomplete`);
  assert.deepEqual(manifest.errors, [], `${dir}: renderer errors`);
  assert.deepEqual(manifest.settings, settings, `${dir}: settings changed`);
  assert.equal(manifest.sha, expected.source); assert.equal(settings.sourceSha, expected.source);
  assert.equal(settings.bundle, expected.bundle); assert.equal(manifest.bundleSha256, expected.sha256);
  assert.equal(hash(await fs.readFile(path.resolve(root, settings.dist, 'assets', expected.bundle))), expected.sha256, 'Pinned bundle bytes changed');
  const html = await fs.readFile(path.resolve(root, settings.dist, 'index.html'), 'utf8');
  const entries = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => path.posix.basename(match[1]));
  assert.deepEqual(entries, [expected.bundle], 'Served HTML entry does not select the pinned bundle');
  assert.equal(manifest.captureScriptSha256, helperHash, 'Capture helper changed');
  assert.equal(manifest.sourceDiffSha256, hash('')); assert.equal(await fs.readFile(path.join(dir, 'source.diff'), 'utf8'), '');
  assert.match(manifest.renderer, /D3D11/); assert.doesNotMatch(manifest.renderer, /SwiftShader|llvmpipe|software/i);
  return { settings, dir, manifest, manifestSha256: hash(rawManifest) };
}

async function comparePixels(a, b, id) {
  const records = [a, b].map(c => c.manifest.images[id]);
  const images = await Promise.all([a, b].map(async (capture, side) => {
    const bytes = await fs.readFile(path.join(capture.dir, `${id}.png`));
    assert.equal(hash(bytes), records[side].sha256, `${id}: PNG hash`);
    return sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  }));
  assert.deepEqual(images[0].info, images[1].info); assert.equal(images[0].info.channels, 3);
  assert.equal(images[0].info.width, records[0].stats.width); assert.equal(images[0].info.height, records[0].stats.height);
  let changed = 0, error = 0, maxChannelError = 0;
  for (let i = 0; i < images[0].data.length; i += 3) {
    let different = false;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(images[0].data[i + c] - images[1].data[i + c]);
      different ||= delta > 0; error += delta; maxChannelError = Math.max(maxChannelError, delta);
    }
    changed += Number(different);
  }
  return { pixelIdentical: changed === 0, pngByteIdentical: records[0].sha256 === records[1].sha256, changedPixels: changed,
    changedFraction: changed / (images[0].info.width * images[0].info.height), meanAbsoluteChannelError255: error / images[0].data.length,
    maxChannelError255: maxChannelError, sha256: records.map(r => r.sha256) };
}

function summarizePass(trace, passIndex) {
  const pass = trace.passes[passIndex], rows = pass.rows;
  const initial = pass.start ?? (passIndex ? trace.passes[passIndex - 1].rows.at(-1) : trace.start);
  for (const key of ['visiblePointLights', 'totalPointLights']) finite(initial[key], `${pass.name}/start/${key}`);
  finite(initial.stats.programs, `${pass.name}/start/programs`);
  let prior = initial;
  const events = rows.map(row => {
    for (const key of ['treeUpdateMs', 'completedMs', 'visiblePointLights', 'totalPointLights']) finite(row[key], `${pass.name}/${row.k}/${key}`);
    const event = { k: row.k, phase: row.phase, completedRenderAwaitMs: row.completedMs, treeUpdateMs: row.treeUpdateMs,
      programsDelta: row.stats.programs - prior.stats.programs, visiblePointLights: [prior.visiblePointLights, row.visiblePointLights],
      lightCountChanged: row.visiblePointLights !== prior.visiblePointLights, drawCalls: row.stats.drawCalls, triangles: row.stats.triangles };
    prior = row; return event;
  });
  const timings = selected => ({ treeUpdateMs: distribution(selected.map(r => r.treeUpdateMs)), completedRenderAwaitMs: distribution(selected.map(r => r.completedMs)) });
  return {
    frames: rows.length, ...timings(rows), phases: Object.fromEntries([...new Set(rows.map(r => r.phase))].map(phase => [phase, timings(rows.filter(r => r.phase === phase))])),
    costs: Object.fromEntries(costKeys.map(key => [key, range(rows.map(r => r.stats[key]))])),
    programs: [initial.stats.programs, rows.at(-1).stats.programs], visiblePointLights: range(rows.map(r => r.visiblePointLights)), totalPointLights: range(rows.map(r => r.totalPointLights)),
    pools: Object.fromEntries(['nearCanopyPool', 'nearBasePool'].map(key => [key, poolSummary(initial, rows, key)])),
    events: events.filter(e => e.programsDelta || e.lightCountChanged || e.completedRenderAwaitMs > 1000),
    slowestFrames: [...events].sort((a, b) => b.completedRenderAwaitMs - a.completedRenderAwaitMs).slice(0, 8),
  };
}

for (let i = 0; i < args.length; i += 2) {
  const captures = await Promise.all([loadCapture(args[i], 0), loadCapture(args[i + 1], 1)]), [a, b] = captures;
  assert.deepEqual(controls(a.settings), controls(b.settings), 'Capture controls differ'); assert.equal(a.manifest.renderer, b.manifest.renderer);
  assert.deepEqual(Object.keys(a.manifest.images), Object.keys(b.manifest.images));
  const pair = { directories: captures.map(c => c.dir), manifestSha256: captures.map(c => c.manifestSha256), renderer: b.manifest.renderer,
    bootReadyMs: captures.map(c => finite(c.manifest.bootReadyMs, 'bootReadyMs')), images: {} };
  for (const id of Object.keys(a.manifest.images)) {
    const before = a.manifest.images[id], after = b.manifest.images[id];
    sameFrame(before, after, id); assert.equal(before.stats.simTime, 12.6);
    assert.deepEqual(before.lighting, after.lighting, `${id}: lighting`); assert.deepEqual(before.variant, after.variant, `${id}: variant`);
    const delta = Object.fromEntries(costKeys.map(key => [key, after.stats[key] - before.stats[key]]));
    const result = { before: before.stats, after: after.stats, delta, ...await comparePixels(a, b, id), distantClose: after.distantClose ?? null,
      canopyPools: [before, after].map(row => poolSummary(row, [], 'nearCanopyPool')) };
    result.canopyPools.forEach((pool, side) => checkPool(pool, `${captures[side].dir}/${id}`));
    if (['A_stairs', 'F_canopy'].includes(id)) result.observedEquality = { pixels: result.pixelIdentical, pngBytes: result.pngByteIdentical, submittedCosts: delta.drawCalls === 0 && delta.triangles === 0, closeSlotsZero: after.distantClose?.active === 0 };
    pair.images[id] = result; report.fixedViews[id] = result;
  }
  assert.equal(Boolean(a.manifest.transition), Boolean(b.manifest.transition), 'Only one side contains a route');
  if (a.manifest.transition) {
    const moduleHash = hash(await fs.readFile(path.join(here, 'matched-transition.mjs'))), traces = [], traceHashes = [];
    const traceBinding = [];
    for (const capture of captures) {
      const transition = capture.manifest.transition;
      assert.equal(transition.file, 'trace.json'); assert.equal(transition.moduleSha256, moduleHash);
      const bytes = await fs.readFile(path.join(capture.dir, transition.file)), trace = JSON.parse(bytes), sha256 = hash(bytes);
      assert.equal(trace.moduleSha256, moduleHash);
      assert.equal(transition.traceSha256, sha256, 'Capture-time trace hash missing or mismatched');
      traceBinding.push(true); traces.push(trace); traceHashes.push(sha256);
      assert.deepEqual(trace.passes.map(p => p.name), ['first', 'warm']); assert.deepEqual(transition.passes, ['first', 'warm']);
      for (const pass of trace.passes) {
        assert(Array.isArray(pass.shots), `${pass.name}: screenshot records missing`);
        assert.deepEqual(pass.shots.map(shot => shot.k), pass.name === 'warm' ? Array.from({ length: pass.rows.length }, (_, k) => k) : [], 'Route screenshot schedule incomplete');
        for (const shot of pass.shots) {
          assert(Number.isInteger(shot.k) && shot.k >= 0 && shot.k < pass.rows.length, 'Invalid screenshot frame');
          assert.equal(shot.file, `warm/${String(shot.k).padStart(4, '0')}.jpg`, 'Route screenshot/frame binding mismatch');
          assert.equal(hash(await fs.readFile(path.join(capture.dir, shot.file))), shot.sha256, 'Route screenshot hash mismatch');
        }
      }
    }
    const keys = ['dt', 'startZ', 'endZ', 'travelFrames', 'turnFrames', 'holdFrames'];
    for (const key of keys) { finite(traces[0][key], key); assert.equal(traces[0][key], traces[1][key], `${key}: route mismatch`); }
    sameFrame(traces[0].start, traces[1].start, 'route start'); assert.equal(traces[0].start.stats.simTime, 12.6);
    const sequence = traces[0], frames = sequence.travelFrames * 2 + sequence.turnFrames + sequence.holdFrames;
    pair.route = { sequence: Object.fromEntries(keys.map(key => [key, sequence[key]])), moduleSha256: moduleHash, traceSha256: traceHashes, captureTimeTraceHash: traceBinding, passes: {} };
    pair.route.firstPose = traces.map((trace, side) => {
      assert(trace.boot?.state, 'Pre-route boot snapshot missing');
      sameFrame(traces[0].boot.state, traces[1].boot.state, 'boot snapshot');
      const pools = Object.fromEntries(['nearCanopyPool', 'nearBasePool'].map(key => [key, poolSummary(trace.boot.state, [trace.start], key)]));
      for (const [key, pool] of Object.entries(pools)) checkPool(pool, `${captures[side].dir}/first-pose/${key}`);
      return { firstPoseMs: finite(trace.boot.firstPoseMs, 'firstPoseMs'), pools };
    });
    for (let pass = 0; pass < 2; pass++) {
      let time = 12.6;
      const starts = traces.map(trace => trace.passes[pass].start);
      assert(starts.every(Boolean), 'Route pass-start snapshot missing');
      sameFrame(starts[0], starts[1], `pass ${pass} start`); assert.equal(starts[0].stats.simTime, time);
      const rows = traces.map(t => t.passes[pass].rows);
      for (const [side, data] of rows.entries()) { assert.equal(data.length, frames); assert.equal(captures[side].manifest.transition.framesPerPass, frames); }
      for (let k = 0; k < frames; k++) {
        time += sequence.dt; sameFrame(rows[0][k], rows[1][k], `route ${pass}/${k}`);
        const phase = k < sequence.travelFrames ? 'approach' : k < sequence.travelFrames + sequence.turnFrames ? 'turn' : k < sequence.travelFrames * 2 + sequence.turnFrames ? 'retreat' : 'hold';
        for (const row of rows.map(r => r[k])) { assert.equal(row.k, k); assert.equal(row.phase, phase); assert.equal(row.stats.simTime, time); }
        assert.equal(rows[0][k].close, null, 'Baseline contains close-crown state'); assert(Array.isArray(rows[1][k].close?.weights), 'Candidate close-crown state missing');
      }
      const before = summarizePass(traces[0], pass), after = summarizePass(traces[1], pass);
      for (const summary of [before, after]) {
        routeCaps.push(...summary.pools.nearCanopyPool.capBytes);
        for (const [poolName, pool] of Object.entries(summary.pools)) checkPool(pool, `${captures[[before, after].indexOf(summary)].dir}/${traces[0].passes[pass].name}/${poolName}`);
      }
      pair.route.passes[traces[0].passes[pass].name] = { before, after,
        pairedDelta: Object.fromEntries(['treeUpdateMs', 'completedMs', ...costKeys].map(key => [key, distribution(rows[0].map((row, k) => (rows[1][k][key] ?? rows[1][k].stats[key]) - (row[key] ?? row.stats[key])))])),
        lightCountMismatchFrames: rows[0].filter((row, k) => row.visiblePointLights !== rows[1][k].visiblePointLights).map(row => row.k),
      };
    }
    report.coverage.firstAndWarmRoute = true;
  }
  report.pairs.push(pair);
}
report.coverage.allSixFixedViews = fixedIds.every(id => Object.hasOwn(report.fixedViews, id));
report.coverage.allRouteCanopyCaps64MiB = routeCaps.length > 0 && routeCaps.every(cap => cap === smallCap);
if (!report.coverage.allSixFixedViews) report.warnings.push('Six-view fixed comparison incomplete or not supplied.');
if (!report.coverage.firstAndWarmRoute) report.warnings.push('First/warm route comparison not supplied.');
if (!report.coverage.allRouteCanopyCaps64MiB) report.warnings.push('A 64 MiB canopy-pool route is not fully established by these captures.');
await fs.writeFile(path.join(here, 'comparison.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ coverage: report.coverage, fixedViews: Object.keys(report.fixedViews), warnings: report.warnings, report: path.join(here, 'comparison.json') }, null, 2));
if (report.warnings.some(warning => warning.includes('configured pool cap EXCEEDED'))) process.exitCode = 2;
