import path from 'node:path';
import { launchBrowser, serveStatic } from '../../../../gauntlet/scripts/lib/browser.mjs';
const dist = process.argv[2];
async function grabHooks(page) {
  const client = await page.createCDPSession();
  try {
    const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
    const objectId = ev.result?.objectId; if (!objectId) return false;
    const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
    const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]'); if (!scopes?.value?.objectId) return false;
    const { result: scopeList } = await client.send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
    for (const sc of scopeList) { if (!sc.value?.objectId) continue; const { result: vars } = await client.send('Runtime.getProperties', { objectId: sc.value.objectId, ownProperties: true });
      for (const v of vars) { if (v.value?.type !== 'object' || !v.value.objectId) continue; const r = await client.send('Runtime.callFunctionOn', { objectId: v.value.objectId, functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }', returnByValue: true }); if (r.result?.value === true) return true; } }
    return false;
  } finally { await client.detach().catch(() => {}); }
}
const server = await serveStatic(path.resolve(dist));
const browser = await launchBrowser({ width: 1280, height: 720 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  await page.goto(`${server.url}/?test=1&dev=0&hud=0&warmup=0&quality=high`, { waitUntil: 'load', timeout: 600000 });
  await page.waitForFunction(() => !!window.__ZR__, { timeout: 600000, polling: 250 });
  await page.evaluate(() => { window.__zrReadyState = 'pending'; Promise.resolve(window.__ZR__.ready()).then(() => (window.__zrReadyState = 'ready'), (e) => (window.__zrReadyState = 'error: ' + e)); });
  await page.waitForFunction(() => window.__zrReadyState !== 'pending', { timeout: 600000, polling: 1000 });
  console.log('ready'); await page.waitForFunction(() => !!window.__ZR_PLAY__, { timeout: 600000, polling: 500 }); console.log('play hooks');
  const readJoints = () => page.evaluate(() => { let root = null; const scene = window.__H?.scene; if (!scene) return 'no __H'; scene.traverse((o) => { if (!root && o.name === 'kokiri-1') root = o; }); if (!root) return 'kokiri-1 not found'; const j = {}; root.traverse((o) => { if (/^(thighL|kneeL|ankleL|hips|chest|shoulderL|elbowL)$/.test(o.name)) j[o.name] = [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(3)); }); return { rootY: +root.position.y.toFixed(3), rootX: +root.position.x.toFixed(2), rootZ: +root.position.z.toFixed(2), j }; });
  await grabHooks(page);
  console.log('view-mode joints (no player):', JSON.stringify(await readJoints()));
  const before = await page.evaluate(() => { try { return window.__ZR__.audit().systems.character.npc.seat.kneeInteriorDeg; } catch (e) { return 'audit error: ' + e.message; } });
  await page.evaluate(() => window.__ZR_PLAY__.place(9.2, 1.4, -2.4));
  await page.evaluate(() => window.__ZR_PLAY__.step(60, 1 / 60, false));
  const r = await page.evaluate(() => {
    let seat = null; try { seat = window.__ZR__.audit().systems.character.npc.seat; } catch (e) { seat = { err: e.message }; }
    const out = { kneeAudit: seat.kneeInteriorDeg ?? seat.err, hips: seat.hips, feet: seat.feet };
    // scan the scene for the kokiri-1 rig and read its joints
    let root = null;
    const scene = (window.__H && window.__H.scene) || null;
    if (scene) scene.traverse((o) => { if (!root && o.name === 'kokiri-1') root = o; });
    if (root) {
      const joints = {};
      root.traverse((o) => { if (/thigh|knee|ankle|hips|shoulder|elbow/.test(o.name)) joints[o.name] = [o.rotation.x, o.rotation.y, o.rotation.z].map((v) => +v.toFixed(3)); });
      out.rootY = +root.position.y.toFixed(3); out.joints = joints;
    } else out.root = 'kokiri-1 not found';
    return out;
  });
  console.log('play-mode joints (Link 1.5 m):', JSON.stringify(await readJoints()));
  const dup = await page.evaluate(() => { const out = []; window.__H.scene.traverse((o) => { if (/^kokiri-\d$/.test(o.name)) { let skinned = 0, meshes = 0, vis = 0; o.traverse((c) => { if (c.isSkinnedMesh) skinned++; else if (c.isMesh) meshes++; if (c.isMesh && c.visible) vis++; }); const p = o.getWorldPosition(new (o.position.constructor)()); out.push({ name: o.name, parent: o.parent?.name, uuid: o.uuid.slice(0, 6), pos: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), visible: o.visible, skinned, meshes, visMeshes: vis, kneeL: +(o.getObjectByName('kneeL')?.rotation.x ?? NaN).toFixed(3) }); } }); return out; });
  // Link 2.2 m in front of her along her facing (yaw -0.699 → fwd (sin, cos) = (-0.643, 0.766)), facing back at her
  await page.evaluate(() => { const yaw = -0.699, fx = Math.sin(yaw), fz = Math.cos(yaw); const rx = Math.cos(yaw), rz = -Math.sin(yaw); const lx = 8.39 + fx * 1.2 + rx * 0.8, lz = 0.32 + fz * 1.2 + rz * 0.8; window.__ZR_PLAY__.place(lx, lz, Math.atan2(-fx, -fz)); });
  await page.evaluate(() => window.__ZR_PLAY__.step(45, 1 / 60, false));
  await page.evaluate(() => window.__ZR_PLAY__.step(1, 1 / 60, true));
  const after = await readJoints();
  await page.screenshot({ path: process.argv[3] });
  console.log('joints right after a rendered frame:', JSON.stringify(after.j.kneeL), JSON.stringify(after.j.thighL));
  // the skinned meshes: skeleton bone for kneeL — does the skeleton's bone list contain the posed joint object?
  const sk = await page.evaluate(() => { let root = null; window.__H.scene.traverse((o) => { if (!root && o.name === 'kokiri-1') root = o; }); const sm = []; root.traverse((c) => { if (c.isSkinnedMesh) sm.push(c); }); const m = sm[0]; const knee = root.getObjectByName('kneeL'); const idx = m.skeleton.bones.indexOf(knee); const bm = m.skeleton.boneMatrices; return { skinnedCount: sm.length, bones: m.skeleton.bones.length, kneeBoneIndex: idx, frame: m.skeleton.frame, bindMode: m.bindMode, boneMatrixKneeRow1: idx >= 0 ? Array.from(bm.slice(idx * 16 + 4, idx * 16 + 8)).map((v) => +v.toFixed(3)) : null, kneeWorldRow1: (() => { const e = knee.matrixWorld.elements; return [e[4], e[5], e[6], e[7]].map((v) => +v.toFixed(3)); })(), visible: m.visible, frustumCulled: m.frustumCulled, sphere: m.boundingSphere ? [+m.boundingSphere.radius.toFixed(2), ...m.boundingSphere.center.toArray().map((v) => +v.toFixed(2))] : null }; });
  console.log('skinning:', JSON.stringify(sk));
  const a1 = await page.evaluate(() => { const a = window.__ZR__.audit().systems.character; return { kids: a?.screen?.kids?.length, seatKnee: a?.npc?.seat?.kneeInteriorDeg }; });
  const j1 = await readJoints();
  console.log('after audit():', JSON.stringify(a1), 'kneeL', JSON.stringify(j1.j.kneeL), 'thighL', JSON.stringify(j1.j.thighL), 'shoulderL', JSON.stringify(j1.j.shoulderL));
  await page.evaluate(() => window.__ZR_PLAY__.step(1, 1 / 60, true));
  const j2 = await readJoints();
  console.log('after one more rendered step:', 'kneeL', JSON.stringify(j2.j.kneeL));
  const cmp = await page.evaluate(() => { const out = {}; for (const name of ['kokiri-0', 'kokiri-1']) { let root = null; window.__H.scene.traverse((o) => { if (!root && o.name === name) root = o; }); const rows = []; root.traverse((c) => { if (!c.isSkinnedMesh) return; const g = c.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; rows.push({ n: c.name, mat: c.material.name || c.material.uuid.slice(0, 6), attrs: Object.keys(g.attributes).join(','), verts: g.attributes.position.count, si0: si ? Array.from(si.array.slice(0, 4)) : null, sw0: sw ? Array.from(sw.array.slice(0, 4)).map((v) => +v.toFixed(2)) : null, siMax: si ? Math.max(...si.array) : null, bones: c.skeleton.bones.length, sameSkel: c.skeleton === root.children.find((x) => x.isSkinnedMesh)?.skeleton, bindMode: c.bindMode, bindId: c.bindMatrix.elements.slice(12, 15).map((v) => +v.toFixed(2)) }); }); out[name] = rows; } return out; });
  for (const [k, rows] of Object.entries(cmp)) { console.log(k); for (const r of rows) console.log('   ', JSON.stringify(r)); }
  console.log('kokiri roots in the scene:'); for (const d of dup) console.log('  ', JSON.stringify(d));
  console.log('knee audit at load', before, '\nafter 60 play frames with Link 1.5 m away:', JSON.stringify(r));
} catch (e) { console.log('probe error:', e.message); } finally { await browser.close(); await server.close(); }
