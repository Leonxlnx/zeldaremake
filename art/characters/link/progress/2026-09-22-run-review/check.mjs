// Reproduce this review with the current production asset and CPU puppet; no renderer or writes.
// node art/characters/link/progress/2026-09-22-run-review/check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

process.env.ZR_NATIVE_GPU = '0';
const dir = path.join(ROOT, 'art/characters/link/progress/2026-09-22-run-review');
const reference = JSON.parse(await fs.readFile(path.join(dir, 'current-run.json'), 'utf8'));
const assetPath = path.join(ROOT, 'public/models/link/link-runtime.glb');
const sourcePath = path.join(ROOT, 'src/world/character/glbLink.ts');
const helperPath = path.join(ROOT, 'art/characters/link/progress/2026-09-21-run-carriage/compare.mjs');
const [bytes, source, helper] = await Promise.all([
  fs.readFile(assetPath), fs.readFile(sourcePath, 'utf8'), fs.readFile(helperPath, 'utf8'),
]);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
assert.equal(hash(bytes), reference.assetSha256, 'This review is pinned to the accepted 4dcf asset');
assert.equal(hash(helper.replace(/\r\n/g, '\n')), reference.reuseHelperNormalizedLfSha256,
  'Existing snapshot helper changed (CRLF normalized to LF)');
const sourceSha = hash(source);
const start = helper.indexOf('const snapshot=root=>{'), end = helper.indexOf('const digest=async rows=>');
assert.ok(start >= 0 && end > start);
const snapshotSource = helper.slice(start, end).trim().replace(/^const snapshot=/, '').replace(/;$/, '');
const anchor = '    armsDirty = true;';
assert.equal(source.split(anchor).length, 2, 'Passive mixer hook must be unambiguous');
const observedSource = source.replace(anchor,
  '    globalThis.__runReviewMixer = Object.fromEntries(armBones.map((b, i) => [b.name, armMix[i].toArray()]));\n' + anchor);
