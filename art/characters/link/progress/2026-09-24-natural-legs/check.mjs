// CPU-only production regression. Run: node art/characters/link/progress/2026-09-24-natural-legs/check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createServer} from 'vite';
import {ROOT, launchBrowser} from '../../../../../gauntlet/scripts/lib/browser.mjs';

const expectedHash = '8d7efa783d4bbc97d053c0a627a28c3c163351d7828124e1bf10c8232f06cedd';
const assetFile = 'public/models/link/link-runtime.glb';
const files = ['glbLink.ts', 'animation.ts', 'puppet.ts', 'gaitChain.ts'].map(n => 'src/world/character/' + n);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const asset = await fs.readFile(path.join(ROOT, assetFile));
assert.equal(hash(asset), expectedHash, 'Unexpected production character asset');
const sources = Object.fromEntries(await Promise.all(files.map(async f => [f, await fs.readFile(path.join(ROOT, f), 'utf8')])));
const report = {assetFile, assetSha256: hash(asset), sourceHashes: Object.fromEntries(files.map(f => [f, hash(sources[f])])), passed: false, errors: []};
process.env.ZR_NATIVE_GPU = '0';
const server = await createServer({root: ROOT, server: {host: '127.0.0.1', port: 0}, plugins: [{
  name: 'production-leg-regression', enforce: 'pre',
  transform(_code, id) { const f = files.find(f => id.replaceAll('\\', '/').endsWith('/' + f)); if (f) return sources[f]; },
  configureServer(s) {
    s.middlewares.use('/__leg-check', (_q, r) => r.end('<!doctype html><title>CPU leg regression</title>'));
    s.middlewares.use('/models/link/link-runtime.glb', (_q, r) => { r.setHeader('Content-Type', 'model/gltf-binary'); r.end(asset); });
  },
}]});
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__leg-check');
  report.results = await page.evaluate(async () => {
    const [{loadGlbLink, LINK_GLB_FILE, LINK_GLB_SHA256, CLIP_SPEC}, {createLocomotion}, {hardChain, switchGait}, {PLAYER_SPEED, PLAYER_ACCEL, PLAYER_DECEL, GAIT_SPEED}, {Vector3}] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'), import('/src/world/character/gaitChain.ts'), import('/src/world/character/animation.ts'), import('/node_modules/three/build/three.module.js'),
    ]);
    const dt = 1 / 60, speed = PLAYER_SPEED.run, groundFlat = () => 0;
    const stats = a => a.length ? {min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length} : null;
    const diff = a => a.slice(1).map((v, i) => v - a[i]);
    const point = (p, n) => p.group.getObjectByName(n).getWorldPosition(new Vector3());
    const snapshot = (p, t, groundY) => ({t, groundY, hipsY: point(p, 'hips').y, feet: p.feetContact(), ik: p.plantInfo(), joints: ['L', 'R'].map(s => {
      const thigh = point(p, 'knee' + s).sub(point(p, 'thigh' + s)), shin = point(p, 'ankle' + s).sub(point(p, 'knee' + s));
      return {side: s, hipPitchDeg: Math.atan2(thigh.z, -thigh.y) * 180 / Math.PI, kneeFlexDeg: thigh.angleTo(shin) * 180 / Math.PI};
    })});
    const summary = rows => {
      const y = rows.map(r => r.hipsY - r.groundY), dy = diff(y);
      return {samples: rows.length, finite: rows.every(r => Number.isFinite(r.hipsY) && r.joints.every(j => Number.isFinite(j.hipPitchDeg + j.kneeFlexDeg))),
        pelvisHeightM: stats(y), pelvisDeltaM: stats(dy), pelvisSecondDifferenceM: stats(diff(dy)),
        reachClamps: rows.filter(r => r.ik.reachClamped).length, maxHipClampRad: Math.max(...rows.map(r => r.ik.hipClampRad)),
        feet: rows[0].feet.map((f, j) => {
          const stanceSpeeds = []; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1].feet[j], b = rows[i].feet[j]; if (a.stance && b.stance) stanceSpeeds.push(Math.hypot(b.soleX - a.soleX, b.soleZ - a.soleZ) / dt); }
          return {side: f.foot, minShoeGapM: stats(rows.map(r => r.feet[j].minShoeGapM)), stanceFraction: rows.filter(r => r.feet[j].stance).length / rows.length,
            groundedFraction: rows.filter(r => Math.abs(r.feet[j].minShoeGapM) < .003).length / rows.length, stanceSpeedMps: stats(stanceSpeeds),
            hipPitchDeg: stats(rows.map(r => r.joints[j].hipPitchDeg)), kneeFlexDeg: stats(rows.map(r => r.joints[j].kneeFlexDeg))};
        })};
    };
    const results = {contract: {file: LINK_GLB_FILE, sha256: LINK_GLB_SHA256, strideM: CLIP_SPEC.run.strideM, playerSpeedMps: speed, nativeSpeedMps: GAIT_SPEED.run, cadenceStepsPerMinute: 120 * speed / CLIP_SPEC.run.strideM}};
    for (const [name, ground] of [['flat', groundFlat], ['up', (_x, z) => z * .15], ['down', (_x, z) => -z * .15]]) {
      const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain('run'), loco = createLocomotion(), contact = new Vector3(), rows = []; let pose;
      for (let i = 0; i < 720; i++) {
        const t = i * dt; loco.speed = speed; loco.dt = dt; puppet.advance(chain, t, speed * dt, dt);
        pose = {...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco}; puppet.pose(0, speed * t, 0, pose, ground, contact);
        if (i >= 120) rows.push(snapshot(puppet, t, ground(0, speed * t)));
      }
      const old = point(puppet, 'hips'); loco.dt = 0; puppet.pose(0, speed * pose.t, 0, pose, ground, contact);
      results[name] = {...summary(rows), zeroDtPelvisM: old.distanceTo(point(puppet, 'hips')), asserted: name === 'flat'};
    }
    // Reuse the production gait hooks for one idle -> run -> stop cycle; no renderer or input emulation.
    const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain('idle'), loco = createLocomotion(), contact = new Vector3(), rows = [];
    let z = 0, velocity = 0, maxZeroDtPelvisM = 0;
    const hooks = {align: puppet.alignClip.bind(puppet), hasPhase: g => g !== 'idle', anchor: (g, shift, t) => puppet.anchor(0, z, 0, g, shift, t)};
    for (let i = 0; i < 360; i++) {
      const t = i * dt, wanted = i >= 60 && i < 240 ? 'run' : 'idle', goal = PLAYER_SPEED[wanted];
      velocity += Math.sign(goal - velocity) * Math.min(Math.abs(goal - velocity), (goal > velocity ? PLAYER_ACCEL : PLAYER_DECEL) * dt);
      switchGait(chain, velocity > .01 ? (wanted === 'idle' ? chain.gait : wanted) : 'idle', t, hooks);
      z += velocity * dt; loco.speed = velocity; loco.dt = dt; puppet.advance(chain, t, velocity * dt, dt);
      const pose = {...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco}; puppet.pose(0, z, 0, pose, groundFlat, contact); rows.push(snapshot(puppet, t, 0));
      const old = point(puppet, 'hips'); loco.dt = 0; puppet.pose(0, z, 0, pose, groundFlat, contact); maxZeroDtPelvisM = Math.max(maxZeroDtPelvisM, old.distanceTo(point(puppet, 'hips')));
    }
    results.transitions = {...summary(rows), maxZeroDtPelvisM, endGait: chain.gait, endSpeedMps: velocity, asserted: ['finite', 'no reach clamps', 'zero-dt pelvis invariance', 'ends stopped', 'shoe gap >= -4 mm'], contactAsserted: true};
    return results;
  });
  assert.deepEqual(report.errors, []);
  for (const f of files) assert.equal(hash(await fs.readFile(path.join(ROOT, f))), report.sourceHashes[f], f + ' changed during check');
  assert.equal(hash(await fs.readFile(path.join(ROOT, assetFile))), expectedHash, 'Production asset changed during check');
  const {contract, flat, transitions} = report.results;
  assert.equal(contract.sha256, expectedHash); assert.equal(contract.strideM, 1.2); assert.equal(contract.playerSpeedMps, 2.2);
  assert.ok(Math.abs(contract.nativeSpeedMps - 1.2 / (28 / 60)) < 1e-9);
  assert.ok(flat.finite); assert.equal(flat.reachClamps, 0); assert.equal(flat.maxHipClampRad, 0); assert.ok(flat.zeroDtPelvisM < 1e-8);
  assert.ok(Math.max(Math.abs(flat.pelvisDeltaM.min), Math.abs(flat.pelvisDeltaM.max)) < .003, 'Flat pelvis frame step');
  assert.ok(Math.max(Math.abs(flat.pelvisSecondDifferenceM.min), Math.abs(flat.pelvisSecondDifferenceM.max)) < .0015, 'Flat pelvis high-frequency movement');
  for (const f of flat.feet) {
    assert.ok(f.stanceFraction >= .25 && f.stanceFraction <= .36, f.side + ' support duration');
    assert.ok(f.minShoeGapM.max > .09 && f.minShoeGapM.max < .15, f.side + ' heel recovery');
    assert.ok(f.minShoeGapM.min >= -.0001, f.side + ' boot penetration');
    assert.ok(f.stanceSpeedMps.max < .005, f.side + ' planted-foot sliding');
    assert.ok(f.kneeFlexDeg.max >= 110 && f.kneeFlexDeg.max <= 135, f.side + ' knee recovery');
    assert.ok(f.hipPitchDeg.max < 70, f.side + ' excessive knee lift');
  }
  assert.ok(transitions.finite); assert.equal(transitions.reachClamps, 0); assert.ok(transitions.maxZeroDtPelvisM < 1e-8);
  assert.equal(transitions.endGait, 'idle'); assert.equal(transitions.endSpeedMps, 0);
  for (const f of transitions.feet) assert.ok(f.minShoeGapM.min >= -.004, f.side + ' transition boot penetration');
  report.transitionNote = 'Foot targets respect the current boot footprint lower bound; steady-run gap >= -0.1 mm and start/stop gap >= -4 mm are asserted.';
  report.slopeNote = 'Slopes are report-only: historical downhill sole flotation remains about 9.7 mm; no slope-contact pass is claimed.';
  report.passed = true;
  console.log(JSON.stringify({passed: true, assetSha256: report.assetSha256, flatMaximumStepMm: 1000 * Math.max(Math.abs(flat.pelvisDeltaM.min), Math.abs(flat.pelvisDeltaM.max)), flatMinimumShoeGapMm: 1000 * Math.min(...flat.feet.map(f => f.minShoeGapM.min)), slopeContactAsserted: false, transitionContactAsserted: true}));
} catch (error) { report.failure = String(error); throw error; }
finally { await fs.writeFile(new URL('./check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server.close(); }
