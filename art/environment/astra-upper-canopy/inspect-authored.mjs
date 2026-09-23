// Reuses the existing full-tree CPU worker; only its observation hooks change.
// node inspect-authored.mjs <ref|WORKTREE> <output.json> [existing-worker.mjs]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workerPath = process.argv[4] ?? 'E:/zeldaremake-astra-bank-distribution/art/environment/astra-bank-distribution/geometry-worker.mjs';
const original = fs.readFileSync(workerPath, 'utf8');
let source = original.replaceAll('\r\n', '\n');
const replace = (from, to) => {
  assert.equal(source.split(from).length, 2, `Worker seam: ${from.slice(0, 100)}`);
  source = source.replace(from, to);
};
replace("import { LayeredAudit } from './inspect-surface.mjs';", '');
replace("root = path.resolve(here, '../../..')", `root = ${JSON.stringify(root)}`);
replace('  const layeredAudit = new LayeredAudit();', `
  const measurements = [];
  const inspectParts = (id, parts) => {
    for (const [i, part] of parts.entries()) {
      const state = { deferred: part.deferred, leaves: part.leaves, triangles: part.triangles, woodTriangles: part.woodTriangles };
      const bounds = part.geometry.boundingBox?.clone();
      const started = performance.now();
      let geometry = part.geometry, steps = 0;
      if (part.deferred) {
        const gen = part.build(); let result = gen.next();
        while (!result.done) { steps++; result = gen.next(); }
        geometry = result.value;
      }
      const actual = geometryRecord(geometry);
      const compact = geometry.clone(); load('src/world/trees/index.ts').compactAttributes(compact);
      const packed = geometryRecord(compact); compact.dispose();
      const contains = !state.deferred || bounds.containsBox(geometry.boundingBox);
      measurements.push({ id, i, kind: part.kind, group: part.group, center: part.center.toArray(), radius: part.radius,
        persistent: !!part.persistent, deferred: !!state.deferred, estimatedBytes: part.estimatedBytes ?? actual.bytes,
        rawBytes: actual.bytes, packedBytes: packed.bytes, triangles: actual.triangles, leaves: part.leaves,
        contains, steps, cpuBuildMs: performance.now() - started });
      assert(contains, id + '/' + i + ' deferred bounds');
      if (state.deferred) {
        assert(actual.bytes <= part.estimatedBytes, id + '/' + i + ' conservative bytes');
        geometry.dispose(); Object.assign(part, state);
      }
    }
  };`);
