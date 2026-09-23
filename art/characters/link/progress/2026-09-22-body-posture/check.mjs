// CPU-only: node .../check.mjs BASE-1873.glb CANDIDATE.glb [new-report.json]
// Reuse the existing snapshot/summarizer; never mutate runtime, models or historical helpers.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Quaternion } from 'three';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
assert.ok(process.argv.length >= 4 && process.argv.length <= 5, 'Supply explicit base and candidate paths');
const files = process.argv.slice(2, 4).map(p => path.resolve(p));
const output = path.resolve(process.argv[4] ?? path.join(here, 'runtime-check.json'));
assert.ok(!files.includes(output));
await assert.rejects(fs.access(output), { code: 'ENOENT' });
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const lfSha = b => sha(b.toString().replace(/\r\n/g, '\n'));
const expected = ['1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5', '143160f1c413694865a9b3273dbbf16bc22a89a1fdc62d2b35381c980ae47e69'];
const bytes = await Promise.all(files.map(f => fs.readFile(f)));
bytes.forEach((b, i) => assert.equal(sha(b), expected[i]));
const carrierPath = path.join(here, 'local-head-posture-native.glb'), carrier = await fs.readFile(carrierPath);
assert.equal(sha(carrier), '24264576c028399026fe26140ffa9f731b322873cf45ae1b9a588d79b0a4991e');
const unpack = b => {
  assert.equal(b.toString('ascii', 0, 4), 'glTF'); assert.equal(b.readUInt32LE(4), 2); assert.equal(b.readUInt32LE(8), b.length);
  const size = b.readUInt32LE(12); assert.equal(b.toString('ascii', 16, 20), 'JSON');
  assert.equal(b.toString('ascii', 24 + size, 28 + size), 'BIN\0');
  const doc = JSON.parse(b.subarray(20, 20 + size));
  return { doc, bin: b.subarray(28 + size, 28 + size + doc.buffers[0].byteLength) };
};
const [base, candidate, native] = [...bytes, carrier].map(unpack);
const run = m => m.doc.animations.find(a => a.name === 'run');
const chest = m => run(m).channels.find(c => m.doc.nodes[c.target.node].name === 'chest' && c.target.path === 'rotation');
const values = (m, i) => {
  const a = m.doc.accessors[i], v = m.doc.bufferViews[a.bufferView], width = { SCALAR: 1, VEC4: 4 }[a.type];
  assert.equal(a.componentType, 5126); assert.ok(width && !a.sparse); assert.equal(v.buffer ?? 0, 0);
  return Array.from({ length: a.count }, (_, r) => Array.from({ length: width }, (_, k) =>
    m.bin.readFloatLE((v.byteOffset ?? 0) + (a.byteOffset ?? 0) + r * (v.byteStride ?? width * 4) + k * 4)));
};
assert.deepEqual(candidate.bin.subarray(0, base.bin.length), base.bin);
assert.equal(candidate.doc.accessors.length, base.doc.accessors.length + 2);
assert.equal(candidate.doc.bufferViews.length, base.doc.bufferViews.length + 2);
assert.deepEqual(candidate.doc.accessors.slice(0, base.doc.accessors.length), base.doc.accessors);
assert.deepEqual(candidate.doc.bufferViews.slice(0, base.doc.bufferViews.length), base.doc.bufferViews);
const restored = structuredClone(candidate.doc), restoredRun = restored.animations.find(a => a.name === 'run');
assert.equal(restoredRun.samplers.length, run(base).samplers.length + 1);
assert.deepEqual(restoredRun.samplers.slice(0, -1), run(base).samplers);
assert.equal(chest(candidate).sampler, run(base).samplers.length);
restoredRun.channels.find(c => restored.nodes[c.target.node].name === 'chest' && c.target.path === 'rotation').sampler = chest(base).sampler;
restoredRun.samplers.pop(); restored.accessors.splice(base.doc.accessors.length); restored.bufferViews.splice(base.doc.bufferViews.length);
restored.buffers = structuredClone(base.doc.buffers);
assert.deepEqual(restored, base.doc, 'Only the run chest rotation may change; all other local source channels must match');
const cs = run(candidate).samplers[chest(candidate).sampler], ns = run(native).samplers[chest(native).sampler];
assert.equal(cs.interpolation, 'LINEAR'); assert.equal(ns.interpolation, 'LINEAR');
const times = values(candidate, cs.input).flat(), qs = values(candidate, cs.output);
assert.deepEqual(values(candidate, cs.input), values(native, ns.input));
assert.deepEqual(qs, values(native, ns.output));
assert.equal(times.length, 113); assert.equal(qs.length, 113);
assert.ok(times.every((t, i) => Math.abs(t - i * (28 / 60) / 112) < 1e-7 && (!i || t > times[i - 1])));
assert.ok(qs.every(q => q.every(Number.isFinite) && Math.abs(q.reduce((s, v) => s + v * v, 0) - 1) < 1e-5));
const angle = (a, b) => {
  const q = new Quaternion(...a).normalize().invert().multiply(new Quaternion(...b).normalize());
  return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), Math.abs(q.w)) * 180 / Math.PI;
};
const steps = qs.slice(1).map((q, i) => angle(qs[i], q));
const loopDeg = angle(qs[0], qs.at(-1)); assert.ok(loopDeg < .0001, 'Authored chest loop must close');
const runtimePath = path.join(ROOT, 'src/world/character/glbLink.ts');
const helperPath = path.join(ROOT, 'art/characters/link/progress/2026-09-21-run-carriage/compare.mjs');
const [runtime, helper] = await Promise.all([fs.readFile(runtimePath), fs.readFile(helperPath, 'utf8')]);
assert.equal(lfSha(helper), 'b24bb9c2434648d0a0144deaeac33e03867a3534018c502c6d6f55acd3d64353');
const extract = (a, b) => { const i = helper.indexOf(a), j = helper.indexOf(b, i); assert.ok(i >= 0 && j > i); return helper.slice(i, j); };
const reuse = extract('const snapshot=root=>{', 'const digest=async rows=>') + extract('const summarize=(rows,dt)=>{', 'const results={};');
const report = { baseSha256: expected[0], candidateSha256: expected[1], carrierSha256: sha(carrier),
  runtimeRawSha256: sha(runtime), runtimeNormalizedLfSha256: lfSha(runtime), helperNormalizedLfSha256: lfSha(helper),
  preservation: { changed: [['run', 'chest', 'rotation']], originalBinBytesExact: base.bin.length,
    originalAccessorsExact: base.doc.accessors.length, allOtherMetadataAndChannelsExact: true,
    nativeCarrierChestKeysAndTimesExact: true, keys: qs.length, durationS: times.at(-1),
    loopOrientationDeg: loopDeg, loopMaxComponentDifference: Math.max(...qs[0].map((v, i) => Math.abs(v - qs.at(-1)[i]))),
    nativeChestMaxStepDeg: Math.max(...steps), nativeChestMaxSpeedDegPerS: Math.max(...steps) / ((28 / 60) / 112) }, errors: [] };
