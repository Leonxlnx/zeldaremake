// CPU-only: reconstruct committed geometry and raycast the pixels of the frozen native image.
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';
import * as bufferUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const evidence = process.argv[2] || 'E:/zeldaremake-astra-stones/art/environment/astra-stones/native-pebble837';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const source = (ref, file) => cp.execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 12000000 });
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 'before/manifest.json')));
const view = 'w05-spine-d';
assert.equal(manifest.complete, true);
assert.equal(hash(fs.readFileSync(path.join(evidence, 'before', view + '.png'))), manifest.images[view].sha256);
const pose = manifest.images[view].camera;
const camera = new THREE.PerspectiveCamera(pose.fov, 1280 / 720, 0.1, 500);
camera.position.fromArray(pose.position);
camera.lookAt(camera.position.clone().add(new THREE.Vector3().fromArray(pose.direction)));
camera.updateMatrixWorld(true);

function graph(ref) {
  const modules = new Map();
  function load(file) {
    file = path.posix.normalize(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    let text = source(ref, file);
    // Expose original sprout locations without mutating source or any generated mesh.
    if (file === 'src/world/hardscape/index.ts') {
      const marker = "ctx.progress('hardscape', 1);";
      assert.equal(text.split(marker).length, 2);
      text = text.replace(marker, marker + '\n group.userData.diagnosticSpots = [...spots, ...gritSpots];');
    }
    text = text.replaceAll('import.meta.env', '({})');
    const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', js)(name => {
      if (name === 'three') return THREE;
      if (name === 'three/examples/jsm/utils/BufferGeometryUtils.js') return bufferUtils;
      if (name.startsWith('.')) return load(path.posix.join(path.posix.dirname(file), `${name}.ts`));
      throw Error(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}

const pixels = [[778, 557], [839, 500], [1026, 484], [685, 421], [964, 329], [245, 530], [675, 711], [112, 391], [630, 585], [1125, 607], [995, 373], [875, 431]];
const report = { evidence, image: view, imageSha256: manifest.images[view].sha256, pose, pixels, builds: {} };
for (const ref of [manifest.source.sha, '6c13f70c']) {
  const load = graph(ref), { WORLD } = load('src/world/config.ts'), { LAYOUT } = load('src/world/layout.ts');
  const { createRng } = load('src/world/util/prng.ts');
  const { getTerrain } = load('src/world/terrain/heightfield.ts');
  const audits = new Map();
  const ctx = {
    config: WORLD, layout: LAYOUT, terrain: getTerrain(), rng: createRng(WORLD.seed), camera,
    quality: { tier: 'high', density: 1, distance: 1, shadows: true },
    renderer: { capabilities: { getMaxAnisotropy: () => 4 } },
    textures: { load: async () => new THREE.Texture() }, shared: {},
    wind: load('src/world/wind/wind.ts').createWind(), progress() {},
    audit: (name, fn) => audits.set(name, fn),
  };
  const hardscape = await load('src/world/hardscape/index.ts').create(ctx);
  hardscape.onCameraMove(camera);
  hardscape.group.updateMatrixWorld(true);
  const visible = [];
  hardscape.group.traverseVisible(o => { if (o.isMesh) visible.push(o); });
  const ray = new THREE.Raycaster();
  const rows = pixels.map(pixel => {
    ray.setFromCamera(new THREE.Vector2((pixel[0] + 0.5) / 1280 * 2 - 1, 1 - (pixel[1] + 0.5) / 720 * 2), camera);
    const hit = ray.intersectObjects(visible, false)[0];
    if (!hit) return { pixel, hit: null };
    const object = hit.object, geo = object.geometry;
    const instanceMatrix = new THREE.Matrix4();
    if (object.isInstancedMesh) object.getMatrixAt(hit.instanceId, instanceMatrix);
    const origin = new THREE.Vector3().setFromMatrixPosition(instanceMatrix).applyMatrix4(object.matrixWorld);
    const spot = object.isInstancedMesh ? hardscape.group.userData.diagnosticSpots.find(s => Math.hypot(s.x - origin.x, s.z - origin.z) < 1e-5) : undefined;
    return {
      pixel, object: object.name, material: object.material.name, instanceId: hit.instanceId,
      point: hit.point.toArray(), distance: hit.distance, faceIndex: hit.faceIndex,
      origin: object.isInstancedMesh ? origin.toArray() : null, spot,
      triangles: (geo.index?.count ?? geo.attributes.position.count) / 3,
      wind: geo.attributes.aWind ? [geo.attributes.aWind.getX(hit.face.a), geo.attributes.aWind.getX(hit.face.b), geo.attributes.aWind.getX(hit.face.c)] : null,
      shaderVariant: geo.attributes.aVariant?.getX(hit.face.a),
      maps: { color: Boolean(object.material.map), normal: Boolean(object.material.normalMap), roughness: Boolean(object.material.roughnessMap) },
    };
  });
  report.builds[ref] = { rows, sproutSourceSha256: hash(source(ref, 'src/world/materials/sprouts.ts')), gritSourceSha256: hash(source(ref, 'src/world/materials/grit.ts')), hardscapeAudit: audits.get('hardscape')() };
  hardscape.dispose();
  console.log(ref, JSON.stringify(rows.map(r => ({ pixel: r.pixel, object: r.object, origin: r.origin, kind: r.spot?.kind, source: r.spot?.source }))));
}
assert(report.builds[manifest.source.sha].rows.slice(0, 8).every(r => r.spot.kind === 'cushion' && r.wind.every(v => v === 0)));
assert.equal(report.builds[manifest.source.sha].sproutSourceSha256, report.builds['6c13f70c'].sproutSourceSha256);
fs.writeFileSync(path.join(out, 'blob-identity.json'), JSON.stringify(report, null, 2) + '\n');
