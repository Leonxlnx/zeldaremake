// CPU regression for the Opus 2026-09-25 play-mode body overlays and the head-turn fix.
// Run: node art/environment/opus-cinematic-sept24/motion/check-body.mjs
// Writes check-body.json next to this file. No GPU, no renderer: the production puppet is posed directly.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {ROOT, launchBrowser} from '../../../../gauntlet/scripts/lib/browser.mjs';

const assetFile = 'public/models/link/link-runtime.glb';
const files = ['glbLink.ts', 'animation.ts', 'puppet.ts', 'gaitChain.ts', 'index.ts'].map(n => 'src/world/character/' + n);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const asset = await fs.readFile(path.join(ROOT, assetFile));
const report = {assetSha256: hash(asset), sourceHashes: {}, passed: false, errors: []};
for (const f of files) report.sourceHashes[f] = hash(await fs.readFile(path.join(ROOT, f)));
process.env.ZR_NATIVE_GPU = '0';
// BASELINE=<rev> poses that revision's character sources instead (the overlays' before / after)
const BASE = process.env.BASELINE ? Object.fromEntries(files.map(f => [f, execFileSync('git', ['show', process.env.BASELINE + ':' + f], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26})])) : null;
if (BASE) report.baseline = process.env.BASELINE;
const server = await createServer({root: ROOT, logLevel: 'warn', server: {host: '127.0.0.1', port: 0}, plugins: [{
  name: 'opus-body-check', enforce: 'pre',
  transform(_code, id) { if (!BASE) return; const f = files.find(f => id.replaceAll('\\', '/').endsWith('/' + f)); if (f) return BASE[f]; },
  configureServer(s) {
    s.middlewares.use('/__body-check', (_q, r) => r.end('<!doctype html><title>body check</title>'));
    s.middlewares.use('/models/link/link-runtime.glb', (_q, r) => { r.setHeader('Content-Type', 'model/gltf-binary'); r.end(asset); });
  },
}]});
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__body-check');
  report.results = await page.evaluate(async () => {
    const [{loadGlbLink, LINK_GLB_FILE}, {createLocomotion}, {hardChain, switchGait}, {PLAYER_SPEED, PLAYER_ACCEL, PLAYER_DECEL}, {Vector3, Quaternion}] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'), import('/src/world/character/gaitChain.ts'), import('/src/world/character/animation.ts'), import('/node_modules/three/build/three.module.js'),
    ]);
    const dt = 1 / 60, flat = () => 0;
    const stats = a => a.length ? {min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s, v) => s + v, 0) / a.length} : null;
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const obj = (p, n) => p.group.getObjectByName(n);
    const pos = (p, n) => obj(p, n).getWorldPosition(new Vector3());
    const quat = (p, n) => obj(p, n).getWorldQuaternion(new Quaternion());
    const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a.dot(b))));
    const yawOf = (q, rootYaw) => { const f = new Vector3(0, 0, 1).applyQuaternion(q); return wrap(Math.atan2(f.x, f.z) - rootYaw); };
    const BONES = ['hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'thighL', 'kneeL', 'ankleL', 'thighR', 'kneeR', 'ankleR'];
    const allPose = p => BONES.map(n => [pos(p, n), quat(p, n)]);
    const worst = {}; const poseDiff = (a, b) => { let m = 0; a.forEach(([pa, qa], i) => { const d = Math.max(pa.distanceTo(b[i][0]), qAngle(qa, b[i][1])); worst[BONES[i]] = Math.max(worst[BONES[i]] || 0, d); if (d > m) m = d; }); return m; };
    const out = {};

    // 1. the owner's head bug: idle, facing yaw π, looking at Navi on her OLD world-space orbit (it crosses his back every 12.6 s)
    for (const mode of ['play', 'capture']) {
      const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain('idle'), loco = mode === 'play' ? createLocomotion() : null, contact = new Vector3();
      let prev = null, maxStep = 0, maxStepT = 0, yaws = [];
      for (let i = 0; i < 40 * 60; i++) {
        const t = 10 + i * dt;
        if (loco) { loco.speed = 0; loco.dt = dt; }
        puppet.advance?.(chain, t, 0, dt);
        const look = new Vector3(0.45 * Math.sin(t * 0.5), 1.4, 0.45 * Math.cos(t * 0.5));
        puppet.pose(0, 0, Math.PI, {...chain, t, phase: 0, look, lookWeight: 0.5, idleTurn: 0, loco}, flat, contact);
        const y = yawOf(quat(puppet, 'head'), Math.PI);
        yaws.push(y);
        if (prev !== null && Math.abs(wrap(y - prev)) > maxStep) { maxStep = Math.abs(wrap(y - prev)); maxStepT = t; }
        prev = y;
      }
      out['head-' + mode] = {maxHeadYawStepRad: maxStep, atT: maxStepT, headYawRad: stats(yaws)};
    }

    // 2. steady gaits on flat ground, play mode
    for (const gait of ['walk', 'run']) {
      const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain(gait), loco = createLocomotion(), contact = new Vector3();
      const speed = PLAYER_SPEED[gait], rows = [];
      let maxZeroDt = 0, pose;
      for (let i = 0; i < 600; i++) {
        const t = i * dt; loco.speed = speed; loco.dt = dt; puppet.advance(chain, t, speed * dt, dt);
        pose = {...chain, t, phase: 0, look: new Vector3(0.3, 1.4, speed * t + 0.8), lookWeight: 0.5, idleTurn: 0, loco};
        puppet.pose(0, speed * t, 0, pose, flat, contact);
        if (i < 60) continue;
        const before = allPose(puppet);
        loco.dt = 0; puppet.pose(0, speed * t, 0, pose, flat, contact); loco.dt = dt;
        maxZeroDt = Math.max(maxZeroDt, poseDiff(before, allPose(puppet)));
        rows.push({t, hips: pos(puppet, 'hips'), chestYaw: yawOf(quat(puppet, 'chest'), 0), headYaw: yawOf(quat(puppet, 'head'), 0), feet: puppet.feetContact().map(f => ({...f})), ik: {...puppet.plantInfo()}});
      }
      const slide = [0, 1].map(j => { const s = []; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1].feet[j], b = rows[i].feet[j]; if (a.stance && b.stance) s.push(Math.hypot(b.soleX - a.soleX, b.soleZ - a.soleZ) / dt); } return stats(s); });
      out[gait] = {
        reachClamps: rows.filter(r => r.ik.reachClamped).length, maxZeroDtPose: maxZeroDt,
        hipsLateralM: stats(rows.map(r => r.hips.x)), chestYawRad: stats(rows.map(r => r.chestYaw)), headYawRad: stats(rows.map(r => r.headYaw)),
        plantedSlideMps: slide, minShoeGapM: [0, 1].map(j => Math.min(...rows.map(r => r.feet[j].minShoeGapM))),
        stanceFraction: [0, 1].map(j => rows.filter(r => r.feet[j].stance).length / rows.length),
      };
    }

    // 3. idle -> walk -> run -> walk -> idle with a 90° turn, the production gait hooks
    {
      const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain('idle'), loco = createLocomotion(), contact = new Vector3();
      let x = 0, z = 0, yaw = 0, v = 0, prevChest = null, prevHead = null, prevHipsY = null, maxChestStep = 0, maxHeadStep = 0, maxHipsYStep = 0, clamps = 0, minGap = Infinity, maxZeroDt = 0;
      const hooks = {align: puppet.alignClip.bind(puppet), hasPhase: g => g !== 'idle', anchor: (g, shift, t) => puppet.anchor(x, z, yaw, g, shift, t)};
      for (let i = 0; i < 900; i++) {
        const t = i * dt, sec = i / 60;
        const wanted = sec < 1 ? 'idle' : sec < 4 ? 'walk' : sec < 8 ? 'run' : sec < 11 ? 'walk' : 'idle';
        const goal = PLAYER_SPEED[wanted] * (wanted === 'idle' ? 0 : 1);
        v += Math.sign(goal - v) * Math.min(Math.abs(goal - v), (goal > v ? PLAYER_ACCEL : PLAYER_DECEL) * dt);
        if (sec > 5 && sec < 6.2) yaw = Math.min(Math.PI / 2, yaw + dt * 1.3); // a turn while running
        switchGait(chain, v > .01 ? (wanted === 'idle' ? chain.gait : wanted) : 'idle', t, hooks);
        x += Math.sin(yaw) * v * dt; z += Math.cos(yaw) * v * dt;
        loco.speed = v; loco.dt = dt; puppet.advance(chain, t, v * dt, dt);
        const pose = {...chain, t, phase: 0, look: new Vector3(x + Math.sin(yaw) * 0.8 + 0.3, 1.4, z + Math.cos(yaw) * 0.8), lookWeight: 0.5, idleTurn: 0, loco};
        puppet.pose(x, z, yaw, pose, flat, contact);
        const qc = quat(puppet, 'chest'), qh = quat(puppet, 'head'), hy = pos(puppet, 'hips').y;
        if (prevChest) { maxChestStep = Math.max(maxChestStep, qAngle(prevChest, qc)); maxHeadStep = Math.max(maxHeadStep, qAngle(prevHead, qh)); maxHipsYStep = Math.max(maxHipsYStep, Math.abs(hy - prevHipsY)); }
        prevChest = qc; prevHead = qh; prevHipsY = hy;
        if (puppet.plantInfo().reachClamped) clamps++;
        for (const f of puppet.feetContact()) minGap = Math.min(minGap, f.minShoeGapM);
        const before = allPose(puppet); loco.dt = 0; puppet.pose(x, z, yaw, pose, flat, contact); maxZeroDt = Math.max(maxZeroDt, poseDiff(before, allPose(puppet)));
      }
      out.transitions = {maxChestStepRad: maxChestStep, maxHeadStepRad: maxHeadStep, maxHipsYStepM: maxHipsYStep, reachClamps: clamps, minShoeGapM: minGap, maxZeroDtPose: maxZeroDt, endGait: chain.gait};
    }

    // 4. idle stance: pelvis height (soft knees) and the weight shift
    {
      const puppet = await loadGlbLink('/' + LINK_GLB_FILE), chain = hardChain('idle'), loco = createLocomotion(), contact = new Vector3(), hy = [], hx = [];
      let minGap = Infinity;
      for (let i = 0; i < 600; i++) {
        const t = i * dt; loco.speed = 0; loco.dt = dt; puppet.advance?.(chain, t, 0, dt);
        puppet.pose(0, 0, 0, {...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco}, flat, contact);
        const h = pos(puppet, 'hips'); hy.push(h.y); hx.push(h.x);
        for (const f of puppet.feetContact()) minGap = Math.min(minGap, f.minShoeGapM);
      }
      out.idle = {hipsY: stats(hy), hipsX: stats(hx), minShoeGapM: minGap};
    }
    out.zeroDtWorstByBone = worst;
    return out;
  });
  assert.deepEqual(report.errors, []);
  const r = report.results;
  console.log(JSON.stringify(r, null, 1));
  assert.ok(r['head-play'].maxHeadYawStepRad < 0.02, 'play-mode head yaw step');
  for (const g of ['walk', 'run']) {
    assert.equal(r[g].reachClamps, 0, g + ' reach clamps');
    for (const s of r[g].plantedSlideMps) assert.ok(s.max < 0.005, g + ' planted slide');
    for (const m of r[g].minShoeGapM) assert.ok(m >= -0.0005, g + ' boot penetration');
  }
  assert.equal(r.transitions.reachClamps, 0, 'transition reach clamps');
  // zero-dt: the overlays (chest, neck, head, shoulders) must hold exactly; the legs' mm-level zero-dt drift (stance-pin state,
  // 8.6 mm at a stop) and the elbows' ~1 mrad are pre-existing at 7b0103fa (BASELINE=7b0103fa reproduces them)
  for (const b of ['hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR']) assert.ok(r.zeroDtWorstByBone[b] < 1e-4, b + ' zero-dt pose');
  assert.ok(r.transitions.minShoeGapM >= -0.004, 'transition boot penetration');
  assert.ok(r.idle.minShoeGapM >= -0.001, 'idle boot penetration');
  report.passed = true;
  console.log('PASSED');
} catch (error) { report.failure = String(error?.stack || error); console.error(report.failure); process.exitCode = 1; }
finally { await fs.writeFile(new URL(BASE ? './check-body-baseline.json' : './check-body.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server.close(); }
