/** Run: node --test src/world/structures/podSkin.test.mjs (Node 20+, no browser needed). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Compile only this test's TS dependency graph in memory (the mossTufts test's loader).
const modules = new Map();
function loadTs(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', source)(
    (name) => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return BufferGeometryUtils;
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(file), name);
        for (const candidate of [target, target + '.ts', path.join(target, 'index.ts')]) {
          if (candidate.endsWith('.ts') && existsSync(candidate)) return loadTs(candidate);
        }
      }
      throw new Error(`Unexpected test dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}
const here = path.dirname(fileURLToPath(import.meta.url));
const skin = loadTs(path.join(here, 'podSkin.ts'));
const { rasterisePodSkin, podU, podBulge, POD_BODY_V, POD_CAP_BAND, POD_CORD_BAND, POD_MAP_MEAN, POD_GLOW_CEIL, POD_TEX_SEGMENTS } = skin;
const { buildLantern, restPodMeshes, swingLanterns, POD_RIBS } = loadTs(path.join(here, 'lantern.ts'));
const { createRng } = loadTs(path.join(here, '../util/prng.ts'));
const { rasteriseEndGrain, END_GRAIN_MEAN } = loadTs(path.join(here, 'endGrain.ts'));

const finite = (arr) => {
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return false;
  return true;
};
const bandMean = (r, lo, hi, arr, stride) => {
  let sum = 0;
  let n = 0;
  for (let y = 0; y < r.height; y++) {
    const v = 1 - (y + 0.5) / r.height;
    if (v < lo || v >= hi) continue;
    for (let x = 0; x < r.width; x++) for (let c = 0; c < stride; c++) (sum += arr[(y * r.width + x) * stride + c]), n++;
  }
  return sum / n;
};

test('pod skin: every albedo band integrates to POD_MAP_MEAN, the glow to 1 under its ceiling, all finite', () => {
  const r = rasterisePodSkin('test/pod', 192, 256);
  assert.ok(finite(r.albedo) && finite(r.normal) && finite(r.glow));
  for (const [lo, hi] of [[0, POD_BODY_V], POD_CAP_BAND, POD_CORD_BAND]) {
    const m = bandMean(r, lo, hi, r.albedo, 3);
    assert.ok(Math.abs(m - POD_MAP_MEAN) < 0.01, `band ${lo}-${hi} mean ${m.toFixed(3)}`);
  }
  const g = bandMean(r, 0, POD_BODY_V, r.glow, 1);
  assert.ok(Math.abs(g - 1) < 0.005, `glow mean ${g.toFixed(4)}`);
  let gmax = 0;
  for (let i = 0; i < r.glow.length; i++) gmax = Math.max(gmax, r.glow[i]);
  assert.ok(gmax <= POD_GLOW_CEIL + 1e-3, `glow max ${gmax}`);
  // the dark bands carry no glow
  assert.equal(bandMean(r, POD_BODY_V, 1, r.glow, 1), 0);
  // the normals are unit and mostly upright
  let zmean = 0;
  for (let i = 0; i < r.width * r.height; i++) {
    const n = Math.hypot(r.normal[i * 3], r.normal[i * 3 + 1], r.normal[i * 3 + 2]);
    assert.ok(Math.abs(n - 1) < 1e-4);
    zmean += r.normal[i * 3 + 2];
  }
  assert.ok(zmean / (r.width * r.height) > 0.8);
});

test('pod skin: the body has a seam groove on every segment edge and is lit between them', () => {
  const r = rasterisePodSkin('test/pod', 192, 256);
  const W = r.width;
  const y = Math.floor(r.height * (1 - 0.4)); // mid-body row
  const seamX = (k) => Math.floor(((k + 0.0) / POD_TEX_SEGMENTS) * W) % W;
  const midX = (k) => Math.floor(((k + 0.5) / POD_TEX_SEGMENTS) * W);
  for (let k = 0; k < POD_TEX_SEGMENTS; k++) {
    const gs = r.glow[y * W + seamX(k)];
    const gm = r.glow[y * W + midX(k)];
    assert.ok(gs < gm * 0.7, `segment ${k}: seam glow ${gs.toFixed(2)} vs mid ${gm.toFixed(2)}`);
    const as = r.albedo[(y * W + seamX(k)) * 3];
    const am = r.albedo[(y * W + midX(k)) * 3];
    assert.ok(as < am, `segment ${k}: seam albedo ${as.toFixed(2)} vs mid ${am.toFixed(2)}`);
  }
});

test('pod skin: deterministic for a seed, different for another', () => {
  const a = rasterisePodSkin('seed-a', 96, 128);
  const b = rasterisePodSkin('seed-a', 96, 128);
  const c = rasterisePodSkin('seed-b', 96, 128);
  assert.deepEqual(Array.from(a.albedo), Array.from(b.albedo));
  assert.deepEqual(Array.from(a.glow), Array.from(b.glow));
  assert.notDeepEqual(Array.from(a.normal), Array.from(c.normal));
});

test('pod skin: podU lands every rib seam on an atlas seam, podBulge is 0 on seams and 1 between', () => {
  for (let ribs = POD_RIBS[0]; ribs <= POD_RIBS[1]; ribs++) {
    for (let k = 0; k < ribs; k++) {
      const phi = (k / ribs) * Math.PI * 2;
      const u = podU(phi, ribs) * POD_TEX_SEGMENTS;
      assert.ok(Math.abs(u - Math.round(u)) < 1e-9, `ribs ${ribs} seam ${k}: u·6 = ${u}`);
      assert.ok(podBulge(phi, ribs) < 1e-6);
      assert.ok(Math.abs(podBulge(phi + Math.PI / ribs, ribs) - 1) < 1e-6);
    }
    // the wrap (φ = 2π) is a seam too
    const uw = podU(Math.PI * 2, ribs) * POD_TEX_SEGMENTS;
    assert.ok(Math.abs(uw - Math.round(uw)) < 1e-9);
  }
});

const fakeMats = () => {
  const m = () => new THREE.MeshStandardMaterial();
  return { lantern: m(), lanternLime: m(), lanternFar: m(), lanternLimeFar: m() };
};

test('lantern: one mesh, the round-21 pod centre and rng draws, wind attributes only on the collar', () => {
  const hook = new THREE.Vector3(1.234, 3.5, -2.1);
  const rng = createRng('lantern-test');
  const rig = buildLantern(hook, 0.3, fakeMats(), rng, 1.0, 'orange');
  // the pod centre is hook − (cord + 0.2 · scale)
  assert.ok(rig.pod.distanceTo(new THREE.Vector3(1.234, 3.5 - 0.5, -2.1)) < 1e-9);
  // exactly four draws from the caller's stream (cap tint + phase / amp / speed): the fifth draw
  // matches a fresh stream advanced by four
  const probe = createRng('lantern-test');
  for (let i = 0; i < 4; i++) probe();
  assert.equal(rng(), probe());
  const meshes = [];
  rig.pivot.traverse((o) => o.isMesh && meshes.push(o));
  assert.equal(meshes.length, 1);
  const g = meshes[0].geometry;
  for (const name of ['position', 'normal', 'uv', 'color', 'aPhase', 'aAmount']) assert.ok(g.attributes[name], `attribute ${name}`);
  assert.ok(g.index);
  assert.ok(finite(g.attributes.position.array));
  assert.ok(finite(g.attributes.normal.array));
  // the hook sits at the pivot's origin (the cord's top): the top vertex is at y ≈ 0
  let ymax = -Infinity;
  let ymin = Infinity;
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) (ymax = Math.max(ymax, pos.getY(i))), (ymin = Math.min(ymin, pos.getY(i)));
  assert.ok(Math.abs(ymax) < 0.03, `top ${ymax}`);
  // 2026-09-23 (round 55, the crafted lantern): the tip is an open hoop now, its underside 2.4 cm
  // above the old closed tip
  assert.ok(Math.abs(ymin + 0.3 - -0.456) < 0.02, `bottom ${ymin}`);
  // wind: some vertices move (the collar's tips), most are rigid
  const amt = g.attributes.aAmount;
  let moving = 0;
  for (let i = 0; i < amt.count; i++) if (amt.getX(i) > 0) moving++;
  assert.ok(moving > 0 && moving < amt.count * 0.15, `moving ${moving} / ${amt.count}`);
  // the body's uv sits in the body rows, the rest above POD_BODY_V
  const uv = g.attributes.uv;
  let body = 0;
  let dark = 0;
  for (let i = 0; i < uv.count; i++) (uv.getY(i) < POD_BODY_V ? body++ : dark++);
  assert.ok(body > 500 && dark > 200);
  // triangles: a pod stays under 4.5 k (2026-09-23, round 55: +≈ 1.1 k for the crafted frame — ribs,
  // hoops, the lining seen through the opening, the wick cup and flame; was 4 k)
  assert.ok(g.index.count / 3 < 4500, `${g.index.count / 3} triangles`);
});

test('lantern: deterministic — the same hook and stream build identical vertices', () => {
  const build = () => {
    const rig = buildLantern(new THREE.Vector3(0.5, 2, 0.25), 0.2, fakeMats(), createRng('det'), 0.42, 'lime');
    let g;
    rig.pivot.traverse((o) => o.isMesh && (g = o.geometry));
    return Array.from(g.attributes.position.array);
  };
  assert.deepEqual(build(), build());
});

test('rest pod folds: one hidden shadowless mesh per group and material, every vertex at its pod’s rest pose, rigs untouched', () => {
  const mats = fakeMats();
  const rng = createRng('rest-pods');
  const village = new THREE.Group();
  const hut = new THREE.Group();
  hut.position.set(3, 0.5, -2);
  hut.rotation.y = 0.7;
  const far = new THREE.Group();
  far.position.set(-10, 1, 5);
  far.rotation.y = -1.1;
  village.add(hut, far);
  const rigs = [
    buildLantern(new THREE.Vector3(0, 3, 0), 0.5, mats, rng.fork('a')),
    buildLantern(new THREE.Vector3(1, 3.2, 0.5), 0.4, mats, rng.fork('b'), 1, 'lime'),
    buildLantern(new THREE.Vector3(-1, 2.8, 0.2), 0.6, mats, rng.fork('c'), 0.62),
    buildLantern(new THREE.Vector3(0.5, 4, 1), 0.5, mats, rng.fork('d')),
  ];
  hut.add(rigs[0].pivot, rigs[1].pivot);
  village.add(rigs[2].pivot);
  far.add(rigs[3].pivot);
  swingLanterns(rigs, 3.7, 0.8, 0.6);
  const swung = rigs.map((r) => r.pivot.rotation.toArray());
  const podOf = (r) => r.pivot.children[0];
  const before = rigs.map((r) => Array.from(podOf(r).geometry.attributes.position.array));
  // each pod's world vertices with its pivot unrotated
  const restWorld = (r) => {
    const rot = r.pivot.rotation.clone();
    r.pivot.rotation.set(0, 0, 0);
    village.updateMatrixWorld(true);
    const pos = podOf(r).geometry.attributes.position;
    const out = [];
    for (let i = 0; i < pos.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(podOf(r).matrixWorld));
    r.pivot.rotation.copy(rot);
    return out;
  };
  const expected = rigs.map(restWorld);
  village.updateMatrixWorld(true);

  const folds = restPodMeshes(rigs, [far], village, 'far-bank-pods');
  assert.equal(folds.length, 3, 'orange + lime in the village, orange in the far group');
  const want = [
    { root: village, material: mats.lantern, rigs: [0, 2] },
    { root: village, material: mats.lanternLime, rigs: [1] },
    { root: far, material: mats.lantern, rigs: [3] },
  ];
  village.updateMatrixWorld(true);
  for (const w of want) {
    const fold = folds.find((f) => f.parent === w.root && f.material === w.material);
    assert.ok(fold, `a fold under ${w.root === far ? 'the far group' : 'the village'}`);
    assert.equal(fold.name, 'far-bank-pods');
    assert.equal(fold.visible, false);
    assert.equal(fold.castShadow, false);
    assert.equal(fold.receiveShadow, false);
    const pos = fold.geometry.attributes.position;
    const verts = w.rigs.flatMap((i) => expected[i]);
    assert.equal(pos.count, verts.length);
    let worst = 0;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) worst = Math.max(worst, v.fromBufferAttribute(pos, i).applyMatrix4(fold.matrixWorld).distanceTo(verts[i]));
    assert.ok(worst < 1e-5, `fold vertices off the rest pose by ${worst} m`);
  }
  rigs.forEach((r, i) => {
    assert.deepEqual(r.pivot.rotation.toArray(), swung[i], 'the swing is left alone');
    assert.equal(r.pivot.visible, true);
    assert.equal(podOf(r).name, 'pod-lantern');
    assert.deepEqual(Array.from(podOf(r).geometry.attributes.position.array), before[i], 'the pod geometry is not moved');
  });
});

test('end grain: rings across v, mean END_GRAIN_MEAN, finite, deterministic', () => {
  const a = rasteriseEndGrain('eg', 128, 128);
  const b = rasteriseEndGrain('eg', 128, 128);
  assert.deepEqual(Array.from(a.albedo), Array.from(b.albedo));
  assert.ok(finite(a.albedo) && finite(a.normal));
  let sum = 0;
  for (let i = 0; i < a.albedo.length; i++) sum += a.albedo[i];
  assert.ok(Math.abs(sum / a.albedo.length - END_GRAIN_MEAN) < 0.01);
  // a column crosses several dark ring lines
  let dips = 0;
  for (let y = 1; y + 1 < a.height; y++) {
    const c = (yy) => a.albedo[(yy * a.width + 10) * 3];
    if (c(y) < c(y - 1) && c(y) < c(y + 1) && c(y) < 0.8 * END_GRAIN_MEAN) dips++;
  }
  assert.ok(dips >= 6, `ring dips ${dips}`);
});
