/** Matched visible canopy route, run twice in one page to separate first use from warmed movement. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function captureTransition(page, out) {
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const result = { dt: 1 / 30, startZ: -17.5, endZ: -44.1, travelFrames: 90, turnFrames: 60, holdFrames: 15, passes: [], moduleSha256: hash(await fs.readFile(new URL(import.meta.url))) };
  await page.evaluate(async () => {
    window.__crownRead = () => {
      const audit = __ZR__.audit().systems.trees, perf = __ZR__.perf(), meshes = [];
      let visiblePointLights = 0, totalPointLights = 0;
      window.__probeScene.traverse(light => {
        if (!light.isPointLight) return;
        totalPointLights++;
        for (let p = light; p; p = p.parent) if (!p.visible) return;
        if (light.layers.test(window.__probeCamera.layers)) visiblePointLights++;
      });
      window.__probeScene.getObjectByName('trees').traverse(m => {
        if (m.userData.kind !== 'distant-close-crown' || !m.visible) return;
        const a = m.geometry.getAttribute('aDistantClose');
        meshes.push({ name: m.name, count: m.count, indices: m.geometry.index?.count ?? 0, fade: a?.array ? Array.from(a.array).slice(0, m.count) : null });
      });
      return { stats: __ZR__.stats(), camera: __ZR__.cameraPose(), close: audit.distantClose ?? null, pool: perf.systemPerf.trees, treeUpdateMs: perf.systems.trees, meshes, visiblePointLights, totalPointLights };
    };
    window.__crownBootPool=window.__crownRead();
    const poseStarted=performance.now();
    const y = __ZR__.probe(4.68, -17.5).height + 1.8;
    __ZR__.setPose([4.68, y, -17.5], [4.77, y + 10, -18.5], 46);
    __ZR__.setTime(12.6);
    window.__crownFirstPoseMs=performance.now()-poseStarted;
  });
  result.boot = await page.evaluate(() => ({ firstPoseMs:window.__crownFirstPoseMs, state:window.__crownBootPool }));
  result.start = await page.evaluate(() => window.__crownRead());
  for (const pass of ['first', 'warm']) {
    const rows = [], shots = [];
    await fs.mkdir(path.join(out, pass), { recursive: true });
    await page.evaluate(() => __ZR__.setTime(12.6));
    let prior = await page.evaluate(() => window.__crownRead());
    const start=prior;
    for (let k = 0; k < 255; k++) {
      const row = await page.evaluate(async ({ k, dt }) => {
        const phase = k < 90 ? 'approach' : k < 150 ? 'turn' : k < 240 ? 'retreat' : 'hold';
        const z = phase === 'approach' ? -17.5 - 26.6 * (k + 1) / 90 : phase === 'turn' ? -44.1 : phase === 'retreat' ? -44.1 + 26.6 * (k - 149) / 90 : -17.5;
        // End at the exact reviewed w19 pose; the 0.351 m correction is eased over its last metre.
        const y = __ZR__.probe(4.68, z).height + 1.8 - .3510576581999998 * Math.max(0, Math.min(1, -43.1 - z));
        const turn = phase === 'turn' ? 2 * Math.PI * (k - 89) / 60 : 0;
        const yaw = Math.atan2(.09, -1) + turn, reach = Math.hypot(.09, 1), camera = window.__probeCamera;
        camera.position.set(4.68, y, z);
        camera.lookAt(4.68 + reach * Math.sin(yaw), y + 10, z + reach * Math.cos(yaw));
        camera.updateMatrixWorld(true);
        const start = performance.now();
        await __ZR__.render(1, dt);
        const gl = window.__probeRenderer.getContext();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        const completedMs = performance.now() - start;
        return { k, phase, completedMs, ...window.__crownRead() };
      }, { k, dt: result.dt });
      if (row.close) {
        assert(row.close.active <= 8 && row.close.triangles <= row.close.triangleCeiling);
        assert(row.meshes.every(m => m.indices > 0 && m.fade?.length === m.count && m.fade.every(w => w > 0 && w <= 1)));
        const old = new Map(prior.close.weights);
        for (const [id, weight] of row.close.weights) { assert(Math.abs(weight - (old.get(id) ?? 0)) <= result.dt / .25 + 1e-6); old.delete(id); }
        assert([...old.values()].every(w => w <= result.dt / .25 + 1e-6));
      }
      rows.push(row); prior = row;
      if (pass === 'warm') {
        const file = `${pass}/${String(k).padStart(4, '0')}.jpg`, bytes = await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 82 });
        shots.push({ k, file, sha256: hash(bytes) });
      }
      if (k % 60 === 0) console.log(path.basename(out), pass, k, row.phase, row.close?.active ?? 0, 'slots');
    }
    result.passes.push({ name: pass, start, rows, shots });
    await fs.writeFile(path.join(out, 'trace.json'), JSON.stringify(result) + '\n');
  }
  return { file: 'trace.json', traceSha256:hash(await fs.readFile(path.join(out,'trace.json'))), moduleSha256: result.moduleSha256, framesPerPass: 255, passes: ['first', 'warm'] };
}
