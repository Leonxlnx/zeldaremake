// Production GLB/mixer/IK measurements only; no renderer or forest. Not an animation-quality verdict.
// node art/characters/link/progress/2026-09-20-natural-run-audit/audit.mjs [asset.glb] [report.json] [--assert-zero-dt] [--baseline=baseline.json]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';

const asset = process.argv[2] || 'link-runtime.glb';
assert.match(asset, /^[\w-]+\.glb$/);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const report = {
  kind: 'CPU production puppet audit; +Z forward, +Y up; positive pitch is forward',
  asset,
  assetSha256: hash(await fs.readFile(path.join(ROOT, 'public/models/link', asset))),
  runtimeSha256: hash(await fs.readFile(path.join(ROOT, 'src/world/character/glbLink.ts'))),
  dt: 1 / 60,
  errors: [],
};
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'natural-run-audit', configureServer(s) {
    s.middlewares.use('/__natural-run-audit', (_req, res) => res.end('<!doctype html><title>CPU motion audit</title>'));
  },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__natural-run-audit');
  report.scenarios = await page.evaluate(async asset => {
    const [{ loadGlbLink }, { createLocomotion }, { hardChain }, { Vector3, Quaternion }] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'),
      import('/src/world/character/gaitChain.ts'), import('/node_modules/three/build/three.module.js'),
    ]);
    const names = ['hips', 'chest', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
    const output = {}, dt = 1 / 60, contact = new Vector3(), flat = () => 0;
    const summary = a => ({ min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length });
    const pitch = v => Math.atan2(v.z, -v.y) * 180 / Math.PI;
    for (const gait of ['idle', 'walk', 'run']) for (const play of [false, true]) {
      const puppet = await loadGlbLink('/models/link/' + asset), chain = hardChain(gait), loco = play ? createLocomotion() : null;
      const speed = { idle: 0, walk: 1.6, run: 4.6 }[gait], rows = [];
      const bone = n => puppet.group.getObjectByName(n);
      const snapshot = () => Object.fromEntries(names.map(n => [n, bone(n).getWorldPosition(new Vector3())]));
      let pose;
      for (let i = 0; i < 420; i++) {
        const t = i * dt;
        if (loco) { loco.speed = speed; loco.dt = dt; }
        puppet.advance(chain, t, speed * dt, dt);
        pose = { ...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco };
        puppet.pose(0, speed * t, 0, pose, flat, contact);
        if (i < 120) continue;
        const p = snapshot(), ik = puppet.plantInfo(), row = {
          rootY: puppet.group.position.y,
          kneeOutDeg: ik.kneeOutRad * 180 / Math.PI,
          chestLeanDeg: Math.atan2(p.neck.z - p.chest.z, p.neck.y - p.chest.y) * 180 / Math.PI,
          reachClamped: Number(ik.reachClamped),
        };
        for (const s of ['L', 'R']) {
          const thigh = p['knee' + s].clone().sub(p['thigh' + s]), shin = p['ankle' + s].clone().sub(p['knee' + s]);
          row['upperArmPitch' + s] = pitch(p['elbow' + s].clone().sub(p['shoulder' + s]));
          row['elbowFlex' + s] = p['elbow' + s].clone().sub(p['shoulder' + s]).angleTo(p['hand' + s].clone().sub(p['elbow' + s])) * 180 / Math.PI;
          row['handForwardM' + s] = p['hand' + s].z - p['shoulder' + s].z;
          row['kneeFlex' + s] = thigh.angleTo(shin) * 180 / Math.PI;
          row['kneeLateralM' + s] = (s === 'L' ? 1 : -1) * thigh.x;
          row['ankleLateralM' + s] = (s === 'L' ? 1 : -1) * (p['ankle' + s].x - p['thigh' + s].x);
        }
        rows.push(row);
      }
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
      const result = { samples: rows.length,
        advancingTraceSha256: [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join(''),
        metrics: Object.fromEntries(Object.keys(rows[0]).map(k => [k, summary(rows.map(r => r[k]))])) };
      if (loco) {
        const before = snapshot(), qs = Object.fromEntries(names.map(n => [n, bone(n).getWorldQuaternion(new Quaternion()).normalize()]));
        loco.dt = 0; puppet.pose(0, speed * pose.t, 0, pose, flat, contact); const after = snapshot();
        result.zeroDt = {
          time: pose.t,
          angularChangeDeg: Object.fromEntries(names.map(n => [n, qs[n].angleTo(bone(n).getWorldQuaternion(new Quaternion()).normalize()) * 180 / Math.PI])),
          handMoveM: Object.fromEntries(['L', 'R'].map(s => [s, before['hand' + s].distanceTo(after['hand' + s])])),
        };
      }
      output[gait + (play ? '_play' : '_capture')] = result;
    }
    return output;
  }, asset);
  assert.deepEqual(report.errors, []);
  for (const scenario of Object.values(report.scenarios)) {
    for (const metric of Object.values(scenario.metrics)) assert.ok(Object.values(metric).every(Number.isFinite));
    assert.equal(scenario.metrics.kneeOutDeg.max, 0, 'Flat test must not trigger the stair knee swivel');
  }
  if (process.argv[3]) await fs.writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (process.argv.includes('--assert-zero-dt')) for (const scenario of Object.values(report.scenarios)) {
    if (!scenario.zeroDt) continue;
    for (const movement of Object.values(scenario.zeroDt.handMoveM)) assert.ok(movement < 1e-8, 'Same-time re-pose must not move a hand');
    for (const [bone, angle] of Object.entries(scenario.zeroDt.angularChangeDeg)) {
      if (/^(shoulder|elbow|hand)/.test(bone)) assert.ok(angle < 0.0001, 'Same-time re-pose must not rotate an arm bone');
    }
  }
  const baselineArg = process.argv.find(a => a.startsWith('--baseline='));
  if (baselineArg) {
    const baseline = JSON.parse(await fs.readFile(baselineArg.slice('--baseline='.length), 'utf8'));
    assert.equal(report.assetSha256, baseline.assetSha256, 'Trace equality requires the same character asset');
    for (const [name, scenario] of Object.entries(report.scenarios)) {
      assert.equal(scenario.advancingTraceSha256, baseline.scenarios[name].advancingTraceSha256, 'Advancing motion changed: ' + name);
    }
  }
} finally { await browser?.close(); await server.close(); }