const errors = [];
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'read-only-run-review', enforce: 'pre',
  load(id) { if (id.split('?')[0].replaceAll('\\', '/').endsWith('/src/world/character/glbLink.ts')) return observedSource; },
  configureServer(s) {
    s.middlewares.use('/__run-review', (_req, res) => res.end('<!doctype html><title>CPU run review</title>'));
    s.middlewares.use('/__review-asset.glb', (_req, res) => { res.setHeader('Content-Type', 'model/gltf-binary'); res.end(bytes); });
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__run-review');
  const result = await page.evaluate(async snapshotSource => {
    const [{ loadGlbLink }, { createLocomotion }, { hardChain }, { Vector3, Quaternion, AnimationMixer, LoopOnce }, { GLTFLoader }] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'), import('/src/world/character/gaitChain.ts'),
      import('/node_modules/three/build/three.module.js'), import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js'),
    ]);
    const points = ['hips', 'chest', 'neck', 'head', ...['thigh', 'knee', 'ankle', 'toe', 'shoulder', 'elbow', 'hand'].flatMap(n => [n + 'L', n + 'R'])];
    const protectedBones = ['hips', 'chest', 'neck', 'head', 'cap', ...['thigh', 'knee', 'ankle', 'toe'].flatMap(n => [n + 'L', n + 'R'])];
    const deg = 180 / Math.PI, snapshot = eval('(' + snapshotSource + ')');
    const enrich = row => {
      const p = Object.fromEntries(Object.entries(row.points).map(([n, v]) => [n, new Vector3(...v)])), m = row.metrics;
      const slope = (p.neck.z - p.hips.z) / (p.neck.y - p.hips.y);
      for (const s of ['L', 'R']) {
        const shoulder = p['shoulder' + s], elbow = p['elbow' + s], hand = p['hand' + s];
        const hip = p['thigh' + s], knee = p['knee' + s], ankle = p['ankle' + s], sign = s === 'L' ? 1 : -1;
        m['upperArmRelativeTorsoDeg' + s] = m['upperArmPitch' + s] + m.torsoLeanDeg;
        m['upperArmRelativeChestDeg' + s] = m['upperArmPitch' + s] + m.chestLeanDeg;
        m['elbowAheadShoulderParallelTorsoM' + s] = elbow.z - shoulder.z - (elbow.y - shoulder.y) * slope;
        const forearm = hand.clone().sub(elbow);
        m['forearmRelativeTorsoDeg' + s] = Math.atan2(forearm.z, -forearm.y) * deg + m.torsoLeanDeg;
        m['handAheadTorsoPlaneM' + s] = hand.z - (p.hips.z + (hand.y - p.hips.y) * slope);
        m['handAheadHipsM' + s] = hand.z - p.hips.z;
        const axis = ankle.clone().sub(hip), near = hip.clone().addScaledVector(axis, knee.clone().sub(hip).dot(axis) / axis.lengthSq());
        m['kneeLateralToHipAnkleM' + s] = sign * (knee.x - near.x);
        m['kneeLateralToHipM' + s] = sign * (knee.x - hip.x);
        m['ankleLateralToHipM' + s] = sign * (ankle.x - hip.x);
      }
      return row;
    };
    const stats = a => ({ min: Math.min(...a), max: Math.max(...a), mean: a.reduce((x, y) => x + y, 0) / a.length });
    const summarize = rows => ({ samples: rows.length, metrics: Object.fromEntries(Object.keys(rows[0].metrics).map(k => [k, stats(rows.map(r => r.metrics[k]))])),
      upperArmBehindTorsoFraction: Object.fromEntries(['L', 'R'].map(s => [s, rows.filter(r => r.metrics['upperArmRelativeTorsoDeg' + s] < 0).length / rows.length])) });
    const native = [], gltf = await new GLTFLoader().loadAsync('/__review-asset.glb'), mixer = new AnimationMixer(gltf.scene);
    const clip = gltf.animations.find(c => c.name === 'run'), action = mixer.clipAction(clip).setLoop(LoopOnce, 1);
    action.clampWhenFinished = true; action.play();
    for (let i = 0; i <= 112; i++) {
      action.enabled = true; action.paused = false; action.time = clip.duration * i / 112;
      mixer.update(0); gltf.scene.updateMatrixWorld(true); native.push(enrich(snapshot(gltf.scene)));
    }
    const puppet = await loadGlbLink('/__review-asset.glb'), chain = hardChain('run'), loco = createLocomotion();
    const flat = () => 0, contact = new Vector3(), dt = 1 / 60, speed = 4.6, current = [], raw = [], ik = [];
    const arms = ['shoulderL', 'shoulderR', 'elbowL', 'elbowR'].map(n => puppet.group.getObjectByName(n));
    let pose, protectedDifference = 0;
    for (let i = 0; i < 720; i++) {
      const t = i * dt; loco.speed = speed; loco.dt = dt; puppet.advance(chain, t, speed * dt, dt);
      pose = { ...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco };
      puppet.pose(0, speed * t, 0, pose, flat, contact);
      if (i < 120) continue;
      const row = enrich(snapshot(puppet.group)); current.push(row); ik.push({ ...puppet.plantInfo() });
      const actual = arms.map(b => b.quaternion.clone());
      arms.forEach(b => b.quaternion.fromArray(globalThis.__runReviewMixer[b.name])); puppet.group.updateMatrixWorld(true);
      const preOverlay = enrich(snapshot(puppet.group)); raw.push(preOverlay);
      protectedDifference = Math.max(protectedDifference, ...row.protected.map((v, j) => Math.abs(v - preOverlay.protected[j])));
      arms.forEach((b, j) => b.quaternion.copy(actual[j])); puppet.group.updateMatrixWorld(true);
    }
    const before = snapshot(puppet.group); loco.dt = 0; puppet.pose(0, speed * pose.t, 0, pose, flat, contact); const after = snapshot(puppet.group);
    return { native: summarize(native), mixerAtPlayClock: summarize(raw), current: summarize(current), protectedDifference,
      kneeOutRad: stats(ik.map(r => r.kneeOutRad)), hipClampRad: stats(ik.map(r => r.hipClampRad)), reachClampedFrames: ik.filter(r => r.reachClamped).length,
      zeroDtHandDifferenceM: Math.max(...['L', 'R'].map(s => new Vector3(...before.points['hand' + s]).distanceTo(new Vector3(...after.points['hand' + s])))) };
  }, snapshotSource);
  assert.deepEqual(errors, []);
  for (const mode of ['native', 'mixerAtPlayClock', 'current']) {
    assert.equal(result[mode].samples, reference.result[mode].samples);
    const expected = { ...reference.result[mode].metrics, ...reference.torsoRelativeReview[mode].metrics };
    for (const [key, metric] of Object.entries(expected)) for (const field of ['min', 'max', 'mean'])
      assert.ok(Math.abs(result[mode].metrics[key][field] - metric[field]) < 1e-9, mode + '/' + key + '/' + field);
    assert.deepEqual(result[mode].upperArmBehindTorsoFraction, reference.torsoRelativeReview[mode].upperArmBehindTorsoFraction);
  }
  assert.equal(result.protectedDifference, 0); assert.equal(result.reachClampedFrames, 0);
  for (const k of ['kneeOutRad', 'hipClampRad']) assert.deepEqual(result[k], { min: 0, max: 0, mean: 0 });
  assert.ok(result.zeroDtHandDifferenceM < 1e-8);
  assert.equal(hash(await fs.readFile(assetPath)), reference.assetSha256); assert.equal(hash(await fs.readFile(sourcePath)), sourceSha);
  console.log(JSON.stringify({ pass: true, assetSha256: reference.assetSha256, runtimeSha256: sourceSha,
    originalReviewRuntime: sourceSha === reference.runtimeSha256, nativeSamples: result.native.samples, playSamples: result.current.samples,
    upperArmTorsoL: result.current.metrics.upperArmRelativeTorsoDegL, upperArmTorsoR: result.current.metrics.upperArmRelativeTorsoDegR,
    protectedDifference: result.protectedDifference, zeroDtHandDifferenceM: result.zeroDtHandDifferenceM }, null, 2));
} finally { await browser?.close(); await server.close(); }