replace("        const bankProof = name === 'createGiantTree' && args[0].id === 'stair-bank-giant' ? layeredAudit.inspect(value, enabled, geometryRecord) : undefined;", "    const bankProof = undefined;\n    if (name === 'createGiantTree') inspectParts(args[0].id, value.nearCanopy);");
replace("    if (file === 'src/world/trees/writer.ts') layeredAudit.wrapWriter(module.exports);", '');
replace("    if (file === 'src/world/trees/nearCanopy.ts') layeredAudit.wrapKit(module.exports);", '');
replace("    if (file === 'src/world/trees/index.ts') {", "    if (file === 'src/world/trees/index.ts') {\n      source = source.replace('const compactAttributes =', 'export const compactAttributes =');");
replace('center: p.center.toArray(), inM:', 'center: p.center.toArray(), radius: p.radius, inM:');
replace('  globalThis.__nonDistantReviewSnapshot({', '  globalThis.__upperRuntime = { nearCanopies, nearCanopyPool, mats };\n  globalThis.__nonDistantReviewSnapshot({');
replace('  trees.group.updateMatrixWorld(true);', `  trees.group.updateMatrixWorld(true);
  const runtime = globalThis.__upperRuntime;
  const poses = [...LAYOUT.viewpoints.filter(p => ['A_stairs', 'C_lookback', 'F_canopy'].includes(p.id)),
    { id: 'upper-southwest-crown', position: [-12, 28, 9], target: [-17.96, 26.78, 2.87], fov: 60 },
    { id: 'upper-envelope-southwest', position: [-45.96, 29, 2.87], target: [-17.96, 26.78, 2.87], fov: 46 }];
  const views = [];
  const pose = p => { camera.position.fromArray(p.position); camera.fov = p.fov; camera.lookAt(...p.target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); };
  const snapshot = () => {
    trees.group.updateMatrixWorld(true);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const shown = runtime.nearCanopies.filter(p => p.mesh.visible).map(p => {
      const g = p.mesh.geometry, sphere = g.boundingSphere.clone().applyMatrix4(p.mesh.matrixWorld);
      return { id: p.id, group: p.group, kind: p.kind, persistent: !!p.persistent, geometry: geometryRecord(g), submitted: frustum.intersectsSphere(sphere), center: p.center.toArray(), dist: p.dist, inM: p.inM, outM: p.outM };
    });
    return { shown, slots: runtime.mats.nearCanopy.value.map(v => v.toArray()) };
  };
  for (const p of poses) {
    runtime.nearCanopyPool.dispose(); pose(p);
    const started = performance.now(); trees.onCameraMove(camera);
    const coldResetMs = performance.now() - started;
    for (let i = 0; i < 6; i++) trees.update(0, 12.6, ctx);
    const cold = snapshot();
    pose({ position: [0, 80, 0], target: [0, 0, 0], fov: 60 }); trees.onCameraMove(camera);
    pose(p); trees.onCameraMove(camera);
    for (let i = 0; i < 6; i++) trees.update(0, 12.6, ctx);
    const warm = snapshot();
    assert.deepEqual(warm, cold, p.id + ': cold/warm explicit pose and six zero-dt frames');
    const submitted = cold.shown.filter(p => p.submitted);
    views.push({ pose: p, coldResetMs, coldWarmEqual: true, shown: cold.shown.map(({ geometry, ...rest }) => ({ ...rest, triangles: geometry.triangles, bytes: geometry.bytes, geometrySha256: geometry.sha256 })), slotsSha256: sha(json(cold.slots)), submittedCalls: submitted.length, submittedTriangles: submitted.reduce((n, p) => n + p.geometry.triangles, 0), pool: runtime.nearCanopyPool.report() });
  }
  delete globalThis.__upperRuntime;`);
replace('    summary, assets, rendered, placementBinding,', `    summary, assets, rendered, placementBinding, measurements,
    views,
    workerProvenance: { path: ${JSON.stringify(workerPath)}, sha256: '${crypto.createHash('sha256').update(original).digest('hex')}', note: 'Existing loader and authored tree creation reused. Measurements build deferred parts on CPU and restore their original metadata before production registration. No renderer or native triangle claim.' },`);
// Ignore only swap-group encoding in aRoot.w when comparing far buffers. The original exact
// hashes remain alongside this canonical hash; shade is quantized to 0.001 for Float32 tags.
replace('  const index = g.index ?', `  const rootAttribute = g.attributes.aRoot;
  let rootWithoutSwapHash;
  if (rootAttribute) {
    const a = Array.from(rootAttribute.array);
    for (let i = 3; i < a.length; i += 4) {
      const w = a[i]; a[i] = Math.round((w >= 1000 ? 1.5 + w % 1 : w >= 2.75 ? 1 : w) * 1000) / 1000;
    }
    rootWithoutSwapHash = sha(Buffer.from(new Float64Array(a).buffer));
  }
  const index = g.index ?`);
replace('return { name: g.name, sha256:', 'return { name: g.name, rootWithoutSwapHash, sha256:');

const tmp = path.join(root, 'gauntlet/tmp/astra-upper-canopy');
fs.mkdirSync(tmp, { recursive: true });
const generated = path.join(tmp, 'reused-geometry-worker.mjs');
fs.writeFileSync(generated, source);
const run = cp.spawnSync(process.execPath, ['--expose-gc', '--max-old-space-size=6144', generated, process.argv[2] ?? 'WORKTREE', '1'], { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
assert.equal(run.status, 0, run.error?.message ?? 'Full-tree worker failed');
fs.writeFileSync(path.resolve(root, process.argv[3]), run.stdout);
const result = JSON.parse(run.stdout);
console.log(JSON.stringify({ ref: result.ref, parts: result.measurements.length, deferred: result.measurements.filter(p => p.deferred).length, rawBytes: result.measurements.reduce((n, p) => n + p.rawBytes, 0), packedBytes: result.measurements.reduce((n, p) => n + p.packedBytes, 0), triangles: result.measurements.reduce((n, p) => n + p.triangles, 0), elapsedSeconds: result.elapsedSeconds }));
