// CPU broad-phase separation of the actual deformed lower-leg/boot mesh, using original rest classification.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { ROOT, launchBrowser } from '../../../../../gauntlet/scripts/lib/browser.mjs';
const candidate = process.argv[2] || 'natural-run-candidate.glb';
assert.match(candidate, /^[\w-]+\.glb$/);
const report = { kind: 'Transverse interval gap of skinned vertices with ORIGINAL rest y < .30 m; negative is inconclusive, not proof of collision',
  hashes: {}, errors: [], dt: 1 / 60, warmupFrames: 120, sampledFrames: 180 };
for (const asset of ['link-runtime.glb', candidate]) report.hashes[asset] = crypto.createHash('sha256').update(await fs.readFile(path.join(ROOT, 'public/models/link', asset))).digest('hex');
const server = await createServer({ root: ROOT, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'lower-leg-gap', configureServer(s) { s.middlewares.use('/__lower-leg-gap', (_q, r) => r.end('<!doctype html>')); },
}] });
let browser;
try {
  await server.listen(); browser = await launchBrowser(); const page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(server.resolvedUrls.local[0] + '__lower-leg-gap');
  report.results = await page.evaluate(async candidate => {
    const [{ loadGlbLink }, { createLocomotion }, { hardChain }, { Vector3, Matrix4 }] = await Promise.all([
      import('/src/world/character/glbLink.ts'), import('/src/world/character/puppet.ts'),
      import('/src/world/character/gaitChain.ts'), import('/node_modules/three/build/three.module.js'),
    ]);
    const original = await loadGlbLink('/models/link/link-runtime.glb'), next = await loadGlbLink('/models/link/' + candidate);
    const meshList = puppet => { const list = []; puppet.group.traverse(o => { if (o.isSkinnedMesh) list.push(o); }); return list; };
    const meshes = meshList(original), candidateMeshes = meshList(next);
    if (meshes.length !== candidateMeshes.length) throw Error('Mesh topology differs');
    const selected = meshes.map((mesh, m) => {
      const a = mesh.geometry.attributes.position, b = candidateMeshes[m].geometry.attributes.position;
      if (a.count !== b.count || mesh.name !== candidateMeshes[m].name) throw Error('Mesh vertex correspondence differs');
      return Array.from({ length: a.count }, (_, i) => i).filter(i => a.getY(i) < .30).map(i => {
        const x = a.getX(i); if (x === 0) throw Error('Lower-leg vertex on original midline');
        return { i, side: x > 0 ? 'positiveX' : 'negativeX' };
      });
    });
    const output = { selectedMeshes: meshes.map((m, i) => ({ name: m.name, vertexCount: m.geometry.attributes.position.count,
      positiveX: selected[i].filter(v => v.side === 'positiveX').length, negativeX: selected[i].filter(v => v.side === 'negativeX').length })), assets: {} };
    const contact = new Vector3(), point = new Vector3(), inverse = new Matrix4(), transform = new Matrix4(), dt = 1 / 60;
    for (const [asset, puppet, list] of [['link-runtime.glb', original, meshes], [candidate, next, candidateMeshes]]) {
      output.assets[asset] = {};
      for (const gait of ['idle', 'walk', 'run']) {
        const loco = createLocomotion(), chain = hardChain(gait), speed = { idle: 0, walk: 1.6, run: 4.6 }[gait];
        const rows = [];
        for (let frame = 0; frame < 300; frame++) {
          const t = frame * dt; loco.speed = speed; loco.dt = dt;
          puppet.advance(chain, t, speed * dt, dt);
          puppet.pose(0, speed * t, 0, { ...chain, t, phase: 0, look: null, lookWeight: 0, idleTurn: 0, loco }, () => 0, contact);
          if (frame < 120) continue;
          inverse.copy(puppet.group.matrixWorld).invert();
          const bounds = Object.fromEntries(['positiveX', 'negativeX'].map(side => [side, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }]));
          let left = { x: Infinity }, right = { x: -Infinity };
          for (let m = 0; m < list.length; m++) {
            const mesh = list[m]; transform.multiplyMatrices(inverse, mesh.matrixWorld);
            for (const { i, side } of selected[m]) {
              mesh.getVertexPosition(i, point).applyMatrix4(transform);
              const p = point.toArray(), b = bounds[side];
              for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], p[k]); b.max[k] = Math.max(b.max[k], p[k]); }
              if (side === 'positiveX' && point.x < left.x) left = { x: point.x, p, mesh: m, vertex: i };
              if (side === 'negativeX' && point.x > right.x) right = { x: point.x, p, mesh: m, vertex: i };
            }
          }
          rows.push({ frame, time: t, clipShift: chain.clipShift, gapM: left.x - right.x, left, right, bounds });
        }
        const worst = rows.reduce((a, b) => a.gapM < b.gapM ? a : b);
        output.assets[asset][gait] = { sampledFrames: rows.length, minGapM: worst.gapM,
          maxGapM: Math.max(...rows.map(r => r.gapM)), nonpositiveFrames: rows.filter(r => r.gapM <= 0).length, worst };
      }
    }
    return output;
  }, candidate);
  assert.deepEqual(report.errors, []);
  for (const asset of Object.values(report.results.assets)) for (const gait of Object.values(asset)) assert.ok(Number.isFinite(gait.minGapM));
  const out = process.argv[3] || 'art/characters/link/progress/2026-09-20-natural-run/lower-leg-gap.json';
  await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser?.close(); await server.close(); }