process.env.ZR_NATIVE_GPU = '0';
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'cpu-local-head-posture-check',
  load(id) { if (id.split('?')[0].replaceAll('\\', '/').endsWith('/src/world/character/glbLink.ts')) return runtime.toString(); },
  configureServer(s) {
    s.middlewares.use('/__chest-follow', (_q, r) => r.end('<!doctype html><title>CPU chest follow check</title>'));
    bytes.forEach((b, i) => s.middlewares.use('/__chest-' + i + '.glb', (_q, r) => { r.setHeader('Content-Type', 'model/gltf-binary'); r.end(b); }));
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__chest-follow');
  report.results = await page.evaluate(async reuse => {
    const [{ loadGlbLink }, { createLocomotion }, { hardChain, switchGait, chainWeights }, { Vector3, Quaternion, AnimationMixer, LoopOnce }, { GLTFLoader }, { PLAYER_SPEED, PLAYER_ACCEL, PLAYER_DECEL, GAIT_SPEED }, { BLINK_S }] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'), import('/src/world/character/gaitChain.ts'),
      import('/node_modules/three/build/three.module.js'), import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
      import('/src/world/character/animation.ts'), import('/src/world/character/blink.ts'),
    ]);
    const points = ['hips', 'chest', 'neck', 'head', ...['thigh', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'hand'].flatMap(n => [n + 'L', n + 'R'])];
    // Chest/head world motion is intentional here. Their unselected local source channels were checked above.
    const protectedBones = ['hips', ...['thigh', 'knee', 'ankle', 'toe'].flatMap(n => [n + 'L', n + 'R'])];
    const localBones = ['neck', 'head', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR'];
    const deg = 180 / Math.PI, flat = () => 0, contact = new Vector3();
    const summary = a => ({ min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length });
    const corr = (a, b) => { const am = summary(a).mean, bm = summary(b).mean; return a.reduce((s, v, i) => s + (v - am) * (b[i] - bm), 0) / Math.sqrt(a.reduce((s, v) => s + (v - am) ** 2, 0) * b.reduce((s, v) => s + (v - bm) ** 2, 0)); };
    const angle = (a, b) => {
      const q = new Quaternion(...a).normalize().invert().multiply(new Quaternion(...b).normalize());
      return 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), Math.abs(q.w)) * deg;
    };
    const { snapshot, summarize } = eval('(() => {' + reuse + '; return {snapshot, summarize};})()');
    const sample = root => {
      const r = snapshot(root);
      r.local = localBones.flatMap(n => { const b = root.getObjectByName(n); return [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]; });
      r.chestQ = root.getObjectByName('chest').getWorldQuaternion(new Quaternion()).normalize().toArray();
      // Current joint chest frame; do not confuse hips-to-neck lean with the chest axis.
      const p = Object.fromEntries(Object.entries(r.points).map(([n, v]) => [n, new Vector3(...v)]));
      const lateral = p.shoulderL.clone().sub(p.shoulderR).normalize();
      const up = p.neck.clone().sub(p.chest); up.addScaledVector(lateral, -up.dot(lateral)).normalize();
      const forward = lateral.clone().cross(up).normalize();
      for (const s of ['L', 'R']) {
        const arm = p['elbow' + s].clone().sub(p['shoulder' + s]);
        r.metrics['upperArmChestFrameDeg' + s] = Math.atan2(arm.dot(forward), -arm.dot(up)) * deg;
        r.metrics['wristShoulderDepthChestFrameM' + s] = p['hand' + s].clone().sub(p['shoulder' + s]).dot(forward);
      }
      return r;
    };
    const digest = async x => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(x))))).map(b => b.toString(16).padStart(2, '0')).join('');
    const maxDiff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
    const zero = (a, b) => ({ headQuaternionComponentDifference: maxDiff(a.headQ, b.headQ), headOrientationDeg: angle(a.headQ, b.headQ),
      chestQuaternionComponentDifference: maxDiff(a.chestQ, b.chestQ), protectedWorldMatrixDifference: maxDiff(a.protected, b.protected),
      handTranslationM: Math.max(...['L', 'R'].map(s => new Vector3(...a.points['hand' + s]).distanceTo(new Vector3(...b.points['hand' + s])))) });
    const temporal = (rows, dt) => Object.fromEntries(['chestQ', 'headQ'].map(k => {
      const jumps = rows.slice(1).map((r, i) => angle(rows[i][k], r[k]));
      return [k, { maxStepDeg: Math.max(...jumps), maxSpeedDegPerS: Math.max(...jumps) / dt }];
    }));
    const sets = [], target = new Vector3(4, 1.2, 70), dt = 1 / 60, speed = 4.6;
    const gazeError = row => new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...row.headQ))
      .angleTo(target.clone().sub(new Vector3(...row.points.head)).normalize()) * deg;
    const transitions = [{ frame: 30, gait: 'walk' }, { frame: 90, gait: 'run' }, { frame: 150, gait: 'idle' },
      { frame: 154, gait: 'run' }, { frame: 158, gait: 'walk' }, { frame: 210, gait: 'idle' }, { frame: 240, gait: 'run' }];
    for (let v = 0; v < 2; v++) {
      const url = '/__chest-' + v + '.glb', gltf = await new GLTFLoader().loadAsync(url), mixer = new AnimationMixer(gltf.scene);
      const clip = gltf.animations.find(c => c.name === 'run'), action = mixer.clipAction(clip).setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
      const native = [], play = [], look = [], transition = [], zeros = [], switches = [];
      for (let i = 0; i <= 112; i++) { action.enabled = true; action.paused = false; action.time = clip.duration * i / 112; mixer.update(0); gltf.scene.updateMatrixWorld(true); native.push(sample(gltf.scene)); }
      const puppet = await loadGlbLink(url), chain = hardChain('run'), loco = createLocomotion(); let pose;
      for (let i = 0; i < 781; i++) {
        const t = i * dt, looking = i >= 720; loco.speed = speed; loco.dt = dt;
        puppet.advance(chain, t, speed * dt, dt); pose = { ...chain, t, phase: 0, look: looking ? target : null, lookWeight: looking ? 1 : 0, idleTurn: 0, loco };
        puppet.pose(0, speed * t, 0, pose, flat, contact);
        if (i < 120) continue;
        const row = { ...sample(puppet.group), rootY: puppet.group.position.y, feet: puppet.feetContact(), ik: puppet.plantInfo() };
        if (!looking) play.push(row);
        else {
          row.gazeErrorDeg = gazeError(row);
          look.push(row);
        }
        if (i === 719 || looking) { loco.dt = 0; puppet.pose(0, speed * t, 0, pose, flat, contact); zeros.push({ mode: looking ? 'look' : 'play', ...zero(row, sample(puppet.group)) }); }
        if (looking) {
          puppet.pose(0, speed * t, 0, { ...pose, look: null, lookWeight: 0 }, flat, contact);
          const without = sample(puppet.group);
          row.noLookGazeErrorDeg = gazeError(without);
          row.overlayCorrectionDeg = angle(without.headQ, row.headQ);
          puppet.pose(0, speed * t, 0, pose, flat, contact);
          zeros.push({ mode: 'look-after-null', ...zero(row, sample(puppet.group)) });
        }
      }
      // Real gait-chain, phase alignment, idle anchoring and acceleration. Three rapid
      // changes also exercise an interrupted blend; no renderer or full player harness.
      const tr = await loadGlbLink(url), tc = hardChain('idle'), tl = createLocomotion();
      let tz = 0, ts = 0, nestedFrames = 0;
      const hooks = { align: (...args) => tr.alignClip(...args), anchor: (gait, shift, t) => tr.anchor(0, tz, 0, gait, shift, t),
        hasPhase: gait => GAIT_SPEED[gait] > 0, blinkS: BLINK_S };
      for (let i = 0; i < 300; i++) {
        const t = i * dt, event = transitions.find(e => e.frame === i);
        if (event) { switchGait(tc, event.gait, t, hooks); switches.push({ ...event, t, chain: structuredClone(tc) }); }
        const desired = PLAYER_SPEED[tc.gait], limit = (desired > ts ? PLAYER_ACCEL : PLAYER_DECEL) * dt;
        ts += Math.max(-limit, Math.min(limit, desired - ts)); tz += ts * dt;
        tl.speed = ts; tl.dt = dt; tr.advance(tc, t, ts * dt, dt);
        const tp = { ...tc, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco: tl };
        tr.pose(0, tz, 0, tp, flat, contact);
        const weights = [0, 0, 0]; if (chainWeights(tc, t, () => true, weights) === 3) nestedFrames++;
        const row = { ...sample(tr.group), rootY: tr.group.position.y, feet: tr.feetContact(), ik: tr.plantInfo(), weights, gait: tc.gait };
        transition.push(row);
        if (event || i === 299) { tl.dt = 0; tr.pose(0, tz, 0, tp, flat, contact); zeros.push({ mode: 'transition', ...zero(row, sample(tr.group)) }); }
      }
      const spec = puppet.asset.clips.find(c => c.name === 'run');
      sets.push({ native, play, look, transition, zeros, switches, nestedFrames,
        spec: { clip: spec, speedMps: speed, cycleS: spec.strideM / speed, cadenceStepsPerMinute: 120 * speed / spec.strideM }, nativeDurationS: clip.duration });
    }
    const result = { specs: sets.map(s => s.spec), nativeDurationS: sets.map(s => s.nativeDurationS), protectedWorldBones: protectedBones, protectedLocalBones: localBones,
      transitions, switchTraceSha256: await Promise.all(sets.map(s => digest(s.switches))), nestedBlendFrames: sets.map(s => s.nestedFrames),
      lookWorldTarget: target.toArray(), modes: {}, zeroDt: sets.map(s => ({
      samples: s.zeros.length, maximumHeadQuaternionComponentDifference: Math.max(...s.zeros.map(z => z.headQuaternionComponentDifference)),
      maximumChestQuaternionComponentDifference: Math.max(...s.zeros.map(z => z.chestQuaternionComponentDifference)),
      maximumProtectedWorldMatrixDifference: Math.max(...s.zeros.map(z => z.protectedWorldMatrixDifference)),
      maximumHeadOrientationDeg: Math.max(...s.zeros.map(z => z.headOrientationDeg)), maximumHandTranslationM: Math.max(...s.zeros.map(z => z.handTranslationM)),
    })) };
    for (const mode of ['native', 'play', 'look', 'transition']) {
      const a = sets[0][mode], b = sets[1][mode], sampleDt = mode === 'native' ? sets[0].nativeDurationS / 112 : dt;
      const r = { base: summarize(a, sampleDt), candidate: summarize(b, sampleDt), upperArmBehindChestFraction: [a, b].map(rows => Object.fromEntries(['L', 'R'].map(s => [s, rows.filter(r => r.metrics['upperArmChestFrameDeg' + s] < 0).length / rows.length]))),
        maxProtectedWorldMatrixDifference: Math.max(...a.map((r, i) => maxDiff(r.protected, b[i].protected))),
        maxProtectedLocalTransformDifference: Math.max(...a.map((r, i) => maxDiff(r.local, b[i].local))),
        protectedWorldTraceSha256: await Promise.all([a, b].map(rows => digest(rows.map(r => r.protected)))),
        maxHeadOrientationDifferenceDeg: Math.max(...a.map((r, i) => angle(r.headQ, b[i].headQ))),
        maxChestOrientationDifferenceDeg: Math.max(...a.map((r, i) => angle(r.chestQ, b[i].chestQ))),
        orientationTemporal: [temporal(a, sampleDt), temporal(b, sampleDt)] };
      if (mode === 'native') r.loop = [a, b].map(rows => ({ headDeg: angle(rows[0].headQ, rows.at(-1).headQ), chestDeg: angle(rows[0].chestQ, rows.at(-1).chestQ), handMaxM: Math.max(...['L', 'R'].map(s => new Vector3(...rows[0].points['hand' + s]).distanceTo(new Vector3(...rows.at(-1).points['hand' + s])))) }));
      else r.rootFootIkTraceSha256 = await Promise.all([a, b].map(rows => digest(rows.map(r => ({ rootY: r.rootY, feet: r.feet, ik: r.ik })))));
      if (mode === 'look') {
        r.headForwardTargetErrorDeg = [a, b].map(rows => summary(rows.map(r => r.gazeErrorDeg)));
        r.headForwardTargetErrorWithoutOverlayDeg = [a, b].map(rows => summary(rows.map(r => r.noLookGazeErrorDeg)));
        r.overlayCorrectionDeg = [a, b].map(rows => summary(rows.map(r => r.overlayCorrectionDeg)));
        r.overlayErrorChangeDeg = [a, b].map(rows => summary(rows.map(r => r.gazeErrorDeg - r.noLookGazeErrorDeg)));
      }
      if (mode === 'transition') r.gaitWeightTraceSha256 = await Promise.all([a, b].map(rows => digest(rows.map(r => ({ gait: r.gait, weights: r.weights })))));
      result.modes[mode] = r;
    }
    return result;
  }, reuse);
  assert.deepEqual(report.errors, []);
  const r = report.results; assert.deepEqual(r.specs[0], r.specs[1]); assert.deepEqual(r.nativeDurationS[0], r.nativeDurationS[1]);
  assert.equal(r.switchTraceSha256[0], r.switchTraceSha256[1]);
  assert.ok(r.nestedBlendFrames[0] > 0); assert.deepEqual(r.nestedBlendFrames[0], r.nestedBlendFrames[1]);
  for (const [mode, m] of Object.entries(r.modes)) {
    assert.equal(m.base.samples, { native: 113, play: 600, look: 61, transition: 300 }[mode]); assert.equal(m.base.samples, m.candidate.samples);
    assert.equal(m.maxProtectedWorldMatrixDifference, 0, mode + ' hips/legs changed');
    assert.equal(m.maxProtectedLocalTransformDifference, 0, mode + ' unselected head/neck/arms changed locally');
    assert.equal(m.protectedWorldTraceSha256[0], m.protectedWorldTraceSha256[1]);
    if (mode !== 'native') { assert.equal(m.rootFootIkTraceSha256[0], m.rootFootIkTraceSha256[1]); assert.equal(m.candidate.reachClamps, 0); }
    if (mode === 'transition') assert.equal(m.gaitWeightTraceSha256[0], m.gaitWeightTraceSha256[1]);
    assert.ok(Object.values(m.candidate.metrics).every(s => Object.values(s).every(Number.isFinite)));
  }
  for (const z of r.zeroDt) { assert.equal(z.maximumProtectedWorldMatrixDifference, 0); assert.ok(z.maximumHandTranslationM < 1e-8); assert.ok(z.maximumHeadQuaternionComponentDifference < 1e-12); assert.ok(z.maximumChestQuaternionComponentDifference < 1e-12); }
  for (const s of r.modes.look.overlayErrorChangeDeg) assert.ok(s.max < 0, 'The fixed front target must improve the head-forward proxy at every tested frame');
  for (let i = 0; i < files.length; i++) assert.equal(sha(await fs.readFile(files[i])), expected[i]);
  assert.equal(sha(await fs.readFile(runtimePath)), report.runtimeRawSha256); assert.equal(sha(await fs.readFile(carrierPath)), report.carrierSha256);
  report.pass = true; report.scope = '113 native samples, 600 flat 60Hz puppet frames, 300 real gait-chain transition frames, raw source/native parity, fixed-world head-forward gaze proxy and zero-dt stability; no full player input, terrain/stair or garment collision claim.';
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ pass: true, output, candidateSha256: expected[1], preservation: report.preservation,
    nativeHeadDifferenceDeg: r.modes.native.maxHeadOrientationDifferenceDeg, playHeadDifferenceDeg: r.modes.play.maxHeadOrientationDifferenceDeg,
    playUpperArmL: [r.modes.play.base.metrics.upperArmChestFrameDegL, r.modes.play.candidate.metrics.upperArmChestFrameDegL],
    playUpperArmR: [r.modes.play.base.metrics.upperArmChestFrameDegR, r.modes.play.candidate.metrics.upperArmChestFrameDegR],
    lookHeadDifferenceDeg: r.modes.look.maxHeadOrientationDifferenceDeg, lookGazeErrorDeg: r.modes.look.headForwardTargetErrorDeg, zeroDt: r.zeroDt }, null, 2));
} finally { await browser?.close(); await server.close(); }
