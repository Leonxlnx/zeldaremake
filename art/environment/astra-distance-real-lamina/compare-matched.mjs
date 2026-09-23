/** CPU-only verification of the completed frozen pair; never launches a renderer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFile(path.join(root, name), 'utf8').then(JSON.parse);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const dirs = ['native-matched-before', 'native-matched-after'];
const [before, after, snapshot, build] = await Promise.all([
  ...dirs.map(dir => read(`${dir}/manifest.json`)), read('baseline-dist-manifest.json'), read('build.json'),
]);
const manifests = [before, after];
assert(manifests.every(m => m.complete === true), 'Both capture manifests must be complete before comparison');
const traces = await Promise.all(dirs.map(dir => read(`${dir}/trace.json`)));
const helperHash = hash(await fs.readFile(path.join(root, 'native-capture.mjs')));
const moduleHash = hash(await fs.readFile(path.join(root, 'matched-transition.mjs')));
const sequenceKeys = ['dt', 'startZ', 'endZ', 'travelFrames', 'turnFrames', 'holdFrames'];
const settings = m => Object.fromEntries(Object.entries(m.settings).filter(([key]) => !['sourceSha', 'dist', 'bundle', 'baseline', 'out'].includes(key)));
assert.deepEqual(settings(before), settings(after), 'Capture settings differ');
assert.equal(before.renderer, after.renderer, 'Renderer differs');
assert.match(before.sha, /^[a-f0-9]{40}$/);
assert(before.sha.startsWith(snapshot.source), 'Baseline source does not match its snapshot');
assert.equal(after.sha, build.source);
assert.equal(after.settings.bundle, path.basename(build.bundle));
const baselineBundle = snapshot.files.find(file => file.file === `assets/${before.settings.bundle}`);
assert(baselineBundle, 'Baseline bundle missing from pinned snapshot');
for (const [i, m] of manifests.entries()) {
  assert.deepEqual(m.errors, [], `${dirs[i]} renderer errors`);
  assert.equal(m.settings.sourceSha, m.sha);
  assert.equal(m.bundleSha256, i ? build.sha256 : baselineBundle.hash);
  assert.match(m.renderer, /D3D11/);
  assert.doesNotMatch(m.renderer, /SwiftShader|llvmpipe|software/i);
  assert.equal(m.sourceDiffSha256, hash(''));
  assert.equal(await fs.readFile(path.join(root, dirs[i], 'source.diff'), 'utf8'), '');
  assert.equal(m.captureScriptSha256, helperHash, 'Capture helper changed');
  assert.equal(m.transition.moduleSha256, moduleHash, 'Transition module changed');
  assert.equal(traces[i].moduleSha256, moduleHash);
  assert.equal(m.transition.file, 'trace.json');
  assert.deepEqual(m.transition.passes, ['first', 'warm']);
  assert.deepEqual(traces[i].passes.map(p => p.name), ['first', 'warm']);
}
for (const key of sequenceKeys) assert.equal(traces[0][key], traces[1][key], `${key} differs`);
const sequence = traces[0];
const frames = sequence.travelFrames * 2 + sequence.turnFrames + sequence.holdFrames;
const phaseAt = k => k < sequence.travelFrames ? 'approach' : k < sequence.travelFrames + sequence.turnFrames ? 'turn' : k < sequence.travelFrames * 2 + sequence.turnFrames ? 'retreat' : 'hold';
const sameFrame = (a, b, label) => {
  assert.deepEqual(a.camera, b.camera, `${label}: actual camera differs`);
  for (const key of ['simTime', 'width', 'height', 'pixelRatio']) assert.equal(a.stats[key], b.stats[key], `${label}: ${key} differs`);
  assert.equal(a.stats.width, 1280); assert.equal(a.stats.height, 720);
};
sameFrame(traces[0].start, traces[1].start, 'start');
assert.equal(traces[0].start.stats.simTime, 12.6);
for (let pass = 0; pass < 2; pass++) {
  for (let side = 0; side < 2; side++) {
    assert.equal(traces[side].passes[pass].rows.length, frames);
    assert.equal(manifests[side].transition.framesPerPass, frames);
    assert.deepEqual(traces[side].passes[pass].shots.map(s => s.k), pass ? Array.from({ length: frames }, (_, k) => k) : []);
  }
  let time = 12.6;
  for (let k = 0; k < frames; k++) {
    const rows = traces.map(t => t.passes[pass].rows[k]);
    sameFrame(...rows, `${traces[0].passes[pass].name}/${k}`);
    assert.equal(rows[0].close, null, 'Baseline unexpectedly contains candidate close-crown state');
    assert(rows[1].close && Array.isArray(rows[1].close.weights), 'Candidate close-crown state missing');
    time += sequence.dt;
    for (const row of rows) {
      assert.equal(row.k, k); assert.equal(row.phase, phaseAt(k));
      assert.equal(row.stats.simTime, time, 'Simulation sequence differs');
      for (const value of [row.treeUpdateMs, row.completedMs, row.visiblePointLights, row.totalPointLights, row.stats.drawCalls, row.stats.triangles, row.stats.programs]) assert(Number.isFinite(value));
    }
  }
}

const distribution = values => {
  assert(values.length && values.every(Number.isFinite));
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], max: sorted.at(-1) };
};
const range = values => [Math.min(...values), Math.max(...values)];
const poolKeys = ['built', 'evicted', 'syncBuilds'];
const poolDelta = (a, b) => Object.fromEntries(poolKeys.map(key => [key, b[key] - a[key]]));
function summarize(trace, passIndex) {
  const rows = trace.passes[passIndex].rows;
  const initial = passIndex ? trace.passes[passIndex - 1].rows.at(-1) : trace.start;
  let prior = initial, fractionalFrames = 0, membershipChanges = 0;
  const ids = new Set(), events = [], annotated = [];
  for (const row of rows) {
    const weights = row.close?.weights ?? [], previous = prior.close?.weights ?? [];
    weights.forEach(([id]) => ids.add(id));
    fractionalFrames += Number(weights.some(([, weight]) => weight > 0 && weight < 1));
    const entered = weights.filter(([id]) => !previous.some(([old]) => old === id)).map(([id]) => id);
    const left = previous.filter(([id]) => !weights.some(([next]) => next === id)).map(([id]) => id);
    membershipChanges += Number(Boolean(entered.length || left.length));
    const event = { k: row.k, phase: row.phase, completedRenderAwaitMs: row.completedMs, treeUpdateMs: row.treeUpdateMs,
      programsAdded: row.stats.programs - prior.stats.programs, visiblePointLights: [prior.visiblePointLights, row.visiblePointLights],
      lightCountChanged: row.visiblePointLights !== prior.visiblePointLights, overOneSecond: row.completedMs > 1000,
      drawCalls: row.stats.drawCalls, triangles: row.stats.triangles, entered, left };
    annotated.push(event);
    if (event.programsAdded || event.lightCountChanged || event.overOneSecond) events.push(event);
    prior = row;
  }
  return {
    frames: rows.length,
    treeUpdateMs: distribution(rows.map(r => r.treeUpdateMs)), completedRenderAwaitMs: distribution(rows.map(r => r.completedMs)),
    phases: Object.fromEntries(['approach', 'turn', 'retreat', 'hold'].map(phase => { const selected = rows.filter(r => r.phase === phase); return [phase, {
      treeUpdateMs: distribution(selected.map(r => r.treeUpdateMs)), completedRenderAwaitMs: distribution(selected.map(r => r.completedMs)),
    }]; })),
    programCount: [initial.stats.programs, rows.at(-1).stats.programs],
    visiblePointLightRange: range(rows.map(r => r.visiblePointLights)), totalPointLightRange: range(rows.map(r => r.totalPointLights)),
    drawCalls: distribution(rows.map(r => r.stats.drawCalls)), triangles: distribution(rows.map(r => r.stats.triangles)),
    pools: Object.fromEntries(['nearCanopyPool', 'nearBasePool'].map(key => [key, {
      delta: poolDelta(initial.pool[key], rows.at(-1).pool[key]), residentBytes: range(rows.map(r => r.pool[key].poolBytes)),
    }])),
    slots: { range: range(rows.map(r => r.close?.active ?? 0)), distinctIds: [...ids].sort((a, b) => a - b), fractionalFrames, membershipChangeFrames: membershipChanges },
    events, slowestFrames: annotated.sort((a, b) => b.completedRenderAwaitMs - a.completedRenderAwaitMs).slice(0, 10),
  };
}
const summary = {
  provenance: { sources: manifests.map(m => ({ sha: m.sha, bundleSha256: m.bundleSha256 })), renderer: after.renderer,
    helperSha256: helperHash, moduleSha256: moduleHash, traceSha256: await Promise.all(dirs.map(dir => fs.readFile(path.join(root, dir, 'trace.json')).then(hash))) },
  sequence: Object.fromEntries(sequenceKeys.map(key => [key, sequence[key]])), passes: {}, pixelChanges: {},
  limitations: [
    'Completed-render-await timings include requestAnimationFrame, GPU readback, shader compilation and host scheduling; they are not FPS.',
    'Both frozen sources predate upstream 4b2fe8e6, which fixes northLights and dressed-hut light parenting when hidden beyond 45m. Coincident light-count changes, new programs and stalls are reported; timing changes cannot be attributed solely to close crowns.',
    'Trace digests are recorded at comparison time. The capture manifests do not contain capture-time trace hashes, so source binding relies on the adjacent capture records and distinct baseline/candidate runtime state, not independent trace attestation.',
    'First use and warmed movement are separate passes in each page. Pool counters determine whether builds or evictions actually occurred; warmth alone is not proof of cold-rebuild coverage.',
    'Decoded JPEG pixel changes are descriptive and include compression. They are not PNG byte-equality evidence or a visual acceptance verdict.',
  ],
};
for (let pass = 0; pass < 2; pass++) {
  const a = traces[0].passes[pass].rows, b = traces[1].passes[pass].rows;
  summary.passes[traces[0].passes[pass].name] = {
    before: summarize(traces[0], pass), after: summarize(traces[1], pass),
    pairedDelta: Object.fromEntries(['treeUpdateMs', 'completedMs', 'drawCalls', 'triangles'].map(key => [key,
      distribution(a.map((row, k) => (b[k][key] ?? b[k].stats[key]) - (row[key] ?? row.stats[key])))])),
    lightCountMismatchFrames: a.filter((row, k) => row.visiblePointLights !== b[k].visiblePointLights).map(row => row.k),
  };
}

// One contact sheet only: warmed endpoint and halfway through the visible turn.
const tiles = [];
for (const [row, k] of [sequence.travelFrames - 1, sequence.travelFrames + Math.floor(sequence.turnFrames / 2) - 1].entries()) {
  const bytes = [];
  for (let side = 0; side < 2; side++) {
    const shot = traces[side].passes[1].shots.find(s => s.k === k);
    assert(shot && shot.file === `warm/${String(k).padStart(4, '0')}.jpg`);
    const raw = await fs.readFile(path.join(root, dirs[side], shot.file));
    assert.equal(hash(raw), shot.sha256, 'Raw JPEG hash mismatch'); bytes.push(raw);
    tiles.push({ input: await sharp(raw).resize(640, 360).toBuffer(), left: side * 640, top: row * 384 });
    const label = `<svg width="640" height="24"><rect width="640" height="24" fill="#151a18"/><text x="12" y="17" fill="white" font-family="sans-serif" font-size="14">${side ? 'Candidate' : 'Baseline'} / warm frame ${k} / ${phaseAt(k)}</text></svg>`;
    tiles.push({ input: Buffer.from(label), left: side * 640, top: row * 384 + 360 });
  }
  const pixels = await Promise.all(bytes.map(raw => sharp(raw).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  assert.deepEqual(pixels[0].info, pixels[1].info); assert.equal(pixels[0].info.channels, 3);
  let changedPixels = 0, error = 0, maxChannelError255 = 0;
  for (let i = 0; i < pixels[0].data.length; i += 3) {
    let changed = false;
    for (let c = 0; c < 3; c++) { const d = Math.abs(pixels[0].data[i + c] - pixels[1].data[i + c]); changed ||= d > 0; error += d; maxChannelError255 = Math.max(maxChannelError255, d); }
    changedPixels += Number(changed);
  }
  summary.pixelChanges[k] = { phase: phaseAt(k), decodedPixels: pixels[0].info.width * pixels[0].info.height, changedPixels,
    changedFraction: changedPixels / (pixels[0].info.width * pixels[0].info.height), meanAbsoluteChannelError255: error / pixels[0].data.length, maxChannelError255,
    rawJpegSha256: bytes.map(hash) };
}
const contact = await sharp({ create: { width: 1280, height: 768, channels: 3, background: '#151a18' } }).composite(tiles).jpeg({ quality: 90 }).toBuffer();
summary.contactSheet = { file: 'matched-contact.jpg', sha256: hash(contact), layout: 'Baseline left, candidate right; warmed endpoint above, turn below.' };
await fs.writeFile(path.join(root, summary.contactSheet.file), contact);
await fs.writeFile(path.join(root, 'matched-comparison.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
