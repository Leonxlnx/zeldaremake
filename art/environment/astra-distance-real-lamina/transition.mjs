/** Frozen-build acceptance probe. Only endpoint jumps use setPose; motion keeps ordinary LOD history. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function captureTransition(page, out) {
  const result = { dt: 1 / 30, frames: [], shots: [], note: 'Native high defaults; camera route, not player collision/FPS validation. First jump is measured separately. Video samples every second simulated frame (15 fps).' };
  await page.evaluate(() => {
    window.__laminaRead = () => {
      const trees = __ZR__.audit().systems.trees, perf = __ZR__.perf();
      const meshes = window.__probeScene.getObjectByName('distant-trees') ?? window.__probeScene.getObjectByName('trees');
      const close = [];
      meshes.traverse(m => {
        if (m.userData.kind !== 'distant-close-crown' || !m.visible) return;
        const fade = m.geometry.getAttribute('aDistantClose');
        close.push({ name: m.name, count: m.count, indices: m.geometry.index?.count ?? 0, fade: fade?.array ? Array.from(fade.array).slice(0, m.count) : null });
      });
      return { stats: __ZR__.stats(), camera: __ZR__.cameraPose(), distantClose: trees.distantClose, lod: trees.distantLod, pool: perf.systemPerf.trees, updateMs: perf.systems.trees, close };
    };
  });
  result.boot = await page.evaluate(() => window.__laminaRead());
  // This is the first visit to a close-crown pose. Report whether it actually required builds;
  // the existing pool may already have retained the initial measurement geometries.
  result.firstJump = await page.evaluate(async () => {
    const before = window.__laminaRead(), start = performance.now();
    __ZR__.setPose([54.00101693066348, 21.992752345655013, -165.33335274009295], [35.616240619813254, 37.51479429090839, -146.9485764292427], 60);
    const poseMs = performance.now() - start;
    await __ZR__.render(1, 0);
    const gl = window.__probeRenderer.getContext();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return { before, poseMs, completedMs: performance.now() - start, after: window.__laminaRead() };
  });
  await page.evaluate(async () => {
    const y = __ZR__.probe(4.68, -8).height + 1.8;
    __ZR__.setPose([4.68, y, -8], [4.68, y + 12, -16], 60);
    __ZR__.setTime(12.6);
    await __ZR__.render(1, 0);
  });
  let previous = await page.evaluate(() => window.__laminaRead());
  const allIds = new Set();
  let fractionalFrames = 0;
  const frameDir = path.join(out, 'frames');
  await fs.mkdir(frameDir, { recursive: true });
  for (let k = 0; k < 540; k++) {
    const row = await page.evaluate(async ({ k, dt }) => {
      const phase = k < 180 ? 'approach' : k < 300 ? 'turn' : k < 480 ? 'retreat' : 'hold';
      const z = phase === 'approach' ? -8 - 48 * (k + 1) / 180 : phase === 'turn' ? -56 : phase === 'retreat' ? -56 + 48 * (k - 299) / 180 : -8;
      const yaw = phase === 'turn' ? 2 * Math.PI * (k - 179) / 120 : 0;
      const camera = window.__probeCamera, y = __ZR__.probe(4.68, z).height + 1.8;
      camera.position.set(4.68, y, z);
      camera.lookAt(4.68 + 8 * Math.sin(yaw), y + 12, z - 8 * Math.cos(yaw));
      camera.updateMatrixWorld(true);
      const start = performance.now();
      await __ZR__.render(1, dt);
      const gl = window.__probeRenderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      const completedMs = performance.now() - start;
      return { k, phase, completedMs, ...window.__laminaRead() };
    }, { k, dt: result.dt });
    const close = row.distantClose, old = new Map(previous.distantClose.weights);
    assert(close.active <= 8 && close.triangles <= close.triangleCeiling && close.draws <= 6);
    assert(row.close.every(m => m.indices > 0 && m.fade?.length === m.count && m.fade.every(v => v > 0 && v <= 1)), 'Visible replacement lost uploaded geometry/fade');
    assert.equal(row.close.reduce((n, m) => n + m.count, 0), close.weights.filter(([, w]) => w > 0).length);
    for (const [id, weight] of close.weights) {
      assert(weight >= 0 && weight <= 1);
      assert(Math.abs(weight - (old.get(id) ?? 0)) <= result.dt / .25 + 1e-6, 'Ordinary fade jumped');
      allIds.add(id);
      old.delete(id);
    }
    assert([...old.values()].every(w => w <= result.dt / .25 + 1e-6), 'Retiring slot vanished early');
    fractionalFrames += Number(close.weights.some(([, w]) => w > 0 && w < 1));
    result.frames.push(row);
    previous = row;
    if (k % 2 === 0) {
      const file = `frames/${String(k / 2).padStart(4, '0')}.jpg`;
      const bytes = await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 82 });
      result.shots.push({ k, file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    }
    if (k % 60 === 0) console.log('Ordinary transition frame', k, row.phase, 'slots', close.active);
  }
  result.coverage = { distinctIds: allIds.size, fractionalFrames, maxSlots: Math.max(...result.frames.map(r => r.distantClose.active)), maxCloseTriangles: Math.max(...result.frames.map(r => r.distantClose.triangles)) };
  assert(allIds.size > 8 && fractionalFrames > 0, 'Route did not exercise turnover and fades');
  result.returns = {};
  for (const id of ['A_stairs', 'F_canopy']) {
    await page.evaluate(async id => { __ZR__.setViewpoint(id); __ZR__.setTime(12.6); await __ZR__.render(14, 0); }, id);
    const bytes = await page.screenshot({ path: path.join(out, `${id}-return.png`) });
    const row = await page.evaluate(() => window.__laminaRead());
    const before = await fs.readFile(path.join(out, '..', 'native-before', `${id}.png`));
    row.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
    row.pixelIdenticalToBaseline = bytes.equals(before);
    assert.equal(row.distantClose.active, 0);
    result.returns[id] = row;
  }
  await fs.writeFile(path.join(out, 'transition.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('Transition coverage', result.coverage);
  return { file: 'transition.json', coverage: result.coverage, returns: Object.fromEntries(Object.entries(result.returns).map(([id, r]) => [id, { sha256: r.sha256, pixelIdenticalToBaseline: r.pixelIdenticalToBaseline }])) };
}
